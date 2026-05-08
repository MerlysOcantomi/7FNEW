/**
 * Workspace IANA timezone for Fanny inbox intelligence (`runConversationIntelligence`).
 *
 * Reads **only** the root `timeZone` key on an already **parsed and merged**
 * workspace config object (`VerticalConfig` after vertical defaults + workspace
 * overrides). Pass `getWorkspaceWithResolvedConfig(...).resolvedConfig`, not
 * the raw `Workspace.config` JSON string.
 *
 * Rules:
 *   - Only `config.timeZone` is consulted — never `locale.timeZone`. Root
 *     `locale` must remain a **language code string** for `resolveLocaleFromConfig`;
 *     nesting timezone under `locale` encouraged broken configs.
 *   - Non-string or whitespace-only `timeZone` → `"UTC"`.
 *
 * Does not validate IANA zone names (no extra deps); invalid zones surface at
 * prompt-anchor time if downstream rejects them.
 */

export function pickWorkspaceTimezoneFromConfig(config: unknown): string {
  if (!config || typeof config !== "object") return "UTC"
  const cfg = config as Record<string, unknown>
  const raw = cfg.timeZone
  if (typeof raw !== "string") return "UTC"
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : "UTC"
}
