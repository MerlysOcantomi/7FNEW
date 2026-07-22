import type { CommonMessages } from "../types"

/** German source for the `common` UI namespace (shared generic actions). */
export const common: CommonMessages = {
  save: "Speichern",
  cancel: "Abbrechen",
  edit: "Bearbeiten",
  delete: "Löschen",
  close: "Schließen",
  confirm: "Bestätigen",
  search: "Suchen",
  loading: "Wird geladen…",
  saveChanges: "Änderungen speichern",
  notifications: {
    label: "Benachrichtigungen",
    newCount: (count) => (count === 1 ? "1 neue" : `${count} neue`),
    markAllRead: "Alle als gelesen markieren",
    empty: "Keine Benachrichtigungen",
    viewAll: "Alle Benachrichtigungen anzeigen",
  },
}
