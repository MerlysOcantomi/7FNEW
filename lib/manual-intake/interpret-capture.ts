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
const SOON_RE = /\b(this week|esta semana|tomorrow|ma[ñn]ana|before|antes de)\b/i

const PHONE_RE = /\b(call|called|calling|phone|llam[óoa]|tel[ée]fono|marcar)\b/i
const ESTIMATE_RE = /\b(estimate|quote|quotation|presupuesto|cotizaci[óo]n|budget)\b/i
const CONFIRM_RE = /\b(confirm|confirmar|vendor|proveedor|booking|reserva)\b/i
const FOLLOWUP_RE = /\b(follow ?up|seguimiento|remind|reminder|recordar|recordatorio|check in|check-in)\b/i

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

  const priority: ManualPriority = URGENT_RE.test(text)
    ? "high"
    : SOON_RE.test(text)
      ? "normal"
      : "normal"

  let intent = "Manual capture"
  if (sourceKind === "phone" || PHONE_RE.test(text)) intent = "Phone follow-up"
  else if (ESTIMATE_RE.test(text)) intent = "Estimate request"
  else if (CONFIRM_RE.test(text)) intent = "Confirmation needed"
  else if (FOLLOWUP_RE.test(text)) intent = "Follow-up"
  else if (sourceKind === "reminder") intent = "Reminder"

  /**
   * Light name guess: a capitalised word that appears right before a "called"
   * verb (e.g. "Pedro called…"). Display-only hint to offer "Connect client".
   */
  const relations: string[] = []
  const nameMatch = text.match(/\b([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)\s+(?:called|llam[óo]|phoned)\b/)
  if (nameMatch) relations.push(nameMatch[1])

  const suggestedActions = ["add_to_inbox"]
  // A follow-up is the safe default next step for most captures.
  if (intent !== "Manual capture") suggestedActions.push("create_follow_up")
  if (priority === "high") suggestedActions.push("add_to_today")

  return {
    summary: firstSentence(text),
    intent,
    priority,
    suggestedRelations: relations,
    suggestedActions,
  }
}
