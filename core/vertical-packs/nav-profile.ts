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
  /** Optional agent attribution shown under the label (e.g. "por Fanny"). */
  helper?: string
  /** `primary` renders flat at the top; `more` collapses under the "Más" group. */
  group: VerticalNavGroup
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
 * Primary:  Hoy · Agenda · Clientas · Mensajes · Marketing · Servicios
 * More:     Cobros · Equipo · Mr Forte · Herramientas · Notificaciones
 *
 * Hidden by omission (never listed): Business Overview, Inbox Overview, a
 * standalone Tasks page, Projects, advanced Finance, Reports, advanced
 * Inventory. Hiding is achieved by NOT listing them — nothing is deleted from
 * the core.
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
    { id: "today", label: "Hoy", href: "/today", helper: "por Fanny", group: "primary" },
    { id: "agenda", label: "Agenda", href: "/calendario", group: "primary" },
    { id: "clientas", label: "Clientas", href: "/clientes", group: "primary" },
    { id: "mensajes", label: "Mensajes", href: "/inbox", helper: "por Fanny", group: "primary" },
    { id: "marketing", label: "Marketing", href: "/contenido", helper: "por Fiona", group: "primary" },
    { id: "servicios", label: "Servicios", href: "/services", group: "primary" },
    { id: "cobros", label: "Cobros", href: "/facturacion", helper: "por Felix", group: "more" },
    { id: "equipo", label: "Equipo", href: "/usuarios", group: "more" },
    { id: "forte", label: "Mr Forte", href: "/forte/improvements", helper: "Mejoras", group: "more" },
    { id: "herramientas", label: "Herramientas", href: "/biblioteca", group: "more" },
    { id: "notificaciones", label: "Notificaciones", href: "/notificaciones", group: "more" },
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
