/**
 * Effective Inbox filter configuration — pure layered resolution of WHICH
 * filters a workspace's Inbox surfaces, in what order and tiering:
 *
 *   core defaults → vertical pack (`pack.inbox.filters`) → workspace
 *   overrides (`Workspace.config.inbox.filters`)
 *
 * Follows the defensive precedents of `core/workspace-taxonomies.ts` and
 * `core/inbox/channel-config.ts`: pure, DB-free, never throws, drops unknown
 * ids/duplicates silently, and configuration can only REFERENCE known filter
 * definitions — it can never define queries (rules live in the registry and
 * in vertical pack DEFINITIONS shipped as code, both typed).
 *
 * Vertical filter definitions: a pack may declare additional filter
 * definitions (`pack.inbox.filterDefinitions`, scope "vertical"). They join
 * the known-id universe here. Definitions whose rules depend on vocabulary
 * that does not exist yet MUST be declared `availability: "planned"` — the
 * resolver keeps planned filters out of the ready list no matter what any
 * config layer says.
 */

import type { ResolvedInboxChannelView } from "./channel-config"
import { INBOX_CHANNELS, isChannelSelectableInFilters } from "./channel-registry"
import {
  buildChannelFilterDefinitions,
  compileInboxFilterRule,
  CORE_INBOX_FILTERS,
  getCoreInboxFilter,
  LEGACY_INBOX_FILTER_ALIASES,
  parseChannelFilterId,
  type CompiledInboxFilterParams,
  type InboxFilterCountStrategy,
  type InboxFilterDefinition,
  type InboxFilterGroup,
  type InboxFilterId,
  type InboxFilterScope,
} from "./filter-registry"

/** Declarative filter configuration, as written by packs and workspaces. */
export interface InboxFiltersConfig {
  /** Filters available to this workspace's Inbox. */
  enabled: InboxFilterId[]
  /** Visual order. Permutation of `enabled` after normalization. */
  order: InboxFilterId[]
  /** Filters surfaced in the toolbar chip row. */
  primary: InboxFilterId[]
  /** The remaining enabled filters (menus/secondary surfaces). */
  secondary: InboxFilterId[]
  /** Enabled-but-hidden filters (still resolvable by URL, not rendered). */
  hidden: InboxFilterId[]
  /** Filter selected when the URL carries none. Must be enabled + active. */
  defaultFilter: InboxFilterId
}

/** A partially-specified layer (pack or workspace). Absent fields inherit. */
export type InboxFiltersConfigInput = Partial<{
  enabled: unknown
  order: unknown
  primary: unknown
  secondary: unknown
  hidden: unknown
  defaultFilter: unknown
}>

/** Strongly-typed pack declaration shape (typo-proof at the pack site). */
export type VerticalInboxFiltersDefaults = Partial<InboxFiltersConfig>

/**
 * The one filter no configuration layer may disable or hide: without the
 * unfiltered default view the Inbox becomes unusable and URL fallbacks have
 * nowhere safe to land.
 */
export const MANDATORY_INBOX_FILTER_ID: InboxFilterId = "all"

/**
 * Core defaults. `primary` reproduces the pre-registry toolbar chip row
 * exactly (All / Needs attention / Waiting / Done); the rest of the active
 * core filters stay enabled for sidebar/menu surfaces and for verticals to
 * promote. Planned filters (e.g. `scheduled`) are NOT enabled by default.
 */
const CORE_ENABLED: readonly InboxFilterId[] = [
  "all",
  "needs_action",
  "waiting",
  "done",
  "unanswered",
  "urgent",
  "unassigned",
  "opportunities",
  "closed",
  "archived",
  "trash",
]

export const CORE_INBOX_FILTERS_CONFIG: InboxFiltersConfig = Object.freeze({
  enabled: Object.freeze([...CORE_ENABLED]),
  order: Object.freeze([...CORE_ENABLED]),
  primary: Object.freeze(["all", "needs_action", "waiting", "done"]),
  secondary: Object.freeze([
    "unanswered",
    "urgent",
    "unassigned",
    "opportunities",
    "closed",
    "archived",
    "trash",
  ]),
  hidden: Object.freeze([]),
  defaultFilter: "all",
}) as unknown as InboxFiltersConfig

