"use client"

import { useState } from "react"
import Link from "next/link"
import { Cpu, ExternalLink, FolderKanban, Loader2, Sparkles, Trash2, Users, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ExpandableText } from "@/components/ui/expandable-text"
import { cn } from "@/lib/utils"
import { apiPatch } from "@/lib/api-client"
import { displayLabel, estadoLabel, prioridadLabel } from "@/lib/api-client"
import { toast } from "sonner"
import { CanDelete, CanEdit } from "@/components/role-gate"

export type TaskRecord = {
  id: string
  titulo?: string
  descripcion?: string | null
  estado?: string
  prioridad?: string
  fechaLimite?: string | null
  proyecto?: { nombre?: string } | null
  proyectoId?: string | null
  cliente?: { nombre?: string } | null
  clienteId?: string | null
  usuario?: { nombre?: string } | null
}

const PRIORITY_BADGE: Record<string, string> = {
  urgente: "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]",
  alta: "bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]",
  media: "bg-[var(--status-info-bg)] text-[var(--status-info-text)]",
  baja: "bg-white/12 text-[var(--text-secondary-light)]",
}

const ESTADO_BADGE =
  "rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-[var(--text-secondary-light)]"

function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  try {
    const d = new Date(value)
    return isNaN(d.getTime())
      ? "—"
      : d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })
  } catch {
    return "—"
  }
}

/**
 * Honest, data-derived "why this matters" line. No invented reasoning — it
 * only restates what the visible fields (estado / prioridad / fechaLimite)
 * already imply. Attributed to 7F because it is system-derived, not a Fanny
 * conversation insight.
 */
function whyThisMatters(task: TaskRecord): string {
  const estado = (task.estado ?? "").toLowerCase()
  const prioridad = (task.prioridad ?? "").toLowerCase()
  const due = task.fechaLimite ? new Date(task.fechaLimite) : null
  const active = estado !== "completada" && estado !== "cancelada"
  const overdue = active && due && !isNaN(due.getTime()) && due.getTime() < Date.now()
  if (overdue) return "Past its due date — clearing it first stops it from holding up the work queued behind it."
  if (active && (prioridad === "urgente" || prioridad === "alta"))
    return "High priority and still open — the most valuable thing you can move right now."
  if (estado === "revision") return "In review — a quick decision here keeps it moving toward done."
  if (estado === "en_progreso") return "Already in progress — finishing it frees up your queue."
  if (estado === "completada") return "Completed. Kept here for reference and quick reopen if needed."
  if (estado === "cancelada") return "Cancelled. Kept for the record; reopen if it comes back."
  return "Ready to pick up whenever you have a clear block of time."
}

/**
 * Contextual actions 7F/Fanny will be able to take on this task. PHASE 1:
 * these are PREPARED, not wired — rendered as disabled "coming soon" chips so
 * the surface communicates intent without faking automation. The set is
 * chosen from the task's real fields.
 */
function contextualActions(task: TaskRecord): string[] {
  const estado = (task.estado ?? "").toLowerCase()
  const prioridad = (task.prioridad ?? "").toLowerCase()
  const out: string[] = []
  if (task.fechaLimite) out.push("Schedule")
  if (estado === "revision" || prioridad === "urgente" || prioridad === "alta") out.push("Find blockers")
  out.push("Create checklist")
  if (task.cliente?.nombre) out.push("Draft client update")
  out.push("Refine task")
  return Array.from(new Set(out)).slice(0, 4)
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-secondary-light)]">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-medium text-[var(--text-primary-light)]">{value}</p>
    </div>
  )
}

interface TaskContextualPanelProps {
  task: TaskRecord
  onTaskUpdated: () => void
  onClose?: () => void
  onEdit: () => void
  onRequestDelete: () => void
}

