import "dotenv/config"
import { PrismaLibSql } from "@prisma/adapter-libsql"
import { PrismaClient } from "../generated/prisma/client"

/**
 * Idempotent provisioning script for the **internal operations workspace**
 * used to run the 7F SaaS business itself (leads, support, active 7F
 * customers, bugs, feature requests, onboarding, roadmap, vertical
 * opportunities, agent/product strategy, etc.).
 *
 * IMPORTANT distinctions:
 *
 *   - This is NOT the Platform Admin control plane. The control plane
 *     lives at `/system` and is gated by `PlatformAdmin` rows. This
 *     script does NOT touch `PlatformAdmin` and does NOT change
 *     `/system` auth.
 *
 *   - This is NOT a regular customer tenant. It's an internal
 *     "product-ops" tenant: still a row in `Workspace`, still uses the
 *     normal Inbox / Clients / Projects / Tasks / Agents UI, but tagged
 *     in `Workspace.config.kind = "internal"` so future code can
 *     distinguish it (e.g. exclude it from a "customer churn" report
 *     without hard-coding slugs).
 *
 *   - Skina + every other customer workspace are NOT touched. The
 *     script only operates on the workspace whose slug is `7f-business`
 *     and on a single membership row for the configured owner.
 *
 * Idempotency strategy:
 *   1. `findUnique({ slug })` on Workspace.
 *   2. Workspace missing  → `create()` with the canonical metadata.
 *      Workspace present  → leave its primary fields alone, only merge
 *                           `config.kind / internalPurpose / description`
 *                           when those keys are NOT already set (we
 *                           respect any operator-written config).
 *   3. `findUnique({ userId, workspaceId })` on WorkspaceMember.
 *      Membership missing → create with `role: "OWNER"`.
 *      Membership present → leave the role intact (we never demote /
 *                           promote an existing membership here).
 *
 * Same `PrismaLibSql` adapter pattern as `scripts/seed-skina-profile.ts`,
 * so the script works identically against `file:./dev.db` or libSQL.
 *
 * Usage (production):
 *   $env:DATABASE_URL = "libsql://7f-7frames.aws-eu-west-1.turso.io"
 *   npx tsx scripts/ensure-7f-business-workspace.ts
 *   Remove-Item env:DATABASE_URL
 *
 * Required env (read from `.env` or shell overrides):
 *   - SEVENF_OWNER_EMAIL          (owner user lookup; canonical: mfajmsa@gmail.com)
 *   - DATABASE_URL or TURSO_DATABASE_URL
 *   - DATABASE_AUTH_TOKEN or TURSO_AUTH_TOKEN  (only required for libSQL)
 */

const SEVENF_BUSINESS_SLUG = "7f-business"
const SEVENF_BUSINESS_NAME = "7F Business"
const SEVENF_BUSINESS_VERTICAL = "saas"
const SEVENF_BUSINESS_PLAN = "business"
const SEVENF_BUSINESS_STATUS = "active"

/**
 * Canonical config blob for the internal workspace. Stored as JSON in
 * `Workspace.config` (which is `String?` in the schema). NO secrets,
 * NO API keys, NO tokens — just descriptive metadata that the rest of
 * the platform can read freely without privilege concerns.
 *
 * Keep these keys in sync with whoever consumes them downstream (today:
 * none — this is the seed of the convention). When a future read site
 * lands, document it in the config interface alongside this constant.
 */
const SEVENF_BUSINESS_CONFIG_METADATA = {
  kind: "internal",
  internalPurpose: "product_ops",
  description:
    "Internal operations workspace for managing the 7F SaaS business",
} as const

type WorkspaceMetadataKey = keyof typeof SEVENF_BUSINESS_CONFIG_METADATA

const REQUIRED_OWNER_EMAIL_ENV = "SEVENF_OWNER_EMAIL"

const dbUrl = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL
if (!dbUrl) {
  console.error(
    "[ensure-7f-business] Missing DATABASE_URL / TURSO_DATABASE_URL",
  )
  process.exit(1)
}

const ownerEmail = process.env[REQUIRED_OWNER_EMAIL_ENV]
if (!ownerEmail) {
  console.error(
    `[ensure-7f-business] Missing ${REQUIRED_OWNER_EMAIL_ENV} (e.g. mfajmsa@gmail.com)`,
  )
  process.exit(1)
}

