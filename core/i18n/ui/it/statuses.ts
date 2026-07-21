import type { StatusesMessages } from "../types"

/** Italian labels for the persisted status/priority enum values. */
export const statuses: StatusesMessages = {
  estado: {
    activo: "Attivo",
    inactivo: "Inattivo",
    prospecto: "Potenziale",
    planificacion: "Pianificazione",
    en_progreso: "In corso",
    revision: "In revisione",
    completado: "Completato",
    cancelado: "Annullato",
    pendiente: "In attesa",
    completada: "Completata",
    cancelada: "Annullata",
    borrador: "Bozza",
    enviada: "Inviata",
    pagada: "Pagata",
    vencida: "Scaduta",
    activa: "Attiva",
    pausada: "In pausa",
    en_pausa: "Sospeso",
  },
  prioridad: {
    baja: "Bassa",
    media: "Media",
    alta: "Alta",
    urgente: "Urgente",
  },
}