const MAX_FILTERS = 64

/** Sanitize one id list against the known universe: dedup, bound, drop unknown. */
function sanitizeFilterList(
  input: unknown,
  known: ReadonlySet<InboxFilterId>,
): InboxFilterId[] | null {
  if (!Array.isArray(input)) return null
  const seen = new Set<InboxFilterId>()
  const out: InboxFilterId[] = []
  for (const raw of input) {
    if (typeof raw !== "string") continue
    const id = raw.trim()
    if (!id || !known.has(id) || seen.has(id)) continue
    seen.add(id)
    out.push(id)
    if (out.length >= MAX_FILTERS) break
  }
  return out
}

/** Parse the `inbox.filters` slice out of an already-parsed config object. */
export function extractInboxFiltersSlice(config: unknown): InboxFiltersConfigInput {
  if (!config || typeof config !== "object" || Array.isArray(config)) return {}
  const inbox = (config as Record<string, unknown>)["inbox"]
  if (!inbox || typeof inbox !== "object" || Array.isArray(inbox)) return {}
  const filters = (inbox as Record<string, unknown>)["filters"]
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) return {}
  return filters as InboxFiltersConfigInput
}

/** Parse workspace overrides from the raw `Workspace.config` string. Never throws. */
export function parseWorkspaceInboxFilters(
  config: string | null | undefined,
): InboxFiltersConfigInput {
  if (!config) return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(config)
  } catch {
    return {}
  }
  return extractInboxFiltersSlice(parsed)
}

export interface ResolveInboxFiltersOptions {
  /** Effective channel views (INBOX-CHANNELS-02) — channel filters derive from these. */
  channelViews?: readonly ResolvedInboxChannelView[]
  /** Vertical pack filter definitions (scope "vertical"), already typed code data. */
  verticalDefinitions?: readonly InboxFilterDefinition[]
  /** Config layers, applied left → right (vertical pack first, workspace last). */
  layers?: Array<InboxFiltersConfigInput | null | undefined>
}

export interface ResolvedInboxFilters {
  config: InboxFiltersConfig
  /** Every known definition in this resolution (core + channel + vertical). */
  definitions: InboxFilterDefinition[]
}

/**
 * Resolve the effective filter config. Universe of known ids = core registry
 * + channel filters derived from the effective channel views + vertical
 * definitions. Per-field layering with wholesale-array replacement (same
 * semantics as `resolveInboxChannelsConfig`), then a coherence pass:
 *
 *   - `MANDATORY_INBOX_FILTER_ID` ("all") can never be disabled or hidden.
 *   - `order` becomes a permutation of `enabled` (missing appended).
 *   - `primary` ⊆ enabled∖hidden; `secondary` = the rest (declared first).
 *   - `defaultFilter` must be enabled, not hidden, and ACTIVE (a planned
 *     filter can never be the default); otherwise falls back to "all".
 */
