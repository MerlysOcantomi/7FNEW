/**
 * Voice capability detection — pure evaluation over an injected environment
 * snapshot, so it is deterministic in tests and never sniffs screen width.
 *
 * `readVoiceEnvironment()` is the only browser-touching function (safe to call
 * during SSR — returns an "everything false" snapshot); `evaluateVoiceSupport`
 * is pure. Voice UI must key off THESE signals: when unsupported, the mic is
 * hidden/disabled with an accessible explanation and the hold-to-talk hint is
 * never shown.
 */

export interface VoiceEnvironment {
  secureContext: boolean
  hasMediaDevices: boolean
  hasGetUserMedia: boolean
  hasRTCPeerConnection: boolean
  hasAudioPlayback: boolean
  touchCapable: boolean
}

export interface VoiceSupport {
  /** Microphone + WebRTC voice sessions can run in this browser context. */
  voiceSupported: boolean
  /** Long-press affordance is meaningful (touch-capable device). */
  touchCapable: boolean
  /** First unmet requirement, for an honest disabled-state explanation. */
  unsupportedReason:
    | null
    | "insecure_context"
    | "no_media_devices"
    | "no_get_user_media"
    | "no_webrtc"
    | "no_audio_playback"
}

/** Snapshot the real browser environment. SSR-safe: no window → all false. */
export function readVoiceEnvironment(): VoiceEnvironment {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      secureContext: false,
      hasMediaDevices: false,
      hasGetUserMedia: false,
      hasRTCPeerConnection: false,
      hasAudioPlayback: false,
      touchCapable: false,
    }
  }
  const mediaDevices = navigator.mediaDevices
  return {
    secureContext: window.isSecureContext === true,
    hasMediaDevices: !!mediaDevices,
    hasGetUserMedia: typeof mediaDevices?.getUserMedia === "function",
    hasRTCPeerConnection: typeof window.RTCPeerConnection === "function",
    hasAudioPlayback: typeof window.Audio === "function" || typeof window.AudioContext === "function",
    // Capability, not viewport width: coarse pointers / touch points.
    touchCapable:
      (typeof navigator.maxTouchPoints === "number" && navigator.maxTouchPoints > 0) ||
      (typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches),
  }
}

export function evaluateVoiceSupport(env: VoiceEnvironment): VoiceSupport {
  const unsupportedReason = !env.secureContext
    ? ("insecure_context" as const)
    : !env.hasMediaDevices
      ? ("no_media_devices" as const)
      : !env.hasGetUserMedia
        ? ("no_get_user_media" as const)
        : !env.hasRTCPeerConnection
          ? ("no_webrtc" as const)
          : !env.hasAudioPlayback
            ? ("no_audio_playback" as const)
            : null

  return {
    voiceSupported: unsupportedReason === null,
    touchCapable: env.touchCapable,
    unsupportedReason,
  }
}
