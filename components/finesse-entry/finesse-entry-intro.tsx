"use client"

import { useEffect, useRef, useState } from "react"

const FINESSE_INTRO_SEEN_KEY = "finesse-entry-intro-seen"
const FINESSE_INTRO_VIDEO = "/finesse/video/finesse-intro.mp4"

export function FinesseEntryIntro({ onComplete }: { onComplete: () => void }) {
  const [ready, setReady] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const completedRef = useRef(false)

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    let seen = false
    try {
      seen = window.sessionStorage.getItem(FINESSE_INTRO_SEEN_KEY) === "1"
    } catch {
      // Storage may be unavailable in restrictive browser modes.
    }

    if (reducedMotion || seen) {
      completedRef.current = true
      onComplete()
      return
    }

    setReady(true)
  }, [onComplete])

  function complete() {
    if (completedRef.current) return
    completedRef.current = true

    try {
      window.sessionStorage.setItem(FINESSE_INTRO_SEEN_KEY, "1")
    } catch {
      // The intro still works when sessionStorage is unavailable.
    }

    setLeaving(true)
    window.setTimeout(onComplete, 420)
  }

  if (!ready) return null

  return (
    <div
      data-finesse-entry-intro
      data-theme="petrol-pearl"
      className={`fixed inset-0 z-[100] overflow-hidden bg-[var(--app-canvas)] transition-opacity duration-500 ${
        leaving ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      {/* Mobile: fill the portrait canvas without sacrificing the full composition. */}
      <video
        autoPlay
        muted
        playsInline
        preload="metadata"
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-45 blur-2xl md:hidden"
      >
        <source src={FINESSE_INTRO_VIDEO} type="video/mp4" />
      </video>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[color-mix(in_srgb,var(--app-canvas)_34%,transparent)] md:hidden"
      />

      <video
        autoPlay
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
        onEnded={complete}
        onError={complete}
        className="relative z-10 h-full w-full scale-[1.04] object-contain md:scale-100 md:object-cover"
      >
        <source src={FINESSE_INTRO_VIDEO} type="video/mp4" />
      </video>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-20 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-canvas)_28%,transparent)_0%,transparent_24%,transparent_74%,color-mix(in_srgb,var(--app-canvas)_48%,transparent)_100%)] md:bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-canvas)_38%,transparent)_0%,transparent_28%,transparent_72%,color-mix(in_srgb,var(--app-canvas)_52%,transparent)_100%)]"
      />

      <button
        type="button"
        onClick={complete}
        className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-30 rounded-full border border-white/20 bg-black/25 px-4 py-2 text-xs font-medium text-white/90 backdrop-blur-md transition-colors hover:bg-black/35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:right-6"
      >
        Saltar
      </button>
    </div>
  )
}
