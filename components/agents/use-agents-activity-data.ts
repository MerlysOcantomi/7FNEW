"use client"

import { useMemo } from "react"
import { useFetch } from "@/hooks/use-fetch"
import type {
  AgentsActivityLanes,
  AgentsActivityPayload,
  AgentSummary,
} from "@modules/agents/types"

/**
 * Single source of truth for the compact Agents quick-view payload.
 *
 * Used by BOTH the desktop top chrome (`GlobalAgentsDesktopChrome`) and
 * the mobile vaul drawer (`AgentsMobileDrawer`) so the two surfaces never
 * disagree about what "agent activity" looks like and we only fire
 * `/api/agents/activity` once.
 *
 * Twin of `useTodayQuickData`: lazy by `enabled` so a globally-mounted
 * (but closed) panel never fetches. The `/api/agents/activity` route
 * enforces `requireReadAccess`, so the workspace scoping is server-side —
 * the hook carries no workspaceId. This reuses the SAME endpoint as the
 * full `/agents` board (`AgentsActivityBoard`), it does not introduce a
 * new query.
 */
export interface AgentsActivityDataResult {
  loading: boolean
  error: string | null
  agents: AgentSummary[]
  lanes: AgentsActivityLanes
  totalItems: number
  refetch: () => void
}

const EMPTY_LANES: AgentsActivityLanes = {
  automated: [],
  needs_review: [],
  executed: [],
  attention: [],
}

export function useAgentsActivityData(enabled: boolean): AgentsActivityDataResult {
  const url = enabled ? "/api/agents/activity" : null
  const { data, loading, error, refetch } = useFetch<AgentsActivityPayload>(url)

  const lanes = useMemo(() => data?.lanes ?? EMPTY_LANES, [data?.lanes])
  const agents = useMemo(() => data?.agents ?? [], [data?.agents])

  const totalItems = useMemo(
    () =>
      lanes.automated.length +
      lanes.needs_review.length +
      lanes.executed.length +
      lanes.attention.length,
    [lanes],
  )

  return { loading, error, agents, lanes, totalItems, refetch }
}
