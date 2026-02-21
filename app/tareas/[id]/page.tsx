"use client"

import { use, useState, useCallback, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { InlineText, InlineSelect, InlineTextarea, InlineDate } from "@/components/inline-edit"
import { apiPatch, apiDelete, estadoLabel, prioridadLabel, displayLabel } from "@/lib/api-client"
import { useFetch } from "@/hooks/use-fetch"
import { ConfirmModal } from "@/components/confirm-modal"
import { CanEdit, CanDelete } from "@/components/role-gate"
import { RelationSelect } from "@/components/relation-select"
import { SmartAction } from "@/components/smart-action"
import { DocumentoForm } from "@/components/forms/documento-form"
import { CommentsSection } from "@/components/comments-section"
import { ActivityTimeline } from "@/components/activity-timeline"
import { UploadArea } from "@/components/upload-area"
import { QRButton } from "@/components/qr-code-modal"
import { SavedQRCodes } from "@/components/saved-qr-codes"
import { toast } from "sonner"
import {
  CheckSquare,
  ArrowLeft,
  Trash2,
  FileText,
  AlertCircle,
  ExternalLink,
  FolderKanban,
  Building,
  User,
  Plus,
} from "lucide-react"

const ESTADO_OPTIONS = [
  { value: "pendiente", label: estadoLabel.pendiente ?? "Pendiente" },
  { value: "en_progreso", label: estadoLabel.en_progreso ?? "En progreso" },
  { value: "revision", label: estadoLabel.revision ?? "En revisión" },
  { value: "completada", label: estadoLabel.completada ?? "Completada" },
  { value: "cancelada", label: estadoLabel.cancelada ?? "Cancelada" },
]

const PRIORIDAD_OPTIONS = [
  { value: "baja", label: prioridadLabel.baja ?? "Baja" },
  { value: "media", label: prioridadLabel.media ?? "Media" },
  { value: "alta", label: prioridadLabel.alta ?? "Alta" },
  { value: "urgente", label: prioridadLabel.urgente ?? "Urgente" },
]

const estadoBadge = (v: string) =>
  ({
    pendiente: "bg-muted text-muted-foreground",
    en_progreso: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    revision: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    completada: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    cancelada: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  })[v] ?? "bg-muted text-muted-foreground"

const prioridadBadge = (v: string) =>
  ({
    urgente: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    alta: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    media: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    baja: "bg-muted text-muted-foreground",
  })[v] ?? "bg-muted text-muted-foreground"

function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  try {
    const d = new Date(value)
    return isNaN(d.getTime()) ? value : d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })
  } catch {
    return value
  }
}

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [deleteOpen, setDeleteOpen] = useState(false)

  const { data: taskData, loading, error, refetch } = useFetch<any>(id ? `/api/tareas/${id}` : null)
  const proyectoId = taskData?.proyectoId ?? null
  const { data: docsData } = useFetch<any>(
    proyectoId ? `/api/documentos?proyectoId=${proyectoId}&pageSize=50` : null
  )
  const documentos = useMemo(() => {
    if (docsData == null) return []
    return Array.isArray(docsData) ? docsData : (docsData as any)?.data ?? []
  }, [docsData])

  const saveField = useCallback(
    async (field: string, value: unknown) => {
      await apiPatch(`/api/tareas/${id}`, { [field]: value })
      toast.success("Guardado")
      refetch()
    },
    [id, refetch]
  )

  const quickAction = useCallback(
    async (estado: string) => {
      await apiPatch(`/api/tareas/${id}`, { estado })
      toast.success(`Tarea marcada como ${displayLabel(estado, estadoLabel)}`)
      refetch()
    },
    [id, refetch]
  )

  const handleDelete = useCallback(async () => {
    await apiDelete(`/api/tareas/${id}`)
    toast.success("Tarea eliminada")
    setDeleteOpen(false)
    router.push("/tareas")
  }, [id, router])

  if (loading && !taskData) {
    return (
      <AppShell currentSection="tareas" breadcrumbs={[{ label: "7F" }, { label: "Tareas", href: "/tareas" }, { label: "…" }]}>
        <div className="flex flex-col gap-6">
          <div className="h-8 w-48 rounded bg-muted animate-pulse" />
          <div className="grid gap-6 lg:grid-cols-5">
            <div className="space-y-4 lg:col-span-3">
              <div className="h-32 rounded-xl border border-border bg-card animate-pulse" />
            </div>
            <div className="space-y-4 lg:col-span-2">
              <div className="h-64 rounded-xl border border-border bg-card animate-pulse" />
            </div>
          </div>
        </div>
      </AppShell>
    )
  }

  if (error || !taskData) {
    return (
      <AppShell currentSection="tareas" breadcrumbs={[{ label: "7F" }, { label: "Tareas", href: "/tareas" }, { label: "Error" }]}>
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-card p-8">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <p className="text-sm text-muted-foreground">{error ?? "Tarea no encontrada"}</p>
          <Link href="/tareas" className="text-sm font-medium text-foreground underline hover:no-underline">
            ← Volver a Tareas
          </Link>
        </div>
      </AppShell>
    )
  }

  const task = taskData
  const estado = task.estado ?? "pendiente"

  return (
    <AppShell
      currentSection="tareas"
      breadcrumbs={[
        { label: "7F" },
        { label: "Tareas", href: "/tareas" },
        { label: task.titulo || "Tarea" },
      ]}
    >
      <div className="flex flex-col gap-6">
        <Link
          href="/tareas"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Tareas
        </Link>

        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-3 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <CheckSquare className="h-7 w-7 text-muted-foreground flex-shrink-0" />
              <InlineText
                value={task.titulo ?? ""}
                onSave={(v) => saveField("titulo", v)}
                placeholder="Sin título"
                as="h1"
                className="text-2xl font-semibold text-foreground"
              />
            </div>
            <div className="flex items-center gap-2">
              <InlineSelect
                value={estado}
                options={ESTADO_OPTIONS}
                onSave={(v) => saveField("estado", v)}
                badgeClassName={estadoBadge}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <QRButton
              module="tareas"
              recordId={id}
              defaultUrl={typeof window !== "undefined" ? `${window.location.origin}/tareas/${id}` : `/tareas/${id}`}
            />
            <CanDelete>
              <button
                onClick={() => setDeleteOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-colors"
              >
                <Trash2 className="h-4 w-4" /> Eliminar
              </button>
            </CanDelete>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-5">
          <div className="flex flex-col gap-6 lg:col-span-3">
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-medium text-muted-foreground mb-3">Descripción</h2>
              <InlineTextarea
                value={task.descripcion ?? ""}
                onSave={(v) => saveField("descripcion", v)}
                placeholder="Agregar descripción..."
                rows={6}
                className="min-h-[8rem]"
              />
            </section>

            {task.proyectoId && (
              <section className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-medium text-muted-foreground">Documentos del proyecto</h2>
                  <SmartAction
                    label="Nuevo documento"
                    icon={Plus}
                    size="sm"
                    variant="ghost"
                    FormComponent={DocumentoForm}
                    defaultValues={{ proyectoId: task.proyectoId, clienteId: task.clienteId ?? undefined }}
                    onCreated={refetch}
                  />
                </div>
                {documentos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay documentos en este proyecto.</p>
                ) : (
                  <ul className="space-y-2">
                    {documentos.map((doc: any) => (
                      <li key={doc.id}>
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-sm text-foreground hover:underline"
                        >
                          <FileText className="h-4 w-4 flex-shrink-0" />
                          {doc.nombre ?? doc.tipo}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </div>

          <aside className="flex flex-col gap-4 lg:col-span-2">
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-medium text-muted-foreground mb-3">Detalles</h2>
              <div className="space-y-0">
                <MetaRow label="Estado">
                  <InlineSelect
                    value={estado}
                    options={ESTADO_OPTIONS}
                    onSave={(v) => saveField("estado", v)}
                    badgeClassName={estadoBadge}
                  />
                </MetaRow>
                <MetaRow label="Prioridad">
                  <InlineSelect
                    value={task.prioridad ?? "media"}
                    options={PRIORIDAD_OPTIONS}
                    onSave={(v) => saveField("prioridad", v)}
                    badgeClassName={prioridadBadge}
                  />
                </MetaRow>
                <MetaRow label="Responsable">
                  <RelationSelect
                    label="Responsable"
                    icon={User}
                    value={task.usuarioId ?? null}
                    field="usuarioId"
                    targetModule="usuarios"
                    sourceModule="tareas"
                    sourceId={id}
                    displayField="nombre"
                    currentDisplay={task.usuario?.nombre ?? task.usuario?.email}
                    onSaved={refetch}
                  />
                </MetaRow>
                <MetaRow label="Fecha límite">
                  <InlineDate
                    value={task.fechaLimite ?? null}
                    onSave={(v) => saveField("fechaLimite", v)}
                    placeholder="Sin fecha"
                  />
                </MetaRow>
                <MetaRow label="Proyecto">
                  <RelationSelect
                    label="Proyecto"
                    icon={FolderKanban}
                    value={task.proyectoId ?? null}
                    field="proyectoId"
                    targetModule="proyectos"
                    sourceModule="tareas"
                    sourceId={id}
                    displayField="nombre"
                    currentDisplay={task.proyecto?.nombre}
                    onSaved={refetch}
                  />
                </MetaRow>
                <MetaRow label="Cliente">
                  <RelationSelect
                    label="Cliente"
                    icon={Building}
                    value={task.clienteId ?? null}
                    field="clienteId"
                    targetModule="clientes"
                    sourceModule="tareas"
                    sourceId={id}
                    displayField="nombre"
                    currentDisplay={task.cliente?.nombre}
                    onSaved={refetch}
                  />
                </MetaRow>
                <MetaRow label="Creada" last>
                  <span className="text-sm text-muted-foreground">{formatDate(task.createdAt)}</span>
                </MetaRow>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-medium text-muted-foreground mb-3">Acciones rápidas</h2>
              <div className="flex flex-col gap-2">
                {estado === "pendiente" && (
                  <button
                    onClick={() => quickAction("en_progreso")}
                    className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-left hover:bg-muted/60 transition-colors"
                  >
                    Iniciar tarea
                  </button>
                )}
                {estado === "en_progreso" && (
                  <>
                    <button
                      onClick={() => quickAction("revision")}
                      className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-left hover:bg-muted/60 transition-colors"
                    >
                      Enviar a revisión
                    </button>
                    <button
                      onClick={() => quickAction("completada")}
                      className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-left hover:bg-muted/60 transition-colors"
                    >
                      Completar
                    </button>
                  </>
                )}
                {estado === "revision" && (
                  <button
                    onClick={() => quickAction("completada")}
                    className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-left hover:bg-muted/60 transition-colors"
                  >
                    Completar
                  </button>
                )}
                {estado === "completada" && (
                  <button
                    onClick={() => quickAction("pendiente")}
                    className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-left hover:bg-muted/60 transition-colors"
                  >
                    Reabrir
                  </button>
                )}
              </div>
            </div>
          </aside>
        </div>

        {/* Archivos adjuntos */}
        <UploadArea module="tareas" recordId={id} />
        <SavedQRCodes module="tareas" recordId={id} />

        {/* Comentarios + Actividad */}
        <CommentsSection module="tareas" recordId={id} />
        <ActivityTimeline module="tareas" recordId={id} />
      </div>

      <ConfirmModal
        open={deleteOpen}
        title="Eliminar tarea"
        description="¿Estás seguro de que quieres eliminar esta tarea? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </AppShell>
  )
}

function MetaRow({
  label,
  children,
  last,
}: {
  label: string
  children: React.ReactNode
  last?: boolean
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 py-3 ${last ? "" : "border-b border-border"}`}
    >
      <span className="text-sm text-muted-foreground flex-shrink-0">{label}</span>
      <div className="min-w-0 text-right">{children}</div>
    </div>
  )
}
