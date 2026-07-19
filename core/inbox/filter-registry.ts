/**
 * Central Inbox filter registry — the single source of truth for every filter
 * the Smart Inbox can offer, and for how each filter compiles into a REAL
 * query. Phase 3 of `docs/product/smart-inbox-multichannel-audit.md`.
 *
 * Design rules (mirroring `core/inbox/channel-registry.ts`):
 *   - Pure declarative data + pure functions. No `@core/db`, no React, no
 *     icon imports — icons are TOKENS resolved by the UI layer.
 *   - Every filter carries a TYPED query rule from a closed discriminated
 *     union. Workspace/vertical configuration can only reference filters by
 *     id (order / visibility / tiering) — it can never introduce arbitrary
 *     predicates, so config JSON is data, not code.
 *   - Rules compile centrally (`compileInboxFilterRule`) into the flat param
 *     shape the existing `/api/inbox/conversations` endpoint understands.
 *     A rule that cannot compile is INVALID and must never render as a
 *     working filter ("no visual filters without semantics").
 *
 * Filter combination model (decision, preserved from current behaviour):
 *   - The PRIMARY filter is single-active and lives in the URL as
 *     `/inbox?filter=<id>`. The sidebar Smart Inbox subitems and the toolbar
 *     chip row are two representations of this SAME state.
 *   - The toolbar's independent dimensions (channel picker, priority,
 *     assignment, category chips, text search) COMBINE with the primary
 *     filter as AND — exactly as before this registry existed. When the
 *     primary filter itself constrains one of those dimensions (e.g. a
 *     `channel:whatsapp` primary filter), the explicit toolbar control for
 *     that dimension takes precedence when set (mirrors the pre-existing
 *     "explicit status select wins over sidebar filter" rule).
 *
 * Future user-defined filters (documented, NOT implemented — no Prisma
 * changes in this phase): a `UserInboxFilter` record would carry
 * `{ id, workspaceId, ownerUserId, name, rule: InboxFilterQueryRule (JSON,
 * validated against this union on write), sortOrder, visibility:
 * "private" | "shared", isPersonalDefault }`. Scope "user" already exists in
 * the type model so those rows can join the resolution pipeline without a
 * schema change here.
 */

import {
  normalizeInboxChannelId,
  type InboxChannelId,
} from "./channel-registry"
import type { ResolvedInboxChannelView } from "./channel-config"

export type InboxFilterId = string

export type InboxFilterGroup =
  | "workflow"
  | "priority"
  | "smart"
  | "storage"
  | "channel"
  | "assignment"
  | "vertical"
  | "custom"

export type InboxFilterScope = "core" | "vertical" | "user"

/**
 * active  — the rule compiles against data/semantics that exist today.
 * planned — declared for the roadmap (e.g. Beauty triage-vocabulary filters,
 *           the old "Scheduled" placeholder). Planned filters are visible at
 *           most as disabled affordances and NEVER execute a query — running
 *           one would return misleading results while pretending to work.
 */
export type InboxFilterAvailability = "active" | "planned"

/**
 * How a filter's counter would be computed. This phase only DECLARES the
 * strategy (and `planInboxFilterCounts` in `filter-config.ts` proves the
 * plan needs one aggregation per strategy, never one query per filter);
 * actually rendering more counters is future work. `dedicated` = the filter
 * already has its own endpoint (the attention badge). `none` = show no
 * counter rather than introduce N+1 queries.
 */
export type InboxFilterCountStrategy =
  | "none"
  | "status_aggregate"
  | "urgency_aggregate"
  | "channel_aggregate"
  | "dedicated"

/** Closed, typed rule union — the ONLY way a filter can express a query. */
export type InboxFilterQueryRule =
  | { type: "all" }
  | { type: "status"; values: string[] }
  | { type: "urgency"; values: string[] }
  | { type: "channel"; values: InboxChannelId[] }
  | { type: "assignment"; value: "assigned" | "unassigned" | "mine" }
  | { type: "unanswered"; minAgeMinutes?: number }
  /** Depends on the AI/triage vocabulary — no server support yet (planned rules only). */
  | { type: "intent"; values: string[] }
  | { type: "category"; values: string[] }
  | { type: "compound"; operator: "and"; rules: InboxFilterQueryRule[] }

/** Which built-in surfaces render the filter by default (config can promote). */
export type InboxFilterSurface = "sidebar" | "toolbar"

