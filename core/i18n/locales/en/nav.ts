// English base strings for the navigation / global-chrome "nav" namespace.
//
// Scaffolding only (PR-I18N-2): not yet consumed. Beauty vertical nav labels
// remain vertical-pack data (core/vertical-packs/nav-profile.ts) and are NOT
// i18n keys. See docs/i18n-localization-architecture.md §5, §10.

export interface NavNamespace {
  overview: string
  today: string
  inbox: {
    title: string
    needsAction: string
  }
  manualIntake: string
  notifications: string
  businessProfile: string
}

export const nav: NavNamespace = {
  overview: "Overview",
  today: "Today",
  inbox: {
    title: "Smart Inbox",
    needsAction: "Needs action",
  },
  manualIntake: "Manual Intake",
  notifications: "Notifications",
  businessProfile: "Business Profile",
}
