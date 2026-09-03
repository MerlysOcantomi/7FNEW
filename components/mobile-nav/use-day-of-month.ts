"use client"

import { useEffect, useState } from "react"
import { getDayOfMonth, msUntilNextLocalDay } from "@core/vertical-packs/mobile-nav"

/**
 * The device's current local date, resolved AFTER mount so server and client
 * markup agree (SSR has no idea what day it is on the phone). Refreshes itself
 * at the next local midnight and whenever the tab becomes visible again (a
 * salon phone left open overnight shows the new day without a reload). Returns
 * `null` until mounted.
 */
export function useLocalToday(): Date | null {
  const [today, setToday] = useState<Date | null>(null)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const update = () => setToday(new Date())
    const schedule = () => {
      timer = setTimeout(() => {
        update()
        schedule()
      }, msUntilNextLocalDay(new Date()))
    }
    const onVisible = () => {
      if (document.visibilityState === "visible") update()
    }
    update()
    schedule()
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      if (timer) clearTimeout(timer)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [])

  return today
}

/** Convenience: the local day of month (1–31), or `null` before mount. */
export function useDayOfMonth(): number | null {
  const today = useLocalToday()
  return today ? getDayOfMonth(today) : null
}
