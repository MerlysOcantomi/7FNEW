/**
 * Mr Forte — Beauty vertical playbook (declarative).
 *
 * This is a SPEC, not an executor. It describes how Forte should detect and
 * configure a Beauty workspace: what signals point to Beauty, which questions to
 * ask (progressively, never all at once), which modules to activate/hide, which
 * services to propose, and which actions are auto vs. approval-gated.
 *
 * It intentionally imports nothing from the Forte runtime (`policy-guard`,
 * `handlers`, `approval`). Wiring these steps into the execution pipeline is a
 * later phase — this file only makes the intent explicit and testable as data,
 * honoring the "no vibe coding, restricted factory" principle: Forte composes
 * from a declared catalog, it does not invent modules.
 */

import {
  BEAUTY_MODULE_VISIBILITY,
  BEAUTY_SERVICE_CATALOG_SEED,
  type BeautyServiceSeed,
} from "@core/vertical-packs/beauty"

/** How autonomous a proposed step is allowed to be. */
export type ForteAutonomy =
  /** Reversible, low-risk, inside the vertical pack → Forte may apply it. */
  | "auto"
  /** Touches money/data/outbound → Forte proposes, user approves (1 click). */
  | "approval"
  /** Only the human knows this → Forte asks. */
  | "ask"

export interface ForteStep {
  id: string
  description: string
  autonomy: ForteAutonomy
}

export interface ForteQuestion {
  id: string
  /** The question in Spanish (España), conversational tone. */
  prompt: string
  /** Whether Forte must have this before it can configure anything. */
  required: boolean
}

export interface ForteVerticalPlaybook {
  verticalKey: string
  /** Free-text / signal hints that suggest this vertical. */
  detectionSignals: string[]
  /** Business sub-types Forte can offer as quick picks. */
  businessSubtypes: string[]
  /** Asked progressively — Forte never demands all of these up front. */
  progressiveQuestions: ForteQuestion[]
  /** Module activation/hiding Forte applies once the vertical is confirmed. */
  moduleVisibility: Record<string, boolean>
  /** Services Forte proposes as a starting catalog (editable by the user). */
  proposedServices: BeautyServiceSeed[]
  /** The ordered configuration steps, each tagged with its autonomy level. */
  steps: ForteStep[]
  /** Guidance strings Forte uses to stay calm and non-overwhelming. */
  principles: string[]
}

export const BEAUTY_FORTE_PLAYBOOK: ForteVerticalPlaybook = {
  verticalKey: "beauty",

  detectionSignals: [
    "manicura",
    "uñas",
    "esteticista",
    "estética",
    "peluquería",
    "peluquera",
    "lashes",
    "pestañas",
    "cejas",
    "masajes",
    "barbería",
    "salón de belleza",
    "citas",
    "reservas",
  ],

  businessSubtypes: [
    "Manicura / uñas",
    "Estética",
    "Peluquería",
    "Barbería",
    "Lashes / pestañas",
    "Masajes",
    "Salón beauty",
  ],

  progressiveQuestions: [
    {
      id: "subtype",
      prompt: "¿A qué te dedicas? (manicura, estética, peluquería, barbería, lashes, masajes, salón)",
      required: true,
    },
    {
      id: "hours",
      prompt: "¿Qué días y horario trabajas normalmente?",
      required: false,
    },
    {
      id: "team",
      prompt: "¿Trabajas sola o con equipo?",
      required: false,
    },
    {
      id: "services_pricing",
      prompt: "Cuando quieras, dime precios y duración de tus servicios. No hace falta ahora.",
      required: false,
    },
    {
      id: "channels",
      prompt: "¿Tienes Instagram, WhatsApp o web? Los conecto si quieres.",
      required: false,
    },
  ],

  moduleVisibility: BEAUTY_MODULE_VISIBILITY,

  proposedServices: BEAUTY_SERVICE_CATALOG_SEED,

  steps: [
    { id: "set_vertical", description: "Marcar el workspace como Beauty (verticalKey=beauty).", autonomy: "auto" },
    { id: "apply_nav", description: "Aplicar navegación y labels en español de Beauty.", autonomy: "auto" },
    { id: "hide_modules", description: "Ocultar módulos no usados en Beauty MVP (Proyectos, Finanzas avanzada, Reports, Inventario, Overviews).", autonomy: "auto" },
    { id: "seed_services", description: "Sembrar el catálogo inicial de servicios beauty.", autonomy: "auto" },
    { id: "set_hours", description: "Configurar horario de atención.", autonomy: "ask" },
    { id: "set_pricing", description: "Fijar precios y duración de servicios.", autonomy: "ask" },
    { id: "enable_reminders", description: "Activar plantillas de recordatorio/confirmación por WhatsApp.", autonomy: "approval" },
    { id: "connect_channels", description: "Conectar Instagram/WhatsApp/web.", autonomy: "approval" },
    { id: "activate_appointment_today", description: "Activar el Today de citas real (requiere backend de citas real).", autonomy: "approval" },
  ],

  principles: [
    "No pedir todos los datos al inicio; empezar con lo mínimo y mejorar con el tiempo.",
    "Explicar que cuanta más información tenga, mejor puede ayudar.",
    "Adaptarse si el usuario se atasca: ofrecer valores por defecto y continuar.",
    "Solo componer desde el catálogo declarado; nunca inventar módulos ni escribir código libre.",
    "No mostrar datos de ejemplo (mock) a una usuaria real como si fueran suyos.",
  ],
}
