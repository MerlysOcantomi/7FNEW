import type { TranslationSet } from "../types"

export const en: TranslationSet = {
  locale: "en",
  label: "English",

  email: {
    ack: {
      heading: "We received your message and our team will get back to you shortly.",
      body: "No need to reply to this email. We'll follow up directly.",
      subjectLabel: "Subject",
      greeting: (name) => (name ? `Hi ${name},` : "Hi,"),
    },
    outbound: {
      footer: (ws) => `Sent via Smart Inbox — ${ws}`,
      defaultSubject: "New message",
    },
    poweredBy: "Powered by 7F",
    sentVia: "Sent via 7F",
  },

  activity: {
    created: "Created",
    updated: "Updated",
    deleted: "Deleted",
    status_change: "Status changed",
    assigned: "Assigned",
    unassigned: "Unassigned",
    comment: "Comment",
    mention: "Mention",
    email_sent: "Email sent",
    email_failed: "Email failed",
    email_skipped: "Email skipped",
  },

  notifications: {
    inbox: {
      newConversation: (who) => `New conversation from ${who}`,
      newConversationFallback: "New conversation",
      newMessage: (who) => `New message from ${who}`,
      newMessageFallback: "New message",
      assigned: "You have been assigned a conversation",
      assignedFallback: "Conversation assigned",
      contactWebChat: "Web visitor",
      contactEmail: "Email contact",
      contactDefault: "Contact",
    },
  },

  common: {
    subject: "Subject",
    message: "Message",
    noReply: "No need to reply",
    hi: "Hi",
    thankYou: "Thank you",
    regards: "Regards",
  },
}
