"use client"

import { use, useCallback, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import {
  InlineText,
  InlineSelect,
  InlineTextarea,
} from "@/components/inline-edit"
import { RelationList } from "@/components/relation-list"
import { DetailSection } from "@/components/detail-section"
import { SmartAction } from "@/components/smart-action"
import { apiPatch, apiDelete } from "@/lib/api-client"
import { useFetch } from "@/hooks/use-fetch"
import { toast } from "sonner"
import { CanDelete } from "@/components/role-gate"
import { CommentsSection } from "@/components/comments-section"
import { ActivityTimeline } from "@/components/activity-timeline"
import { UploadArea } from "@/components/upload-area"
import { QRButton } from "@/components/qr-code-modal"
import { SavedQRCodes } from "@/components/saved-qr-codes"
import { ClientPortalAccess } from "@/components/client-portal-access"
import {
  Building,
  ArrowLeft,
  Trash2,
  FolderKanban,
  CheckSquare,
  FileText,
  Receipt,
  Plus,
  TrendingUp,
  TrendingDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ProyectoForm } from "@/components/forms/proyecto-form"
import { TareaForm } from "@/components/forms/tarea-form"
import { DocumentoForm } from "@/components/forms/documento-form"
import { TransaccionForm } from "@/components/forms/transaccion-form"
import { FacturaForm } from "@/components/forms/factura-form"
import { ConfirmModal } from "@/components/confirm-modal"

const clienteEstadoOptions = [
  { value: "activo", label: "Activo" },
  { value: "inactivo", label: "Inactivo" },
  { value: "prospecto", label: "Prospecto" },
]

const clienteTipoOptions = [
  { value: "empresa", label: "Empresa" },
  { value: "freelancer", label: "Freelancer" },
  { value: "startup", label: "Startup" },
]

const estadoBadgeClass = (value: string) => {
  if (value === "activo") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
  if (value === "inactivo") return "bg-muted text-muted-foreground"
  if (value === "prospecto") return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
  return "bg-muted text-muted-foreground"
}

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
  })[v] ?? "bg-muted text-muted-foreground"

