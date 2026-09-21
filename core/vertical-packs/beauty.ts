/**
 * Beauty vertical pack (shown to users as "Finesse") — the single, declarative
 * source of truth for what "7F becomes Finesse" means as DATA, not code. The
 * technical identifier stays `beauty`; Finesse is the visible name only.
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
 *   - `today.mode` is `appointment_first` and its activation gate is ON
 *     (`activateRealForRealWorkspaces: true` since 7F-P01.B3): the Beauty
 *     Today runs on the real backend, so no operator is ever shown demo
 *     bookings — mocks survive only behind explicit QA params.
 */

import type { VerticalInboxChannelsDefaults } from "@core/inbox/channel-config"
import type { VerticalInboxFiltersDefaults } from "@core/inbox/filter-config"
import type { InboxFilterDefinition } from "@core/inbox/filter-registry"
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
/**
 * P4.2.1: neutral Cliente/Clientes is the product decision for standard
 * Finesse (mixed clienteles). NOTE: these seeds land in Vertical.defaultConfig
 * ui.labels — vertical DEFAULTS, not workspace personalization. The vocabulary
 * resolver deliberately ignores them (it reads only the workspace's OWN raw
 * config labels); language-variant nouns live in LOCALIZED_BUSINESS_PRESETS.
 */
export const BEAUTY_LABEL_OVERRIDES: Record<string, string> = {
  "client.singular": "Cliente",
  "client.plural": "Clientes",
  "calendar.singular": "Agenda",
  "calendar.plural": "Agenda",
  "inbox.singular": "Mensajes",
  "inbox.plural": "Mensajes",
  "marketing.singular": "Marketing",
  "billing.singular": "Cobro",
  "billing.plural": "Cobros",
}

/**
 * Beauty business filter definitions (scope "vertical", ALL planned). Intent
 * tag values are the PROPOSED triage vocabulary — they become real when the
 * Fanny pipeline emits them stably; until then `availability: "planned"`
 * keeps every one of these out of the effective ready list.
 */
export const BEAUTY_INBOX_FILTER_DEFINITIONS: InboxFilterDefinition[] = [
  {
    id: "beauty.new_inquiries",
    labelKey: "beautyNewInquiries",
    iconToken: "sparkle",
    group: "vertical",
    scope: "vertical",
    availability: "planned",
    queryRule: { type: "intent", values: ["new_inquiry"] },
    countStrategy: "none",
    combinable: true,
    surfaces: [],
  },
  {
    id: "beauty.booking_requests",
    labelKey: "beautyBookingRequests",
    iconToken: "calendar-plus",
    group: "vertical",
    scope: "vertical",
    availability: "planned",
    queryRule: { type: "intent", values: ["booking_request"] },
    countStrategy: "none",
    combinable: true,
    surfaces: [],
  },
  {
    id: "beauty.pending_confirmations",
    labelKey: "beautyPendingConfirmations",
    iconToken: "clock",
    group: "vertical",
    scope: "vertical",
    availability: "planned",
    queryRule: { type: "intent", values: ["confirmation_pending"] },
    countStrategy: "none",
    combinable: true,
    surfaces: [],
  },
  {
    id: "beauty.reschedules",
    labelKey: "beautyReschedules",
    iconToken: "calendar-clock",
    group: "vertical",
    scope: "vertical",
    availability: "planned",
    queryRule: { type: "intent", values: ["reschedule_request"] },
    countStrategy: "none",
    combinable: true,
    surfaces: [],
  },
  {
    id: "beauty.cancellations",
    labelKey: "beautyCancellations",
    iconToken: "calendar-x",
    group: "vertical",
    scope: "vertical",
    availability: "planned",
    queryRule: { type: "intent", values: ["cancellation"] },
    countStrategy: "none",
    combinable: true,
    surfaces: [],
  },
  {
    id: "beauty.rebooking",
    labelKey: "beautyRebooking",
    iconToken: "repeat",
    group: "vertical",
    scope: "vertical",
    availability: "planned",
    queryRule: { type: "intent", values: ["rebooking_opportunity"] },
    countStrategy: "none",
    combinable: true,
    surfaces: [],
  },
  {
    id: "beauty.no_show",
    labelKey: "beautyNoShow",
    iconToken: "user-x",
    group: "vertical",
    scope: "vertical",
    availability: "planned",
    queryRule: { type: "intent", values: ["no_show_followup"] },
    countStrategy: "none",
    combinable: true,
    surfaces: [],
  },
]

/** Theme keys for a vertical (data only; the theme foundation maps them to CSS later). */
export interface VerticalThemeKeys {
  default: string
  available: string[]
}

