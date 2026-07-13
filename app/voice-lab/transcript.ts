/**
 * Voice Lab transcript store (CORE-VOICE-0B.1.1) — pure, id-keyed.
 *
 * Items are tracked by id so we never blindly append on each update:
 *   - partial  → replace the text
 *   - final    → consolidate (a later partial for a finalized id is ignored)
 *   - repeated → ignored (same id, no change of content after final)
 *   - error    → unavailable
 *
 * Insertion order is preserved so the UI renders turns in order.
 */

export type TranscriptStatus = "partial" | "final" | "unavailable"
export type TranscriptRole = "user" | "assistant"

export interface TranscriptEntry {
  id: string
  role: TranscriptRole
  text: string
  status: TranscriptStatus
}

export type TranscriptStore = ReadonlyMap<string, TranscriptEntry>

export function emptyTranscriptStore(): TranscriptStore {
  return new Map()
}

export interface TranscriptUpdate {
  id: string
  role: TranscriptRole
  text: string
  status: TranscriptStatus
}

/**
 * Apply one update, returning a new store. A finalized entry is immutable except
 * to become `unavailable` (a transcription failure always wins). Partial/repeat
 * updates to a finalized id are ignored.
 */
export function applyTranscript(
  store: TranscriptStore,
  update: TranscriptUpdate,
): TranscriptStore {
  const existing = store.get(update.id)

  if (existing?.status === "final") {
    // Only a failure may override a finalized entry; everything else is ignored.
    if (update.status !== "unavailable") return store
  }
  if (
    existing &&
    existing.status === update.status &&
    existing.text === update.text &&
    existing.role === update.role
  ) {
    // Repeated identical update → no change (no duplicate line).
    return store
  }

  const next = new Map(store)
  next.set(update.id, {
    id: update.id,
    role: update.role,
    text: update.text,
    status: update.status,
  })
  return next
}

/** Ordered list for rendering. */
export function transcriptLines(store: TranscriptStore): TranscriptEntry[] {
  return [...store.values()]
}
