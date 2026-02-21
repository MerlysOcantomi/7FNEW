"use client"

import { useState, useRef, useCallback } from "react"
import { cn } from "@/lib/utils"
import {
  Search,
  Upload,
  SlidersHorizontal,
  Grid3X3,
  List,
  FileText,
  FileImage,
  FileSpreadsheet,
  FileArchive,
  Film,
  File,
  Download,
  Trash2,
  Eye,
  MoreHorizontal,
  X,
  ChevronDown,
  Sparkles,
  Calendar,
  User,
  ArrowUpDown,
  FolderKanban,
  Check,
} from "lucide-react"

/* ─────────── Types ─────────── */

type FileType = "image" | "pdf" | "doc" | "spreadsheet" | "zip" | "video" | "other"
type SortKey = "name" | "date" | "size" | "type"
type ViewMode = "grid" | "list"

interface DocFile {
  id: string
  name: string
  type: FileType
  mimeLabel: string
  date: string
  size: string
  sizeBytes: number
  uploadedBy: string
  project?: string
  thumbnailColor: string
}

/* ─────────── Data ─────────── */

const allDocuments: DocFile[] = [
  {
    id: "d1",
    name: "Contrato de servicio 2026.pdf",
    type: "pdf",
    mimeLabel: "PDF",
    date: "10 ene 2026",
    size: "1.8 MB",
    sizeBytes: 1800000,
    uploadedBy: "Carlos M.",
    project: "Rediseno Identidad Visual",
    thumbnailColor: "#F87171",
  },
  {
    id: "d2",
    name: "Brief creativo.pdf",
    type: "pdf",
    mimeLabel: "PDF",
    date: "15 ene 2026",
    size: "2.4 MB",
    sizeBytes: 2400000,
    uploadedBy: "Ana R.",
    project: "Rediseno Identidad Visual",
    thumbnailColor: "#F87171",
  },
  {
    id: "d3",
    name: "Propuesta comercial Q1.pdf",
    type: "pdf",
    mimeLabel: "PDF",
    date: "5 dic 2025",
    size: "3.2 MB",
    sizeBytes: 3200000,
    uploadedBy: "Laura G.",
    thumbnailColor: "#F87171",
  },
  {
    id: "d4",
    name: "Logo final v3.png",
    type: "image",
    mimeLabel: "PNG",
    date: "20 ene 2026",
    size: "4.5 MB",
    sizeBytes: 4500000,
    uploadedBy: "Carlos M.",
    project: "Rediseno Identidad Visual",
    thumbnailColor: "#60A5FA",
  },
  {
    id: "d5",
    name: "Paleta de colores.jpg",
    type: "image",
    mimeLabel: "JPG",
    date: "18 ene 2026",
    size: "1.2 MB",
    sizeBytes: 1200000,
    uploadedBy: "Ana R.",
    project: "Rediseno Identidad Visual",
    thumbnailColor: "#60A5FA",
  },
  {
    id: "d6",
    name: "Moodboard referencias.webp",
    type: "image",
    mimeLabel: "WEBP",
    date: "12 ene 2026",
    size: "3.8 MB",
    sizeBytes: 3800000,
    uploadedBy: "Ana R.",
    project: "Campana Digital Q1",
    thumbnailColor: "#60A5FA",
  },
  {
    id: "d7",
    name: "Presupuesto desglosado.xlsx",
    type: "spreadsheet",
    mimeLabel: "XLSX",
    date: "8 feb 2026",
    size: "0.6 MB",
    sizeBytes: 600000,
    uploadedBy: "Laura G.",
    thumbnailColor: "#34D399",
  },
  {
    id: "d8",
    name: "Acta de reunion 14-feb.docx",
    type: "doc",
    mimeLabel: "DOCX",
    date: "14 feb 2026",
    size: "0.3 MB",
    sizeBytes: 300000,
    uploadedBy: "Carlos M.",
    thumbnailColor: "#818CF8",
  },
  {
    id: "d9",
    name: "Materiales fotograficos.zip",
    type: "zip",
    mimeLabel: "ZIP",
    date: "8 feb 2026",
    size: "128 MB",
    sizeBytes: 128000000,
    uploadedBy: "Ana R.",
    project: "Rediseno Identidad Visual",
    thumbnailColor: "#FBBF24",
  },
  {
    id: "d10",
    name: "Video testimonial v1.mp4",
    type: "video",
    mimeLabel: "MP4",
    date: "1 feb 2026",
    size: "45.6 MB",
    sizeBytes: 45600000,
    uploadedBy: "Carlos M.",
    project: "Campana Digital Q1",
    thumbnailColor: "#F472B6",
  },
  {
    id: "d11",
    name: "Guia de marca actual.ai",
    type: "other",
    mimeLabel: "AI",
    date: "20 nov 2025",
    size: "45.6 MB",
    sizeBytes: 45600000,
    uploadedBy: "Ana R.",
    project: "Rediseno Identidad Visual",
    thumbnailColor: "#FB923C",
  },
  {
    id: "d12",
    name: "Captura pantalla competencia.png",
    type: "image",
    mimeLabel: "PNG",
    date: "25 ene 2026",
    size: "2.1 MB",
    sizeBytes: 2100000,
    uploadedBy: "Laura G.",
    project: "Estrategia de Contenidos",
    thumbnailColor: "#60A5FA",
  },
]