export interface InboxFilterDefinition {
  id: InboxFilterId
  /**
   * Label lookup key. Core workflow/storage/smart filters resolve through the
   * existing i18n catalogs (`nav.smartInbox.items` in the sidebar,
   * `inbox.toolbar.workFilters` in the toolbar); channel filters resolve
   * through the channel label maps. The key equals the catalog member name.
   */
  labelKey: string
  iconToken?: string
  group: InboxFilterGroup
  scope: InboxFilterScope
  availability: InboxFilterAvailability
  queryRule: InboxFilterQueryRule
  countStrategy: InboxFilterCountStrategy
  /**
   * Whether the filter can be combined with the independent toolbar
   * dimensions (channel / priority / assignment / category / search).
   * Everything is combinable today; the flag exists so a future exclusive
   * filter can opt out explicitly instead of by convention.
   */
  combinable: boolean
  /** Default built-in placement. Vertical/workspace config can promote/demote. */
  surfaces: readonly InboxFilterSurface[]
}

// ── Core filter set ─────────────────────────────────────────────────────────
//
// Ids are STABLE URL contracts (`/inbox?filter=<id>`): the pre-registry
// sidebar values keep working unchanged. Status value sets are copied
// verbatim from the old `mapSidebarFilter()` in `app/inbox/page.tsx` — see
// that function's history for the product rationale per bucket.

export const CORE_INBOX_FILTERS: readonly InboxFilterDefinition[] = [
  {
    id: "all",
    labelKey: "all",
    iconToken: "inbox",
    group: "workflow",
    scope: "core",
    availability: "active",
    queryRule: { type: "all" },
    countStrategy: "none",
    combinable: true,
    surfaces: ["toolbar"],
  },
  {
    id: "needs_action",
    labelKey: "needsAction",
    iconToken: "message-plus",
    group: "workflow",
    scope: "core",
    availability: "active",
    queryRule: { type: "status", values: ["new", "assigned", "triaged", "lead_detected"] },
    // The sidebar attention badge already has its own endpoint.
    countStrategy: "dedicated",
    combinable: true,
    surfaces: ["sidebar", "toolbar"],
  },
  {
    id: "waiting",
    labelKey: "waiting",
    iconToken: "clock",
    group: "workflow",
    scope: "core",
    availability: "active",
    queryRule: { type: "status", values: ["awaiting_response"] },
    countStrategy: "status_aggregate",
    combinable: true,
    surfaces: ["sidebar", "toolbar"],
  },
  {
    id: "done",
    labelKey: "done",
    iconToken: "check-circle",
    group: "workflow",
    scope: "core",
    availability: "active",
    queryRule: { type: "status", values: ["resolved", "closed", "converted"] },
    countStrategy: "status_aggregate",
    combinable: true,
    surfaces: ["sidebar", "toolbar"],
  },
  {
    id: "unanswered",
    labelKey: "unanswered",
    iconToken: "reply-alert",
    group: "workflow",
    scope: "core",
    availability: "active",
    queryRule: { type: "unanswered" },
    countStrategy: "none",
    combinable: true,
    // Not in the default core chip row (preserves pre-registry UI); verticals
    // promote it via their pack config (Beauty does).
    surfaces: [],
  },
  {
    id: "urgent",
    labelKey: "urgent",
    iconToken: "alert",
    group: "priority",
    scope: "core",
    availability: "active",
    // Matches the legacy `?filter=urgent` alias exactly.
    queryRule: { type: "urgency", values: ["alta", "critica"] },
    countStrategy: "urgency_aggregate",
    combinable: true,
    surfaces: [],
  },
  {
    id: "unassigned",
    labelKey: "unassigned",
    iconToken: "user-off",
    group: "assignment",
    scope: "core",
    availability: "active",
    queryRule: { type: "assignment", value: "unassigned" },
    countStrategy: "none",
    combinable: true,
    surfaces: [],
  },
  {
    id: "opportunities",
    labelKey: "opportunities",
    iconToken: "star",
    group: "smart",
    scope: "core",
    availability: "active",
    queryRule: { type: "status", values: ["lead_detected"] },
    countStrategy: "status_aggregate",
    combinable: true,
    surfaces: ["sidebar"],
  },
  {
    id: "scheduled",
    labelKey: "scheduled",
    iconToken: "calendar-clock",
    group: "smart",
    scope: "core",
    // The old nav entry was a placeholder with NO semantics (it rendered the
    // unfiltered list). Declared planned: kept as an id (URLs fall back
    // safely) but no longer rendered as a working filter.
    availability: "planned",
    queryRule: { type: "all" },
    countStrategy: "none",
    combinable: true,
    surfaces: [],
  },
  {
    id: "closed",
    labelKey: "closed",
    iconToken: "check-done",
    group: "storage",
    scope: "core",
    availability: "active",
    queryRule: { type: "status", values: ["closed"] },
    countStrategy: "status_aggregate",
    combinable: true,
    surfaces: ["sidebar"],
  },
  {
    id: "archived",
    labelKey: "archived",
    iconToken: "archive",
    group: "storage",
    scope: "core",
    availability: "active",
    queryRule: { type: "status", values: ["archived"] },
    countStrategy: "status_aggregate",
    combinable: true,
    surfaces: ["sidebar"],
  },
  {
    id: "trash",
    labelKey: "trash",
    iconToken: "trash",
    group: "storage",
    scope: "core",
    availability: "active",
    queryRule: { type: "status", values: ["trashed"] },
    countStrategy: "status_aggregate",
    combinable: true,
    surfaces: ["sidebar"],
  },
]