export function TaskContextualPanel({
  task,
  onTaskUpdated,
  onClose,
  onEdit,
  onRequestDelete,
}: TaskContextualPanelProps) {
  const [patching, setPatching] = useState(false)

  async function patchEstado(next: string) {
    setPatching(true)
    try {
      await apiPatch(`/api/tareas/${task.id}`, { estado: next })
      toast.success("Task updated")
      onTaskUpdated()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Update failed")
    } finally {
      setPatching(false)
    }
  }

  const estado = task.estado ?? ""
  const canComplete = estado !== "completada" && estado !== "cancelada"
  const prioClass = PRIORITY_BADGE[task.prioridad ?? ""] ?? PRIORITY_BADGE.media

  return (
    <div className="flex max-h-[min(85vh,880px)] flex-col overflow-hidden xl:max-h-none">
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-dark)] px-5 py-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary-light)]">Task details</h3>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-secondary-light)] transition-colors hover:bg-white/10 hover:text-[var(--text-primary-light)]"
            aria-label="Close panel"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4 p-5">
          <div>
            <p className="text-base font-semibold text-[var(--text-primary-light)]">{task.titulo}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", prioClass)}>
                {displayLabel(task.prioridad ?? "", prioridadLabel)}
              </span>
              <span className={ESTADO_BADGE}>{displayLabel(estado, estadoLabel)}</span>
            </div>
          </div>

          {/* Why this matters — data-derived, attributed to 7F */}
          <div className="rounded-lg border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/[0.06] p-3">
            <div className="mb-1.5 flex items-center gap-1.5">
              <Cpu className="h-3 w-3 text-[var(--accent-primary)]" />
              <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-primary)]">
                7F · why this matters
              </span>
            </div>
            <p className="text-[12.5px] leading-relaxed text-[var(--text-secondary-light)]">
              {whyThisMatters(task)}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DetailField label="Project" value={task.proyecto?.nombre ?? "—"} />
            <DetailField label="Client" value={task.cliente?.nombre ?? "—"} />
            <DetailField label="Owner" value={task.usuario?.nombre ?? "—"} />
            <DetailField label="Due date" value={formatDate(task.fechaLimite)} />
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-secondary-light)]">
              Description
            </p>
            {task.descripcion?.trim() ? (
              <ExpandableText lines={4} textClassName="text-[var(--text-primary-light)]/90">
                {task.descripcion.trim()}
              </ExpandableText>
            ) : (
              <p className="text-sm leading-relaxed text-[var(--text-secondary-light)]">No description.</p>
            )}
          </div>

          {/* Fanny can — contextual, PREPARED (not wired yet): honest "coming soon" affordances */}
          <div className="border-t border-[var(--border-dark)] pt-4">
            <div className="mb-2 flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-[var(--accent-primary)]" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-primary)]">
                Fanny can
              </span>
              <span className="text-[10px] text-[var(--text-secondary-light)]">· coming soon</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {contextualActions(task).map((label) => (
                <span
                  key={label}
                  title="Available soon"
                  aria-disabled="true"
                  className="inline-flex cursor-not-allowed items-center gap-1 rounded-lg border border-dashed border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary-light)] opacity-70"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-[var(--border-dark)] pt-4">
            <Button asChild className="w-full justify-center gap-2 sm:w-auto sm:justify-start" variant="default">
              <Link href={`/tareas/${task.id}`}>
                <ExternalLink className="h-3.5 w-3.5" />
                Open full task
              </Link>
            </Button>

            <CanEdit>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onEdit}
                  disabled={patching}
                  className="border-[var(--border-dark)] text-[var(--text-primary-light)] hover:bg-white/10 hover:text-[var(--text-primary-light)]"
                >
                  Edit
                </Button>
                {canComplete && (
                  <>
                    {estado === "pendiente" && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={patching}
                        onClick={() => patchEstado("en_progreso")}
                        className="gap-1.5 border-0 bg-white/10 text-[var(--text-primary-light)] hover:bg-white/15"
                      >
                        {patching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                        Start
                      </Button>
                    )}
                    {(estado === "en_progreso" || estado === "revision" || estado === "pendiente") && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={patching}
                        onClick={() => patchEstado("completada")}
                        className="border-0 bg-white/10 text-[var(--text-primary-light)] hover:bg-white/15"
                      >
                        Mark complete
                      </Button>
                    )}
                  </>
                )}
              </div>
            </CanEdit>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-[var(--border-dark)] pt-4">
            {task.proyectoId && (
              <Link
                href={`/proyectos/${task.proyectoId}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary-light)] transition-colors hover:bg-white/10"
              >
                <FolderKanban className="h-3 w-3" /> Project
              </Link>
            )}
            {task.clienteId && (
              <Link
                href={`/clientes/${task.clienteId}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary-light)] transition-colors hover:bg-white/10"
              >
                <Users className="h-3 w-3" /> Client
              </Link>
            )}
          </div>

          <CanDelete>
            <div className="border-t border-[var(--border-dark)] pt-4">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={onRequestDelete}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete task
              </Button>
            </div>
          </CanDelete>
        </div>
      </div>
    </div>
  )
}
