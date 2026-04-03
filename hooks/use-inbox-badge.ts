"use client"

import { useCallback, useEffect, useRef, useState } from "react"

const POLL_INTERVAL_MS = 30_000

/**
 * Returns the count of conversations needing operator attention.
 * Uses the per-operator attention model: new + assigned-unseen + lead-unseen.
 */
export function useInboxBadge(): number {
  const [count, setCount] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchCount = useCallback(async () => {
    try {
      const res = await fetch("/api/inbox/attention-count")
      const json = await res.json()
      if (json.success && typeof json.data?.total === "number") {
        setCount(json.data.total)
      }
    } catch {}
  }, [])

  useEffect(() => {
    fetchCount()
    intervalRef.current = setInterval(fetchCount, POLL_INTERVAL_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchCount])

  return count
}
