"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { usePathname } from "next/navigation"
import { useActiveWorkspace } from "@/hooks/use-active-workspace"
import { useI18n } from "@/components/i18n-provider"
import {
  resolveFinessePageKey,
  type FinesseAssistantContext,
  type FinesseAssistantMessage,
  type FinesseAssistantPageContext,
  type FinesseAssistantStatus,
} from "@modules/assistant/finesse-assistant"

/**
 * Global Ask Finesse state — provider + page-context registration.
 *
 * Shaped after `AskFannyProvider` (noop default + `available` flag, memoized
 * value, one-direction helpers) but page-agnostic: ANY page in the Finesse
 * shell can publish a small serializable context via
 * `useRegisterFinesseAssistantContext`, and the far-away floating launcher
 * opens a panel scoped to it. Without an explicit registration the provider
 * still derives the page key from the route, so suggestions are always
 * page-aware.
 *
 * Isolation guarantees:
 *  - Page context is cleared on route change (stale context never leaks
 *    across pages) and on workspace change (conversation + context reset —
 *    no cross-workspace leakage; mission §29).
 *  - Nothing here is persisted: context and conversation are in-memory only.
 */

interface FinesseAssistantContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  openAssistant: () => void
  closeAssistant: () => void
  /** Registered page context (or null → derived from route only). */
  pageContext: FinesseAssistantPageContext | null
  registerPageContext: (context: FinesseAssistantPageContext | null) => void
  /** Full serializable context snapshot for the API call. */
  buildContext: () => FinesseAssistantContext
  messages: FinesseAssistantMessage[]
  status: FinesseAssistantStatus
  ask: (question: string) => Promise<void>
  available: boolean
}

const noopValue: FinesseAssistantContextValue = {
  open: false,
  setOpen: () => {},
  openAssistant: () => {},
  closeAssistant: () => {},
  pageContext: null,
  registerPageContext: () => {},
  buildContext: () => ({
    workspaceId: "",
    vertical: "",
    route: "/",
    page: "other",
  }),
  messages: [],
  status: "idle",
  ask: async () => {},
  available: false,
}

const FinesseAssistantReactContext = createContext<FinesseAssistantContextValue>(noopValue)

export function useFinesseAssistant(): FinesseAssistantContextValue {
  return useContext(FinesseAssistantReactContext)
}

/**
 * Pages contribute context through this hook without knowing how the panel is
 * rendered. Registers on mount / when the (serialized) context changes and
 * clears on unmount. Safe no-op outside the provider.
 */
export function useRegisterFinesseAssistantContext(
  context: FinesseAssistantPageContext | null,
): void {
  const { registerPageContext, available } = useFinesseAssistant()
  // Serialize so callers can pass fresh object literals without loops.
  const serialized = context ? JSON.stringify(context) : null

  useEffect(() => {
    if (!available) return
    registerPageContext(serialized ? (JSON.parse(serialized) as FinesseAssistantPageContext) : null)
    return () => registerPageContext(null)
  }, [available, registerPageContext, serialized])
}

let messageCounter = 0
function nextMessageId(): string {
  messageCounter += 1
  return `finesse-msg-${messageCounter}`
}

export function FinesseAssistantProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { workspace } = useActiveWorkspace()
  const { locale } = useI18n()

  const [open, setOpen] = useState(false)
  const [pageContext, setPageContext] = useState<FinesseAssistantPageContext | null>(null)
  const [messages, setMessages] = useState<FinesseAssistantMessage[]>([])
  const [status, setStatus] = useState<FinesseAssistantStatus>("idle")

  const workspaceId = workspace?.id ?? null
  const vertical = workspace?.verticalKey ?? ""

  // Route change → drop the registered context (the incoming page re-registers
  // its own). Keeps suggestions/scope honest while navigating with the panel
  // open.
  useEffect(() => {
    setPageContext(null)
  }, [pathname])

  // Workspace change → clear EVERYTHING (context + conversation). A thread
  // started in one workspace must never be visible from another.
  const lastWorkspaceRef = useRef<string | null>(workspaceId)
  useEffect(() => {
    if (lastWorkspaceRef.current !== workspaceId) {
      lastWorkspaceRef.current = workspaceId
      setPageContext(null)
      setMessages([])
      setStatus("idle")
    }
  }, [workspaceId])

  const openAssistant = useCallback(() => setOpen(true), [])
  const closeAssistant = useCallback(() => setOpen(false), [])
  const registerPageContext = useCallback(
    (context: FinesseAssistantPageContext | null) => setPageContext(context),
    [],
  )

  const buildContext = useCallback((): FinesseAssistantContext => {
    return {
      page: pageContext?.page ?? resolveFinessePageKey(pathname),
      ...pageContext,
      workspaceId: workspaceId ?? "",
      vertical,
      route: pathname,
      locale,
    }
  }, [pageContext, pathname, workspaceId, vertical, locale])

  const ask = useCallback(
    async (question: string) => {
      const trimmed = question.trim()
      if (!trimmed || status === "loading") return

      setMessages((prev) => [...prev, { id: nextMessageId(), role: "user", content: trimmed }])
      setStatus("loading")
      try {
        const res = await fetch("/api/assistant/finesse", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: trimmed, context: buildContext() }),
        })
        const json = await res.json().catch(() => null)

        if (res.status === 503) {
          setStatus("unavailable")
          return
        }
        const answer: unknown = json?.data?.answer ?? json?.answer
        if (!res.ok || typeof answer !== "string" || answer.trim().length === 0) {
          setStatus("error")
          return
        }
        setMessages((prev) => [
          ...prev,
          { id: nextMessageId(), role: "assistant", content: answer.trim() },
        ])
        setStatus("idle")
      } catch {
        setStatus("error")
      }
    },
    [buildContext, status],
  )

  const value = useMemo<FinesseAssistantContextValue>(
    () => ({
      open,
      setOpen,
      openAssistant,
      closeAssistant,
      pageContext,
      registerPageContext,
      buildContext,
      messages,
      status,
      ask,
      available: true,
    }),
    [open, openAssistant, closeAssistant, pageContext, registerPageContext, buildContext, messages, status, ask],
  )

  return (
    <FinesseAssistantReactContext.Provider value={value}>
      {children}
    </FinesseAssistantReactContext.Provider>
  )
}
