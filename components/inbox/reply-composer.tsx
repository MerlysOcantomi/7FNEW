"use client"

import { useEffect, useRef, useState } from "react"
import {
  Send, Loader2, Mic, MicOff, Zap, Paperclip, ChevronDown, ChevronUp,
  Mail, MessageSquareText, Languages, X, FileText, Reply, ReplyAll, Forward,
  Sparkles, CheckCheck, AlignLeft, Briefcase, Heart, ArrowRight,
  MapPin, Calendar, Link, User, Camera, Image, Video
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useSpeechRecognition } from "@/hooks/use-speech-recognition"
import { useCannedResponses, type CannedResponse } from "@/hooks/use-canned-responses"

interface ComposerAdvancedItem {
  label: string
  hint: string
  tone?: "default" | "accent"
}

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

  return (
    <div className="shrink-0 border-t border-[var(--inbox-chat-border)] bg-[var(--inbox-chat-surface)]/96 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur supports-[backdrop-filter]:bg-[var(--inbox-chat-surface)]/92 md:px-6" data-composer="true">
      <div className="space-y-2 rounded-[var(--inbox-radius-premium)] border border-[var(--inbox-chat-border)]/60 bg-[var(--inbox-chat-surface)] p-4 shadow-[var(--inbox-shadow-premium)] md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant={!replyIsInternal && emailMode === "reply" ? "accent" : "outline"}
              onClick={() => { 
                onReplyModeChange(false); 
                onEmailModeChange("reply");
                focusComposerWithScroll();
              }}
              className="h-7 rounded-lg text-xs px-2.5"
            >
              <Reply className="h-3 w-3" />
              Reply
            </Button>
            {channel === "email" && (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant={!replyIsInternal && emailMode === "reply_all" ? "accent" : "outline"}
                  onClick={() => { 
                    onReplyModeChange(false); 
                    onEmailModeChange("reply_all");
                    focusComposerWithScroll();
                  }}
                  className="h-7 rounded-lg text-xs px-2.5"
                >
                  <ReplyAll className="h-3 w-3" />
                  Reply all
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={!replyIsInternal && emailMode === "forward" ? "accent" : "outline"}
                  onClick={() => { 
                    onReplyModeChange(false); 
                    onEmailModeChange("forward");
                    focusComposerWithScroll();
                  }}
                  className="h-7 rounded-lg text-xs px-2.5"
                >
                  <Forward className="h-3 w-3" />
                  Forward
                </Button>
              </>
            )}
            <Button
              type="button"
              size="sm"
              variant={replyIsInternal ? "secondary" : "outline"}
              onClick={() => {
                onReplyModeChange(true);
                focusComposerWithScroll();
              }}
              className={cn("h-7 rounded-lg text-xs px-2.5", replyIsInternal && "border-amber-200 bg-amber-100 text-amber-950 hover:bg-amber-200")}
            >
              Internal note
            </Button>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="rounded-full border border-[var(--inbox-chat-border)] bg-[var(--inbox-chat-background)] px-2.5 py-1 text-[10px] font-medium text-[var(--inbox-chat-text-secondary)]">
              {channelLabel}
            </span>
            <span className="rounded-full border border-[var(--inbox-chat-border)] bg-[var(--inbox-chat-surface)] px-2.5 py-1 text-[10px] font-medium text-[var(--inbox-chat-text-secondary)]">
              {replyIsInternal
                ? "Internal"
                : emailMode === "forward"
                  ? "Forward"
                  : emailMode === "reply_all"
                    ? "Reply all"
                    : "Reply"}
            </span>
          </div>
        </div>

        {!replyIsInternal && composerConfig.subjectPreview && (
          <div className="rounded-lg border border-[var(--inbox-divider)] bg-[var(--inbox-background)]/30 px-2.5 py-1.5">
            <div className="flex items-center gap-2">
              <Mail className="h-3 w-3 text-[var(--inbox-text-secondary)]" />
              <span className="text-[9px] font-medium uppercase tracking-wider text-[var(--inbox-muted)]">Subject:</span>
              <span className="truncate text-xs font-medium text-[var(--inbox-text)]">{composerConfig.subjectPreview}</span>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
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
              rows={2}
              className={cn(
                "min-h-[72px] max-h-[220px] resize-none overflow-y-auto rounded-xl border border-[var(--inbox-chat-border)] bg-[var(--inbox-chat-surface)] px-4 py-3 text-sm text-[var(--inbox-chat-text)] placeholder:text-[var(--inbox-chat-text-secondary)] transition-all duration-200 focus-visible:border-[var(--inbox-chat-bubble-outbound)] focus-visible:ring-2 focus-visible:ring-[var(--inbox-chat-bubble-outbound)]/20 shadow-sm",
                replyIsInternal && "border-amber-200 bg-amber-50/60 focus-visible:border-amber-400 focus-visible:ring-amber-400/20",
                speech.listening && voiceMode === "dictate" && "border-red-300 bg-red-50/30 ring-2 ring-red-300/30",
                speech.listening && voiceMode === "compose" && "border-violet-300 bg-violet-50/30 ring-2 ring-violet-300/30",
                isProcessing && "opacity-60 cursor-not-allowed",
              )}
              disabled={isProcessing}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) handleSend()
              }}
            />
            {isProcessing && (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/70 backdrop-blur-sm">
                <div className="flex items-center gap-2.5 rounded-xl border border-[var(--inbox-border)] bg-[var(--inbox-surface)] px-4 py-2.5 shadow-[var(--inbox-panel-shadow-sm)]">
                  <div className="relative flex items-center justify-center">
                    <Loader2 className="h-4 w-4 animate-spin text-[var(--inbox-accent)]" />
                    <div className="absolute inset-0 h-4 w-4 animate-ping rounded-full bg-[var(--inbox-accent)]/20" />
                  </div>
                  <span className="text-sm font-medium text-[var(--inbox-text)]">
                    {assistLoading === "compose_from_intent" ? "Composing your reply..." : "Rewriting..."}
                  </span>
                </div>
              </div>
            )}
            {speech.listening && voiceMode === "compose" && (
              <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2.5 rounded-xl border border-violet-200 bg-violet-50/90 px-3 py-2.5 text-sm text-violet-700 backdrop-blur-sm">
                <div className="relative flex items-center justify-center">
                  <Mic className="h-4 w-4 animate-pulse" />
                  <div className="absolute inset-0 h-4 w-4 animate-ping rounded-full bg-violet-400/30" />
                </div>
                <span className="flex-1 truncate font-medium">
                  {speech.transcript || "Listening... describe what you want to say"}
                </span>
                <button
                  type="button"
                  onClick={() => speech.stop()}
                  className="shrink-0 rounded-lg bg-violet-200/80 px-2.5 py-1 text-xs font-medium text-violet-800 transition-colors hover:bg-violet-300"
                >
                  Done
                </button>
              </div>
            )}
            {speech.listening && voiceMode === "dictate" && (
              <div className="absolute bottom-3 right-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50/90 px-3 py-1.5 text-xs font-medium text-red-600 backdrop-blur-sm">
                <div className="relative flex items-center justify-center">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                  <div className="absolute inset-0 h-2 w-2 animate-ping rounded-full bg-red-400" />
                </div>
                Recording...
              </div>
            )}
          </div>

          {/* ── Smart tools row ── */}
          {(hasText || prevContentRef !== null) && !isProcessing && (
            <div className="flex items-center gap-1.5 overflow-x-auto px-0.5">
              {SMART_TOOLS.map((tool) => (
                <button
                  key={tool.action}
                  type="button"
                  onClick={() => handleAssist(tool.action)}
                  disabled={!hasText}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--inbox-divider)] bg-[var(--inbox-surface)] px-2 py-1 text-xs font-medium text-[var(--inbox-text-secondary)] transition-all duration-150 hover:border-[var(--inbox-accent)]/30 hover:bg-[var(--inbox-accent-soft)]/40 hover:text-[var(--inbox-accent)] disabled:opacity-40 disabled:hover:border-[var(--inbox-divider)] disabled:hover:bg-[var(--inbox-surface)] disabled:hover:text-[var(--inbox-text-secondary)]"
                >
                  <tool.icon className="h-3 w-3" />
                  {tool.label}
                </button>
              ))}

              {/* Translate button */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    disabled={!hasText}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--inbox-divider)] bg-[var(--inbox-surface)] px-2 py-1 text-xs font-medium text-[var(--inbox-text-secondary)] transition-all duration-150 hover:border-[var(--inbox-accent)]/30 hover:bg-[var(--inbox-accent-soft)]/40 hover:text-[var(--inbox-accent)] disabled:opacity-40 disabled:hover:border-[var(--inbox-divider)] disabled:hover:bg-[var(--inbox-surface)] disabled:hover:text-[var(--inbox-text-secondary)]"
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
                        className="w-full rounded-md px-2.5 py-1.5 text-left text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
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
                  className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 transition-all duration-150 hover:bg-amber-100"
                >
                  Undo changes
                </button>
              )}
            </div>
          )}

          {/* ── Toolbar row ── */}
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--inbox-divider)] bg-[var(--inbox-background)]/30 px-3 py-1.5">
            {cannedResponses.length > 0 && (
              <Popover open={cannedOpen} onOpenChange={onCannedOpenChange}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 rounded-md text-xs px-2.5"
                    title="Quick responses"
                  >
                    <Zap className="h-3 w-3" />
                    Snippets
                  </Button>
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
                              <p className="truncate text-xs text-muted-foreground">{item.content}</p>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={cn("h-7 rounded-md text-xs px-2.5", attachmentUploading && "opacity-60")}
                  disabled={attachmentUploading}
                >
                  {attachmentUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />}
                  {attachmentUploading ? "Uploading…" : "Attach"}
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                <DropdownMenuItem 
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2"
                >
                  <FileText className="h-4 w-4 text-[var(--inbox-text-secondary)]" />
                  <div className="flex flex-col">
                    <span>Upload file</span>
                    <span className="text-[10px] text-[var(--inbox-muted)]">Documents, images, audio</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 text-[var(--inbox-muted)]" disabled>
                  <MapPin className="h-4 w-4" />
                  <div className="flex flex-col">
                    <span>Share location</span>
                    <span className="text-[10px]">Send current location</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 text-[var(--inbox-muted)]" disabled>
                  <Camera className="h-4 w-4" />
                  <div className="flex flex-col">
                    <span>Take photo</span>
                    <span className="text-[10px]">Camera capture</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 text-[var(--inbox-muted)]" disabled>
                  <Video className="h-4 w-4" />
                  <div className="flex flex-col">
                    <span>Record video</span>
                    <span className="text-[10px]">Video message</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 text-[var(--inbox-muted)]" disabled>
                  <User className="h-4 w-4" />
                  <div className="flex flex-col">
                    <span>Share contact</span>
                    <span className="text-[10px]">Send contact card</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 text-[var(--inbox-muted)]" disabled>
                  <Calendar className="h-4 w-4" />
                  <div className="flex flex-col">
                    <span>Schedule meeting</span>
                    <span className="text-[10px]">Calendar integration</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 text-[var(--inbox-muted)]" disabled>
                  <Link className="h-4 w-4" />
                  <div className="flex flex-col">
                    <span>Insert link</span>
                    <span className="text-[10px]">Web link or resource</span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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

            {/* ── Voice: Dictate / Compose toggle + mic ── */}
            {speech.supported && (
              <div className="flex items-center rounded-md border border-[var(--inbox-border)] bg-[var(--inbox-surface)]">
                <button
                  type="button"
                  onClick={() => setVoiceMode("dictate")}
                  className={cn(
                    "rounded-l-md px-2.5 py-1.5 text-xs font-medium transition-all duration-150",
                    voiceMode === "dictate"
                      ? "bg-red-50 text-red-700"
                      : "text-[var(--inbox-text-secondary)] hover:bg-[var(--inbox-background)]",
                  )}
                  title="Dictation mode: speech becomes text directly"
                >
                  <div className="flex items-center gap-1">
                    <div className={cn(
                      "h-1.5 w-1.5 rounded-full transition-colors",
                      voiceMode === "dictate" && speech.listening ? "bg-red-500 animate-pulse" : "bg-red-400",
                      voiceMode !== "dictate" && "bg-gray-300"
                    )} />
                    Dictate
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setVoiceMode("compose")}
                  className={cn(
                    "border-l border-[var(--inbox-border)] px-2.5 py-1.5 text-xs font-medium transition-all duration-150",
                    voiceMode === "compose"
                      ? "bg-violet-50 text-violet-700"
                      : "text-[var(--inbox-text-secondary)] hover:bg-[var(--inbox-background)]",
                  )}
                  title="Compose mode: describe your intent and AI writes the reply"
                >
                  <div className="flex items-center gap-1">
                    <Sparkles className={cn(
                      "h-3 w-3 transition-colors",
                      voiceMode === "compose" ? "text-violet-600" : "text-gray-400"
                    )} />
                    Compose
                  </div>
                </button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleMicToggle}
                  disabled={isProcessing}
                  className={cn(
                    "h-7 rounded-l-none rounded-r-md border-l border-[var(--inbox-border)] px-2.5 py-1.5 transition-all duration-150",
                    speech.listening && voiceMode === "dictate" && "bg-red-100 text-red-700 hover:bg-red-200",
                    speech.listening && voiceMode === "compose" && "bg-violet-100 text-violet-700 hover:bg-violet-200",
                    !speech.listening && "hover:bg-[var(--inbox-accent-soft)] hover:text-[var(--inbox-accent)]",
                  )}
                  title={speech.listening ? "Stop recording" : voiceMode === "compose" ? "Describe your intent" : "Start dictation"}
                >
                  {speech.listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                </Button>
              </div>
            )}

            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setAdvancedOpen((value) => !value)}
              className="ml-auto h-7 rounded-md text-xs px-2"
            >
              <MessageSquareText className="h-3 w-3" />
              More
              {advancedOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </div>

          {/* ── Attachments ── */}
          {attachments.length > 0 && (
            <div className="rounded-lg border border-[var(--inbox-divider)] bg-[var(--inbox-background)]/30 p-2">
              <p className="mb-1.5 text-[9px] font-medium uppercase tracking-wider text-[var(--inbox-muted)]">
                Attachments ({attachments.length})
              </p>
              <div className="flex flex-wrap gap-1">
                {attachments.map((att) => (
                  <span
                    key={att.url}
                    className="inline-flex items-center gap-1 rounded-full border border-[var(--inbox-divider)] bg-[var(--inbox-surface)] px-2 py-0.5 text-[10px] font-medium text-[var(--inbox-text-secondary)]"
                  >
                    <FileText className="h-3 w-3 shrink-0" />
                    <span className="max-w-[120px] truncate">{att.filename}</span>
                    <span className="text-[9px] text-[var(--inbox-muted)]">
                      {att.size < 1024 ? `${att.size} B` : att.size < 1048576 ? `${Math.round(att.size / 1024)} KB` : `${(att.size / 1048576).toFixed(1)} MB`}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveAttachment(att.url)}
                      className="ml-0.5 rounded-full p-0.5 hover:bg-[var(--inbox-background)]"
                      title="Remove"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Forward to ── */}
          {!replyIsInternal && channel === "email" && emailMode === "forward" && (
            <div className="rounded-lg border border-[var(--inbox-divider)] bg-[var(--inbox-background)]/30 px-2.5 py-2">
              <label className="text-[9px] font-medium uppercase tracking-wider text-[var(--inbox-muted)]">
                Forward to
              </label>
              <Input
                type="text"
                value={emailForwardTo}
                onChange={(e) => onEmailForwardToChange(e.target.value)}
                placeholder="recipient@example.com"
                className="mt-1 h-7 text-xs"
              />
            </div>
          )}

          {/* ── Advanced options ── */}
          {advancedOpen && (
            <div className="rounded-lg border border-[var(--inbox-divider)] bg-[var(--inbox-background)]/30 px-2.5 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[9px] font-medium uppercase tracking-wider text-[var(--inbox-muted)]">
                  More options
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {speech.listening
                    ? voiceMode === "compose" ? "Listening..." : "Dictating..."
                    : "Ctrl+Enter to send"}
                </span>
              </div>

              {!replyIsInternal && channel === "email" && (
                <div className="mt-2 space-y-1.5">
                  <div>
                    <label className="text-[9px] font-medium uppercase tracking-wider text-[var(--inbox-muted)]">CC</label>
                    <Input
                      type="text"
                      value={emailCc}
                      onChange={(e) => onEmailCcChange(e.target.value)}
                      placeholder="cc@example.com"
                      className="mt-0.5 h-7 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-medium uppercase tracking-wider text-[var(--inbox-muted)]">BCC</label>
                    <Input
                      type="text"
                      value={emailBcc}
                      onChange={(e) => onEmailBccChange(e.target.value)}
                      placeholder="bcc@example.com"
                      className="mt-0.5 h-7 text-xs"
                    />
                  </div>
                </div>
              )}

              {composerConfig.advancedItems.length > 0 && (
                <div className="mt-2 grid gap-1.5 md:grid-cols-2">
                  {composerConfig.advancedItems.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-md border border-[var(--inbox-divider)] bg-[var(--inbox-surface)] px-2.5 py-1.5 opacity-60"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-medium text-[var(--inbox-text)]">{item.label}</p>
                        <span className="shrink-0 rounded-full border border-[var(--inbox-divider)] bg-[var(--inbox-background)] px-1.5 py-0.5 text-[8px] font-medium text-[var(--inbox-muted)]">
                          Planned
                        </span>
                      </div>
                      <p className="mt-0.5 text-[10px] leading-relaxed text-[var(--inbox-text-secondary)]">{item.hint}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Footer: status + send ── */}
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] text-muted-foreground truncate">
              {speech.listening
                ? voiceMode === "compose"
                  ? "Describe your intent..."
                  : "Dictating..."
                : "Ctrl+Enter to send"}
            </span>
            <Button
              type="button"
              onClick={handleSend}
              disabled={replySending || !hasText || isProcessing || (!replyIsInternal && emailMode === "forward" && !emailForwardTo.trim())}
              className={cn(
                "h-8 min-w-[120px] rounded-md text-xs px-3",
                replyIsInternal && "bg-amber-900 text-white hover:bg-amber-950",
              )}
              variant={replyIsInternal ? undefined : "accent"}
            >
              {replySending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : emailMode === "forward" && !replyIsInternal ? (
                <Forward className="h-3 w-3" />
              ) : (
                <Send className="h-3 w-3" />
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
        </div>

        {assistError && (
          <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-2.5 py-1">
            <p className="flex-1 text-[11px] text-red-700">{assistError}</p>
            <button
              type="button"
              onClick={() => setAssistError(null)}
              className="shrink-0 rounded p-0.5 text-red-400 hover:text-red-600"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        )}
        {replyStatus && !assistError && <p className="text-[11px] text-muted-foreground">{replyStatus}</p>}
      </div>
    </div>
  )
}

function getComposerConfig({
  channel,
  channelLabel,
  replyIsInternal,
  detectedLanguage,
  subject,
}: {
  channel: string
  channelLabel: string
  replyIsInternal: boolean
  detectedLanguage?: string | null
  subject?: string | null
}) {
  if (replyIsInternal) {
    return {
      placeholder: "Add an internal note...",
      sendLabel: "Save note",
      subjectPreview: null,
      advancedItems: [
        { label: "Structured note blocks", hint: "Prepare sections for risks, decisions or follow-up without changing the main composer.", tone: "accent" as const },
        { label: "Saved note templates", hint: "Team note templates can grow from the existing snippets entry point." },
      ] satisfies ComposerAdvancedItem[],
    }
  }

  switch (channel) {
    case "email":
      return {
        placeholder: "Write your reply...",
        sendLabel: "Send reply",
        subjectPreview: subject || "No subject available",
        advancedItems: [
          { label: "Edit subject", hint: "The current subject is already visible above and can become editable without changing the composer shell." },
          { label: "Save draft and schedule send", hint: "Future send options can branch from the footer instead of adding more primary buttons." },
        ] satisfies ComposerAdvancedItem[],
      }
    case "whatsapp":
      return {
        placeholder: "Type your message...",
        sendLabel: "Send message",
        subjectPreview: null,
        advancedItems: [
          { label: "Media attachments", hint: "Images, documents and audio can render in a future attachment tray here." },
          { label: "Follow-up handoff", hint: "Scheduling or business follow-up should stay in ActionsCard, not overload the composer." },
        ] satisfies ComposerAdvancedItem[],
      }
    case "web_chat":
    case "portal":
      return {
        placeholder: "Type your message...",
        sendLabel: "Send message",
        subjectPreview: null,
        advancedItems: [
          { label: "Quick replies", hint: "Snippets stay available for faster customer responses.", tone: "accent" as const },
          { label: "Channel-safe send options", hint: "Only options valid for this channel should surface here as capabilities mature." },
        ] satisfies ComposerAdvancedItem[],
      }
    default:
      return {
        placeholder: "Write your message...",
        sendLabel: "Send reply",
        subjectPreview: null,
        advancedItems: [
          { label: "Channel-aware send options", hint: "Additional reply modes can appear here only when the channel supports them.", tone: "accent" as const },
        ] satisfies ComposerAdvancedItem[],
      }
  }
}
