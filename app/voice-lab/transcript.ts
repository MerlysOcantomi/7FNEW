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
  /**
   * Best-effort: an assistant turn cut short by a barge-in. Only set via
   * `markInterrupted`, and preserved across later partial/final updates so the
   * "interrumpido" marker is not lost when a trailing transcript arrives. Never
   * present on entries that were never interrupted (keeps equality simple).
   */
  interrupted?: boolean
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
  const entry: TranscriptEntry = {
    id: update.id,
    role: update.role,
    text: update.text,
    status: update.status,
  }
  // Preserve an interrupted mark across later partial/final updates; never add
  // the key to entries that were never interrupted.
  if (existing?.interrupted) entry.interrupted = true
  next.set(update.id, entry)
  return next
}

/**
 * Mark an existing ASSISTANT entry as interrupted (best-effort barge-in mark).
 * No-op if the id is unknown or the entry is a user turn. Reliable item↔event
 * relation is not guaranteed by SDK 0.3.0, so callers pass the last streaming
 * assistant id; the UI documents this as approximate.
 */
export function markInterrupted(store: TranscriptStore, id: string): TranscriptStore {
  const existing = store.get(id)
  if (!existing || existing.role !== "assistant" || existing.interrupted) return store
  const next = new Map(store)
  next.set(id, { ...existing, interrupted: true })
  return next
}

/** Ordered list for rendering. */
export function transcriptLines(store: TranscriptStore): TranscriptEntry[] {
  return [...store.values()]
}
