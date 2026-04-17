"use client"

import { useState } from "react"
import Link from "next/link"
import { ExternalLink, FolderKanban, Loader2, Trash2, Users, X } from "lucide-react"
import { Button } from "@/components/ui/button"
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
  baja: "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)]",
}

const ESTADO_BADGE =
  "rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"

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

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-foreground">{value}</p>
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
      <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
        <h3 className="text-sm font-semibold text-foreground">Task details</h3>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Close panel"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4 p-5">
          <div>
            <p className="text-base font-semibold text-foreground">{task.titulo}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", prioClass)}>
                {displayLabel(task.prioridad ?? "", prioridadLabel)}
              </span>
              <span className={ESTADO_BADGE}>{displayLabel(estado, estadoLabel)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DetailField label="Project" value={task.proyecto?.nombre ?? "—"} />
            <DetailField label="Client" value={task.cliente?.nombre ?? "—"} />
            <DetailField label="Owner" value={task.usuario?.nombre ?? "—"} />
            <DetailField label="Due date" value={formatDate(task.fechaLimite)} />
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Description
            </p>
            <p className="text-sm leading-relaxed text-foreground/80">
              {task.descripcion?.trim() || "No description."}
            </p>
          </div>

          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <Button asChild className="w-full justify-center gap-2 sm:w-auto sm:justify-start" variant="default">
              <Link href={`/tareas/${task.id}`}>
                <ExternalLink className="h-3.5 w-3.5" />
                Open full task
              </Link>
            </Button>

            <CanEdit>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={onEdit} disabled={patching}>
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
                        className="gap-1.5"
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
                      >
                        Mark complete
                      </Button>
                    )}
                  </>
                )}
              </div>
            </CanEdit>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            {task.proyectoId && (
              <Link
                href={`/proyectos/${task.proyectoId}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
              >
                <FolderKanban className="h-3 w-3" /> Project
              </Link>
            )}
            {task.clienteId && (
              <Link
                href={`/clientes/${task.clienteId}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
              >
                <Users className="h-3 w-3" /> Client
              </Link>
            )}
          </div>

          <CanDelete>
            <div className="border-t border-border pt-4">
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