function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value)
}

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { data: client, loading, error, refetch } = useFetch<any>(id ? `/api/clientes/${id}` : null)
  const { data: finanzasData, refetch: refetchFinanzas } = useFetch<unknown>(id ? `/api/finanzas?clienteId=${id}` : null)

  const [deleteOpen, setDeleteOpen] = useState(false)

  const saveField = useCallback(
    async (field: string, value: unknown) => {
      await apiPatch(`/api/clientes/${id}`, { [field]: value })
      toast.success("Guardado")
      refetch()
    },
    [id, refetch]
  )

  const handleDelete = useCallback(async () => {
    await apiDelete(`/api/clientes/${id}`)
    toast.success("Cliente eliminado")
    setDeleteOpen(false)
    router.push("/clientes")
  }, [id, router])

  const transacciones = Array.isArray(finanzasData) ? finanzasData : []
  const totalIngresos = transacciones
    .filter((t: { tipo?: string }) => t.tipo === "ingreso")
    .reduce((s: number, t: { monto?: number }) => s + (t.monto ?? 0), 0)
  const totalGastos = transacciones
    .filter((t: { tipo?: string }) => t.tipo === "gasto")
    .reduce((s: number, t: { monto?: number }) => s + (t.monto ?? 0), 0)

  if (loading) {
    return (
      <AppShell currentSection="clientes" breadcrumbs={[{ label: "7F" }, { label: "Clientes", href: "/clientes" }, { label: "..." }]}>
        <div className="flex flex-col gap-8">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-muted animate-pulse" />
            <div className="space-y-2">
              <div className="h-7 w-48 rounded bg-muted animate-pulse" />
              <div className="h-4 w-32 rounded bg-muted animate-pulse" />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        </div>
      </AppShell>
    )
  }

  if (error || !client) {
    return (
      <AppShell currentSection="clientes" breadcrumbs={[{ label: "7F" }, { label: "Clientes", href: "/clientes" }]}>
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <Building className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-semibold text-foreground">Cliente no encontrado</p>
          <p className="text-xs text-muted-foreground mt-1">{error ?? "No se encontró este cliente."}</p>
          <Link href="/clientes" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
            ← Volver a Clientes
          </Link>
        </div>
      </AppShell>
    )
  }

  const proyectos = Array.isArray(client?.proyectos) ? client.proyectos : []
  const tareas = Array.isArray(client?.tareas) ? client.tareas : []

  return (
    <AppShell
      currentSection="clientes"
      breadcrumbs={[{ label: "7F" }, { label: "Clientes", href: "/clientes" }, { label: client.nombre ?? "Cliente" }]}
    >
      <div className="flex flex-col gap-8">
        <Link
          href="/clientes"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          <ArrowLeft className="h-4 w-4" /> Clientes
        </Link>

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4 min-w-0">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted flex-shrink-0">
              <Building className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <InlineText
                  value={client.nombre ?? ""}
                  onSave={(v) => saveField("nombre", v)}
                  as="h1"
                  className="text-2xl font-semibold tracking-tight text-foreground"
                  placeholder="Nombre del cliente"
                />
                <InlineSelect
                  value={client.estado ?? "activo"}
                  options={clienteEstadoOptions}
                  onSave={(v) => saveField("estado", v)}
                  badgeClassName={estadoBadgeClass}
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <QRButton
              module="clientes"
              recordId={id}
              defaultUrl={typeof window !== "undefined" ? `${window.location.origin}/clientes/${id}` : `/clientes/${id}`}
            />
            <CanDelete>
              <button
                onClick={() => setDeleteOpen(true)}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" /> Eliminar
              </button>
            </CanDelete>
          </div>
        </div>

        {/* Metadata grid */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Empresa</p>
              <InlineText value={client.empresa ?? ""} onSave={(v) => saveField("empresa", v)} placeholder="—" className="text-sm" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Email</p>
              <InlineText value={client.email ?? ""} onSave={(v) => saveField("email", v)} placeholder="—" className="text-sm" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Teléfono</p>
              <InlineText value={client.telefono ?? ""} onSave={(v) => saveField("telefono", v)} placeholder="—" className="text-sm" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Tipo</p>
              <InlineSelect value={client.tipo ?? "empresa"} options={clienteTipoOptions} onSave={(v) => saveField("tipo", v)} />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Fecha registro</p>
              <p className="text-sm text-foreground">{formatDate(client.createdAt)}</p>
            </div>
          </div>
        </div>

        {/* Notas */}
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="text-xs font-medium text-muted-foreground mb-2">Notas</p>
          <InlineTextarea value={client.notas ?? ""} onSave={(v) => saveField("notas", v)} placeholder="Agregar notas..." rows={3} />
        </div>

        {/* Proyectos - RelationList */}
        <RelationList
          title="Proyectos"
          icon={FolderKanban}
          module="proyectos"
          parentField="clienteId"
          parentId={id}
          titleField="nombre"
          statusField="estado"
          dateField="fechaFin"
          items={proyectos}
          canCreate
          canAssign
          canUnlink
          FormComponent={ProyectoForm}
          onRefresh={refetch}
          statusBadge={estadoBadge}
          emptyMessage="Sin proyectos. Crea uno para este cliente."
        />

        {/* Tareas - RelationList */}
        <RelationList
          title="Tareas"
          icon={CheckSquare}
          module="tareas"
          parentField="clienteId"
          parentId={id}
          titleField="titulo"
          statusField="estado"
          dateField="fechaLimite"
          items={tareas}
          canCreate
          canAssign
          canUnlink
          FormComponent={TareaForm}
          onRefresh={refetch}
          statusBadge={estadoBadge}
          emptyMessage="Sin tareas. Crea una para este cliente."
        />

        {/* Documentos - RelationList */}
        <RelationList
          title="Documentos"
          icon={FileText}
          module="documentos"
          parentField="clienteId"
          parentId={id}
          titleField="nombre"
          canCreate
          canAssign
          FormComponent={DocumentoForm}
          onRefresh={refetch}
          emptyMessage="Sin documentos."
        />

        {/* Facturas - RelationList */}
        <RelationList
          title="Facturas"
          icon={Receipt}
          module="facturacion"
          parentField="clienteId"
          parentId={id}
          titleField="numero"
          statusField="estado"
          dateField="fechaVencimiento"
          canCreate
          canAssign
          FormComponent={FacturaForm}
          formData={{ clienteId: id }}
          onRefresh={refetch}
          statusBadge={estadoBadge}
          emptyMessage="Sin facturas."
        />

        {/* Transacciones - Custom section */}
        <DetailSection
          title="Transacciones"
          icon={TrendingUp}
          badge={
            <span className="text-sm text-muted-foreground">
              Ingresos: {formatCurrency(totalIngresos)} · Gastos: {formatCurrency(totalGastos)}
            </span>
          }
          action={
            <SmartAction
              label="Nueva transaccion"
              icon={Plus}
              FormComponent={TransaccionForm}
              defaultValues={{ clienteId: id }}
              onCreated={() => { refetch(); refetchFinanzas() }}
            />
          }
        >
          {transacciones.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Sin transacciones.</p>
          ) : (
            <div className="space-y-2">
              {transacciones.map((tr: { id: string; tipo?: string; monto?: number; descripcion?: string; fecha?: string }) => (
                <div key={tr.id} className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-border bg-background/50">
                  <span className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-medium",
                    tr.tipo === "ingreso" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                  )}>
                    {tr.tipo === "ingreso" ? "Ingreso" : "Gasto"}
                  </span>
                  <span className="font-medium text-foreground">{formatCurrency(tr.monto ?? 0)}</span>
                  <span className="text-sm text-muted-foreground truncate">{tr.descripcion ?? "—"}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{formatDate(tr.fecha)}</span>
                </div>
              ))}
            </div>
          )}
        </DetailSection>

        {/* Archivos adjuntos */}
        <UploadArea module="clientes" recordId={id} />
        <SavedQRCodes module="clientes" recordId={id} />

        {/* Portal de Clientes */}
        <ClientPortalAccess clienteId={id} clienteEmail={client?.email} />

        {/* Comentarios + Actividad */}
        <CommentsSection module="clientes" recordId={id} />
        <ActivityTimeline module="clientes" recordId={id} />
      </div>

      <ConfirmModal
        open={deleteOpen}
        title="Eliminar cliente"
        description="¿Estás seguro? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </AppShell>
  )
}
