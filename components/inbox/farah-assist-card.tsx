"use client"

import { ChevronDown, ChevronRight, PenSquare, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"

export type FarahAssistState = "hidden" | "compact" | "expanded"

interface FarahAssistCardProps {
  state: Exclude<FarahAssistState, "hidden">
  summary?: string | null
  suggestionTitle?: string | null
  suggestionContent?: string | null
  nextRecommendedAction?: string | null
  confidenceLabel?: string | null
  autoPopulated?: boolean
  onToggleExpanded: () => void
  onInsertSuggestion?: () => void
  onEditSuggestion?: () => void
  onDismiss: () => void
}

export function FarahAssistCard({
  state,
  summary,
  suggestionTitle,
  suggestionContent,
  nextRecommendedAction,
  confidenceLabel,
  autoPopulated = false,
  onToggleExpanded,
  onInsertSuggestion,
  onEditSuggestion,
  onDismiss,
}: FarahAssistCardProps) {
  const isExpanded = state === "expanded"
  const hasSuggestion = Boolean(suggestionContent?.trim())
  const leadingText = hasSuggestion
    ? autoPopulated
      ? "Farah prepared a reply for you."
      : "Farah has a reply suggestion ready."
    : "Farah has context for this conversation."

  return (
    <div className="shrink-0 border-t border-[var(--inbox-divider)] bg-[var(--inbox-surface)]/96 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-[var(--inbox-surface)]/92 md:px-5">
      <div className="rounded-[var(--inbox-radius-panel)] border border-[var(--inbox-border)] bg-[linear-gradient(180deg,rgba(230,241,242,0.6)_0%,rgba(255,255,255,1)_42%)] shadow-[var(--inbox-panel-shadow-sm)]">
        <div className="flex items-start gap-3 px-4 py-4">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--inbox-divider)] bg-[linear-gradient(180deg,#F7FBFB_0%,#E6F1F2_100%)]">
            <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.9),transparent_42%)] text-[var(--inbox-accent)]">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--inbox-accent)]">
                  Farah
                </p>
                <p className="mt-1 text-sm font-semibold text-[var(--inbox-text)]">
                  {suggestionTitle || leadingText}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--inbox-text-secondary)]">
                  {summary || leadingText}
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="h-8 w-8 rounded-[var(--inbox-radius-control)] text-[var(--inbox-text-secondary)] hover:bg-[var(--inbox-background)]"
                  onClick={onToggleExpanded}
                  title={isExpanded ? "Collapse Farah details" : "Expand Farah details"}
                >
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="h-8 w-8 rounded-[var(--inbox-radius-control)] text-[var(--inbox-text-secondary)] hover:bg-[var(--inbox-background)]"
                  onClick={onDismiss}
                  title="Hide Farah assistance"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {hasSuggestion && (
                <span className="rounded-full bg-[var(--inbox-accent-soft)] px-2 py-1 text-[10px] font-semibold text-[var(--inbox-accent)]">
                  Reply ready
                </span>
              )}
              {autoPopulated && (
                <span className="rounded-full border border-[var(--inbox-divider)] bg-[var(--inbox-surface)] px-2 py-1 text-[10px] font-medium text-[var(--inbox-text-secondary)]">
                  Draft inserted
                </span>
              )}
              {confidenceLabel && (
                <span className="rounded-full border border-[var(--inbox-divider)] bg-[var(--inbox-surface)] px-2 py-1 text-[10px] font-medium text-[var(--inbox-text-secondary)]">
                  Confidence {confidenceLabel}
                </span>
              )}
            </div>

            {!isExpanded && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="accent"
                  onClick={hasSuggestion && onInsertSuggestion ? onInsertSuggestion : onToggleExpanded}
                  className="min-w-[104px]"
                >
                  {hasSuggestion ? "Insertar" : "Ver ayuda"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={onToggleExpanded}
                  className="rounded-[var(--inbox-radius-control)]"
                >
                  Expandir
                </Button>
              </div>
            )}
          </div>
        </div>

        {isExpanded && (
          <div className="space-y-4 border-t border-[var(--inbox-divider)] px-4 py-4">
            {nextRecommendedAction && (
              <div className="rounded-[10px] border border-[var(--inbox-divider)] bg-[var(--inbox-surface)] px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--inbox-muted)]">
                  Next step
                </p>
                <p className="mt-1 text-sm leading-relaxed text-[var(--inbox-text)]">{nextRecommendedAction}</p>
              </div>
            )}

            {hasSuggestion && (
              <div className="rounded-[10px] border border-[var(--inbox-divider)] bg-[var(--inbox-surface)] px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--inbox-muted)]">
                  Suggested reply
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--inbox-text)]">
                  {suggestionContent}
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {hasSuggestion && onInsertSuggestion && (
                <Button type="button" size="sm" variant="accent" onClick={onInsertSuggestion}>
                  Insertar
                </Button>
              )}
              {hasSuggestion && onEditSuggestion && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={onEditSuggestion}
                  className="rounded-[var(--inbox-radius-control)]"
                >
                  <PenSquare className="h-3.5 w-3.5" />
                  Editar
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={onDismiss}
                className="rounded-[var(--inbox-radius-control)] text-[var(--inbox-text-secondary)]"
              >
                Descartar
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
