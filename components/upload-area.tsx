"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { useFetch } from "@/hooks/use-fetch"
import { useUser } from "@/hooks/use-user"
import { CanEdit } from "@/components/role-gate"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  Upload,
  X,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  FileType,
  Film,
  Archive,
  Trash2,
  Download,
  Eye,
  Loader2,
  Paperclip,
  ScanLine,
  Tag,
  Calendar,
  DollarSign,
  Building2,
  MapPin,
  Hash,
  ChevronRight,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
} from "lucide-react"

interface ScanResultData {
  tipoDocumento: string
  fecha: string | null
  total: string | null
  entidad: string | null
  resumen: string
  tags: string[]
  direccion: string | null
  numerosRelevantes: string[]
  error?: string
}

interface AttachmentData {
  id: string
  nombre: string
  url: string
  tipo: string
  tamano: number
  userName: string | null
  createdAt: string
  ocrText: string | null
  scanStatus: string
  scanResult: string | ScanResultData | null
}

interface UploadAreaProps {
  module: string
  recordId: string
  onUploaded?: () => void
}

const MAX_SIZE = 10 * 1024 * 1024

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return "now"
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(dateStr).toLocaleDateString("en-US", { day: "numeric", month: "short" })
}

function getFileIcon(tipo: string) {
  if (tipo.startsWith("image/")) return ImageIcon
  if (tipo === "application/pdf") return FileText
  if (tipo.includes("spreadsheet") || tipo.includes("excel") || tipo === "text/csv") return FileSpreadsheet
  if (tipo.includes("word") || tipo.includes("document")) return FileType
  if (tipo.startsWith("video/")) return Film
  if (tipo.includes("zip")) return Archive
  return FileText
}

function isPreviewable(tipo: string): boolean {
  return tipo.startsWith("image/") || tipo === "application/pdf"
}

function parseScanResult(raw: string | ScanResultData | null): ScanResultData | null {
  if (!raw) return null
  if (typeof raw === "object") return raw
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

const DOC_TYPE_LABELS: Record<string, string> = {
  factura: "Invoice",
  contrato: "Contract",
  recibo: "Receipt",
  nota: "Nota",
  carta: "Letter",
  reporte: "Report",
  otro: "Other",
  desconocido: "Unknown",
}

function ScanStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
          <CheckCircle2 className="h-2.5 w-2.5" />
          Scanned
        </span>
      )
    case "processing":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-600">
          <Loader2 className="h-2.5 w-2.5 animate-spin" />
          Scanning
        </span>
      )
    case "error":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-600">
          <AlertCircle className="h-2.5 w-2.5" />
          Error
        </span>
      )
    case "pending":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600">
          <Clock className="h-2.5 w-2.5" />
          Pending
        </span>
      )
    default:
      return null
  }
}

