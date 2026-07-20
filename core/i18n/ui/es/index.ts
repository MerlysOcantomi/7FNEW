import type { LocaleCatalogOverrides } from "../types"
import { common } from "./common"
import { nav } from "./nav"
import { globalSearch } from "./global-search"
import { globalNew } from "./global-new"
import { agents } from "./agents"
import { settings } from "./settings"
import { today } from "./today"
import { clients } from "./clients"
import { calendar } from "./calendar"
import { billing } from "./billing"
import { services } from "./services"
import { team } from "./team"
import { inbox } from "./inbox"
import { statuses } from "./statuses"
import { voice } from "./voice"

/**
 * Spanish catalog contribution — ONLY really-translated namespaces (each one
 * complete against its typed contract). Every registered namespace currently
 * has a real Spanish translation; if a future namespace is not yet
 * translated, leave it OUT so composition in `ui/index.ts` serves the
 * English object (explicit per-namespace fallback, surfaced by
 * UI_NAMESPACE_COVERAGE and verified by test). Never add an English-valued
 * file here to fake coverage.
 */
export const es: LocaleCatalogOverrides = {
  common,
  nav,
  globalSearch,
  globalNew,
  agents,
  settings,
  today,
  clients,
  calendar,
  billing,
  services,
  team,
  inbox,
  statuses,
  voice,
}
