"use client"

import { ChevronDown, ChevronRight, FolderKanban, Loader2, User, WandSparkles, CheckSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

interface ActionItem {
  id: string
  type: string
  status: string
  data?: Record<string, unknown> | null
  executionNotes?: string | null
  errorMessage?: string | null
}

interface ActionsCardProps {
  actions: ActionItem[]
  expanded: boolean
  onExpandedChange: (value: boolean) => void
  pendingActionId: string | null
  actionTypeLabel: (type: string) => string
  actionStatusLabel: (status: string) => string
  actionStatusBadge: (status: string) => string
  onAction: (action: ActionItem, operation: "approve" | "dismiss" | "execute") => Promise<void>
  onConvert: (action: "cliente" | "proyecto" | "tarea") => Promise<void>
  actionState?: string | null
}

export function ActionsCard({
  actions,
  expanded,
  onExpandedChange,
  pendingActionId,
  actionTypeLabel,
  actionStatusLabel,
  actionStatusBadge,
  onAction,
  onConvert,
  actionState,
}: ActionsCardProps) {
  const suggestedCount = actions.filter((action) => action.status === "suggested").length

  return (
    <Card className="gap-0 overflow-hidden rounded-[var(--inbox-radius-panel)] border-[var(--inbox-border)] bg-[var(--inbox-surface)] py-0 shadow-[var(--inbox-panel-shadow-sm)]">
      <Collapsible open={expanded} onOpenChange={onExpandedChange}>
        <CardHeader className="px-4 py-0">
          <CollapsibleTrigger asChild>
            <button className="flex w-full items-center justify-between gap-3 py-4 text-left transition-colors hover:text-[var(--inbox-text)]">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--inbox-background)] text-[var(--inbox-text-secondary)]">
                  <WandSparkles className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-sm text-[var(--inbox-text)]">Actions</CardTitle>
                  <p className="mt-1 text-xs text-[var(--inbox-text-secondary)]">
                    {actions.length > 0
                      ? `${actions.length} action${actions.length === 1 ? "" : "s"} available`
                      : "No actions available yet"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {suggestedCount > 0 && (
                  <span className="rounded-full bg-[var(--inbox-accent-soft)] px-2 py-1 text-[10px] font-semibold text-[var(--inbox-accent)]">
                    {suggestedCount} suggested
                  </span>
                )}
                {expanded ? (
                  <ChevronDown className="h-4 w-4 text-[var(--inbox-text-secondary)]" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-[var(--inbox-text-secondary)]" />
                )}
              </div>
            </button>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-4 border-t border-[var(--inbox-divider)] px-4 py-4">
            {actions.length > 0 ? (
              <div className="space-y-3">
                {actions.map((action) => {
                  const title =
                    typeof action.data?.title === "string" && action.data.title.trim()
                      ? action.data.title
                      : actionTypeLabel(action.type)
                  const description =
                    typeof action.data?.description === "string" ? action.data.description : null
                  const isPending = pendingActionId === action.id

                  return (
                    <div key={action.id} className="space-y-2 border-b border-[var(--inbox-divider)] pb-3 last:border-b-0 last:pb-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-[var(--inbox-text)]">{title}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", actionStatusBadge(action.status))}>
                              {actionStatusLabel(action.status)}
                            </span>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          {action.status === "suggested" && (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="accent"
                                onClick={() => onAction(action, "approve")}
                                disabled={isPending}
                                className="min-w-[86px]"
                              >
                                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Approve"}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => onAction(action, "dismiss")}
                                disabled={isPending}
                                className="rounded-[var(--inbox-radius-control)]"
                              >
                                Dismiss
                              </Button>
                            </>
                          )}

                          {action.status === "approved" && (
                            <Button
                              type="button"
                              size="sm"
                              variant="accent"
                              onClick={() => onAction(action, "execute")}
                              disabled={isPending}
                              className="min-w-[86px]"
                            >
                              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Execute"}
                            </Button>
                          )}
                        </div>
                      </div>

                      {description && <p className="text-xs leading-relaxed text-[var(--inbox-text-secondary)]">{description}</p>}
                      {action.executionNotes && (
                        <p className="text-xs text-[var(--inbox-text-secondary)]">
                          <span className="font-semibold text-[var(--inbox-text)]">Notes:</span> {action.executionNotes}
                        </p>
                      )}
                      {action.errorMessage && (
                        <p className="text-xs text-destructive">
                          <span className="font-semibold">Error:</span> {action.errorMessage}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-[var(--inbox-muted)]">There are no suggested actions for this conversation yet.</p>
            )}

            <div className="rounded-[10px] border border-dashed border-[var(--inbox-divider)] bg-[var(--inbox-background)]/44 p-3">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--inbox-muted)]">
                Convert
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="accent" onClick={() => onConvert("cliente")}>
                  <User className="h-3.5 w-3.5" />
                  Client
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => onConvert("proyecto")} className="rounded-[var(--inbox-radius-control)]">
                  <FolderKanban className="h-3.5 w-3.5" />
                  Project
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => onConvert("tarea")} className="rounded-[var(--inbox-radius-control)]">
                  <CheckSquare className="h-3.5 w-3.5" />
                  Task
                </Button>
              </div>
            </div>

            {actionState && <p className="text-xs text-[var(--inbox-muted)]">{actionState}</p>}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
