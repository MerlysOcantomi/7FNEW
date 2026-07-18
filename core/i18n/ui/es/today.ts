import type { TodayMessages } from "../types"

/**
 * Spanish source for the `today` UI namespace.
 * P4.1 ships English values on purpose — the Today surface does not consume
 * this namespace yet; the translation pass belongs to the Finesse pilot
 * (P4.2). Typed parity with English is already enforced.
 */
export const today: TodayMessages = {
  title: "Today",
  empty: {
    title: "Nothing for today yet",
    body: "New items will show up here as they come in.",
  },
}
