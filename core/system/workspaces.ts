import { db } from "@core/db"

/**
 * Public shape returned to the SevenF System Admin area.
 *
 * EXPLICIT WHITELIST. Anything we DO NOT add here can never be sent to the
 * UI by accident — even if the underlying Prisma model gains new fields.
 * No message content, no inbox payloads, no OAuth tokens, no credentials,
 * no per-user data. Counts only.
 */
export interface SystemWorkspaceSummary {
  id: string
  nombre: string
  slug: string
  vertical: string | null
  plan: string
  createdAt: string
  updatedAt: string
  memberCount: number
  conversationCount: number
  channelCount: number
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
 * List every workspace in the platform, with safe metadata + aggregate counts.
 *
 * MUST be called only after `requirePlatformRole(...)` (the API route and
 * server component caller are responsible for that). This function does NOT
 * itself authenticate — it's a pure data accessor — so a misuse from a
 * non-platform context would leak the tenant list. Reviewers: keep call sites
 * minimal and always behind a platform gate.
 *
 * Counts use Prisma's `_count` aggregator, which is a SINGLE query joined on
 * the relation, not N+1. Cheap even with many workspaces.
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
    },
    orderBy: { createdAt: "asc" },
  })

  return rows.map((w) => ({
    id: w.id,
    nombre: w.nombre,
    slug: w.slug,
    vertical: w.vertical ?? null,
    plan: w.plan,
    createdAt: w.createdAt.toISOString(),
    updatedAt: w.updatedAt.toISOString(),
    memberCount: w._count.members,
    conversationCount: w._count.conversations,
    channelCount: w._count.channelConnections,
  }))
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
