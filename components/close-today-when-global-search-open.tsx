"use client"

import { useEffect } from "react"
import { useGlobalSearch } from "@/components/global-search-provider"
import { useTodayDrawer } from "@/components/today/today-drawer-provider"
import { useAgentsPanel } from "@/components/agents/agents-panel-provider"

/**
 * Closes the per-shell top panels (Today + Agents) when global Search
 * opens — the Search → top-panel half of mutual exclusion.
 *
 * Search is a layout-level provider (mounted in `app/layout.tsx`) and its
 * `openSearch` already closes the global New panel via `closeAll()`. But
 * Today and Agents are scoped to PER-SHELL providers that the
 * layout-level Search provider cannot see, so this bridge component —
 * mounted inside each shell, under both providers — watches `searchOpen`
 * and closes them. The reverse direction (opening Today/Agents closes
 * Search) is handled at those triggers via `closeSearch()`.
 */
export function CloseTodayWhenGlobalSearchOpen() {
  const { searchOpen } = useGlobalSearch()
  const { closeToday } = useTodayDrawer()
  const { closeAgents } = useAgentsPanel()

  useEffect(() => {
    if (searchOpen) {
      closeToday()
      closeAgents()
    }
  }, [searchOpen, closeToday, closeAgents])

  return null
}
