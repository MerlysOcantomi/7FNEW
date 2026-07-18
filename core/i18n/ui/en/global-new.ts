import type { GlobalNewMessages } from "../types"

/**
 * English source for the `globalNew` UI namespace — trigger + panel CHROME.
 * Item labels ("New client", …) stay in lib/global-new-config.ts until they
 * are composed with entity vocabulary in a later block.
 */
export const globalNew: GlobalNewMessages = {
  trigger: "New",
  title: "New",
  subtitle: "Create across your workspace",
  close: "Close New panel",
  groups: {
    capture: "Capture",
    work: "Work",
    assets: "Assets",
    vertical: "Vertical",
  },
}
