// English base strings for the shared UI "common" namespace.
//
// Scaffolding only (PR-I18N-2): not yet consumed by any component, and es/de
// parallels are added in later, per-surface PRs. See
// docs/i18n-localization-architecture.md §10.

export interface CommonNamespace {
  save: string
  cancel: string
  delete: string
  edit: string
  close: string
  back: string
  next: string
  search: string
  loading: string
  saving: string
  saved: string
  error: string
  retry: string
  confirm: string
  /**
   * Simple function-based plural. Per-locale Intl.PluralRules is deferred until
   * real coverage exists (doc §10 — "do not overbuild before coverage exists").
   */
  itemCount: (count: number, singular: string, plural: string) => string
}

export const common: CommonNamespace = {
  save: "Save",
  cancel: "Cancel",
  delete: "Delete",
  edit: "Edit",
  close: "Close",
  back: "Back",
  next: "Next",
  search: "Search",
  loading: "Loading…",
  saving: "Saving…",
  saved: "Saved",
  error: "Something went wrong",
  retry: "Retry",
  confirm: "Confirm",
  itemCount: (count, singular, plural) => `${count} ${count === 1 ? singular : plural}`,
}
