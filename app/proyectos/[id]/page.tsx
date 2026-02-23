"use client"

import { use, useCallback, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import {
  InlineText,
  InlineSelect,
  InlineTextarea,
  InlineDate,
  InlineNumber,
} from "@/components/inline-edit"
import { RelationList } from "@/components/relation-list"
import { RelationSelect } from "@/components/relation-select"
import { DetailSection } from "@/components/detail-section"
import { SmartAction } from "@/components/smart-action"
import { apiPatch, apiDelete } from "@/lib/api-client"
import { useFetch } from "@/hooks/use-fetch"
import { toast } from "sonner"
import {
  ArrowLeft,
  FolderKanban,
  Trash2,
  FileText,
  Receipt,
  Building,
  DollarSign,
  CheckSquare,
  TrendingUp,
  TrendingDown,
  Plus,
  Lock,
  Globe,
  Users,
  Eye,
} from "lucide-react"
import { TareaForm } from "@/components/forms/tarea-form"
import { DocumentoForm } from "@/components/forms/documento-form"
import { TransaccionForm } from "@/components/forms/transaccion-form"
import { FacturaForm } from "@/components/forms/factura-form"
import { ConfirmModal } from "@/components/confirm-modal"
import { CanDelete, CanEdit } from "@/components/role-gate"
import { CommentsSection } from "@/components/comments-section"
import { ActivityTimeline } from "@/components/activity-timeline"
import { UploadArea } from "@/components/upload-area"
import { QRButton } from "@/components/qr-code-modal"
import { SavedQRCodes } from "@/components/saved-qr-codes"

const ESTADO_OPTIONS = [
  { value: "planificacion", label: "Planificación" },
  { value: "en_progreso", label: "En progreso" },
  { value: "revision", label: "En revisión" },
  { value: "completado", label: "Completado" },
  { value: "cancelado", label: "Cancelado" },
]

const PRIORIDAD_OPTIONS = [
  { value: "baja", label: "Baja" },
  { value: "media", label: "Media" },
  { value: "alta", label: "Alta" },
  { value: "urgente", label: "Urgente" },
]

const estadoBadge = (v: string) =>
  ({
    planificacion: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    en_progreso: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    revision: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    completado: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    cancelado: "bg-muted text-muted-foreground",
    pendiente: "bg-muted text-muted-foreground",
    completada: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    cancelada: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    borrador: "bg-muted text-muted-foreground",
    enviada: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    pagada: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    vencida: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  })[v] ?? "bg-muted text-muted-foreground"

const prioridadBadge = (v: string) =>
  ({
    urgente: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    alta: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    media: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    baja: "bg-muted text-muted-foreground",
  })[v] ?? "bg-muted text-muted-foreground"

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—"
  try {
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) return "—"
    return d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })
  } catch {
    return "—"
  }
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n)
}

