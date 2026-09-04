// English base strings for the "settings" namespace.
//
// Scaffolding only (PR-I18N-2): not yet consumed. The actual language settings
// UI is a later PR (doc §9, §14 PR 7). Copy here mirrors the doc's App vs
// Workspace language distinction. See docs/i18n-localization-architecture.md §9.

export interface SettingsNamespace {
  title: string
  language: {
    appLabel: string
    appDescription: string
    workspaceLabel: string
    workspaceDescription: string
  }
}

export const settings: SettingsNamespace = {
  title: "Settings",
  language: {
    appLabel: "App language",
    appDescription: "Used for your personal 7F interface.",
    workspaceLabel: "Workspace language",
    workspaceDescription:
      "Used for customer-facing messages, emails, portal, and workspace defaults.",
  },
}
