import type { LocaleCatalogOverrides } from "../types"
import { common } from "./common"
import { nav } from "./nav"
import { globalSearch } from "./global-search"
import { globalNew } from "./global-new"
import { agents } from "./agents"
import { today } from "./today"
import { appointments } from "./appointments"
import { statuses } from "./statuses"

/**
 * French catalog contribution — ONLY really-translated namespaces (each one
 * complete against its typed contract). Scope so far: the global toolbar
 * family — nav, Search, New, Agents, Today (I18N-TOP-ACTIONS-01) — plus the
 * shared status/priority labels (I18N-STATUSES-CENTRAL-04) and the shared
 * common action labels (I18N-SHARED-PRIMITIVES-05). Every other namespace intentionally
 * stays OUT and serves English (explicit fallback, surfaced by
 * UI_NAMESPACE_COVERAGE). Never add an English-valued file here to fake
 * coverage.
 */
export const fr: LocaleCatalogOverrides = {
  common,
  nav,
  globalSearch,
  globalNew,
  agents,
  today,
  appointments,
  statuses,
}
