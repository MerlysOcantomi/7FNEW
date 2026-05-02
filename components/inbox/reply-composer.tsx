"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import {
  Send, Loader2, Mic, MicOff, Paperclip, ChevronDown, ChevronUp,
  Mail, Languages, X, FileText, Forward, Reply, ReplyAll, StickyNote,
  Sparkles, CheckCheck, AlignLeft, Briefcase, Heart, ArrowRight,
  MapPin, Calendar, Link, User, Image, Globe, LayoutTemplate,
  Receipt, CreditCard, RotateCcw, Keyboard, Wand2,
  Archive, ArchiveRestore, CheckCircle2, Trash2, MoreHorizontal,
  MailOpen, AlertCircle, Target, Layers, MailCheck, ListPlus,
  type LucideIcon,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { useSpeechRecognition } from "@/hooks/use-speech-recognition"
import { useCannedResponses, type CannedResponse } from "@/hooks/use-canned-responses"

export interface ComposerAttachment {
  url: string
  filename: string
  contentType: string
  size: number
}

/** Phase 2: información compacta del mensaje al que se está respondiendo (badge sobre el composer). */
export interface ReplyTargetInfo {
  messageId: string
  authorLabel: string
  timestampLabel?: string | null
  snippet?: string | null
  /**
   * Phase B: signals derivados client-side en `app/inbox/page.tsx`. El composer NO los renderiza,
   * pero el shape se comparte con `SelectedMessageInfo` del ContextPanel para evitar split de tipos.
   * Mantener todos opcionales para no romper callers existentes.
   */
  shortIntent?: string | null
  direction?: string | null
  hasAttachments?: boolean
  hasLinks?: boolean
  isInbound?: boolean
  isOutbound?: boolean
}

/** Phase 4: agrupa los handlers conversation-level que se renderizan como strip "Conversation actions". */
export interface ConversationActionsApi {
  onArchive?: () => void
  onClose?: () => void
  onTrash?: () => void
  /**
   * Mark conversation as resolved. Distinct from `onClose`: resolved means the work is done
   * but the thread stays active for follow-ups. The button is hidden when omitted; auto-disabled
   * when `currentStatus === "resolved"`.
   */
  onMarkResolved?: () => void
  /**
   * Reverse-state handlers: each one is shown *in place of* the matching forward action when
   * the conversation is currently in that terminal/done state. Keeping them on the same
   * `ConversationActionsApi` (instead of a sibling object) lets the composer just look at
   * `currentStatus` and pick the right pair without extra plumbing.
   *  - onRestoreFromTrash → flips `trashed` back to an active status.
   *  - onUnarchive       → flips `archived` back to active.
   *  - onReopen          → flips `closed` back to active.
   *  - onMarkNeedsAction → flips `resolved` back to active (the inverse of onMarkResolved).
   * Each is optional so callers that don't wire reversibility yet keep working.
   */
  onRestoreFromTrash?: () => void
  onUnarchive?: () => void
  onReopen?: () => void
  onMarkNeedsAction?: () => void
  /** Status actual de la conversación; deshabilita el botón equivalente. */
  currentStatus?: string | null
}

/**
 * Scope-aware message-level actions for the More menu when Acting on is "latest" or "selected".
 * The page resolves which message id applies (latest inbound vs selected) before calling the
 * handler — the composer never decides scope on its own here.
 */
export interface MessageActionsApi {
  /** Toggle the message intent done/open. The composer receives the *current* intentStatus
   *  to render an "is current" / disabled state without an extra fetch. */
  onMarkDone?: () => void
  /** Quick-add an internal note about the scoped message (latest/selected). The composer
   *  delegates to the parent because the parent owns composer state (replyIsInternal, focus). */
  onAddInternalNote?: () => void
  /** Current intentStatus of the scoped message ("done" | "open" | undefined). */
  intentStatus?: "done" | "open" | null
  /**
   * Soft-trash the scoped message (sets `Message.metadata.trashedAt`). The page resolves which
   * messageId is affected based on Acting on scope and ensures the target is always a
   * non-trashed message — Restore lives inline inside the bubble itself, not in this panel.
   * Optional — if the parent doesn't pass it, the entry simply isn't rendered.
   */
  onTrashMessage?: () => void
  /**
   * Phase 3 To-do capture — turn the scoped message (latest or selected) into an `InboxTodo`.
   * The page derives `title`/`description`/`priority` from the resolved message before the
   * `POST /api/inbox/todos` call, so the composer just owns the click. Optional — when omitted
   * the entry is hidden so partial wiring (e.g. legacy callers) keeps working.
   */
  onAddToTodo?: () => void
  /** True when no usable message id can be resolved for the current scope (e.g. empty thread).
   *  When true, the composer hides the message-level actions panel entirely. */
  unavailable?: boolean
}

export type EmailSendMode = "reply" | "reply_all" | "forward"

type VoiceMode = "dictate" | "compose"

type AssistAction = "proofread" | "shorter" | "clearer" | "professional" | "warmer" | "direct" | "translate" | "compose_from_intent"

interface ReplyComposerProps {
  channel: string
  channelLabel: string
  /** Sesión actual (Google, etc.) — no confundir con la dirección "From" del canal SMTP. */
  signedInEmail?: string | null
  subject?: string | null
  detectedLanguage?: string | null
  replyContent: string
  replyIsInternal: boolean
  replySending: boolean
  replyStatus: string | null
  cannedOpen: boolean
  composerTextareaRef: React.RefObject<HTMLTextAreaElement | null>
  attachments: ComposerAttachment[]
  attachmentUploading: boolean
  emailMode: EmailSendMode
  emailCc: string
  emailBcc: string
  emailForwardTo: string
  onEmailModeChange: (mode: EmailSendMode) => void
  onEmailCcChange: (value: string) => void
  onEmailBccChange: (value: string) => void
  onEmailForwardToChange: (value: string) => void
  onReplyModeChange: (isInternal: boolean) => void
  onReplyContentChange: (value: string) => void
  onCannedOpenChange: (open: boolean) => void
  onAttachFiles: (files: File[]) => void
  onRemoveAttachment: (url: string) => void
  onSend: () => void
  /** Phase 2: cuando está presente, la respuesta se asocia a este mensaje (sourceMessageId). */
  replyTarget?: ReplyTargetInfo | null
  /** Limpia la selección por-mensaje desde el composer (badge X / "Reply to whole conversation"). */
  onClearReplyTarget?: () => void
  /**
   * Phase 4: cuando NO hay `replyTarget`, este preview describe el "último mensaje relevante" que
   * recibirá la acción message-level (sourceMessageId del envío). Se muestra como badge sutil
   * "Replying to latest message" — no es clearable porque representa el comportamiento por defecto.
   */
  latestActionAnchor?: ReplyTargetInfo | null
  /** Phase 4: handlers conversation-level para el strip "Conversation actions" sobre el composer. */
  conversationActions?: ConversationActionsApi
  /**
   * Scope-aware message-level actions surfaced inside the More panel when Acting on is set
   * to "latest" or "selected". Optional — when omitted the More panel only shows the
   * conversation-level actions (legacy behaviour).
   */
  messageActions?: MessageActionsApi
  /** Fanny suggested reply — panel desde la barra; solo vuelca texto al compositor (no envía). */
  fannySuggestionTitle?: string | null
  fannySuggestionContent?: string | null
  onApplyFannySuggestion?: (content: string) => void
  /**
   * Acting on scope (controla qué mensaje/contexto usan los tools del composer).
   * Ortogonal a `selectedMessageId`: el highlight no se pierde al cambiar scope.
   */
  actingOnScope?: "latest" | "selected" | "all"
  onActingOnScopeChange?: (scope: "latest" | "selected" | "all") => void
  /** Indica si hay un mensaje seleccionado disponible para usar el scope "selected". */
  hasSelectedMessage?: boolean
  /**
   * Phase 3 receipt confirmation toggle. The composer is presentational here: state is owned
   * by the parent inbox page (so the flag persists across re-renders and resets cleanly after
   * send). Email channel only — non-email channels render the action disabled with a tooltip.
   */
  requestConfirmation?: boolean
  onRequestConfirmationChange?: (next: boolean) => void
}

const TRANSLATE_LANGUAGES = [
  { code: "English", label: "English" },
  { code: "Spanish", label: "Español" },
  { code: "German", label: "Deutsch" },
  { code: "French", label: "Français" },
  { code: "Portuguese", label: "Português" },
] as const

const TEXTAREA_MIN_PX = 52
const TEXTAREA_MAX_PX = 220

/** Hover + activo alineados con `sidebar-nav` (NavLink): muted → texto shell */
const SHELL_TOOLBAR_ICON =
  "rounded-[8px] p-1.5 text-[var(--app-sidebar-text-muted)] transition-all duration-150 hover:bg-[var(--app-sidebar-surface)]/60 hover:text-[var(--app-sidebar-text)]"
/**
 * Activo = ítem Inbox en sidebar: 1px exterior + halo (misma sombra compuesta que NavLinkWithSubitems) + pastilla izquierda.
 */
const SHELL_TOOLBAR_ICON_ACTIVE =
  "relative bg-[var(--app-sidebar-surface)] text-[var(--app-accent)] shadow-[0_0_0_1px_var(--app-accent),0_0_10px_0_rgba(99,102,241,0.22)] before:pointer-events-none before:absolute before:left-px before:top-1/2 before:z-10 before:-translate-y-1/2 before:w-0.5 before:h-3.5 before:rounded-r-full before:bg-[var(--app-accent)]"

const SMART_TOOLS: Array<{ action: AssistAction; label: string; icon: typeof Sparkles; needsText: boolean }> = [
  { action: "proofread", label: "Proofread", icon: CheckCheck, needsText: true },
  { action: "shorter", label: "Shorter", icon: AlignLeft, needsText: true },
  { action: "clearer", label: "Clearer", icon: Sparkles, needsText: true },
  { action: "professional", label: "Professional", icon: Briefcase, needsText: true },
  { action: "warmer", label: "Warmer", icon: Heart, needsText: true },
  { action: "direct", label: "Direct", icon: ArrowRight, needsText: true },
]

