"use client"

import { useEffect, useMemo, useState } from "react"
import { Sparkles, X } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer"
import { useActiveWorkspace } from "@/hooks/use-active-workspace"
import { useIsMobile } from "@/hooks/use-mobile"
import { resolveVerticalSpecialist } from "@core/vertical-packs/specialists"
import { useI18n } from "@/components/i18n-provider"
import { getFinesseAssistantCopy } from "@modules/assistant/finesse-assistant"
import {
  VOICE_HINT_STORAGE_KEY,
  shouldShowVoiceHint,
} from "@modules/assistant/finesse-long-press"
import { useFinesseAssistant } from "./finesse-assistant-provider"
import { useFinesseLongPress } from "./use-finesse-long-press"
import {
  FinesseAssistantConversation,
  FinesseAssistantIdentity,
} from "./finesse-assistant-conversation"

/**
 * Global Ask Finesse chrome: ONE floating launcher + the contextual panel.
 *
 * Mounted once by the shared shells (`AppShell`, `ContextShell`) so the
 * assistant appears automatically on every Finesse page — never added
 * per-page, never duplicated in page headers (the floating launcher is the
 * only persistent entry point; mission §5).
 *
 * Vertical gating: renders ONLY when the active workspace resolves to a
 * vertical specialist (Beauty → Finesse), or under the `?vertical=beauty`
 * design-preview helper. Other verticals ship zero assistant UI or JS beyond
 * this cheap gate.
 *
 * Form factors:
 *  - Desktop (md+): pill launcher bottom-right → right-side Sheet panel
 *    (Radix dialog → focus trap, Escape, ARIA roles and focus restoration to
 *    the launcher come built in). The page stays visible behind the overlay.
 *  - Mobile: circular launcher above the safe-area inset → vaul bottom
 *    drawer (drag-to-close, keyboard/safe-area handling out of the box).
 *
 * Overlap discipline: the launcher sits at z-40 — BELOW toasts (z-[200]) and
 * below any Radix/vaul overlay (z-50), so it can never cover a toast, a
 * dialog action or the assistant itself; while any modal is open the
 * backdrop covers the launcher. Content clearance is handled by the shells
 * (extra bottom padding when the launcher is mounted).
 */
/**
 * Explicit focus restoration: both overlays return focus to the visible
 * floating launcher on close (Radix's default "previously focused element"
 * proved unreliable here because the launcher is not the Radix trigger).
 */
function focusLauncher(event: Event) {
  event.preventDefault()
  const launchers = document.querySelectorAll<HTMLElement>("[data-finesse-launcher]")
  for (const el of launchers) {
    // The launchers are position:fixed (offsetParent is always null), so use
    // rendered boxes to skip the breakpoint-hidden (display:none) variant.
    if (el.getClientRects().length > 0) {
      el.focus()
      return
    }
  }
}

