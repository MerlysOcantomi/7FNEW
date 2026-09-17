/**
 * Smart Inbox experience levels — PURE declarative layer (INBOX-UX-SAFE-01).
 *
 * One Smart Inbox, three levels of VISIBLE complexity:
 *
 *   simple    — see who writes → understand → reply/act. Few controls.
 *   standard  — + organise (categories, priority, assignment as secondary controls).
 *   advanced  — + operate (layout modes, channel chips, every filter surface).
 *
 * What this module IS: types, declarative UI policies and pure shaping helpers
 * that existing components consume as props. It follows the precedent of
 * `core/inbox/channel-config.ts` / `filter-config.ts`: no `@core/db`, no React,
 * never throws, unknown input degrades to "no effective experience".
 *
 * What this module is NOT (deliberately, while Neon/Postgres work is active):
 *   - it does not persist anything (no `Workspace.config` reader/writer);
 *   - it does not resolve a level for a workspace or a vertical (no pack gate,
 *     no `resolveWorkspaceExperience` coupling, no host/standalone logic);
 *   - it does not decide permissions, plans, entitlements or availability —
 *     a level can only HIDE or REORDER controls the registries already allow.
 *
 * Invariant the callers rely on: **no effective experience (`null`) leaves the
 * current UI byte-for-byte intact.** Every consumer must treat `null` as
 * "render exactly what you rendered before this module existed".
 *
 * `advanced` is an EXPLICIT selection. Today its policy reproduces the current
 * UI, but the current UI is defined by the absence of a level, not by this
 * profile — the two may diverge later without touching any workspace.
 */

import type { InboxFilterGroup, InboxFilterId } from "./filter-registry"
import type { ResolvedInboxFilterView } from "./filter-config"
import { MANDATORY_INBOX_FILTER_ID } from "./filter-config"

export type InboxExperienceLevel = "simple" | "standard" | "advanced"

export const INBOX_EXPERIENCE_LEVELS: readonly InboxExperienceLevel[] = Object.freeze([
  "simple",
  "standard",
  "advanced",
])

/**
 * How channels are surfaced in the toolbar:
 *   picker — only through the compact channel picker (never as primary chips);
 *   chips  — `channel:<id>` registry filters may also appear as primary chips
 *            when the effective filter config promotes them.
 * The picker itself is always available; a level never hides channels.
 */
export type InboxChannelPresentation = "picker" | "chips"

/**
 * Declarative UI policy for one level. Every field is a VISIBILITY / ORDER
 * decision consumed by existing components. Nothing here grants a capability:
 * a control hidden by a level is still guarded server-side, and a control
 * shown by a level renders only if the registries mark it ready.
 */
export interface InboxExperienceUiPolicy {
  /** Upper bound for the primary-filter chip row (`all` always counts as one). */
  readonly maxPrimaryFilters: number
  /**
   * Ordered allow-list of registry filter ids for the chip row. When non-empty
   * the row is rebuilt from the EFFECTIVE views in this order (ids the
   * workspace does not enable are skipped). When empty, the effective
   * `primary` tier is kept as-is (then only `channelPresentation`, the group
   * allow-list and `maxPrimaryFilters` apply).
   */
  readonly primaryFilterIds: readonly InboxFilterId[]
  /** Filter groups allowed in the chip row (channel chips are governed by `channelPresentation`). */
  readonly primaryFilterGroups: readonly InboxFilterGroup[]
  /** Whether "coming soon" (non-executable) filters may occupy a chip slot. */
  readonly showComingSoonFilters: boolean
  readonly channelPresentation: InboxChannelPresentation
  /** Assignment as a MAIN control (filters row / operational sections). Not the authorization to assign. */
  readonly showAssignment: boolean
  /** "More filters" surface (priority / assignment / technical conversation status). */
  readonly showAdvancedFilters: boolean
  /** Workspace taxonomy (category) chips row. */
  readonly showTaxonomies: boolean
  /** Brief / Read / Handle desktop layout switcher. */
  readonly showLayoutSwitcher: boolean
  /** Operational sections of the context panel (handling strip, assignment, handoff controls). */
  readonly showContextOperationalSections: boolean
  /**
   * Active-filter tokens row (each active dimension visible and removable,
   * plus "clear all"). Simplifying must never hide an active restriction.
   */
  readonly showActiveFilterTokens: boolean
}

