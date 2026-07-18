import type { GlobalSearchMessages } from "../types"

/**
 * English source for the `globalSearch` UI namespace — dialog CHROME only.
 * Result-group headings, quick-link labels and example chips stay in the
 * component until they are composed with nav/vocabulary in a later block.
 */
export const globalSearch: GlobalSearchMessages = {
  placeholder: "Search messages, tasks, clients, invoices...",
  introTitle: "Search your workspace",
  introSubtitle:
    "Find inbox conversations, Today tasks, clients, projects, invoices, events and files.",
  quickNavigation: "Quick navigation",
  exampleSearchesAria: "Example workspace searches",
  loading: "Searching…",
  close: "Close",
  dialogAria: "Workspace search",
  footer: {
    navigate: "navigate",
    open: "open",
    close: "close",
  },
}