const adapter = new PrismaLibSql({
  url: dbUrl,
  authToken: process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN,
})
const db = new PrismaClient({ adapter })

/**
 * Merge helper. Returns the JSON string we want to persist in
 * `Workspace.config`. Existing keys take precedence so an operator
 * who already wrote a tweaked `description` (or any other field) does
 * NOT see their value silently rewritten by a re-run.
 */
function mergeWorkspaceConfig(
  existingRaw: string | null | undefined,
): { json: string; addedKeys: WorkspaceMetadataKey[] } {
  let existing: Record<string, unknown> = {}
  if (existingRaw) {
    try {
      const parsed = JSON.parse(existingRaw) as unknown
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        existing = parsed as Record<string, unknown>
      } else {
        console.warn(
          "[ensure-7f-business] Existing Workspace.config is not a JSON object — preserving it as-is and skipping metadata merge.",
        )
        return { json: existingRaw, addedKeys: [] }
      }
    } catch {
      console.warn(
        "[ensure-7f-business] Existing Workspace.config is not valid JSON — preserving it as-is and skipping metadata merge.",
      )
      return { json: existingRaw, addedKeys: [] }
    }
  }

  const next = { ...existing }
  const added: WorkspaceMetadataKey[] = []
  for (const k of Object.keys(SEVENF_BUSINESS_CONFIG_METADATA) as WorkspaceMetadataKey[]) {
    if (!(k in next)) {
      next[k] = SEVENF_BUSINESS_CONFIG_METADATA[k]
      added.push(k)
    }
  }

  return { json: JSON.stringify(next), addedKeys: added }
}