function daysRemaining(fechaFin: string | null | undefined): number {
  if (!fechaFin) return 0
  const target = new Date(fechaFin)
  if (Number.isNaN(target.getTime())) return 0
  const diff = Math.ceil((target.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  return Math.max(0, diff)
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { data: project, loading, error, refetch } = useFetch<any>(`/api/proyectos/${id}`)
  const { data: finanzasRaw, refetch: refetchFinanzas } = useFetch<any>(id ? `/api/finanzas?proyectoId=${id}` : null)

  const [deleteOpen, setDeleteOpen] = useState(false)

  const saveField = useCallback(
    async (field: string, value: unknown) => {
      await apiPatch(`/api/proyectos/${id}`, { [field]: value })
      toast.success("Guardado")
      refetch()
    },
    [id, refetch]
  )

  const handleDelete = useCallback(async () => {
    await apiDelete(`/api/proyectos/${id}`)
    toast.success("Proyecto eliminado")
    router.push("/proyectos")
  }, [id, router])

  if (loading) {
    return (
      <AppShell currentSection="proyectos" breadcrumbs={[{ label: "7F" }, { label: "Proyectos", href: "/proyectos" }, { label: "..." }]}>
        <div className="flex flex-col gap-6">
          <Link href="/proyectos" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground w-fit">
            <ArrowLeft className="h-3.5 w-3.5" /> Proyectos
          </Link>
          <div className="h-32 rounded-xl border border-border bg-card animate-pulse" />
          <div className="h-48 rounded-xl border border-border bg-card animate-pulse" />
        </div>
      </AppShell>
    )
  }

  if (error || !project) {
    return (
      <AppShell currentSection="proyectos" breadcrumbs={[{ label: "7F" }, { label: "Proyectos", href: "/proyectos" }, { label: "Error" }]}>
        <div className="flex flex-col gap-6">
          <Link href="/proyectos" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground w-fit">
            <ArrowLeft className="h-3.5 w-3.5" /> Proyectos
          </Link>
          <p className="text-sm text-destructive">{error || "Proyecto no encontrado"}</p>
        </div>
      </AppShell>
    )
  }

  const finanzas = Array.isArray(finanzasRaw) ? finanzasRaw : []
  const tareas = Array.isArray(project.tareas) ? project.tareas : []
  const cliente = project.cliente ?? null
  const ingresos = finanzas.filter((t: any) => t.tipo === "ingreso").reduce((s: number, t: any) => s + Number(t.monto ?? 0), 0)
  const gastos = finanzas.filter((t: any) => t.tipo === "gasto").reduce((s: number, t: any) => s + Number(t.monto ?? 0), 0)

  return (
    <AppShell
      currentSection="proyectos"
      breadcrumbs={[{ label: "7F" }, { label: "Proyectos", href: "/proyectos" }, { label: project.nombre ?? "Proyecto" }]}
    >
      <div className="flex flex-col gap-6 pb-8">
        <Link href="/proyectos" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground w-fit">
          <ArrowLeft className="h-3.5 w-3.5" /> Proyectos
        </Link>

        {/* Header */}
        <div className="rounded-xl border border-border bg-card p-5 md:p-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <FolderKanban className="h-7 w-7 text-muted-foreground shrink-0" />
              <InlineText
                value={project.nombre ?? ""}
                onSave={(v) => saveField("nombre", v)}
                placeholder="Nombre del proyecto"
                as="h1"
                className="text-2xl font-semibold min-w-[200px]"
              />
              <InlineSelect
                value={project.estado ?? "planificacion"}
                options={ESTADO_OPTIONS}
                onSave={(v) => saveField("estado", v)}
                badgeClassName={estadoBadge}
              />
              <InlineSelect
                value={project.prioridad ?? "media"}
                options={PRIORIDAD_OPTIONS}
                onSave={(v) => saveField("prioridad", v)}
                badgeClassName={prioridadBadge}
              />
              <QRButton
                module="proyectos"
                recordId={id}
                defaultUrl={typeof window !== "undefined" ? `${window.location.origin}/proyectos/${id}` : `/proyectos/${id}`}
                className="ml-auto"
              />
              <CanDelete>
                <button
                  onClick={() => setDeleteOpen(true)}
                  className="rounded-lg p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  aria-label="Eliminar"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </CanDelete>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <InlineNumber
                  value={Number(project.progreso) ?? 0}
                  onSave={(v) => saveField("progreso", v)}
                  min={0}
                  max={100}
                  suffix="%"
                />
              </div>
            </div>

            {/* Metadata grid with RelationSelect for Cliente */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2 border-t border-border">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Cliente</p>
                <RelationSelect
                  label="Cliente"
                  icon={Building}
                  value={project.clienteId ?? null}
                  field="clienteId"
                  targetModule="clientes"
                  sourceModule="proyectos"
                  sourceId={id}
                  displayField="nombre"
                  currentDisplay={cliente?.nombre}
                  onSaved={refetch}
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Fecha inicio</p>
                <InlineDate value={project.fechaInicio} onSave={(v) => saveField("fechaInicio", v)} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Fecha fin</p>
                <InlineDate value={project.fechaFin} onSave={(v) => saveField("fechaFin", v)} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Presupuesto</p>
                <InlineText
                  value={project.presupuesto != null ? String(project.presupuesto) : ""}
                  onSave={async (v) => {
                    const trimmed = v.trim()
                    const num = trimmed === "" ? null : parseFloat(trimmed.replace(/[^0-9.-]/g, ""))
                    if (trimmed !== "" && Number.isNaN(num)) return
                    await saveField("presupuesto", num)
                  }}
                  placeholder="0"
                  className="tabular-nums"
                />
                <span className="text-xs text-muted-foreground ml-1">MXN</span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Días restantes</p>
                <span className="text-sm font-medium">{daysRemaining(project.fechaFin)}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2 border-t border-border">
              <div>
                <p className="text-xs text-muted-foreground mb-1">ID editorial</p>
                <InlineText value={project.customId ?? ""} onSave={(v) => saveField("customId", v || null)} placeholder="Ej: PRJ-001" className="font-mono text-xs" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Entrega estimada</p>
                <InlineDate value={project.estimatedDelivery} onSave={(v) => saveField("estimatedDelivery", v)} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Entrega real</p>
                <InlineDate value={project.actualDelivery} onSave={(v) => saveField("actualDelivery", v)} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Asignado a</p>
                <InlineText value={project.assignedTo ?? ""} onSave={(v) => saveField("assignedTo", v || null)} placeholder="Nombre o equipo" />
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs text-muted-foreground mb-1">Tags (separados por coma)</p>
                <InlineText value={project.tags ?? ""} onSave={(v) => saveField("tags", v || null)} placeholder="diseño, web, branding" />
              </div>
            </div>

            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground mb-1">Descripcion</p>
              <InlineTextarea value={project.descripcion ?? ""} onSave={(v) => saveField("descripcion", v)} rows={3} placeholder="Agregar descripcion..." />
            </div>

            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground mb-1">Notas internas</p>
              <InlineTextarea value={project.internalNotes ?? ""} onSave={(v) => saveField("internalNotes", v || null)} rows={2} placeholder="Notas solo visibles para el equipo..." />
            </div>

            {/* Privacidad del proyecto */}
            <CanEdit>
              <div className="pt-2 border-t border-border">
                <div className="flex items-center gap-2 mb-2">
                  {project.visibility === "private" ? (
                    <Lock className="h-3.5 w-3.5 text-red-500" />
                  ) : project.visibility === "custom" ? (
                    <Users className="h-3.5 w-3.5 text-amber-500" />
                  ) : (
                    <Globe className="h-3.5 w-3.5 text-emerald-500" />
                  )}
                  <p className="text-xs font-medium text-foreground">Privacidad del proyecto</p>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  {(["public", "private", "custom"] as const).map((v) => {
                    const labels: Record<string, string> = { public: "Publico", private: "Privado", custom: "Personalizado" }
                    const icons: Record<string, typeof Globe> = { public: Globe, private: Lock, custom: Users }
                    const VIcon = icons[v]
                    return (
                      <button
                        key={v}
                        onClick={() => saveField("visibility", v)}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors border ${
                          project.visibility === v
                            ? "border-foreground/30 bg-foreground/5 text-foreground"
                            : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/30"
                        }`}
                      >
                        <VIcon className="h-3 w-3" />
                        {labels[v]}
                      </button>
                    )
                  })}
                </div>
                {project.visibility === "public" && (
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Eye className="h-3 w-3" /> Todos los usuarios internos pueden ver este proyecto</p>
                )}
                {project.visibility === "private" && (
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Lock className="h-3 w-3" /> Solo admin y el creador pueden ver este proyecto</p>
                )}
                {project.visibility === "custom" && (
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1"><Users className="h-3 w-3" /> Solo los usuarios incluidos pueden ver este proyecto</p>
                    <InlineText
                      value={project.allowedUsers ?? ""}
                      onSave={(v) => saveField("allowedUsers", v || null)}
                      placeholder='IDs de usuarios (separados por coma)'
                      className="font-mono text-xs"
                    />
                  </div>
                )}
              </div>
            </CanEdit>
          </div>
        </div>

        {/* Tareas - RelationList */}
        <RelationList
          title="Tareas"
          icon={CheckSquare}
          module="tareas"
          parentField="proyectoId"
          parentId={id}
          titleField="titulo"
          statusField="estado"
          dateField="fechaLimite"
          items={tareas}
          canCreate
          canAssign
          canUnlink
          FormComponent={TareaForm}
          formData={{ clienteId: project.clienteId ?? undefined }}
          onRefresh={refetch}
          statusBadge={estadoBadge}
          emptyMessage="No hay tareas. Crea una para empezar."
        />

        {/* Documentos - RelationList */}
        <RelationList
          title="Documentos"
          icon={FileText}
          module="documentos"
          parentField="proyectoId"
          parentId={id}
          titleField="nombre"
          canCreate
          canAssign
          FormComponent={DocumentoForm}
          onRefresh={refetch}
          emptyMessage="No hay documentos."
        />

        {/* Transacciones - Custom section (sumas financieras) */}
        <DetailSection
          title="Transacciones"
          icon={DollarSign}
          badge={
            <span className="text-sm text-muted-foreground">
              <span className="text-emerald-600 dark:text-emerald-400">+{formatCurrency(ingresos)}</span>
              {" · "}
              <span className="text-red-600 dark:text-red-400">−{formatCurrency(gastos)}</span>
            </span>
          }
          action={
            <SmartAction
              label="Nueva transaccion"
              icon={Plus}
              FormComponent={TransaccionForm}
              defaultValues={{ proyectoId: id, clienteId: project.clienteId ?? undefined }}
              onCreated={refetchFinanzas}
            />
          }
        >
          {finanzas.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No hay transacciones.</p>
          ) : (
            <ul className="space-y-2">
              {finanzas.map((t: any) => (
                <li key={t.id} className="flex items-center gap-2 py-2 border-b border-border last:border-0">
                  {t.tipo === "ingreso" ? <TrendingUp className="h-4 w-4 text-emerald-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
                  <span className="text-sm flex-1 truncate">{t.descripcion || "Sin descripción"}</span>
                  <span className={t.tipo === "ingreso" ? "text-emerald-600" : "text-red-600"}>{t.tipo === "ingreso" ? "+" : "−"}{formatCurrency(Number(t.monto ?? 0))}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(t.fecha)}</span>
                </li>
              ))}
            </ul>
          )}
        </DetailSection>

        {/* Facturas - RelationList */}
        <RelationList
          title="Facturas"
          icon={Receipt}
          module="facturacion"
          parentField="proyectoId"
          parentId={id}
          titleField="numero"
          statusField="estado"
          dateField="fechaVencimiento"
          canCreate
          canAssign
          FormComponent={FacturaForm}
          formData={{ clienteId: project.clienteId ?? undefined }}
          onRefresh={refetch}
          statusBadge={estadoBadge}
          emptyMessage="No hay facturas."
        />

        {/* Archivos adjuntos */}
        <UploadArea module="proyectos" recordId={id} />
        <SavedQRCodes module="proyectos" recordId={id} />

        {/* Comentarios + Actividad */}
        <CommentsSection module="proyectos" recordId={id} />
        <ActivityTimeline module="proyectos" recordId={id} />

        <ConfirmModal open={deleteOpen} title="Eliminar proyecto" description="¿Estás seguro? Esta acción no se puede deshacer." confirmLabel="Eliminar" variant="danger" onConfirm={handleDelete} onCancel={() => setDeleteOpen(false)} />
      </div>
    </AppShell>
  )
}
