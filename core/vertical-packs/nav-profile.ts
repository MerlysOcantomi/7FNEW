/**
 * Vertical-aware navigation profiles.
 *
 * The 7F sidebar ships one hardcoded navigation for every workspace. A vertical
 * pack can override WHICH modules are visible, their ORDER and their LABELS by
 * declaring a nav profile here. This module is pure data + a pure resolver: it
 * imports nothing (no React, no lucide, no Prisma) so it is safe to call from
 * the client sidebar, from the server, or from a test.
 *
 * Fallback is the whole point: `resolveNavProfile` returns `null` for any
 * vertical that does not declare a profile, and the sidebar keeps rendering its
 * existing default structure byte-for-byte. Adding a vertical here NEVER changes
 * another vertical's navigation.
 *
 * Icons are intentionally NOT part of the profile — they stay in the sidebar
 * (`components/sidebar-nav.tsx`) mapped by item `id`, so core never depends on
 * an icon library.
 *
 * Routes: every `href` MUST point to a route that already exists in 7F Core.
 * This layer only reorders / relabels / hides — it never invents a page. When a
 * vertical wants a dedicated surface that does not exist yet (e.g. a real
 * Servicios page) it points at the closest existing home and the dedicated page
 * is a later, separate step.
 */

export type VerticalNavGroup = "primary" | "more"

export interface VerticalNavItem {
  /** Stable id used by the sidebar to pick an icon. Not shown to the user. */
  id: string
  /** User-facing label (already localized for the vertical). */
  label: string
  /** Existing 7F Core route. Never a new/vertical-specific route. */
  href: string
  /**
   * Optional neutral, FUNCTION-describing subtitle (e.g. "Facturas y pagos").
   * Never an agent attribution: the sidebar describes what a section does, not
   * which agent owns it — work attribution belongs to the Agents surface.
   */
  helper?: string
  /** `primary` renders flat at the top; `more` collapses under the "Más" group. */
  group: VerticalNavGroup
  /**
   * Item visible only in Team-capacity workspaces. Filtered out for Solo
   * (plan `includedSeats === 1`) and while the plan is unresolved, by
   * `getVisibleVerticalNavItems`. Omitted = always visible.
   */
  teamOnly?: boolean
}

export interface VerticalNavProfile {
  /** The vertical this profile belongs to (canonical key). */
  verticalKey: string
  /** Display locale for the labels in this profile. */
  locale: string
  /** Header label for the collapsible "more" group. */
  moreLabel: string
  /** Ordered nav items (primary first, then more). */
  items: VerticalNavItem[]
}

/**
 * 7F Beauty navigation — the target Beauty MVP menu.
 *
 * Primary:  Hoy · Agenda · Clientas · Mensajes · Marketing
 * More:     Cobros · Servicios · Equipo (Team only) · Mr. Forte Lab
 *
 * Hidden by omission (never listed — routes stay live in core): Business
 * Overview, Inbox Overview, a standalone Tasks page, Projects, advanced
 * Finance, Reports, advanced Inventory, Biblioteca/Herramientas, and
 * Notificaciones (which lives in the top-bar bell). Hiding is achieved by NOT
 * listing them — nothing is deleted from the core.
 *
 * Helpers are NEUTRAL function descriptions ("Facturas y pagos"), never agent
 * attributions: the sidebar says what a section does; who does the work is the
 * Agents surface's job.
 *
 * `Servicios` points at `/services` — the generic (core) service-catalog
 * surface. The catalog itself is core infrastructure; Beauty only contributes
 * the seed/labels via its vertical pack.
 */
