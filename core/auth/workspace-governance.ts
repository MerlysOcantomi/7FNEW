/**
 * Workspace governance — what a TENANT (workspace admin/owner) may NOT change.
 *
 * Structural / plan-gated configuration (which modules are enabled, the vertical)
 * is controlled ONLY by 7F platform-admins via `/system`. A workspace admin
 * consumes what their plan enables; they do not flip modules or verticals from
 * the tenant app. This module is the single, pure place that encodes that rule
 * so the tenant-facing API can enforce it consistently.
 */

/** Config keys a tenant may not write directly (managed by platform-admin). */
export const TENANT_FORBIDDEN_CONFIG_KEYS = ["modules"] as const

/**
 * Strip privileged keys from a config patch coming from a tenant request. Pure:
 * returns a new object plus the list of keys that were removed (for logging /
 * an explanatory response). Non-object input yields an empty patch.
 */
export function sanitizeTenantConfig<T extends Record<string, unknown>>(
  config: T | null | undefined,
): { config: Partial<T>; stripped: string[] } {
  if (!config || typeof config !== "object") {
    return { config: {} as Partial<T>, stripped: [] }
  }
  const forbidden = new Set<string>(TENANT_FORBIDDEN_CONFIG_KEYS)
  const out: Record<string, unknown> = {}
  const stripped: string[] = []
  for (const [key, value] of Object.entries(config)) {
    if (forbidden.has(key)) stripped.push(key)
    else out[key] = value
  }
  return { config: out as Partial<T>, stripped }
}