const CORE_FILTERS_BY_ID: ReadonlyMap<string, InboxFilterDefinition> = new Map(
  CORE_INBOX_FILTERS.map((def) => [def.id, def]),
)

/**
 * Legacy `?filter=` aliases (old bookmarks, notifications, external links).
 * Each maps to the rule the pre-registry `mapSidebarFilter()` produced, so
 * existing URLs keep the exact same query. Aliases are resolution-only: they
 * never render as filter options.
 */
export const LEGACY_INBOX_FILTER_ALIASES: Readonly<
  Record<string, { canonicalId: InboxFilterId | null; rule: InboxFilterQueryRule }>
> = {
  new: { canonicalId: null, rule: { type: "status", values: ["new"] } },
  in_progress: {
    canonicalId: null,
    rule: { type: "status", values: ["assigned", "awaiting_response", "triaged"] },
  },
  needs_reply: { canonicalId: "waiting", rule: { type: "status", values: ["awaiting_response"] } },
  leads: { canonicalId: "opportunities", rule: { type: "status", values: ["lead_detected"] } },
  /** Retired placeholders — always resolved to the default unfiltered view. */
  todo: { canonicalId: "all", rule: { type: "all" } },
  scheduled: { canonicalId: "all", rule: { type: "all" } },
}

// ── Channel-derived filters ─────────────────────────────────────────────────

export const CHANNEL_FILTER_PREFIX = "channel:"

export function channelFilterId(channel: InboxChannelId): InboxFilterId {
  return `${CHANNEL_FILTER_PREFIX}${channel}`
}

/** Parse a `channel:<id>` filter id back to its channel, or null. */
export function parseChannelFilterId(id: string): InboxChannelId | null {
  if (!id.startsWith(CHANNEL_FILTER_PREFIX)) return null
  return normalizeInboxChannelId(id.slice(CHANNEL_FILTER_PREFIX.length))
}

/**
 * Derive one filter definition per effective channel view (INBOX-CHANNELS-02).
 * This is the ONLY source of channel filters — there is no separate list to
 * drift. Coming-soon channels yield `availability: "planned"` filters: they
 * may render disabled but can never run a query.
 */
export function buildChannelFilterDefinitions(
  channelViews: readonly ResolvedInboxChannelView[],
): InboxFilterDefinition[] {
  return channelViews.map((view) => ({
    id: channelFilterId(view.id),
    labelKey: view.labelKey,
    iconToken: view.iconToken,
    group: "channel",
    scope: "core",
    availability: view.uiAvailability === "coming_soon" ? "planned" : "active",
    queryRule: { type: "channel", values: [view.id] },
    countStrategy: "channel_aggregate",
    combinable: true,
    surfaces: [],
  }))
}

// ── Rule compilation ────────────────────────────────────────────────────────

/**
 * Flat, serializable compilation target. Maps 1:1 onto the parameters the
 * existing list endpoint/service understand (`status`/`urgency` as CSV `in`
 * lists, single `channel`, `assignedTo`, plus the new `unanswered` support).
 */
export interface CompiledInboxFilterParams {
  status?: string[]
  urgency?: string[]
  channel?: InboxChannelId[]
  assignment?: "assigned" | "unassigned" | "mine"
  unanswered?: { minAgeMinutes?: number }
  intent?: string[]
  category?: string[]
}

function mergeCompiled(
  base: CompiledInboxFilterParams,
  next: CompiledInboxFilterParams,
): CompiledInboxFilterParams | null {
  const out: CompiledInboxFilterParams = { ...base }
  for (const key of ["status", "urgency", "channel", "intent", "category"] as const) {
    const value = next[key]
    if (!value) continue
    const existing = out[key]
    if (!existing) {
      out[key] = value as never
      continue
    }
    // AND across the same list dimension = intersection. Empty intersection
    // is contradictory → invalid rule.
    const intersect = (existing as string[]).filter((v) => (value as string[]).includes(v))
    if (intersect.length === 0) return null
    out[key] = intersect as never
  }
  if (next.assignment) {
    if (out.assignment && out.assignment !== next.assignment) return null
    out.assignment = next.assignment
  }
  if (next.unanswered) {
    const minAges = [out.unanswered?.minAgeMinutes, next.unanswered.minAgeMinutes].filter(
      (v): v is number => typeof v === "number",
    )
    out.unanswered = minAges.length > 0 ? { minAgeMinutes: Math.max(...minAges) } : {}
  }
  return out
}