export interface BeautyPack {
  verticalKey: string
  name: string
  /** Brand-facing vertical name, e.g. "Finesse". */
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
     * appointment Today. Flipped ON in 7F-P01.B3: the appointment Today now
     * runs on the REAL backend (`GET /api/today/beauty` →
     * `modules/today/beauty-aggregator.ts` over Evento/Cliente + the same
     * `aggregateToday` task reality as the workboard), so real operators see
     * their own data. The mock Studio preview survives only behind
     * `?todayData=mock` / the forced `?vertical=beauty` design preview.
     */
    activateRealForRealWorkspaces: boolean
  }
  modules: Record<string, boolean>
  labels: Record<string, string>
  serviceCatalog: BeautyServiceSeed[]
  appointmentStateLabels: Record<string, string>
  /**
   * Declarative Smart Inbox configuration for this vertical (data only —
   * resolved against core defaults and workspace overrides by
   * `core/inbox/channel-config.ts`). Declaring a channel here NEVER implies
   * its integration exists: availability/capabilities stay in the central
   * channel registry.
   */
  inbox: {
    /** Presentation stays declarative so the shared Inbox Core can expose a simpler
     * conversation-first chrome for Finesse without branching on verticalKey. */
    toolbarVariant: "simple" | "standard"
    channels: VerticalInboxChannelsDefaults
    /** Filter ordering/tiering for this vertical (references core/channel filter ids). */
    filters: VerticalInboxFiltersDefaults
    /**
     * Vertical-specific filter DEFINITIONS (scope "vertical"). Business
     * filters whose rules depend on the Beauty triage vocabulary MUST stay
     * `availability: "planned"` until that vocabulary ships — the resolver
     * keeps planned filters out of every ready list, so they can never
     * pretend to work.
     */
    filterDefinitions: InboxFilterDefinition[]
  }
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
  verticalName: "Finesse",
  description:
    "Manicura, estética, peluquería, lashes, masajes, barbería y pequeños salones beauty",
  locale: "es",
  businessType: "beauty",
  navProfileId: "beauty",
  // Finesse opens in Petróleo Perla by default; Rose Nude stays available.
  themes: {
    default: "petrol-pearl",
    available: ["petrol-pearl", "rose-nude", "sage-luxe", "noir-or"],
  },
  channels: ["whatsapp", "instagram", "messenger", "web_chat"],
  recommendedModules: ["calendar", "clients", "messages", "marketing", "catalog", "services"],
  today: {
    mode: "appointment_first",
    activateRealForRealWorkspaces: true,
  },
  modules: BEAUTY_MODULE_VISIBILITY,
  labels: BEAUTY_LABEL_OVERRIDES,
  serviceCatalog: BEAUTY_SERVICE_CATALOG_SEED,
  appointmentStateLabels: BEAUTY_APPOINTMENT_STATE_LABELS,
  specialistAgent: BEAUTY_SPECIALIST_AGENT,
  /**
   * Finesse starts conversation-first: WhatsApp → Instagram → Messenger →
   * web chat, with TikTok visible as a planned channel. Email/Gmail, SMS,
   * portal and manual capture remain Core capabilities but are not part of
   * the initial Finesse messaging experience; higher business plans can
   * enable them later through entitlement/workspace configuration.
   */
  inbox: {
    toolbarVariant: "simple",
    channels: {
      enabled: ["whatsapp", "instagram", "messenger", "web_chat", "tiktok"],
      order: ["whatsapp", "instagram", "messenger", "web_chat", "tiktok"],
      primary: ["whatsapp", "instagram"],
      secondary: ["messenger", "web_chat", "tiktok"],
      defaultChannel: "whatsapp",
    },
    /**
     * Finesse keeps the primary work choice intentionally small:
     * All + Pending. Channel is a separate dimension in the toolbar; Waiting,
     * Resolved, Urgent and storage states live under More.
     */
    filters: {
      enabled: [
        "all",
        "needs_action",
        "waiting",
        "done",
        "unanswered",
        "urgent",
        "unassigned",
        "archived",
        "trash",
      ],
      order: [
        "all",
        "needs_action",
        "waiting",
        "done",
        "unanswered",
        "urgent",
        "unassigned",
        "archived",
        "trash",
      ],
      primary: ["all", "needs_action"],
      secondary: ["waiting", "done", "unanswered", "urgent", "unassigned", "archived", "trash"],
      defaultFilter: "all",
    },
    filterDefinitions: BEAUTY_INBOX_FILTER_DEFINITIONS,
  }
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
    inbox: BEAUTY_PACK.inbox,
  })
}
