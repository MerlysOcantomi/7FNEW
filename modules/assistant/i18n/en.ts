/** Ask Finesse — English catalog (base language). */

import type { FinesseAssistantMessages } from "./types"

export const en = {
  locale: "en",
  launcherLabel: "Ask Finesse",
  launcherAria: "Ask Finesse, your business assistant",
  panelTitle: "Finesse",
  panelSubtitle: "beauty intelligence · by Sevenef",
  contextLead: "You are in",
  pageLabels: {
    "my-salon": "My salon",
    today: "Today",
    agenda: "Agenda",
    clients: "Clients",
    messages: "Messages",
    catalog: "Services",
    marketing: "Marketing",
    billing: "Payments",
    team: "Team",
    settings: "Settings",
    other: "7F Beauty",
  },
  intros: {
    "my-salon": "I can explain how your salon is doing this period and what you could improve.",
    today: "I can help you organize your day and decide what to do first.",
    agenda: "I can help you with your appointments, open slots and peak hours.",
    clients: "I can help you look after your clients and spot who needs attention.",
    messages: "I can help you bring order to your conversations.",
    catalog: "I can help you understand which services perform best.",
    marketing: "I can give you ideas for your content and campaigns.",
    billing: "I can help you with your pending payments and invoices.",
    team: "I can help you organize your team's work.",
    settings: "I can help you set up your workspace.",
    other: "Ask me anything you need about your business.",
  },
  suggestionsTitle: "Suggestions",
  composerPlaceholder: "Type your question…",
  send: "Send",
  close: "Close",
  thinking: "Finesse is thinking…",
  unavailable: {
    title: "Finesse isn't connected yet.",
    description:
      "The assistant will be available once the AI service is connected. Everything else in your workspace keeps working as usual.",
  },
  error: {
    title: "I couldn't answer just now.",
    retry: "Please try again in a few seconds.",
  },
  honestyNote:
    "Finesse answers from the information visible in your workspace. It doesn't perform actions for you yet.",
  emptyConversation: "Pick a suggestion or type your question.",
  staticSuggestions: {
    "my-salon": [
      "Explain this period to me",
      "Why did my earnings change?",
      "Which clients should come back?",
      "How can I improve next month?",
    ],
    today: ["What should I do first?", "Summarize my day", "What needs my attention?"],
    agenda: [
      "Find a free slot tomorrow",
      "What are my peak hours?",
      "Where could two more appointments fit?",
    ],
    clients: [
      "Who should I get back in touch with?",
      "Which clients haven't come back?",
      "Show me my most loyal clients",
    ],
    messages: [
      "Summarize the pending conversations",
      "Which messages need a reply?",
    ],
    catalog: ["Which service performs best?", "What should I promote?"],
    marketing: [
      "Create a post",
      "Suggest a campaign",
      "Use my latest work",
      "Help me fill open slots",
    ],
    billing: ["Which payments are still pending?", "Summarize my earnings for the period"],
    team: ["How is my team's work going?"],
    settings: ["What do I still need to set up?"],
    other: ["How is my business doing?", "What needs my attention today?"],
  },
  dynamicSuggestions: {
    overview: {
      firstPeriod: {
        label: "What should I watch in my first month?",
        prompt:
          "This is my first period with data, with no previous comparison. What signals should I keep an eye on during my first month?",
      },
      earningsDrop: {
        label: "Why did my earnings drop?",
        prompt:
          "My earnings went down compared with the previous period. What could have caused the drop and what can I do?",
      },
      earningsGrowth: {
        label: "What drove the growth?",
        prompt:
          "My earnings grew compared with the previous period. What drove that growth and how do I keep it up?",
      },
      weakRebooking: {
        label: "Which clients should come back?",
        prompt:
          "My rebooking rate is weak. Which clients should come back soon and how do I reach out to them?",
      },
      pendingPayments: {
        label: "Which payments need attention?",
        prompt:
          "I have pending payments from visits that are already completed. Which ones should I handle first?",
      },
      peakAvailability: {
        label: "How do I free up my peak day?",
        prompt:
          "My busiest day is almost fully booked. How can I create more availability without losing clients?",
      },
    },
    today: {
      fillGaps: {
        label: "How do I fill today's gaps?",
        prompt: (count) =>
          `I have ${count} open slot(s) in today's agenda. How can I fill them?`,
      },
      firstMove: {
        label: "What should I do first?",
        prompt: (count) =>
          `I have ${count} appointments today. What should I do first so the day goes well?`,
      },
      summary: {
        label: "Summarize my day",
        prompt: "Summarize my day: appointments, open slots and whatever needs my attention.",
      },
    },
    agenda: {
      fillTomorrow: {
        label: "How do I fill tomorrow's gaps?",
        prompt: (count) => `Tomorrow I have ${count} open slot(s). How can I fill them?`,
      },
      pendingConfirmation: {
        label: "Which appointments still need confirming?",
        prompt: (count) =>
          `I have ${count} unconfirmed appointment(s). Which ones should I confirm first?`,
      },
      cancelledSlot: {
        label: "What do I do with the cancelled slot?",
        prompt: "An appointment was cancelled today. What can I do with that slot?",
      },
      fitUrgent: {
        label: "Where does an urgent appointment fit?",
        prompt:
          "My day is almost full. Where could I fit an urgent appointment without disrupting the agenda?",
      },
    },
    clients: {
      selectedSummary: {
        label: "Summarize their recent history",
        prompt:
          "Summarize this client's recent history: visits, services and any signal worth watching.",
      },
      selectedContact: {
        label: "Should I get back in touch?",
        prompt: "Should I get back in touch with this client? When, and with what message?",
      },
      overdueRebooking: {
        label: "Who should I contact this week?",
        prompt: (count) =>
          `There are ${count} clients who haven't come back in a while. Who should I contact this week, and how?`,
      },
    },
    messages: {
      selectedSummary: {
        label: "Summarize this conversation",
        prompt: "Summarize this conversation and tell me if anything is still waiting for a reply.",
      },
      needReply: {
        label: "Which messages do I answer first?",
        prompt: (count) =>
          `I have ${count} unanswered message(s). Which ones should I answer first?`,
      },
    },
    marketing: {
      postLatestWork: {
        label: "Create a post with my latest work",
        prompt:
          "I have photos of recent work that I haven't used. How do I prepare a post with the latest one?",
      },
      noMedia: {
        label: "What content should I create today?",
        prompt:
          "I haven't uploaded any photos yet. What content should I create today for my salon?",
      },
      reviewReady: {
        label: "What do I publish first?",
        prompt: (count) =>
          `I have ${count} post(s) prepared. Which one should I review and publish first?`,
      },
    },
    billing: {
      followUp: {
        label: "Which payments do I chase first?",
        prompt: "I have pending payments. Which ones should I chase first, and how?",
      },
      collectionHealth: {
        label: "How is my collection going?",
        prompt:
          "I have no overdue payments right now. How is my collection rhythm doing overall?",
      },
      revenueChange: {
        label: "Explain this period's earnings",
        prompt:
          "My earnings changed compared with the previous period. Explain that change to me.",
      },
    },
  },
} satisfies FinesseAssistantMessages
