"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import {
  Phone,
  Users,
  StickyNote,
  Bell,
  Upload,
  Sparkles,
  Check,
  Loader2,
  PenSquare,
  ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useManualIntake } from "@/components/manual-intake/manual-intake-provider"
import {
  interpretCapture,
  type ManualInterpretation,
  type ManualPriority,
  type ManualSourceKind,
} from "@/lib/manual-intake/interpret-capture"

type Stage = "capture" | "review"

const SOURCE_CHIPS: Array<{ id: ManualSourceKind; label: string; icon: typeof Phone }> = [
  { id: "phone", label: "Phone call", icon: Phone },
  { id: "in_person", label: "In-person", icon: Users },
  { id: "note", label: "Note", icon: StickyNote },
  { id: "reminder", label: "Reminder", icon: Bell },
  { id: "imported", label: "Imported", icon: Upload },
]

const PRIORITY_CHIPS: ManualPriority[] = ["low", "normal", "high", "urgent"]

/** Real next steps backed by existing write paths. */
interface RealSteps {
  /** Always on: creates the Manual conversation. The anchor write. */
  addToInbox: true
  createFollowUp: boolean
  addToToday: boolean
}

/**
 * Manual Intake sheet — global capture surface. Mounted once inside AppShell and
 * controlled by `ManualIntakeProvider`; opened from the inbox toolbar and Global New.
 *
 * Two states: Capture → "Fanny organized" review. Confirm writes a real Manual
 * conversation (POST /api/inbox, channel="manual") and, when selected, a linked
 * follow-up task (POST /api/inbox/todos). Steps without a safe write path today
 * (Schedule / Connect client / Save as note) are shown disabled as "Soon" — never
 * faked. Source kind + Fanny summary are capture-time hints; persisting them is a
 * documented follow-up (the /api/inbox body has no field for them yet).
 */
