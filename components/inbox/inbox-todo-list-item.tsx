"use client"

import { Check, MessageSquare, Mail, X, Bot, Clock3, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Wire shape — what the API returns. Matches `InboxTodoRecord` from
 * `modules/inbox/todo-service.ts` but with all `Date` fields serialized to strings (JSON over
 * the wire). We declare it locally so this component can be used without a server-side import.
 */
export interface ClientInboxTodo {
  id: string
  workspaceId: string
  conversationId: string | null
  sourceMessageId: string | null
  sourceActionId: string | null
  sourceNoteId: string | null
  title: string
  description: string | null
  status: "open" | "done" | "dismissed" | "waiting"
  priority: "low" | "normal" | "high" | "urgent"
  assigneeType: "me" | "fanny" | "automation" | "client" | "team"
  assigneeId: string | null
  dueAt: string | null
  remindAt: string | null
  createdBy: string
  createdSource: string
  completedAt: string | null
  completedBy: string | null
  dismissedAt: string | null
  dismissedReason: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

interface InboxTodoListItemProps {
  todo: ClientInboxTodo
  /** Optional contact display label; resolved by the parent (lookup by conversationId). */
  contactLabel?: string | null
  /** Optional channel hint resolved by the parent for the source conversation. */
  channelLabel?: string | null
  selected?: boolean
  onSelect: () => void
  onToggleDone: () => void
  onDismiss: () => void
  /** Disable buttons while a mutation is in flight to avoid double-fires. */
  busy?: boolean
}

/**
 * Tokens — match the existing left column. We deliberately reuse `--inbox-list-*` so the To-do
 * view feels like a peer of the conversation list, not a foreign module.
 */
const PRIORITY_STYLES: Record<ClientInboxTodo["priority"], string> = {
  low: "border-transparent bg-transparent text-[var(--inbox-list-text-secondary)]",
  normal: "border-transparent bg-transparent text-[var(--inbox-list-text-secondary)]",
  high: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  urgent: "border-rose-400/40 bg-rose-500/15 text-rose-300",
}

const ASSIGNEE_LABEL: Record<ClientInboxTodo["assigneeType"], string> = {
  me: "Me",
  fanny: "Fanny",
  automation: "Automation",
  client: "Client",
  team: "Team",
}

/**
 * Friendly relative due date. Days only — keeps the row compact. Past-due gets red emphasis via
 * the parent's chip styling; here we only return text.
 */
function formatDue(dueAt: string | null): string | null {
  if (!dueAt) return null
  const due = new Date(dueAt)
  if (Number.isNaN(due.getTime())) return null
  const now = new Date()
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diffDays = Math.round((startOfDay(due) - startOfDay(now)) / (1000 * 60 * 60 * 24))
  if (diffDays < -1) return `${Math.abs(diffDays)}d overdue`
  if (diffDays === -1) return "Yesterday"
  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Tomorrow"
  if (diffDays < 7) return `In ${diffDays}d`
  return due.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function isOverdue(dueAt: string | null, status: ClientInboxTodo["status"]): boolean {
  if (status === "done" || status === "dismissed") return false
  if (!dueAt) return false
  const d = new Date(dueAt)
  if (Number.isNaN(d.getTime())) return false
  return d.getTime() < Date.now() - 24 * 60 * 60 * 1000
}

export function InboxTodoListItem({
  todo,
  contactLabel,
  channelLabel,
  selected,
  onSelect,
  onToggleDone,
  onDismiss,
  busy,
}: InboxTodoListItemProps) {
  const dueText = formatDue(todo.dueAt)
  const overdue = isOverdue(todo.dueAt, todo.status)
  const isDone = todo.status === "done"
  const isWaiting = todo.status === "waiting"
  const showPriorityChip = todo.priority === "high" || todo.priority === "urgent"
  const sourceIcon = todo.sourceMessageId
    ? Mail
    : todo.conversationId
      ? MessageSquare
      : null
  const SourceIcon = sourceIcon

  const AssigneeIcon =
    todo.assigneeType === "fanny" ? Bot : todo.assigneeType === "automation" ? Bot : null

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected ?? false}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onSelect()
        }
      }}
      className={cn(
        "group flex w-full cursor-pointer items-start gap-2 rounded-lg border border-transparent px-2.5 py-2 text-left transition-colors",
        selected
          ? "border-[var(--inbox-accent)]/30 bg-[var(--inbox-list-selected-bg)]"
          : "hover:bg-[var(--inbox-list-background)]",
      )}
    >
      {/*
       * Checkbox toggles done ↔ open. Reversibility is the contract — clicking a checked box
       * reopens (the parent flips status back to "open"). We swallow the onClick to keep the
       * row's onSelect from firing alongside the toggle.
       */}
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          if (!busy) onToggleDone()
        }}
        disabled={busy}
        aria-label={isDone ? "Reopen to-do" : "Mark to-do as done"}
        title={isDone ? "Reopen" : "Mark as done"}
        className={cn(
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
          isDone
            ? "border-[var(--inbox-done-color)] bg-[var(--inbox-done-color)]/20 text-[var(--inbox-done-color)]"
            : "border-[var(--inbox-list-border)] bg-transparent text-transparent hover:border-[var(--inbox-accent)] hover:text-[var(--inbox-accent)]/70",
          busy && "opacity-50",
        )}
      >
        {isDone ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p
            className={cn(
              "truncate text-[13px] font-medium leading-tight",
              isDone
                ? "text-[var(--inbox-list-text-secondary)] line-through decoration-[var(--inbox-done-color)]/50"
                : "text-[var(--inbox-list-text)]",
            )}
            title={todo.title}
          >
            {todo.title}
          </p>
          {showPriorityChip && (
            <span
              className={cn(
                "shrink-0 rounded-full border px-1.5 py-0 text-[9px] font-bold uppercase tracking-wider",
                PRIORITY_STYLES[todo.priority],
              )}
            >
              {todo.priority}
            </span>
          )}
          {isWaiting && (
            <span
              className="shrink-0 rounded-full border border-[var(--inbox-waiting-color)]/30 bg-[var(--inbox-waiting-color)]/10 px-1.5 py-0 text-[9px] font-bold uppercase tracking-wider text-[var(--inbox-waiting-color)]"
              title="Waiting on external party"
            >
              Waiting
            </span>
          )}
        </div>

        {/* Meta row — contact · channel · due · assignee. We omit pieces silently when missing. */}
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] leading-tight text-[var(--inbox-list-text-secondary)]">
          {contactLabel && (
            <span className="truncate" title={contactLabel}>
              {contactLabel}
            </span>
          )}
          {contactLabel && (channelLabel || dueText || todo.assigneeType !== "me") && (
            <span aria-hidden>·</span>
          )}
          {channelLabel && <span className="truncate">{channelLabel}</span>}
          {channelLabel && (dueText || todo.assigneeType !== "me") && <span aria-hidden>·</span>}
          {dueText && (
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-0.5",
                overdue && "font-semibold text-rose-300",
              )}
            >
              {overdue ? (
                <AlertCircle className="h-3 w-3" />
              ) : (
                <Clock3 className="h-3 w-3 opacity-70" />
              )}
              {dueText}
            </span>
          )}
          {dueText && todo.assigneeType !== "me" && <span aria-hidden>·</span>}
          {todo.assigneeType !== "me" && (
            <span className="inline-flex shrink-0 items-center gap-0.5">
              {AssigneeIcon ? <AssigneeIcon className="h-3 w-3 opacity-70" /> : null}
              {ASSIGNEE_LABEL[todo.assigneeType]}
            </span>
          )}
        </div>
      </div>

      {/* Right-side actions — only show on hover/selection to keep rows clean. */}
      <div
        className={cn(
          "flex shrink-0 items-center gap-0.5 self-center transition-opacity",
          selected ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100",
        )}
      >
        {SourceIcon && (
          <span
            className="flex h-5 w-5 items-center justify-center text-[var(--inbox-list-text-secondary)]/60"
            title={
              todo.sourceMessageId
                ? "Linked to a message"
                : todo.conversationId
                  ? "Linked to a conversation"
                  : ""
            }
          >
            <SourceIcon className="h-3 w-3" />
          </span>
        )}
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            if (!busy) onDismiss()
          }}
          disabled={busy}
          aria-label={isDone ? "Dismiss to-do" : "Dismiss to-do (didn't need action)"}
          title="Dismiss"
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded text-[var(--inbox-list-text-secondary)] transition-colors hover:bg-white/10 hover:text-rose-300",
            busy && "opacity-50",
          )}
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}
