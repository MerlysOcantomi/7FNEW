/**
 * Operator-facing strings for inbox AI fallbacks & pipeline (aligned with workspace UI locale).
 * Customer-facing draft language is governed separately in prompts (customer's written language).
 */

import { DEFAULT_LOCALE, parseLocale, type SupportedLocale } from "@core/i18n"

export type OperatorUiStrings = {
  requiresFollowUp: string
  requiresHumanReview: string
  noSummary: string
  scoringFromContext: string
  scoreReasoningParseFallback: string
  humanReviewRecommendedDesc: string
  operationalContextReady: string
  noGeneratedContext: string
  fallbackNotes: string
  manualReviewTag: string
  parseWarningRisk: string
  humanReviewNext: string
  assignOperatorTitle: string
  draftReplyTitle: string
  revisedSummary: string
}

const EN: OperatorUiStrings = {
  requiresFollowUp: "Needs follow-up",
  requiresHumanReview: "Needs human review",
  noSummary: "No summary",
  scoringFromContext: "Score derived from current conversation context.",
  scoreReasoningParseFallback: "Parsing fallback applied for AI response.",
  humanReviewRecommendedDesc: "Human review recommended before taking action.",
  operationalContextReady: "Operational context ready for review",
  noGeneratedContext: "No generated context.",
  fallbackNotes: "Conversation intelligence fallback. Manual review recommended.",
  manualReviewTag: "manual-review",
  parseWarningRisk: "AI response could not be parsed correctly.",
  humanReviewNext: "Human review recommended.",
  assignOperatorTitle: "Assign operator",
  draftReplyTitle: "Draft reply",
  revisedSummary: "Recommended manual review",
}

const ES: OperatorUiStrings = {
  requiresFollowUp: "Requiere seguimiento",
  requiresHumanReview: "Requiere revisión humana",
  noSummary: "Sin resumen",
  scoringFromContext: "Scoring según el contexto conversacional actual.",
  scoreReasoningParseFallback: "Respuesta aplicada por error de análisis del modelo.",
  humanReviewRecommendedDesc: "Se recomienda revisión humana antes de operar.",
  operationalContextReady: "Contexto operativo listo para revisión",
  noGeneratedContext: "Sin contexto generado.",
  fallbackNotes: "Inteligencia conversacional en modo fallback. Requiere revisión manual.",
  manualReviewTag: "revision-manual",
  parseWarningRisk: "La respuesta de IA no pudo analizarse correctamente.",
  humanReviewNext: "Se recomienda revisión humana.",
  assignOperatorTitle: "Asignar operador",
  draftReplyTitle: "Borrador de respuesta",
  revisedSummary: "Revisión manual recomendada",
}

const DE: OperatorUiStrings = {
  requiresFollowUp: "Nachverfolgung nötig",
  requiresHumanReview: "Manuelle Prüfung empfohlen",
  noSummary: "Keine Zusammenfassung",
  scoringFromContext: "Bewertung aus dem aktuellen Gesprächskontext.",
  scoreReasoningParseFallback: "Fallback aufgrund eines Analysefehlers der KI.",
  humanReviewRecommendedDesc: "Manuelle Prüfung vor Aktion empfohlen.",
  operationalContextReady: "Operativer Kontext zur Prüfung bereit",
  noGeneratedContext: "Kein Kontext erzeugt.",
  fallbackNotes: "Konversations-Intelligence im Fallback. Manuelle Prüfung empfohlen.",
  manualReviewTag: "manuelle-pruefung",
  parseWarningRisk: "KI-Antwort konnte nicht korrekt interpretiert werden.",
  humanReviewNext: "Manuelle Prüfung empfohlen.",
  assignOperatorTitle: "Bearbeiter zuweisen",
  draftReplyTitle: "Antwortentwurf",
  revisedSummary: "Manuelle Prüfung empfohlen",
}

const MAP: Record<SupportedLocale, OperatorUiStrings> = { en: EN, es: ES, de: DE }

export function getOperatorUiStrings(locale?: string | null): OperatorUiStrings {
  const key = parseLocale(locale)
  return MAP[key] ?? MAP[DEFAULT_LOCALE]
}

/** English name for prompts (readable by the model). */
export function operatorLocalePromptName(locale: SupportedLocale): string {
  switch (locale) {
    case "es":
      return "Spanish"
    case "de":
      return "German"
    default:
      return "English"
  }
}
