import type { StatusesMessages } from "../types"

/** English labels for the persisted status/priority enum values. */
export const statuses: StatusesMessages = {
  estado: {
    activo: "Active",
    inactivo: "Inactive",
    prospecto: "Prospect",
    planificacion: "Planning",
    en_progreso: "In progress",
    revision: "In review",
    completado: "Completed",
    cancelado: "Canceled",
    pendiente: "Pending",
    completada: "Completed",
    cancelada: "Canceled",
    borrador: "Draft",
    enviada: "Sent",
    pagada: "Paid",
    vencida: "Overdue",
    activa: "Active",
    pausada: "Paused",
    en_pausa: "On hold",
  },
  prioridad: {
    baja: "Low",
    media: "Medium",
    alta: "High",
    urgente: "Urgent",
  },
}
