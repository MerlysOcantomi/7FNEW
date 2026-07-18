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
  applyVoiceMessage,
  buildVoiceConversationSummary,
  markVoiceMessageInterrupted,
  resolveFinessePageKey,
  type FinesseAssistantContext,
  type FinesseAssistantMessage,
  type FinesseAssistantPageContext,
  type FinesseAssistantStatus,
  type VoiceMessageUpdate,
} from "@modules/assistant/finesse-assistant"
import {
  useFinesseVoiceController,
  type FinesseVoiceHandle,
} from "./finesse-voice-controller"

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
  /** Open the panel AND start a voice session (launcher hold-to-talk). */
  openAssistantWithVoice: () => void
  /** Registered page context (or null → derived from route only). */
  pageContext: FinesseAssistantPageContext | null
  registerPageContext: (context: FinesseAssistantPageContext | null) => void
  /** Full serializable context snapshot for the API call. */
  buildContext: () => FinesseAssistantContext
  messages: FinesseAssistantMessage[]
  status: FinesseAssistantStatus
  ask: (question: string) => Promise<void>
  /** Voice session handle — one per provider (see finesse-voice-controller). */
  voice: FinesseVoiceHandle
  available: boolean
}

const NOOP_VOICE: FinesseVoiceHandle = {
  state: "idle",
  errorKind: null,
  support: { voiceSupported: false, touchCapable: false, unsupportedReason: "no_media_devices" },
  entitled: false,
  everConnected: false,
  muted: false,
  active: false,
  start: async () => {},
  stop: () => {},
  interrupt: () => {},
  toggleMute: () => {},
}

const noopValue: FinesseAssistantContextValue = {
  open: false,
  setOpen: () => {},
  openAssistant: () => {},
  closeAssistant: () => {},
  openAssistantWithVoice: () => {},
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
  voice: NOOP_VOICE,
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
  const registerPageContext = useCallback(
    (context: FinesseAssistantPageContext | null) => setPageContext(context),
    [],
  )

  // ── Voice ↔ shared conversation glue ──────────────────────────────────────
  // Voice turns are keyed by Realtime item id, so a partial transcript is
  // REPLACED by its final text (never duplicated) and an interrupted answer
  // stays honestly marked. Finalized entries are immutable except for the
  // interruption mark.
  const upsertVoiceMessage = useCallback((update: VoiceMessageUpdate) => {
    setMessages((prev) => applyVoiceMessage(prev, update))
  }, [])

  const markAssistantInterrupted = useCallback((id: string) => {
    setMessages((prev) => markVoiceMessageInterrupted(prev, id))
  }, [])

  const messagesRef = useRef(messages)
  messagesRef.current = messages
  const buildConversationSummary = useCallback(
    (): string | null => buildVoiceConversationSummary(messagesRef.current),
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

  const voice = useFinesseVoiceController({
    buildContext,
    buildConversationSummary,
    upsertVoiceMessage,
    markAssistantInterrupted,
  })
  const voiceStop = voice.stop
  const voiceActive = voice.active
  const voiceStart = voice.start

  // Panel close stops the session (audio + billing) — mission §16/§21.
  const wrappedSetOpen = useCallback(
    (next: boolean) => {
      if (!next && voiceActive) voiceStop("user")
      setOpen(next)
    },
    [voiceActive, voiceStop],
  )
  const closeAssistantAndVoice = useCallback(() => wrappedSetOpen(false), [wrappedSetOpen])

  // Route change → a live session would keep STALE page instructions; stop it.
  const lastPathRef = useRef(pathname)
  useEffect(() => {
    if (lastPathRef.current !== pathname) {
      lastPathRef.current = pathname
      if (voiceActive) voiceStop("context")
    }
  }, [pathname, voiceActive, voiceStop])

  // Workspace change → stop immediately; a session must NEVER cross tenants.
  const lastVoiceWorkspaceRef = useRef<string | null>(workspaceId)
  useEffect(() => {
    if (lastVoiceWorkspaceRef.current !== workspaceId) {
      lastVoiceWorkspaceRef.current = workspaceId
      voiceStop("teardown")
    }
  }, [workspaceId, voiceStop])

  // Launcher hold-to-talk: open the panel and start voice in one gesture.
  const openAssistantWithVoice = useCallback(() => {
    setOpen(true)
    void voiceStart()
  }, [voiceStart])

  const value = useMemo<FinesseAssistantContextValue>(
    () => ({
      open,
      setOpen: wrappedSetOpen,
      openAssistant,
      closeAssistant: closeAssistantAndVoice,
      openAssistantWithVoice,
      pageContext,
      registerPageContext,
      buildContext,
      messages,
      status,
      ask,
      voice,
      available: true,
    }),
    [open, wrappedSetOpen, openAssistant, closeAssistantAndVoice, openAssistantWithVoice, pageContext, registerPageContext, buildContext, messages, status, ask, voice],
  )

  return (
    <FinesseAssistantReactContext.Provider value={value}>
      {children}
    </FinesseAssistantReactContext.Provider>
  )
}
