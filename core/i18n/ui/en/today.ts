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
}
