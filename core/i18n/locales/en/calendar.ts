// English base strings for the "calendar" namespace.
//
// Scaffolding only (PR-I18N-2): visible labels for a future PR. No calendar or
// appointment behavior is touched. See docs/i18n-localization-architecture.md §11.

export interface CalendarNamespace {
  title: string
  today: string
  empty: string
}

export const calendar: CalendarNamespace = {
  title: "Calendar",
  today: "Today",
  empty: "No events scheduled.",
}
