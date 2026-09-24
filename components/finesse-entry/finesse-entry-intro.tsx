"use client"

import { useCallback, useEffect, useRef, useState } from "react"

const FINESSE_INTRO_DESKTOP_VIDEO = "/finesse/video/Intro%20Finesse%20horizontal.mp4"
const FINESSE_INTRO_MOBILE_VIDEO = "/finesse/image/Mobile%20intro%20finesse.mp4"

type IntroMedia = "mobile" | "desktop"

export function FinesseEntryIntro({ onComplete }: { onComplete: () => void }) {
  const [ready, setReady] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [media, setMedia] = useState<IntroMedia | null>(null)
  const completedRef = useRef(false)

  const complete = useCallback(() => {
    if (completedRef.current) return
    completedRef.current = true
    setLeaving(true)
    window.setTimeout(onComplete, 420)
  }, [onComplete])

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    if (reducedMotion) {
      completedRef.current = true
      onComplete()
      return
    }

    setMedia(window.matchMedia("(min-width: 768px)").matches ? "desktop" : "mobile")
    setReady(true)
  }, [onComplete])

  if (!ready || !media) return null

  const videoSrc =
    media === "mobile" ? FINESSE_INTRO_MOBILE_VIDEO : FINESSE_INTRO_DESKTOP_VIDEO

  return (
    <div
      data-finesse-entry-intro
      data-theme="petrol-pearl"
      className={`fixed inset-0 z-[100] overflow-hidden bg-[var(--app-canvas)] transition-opacity duration-500 ${
        leaving ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <video
        key={videoSrc}
        autoPlay
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
        onEnded={complete}
        onError={complete}
        className="relative z-10 h-full w-full object-cover object-center"
      >
        <source src={videoSrc} type="video/mp4" />
      </video>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-20 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-canvas)_10%,transparent)_0%,transparent_20%,transparent_80%,color-mix(in_srgb,var(--app-canvas)_22%,transparent)_100%)]"
      />

      <button
        type="button"
        onClick={complete}
        className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-30 rounded-full border border-white/20 bg-black/20 px-4 py-2 text-xs font-medium text-white/90 backdrop-blur-md transition-colors hover:bg-black/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:right-6"
      >
        Saltar
      </button>
    </div>
  )
}
