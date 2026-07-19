import type { NavMessages } from "../types"

/**
 * English source for the `nav` UI namespace. Entity keys are locale fallbacks
 * — vertical vocabulary (Clientas/Agenda/…) overrides them at compose time.
 */
export const nav: NavMessages = {
  today: "Today",
  calendar: "Calendar",
  clients: "Clients",
  inbox: "Inbox",
  services: "Services",
  billing: "Billing",
  team: "Team",
  settings: "Settings",
  tasks: "Tasks",
  finance: "Finance",
  marketing: "Marketing",
  more: "More",
  new: "New",
  search: "Search",
  agents: "Agents",
  agentsOpen: "Open Agents",
  askFanny: "Ask Fanny",
  expandSidebar: "Expand sidebar",
  collapseSidebar: "Collapse sidebar",
  openNavigation: "Open navigation",
  closeNavigation: "Close navigation",
  navigationTitle: "Navigation",
  backToWorkspace: "Back to 7F",
  mySalon: "My salon",
  helpers: {
    marketing: "Content, campaigns & growth",
    billing: "Invoices & payments",
    forteLab: "Modules & improvements",
  },
  smartInbox: {
    title: "Smart Inbox",
    byFanny: "by Fanny",
    groups: {
      work: "Work",
      smartViews: "Smart views",
      storage: "Storage",
    },
    items: {
      inbox: "Inbox",
      needsAction: "Needs action",
      waiting: "Waiting",
      done: "Done",
      scheduled: "Scheduled",
      opportunities: "Opportunities",
      closed: "Closed",
      archived: "Archived",
      trash: "Trash",
    },
  },
}
