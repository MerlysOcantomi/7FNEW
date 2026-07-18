import type { UIMessages } from "../types"
import { common } from "./common"
import { nav } from "./nav"
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
 * P4.1 status: `settings` and `common` are really translated; `nav`, `today`,
 * `clients`, `calendar` and `billing` intentionally carry English values until
 * their surfaces are wired in the Finesse pilot (P4.2) — none of them has a
 * consumer yet, so no mixed-language UI can result.
 */
export const es: UIMessages = { common, nav, settings, today, clients, calendar, billing }
