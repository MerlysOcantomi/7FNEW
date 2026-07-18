import type { UIMessages } from "../types"
import { common } from "./common"
import { nav } from "./nav"
import { globalSearch } from "./global-search"
import { globalNew } from "./global-new"
import { settings } from "./settings"
import { today } from "./today"
import { clients } from "./clients"
import { calendar } from "./calendar"
import { billing } from "./billing"

/**
 * Composed Spanish UI messages. Typed against the same `UIMessages` contract
 * as English — structural parity is a compile-time guarantee (and re-checked
 * at runtime by the parity test in `../../ui.test.ts`).
 *
 * P4.2 status: `settings`, `common`, `nav`, `globalSearch`, `globalNew` and
 * `today` are really translated. `clients`, `calendar` and `billing` still
 * carry English values until their surfaces are wired (deep Finesse content)
 * — none of them has a consumer yet, so no mixed-language UI can result.
 */
export const es: UIMessages = {
  common,
  nav,
  globalSearch,
  globalNew,
  settings,
  today,
  clients,
  calendar,
  billing,
}
