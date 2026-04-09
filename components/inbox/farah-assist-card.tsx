"use client"

import { ChevronDown, ChevronRight, Globe, PenSquare, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type FarahAssistState = "hidden" | "compact" | "expanded"

interface FarahAssistCardProps {
  state: Exclude<FarahAssistState, "hidden">
  summary?: string | null
  suggestionTitle?: string | null
  suggestionContent?: string | null
  nextRecommendedAction?: string | null
  confidenceLabel?: string | null
  detectedLanguage?: string | null
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
  detectedLanguage,
  autoPopulated = false,
  onToggleExpanded,
  onInsertSuggestion,
  onEditSuggestion,
  onDismiss,
}: FarahAssistCardProps) {
  const isExpanded = state === "expanded"
  const hasSuggestion = Boolean(suggestionContent?.trim())
  const languageHint = detectedLanguage && detectedLanguage.toLowerCase() !== "en"
    ? detectedLanguage.toUpperCase()
    : null

  return (
    <div className="shrink-0 border-t border-[var(--inbox-divider)] bg-[var(--inbox-surface)]/96 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-[var(--inbox-surface)]/92 md:px-5">
      <div className={cn(
        "rounded-[var(--inbox-radius-panel)] border shadow-[var(--inbox-panel-shadow-sm)]",
        hasSuggestion
          ? "border-[var(--inbox-accent)]/30 bg-[linear-gradient(180deg,rgba(230,241,242,0.6)_0%,rgba(255,255,255,1)_42%)]"
          : "border-[var(--inbox-border)] bg-[var(--inbox-surface)]",
      )}>
        {/* ── Compact state ── */}
        {!isExpanded && (
          <div className="flex items-center gap-3 px-3.5 py-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--inbox-accent-soft)] text-[var(--inbox-accent)]">
              <Sparkles className="h-3.5 w-3.5" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--inbox-accent)]">
                  Farah
                </span>
                {hasSuggestion && (
                  <span className="rounded-full bg-[var(--inbox-accent-soft)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--inbox-accent)]">
                    Reply ready
                  </span>
                )}
                {autoPopulated && (
                  <span className="rounded-full border border-[var(--inbox-divider)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--inbox-text-secondary)]">
                    Inserted
                  </span>
                )}
                {languageHint && (
                  <span className="inline-flex items-center gap-0.5 rounded-full border border-[var(--inbox-divider)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--inbox-text-secondary)]">
                    <Globe className="h-2.5 w-2.5" />
                    {languageHint}
                  </span>
                )}
                {confidenceLabel && (
                  <span className="hidden rounded-full border border-[var(--inbox-divider)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--inbox-text-secondary)] sm:inline-flex">
                    {confidenceLabel}
                  </span>
                )}
              </div>
              {hasSuggestion && (
                <p className="mt-0.5 truncate text-xs text-[var(--inbox-text-secondary)]">
                  {suggestionTitle || suggestionContent}
                </p>
              )}
              {!hasSuggestion && summary && (
                <p className="mt-0.5 truncate text-xs text-[var(--inbox-text-secondary)]">
                  {summary}
                </p>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {hasSuggestion && onInsertSuggestion && (
                <Button
                  type="button"
                  size="sm"
                  variant="accent"
                  onClick={onInsertSuggestion}
                  className="h-7 min-w-[72px] rounded-[var(--inbox-radius-control)] text-xs"
                >
                  Use reply
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="h-7 w-7 rounded-[var(--inbox-radius-control)] text-[var(--inbox-text-secondary)] hover:bg-[var(--inbox-background)]"
                onClick={onToggleExpanded}
                title="Expand"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="h-7 w-7 rounded-[var(--inbox-radius-control)] text-[var(--inbox-text-secondary)] hover:bg-[var(--inbox-background)]"
                onClick={onDismiss}
                title="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Expanded state ── */}
        {isExpanded && (
          <>
            <div className="flex items-start gap-3 px-4 py-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--inbox-accent-soft)] text-[var(--inbox-accent)]">
                <Sparkles className="h-4 w-4" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--inbox-accent)]">
                      Farah
                    </span>
                    {languageHint && (
                      <span className="inline-flex items-center gap-0.5 rounded-full border border-[var(--inbox-divider)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--inbox-text-secondary)]">
                        <Globe className="h-2.5 w-2.5" />
                        {languageHint}
                      </span>
                    )}
                    {confidenceLabel && (
                      <span className="rounded-full border border-[var(--inbox-divider)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--inbox-text-secondary)]">
                        {confidenceLabel}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="h-7 w-7 rounded-[var(--inbox-radius-control)] text-[var(--inbox-text-secondary)] hover:bg-[var(--inbox-background)]"
                      onClick={onToggleExpanded}
                      title="Collapse"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="h-7 w-7 rounded-[var(--inbox-radius-control)] text-[var(--inbox-text-secondary)] hover:bg-[var(--inbox-background)]"
                      onClick={onDismiss}
                      title="Dismiss"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {summary && (
                  <p className="mt-1.5 text-xs leading-relaxed text-[var(--inbox-text-secondary)]">
                    {summary}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-3 border-t border-[var(--inbox-divider)] px-4 py-3">
              {nextRecommendedAction && (
                <div className="rounded-[8px] border border-[var(--inbox-divider)] bg-[var(--inbox-accent-soft)]/40 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--inbox-accent)]">
                    Next step
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--inbox-text)]">{nextRecommendedAction}</p>
                </div>
              )}

              {hasSuggestion && (
                <div className="rounded-[8px] border border-[var(--inbox-divider)] bg-[var(--inbox-surface)] px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--inbox-muted)]">
                    Suggested reply
                  </p>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-[var(--inbox-text)]">
                    {suggestionContent}
                  </p>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {hasSuggestion && onInsertSuggestion && (
                  <Button type="button" size="sm" variant="accent" onClick={onInsertSuggestion} className="min-w-[80px]">
                    Use reply
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
                    Edit
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={onDismiss}
                  className="rounded-[var(--inbox-radius-control)] text-[var(--inbox-text-secondary)]"
                >
                  Dismiss
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
