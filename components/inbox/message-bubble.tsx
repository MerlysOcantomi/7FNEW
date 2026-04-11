"use client"

import { cn } from "@/lib/utils"
import { FileText, Download } from "lucide-react"

type MessageTone = "inbound" | "outbound" | "internal" | "system"

export interface MessageAttachment {
  filename: string
  url: string
  contentType: string
  size?: number
}

export interface MessageEmailMeta {
  cc?: string[]
  bcc?: string[]
  to?: string[]
  mode?: "reply" | "reply_all" | "forward"
}

interface MessageBubbleProps {
  authorLabel: string
  roleLabel: string
  metaLabel: string
  timestampLabel: string
  content: string
  tone: MessageTone
  attachments?: MessageAttachment[]
  emailMeta?: MessageEmailMeta
}

export function MessageBubble({
  authorLabel,
  roleLabel,
  metaLabel,
  timestampLabel,
  content,
  tone,
  attachments,
  emailMeta,
}: MessageBubbleProps) {
  const isRightAligned = tone === "outbound"
  const isSystem = tone === "system"

  return (
    <div
      className={cn(
        "flex",
        isSystem ? "justify-center" : isRightAligned ? "justify-end" : "justify-start",
      )}
    >
      <div className={cn("max-w-[96%] sm:max-w-[82%] md:max-w-[78%]", isRightAligned && "items-end")}>
        <div
          className={cn(
            "mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 px-1",
            isSystem
              ? "justify-center text-center"
              : isRightAligned
                ? "justify-end text-right"
                : "justify-start text-left",
          )}
        >
          <span className={cn(
            "text-xs font-semibold",
            tone === "inbound" ? "text-[var(--inbox-accent)]" : "text-[var(--inbox-text)]"
          )}>{authorLabel}</span>
          <span className="text-xs uppercase tracking-wide font-medium text-[var(--inbox-text-secondary)]">
            {roleLabel}
          </span>
          <span className={cn(
            "rounded-lg border px-2.5 py-0.5 text-xs leading-relaxed font-medium",
            tone === "inbound" 
              ? "border-[var(--inbox-accent)]/30 bg-[var(--inbox-accent-soft)] text-[var(--inbox-accent)]"
              : tone === "outbound"
                ? "border-[#332455] bg-[#2B2144] text-[#E8DFFF]"
                : "border-[var(--inbox-divider)] bg-[var(--surface-3)] text-[var(--inbox-text-secondary)]"
          )}>
            {metaLabel}
          </span>
          <span suppressHydrationWarning className="text-xs whitespace-nowrap text-[var(--text-secondary-dark)]">{timestampLabel}</span>
          {emailMeta?.mode === "forward" && (
            <span className="rounded-lg bg-[var(--inbox-accent-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--inbox-accent)] border border-[var(--inbox-accent)]/30">
              Forwarded
            </span>
          )}
          {emailMeta?.mode === "reply_all" && (
            <span className="rounded-lg bg-[var(--inbox-accent-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--inbox-accent)] border border-[var(--inbox-accent)]/30">
              Reply all
            </span>
          )}
        </div>

        {emailMeta?.cc && emailMeta.cc.length > 0 && (
          <p className={cn(
            "mb-1 px-1 text-[10px] text-[var(--inbox-text-secondary)]/70",
            isRightAligned ? "text-right" : "text-left",
          )}>
            CC: {emailMeta.cc.join(", ")}
          </p>
        )}

        <div
          className={cn(
            "rounded-2xl border px-5 py-4 text-sm leading-relaxed shadow-sm transition-all duration-300",
            tone === "outbound" &&
              "rounded-tr-lg border-[var(--inbox-chat-bubble-outbound)]/18 bg-[linear-gradient(135deg,#7C4DFF_0%,#6E40F0_100%)] text-white shadow-[0_8px_24px_rgba(110,64,240,0.18)] hover:shadow-[0_12px_30px_rgba(110,64,240,0.22)]",
            tone === "inbound" &&
              "rounded-tl-lg border-[var(--inbox-chat-border)] bg-[var(--inbox-chat-bubble-inbound)] text-[var(--inbox-chat-text)] shadow-[var(--inbox-shadow-card)] ring-1 ring-[var(--inbox-chat-border)]/30 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)]",
            tone === "internal" &&
              "rounded-tl-lg border-[var(--inbox-warning)]/20 bg-[var(--inbox-warning)]/8 text-[var(--inbox-warning)] shadow-[0_4px_20px_rgba(217,119,6,0.10)]",
            tone === "system" &&
              "rounded-2xl border-dashed border-[var(--inbox-chat-border)] bg-[var(--inbox-chat-background)]/60 text-[var(--inbox-chat-text-secondary)]",
          )}
        >
          <p className="whitespace-pre-wrap break-words">{content}</p>
          {attachments && attachments.length > 0 && (
            <div className="mt-2 flex flex-col gap-1.5 border-t border-current/10 pt-2">
              {attachments.map((att) => (
                <a
                  key={att.url || att.filename}
                  href={att.url || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors",
                    att.url
                      ? "hover:bg-current/10 cursor-pointer"
                      : "opacity-60 cursor-default",
                    tone === "outbound" ? "text-white/90" : "text-[var(--inbox-text)]/80",
                  )}
                  onClick={att.url ? undefined : (e) => e.preventDefault()}
                >
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  <span className="max-w-[180px] truncate font-medium">{att.filename}</span>
                  {att.size != null && (
                    <span className="text-[10px] opacity-70">
                      {att.size < 1024 ? `${att.size} B` : att.size < 1048576 ? `${Math.round(att.size / 1024)} KB` : `${(att.size / 1048576).toFixed(1)} MB`}
                    </span>
                  )}
                  {att.url && <Download className="h-3 w-3 shrink-0 opacity-70" />}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
