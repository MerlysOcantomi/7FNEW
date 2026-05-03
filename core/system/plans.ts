/**
 * Tenant plan metadata for the SevenF SaaS.
 *
 * THIS FILE IS THE SINGLE SOURCE OF TRUTH for what each plan unlocks. The
 * `/system/workspaces` views, the future limit-enforcement layer, and the
 * future billing layer all read from here.
 *
 * Important non-goals for this PR:
 *   - This file does NOT implement Stripe or billing. There is no checkout,
 *     no invoice, no subscription state. Plans are read-only metadata used
 *     for display + future limit checks.
 *   - This file does NOT enforce limits. Member creation, channel
 *     connection, AI-credit consumption etc. continue to work without any
 *     gate. The `seatLimitReached` / `channelLimitReached` booleans surfaced
 *     to the UI are observational only.
 *   - This file does NOT decide what a workspace is allowed to do today.
 *     A future PR will read `enabledModules` to gate UI / API surfaces.
 *
 * Adding/changing a plan: edit `PLAN_DEFINITIONS` and that's it. No DB
 * migration required because the source of truth for "which plan does this
 * workspace have" is `Workspace.plan` (free-form string), and the resolver
 * downstream is permissive.
 */

/**
 * The four plans we ship with. Keep this union small — every new entry has
 * downstream implications (UI columns, billing assumptions, modules list).
 */
export type TenantPlan = "free" | "starter" | "business" | "enterprise"

/**
 * `null` means "unlimited" / "not applicable". Used by `enterprise` for all
 * three caps. The UI renders `null` as the literal "Unlimited" so operators
 * never see an ambiguous "0" or "—".
 */
export interface TenantPlanLimits {
  includedSeats: number | null
  maxChannels: number | null
  aiCreditsMonthly: number | null
}

/**
 * Module identifiers are free-form strings on purpose: the modules system
 * itself isn't gated yet, and the set of modules is still evolving (forte,
 * agents, etc.). The special token `"all"` on `enterprise` means "every
 * module known to the platform" and the UI / future gate code must handle
 * it explicitly.
 */
export interface TenantPlanDefinition {
  key: TenantPlan
  label: string
  limits: TenantPlanLimits
  enabledModules: readonly string[]
}

/**
 * Plan catalogue. Order matters: the UI renders them in this order when
 * choices are displayed (future PR — not yet wired).
 */
export const PLAN_DEFINITIONS: Readonly<Record<TenantPlan, TenantPlanDefinition>> = {
  free: {
    key: "free",
    label: "Free",
    limits: {
      includedSeats: 1,
      maxChannels: 1,
      aiCreditsMonthly: 500,
    },
    enabledModules: ["inbox"],
  },
  starter: {
    key: "starter",
    label: "Starter",
    limits: {
      includedSeats: 3,
      maxChannels: 2,
      aiCreditsMonthly: 5000,
    },
    enabledModules: ["inbox", "clients", "projects"],
  },
  business: {
    key: "business",
    label: "Business",
    limits: {
      includedSeats: 10,
      maxChannels: 5,
      aiCreditsMonthly: 25000,
    },
    enabledModules: ["inbox", "clients", "projects", "invoices", "tasks", "agents"],
  },
  enterprise: {
    key: "enterprise",
    label: "Enterprise",
    limits: {
      includedSeats: null,
      maxChannels: null,
      aiCreditsMonthly: null,
    },
    enabledModules: ["all"],
  },
}

const VALID_PLAN_KEYS = new Set<string>(Object.keys(PLAN_DEFINITIONS))

/**
 * Type guard. Useful for callers that receive a free-form string from the
 * DB and want to fan-out by plan without touching the resolver.
 */
export function isTenantPlan(value: unknown): value is TenantPlan {
  return typeof value === "string" && VALID_PLAN_KEYS.has(value)
}

/**
 * Resolution result. Includes the original `rawPlan` so the UI can flag
 * "unknown plan" without losing the actual value (useful when debugging a
 * tenant that landed on a deprecated/typoed plan name).
 */
export interface ResolvedTenantPlan {
  planKey: TenantPlan
  label: string
  limits: TenantPlanLimits
  enabledModules: readonly string[]
  isUnknownPlan: boolean
  rawPlan: string
}

/**
 * Resolve `Workspace.plan` (free-form string in DB) into a structured plan
 * definition. Permissive by design:
 *
 *   - Trims + lower-cases the input. `"Free"`, `"FREE"`, `"  free "` all
 *     resolve to the `free` plan without complaints.
 *   - If the string is empty, missing, or unknown, falls back to `free`
 *     and sets `isUnknownPlan: true`. The UI uses that flag to show a
 *     soft warning so operators can spot the misconfiguration.
 *   - NEVER throws. The resolver is in the read path of every system
 *     workspace listing — a thrown error here would 500 the whole page.
 *
 * Argument shape is an object so we can add optional context (e.g.
 * `workspace.config`) later without breaking existing callers.
 */
export function resolveWorkspacePlan(input: {
  plan: string | null | undefined
}): ResolvedTenantPlan {
  const raw = (input.plan ?? "").toString()
  const normalized = raw.trim().toLowerCase()

  if (isTenantPlan(normalized)) {
    const def = PLAN_DEFINITIONS[normalized]
    return {
      planKey: def.key,
      label: def.label,
      limits: def.limits,
      enabledModules: def.enabledModules,
      isUnknownPlan: false,
      rawPlan: raw,
    }
  }

  const fallback = PLAN_DEFINITIONS.free
  return {
    planKey: fallback.key,
    label: fallback.label,
    limits: fallback.limits,
    enabledModules: fallback.enabledModules,
    isUnknownPlan: true,
    rawPlan: raw,
  }
}

/**
 * Compute whether a usage value has hit / exceeded a plan limit.
 *
 * Returns `false` when the limit is `null` ("unlimited") — the enterprise
 * tier never reaches its cap by definition.
 */
export function hasReachedLimit(usage: number, limit: number | null): boolean {
  if (limit === null) return false
  return usage >= limit
}