export const BEAUTY_NAV_PROFILE: VerticalNavProfile = {
  verticalKey: "beauty",
  locale: "es",
  moreLabel: "Más",
  items: [
    { id: "today", label: "Hoy", href: "/today", group: "primary" },
    { id: "agenda", label: "Agenda", href: "/calendario", group: "primary" },
    { id: "clientas", label: "Clientas", href: "/clientes", group: "primary" },
    { id: "mensajes", label: "Mensajes", href: "/inbox", group: "primary" },
    { id: "marketing", label: "Marketing", href: "/contenido", helper: "Contenido, campañas y crecimiento", group: "primary" },
    { id: "cobros", label: "Cobros", href: "/facturacion", helper: "Facturas y pagos", group: "more" },
    { id: "servicios", label: "Servicios", href: "/services", group: "more" },
    { id: "equipo", label: "Equipo", href: "/usuarios", group: "more", teamOnly: true },
    { id: "forte", label: "Mr. Forte Lab", href: "/forte/improvements", helper: "Módulos y mejoras", group: "more" },
  ],
}

/**
 * Vertical keys that resolve to the Beauty nav profile. Kept in sync with
 * `APPOINTMENT_VERTICAL_KEYS` in `modules/today/today-layout-mode.ts` (the
 * appointment-based operating model) so a salon/nails/barber workspace gets both
 * the Beauty menu and — once real appointment data exists — the appointment
 * Today. Adding a key here only affects navigation; it never touches modules.
 */
export const BEAUTY_NAV_VERTICAL_KEYS: ReadonlySet<string> = new Set([
  "beauty",
  "salon",
  "nails",
  "barber",
  "barbershop",
  "spa",
  "lashes",
  "estetica",
])

/**
 * All registered vertical nav profiles, keyed by the canonical verticalKey the
 * profile represents. Future verticals (construction, cleaning, agency) add an
 * entry here + a `*_NAV_VERTICAL_KEYS` set and a case in `resolveNavProfile`.
 */
export const VERTICAL_NAV_PROFILES: Record<string, VerticalNavProfile> = {
  beauty: BEAUTY_NAV_PROFILE,
}

/**
 * Resolve the nav profile for a workspace's vertical, or `null` when the
 * vertical has no profile (→ the sidebar renders its default 7F Core nav).
 * Pure and total: never throws, unknown/empty input → `null`.
 */
export function resolveNavProfile(
  verticalKey: string | null | undefined,
): VerticalNavProfile | null {
  if (!verticalKey) return null
  if (BEAUTY_NAV_VERTICAL_KEYS.has(verticalKey)) return BEAUTY_NAV_PROFILE
  return null
}

// ─── Solo / Team visibility (single source of truth) ─────────────────────────

/**
 * Whether `teamOnly` nav items are visible for a workspace's seat capacity.
 *
 * MVP rule (capacity-based, never `memberCount`):
 *   - `includedSeats === 1`         → Solo → hide Team items
 *   - `includedSeats > 1`           → Team → show Team items
 *   - `includedSeats === null`      → unlimited capacity (enterprise) → show
 *   - `includedSeats === undefined` → plan not resolved yet → hide (no flash)
 *
 * Pure: no React, no DB, no clock. `undefined` is deliberately fail-closed so a
 * Solo workspace never flashes "Equipo" during the workspace/plan load.
 */
export function showsTeamOnlyItems(
  includedSeats: number | null | undefined,
): boolean {
  if (includedSeats === undefined) return false
  if (includedSeats === null) return true
  return includedSeats > 1
}

/** Capacity input for `getVisibleVerticalNavItems`. */
export interface VerticalNavVisibilityInput {
  /** Plan seat allowance: number, `null` (unlimited), or `undefined` (loading). */
  includedSeats: number | null | undefined
}

/**
 * The vertical nav items visible for a workspace, in DECLARED order.
 *
 * This is the ONE place the Solo/Team policy is applied: both the desktop and
 * mobile sidebars call this so they can never drift. Pure — no React, no DB, no
 * hooks. `sidebar-nav.tsx` still owns turning items into `NavSection`s and
 * attaching badges, but it must NOT re-implement the `teamOnly` filter.
 */
export function getVisibleVerticalNavItems(
  profile: VerticalNavProfile,
  { includedSeats }: VerticalNavVisibilityInput,
): VerticalNavItem[] {
  const showTeam = showsTeamOnlyItems(includedSeats)
  return profile.items.filter((item) => !item.teamOnly || showTeam)
}
