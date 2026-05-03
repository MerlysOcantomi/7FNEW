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
