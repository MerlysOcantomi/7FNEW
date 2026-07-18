import type { VoiceMessages } from "../types"

/** Ask Finesse voice labels — English base. */
export const voice: VoiceMessages = {
  micStart: "Talk to Finesse",
  micUnsupported: "Voice needs a microphone and a secure browser; text keeps working normally.",
  stop: "End voice",
  interrupt: "Cut response",
  mute: "Mute microphone",
  unmute: "Unmute microphone",
  states: {
    connecting: "Connecting",
    listening: "Listening",
    thinking: "Thinking",
    speaking: "Speaking",
    interrupted: "Interrupted",
    stopping: "Ending",
    expired: "Session ended",
    error: "Voice error",
  },
  micBlocked: "Microphone blocked. Allow it in your browser and try again.",
  micUnavailableDevice: "No microphone available. Connect one and try again.",
  unavailable: "Voice is not available right now. Text keeps working normally.",
  rateLimited: "Too many voice attempts. Wait a moment and try again.",
  sessionEnded: "Voice session ended. Tap the microphone to talk again.",
  contextChanged: "You changed page — restart voice to talk about this screen.",
  interruptedMarker: "interrupted",
  holdToTalk: "Hold to talk",
  voiceStatusRegion: "Voice status",
}