async function main() {
  console.log(`[ensure-7f-business] Connecting to: ${dbUrl!.split("?")[0]}`)
  console.log(`[ensure-7f-business] Owner email   : ${ownerEmail}`)

  /**
   * Step 1 — Owner lookup. We REQUIRE the user to already exist; this
   * script does not create platform users (that flow is handled by
   * `AllowedEmail` + the OAuth login). If the configured email has not
   * logged in yet, abort with a clear message instead of silently
   * spawning an account.
   */
  const owner = await db.user.findUnique({
    where: { email: ownerEmail! },
    select: { id: true, email: true, nombre: true },
  })
  if (!owner) {
    console.error(
      `[ensure-7f-business] User ${ownerEmail} not found. Have they logged in at least once via Google? Aborting.`,
    )
    process.exit(1)
  }
  console.log(
    `[ensure-7f-business] Owner user id : ${owner.id} (${owner.nombre ?? "no name"})`,
  )

  /**
   * Step 2 — Workspace lookup. `slug` is unique so this returns at most
   * one row. We never create a duplicate workspace here.
   */
  const existing = await db.workspace.findUnique({
    where: { slug: SEVENF_BUSINESS_SLUG },
    select: {
      id: true,
      nombre: true,
      slug: true,
      plan: true,
      status: true,
      vertical: true,
      config: true,
    },
  })

  let workspaceId: string
  let workspaceState: "created" | "already_existed"
  let configState: "created" | "merged" | "preserved" | "noop" = "noop"

  if (!existing) {
    /**
     * First-run path. We create the workspace with the canonical config
     * blob already serialised, so a re-run will hit the merge path below
     * and find every key already present.
     */
    const { json: configJson } = mergeWorkspaceConfig(null)
    const created = await db.workspace.create({
      data: {
        nombre: SEVENF_BUSINESS_NAME,
        slug: SEVENF_BUSINESS_SLUG,
        vertical: SEVENF_BUSINESS_VERTICAL,
        verticalKey: SEVENF_BUSINESS_VERTICAL,
        plan: SEVENF_BUSINESS_PLAN,
        status: SEVENF_BUSINESS_STATUS,
        config: configJson,
      },
      select: { id: true, slug: true },
    })
    workspaceId = created.id
    workspaceState = "created"
    configState = "created"
    console.log(
      `[ensure-7f-business] Workspace created: ${created.slug} (${created.id})`,
    )
  } else {
    /**
     * Idempotent path. We DO NOT overwrite primary fields — if an
     * operator renamed the workspace, changed its plan, or moved its
     * status, we keep their value. We only enrich `config` with the
     * three canonical metadata keys when they are missing.
     *
     * Drift visibility: if any of the primary fields differ from this
     * script's expectations we log it as a warning so an operator can
     * decide whether to reconcile manually. We never reconcile silently.
     */
    workspaceId = existing.id
    workspaceState = "already_existed"
    console.log(
      `[ensure-7f-business] Workspace already exists: ${existing.slug} (${existing.id})`,
    )

    const drift: string[] = []
    if (existing.nombre !== SEVENF_BUSINESS_NAME) {
      drift.push(`nombre="${existing.nombre}" (expected "${SEVENF_BUSINESS_NAME}")`)
    }
    if (existing.plan !== SEVENF_BUSINESS_PLAN) {
      drift.push(`plan="${existing.plan}" (expected "${SEVENF_BUSINESS_PLAN}")`)
    }
    if (existing.status !== SEVENF_BUSINESS_STATUS) {
      drift.push(
        `status="${existing.status}" (expected "${SEVENF_BUSINESS_STATUS}")`,
      )
    }
    if (existing.vertical !== SEVENF_BUSINESS_VERTICAL) {
      drift.push(
        `vertical="${existing.vertical}" (expected "${SEVENF_BUSINESS_VERTICAL}")`,
      )
    }
    if (drift.length > 0) {
      console.warn(
        `[ensure-7f-business] Note: workspace fields differ from defaults — preserving operator values: ${drift.join(", ")}`,
      )
    }

    const { json: configJson, addedKeys } = mergeWorkspaceConfig(existing.config)
    if (addedKeys.length > 0) {
      await db.workspace.update({
        where: { id: existing.id },
        data: { config: configJson },
      })
      configState = "merged"
      console.log(
        `[ensure-7f-business] Config merged — added keys: ${addedKeys.join(", ")}`,
      )
    } else if (configJson === existing.config) {
      configState = "preserved"
      console.log(
        `[ensure-7f-business] Config left untouched — all metadata keys already present (or non-JSON config preserved as-is).`,
      )
    } else {
      configState = "preserved"
      console.log(
        `[ensure-7f-business] Config left untouched — all metadata keys already present.`,
      )
    }
  }

  /**
   * Step 3 — Membership. Composite unique key (userId, workspaceId)
   * matches the schema's `@@unique`, so this is a single deterministic
   * lookup. If the membership exists with a different role we do NOT
   * change it — the operator may have intentionally adjusted it.
   */
  const membership = await db.workspaceMember.findUnique({
    where: {
      userId_workspaceId: { userId: owner.id, workspaceId },
    },
    select: { id: true, role: true },
  })

  let membershipState: "created_owner" | "already_owner" | "already_other_role"
  let membershipRole: string

  if (!membership) {
    const created = await db.workspaceMember.create({
      data: {
        userId: owner.id,
        workspaceId,
        role: "OWNER",
      },
      select: { role: true },
    })
    membershipState = "created_owner"
    membershipRole = created.role
    console.log(
      `[ensure-7f-business] Membership created: ${owner.email} → OWNER`,
    )
  } else if (membership.role === "OWNER") {
    membershipState = "already_owner"
    membershipRole = membership.role
    console.log(
      `[ensure-7f-business] Membership already present: ${owner.email} (OWNER)`,
    )
  } else {
    membershipState = "already_other_role"
    membershipRole = membership.role
    console.warn(
      `[ensure-7f-business] Membership already present with non-OWNER role: ${owner.email} (${membership.role}) — left intact.`,
    )
  }

  /**
   * Compact, machine-readable summary on a single line so callers (e.g.
   * a CI step) can grep for `[ensure-7f-business] RESULT` and parse the
   * JSON without re-parsing the rest of the log.
   */
  const summary = {
    workspace: workspaceState,
    workspaceId,
    slug: SEVENF_BUSINESS_SLUG,
    ownerEmail: owner.email,
    membership: membershipState,
    membershipRole,
    config: configState,
  }
  console.log(`[ensure-7f-business] RESULT ${JSON.stringify(summary)}`)
  console.log("[ensure-7f-business] Done.")
}

main()
  .then(() => db.$disconnect())
  .catch((err) => {
    console.error("[ensure-7f-business] Failed:", err)
    db.$disconnect()
    process.exit(1)
  })
