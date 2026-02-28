"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { ClientPortalShell } from "@/components/client-portal-shell"
import {
  Files,
  FileText,
  Image,
  File,
  Film,
  Download,
  Loader2,
  Upload,
  Search,
  X,
  Link2,
} from "lucide-react"

interface AssetItem {
  id: string
  filename: string
  mimeType: string
  sizeBytes: number
  url: string
  type: string
  createdAt: string
  source: "asset" | "documento"
}

const TYPE_FILTERS = [
  { key: "", label: "Todos" },
  { key: "DOCUMENT", label: "Documentos" },
  { key: "IMAGE", label: "Imagenes" },
  { key: "LOGO", label: "Logos" },
  { key: "VIDEO", label: "Videos" },
]

function getFileIcon(mimeType: string, type: string) {
  if (type === "VIDEO" || mimeType.startsWith("video")) return Film
  if (type === "IMAGE" || type === "LOGO" || mimeType.startsWith("image"))
    return Image
  if (mimeType.includes("pdf")) return FileText
  return File
}

function formatBytes(bytes: number) {
  if (!bytes || bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
}

function inferType(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "IMAGE"
  if (mimeType.startsWith("video/")) return "VIDEO"
  if (mimeType.includes("pdf") || mimeType.includes("document"))
    return "DOCUMENT"
  return "OTHER"
}

export default function ClienteArchivosPage() {
  const [assets, setAssets] = useState<AssetItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [typeFilter, setTypeFilter] = useState("")
  const [search, setSearch] = useState("")
  const [copied, setCopied] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadAssets = useCallback(() => {
    const params = new URLSearchParams()
    if (typeFilter) params.set("type", typeFilter)
    if (search.trim().length >= 2) params.set("q", search.trim())

    fetch(`/api/cliente/archivos?${params}`)
      .then((r) => r.json())
      .then((data) => {
        const fromAssets: AssetItem[] = (data.assets || []).map(
          (a: Record<string, unknown>) => ({
            ...a,
            source: "asset" as const,
          })
        )
        const fromDocs: AssetItem[] = (data.documentos || []).map(
          (d: Record<string, unknown>) => ({
            id: d.id,
            filename: d.nombre,
            mimeType: d.tipo,
            sizeBytes: d.tamano || 0,
            url: d.url,
            type: inferType(String(d.tipo || "")),
            createdAt: d.createdAt,
            source: "documento" as const,
          })
        )
        const merged = [...fromAssets, ...fromDocs].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )

        if (typeFilter && typeFilter !== "") {
          setAssets(merged.filter((f) => f.type === typeFilter))
        } else {
          setAssets(merged)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [typeFilter, search])

  useEffect(() => {
    const timer = setTimeout(loadAssets, search ? 300 : 0)
    return () => clearTimeout(timer)
  }, [loadAssets, search])

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const reader = new FileReader()
        const dataUrl = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string)
          reader.readAsDataURL(file)
        })

        await fetch("/api/cliente/archivos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            url: dataUrl,
            mimeType: file.type || "application/octet-stream",
            sizeBytes: file.size,
          }),
        })
      }
      loadAssets()
    } catch (error) {
      console.error("Upload error:", error)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  function copyLink(url: string, id: string) {
    navigator.clipboard.writeText(url).catch(console.error)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <ClientPortalShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              Mis Archivos
            </h1>
            <p className="text-sm text-gray-500">
              Documentos, imagenes y archivos de tu cuenta
            </p>
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-lg bg-[#111827] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1f2937] transition-colors disabled:opacity-50 w-full sm:w-auto justify-center"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {uploading ? "Subiendo..." : "Subir archivo"}
            </button>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar archivos..."
              className="w-full rounded-lg border border-gray-300 pl-9 pr-9 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap overflow-x-auto">
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.key || "all"}
                onClick={() => setTypeFilter(f.key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  typeFilter === f.key
                    ? "bg-[#1a3a5c] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-3 grid-cols-2 min-[480px]:grid-cols-4">
          <MiniStat
            label="Total"
            value={assets.length}
            icon={Files}
          />
          <MiniStat
            label="Documentos"
            value={assets.filter((a) => a.type === "DOCUMENT").length}
            icon={FileText}
          />
          <MiniStat
            label="Imagenes"
            value={
              assets.filter((a) => a.type === "IMAGE" || a.type === "LOGO")
                .length
            }
            icon={Image}
          />
          <MiniStat
            label="Videos"
            value={assets.filter((a) => a.type === "VIDEO").length}
            icon={Film}
          />
        </div>

        {/* File List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : assets.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white px-6 py-16 text-center">
            <Files className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm font-medium text-gray-900">
              {search || typeFilter
                ? "No se encontraron archivos"
                : "No tienes archivos"}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {search || typeFilter
                ? "Intenta con otro filtro o busqueda"
                : "Sube tu primer archivo usando el boton de arriba"}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="divide-y divide-gray-100">
              {assets.map((file) => {
                const Icon = getFileIcon(file.mimeType, file.type)
                const isImage =
                  file.type === "IMAGE" ||
                  file.type === "LOGO" ||
                  file.mimeType.startsWith("image")
                return (
                  <div
                    key={`${file.source}-${file.id}`}
                    className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 hover:bg-gray-50 transition-colors"
                  >
                    {/* Thumbnail or icon */}
                    {isImage && file.url ? (
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                        <img
                          src={file.url}
                          alt={file.filename}
                          className="h-10 w-10 object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 flex-shrink-0">
                        <Icon className="h-5 w-5 text-gray-500" />
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {file.filename}
                      </p>
                      <p className="text-xs text-gray-500">
                        <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase">
                          {file.type}
                        </span>
                        {file.sizeBytes > 0 && (
                          <span className="ml-2">
                            {formatBytes(file.sizeBytes)}
                          </span>
                        )}
                        <span className="ml-2">
                          {new Date(file.createdAt).toLocaleDateString("es")}
                        </span>
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => copyLink(file.url, file.id)}
                        title="Copiar enlace"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-[#1a3a5c] transition-colors"
                      >
                        <Link2
                          className={`h-4 w-4 ${
                            copied === file.id
                              ? "text-green-500"
                              : ""
                          }`}
                        />
                      </button>
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Descargar"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-[#1a3a5c] transition-colors"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </ClientPortalShell>
  )
}

function MiniStat({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-gray-400" />
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p className="mt-1 text-xl font-semibold text-gray-900">{value}</p>
    </div>
  )
}
