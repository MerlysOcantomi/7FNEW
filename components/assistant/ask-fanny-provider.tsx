"use client"

import { createContext, useCallback, useContext, useMemo, useState } from "react"

/**
 * Inbox context the Ask Fanny panel needs to scope its question. Published by
 * the Inbox page (which owns the selection state) into the provider, so the
 * global-action-row trigger can open the SAME panel from the top toolbar — far
 * away from where the selection lives in the tree.
 *
 * Mirrors the props the legacy floating `TalkToFanny` received directly; nothing
 * about the /ask API or scope semantics changes.
 */
export interface AskFannyContext {
  conversationId: string | null
  selectedMessageId: string | null
  actingOnScope?: "latest" | "selected" | "all"
  latestInboundMessageId: string | null
}

/**
 * State + actions exposed by `AskFannyProvider`. Shaped after the sibling global
 * actions (Today / New / Agents): a low-level `setOpen` plus one-direction
 * helpers (`openAsk` / `closeAsk`) so mutual-exclusion call sites read clearly.
 *
 * `available` is `true` only inside a real provider, mirroring
 * `TodayDrawerProvider` so consumers in unknown territory (legacy mounts) can
 * stay no-op-safe instead of throwing.
 */
export interface AskFannyContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  openAsk: () => void
  closeAsk: () => void
  context: AskFannyContext
  setAskContext: (context: AskFannyContext) => void
  available: boolean
}

const EMPTY_CONTEXT: AskFannyContext = {
  conversationId: null,
  selectedMessageId: null,
  actingOnScope: undefined,
  latestInboundMessageId: null,
}

const noopContext: AskFannyContextValue = {
  open: false,
  setOpen: () => {},
  openAsk: () => {},
  closeAsk: () => {},
  context: EMPTY_CONTEXT,
  setAskContext: () => {},
  available: false,
}

const AskFannyContextObject = createContext<AskFannyContextValue>(noopContext)

export function useAskFanny(): AskFannyContextValue {
  return useContext(AskFannyContextObject)
}

export function AskFannyProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [context, setContext] = useState<AskFannyContext>(EMPTY_CONTEXT)

  const openAsk = useCallback(() => setOpen(true), [])
  const closeAsk = useCallback(() => setOpen(false), [])
  const setAskContext = useCallback((next: AskFannyContext) => setContext(next), [])

  const value = useMemo<AskFannyContextValue>(
    () => ({ open, setOpen, openAsk, closeAsk, context, setAskContext, available: true }),
    [open, openAsk, closeAsk, context, setAskContext],
  )

  return <AskFannyContextObject.Provider value={value}>{children}</AskFannyContextObject.Provider>
}