export function GlobalFinesseAssistantChrome() {
  const searchParams = useSearchParams()
  const { workspace } = useActiveWorkspace()
  const { open, setOpen, available } = useFinesseAssistant()
  const isMobile = useIsMobile()
  const { locale } = useI18n()

  // Panel chrome copy resolved from the effective UI locale (EN fallback).
  const copy = useMemo(() => getFinesseAssistantCopy(locale), [locale])

  const forcedBeauty = searchParams.get("vertical") === "beauty"
  const specialist = resolveVerticalSpecialist(
    forcedBeauty ? "beauty" : workspace?.verticalKey,
  )

  if (!available || !specialist) return null

  return (
    <>
      <FinesseLauncher />
      {isMobile ? (
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent
            className="border-[var(--border-dark)] bg-[var(--app-surface-dark)] text-[var(--text-primary-light)] data-[vaul-drawer-direction=bottom]:max-h-[88dvh] data-[vaul-drawer-direction=bottom]:rounded-t-[24px]"
            aria-describedby={undefined}
            onCloseAutoFocus={focusLauncher}
          >
            <DrawerTitle className="sr-only">{copy.panelTitle}</DrawerTitle>
            <DrawerDescription className="sr-only">{copy.panelSubtitle}</DrawerDescription>
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border-dark)] px-4 py-3">
              <FinesseAssistantIdentity />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={copy.close}
                className="grid h-8 w-8 place-items-center rounded-lg text-[var(--text-secondary-light)] transition-colors hover:bg-[var(--app-surface-hover)] hover:text-[var(--text-primary-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/50"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            {/* Fixed height keeps the composer reachable above the keyboard. */}
            <div className="flex h-[72dvh] min-h-0 flex-col pb-[env(safe-area-inset-bottom)]">
              <FinesseAssistantConversation />
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="right"
            // Floating Finesse card, not a square administrative sheet: inset
            // from the viewport (top/right/bottom ~12px), 20px radius, soft
            // accent-tinted shadow. `inset-y-3 right-3 h-auto rounded-[20px]`
            // override the primitive's `inset-y-0 right-0 h-full` via
            // tailwind-merge; Radix focus trap / Escape / restore are untouched.
            className="inset-y-3 right-3 h-auto w-full gap-0 overflow-hidden rounded-[20px] border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-0 text-[var(--text-primary-light)] shadow-[0_28px_70px_-28px_color-mix(in_srgb,var(--accent-primary)_45%,rgba(0,0,0,0.4))] sm:max-w-[420px] [&>button]:hidden"
            onCloseAutoFocus={focusLauncher}
          >
            <SheetTitle className="sr-only">{copy.panelTitle}</SheetTitle>
            <SheetDescription className="sr-only">{copy.panelSubtitle}</SheetDescription>
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border-dark)] px-4 py-3.5">
              <FinesseAssistantIdentity />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={copy.close}
                className="grid h-8 w-8 place-items-center rounded-lg text-[var(--text-secondary-light)] transition-colors hover:bg-[var(--app-surface-hover)] hover:text-[var(--text-primary-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/50"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <FinesseAssistantConversation />
          </SheetContent>
        </Sheet>
      )}
    </>
  )
}

/**
 * The floating launcher. Desktop: labeled pill. Mobile: icon circle above the
 * device safe area. Stays mounted while the panel is open (behind the modal
 * overlay) so Radix/vaul can restore focus to it on close.
 *
 * Gesture (mission §13): a short click/tap opens the panel; on touch-capable
 * devices with working voice, holding ~500ms opens the panel AND starts a
 * voice session (with a light optional haptic). The released long press never
 * double-fires the click; scrolling/moving cancels; keyboard users keep the
 * plain accessible click, and the in-panel microphone remains the accessible
 * voice entry point.
 *
 * While a session is active the launcher reflects the voice state (soft ring
 * for listening/speaking, subtle pulse for thinking — label carried by
 * aria-label, animations disabled under reduced motion). Errors drop the
 * active look instead of faking a live session.
 */
