"use client"

import { useCallback, useEffect, useState } from "react"

/**
 * Minimal shape returned by `GET /api/workspaces` for one membership row.
 * Keep this aligned with `listWorkspacesForUser` in `core/workspace.ts` —
 * we only surface the fields the sidebar account UI needs.
 */
export interface ActiveWorkspaceSummary {
  id: string
  nombre: string
  slug: string
  vertical: string | null
  verticalKey: string | null
  plan: string
  role: string
}

interface UseActiveWorkspaceResult {
  workspace: ActiveWorkspaceSummary | null
  workspaces: ActiveWorkspaceSummary[]
  loading: boolean
  error: string | null
  refetch: () => void
}

/**
 * Fetches the authenticated user's workspaces from `GET /api/workspaces` and
 * exposes the currently active one (the workspace the `wf_workspace` cookie
 * resolves to server-side; if that cookie is missing or stale the server
 * returns `activeWorkspaceId = null` and we fall back to the first membership).
 *
 * Single source of truth on purpose: the sidebar account menu, future workspace
 * switcher and any "you are currently in X" UI must read from one place so they
 * never disagree about which tenant is active. Components that need to react
 * to a workspace change (after a future `POST /api/workspaces/active`) call
 * `refetch` to re-sync.
 *
 * Defensive about API shape: `successResponse` wraps payloads in
 * `{ success: true, data: ... }`, but we also accept the bare-data shape so
 * the hook keeps working if the wrapper is removed in a future refactor.
 */
export function useActiveWorkspace(): UseActiveWorkspaceResult {
  const [workspaces, setWorkspaces] = useState<ActiveWorkspaceSummary[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/workspaces", { credentials: "include" })
      if (!res.ok) {
        if (res.status === 401) {
          setWorkspaces([])
          setActiveId(null)
          return
        }
        setError(`Failed to load workspaces (HTTP ${res.status})`)
        return
      }
      const json = await res.json()
      const payload = json?.data ?? json
      const list: ActiveWorkspaceSummary[] = Array.isArray(payload?.workspaces)
        ? payload.workspaces
        : []
      const active: string | null = typeof payload?.activeWorkspaceId === "string"
        ? payload.activeWorkspaceId
        : null
      setWorkspaces(list)
      setActiveId(active)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workspaces")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const workspace =
    (activeId ? workspaces.find((w) => w.id === activeId) : null) ?? workspaces[0] ?? null

  return { workspace, workspaces, loading, error, refetch: fetchData }
}
