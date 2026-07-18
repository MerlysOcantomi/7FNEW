import type { UIMessages } from "../types"
import { common } from "./common"
import { nav } from "./nav"
import { settings } from "./settings"
import { today } from "./today"
import { clients } from "./clients"
import { calendar } from "./calendar"
import { billing } from "./billing"

/** Composed English UI messages — the only fully-populated locale in this phase. */
export const en: UIMessages = { common, nav, settings, today, clients, calendar, billing }
