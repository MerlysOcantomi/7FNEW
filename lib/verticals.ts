import { db } from "@/lib/db"

export interface VerticalConfig {
  modules: Record<string, boolean>
  ui: {
    labels: Record<string, string>
  }
  [key: string]: unknown
}

export function parseJsonConfig(str: string | null | undefined): VerticalConfig {
  if (!str) return { modules: {}, ui: { labels: {} } }
  try {
    const parsed = JSON.parse(str)
    return {
      modules: parsed.modules ?? {},
      ui: { labels: parsed.ui?.labels ?? {}, ...parsed.ui },
      ...parsed,
    }
  } catch {
    return { modules: {}, ui: { labels: {} } }
  }
}

/**
 * Deep-merge defaultConfig with workspaceConfig.
 * Workspace overrides take precedence at the leaf level.
 */
export function mergeConfigs(
  defaultConfig: VerticalConfig,
  workspaceConfig: VerticalConfig,
): VerticalConfig {
  const merged: VerticalConfig = {
    ...defaultConfig,
    ...workspaceConfig,
    modules: { ...defaultConfig.modules, ...workspaceConfig.modules },
    ui: {
      ...defaultConfig.ui,
      ...workspaceConfig.ui,
      labels: { ...defaultConfig.ui?.labels, ...workspaceConfig.ui?.labels },
    },
  }
  return merged
}

export async function listVerticals(opts?: { activeOnly?: boolean }) {
  const where = opts?.activeOnly !== false ? { isActive: true } : {}
  return db.vertical.findMany({
    where,
    select: {
      id: true,
      key: true,
      name: true,
      description: true,
      defaultConfig: true,
      isActive: true,
    },
    orderBy: { name: "asc" },
  })
}

export async function getVerticalByKey(key: string) {
  return db.vertical.findUnique({ where: { key } })
}

export async function applyVerticalDefaultsToWorkspace(workspace: {
  verticalKey: string
  config: string | null
}) {
  const vertical = await getVerticalByKey(workspace.verticalKey)
  const defaults = parseJsonConfig(vertical?.defaultConfig)
  const overrides = parseJsonConfig(workspace.config)
  return {
    verticalKey: vertical ? workspace.verticalKey : "creative-agency",
    resolvedConfig: mergeConfigs(defaults, overrides),
  }
}
