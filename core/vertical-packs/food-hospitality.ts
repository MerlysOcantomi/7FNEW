/**
 * Food / Hospitality vertical pack.
 *
 * Bonabasto is the first commercial experience over this technical family.
 * The family stays reusable for future hospitality experiences (bar, club,
 * discoteca) without forking sevenef Core or shared modules.
 *
 * BONA-00 rules:
 *   - data only: no DB imports, no routes, no restaurant persistence;
 *   - only existing sevenef surfaces are exposed;
 *   - Today stays on the real core work_first mode until Orders exists;
 *   - order_first is a declared future target only, never a runtime mode here;
 *   - no speculative platform capabilities are granted by this pack.
 */

import type { VerticalInboxChannelsDefaults } from "@core/inbox/channel-config"
import type { VerticalInboxFiltersDefaults } from "@core/inbox/filter-config"

export const BONABASTO_EXPERIENCE_KEY = "bonabasto" as const

export const FOOD_HOSPITALITY_MODULE_VISIBILITY: Record<string, boolean> = {
  today: true,
  clientes: true,
  inbox: true,
  marketing: true,
  cobros: true,
  businessOverview: true,
  tasksPage: false,
  projects: false,
  financeAdvanced: false,
  reports: false,
  inventoryAdvanced: false,
}

export const FOOD_HOSPITALITY_LABEL_OVERRIDES: Record<string, string> = {
  "client.singular": "Cliente",
  "client.plural": "Clientes",
  "inbox.singular": "Mensajes",
  "inbox.plural": "Mensajes",
  "marketing.singular": "Marketing",
  "billing.singular": "Cobro",
  "billing.plural": "Cobros",
}

export interface FoodHospitalityPack {
  verticalKey: "food-hospitality"
  defaultExperienceKey: typeof BONABASTO_EXPERIENCE_KEY
  name: string
  verticalName: string
  brandLine: string
  description: string
  locale: string
  businessType: "food-hospitality"
  navProfileId: "food-hospitality"
  themes: {
    default: string
    available: string[]
  }
  channels: string[]
  recommendedModules: string[]
  today: {
    /** Real runtime mode until the Orders backend exists. */
    mode: "work_first"
    /** Architecture target only. Not a TodayLayoutMode until BONA-03. */
    targetMode: "order_first"
    activateRealForRealWorkspaces: false
  }
  modules: Record<string, boolean>
  labels: Record<string, string>
  inbox: {
    channels: VerticalInboxChannelsDefaults
    filters: VerticalInboxFiltersDefaults
    filterDefinitions: []
  }
}

export const FOOD_HOSPITALITY_PACK: FoodHospitalityPack = {
  verticalKey: "food-hospitality",
  defaultExperienceKey: BONABASTO_EXPERIENCE_KEY,
  name: "Food / Hospitality",
  verticalName: "Bonabasto",
  brandLine: "Bonabasto, by sevenef",
  description:
    "Restaurantes, comida para llevar, cafeterías, bares y otros negocios de hostelería",
  locale: "es",
  businessType: "food-hospitality",
  navProfileId: "food-hospitality",
  // BONA-00 deliberately uses an existing platform theme. Bonabasto visual
  // identity is a later design decision, not invented in the architecture pack.
  themes: {
    default: "midnight",
    available: ["midnight"],
  },
  channels: ["whatsapp", "instagram", "web_chat", "email"],
  // Existing shared surfaces only. Catalog / Orders / Inventory are added here
  // only when their real modules land.
  recommendedModules: ["clients", "messages", "marketing"],
  today: {
    mode: "work_first",
    targetMode: "order_first",
    activateRealForRealWorkspaces: false,
  },
  modules: FOOD_HOSPITALITY_MODULE_VISIBILITY,
  labels: FOOD_HOSPITALITY_LABEL_OVERRIDES,
  inbox: {
    channels: {
      enabled: ["whatsapp", "instagram", "web_chat", "manual", "email"],
      order: ["whatsapp", "instagram", "web_chat", "manual", "email"],
      primary: ["whatsapp", "instagram", "web_chat"],
      secondary: ["manual", "email"],
      defaultChannel: "whatsapp",
    },
    filters: {
      enabled: [
        "all",
        "needs_action",
        "unanswered",
        "urgent",
        "waiting",
        "done",
        "unassigned",
        "opportunities",
        "closed",
        "archived",
        "trash",
      ],
      order: [
        "all",
        "needs_action",
        "unanswered",
        "urgent",
        "waiting",
        "done",
        "unassigned",
        "opportunities",
        "closed",
        "archived",
        "trash",
      ],
      primary: ["all", "needs_action", "unanswered", "urgent", "waiting", "done"],
      secondary: ["unassigned", "opportunities", "closed", "archived", "trash"],
      hidden: [],
      defaultFilter: "all",
    },
    filterDefinitions: [],
  },
}

/**
 * Serialized defaults consumed by core/verticals.ts and the Vertical seed.
 * Experience selection is intentionally NOT serialized here: the technical
 * family can host more than Bonabasto. Entry products/workspace config select
 * the commercial experience.
 */
export function buildFoodHospitalityDefaultConfig(): string {
  return JSON.stringify({
    locale: FOOD_HOSPITALITY_PACK.locale,
    modules: FOOD_HOSPITALITY_PACK.modules,
    ui: { labels: FOOD_HOSPITALITY_PACK.labels },
    nav: { profile: FOOD_HOSPITALITY_PACK.navProfileId },
    today: FOOD_HOSPITALITY_PACK.today,
    inbox: FOOD_HOSPITALITY_PACK.inbox,
  })
}