export interface InboxExperienceDefinition {
  readonly level: InboxExperienceLevel
  /** Stable, English, for logs/tests. User-facing copy lives in the i18n catalogs. */
  readonly label: string
  readonly summary: string
  readonly ui: InboxExperienceUiPolicy
}

/**
 * Filter ids (core registry) a Simple operator works with. `unanswered`
 * ("no reply yet") is deliberately distinct from `needs_action` ("needs
 * attention": new / assigned / triaged / lead detected) — they are not
 * equivalent and both stay visible. There is intentionally NO "unread"
 * entry: no such filter exists in the registry and this layer never invents
 * semantics.
 */
const SIMPLE_PRIMARY_FILTER_IDS: readonly InboxFilterId[] = Object.freeze([
  "all",
  "needs_action",
  "unanswered",
])

const SIMPLE_POLICY: InboxExperienceUiPolicy = Object.freeze({
  maxPrimaryFilters: 4,
  primaryFilterIds: SIMPLE_PRIMARY_FILTER_IDS,
  primaryFilterGroups: Object.freeze(["workflow"]) as readonly InboxFilterGroup[],
  showComingSoonFilters: false,
  channelPresentation: "picker",
  showAssignment: false,
  showAdvancedFilters: false,
  showTaxonomies: false,
  showLayoutSwitcher: false,
  showContextOperationalSections: false,
  showActiveFilterTokens: true,
})

/**
 * Conservative initial definition: the effective primary row minus channel
 * chips, capped; organisation controls back; still no layout modes.
 */
const STANDARD_POLICY: InboxExperienceUiPolicy = Object.freeze({
  maxPrimaryFilters: 6,
  primaryFilterIds: Object.freeze([]) as readonly InboxFilterId[],
  primaryFilterGroups: Object.freeze([
    "workflow",
    "priority",
    "smart",
    "assignment",
    "storage",
    "vertical",
    "custom",
  ]) as readonly InboxFilterGroup[],
  showComingSoonFilters: true,
  channelPresentation: "picker",
  showAssignment: true,
  showAdvancedFilters: true,
  showTaxonomies: true,
  showLayoutSwitcher: false,
  showContextOperationalSections: true,
  showActiveFilterTokens: true,
})

/**
 * Conservative initial definition: everything the registries surface, with
 * the active-filter tokens row as the only addition over today's chrome.
 */
const ADVANCED_POLICY: InboxExperienceUiPolicy = Object.freeze({
  maxPrimaryFilters: Number.POSITIVE_INFINITY,
  primaryFilterIds: Object.freeze([]) as readonly InboxFilterId[],
  primaryFilterGroups: Object.freeze([
    "workflow",
    "priority",
    "smart",
    "storage",
    "channel",
    "assignment",
    "vertical",
    "custom",
  ]) as readonly InboxFilterGroup[],
  showComingSoonFilters: true,
  channelPresentation: "chips",
  showAssignment: true,
  showAdvancedFilters: true,
  showTaxonomies: true,
  showLayoutSwitcher: true,
  showContextOperationalSections: true,
  showActiveFilterTokens: true,
})

export const INBOX_EXPERIENCE_DEFINITIONS: Readonly<
  Record<InboxExperienceLevel, InboxExperienceDefinition>
> = Object.freeze({
  simple: Object.freeze({
    level: "simple",
    label: "Simple",
    summary: "See who writes, understand the message, reply or act. Few, clear controls.",
    ui: SIMPLE_POLICY,
  }),
  standard: Object.freeze({
    level: "standard",
    label: "Standard",
    summary: "Simple plus organisation: categories, priority and assignment as secondary controls.",
    ui: STANDARD_POLICY,
  }),
  advanced: Object.freeze({
    level: "advanced",
    label: "Advanced",
    summary: "Every filter surface, channel chips and desktop layout modes.",
    ui: ADVANCED_POLICY,
  }),
})

/** Type guard for the closed level union. */
export function isInboxExperienceLevel(value: unknown): value is InboxExperienceLevel {
  return typeof value === "string" && (INBOX_EXPERIENCE_LEVELS as readonly string[]).includes(value)
}

/**
 * Parse an untrusted level value (URL param, JSON, form). Trims and
 * lower-cases; anything outside the closed union → `null` ("no experience").
 * Never throws.
 */
