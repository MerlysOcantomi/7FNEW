"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import {
  Send, Loader2, Mic, MicOff, Zap, Paperclip, ChevronDown, ChevronUp,
  Mail, Languages, X, FileText, Forward, Reply, ReplyAll, StickyNote,
  Sparkles, CheckCheck, AlignLeft, Briefcase, Heart, ArrowRight,
  MapPin, Calendar, Link, User, Image, Globe, LayoutTemplate,
  Receipt, CreditCard, RotateCcw, Keyboard, Wand2, MessageSquareQuote, type LucideIcon,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command"
import { cn } from "@/lib/utils"
import { useSpeechRecognition } from "@/hooks/use-speech-recognition"
import { useCannedResponses, type CannedResponse } from "@/hooks/use-canned-responses"

export interface ComposerAttachment {
  url: string
  filename: string
  contentType: string
  size: number
}

export type EmailSendMode = "reply" | "reply_all" | "forward"

type VoiceMode = "dictate" | "compose"

type AssistAction = "proofread" | "shorter" | "clearer" | "professional" | "warmer" | "direct" | "translate" | "compose_from_intent"

interface ReplyComposerProps {
  channel: string
  channelLabel: string
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
  /** Fanny suggested reply — panel desde la barra; solo vuelca texto al compositor (no envía). */
  fannySuggestionTitle?: string | null
  fannySuggestionContent?: string | null
  onApplyFannySuggestion?: (content: string) => void
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
  fannySuggestionTitle,
  fannySuggestionContent,
  onApplyFannySuggestion,
}: ReplyComposerProps) {
  const speech = useSpeechRecognition()
  const baseTextRef = useRef("")
  const userInterruptedRef = useRef(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [voiceMode, setVoiceMode] = useState<VoiceMode>("dictate")
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

  function handleMicToggle() {
    if (speech.listening) {
      speech.stop()
      return
    }
    userInterruptedRef.current = false
    composingIntentRef.current = voiceMode === "compose"
    baseTextRef.current = voiceMode === "compose" ? "" : replyContent
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
  const [fannyPopoverOpen, setFannyPopoverOpen] = useState(false)
  const [fannyEditBuffer, setFannyEditBuffer] = useState("")

  const hasFannySuggestion = Boolean(onApplyFannySuggestion && fannySuggestionContent?.trim())

  useEffect(() => {
    if (fannyPopoverOpen && typeof fannySuggestionContent === "string") {
      setFannyEditBuffer(fannySuggestionContent)
    }
  }, [fannyPopoverOpen, fannySuggestionContent])

  useLayoutEffect(() => {
    const el = composerTextareaRef.current
    if (!el) return
    el.style.height = "auto"
    const h = Math.min(Math.max(el.scrollHeight, TEXTAREA_MIN_PX), TEXTAREA_MAX_PX)
    el.style.height = `${h}px`
  }, [replyContent, composerTextareaRef])

  useEffect(() => {
    if (isProcessing) setAssistPanelOpen(false)
  }, [isProcessing])

  const showEmailOptions = !replyIsInternal && channel === "email"

  const sendActionLabel = replyIsInternal
    ? "Save note"
    : emailMode === "forward"
      ? "Forward"
      : emailMode === "reply_all"
        ? "Reply all"
        : composerConfig.sendLabel

  return (
    <div className="shrink-0 border-t border-[var(--inbox-divider)]/60 bg-[var(--inbox-chat-background)] px-3 py-1 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] md:px-5" data-composer="true">
      <div className="space-y-0.5 rounded-lg border border-[var(--inbox-border)]/30 bg-[var(--inbox-composer-background)]/70 p-1 shadow-none md:p-1.5">

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
                  placeholder="recipient@example.com"
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
                    placeholder="cc@example.com"
                    className="h-4 flex-1 border-0 bg-transparent p-0 text-[10px] text-[var(--inbox-text)] placeholder:text-[var(--inbox-text-secondary)]/65 shadow-none focus-visible:ring-0"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-5 shrink-0 text-[8px] font-medium text-[var(--inbox-chat-text-secondary)]">BCC</span>
                  <Input
                    type="text"
                    value={emailBcc}
                    onChange={(e) => onEmailBccChange(e.target.value)}
                    placeholder="bcc@example.com"
                    className="h-4 flex-1 border-0 bg-transparent p-0 text-[10px] text-[var(--inbox-text)] placeholder:text-[var(--inbox-text-secondary)]/65 shadow-none focus-visible:ring-0"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Textarea ── */}
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
              "[field-sizing:fixed] min-h-[52px] max-h-[220px] resize-none overflow-y-auto rounded-md border border-[var(--inbox-border)]/28 bg-[var(--inbox-composer-input)]/75 px-2 py-1.5 text-[12px] leading-snug text-[var(--inbox-composer-input-text)] placeholder:text-[var(--inbox-composer-placeholder)]/85 transition-colors duration-150 focus-visible:border-[var(--inbox-accent)]/70 focus-visible:ring-1 focus-visible:ring-[var(--inbox-accent)]/18",
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
            <div className="absolute bottom-3 right-3 flex items-center gap-2 rounded-lg border border-[var(--inbox-voice-dictate-border)] bg-[var(--inbox-voice-dictate-bg)]/90 px-3 py-1.5 text-xs font-medium text-[var(--inbox-voice-dictate-text)] backdrop-blur-sm">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--inbox-voice-dictate-text)]" />
              Recording...
            </div>
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
                  className="ml-0.5 rounded-full p-0.5 hover:bg-[var(--accent-soft)]/45"
                  title="Remove"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* ── Barra de iconos + envío (solo icono a la derecha) ── */}
        <div className="flex flex-wrap items-center justify-between gap-x-1.5 gap-y-0.5 border-t border-[var(--inbox-border)]/25 pt-0.5">
          <div className="flex min-w-0 flex-wrap items-center gap-y-1">
            <div className="flex flex-wrap items-center gap-0.5">
              <button
                type="button"
                onClick={() => {
                  onReplyModeChange(false)
                  onEmailModeChange("reply")
                  focusComposerWithScroll()
                }}
                className={cn(
                  "rounded-md p-1.5 text-[var(--inbox-text-secondary)] transition-colors hover:bg-[var(--inbox-accent-soft)] hover:text-[var(--inbox-accent)]",
                  !replyIsInternal && emailMode === "reply" && "bg-[var(--inbox-accent-soft)] text-[var(--inbox-accent)]",
                )}
                title="Reply"
                aria-label="Reply"
              >
                <Reply className="h-[18px] w-[18px]" strokeWidth={2} />
              </button>
              {channel === "email" && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      onReplyModeChange(false)
                      onEmailModeChange("reply_all")
                      focusComposerWithScroll()
                    }}
                    className={cn(
                      "rounded-md p-1.5 text-[var(--inbox-text-secondary)] transition-colors hover:bg-[var(--inbox-accent-soft)] hover:text-[var(--inbox-accent)]",
                      !replyIsInternal && emailMode === "reply_all" && "bg-[var(--inbox-accent-soft)] text-[var(--inbox-accent)]",
                    )}
                    title="Reply all"
                    aria-label="Reply all"
                  >
                    <ReplyAll className="h-[18px] w-[18px]" strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onReplyModeChange(false)
                      onEmailModeChange("forward")
                      focusComposerWithScroll()
                    }}
                    className={cn(
                      "rounded-md p-1.5 text-[var(--inbox-text-secondary)] transition-colors hover:bg-[var(--inbox-accent-soft)] hover:text-[var(--inbox-accent)]",
                      !replyIsInternal && emailMode === "forward" && "bg-[var(--inbox-accent-soft)] text-[var(--inbox-accent)]",
                    )}
                    title="Forward"
                    aria-label="Forward"
                  >
                    <Forward className="h-[18px] w-[18px]" strokeWidth={2} />
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  onReplyModeChange(true)
                  focusComposerWithScroll()
                }}
                className={cn(
                  "rounded-md p-1.5 text-[var(--inbox-text-secondary)] transition-colors hover:bg-[var(--inbox-warning)]/15 hover:text-[var(--inbox-warning)]",
                  replyIsInternal && "bg-[var(--inbox-warning)]/12 text-[var(--inbox-warning)]",
                )}
                title="Internal note"
                aria-label="Internal note"
              >
                <StickyNote className="h-[18px] w-[18px]" strokeWidth={2} />
              </button>
            </div>
            <span
              className="mx-1 hidden h-5 w-px shrink-0 bg-[var(--inbox-divider)] sm:block"
              aria-hidden="true"
            />
            <span className="hidden max-w-[7rem] truncate text-[10px] text-[var(--inbox-chat-text-secondary)] sm:inline md:max-w-[10rem]">
              {channelLabel}
            </span>
            <span
              className="mx-1 hidden h-5 w-px shrink-0 bg-[var(--inbox-divider)] sm:block"
              aria-hidden="true"
            />
            <div className="flex flex-wrap items-center gap-0.5">
            <button
              type="button"
              onClick={() => {
                setClipPanelOpen((v) => !v)
                setAssistPanelOpen(false)
              }}
              disabled={attachmentUploading}
              className={cn(
                "rounded-md p-1.5 text-[var(--inbox-text-secondary)] transition-colors hover:bg-[var(--inbox-accent-soft)] hover:text-[var(--inbox-accent)]",
                clipPanelOpen && "bg-[var(--inbox-accent-soft)] text-[var(--inbox-accent)]",
                attachmentUploading && "opacity-50",
              )}
              title="Insert or attach"
            >
              {attachmentUploading ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <Paperclip className="h-[18px] w-[18px]" />}
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

            {cannedResponses.length > 0 && (
              <Popover open={cannedOpen} onOpenChange={onCannedOpenChange}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-[var(--inbox-text-secondary)] transition-colors hover:bg-[var(--inbox-accent-soft)] hover:text-[var(--inbox-accent)]"
                    title="Snippets"
                  >
                    <Zap className="h-[18px] w-[18px]" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-0" align="start" side="top" sideOffset={8}>
                  <Command>
                    <CommandInput placeholder="Search responses..." />
                    <CommandList>
                      <CommandEmpty>No matches</CommandEmpty>
                      <CommandGroup>
                        {cannedResponses.map((item) => (
                          <CommandItem
                            key={item.id}
                            value={`${item.label} ${item.content}`}
                            onSelect={() => handleInsertCanned(item)}
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{item.label}</p>
                              <p className="truncate text-xs text-[var(--inbox-text-secondary)]">{item.content}</p>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}

            {!isProcessing && (
              <button
                type="button"
                onClick={() => {
                  setAssistPanelOpen((v) => !v)
                  setClipPanelOpen(false)
                }}
                className={cn(
                  "rounded-md p-1.5 text-[var(--inbox-text-secondary)] transition-colors hover:bg-[var(--inbox-accent-soft)] hover:text-[var(--inbox-accent)]",
                  assistPanelOpen && "bg-[var(--inbox-accent-soft)] text-[var(--inbox-accent)]",
                )}
                title="Improve text — tone, clarity, translate…"
              >
                <Wand2 className="h-[18px] w-[18px]" />
              </button>
            )}

            {hasFannySuggestion && (
              <Popover
                open={fannyPopoverOpen}
                onOpenChange={(open) => {
                  setFannyPopoverOpen(open)
                  if (open) {
                    setClipPanelOpen(false)
                    setAssistPanelOpen(false)
                  }
                }}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "rounded-md p-1.5 text-[var(--inbox-accent)] transition-colors hover:bg-[var(--inbox-accent-soft)] hover:text-[var(--inbox-accent)]",
                      fannyPopoverOpen && "bg-[var(--inbox-accent-soft)]",
                    )}
                    title="Fanny suggested reply — apply to compose only (does not send)"
                    aria-label="Fanny suggested reply"
                  >
                    <MessageSquareQuote className="h-[18px] w-[18px]" strokeWidth={2} />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  side="top"
                  sideOffset={8}
                  className="flex max-h-[min(85vh,480px)] w-[min(calc(100vw-1.5rem),26rem)] flex-col overflow-hidden border-[var(--inbox-border)] bg-[var(--inbox-composer-background)] p-0 text-[var(--inbox-text)] shadow-md"
                >
                  <div className="border-b border-[var(--inbox-border)]/40 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--inbox-accent)]">
                      Fanny · suggested reply
                    </p>
                    {fannySuggestionTitle?.trim() ? (
                      <p className="mt-0.5 text-xs text-[var(--inbox-text-secondary)]">{fannySuggestionTitle}</p>
                    ) : null}
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto p-2">
                    <Textarea
                      value={fannyEditBuffer}
                      onChange={(e) => setFannyEditBuffer(e.target.value)}
                      rows={10}
                      className="min-h-[160px] max-h-[min(40vh,280px)] w-full resize-y rounded-md border border-[var(--inbox-border)]/40 bg-[var(--inbox-composer-input)] px-2.5 py-2 text-sm text-[var(--inbox-composer-input-text)] [field-sizing:fixed]"
                      placeholder="Edit suggested reply…"
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-1.5 border-t border-[var(--inbox-border)]/40 px-2 py-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-[var(--inbox-text-secondary)]"
                      onClick={() => setFannyPopoverOpen(false)}
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
                        setFannyPopoverOpen(false)
                      }}
                    >
                      Use reply
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {speech.supported && (
              <div className="flex items-center rounded-md border border-[var(--inbox-divider)] p-0.5">
                <button
                  type="button"
                  onClick={() => setVoiceMode("dictate")}
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded transition-all",
                    voiceMode === "dictate"
                      ? "bg-[var(--inbox-voice-dictate-bg)] text-[var(--inbox-voice-dictate-text)]"
                      : "text-[var(--inbox-text-secondary)] hover:bg-white/[0.06]",
                  )}
                  title="Dictate — speech is typed into the message"
                >
                  <Keyboard className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setVoiceMode("compose")}
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded transition-all",
                    voiceMode === "compose"
                      ? "bg-[var(--inbox-voice-compose-bg)] text-[var(--inbox-voice-compose-text)]"
                      : "text-[var(--inbox-text-secondary)] hover:bg-white/[0.06]",
                  )}
                  title="Intent — describe the reply you want (drafted from your words)"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleMicToggle}
                  disabled={isProcessing}
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded border-l border-[var(--inbox-divider)] transition-all",
                    speech.listening && voiceMode === "dictate" && "bg-[var(--inbox-voice-dictate-bg)] text-[var(--inbox-voice-dictate-text)]",
                    speech.listening && voiceMode === "compose" && "bg-[var(--inbox-voice-compose-bg)] text-[var(--inbox-voice-compose-text)]",
                    !speech.listening && "text-[var(--inbox-text-secondary)] hover:text-[var(--inbox-accent)]",
                  )}
                  title={
                    speech.listening
                      ? "Stop recording"
                      : voiceMode === "compose"
                        ? "Speak your intent"
                        : "Start dictation"
                  }
                >
                  {speech.listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                </button>
              </div>
            )}
            </div>

          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            {contentBeforeAssist !== null && (
              <button
                type="button"
                onClick={handleUndoAssist}
                className="rounded-md p-1.5 text-[var(--inbox-warning)] transition-colors hover:bg-[var(--inbox-warning)]/12"
                title="Undo last AI change"
                aria-label="Undo last AI change"
              >
                <RotateCcw className="h-[18px] w-[18px] shrink-0" />
              </button>
            )}

            <Button
              type="button"
              size="icon-sm"
              onClick={handleSend}
              disabled={replySending || !hasText || isProcessing || (!replyIsInternal && emailMode === "forward" && !emailForwardTo.trim())}
              title={`${sendActionLabel} · Ctrl+Enter or ⌘+Enter`}
              aria-label={sendActionLabel}
              className={cn(
                "shrink-0 rounded-md",
                replyIsInternal && "bg-[var(--inbox-warning)] text-white hover:bg-[var(--inbox-warning)]/90",
              )}
              variant={replyIsInternal ? undefined : "accent"}
            >
              {replySending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" strokeWidth={2} />
              )}
            </Button>
          </div>
        </div>

        {/* ── Intelligence panel (same pattern as Clip) ── */}
        {assistPanelOpen && !isProcessing && (
          <div className="rounded-lg border border-[var(--inbox-border)]/35 bg-white/[0.02] p-2">
            {!hasText && (
              <p className="mb-2 text-[11px] leading-relaxed text-[var(--inbox-text-secondary)]">
                Write something in the message to use improve and translate tools.
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <ClipCategory title="Improve">
                {SMART_TOOLS.map((tool) => (
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
              </ClipCategory>
              <ClipCategory title="Translate">
                {TRANSLATE_LANGUAGES.map((lang) => (
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
              </ClipCategory>
            </div>
          </div>
        )}

        {/* ── Clip / Insert panel ── */}
        {clipPanelOpen && (
          <div className="rounded-lg border border-[var(--inbox-border)]/35 bg-white/[0.02] p-2">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
              <ClipCategory title="Attach">
                <ClipAction label="File" icon={FileText} onClick={() => { fileInputRef.current?.click(); setClipPanelOpen(false); }} />
                <ClipAction label="Image" icon={Image} />
                <ClipAction label="Document" icon={FileText} />
                <ClipAction label="Link" icon={Link} />
              </ClipCategory>
              <ClipCategory title="From workspace">
                <ClipAction label="Client files" icon={User} />
                <ClipAction label="Project files" icon={Briefcase} />
                <ClipAction label="Billing" icon={Receipt} />
              </ClipCategory>
              <ClipCategory title="Show">
                <ClipAction label="Screenshot" icon={Image} />
                <ClipAction label="Reference" icon={Link} />
                <ClipAction label="Landing" icon={Globe} />
              </ClipCategory>
              <ClipCategory title="Generate">
                <ClipAction label="Proposal" icon={Sparkles} />
                <ClipAction label="Quote" icon={Receipt} />
                <ClipAction label="Template" icon={LayoutTemplate} />
              </ClipCategory>
              <ClipCategory title="Share">
                <ClipAction label="Contact" icon={User} />
                <ClipAction label="Location" icon={MapPin} />
                <ClipAction label="Meeting" icon={Calendar} />
                <ClipAction label="Payment" icon={CreditCard} />
              </ClipCategory>
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

function ClipCategory({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--inbox-muted)]">{title}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

function ClipAction({ label, icon: Icon, onClick }: { label: string; icon: LucideIcon; onClick?: () => void }) {
  const available = Boolean(onClick)
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!available}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors",
        available
          ? "text-[var(--inbox-text)] hover:bg-[var(--inbox-accent-soft)] hover:text-[var(--inbox-accent)]"
          : "text-[var(--inbox-text-secondary)]/50 cursor-default",
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  )
}
