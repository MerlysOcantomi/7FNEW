import type { LocaleCatalogOverrides } from "../types"
import { nav } from "./nav"
import { globalSearch } from "./global-search"
import { globalNew } from "./global-new"
import { agents } from "./agents"
import { today } from "./today"

/**
 * German catalog contribution — ONLY really-translated namespaces (each one
 * complete against its typed contract). Scope so far (I18N-TOP-ACTIONS-01):
 * the global toolbar family — nav, Search, New, Agents, Today. Every other
 * namespace intentionally stays OUT and serves English (explicit fallback,
 * surfaced by UI_NAMESPACE_COVERAGE). Never add an English-valued file here
 * to fake coverage.
 */
export const de: LocaleCatalogOverrides = {
  nav,
  globalSearch,
  globalNew,
  agents,
  today,
}
