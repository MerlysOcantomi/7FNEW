import { db } from "@core/db"

/**
 * Public shape returned to the SevenF System Admin area.
 *
 * EXPLICIT WHITELIST. Anything we DO NOT add here can never be sent to the
 * UI by accident — even if the underlying Prisma model gains new fields.
 * No message content, no inbox payloads, no OAuth tokens, no credentials,
 * no per-user data. Counts only.
 *
 * Owner / primary-channel fields are derived metadata: they help operators
 * reach the right person and quickly see which channel a tenant is using
 * without having to drill into the workspace detail page. The underlying
 * resolution rules live in `listWorkspacesForSystem` below.
 */
export interface SystemWorkspaceSummary {
  id: string
  nombre: string
  slug: string
  vertical: string | null
  plan: string
  createdAt: string
  updatedAt: string
  // Counts
  memberCount: number
  adminCount: number
  conversationCount: number
  channelCount: number
  // Owner — first OWNER (or first ADMIN if no OWNER exists); null if neither.
  ownerName: string | null
  ownerEmail: string | null
  // Primary channel — first ACTIVE ChannelConnection ranked by recency of
  // sync; null if the workspace has no active channel.
  primaryChannelExternalAccountId: string | null
  primaryChannelType: string | null
  primaryChannelStatus: string | null
  lastChannelSyncAt: string | null
}

/**
 * Detail shape for `/system/workspaces/[id]`. Same WHITELIST discipline as
 * the listing — every field present here was vetted as non-sensitive
 * platform metadata. New fields must be added explicitly.
 *
 * Excluded from this view by design:
 *   - `Workspace.config`              (may carry provider keys / prompts)
 *   - `ChannelConnection.config`      (JSON with IMAP/SMTP host config)
 *   - `ChannelConnection.credentials` (AES-256-GCM encrypted secrets)
 *   - `ChannelConnection.syncState`   (incremental sync cursors)
 *   - `ChannelConnection.lastError`   (may include excerpts of email/payload)
 *   - Conversation / Message bodies
 *   - Per-user lastLogin / sessions   (sensitive privacy data)
 */
export interface SystemWorkspaceMemberSummary {
  userId: string
  userName: string | null
  userEmail: string
  role: string
  createdAt: string
}

export interface SystemWorkspaceChannelSummary {
  id: string
  channelType: string
  provider: string
  name: string
  externalAccountId: string | null
  status: string
  isActive: boolean
  lastSyncAt: string | null
  createdAt: string
}

export interface SystemWorkspaceDetail {
  workspace: {
    id: string
    nombre: string
    slug: string
    vertical: string | null
    plan: string
    createdAt: string
    updatedAt: string
  }
  members: SystemWorkspaceMemberSummary[]
  channels: SystemWorkspaceChannelSummary[]
}

/**
 * Role values that count as "leadership" for owner resolution. We pull both
 * in a single relation read so the .map() loop can pick OWNER first and
 * fall back to ADMIN without a second round-trip.
 */
const OWNER_RESOLUTION_ROLES = ["OWNER", "ADMIN"] as const

/**
 * Hard cap on how many leadership members we eagerly load per workspace.
 * 5 is overkill in practice (a workspace usually has 1 owner + a few admins)
 * but keeps the relation read bounded if a misconfigured tenant has dozens
 * of admins.
 */
const OWNER_RESOLUTION_TAKE = 5

/**
 * List every workspace in the platform, with safe metadata + aggregate counts.
 *
 * MUST be called only after `requirePlatformRole(...)` (the API route and
 * server component caller are responsible for that). This function does NOT
 * itself authenticate — it's a pure data accessor — so a misuse from a
 * non-platform context would leak the tenant list. Reviewers: keep call sites
 * minimal and always behind a platform gate.
 *
 * Query strategy: TWO queries total (no N+1).
 *
 *   1. `workspace.findMany` with relation reads for:
 *      - Aggregate counts (`_count.members | conversations | channelConnections`).
 *      - A small window of leadership members (OWNER+ADMIN, take=5, oldest
 *        first) used to derive `ownerName` / `ownerEmail`.
 *      - The single most recently-synced ACTIVE channel per workspace,
 *        used to derive primary-channel fields.
 *   2. `workspaceMember.groupBy` on role=ADMIN to get `adminCount` per
 *      workspace — Prisma can't do conditional `_count` alongside an
 *      unconditional `_count` on the same relation, so groupBy is the
 *      cleanest single-query alternative.
 *
 * Owner resolution rule (per task brief):
 *   - First OWNER ordered by `createdAt asc` (the founding owner).
 *   - Fallback: first ADMIN ordered by `createdAt asc`.
 *   - `null` if neither exists (orphaned tenant; operators see "No owner").
 *
 * Primary channel resolution rule (per task brief):
 *   - First ACTIVE ChannelConnection ordered by `lastSyncAt DESC, createdAt DESC`.
 *   - Tenants with no active channel return `null` for all four channel fields.
 *
 * Channel select is INTENTIONALLY narrow: NO `config`, NO `credentials`,
 * NO `syncState`, NO `lastError`. Same whitelist discipline as
 * `getWorkspaceSystemDetail`.
 */
