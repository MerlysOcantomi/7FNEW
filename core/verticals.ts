import { db } from "@core/db"
import { BEAUTY_PACK, buildBeautyDefaultConfig } from "@core/vertical-packs/beauty"

export interface WorkspaceBusinessProfile {
  businessName?: string
  businessDescription?: string
  services?: string[]
  tone?: string
  region?: string
  languages?: string[]
  workingHours?: string
  attentionRules?: string[]
}

export interface WorkspaceServiceCatalogItem {
  /** Stable id — added by the service-catalog layer so agenda/billing can reference a service later. */
  id?: string
  name: string
  active: boolean
  category?: string
  description?: string
  tags?: string[]
}

export interface VerticalConfig {
  modules: Record<string, boolean>
  locale?: string
  ui: {
    labels: Record<string, string>
  }
  businessProfile?: WorkspaceBusinessProfile
  serviceCatalog?: WorkspaceServiceCatalogItem[]
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

/** The subset of a `Vertical` the app actually consumes (DB or built-in). */
export interface VerticalRecord {
  id: string
  key: string
  name: string
  description: string | null
  defaultConfig: string
  isActive: boolean
}

const VERTICAL_SELECT = {
  id: true,
  key: true,
  name: true,
  description: true,
  defaultConfig: true,
  isActive: true,
} as const

/**
 * Built-in vertical packs defined in code (core/vertical-packs/* is the single
 * source of truth). They make a vertical selectable/saveable even when the DB
 * `Vertical` table has not been seeded with it yet — e.g. a workspace can pick
 * Beauty/Finesse from the platform console before `prisma db seed` runs in that
 * environment. A real DB row with the same key ALWAYS takes precedence (it can
 * carry admin edits/overrides); `defaultConfig` here is derived from the same
 * pack the seed uses, so the two can never drift.
 */
const BUILTIN_VERTICALS: VerticalRecord[] = [
  {
    id: `builtin:${BEAUTY_PACK.verticalKey}`,
    key: BEAUTY_PACK.verticalKey,
    name: BEAUTY_PACK.name,
    description: BEAUTY_PACK.description,
    defaultConfig: buildBeautyDefaultConfig(),
    isActive: true,
  },
]

export async function listVerticals(opts?: { activeOnly?: boolean }): Promise<VerticalRecord[]> {
  const activeOnly = opts?.activeOnly !== false
  const rows = await db.vertical.findMany({
    where: activeOnly ? { isActive: true } : {},
    select: VERTICAL_SELECT,
    orderBy: { name: "asc" },
  })
  // Union with built-in packs that the DB does not carry yet (DB rows win).
  const present = new Set(rows.map((r) => r.key))
  const extras = BUILTIN_VERTICALS.filter(
    (b) => !present.has(b.key) && (!activeOnly || b.isActive),
  )
  return [...rows, ...extras].sort((a, b) => a.name.localeCompare(b.name))
}

export async function getVerticalByKey(key: string): Promise<VerticalRecord | null> {
  const row = await db.vertical.findUnique({ where: { key }, select: VERTICAL_SELECT })
  if (row) return row
  return BUILTIN_VERTICALS.find((b) => b.key === key) ?? null
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