function FinesseLauncher() {
  const { openAssistant, openAssistantWithVoice, open, voice } = useFinesseAssistant()
  const { t, locale } = useI18n()
  const tv = t.voice
  const copy = getFinesseAssistantCopy(locale)

  const canLongPress =
    voice.support.voiceSupported && voice.support.touchCapable && voice.entitled

  const handlers = useFinesseLongPress({
    enabled: canLongPress,
    onLongPress: openAssistantWithVoice,
    onClick: openAssistant,
  })

  // Voice-state visual: ring/pulse + state appended to the accessible name.
  const voiceVisual =
    voice.state === "listening" || voice.state === "speaking"
      ? "ring-4 ring-[color-mix(in_srgb,var(--accent-primary)_45%,transparent)] animate-pulse motion-reduce:animate-none"
      : voice.state === "thinking" || voice.state === "connecting"
        ? "ring-2 ring-[color-mix(in_srgb,var(--accent-primary)_35%,transparent)]"
        : ""
  const stateSuffix =
    voice.state === "listening"
      ? ` — ${tv.states.listening}`
      : voice.state === "speaking"
        ? ` — ${tv.states.speaking}`
        : voice.state === "thinking"
          ? ` — ${tv.states.thinking}`
          : ""

  const shared = {
    "data-finesse-launcher": true as const,
    "aria-haspopup": "dialog" as const,
    "aria-expanded": open,
    "aria-label": `${copy.launcherAria}${stateSuffix}`,
    onPointerDown: handlers.onPointerDown,
    onPointerMove: handlers.onPointerMove,
    onPointerUp: handlers.onPointerUp,
    onPointerCancel: handlers.onPointerCancel,
    onClick: handlers.onClick,
  }

  return (
    <>
      {/* Desktop pill */}
      <button
        type="button"
        {...shared}
        className={`fixed bottom-5 right-6 z-40 hidden items-center gap-2 rounded-2xl px-4 py-2.5 text-[12.5px] font-semibold text-white shadow-[0_14px_30px_-12px_color-mix(in_srgb,var(--accent-primary)_80%,transparent)] transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:scale-100 md:inline-flex ${voiceVisual}`}
        style={{
          background:
            "linear-gradient(135deg, var(--accent-primary), var(--accent-rich, var(--accent-primary-hover, var(--accent-primary))))",
        }}
      >
        <Sparkles size={15} strokeWidth={2} aria-hidden="true" />
        {copy.launcherLabel}
      </button>

      {/* Mobile circle — above the safe-area inset, right side. */}
      <button
        type="button"
        {...shared}
        className={`fixed right-4 z-40 grid h-[52px] w-[52px] place-items-center rounded-full text-white shadow-[0_14px_30px_-10px_color-mix(in_srgb,var(--accent-primary)_85%,transparent)] transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 motion-reduce:transition-none md:hidden ${voiceVisual}`}
        style={{
          bottom: "calc(1.25rem + env(safe-area-inset-bottom))",
          background:
            "linear-gradient(135deg, var(--accent-primary), var(--accent-rich, var(--accent-primary-hover, var(--accent-primary))))",
        }}
      >
        <Sparkles size={21} strokeWidth={2} aria-hidden="true" />
      </button>

      <HoldToTalkHint eligible={canLongPress && voice.everConnected && !open} label={tv.holdToTalk} />
    </>
  )
}

/**
 * One-time "hold to talk" education (mission §13): shown at most
 * VOICE_HINT_MAX_SHOWS times, ONLY when the long press would genuinely work
 * (capability + touch + entitlement + voice has connected before). Persists
 * nothing but the shown counter; dismisses on any interaction or after a few
 * seconds; never blocks controls.
 */
function HoldToTalkHint({ eligible, label }: { eligible: boolean; label: string }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!eligible) return
    let shown = 0
    try {
      shown = Number(window.localStorage.getItem(VOICE_HINT_STORAGE_KEY) ?? "0") || 0
    } catch {
      return // storage unavailable → never nag repeatedly; skip the hint
    }
    if (
      !shouldShowVoiceHint({
        voiceSupported: true,
        touchCapable: true,
        entitled: true,
        everConnected: true,
        shownCount: shown,
      })
    ) {
      return
    }
    setVisible(true)
    try {
      window.localStorage.setItem(VOICE_HINT_STORAGE_KEY, String(shown + 1))
    } catch {
      /* learning flag only — safe to lose */
    }
    const timer = setTimeout(() => setVisible(false), 6000)
    const dismiss = () => setVisible(false)
    window.addEventListener("pointerdown", dismiss, { once: true })
    return () => {
      clearTimeout(timer)
      window.removeEventListener("pointerdown", dismiss)
    }
  }, [eligible])

  if (!visible) return null

  return (
    <div
      role="note"
      className="fixed right-4 z-40 rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] px-3 py-1.5 text-[11px] font-semibold text-[var(--text-primary-light)] shadow-lg md:hidden"
      style={{ bottom: "calc(1.25rem + 60px + env(safe-area-inset-bottom))" }}
    >
      {label}
    </div>
  )
}
