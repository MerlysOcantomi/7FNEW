import { db } from "@core/db"

/**
 * Platform audit log — write helper, sanitiser and read accessor.
 *
 * The store is `PlatformAuditLog` (see `prisma/schema.prisma`). Every write
 * goes through `logPlatformAudit` which:
 *
 *   1. Sanitises the metadata payload (strips secret-shaped keys, truncates
 *      long strings, drops non-serialisable values).
 *   2. Extracts a safe IP + user-agent from the originating `Request`.
 *   3. Inserts as TEXT (JSON-serialised metadata) — same convention the rest
 *      of the codebase uses for JSON fields in SQLite/libSQL.
 *
 * Reads happen through `listPlatformAuditLogs` and ARE allowed to fan-out to
 * `User` to enrich `actorId` with name/email — the actor is always a
 * platform admin, never a tenant user, so no cross-tenant boundary is
 * crossed by that join.
 *
 * Failure policy: WRITE failures NEVER throw to the caller. The audit trail
 * is best-effort; a missing row is preferable to taking down a working
 * mutation. We log a sanitised warning so operators notice persistent
 * audit-write failures (e.g. table missing in production).
 */

/**
 * String enum-ish for action codes. We deliberately don't lock it down to a
 * union — new actions ship faster than the type ergonomics deserve. Convention:
 *
 *   `<entity>.<verb>` — lowercase, dot-separated, no spaces.
 *   e.g. `user.update`, `allowed_email.delete`, `workspace.suspend`.
 */
export type PlatformAuditAction = string

/**
 * Keys that MUST never reach the audit log. Match is case-insensitive on the
 * key name — value is irrelevant. Anything that smells like a secret, a raw
 * payload, or a long-form free-text body goes here.
 *
 * NEW entries: be aggressive. Audit logs are operator-readable, often
 * exported, and visible to every PlatformAdmin including BILLING / SUPPORT.
 */
const SENSITIVE_KEY_PATTERNS = new Set<string>([
  "password",
  "token",
  "secret",
  "credential",
  "credentials",
  "refreshtoken",
  "accesstoken",
  "authtoken",
  "config",
  "body",
  "message",
  "emailbody",
  "content",
])

/**
 * Hard caps to keep audit rows small. Strings that look like raw payloads
 * leaking through (a JSON blob serialised by a caller, a stack trace, …)
 * get cut. The replacement marker preserves the fact that data was elided
 * without leaking it.
 */
const MAX_STRING_LENGTH = 512
const MAX_OBJECT_KEYS = 32
const MAX_ARRAY_LENGTH = 32
const MAX_DEPTH = 4
const REDACTED_MARK = "[redacted]"
const TRUNCATED_MARK = "…[truncated]"

/**
 * Recursively walk a metadata payload and:
 *   - drop sensitive-shaped keys entirely (no placeholder; their PRESENCE
 *     can be sensitive too)
 *   - reject non-JSON-safe values (functions, symbols, undefined, bigint…)
 *   - truncate long strings
 *   - cap object/array sizes
 *   - cap recursion depth (prevents blowups on cyclic references)
 *
 * Returns a plain JSON-serialisable object or `undefined` if input is null /
 * already empty.
 */
export function sanitizeAuditMetadata(
  raw: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!raw || typeof raw !== "object") return undefined

  const out = sanitizeValue(raw, 0)
  if (!out || typeof out !== "object" || Array.isArray(out)) return undefined
  if (Object.keys(out).length === 0) return undefined
  return out as Record<string, unknown>
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (value === null) return null
  if (depth > MAX_DEPTH) return REDACTED_MARK

  switch (typeof value) {
    case "string":
      return value.length > MAX_STRING_LENGTH
        ? value.slice(0, MAX_STRING_LENGTH) + TRUNCATED_MARK
        : value
    case "number":
      return Number.isFinite(value) ? value : null
    case "boolean":
      return value
    case "bigint":
      // JSON.stringify can't handle bigint; coerce conservatively.
      return value.toString()
    case "undefined":
    case "function":
    case "symbol":
      return undefined
    case "object": {
      if (value instanceof Date) return value.toISOString()
      if (Array.isArray(value)) {
        return value
          .slice(0, MAX_ARRAY_LENGTH)
          .map((v) => sanitizeValue(v, depth + 1))
          .filter((v) => v !== undefined)
      }
      const entries = Object.entries(value as Record<string, unknown>).slice(
        0,
        MAX_OBJECT_KEYS,
      )
      const next: Record<string, unknown> = {}
      for (const [k, v] of entries) {
        if (SENSITIVE_KEY_PATTERNS.has(k.toLowerCase())) continue
        const cleaned = sanitizeValue(v, depth + 1)
        if (cleaned !== undefined) next[k] = cleaned
      }
      return next
    }
    default:
      return undefined
  }
}

/**
 * Read a couple of safe headers from the originating Request. We trust the
 * standard reverse-proxy headers (`x-forwarded-for`, `x-real-ip`) because
 * Vercel sets them; if a self-hosted deploy bypasses a proxy, these will be
 * empty and the audit row simply records `null` for IP, which is fine.
 *
 * `x-forwarded-for` may be a comma-separated chain — we keep only the first
 * (the original client) and ignore the proxy hops.
 */