function ScanResultPanel({
  attachment,
  onClose,
  onRescan,
}: {
  attachment: AttachmentData
  onClose: () => void
  onRescan: (id: string) => void
}) {
  const result = parseScanResult(attachment.scanResult)
  const [showOcr, setShowOcr] = useState(false)

  if (attachment.scanStatus === "processing") {
    return (
      <div className="rounded-xl border border-border bg-card p-5 animate-in slide-in-from-right-4 fade-in duration-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <ScanLine className="h-4 w-4 text-blue-500" />
            Scanning...
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-col items-center gap-3 py-8">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-sm text-muted-foreground text-center">
            Extracting text and analyzing with AI...
          </p>
        </div>
      </div>
    )
  }

  if (attachment.scanStatus === "error" || (result && result.error)) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 animate-in slide-in-from-right-4 fade-in duration-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
            Scan error
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {result?.error ?? "The file could not be scanned."}
        </p>
        <button
          onClick={() => onRescan(attachment.id)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          Retry
        </button>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 animate-in slide-in-from-right-4 fade-in duration-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <ScanLine className="h-4 w-4" />
            Smart scan
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">This file has not been scanned yet.</p>
        <button
          onClick={() => onRescan(attachment.id)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <ScanLine className="h-3 w-3" />
          Scan now
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 animate-in slide-in-from-right-4 fade-in duration-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <ScanLine className="h-4 w-4 text-emerald-500" />
          Smart scan
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onRescan(attachment.id)}
            className="text-muted-foreground hover:text-foreground"
            title="Scan again"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {/* Document type */}
        <div className="flex items-start gap-2.5">
          <FileText className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-[11px] text-muted-foreground mb-0.5">Document type</p>
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              {DOC_TYPE_LABELS[result.tipoDocumento] ?? result.tipoDocumento}
            </span>
          </div>
        </div>

        {/* Summary */}
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground mb-1 font-medium">Summary</p>
          <p className="text-sm text-foreground leading-relaxed">{result.resumen}</p>
        </div>

        {/* Detected fields */}
        <div className="grid grid-cols-1 gap-2">
          {result.fecha && (
            <div className="flex items-center gap-2.5 rounded-lg bg-background border border-border px-3 py-2">
              <Calendar className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground">Date</p>
                <p className="text-sm text-foreground font-medium">{result.fecha}</p>
              </div>
            </div>
          )}

          {result.total && (
            <div className="flex items-center gap-2.5 rounded-lg bg-background border border-border px-3 py-2">
              <DollarSign className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground">Total</p>
                <p className="text-sm text-foreground font-medium">{result.total}</p>
              </div>
            </div>
          )}

          {result.entidad && (
            <div className="flex items-center gap-2.5 rounded-lg bg-background border border-border px-3 py-2">
              <Building2 className="h-3.5 w-3.5 text-purple-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground">Entity</p>
                <p className="text-sm text-foreground font-medium truncate">{result.entidad}</p>
              </div>
            </div>
          )}

          {result.direccion && (
            <div className="flex items-center gap-2.5 rounded-lg bg-background border border-border px-3 py-2">
              <MapPin className="h-3.5 w-3.5 text-orange-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground">Address</p>
                <p className="text-sm text-foreground">{result.direccion}</p>
              </div>
            </div>
          )}
        </div>

        {/* Relevant numbers */}
        {result.numerosRelevantes && result.numerosRelevantes.length > 0 && (
          <div>
            <p className="text-[11px] text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <Hash className="h-3 w-3" />
              Relevant numbers
            </p>
            <div className="flex flex-wrap gap-1.5">
              {result.numerosRelevantes.map((num, i) => (
                <span key={i} className="rounded-md bg-muted px-2 py-0.5 text-xs text-foreground font-mono">
                  {num}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        {result.tags && result.tags.length > 0 && (
          <div>
            <p className="text-[11px] text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <Tag className="h-3 w-3" />
              Tags
            </p>
            <div className="flex flex-wrap gap-1.5">
              {result.tags.map((tag, i) => (
                <span key={i} className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[11px] font-medium text-blue-600">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* OCR text toggle */}
        {attachment.ocrText && (
          <div>
            <button
              onClick={() => setShowOcr(!showOcr)}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRight className={cn("h-3 w-3 transition-transform", showOcr && "rotate-90")} />
              {showOcr ? "Hide extracted text" : "View extracted text"}
            </button>
            {showOcr && (
              <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-muted/50 p-3 text-xs text-foreground font-mono whitespace-pre-wrap border border-border">
                {attachment.ocrText}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function UploadArea({ module, recordId, onUploaded }: UploadAreaProps) {
  const { canEdit } = useUser()
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewType, setPreviewType] = useState<string>("")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [scanPanelId, setScanPanelId] = useState<string | null>(null)
  const [scanningId, setScanningId] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: rawAttachments, refetch } = useFetch<AttachmentData[]>(
    `/api/attachments?module=${module}&recordId=${recordId}`,
    { refreshKey },
  )
  const attachments = Array.isArray(rawAttachments) ? rawAttachments : []

  // Poll for scan status on processing files
  useEffect(() => {
    const hasProcessing = attachments.some((a) => a.scanStatus === "processing")
    if (!hasProcessing) return

    const interval = setInterval(() => {
      setRefreshKey((k) => k + 1)
    }, 5000)

    return () => clearInterval(interval)
  }, [attachments])

  const uploadFile = useCallback(
    async (file: File) => {
      if (file.size > MAX_SIZE) {
        toast.error(`File is too large: ${formatSize(file.size)}. Max: 10MB`)
        return
      }

      setUploading(true)
      try {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("module", module)
        formData.append("recordId", recordId)

        const res = await fetch("/api/attachments", { method: "POST", body: formData })
        const json = await res.json()

        if (!json.success) throw new Error(json.error?.message ?? "Could not upload file")

        toast.success(`File uploaded: ${file.name}`)
        refetch()
        onUploaded?.()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not upload file")
      } finally {
        setUploading(false)
      }
    },
    [module, recordId, refetch, onUploaded],
  )

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return
      for (let i = 0; i < files.length; i++) {
        uploadFile(files[i])
      }
    },
    [uploadFile],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragActive(false)
      handleFiles(e.dataTransfer.files)
    },
    [handleFiles],
  )

  const handleDelete = useCallback(
    async (id: string) => {
      setDeletingId(id)
      try {
        const res = await fetch(`/api/attachments/${id}`, { method: "DELETE" })
        const json = await res.json()
        if (!json.success) throw new Error(json.error?.message ?? "Error")
        toast.success("File deleted")
        if (scanPanelId === id) setScanPanelId(null)
        refetch()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not delete file")
      } finally {
        setDeletingId(null)
      }
    },
    [refetch, scanPanelId],
  )

  const handleScan = useCallback(
    async (id: string) => {
      setScanningId(id)
      setScanPanelId(id)
      try {
        const res = await fetch(`/api/attachments/${id}/scan`, { method: "POST" })
        const json = await res.json()
        if (!json.success) throw new Error(json.error?.message ?? "Could not scan file")
        toast.success("Scan completed")
        refetch()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not scan file")
        refetch()
      } finally {
        setScanningId(null)
      }
    },
    [refetch],
  )

  const openPreview = useCallback((url: string, tipo: string) => {
    setPreviewUrl(url)
    setPreviewType(tipo)
  }, [])

  const scanPanelAttachment = scanPanelId
    ? attachments.find((a) => a.id === scanPanelId)
    : null

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Paperclip className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">Files</h2>
        {attachments.length > 0 && (
          <span className="text-xs text-muted-foreground">({attachments.length})</span>
        )}
      </div>

      <div className={cn("gap-4", scanPanelAttachment ? "grid grid-cols-1 lg:grid-cols-2" : "")}>
        {/* Main column */}
        <div>
          {/* Drop zone */}
          <CanEdit>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={cn(
                "relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 cursor-pointer transition-colors mb-4",
                dragActive
                  ? "border-blue-500 bg-blue-500/5"
                  : "border-border hover:border-muted-foreground/40 hover:bg-accent/30",
                uploading && "pointer-events-none opacity-60",
              )}
            >
              {uploading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                <Upload className="h-6 w-6 text-muted-foreground" />
              )}
              <p className="text-sm text-muted-foreground text-center">
                {uploading ? "Uploading..." : dragActive ? "Drop files here" : "Drag files here or click to upload"}
              </p>
              <p className="text-[11px] text-muted-foreground/60">Max 10MB · Automatic OCR for images and PDFs</p>
              <input
                ref={inputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>
          </CanEdit>

          {/* File list */}
          {attachments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No attachments yet.</p>
          ) : (
            <div className="space-y-1.5">
              {attachments.map((att) => {
                const Icon = getFileIcon(att.tipo)
                const canPreview = isPreviewable(att.tipo)
                const isScannable = att.scanStatus !== "not_applicable"
                const isActive = scanPanelId === att.id
                return (
                  <div
                    key={att.id}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border px-3 py-2.5 group transition-colors",
                      isActive
                        ? "border-primary/30 bg-primary/5"
                        : "border-border bg-background/50 hover:bg-accent/30",
                    )}
                  >
                    {att.tipo.startsWith("image/") ? (
                      <img
                        src={att.url}
                        alt={att.nombre}
                        className="h-9 w-9 rounded object-cover flex-shrink-0 cursor-pointer"
                        onClick={() => openPreview(att.url, att.tipo)}
                      />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded bg-muted flex-shrink-0">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{att.nombre}</p>
                        {isScannable && <ScanStatusBadge status={att.scanStatus} />}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {formatSize(att.tamano)} · {att.userName ?? "System"} · {timeAgo(att.createdAt)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      {isScannable && (
                        <button
                          onClick={() => {
                            if (att.scanStatus === "completed" || att.scanStatus === "error" || att.scanStatus === "pending") {
                              setScanPanelId(isActive ? null : att.id)
                            }
                            if (att.scanStatus === "pending") {
                              handleScan(att.id)
                            }
                          }}
                          disabled={scanningId === att.id}
                          className={cn(
                            "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                            att.scanStatus === "completed"
                              ? "text-emerald-500 hover:bg-emerald-500/10"
                              : "text-muted-foreground hover:bg-accent hover:text-foreground",
                          )}
                          title={att.scanStatus === "completed" ? "View scan" : "Scan"}
                        >
                          {scanningId === att.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ScanLine className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}
                      {canPreview && (
                        <button
                          onClick={() => openPreview(att.url, att.tipo)}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                          title="Preview"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <a
                        href={att.url}
                        download={att.nombre}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                        title="Download"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                      {canEdit && (
                        <button
                          onClick={() => handleDelete(att.id)}
                          disabled={deletingId === att.id}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                          title="Delete"
                        >
                          {deletingId === att.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Scan results panel */}
        {scanPanelAttachment && (
          <ScanResultPanel
            attachment={scanPanelAttachment}
            onClose={() => setScanPanelId(null)}
            onRescan={handleScan}
          />
        )}
      </div>

      {/* Preview modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setPreviewUrl(null)}
          />
          <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col rounded-xl bg-card border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200">
            <div className="flex items-center justify-between border-b border-border px-4 py-3 flex-shrink-0">
              <p className="text-sm font-medium text-foreground truncate">Preview</p>
              <div className="flex items-center gap-2">
                <a
                  href={previewUrl}
                  download
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <Download className="h-4 w-4" />
                </a>
                <button
                  onClick={() => setPreviewUrl(null)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-muted/30">
              {previewType.startsWith("image/") ? (
                <img src={previewUrl} alt="Preview" className="max-w-full max-h-[75vh] object-contain rounded" />
              ) : previewType === "application/pdf" ? (
                <iframe src={previewUrl} className="w-full h-[75vh] rounded border-0" title="PDF preview" />
              ) : null}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
