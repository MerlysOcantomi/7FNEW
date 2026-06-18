"use client"

import { AgentsMobileDrawer } from "@/components/agents/agents-mobile-drawer"
import { useAgentsPanel } from "@/components/agents/agents-panel-provider"
import { useIsMobile } from "@/hooks/use-mobile"

/**
 * Mount point for the global Agents mobile surface — twin of
 * `GlobalTodayChrome`.
 *
 * Agents is split across two mounting sites, mirroring Today exactly:
 *
 *   1. `<GlobalAgentsDesktopChrome>` — mounted by the shells inside the
 *      same `sticky top-0` container as the New + Today panels. The
 *      canonical desktop surface; themed from the active theme's tokens
 *      (the `app` / `context` variant is structural only — no colour fork,
 *      matching `GlobalTodayDesktopChrome`).
 *
 *   2. This component — mounted as a sibling next to `<main>` by the
 *      shells. It owns ONLY the mobile vaul drawer
 *      (`<AgentsMobileDrawer>`), the single mobile Agents surface.
 *
 * Both consume the same `<AgentsPanelProvider>` so the open state stays
 * in one place per shell instance. Gating the mobile drawer on
 * `useIsMobile()` keeps the desktop chrome the only desktop surface.
 */
export function GlobalAgentsChrome() {
  const { open, setOpen } = useAgentsPanel()
  const isMobile = useIsMobile()

  return <AgentsMobileDrawer open={open && isMobile} onOpenChange={setOpen} />
}
