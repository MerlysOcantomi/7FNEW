import type { CommonMessages } from "../types"

/** French source for the `common` UI namespace (shared generic actions). */
export const common: CommonMessages = {
  save: "Enregistrer",
  cancel: "Annuler",
  edit: "Modifier",
  delete: "Supprimer",
  close: "Fermer",
  confirm: "Confirmer",
  search: "Rechercher",
  loading: "Chargement…",
  saveChanges: "Enregistrer les modifications",
  notifications: {
    label: "Notifications",
    newCount: (count) => (count === 1 ? "1 nouvelle" : `${count} nouvelles`),
    markAllRead: "Tout marquer comme lu",
    empty: "Aucune notification",
    viewAll: "Voir toutes les notifications",
  },
}