export function resolveInboxFiltersConfig(
  options: ResolveInboxFiltersOptions = {},
): ResolvedInboxFilters {
  const channelDefinitions = buildChannelFilterDefinitions(options.channelViews ?? [])
  const verticalDefinitions = (options.verticalDefinitions ?? []).filter(
    (def) => def.scope === "vertical",
  )
  const definitions: InboxFilterDefinition[] = [
    ...CORE_INBOX_FILTERS,
    ...channelDefinitions,
    ...verticalDefinitions,
  ]
  const byId = new Map(definitions.map((def) => [def.id, def]))
  const known = new Set(byId.keys())

  let enabled = [...CORE_INBOX_FILTERS_CONFIG.enabled]
  let order = [...CORE_INBOX_FILTERS_CONFIG.order]
  let primary = [...CORE_INBOX_FILTERS_CONFIG.primary]
  let secondary = [...CORE_INBOX_FILTERS_CONFIG.secondary]
  let hidden = [...CORE_INBOX_FILTERS_CONFIG.hidden]
  let defaultFilter: InboxFilterId = CORE_INBOX_FILTERS_CONFIG.defaultFilter
  let secondaryDeclared = false

  for (const layer of options.layers ?? []) {
    if (!layer || typeof layer !== "object") continue
    const nextEnabled = sanitizeFilterList(layer.enabled, known)
    if (nextEnabled && nextEnabled.length > 0) enabled = nextEnabled
    const nextOrder = sanitizeFilterList(layer.order, known)
    if (nextOrder && nextOrder.length > 0) order = nextOrder
    const nextPrimary = sanitizeFilterList(layer.primary, known)
    if (nextPrimary) primary = nextPrimary
    const nextSecondary = sanitizeFilterList(layer.secondary, known)
    if (nextSecondary) {
      secondary = nextSecondary
      secondaryDeclared = true
    }
    const nextHidden = sanitizeFilterList(layer.hidden, known)
    if (nextHidden) hidden = nextHidden
    if (typeof layer.defaultFilter === "string" && known.has(layer.defaultFilter.trim())) {
      defaultFilter = layer.defaultFilter.trim()
    }
  }

  // The mandatory filter can never be disabled or hidden.
  if (!enabled.includes(MANDATORY_INBOX_FILTER_ID)) enabled = [MANDATORY_INBOX_FILTER_ID, ...enabled]
  hidden = hidden.filter((id) => id !== MANDATORY_INBOX_FILTER_ID)

  // Coherence: order = permutation of enabled.
  const enabledSet = new Set(enabled)
  const coherentOrder = order.filter((id) => enabledSet.has(id))
  for (const id of enabled) {
    if (!coherentOrder.includes(id)) coherentOrder.push(id)
  }

  // Coherence: hidden ⊆ enabled; visible = enabled ∖ hidden.
  const coherentHidden = hidden.filter((id) => enabledSet.has(id))
  const hiddenSet = new Set(coherentHidden)

  // Coherence: primary ⊆ visible; secondary = the remaining visible filters.
  const coherentPrimary = primary.filter((id) => enabledSet.has(id) && !hiddenSet.has(id))
  const primarySet = new Set(coherentPrimary)
  const declaredSecondary = secondaryDeclared ? secondary : []
  const coherentSecondary = declaredSecondary.filter(
    (id) => enabledSet.has(id) && !hiddenSet.has(id) && !primarySet.has(id),
  )
  for (const id of coherentOrder) {
    if (!primarySet.has(id) && !hiddenSet.has(id) && !coherentSecondary.includes(id)) {
      coherentSecondary.push(id)
    }
  }

  // Coherence: the default must be enabled, visible, ACTIVE and compilable.
  const defaultDef = byId.get(defaultFilter)
  const defaultIsUsable =
    !!defaultDef &&
    enabledSet.has(defaultFilter) &&
    !hiddenSet.has(defaultFilter) &&
    defaultDef.availability === "active" &&
    compileInboxFilterRule(defaultDef.queryRule) !== null
  const coherentDefault = defaultIsUsable ? defaultFilter : MANDATORY_INBOX_FILTER_ID

  return {
    config: {
      enabled: coherentOrder.slice(),
      order: coherentOrder,
      primary: coherentPrimary,
      secondary: coherentSecondary,
      hidden: coherentHidden,
      defaultFilter: coherentDefault,
    },
    definitions,
  }
}

// ── Effective per-filter view ───────────────────────────────────────────────

export interface ResolvedInboxFilterView {
  id: InboxFilterId
  labelKey: string
  iconToken?: string
  group: InboxFilterGroup
  scope: InboxFilterScope
  tier: "primary" | "secondary"
  isDefault: boolean
  countStrategy: InboxFilterCountStrategy
  /**
   * ready       — selectable; `compiled` is non-null and safe to execute.
   * coming_soon — planned / not-yet-executable; render disabled at most.
   */
  uiAvailability: "ready" | "coming_soon"
  /** Compiled query params, null when the filter cannot run today. */
  compiled: CompiledInboxFilterParams | null
}

/**
 * Materialize the ordered filter views the UI consumes. Hidden filters are
 * excluded; planned or non-compilable filters surface as `coming_soon` with
 * `compiled: null` — a filter can NEVER look ready while lacking semantics.
 */
