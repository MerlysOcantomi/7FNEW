"use client"

import { useCallback, useEffect, useRef, useState } from "react"

const POLL_INTERVAL_MS = 30_000

/**
 * Lightweight hook that returns the count of conversations needing attention.
 * Rule: status = "new" (arrived but not yet triaged/assigned/responded).
 * Polls every 30 seconds. Returns 0 while loading or on error.
 */
export function useInboxBadge(): number {
  const [count, setCount] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchCount = useCallback(async () => {
    try {
      const res = await fetch("/api/inbox/conversations?status=new&pageSize=1")
      const json = await res.json()
      if (json.success && typeof json.meta?.total === "number") {
        setCount(json.meta.total)
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
