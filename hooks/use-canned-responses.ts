"use client"

import { useCallback, useEffect, useState } from "react"
import { useUser } from "@/hooks/use-user"

export interface CannedResponse {
  id: string
  label: string
  content: string
}

export function useCannedResponses() {
  const { user } = useUser()
  const [items, setItems] = useState<CannedResponse[]>([])
  const [loaded, setLoaded] = useState(false)

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch("/api/inbox/canned-responses")
      if (!res.ok) return
      const json = await res.json()
      setItems(Array.isArray(json.data) ? json.data : [])
    } catch {
      /* silent */
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (user) fetch_()
  }, [user, fetch_])

  return { items, loaded, refetch: fetch_ }
}
