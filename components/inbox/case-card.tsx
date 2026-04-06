"use client"

import { ChevronDown, ChevronRight, Play, ShieldCheck, Sparkles } from "lucide-react"
import { InlineText, InlineTextarea } from "@/components/inline-edit"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface CaseCardProps {
  title: string
  summary: string
  statusLabel: string
  statusClassName: string
  urgencyLabel?: string | null
  urgencyClassName?: string | null
  intent?: string | null
  assignedLabel?: string | null
  nextRecommendedAction?: string | null
  expanded: boolean
  onExpandedChange: (value: boolean) => void
  onMarkReviewed?: () => void
  canMarkReviewed?: boolean
  detailHeadline?: string | null
  detailSummary?: string | null
  factsText: string
  pendingItemsText: string
  risksText: string
  confidenceLabel?: string | null
  reviewedBy?: string | null
  reviewedAt?: string | null
  onSaveHeadline: (value: string) => Promise<void>
  onSaveSummary: (value: string) => Promise<void>
  onSaveFacts: (value: string) => Promise<void>
  onSavePendingItems: (value: string) => Promise<void>
  onSaveRisks: (value: string) => Promise<void>
  onSaveNextRecommendedAction: (value: string) => Promise<void>
  stateMessage?: string | null
}

export function CaseCard({
  title,
  summary,
  statusLabel,
  statusClassName,
  urgencyLabel,
  urgencyClassName,
  intent,
  assignedLabel,
  nextRecommendedAction,
  expanded,
  onExpandedChange,
  onMarkReviewed,
  canMarkReviewed,
  detailHeadline,
  detailSummary,
  factsText,
  pendingItemsText,
  risksText,
  confidenceLabel,
  reviewedBy,
  reviewedAt,
  onSaveHeadline,
  onSaveSummary,
  onSaveFacts,
  onSavePendingItems,
  onSaveRisks,
  onSaveNextRecommendedAction,
  stateMessage,
}: CaseCardProps) {
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
                    title="Mark as reviewed"
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
                  title={expanded ? "Collapse case details" : "Expand case details"}
                >
                  {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("rounded-full px-2 py-1 text-[10px] font-semibold", statusClassName)}>
                {statusLabel}
              </span>
              {urgencyLabel && urgencyClassName && (
                <span className={cn("rounded-full px-2 py-1 text-[10px] font-medium", urgencyClassName)}>
                  {urgencyLabel}
                </span>
              )}
              {intent && (
                <span className="rounded-full border border-[var(--inbox-divider)] bg-[var(--inbox-background)] px-2 py-1 text-[10px] font-medium text-[var(--inbox-text-secondary)]">
                  {intent}
                </span>
              )}
              {assignedLabel && (
                <span className="rounded-full border border-[var(--inbox-divider)] bg-[var(--inbox-background)] px-2 py-1 text-[10px] font-medium text-[var(--inbox-text-secondary)]">
                  {assignedLabel}
                </span>
              )}
            </div>

            {nextRecommendedAction && !expanded && (
              <div className="flex items-start gap-2 rounded-[10px] border border-[var(--inbox-divider)] bg-[var(--inbox-background)]/60 px-3 py-2.5">
                <Play className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--inbox-accent)]" />
                <p className="text-xs font-medium leading-relaxed text-[var(--inbox-text)]">
                  {nextRecommendedAction}
                </p>
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4 border-t border-[var(--inbox-divider)] px-4 py-4">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--inbox-muted)]">
              Headline
            </p>
            <InlineText
              value={detailHeadline || ""}
              placeholder="Add operational headline..."
              className="text-sm font-semibold text-[var(--inbox-text)]"
              onSave={onSaveHeadline}
            />
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--inbox-muted)]">
              Summary
            </p>
            <InlineTextarea
              value={detailSummary || ""}
              placeholder="Add operational summary..."
              className="mt-0 rounded-[10px] bg-[var(--inbox-background)]/60"
              rows={3}
              onSave={onSaveSummary}
            />
          </div>

          <div className="grid gap-3">
            <div className="rounded-[10px] border border-[var(--inbox-divider)] bg-[var(--inbox-background)]/44 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--inbox-muted)]">Facts</p>
              <InlineTextarea
                value={factsText}
                placeholder="One fact per line..."
                className="mt-1 px-0 py-0"
                rows={2}
                onSave={onSaveFacts}
              />
            </div>

            <div className="rounded-[10px] border border-[var(--inbox-divider)] bg-[var(--inbox-background)]/44 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--inbox-muted)]">Pending items</p>
              <InlineTextarea
                value={pendingItemsText}
                placeholder="One pending item per line..."
                className="mt-1 px-0 py-0"
                rows={2}
                onSave={onSavePendingItems}
              />
            </div>

            <div className="rounded-[10px] border border-[var(--inbox-divider)] bg-[var(--inbox-background)]/44 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--inbox-muted)]">Risks</p>
              <InlineTextarea
                value={risksText}
                placeholder="One risk per line..."
                className="mt-1 px-0 py-0"
                rows={2}
                onSave={onSaveRisks}
              />
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--inbox-muted)]">
              Next recommended action
            </p>
            <InlineTextarea
              value={nextRecommendedAction || ""}
              placeholder="Add recommended next step..."
              className="mt-0 rounded-[10px] bg-[var(--inbox-background)]/60"
              rows={2}
              onSave={onSaveNextRecommendedAction}
            />
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--inbox-muted)]">
            {confidenceLabel && <span>Confidence {confidenceLabel}</span>}
            {reviewedBy && <span>Reviewed by {reviewedBy}</span>}
            {reviewedAt && <span>{reviewedAt}</span>}
          </div>

          {stateMessage && <p className="text-xs text-[var(--inbox-muted)]">{stateMessage}</p>}
        </CardContent>
      )}
    </Card>
  )
}
