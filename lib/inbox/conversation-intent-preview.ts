import { MAX_EXPANDED_INTENTS, normalizeIntentForComparison } from "@/lib/inbox/pick-expanded-intents"
import {
  getIntentOperationalStatusFromMetadata,
  getShortIntentFromMessageMetadata,
  parseMessageMetadataRecord,
  type IntentOperationalStatus,
} from "@/lib/inbox/parse-message-metadata"

export type { IntentOperationalStatus }

export type ConversationIntentPreview = {
  messageId: string
  shortIntent: string
  status: IntentOperationalStatus
}

interface ListMessageLite {
  id: string
  metadata?: string | Record<string, unknown> | null
  createdAt?: string | Date
}

/**
 * Misma lógica que pickExpandedIntents pero conservando messageId y status por fila.
 * `rows` en orden cronológico ascendente (más antiguo primero).
 */
export function pickConversationIntentPreviews(
  rows: Array<{
    messageId: string
    shortIntent: string
    status: IntentOperationalStatus
  }>,
): ConversationIntentPreview[] {
  if (!rows.length) return []

  const consecutivePass: typeof rows = []
  let prevNorm: string | null = null
  for (const r of rows) {
    const n = normalizeIntentForComparison(r.shortIntent)
    if (!n) continue
    if (n === prevNorm) continue
    consecutivePass.push(r)
    prevNorm = n
  }

  const dedupLastWins: typeof rows = []
  for (const r of consecutivePass) {
    const n = normalizeIntentForComparison(r.shortIntent)
    const kept = dedupLastWins.filter((x) => normalizeIntentForComparison(x.shortIntent) !== n)
    dedupLastWins.length = 0
    dedupLastWins.push(...kept, r)
  }

  return dedupLastWins.slice(-MAX_EXPANDED_INTENTS).map((r) => ({
    messageId: r.messageId,
    shortIntent: r.shortIntent.trim(),
    status: r.status,
  }))
}

/**
 * A partir de los últimos mensajes incluidos en el listado de conversaciones (orden DESC del API),
 * construye hasta 3 previews operativos.
 */
export function buildIntentPreviewsFromListMessages(messages: ListMessageLite[] | undefined): ConversationIntentPreview[] {
  if (!messages?.length) return []
  const asc = [...messages].sort((a, b) => {
    const ta =
      a.createdAt instanceof Date ? a.createdAt.getTime() : a.createdAt ? new Date(a.createdAt).getTime() : 0
    const tb =
      b.createdAt instanceof Date ? b.createdAt.getTime() : b.createdAt ? new Date(b.createdAt).getTime() : 0
    return ta - tb
  })

  const rows: Array<{
    messageId: string
    shortIntent: string
    status: IntentOperationalStatus
  }> = []

  for (const m of asc) {
    const si = getShortIntentFromMessageMetadata(m.metadata)
    if (!si) continue
    const metaObj =
      typeof m.metadata === "string"
        ? parseMessageMetadataRecord(m.metadata)
        : m.metadata && typeof m.metadata === "object" && !Array.isArray(m.metadata)
          ? (m.metadata as Record<string, unknown>)
          : null
    const status = getIntentOperationalStatusFromMetadata(metaObj)
    rows.push({ messageId: m.id, shortIntent: si, status })
  }

  return pickConversationIntentPreviews(rows)
}
