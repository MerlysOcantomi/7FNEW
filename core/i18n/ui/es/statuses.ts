import type { StatusesMessages } from "../types"

/** Spanish labels for the persisted status/priority enum values. */
export const statuses: StatusesMessages = {
  estado: {
    activo: "Activo",
    inactivo: "Inactivo",
    prospecto: "Prospecto",
    planificacion: "Planificación",
    en_progreso: "En progreso",
    revision: "En revisión",
    completado: "Completado",
    cancelado: "Cancelado",
    pendiente: "Pendiente",
    completada: "Completada",
    cancelada: "Cancelada",
    borrador: "Borrador",
    enviada: "Enviada",
    pagada: "Pagada",
    vencida: "Vencida",
    activa: "Activa",
    pausada: "Pausada",
    en_pausa: "En pausa",
  },
  prioridad: {
    baja: "Baja",
    media: "Media",
    alta: "Alta",
    urgente: "Urgente",
  },
}
