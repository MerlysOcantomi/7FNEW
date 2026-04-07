"use client"

import { ChevronDown, ChevronRight, FolderKanban, Loader2, User, WandSparkles, CheckSquare, Clock3, Sparkles, Inbox } from "lucide-react"
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
  channel: string
  channelLabel: string
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
  channel,
  channelLabel,
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
  const primaryAction = actions.find((action) => action.status === "suggested") ?? actions.find((action) => action.status === "approved") ?? null
  const secondaryActions = primaryAction ? actions.filter((action) => action.id !== primaryAction.id) : actions
  const categorizedActions = groupActionsByIntent(secondaryActions)
  const channelReadiness = getChannelReadiness(channel)
  const collapsedHint = primaryAction
    ? getActionTitle(primaryAction, actionTypeLabel)
    : channelReadiness.primaryHint
  const businessActions = [
    { key: "cliente", label: "Create client", icon: User, variant: "accent" as const },
    { key: "proyecto", label: "Create project", icon: FolderKanban, variant: "outline" as const },
    { key: "tarea", label: "Create task", icon: CheckSquare, variant: "outline" as const },
  ]

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
                  {collapsedHint && (
                    <p className="mt-1 truncate text-[11px] text-[var(--inbox-muted)]">
                      {primaryAction ? `Suggested now: ${collapsedHint}` : collapsedHint}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {suggestedCount > 0 && (
                  <span className="shrink-0 whitespace-nowrap rounded-full bg-[var(--inbox-accent-soft)] px-2 py-1 text-[10px] font-semibold text-[var(--inbox-accent)]">
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
            {primaryAction ? (
              <div className="rounded-[10px] border border-[var(--inbox-divider)] bg-[linear-gradient(180deg,rgba(230,241,242,0.5)_0%,rgba(255,255,255,1)_100%)] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--inbox-accent)]">
                  Recommended now
                </p>
                <div className="mt-2 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[var(--inbox-text)]">
                      {getActionTitle(primaryAction, actionTypeLabel)}
                    </p>
                    {getActionDescription(primaryAction) && (
                      <p className="mt-1 text-xs leading-relaxed text-[var(--inbox-text-secondary)]">
                        {getActionDescription(primaryAction)}
                      </p>
                    )}
                  </div>
                  <span className={cn("shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold", actionStatusBadge(primaryAction.status))}>
                    {actionStatusLabel(primaryAction.status)}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {primaryAction.status === "suggested" && (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="accent"
                        onClick={() => onAction(primaryAction, "approve")}
                        disabled={pendingActionId === primaryAction.id}
                      >
                        {pendingActionId === primaryAction.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Approve"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onAction(primaryAction, "dismiss")}
                        disabled={pendingActionId === primaryAction.id}
                        className="rounded-[var(--inbox-radius-control)]"
                      >
                        Dismiss
                      </Button>
                    </>
                  )}
                  {primaryAction.status === "approved" && (
                    <Button
                      type="button"
                      size="sm"
                      variant="accent"
                      onClick={() => onAction(primaryAction, "execute")}
                      disabled={pendingActionId === primaryAction.id}
                    >
                      {pendingActionId === primaryAction.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Execute"}
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-[10px] border border-[var(--inbox-divider)] bg-[var(--inbox-background)]/44 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--inbox-muted)]">
                  Recommended now
                </p>
                <p className="mt-2 text-xs leading-relaxed text-[var(--inbox-text-secondary)]">
                  {channelReadiness.primaryHint}
                </p>
              </div>
            )}

            <div className="grid gap-3">
              {categorizedActions.map((group) => (
                <div key={group.key} className="rounded-[10px] border border-[var(--inbox-divider)] bg-[var(--inbox-background)]/38 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-[var(--inbox-surface)] text-[var(--inbox-text-secondary)]">
                        <group.icon className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[var(--inbox-text)]">{group.label}</p>
                        <p className="text-[11px] text-[var(--inbox-text-secondary)]">{group.helper}</p>
                      </div>
                    </div>
                    <span className="shrink-0 whitespace-nowrap rounded-full border border-[var(--inbox-divider)] bg-[var(--inbox-surface)] px-2 py-0.5 text-[10px] font-medium text-[var(--inbox-text-secondary)]">
                      {group.items.length}
                    </span>
                  </div>

                  {group.items.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {group.items.map((action) => {
                        const isPending = pendingActionId === action.id
                        return (
                          <div key={action.id} className="flex items-start justify-between gap-3 rounded-[8px] bg-[var(--inbox-surface)] px-3 py-2.5">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-[var(--inbox-text)]">
                                {getActionTitle(action, actionTypeLabel)}
                              </p>
                              {getActionDescription(action) && (
                                <p className="mt-1 text-xs leading-relaxed text-[var(--inbox-text-secondary)]">
                                  {getActionDescription(action)}
                                </p>
                              )}
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <span className={cn("shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold", actionStatusBadge(action.status))}>
                                {actionStatusLabel(action.status)}
                              </span>
                              {action.status === "suggested" && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => onAction(action, "approve")}
                                  disabled={isPending}
                                  className="rounded-[var(--inbox-radius-control)]"
                                >
                                  {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Use"}
                                </Button>
                              )}
                              {action.status === "approved" && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => onAction(action, "execute")}
                                  disabled={isPending}
                                  className="rounded-[var(--inbox-radius-control)]"
                                >
                                  {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Run"}
                                </Button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-[var(--inbox-muted)]">{group.emptyText}</p>
                  )}
                </div>
              ))}
            </div>

            <div className="rounded-[10px] border border-dashed border-[var(--inbox-divider)] bg-[var(--inbox-background)]/44 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--inbox-muted)]">
                Channel readiness
              </p>
              <p className="mt-2 text-xs text-[var(--inbox-text-secondary)]">
                {channelLabel} can evolve into channel-specific execution without overloading the card today.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {channelReadiness.capabilities.map((capability) => (
                  <span
                    key={capability}
                    className="rounded-full border border-[var(--inbox-divider)] bg-[var(--inbox-surface)] px-2 py-1 text-[10px] font-medium text-[var(--inbox-text-secondary)]"
                  >
                    {capability}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-[10px] border border-dashed border-[var(--inbox-divider)] bg-[var(--inbox-background)]/44 p-3">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--inbox-muted)]">
                Quick conversions
              </p>
              <div className="flex flex-wrap gap-2">
                {businessActions.map((item) => (
                  <Button
                    key={item.key}
                    type="button"
                    size="sm"
                    variant={item.variant}
                    onClick={() => onConvert(item.key as "cliente" | "proyecto" | "tarea")}
                    className={cn(item.variant === "outline" && "rounded-[var(--inbox-radius-control)]")}
                  >
                    <item.icon className="h-3.5 w-3.5" />
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>

            {actionState && <p className="text-xs text-[var(--inbox-muted)]">{actionState}</p>}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}

function getActionTitle(action: ActionItem, actionTypeLabel: (type: string) => string) {
  return typeof action.data?.title === "string" && action.data.title.trim()
    ? action.data.title
    : actionTypeLabel(action.type)
}

function getActionDescription(action: ActionItem) {
  return typeof action.data?.description === "string" ? action.data.description : action.executionNotes || null
}

function groupActionsByIntent(actions: ActionItem[]) {
  const groups = [
    {
      key: "thread",
      label: "Thread management",
      helper: "Ownership, state and control of the conversation.",
      icon: Inbox,
      emptyText: "No thread-management actions are suggested right now.",
      items: [] as ActionItem[],
    },
    {
      key: "business",
      label: "Business operations",
      helper: "Create or link work around the conversation.",
      icon: FolderKanban,
      emptyText: "No business operation is suggested right now.",
      items: [] as ActionItem[],
    },
    {
      key: "followup",
      label: "Follow-up and time",
      helper: "Scheduling, reminders and next-touch actions.",
      icon: Clock3,
      emptyText: "No follow-up action is suggested right now.",
      items: [] as ActionItem[],
    },
    {
      key: "intelligence",
      label: "Intelligence and assistance",
      helper: "Guidance, proposal and AI-assisted next steps.",
      icon: Sparkles,
      emptyText: "No intelligence action is suggested right now.",
      items: [] as ActionItem[],
    },
  ]

  for (const action of actions) {
    const targetGroup =
      action.type === "assign_operator"
        ? "thread"
        : action.type === "schedule_followup"
          ? "followup"
          : action.type === "generate_proposal"
            ? "intelligence"
            : "business"

    groups.find((group) => group.key === targetGroup)?.items.push(action)
  }

  return groups
}

function getChannelReadiness(channel: string) {
  switch (channel) {
    case "email":
      return {
        primaryHint: "Email can evolve into reply all, forward, CC, BCC and subject actions here.",
        capabilities: ["Reply all", "Forward", "CC", "BCC", "Edit subject", "Schedule send"],
      }
    case "whatsapp":
    case "web_chat":
      return {
        primaryHint: "Chat channels prioritize follow-up, notes, attachments and quick execution.",
        capabilities: ["Follow-up", "Internal note", "Attachment", "Assign", "Change priority"],
      }
    case "portal":
      return {
        primaryHint: "Portal conversations can lean on task creation, routing and structured follow-up.",
        capabilities: ["Create task", "Route case", "Reminder", "Link project", "Assign"],
      }
    case "manual":
      return {
        primaryHint: "Manual conversations stay flexible and can expose the broadest execution set.",
        capabilities: ["Create lead", "Link client", "Follow-up", "Assign", "Summarize"],
      }
    default:
      return {
        primaryHint: "Channel-specific execution can expand here as more channel actions become available.",
        capabilities: ["Assign", "Follow-up", "Create task", "Summarize", "Suggest next step"],
      }
  }
}