export async function listWorkspacesForSystem(): Promise<SystemWorkspaceSummary[]> {
  const rows = await db.workspace.findMany({
    select: {
      id: true,
      nombre: true,
      slug: true,
      vertical: true,
      plan: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          members: true,
          conversations: true,
          channelConnections: true,
        },
      },
      members: {
        where: { role: { in: [...OWNER_RESOLUTION_ROLES] } },
        select: {
          role: true,
          user: { select: { nombre: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
        take: OWNER_RESOLUTION_TAKE,
      },
      channelConnections: {
        where: { status: "active" },
        select: {
          externalAccountId: true,
          channelType: true,
          status: true,
          lastSyncAt: true,
        },
        orderBy: [{ lastSyncAt: "desc" }, { createdAt: "desc" }],
        take: 1,
      },
    },
    orderBy: { createdAt: "asc" },
  })

  /**
   * adminCount per workspace: ONE groupBy across the platform. Mapping into
   * a Map keeps lookup O(1) inside the .map below.
   */
  const adminCountRows = await db.workspaceMember.groupBy({
    by: ["workspaceId"],
    where: { role: "ADMIN" },
    _count: { _all: true },
  })
  const adminCountByWorkspace = new Map<string, number>(
    adminCountRows.map((r) => [r.workspaceId, r._count._all]),
  )

  return rows.map((w) => {
    const owner =
      w.members.find((m) => m.role === "OWNER") ??
      w.members.find((m) => m.role === "ADMIN") ??
      null
    const channel = w.channelConnections[0] ?? null

    return {
      id: w.id,
      nombre: w.nombre,
      slug: w.slug,
      vertical: w.vertical ?? null,
      plan: w.plan,
      createdAt: w.createdAt.toISOString(),
      updatedAt: w.updatedAt.toISOString(),
      memberCount: w._count.members,
      adminCount: adminCountByWorkspace.get(w.id) ?? 0,
      conversationCount: w._count.conversations,
      channelCount: w._count.channelConnections,
      ownerName: owner?.user.nombre ?? null,
      ownerEmail: owner?.user.email ?? null,
      primaryChannelExternalAccountId: channel?.externalAccountId ?? null,
      primaryChannelType: channel?.channelType ?? null,
      primaryChannelStatus: channel?.status ?? null,
      lastChannelSyncAt: channel?.lastSyncAt ? channel.lastSyncAt.toISOString() : null,
    }
  })
}

/**
 * Read-only detail of a single workspace for the System Admin area.
 *
 * Same authorisation contract as `listWorkspacesForSystem`: callers must run
 * `requirePlatformRole(...)` first. This function does NOT verify identity —
 * it's a pure data accessor.
 *
 * Returns `null` (not throws) when the id is unknown so the API route can
 * map that cleanly to a 404 without try/catching.
 *
 * Three queries (workspace + members + channels) instead of one nested
 * include because:
 *   - We can apply distinct `select` whitelists per relation, which makes
 *     leak prevention easier to audit.
 *   - Member ordering and channel ordering are independent.
 *   - If one accidentally grows expensive in the future, it's trivial to
 *     paginate just that one.
 */
export async function getWorkspaceSystemDetail(
  workspaceId: string,
): Promise<SystemWorkspaceDetail | null> {
  const ws = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      id: true,
      nombre: true,
      slug: true,
      vertical: true,
      plan: true,
      createdAt: true,
      updatedAt: true,
    },
  })
  if (!ws) return null

  const memberRows = await db.workspaceMember.findMany({
    where: { workspaceId },
    select: {
      role: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          nombre: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  })

  /**
   * Channel select is INTENTIONALLY narrow. `config` and `credentials`
   * MUST never be selected here. `credentials` is AES-encrypted but even the
   * ciphertext should not leave the server. `syncState` and `lastError` are
   * also omitted because they can carry payload excerpts.
   */
  const channelRows = await db.channelConnection.findMany({
    where: { workspaceId },
    select: {
      id: true,
      channelType: true,
      provider: true,
      name: true,
      externalAccountId: true,
      status: true,
      lastSyncAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  })

  return {
    workspace: {
      id: ws.id,
      nombre: ws.nombre,
      slug: ws.slug,
      vertical: ws.vertical ?? null,
      plan: ws.plan,
      createdAt: ws.createdAt.toISOString(),
      updatedAt: ws.updatedAt.toISOString(),
    },
    members: memberRows.map((m) => ({
      userId: m.user.id,
      userName: m.user.nombre ?? null,
      userEmail: m.user.email,
      role: m.role,
      createdAt: m.createdAt.toISOString(),
    })),
    channels: channelRows.map((c) => ({
      id: c.id,
      channelType: c.channelType,
      provider: c.provider,
      name: c.name,
      externalAccountId: c.externalAccountId ?? null,
      status: c.status,
      isActive: c.status === "active",
      lastSyncAt: c.lastSyncAt ? c.lastSyncAt.toISOString() : null,
      createdAt: c.createdAt.toISOString(),
    })),
  }
}
