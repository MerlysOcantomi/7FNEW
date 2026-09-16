// English base strings for the "today" namespace.
//
// Scaffolding only (PR-I18N-2): not yet consumed; no Today behavior is touched.
// See docs/i18n-localization-architecture.md §10, §11.

export interface TodayNamespace {
  title: string
  empty: {
    title: string
    body: string
  }
}

export const today: TodayNamespace = {
  title: "Today",
  empty: {
    title: "Nothing for today yet",
    body: "New items will show up here as they come in.",
  },
}
