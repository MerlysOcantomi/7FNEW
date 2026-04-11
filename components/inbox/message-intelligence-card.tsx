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
    <Card className="gap-0 overflow-hidden rounded-[var(--inbox-radius-panel)] border-[var(--inbox-intelligence-border)] bg-[var(--inbox-intelligence-surface)] py-0 shadow-[var(--inbox-panel-shadow-sm)]">
      <CardHeader className="px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--inbox-accent-soft)] text-[var(--inbox-accent)]">
            <Sparkles className="h-4 w-4" />
          </div>

          <div className="min-w-0 flex-1 space-y-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="text-sm text-[var(--inbox-intelligence-text)]">Situation</CardTitle>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--inbox-intelligence-text-secondary)]">
                  {summary}
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                {canMarkReviewed && onMarkReviewed && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="h-7 w-7 rounded-[var(--inbox-radius-control)] text-[var(--inbox-accent)] hover:bg-[var(--inbox-accent-soft)]"
                    onClick={onMarkReviewed}
                    title="Mark as reviewed"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                    className="h-7 w-7 rounded-[var(--inbox-radius-control)] text-[var(--inbox-intelligence-text-secondary)] hover:bg-white/8"
                  onClick={() => onExpandedChange(!expanded)}
                  title={expanded ? "Collapse" : "Expand"}
                >
                  {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", conversationStatusClassName)}>
                {conversationStatusLabel}
              </span>
              {urgencyLabel && urgencyClassName && (
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", urgencyClassName)}>
                  {urgencyLabel}
                </span>
              )}
              {intent && (
                <span className="rounded-full border border-[var(--inbox-intelligence-border)] px-2 py-0.5 text-[10px] font-medium text-[var(--inbox-intelligence-text-secondary)]">
                  {intent}
                </span>
              )}
              {sentiment && (
                <span className="rounded-full border border-[var(--inbox-intelligence-border)] px-2 py-0.5 text-[10px] font-medium text-[var(--inbox-intelligence-text-secondary)]">
                  {sentiment}
                </span>
              )}
              {confidenceLabel && (
                <span className="rounded-full bg-[var(--inbox-accent-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--inbox-accent)]">
                  {confidenceLabel}
                </span>
              )}
            </div>

            {!expanded && nextRecommendedAction && (
              <div className="rounded-[8px] border border-[var(--inbox-intelligence-border)] bg-white/6 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--inbox-intelligence-text-secondary)]">Next step</p>
                <p className="mt-0.5 text-xs font-medium leading-relaxed text-[var(--inbox-intelligence-text)]">
                  {nextRecommendedAction}
                </p>
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-3 border-t border-[var(--inbox-intelligence-border)] px-4 py-3.5">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-[8px] border border-[var(--inbox-intelligence-border)] bg-white/6 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--inbox-intelligence-text-secondary)]">Intent</p>
              <p className="mt-0.5 text-xs font-medium text-[var(--inbox-intelligence-text)]">{intent || "Unclassified"}</p>
            </div>
            <div className="rounded-[8px] border border-[var(--inbox-intelligence-border)] bg-white/6 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--inbox-intelligence-text-secondary)]">Sentiment</p>
              <p className="mt-0.5 text-xs font-medium text-[var(--inbox-intelligence-text)]">{sentiment || "Unknown"}</p>
            </div>
            <div className="rounded-[8px] border border-[var(--inbox-intelligence-border)] bg-white/6 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--inbox-intelligence-text-secondary)]">Urgency</p>
              <p className="mt-0.5 text-xs font-medium text-[var(--inbox-intelligence-text)]">{urgencyLabel || "Normal"}</p>
            </div>
          </div>

          {(risksCount > 0 || pendingItemsCount > 0) && (
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-[8px] border border-[var(--inbox-intelligence-border)] bg-white/6 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--inbox-intelligence-text-secondary)]">Risk signals</p>
                <p className="mt-0.5 text-xs font-medium text-[var(--inbox-intelligence-text)]">{risksCount}</p>
              </div>
              <div className="rounded-[8px] border border-[var(--inbox-intelligence-border)] bg-white/6 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--inbox-intelligence-text-secondary)]">Pending</p>
                <p className="mt-0.5 text-xs font-medium text-[var(--inbox-intelligence-text)]">{pendingItemsCount}</p>
              </div>
            </div>
          )}

          {translationHint && (
            <div className="flex items-start gap-2 rounded-[8px] border border-[var(--inbox-intelligence-border)] bg-white/6 px-3 py-2">
              <Languages className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--inbox-accent)]" />
              <p className="text-xs leading-relaxed text-[var(--inbox-intelligence-text-secondary)]">{translationHint}</p>
            </div>
          )}

          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--inbox-intelligence-text-secondary)]">
              Summary
            </p>
            <InlineTextarea
              value={detailSummary || ""}
              placeholder="Add intelligence summary..."
              className="mt-0 rounded-[8px] bg-white/6 text-[var(--inbox-intelligence-text)]"
              rows={3}
              onSave={onSaveSummary}
            />
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--inbox-intelligence-text-secondary)]">
              Next recommended action
            </p>
            <InlineTextarea
              value={detailNextRecommendedAction || ""}
              placeholder="Add recommended next step..."
              className="mt-0 rounded-[8px] bg-white/6 text-[var(--inbox-intelligence-text)]"
              rows={2}
              onSave={onSaveNextRecommendedAction}
            />
          </div>

          {stateMessage && <p className="text-xs text-[var(--inbox-intelligence-text-secondary)]">{stateMessage}</p>}
        </CardContent>
      )}
    </Card>
  )
}