export function parseInboxExperienceLevel(value: unknown): InboxExperienceLevel | null {
  if (typeof value !== "string") return null
  const normalized = value.trim().toLowerCase()
  return isInboxExperienceLevel(normalized) ? normalized : null
}

/** The UI policy for a level, or `null` when there is no effective experience. */
export function getInboxExperienceUiPolicy(
  level: InboxExperienceLevel | null | undefined,
): InboxExperienceUiPolicy | null {
  if (!level || !isInboxExperienceLevel(level)) return null
  return INBOX_EXPERIENCE_DEFINITIONS[level].ui
}

/**
 * Shape the effective filter views into the primary chip row for a level.
 *
 * Input: the EFFECTIVE views (`resolveInboxFilterViews`), i.e. what the
 * workspace's config layers already allow, in resolved order. Output: the
 * subset (and order) rendered as primary chips. Rules, in order:
 *
 *   1. `policy === null` → identity on the `primary` tier (today's behaviour).
 *   2. Candidates = the `primary` tier, or EVERY visible view when the policy
 *      declares `primaryFilterIds` (a level may promote an enabled secondary
 *      filter such as `unanswered` — it can never introduce an id the
 *      workspace did not enable).
 *   3. Drop groups outside `primaryFilterGroups`; drop `channel` chips unless
 *      `channelPresentation === "chips"`; drop coming-soon views unless
 *      `showComingSoonFilters`.
 *   4. Apply the `primaryFilterIds` order when declared.
 *   5. Guarantee the mandatory unfiltered view (`all`) is first.
 *   6. Cap at `maxPrimaryFilters`.
 *
 * The result only affects RENDERING: filters not in the row remain
 * resolvable through the URL (`resolveActiveUrlFilter`) exactly as hidden
 * filters always have — the callers surface them as active-filter tokens.
 */
export function shapeInboxPrimaryFilterViews(
  views: readonly ResolvedInboxFilterView[],
  policy: InboxExperienceUiPolicy | null | undefined,
): ResolvedInboxFilterView[] {
  const primaryTier = views.filter((view) => view.tier === "primary")
  if (!policy) return primaryTier

  const allowedGroups = new Set<InboxFilterGroup>(policy.primaryFilterGroups)
  const useAllowList = policy.primaryFilterIds.length > 0
  const candidates = useAllowList ? views : primaryTier

  let shaped = candidates.filter((view) => {
    if (view.group === "channel") {
      if (policy.channelPresentation !== "chips") return false
    } else if (!allowedGroups.has(view.group)) {
      return false
    }
    if (!policy.showComingSoonFilters && view.uiAvailability !== "ready") return false
    return true
  })

  if (useAllowList) {
    const byId = new Map(shaped.map((view) => [view.id, view]))
    // Dedupe defensively: a repeated id in a (future, persisted) policy must
    // never yield the same chip twice (duplicate React keys in the row).
    const seen = new Set<InboxFilterId>()
    shaped = policy.primaryFilterIds
      .filter((id) => (seen.has(id) ? false : (seen.add(id), true)))
      .map((id) => byId.get(id))
      .filter((view): view is ResolvedInboxFilterView => view !== undefined)
  }

  // The mandatory unfiltered view is always the first chip: without it the
  // operator has no way back to "everything" from the row itself.
  const mandatory =
    shaped.find((view) => view.id === MANDATORY_INBOX_FILTER_ID) ??
    views.find((view) => view.id === MANDATORY_INBOX_FILTER_ID)
  const withoutMandatory = shaped.filter((view) => view.id !== MANDATORY_INBOX_FILTER_ID)
  const ordered = mandatory ? [mandatory, ...withoutMandatory] : withoutMandatory

  const max = Number.isFinite(policy.maxPrimaryFilters) ? Math.max(1, Math.floor(policy.maxPrimaryFilters)) : ordered.length
  return ordered.slice(0, max)
}

/**
 * Desktop layout mode a level allows. Levels without the switcher pin the
 * classic three-column reading layout so a previously persisted Brief/Handle
 * choice can never trap an operator in a layout with no control to leave it.
 * `null` policy → the persisted/deep-linked mode is honoured unchanged.
 */
export function resolveEffectiveInboxLayoutMode<TMode extends string>(
  persistedMode: TMode,
  policy: InboxExperienceUiPolicy | null | undefined,
  fallbackMode: TMode,
): TMode {
  if (!policy) return persistedMode
  return policy.showLayoutSwitcher ? persistedMode : fallbackMode
}
