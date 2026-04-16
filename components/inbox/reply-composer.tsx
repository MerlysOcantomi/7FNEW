"use client"

import { useEffect, useRef, useState } from "react"
import {
  Send, Loader2, Mic, MicOff, Zap, Paperclip, ChevronDown, ChevronUp,
  Mail, Languages, X, FileText, Forward,
  Sparkles, CheckCheck, AlignLeft, Briefcase, Heart, ArrowRight,
  MapPin, Calendar, Link, User, Image, Globe, LayoutTemplate,
  Receipt, CreditCard, type LucideIcon,
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
}

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
}: ReplyComposerProps) {
  const speech = useSpeechRecognition()
  const baseTextRef = useRef("")
  const userInterruptedRef = useRef(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [voiceMode, setVoiceMode] = useState<VoiceMode>("dictate")
  const [assistLoading, setAssistLoading] = useState<AssistAction | null>(null)
  const [assistError, setAssistError] = useState<string | null>(null)
  const [prevContentRef, setPrevContentRef] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const composingIntentRef = useRef(false)
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    setPrevContentRef(null)
    onSend()
  }

  async function handleAssist(action: AssistAction, text?: string) {
    const input = text ?? replyContent.trim()
    if (!input) return

    const savedContent = replyContent
    setAssistLoading(action)
    setAssistError(null)

    if (action !== "compose_from_intent") {
      setPrevContentRef(savedContent)
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
          setPrevContentRef(savedContent)
        }
        onReplyContentChange(json.data.result)
      } else {
        const errorMsg = json.error?.message || "Could not process your request"
        showAssistError(errorMsg)
        if (action === "compose_from_intent") {
          onReplyContentChange(input)
          setPrevContentRef(null)
        }
      }
    } catch {
      showAssistError("Connection error — your text was not changed")
      if (action === "compose_from_intent") {
        onReplyContentChange(input)
        setPrevContentRef(null)
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
    setPrevContentRef(savedContent)

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
    if (prevContentRef !== null) {
      onReplyContentChange(prevContentRef)
      setPrevContentRef(null)
    }
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
      onReplyContentChange(finalText)
    }
    userInterruptedRef.current = false
    speech.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speech.listening])

  const [clipPanelOpen, setClipPanelOpen] = useState(false)

  const showEmailOptions = !replyIsInternal && channel === "email"

  return (
    <div className="shrink-0 border-t border-[var(--inbox-chat-border)] bg-[var(--inbox-chat-background)] px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] md:px-6" data-composer="true">
      <div className="space-y-2 rounded-[var(--inbox-radius-premium)] border border-[var(--inbox-chat-border)]/80 bg-[var(--inbox-composer-background)] p-4 shadow-[var(--inbox-shadow-premium)] md:p-5">

        {/* ── Mode selector ── */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => { onReplyModeChange(false); onEmailModeChange("reply"); focusComposerWithScroll(); }}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                !replyIsInternal && emailMode === "reply"
                  ? "bg-[var(--inbox-accent-soft)] text-[var(--inbox-accent)]"
                  : "text-[var(--inbox-text-secondary)] hover:text-[var(--inbox-text)]",
              )}
            >
              Reply
            </button>
            {channel === "email" && (
              <>
                <button
                  type="button"
                  onClick={() => { onReplyModeChange(false); onEmailModeChange("reply_all"); focusComposerWithScroll(); }}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                    !replyIsInternal && emailMode === "reply_all"
                      ? "bg-[var(--inbox-accent-soft)] text-[var(--inbox-accent)]"
                      : "text-[var(--inbox-text-secondary)] hover:text-[var(--inbox-text)]",
                  )}
                >
                  Reply all
                </button>
                <button
                  type="button"
                  onClick={() => { onReplyModeChange(false); onEmailModeChange("forward"); focusComposerWithScroll(); }}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                    !replyIsInternal && emailMode === "forward"
                      ? "bg-[var(--inbox-accent-soft)] text-[var(--inbox-accent)]"
                      : "text-[var(--inbox-text-secondary)] hover:text-[var(--inbox-text)]",
                  )}
                >
                  Forward
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => { onReplyModeChange(true); focusComposerWithScroll(); }}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                replyIsInternal
                  ? "bg-[var(--inbox-warning)]/12 text-[var(--inbox-warning)]"
                  : "text-[var(--inbox-text-secondary)] hover:text-[var(--inbox-text)]",
              )}
            >
              Internal note
            </button>
          </div>
          <span className="text-[10px] text-[var(--inbox-chat-text-secondary)]">
            {channelLabel}
          </span>
        </div>

        {/* ── Email options: Subject, CC, BCC, Forward to ── */}
        {showEmailOptions && (
          <div className="space-y-1.5 rounded-lg border border-[var(--inbox-divider)] bg-[var(--surface-3)] px-3 py-2">
            {composerConfig.subjectPreview && (
              <div className="flex items-center gap-2">
                <Mail className="h-3 w-3 shrink-0 text-[var(--inbox-text-secondary)]" />
                <span className="text-[10px] font-medium text-[var(--inbox-muted)]">Subject</span>
                <span className="truncate text-xs text-[var(--inbox-text)]">{composerConfig.subjectPreview}</span>
              </div>
            )}
            {emailMode === "forward" && (
              <div className="flex items-center gap-2">
                <Forward className="h-3 w-3 shrink-0 text-[var(--inbox-text-secondary)]" />
                <span className="text-[10px] font-medium text-[var(--inbox-muted)]">To</span>
                <Input
                  type="text"
                  value={emailForwardTo}
                  onChange={(e) => onEmailForwardToChange(e.target.value)}
                  placeholder="recipient@example.com"
                  className="h-6 flex-1 border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0"
                />
              </div>
            )}
            <button
              type="button"
              onClick={() => setAdvancedOpen((v) => !v)}
              className="flex items-center gap-1 text-[10px] font-medium text-[var(--inbox-accent)] hover:text-[var(--inbox-accent)]/80 transition-colors"
            >
              {advancedOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {advancedOpen ? "Hide CC / BCC" : "CC / BCC"}
            </button>
            {advancedOpen && (
              <div className="space-y-1.5 border-t border-[var(--inbox-divider)] pt-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-7 text-[10px] font-medium text-[var(--inbox-muted)]">CC</span>
                  <Input
                    type="text"
                    value={emailCc}
                    onChange={(e) => onEmailCcChange(e.target.value)}
                    placeholder="cc@example.com"
                    className="h-6 flex-1 border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-7 text-[10px] font-medium text-[var(--inbox-muted)]">BCC</span>
                  <Input
                    type="text"
                    value={emailBcc}
                    onChange={(e) => onEmailBccChange(e.target.value)}
                    placeholder="bcc@example.com"
                    className="h-6 flex-1 border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Fanny reply tools ── */}
        {!isProcessing && (
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {SMART_TOOLS.map((tool) => (
              <button
                key={tool.action}
                type="button"
                onClick={() => handleAssist(tool.action)}
                disabled={!hasText}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--inbox-divider)] bg-[var(--surface-3)] px-2.5 py-1 text-[11px] font-medium text-[var(--inbox-text-secondary)] transition-all hover:border-[var(--inbox-accent)]/30 hover:bg-[var(--inbox-accent-soft)]/40 hover:text-[var(--inbox-accent)] disabled:opacity-30"
              >
                <tool.icon className="h-3 w-3" />
                {tool.label}
              </button>
            ))}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={!hasText}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--inbox-divider)] bg-[var(--surface-3)] px-2.5 py-1 text-[11px] font-medium text-[var(--inbox-text-secondary)] transition-all hover:border-[var(--inbox-accent)]/30 hover:bg-[var(--inbox-accent-soft)]/40 hover:text-[var(--inbox-accent)] disabled:opacity-30"
                >
                  <Languages className="h-3 w-3" />
                  Translate
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-40 p-1" align="start" side="top" sideOffset={4}>
                <div className="space-y-0.5">
                  {[
                    { code: "English", label: "English" },
                    { code: "Spanish", label: "Español" },
                    { code: "German", label: "Deutsch" },
                    { code: "French", label: "Français" },
                    { code: "Portuguese", label: "Português" },
                  ].map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => handleTranslate(lang.code)}
                      className="w-full rounded-md px-2.5 py-1.5 text-left text-xs font-medium text-[var(--inbox-text)] transition-colors hover:bg-[var(--inbox-accent-soft)] hover:text-[var(--inbox-accent)]"
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            {prevContentRef !== null && (
              <button
                type="button"
                onClick={handleUndoAssist}
                className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--inbox-warning)]/30 bg-[var(--inbox-warning)]/10 px-2.5 py-1 text-[11px] font-medium text-[var(--inbox-warning)] hover:bg-[var(--inbox-warning)]/20"
              >
                Undo changes
              </button>
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
            rows={3}
            className={cn(
              "min-h-[88px] max-h-[240px] resize-none overflow-y-auto rounded-xl border border-[var(--inbox-chat-border)] bg-[var(--inbox-composer-input)] px-4 py-3 text-sm text-[var(--inbox-chat-text)] placeholder:text-[var(--inbox-chat-text-secondary)] transition-all duration-200 focus-visible:border-[var(--inbox-chat-bubble-outbound)] focus-visible:ring-2 focus-visible:ring-[var(--inbox-chat-bubble-outbound)]/20 shadow-sm",
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
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-[var(--inbox-surface)]/70 backdrop-blur-sm">
              <div className="flex items-center gap-2.5 rounded-xl border border-[var(--inbox-border)] bg-[var(--inbox-surface)] px-4 py-2.5 shadow-[var(--inbox-panel-shadow-sm)]">
                <Loader2 className="h-4 w-4 animate-spin text-[var(--inbox-accent)]" />
                <span className="text-sm font-medium text-[var(--inbox-text)]">
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
                className="inline-flex items-center gap-1 rounded-full border border-[var(--inbox-divider)] bg-[var(--surface-3)] px-2 py-0.5 text-[10px] font-medium text-[var(--inbox-text-secondary)]"
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

        {/* ── Bottom bar: clip, snippets, voice, send ── */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setClipPanelOpen((v) => !v)}
            disabled={attachmentUploading}
            className={cn(
              "rounded-lg p-2 text-[var(--inbox-text-secondary)] transition-colors hover:bg-[var(--inbox-accent-soft)] hover:text-[var(--inbox-accent)]",
              clipPanelOpen && "bg-[var(--inbox-accent-soft)] text-[var(--inbox-accent)]",
              attachmentUploading && "opacity-50",
            )}
            title="Insert or attach"
          >
            {attachmentUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
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
                  className="rounded-lg p-2 text-[var(--inbox-text-secondary)] transition-colors hover:bg-[var(--inbox-accent-soft)] hover:text-[var(--inbox-accent)]"
                  title="Snippets"
                >
                  <Zap className="h-4 w-4" />
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

          {speech.supported && (
            <div className="flex items-center rounded-lg border border-[var(--inbox-divider)]">
              <button
                type="button"
                onClick={() => setVoiceMode("dictate")}
                className={cn(
                  "rounded-l-lg px-2 py-1.5 text-[10px] font-medium transition-all",
                  voiceMode === "dictate"
                    ? "bg-[var(--inbox-voice-dictate-bg)] text-[var(--inbox-voice-dictate-text)]"
                    : "text-[var(--inbox-text-secondary)] hover:bg-[var(--surface-3)]",
                )}
              >
                Dictate
              </button>
              <button
                type="button"
                onClick={() => setVoiceMode("compose")}
                className={cn(
                  "border-l border-[var(--inbox-divider)] px-2 py-1.5 text-[10px] font-medium transition-all",
                  voiceMode === "compose"
                    ? "bg-[var(--inbox-voice-compose-bg)] text-[var(--inbox-voice-compose-text)]"
                    : "text-[var(--inbox-text-secondary)] hover:bg-[var(--surface-3)]",
                )}
              >
                <Sparkles className="mr-0.5 inline h-2.5 w-2.5" />
                Compose
              </button>
              <button
                type="button"
                onClick={handleMicToggle}
                disabled={isProcessing}
                className={cn(
                  "rounded-r-lg border-l border-[var(--inbox-divider)] p-1.5 transition-all",
                  speech.listening && voiceMode === "dictate" && "bg-[var(--inbox-voice-dictate-bg)] text-[var(--inbox-voice-dictate-text)]",
                  speech.listening && voiceMode === "compose" && "bg-[var(--inbox-voice-compose-bg)] text-[var(--inbox-voice-compose-text)]",
                  !speech.listening && "text-[var(--inbox-text-secondary)] hover:text-[var(--inbox-accent)]",
                )}
                title={speech.listening ? "Stop recording" : voiceMode === "compose" ? "Describe your intent" : "Start dictation"}
              >
                {speech.listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
              </button>
            </div>
          )}

          <span className="ml-auto text-[10px] text-[var(--inbox-text-secondary)] hidden sm:inline">
            {speech.listening
              ? voiceMode === "compose" ? "Describe your intent..." : "Dictating..."
              : "Ctrl+Enter to send"}
          </span>

          <Button
            type="button"
            onClick={handleSend}
            disabled={replySending || !hasText || isProcessing || (!replyIsInternal && emailMode === "forward" && !emailForwardTo.trim())}
            className={cn(
              "h-8 rounded-lg text-xs px-4",
              replyIsInternal && "bg-[var(--inbox-warning)] text-white hover:bg-[var(--inbox-warning)]/90",
            )}
            variant={replyIsInternal ? undefined : "accent"}
          >
            {replySending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            {replyIsInternal
              ? "Save note"
              : emailMode === "forward"
                ? "Forward"
                : emailMode === "reply_all"
                  ? "Reply all"
                  : composerConfig.sendLabel}
          </Button>
        </div>

        {/* ── Clip / Insert panel ── */}
        {clipPanelOpen && (
          <div className="rounded-xl border border-[var(--inbox-divider)] bg-[var(--surface-3)] p-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
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
