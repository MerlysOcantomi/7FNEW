import type { CommonMessages } from "../types"

/** Spanish source for the `common` UI namespace (shared generic actions). */
export const common: CommonMessages = {
  save: "Guardar",
  cancel: "Cancelar",
  edit: "Editar",
  delete: "Eliminar",
  close: "Cerrar",
  search: "Buscar",
  loading: "Cargando…",
  saveChanges: "Guardar cambios",
  notifications: {
    label: "Notificaciones",
    newCount: (count) => (count === 1 ? "1 nueva" : `${count} nuevas`),
    markAllRead: "Marcar todas como leídas",
    empty: "Sin notificaciones",
    viewAll: "Ver todas las notificaciones",
  },
}
