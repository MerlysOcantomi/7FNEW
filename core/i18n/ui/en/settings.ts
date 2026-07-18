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
      "Used for customer-facing messages, emails, portal, and workspace defaults.",
    followingDefault: "No personal preference yet — following the workspace language.",
    updatedToast: "App language updated",
    updateErrorTitle: "Could not save your language",
    updateErrorBody: "Please try again.",
    workspaceUpdatedToast: "Workspace language updated",
    workspaceUpdateErrorTitle: "Could not save the workspace language",
    workspaceReadOnly: "Only workspace admins can change this.",
  },
}
