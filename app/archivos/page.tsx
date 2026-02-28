"use client"

import { useMemo, useState } from "react"
import { AppShell } from "@/components/app-shell"
import { SectionPage } from "@/components/section-page"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { useFetch } from "@/hooks/use-fetch"
import {
  FileText,
  Search,
  Image,
  FileSpreadsheet,
  File,
  FileVideo,
  FolderKanban,
  Calendar,
  Download,
  Eye,
  X,
  Grid3X3,
  List,
  Pencil,
  Trash2,
  Plus,
  Upload,
} from "lucide-react"
import { DocumentoForm } from "@/components/forms/documento-form"
import { ConfirmModal } from "@/components/confirm-modal"
import { apiDelete } from "@/lib/api-client"
import { toast } from "sonner"

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })
  } catch {
    return dateStr
  }
}

function getFileIcon(tipo: string) {
  const t = (tipo ?? "").toLowerCase()
  if (t.includes("pdf")) return FileText
  if (t.includes("imagen") || t.includes("image") || t.includes("png") || t.includes("jpg") || t.includes("jpeg")) return Image
  if (t.includes("hoja") || t.includes("calcul") || t.includes("excel") || t.includes("xlsx")) return FileSpreadsheet
  if (t.includes("video") || t.includes("mp4")) return FileVideo
  return File
}

