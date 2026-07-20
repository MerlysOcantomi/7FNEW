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
