/**
 * Voice Lab session lifecycle (CORE-VOICE-0B.1.2a).
 *
 * Promoted to `@core/voice/lifecycle` during the shared-voice extraction —
 * the explicit `sessionLive` truth and the derived control-lock view are
 * identical for every voice surface. Re-exported here so lab code and tests
 * keep their import path.
 */

export {
  SESSION_LIVE_INITIAL,
  lifecycleView,
  nextSessionLive,
  type LifecycleEvent,
  type LifecycleView,
} from "@core/voice/lifecycle"