export function ManualIntakeSheet() {
  const { open, setOpen, available } = useManualIntake()
  const router = useRouter()

  const [stage, setStage] = useState<Stage>("capture")
  const [sourceKind, setSourceKind] = useState<ManualSourceKind>("phone")
  const [text, setText] = useState("")
  const [who, setWho] = useState("")
  const [whenNote, setWhenNote] = useState("")
  const [priority, setPriority] = useState<ManualPriority>("normal")
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [interp, setInterp] = useState<ManualInterpretation | null>(null)
  const [steps, setSteps] = useState<RealSteps>({
    addToInbox: true,
    createFollowUp: false,
    addToToday: false,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset to a clean capture each time the sheet closes.
  useEffect(() => {
    if (open) return
    setStage("capture")
    setSourceKind("phone")
    setText("")
    setWho("")
    setWhenNote("")
    setPriority("normal")
    setDetailsOpen(false)
    setInterp(null)
    setSteps({ addToInbox: true, createFollowUp: false, addToToday: false })
    setSubmitting(false)
    setError(null)
  }, [open])

  function handleOrganize() {
    const read = interpretCapture(text, sourceKind)
    setInterp(read)
    setPriority(read.priority)
    setSteps({
      addToInbox: true,
      createFollowUp: read.suggestedActions.includes("create_follow_up"),
      addToToday: read.suggestedActions.includes("add_to_today"),
    })
    setStage("review")
  }

  const selectedCount = useMemo(
    () => 1 + (steps.createFollowUp ? 1 : 0) + (steps.addToToday ? 1 : 0),
    [steps],
  )

  async function handleConfirm() {
    if (submitting) return
    setError(null)
    setSubmitting(true)
    try {
      // 1) Create the Manual conversation (channel="manual"). This is the anchor.
      const convRes = await fetch("/api/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          nombre: who.trim() || undefined,
          mensaje: text.trim(),
          fuente: "manual",
        }),
      })
      const convJson = await convRes.json().catch(() => ({}))
      if (!convRes.ok || convJson?.success === false) {
        throw new Error(convJson?.error?.message || "Could not add to Inbox")
      }
      const conversationId: string | undefined =
        convJson?.data?.conversationId ?? convJson?.conversationId

      // 2) Optional linked follow-up task (Today = due today).
      const needsTask = steps.createFollowUp || steps.addToToday
      if (needsTask && conversationId) {
        const title = (interp?.summary || text.trim()).slice(0, 120)
        let dueAt: string | undefined
        if (steps.addToToday) {
          const d = new Date()
          d.setHours(23, 59, 0, 0)
          dueAt = d.toISOString()
        }
        const taskRes = await fetch("/api/inbox/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            title,
            conversationId,
            priority,
            dueAt,
            createdSource: "manual",
          }),
        })
        const taskJson = await taskRes.json().catch(() => ({}))
        if (!taskRes.ok || taskJson?.success === false) {
          // The conversation already exists; surface the partial failure honestly.
          throw new Error(
            taskJson?.error?.message ||
              "Added to Inbox, but the follow-up could not be created",
          )
        }
      }

      setOpen(false)
      if (conversationId) {
        router.push(`/inbox?id=${encodeURIComponent(conversationId)}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSubmitting(false)
    }
  }

  if (!available) return null

  const canOrganize = text.trim().length > 0

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        className="w-full gap-0 border-l border-[var(--inbox-border)] bg-[var(--app-surface-dark)] p-0 text-[var(--inbox-text)] sm:max-w-md"
      >
        <SheetHeader className="border-b border-[var(--inbox-border)] p-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--inbox-accent)]/15 text-[var(--inbox-accent)]">
              <PenSquare className="h-4 w-4" aria-hidden="true" />
            </span>
            <SheetTitle className="text-[var(--inbox-text)]">
              {stage === "capture" ? "Capture something" : "Fanny organized this"}
            </SheetTitle>
          </div>
          <SheetDescription className="text-[var(--inbox-text-secondary)]">
            {stage === "capture"
              ? "Add a call, note, request or follow-up. Fanny will organize it."
              : "Review what Fanny read and choose what to do."}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {stage === "capture" ? (
            <div className="space-y-4">
              {/* Source chips */}
              <div className="flex flex-wrap gap-1.5">
                {SOURCE_CHIPS.map((chip) => {
                  const ChipIcon = chip.icon
                  const active = sourceKind === chip.id
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => setSourceKind(chip.id)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                        active
                          ? "border-[var(--inbox-accent)]/50 bg-[var(--inbox-accent)]/15 text-[var(--inbox-accent)]"
                          : "border-[var(--inbox-border)] bg-transparent text-[var(--inbox-text-secondary)] hover:bg-white/[0.06] hover:text-[var(--inbox-text)]",
                      )}
                    >
                      <ChipIcon className="h-3 w-3" aria-hidden="true" />
                      {chip.label}
                    </button>
                  )
                })}
              </div>

              {/* What happened */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-[var(--inbox-text-secondary)]">
                  What happened?
                </label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={5}
                  autoFocus
                  placeholder="Pedro called about a roof leak. He wants an estimate this week."
                  className="w-full resize-none rounded-lg border border-[var(--inbox-border)] bg-[var(--inbox-surface-elevated)] px-3 py-2 text-sm leading-relaxed text-[var(--inbox-text)] placeholder:text-[var(--inbox-text-secondary)]/70 focus-visible:border-[var(--inbox-accent)]/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--inbox-accent)]/30"
                />
              </div>

              {/* Optional details */}
              <div>
                <button
                  type="button"
                  onClick={() => setDetailsOpen((v) => !v)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--inbox-text-secondary)] hover:text-[var(--inbox-text)]"
                >
                  <ChevronDown
                    className={cn("h-3.5 w-3.5 transition-transform", detailsOpen && "rotate-180")}
                    aria-hidden="true"
                  />
                  Details (optional)
                </button>
                {detailsOpen ? (
                  <div className="mt-2 space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-[var(--inbox-text-secondary)]">Who?</label>
                      <input
                        value={who}
                        onChange={(e) => setWho(e.target.value)}
                        placeholder="Pedro Ramos"
                        className="w-full rounded-lg border border-[var(--inbox-border)] bg-[var(--inbox-surface-elevated)] px-3 py-1.5 text-sm text-[var(--inbox-text)] placeholder:text-[var(--inbox-text-secondary)]/70 focus-visible:border-[var(--inbox-accent)]/60 focus-visible:outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-[var(--inbox-text-secondary)]">When?</label>
                      <input
                        value={whenNote}
                        onChange={(e) => setWhenNote(e.target.value)}
                        placeholder="This week"
                        className="w-full rounded-lg border border-[var(--inbox-border)] bg-[var(--inbox-surface-elevated)] px-3 py-1.5 text-sm text-[var(--inbox-text)] placeholder:text-[var(--inbox-text-secondary)]/70 focus-visible:border-[var(--inbox-accent)]/60 focus-visible:outline-none"
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* What you captured */}
              <section className="rounded-xl border border-[var(--inbox-border)] bg-[var(--inbox-surface-elevated)] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--inbox-text-secondary)]">
                  What you captured
                </p>
                <p className="mt-1 text-sm leading-snug text-[var(--inbox-text)]">{text.trim()}</p>
              </section>

              {/* Fanny's read */}
              <section className="rounded-xl border border-[var(--inbox-border)] bg-[var(--inbox-surface-elevated)] p-3">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-[var(--inbox-accent)]" aria-hidden="true" />
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--inbox-text-secondary)]">
                    Fanny&apos;s read
                  </p>
                </div>
                {interp?.summary ? (
                  <p className="mt-1.5 text-sm leading-snug text-[var(--inbox-text)]">
                    {interp.summary}
                  </p>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-md border border-[var(--inbox-border)] bg-white/[0.06] px-2 py-0.5 text-[10px] text-[var(--inbox-text-secondary)]">
                    {interp?.intent}
                  </span>
                  <span className="rounded-md border border-[var(--inbox-accent)]/30 bg-[var(--inbox-accent)]/10 px-2 py-0.5 text-[10px] capitalize text-[var(--inbox-accent)]">
                    {priority}
                  </span>
                  {interp?.suggestedRelations.map((rel) => (
                    <span
                      key={rel}
                      className="rounded-md border border-[var(--inbox-border)] bg-white/[0.06] px-2 py-0.5 text-[10px] text-[var(--inbox-text-secondary)]"
                    >
                      {rel}
                    </span>
                  ))}
                </div>
              </section>

              {/* Priority chips */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-[var(--inbox-text-secondary)]">Priority</span>
                {PRIORITY_CHIPS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize transition-colors",
                      priority === p
                        ? "border-[var(--inbox-accent)]/50 bg-[var(--inbox-accent)]/15 text-[var(--inbox-accent)]"
                        : "border-[var(--inbox-border)] text-[var(--inbox-text-secondary)] hover:text-[var(--inbox-text)]",
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>

              {/* Next steps */}
              <section className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--inbox-text-secondary)]">
                  Suggested next steps
                </p>
                <StepRow checked locked label="Add to Inbox as Manual" />
                <StepRow
                  checked={steps.createFollowUp}
                  onToggle={() => setSteps((s) => ({ ...s, createFollowUp: !s.createFollowUp }))}
                  label="Create follow-up"
                />
                <StepRow
                  checked={steps.addToToday}
                  onToggle={() => setSteps((s) => ({ ...s, addToToday: !s.addToToday }))}
                  label="Add to Today"
                />
                <StepRow disabled label="Schedule" hint="Soon" />
                <StepRow disabled label="Connect client" hint="Soon" />
                <StepRow disabled label="Save as note" hint="Soon" />
              </section>

              {error ? (
                <p className="rounded-lg border border-[rgba(232,111,116,0.32)] bg-[rgba(232,111,116,0.12)] px-3 py-2 text-[11px] text-[var(--inbox-destructive)]">
                  {error}
                </p>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[var(--inbox-border)] p-4">
          {stage === "capture" ? (
            <Button
              type="button"
              variant="accent"
              disabled={!canOrganize}
              onClick={handleOrganize}
              className="gap-1.5"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Let Fanny organize this
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStage("capture")}
                disabled={submitting}
                className="text-[var(--inbox-text-secondary)] hover:text-[var(--inbox-text)]"
              >
                Edit
              </Button>
              <Button
                type="button"
                variant="accent"
                onClick={handleConfirm}
                disabled={submitting}
                className="gap-1.5"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Check className="h-4 w-4" aria-hidden="true" />
                )}
                Confirm · {selectedCount} selected
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function StepRow({
  label,
  checked = false,
  locked = false,
  disabled = false,
  hint,
  onToggle,
}: {
  label: string
  checked?: boolean
  locked?: boolean
  disabled?: boolean
  hint?: string
  onToggle?: () => void
}) {
  const interactive = !locked && !disabled && Boolean(onToggle)
  return (
    <button
      type="button"
      onClick={interactive ? onToggle : undefined}
      disabled={!interactive}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
        disabled
          ? "cursor-not-allowed border-[var(--inbox-border)]/60 text-[var(--inbox-text-secondary)]/60"
          : "border-[var(--inbox-border)] text-[var(--inbox-text)]",
        interactive && "hover:bg-white/[0.04]",
      )}
    >
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
          checked
            ? "border-[var(--inbox-accent)] bg-[var(--inbox-accent)] text-white"
            : "border-[var(--inbox-border)] bg-transparent",
        )}
        aria-hidden="true"
      >
        {checked ? <Check className="h-3 w-3" /> : null}
      </span>
      <span className="flex-1">{label}</span>
      {locked ? (
        <span className="text-[10px] uppercase tracking-wide text-[var(--inbox-text-secondary)]/70">
          Always
        </span>
      ) : hint ? (
        <span className="text-[10px] uppercase tracking-wide text-[var(--inbox-text-secondary)]/70">
          {hint}
        </span>
      ) : null}
    </button>
  )
}
