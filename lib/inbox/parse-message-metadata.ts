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
