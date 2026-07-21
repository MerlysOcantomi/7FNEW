import type { StatusesMessages } from "../types"

/** German labels for the persisted status/priority enum values. */
export const statuses: StatusesMessages = {
  estado: {
    activo: "Aktiv",
    inactivo: "Inaktiv",
    prospecto: "Interessent",
    planificacion: "Planung",
    en_progreso: "In Bearbeitung",
    revision: "In Prüfung",
    completado: "Abgeschlossen",
    cancelado: "Storniert",
    pendiente: "Ausstehend",
    completada: "Abgeschlossen",
    cancelada: "Storniert",
    borrador: "Entwurf",
    enviada: "Gesendet",
    pagada: "Bezahlt",
    vencida: "Überfällig",
    activa: "Aktiv",
    pausada: "Pausiert",
    en_pausa: "Angehalten",
  },
  prioridad: {
    baja: "Niedrig",
    media: "Mittel",
    alta: "Hoch",
    urgente: "Dringend",
  },
}
