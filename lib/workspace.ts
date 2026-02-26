import { db } from "@/lib/db"
import {
  parseJsonConfig,
  mergeConfigs,
  getVerticalByKey,
  type VerticalConfig,
} from "@/lib/verticals"

export const DEFAULT_WORKSPACE_ID = "ws_default"
export const DEFAULT_WORKSPACE_SLUG = "default"

export async function getOrCreateDefaultWorkspace() {
  const existing = await db.workspace.findUnique({
    where: { slug: DEFAULT_WORKSPACE_SLUG },
  })
  if (existing) return existing

  return db.workspace.create({
    data: {
      id: DEFAULT_WORKSPACE_ID,
      nombre: "Default Workspace",
      slug: DEFAULT_WORKSPACE_SLUG,
      vertical: "creative-agency",
      verticalKey: "creative-agency",
    },
  })
}

export async function checkMembership(userId: string, workspaceId: string) {
  return db.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
    select: { id: true, userId: true, workspaceId: true, role: true, createdAt: true },
  })
}

export async function listWorkspacesForUser(userId: string) {
  const memberships = await db.workspaceMember.findMany({
    where: { userId },
    include: {
      workspace: {
        select: { id: true, nombre: true, slug: true, vertical: true, verticalKey: true, plan: true },
      },
    },
    orderBy: { createdAt: "asc" },
  })
  return memberships.map((m) => ({ ...m.workspace, role: m.role }))
}

export async function ensureUserHasDefaultWorkspace(userId: string): Promise<string> {
  const existing = await db.workspaceMember.findFirst({
    where: { userId },
    select: { workspaceId: true },
    orderBy: { createdAt: "asc" },
  })
  if (existing) return existing.workspaceId

  const ws = await getOrCreateDefaultWorkspace()
  await db.workspaceMember.create({
    data: {
      userId,
      workspaceId: ws.id,
      role: "OWNER",
    },
  })
  return ws.id
}

export function getActiveWorkspaceId(): string {
  return DEFAULT_WORKSPACE_ID
}

export function workspaceFilter(workspaceId: string | null): { workspaceId?: string } {
  if (!workspaceId) return {}
  return { workspaceId }
}

export async function getWorkspaceWithResolvedConfig(workspaceId: string) {
  const ws = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      id: true,
      nombre: true,
      slug: true,
      vertical: true,
      verticalKey: true,
      config: true,
      plan: true,
      createdAt: true,
      updatedAt: true,
    },
  })
  if (!ws) return null

  const vertical = await getVerticalByKey(ws.verticalKey)
  const defaults = parseJsonConfig(vertical?.defaultConfig)
  const overrides = parseJsonConfig(ws.config)
  const resolvedConfig = mergeConfigs(defaults, overrides)

  return { ...ws, resolvedConfig }
}

export async function updateWorkspaceConfig(
  workspaceId: string,
  partialConfig: Partial<VerticalConfig>,
) {
  const ws = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { config: true },
  })
  if (!ws) return null

  const current = parseJsonConfig(ws.config)
  const merged = mergeConfigs(current, partialConfig as VerticalConfig)

  return db.workspace.update({
    where: { id: workspaceId },
    data: { config: JSON.stringify(merged) },
  })
}

export async function setWorkspaceVertical(workspaceId: string, verticalKey: string) {
  const vertical = await getVerticalByKey(verticalKey)
  if (!vertical || !vertical.isActive) return null

  const ws = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { config: true },
  })
  if (!ws) return null

  const newDefaults = parseJsonConfig(vertical.defaultConfig)
  const existingOverrides = parseJsonConfig(ws.config)
  const merged = mergeConfigs(newDefaults, existingOverrides)

  return db.workspace.update({
    where: { id: workspaceId },
    data: {
      vertical: verticalKey,
      verticalKey,
      config: JSON.stringify(merged),
    },
  })
}
