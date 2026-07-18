/**
 * Ask Finesse launcher — hold-to-talk gesture machine (pure, injected timers).
 *
 * Framework-free so the click-vs-hold rules are deterministic and unit-tested;
 * the React hook (`components/assistant/use-finesse-long-press.ts`) only wires
 * DOM events + real timers to this machine.
 *
 * Rules (mission §13):
 *  - `pointerDown` on a COARSE pointer starts the long-press timer; fine
 *    pointers (mouse) never long-press — they click.
 *  - Firing the timer marks the gesture as a long press and invokes
 *    `onLongPress` exactly once; the following `pointerUp`/click must NOT also
 *    fire the normal click action.
 *  - Moving beyond the tolerance (scroll intent) cancels the timer; the
 *    subsequent click is also suppressed only if the long press already fired.
 *  - `pointerCancel` cleans up without firing anything.
 *  - Keyboard/AT activation never goes through this machine — the host keeps
 *    its native click behavior (`shouldSuppressClick` is false for them).
 */

export const LONG_PRESS_DELAY_MS = 500
export const LONG_PRESS_TOLERANCE_PX = 12

export interface LongPressCallbacks {
  onLongPress: () => void
  onClick: () => void
}

export interface LongPressTimer {
  schedule: (fn: () => void, ms: number) => unknown
  cancel: (handle: unknown) => void
}

export interface LongPressOptions {
  delayMs?: number
  tolerancePx?: number
}

export class LongPressGesture {
  private timerHandle: unknown = null
  private startX = 0
  private startY = 0
  private pressing = false
  private longPressFired = false
  private suppressNextClick = false
  private readonly delayMs: number
  private readonly tolerancePx: number

  constructor(
    private readonly cb: LongPressCallbacks,
    private readonly timer: LongPressTimer,
    options: LongPressOptions = {},
  ) {
    this.delayMs = options.delayMs ?? LONG_PRESS_DELAY_MS
    this.tolerancePx = options.tolerancePx ?? LONG_PRESS_TOLERANCE_PX
  }

  /** `coarse` = touch/pen pointer. Fine pointers never start the timer. */
  pointerDown(x: number, y: number, coarse: boolean): void {
    this.clearTimer()
    this.pressing = true
    this.longPressFired = false
    this.startX = x
    this.startY = y
    if (!coarse) return
    this.timerHandle = this.timer.schedule(() => {
      this.timerHandle = null
      if (!this.pressing) return
      this.longPressFired = true
      this.suppressNextClick = true
      this.cb.onLongPress()
    }, this.delayMs)
  }

  pointerMove(x: number, y: number): void {
    if (!this.pressing || this.timerHandle === null) return
    const dx = x - this.startX
    const dy = y - this.startY
    if (dx * dx + dy * dy > this.tolerancePx * this.tolerancePx) {
      // Scroll/drag intent — never a long press.
      this.clearTimer()
    }
  }

  pointerUp(): void {
    this.pressing = false
    this.clearTimer()
    // A released long press must not ALSO click; the browser still emits a
    // click event, which `clickIntercepted()` swallows exactly once.
  }

  pointerCancel(): void {
    this.pressing = false
    this.longPressFired = false
    this.suppressNextClick = false
    this.clearTimer()
  }

  /**
   * Host calls this from the DOM `click` handler. Returns true when the click
   * belongs to a completed long press and must be swallowed; otherwise runs
   * the normal click action. Keyboard clicks (no preceding pointerdown/long
   * press) always run normally.
   */
  clickIntercepted(): boolean {
    if (this.suppressNextClick) {
      this.suppressNextClick = false
      this.longPressFired = false
      return true
    }
    this.cb.onClick()
    return false
  }

  /** For teardown on unmount. */
  dispose(): void {
    this.pressing = false
    this.suppressNextClick = false
    this.longPressFired = false
    this.clearTimer()
  }

  private clearTimer(): void {
    if (this.timerHandle !== null) {
      this.timer.cancel(this.timerHandle)
      this.timerHandle = null
    }
  }
}

// ─── One-time "hold to talk" hint eligibility (pure) ─────────────────────────

export const VOICE_HINT_MAX_SHOWS = 2
/** localStorage key holding ONLY the learning counter — never conversation data. */
export const VOICE_HINT_STORAGE_KEY = "7f-finesse-voice-hint-shown"

export interface VoiceHintSignals {
  voiceSupported: boolean
  touchCapable: boolean
  entitled: boolean
  /** Voice has actually worked at least once in this browser profile. */
  everConnected: boolean
  /** Times the hint was already shown (persisted learning flag). */
  shownCount: number
}

/** The hint appears only when the long press would genuinely work. */
export function shouldShowVoiceHint(signals: VoiceHintSignals): boolean {
  return (
    signals.voiceSupported &&
    signals.touchCapable &&
    signals.entitled &&
    signals.everConnected &&
    signals.shownCount < VOICE_HINT_MAX_SHOWS
  )
}
