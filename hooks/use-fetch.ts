"use client"

import { useState, useEffect, useCallback } from "react"

interface FetchOptions {
  refreshKey?: number
}

interface FetchResult<T> {
  data: T | null
  meta: Record<string, unknown> | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useFetch<T>(url: string | null, options?: FetchOptions): FetchResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [meta, setMeta] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const refreshKey = options?.refreshKey

  const fetchData = useCallback(async () => {
    if (!url) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(url)
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message || "Error desconocido")
      setData(json.data)
      setMeta(json.meta ?? null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setLoading(false)
    }
  }, [url])

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchData, refreshKey])

  return { data, meta, loading, error, refetch: fetchData }
}
