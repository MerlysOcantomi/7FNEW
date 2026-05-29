"use client"

import { createContext, useCallback, useContext, useMemo, useState } from "react"

/**
 * State + actions exposed by `AgentsPanelProvider`.
 *
 * Deliberate twin of `TodayDrawerProvider`: Agents is the fourth global
 * action surface (New / Today / Search / Agents) and reuses Today's
 * per-shell provider recipe so the desktop top-chrome panel and the
 * mobile vaul drawer can share one boolean without leaking state across
 * shells.
 *
 * `setOpen` is the low-level toggle (matches vaul's `onOpenChange`). The
 * convenience helpers `openAgents` / `closeAgents` make intent explicit
 * at call sites (a trigger only ever wants one direction) and let other
 * global triggers (New / Today) enforce mutual exclusion by calling
 * `closeAgents()` when they open.
 *
 * `available` is `true` only when consumed inside a real provider. It
 * lets triggers rendered in ambiguous positions (e.g. `MobileSidebarNav`,
 * which mounts both inside the shells AND above `LegacyTodayChrome` on
 * un-shelled legacy pages) fall back to a direct `/agents` navigation
 * instead of clicking a silently no-op button — exactly the Today rule.
 */
export interface AgentsPanelContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  openAgents: () => void
  closeAgents: () => void
  available: boolean
}

/**
 * No-op store used when a consumer renders outside of a provider. Mirrors
 * `TodayDrawerProvider`'s noop default so public / un-shelled routes can
 * still mount triggers safely — they just won't open anything, and
 * `available: false` signals the trigger to navigate to `/agents`.
 */
const noopContext: AgentsPanelContextValue = {
  open: false,
  setOpen: () => {},
  openAgents: () => {},
  closeAgents: () => {},
  available: false,
}

const AgentsPanelContext = createContext<AgentsPanelContextValue>(noopContext)

/**
 * Hook to read/control the Agents panel state. Returns the no-op store
 * outside a provider so it never throws at render time (keeps legacy
 * mounts renderable, identical to `useTodayDrawer`).
 */
export function useAgentsPanel(): AgentsPanelContextValue {
  return useContext(AgentsPanelContext)
}

/**
 * Provider that owns the Agents panel's `open` state for a given shell
 * subtree.
 *
 * Mounted per shell (`AppShell`, `ContextShell`) — at runtime exactly one
 * shell renders, so each provider naturally scopes the boolean to the
 * shell on screen. NOT mounted at `app/layout.tsx` (that would also wrap
 * public / customer-portal / `/system` routes with no Agents surface).
 *
 * Route-change / Escape / click-outside closing is handled by the
 * desktop chrome component (`GlobalAgentsDesktopChrome`), exactly like
 * `GlobalTodayDesktopChrome` — the provider stays a minimal state store.
 */
export function AgentsPanelProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  const openAgents = useCallback(() => setOpen(true), [])
  const closeAgents = useCallback(() => setOpen(false), [])

  const value = useMemo<AgentsPanelContextValue>(
    () => ({ open, setOpen, openAgents, closeAgents, available: true }),
    [open, openAgents, closeAgents],
  )

  return <AgentsPanelContext.Provider value={value}>{children}</AgentsPanelContext.Provider>
}
