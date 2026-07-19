/**
 * Finesse demo data utilities — pure functions for configuration and validation.
 *
 * These functions are testable and have no side effects.
 * They handle Workspace.config parsing, validation, and merging.
 */

/**
 * Validate and parse Workspace.config JSON.
 * - Empty/null input → returns {}
 * - Valid JSON object → returns parsed object
 * - Invalid JSON or non-object → returns null (abort without modifications)
 */
export function parseWorkspaceConfig(
  configRaw: string | null | undefined,
): Record<string, unknown> | null {
  if (!configRaw) return {}
  if (typeof configRaw === "string" && !configRaw.trim()) return {}

  try {
    const parsed = JSON.parse(configRaw as string)
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
    return null // Invalid: not a JSON object
  } catch {
    return null // Invalid JSON
  }
}

/**
 * Merge demo workspace metadata into existing config.
 * Preserves all existing properties and marks the workspace as a demo:
 *   - `demo: { enabled: true, type: "finesse-internal", ownerEmail }`
 *     (existing `demo` sub-properties are preserved, these three keys win)
 *   - `finesseDemoMetadata`: execution details of the last seed run
 *
 * @param existingConfig - Current Workspace.config (already parsed)
 * @param demoMetadata - Demo metadata to add
 * @param ownerEmail - Owner email recorded in the demo flag
 * @returns New config with demo flag and metadata merged in
 */
export function mergeDemoWorkspaceConfig(
  existingConfig: Record<string, unknown>,
  demoMetadata: Record<string, unknown>,
  ownerEmail: string,
): Record<string, unknown> {
  const existingDemo =
    typeof existingConfig.demo === "object" &&
    existingConfig.demo !== null &&
    !Array.isArray(existingConfig.demo)
      ? (existingConfig.demo as Record<string, unknown>)
      : {}

  return {
    ...existingConfig,
    demo: {
      ...existingDemo,
      enabled: true,
      type: "finesse-internal",
      ownerEmail,
    },
    finesseDemoMetadata: demoMetadata,
  }
}

/**
 * Merge the demo business profile into a workspace config, filling ONLY the
 * fields the workspace has not set yet. A profile value the owner already
 * wrote (non-empty string / non-empty array) is never overwritten.
 *
 * Returns the new config plus the list of profile keys that were filled
 * (empty list = nothing to do, caller may skip the write).
 */
export function mergeDemoBusinessProfile(
  existingConfig: Record<string, unknown>,
  demoProfile: Record<string, unknown>,
): { config: Record<string, unknown>; filledKeys: string[] } {
  const existingProfile =
    typeof existingConfig.businessProfile === "object" &&
    existingConfig.businessProfile !== null &&
    !Array.isArray(existingConfig.businessProfile)
      ? (existingConfig.businessProfile as Record<string, unknown>)
      : {}

  const filledKeys: string[] = []
  const merged: Record<string, unknown> = { ...existingProfile }

  for (const [key, demoValue] of Object.entries(demoProfile)) {
    const current = existingProfile[key]
    const isEmpty =
      current === undefined ||
      current === null ||
      (typeof current === "string" && current.trim() === "") ||
      (Array.isArray(current) && current.length === 0)
    if (isEmpty) {
      merged[key] = demoValue
      filledKeys.push(key)
    }
  }

  if (filledKeys.length === 0) {
    return { config: existingConfig, filledKeys }
  }

  return {
    config: { ...existingConfig, businessProfile: merged },
    filledKeys,
  }
}

/**
 * Decide whether the demo service catalog should be written into the
 * workspace config. It should ONLY happen when neither the vertical defaults
 * nor the workspace override provide any catalog items — otherwise the
 * canonical source (vertical seed or the workspace's own saved catalog)
 * stays untouched.
 */
export function shouldWriteDemoServiceCatalog(
  existingConfig: Record<string, unknown>,
  verticalDefaultConfig: Record<string, unknown> | null,
): boolean {
  const workspaceCatalog = existingConfig.serviceCatalog
  if (Array.isArray(workspaceCatalog) && workspaceCatalog.length > 0) return false

  const defaultCatalog = verticalDefaultConfig?.serviceCatalog
  if (Array.isArray(defaultCatalog) && defaultCatalog.length > 0) return false

  return true
}

/**
 * Preflight assessment of a seed target — the guard that keeps the seeder
 * from ever writing into a REAL client workspace by mistake.
 *
 * Rules (pure, tested):
 *   - `ok-flagged-demo`  → the workspace already carries the canonical demo
 *     flag (`config.demo.enabled === true` + `type: "finesse-internal"`).
 *     Re-runs are safe by construction (markers).
 *   - `ok-fresh`         → not flagged yet, but it contains NO unmarked
 *     clients/conversations — a fresh workspace being activated for the
 *     first time.
 *   - `blocked-unflagged-data` → not flagged AND it holds rows the seeder
 *     did not create (clients/conversations without FINESSE_DEMO markers).
 *     That is what a real operator's workspace looks like — the seeder must
 *     STOP without writing.
 */
export interface DemoTargetCounts {
  totalClients: number
  demoClients: number
  totalConversations: number
  demoConversations: number
}

export interface DemoTargetAssessment {
  status: "ok-flagged-demo" | "ok-fresh" | "blocked-unflagged-data"
  flaggedDemo: boolean
  nonDemoClients: number
  nonDemoConversations: number
}

export function assessDemoTarget(
  config: Record<string, unknown>,
  counts: DemoTargetCounts,
): DemoTargetAssessment {
  const demo =
    typeof config.demo === "object" && config.demo !== null && !Array.isArray(config.demo)
      ? (config.demo as Record<string, unknown>)
      : {}
  const flaggedDemo = demo.enabled === true && demo.type === "finesse-internal"

  const nonDemoClients = Math.max(0, counts.totalClients - counts.demoClients)
  const nonDemoConversations = Math.max(
    0,
    counts.totalConversations - counts.demoConversations,
  )

  if (flaggedDemo) {
    return { status: "ok-flagged-demo", flaggedDemo, nonDemoClients, nonDemoConversations }
  }
  if (nonDemoClients === 0 && nonDemoConversations === 0) {
    return { status: "ok-fresh", flaggedDemo, nonDemoClients, nonDemoConversations }
  }
  return { status: "blocked-unflagged-data", flaggedDemo, nonDemoClients, nonDemoConversations }
}

/**
 * Extract demo metadata from Workspace.config.
 * Returns the demo metadata object or empty object if not found.
 */
export function extractDemoMetadata(
  config: Record<string, unknown>,
): Record<string, unknown> {
  return (config.finesseDemoMetadata as Record<string, unknown>) || {}
}
