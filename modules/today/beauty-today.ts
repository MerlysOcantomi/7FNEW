/**
 * Beauty "Hoy" — the Spanish, Finesse-branded configuration the appointment
 * Today layout uses when a workspace is Beauty.
 *
 * Pure and DB-free: resolves entirely from `verticalKey`. Returns `null` for
 * any non-beauty vertical, so the appointment layout keeps its generic English
 * preview untouched for everyone else. All strings live here (Spanish, España)
 * and the Finesse voice/labels come from the Beauty pack — nothing is hardcoded
 * inside the layout component.
 *
 * MVP scope: this drives a VISIBLE Beauty "Hoy" over the existing mock data —
 * no backend, no AI, no real actions. The layout renders a "Vista previa ·
 * datos de ejemplo" chip so a real operator is never shown demo data as real.
 */

import type { AppointmentStatus } from "@modules/today/appointments"
import { mapVerticalKeyToBusinessType } from "@core/personalization"
import { BEAUTY_SPECIALIST_AGENT } from "@core/vertical-packs/specialists"
import {
  BEAUTY_APPOINTMENT_STATE_LABELS,
  BEAUTY_SERVICE_CATALOG_SEED,
} from "@core/vertical-packs/beauty"

export interface BeautyTodayConfig {
  brandTitle: string
  eyebrow: string
  brandLine: string
  previewChip: string
  statusLabels: Record<AppointmentStatus, string>
  ui: {
    railTitle: string
    pills: { appointments: string; unconfirmed: string; openGaps: string; booked: string }
    now: string
    openGap: string
    nothingHere: string
    groups: { unconfirmed: string; openGaps: string; followUps: string; messages: string; care: string; content: string }
    actions: { remind: string; waitlist: string; message: string }
  }
  extras: {
    recentClients: string[]
    featuredServices: string[]
    recommendedActions: { title: string; meta: string }[]
    pendingMessages: { name: string; text: string }[]
    clientsToCare: { name: string; meta: string }[]
    postIdea: { title: string; meta: string }
  }
}

const STATUS_LABELS_ES: Record<AppointmentStatus, string> = {
  confirmed: BEAUTY_APPOINTMENT_STATE_LABELS.confirmed,
  pending: BEAUTY_APPOINTMENT_STATE_LABELS.pending,
  arrived: BEAUTY_APPOINTMENT_STATE_LABELS.arrived,
  no_show: BEAUTY_APPOINTMENT_STATE_LABELS.no_show,
  cancelled: BEAUTY_APPOINTMENT_STATE_LABELS.cancelled,
}

const BEAUTY_TODAY_CONFIG: BeautyTodayConfig = {
  brandTitle: "7F Beauty",
  eyebrow: BEAUTY_SPECIALIST_AGENT.voice.intelligence, // "Finesse · Beauty Intelligence"
  brandLine: BEAUTY_SPECIALIST_AGENT.tagline, // "7F Beauty, powered by Finesse"
  previewChip: "Vista previa · datos de ejemplo",
  statusLabels: STATUS_LABELS_ES,
  ui: {
    railTitle: "Flujo de Finesse",
    pills: { appointments: "Citas", unconfirmed: "Sin confirmar", openGaps: "Huecos", booked: "Ingresos" },
    now: "Ahora",
    openGap: "Libre",
    nothingHere: "Nada por aquí.",
    groups: {
      unconfirmed: "Sin confirmar",
      openGaps: "Huecos libres",
      followUps: "Seguimientos",
      messages: "Mensajes pendientes",
      care: "Clientas a cuidar",
      content: "Idea de contenido",
    },
    actions: { remind: "Enviar recordatorio", waitlist: "Ofrecer hueco", message: "Preparar mensaje" },
  },
  extras: {
    recentClients: ["Marina Velasco", "Nora Díaz", "Sofía Cano", "Laura Méndez"],
    featuredServices: BEAUTY_SERVICE_CATALOG_SEED.slice(0, 4).map((s) => s.name),
    recommendedActions: [
      { title: "Confirmar 2 citas de hoy", meta: "Marina (10:00) · Carla (12:30)" },
      { title: "Llenar el hueco de las 13:30", meta: "Ofrécelo a clientas frecuentes" },
      { title: "Publicar la foto de ayer", meta: "Nail art · rojo intenso" },
    ],
    pendingMessages: [
      { name: "Claudia", text: "¿Tienes hueco el viernes por la tarde?" },
      { name: "Ana", text: "¿Puedo cambiar mi cita a las 17:00?" },
    ],
    clientsToCare: [
      { name: "Elena Soto", meta: "No viene hace 6 semanas · rebooking" },
      { name: "Paula Gil", meta: "Cumpleaños esta semana 🎂" },
    ],
    postIdea: {
      title: "Antes/después de manicura semipermanente",
      meta: "Freya puede preparar el post · tú apruebas",
    },
  },
}

/**
 * Resolve the Beauty "Hoy" config for a vertical, or `null` when it is not a
 * beauty workspace (covers aliases salon/nails/… via business type).
 */
export function resolveBeautyTodayConfig(
  verticalKey: string | null | undefined,
): BeautyTodayConfig | null {
  if (!verticalKey) return null
  return mapVerticalKeyToBusinessType(verticalKey) === "beauty" ? BEAUTY_TODAY_CONFIG : null
}
