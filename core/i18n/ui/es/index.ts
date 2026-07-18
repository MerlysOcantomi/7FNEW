import type { LocaleCatalogOverrides } from "../types"
import { common } from "./common"
import { nav } from "./nav"
import { globalSearch } from "./global-search"
import { globalNew } from "./global-new"
import { settings } from "./settings"
import { today } from "./today"
import { clients } from "./clients"
import { calendar } from "./calendar"
import { statuses } from "./statuses"
import { voice } from "./voice"

/**
 * Spanish catalog contribution — ONLY really-translated namespaces (each one
 * complete against its typed contract). `billing` is absent on purpose:
 * composition in `ui/index.ts` serves the English object for it (explicit
 * per-namespace fallback, surfaced by UI_NAMESPACE_COVERAGE and verified by
 * test). Never add an English-valued file here to fake coverage.
 */
export const es: LocaleCatalogOverrides = {
  common,
  nav,
  globalSearch,
  globalNew,
  settings,
  today,
  clients,
  calendar,
  statuses,
  voice,
}
