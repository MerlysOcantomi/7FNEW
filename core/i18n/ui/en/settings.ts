import type { SettingsMessages } from "../types"

/**
 * English source for the `settings` UI namespace.
 * Not consumed by any surface yet — the language settings UI is a later phase.
 */
export const settings: SettingsMessages = {
  title: "Settings",
  language: {
    appLabel: "App language",
    appDescription: "Used for your personal 7F interface.",
    workspaceLabel: "Workspace language",
    workspaceDescription:
      "Used for customer-facing messages, emails, portal and public content. It never changes what each team member sees in the app.",
    followingDefault: "No personal preference yet — following your browser language.",
    useDeviceLanguage: "Use my device language",
    clearedToast: "Now following your device language",
    updatedToast: "App language updated",
    updateErrorTitle: "Could not save your language",
    updateErrorBody: "Please try again.",
    workspaceUpdatedToast: "Workspace language updated",
    workspaceUpdateErrorTitle: "Could not save the workspace language",
    workspaceReadOnly: "Only workspace admins can change this.",
    inProgressNote: "Translation in progress. Some areas may still appear in English.",
  },
  accountCenter: {
    workspacesSection: "Workspaces",
    currentWorkspace: "Current workspace",
    youAreHere: "You are here",
    switchWorkspace: "Switch workspace",
    noOtherWorkspaces: "No other workspaces available",
    workspacesLoadError: "Couldn't load workspaces. Try reopening the panel.",
    loadingWorkspace: "Loading workspace…",
    noActiveWorkspace: "No active workspace",
    platformSection: "Platform",
    platformDescription: "Control plane (not a workspace)",
    settingsSection: "Settings",
    languageSection: "Language",
    appearanceSection: "Appearance",
    appearanceNote:
      "Midnight is the default. Lavender Mist is an in-progress light theme — some areas may still show dark styling.",
    comingSoon: "Soon",
    signOut: "Sign out",
    signOutDescription: "Signs you out on this device",
    items: {
      workspaceSettings: {
        label: "Workspace settings",
        description: "General workspace configuration",
      },
      businessProfile: {
        label: "Business Profile",
        description: "Identity, services and business context",
      },
      members: { label: "Members", description: "Team invitations and roles" },
      planUsage: { label: "Plan & usage", description: "Current plan, usage, and billing" },
      profile: { label: "My profile", description: "Personal details and preferences" },
      security: { label: "Account security", description: "Active sessions and authentication" },
    },
  },
  businessProfilePage: {
    title: "Business Profile",
    description:
      "Define your business identity. This context is used by Fanny and other agents to understand who you are and what you offer.",
    loading: "Loading profile...",
    loadError: "Could not load business profile",
    saveError: "Could not save profile",
    save: "Save Profile",
    saving: "Saving...",
    saved: "Saved",
    add: "Add",
    tabs: {
      profile: "Profile",
      channels: "Channels",
      aria: "Business Profile sections",
    },
    operatingContext: {
      title: "Operating context",
      description:
        "Rules Fanny should consider when classifying, summarizing, and suggesting work. Examples: payment questions require review, urgent complaints need operator attention, new leads should get a follow-up task.",
    },
    fields: {
      businessName: {
        label: "Business Name",
        hint: "How your business is known to clients",
        placeholder: "e.g. Skina Studio",
      },
      businessDescription: {
        label: "Description",
        hint: "Brief description of what your business does",
        placeholder: "e.g. Web design, branding and digital development studio",
      },
      services: {
        label: "Services",
        hint: (max) => `What your business offers (max ${max})`,
        placeholder: "Add a service...",
        removeAria: (name) => `Remove ${name}`,
      },
      tone: {
        label: "Tone",
        hint: "How should agents communicate on behalf of your business",
        placeholder: "e.g. professional, approachable and direct",
      },
      languages: {
        label: "Languages",
        hint: "Languages your business operates in",
        placeholder: "Add a language...",
        removeAria: (name) => `Remove ${name}`,
      },
      region: {
        label: "Region / market",
        hint: "Where you mainly operate or who you mainly serve",
        placeholder: "e.g. Spain & LATAM, DACH, remote worldwide",
      },
      workingHours: {
        label: "Working hours",
        hint: "When customers can generally expect a reply (plain language is fine)",
        placeholder: "e.g. Mon–Fri 9:00–18:00 CET; emergencies via phone only",
      },
      attentionRules: {
        label: "Attention rules",
        hint: (max) => `Short reminders for how to treat certain kinds of messages (max ${max})`,
        placeholder: "Add a rule...",
        removeAria: (rule) => `Remove rule: ${rule}`,
      },
    },
  },
  businessProfileChannelsPage: {
    title: "Channels",
    description:
      "Where clients can reach your business, and what each channel presents to them. Day-to-day conversations live in the Inbox.",
    loading: "Loading channels...",
    loadError: "Could not load your channels",
    retry: "Retry",
    groups: {
      connected: {
        title: "Connected channels",
        description: "Live now — messages arrive in your Inbox.",
      },
      actionable: {
        title: "Ready to connect",
        description: "Channels you can set up now, or that need your attention.",
      },
      future: {
        title: "More channels",
        description: "Not available yet — nothing to configure until each integration is ready.",
      },
    },
    status: {
      connected: "Connected",
      available: "Ready to connect",
      setup_required: "Finish setup",
      pending: "Pending",
      error: "Connection error",
      plan_locked: "Not in your plan",
      coming_soon: "Coming soon",
      disabled: "Off",
    },
    channelDescriptions: {
      email: "Send and receive email from your business address",
      web_chat: "Chat with visitors on your website",
      portal: "Conversations with clients inside their portal",
      whatsapp: "Message your clients on WhatsApp",
      instagram: "Reply to Instagram direct messages",
      messenger: "Reply to Facebook Messenger messages",
      tiktok: "Reply to TikTok direct messages",
      sms: "Text messages to phone numbers",
    },
    actions: {
      connect_email: "Connect email",
      manage_email_connections: "Manage accounts",
      connect_another_email: "Connect another email",
      review_email_connection: "Review connection",
      activate_web_chat: "Activate web chat",
      enable_web_chat_reception: "Turn on reception",
      disable_web_chat_reception: "Turn off reception",
      open_inbox: "Open Inbox",
    },
    emailAccounts: {
      title: "Email accounts",
      connectedCount: (count) =>
        count === 1 ? "1 account connected" : `${count} accounts connected`,
      primaryBadge: "Primary account",
      providerLabel: "Provider",
      demoBadge: "Demo account",
    },
    identityLabel: "Identity",
    receiving: "Receiving",
    sending: "Sending",
    lastSync: (formatted) => `Last sync ${formatted}`,
    errorLabel: "Error",
    planNote: (used, max) => `${used} of ${max} channels included in your plan in use`,
    planLockedHint:
      "Your plan's channel limit is already in use. Free a channel to connect this one.",
    comingSoonHint: "This integration isn't available yet. You'll be able to set it up here once it's ready.",
    recommendedBadge: "Recommended",
    webChat: {
      visitorNameLabel: "Name visitors see",
      inboxNote: "Visitor messages arrive in your Inbox as Web chat conversations.",
      updateError: "Could not update web chat reception",
      snippetLabel: "Install snippet",
      snippetHint:
        "Paste this before the closing </body> tag of your website. The chat bubble appears on every page that includes it.",
      copySnippet: "Copy snippet",
      snippetCopied: "Copied",
      activateHint:
        "Activation marks the channel as live for your business. Visitor messages arrive in your Inbox, and your replies show up in the visitor's chat.",
    },
    showDetails: (channel) => `Show ${channel} details`,
    hideDetails: (channel) => `Hide ${channel} details`,
  },
  adminPage: {
    eyebrow: "Settings",
    title: "Workspace settings",
    subtitle:
      "Review core capabilities, optional packs, and advanced upgrades for this workspace.",
    adminOnlyNotice: "You need admin or owner access to change settings.",
    emailChannelsLink: "Email channels",
    emailChannelsNote: "— IMAP/SMTP inboxes for this workspace.",
  },
}
