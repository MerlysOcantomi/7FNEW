import type { AgentsMessages } from "../types"

/**
 * English source for the `agents` UI namespace — the global Agents quick view
 * (toolbar panel + mobile drawer). Agent proper names never live here.
 */
export const agents: AgentsMessages = {
  subtitle: "What your AI agents are doing · workspace-wide",
  openFull: "Open full Agents",
  closePanel: "Close Agents panel",
  closeDrawer: "Close Agents drawer",
  loadingAria: "Loading Agents activity",
  loadErrorNote: "Agents activity could not be loaded.",
  empty: {
    title: "No agent activity yet",
    body: "When Fanny automates work, proposes a task, or runs an action, it will show up here — grouped by what needs review, what was automated, and what needs your attention.",
  },
  lanes: {
    needsReview: { title: "Needs your review", empty: "No proposals waiting." },
    automated: { title: "Recently handled", empty: "Nothing handled yet." },
    attention: { title: "Attention", empty: "Nothing needs attention." },
  },
  moreOnFullPage: (count) => `+${count} more on the full Agents page`,
  fromInbox: "From Inbox",
}
