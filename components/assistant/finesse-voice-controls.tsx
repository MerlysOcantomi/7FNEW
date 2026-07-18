"use client"

import { Loader2, Mic, MicOff, Square } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"
import type { VoiceMessages } from "@core/i18n/ui"
import { useFinesseAssistant } from "./finesse-assistant-provider"
import type { FinesseVoiceHandle, FinesseVoiceState } from "./finesse-voice-controller"

/**
 * Voice controls for the Ask Finesse panel: the composer microphone button
 * and the active-session status bar. All copy comes from the central i18n
 * runtime (`t.voice`); states are announced through ONE polite live region
 * (never per partial transcript) and never rely on color alone.
 */

// ─── Status helpers ──────────────────────────────────────────────────────────

function stateLabel(t: VoiceMessages, state: FinesseVoiceState): string {
  switch (state) {
    case "requesting-permission":
    case "connecting":
      return t.states.connecting
    case "listening":
      return t.states.listening
    case "thinking":
      return t.states.thinking
    case "speaking":
      return t.states.speaking
    case "interrupted":
      return t.states.interrupted
    case "stopping":
      return t.states.stopping
    case "expired":
      return t.states.expired
    case "error":
      return t.states.error
    default:
      return ""
  }
}

function errorCopy(t: VoiceMessages, voice: FinesseVoiceHandle): string | null {
  if (voice.state !== "error") return null
  switch (voice.errorKind) {
    case "permission_denied":
      return t.micBlocked
    case "mic_unavailable":
      return t.micUnavailableDevice
    case "entitlement":
    case "provider_unavailable":
      return t.unavailable
    case "rate_limited":
      return t.rateLimited
    default:
      return t.unavailable
  }
}

/** Tone per state — glyph + label always accompany the color. */
function stateTone(state: FinesseVoiceState): string {
  switch (state) {
    case "listening":
      return "var(--inbox-info)"
    case "thinking":
      return "var(--inbox-lead)"
    case "speaking":
      return "var(--inbox-success)"
    case "interrupted":
      return "var(--inbox-lead)"
    case "error":
      return "var(--inbox-urgency)"
    default:
      return "var(--text-secondary-light)"
  }
}

// ─── Composer microphone button ──────────────────────────────────────────────

/**
 * The accessible voice entry point inside the panel. Hidden only when the
 * server said the workspace has no entitlement; DISABLED (with an accessible
 * explanation) when the browser cannot do voice. Clicking while a session is
 * active stops it.
 */
export function FinesseVoiceMicButton() {
  const { voice } = useFinesseAssistant()
  const { t } = useI18n()
  const tv = t.voice

  if (!voice.entitled) return null

  const supported = voice.support.voiceSupported
  const busy = voice.state === "connecting" || voice.state === "requesting-permission"

  return (
    <>
      <button
        type="button"
        data-finesse-mic
        onClick={() => (voice.active ? voice.stop("user") : void voice.start())}
        disabled={!supported}
        aria-label={voice.active ? tv.stop : tv.micStart}
        aria-pressed={voice.active}
        aria-describedby={!supported ? "finesse-voice-unsupported" : undefined}
        title={supported ? (voice.active ? tv.stop : tv.micStart) : tv.micUnsupported}
        className={`grid h-[42px] w-[42px] shrink-0 place-items-center rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40 ${
          voice.active
            ? "border-transparent bg-[var(--accent-primary)] text-white"
            : "border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] text-[var(--text-secondary-light)] hover:text-[var(--text-primary-light)]"
        }`}
      >
        {busy ? (
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
        ) : voice.active ? (
          <Square size={14} strokeWidth={2.5} aria-hidden="true" />
        ) : (
          <Mic size={16} strokeWidth={2} aria-hidden="true" />
        )}
      </button>
      {!supported ? (
        <span id="finesse-voice-unsupported" className="sr-only">
          {tv.micUnsupported}
        </span>
      ) : null}
    </>
  )
}

// ─── Active-session status bar ───────────────────────────────────────────────

/**
 * Rendered above the composer while a session is active or just ended.
 * Carries the polite live region for state announcements plus the explicit
 * controls: stop, interrupt (while speaking), mute.
 */
export function FinesseVoiceStatusBar() {
  const { voice } = useFinesseAssistant()
  const { t } = useI18n()
  const tv = t.voice

  const showBar = voice.active || voice.state === "expired" || voice.state === "error"
  const label = stateLabel(tv, voice.state)
  const error = errorCopy(tv, voice)
  const tone = stateTone(voice.state)

  return (
    <div aria-label={tv.voiceStatusRegion} role="status" aria-live="polite" className={showBar ? "border-t border-[var(--border-dark)] px-4 py-2" : "sr-only"}>
      {showBar ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span
              aria-hidden="true"
              className={`h-2 w-2 shrink-0 rounded-full ${
                voice.state === "listening" || voice.state === "speaking"
                  ? "animate-pulse motion-reduce:animate-none"
                  : ""
              }`}
              style={{ background: tone }}
            />
            <span className="truncate text-[11.5px] font-semibold" style={{ color: tone }}>
              {voice.state === "expired" ? tv.sessionEnded : error ?? label}
            </span>
          </span>

          {voice.state === "speaking" ? (
            <button
              type="button"
              onClick={voice.interrupt}
              className="rounded-lg border border-[var(--border-dark)] px-2 py-1 text-[10.5px] font-semibold text-[var(--text-secondary-light)] transition-colors hover:text-[var(--text-primary-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/50"
            >
              {tv.interrupt}
            </button>
          ) : null}

          {voice.active ? (
            <>
              <button
                type="button"
                onClick={voice.toggleMute}
                aria-pressed={voice.muted}
                aria-label={voice.muted ? tv.unmute : tv.mute}
                title={voice.muted ? tv.unmute : tv.mute}
                className="grid h-7 w-7 place-items-center rounded-lg border border-[var(--border-dark)] text-[var(--text-secondary-light)] transition-colors hover:text-[var(--text-primary-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/50"
              >
                {voice.muted ? (
                  <MicOff size={13} aria-hidden="true" />
                ) : (
                  <Mic size={13} aria-hidden="true" />
                )}
              </button>
              <button
                type="button"
                onClick={() => voice.stop("user")}
                className="rounded-lg bg-[var(--accent-primary)] px-2.5 py-1 text-[10.5px] font-semibold text-white transition-colors hover:bg-[var(--accent-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-1"
              >
                {tv.stop}
              </button>
            </>
          ) : null}
        </div>
      ) : (
        // Empty live region while idle so announcements have a stable node.
        <span />
      )}
    </div>
  )
}
