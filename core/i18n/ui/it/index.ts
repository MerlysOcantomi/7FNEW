import type { LocaleCatalogOverrides } from "../types"
import { nav } from "./nav"
import { globalSearch } from "./global-search"
import { globalNew } from "./global-new"
import { agents } from "./agents"
import { today } from "./today"
import { statuses } from "./statuses"

/**
 * Italian catalog contribution — ONLY really-translated namespaces (each one
 * complete against its typed contract). Scope so far: the global toolbar
 * family — nav, Search, New, Agents, Today (I18N-TOP-ACTIONS-01) — plus the
 * shared status/priority labels (I18N-STATUSES-CENTRAL-04), a small closed
 * enum vocabulary translated in full. Every other namespace intentionally
 * stays OUT and serves English (explicit fallback, surfaced by
 * UI_NAMESPACE_COVERAGE). Never add an English-valued file here to fake
 * coverage.
 */
export const it: LocaleCatalogOverrides = {
  nav,
  globalSearch,
  globalNew,
  agents,
  today,
  statuses,
}
