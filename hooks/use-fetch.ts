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
  /** API `error.code` when the server returns `{ success: false, error: { code, message } }` */
  errorCode: string | null
  refetch: () => void
}

export function useFetch<T>(url: string | null, options?: FetchOptions): FetchResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [meta, setMeta] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const refreshKey = options?.refreshKey
  const pollInterval = options?.pollInterval
  const isMountedRef = useRef(true)

  const fetchData = useCallback(async (silent = false) => {
    if (!url) {
      setData(null)
      setMeta(null)
      setError(null)
      setErrorCode(null)
      setLoading(false)
      return
    }
    if (!silent) {
      setLoading(true)
      setError(null)
      setErrorCode(null)
    }
    try {
      const res = await fetch(url)
      if (!isMountedRef.current) return
      if (!res.ok) {
        const text = await res.text()
        try {
          const json = JSON.parse(text)
          const msg = json.error?.message || `Error ${res.status}`
          const err = new Error(msg) as Error & { apiCode?: string }
          err.apiCode = typeof json.error?.code === "string" ? json.error.code : undefined
          throw err
        } catch (parseErr) {
          if (parseErr instanceof SyntaxError) throw new Error(`Error ${res.status}: ${res.statusText}`)
          throw parseErr
        }
      }
      const json = await res.json()
      if (!isMountedRef.current) return
      if (!json.success) {
        const err = new Error(json.error?.message || "Request failed") as Error & { apiCode?: string }
        err.apiCode = typeof json.error?.code === "string" ? json.error.code : undefined
        throw err
      }
      setData(json.data)
      setMeta(json.meta ?? null)
      if (!silent) {
        setError(null)
        setErrorCode(null)
      }
    } catch (err: unknown) {
      if (isMountedRef.current && !silent) {
        const apiCode =
          err && typeof err === "object" && "apiCode" in err && typeof (err as { apiCode?: string }).apiCode === "string"
            ? (err as { apiCode: string }).apiCode
            : null
        setErrorCode(apiCode)
        setError(err instanceof Error ? err.message : "Unknown error")
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

  return { data, meta, loading, error, errorCode, refetch }
}
