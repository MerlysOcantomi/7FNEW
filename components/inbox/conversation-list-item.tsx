"use client"

import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

interface ConversationListItemProps {
  title: string
  subtitle: string
  preview: string
  timeLabel: string
  selected: boolean
  isUnread: boolean
  onClick: () => void
  statusLabel: string
  statusClassName: string
  channelLabel: string
  urgencyLabel: string
  urgencyClassName: string
  leadScore?: number | null
}

export function ConversationListItem({
  title,
  subtitle,
  preview,
  timeLabel,
  selected,
  isUnread,
  onClick,
  statusLabel,
  statusClassName,
  channelLabel,
  urgencyLabel,
  urgencyClassName,
  leadScore,
}: ConversationListItemProps) {
  const itemRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!selected) return
    itemRef.current?.scrollIntoView({ block: "nearest" })
  }, [selected])

  return (
    <button
      ref={itemRef}
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "group relative w-full rounded-[22px] border px-4 py-3.5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
        selected
          ? "border-primary/30 bg-primary/[0.06] shadow-[0_8px_30px_rgba(15,23,42,0.08)]"
          : "border-border/80 bg-card hover:-translate-y-0.5 hover:border-border hover:bg-accent/15 hover:shadow-[0_10px_24px_rgba(15,23,42,0.06)]",
      )}
    >
      <span
        className={cn(
          "absolute inset-y-3 left-0 w-1 rounded-r-full transition-colors",
          selected ? "bg-primary/80" : "bg-transparent group-hover:bg-border",
        )}
      />
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {isUnread && (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                )}
                <p
                  className={cn(
                    "truncate pr-1 text-sm text-foreground",
                    isUnread ? "font-semibold" : "font-medium",
                  )}
                >
                  {title}
                </p>
              </div>
              <p className="mt-1 truncate text-[11px] text-muted-foreground">{subtitle}</p>
            </div>
            <span
              className={cn(
                "shrink-0 whitespace-nowrap pt-0.5 text-[10px] font-medium",
                isUnread ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {timeLabel}
            </span>
          </div>

          <p
            className={cn(
              "mt-2.5 line-clamp-2 text-[13px] leading-5",
              isUnread ? "text-foreground/80" : "text-muted-foreground",
            )}
          >
            {preview}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", statusClassName)}>
              {statusLabel}
            </span>
            <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {channelLabel}
            </span>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", urgencyClassName)}>
              {urgencyLabel}
            </span>
            {typeof leadScore === "number" && (
              <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-medium text-background">
                Lead {leadScore}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}
