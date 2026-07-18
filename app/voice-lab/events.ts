/**
 * Voice Lab event parsing (CORE-VOICE-0B.1.1).
 *
 * The defensive Realtime event parser was promoted to
 * `@core/voice/realtime-events` during the shared-voice extraction so the
 * production Ask Finesse surface parses transport events identically. This
 * module keeps the lab's historical names as aliases; the lab tests keep
 * pinning the 0.3.0 payload fixtures against the SAME shared implementation.
 */

export {
  parseRealtimeEvent as parseLabEvent,
  toTurnUsage,
  type RealtimeVoiceEvent as LabEvent,
} from "@core/voice/realtime-events"