const typeFilterOptions: { value: FileType | "all"; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "image", label: "Imagenes" },
  { value: "pdf", label: "PDFs" },
  { value: "doc", label: "Documentos" },
  { value: "spreadsheet", label: "Hojas de calculo" },
  { value: "zip", label: "Archivos ZIP" },
  { value: "video", label: "Videos" },
]

/* ─────────── Helpers ─────────── */

function getFileIcon(type: FileType) {
  switch (type) {
    case "image":
      return FileImage
    case "pdf":
      return FileText
    case "doc":
      return FileText
    case "spreadsheet":
      return FileSpreadsheet
    case "zip":
      return FileArchive
    case "video":
      return Film
    default:
      return File
  }
}

function sortDocs(docs: DocFile[], key: SortKey, asc: boolean): DocFile[] {
  return [...docs].sort((a, b) => {
    let cmp = 0
    switch (key) {
      case "name":
        cmp = a.name.localeCompare(b.name)
        break
      case "date":
        cmp = new Date(parseSpanishDate(a.date)).getTime() - new Date(parseSpanishDate(b.date)).getTime()
        break
      case "size":
        cmp = a.sizeBytes - b.sizeBytes
        break
      case "type":
        cmp = a.type.localeCompare(b.type)
        break
    }
    return asc ? cmp : -cmp
  })
}

function parseSpanishDate(d: string): string {
  const months: Record<string, string> = {
    ene: "01", feb: "02", mar: "03", abr: "04",
    may: "05", jun: "06", jul: "07", ago: "08",
    sep: "09", oct: "10", nov: "11", dic: "12",
  }
  const parts = d.split(" ")
  if (parts.length === 3) {
    const month = months[parts[1]] || "01"
    return `${parts[2]}-${month}-${parts[0].padStart(2, "0")}`
  }
  return d
}

/* ─────────── Main Component ─────────── */

