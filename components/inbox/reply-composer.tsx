"use client"

import { useEffect, useRef } from "react"
import { Send, Loader2, Mic, MicOff, Zap } from "lucide-react"
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

interface ReplyComposerProps {
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

  const { items: cannedResponses } = useCannedResponses()

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
    <div className="shrink-0 border-t border-[var(--inbox-divider)] bg-[var(--inbox-surface)]/96 px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] backdrop-blur supports-[backdrop-filter]:bg-[var(--inbox-surface)]/92 md:px-5">
      <div className="space-y-3 rounded-[var(--inbox-radius-panel)] border border-[var(--inbox-border)] bg-[var(--inbox-surface)] p-3 shadow-[var(--inbox-panel-shadow-sm)] md:p-4">
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
            className={cn("rounded-xl", replyIsInternal && "border-amber-200 bg-amber-100 text-amber-950 hover:bg-amber-200")}
          >
            Internal note
          </Button>

          {cannedResponses.length > 0 && (
            <Popover open={cannedOpen} onOpenChange={onCannedOpenChange}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="ml-1 rounded-xl px-2"
                  title="Quick responses"
                >
                  <Zap className="h-3.5 w-3.5" />
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

          {speech.supported && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleMicToggle}
              className={cn(
                "ml-1 rounded-xl px-2",
                speech.listening && "bg-red-100 text-red-700 hover:bg-red-200 hover:text-red-800",
              )}
              title={speech.listening ? "Stop dictation" : "Start dictation"}
            >
              {speech.listening ? (
                <MicOff className="h-3.5 w-3.5" />
              ) : (
                <Mic className="h-3.5 w-3.5" />
              )}
            </Button>
          )}

          <span className="ml-auto text-[11px] text-muted-foreground max-sm:w-full">
            {speech.listening ? "Listening..." : "Ctrl+Enter to send"}
          </span>
        </div>

        <div className="space-y-2">
          <Textarea
            ref={composerTextareaRef}
            value={replyContent}
            onChange={(event) => handleTextareaChange(event.target.value)}
            placeholder={replyIsInternal ? "Write an internal note..." : "Write a reply..."}
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

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-xl text-[11px] leading-relaxed text-muted-foreground">
              {replyIsInternal
                ? "This note will stay internal and will not be delivered externally."
                : "This reply uses the current outbound flow."}
            </p>
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
              {replyIsInternal ? "Save note" : "Send reply"}
            </Button>
          </div>
        </div>

        {replyStatus && <p className="text-xs text-muted-foreground">{replyStatus}</p>}
      </div>
    </div>
  )
}
