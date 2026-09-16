// English-only namespace scaffolding (PR-I18N-2).
//
// Introduces the per-namespace translation structure proposed in
// docs/i18n-localization-architecture.md (§4 "typed namespaces" and §10
// "translation file structure") WITHOUT moving any visible UI strings and
// WITHOUT touching the existing monolithic TranslationSet.
//
//   - English only. es/de parallels are added in later, per-surface PRs.
//   - Not yet consumed by any component. Wiring into the app shell / client
//     provider happens in the provider and pilot PRs (doc §14 PRs 6–10).
//   - The existing email / activity / notifications dictionary continues to
//     live in core/i18n/locales/{en,es,de}.ts and is unaffected by this file.

import { common, type CommonNamespace } from "./common"
import { nav, type NavNamespace } from "./nav"
import { settings, type SettingsNamespace } from "./settings"
import { today, type TodayNamespace } from "./today"
import { clients, type ClientsNamespace } from "./clients"
import { calendar, type CalendarNamespace } from "./calendar"
import { billing, type BillingNamespace } from "./billing"

/** Shape of the per-namespace translation tree for a single locale. */
export interface NamespacedTranslations {
  common: CommonNamespace
  nav: NavNamespace
  settings: SettingsNamespace
  today: TodayNamespace
  clients: ClientsNamespace
  calendar: CalendarNamespace
  billing: BillingNamespace
}

export type NamespaceKey = keyof NamespacedTranslations

/** English base translations, one entry per namespace. */
export const enNamespaces: NamespacedTranslations = {
  common,
  nav,
  settings,
  today,
  clients,
  calendar,
  billing,
}

export { common, nav, settings, today, clients, calendar, billing }
export type {
  CommonNamespace,
  NavNamespace,
  SettingsNamespace,
  TodayNamespace,
  ClientsNamespace,
  CalendarNamespace,
  BillingNamespace,
}
