/**
 * Vertical mobile navigation — pure resolver (FINESSE-UI-02).
 *
 * Turns a vertical nav profile into the two lists the mobile bottom bar
 * renders: the fixed `primary` slots (declared by `profile.mobile.primaryIds`,
 * in bar order) and the `more` list (every other VISIBLE item, in the
 * profile's declared order). It never invents a destination: every entry is
 * one of the profile's own items, so the bar can only point at routes the
 * desktop navigation already exposes. Solo/Team visibility is applied by the
 * shared `getVisibleVerticalNavItems` so the two surfaces can never drift.
 *
 * Pure and DB-free (no React, no icons, no i18n): safe on the client, the
 * server and in tests. Labels/icons/badges stay in the sidebar layer, which
 * already composes them per locale and vocabulary.
 */

import {
  getVisibleVerticalNavItems,
  type VerticalNavItem,
  type VerticalNavProfile,
  type VerticalNavVisibilityInput,
} from "./nav-profile"

export interface VerticalMobileNavModel {
  /** Bar slots, in bar order (the assistant mic is inserted by the component). */
  primary: VerticalNavItem[]
  /** Everything else that is visible — rendered inside the "More" sheet. */
  more: VerticalNavItem[]
}

/**
 * Resolve the mobile nav for a profile, or `null` when the profile declares no
 * mobile bar (→ the component renders nothing; existing mobile nav unchanged).
 * Unknown ids in `primaryIds` are ignored; items hidden by capacity (teamOnly
 * in a Solo workspace) never appear in either list.
 */
export function resolveVerticalMobileNav(
  profile: VerticalNavProfile | null | undefined,
  visibility: VerticalNavVisibilityInput,
): VerticalMobileNavModel | null {
  if (!profile?.mobile) return null
  const visible = getVisibleVerticalNavItems(profile, visibility)
  const byId = new Map(visible.map((item) => [item.id, item]))
  const primary = profile.mobile.primaryIds
    .map((id) => byId.get(id))
    .filter((item): item is VerticalNavItem => item !== undefined)
  const primaryIds = new Set(primary.map((item) => item.id))
  const more = visible.filter((item) => !primaryIds.has(item.id))
  return { primary, more }
}

/**
 * Whether `pathname` belongs to a nav destination. `/` matches ONLY the exact
 * root (it is the overview, not a prefix of everything); any other href
 * matches itself and its sub-routes (`/today` → `/today/x`). Query strings and
 * hashes are never part of `pathname` (Next's `usePathname`), so `/inbox?f=x`
 * arrives as `/inbox` and matches.
 */
export function isMobileNavHrefActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * The id of the destination that owns `pathname`, or `null` when no nav item
 * matches (e.g. a core route hidden by omission). Primary items win over
 * "more" items; within a list the first declared match wins.
 */
export function resolveActiveMobileNavItemId(
  pathname: string,
  nav: VerticalMobileNavModel,
): string | null {
  for (const item of [...nav.primary, ...nav.more]) {
    if (isMobileNavHrefActive(pathname, item.href)) return item.id
  }
  return null
}

/** True when the active destination lives inside the "More" sheet. */
export function isMoreDestinationActive(pathname: string, nav: VerticalMobileNavModel): boolean {
  const activeId = resolveActiveMobileNavItemId(pathname, nav)
  return activeId !== null && nav.more.some((item) => item.id === activeId)
}

// ─── Mobile header chrome (what stays in the top bar next to the bottom bar) ──

export interface MobileHeaderChromeInput {
  /** A vertical mobile bottom bar is rendered for this workspace (profile.mobile). */
  hasMobileBar: boolean
  /** Inbox-focused mode (`/inbox`): the sheet holds the Smart Inbox views, not primary nav. */
  focused: boolean
  /** The operator is already on `/today` (existing rule: no Today trigger there). */
  onToday: boolean
}

export interface MobileHeaderChrome {
  /** Header "Today" drawer trigger. Hidden when the bar already owns Today. */
  showTodayTrigger: boolean
  /**
   * Header hamburger (opens the navigation sheet). With a bottom bar the sheet
   * would be a second primary navigation, so it hides — except in Inbox-focused
   * mode, where the sheet holds the Smart Inbox views (not primary nav).
   */
  showMenu: boolean
}

/**
 * Decide which top-header actions survive when the vertical bottom bar is the
 * primary mobile navigation (FINESSE-UI-02 R1). Agents, New, Search, Ask Fanny
 * and the workspace identity are never touched here: they have no bar
 * equivalent and keep their own function.
 */
export function resolveMobileHeaderChrome({ hasMobileBar, focused, onToday }: MobileHeaderChromeInput): MobileHeaderChrome {
  return {
    showTodayTrigger: !onToday && !hasMobileBar,
    showMenu: !hasMobileBar || focused,
  }
}

// ─── Today glyph helpers (local calendar day) ────────────────────────────────

/** Day of month (1–31) in the device's LOCAL calendar — what the operator sees on her phone. */
export function getDayOfMonth(date: Date): number {
  return date.getDate()
}

/**
 * Milliseconds until the next local midnight (+ a 1s guard so the timer never
 * fires a hair before the day actually changes). Used by the Today glyph to
 * refresh the day number without a reload. Minimum 1s, never negative.
 */
export function msUntilNextLocalDay(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1, 0)
  return Math.max(1000, next.getTime() - now.getTime())
}
