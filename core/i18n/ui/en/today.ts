import type { TodayMessages } from "../types"

/**
 * English source for the `today` UI namespace.
 * Not consumed by the Today surfaces yet — foundation only.
 */
export const today: TodayMessages = {
  title: "Today",
  empty: {
    title: "Nothing for today yet",
    body: "New items will show up here as they come in.",
  },
  chrome: {
    openFull: "Open full Today",
    close: "Close Today",
  },
}
