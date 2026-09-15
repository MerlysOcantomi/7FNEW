/**
 * Safe partial writes into the `Workspace.config.inbox` slice (INBOX-FIX-01).
 *
 * `updateWorkspaceConfig` merges through `mergeConfigs`, which replaces every
 * top-level key WHOLESALE except `modules` / `ui`. A caller that writes
 * `{ inbox: { cannedResponses } }` therefore silently drops the workspace's
 * other `inbox.*` overrides (`channels`, `filters`, `webChat`, …).
 *
 * This pure helper builds the FULL `inbox` object to write: the current slice
 * re-spread with exactly one key replaced. Pure, DB-free, never throws —
 * malformed JSON or a non-object `inbox` degrade to "start from an empty
 * slice", which is the same outcome as before the workspace had any inbox
 * config at all.
 */

/** The current `inbox` slice of an already-parsed config object, or `{}`. */
export function extractInboxConfigSlice(config: unknown): Record<string, unknown> {
  if (!config || typeof config !== "object" || Array.isArray(config)) return {}
  const inbox = (config as Record<string, unknown>)["inbox"]
  if (!inbox || typeof inbox !== "object" || Array.isArray(inbox)) return {}
  return { ...(inbox as Record<string, unknown>) }
}

/** Parse the raw `Workspace.config` string and extract its `inbox` slice. Never throws. */
export function parseWorkspaceInboxConfigSlice(
  config: string | null | undefined,
): Record<string, unknown> {
  if (!config) return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(config)
  } catch {
    return {}
  }
  return extractInboxConfigSlice(parsed)
}

/**
 * The `inbox` object to persist so that `inbox[key] = value` while every
 * other existing `inbox.*` key is preserved verbatim.
 */
export function withInboxConfigKey(
  currentConfig: string | null | undefined,
  key: string,
  value: unknown,
): Record<string, unknown> {
  const current = parseWorkspaceInboxConfigSlice(currentConfig)
  return { ...current, [key]: value }
}