/**
 * Compile a typed rule into flat query params. Returns `null` when the rule
 * is invalid or not yet executable (empty value lists, `intent` rules — the
 * triage vocabulary has no server support yet, contradictory compounds).
 * Callers MUST treat `null` as "filter cannot run" and fall back safely.
 */
export function compileInboxFilterRule(
  rule: InboxFilterQueryRule,
): CompiledInboxFilterParams | null {
  switch (rule.type) {
    case "all":
      return {}
    case "status":
      return rule.values.length > 0 ? { status: [...rule.values] } : null
    case "urgency":
      return rule.values.length > 0 ? { urgency: [...rule.values] } : null
    case "channel": {
      const values = rule.values
        .map((value) => normalizeInboxChannelId(value))
        .filter((value): value is InboxChannelId => value !== null)
      // The list endpoint accepts a single channel value today.
      return values.length === 1 ? { channel: values } : null
    }
    case "assignment":
      return { assignment: rule.value }
    case "unanswered":
      return {
        unanswered:
          typeof rule.minAgeMinutes === "number" && rule.minAgeMinutes > 0
            ? { minAgeMinutes: rule.minAgeMinutes }
            : {},
      }
    case "category":
      // Server supports a single exact category value today.
      return rule.values.length === 1 ? { category: [...rule.values] } : null
    case "intent":
      // No server support for intent-tag filtering yet — planned rules only.
      return null
    case "compound": {
      if (rule.operator !== "and" || rule.rules.length === 0) return null
      let merged: CompiledInboxFilterParams = {}
      for (const sub of rule.rules) {
        const compiled = compileInboxFilterRule(sub)
        if (!compiled) return null
        const next = mergeCompiled(merged, compiled)
        if (!next) return null
        merged = next
      }
      return merged
    }
    default:
      return null
  }
}

/**
 * Serialize compiled params into the existing `/api/inbox/conversations`
 * query-string shape. Returns only the entries the rule constrains; the page
 * layers its independent toolbar dimensions on top (explicit controls win).
 */
export function compiledFilterToSearchParams(
  compiled: CompiledInboxFilterParams,
): Record<string, string> {
  const out: Record<string, string> = {}
  if (compiled.status?.length) out.status = compiled.status.join(",")
  if (compiled.urgency?.length) out.urgency = compiled.urgency.join(",")
  if (compiled.channel?.length === 1) out.channel = compiled.channel[0]
  if (compiled.assignment === "unassigned") out.assignedTo = "unassigned"
  // "mine" needs the current user id — the page substitutes it (same as the
  // assignment toolbar control). "assigned" has no server param yet; callers
  // must not surface an assigned-rule filter as active until it does.
  if (compiled.category?.length === 1) out.category = compiled.category[0]
  if (compiled.unanswered) {
    out.unanswered = "1"
    if (compiled.unanswered.minAgeMinutes) {
      out.unansweredMinAgeMinutes = String(compiled.unanswered.minAgeMinutes)
    }
  }
  return out
}

// ── Lookup / URL resolution ─────────────────────────────────────────────────

export function getCoreInboxFilter(id: string): InboxFilterDefinition | null {
  return CORE_FILTERS_BY_ID.get(id) ?? null
}

export interface ResolvedUrlFilter {
  /** Canonical filter id (aliases resolved), or null for pure-legacy rules. */
  id: InboxFilterId | null
  rule: InboxFilterQueryRule
  /** True when the raw value was unknown and fell back to the default view. */
  isFallback: boolean
}

/**
 * Resolve a raw `?filter=` URL value against the registry + legacy aliases.
 * Unknown or planned values fall back to the unfiltered default view (never
 * a broken/misleading query); pure-legacy aliases keep their historical rule.
 * `extraDefinitions` lets callers include dynamically-derived definitions
 * (channel filters, vertical definitions) in the lookup.
 */
export function resolveInboxFilterFromUrl(
  raw: string | null | undefined,
  extraDefinitions?: readonly InboxFilterDefinition[],
): ResolvedUrlFilter {
  if (!raw || raw === "inbox" || raw === "all") {
    return { id: "all", rule: { type: "all" }, isFallback: false }
  }
  const core = CORE_FILTERS_BY_ID.get(raw)
  const extra = core ?? extraDefinitions?.find((def) => def.id === raw) ?? null
  if (extra) {
    if (extra.availability === "planned" || !compileInboxFilterRule(extra.queryRule)) {
      return { id: "all", rule: { type: "all" }, isFallback: true }
    }
    return { id: extra.id, rule: extra.queryRule, isFallback: false }
  }
  const legacy = LEGACY_INBOX_FILTER_ALIASES[raw]
  if (legacy) {
    return { id: legacy.canonicalId, rule: legacy.rule, isFallback: false }
  }
  return { id: "all", rule: { type: "all" }, isFallback: true }
}
