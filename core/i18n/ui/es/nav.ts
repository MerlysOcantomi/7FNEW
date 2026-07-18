import type { NavMessages } from "../types"

/**
 * Spanish source for the `nav` UI namespace.
 *
 * P4.1 deliberately ships ENGLISH VALUES here: the sidebar does not consume
 * this namespace yet, and nav wording in Spanish (Calendar → Calendario vs the
 * Beauty vertical's "Agenda") is a vocabulary decision owned by the Finesse
 * pilot (P4.2). Typed parity with English is already enforced; only the
 * translation pass is pending. Do NOT wire the nav before translating this.
 */
export const nav: NavMessages = {
  today: "Today",
  calendar: "Calendar",
  clients: "Clients",
  inbox: "Inbox",
  services: "Services",
  billing: "Billing",
  team: "Team",
  settings: "Settings",
}