function extractAuditContext(request?: Request): {
  ip: string | null
  userAgent: string | null
} {
  if (!request) return { ip: null, userAgent: null }

  const headers = request.headers
  const xff = headers.get("x-forwarded-for")
  const xri = headers.get("x-real-ip")
  let ip: string | null = null
  if (xff) {
    const first = xff.split(",")[0]?.trim()
    if (first) ip = first
  } else if (xri) {
    ip = xri.trim() || null
  }

  let userAgent: string | null = headers.get("user-agent")
  if (userAgent && userAgent.length > MAX_STRING_LENGTH) {
    userAgent = userAgent.slice(0, MAX_STRING_LENGTH) + TRUNCATED_MARK
  }

  return { ip, userAgent }
}

/**
 * Input shape for a single audit event. `metadata` is optional and goes
 * through `sanitizeAuditMetadata` before being persisted.
 */
export interface PlatformAuditInput {
  actorId: string
  action: PlatformAuditAction
  targetType: string
  targetId: string
  metadata?: Record<string, unknown>
  request?: Request
}

/**
 * Write a single audit event. NEVER throws — failures degrade gracefully
 * (warning to stderr) so a transient DB blip cannot 500 the upstream
 * mutation.
 *
 * Security:
 *   - `metadata` is sanitised before persistence.
 *   - `ip` / `userAgent` are read from request headers only; we never
 *     attempt to fingerprint the user beyond what they already send.
 */
export async function logPlatformAudit(input: PlatformAuditInput): Promise<void> {
  try {
    const safe = sanitizeAuditMetadata(input.metadata)
    const { ip, userAgent } = extractAuditContext(input.request)

    await db.platformAuditLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        metadata: safe ? JSON.stringify(safe) : null,
        ip,
        userAgent,
      },
    })
  } catch (err) {
    /**
     * Sanitised warning. We intentionally do NOT include the metadata or any
     * payload — even on the error path — because the failure mode might be
     * "DB rejected because of a constraint" and we don't want to bypass the
     * sanitisation by dumping the raw input on stderr.
     */
    const message = err instanceof Error ? err.message : "unknown"
    console.warn("[platform-audit] write failed", {
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      error: message,
    })
  }
}

/**
 * Public shape returned by the audit listing endpoint / page.
 *
 * `metadata` is parsed back to an object on read so the UI doesn't have to
 * re-parse a string. If parsing fails (corrupted row), we return `null`
 * rather than throw — the audit trail is robust against bad rows.
 */
export interface PlatformAuditEntry {
  id: string
  actorId: string
  actorName: string | null
  actorEmail: string | null
  action: string
  targetType: string
  targetId: string
  metadata: Record<string, unknown> | null
  ip: string | null
  userAgent: string | null
  createdAt: string
}

export interface ListPlatformAuditLogsInput {
  limit?: number
}

/**
 * Default cap on the number of rows returned by `listPlatformAuditLogs`.
 * Kept conservative — the UI is read-only and a richer time-bounded query
 * is a future feature; for now 100 most-recent is enough to make the page
 * useful.
 */
const DEFAULT_LIMIT = 100
const MAX_LIMIT = 500

/**
 * Read the latest audit events ordered by `createdAt DESC`.
 *
 * The actor enrichment is a single secondary `User.findMany` keyed by the
 * distinct actor ids seen in the page. This avoids per-row joins and stays
 * O(2) queries regardless of page size. If a user was deleted, their actor
 * row is `null` for name/email — the trail still shows the original userId.
 */
export async function listPlatformAuditLogs(
  input: ListPlatformAuditLogsInput = {},
): Promise<PlatformAuditEntry[]> {
  const requested = input.limit ?? DEFAULT_LIMIT
  const limit = Math.max(1, Math.min(MAX_LIMIT, requested))

  const rows = await db.platformAuditLog.findMany({
    select: {
      id: true,
      actorId: true,
      action: true,
      targetType: true,
      targetId: true,
      metadata: true,
      ip: true,
      userAgent: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  })

  const actorIds = Array.from(new Set(rows.map((r) => r.actorId)))
  const actors = actorIds.length
    ? await db.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, nombre: true, email: true },
      })
    : []
  const actorById = new Map(actors.map((a) => [a.id, a]))

  return rows.map((r) => {
    const actor = actorById.get(r.actorId) ?? null
    let parsed: Record<string, unknown> | null = null
    if (r.metadata) {
      try {
        const candidate = JSON.parse(r.metadata)
        if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
          parsed = candidate as Record<string, unknown>
        }
      } catch {
        parsed = null
      }
    }

    return {
      id: r.id,
      actorId: r.actorId,
      actorName: actor?.nombre ?? null,
      actorEmail: actor?.email ?? null,
      action: r.action,
      targetType: r.targetType,
      targetId: r.targetId,
      metadata: parsed,
      ip: r.ip ?? null,
      userAgent: r.userAgent ?? null,
      createdAt: r.createdAt.toISOString(),
    }
  })
}
