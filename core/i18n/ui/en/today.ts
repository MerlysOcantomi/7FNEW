import type { TodayMessages } from "../types"

/** English source for the `today` UI namespace (chrome + daily workboard). */
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
  quick: {
    subtitle: "Daily overview · workspace-wide",
    needsCount: (count) =>
      count === 1 ? "1 thing needs you today" : `${count} things need you today`,
    moreInToday: (count) => `+${count} more in Today`,
    aiChip: "AI",
    sources: { inbox: "Inbox", calendar: "Calendar", task: "Task" },
  },
  workboard: {
    loadingAria: "Loading Today",
    errorNote: "Today could not be loaded.",
    toasts: {
      sendToAiFailed: "Could not send to AI",
      takeOverFailed: "Could not take over",
      tryAgain: "Please try again in a moment.",
    },
    summary: {
      overdue: (count) => `${count} overdue`,
      dueToday: (count) => `${count} due today`,
      waiting: (count) => (count > 0 ? `${count} waiting` : "nothing waiting"),
      caption: "your daily workboard",
    },
    pills: {
      myWork: "My work",
      aiWork: "AI work",
      schedule: "Schedule",
      waiting: "Waiting",
    },
    lanes: {
      myWork: {
        title: "My work",
        subtitle: "Yours, your team's, and anything not yet handed to AI",
        emptyTitle: "No work for you today",
        emptyDescription: "Tasks you create or take over will land here.",
      },
      aiWork: {
        title: "AI work",
        subtitle: "Proposals from Fanny and anything you handed off to AI",
        emptyTitle: "No AI work yet",
        emptyDescription:
          "AI work shows up when Fanny proposes work, or when you hand a task off with “Send to AI” on a My work item.",
        emptyActionLabel: "Review Agents",
      },
      schedule: {
        title: "Schedule",
        subtitle: "Calendar events anchored to today",
        emptyTitle: "No events today",
        emptyDescription: "Scheduled items will appear here.",
      },
    },
    sections: {
      overdue: "Overdue",
      dueToday: "Due today",
      waitingBlocked: "Waiting / Blocked",
      noDate: "No date",
    },
    briefingAria: "Today briefing",
    emptyState: {
      title: "Nothing pending. Nice.",
      body: "Anything that needs your attention will show up here.",
      inboxCta: "Or check your Inbox →",
    },
    row: {
      sendToAi: "Send to AI",
      takeOver: "Take over",
      proposed: "Proposed",
      proposedByAi: "Proposed by AI",
      assignedToMe: "Assigned to me",
      taskChip: "Task",
      fromInbox: "From Inbox",
      fromProject: (name) => `From ${name}`,
      projectFallback: "Project",
      fromCalendar: "From Calendar",
      eventAria: "Event",
      atTime: (time) => `at ${time}`,
      priorities: {
        critical: "Urgent",
        high: "High",
        low: "Low",
        normal: "Normal",
      },
      due: {
        todayAt: (time) => `Today ${time}`,
        yesterday: "Yesterday",
        tomorrow: "Tomorrow",
        daysAgo: (days) => `${days}d ago`,
      },
      a11y: {
        task: "Task",
        priorityPrefix: "priority",
        duePrefix: "due",
        noDueDate: "no due date",
        inMyLane: "in my lane",
        inAiLane: "in AI lane",
        fromInbox: "from Inbox",
        fromProject: (name) => `from project ${name}`,
        manualTask: "manual task",
      },
    },
  },
  startHere: {
    eyebrow: "Start here · now",
    ariaLabel: "Start here",
    allClearTitle: "You're all clear",
    allClearBody:
      "Nothing needs you right now. New work and AI proposals will surface here as the day moves.",
    openTask: "Open task",
    sendToAI: "Send to AI",
    badges: { overdue: "Overdue", today: "Due today", waiting: "Waiting", undated: "No date" },
    source: {
      inbox: "From Inbox · assigned to you",
      projectFallback: "From a project",
      fromProject: (name) => `From ${name}`,
      manual: "Task",
      calendar: "From Calendar",
    },
    why: {
      overdue: (since) => `Overdue${since} — clearing it resets your board and gets the day moving.`,
      today: (at) => `Due today${at}. The clearest win on the board right now.`,
      waiting: "Waiting on someone else. A quick nudge keeps it from stalling the day.",
      undated: "No due date yet — a good one to close while the day is open.",
    },
    sinceDate: (formatted) => ` since ${formatted}`,
    atTime: (formatted) => ` at ${formatted}`,
  },
  briefing: {
    ariaLabel: "Daily briefing",
    eyebrow: { morning: "Morning briefing", afternoon: "Afternoon briefing", evening: "Evening briefing" },
    greeting: { morning: "Good morning.", afternoon: "Good afternoon.", evening: "Good evening." },
    meetings: (count) => `${count} ${count === 1 ? "event" : "events"} on the calendar`,
    noMeetings: "no meetings today",
    bodyOverdue: (overdue, meetings) =>
      `You have ${overdue} overdue ${overdue === 1 ? "item" : "items"} and ${meetings}. I'd ${
        overdue === 1 ? "clear it first" : "clear the overdue work first"
      } — it's what's pulling the day behind.`,
    bodyDueToday: (dueToday, meetings) =>
      `${dueToday} ${dueToday === 1 ? "item is" : "items are"} due today and ${meetings}. Start with what's due and the board stays ahead.`,
    bodyWaiting: (waiting, meetings) =>
      `Nothing overdue or due today, and ${meetings}. ${waiting} ${
        waiting === 1 ? "item is" : "items are"
      } waiting on others — a good moment to follow up.`,
    bodySchedule: (meetings) => `No overdue or due-today work — just ${meetings}. Your queue is clear.`,
    bodyAllClear: "Nothing overdue, due today, or waiting, and no meetings. You're all clear.",
    aiTail: (ai) => ` 7F is on ${ai} ${ai === 1 ? "item" : "items"} alongside you.`,
  },
}
