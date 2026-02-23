"use client"

import { use, useCallback, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { SectionPage } from "@/components/section-page"
import { useFetch } from "@/hooks/use-fetch"
import { apiPatch, apiDelete } from "@/lib/api-client"
import { toast } from "sonner"
import { CanEdit, CanDelete } from "@/components/role-gate"
import {
  ArrowLeft,
  File,
  FileText,
  Image,
  FileSpreadsheet,
  FileVideo,
  Download,
  Trash2,
  Pencil,
  Save,
  X,
  FolderKanban,
  Users,
  Calendar,
  HardDrive,
  Loader2,
  Check,
} from "lucide-react"
import { ConfirmModal } from "@/components/confirm-modal"

function getFileIcon(tipo: string) {
  const t = (tipo ?? "").toLowerCase()
  if (t.includes("pdf")) return FileText
  if (t.includes("image") || t.includes("png") || t.includes("jpg") || t.includes("jpeg") || t.includes("imagen")) return Image
  if (t.includes("excel") || t.includes("xlsx") || t.includes("spreadsheet") || t.includes("hoja")) return FileSpreadsheet
  if (t.includes("video") || t.includes("mp4")) return FileVideo
  return File
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "—"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—"
  return new Date(dateStr).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function isPreviewable(tipo: string): boolean {
  const t = (tipo ?? "").toLowerCase()
  return t.includes("image") || t.includes("png") || t.includes("jpg") || t.includes("jpeg") || t.includes("gif") || t.includes("webp") || t.includes("svg")
}

export default function ArchivoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { data: doc, loading, error, refetch } = useFetch<any>(id ? `/api/documentos/${id}` : null)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [newName, setNewName] = useState("")
  const [saving, setSaving] = useState(false)

  const handleDelete = useCallback(async () => {
    try {
      await apiDelete(`/api/documentos/${id}`)
      toast.success("Archivo eliminado")
      setDeleteOpen(false)
      router.push("/archivos")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar")
    }
  }, [id, router])

  const handleRename = useCallback(async () => {
    if (!newName.trim()) return
    setSaving(true)
    try {
      await apiPatch(`/api/documentos/${id}`, { nombre: newName.trim() })
      toast.success("Archivo renombrado")
      setRenaming(false)
      refetch()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al renombrar")
    } finally {
      setSaving(false)
    }
  }, [id, newName, refetch])

  const startRenaming = useCallback(() => {
    setNewName(doc?.nombre || "")
    setRenaming(true)
  }, [doc])

  if (loading) {
    return (
      <AppShell currentSection="archivos" breadcrumbs={[{ label: "7F" }, { label: "Archivos", href: "/archivos" }, { label: "..." }]}>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    )
  }

  if (error || !doc) {
    return (
      <AppShell currentSection="archivos" breadcrumbs={[{ label: "7F" }, { label: "Archivos", href: "/archivos" }, { label: "Error" }]}>
        <div className="flex flex-col items-center justify-center py-20">
          <File className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-foreground">Archivo no encontrado</p>
          <Link href="/archivos" className="mt-2 text-sm text-muted-foreground hover:text-foreground">
            Volver a archivos
          </Link>
        </div>
      </AppShell>
    )
  }

  const Icon = getFileIcon(doc.tipo)
  const canPreview = isPreviewable(doc.tipo)

  return (
    <AppShell
      currentSection="archivos"
      breadcrumbs={[
        { label: "7F" },
        { label: "Archivos", href: "/archivos" },
        { label: doc.nombre },
      ]}
    >
      <SectionPage title="" description="">
        <div className="space-y-6">
          {/* Header */}
          <div>
            <Link href="/archivos" className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" /> Archivos
            </Link>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted flex-shrink-0">
                  <Icon className="h-7 w-7 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  {renaming ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setRenaming(false) }}
                        autoFocus
                        className="rounded-lg border border-border bg-background px-3 py-1.5 text-lg font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
                      />
                      <button
                        onClick={handleRename}
                        disabled={saving}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-emerald-600 hover:bg-emerald-50 transition-colors"
                      >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => setRenaming(false)}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <h1 className="text-xl font-semibold text-foreground truncate">{doc.nombre}</h1>
                  )}
                  <p className="text-sm text-muted-foreground mt-0.5">{doc.tipo}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-80"
                >
                  <Download className="h-3.5 w-3.5" />
                  Descargar
                </a>
                <CanEdit>
                  <button
                    onClick={startRenaming}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                    title="Renombrar"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </CanEdit>
                <CanDelete>
                  <button
                    onClick={() => setDeleteOpen(true)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-accent hover:text-destructive transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </CanDelete>
              </div>
            </div>
          </div>

          {/* Preview */}
          {canPreview && doc.url && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="border-b border-border px-5 py-3">
                <h2 className="text-sm font-semibold text-foreground">Vista previa</h2>
              </div>
              <div className="flex items-center justify-center bg-muted/30 p-6">
                <img
                  src={doc.url}
                  alt={doc.nombre}
                  className="max-h-[500px] max-w-full rounded-lg object-contain"
                />
              </div>
            </div>
          )}

          {/* Info */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card">
              <div className="border-b border-border px-5 py-4">
                <h2 className="text-sm font-semibold text-foreground">Informacion del archivo</h2>
              </div>
              <div className="divide-y divide-border">
                <InfoRow icon={File} label="Nombre" value={doc.nombre} />
                <InfoRow icon={FileText} label="Tipo" value={doc.tipo} />
                <InfoRow icon={HardDrive} label="Tamaño" value={formatBytes(doc.tamano)} />
                <InfoRow icon={Calendar} label="Fecha de subida" value={formatDate(doc.createdAt)} />
                <InfoRow icon={Calendar} label="Ultima modificacion" value={formatDate(doc.updatedAt)} />
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card">
              <div className="border-b border-border px-5 py-4">
                <h2 className="text-sm font-semibold text-foreground">Asociaciones</h2>
              </div>
              <div className="divide-y divide-border">
                {doc.cliente ? (
                  <div className="flex items-center justify-between px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Cliente</span>
                    </div>
                    <Link
                      href={`/clientes/${doc.cliente.id}`}
                      className="text-sm font-medium text-foreground hover:underline"
                    >
                      {doc.cliente.nombre}
                    </Link>
                  </div>
                ) : (
                  <InfoRow icon={Users} label="Cliente" value="Sin asignar" />
                )}
                {doc.proyecto ? (
                  <div className="flex items-center justify-between px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <FolderKanban className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Proyecto</span>
                    </div>
                    <Link
                      href={`/proyectos/${doc.proyecto.id}`}
                      className="text-sm font-medium text-foreground hover:underline"
                    >
                      {doc.proyecto.nombre}
                    </Link>
                  </div>
                ) : (
                  <InfoRow icon={FolderKanban} label="Proyecto" value="Sin asignar" />
                )}
              </div>
            </div>
          </div>

          {/* URL */}
          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold text-foreground">Ubicacion del archivo</h2>
            </div>
            <div className="px-5 py-4">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  readOnly
                  value={doc.url}
                  className="flex-1 rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground"
                />
                <button
                  onClick={() => { navigator.clipboard.writeText(doc.url); toast.success("URL copiada") }}
                  className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
                >
                  Copiar
                </button>
              </div>
            </div>
          </div>
        </div>

        <ConfirmModal
          open={deleteOpen}
          title="Eliminar archivo"
          description={`¿Seguro que quieres eliminar "${doc.nombre}"? Esta accion no se puede deshacer.`}
          confirmLabel="Eliminar"
          variant="danger"
          onConfirm={handleDelete}
          onCancel={() => setDeleteOpen(false)}
        />
      </SectionPage>
    </AppShell>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5">
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  )
}
