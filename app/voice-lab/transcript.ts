/**
 * Voice Lab transcript store (CORE-VOICE-0B.1.1).
 *
 * Promoted to `@core/voice/realtime-transcript` during the shared-voice
 * extraction — the id-keyed partial/final consolidation and interrupted-mark
 * behavior is identical for every voice surface. Re-exported here so lab code
 * and tests keep their import path.
 */

export {
  applyTranscript,
  emptyTranscriptStore,
  markInterrupted,
  transcriptLines,
  type TranscriptEntry,
  type TranscriptRole,
  type TranscriptStore,
  type TranscriptUpdate,
} from "@core/voice/realtime-transcript"

export type { TranscriptStatus } from "@core/voice/contracts"
