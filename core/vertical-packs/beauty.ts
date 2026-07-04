/**
 * 7F Beauty vertical pack — the single, declarative source of truth for what
 * "7F becomes 7F Beauty" means as DATA, not code.
 *
 * Nothing here is wired into a module. It is consumed by:
 *   - the seed (`prisma/seed.ts`), which serializes `buildBeautyDefaultConfig()`
 *     into the `Vertical.defaultConfig` row;
 *   - the personalization layer (Spanish labels via the `beauty` business type);
 *   - the nav profile (`nav-profile.ts`), which renders the Beauty menu;
 *   - Mr Forte's declarative playbook (`agents/forte/verticals/beauty.ts`).
 *
 * Design rules honored here:
 *   - No `@core/db` import — safe to load on the client and in tests.
 *   - No new routes, no new modules. `modules` is a visibility record, not code.
 *   - Spanish (España) strings live here, in the pack — never hardcoded inside a
 *     core module.
 *   - `today.mode` is DECLARED as `appointment_first`, but the real appointment
 *     Today stays gated (`activateRealForRealWorkspaces: false`) until a real
 *     appointment backend exists. No real operator is shown demo bookings.
 */

import { BEAUTY_SPECIALIST_AGENT, type VerticalSpecialistAgent } from "./specialists"

/** A seed service for the Beauty service catalog (duration/price added later). */
export interface BeautyServiceSeed {
  name: string
  category: string
  active: boolean
}

/**
 * Beauty service catalog seed. Duration and price are intentionally omitted —
 * Mr Forte proposes these progressively and never demands them up front.
 */
export const BEAUTY_SERVICE_CATALOG_SEED: BeautyServiceSeed[] = [
  { name: "Manicura semipermanente", category: "Uñas", active: true },
  { name: "Pedicura", category: "Uñas", active: true },
  { name: "Relleno de uñas", category: "Uñas", active: true },
  { name: "Retirada de esmalte", category: "Uñas", active: true },
  { name: "Nail art", category: "Uñas", active: true },
  { name: "Limpieza facial", category: "Estética", active: true },
  { name: "Lifting de pestañas", category: "Pestañas", active: true },
  { name: "Depilación de cejas", category: "Cejas", active: true },
]

/**
 * Appointment status labels in Spanish (España). Used by the appointment Today
 * and message templates when they go live. Keys mirror the `AppointmentStatus`
 * contract in `modules/today/appointments.ts`.
 */
export const BEAUTY_APPOINTMENT_STATE_LABELS: Record<string, string> = {
  confirmed: "Confirmada",
  pending: "Pendiente de confirmar",
  arrived: "Ha llegado",
  completed: "Completada",
  no_show: "No asistió",
  cancelled: "Cancelada",
}

/**
 * Module visibility for Beauty MVP. `true` = visible / active for Beauty,
 * `false` = hidden for Beauty (still exists in 7F Core, just not surfaced).
 * This record is the declarative source of truth; the *visible* effect in the
 * sidebar comes from the nav profile, which lists only the active surfaces.
 */
export const BEAUTY_MODULE_VISIBILITY: Record<string, boolean> = {
  // Active for Beauty MVP
  today: true,
  agenda: true,
  clientes: true,
  inbox: true,
  marketing: true,
  servicios: true,
  cobros: true,
  // Hidden for Beauty MVP (kept in core, not surfaced)
  businessOverview: false,
  inboxOverview: false,
  tasksPage: false,
  projects: false,
  financeAdvanced: false,
  reports: false,
  inventoryAdvanced: false,
}

/**
 * Flat vocabulary label overrides (Spanish), in the `VerticalConfig.ui.labels`
 * format understood by `core/personalization/resolve.ts` (`"client.plural"` …).
 * These complement the `beauty` business-type preset for anything a workspace
 * wants to pin explicitly.
 */
export const BEAUTY_LABEL_OVERRIDES: Record<string, string> = {
  "client.singular": "Clienta",
  "client.plural": "Clientas",
  "calendar.singular": "Agenda",
  "calendar.plural": "Agenda",
  "inbox.singular": "Mensajes",
  "inbox.plural": "Mensajes",
  "marketing.singular": "Marketing",
  "billing.singular": "Cobro",
  "billing.plural": "Cobros",
}

/** Theme keys for a vertical (data only; the theme foundation maps them to CSS later). */
export interface VerticalThemeKeys {
  default: string
  available: string[]
}

export interface BeautyPack {
  verticalKey: string
  name: string
  /** Brand-facing vertical name, e.g. "7F Beauty". */
  verticalName: string
  description: string
  locale: string
  businessType: string
  navProfileId: string
  /** Theme keys as DATA — consumed by the future theme foundation, not applied here. */
  themes: VerticalThemeKeys
  /** Recommended messaging channels for this vertical (data). */
  channels: string[]
  /** Modules this vertical recommends (data; the actual toggle lives in workspace config). */
  recommendedModules: string[]
  today: {
    /** Declared operating model for Today. */
    mode: "appointment_first"
    /**
     * Gate: while `false`, a REAL Beauty workspace never auto-switches into the
     * appointment Today (which currently renders demo data). Real users stay on
     * the safe default (`work_first`) until a real appointment backend lands.
     * Preview/design review is still reachable via `?todayLayout=appointment_first`.
     */
    activateRealForRealWorkspaces: boolean
  }
  modules: Record<string, boolean>
  labels: Record<string, string>
  serviceCatalog: BeautyServiceSeed[]
  appointmentStateLabels: Record<string, string>
  /**
   * The vertical specialist that leads this vertical's experience (Finesse for
   * Beauty). Optional so existing consumers/tests stay valid. Branding only —
   * not serialized into `Vertical.defaultConfig` (like `name`/`description`).
   */
  specialistAgent?: VerticalSpecialistAgent
}

export const BEAUTY_PACK: BeautyPack = {
  verticalKey: "beauty",
  name: "Beauty",
  verticalName: "7F Beauty",
  description:
    "Manicura, estética, peluquería, lashes, masajes, barbería y pequeños salones beauty",
  locale: "es",
  businessType: "beauty",
  navProfileId: "beauty",
  themes: { default: "rose-nude", available: ["rose-nude", "sage-luxe", "noir-or"] },
  channels: ["whatsapp", "instagram", "email"],
  recommendedModules: ["calendar", "clients", "messages", "marketing", "catalog", "services"],
  today: {
    mode: "appointment_first",
    activateRealForRealWorkspaces: false,
  },
  modules: BEAUTY_MODULE_VISIBILITY,
  labels: BEAUTY_LABEL_OVERRIDES,
  serviceCatalog: BEAUTY_SERVICE_CATALOG_SEED,
  appointmentStateLabels: BEAUTY_APPOINTMENT_STATE_LABELS,
  specialistAgent: BEAUTY_SPECIALIST_AGENT,
}

/**
 * Serialize the Beauty pack into the `Vertical.defaultConfig` JSON string shape
 * consumed by `core/verticals.ts` (`parseJsonConfig` / `mergeConfigs`). This is
 * what the seed writes to the DB row. Keeping it here means the DB row and the
 * in-code pack can never drift.
 */
export function buildBeautyDefaultConfig(): string {
  return JSON.stringify({
    locale: BEAUTY_PACK.locale,
    modules: BEAUTY_PACK.modules,
    ui: { labels: BEAUTY_PACK.labels },
    serviceCatalog: BEAUTY_PACK.serviceCatalog,
    nav: { profile: BEAUTY_PACK.navProfileId },
    today: BEAUTY_PACK.today,
  })
}
