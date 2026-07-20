import type { AgentsMessages } from "../types"

/**
 * English source for the `agents` UI namespace — the global Agents quick view
 * (toolbar panel + mobile drawer) AND the full `/agents` page. Agent proper
 * names (Francis, Fanny, Freya, Fiona, Felix, Mr. Forte, Fathom, Finesse)
 * never live here; activity item titles come from the API as user/structured
 * content and are rendered verbatim.
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
  states: {
    working: "Working",
    waiting: "Waiting for you",
    idle: "Idle",
    comingOnline: "Coming online",
  },
  autonomyLabels: { auto: "Auto", suggests: "Suggests" },
  time: {
    now: "now",
    minutesAgo: (n) => `${n}m ago`,
    hoursAgo: (n) => `${n}h ago`,
  },
  page: {
    live: "Live",
    loadingAria: "Loading Agents",
    loadError: "Agents could not be loaded.",
    summary: {
      agentsCount: (n) => `${n} agents`,
      workingNow: (n) => `${n} working now`,
      awaitingYou: (n) => `${n} awaiting you`,
    },
    kpis: {
      workingNow: "Working now",
      needsReview: "Needs review",
      automatedToday: "Automated today",
      attention: "Attention",
    },
    hero: {
      leadRoleSuffix: "CEO",
      leadsTeam: "Leads the team",
      briefingWorking: "Fanny is on your inbox",
      briefingCalm: "your inbox is calm",
      needsProposals: (n) => `${n} proposal${n === 1 ? "" : "s"} waiting`,
      needsAttention: (n) => `${n} need${n === 1 ? "s" : ""} attention`,
      needsJoiner: "and",
      briefingWithNeeds: (opening, needs) =>
        `Right now: ${opening} — ${needs} for you. The rest of your team is coming online.`,
      briefingNoNeeds: (opening) =>
        `Right now: ${opening} — nothing is waiting on you. The rest of your team is coming online.`,
      reviewProposals: (n) => `Review ${n} proposal${n === 1 ? "" : "s"}`,
      noProposals: "No proposals to review",
      adjustAutonomy: "Adjust autonomy",
      adjustAutonomyTitle: "Autonomy settings are coming soon",
    },
    roster: {
      heading: "Your agents · live",
      defaultTagline: "6 specialists + Francis",
      review: "Review →",
      handledToday: (n) => `${n} done today`,
      watching: "Watching",
      comingOnline: "Coming online",
      upToDate: "Up to date — watching for new work.",
      readyInRegistry: "Ready in your registry — coming online.",
      openDetailsSuffix: "Open details",
    },
    liveActivity: {
      title: "Live activity",
      executedToday: (n) => `Executed today · ${n}`,
      empty: "No actions have run yet today.",
    },
    rail: {
      needsReview: "Needs your review",
      attention: "Attention",
      needsReviewEmpty: "No proposals waiting for you.",
      attentionEmpty: "Nothing needs your attention.",
      proposes: "proposes",
      approve: "Approve",
      dismiss: "Dismiss",
      approveTitle: "Approve & dismiss from Agents is coming soon",
      viewContext: "View context",
      view: "View",
    },
    autonomy: {
      title: "Autonomy",
      auto: "Auto",
      suggests: "Suggests",
      approval: "Approval",
      autoText: "Runs low-risk work on its own",
      suggestsText: "Proposes, waits for your yes",
      approvalText: "Never acts without your approval",
    },
  },
  detail: {
    doingNow: "Doing now",
    today: "Today",
    todayEmpty: "No activity yet today.",
    worksWithTeam: "Works with the team",
    watching: "Watching",
    recentlyHandled: "Recently handled",
    openInPrefix: "Open in",
    sectionComingOnline: "Section coming online",
    sectionComingOnlineTitle: "This agent's section is coming online",
    close: "Close",
    closeDetailsAria: "Close agent details",
    detailsAria: (name) => `${name} details`,
  },
  roster: {
    francis: {
      role: "CEO · Operations & Coordination",
      watching: [
        "The whole operation",
        "Team, roles & capacity",
        "What needs your decision",
        "Blockers & priorities",
        "Business health",
      ],
      collaborationNote:
        "Francis conducts the team — routing work to the right agent, coordinating people and surfacing only what needs you.",
    },
    forte: {
      role: "Architecture · Modules · Lab",
      watching: ["Missing modules", "Vertical fit", "Reusable patterns", "Backend & product logic"],
      collaborationNote:
        "Mr. Forte builds the systems Freya dresses visually and Fiona uses commercially; he listens to Fathom's trends.",
    },
    fanny: {
      role: "Conversations · Inbox",
      watching: ["Unread client replies", "Waiting conversations", "Follow-ups due today", "Urgent messages"],
      collaborationNote:
        "When a message asks for an invoice, Fanny hands it to Felix; new contacts sync to Fiona.",
    },
    freya: {
      role: "Creative Studio · Visual",
      watching: ["Visual content & assets", "Design & interfaces", "Creative pieces for growth & modules"],
      collaborationNote:
        "Freya produces the visuals Fiona needs for growth and the interfaces that dress Mr. Forte's modules.",
    },
    fiona: {
      role: "7F Growth · Marketing",
      watching: [
        "Campaigns & funnels",
        "CRM & relationships",
        "Audiences & segmentation",
        "SEO / AEO visibility",
        "Reactivation opportunities",
      ],
      collaborationNote:
        "Fiona turns Fanny's new contacts and Freya's visuals into campaigns, reactivations and growth.",
    },
    felix: {
      role: "Finance · Invoices",
      watching: ["Unpaid invoices", "Deposits", "Overdue payments", "Finance risk"],
      collaborationNote: "Felix prepares invoices from the requests Fanny hands over.",
    },
    fathom: {
      role: "Research · Vertical trends",
      watching: ["Market trends", "Vertical opportunities", "Competitor & product signals"],
      collaborationNote:
        "Fathom feeds vertical trends to Mr. Forte, SEO/AEO & market signals to Fiona, and content angles to Freya.",
    },
    finesse: {
      role: "Beauty specialist",
      watching: ["The business day", "What needs your attention", "Team coordination"],
      collaborationNote:
        "Leads the 7F Beauty experience: reads the business context, coordinates the day and presents the actions. Works on top of the core agents (Fanny, Freya, Fiona, Felix, Mr. Forte, Fathom) without replacing them.",
    },
  },
}
