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
 * Extract demo metadata from Workspace.config.
 * Returns the demo metadata object or empty object if not found.
 */
export function extractDemoMetadata(
  config: Record<string, unknown>,
): Record<string, unknown> {
  return (config.finesseDemoMetadata as Record<string, unknown>) || {}
}
