"use client"

import { ChevronDown, ChevronRight, Languages, ShieldCheck, Sparkles } from "lucide-react"
import { InlineTextarea } from "@/components/inline-edit"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface MessageIntelligenceCardProps {
  title: string
  summary: string
  intent?: string | null
  sentiment?: string | null
  urgencyLabel?: string | null
  urgencyClassName?: string | null
  conversationStatusLabel: string
  conversationStatusClassName: string
  confidenceLabel?: string | null
  nextRecommendedAction?: string | null
  pendingItemsCount?: number
  risksCount?: number
  expanded: boolean
  onExpandedChange: (value: boolean) => void
  onMarkReviewed?: () => void
  canMarkReviewed?: boolean
  translationHint?: string | null
  detailSummary?: string | null
  onSaveSummary: (value: string) => Promise<void>
  detailNextRecommendedAction?: string | null
  onSaveNextRecommendedAction: (value: string) => Promise<void>
  stateMessage?: string | null
}

export function MessageIntelligenceCard({
  title,
  summary,
  intent,
  sentiment,
  urgencyLabel,
  urgencyClassName,
  conversationStatusLabel,
  conversationStatusClassName,
  confidenceLabel,
  nextRecommendedAction,
  pendingItemsCount = 0,
  risksCount = 0,
  expanded,
  onExpandedChange,
  onMarkReviewed,
  canMarkReviewed,
  translationHint,
  detailSummary,
  onSaveSummary,
  detailNextRecommendedAction,
  onSaveNextRecommendedAction,
  stateMessage,
}: MessageIntelligenceCardProps) {
  return (
    <Card className="gap-0 overflow-hidden rounded-[var(--inbox-radius-panel)] border-[var(--inbox-border)] bg-[var(--inbox-surface)] py-0 shadow-[var(--inbox-panel-shadow-sm)]">
      <CardHeader className="px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--inbox-accent-soft)] text-[var(--inbox-accent)]">
            <Sparkles className="h-4 w-4" />
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="text-sm text-[var(--inbox-text)]">{title}</CardTitle>
                <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-[var(--inbox-text-secondary)]">
                  {summary}
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                {canMarkReviewed && onMarkReviewed && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="h-8 w-8 rounded-[var(--inbox-radius-control)] text-[var(--inbox-accent)] hover:bg-[var(--inbox-accent-soft)]"
                    onClick={onMarkReviewed}
                    title="Mark intelligence as reviewed"
                  >
                    <ShieldCheck className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="h-8 w-8 rounded-[var(--inbox-radius-control)] text-[var(--inbox-text-secondary)] hover:bg-[var(--inbox-background)]"
                  onClick={() => onExpandedChange(!expanded)}
                  title={expanded ? "Collapse intelligence" : "Expand intelligence"}
                >
                  {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("rounded-full px-2 py-1 text-[10px] font-semibold", conversationStatusClassName)}>
                {conversationStatusLabel}
              </span>
              {urgencyLabel && urgencyClassName && (
                <span className={cn("rounded-full px-2 py-1 text-[10px] font-medium", urgencyClassName)}>
                  {urgencyLabel}
                </span>
              )}
              {confidenceLabel && (
                <span className="rounded-full bg-[var(--inbox-accent-soft)] px-2 py-1 text-[10px] font-medium text-[var(--inbox-accent)]">
                  {confidenceLabel}
                </span>
              )}
            </div>

            <div className="space-y-2">
              <div className="rounded-[10px] border border-[var(--inbox-divider)] bg-[var(--inbox-background)]/44 px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--inbox-muted)]">Intent</p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--inbox-text)]">
                  {intent || "Unclassified"}
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-[10px] border border-[var(--inbox-divider)] bg-[var(--inbox-background)]/44 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--inbox-muted)]">Sentiment</p>
                  <p className="mt-1 text-xs font-medium text-[var(--inbox-text)]">{sentiment || "Unknown"}</p>
                </div>
                <div className="rounded-[10px] border border-[var(--inbox-divider)] bg-[var(--inbox-background)]/44 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--inbox-muted)]">Urgency</p>
                  <p className="mt-1 text-xs font-medium text-[var(--inbox-text)]">{urgencyLabel || "Normal"}</p>
                </div>
              </div>
            </div>

            {!expanded && nextRecommendedAction && (
              <div className="rounded-[10px] border border-[var(--inbox-divider)] bg-[var(--inbox-background)]/60 px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--inbox-muted)]">Next step</p>
                <p className="mt-1 text-xs font-medium leading-relaxed text-[var(--inbox-text)]">
                  {nextRecommendedAction}
                </p>
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4 border-t border-[var(--inbox-divider)] px-4 py-4">
          <div className="rounded-[10px] border border-[var(--inbox-divider)] bg-[var(--inbox-background)]/44 p-3">
            <div className="flex items-center gap-2">
              <Languages className="h-4 w-4 text-[var(--inbox-accent)]" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--inbox-muted)]">
                Translation
              </p>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[var(--inbox-text-secondary)]">
              {translationHint || "Translation support can live here when language assistance is added."}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--inbox-muted)]">
              Summary
            </p>
            <InlineTextarea
              value={detailSummary || ""}
              placeholder="Add message intelligence summary..."
              className="mt-0 rounded-[10px] bg-[var(--inbox-background)]/60"
              rows={3}
              onSave={onSaveSummary}
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-[10px] border border-[var(--inbox-divider)] bg-[var(--inbox-background)]/44 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--inbox-muted)]">Risk signals</p>
              <p className="mt-1 text-sm font-medium text-[var(--inbox-text)]">{risksCount}</p>
            </div>
            <div className="rounded-[10px] border border-[var(--inbox-divider)] bg-[var(--inbox-background)]/44 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--inbox-muted)]">Pending signals</p>
              <p className="mt-1 text-sm font-medium text-[var(--inbox-text)]">{pendingItemsCount}</p>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--inbox-muted)]">
              Next recommended action
            </p>
            <InlineTextarea
              value={detailNextRecommendedAction || ""}
              placeholder="Add recommended next step..."
              className="mt-0 rounded-[10px] bg-[var(--inbox-background)]/60"
              rows={2}
              onSave={onSaveNextRecommendedAction}
            />
          </div>

          {stateMessage && <p className="text-xs text-[var(--inbox-muted)]">{stateMessage}</p>}
        </CardContent>
      )}
    </Card>
  )
}
