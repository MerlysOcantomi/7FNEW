import type { ConversationIntelligenceOutput, FannyAnalysisResult } from "@modules/inbox/types"

const HUMAN_REVIEW_CONFIDENCE_THRESHOLD = 0.5
const HUMAN_REVIEW_URGENCY = new Set(["alta", "critica"])

/**
 * Converts the raw intelligence pipeline output into the Fanny v1 public contract.
 *
 * This adapter ensures a clean boundary between the internal pipeline
 * (which may evolve) and the agent-facing contract that UI and other
 * consumers depend on.
 */
export function toFannyResult(output: ConversationIntelligenceOutput): FannyAnalysisResult {
  const needsHumanReview =
    output.confidence < HUMAN_REVIEW_CONFIDENCE_THRESHOLD
    || HUMAN_REVIEW_URGENCY.has(output.urgencia)
    || output.risks.length > 0
    || output.suggestedActions.some((a) => a.type === "assign_operator")

  return {
    summary: output.resumen,
    intent: output.intencion,
    urgency: output.urgencia,
    sentiment: output.sentiment,
    confidence: output.confidence,
    detectedLanguage: output.detectedLanguage,
    leadScore: output.leadScore,

    needsHumanReview,

    suggestedReply: output.draft?.shouldCreate && output.draft.content?.trim()
      ? {
          title: output.draft.title,
          content: output.draft.content,
          tone: output.draft.tone,
          targetChannel: output.draft.targetChannel,
          reason: output.draft.reason,
        }
      : null,

    suggestedActions: output.suggestedActions,
    handoff: output.handoff,

    facts: output.facts,
    pendingItems: output.pendingItems,
    risks: output.risks,
    nextBestAction: output.nextBestAction,
    tags: output.tags,
  }
}
