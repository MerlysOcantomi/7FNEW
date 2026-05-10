"use client"

import { createContext, useCallback, useContext, useMemo, useState } from "react"

/**
 * State + actions exposed by `TodayDrawerProvider`.
 *
 * `setOpen` is the low-level toggle and matches the shape vaul expects on
 * its `onOpenChange` callbacks, so the drawer can be wired directly. The
 * convenience helpers `openToday` / `closeToday` exist for call sites that
 * only need one direction (typically a button) — they make intent explicit
 * at the call site instead of every caller having to know the boolean.
 */
export interface TodayDrawerContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  openToday: () => void
  closeToday: () => void
}

/**
 * Default value used when a consumer renders outside of a provider. We
 * intentionally make this a NO-OP store instead of `null` + runtime throw
 * so legacy / public routes that aren't wrapped (login, customer portal,
 * /widget/chat) can still mount the chrome safely — they just won't be
 * able to open anything, which matches user expectations there.
 */
const noopContext: TodayDrawerContextValue = {
  open: false,
  setOpen: () => {},
  openToday: () => {},
  closeToday: () => {},
}

const TodayDrawerContext = createContext<TodayDrawerContextValue>(noopContext)

/**
 * Hook to read/control the Today drawer state.
 *
 * Returns the no-op store when called outside of a provider so it never
 * throws at render time; this keeps shells that haven't been migrated yet
 * (legacy direct-SidebarNav pages: Overview, Clients list, Projects list,
 * etc.) renderable while the migration is in progress.
 */
export function useTodayDrawer(): TodayDrawerContextValue {
  return useContext(TodayDrawerContext)
}

/**
 * Provider that owns the Today drawer's `open` state for a given shell
 * subtree.
 *
 * Each shell (`AppShell`, `ContextShell`) mounts its own provider on
 * purpose — at runtime exactly one shell is rendered, so each provider
 * naturally scopes the boolean to whichever shell is on screen. We do NOT
 * mount this at `app/layout.tsx` because that would also wrap public /
 * customer-portal / `/system` routes that have no business with the
 * workspace Today drawer.
 */
export function TodayDrawerProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  const openToday = useCallback(() => setOpen(true), [])
  const closeToday = useCallback(() => setOpen(false), [])

  /**
   * Memoise the context value so consumers that read only `open` (e.g. the
   * launcher) don't re-render every time a sibling re-renders the
   * provider. The dependency array intentionally includes `open` because
   * the value object exposes it directly.
   */
  const value = useMemo<TodayDrawerContextValue>(
    () => ({ open, setOpen, openToday, closeToday }),
    [open, openToday, closeToday],
  )

  return <TodayDrawerContext.Provider value={value}>{children}</TodayDrawerContext.Provider>
}
