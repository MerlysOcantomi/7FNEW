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

/** Parsed, already-validated payload of one `GET /api/workspaces` response. */
interface WorkspacesSnapshot {
  workspaces: ActiveWorkspaceSummary[]
  activeWorkspaceId: string | null
}

/**
 * Module-level snapshot cache + in-flight request dedupe.
 *
 * The app shell (and therefore the sidebar) is mounted PER PAGE, so every
 * client-side navigation unmounts and remounts every `useActiveWorkspace()`
 * caller. Without a cache each remount started from `workspace = null` and
 * re-fetched `/api/workspaces`, which made vertical-aware UI (e.g. the Beauty
 * sidebar) flash the default 7F Core nav on every click until the fetch
 * resolved. The cache lets remounts render the last known workspace
 * synchronously; the effect below still revalidates in the background so a
 * workspace switch in another tab is eventually picked up.
 *
 * `inflight` dedupes concurrent callers (sidebar, account menu, Today, …)
 * mounting in the same render pass into ONE network request.
 */
let workspacesCache: WorkspacesSnapshot | null = null
let inflightRequest: Promise<WorkspacesSnapshot> | null = null

async function requestWorkspaces(): Promise<WorkspacesSnapshot> {
  const res = await fetch("/api/workspaces", { credentials: "include" })
  if (!res.ok) {
    // Signed out: a real (empty) snapshot, not an error — the UI falls back
    // to its unauthenticated state instead of showing a failure message.
    if (res.status === 401) return { workspaces: [], activeWorkspaceId: null }
    throw new Error(`Failed to load workspaces (HTTP ${res.status})`)
  }
  const json = await res.json()
  // Defensive about API shape: `successResponse` wraps payloads in
  // `{ success: true, data: ... }`, but we also accept the bare-data shape so
  // the hook keeps working if the wrapper is removed in a future refactor.
  const payload = json?.data ?? json
  const workspaces: ActiveWorkspaceSummary[] = Array.isArray(payload?.workspaces)
    ? payload.workspaces
    : []
  const activeWorkspaceId: string | null =
    typeof payload?.activeWorkspaceId === "string" ? payload.activeWorkspaceId : null
  return { workspaces, activeWorkspaceId }
}

function fetchWorkspacesShared(): Promise<WorkspacesSnapshot> {
  if (!inflightRequest) {
    inflightRequest = requestWorkspaces()
      .then((snapshot) => {
        workspacesCache = snapshot
        return snapshot
      })
      .finally(() => {
        inflightRequest = null
      })
  }
  return inflightRequest
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
 * Loading contract: `loading` is `true` ONLY while there is no snapshot at all
 * (first load of the JS runtime). Once a snapshot exists, remounts render it
 * synchronously and revalidation happens silently — consumers can trust that
 * `loading === true` means "we genuinely don't know the workspace yet".
 */
export function useActiveWorkspace(): UseActiveWorkspaceResult {
  const [snapshot, setSnapshot] = useState<WorkspacesSnapshot | null>(workspacesCache)
  const [loading, setLoading] = useState(workspacesCache === null)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    // Only surface the loading state when there is nothing cached to render —
    // a background revalidation must never flash loading UI over live data.
    if (workspacesCache === null) setLoading(true)
    setError(null)
    try {
      setSnapshot(await fetchWorkspacesShared())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workspaces")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const workspaces = snapshot?.workspaces ?? []
  const activeId = snapshot?.activeWorkspaceId ?? null
  const workspace =
    (activeId ? workspaces.find((w) => w.id === activeId) : null) ?? workspaces[0] ?? null

  return { workspace, workspaces, loading, error, refetch: fetchData }
}
