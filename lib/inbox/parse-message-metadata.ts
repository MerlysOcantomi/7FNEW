/**
 * Parsea `Message.metadata` (string JSON en Prisma). Acepta JSON doblemente codificado por error.
 */
export function parseMessageMetadataRecord(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null
  try {
    let v: unknown = JSON.parse(raw)
    if (typeof v === "string") {
      try {
        v = JSON.parse(v)
      } catch {
        return null
      }
    }
    if (!v || typeof v !== "object") return null
    return v as Record<string, unknown>
  } catch {
    return null
  }
}

/** Claves donde puede vivir la frase corta por mensaje (Smart Inbox). */
export function getShortIntentFromMetadataRecord(meta: Record<string, unknown> | null): string | null {
  if (!meta) return null
  const raw = meta.shortIntent ?? meta.short_intent
  if (typeof raw !== "string") return null
  const t = raw.trim()
  return t.length > 0 ? t : null
}

/** Lee `shortIntent` desde metadata en bruto (string JSON) o ya parseada en objeto (respuesta lista API). */
export function getShortIntentFromMessageMetadata(
  rawMeta: string | Record<string, unknown> | null | undefined,
): string | null {
  const metaRecord =
    rawMeta == null
      ? null
      : typeof rawMeta === "string"
        ? parseMessageMetadataRecord(rawMeta)
        : typeof rawMeta === "object" && !Array.isArray(rawMeta)
          ? (rawMeta as Record<string, unknown>)
          : null
  return getShortIntentFromMetadataRecord(metaRecord)
}

/**
 * Devuelve el `shortIntent` del mensaje **más reciente** que lo tenga entre los incluidos en la lista.
 * Ordena por `createdAt` descendente de forma defensiva (por si el JSON llegara en otro orden).
 */
export function firstShortIntentFromRecentMessages(
  messages:
    | Array<{ metadata?: string | Record<string, unknown> | null; createdAt?: string }>
    | undefined
    | null,
): string | null {
  if (!messages?.length) return null
  const sorted = [...messages].sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : NaN
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : NaN
    const safeA = Number.isFinite(ta) ? ta : 0
    const safeB = Number.isFinite(tb) ? tb : 0
    return safeB - safeA
  })
  for (const m of sorted) {
    const s = getShortIntentFromMessageMetadata(m.metadata)
    if (s) return s
  }
  return null
}

export interface CurrentRequestRef {
  messageId: string
  text: string
}

/**
 * Resolves the "current request" for a conversation row: the most recent ACTIVE
 * inbound message that already carries an AI `shortIntent`, together with its
 * `messageId` so the collapsed row can anchor to the real email in the thread.
 *
 * Mirrors the activity filters used by the expanded request list in
 * `app/inbox/page.tsx` (`parseResponse`): outbound replies, internal notes,
 * system events, soft-trashed messages and intents marked done never represent
 * the current request. Returns `null` when no qualifying message exists — the
 * caller must then fall back to thread-level text and render no anchor (no
 * fake navigation).
 */
export function currentRequestFromRecentMessages(
  messages:
    | Array<{
        id?: string
        direction?: string
        role?: string
        isInternal?: boolean
        createdAt?: string
        metadata?: string | Record<string, unknown> | null
      }>
    | undefined
    | null,
): CurrentRequestRef | null {
  if (!messages?.length) return null
  const sorted = [...messages].sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : NaN
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : NaN
    const safeA = Number.isFinite(ta) ? ta : 0
    const safeB = Number.isFinite(tb) ? tb : 0
    return safeB - safeA
  })
  for (const m of sorted) {
    if (!m.id) continue
    if (m.direction !== "inbound") continue
    if (m.isInternal === true) continue
    if (m.role === "system") continue
    const meta =
      m.metadata == null
        ? null
        : typeof m.metadata === "string"
          ? parseMessageMetadataRecord(m.metadata)
          : typeof m.metadata === "object" && !Array.isArray(m.metadata)
            ? (m.metadata as Record<string, unknown>)
            : null
    if (meta && typeof meta.trashedAt === "string" && meta.trashedAt.length > 0) continue
    if (meta && meta.intentStatus === "done") continue
    const text = getShortIntentFromMetadataRecord(meta)
    if (!text) continue
    return { messageId: m.id, text }
  }
  return null
}
