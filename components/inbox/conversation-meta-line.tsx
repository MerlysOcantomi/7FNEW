"use client"

import { Badge, badgeVariants } from "@/components/ui/badge"
import type { VariantProps } from "class-variance-authority"
import { Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>

function statusForSemantics(status: string): string {
  return status === "triaged" ? "assigned" : status
}

/** Semántica de color restringida: ámbar = lead oportunidad, verde = convertido, rojo = urgencia/riesgo, azul suave = nuevo, neutro donde aplica. */
function statusSemanticClasses(status: string): string {
  const s = statusForSemantics(status)
  switch (s) {
    case "awaiting_response":
      return "!border !border-[rgba(232,111,116,0.32)] !bg-[rgba(232,111,116,0.12)] !text-[var(--inbox-destructive)]"
    case "lead_detected":
      return "!border !border-[rgba(242,198,109,0.35)] !bg-[rgba(242,198,109,0.14)] !text-[var(--inbox-lead-color)]"
    case "new":
      return "!border !border-[rgba(147,197,253,0.22)] !bg-[rgba(59,130,246,0.1)] !text-[#93C5FD]"
    case "converted":
      return "!border !border-[rgba(143,198,162,0.28)] !bg-[rgba(143,198,162,0.14)] !text-[var(--inbox-success)]"
    case "assigned":
      return "!border !border-white/[0.1] !bg-white/[0.06] !text-[var(--inbox-list-text-secondary)]"
    default:
      return "!border !border-white/[0.08] !bg-white/[0.05] !text-[var(--inbox-list-text-secondary)]"
  }
}

/** Prioridad alta / crítica: mismo tono rojo que awaiting (atención fuerte); media/baja discretas. */
function urgencySoftClasses(urgencyVariant: string): string {
  switch (urgencyVariant) {
    case "urgency-critical":
    case "urgency-high":
      return "!border !border-[rgba(232,111,116,0.32)] !bg-[rgba(232,111,116,0.12)] !text-[var(--inbox-destructive)] shadow-none"
    case "urgency-medium":
      return "!border !border-white/[0.08] !bg-white/[0.07] !text-[var(--inbox-list-text-secondary)] shadow-none"
    case "urgency-low":
      return "!border !border-white/[0.06] !bg-white/[0.05] !text-[var(--inbox-list-text-secondary)]/85 shadow-none"
    default:
      return ""
  }
}

interface ConversationMetaLineProps {
  conversationStatus: string
  statusLabel: string
  statusClassName: string
  urgencyLabel: string
  urgencyClassName: string
  leadScore?: number | null
  sectorLabel?: string | null
  /**
   * Operator-assigned workspace category from `Conversation.category`.
   * Drawn from `Workspace.config.taxonomies.inbox` and set manually via
   * `<ConversationCategoryEditor>` in the thread header. We render a
   * subtle pill ONLY when it is a non-empty string — `null` / `""`
   * means "uncategorised" and the row stays exactly as before.
   *
   * Independent of `intent` (AI classifier) on purpose; that text is
   * never surfaced here so the operator can tell at a glance which
   * threads they have personally triaged vs. those still on AI hints.
   */
  category?: string | null
  /**
   * PR 10 — count of Fanny-suggested `WorkspaceTask` rows still in
   * `proposed` status for this conversation. Renders a discreet
   * accent-tinted pill only when `proposedTaskCount > 0` so the
   * operator can spot conversations that have AI suggestions waiting
   * for approval without opening each thread. Defaults to `0` /
   * `undefined` for conversations without suggestions, which keeps
   * their meta line visually identical to its pre-PR state.
   */
  proposedTaskCount?: number
  /**
   * PR 2 (Smart Action visibility) — derived, read-only Smart Action state
   * for this conversation (see `modules/inbox/smart-action-state.ts`). We
   * render ONE subtle pill summarising where Fanny's work stands, reusing
   * this existing wrap-line so the row gains no vertical height.
   *
   * De-dup rule: when `proposedTaskCount > 0` the "pending decisions" pill
   * above already conveys the `needs_review` signal, so we suppress the
   * Smart Action pill for that exact case to avoid a double badge. All other
   * states (failed / draft_ready / action_ready / task_created, and the rare
   * suggested-action-only needs_review with no proposed task) render here.
   * `"none"` / `undefined` renders nothing — row stays pixel-identical.
   */
  smartActionState?:
    | "none"
    | "failed"
    | "needs_review"
    | "draft_ready"
    | "action_ready"
    | "task_created"
}

/**
 * Subtle, read-only presentation map for the derived Smart Action state.
 * Colours follow the same restrained semantics used elsewhere in this file:
 * red = attention/failure, accent = needs a human, info-blue = Fanny prepared
 * something, green = ready, neutral = informational. Labels are short on
 * purpose — the narrow list column can't afford long copy.
 */
const SMART_ACTION_BADGE: Record<
  "failed" | "needs_review" | "draft_ready" | "action_ready" | "task_created",
  { label: string; title: string; className: string }
> = {
  failed: {
    label: "Failed",
    title: "A Smart Action failed — needs attention",
    className:
      "border border-[rgba(232,111,116,0.32)] bg-[rgba(232,111,116,0.12)] text-[var(--inbox-destructive)]",
  },
  needs_review: {
    label: "Review",
    title: "Fanny prepared something that needs your review",
    className:
      "border border-[var(--inbox-accent)]/30 bg-[var(--inbox-accent)]/10 text-[var(--inbox-accent)]",
  },
  draft_ready: {
    label: "Draft",
    title: "Fanny prepared a reply draft",
    className:
      "border border-[rgba(147,197,253,0.22)] bg-[rgba(59,130,246,0.1)] text-[#93C5FD]",
  },
  action_ready: {
    label: "Ready",
    title: "A Smart Action is ready",
    className:
      "border border-[rgba(143,198,162,0.28)] bg-[rgba(143,198,162,0.14)] text-[var(--inbox-success)]",
  },
  task_created: {
    label: "Task",
    title: "A task was created from this conversation",
    className: "border border-white/[0.1] bg-white/[0.06] text-[var(--inbox-list-text-secondary)]",
  },
}

export function ConversationMetaLine({
  conversationStatus,
  statusLabel,
  statusClassName,
  urgencyLabel,
  urgencyClassName,
  leadScore,
  sectorLabel,
  category,
  proposedTaskCount,
  smartActionState,
}: ConversationMetaLineProps) {
  /**
   * Singular / plural copy. PR 11 swapped "Fanny suggestion(s)" for
   * "pending decision(s)" so the badge stays consistent with the
   * Smart Hub's "Pending decisions" section title and reinforces the
   * IA: this row needs a human decision (approve / dismiss), not
   * generic execution. The pill is hidden entirely when `count <= 0`
   * (or `undefined`), so rows without proposals keep their previous
   * footprint to the pixel.
   */
  const proposedTaskBadge =
    typeof proposedTaskCount === "number" && proposedTaskCount > 0
      ? proposedTaskCount === 1
        ? "1 pending decision"
        : `${proposedTaskCount} pending decisions`
      : null
  const hideTerminal =
    conversationStatus === "archived" ||
    conversationStatus === "closed" ||
    conversationStatus === "trashed"

  /**
   * Resolve the Smart Action pill. Suppressed when the state is absent /
   * "none", and de-duped against the proposed-task pill: a `needs_review`
   * driven by a proposed task is already shown as "N pending decision(s)"
   * above, so we don't repeat it. Unknown values degrade to no pill.
   */
  const smartActionBadge =
    smartActionState && smartActionState !== "none"
      ? smartActionState === "needs_review" && proposedTaskBadge
        ? null
        : SMART_ACTION_BADGE[smartActionState] ?? null
      : null

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {sectorLabel ? (
        <span className="rounded-md border border-[var(--inbox-list-border)] bg-[var(--inbox-list-background)] px-2 py-0.5 text-[10px] font-medium text-[var(--inbox-list-text-secondary)] whitespace-nowrap">
          {sectorLabel}
        </span>
      ) : null}
      {!hideTerminal ? (
        <Badge
          variant={statusClassName as BadgeVariant}
          className={cn(
            "h-auto rounded-lg border-0 px-2 py-0.5 text-[10px] font-semibold shadow-none whitespace-nowrap",
            statusSemanticClasses(conversationStatus),
          )}
        >
          {statusLabel}
        </Badge>
      ) : null}
      {!hideTerminal ? (
        <Badge
          variant={urgencyClassName as BadgeVariant}
          className={cn(
            "h-auto rounded-md border-0 px-2 py-0.5 text-[10px] font-medium shadow-none whitespace-nowrap",
            urgencySoftClasses(urgencyClassName),
          )}
        >
          {urgencyLabel}
        </Badge>
      ) : null}
      {typeof leadScore === "number" && (
        <span className="rounded-md border border-[rgba(242,198,109,0.35)] bg-[rgba(242,198,109,0.12)] px-2 py-0.5 text-[10px] font-semibold tabular-nums text-[var(--inbox-lead-color)] shadow-none whitespace-nowrap">
          Lead {leadScore}
        </span>
      )}
      {/*
       * Workspace category pill. Subtle by design — same rounded-md
       * footprint as the sector chip, accent-tinted so it remains
       * distinguishable from urgency/status without competing with
       * them. `max-w` + `truncate` guard against operator-defined
       * labels longer than the row can comfortably hold (e.g. an
       * accidental paragraph), without blowing the layout. The full
       * value stays accessible via `title`.
       */}
      {category ? (
        <span
          className="inline-flex max-w-[12rem] items-center rounded-md border border-[var(--inbox-accent)]/30 bg-[var(--inbox-accent)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--inbox-accent)] shadow-none truncate whitespace-nowrap"
          title={`Category: ${category}`}
        >
          {category}
        </span>
      ) : null}
      {/*
       * PR 10 — Fanny suggestion pill. Renders only when the conversation
       * has at least one proposed `WorkspaceTask` (linked to a `create_task`
       * ConversationAction). The accent border + sparkle icon keep it
       * distinguishable from status / urgency / category chips while
       * staying visually secondary; it does NOT compete with primary
       * metadata for vertical real estate (sits inline on the existing
       * meta row's wrap line).
       */}
      {proposedTaskBadge ? (
        <span
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--inbox-accent)]/30 bg-[var(--inbox-accent)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--inbox-accent)] shadow-none whitespace-nowrap"
          title="Fanny suggestions awaiting your approve / dismiss decision"
        >
          <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
          {proposedTaskBadge}
        </span>
      ) : null}
      {/*
       * PR 2 — Smart Action state pill. The single SevenF-native signal of
       * "what did Fanny prepare / what needs review / what is ready". Sits on
       * the same wrap line as the other chips (no extra row height) and only
       * appears for actionable states. Read-only: no filter is wired to it
       * yet — exposing it as a More-filters control is deferred (see PR notes)
       * because the WorkspaceTask-backed signals can't be filtered via a
       * Conversation relation without a schema relation.
       */}
      {smartActionBadge ? (
        <span
          className={cn(
            "inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[10px] font-semibold shadow-none whitespace-nowrap",
            smartActionBadge.className,
          )}
          title={smartActionBadge.title}
        >
          {smartActionBadge.label}
        </span>
      ) : null}
    </div>
  )
}
