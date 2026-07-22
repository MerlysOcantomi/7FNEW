import type { CommonMessages } from "../types"

/** Italian source for the `common` UI namespace (shared generic actions). */
export const common: CommonMessages = {
  save: "Salva",
  cancel: "Annulla",
  edit: "Modifica",
  delete: "Elimina",
  close: "Chiudi",
  confirm: "Conferma",
  search: "Cerca",
  loading: "Caricamento…",
  saveChanges: "Salva le modifiche",
  notifications: {
    label: "Notifiche",
    newCount: (count) => (count === 1 ? "1 nuova" : `${count} nuove`),
    markAllRead: "Segna tutte come lette",
    empty: "Nessuna notifica",
    viewAll: "Vedi tutte le notifiche",
  },
}
