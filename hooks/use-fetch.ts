"use client"

import { useState, useEffect, useCallback, useRef } from "react"

interface FetchOptions {
  refreshKey?: number
  pollInterval?: number
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
  const pollInterval = options?.pollInterval
  const isMountedRef = useRef(true)

  const fetchData = useCallback(async (silent = false) => {
    if (!url) {
      setData(null)
      setMeta(null)
      setError(null)
      setLoading(false)
      return
    }
    if (!silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const res = await fetch(url)
      if (!isMountedRef.current) return
      if (!res.ok) {
        const text = await res.text()
        try {
          const json = JSON.parse(text)
          throw new Error(json.error?.message || `Error ${res.status}`)
        } catch (parseErr) {
          if (parseErr instanceof SyntaxError) throw new Error(`Error ${res.status}: ${res.statusText}`)
          throw parseErr
        }
      }
      const json = await res.json()
      if (!isMountedRef.current) return
      if (!json.success) throw new Error(json.error?.message || "Error desconocido")
      setData(json.data)
      setMeta(json.meta ?? null)
      if (!silent) setError(null)
    } catch (err: unknown) {
      if (isMountedRef.current && !silent) {
        setError(err instanceof Error ? err.message : "Error desconocido")
      }
    } finally {
      if (isMountedRef.current && !silent) {
        setLoading(false)
      }
    }
  }, [url])

  useEffect(() => {
    isMountedRef.current = true
    return () => { isMountedRef.current = false }
  }, [])

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchData, refreshKey])

  useEffect(() => {
    if (!pollInterval || !url) return
    const id = setInterval(() => fetchData(true), pollInterval)
    return () => clearInterval(id)
  }, [pollInterval, url, fetchData])

  const refetch = useCallback(() => fetchData(false), [fetchData])

  return { data, meta, loading, error, refetch }
}