export default function ArchivosPage() {
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState("Todos")
  const [filterClient, setFilterClient] = useState("Todos")
  const [filterProject, setFilterProject] = useState("Todos")
  const [viewMode, setViewMode] = useState<"list" | "grid">("list")
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [deleteItem, setDeleteItem] = useState<any>(null)

  const apiUrl = useMemo(() => {
    const params = new URLSearchParams()
    if (filterType && filterType !== "Todos") params.set("tipo", filterType)
    if (search.trim()) params.set("search", search.trim())
    const q = params.toString()
    return q ? `/api/documentos?${q}` : "/api/documentos"
  }, [filterType, search])
  const { data: apiData, loading, error, refetch } = useFetch<any>(apiUrl)
  const allFiles = useMemo(() => {
    if (apiData == null) return []
    return Array.isArray(apiData) ? apiData : (apiData?.data ?? [])
  }, [apiData])

  const fileTypes = useMemo(() => {
    const types = new Set<string>(["Todos"])
    allFiles.forEach((f: any) => {
      const t = f.tipo ?? "Otro"
      types.add(typeof t === "string" ? t : "Otro")
    })
    return Array.from(types)
  }, [allFiles])

  const fileClients = useMemo(() => {
    const clients = new Set<string>(["Todos"])
    allFiles.forEach((f: any) => {
      const name = f.cliente?.nombre ?? ""
      if (name) clients.add(name)
    })
    return Array.from(clients)
  }, [allFiles])

  const fileProjects = useMemo(() => {
    const projects = new Set<string>(["Todos"])
    allFiles.forEach((f: any) => {
      const name = f.proyecto?.nombre ?? ""
      if (name) projects.add(name)
    })
    return Array.from(projects)
  }, [allFiles])

  const filtered = useMemo(() => {
    return allFiles.filter((f: any) => {
      const matchSearch =
        search === "" ||
        (f.nombre ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (f.proyecto?.nombre ?? "").toLowerCase().includes(search.toLowerCase())
      const matchType = filterType === "Todos" || (f.tipo ?? "") === filterType
      const matchClient = filterClient === "Todos" || (f.cliente?.nombre ?? "") === filterClient
      const matchProject = filterProject === "Todos" || (f.proyecto?.nombre ?? "") === filterProject
      return matchSearch && matchType && matchClient && matchProject
    })
  }, [allFiles, search, filterType, filterClient, filterProject])

  const selected = useMemo(() => allFiles.find((f: any) => f.id === selectedFile), [allFiles, selectedFile])

  const totalSize = useMemo(() => {
    const sum = allFiles.reduce((acc: number, f: any) => acc + (Number(f.tamano) || 0), 0)
    return formatBytes(sum)
  }, [allFiles])

  const pdfCount = useMemo(() => allFiles.filter((f: any) => (f.tipo ?? "").toLowerCase().includes("pdf")).length, [allFiles])
  const imgCount = useMemo(
    () =>
      allFiles.filter((f: any) => {
        const t = (f.tipo ?? "").toLowerCase()
        return t.includes("imagen") || t.includes("image") || t.includes("png") || t.includes("jpg")
      }).length,
    [allFiles]
  )

  async function handleDelete() {
    if (!deleteItem) return
    try {
      await apiDelete(`/api/documentos/${deleteItem.id}`)
      toast.success("Documento eliminado")
      refetch()
      if (selectedFile === deleteItem.id) setSelectedFile(null)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar")
    } finally {
      setDeleteItem(null)
    }
  }

  return (
    <AppShell currentSection="archivos" breadcrumbs={[{ label: "7F" }, { label: "Archivos" }]}>
      <SectionPage title="Archivos" description="Explorador centralizado de todos los documentos, imagenes y archivos del sistema.">

        {error && (
          <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total archivos</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{loading ? "—" : allFiles.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Almacenamiento</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{loading ? "—" : totalSize}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Documentos PDF</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{loading ? "—" : pdfCount}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Imagenes</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{loading ? "—" : imgCount}</p>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <input
                type="text"
                placeholder="Buscar archivo o proyecto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-0.5">
                <button onClick={() => setViewMode("list")} className={cn("rounded-md p-1.5 transition-colors", viewMode === "list" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")} aria-label="Vista lista"><List className="h-4 w-4" /></button>
                <button onClick={() => setViewMode("grid")} className={cn("rounded-md p-1.5 transition-colors", viewMode === "grid" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")} aria-label="Vista grid"><Grid3X3 className="h-4 w-4" /></button>
              </div>
              <button
                onClick={() => { setEditingItem(null); setFormOpen(true) }}
                className="flex items-center gap-2 rounded-lg bg-foreground px-3.5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-80 whitespace-nowrap flex-shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Nuevo</span>
              </button>
            </div>
          </div>
          <div className="flex flex-nowrap sm:flex-wrap items-center gap-2 overflow-x-auto">
            {fileTypes.map(t => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  filterType === t ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {t}
              </button>
            ))}
            <span className="mx-1 h-4 w-px bg-border" />
            <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)} className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground outline-none flex-shrink-0">
              {fileClients.map(c => <option key={c} value={c}>{c === "Todos" ? "Cliente" : c}</option>)}
            </select>
            <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)} className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground outline-none flex-shrink-0">
              {fileProjects.map(p => <option key={p} value={p}>{p === "Todos" ? "Proyecto" : p}</option>)}
            </select>
          </div>
        </div>

        {/* File list + detail panel */}
        <div className="grid gap-4 lg:grid-cols-5">
          {/* List/Grid */}
          <div className={cn(selected ? "lg:col-span-3" : "lg:col-span-5")}>
            <p className="text-xs text-muted-foreground mb-2">{filtered.length} archivos</p>
            {loading ? (
              <div className="flex flex-col gap-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="w-full rounded-xl border border-border bg-card px-4 py-3 animate-pulse">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-muted" />
                      <div className="flex-1 space-y-1">
                        <div className="h-4 w-48 bg-muted rounded" />
                        <div className="h-3 w-32 bg-muted rounded" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : viewMode === "list" ? (
              <div className="flex flex-col gap-2">
                {filtered.map((file: any) => {
                  const FileIcon = getFileIcon(file.tipo)
                  const isSelected = selectedFile === file.id
                  const sizeStr = formatBytes(Number(file.tamano) || 0)
                  const dateStr = file.createdAt ? formatDate(file.createdAt) : "—"
                  return (
                    <button
                      key={file.id}
                      onClick={() => setSelectedFile(isSelected ? null : file.id)}
                      className={cn(
                        "w-full rounded-xl border bg-card px-4 py-3 text-left transition-all hover:shadow-sm",
                        isSelected ? "border-foreground/30 shadow-sm" : "border-border"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--tab-docs)] flex-shrink-0">
                          <FileIcon className="h-5 w-5 text-foreground/60" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{file.nombre}</p>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                            <span>{file.tipo ?? "—"}</span>
                            <span>&middot;</span>
                            <span>{sizeStr}</span>
                            <span className="hidden sm:inline">&middot;</span>
                            <span className="hidden sm:flex items-center gap-1"><FolderKanban className="h-3 w-3" />{file.proyecto?.nombre ?? "—"}</span>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground flex-shrink-0 hidden sm:block">{dateStr}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((file: any) => {
                  const FileIcon = getFileIcon(file.tipo)
                  const isSelected = selectedFile === file.id
                  const sizeStr = formatBytes(Number(file.tamano) || 0)
                  const dateStr = file.createdAt ? formatDate(file.createdAt) : "—"
                  return (
                    <button
                      key={file.id}
                      onClick={() => setSelectedFile(isSelected ? null : file.id)}
                      className={cn(
                        "rounded-xl border bg-card p-4 text-left transition-all hover:shadow-sm flex flex-col gap-3",
                        isSelected ? "border-foreground/30 shadow-sm" : "border-border"
                      )}
                    >
                      <div className="flex h-20 items-center justify-center rounded-lg bg-[var(--tab-docs)]/30">
                        <FileIcon className="h-8 w-8 text-foreground/30" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground truncate">{file.nombre}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{sizeStr} &middot; {dateStr}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
                <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground">No se encontraron archivos</p>
                <p className="text-xs text-muted-foreground mt-1">Ajusta los filtros o busca con otro termino.</p>
              </div>
            )}
          </div>

          {/* Detail panel */}
          {selected && (
            <div className="lg:col-span-2">
              <div className="rounded-xl border border-border bg-card lg:sticky lg:top-6">
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                  <h3 className="text-sm font-semibold text-foreground">Detalle del archivo</h3>
                  <button onClick={() => setSelectedFile(null)} className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Cerrar">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="p-5 flex flex-col gap-4">
                  <div className="flex h-32 items-center justify-center rounded-lg bg-muted">
                    {(() => {
                      const Icon = getFileIcon(selected.tipo)
                      return <Icon className="h-12 w-12 text-muted-foreground/30" />
                    })()}
                  </div>
                  <div>
                    <p className="text-base font-semibold text-foreground">{selected.nombre}</p>
                    <p className="text-xs text-muted-foreground mt-1">{selected.tipo ?? "—"} &middot; {formatBytes(Number(selected.tamano) || 0)}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <DetailField label="Proyecto" value={selected.proyecto?.nombre ?? "—"} />
                    <DetailField label="Cliente" value={selected.cliente?.nombre ?? "—"} />
                    <DetailField label="Subido por" value="—" />
                    <DetailField label="Fecha" value={selected.createdAt ? formatDate(selected.createdAt) : "—"} />
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-border flex-wrap">
                    <button className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors">
                      <Eye className="h-3 w-3" /> Vista previa
                    </button>
                    <button className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors">
                      <Download className="h-3 w-3" /> Descargar
                    </button>
                    <button
                      onClick={() => { setEditingItem(selected); setFormOpen(true) }}
                      className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
                    >
                      <Pencil className="h-3 w-3" /> Editar
                    </button>
                    <button
                      onClick={() => setDeleteItem(selected)}
                      className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-destructive hover:bg-accent transition-colors"
                    >
                      <Trash2 className="h-3 w-3" /> Eliminar
                    </button>
                  </div>
                  <Link
                    href={`/archivos/${selected.id}`}
                    className="block w-full rounded-lg bg-foreground px-3 py-2 text-center text-xs font-medium text-background transition-opacity hover:opacity-80"
                  >
                    Ver detalle completo
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
        <DocumentoForm
          open={formOpen}
          onClose={() => { setFormOpen(false); setEditingItem(null) }}
          onSuccess={refetch}
          data={editingItem}
        />
        <ConfirmModal
          open={!!deleteItem}
          title="Eliminar documento"
          description={`¿Seguro que quieres eliminar "${deleteItem?.nombre}"? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          variant="danger"
          onConfirm={handleDelete}
          onCancel={() => setDeleteItem(null)}
        />
      </SectionPage>
    </AppShell>
  )
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}