export function resolveInboxFilterViews(resolved: ResolvedInboxFilters): ResolvedInboxFilterView[] {
  const byId = new Map(resolved.definitions.map((def) => [def.id, def]))
  const hiddenSet = new Set(resolved.config.hidden)
  const primarySet = new Set(resolved.config.primary)
  const views: ResolvedInboxFilterView[] = []
  for (const id of resolved.config.order) {
    if (hiddenSet.has(id)) continue
    const def = byId.get(id)
    if (!def) continue
    const compiled = def.availability === "active" ? compileInboxFilterRule(def.queryRule) : null
    views.push({
      id,
      labelKey: def.labelKey,
      iconToken: def.iconToken,
      group: def.group,
      scope: def.scope,
      tier: primarySet.has(id) ? "primary" : "secondary",
      isDefault: resolved.config.defaultFilter === id,
      countStrategy: def.countStrategy,
      uiAvailability: compiled ? "ready" : "coming_soon",
      compiled,
    })
  }
  return views
}

export interface ActiveUrlFilter {
  /** Canonical id for chip/sidebar highlighting; null when only a legacy rule matched. */
  id: InboxFilterId | null
  /** Compiled query params ({} = default unfiltered view). */
  compiled: CompiledInboxFilterParams
  /** True when the raw value was unknown/unusable and fell back to the default view. */
  isFallback: boolean
}

/**
 * Resolve a raw `?filter=` URL value against the EFFECTIVE filter views,
 * falling back through progressively broader lookups so old or hidden links
 * never break:
 *
 *   1. effective views (ready → its compiled params; coming_soon → fallback);
 *   2. core registry (covers filters a workspace HID — hidden means "not
 *      rendered", deep links still resolve);
 *   3. `channel:<id>` parsing (channel deep links survive config changes);
 *   4. legacy aliases (`new`, `in_progress`, `urgent`, `needs_reply`,
 *      `leads`, `todo`, `scheduled` — the pre-registry `mapSidebarFilter`
 *      contract, preserved verbatim);
 *   5. safe fallback → the default unfiltered view (never a broken query).
 */
export function resolveActiveUrlFilter(
  raw: string | null | undefined,
  views: readonly ResolvedInboxFilterView[],
): ActiveUrlFilter {
  if (!raw || raw === "inbox" || raw === "all") {
    return { id: "all", compiled: {}, isFallback: false }
  }
  const view = views.find((v) => v.id === raw)
  if (view) {
    if (view.uiAvailability === "ready" && view.compiled) {
      return { id: view.id, compiled: view.compiled, isFallback: false }
    }
    return { id: "all", compiled: {}, isFallback: true }
  }
  const core = getCoreInboxFilter(raw)
  if (core && core.availability === "active") {
    const compiled = compileInboxFilterRule(core.queryRule)
    if (compiled) return { id: core.id, compiled, isFallback: false }
  }
  const channelId = parseChannelFilterId(raw)
  if (channelId && isChannelSelectableInFilters(INBOX_CHANNELS[channelId])) {
    // Planned channels are excluded: their filter must not run a query that
    // pretends the integration exists.
    return { id: raw, compiled: { channel: [channelId] }, isFallback: false }
  }
  const legacy = LEGACY_INBOX_FILTER_ALIASES[raw]
  if (legacy) {
    const compiled = compileInboxFilterRule(legacy.rule)
    if (compiled) return { id: legacy.canonicalId, compiled, isFallback: false }
  }
  return { id: "all", compiled: {}, isFallback: true }
}

/**
 * Group filter ids by count strategy — the aggregation PLAN. One aggregate
 * query per non-"none"/"dedicated" strategy serves every filter in its
 * bucket; there is never a per-filter query (no N+1). This phase only plans;
 * a future counts endpoint executes the plan.
 */
export function planInboxFilterCounts(
  views: readonly ResolvedInboxFilterView[],
): Record<Exclude<InboxFilterCountStrategy, "none">, InboxFilterId[]> {
  const plan: Record<Exclude<InboxFilterCountStrategy, "none">, InboxFilterId[]> = {
    status_aggregate: [],
    urgency_aggregate: [],
    channel_aggregate: [],
    dedicated: [],
  }
  for (const view of views) {
    if (view.uiAvailability !== "ready") continue
    if (view.countStrategy === "none") continue
    plan[view.countStrategy].push(view.id)
  }
  return plan
}
