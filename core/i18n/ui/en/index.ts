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
import { voice } from "./voice"

/** Composed English UI messages. */
export const en: UIMessages = {
  common,
  nav,
  globalSearch,
  globalNew,
  settings,
  today,
  clients,
  calendar,
  billing,
  voice,
}
