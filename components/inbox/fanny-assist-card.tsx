"use client"

import { ChevronDown, ChevronRight, PenSquare, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type FannyAssistState = "hidden" | "compact" | "expanded"

interface FannyAssistCardProps {
  state: Exclude<FannyAssistState, "hidden">
  suggestionTitle?: string | null
  suggestionContent?: string | null
  autoPopulated?: boolean
  onToggleExpanded: () => void
  onInsertSuggestion?: () => void
  onEditSuggestion?: () => void
  onDismiss: () => void
}

export function FannyAssistCard({
  state,
  suggestionTitle,
  suggestionContent,
  autoPopulated = false,
  onToggleExpanded,
  onInsertSuggestion,
  onEditSuggestion,
  onDismiss,
}: FannyAssistCardProps) {
  const isExpanded = state === "expanded"
  const hasSuggestion = Boolean(suggestionContent?.trim())

  if (!hasSuggestion) return null

  return (
    <div className="shrink-0 border-b border-[var(--inbox-divider)] bg-[var(--inbox-surface)]/96 px-5 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-[var(--inbox-surface)]/92 md:px-6">
      <div className={cn(
        "rounded-xl border shadow-sm",
        "border-[var(--inbox-accent)]/25 bg-[var(--inbox-accent-soft)]/30",
      )}>
        {!isExpanded && (
          <div className="flex items-center gap-3 px-3.5 py-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--inbox-accent-soft)] text-[var(--inbox-accent)]">
              <Sparkles className="h-3 w-3" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--inbox-accent)]">
                  Fanny
                </span>
                <span className="rounded-full bg-[var(--inbox-accent-soft)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--inbox-accent)]">
                  Reply ready
                </span>
                {autoPopulated && (
                  <span className="rounded-full border border-[var(--inbox-divider)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--inbox-text-secondary)]">
                    Inserted
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate text-xs text-[var(--inbox-text-secondary)]">
                {suggestionTitle || suggestionContent}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {onInsertSuggestion && (
                <Button
                  type="button"
                  size="sm"
                  variant="accent"
                  onClick={onInsertSuggestion}
                  className="h-6 min-w-[64px] rounded-lg text-[11px]"
                >
                  Use reply
                </Button>
              )}
              <button
                type="button"
                className="rounded-md p-1 text-[var(--inbox-text-secondary)] hover:bg-white/8"
                onClick={onToggleExpanded}
                title="Expand"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="rounded-md p-1 text-[var(--inbox-text-secondary)] hover:bg-white/8"
                onClick={onDismiss}
                title="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {isExpanded && (
          <>
            <div className="flex items-start gap-3 px-4 py-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--inbox-accent-soft)] text-[var(--inbox-accent)]">
                <Sparkles className="h-3.5 w-3.5" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--inbox-accent)]">
                    Suggested reply
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="rounded-md p-1 text-[var(--inbox-text-secondary)] hover:bg-white/8"
                      onClick={onToggleExpanded}
                      title="Collapse"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="rounded-md p-1 text-[var(--inbox-text-secondary)] hover:bg-white/8"
                      onClick={onDismiss}
                      title="Dismiss"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--inbox-text)]">
                  {suggestionContent}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-[var(--inbox-divider)] px-4 py-2.5">
              {onInsertSuggestion && (
                <Button type="button" size="sm" variant="accent" onClick={onInsertSuggestion} className="min-w-[72px]">
                  Use reply
                </Button>
              )}
              {onEditSuggestion && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={onEditSuggestion}
                  className="rounded-lg border-[var(--inbox-border)] bg-transparent text-[var(--inbox-text)] hover:bg-white/8 hover:text-[var(--inbox-accent)]"
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
                className="rounded-lg text-[var(--inbox-text-secondary)]"
              >
                Dismiss
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
