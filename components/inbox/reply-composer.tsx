"use client"

import { useEffect, useRef, useState } from "react"
import { Send, Loader2, Mic, MicOff, Zap, Paperclip, ChevronDown, ChevronUp, Mail, MessageSquareText, Clock3, Languages } from "lucide-react"
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

interface ComposerAdvancedItem {
  label: string
  hint: string
  tone?: "default" | "accent"
}

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
  onReplyModeChange: (isInternal: boolean) => void
  onReplyContentChange: (value: string) => void
  onCannedOpenChange: (open: boolean) => void
  onSend: () => void
}

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
  onReplyModeChange,
  onReplyContentChange,
  onCannedOpenChange,
  onSend,
}: ReplyComposerProps) {
  const speech = useSpeechRecognition()
  const baseTextRef = useRef("")
  const userInterruptedRef = useRef(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [attachmentsOpen, setAttachmentsOpen] = useState(false)

  const { items: cannedResponses } = useCannedResponses()
  const composerConfig = getComposerConfig({
    channel,
    channelLabel,
    replyIsInternal,
    detectedLanguage,
    subject,
  })

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
    baseTextRef.current = replyContent
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
    onSend()
  }

  useEffect(() => {
    if (!speech.listening || !speech.transcript) return
    const separator = baseTextRef.current && !baseTextRef.current.endsWith(" ") ? " " : ""
    onReplyContentChange(baseTextRef.current + separator + speech.transcript)
  }, [speech.transcript, speech.listening, onReplyContentChange])

  useEffect(() => {
    if (speech.listening || !speech.transcript) return
    const separator = baseTextRef.current && !baseTextRef.current.endsWith(" ") ? " " : ""
    const finalText = baseTextRef.current + separator + speech.transcript
    baseTextRef.current = finalText
    if (!userInterruptedRef.current) {
      onReplyContentChange(finalText)
    }
    userInterruptedRef.current = false
    speech.reset()
  }, [speech.listening, speech.transcript, speech.reset, onReplyContentChange])

  return (
    <div className="shrink-0 border-t border-[var(--inbox-divider)] bg-[var(--inbox-surface)]/96 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur supports-[backdrop-filter]:bg-[var(--inbox-surface)]/92 md:px-5">
      <div className="space-y-3 rounded-[var(--inbox-radius-panel)] border border-[var(--inbox-border)] bg-[var(--inbox-surface)] p-3 shadow-[var(--inbox-panel-shadow-sm)] md:p-3.5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={replyIsInternal ? "outline" : "accent"}
                onClick={() => onReplyModeChange(false)}
                className="rounded-[var(--inbox-radius-control)]"
              >
                Reply
              </Button>
              <Button
                type="button"
                size="sm"
                variant={replyIsInternal ? "secondary" : "outline"}
                onClick={() => onReplyModeChange(true)}
                className={cn("rounded-[var(--inbox-radius-control)]", replyIsInternal && "border-amber-200 bg-amber-100 text-amber-950 hover:bg-amber-200")}
              >
                Internal note
              </Button>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--inbox-muted)]">
                {composerConfig.headerLabel}
              </p>
              <p className="mt-1 line-clamp-1 text-xs leading-relaxed text-[var(--inbox-text-secondary)]">
                {composerConfig.headerDescription}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="rounded-full border border-[var(--inbox-divider)] bg-[var(--inbox-background)] px-2.5 py-1 text-[10px] font-medium text-[var(--inbox-text-secondary)]">
              {channelLabel}
            </span>
            <span className="rounded-full border border-[var(--inbox-divider)] bg-[var(--inbox-surface)] px-2.5 py-1 text-[10px] font-medium text-[var(--inbox-text-secondary)]">
              {replyIsInternal ? "Internal workflow" : "Outbound reply"}
            </span>
          </div>
        </div>

        {!replyIsInternal && composerConfig.subjectPreview && (
          <div className="rounded-[10px] border border-[var(--inbox-divider)] bg-[var(--inbox-background)]/44 px-3 py-2.5">
            <div className="flex items-start gap-2">
              <Mail className="mt-0.5 h-3.5 w-3.5 text-[var(--inbox-text-secondary)]" />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--inbox-muted)]">
                  Subject
                </p>
                <p className="mt-1 truncate text-sm font-medium text-[var(--inbox-text)]">{composerConfig.subjectPreview}</p>
                <p className="mt-1 text-xs text-[var(--inbox-text-secondary)]">
                  Subject editing can plug into advanced email actions later without changing the composer layout.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Textarea
            ref={composerTextareaRef}
            value={replyContent}
            onChange={(event) => handleTextareaChange(event.target.value)}
            placeholder={composerConfig.placeholder}
            rows={4}
            className={cn(
              "min-h-[128px] max-h-[256px] resize-none overflow-y-auto rounded-2xl border-border/80 bg-background px-3.5 py-3 shadow-none focus-visible:ring-[4px]",
              replyIsInternal && "border-amber-200 bg-amber-50/60",
              speech.listening && "ring-2 ring-red-300",
            )}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) handleSend()
            }}
          />

          <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-[var(--inbox-divider)] bg-[var(--inbox-background)]/44 px-3 py-2">
            {cannedResponses.length > 0 && (
              <Popover open={cannedOpen} onOpenChange={onCannedOpenChange}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-[var(--inbox-radius-control)]"
                    title="Quick responses"
                  >
                    <Zap className="h-3.5 w-3.5" />
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

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setAttachmentsOpen((value) => !value)}
              className="rounded-[var(--inbox-radius-control)]"
              title="Prepare attachments area"
            >
              <Paperclip className="h-3.5 w-3.5" />
              Attach
            </Button>

            {speech.supported && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleMicToggle}
                className={cn(
                  "rounded-[var(--inbox-radius-control)]",
                  speech.listening && "border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800",
                )}
                title={speech.listening ? "Stop dictation" : "Start dictation"}
              >
                {speech.listening ? (
                  <MicOff className="h-3.5 w-3.5" />
                ) : (
                  <Mic className="h-3.5 w-3.5" />
                )}
                {speech.listening ? "Listening" : "Mic"}
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setAdvancedOpen((value) => !value)}
              className="ml-auto rounded-[var(--inbox-radius-control)] px-2.5"
            >
              <MessageSquareText className="h-3.5 w-3.5" />
              More options
              {advancedOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
          </div>

          {attachmentsOpen && (
            <div className="rounded-[10px] border border-dashed border-[var(--inbox-divider)] bg-[var(--inbox-background)]/44 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--inbox-muted)]">
                    Attachments
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--inbox-text-secondary)]">
                    {composerConfig.attachmentHint}
                  </p>
                </div>
                <span className="rounded-full bg-[var(--inbox-surface)] px-2 py-1 text-[10px] font-medium text-[var(--inbox-text-secondary)]">
                  Future preview zone
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {composerConfig.attachmentTypes.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-[var(--inbox-divider)] bg-[var(--inbox-surface)] px-2 py-1 text-[10px] font-medium text-[var(--inbox-text-secondary)]"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          {advancedOpen && (
            <div className="rounded-[10px] border border-[var(--inbox-divider)] bg-[var(--inbox-background)]/42 px-3 py-2.5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--inbox-muted)]">
                    More options
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--inbox-text-secondary)]">
                    {composerConfig.quickHint}
                  </p>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {speech.listening ? "Listening..." : "Ctrl+Enter to send"}
                </span>
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {composerConfig.advancedItems.map((item) => (
                  <div
                    key={item.label}
                    className={cn(
                      "rounded-[8px] border px-3 py-2",
                      item.tone === "accent"
                        ? "border-[var(--inbox-accent)]/20 bg-[var(--inbox-accent-soft)]/55"
                        : "border-[var(--inbox-divider)] bg-[var(--inbox-surface)]",
                    )}
                  >
                    <p className="text-xs font-semibold text-[var(--inbox-text)]">{item.label}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-[var(--inbox-text-secondary)]">{item.hint}</p>
                  </div>
                ))}

                {composerConfig.languageHint && (
                  <div className="rounded-[8px] border border-[var(--inbox-divider)] bg-[var(--inbox-surface)] px-3 py-2 md:col-span-2">
                    <div className="flex items-start gap-2">
                      <Languages className="mt-0.5 h-3.5 w-3.5 text-[var(--inbox-text-secondary)]" />
                      <div>
                        <p className="text-xs font-semibold text-[var(--inbox-text)]">Language context</p>
                        <p className="mt-1 text-[11px] leading-relaxed text-[var(--inbox-text-secondary)]">
                          {composerConfig.languageHint}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl space-y-1">
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {composerConfig.footerHint}
              </p>
              {!replyIsInternal && (
                <p className="text-[11px] leading-relaxed text-[var(--inbox-text-secondary)]">
                  Advanced send behaviors like reply all, forward, save draft or schedule send can expand from this layout later.
                </p>
              )}
            </div>
            <Button
              type="button"
              onClick={handleSend}
              disabled={replySending || !replyContent.trim()}
              className={cn(
                "min-w-[148px] self-end rounded-[var(--inbox-radius-control)] px-4 sm:self-auto",
                replyIsInternal && "bg-amber-900 text-white hover:bg-amber-950",
              )}
              variant={replyIsInternal ? undefined : "accent"}
            >
              {replySending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              {replyIsInternal ? "Save note" : composerConfig.sendLabel}
            </Button>
          </div>
        </div>

        {replyStatus && <p className="text-xs text-muted-foreground">{replyStatus}</p>}
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
      headerLabel: "Internal note",
      headerDescription: "Capture context, decisions and operational notes without sending anything externally.",
      placeholder: "Add an internal note...",
      quickHint: "Internal notes stay lightweight but still benefit from snippets, dictation and future attachments.",
      footerHint: "This note will stay internal and will not be delivered externally.",
      sendLabel: "Save note",
      subjectPreview: null,
      languageHint: detectedLanguage ? `Detected language: ${detectedLanguage.toUpperCase()}. Translation helpers can be offered before sharing notes later if needed.` : null,
      attachmentHint: "Attachments for internal notes can plug in here later for screenshots, docs or voice references.",
      attachmentTypes: ["Screenshots", "Docs", "PDFs", "Audio notes"],
      advancedItems: [
        { label: "Structured note blocks", hint: "Prepare sections for risks, decisions or follow-up without changing the main composer.", tone: "accent" as const },
        { label: "Farah rewrite later", hint: "Rewrite, summarize or change tone can connect here without reintroducing Farah into the composer." },
        { label: "Internal attachments", hint: "Screenshots, files or recordings can render in a future preview rail." },
        { label: "Saved note templates", hint: "Team note templates can grow from the existing snippets entry point." },
      ] satisfies ComposerAdvancedItem[],
    }
  }

  switch (channel) {
    case "email":
      return {
        headerLabel: "Email composer",
        headerDescription: "Keep the reply flow simple now while preparing room for fuller email actions later.",
        placeholder: "Write your reply...",
        quickHint: "Email keeps the writing surface primary and moves richer controls into contextual layers.",
        footerHint: "This reply uses the current outbound email flow.",
        sendLabel: "Send reply",
        subjectPreview: subject || "No subject available",
        languageHint: detectedLanguage && detectedLanguage.toLowerCase() !== "en"
          ? `Detected language: ${detectedLanguage.toUpperCase()}. Translation before send can plug into this composer later.`
          : null,
        attachmentHint: "Email attachments can expand here into file picking, previews, multi-file handling and send validation.",
        attachmentTypes: ["Images", "PDFs", "Docs", "Spreadsheets"],
        advancedItems: [
          { label: "Reply all and forward", hint: "Prepared as advanced email modes so the main Reply/Internal note switch stays simple.", tone: "accent" as const },
          { label: "CC and BCC", hint: "Addressing controls can live in a secondary layer instead of crowding the main toolbar." },
          { label: "Edit subject", hint: "The current subject is already visible above and can become editable without changing the composer shell." },
          { label: "Save draft and schedule send", hint: "Future send options can branch from the footer instead of adding more primary buttons." },
        ] satisfies ComposerAdvancedItem[],
      }
    case "whatsapp":
      return {
        headerLabel: "WhatsApp composer",
        headerDescription: "Fast message-first response with room for dictation, attachments and lightweight follow-up helpers.",
        placeholder: "Type your message...",
        quickHint: "WhatsApp keeps the composer direct: write, dictate, attach later and send.",
        footerHint: "This reply uses the current outbound flow for WhatsApp.",
        sendLabel: "Send message",
        subjectPreview: null,
        languageHint: detectedLanguage && detectedLanguage.toLowerCase() !== "en"
          ? `Detected language: ${detectedLanguage.toUpperCase()}. Translation or tone helpers can be added before send later.`
          : null,
        attachmentHint: "WhatsApp attachments can expand here into image, PDF, document and audio support when the channel pipeline is ready.",
        attachmentTypes: ["Images", "PDFs", "Docs", "Audio"],
        advancedItems: [
          { label: "Voice-first workflow", hint: "Dictation is already integrated and can evolve into channel-aware voice messaging later.", tone: "accent" as const },
          { label: "Media attachments", hint: "Images, documents and audio can render in a future attachment tray here." },
          { label: "Tone and translation", hint: "Rewrite or translate before sending can connect later without turning the composer into a second assistant panel." },
          { label: "Follow-up handoff", hint: "Scheduling or business follow-up should stay in ActionsCard, not overload the composer." },
        ] satisfies ComposerAdvancedItem[],
      }
    case "web_chat":
    case "portal":
      return {
        headerLabel: `${channelLabel} composer`,
        headerDescription: "Conversation-first messaging with a clean writing surface and room for rich helpers when the channel supports them.",
        placeholder: "Type your message...",
        quickHint: "This channel stays message-led while keeping dictation, snippets and future attachments close at hand.",
        footerHint: `This reply uses the current outbound flow for ${channelLabel.toLowerCase()}.`,
        sendLabel: "Send message",
        subjectPreview: null,
        languageHint: detectedLanguage && detectedLanguage.toLowerCase() !== "en"
          ? `Detected language: ${detectedLanguage.toUpperCase()}. Translation support can plug in later without changing the main writing area.`
          : null,
        attachmentHint: `${channelLabel} attachments can slot into this tray later when upload and validation flows are ready.`,
        attachmentTypes: ["Images", "PDFs", "Docs"],
        advancedItems: [
          { label: "Quick replies", hint: "Snippets stay available for faster customer responses.", tone: "accent" as const },
          { label: "Future attachments", hint: "Attachment support can be added here without rebuilding the composer structure." },
          { label: "Rewrite and translate", hint: "AI helpers can remain adjacent to writing without pulling Farah back into the composer." },
          { label: "Channel-safe send options", hint: "Only options valid for this channel should surface here as capabilities mature." },
        ] satisfies ComposerAdvancedItem[],
      }
    default:
      return {
        headerLabel: `${channelLabel} composer`,
        headerDescription: "A clean shared composer shell that can adapt per channel as richer messaging support grows.",
        placeholder: "Write your message...",
        quickHint: "The composer stays simple now, but its structure is ready for channel-aware enhancements later.",
        footerHint: "This reply uses the current outbound flow.",
        sendLabel: "Send reply",
        subjectPreview: null,
        languageHint: detectedLanguage ? `Detected language: ${detectedLanguage.toUpperCase()}. Language helpers can connect here later.` : null,
        attachmentHint: "Attachments can plug into this tray later once channel capabilities are defined.",
        attachmentTypes: ["Images", "PDFs", "Docs"],
        advancedItems: [
          { label: "Channel-aware send options", hint: "Additional reply modes can appear here only when the channel supports them.", tone: "accent" as const },
          { label: "Attachments", hint: "The tray is already prepared for richer file handling later." },
          { label: "Templates and rewrite", hint: "Snippets and future assistive helpers can stay adjacent to writing, not inside it." },
          { label: "Safe expansion path", hint: "More controls can grow in this advanced layer instead of turning the toolbar into a wall of buttons." },
        ] satisfies ComposerAdvancedItem[],
      }
  }
}
