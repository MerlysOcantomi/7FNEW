import type { GlobalSearchMessages } from "../types"

/**
 * English source for the `globalSearch` UI namespace — dialog chrome,
 * quick-navigation labels, result-group headings and structural row strings.
 * Result titles/subjects/names are user content and never live here.
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
  exampleChips: ["Ana invoice", "Carlos contract", "appointment tomorrow", "proposal"],
  quickLinks: {
    overview: "Overview",
    manualIntake: "Manual Intake",
    projects: "Projects",
    invoices: "Invoices",
    files: "Files",
    departments: "Departments",
    improvements: "Improvements",
    communication: "Communication",
    notifications: "Notifications",
    aiWorkspace: "AI workspace",
    identityResolution: "Identity Resolution",
    history: "History",
    library: "Library",
    users: "Users",
  },
  groups: {
    conversations: "Inbox conversations",
    todayTasks: "Today tasks",
    tasks: "Tasks",
    clients: "Clients",
    projects: "Projects",
    invoices: "Invoices",
    schedule: "Schedule",
    notes: "Notes",
    documents: "Documents",
    attachments: "Attachments",
  },
  result: {
    contactFallback: "Contact",
    conversationPrefix: "Conversation",
    opensTodayBoard: "Opens Today board (full workspace task)",
    due: (when) => `Due ${when}`,
    legacyTaskNoProject: "Legacy task · no project",
    clientFallback: "Client",
    projectFallback: "Project",
    invoiceTitle: (num) => `Invoice ${num}`,
    noClient: "No client",
    opensCalendar: "Opens Calendar (workspace event)",
    noteFallback: "Note",
    attachment: "attachment",
  },
  counts: {
    results: (count) => (count === 1 ? "1 result" : `${count} results`),
    links: (count) => (count === 1 ? "1 link" : `${count} links`),
  },
  empty: {
    noResultsPrefix: "No results for",
    hint: "Try another search term",
  },
}