export function ClientDocumentsTab() {
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<FileType | "all">("all")
  const [sortKey, setSortKey] = useState<SortKey>("date")
  const [sortAsc, setSortAsc] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  const [showFilters, setShowFilters] = useState(false)
  const [previewFile, setPreviewFile] = useState<DocFile | null>(null)
  const [showUploadZone, setShowUploadZone] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [showAIPanel, setShowAIPanel] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Filtering
  let filtered = allDocuments.filter((doc) => {
    const matchSearch =
      search === "" ||
      doc.name.toLowerCase().includes(search.toLowerCase()) ||
      doc.uploadedBy.toLowerCase().includes(search.toLowerCase()) ||
      (doc.project && doc.project.toLowerCase().includes(search.toLowerCase()))
    const matchType = typeFilter === "all" || doc.type === typeFilter
    return matchSearch && matchType
  })
  filtered = sortDocs(filtered, sortKey, sortAsc)

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(true)
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (selectedFiles.size === filtered.length) {
      setSelectedFiles(new Set())
    } else {
      setSelectedFiles(new Set(filtered.map((d) => d.id)))
    }
  }

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    // In a real app, handle file upload here
    setShowUploadZone(false)
  }, [])

  return (
    <div className="flex flex-col gap-5">
      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Documentos</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} archivo{filtered.length !== 1 ? "s" : ""}
            {typeFilter !== "all" && " filtrados"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowAIPanel(!showAIPanel)}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
              showAIPanel
                ? "border-foreground/20 bg-[var(--tab-ai)] text-foreground"
                : "border-border bg-card text-foreground hover:bg-accent"
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">IA</span>
          </button>
          <button
            onClick={() => {
              setShowUploadZone(!showUploadZone)
            }}
            className="flex items-center gap-2 rounded-lg bg-foreground px-3.5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-80"
          >
            <Upload className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Subir archivo</span>
          </button>
        </div>
      </div>

      {/* ── Upload Zone ── */}
      {showUploadZone && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "relative rounded-xl border-2 border-dashed p-8 text-center transition-all",
            isDragging
              ? "border-foreground/30 bg-[var(--tab-docs)]/30"
              : "border-border bg-card hover:border-foreground/20"
          )}
        >
          <button
            onClick={() => setShowUploadZone(false)}
            className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <Upload className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                Arrastra archivos aqui o{" "}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-foreground underline underline-offset-2 hover:opacity-70"
                >
                  selecciona del explorador
                </button>
              </p>
              <p className="text-xs text-muted-foreground mt-1.5">
                JPG, PNG, WEBP, PDF, DOCX, XLSX, ZIP, MP4 &middot; Max 200 MB por archivo
              </p>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xls,.xlsx,.zip,.mp4,.mov"
            className="hidden"
            onChange={() => {
              // In a real app, handle file selection here
              setShowUploadZone(false)
            }}
          />
        </div>
      )}

      {/* ── AI Panel ── */}
      {showAIPanel && (
        <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--tab-ai)] flex-shrink-0">
                <Sparkles className="h-4 w-4 text-foreground/70" />
              </div>
              <p className="text-sm font-semibold text-foreground">IA Contextual de Documentos</p>
            </div>
            <button
              onClick={() => setShowAIPanel(false)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Selecciona uno o mas documentos para que la IA los analice, o usa las acciones rapidas.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <AIDocAction
              title="Resumir documento"
              description="Extrae los puntos clave de un PDF o documento."
              disabled={selectedFiles.size === 0}
            />
            <AIDocAction
              title="Extraer informacion"
              description="Obtiene datos, cifras y fechas relevantes."
              disabled={selectedFiles.size === 0}
            />
            <AIDocAction
              title="Comparar versiones"
              description="Compara dos archivos y muestra diferencias."
              disabled={selectedFiles.size < 2}
            />
            <AIDocAction
              title="Generar descripcion"
              description="Crea una descripcion automatica del archivo."
              disabled={selectedFiles.size === 0}
            />
          </div>
          {selectedFiles.size > 0 && (
            <p className="text-xs text-muted-foreground">
              {selectedFiles.size} archivo{selectedFiles.size > 1 ? "s" : ""} seleccionado
              {selectedFiles.size > 1 ? "s" : ""}
            </p>
          )}
        </div>
      )}

      {/* ── Search & Filters bar ── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, autor o proyecto..."
              className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Limpiar busqueda"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
              showFilters
                ? "border-foreground/20 bg-accent text-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Filtros</span>
          </button>
          <div className="flex items-center rounded-lg border border-border bg-card">
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-l-lg transition-colors",
                viewMode === "grid" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
              aria-label="Vista en cuadricula"
            >
              <Grid3X3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-r-lg transition-colors",
                viewMode === "list" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
              aria-label="Vista en lista"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div className="flex items-center gap-3 flex-wrap rounded-lg border border-border bg-card px-4 py-3">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Tipo:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {typeFilterOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTypeFilter(opt.value)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    typeFilter === opt.value
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground hidden sm:inline">Ordenar:</span>
              <SortButton label="Nombre" sortKey="name" currentKey={sortKey} asc={sortAsc} onToggle={toggleSort} />
              <SortButton label="Fecha" sortKey="date" currentKey={sortKey} asc={sortAsc} onToggle={toggleSort} />
              <SortButton label="Tamano" sortKey="size" currentKey={sortKey} asc={sortAsc} onToggle={toggleSort} />
            </div>
          </div>
        )}

        {/* Bulk selection bar */}
        {selectedFiles.size > 0 && (
          <div className="flex items-center gap-3 rounded-lg border border-foreground/10 bg-[var(--tab-docs)]/40 px-4 py-2.5">
            <button
              onClick={selectAll}
              className="flex h-5 w-5 items-center justify-center rounded border border-foreground/30 text-foreground"
            >
              {selectedFiles.size === filtered.length && <Check className="h-3 w-3" />}
            </button>
            <span className="text-sm text-foreground">
              {selectedFiles.size} seleccionado{selectedFiles.size > 1 ? "s" : ""}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <button className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors">
                <Download className="h-3 w-3" />
                Descargar
              </button>
              <button className="flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-card px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors">
                <Trash2 className="h-3 w-3" />
                Eliminar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Document Grid/List ── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted mb-4">
            <FileText className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">No se encontraron documentos</p>
          <p className="text-xs text-muted-foreground mt-1">Intenta ajustar los filtros o la busqueda</p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              selected={selectedFiles.has(doc.id)}
              onToggleSelect={() => toggleSelect(doc.id)}
              onPreview={() => setPreviewFile(doc)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col">
          {/* List header */}
          <div className="hidden sm:grid grid-cols-[auto_1fr_100px_100px_100px_80px] items-center gap-3 px-4 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground border-b border-border">
            <button
              onClick={selectAll}
              className="flex h-5 w-5 items-center justify-center rounded border border-border hover:border-foreground/30"
            >
              {selectedFiles.size === filtered.length && filtered.length > 0 && (
                <Check className="h-3 w-3 text-foreground" />
              )}
            </button>
            <span>Nombre</span>
            <span>Tipo</span>
            <span>Fecha</span>
            <span>Tamano</span>
            <span></span>
          </div>
          <div className="flex flex-col divide-y divide-border">
            {filtered.map((doc) => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                selected={selectedFiles.has(doc.id)}
                onToggleSelect={() => toggleSelect(doc.id)}
                onPreview={() => setPreviewFile(doc)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Preview Modal ── */}
      {previewFile && (
        <PreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
      )}
    </div>
  )
}

/* ─────────── Sub Components ─────────── */

function SortButton({
  label,
  sortKey,
  currentKey,
  asc,
  onToggle,
}: {
  label: string
  sortKey: SortKey
  currentKey: SortKey
  asc: boolean
  onToggle: (key: SortKey) => void
}) {
  const isActive = currentKey === sortKey
  return (
    <button
      onClick={() => onToggle(sortKey)}
      className={cn(
        "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
        isActive
          ? "bg-foreground text-background"
          : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {label}
      {isActive && (
        <ArrowUpDown className={cn("h-3 w-3", !asc && "rotate-180")} />
      )}
    </button>
  )
}

function AIDocAction({
  title,
  description,
  disabled,
}: {
  title: string
  description: string
  disabled: boolean
}) {
  return (
    <button
      disabled={disabled}
      className={cn(
        "rounded-xl border p-3 text-left transition-all flex flex-col gap-1",
        disabled
          ? "border-border bg-muted/50 opacity-50 cursor-not-allowed"
          : "border-border bg-card hover:shadow-sm hover:border-foreground/10 cursor-pointer"
      )}
    >
      <p className="text-xs font-medium text-foreground">{title}</p>
      <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
    </button>
  )
}

/* ── Grid Card ── */

function DocumentCard({
  doc,
  selected,
  onToggleSelect,
  onPreview,
}: {
  doc: DocFile
  selected: boolean
  onToggleSelect: () => void
  onPreview: () => void
}) {
  const [showMenu, setShowMenu] = useState(false)
  const Icon = getFileIcon(doc.type)
  const isVisual = doc.type === "image" || doc.type === "video"

  return (
    <div
      className={cn(
        "group relative rounded-xl border bg-card transition-all hover:shadow-sm",
        selected ? "border-foreground/20 ring-1 ring-foreground/10" : "border-border"
      )}
    >
      {/* Thumbnail area */}
      <button
        onClick={onPreview}
        className="w-full aspect-[4/3] rounded-t-xl overflow-hidden flex items-center justify-center"
        style={{
          backgroundColor: isVisual
            ? `color-mix(in srgb, ${doc.thumbnailColor} 15%, white)`
            : "var(--muted)",
        }}
      >
        {isVisual ? (
          <div className="flex flex-col items-center gap-2">
            <Icon className="h-10 w-10" style={{ color: doc.thumbnailColor }} />
            <span className="text-xs font-medium" style={{ color: doc.thumbnailColor }}>
              {doc.mimeLabel}
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Icon className="h-10 w-10 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">{doc.mimeLabel}</span>
          </div>
        )}
      </button>

      {/* Select checkbox */}
      <button
        onClick={onToggleSelect}
        className={cn(
          "absolute top-3 left-3 flex h-5 w-5 items-center justify-center rounded border transition-all",
          selected
            ? "bg-foreground border-foreground text-background"
            : "bg-card/80 border-border opacity-0 group-hover:opacity-100"
        )}
      >
        {selected && <Check className="h-3 w-3" />}
      </button>

      {/* Info area */}
      <div className="p-3.5 flex flex-col gap-2">
        <p className="text-sm font-medium text-foreground leading-snug line-clamp-2">{doc.name}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{doc.size}</span>
          <span className="text-muted-foreground/40">&middot;</span>
          <span>{doc.date}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <User className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{doc.uploadedBy}</span>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              aria-label="Opciones"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {showMenu && (
              <ContextMenu onClose={() => setShowMenu(false)} onPreview={onPreview} />
            )}
          </div>
        </div>
        {doc.project && (
          <div className="flex items-center gap-1.5 mt-0.5">
            <FolderKanban className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground truncate">{doc.project}</span>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── List Row ── */

function DocumentRow({
  doc,
  selected,
  onToggleSelect,
  onPreview,
}: {
  doc: DocFile
  selected: boolean
  onToggleSelect: () => void
  onPreview: () => void
}) {
  const [showMenu, setShowMenu] = useState(false)
  const Icon = getFileIcon(doc.type)

  return (
    <div
      className={cn(
        "group relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50",
        selected && "bg-[var(--tab-docs)]/20"
      )}
    >
      {/* Checkbox - always visible on mobile via padding, toggles on desktop */}
      <button
        onClick={onToggleSelect}
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded border transition-all flex-shrink-0",
          selected
            ? "bg-foreground border-foreground text-background"
            : "border-border sm:opacity-0 sm:group-hover:opacity-100"
        )}
      >
        {selected && <Check className="h-3 w-3" />}
      </button>

      {/* Icon */}
      <button
        onClick={onPreview}
        className="flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0"
        style={{
          backgroundColor: `color-mix(in srgb, ${doc.thumbnailColor} 20%, white)`,
        }}
      >
        <Icon className="h-4 w-4" style={{ color: doc.thumbnailColor }} />
      </button>

      {/* Name & meta */}
      <button onClick={onPreview} className="flex-1 min-w-0 text-left">
        <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 sm:hidden">
          <span>{doc.mimeLabel}</span>
          <span className="text-muted-foreground/40">&middot;</span>
          <span>{doc.date}</span>
          <span className="text-muted-foreground/40">&middot;</span>
          <span>{doc.size}</span>
        </div>
      </button>

      {/* Desktop columns */}
      <span className="text-xs text-muted-foreground w-[100px] flex-shrink-0 hidden sm:block">{doc.mimeLabel}</span>
      <span className="text-xs text-muted-foreground w-[100px] flex-shrink-0 hidden sm:block">{doc.date}</span>
      <span className="text-xs text-muted-foreground w-[100px] flex-shrink-0 hidden sm:block">{doc.size}</span>

      {/* Actions */}
      <div className="relative flex-shrink-0 w-[80px] flex justify-end">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          aria-label="Opciones"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
        {showMenu && (
          <ContextMenu onClose={() => setShowMenu(false)} onPreview={onPreview} />
        )}
      </div>
    </div>
  )
}

/* ── Context Menu ── */

function ContextMenu({ onClose, onPreview }: { onClose: () => void; onPreview: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg border border-border bg-card py-1.5 shadow-lg">
        <button
          onClick={() => {
            onPreview()
            onClose()
          }}
          className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
        >
          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
          Vista previa
        </button>
        <button
          onClick={onClose}
          className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
        >
          <Download className="h-3.5 w-3.5 text-muted-foreground" />
          Descargar
        </button>
        <div className="my-1 border-t border-border" />
        <button
          onClick={onClose}
          className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Eliminar
        </button>
      </div>
    </>
  )
}

/* ── Preview Modal ── */

function PreviewModal({ file, onClose }: { file: DocFile; onClose: () => void }) {
  const Icon = getFileIcon(file.type)
  const isVisual = file.type === "image" || file.type === "video"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-foreground/40" />

      {/* Modal */}
      <div
        className="relative w-full max-w-2xl max-h-[85vh] rounded-2xl bg-card border border-border shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0"
              style={{
                backgroundColor: `color-mix(in srgb, ${file.thumbnailColor} 20%, white)`,
              }}
            >
              <Icon className="h-4 w-4" style={{ color: file.thumbnailColor }} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {file.mimeLabel} &middot; {file.size} &middot; {file.date}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors flex-shrink-0"
            aria-label="Cerrar vista previa"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Preview content */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-8">
          <div
            className="w-full max-w-md aspect-square rounded-xl flex flex-col items-center justify-center gap-4"
            style={{
              backgroundColor: isVisual
                ? `color-mix(in srgb, ${file.thumbnailColor} 10%, white)`
                : "var(--muted)",
            }}
          >
            <Icon
              className="h-16 w-16"
              style={{ color: isVisual ? file.thumbnailColor : "var(--muted-foreground)" }}
            />
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">{file.name}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Vista previa no disponible para este tipo de archivo
              </p>
            </div>
          </div>
        </div>

        {/* Modal footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-border flex-shrink-0">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <User className="h-3 w-3" />
              {file.uploadedBy}
            </span>
            {file.project && (
              <span className="flex items-center gap-1.5">
                <FolderKanban className="h-3 w-3" />
                {file.project}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3 w-3" />
              {file.date}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors">
              <Download className="h-3 w-3" />
              Descargar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
