"use client"

import { cn } from "@/lib/utils"

type MessageTone = "inbound" | "outbound" | "internal" | "system"

interface MessageBubbleProps {
  authorLabel: string
  roleLabel: string
  metaLabel: string
  timestampLabel: string
  content: string
  tone: MessageTone
}

export function MessageBubble({
  authorLabel,
  roleLabel,
  metaLabel,
  timestampLabel,
  content,
  tone,
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
          <span className="text-[11px] font-medium text-foreground/90">{authorLabel}</span>
          <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/80">
            {roleLabel}
          </span>
          <span className="rounded-full border border-border/80 bg-background/80 px-2 py-0.5 text-[10px] leading-none text-muted-foreground">
            {metaLabel}
          </span>
          <span className="text-[10px] whitespace-nowrap text-muted-foreground/90">{timestampLabel}</span>
        </div>

        <div
          className={cn(
            "rounded-2xl border px-4 py-3 text-[13px] leading-6 shadow-sm",
            tone === "outbound" &&
              "rounded-tr-md border-primary/15 bg-primary text-primary-foreground shadow-[0_10px_24px_rgba(37,99,235,0.18)]",
            tone === "inbound" &&
              "rounded-tl-md border-border/80 bg-card text-card-foreground",
            tone === "internal" &&
              "rounded-tl-md border-amber-200/80 bg-amber-50/90 text-amber-950",
            tone === "system" &&
              "rounded-2xl border-dashed border-border/80 bg-muted/40 text-foreground/85",
          )}
        >
          <p className="whitespace-pre-wrap break-words">{content}</p>
        </div>
      </div>
    </div>
  )
}
