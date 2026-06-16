/**
 * Local, deterministic interpretation of a manual capture.
 *
 * This is intentionally a simple keyword heuristic — NOT an external AI call.
 * It gives the review state an honest "Fanny's read" without pretending to run
 * a model. When a real inbox intelligence pass exists for manual conversations,
 * it runs server-side after the conversation is created; this local read is only
 * for the capture/review UX before anything is written.
 */

export type ManualSourceKind = "phone" | "in_person" | "note" | "reminder" | "imported"

export type ManualPriority = "low" | "normal" | "high" | "urgent"

export interface ManualInterpretation {
  summary: string
  intent: string
  priority: ManualPriority
  /** Human hints about who/what this could connect to. Display-only for now. */
  suggestedRelations: string[]
  /** Stable ids of the next steps Fanny suggests pre-selecting. */
  suggestedActions: string[]
}

const URGENT_RE =
  /\b(urgent|asap|emergency|emergencia|right now|ahora mismo|leak|fuga|gotera|today|hoy)\b/i

const PHONE_RE = /\b(call|called|calling|phone|llam[óoa]|tel[ée]fono|marcar)\b/i

// Vertical example buckets (from the Claude Design handoff). Keyword heuristics only.
const ESTIMATE_RE =
  /\b(estimate|quote|quotation|presupuesto|cotizaci[óo]n|budget|roof|leak|gotera|fuga|repair|arreglo|install|instalaci[óo]n)\b/i
const VENDOR_RE =
  /\b(florist|vendor|proveedor|wedding|boda|catering|venue|sal[óo]n|event|evento|confirm|confirmar|booking|reserva)\b/i
const PARENT_RE =
  /\b(homework|tarea|mom|mam[áa]|dad|pap[áa]|class|clase|student|alumno|alumna|parent|padre|madre|school|escuela)\b/i
const CHECKIN_RE =
  /\b(check[- ]?in|group|grupo|hasn'?t come|no ha venido|weeks|semanas|wellbeing|bienestar|how (are|is)|c[óo]mo (est[áa]|sigue))\b/i

function firstSentence(text: string): string {
  const clean = text.trim().replace(/\s+/g, " ")
  const m = clean.split(/(?<=[.!?])\s/)[0]
  const out = (m || clean).trim()
  return out.length > 140 ? `${out.slice(0, 140)}…` : out
}

export function interpretCapture(
  rawText: string,
  sourceKind: ManualSourceKind,
): ManualInterpretation {
  const text = rawText.trim()
  if (!text) {
    return {
      summary: "",
      intent: "Manual capture",
      priority: "normal",
      suggestedRelations: [],
      suggestedActions: ["add_to_inbox"],
    }
  }

  const priority: ManualPriority = URGENT_RE.test(text) ? "high" : "normal"

  /**
   * Intent + default next steps by vertical bucket. Order matters: the more
   * specific business intents win before the generic phone/follow-up fallback.
   * `add_to_inbox` is always present (the anchor write); the rest are pre-checks.
   */
  let intent = "General follow-up"
  const suggestedActions = ["add_to_inbox"]

  if (ESTIMATE_RE.test(text)) {
    intent = "Estimate request · site visit"
    suggestedActions.push("create_follow_up", "add_to_today")
  } else if (VENDOR_RE.test(text)) {
    intent = "Vendor confirmation"
    suggestedActions.push("create_follow_up")
  } else if (PARENT_RE.test(text)) {
    intent = "Parent follow-up"
    suggestedActions.push("create_follow_up")
  } else if (CHECKIN_RE.test(text)) {
    intent = "Gentle check-in"
    suggestedActions.push("create_follow_up")
  } else if (sourceKind === "phone" || PHONE_RE.test(text)) {
    intent = "Phone follow-up"
    suggestedActions.push("create_follow_up")
  } else if (sourceKind === "reminder") {
    intent = "Reminder"
    suggestedActions.push("create_follow_up")
  } else {
    suggestedActions.push("create_follow_up")
  }

  if (priority === "high" && !suggestedActions.includes("add_to_today")) {
    suggestedActions.push("add_to_today")
  }

  /**
   * Light name guess for "Connect to": a capitalised word right before a
   * "called/phoned" verb (e.g. "Pedro called…"), or after "call/llamar a".
   * Display-only hint to offer connecting a client. Never fabricated beyond
   * what the text literally contains.
   */
  const relations: string[] = []
  const before = text.match(/\b([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)\s+(?:called|phoned|llam[óo]|escribi[óo])\b/)
  const after = text.match(/\b(?:call|llamar a|contact|contactar a)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)\b/i)
  const name = before?.[1] || after?.[1]
  if (name) relations.push(name)

  return {
    summary: firstSentence(text),
    intent,
    priority,
    suggestedRelations: relations,
    suggestedActions,
  }
}