export function ReplyComposer({
  channel,
  channelLabel,
  signedInEmail,
  subject,
  detectedLanguage,
  replyContent,
  replyIsInternal,
  replySending,
  replyStatus,
  cannedOpen,
  composerTextareaRef,
  attachments,
  attachmentUploading,
  emailMode,
  emailCc,
  emailBcc,
  emailForwardTo,
  onEmailModeChange,
  onEmailCcChange,
  onEmailBccChange,
  onEmailForwardToChange,
  onReplyModeChange,
  onReplyContentChange,
  onCannedOpenChange,
  onAttachFiles,
  onRemoveAttachment,
  onSend,
  replyTarget,
  onClearReplyTarget,
  latestActionAnchor,
  conversationActions,
  messageActions,
  fannySuggestionTitle,
  fannySuggestionContent,
  onApplyFannySuggestion,
  actingOnScope = "latest",
  onActingOnScopeChange,
  hasSelectedMessage = false,
  requestConfirmation = false,
  onRequestConfirmationChange,
}: ReplyComposerProps) {
  const speech = useSpeechRecognition()
  const baseTextRef = useRef("")
  const userInterruptedRef = useRef(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [voiceMode, setVoiceMode] = useState<VoiceMode>("dictate")
  /** Solo un grupo (email vs voz) puede llevar el chrome activo de la barra; por defecto gana email (Reply). */
  const [voiceToolbarFocus, setVoiceToolbarFocus] = useState(false)
  const [assistLoading, setAssistLoading] = useState<AssistAction | null>(null)
  const [assistError, setAssistError] = useState<string | null>(null)
  const [contentBeforeAssist, setContentBeforeAssist] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const composingIntentRef = useRef(false)
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onReplyContentChangeRef = useRef(onReplyContentChange)
  onReplyContentChangeRef.current = onReplyContentChange

  const { items: cannedResponses } = useCannedResponses()
  const composerConfig = getComposerConfig({ channel, channelLabel, replyIsInternal, detectedLanguage, subject })

  const hasText = replyContent.trim().length > 0
  const isProcessing = assistLoading !== null

  /**
   * Phase 1 toolbox: el mismo `<input type="file">` se reutiliza para File / Image / Document
   * mutando su `accept` antes de abrirlo. Evita duplicar inputs ocultos y mantiene el pipeline
   * existente (`onAttachFiles` → `/api/inbox/attachments/upload`).
   */
  function openFilePicker(accept: string) {
    if (!fileInputRef.current) return
    fileInputRef.current.accept = accept
    fileInputRef.current.click()
    setClipPanelOpen(false)
  }

  /** Phase 1 toolbox: Link insert es puramente client-side; no toca backend. */
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState("")
  const [linkLabel, setLinkLabel] = useState("")

  /**
   * Conversation-level "More" menu (Archive / Close / Move to Trash). Antes era un strip ancho
   * sobre el composer; ahora vive como icono en la toolbar para liberar espacio vertical.
   */
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)

  /** Acting on panel: scope picker (Latest / Selected / All). */
  const [actingOnPanelOpen, setActingOnPanelOpen] = useState(false)
  const actingOnScopeMeta: Record<"latest" | "selected" | "all", { label: string; icon: LucideIcon; description: string }> = {
    latest: {
      label: "Latest",
      icon: Reply,
      description: "Use the most recent relevant message.",
    },
    selected: {
      label: "Selected",
      icon: Target,
      description: hasSelectedMessage
        ? "Use the message you selected in the thread."
        : "Select a message in the thread first.",
    },
    all: {
      label: "All",
      icon: Layers,
      description: "Use the whole conversation as context.",
    },
  }
  const currentActingOnLabel = actingOnScopeMeta[actingOnScope].label

  /**
   * Assist panel layout: mismo patrón que el toolbox (tabs en barra negra + contenido de la activa).
   * Consolida bajo el icono Wand2 todas las herramientas AI/text que antes vivían como iconos
   * separados en la toolbar (Snippets, Fanny suggestion, Dictate, Intent compose). El Mic y el
   * Attach quedan fuera (alta frecuencia + semántica distinta).
   */
  type AssistTabId = "improve" | "translate" | "templates" | "suggestions" | "voice"
  const [activeAssistTab, setActiveAssistTab] = useState<AssistTabId>("improve")
  const [templateQuery, setTemplateQuery] = useState("")

  /**
   * Toolbox layout v2: en lugar de mostrar todas las categorías en columnas estrechas
   * (que hacía wrap roto en "Scree/n", "Propo/sal", etc.), las categorías son tabs y
   * solo se renderizan las acciones de la activa. Default: "attach".
   */
  type ClipCategoryId = "attach" | "workspace" | "show" | "generate" | "share"
  const [activeClipCategory, setActiveClipCategory] = useState<ClipCategoryId>("attach")
  const clipCategoryTabs: Array<{ id: ClipCategoryId; label: string }> = [
    { id: "attach", label: "Attach" },
    { id: "workspace", label: "From workspace" },
    { id: "show", label: "Show" },
    { id: "generate", label: "Generate" },
    { id: "share", label: "Share / Schedule" },
  ]

  function insertLinkAtCursor() {
    const trimmedUrl = linkUrl.trim()
    if (!trimmedUrl) return
    const trimmedLabel = linkLabel.trim()
    const snippet = trimmedLabel ? `[${trimmedLabel}](${trimmedUrl})` : trimmedUrl
    const textarea = composerTextareaRef.current
    const current = replyContent ?? ""
    if (!textarea) {
      onReplyContentChange(current ? `${current}\n${snippet}` : snippet)
    } else {
      const start = textarea.selectionStart ?? current.length
      const end = textarea.selectionEnd ?? current.length
      const next = current.slice(0, start) + snippet + current.slice(end)
      onReplyContentChange(next)
      requestAnimationFrame(() => {
        const caret = start + snippet.length
        textarea.focus()
        textarea.setSelectionRange(caret, caret)
      })
    }
    setLinkUrl("")
    setLinkLabel("")
    setLinkPopoverOpen(false)
    setClipPanelOpen(false)
  }

  function showAssistError(msg: string) {
    setAssistError(msg)
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
    errorTimerRef.current = setTimeout(() => setAssistError(null), 6000)
  }

  function handleInsertCanned(item: CannedResponse) {
    if (speech.listening) {
      userInterruptedRef.current = true
      speech.stop()
    }
    const current = replyContent.trimEnd()
    const separator = current ? "\n\n" : ""
    onReplyContentChange(current + separator + item.content)
    onCannedOpenChange(false)
  }

  /**
   * Inicia el reconocimiento de voz con un modo específico (sin depender del state). Usado por
   * el tab "Voice" del AI panel — antes solo cambiaba el modo y exigía pulsar luego el Mic
   * standalone del toolbar; ese Mic se removió, así que ahora el tab arranca el speech directo.
   */
  function startVoice(mode: VoiceMode) {
    if (speech.listening) speech.stop()
    setVoiceMode(mode)
    setVoiceToolbarFocus(true)
    userInterruptedRef.current = false
    composingIntentRef.current = mode === "compose"
    baseTextRef.current = mode === "compose" ? "" : replyContent
    speech.start()
  }

  function handleTextareaChange(value: string) {
    if (speech.listening) {
      userInterruptedRef.current = true
      speech.stop()
    }
    onReplyContentChange(value)
  }

  function handleSend() {
    if (speech.listening) {
      userInterruptedRef.current = true
      speech.stop()
    }
    baseTextRef.current = ""
    setContentBeforeAssist(null)
    onSend()
  }

  async function handleAssist(action: AssistAction, text?: string) {
    const input = text ?? replyContent.trim()
    if (!input) return

    const savedContent = replyContent
    setAssistLoading(action)
    setAssistError(null)

    if (action !== "compose_from_intent") {
      setContentBeforeAssist(savedContent)
    }

    try {
      const res = await fetch("/api/inbox/composer/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          text: input,
          detectedLanguage: detectedLanguage ?? undefined,
        }),
      })
      const json = await res.json()

      if (json.success && json.data?.result) {
        if (json.data.skipped) return
        if (action === "compose_from_intent") {
          setContentBeforeAssist(savedContent)
        }
        onReplyContentChange(json.data.result)
      } else {
        const errorMsg = json.error?.message || "Could not process your request"
        showAssistError(errorMsg)
        if (action === "compose_from_intent") {
          onReplyContentChange(input)
          setContentBeforeAssist(null)
        }
      }
    } catch {
      showAssistError("Connection error — your text was not changed")
      if (action === "compose_from_intent") {
        onReplyContentChange(input)
        setContentBeforeAssist(null)
      }
    } finally {
      setAssistLoading(null)
    }
  }

  async function handleTranslate(targetLang: string) {
    if (!replyContent.trim()) return

    const savedContent = replyContent
    setAssistLoading("translate")
    setAssistError(null)
    setContentBeforeAssist(savedContent)

    try {
      const res = await fetch("/api/inbox/composer/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "translate",
          text: replyContent.trim(),
          targetLanguage: targetLang,
          detectedLanguage: detectedLanguage ?? undefined,
        }),
      })
      const json = await res.json()

      if (json.success && json.data?.result && !json.data.skipped) {
        onReplyContentChange(json.data.result)
      } else {
        const errorMsg = json.error?.message || "Could not translate"
        showAssistError(errorMsg)
      }
    } catch {
      showAssistError("Connection error — translation failed")
    } finally {
      setAssistLoading(null)
    }
  }

  function handleUndoAssist() {
    if (contentBeforeAssist === null) return
    onReplyContentChange(contentBeforeAssist)
    setContentBeforeAssist(null)
  }

  function focusComposerWithScroll() {
    // Focus textarea
    setTimeout(() => composerTextareaRef.current?.focus(), 100);
    
    // Scroll to composer smoothly (like WhatsApp)
    setTimeout(() => {
      const composerElement = composerTextareaRef.current?.closest('[data-composer="true"]') || 
                             composerTextareaRef.current;
      if (composerElement) {
        composerElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }
    }, 150);
  }

  // Dictation: append transcript to content in real time
  useEffect(() => {
    if (!speech.listening || !speech.transcript || composingIntentRef.current) return
    const separator = baseTextRef.current && !baseTextRef.current.endsWith(" ") ? " " : ""
    onReplyContentChange(baseTextRef.current + separator + speech.transcript)
  }, [speech.transcript, speech.listening, onReplyContentChange])

  // On stop: finalize dictation or trigger compose-from-intent
  useEffect(() => {
    if (speech.listening || !speech.transcript) return

    if (composingIntentRef.current) {
      composingIntentRef.current = false
      const intentText = speech.transcript
      speech.reset()

      if (intentText.trim().length < 3) {
        showAssistError("Voice input too short — try describing your intent more clearly")
        return
      }

      handleAssist("compose_from_intent", intentText)
      return
    }

    const separator = baseTextRef.current && !baseTextRef.current.endsWith(" ") ? " " : ""
    const finalText = baseTextRef.current + separator + speech.transcript
    baseTextRef.current = finalText
    if (!userInterruptedRef.current) {
      onReplyContentChangeRef.current(finalText)
    }
    userInterruptedRef.current = false
    speech.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- event-driven: only fires when listening stops, reads transcript at that moment
  }, [speech.listening])

  const [clipPanelOpen, setClipPanelOpen] = useState(false)
  const [assistPanelOpen, setAssistPanelOpen] = useState(false)
  const [fannyEditBuffer, setFannyEditBuffer] = useState("")

  const hasFannySuggestion = Boolean(onApplyFannySuggestion && fannySuggestionContent?.trim())

  /**
   * Seed the Fanny edit buffer when the operator switches to the "suggestions" tab inside the
   * AI panel. Antes existía un panel separado controlado por `fannyPanelOpen`; tras consolidar
   * todo bajo Wand2, el activeAssistTab gobierna cuándo refrescar el draft editable.
   */
  useEffect(() => {
    if (
      assistPanelOpen
      && activeAssistTab === "suggestions"
      && typeof fannySuggestionContent === "string"
    ) {
      setFannyEditBuffer(fannySuggestionContent)
    }
  }, [assistPanelOpen, activeAssistTab, fannySuggestionContent])

  /**
   * Receipt confirmation is email-only. If the active channel is anything else (WhatsApp, web
   * chat, …) we clear the flag silently so we don't carry it over from a previous conversation.
   */
  useEffect(() => {
    if (channel !== "email" && requestConfirmation && onRequestConfirmationChange) {
      onRequestConfirmationChange(false)
    }
  }, [channel, requestConfirmation, onRequestConfirmationChange])

  useLayoutEffect(() => {
    const el = composerTextareaRef.current
    if (!el) return
    el.style.height = "auto"
    const h = Math.min(Math.max(el.scrollHeight, TEXTAREA_MIN_PX), TEXTAREA_MAX_PX)
    el.style.height = `${h}px`
  }, [replyContent, composerTextareaRef])

  useEffect(() => {
    if (isProcessing) {
      setAssistPanelOpen(false)
    }
  }, [isProcessing])

  const closePanelBlocks = useCallback(() => {
    setClipPanelOpen(false)
    setAssistPanelOpen(false)
    setMoreMenuOpen(false)
    setActingOnPanelOpen(false)
  }, [])

  const closeComposerOverlays = useCallback(() => {
    closePanelBlocks()
    onCannedOpenChange(false)
  }, [closePanelBlocks, onCannedOpenChange])

  const showEmailOptions = !replyIsInternal && channel === "email"

  const sendActionLabel = replyIsInternal
    ? "Save note"
    : emailMode === "forward"
      ? "Forward"
      : emailMode === "reply_all"
        ? "Reply all"
        : composerConfig.sendLabel

  /** Phase 4: handlers conversation-level (Archive / Close / Move to Trash). */
  const archiveHandler = conversationActions?.onArchive
  const closeHandler = conversationActions?.onClose
  const trashHandler = conversationActions?.onTrash
  const markResolvedHandler = conversationActions?.onMarkResolved
  /**
   * Reverse handlers — each one is paired with its forward counterpart and rendered in place
   * when `currentStatus` matches. Reading them as locals keeps the JSX further down compact
   * and lets us include them in the `hasConversationActions` gate.
   */
  const restoreFromTrashHandler = conversationActions?.onRestoreFromTrash
  const unarchiveHandler = conversationActions?.onUnarchive
  const reopenHandler = conversationActions?.onReopen
  const markNeedsActionHandler = conversationActions?.onMarkNeedsAction
  const currentConversationStatus = conversationActions?.currentStatus ?? null
  const hasConversationActions = Boolean(
    archiveHandler
    || closeHandler
    || trashHandler
    || markResolvedHandler
    || restoreFromTrashHandler
    || unarchiveHandler
    || reopenHandler
    || markNeedsActionHandler,
  )

  /**
   * More panel composition — both groups are *additive*, not mutually exclusive:
   *  - Conversation actions (Mark resolved + Archive / Close / Trash) always render when at
   *    least one handler is wired, regardless of Acting on scope. Closing/archiving/trashing
   *    a thread is a conversation-level decision the operator should never have to "leave"
   *    a message scope to perform.
   *  - Message actions (Mark done + Add internal note) render *additionally* when scope is
   *    Latest or Selected and the parent reports the scope is usable. For "selected" we still
   *    require `hasSelectedMessage`; otherwise the message section silently disappears so the
   *    panel doesn't dangle a button with no target.
   *
   * The panel order is "Message → Conversation" so the most scope-relevant actions are at
   * the top under Latest/Selected, while Conversation actions remain a stable footer.
   */
  const moreMessageActionsAvailable = Boolean(
    messageActions
    && !messageActions.unavailable
    && (messageActions.onMarkDone || messageActions.onAddInternalNote || messageActions.onTrashMessage || messageActions.onAddToTodo)
    && (actingOnScope !== "selected" || hasSelectedMessage),
  )
  const showMoreMessagePanel = actingOnScope !== "all" && moreMessageActionsAvailable
  const showMoreConversationPanel = hasConversationActions
  const morePanelHasContent = showMoreMessagePanel || showMoreConversationPanel

  /** Un solo icono con chrome “activo”: overlay (paneles/snippets) o mic grabando tienen prioridad sobre modo email/voz */
  const composerOverlayOpen =
    clipPanelOpen || assistPanelOpen || moreMenuOpen || actingOnPanelOpen
  const micCapturesChrome = speech.listening
  const showEmailModeChrome = !composerOverlayOpen && !micCapturesChrome
  const emailToolActive = showEmailModeChrome && !replyIsInternal && !voiceToolbarFocus

  /**
   * Assist tabs: dinámicos según capacidades disponibles. El icono `Wand2` siempre es visible y
   * abre este panel — los tabs internos se adaptan al estado (no hay snippets si el workspace
   * no tiene canned responses, no hay Fanny tab si no hay sugerencia, no hay Voice tab si el
   * navegador no soporta speech recognition).
   */
  const assistTabs: Array<{ id: AssistTabId; label: string }> = [
    { id: "improve", label: "Improve" },
    { id: "translate", label: "Translate" },
    ...(cannedResponses.length > 0 ? [{ id: "templates" as const, label: "Templates" }] : []),
    ...(hasFannySuggestion ? [{ id: "suggestions" as const, label: "Fanny" }] : []),
    ...(speech.supported ? [{ id: "voice" as const, label: "Voice" }] : []),
  ]
  /** Si el tab activo deja de existir (p. ej. Fanny pierde sugerencia), volvemos a "improve". */
  useEffect(() => {
    if (!assistTabs.some((t) => t.id === activeAssistTab)) {
      setActiveAssistTab("improve")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- assistTabs is derived; only re-check when its inputs flip
  }, [cannedResponses.length, hasFannySuggestion, speech.supported])

  return (
    <div className="shrink-0 border-t border-[var(--inbox-divider)]/60 bg-[var(--inbox-chat-background)] px-3 py-1 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] md:px-5" data-composer="true">
      <div className="space-y-0.5 rounded-lg border border-[var(--inbox-border)]/30 bg-[var(--inbox-composer-background)]/70 p-1 shadow-none md:p-1.5">
        {/*
         * Composer header: signed-in account (when present) on the left, dynamic channel badge
         * on the right. The badge replaces the channelLabel that used to live inside the toolbar
         * row, freeing horizontal space and keeping channel info contextual rather than as a
         * tool. Always rendered when we have at least one piece of metadata (account or channel).
         */}
        {(signedInEmail?.trim() || channel) && (
          <div className="flex items-center justify-between gap-2 px-1.5 pb-0.5">
            {signedInEmail?.trim() ? (
              <p className="min-w-0 truncate text-[10px] leading-tight text-[var(--inbox-text-secondary)]">
                Signed in as{" "}
                <span className="font-medium text-[var(--inbox-text)]" title={signedInEmail}>
                  {signedInEmail}
                </span>
              </p>
            ) : (
              <span aria-hidden="true" />
            )}
            <div className="flex shrink-0 items-center gap-1.5">
              {/* Phase 3: confirmation-requested pill. Email-only; click clears the request. */}
              {channel === "email" && requestConfirmation && (
                <button
                  type="button"
                  onClick={() => onRequestConfirmationChange?.(false)}
                  title="Confirmation requested — click to remove"
                  aria-label="Confirmation requested. Click to remove."
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--inbox-accent)]/45 bg-[var(--inbox-accent)]/12 px-2 py-0.5 text-[10px] font-medium text-[var(--inbox-accent)] transition-colors hover:bg-[var(--inbox-accent)]/20"
                >
                  <MailCheck className="h-3 w-3" aria-hidden />
                  Confirmation requested
                  <X className="h-2.5 w-2.5 opacity-70" aria-hidden />
                </button>
              )}
              {channel ? (
                <span
                  className="inline-flex items-center rounded-full border border-[var(--inbox-border)]/45 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-[var(--inbox-text-secondary)]"
                  title={`Channel: ${formatChannelBadge(channel, channelLabel)}`}
                  aria-label={`Channel: ${formatChannelBadge(channel, channelLabel)}`}
                >
                  {formatChannelBadge(channel, channelLabel)}
                </span>
              ) : null}
            </div>
          </div>
        )}

        {/* ── Internal note banner (privacy reminder) ── */}
        {replyIsInternal && (
          <div className="flex items-center gap-1.5 rounded border border-[var(--inbox-warning)]/35 bg-[var(--inbox-warning)]/10 px-2 py-1">
            <StickyNote className="h-3 w-3 shrink-0 text-[var(--inbox-warning)]" aria-hidden />
            <span className="text-[10px] font-medium leading-tight text-[var(--inbox-warning)]">
              Internal note — private to your team. Not sent to the customer.
            </span>
          </div>
        )}

        {/* ── Email metadata (franja mínima) ── */}
        {showEmailOptions && (
          <div className="space-y-0.5 rounded border border-[var(--inbox-border)]/20 bg-transparent px-1.5 py-0.5">
            {composerConfig.subjectPreview && (
              <div className="flex min-h-[1.125rem] items-center gap-1">
                <Mail className="h-2 w-2 shrink-0 opacity-50 text-[var(--inbox-chat-text-secondary)]" aria-hidden />
                <span className="shrink-0 text-[8px] font-semibold uppercase tracking-wider text-[var(--inbox-chat-text-secondary)]">
                  Subject
                </span>
                <span className="min-w-0 truncate text-[10px] leading-tight text-[var(--inbox-text-secondary)]">
                  {composerConfig.subjectPreview}
                </span>
              </div>
            )}
            {emailMode === "forward" && (
              <div className="flex min-h-[1.125rem] items-center gap-1">
                <Forward className="h-2 w-2 shrink-0 opacity-50 text-[var(--inbox-chat-text-secondary)]" aria-hidden />
                <span className="shrink-0 text-[8px] font-semibold uppercase tracking-wider text-[var(--inbox-chat-text-secondary)]">
                  To
                </span>
                <Input
                  type="text"
                  value={emailForwardTo}
                  onChange={(e) => onEmailForwardToChange(e.target.value)}
                  placeholder="Recipient email"
                  className="h-4 flex-1 border-0 bg-transparent p-0 text-[10px] leading-tight text-[var(--inbox-text)] placeholder:text-[var(--inbox-text-secondary)]/65 shadow-none focus-visible:ring-0"
                />
              </div>
            )}
            <button
              type="button"
              onClick={() => setAdvancedOpen((v) => !v)}
              className="flex w-full items-center gap-0.5 py-px text-[8px] font-medium text-[var(--inbox-text-secondary)] transition-colors hover:text-[var(--inbox-accent)]"
            >
              {advancedOpen ? <ChevronUp className="h-2 w-2 shrink-0 opacity-60" /> : <ChevronDown className="h-2 w-2 shrink-0 opacity-60" />}
              {advancedOpen ? "Hide CC / BCC" : "CC / BCC"}
            </button>
            {advancedOpen && (
              <div className="space-y-0.5 border-t border-[var(--inbox-divider)]/40 pt-0.5">
                <div className="flex items-center gap-1">
                  <span className="w-5 shrink-0 text-[8px] font-medium text-[var(--inbox-chat-text-secondary)]">CC</span>
                  <Input
                    type="text"
                    value={emailCc}
                    onChange={(e) => onEmailCcChange(e.target.value)}
                    placeholder="CC (optional)"
                    className="h-4 flex-1 border-0 bg-transparent p-0 text-[10px] text-[var(--inbox-text)] placeholder:text-[var(--inbox-text-secondary)]/65 shadow-none focus-visible:ring-0"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-5 shrink-0 text-[8px] font-medium text-[var(--inbox-chat-text-secondary)]">BCC</span>
                  <Input
                    type="text"
                    value={emailBcc}
                    onChange={(e) => onEmailBccChange(e.target.value)}
                    placeholder="BCC (optional)"
                    className="h-4 flex-1 border-0 bg-transparent p-0 text-[10px] text-[var(--inbox-text)] placeholder:text-[var(--inbox-text-secondary)]/65 shadow-none focus-visible:ring-0"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Textarea + inline Send (chat-style) ── */}
        <div className="relative">
          <Textarea
            ref={composerTextareaRef}
            value={replyContent}
            onChange={(event) => handleTextareaChange(event.target.value)}
            placeholder={
              speech.listening && voiceMode === "compose"
                ? "Describe what you want to say..."
                : composerConfig.placeholder
            }
            rows={1}
            className={cn(
              /* `pr-12` reserva espacio a la derecha para el botón Send (`+ Undo` apilado a su izquierda); */
              /* el textarea sigue creciendo verticalmente sin chocar con el botón. */
              "[field-sizing:fixed] min-h-[52px] max-h-[220px] resize-none overflow-y-auto rounded-md border border-[var(--inbox-border)]/28 bg-[var(--inbox-composer-input)]/75 px-2 py-1.5 pr-12 text-[12px] leading-snug text-[var(--inbox-composer-input-text)] placeholder:text-[var(--inbox-composer-placeholder)]/85 transition-colors duration-150 focus-visible:border-[var(--inbox-accent)]/70 focus-visible:ring-1 focus-visible:ring-[var(--inbox-accent)]/18",
              replyIsInternal && "border-[var(--inbox-warning)]/40 focus-visible:border-[var(--inbox-warning)] focus-visible:ring-[var(--inbox-warning)]/20",
              speech.listening && voiceMode === "dictate" && "border-[var(--inbox-voice-dictate-border)] bg-[var(--inbox-voice-dictate-bg)]/50 ring-2 ring-[var(--inbox-voice-dictate-border)]/30",
              speech.listening && voiceMode === "compose" && "border-[var(--inbox-voice-compose-border)] bg-[var(--inbox-voice-compose-bg)]/50 ring-2 ring-[var(--inbox-voice-compose-border)]/30",
              isProcessing && "opacity-60 cursor-not-allowed",
            )}
            disabled={isProcessing}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) handleSend()
            }}
          />
          {/*
           * Inline Send (chat-style): pegado al borde inferior derecho del textarea, similar al
           * patrón ChatGPT/WhatsApp. El botón Undo (cuando hay AI change reciente) se apila a su
           * izquierda. Conserva todos los estados — disabled/loading/internal — del botón antiguo.
           */}
          <div className="pointer-events-none absolute bottom-1.5 right-1.5 flex items-end gap-1">
            {contentBeforeAssist !== null && (
              <button
                type="button"
                onClick={handleUndoAssist}
                className="pointer-events-auto rounded-[8px] p-1.5 text-[var(--inbox-warning)] transition-all duration-150 hover:bg-[var(--app-sidebar-surface)]/60"
                title="Undo last AI change"
                aria-label="Undo last AI change"
              >
                <RotateCcw className="h-4 w-4 shrink-0" strokeWidth={2} />
              </button>
            )}
            <Button
              type="button"
              size="icon-sm"
              onClick={() => {
                closeComposerOverlays()
                handleSend()
              }}
              disabled={replySending || !hasText || isProcessing || (!replyIsInternal && emailMode === "forward" && !emailForwardTo.trim())}
              title={`${sendActionLabel} · Ctrl+Enter or ⌘+Enter`}
              aria-label={sendActionLabel}
              className={cn(
                "pointer-events-auto shrink-0 rounded-md shadow-sm",
                replyIsInternal && "bg-[var(--inbox-warning)] text-white hover:bg-[var(--inbox-warning)]/90",
              )}
              variant={replyIsInternal ? undefined : "accent"}
            >
              {replySending ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" strokeWidth={2} />
              ) : (
                <Send className="h-4 w-4 shrink-0" strokeWidth={2} />
              )}
            </Button>
          </div>
            {isProcessing && (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-[var(--inbox-surface)]/60 backdrop-blur-sm">
              <div className="flex items-center gap-2 rounded-lg border border-[var(--inbox-border)]/50 bg-[var(--inbox-surface)] px-3 py-2 text-sm shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin text-[var(--inbox-accent)]" />
                <span className="text-[13px] font-medium text-[var(--inbox-text)]">
                  {assistLoading === "compose_from_intent" ? "Composing your reply..." : "Rewriting..."}
                </span>
              </div>
            </div>
          )}
          {speech.listening && voiceMode === "compose" && (
            <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2.5 rounded-xl border border-[var(--inbox-voice-compose-border)] bg-[var(--inbox-voice-compose-bg)]/90 px-3 py-2.5 text-sm text-[var(--inbox-voice-compose-text)] backdrop-blur-sm">
              <Mic className="h-4 w-4 shrink-0 animate-pulse" />
              <span className="flex-1 truncate font-medium">
                {speech.transcript || "Listening... describe what you want to say"}
              </span>
              <button
                type="button"
                onClick={() => speech.stop()}
                className="shrink-0 rounded-lg bg-[var(--inbox-voice-compose-border)]/80 px-2.5 py-1 text-xs font-medium text-[var(--inbox-voice-compose-text)] transition-colors hover:bg-[var(--inbox-voice-compose-border)]"
              >
                Done
              </button>
            </div>
          )}
          {speech.listening && voiceMode === "dictate" && (
            <button
              type="button"
              onClick={() => speech.stop()}
              className="absolute bottom-3 right-14 flex items-center gap-2 rounded-lg border border-[var(--inbox-voice-dictate-border)] bg-[var(--inbox-voice-dictate-bg)]/90 px-3 py-1.5 text-xs font-medium text-[var(--inbox-voice-dictate-text)] backdrop-blur-sm transition-colors hover:bg-[var(--inbox-voice-dictate-bg)]"
              title="Stop dictation"
              aria-label="Stop dictation"
            >
              <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--inbox-voice-dictate-text)]" />
              Recording — click to stop
            </button>
          )}
        </div>

        {/* ── Attachments ── */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {attachments.map((att) => (
              <span
                key={att.url}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--inbox-border)] bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-[var(--inbox-text-secondary)]"
              >
                <FileText className="h-3 w-3 shrink-0" />
                <span className="max-w-[120px] truncate">{att.filename}</span>
                <span className="text-[9px] text-[var(--inbox-muted)]">
                  {att.size < 1024 ? `${att.size} B` : att.size < 1048576 ? `${Math.round(att.size / 1024)} KB` : `${(att.size / 1048576).toFixed(1)} MB`}
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveAttachment(att.url)}
                  className="ml-0.5 rounded-full p-0.5 text-[var(--inbox-text-secondary)] hover:bg-white/[0.08] hover:text-[var(--inbox-text)]"
                  title="Remove"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* ── Barra de iconos (solo tools — Send vive ahora dentro del textarea) ── */}
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 border-t border-[var(--inbox-border)]/25 pt-0.5">
          <div className="flex min-w-0 flex-wrap items-center gap-y-1">
            {/* Acting on — first toolbar control, drives scope used by the rest of the toolbar */}
            <button
              type="button"
              onClick={() => {
                setClipPanelOpen(false)
                setAssistPanelOpen(false)
                setMoreMenuOpen(false)
                onCannedOpenChange(false)
                setActingOnPanelOpen((v) => !v)
              }}
              className={cn(
                "mr-1 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--inbox-accent)]/40",
                actingOnPanelOpen
                  ? "border-[var(--inbox-accent)]/50 bg-[var(--inbox-accent)]/12 text-[var(--inbox-accent)]"
                  : "border-[var(--inbox-border)]/40 bg-transparent text-[var(--inbox-text-secondary)] hover:bg-white/[0.06] hover:text-[var(--inbox-text)]",
              )}
              title={`Acting on: ${currentActingOnLabel} — controls scope used by toolbar`}
              aria-label={`Acting on: ${currentActingOnLabel}`}
              aria-expanded={actingOnPanelOpen}
            >
              <Target className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="text-[10px]">Acting on:</span>
              <span className="text-[10px] font-semibold">{currentActingOnLabel}</span>
            </button>
            <div className="flex flex-wrap items-center gap-0.5">
              <button
                type="button"
                onClick={() => {
                  closeComposerOverlays()
                  setVoiceToolbarFocus(false)
                  onReplyModeChange(false)
                  onEmailModeChange("reply")
                  focusComposerWithScroll()
                }}
                className={cn(
                  SHELL_TOOLBAR_ICON,
                  emailToolActive && emailMode === "reply" && SHELL_TOOLBAR_ICON_ACTIVE,
                )}
                title="Reply"
                aria-label="Reply"
              >
                <Reply className="h-4 w-4 shrink-0" strokeWidth={2} />
              </button>
              {channel === "email" && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      closeComposerOverlays()
                      setVoiceToolbarFocus(false)
                      onReplyModeChange(false)
                      onEmailModeChange("reply_all")
                      focusComposerWithScroll()
                    }}
                    className={cn(
                      SHELL_TOOLBAR_ICON,
                      emailToolActive && emailMode === "reply_all" && SHELL_TOOLBAR_ICON_ACTIVE,
                    )}
                    title="Reply all"
                    aria-label="Reply all"
                  >
                    <ReplyAll className="h-4 w-4 shrink-0" strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      closeComposerOverlays()
                      setVoiceToolbarFocus(false)
                      onReplyModeChange(false)
                      onEmailModeChange("forward")
                      focusComposerWithScroll()
                    }}
                    className={cn(
                      SHELL_TOOLBAR_ICON,
                      emailToolActive && emailMode === "forward" && SHELL_TOOLBAR_ICON_ACTIVE,
                    )}
                    title="Forward"
                    aria-label="Forward"
                  >
                    <Forward className="h-4 w-4 shrink-0" strokeWidth={2} />
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  onReplyModeChange(!replyIsInternal)
                  focusComposerWithScroll()
                }}
                className={cn(
                  "rounded-[8px] p-1.5 transition-all duration-150",
                  replyIsInternal && showEmailModeChrome
                    ? "relative bg-[var(--inbox-warning)]/12 text-[var(--inbox-warning)] shadow-[0_0_0_1px_var(--inbox-warning),0_0_10px_0_rgba(242,198,109,0.2)] hover:bg-[var(--inbox-warning)]/18 before:pointer-events-none before:absolute before:left-px before:top-1/2 before:z-10 before:-translate-y-1/2 before:w-0.5 before:h-3.5 before:rounded-r-full before:bg-[var(--inbox-warning)]"
                    : SHELL_TOOLBAR_ICON,
                )}
                title={replyIsInternal ? "Switch back to reply" : "Internal note"}
                aria-label={replyIsInternal ? "Switch back to reply" : "Internal note"}
                aria-pressed={replyIsInternal}
              >
                <StickyNote className="h-4 w-4 shrink-0" strokeWidth={2} />
              </button>
            </div>
            <span
              className="mx-1 hidden h-5 w-px shrink-0 bg-[var(--inbox-divider)] sm:block"
              aria-hidden="true"
            />
            <div className="flex flex-wrap items-center gap-0.5">
            <button
              type="button"
              onClick={() => {
                setAssistPanelOpen(false)
                onCannedOpenChange(false)
                setClipPanelOpen((v) => !v)
              }}
              disabled={attachmentUploading}
              className={cn(
                SHELL_TOOLBAR_ICON,
                clipPanelOpen && !micCapturesChrome && SHELL_TOOLBAR_ICON_ACTIVE,
                attachmentUploading && "opacity-50",
              )}
              title="Insert or attach"
            >
              {attachmentUploading ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" strokeWidth={2} />
              ) : (
                <Paperclip className="h-4 w-4 shrink-0" strokeWidth={2} />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = e.target.files
                if (files && files.length > 0) onAttachFiles(Array.from(files))
                e.target.value = ""
              }}
            />

            {/*
             * AI / text tools — un solo icono Wand2 abre el panel consolidado con tabs:
             * Improve, Translate, Templates (canned), Fanny (sugerencia), Voice (dictate / intent).
             * Antes había varios iconos separados (Zap snippets, MessageSquareQuote Fanny, Keyboard dictate, Sparkles intent)
             * que hacían wrap la toolbar al añadir "Acting on".
             */}
            {!isProcessing && (
              <button
                type="button"
                onClick={() => {
                  setClipPanelOpen(false)
                  onCannedOpenChange(false)
                  setAssistPanelOpen((v) => !v)
                }}
                className={cn(
                  SHELL_TOOLBAR_ICON,
                  assistPanelOpen && !micCapturesChrome && SHELL_TOOLBAR_ICON_ACTIVE,
                )}
                title="AI tools — improve, translate, templates, suggestions, voice"
                aria-label="AI tools"
                aria-expanded={assistPanelOpen}
              >
                <Wand2 className="h-4 w-4 shrink-0" strokeWidth={2} />
              </button>
            )}

            {/*
             * El Mic standalone vivía aquí. Se removió porque "Talk to Fanny" cumple ese rol a
             * nivel Inbox (preguntar/instruir) y el dictado del composer ahora se inicia desde
             * el tab Voice del AI panel (Wand2). Mientras está grabando, el indicador inline en
             * el textarea es clickable para parar.
             */}
            {speech.listening && (
              <button
                type="button"
                onClick={() => speech.stop()}
                className={cn(SHELL_TOOLBAR_ICON, SHELL_TOOLBAR_ICON_ACTIVE)}
                title="Stop recording"
                aria-label="Stop recording"
              >
                <MicOff className="h-4 w-4 shrink-0" strokeWidth={2} />
              </button>
            )}

            {morePanelHasContent ? (
              <button
                type="button"
                onClick={() => {
                  setClipPanelOpen(false)
                  setAssistPanelOpen(false)
                  setActingOnPanelOpen(false)
                  onCannedOpenChange(false)
                  setMoreMenuOpen((v) => !v)
                }}
                className={cn(
                  SHELL_TOOLBAR_ICON,
                  moreMenuOpen && !micCapturesChrome && SHELL_TOOLBAR_ICON_ACTIVE,
                )}
                title="More actions"
                aria-label="More actions"
                aria-expanded={moreMenuOpen}
              >
                <MoreHorizontal className="h-4 w-4 shrink-0" strokeWidth={2} />
              </button>
            ) : null}
            </div>

          </div>
        </div>

        {/* ── Intelligence panel (tabbed: Improve / Translate) ── */}
        {assistPanelOpen && !isProcessing && (
          <div className="overflow-hidden rounded-lg border border-[var(--inbox-border)]/35 bg-white/[0.02]">
            {/* Dark tab bar — matches Attach toolbox */}
            <div
              role="tablist"
              aria-label="Improve text categories"
              className="flex flex-wrap items-center gap-0.5 border-b border-[var(--inbox-border)]/35 bg-black/35 px-2 pt-1.5"
            >
              {assistTabs.map((tab) => {
                const isActive = activeAssistTab === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    id={`assist-tab-${tab.id}`}
                    aria-selected={isActive}
                    aria-controls={`assist-panel-${tab.id}`}
                    tabIndex={isActive ? 0 : -1}
                    onClick={() => setActiveAssistTab(tab.id)}
                    onKeyDown={(event) => {
                      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return
                      event.preventDefault()
                      const idx = assistTabs.findIndex((t) => t.id === activeAssistTab)
                      const delta = event.key === "ArrowRight" ? 1 : -1
                      const next = assistTabs[(idx + delta + assistTabs.length) % assistTabs.length]
                      setActiveAssistTab(next.id)
                    }}
                    className={cn(
                      "rounded-t-md px-2.5 py-1 text-[11px] font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--inbox-accent)]/40",
                      isActive
                        ? "border-b-2 border-[var(--inbox-accent)] -mb-[1px] text-[var(--inbox-accent)]"
                        : "text-[var(--inbox-text-secondary)] hover:text-[var(--inbox-text)]",
                    )}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>

            {/* Helper hint when textarea is empty — only relevant to Improve/Translate */}
            {!hasText && (activeAssistTab === "improve" || activeAssistTab === "translate") && (
              <p className="px-3 pt-2 text-[11px] leading-relaxed text-[var(--inbox-text-secondary)]">
                Write something in the message to use improve and translate tools.
              </p>
            )}

            {/* Active tab content */}
            <div
              role="tabpanel"
              id={`assist-panel-${activeAssistTab}`}
              aria-labelledby={`assist-tab-${activeAssistTab}`}
              className={cn(
                activeAssistTab === "templates" || activeAssistTab === "suggestions"
                  ? "flex flex-col gap-1.5 p-2.5"
                  : "flex flex-wrap gap-1.5 p-2.5",
              )}
            >
              {activeAssistTab === "improve" &&
                SMART_TOOLS.map((tool) => (
                  <ClipAction
                    key={tool.action}
                    label={tool.label}
                    icon={tool.icon}
                    onClick={
                      hasText
                        ? () => {
                            void handleAssist(tool.action)
                            setAssistPanelOpen(false)
                          }
                        : undefined
                    }
                  />
                ))}
              {activeAssistTab === "translate" &&
                TRANSLATE_LANGUAGES.map((lang) => (
                  <ClipAction
                    key={lang.code}
                    label={lang.label}
                    icon={Languages}
                    onClick={
                      hasText
                        ? () => {
                            void handleTranslate(lang.code)
                            setAssistPanelOpen(false)
                          }
                        : undefined
                    }
                  />
                ))}
              {activeAssistTab === "templates" && (
                <>
                  <Input
                    type="text"
                    placeholder="Search templates..."
                    value={templateQuery}
                    onChange={(e) => setTemplateQuery(e.target.value)}
                    className="h-7 border border-[var(--inbox-border)]/40 bg-[var(--inbox-composer-input)]/60 px-2 text-[11px] text-[var(--inbox-text)] placeholder:text-[var(--inbox-text-secondary)]/65 focus-visible:ring-0"
                  />
                  <div className="flex max-h-48 flex-col gap-1 overflow-y-auto pr-1">
                    {(() => {
                      const q = templateQuery.trim().toLowerCase()
                      const filtered = q
                        ? cannedResponses.filter(
                            (r) =>
                              r.label.toLowerCase().includes(q) ||
                              r.content.toLowerCase().includes(q),
                          )
                        : cannedResponses
                      if (filtered.length === 0) {
                        return (
                          <p className="px-1 py-2 text-[11px] text-[var(--inbox-text-secondary)]">
                            No matches.
                          </p>
                        )
                      }
                      return filtered.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            handleInsertCanned(item)
                            setAssistPanelOpen(false)
                            setTemplateQuery("")
                          }}
                          className="rounded-md border border-transparent px-2 py-1.5 text-left transition-colors hover:border-[var(--inbox-border)]/40 hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--inbox-accent)]/40"
                        >
                          <p className="truncate text-[11px] font-medium text-[var(--inbox-text)]">
                            {item.label}
                          </p>
                          <p className="truncate text-[10px] text-[var(--inbox-text-secondary)]">
                            {item.content}
                          </p>
                        </button>
                      ))
                    })()}
                  </div>
                </>
              )}
              {activeAssistTab === "suggestions" && hasFannySuggestion && (
                <>
                  {fannySuggestionTitle?.trim() ? (
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--inbox-accent)]">
                      Fanny · {fannySuggestionTitle}
                    </p>
                  ) : (
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--inbox-accent)]">
                      Fanny · suggested reply
                    </p>
                  )}
                  <Textarea
                    value={fannyEditBuffer}
                    onChange={(e) => setFannyEditBuffer(e.target.value)}
                    rows={6}
                    className="min-h-[120px] max-h-[min(32vh,240px)] w-full resize-y overflow-y-auto rounded-md border border-[var(--inbox-border)]/40 bg-[var(--inbox-composer-input)] px-2.5 py-2 text-sm text-[var(--inbox-composer-input-text)] [field-sizing:fixed]"
                    placeholder="Edit suggested reply…"
                  />
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-[var(--inbox-text-secondary)] hover:bg-white/8 hover:text-[var(--inbox-text)]"
                      onClick={() => setAssistPanelOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="accent"
                      disabled={!fannyEditBuffer.trim()}
                      onClick={() => {
                        const next = fannyEditBuffer.trim()
                        if (!next) return
                        onApplyFannySuggestion?.(next)
                        setAssistPanelOpen(false)
                      }}
                    >
                      Use reply
                    </Button>
                  </div>
                </>
              )}
              {activeAssistTab === "voice" && speech.supported && (
                <>
                  <ClipAction
                    label="Dictate"
                    icon={Keyboard}
                    title="Dictation — speech is typed into the message"
                    onClick={() => {
                      setAssistPanelOpen(false)
                      startVoice("dictate")
                    }}
                  />
                  <ClipAction
                    label="Speak intent"
                    icon={Sparkles}
                    title="Intent — describe the reply you want; Fanny drafts it from your words"
                    onClick={() => {
                      setAssistPanelOpen(false)
                      startVoice("compose")
                    }}
                  />
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Clip / Insert panel (tabbed by category) ── */}
        {clipPanelOpen && (
          <div className="overflow-hidden rounded-lg border border-[var(--inbox-border)]/35 bg-white/[0.02]">
            {/* Category tabs — dark header */}
            <div
              role="tablist"
              aria-label="Insert toolbox categories"
              className="flex flex-wrap items-center gap-0.5 border-b border-[var(--inbox-border)]/35 bg-black/35 px-2 pt-1.5"
            >
              {clipCategoryTabs.map((tab) => {
                const isActive = activeClipCategory === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    id={`clip-tab-${tab.id}`}
                    aria-selected={isActive}
                    aria-controls={`clip-panel-${tab.id}`}
                    tabIndex={isActive ? 0 : -1}
                    onClick={() => setActiveClipCategory(tab.id)}
                    onKeyDown={(event) => {
                      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return
                      event.preventDefault()
                      const idx = clipCategoryTabs.findIndex((t) => t.id === activeClipCategory)
                      const delta = event.key === "ArrowRight" ? 1 : -1
                      const next =
                        clipCategoryTabs[(idx + delta + clipCategoryTabs.length) % clipCategoryTabs.length]
                      setActiveClipCategory(next.id)
                    }}
                    className={cn(
                      "rounded-t-md px-2.5 py-1 text-[11px] font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--inbox-accent)]/40",
                      isActive
                        ? "border-b-2 border-[var(--inbox-accent)] -mb-[1px] text-[var(--inbox-accent)]"
                        : "text-[var(--inbox-text-secondary)] hover:text-[var(--inbox-text)]",
                    )}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>

            {/* Active category content */}
            <div
              role="tabpanel"
              id={`clip-panel-${activeClipCategory}`}
              aria-labelledby={`clip-tab-${activeClipCategory}`}
              className="flex flex-wrap gap-1.5 p-2.5"
            >
              {activeClipCategory === "attach" && (
                <>
                  <ClipAction
                    label="File"
                    icon={FileText}
                    title="Attach any allowed file"
                    onClick={() => openFilePicker("")}
                  />
                  <ClipAction
                    label="Image"
                    icon={Image}
                    title="Attach an image (JPG, PNG, GIF, WebP)"
                    onClick={() => openFilePicker("image/*")}
                  />
                  <ClipAction
                    label="Document"
                    icon={FileText}
                    title="Attach a document (PDF, Word, Excel, CSV, TXT)"
                    onClick={() =>
                      openFilePicker(".pdf,.doc,.docx,.txt,.csv,.xls,.xlsx")
                    }
                  />
                  <Popover
                    open={linkPopoverOpen}
                    onOpenChange={(open) => {
                      setLinkPopoverOpen(open)
                      if (!open) {
                        setLinkUrl("")
                        setLinkLabel("")
                      }
                    }}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        title="Insert a link into the reply"
                        aria-label="Insert a link into the reply"
                        className="inline-flex min-w-[110px] flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-xs whitespace-nowrap text-[var(--inbox-text)] transition-colors hover:bg-white/[0.06] hover:text-[var(--inbox-accent)] sm:flex-none"
                      >
                        <Link className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span className="text-left">Link</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      sideOffset={6}
                      className="w-72 space-y-2 border border-[var(--inbox-border)]/40 bg-[var(--inbox-card)] p-3 text-[var(--inbox-text)]"
                    >
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--inbox-muted)]">
                          URL
                        </label>
                        <Input
                          type="url"
                          value={linkUrl}
                          onChange={(e) => setLinkUrl(e.target.value)}
                          placeholder="https://example.com"
                          className="h-8 text-xs"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault()
                              insertLinkAtCursor()
                            }
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--inbox-muted)]">
                          Label (optional)
                        </label>
                        <Input
                          type="text"
                          value={linkLabel}
                          onChange={(e) => setLinkLabel(e.target.value)}
                          placeholder="Click here"
                          className="h-8 text-xs"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault()
                              insertLinkAtCursor()
                            }
                          }}
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setLinkPopoverOpen(false)}
                          className="h-7 px-2 text-[11px] text-[var(--inbox-text-secondary)] hover:bg-white/[0.06] hover:text-[var(--inbox-text)]"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="accent"
                          onClick={insertLinkAtCursor}
                          disabled={linkUrl.trim().length === 0}
                          className="h-7 px-3 text-[11px]"
                        >
                          Insert
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </>
              )}

              {activeClipCategory === "workspace" && (
                <>
                  <ClipAction
                    label="Client"
                    icon={User}
                    title="Coming later: insert client info into reply"
                  />
                  <ClipAction
                    label="Project"
                    icon={Briefcase}
                    title="Coming later: insert project info into reply"
                  />
                  <ClipAction
                    label="Billing"
                    icon={Receipt}
                    title="Coming later: insert billing info into reply"
                  />
                </>
              )}

              {activeClipCategory === "show" && (
                <>
                  <ClipAction
                    label="Screen"
                    icon={Image}
                    title="Coming later: attach or insert a screenshot"
                  />
                  <ClipAction
                    label="Reference"
                    icon={Link}
                    title="Coming later: insert a saved reference"
                  />
                  <ClipAction
                    label="Landing"
                    icon={Globe}
                    title="Coming later: share a landing page"
                  />
                </>
              )}

              {activeClipCategory === "generate" && (
                <>
                  <ClipAction
                    label="Proposal"
                    icon={Sparkles}
                    title="Coming later: generate a proposal draft"
                  />
                  <ClipAction
                    label="Quote"
                    icon={Receipt}
                    title="Coming later: generate a quote"
                  />
                  <ClipAction
                    label="Template"
                    icon={LayoutTemplate}
                    title="Use canned responses from the template button above"
                  />
                </>
              )}

              {activeClipCategory === "share" && (
                <>
                  {/* Phase 3: opt-in receipt confirmation. Email channel only — non-email
                      channels are disabled with an explanatory tooltip. The active state
                      reflects the parent flag so the pill in the header stays in sync. */}
                  <ClipAction
                    label={requestConfirmation ? "Confirmation requested" : "Confirm received"}
                    icon={MailCheck}
                    onClick={
                      channel === "email" && onRequestConfirmationChange
                        ? () => onRequestConfirmationChange(!requestConfirmation)
                        : undefined
                    }
                    active={requestConfirmation}
                    disabled={channel !== "email"}
                    title={
                      channel === "email"
                        ? requestConfirmation
                          ? "Customer will see a 'Confirm you received this' link. Click to disable."
                          : "Add a 'Confirm you received this' link to this email."
                        : "Email only. Other channels use native read receipts when available."
                    }
                  />
                  <ClipAction
                    label="Contact"
                    icon={User}
                    title="Coming later: share a contact card"
                  />
                  <ClipAction
                    label="Location"
                    icon={MapPin}
                    title="Coming later: share a location"
                  />
                  <ClipAction
                    label="Meeting"
                    icon={Calendar}
                    title="Coming later: schedule or share a meeting link"
                  />
                  <ClipAction
                    label="Payment"
                    icon={CreditCard}
                    title="Coming later: share a payment link"
                  />
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Acting on scope panel ── */}
        {actingOnPanelOpen && (
          <div className="overflow-hidden rounded-lg border border-[var(--inbox-border)]/35 bg-white/[0.02]">
            {/* Dark header — same visual language as Attach toolbox tab bar */}
            <div className="border-b border-[var(--inbox-border)]/35 bg-black/35 px-3 py-1.5">
              <p className="text-[11px] font-semibold leading-tight text-[var(--inbox-text)]">
                Acting on
              </p>
              <p className="mt-0.5 text-[10px] leading-tight text-[var(--inbox-text-secondary)]">
                Choose which message context the toolbar uses.
              </p>
            </div>
            <div className="flex flex-col gap-1 p-2.5">
              {(["latest", "selected", "all"] as const).map((scope) => {
                const meta = actingOnScopeMeta[scope]
                const isActive = actingOnScope === scope
                const isDisabled = scope === "selected" && !hasSelectedMessage
                return (
                  <button
                    key={scope}
                    type="button"
                    disabled={isDisabled}
                    onClick={
                      isDisabled
                        ? undefined
                        : () => {
                            onActingOnScopeChange?.(scope)
                            setActingOnPanelOpen(false)
                          }
                    }
                    className={cn(
                      "flex w-full items-start gap-2 rounded-md border px-2.5 py-1.5 text-left transition-colors",
                      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--inbox-accent)]/40",
                      isActive
                        ? "border-[var(--inbox-accent)]/45 bg-[var(--inbox-accent)]/12 text-[var(--inbox-text)]"
                        : isDisabled
                          ? "cursor-not-allowed border-[var(--inbox-border)]/30 bg-transparent text-[var(--inbox-text-secondary)]/65 opacity-75"
                          : "border-[var(--inbox-border)]/30 bg-transparent text-[var(--inbox-text)] hover:border-[var(--inbox-accent)]/30 hover:bg-white/[0.06]",
                    )}
                    title={isDisabled ? meta.description : `Use ${meta.label.toLowerCase()} scope`}
                    aria-pressed={isActive}
                  >
                    <meta.icon
                      className={cn(
                        "mt-0.5 h-3.5 w-3.5 shrink-0",
                        isActive && "text-[var(--inbox-accent)]",
                      )}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block text-[12px] font-medium leading-tight",
                          isActive && "text-[var(--inbox-accent)]",
                        )}
                      >
                        {meta.label}
                      </span>
                      <span className="mt-0.5 block text-[10px] leading-snug text-[var(--inbox-text-secondary)]">
                        {meta.description}
                      </span>
                      {/* Inline preview when this scope is active and an anchor exists */}
                      {isActive && scope === "selected" && replyTarget ? (
                        <span className="mt-1 block">
                          <span className="flex min-w-0 items-baseline gap-1.5">
                            <span className="shrink-0 truncate text-[10px] font-semibold text-[var(--inbox-text)]">
                              {replyTarget.authorLabel}
                            </span>
                            {replyTarget.timestampLabel ? (
                              <span
                                suppressHydrationWarning
                                className="text-[9px] tabular-nums text-[var(--inbox-text-secondary)]"
                              >
                                · {replyTarget.timestampLabel}
                              </span>
                            ) : null}
                          </span>
                          {replyTarget.snippet ? (
                            <span
                              className="mt-0.5 block truncate text-[10px] leading-snug text-[var(--inbox-text-secondary)]"
                              title={replyTarget.snippet}
                            >
                              {replyTarget.snippet}
                            </span>
                          ) : null}
                        </span>
                      ) : null}
                      {isActive && scope === "latest" && latestActionAnchor ? (
                        <span className="mt-1 block">
                          <span className="flex min-w-0 items-baseline gap-1.5">
                            <span className="shrink-0 truncate text-[10px] font-semibold text-[var(--inbox-text)]">
                              {latestActionAnchor.authorLabel}
                            </span>
                            {latestActionAnchor.timestampLabel ? (
                              <span
                                suppressHydrationWarning
                                className="text-[9px] tabular-nums text-[var(--inbox-text-secondary)]"
                              >
                                · {latestActionAnchor.timestampLabel}
                              </span>
                            ) : null}
                          </span>
                          {latestActionAnchor.snippet ? (
                            <span
                              className="mt-0.5 block truncate text-[10px] leading-snug text-[var(--inbox-text-secondary)]"
                              title={latestActionAnchor.snippet}
                            >
                              {latestActionAnchor.snippet}
                            </span>
                          ) : null}
                        </span>
                      ) : null}
                    </span>
                    {isActive && (
                      <span className="mt-0.5 shrink-0 rounded-full border border-[var(--inbox-accent)]/40 bg-[var(--inbox-accent)]/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[var(--inbox-accent)]">
                        Active
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/*
          Scope-aware More actions panel — additive layout:
          - Conversation actions (Mark resolved + Archive / Close / Trash) always render when
            the conversation handlers are wired. The operator must always be able to
            archive/close/trash a thread, regardless of the current Acting on scope.
          - Message actions (Mark done + Add internal note) render *additionally* on top when
            scope is Latest or Selected and the parent reports the scope is usable.
        */}
        {moreMenuOpen && showMoreMessagePanel && messageActions && (
          <div className="overflow-hidden rounded-lg border border-[var(--inbox-border)]/35 bg-white/[0.02]">
            <div className="border-b border-[var(--inbox-border)]/35 bg-black/35 px-3 py-1.5">
              <p className="text-[11px] font-semibold leading-tight text-[var(--inbox-text)]">
                {actingOnScope === "selected" ? "Selected message actions" : "Message actions"}
              </p>
              <p className="mt-0.5 text-[10px] leading-tight text-[var(--inbox-text-secondary)]">
                {actingOnScope === "selected"
                  ? "Affects the selected message."
                  : "Affects the latest relevant message."}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5 p-2.5">
              {messageActions.onMarkDone ? (
                /**
                 * Reversibility: when the scoped message is already done, swap the label to
                 * "Mark as needs action". The handler is the same toggle the page provides
                 * (it inverts intentStatus internally), so the user gets a one-click flip back
                 * to open work without leaving the More panel.
                 */
                messageActions.intentStatus === "done" ? (
                  <MoreMenuItem
                    icon={AlertCircle}
                    label={actingOnScope === "selected" ? "Mark selected as needs action" : "Mark latest as needs action"}
                    onClick={messageActions.onMarkDone}
                    onAfterClick={() => setMoreMenuOpen(false)}
                  />
                ) : (
                  <MoreMenuItem
                    icon={CheckCircle2}
                    label={actingOnScope === "selected" ? "Mark selected as done" : "Mark latest as done"}
                    activeLabel="Marked as done"
                    onClick={messageActions.onMarkDone}
                    isCurrent={false}
                    onAfterClick={() => setMoreMenuOpen(false)}
                  />
                )
              ) : null}
              {messageActions.onAddInternalNote ? (
                <MoreMenuItem
                  icon={StickyNote}
                  label={actingOnScope === "selected" ? "Add internal note about selected" : "Add internal note about latest"}
                  onClick={messageActions.onAddInternalNote}
                  onAfterClick={() => setMoreMenuOpen(false)}
                />
              ) : null}
              {messageActions.onAddToTodo ? (
                /**
                 * Phase 3: capture the scoped message as an `InboxTodo`. The page derives the
                 * title (preferring shortIntent), the description excerpt, and the priority
                 * (escalated to `high`/`urgent` only when the conversation already carries
                 * matching urgency). Clicking *does not* mark the message done — explicit
                 * Done lives one button up so the operator decides when work is closed.
                 */
                <MoreMenuItem
                  icon={ListPlus}
                  label={actingOnScope === "selected" ? "Add selected message to To-do" : "Add latest message to To-do"}
                  onClick={messageActions.onAddToTodo}
                  onAfterClick={() => setMoreMenuOpen(false)}
                />
              ) : null}
              {messageActions.onTrashMessage ? (
                /**
                 * Soft-trash for a single message. The "selected" / "latest" target the More
                 * panel applies to is always a non-trashed message (the page derivations skip
                 * trashed entries on purpose, so the operator never trashes a placeholder),
                 * which means this entry is Trash-only — Restore lives inline on the bubble
                 * itself via its dedicated Restore CTA. Distinct from the conversation-level
                 * Move to Trash below: this only hides one bubble inside the thread; the
                 * conversation stays visible in the inbox.
                 */
                <MoreMenuItem
                  icon={Trash2}
                  label={actingOnScope === "selected" ? "Trash selected message" : "Trash latest message"}
                  onClick={messageActions.onTrashMessage}
                  onAfterClick={() => setMoreMenuOpen(false)}
                  tone="danger"
                />
              ) : null}
            </div>
          </div>
        )}

        {moreMenuOpen && showMoreConversationPanel && (
          <div className="overflow-hidden rounded-lg border border-[var(--inbox-border)]/35 bg-white/[0.02]">
            <div className="border-b border-[var(--inbox-border)]/35 bg-black/35 px-3 py-1.5">
              <p className="text-[11px] font-semibold leading-tight text-[var(--inbox-text)]">
                Conversation actions
              </p>
              <p className="mt-0.5 text-[10px] leading-tight text-[var(--inbox-text-secondary)]">
                Affects the whole conversation.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5 p-2.5">
              {/*
                Per-button swap: when the conversation is already in a terminal/done state we
                render the *reverse* action in place of the matching forward one. The other
                three actions stay as-is so the operator can still e.g. Archive a conversation
                that is currently resolved. Reverse handlers are optional — when missing we
                fall back to the legacy disabled-when-current behavior so partial wiring
                never breaks the panel.
              */}
              {markResolvedHandler ? (
                currentConversationStatus === "resolved" && markNeedsActionHandler ? (
                  <MoreMenuItem
                    icon={AlertCircle}
                    label="Mark as needs action"
                    onClick={markNeedsActionHandler}
                    onAfterClick={() => setMoreMenuOpen(false)}
                  />
                ) : (
                  <MoreMenuItem
                    icon={CheckCheck}
                    label="Mark as resolved"
                    activeLabel="Resolved"
                    onClick={markResolvedHandler}
                    isCurrent={currentConversationStatus === "resolved"}
                    onAfterClick={() => setMoreMenuOpen(false)}
                  />
                )
              ) : null}
              {currentConversationStatus === "archived" && unarchiveHandler ? (
                <MoreMenuItem
                  icon={ArchiveRestore}
                  label="Unarchive"
                  onClick={unarchiveHandler}
                  onAfterClick={() => setMoreMenuOpen(false)}
                />
              ) : (
                <MoreMenuItem
                  icon={Archive}
                  label="Archive"
                  activeLabel="Archived"
                  onClick={archiveHandler}
                  isCurrent={currentConversationStatus === "archived"}
                  onAfterClick={() => setMoreMenuOpen(false)}
                />
              )}
              {currentConversationStatus === "closed" && reopenHandler ? (
                <MoreMenuItem
                  icon={MailOpen}
                  label="Reopen"
                  onClick={reopenHandler}
                  onAfterClick={() => setMoreMenuOpen(false)}
                />
              ) : (
                <MoreMenuItem
                  icon={CheckCircle2}
                  label="Close"
                  activeLabel="Closed"
                  onClick={closeHandler}
                  isCurrent={currentConversationStatus === "closed"}
                  onAfterClick={() => setMoreMenuOpen(false)}
                />
              )}
              {currentConversationStatus === "trashed" && restoreFromTrashHandler ? (
                <MoreMenuItem
                  icon={RotateCcw}
                  label="Restore to Inbox"
                  onClick={restoreFromTrashHandler}
                  onAfterClick={() => setMoreMenuOpen(false)}
                />
              ) : (
                <MoreMenuItem
                  icon={Trash2}
                  label="Move to Trash"
                  activeLabel="In Trash"
                  onClick={trashHandler}
                  isCurrent={currentConversationStatus === "trashed"}
                  onAfterClick={() => setMoreMenuOpen(false)}
                  tone="danger"
                />
              )}
            </div>
          </div>
        )}

        {/* ── Status / errors ── */}
        {assistError && (
          <div className="flex items-center gap-2 rounded-md border border-[var(--inbox-urgency-critical-bg)] bg-[var(--inbox-urgency-critical-bg)] px-2.5 py-1">
            <p className="flex-1 text-[11px] text-[var(--inbox-urgency-critical-text)]">{assistError}</p>
            <button
              type="button"
              onClick={() => setAssistError(null)}
              className="shrink-0 rounded p-0.5 text-[var(--inbox-urgency-critical-text)]/60 hover:text-[var(--inbox-urgency-critical-text)]"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        )}
        {replyStatus && !assistError && <p className="text-[11px] text-[var(--inbox-text-secondary)]">{replyStatus}</p>}
      </div>
    </div>
  )
}

/**
 * Formatea el canal de la conversación para el badge del header del composer. Prioriza un map
 * curado para los canales conocidos (consistencia tipográfica: "Web chat", no "Web_chat"), cae
 * al `channelLabel` que envía el parent, y como último recurso capitaliza el slug crudo.
 */
function formatChannelBadge(channel: string, channelLabel: string): string {
  const normalized = (channel || "").trim().toLowerCase()
  const map: Record<string, string> = {
    email: "Email",
    whatsapp: "WhatsApp",
    web_chat: "Web chat",
    web: "Web chat",
    webchat: "Web chat",
    portal: "Portal",
    instagram: "Instagram",
    facebook: "Facebook",
    messenger: "Messenger",
    sms: "SMS",
    voice: "Voice",
    telegram: "Telegram",
  }
  if (map[normalized]) return map[normalized]
  const fromLabel = channelLabel?.trim()
  if (fromLabel) return fromLabel
  if (!normalized) return "Channel"
  return normalized
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function getComposerConfig({
  channel,
  replyIsInternal,
  subject,
}: {
  channel: string
  channelLabel: string
  replyIsInternal: boolean
  detectedLanguage?: string | null
  subject?: string | null
}) {
  if (replyIsInternal) {
    return { placeholder: "Add an internal note...", sendLabel: "Save note", subjectPreview: null }
  }

  switch (channel) {
    case "email":
      return { placeholder: "Write your reply...", sendLabel: "Send reply", subjectPreview: subject || "No subject available" }
    case "whatsapp":
      return { placeholder: "Type your message...", sendLabel: "Send message", subjectPreview: null }
    case "web_chat":
    case "portal":
      return { placeholder: "Type your message...", sendLabel: "Send message", subjectPreview: null }
    default:
      return { placeholder: "Write your message...", sendLabel: "Send reply", subjectPreview: null }
  }
}

/**
 * Item del menú "More" (Archive / Close / Move to Trash) en la toolbar del composer.
 * Reemplaza al antiguo `ConversationActionChip` del strip ancho.
 *
 * Comportamiento:
 *  - Sin handler → disabled.
 *  - `isCurrent` (la conversación ya está en ese estado) → disabled con `activeLabel`.
 *  - `tone="danger"` aplica color de urgencia para Trash.
 *  - `onAfterClick` cierra el popover tras disparar el handler.
 */
function MoreMenuItem({
  icon: Icon,
  label,
  activeLabel,
  onClick,
  isCurrent,
  tone = "neutral",
  onAfterClick,
}: {
  icon: LucideIcon
  label: string
  activeLabel?: string
  onClick?: () => void
  isCurrent?: boolean
  tone?: "neutral" | "danger"
  onAfterClick?: () => void
}) {
  const disabled = !onClick || Boolean(isCurrent)
  const toneText = tone === "danger" ? "text-[var(--inbox-urgency-critical-text)]" : "text-[var(--inbox-text)]"
  const toneHover =
    tone === "danger"
      ? "hover:bg-[var(--inbox-urgency-critical-bg)] hover:text-[var(--inbox-urgency-critical-text)]"
      : "hover:bg-white/[0.06] hover:text-[var(--inbox-accent)]"
  return (
    <button
      type="button"
      onClick={
        disabled
          ? undefined
          : () => {
              onClick?.()
              onAfterClick?.()
            }
      }
      disabled={disabled}
      title={isCurrent ? `Already ${activeLabel || label}` : `${label} (whole conversation)`}
      aria-label={isCurrent ? `${label} (already applied)` : `${label} — affects the whole conversation`}
      className={cn(
        "inline-flex min-w-[110px] flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-xs whitespace-nowrap transition-colors sm:flex-none",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--inbox-accent)]/40",
        disabled
          ? "cursor-not-allowed text-[var(--inbox-text-secondary)]/70 opacity-70"
          : cn(toneText, toneHover),
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="text-left">{isCurrent && activeLabel ? activeLabel : label}</span>
    </button>
  )
}

/**
 * Phase 1 toolbox: ClipAction admite labels que envuelven a 2 líneas (sin truncate)
 * para evitar "Scre…", "Prop…", "Cont…" cuando la columna es estrecha.
 *
 * Estados:
 *  - enabled (con `onClick`): texto normal del inbox, hover purple translucent.
 *  - disabled (sin `onClick`): opacidad reducida pero **legible** (~75%) sobre dark surface,
 *    `cursor-not-allowed`, y `title` explica la promesa futura.
 */
function ClipAction({
  label,
  icon: Icon,
  onClick,
  title,
  active = false,
  disabled,
}: {
  label: string
  icon: LucideIcon
  onClick?: () => void
  title?: string
  /** Toggle visual state; when true the row is highlighted as the accent surface. */
  active?: boolean
  /**
   * Optional explicit disabled override. When omitted, the button is disabled iff `onClick`
   * is missing (legacy "coming later" pattern). Pass `false` to keep enabled even without an
   * onClick, or `true` to force-disable a wired action (e.g. wrong channel).
   */
  disabled?: boolean
}) {
  const available = disabled === undefined ? Boolean(onClick) : !disabled
  return (
    <button
      type="button"
      onClick={available ? onClick : undefined}
      disabled={!available}
      title={title ?? label}
      aria-label={title ?? label}
      aria-pressed={active}
      className={cn(
        "inline-flex min-w-[110px] flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-xs whitespace-nowrap transition-colors sm:flex-none",
        active
          ? "bg-[var(--inbox-accent)]/15 text-[var(--inbox-accent)] ring-1 ring-[var(--inbox-accent)]/40 hover:bg-[var(--inbox-accent)]/20"
          : available
            ? "text-[var(--inbox-text)] hover:bg-white/[0.06] hover:text-[var(--inbox-accent)]"
            : "cursor-not-allowed text-[var(--inbox-text-secondary)]/80 opacity-75",
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="text-left">{label}</span>
    </button>
  )
}
