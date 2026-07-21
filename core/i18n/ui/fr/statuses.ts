import type { StatusesMessages } from "../types"

/** French labels for the persisted status/priority enum values. */
export const statuses: StatusesMessages = {
  estado: {
    activo: "Actif",
    inactivo: "Inactif",
    prospecto: "Prospect",
    planificacion: "Planification",
    en_progreso: "En cours",
    revision: "En révision",
    completado: "Terminé",
    cancelado: "Annulé",
    pendiente: "En attente",
    completada: "Terminée",
    cancelada: "Annulée",
    borrador: "Brouillon",
    enviada: "Envoyée",
    pagada: "Payée",
    vencida: "En retard",
    activa: "Active",
    pausada: "En pause",
    en_pausa: "Suspendu",
  },
  prioridad: {
    baja: "Basse",
    media: "Moyenne",
    alta: "Haute",
    urgente: "Urgente",
  },
}
