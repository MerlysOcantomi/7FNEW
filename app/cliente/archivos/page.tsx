"use client"

import { useEffect, useState } from "react"
import { ClientPortalShell } from "@/components/client-portal-shell"
import { Files, FileText, Image, File, Download, Loader2 } from "lucide-react"

function getFileIcon(tipo: string) {
  if (tipo.startsWith("image")) return Image
  if (tipo.includes("pdf")) return FileText
  return File
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
}

export default function ClienteArchivosPage() {
  const [data, setData] = useState<{ documentos: any[]; attachments: any[] }>({ documentos: [], attachments: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/cliente/archivos")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const allFiles = [
    ...data.documentos.map((d) => ({ ...d, source: "documento" })),
    ...data.attachments.map((a) => ({ ...a, source: "attachment" })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return (
    <ClientPortalShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Mis Archivos</h1>
          <p className="text-sm text-gray-500">Documentos y archivos asociados a tu cuenta</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : allFiles.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white px-6 py-16 text-center">
            <Files className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm font-medium text-gray-900">No hay archivos</p>
            <p className="mt-1 text-xs text-gray-500">Aun no tienes documentos adjuntos</p>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="divide-y divide-gray-100">
              {allFiles.map((file: any) => {
                const Icon = getFileIcon(file.tipo)
                return (
                  <div
                    key={file.id}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 flex-shrink-0">
                      <Icon className="h-5 w-5 text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{file.nombre}</p>
                      <p className="text-xs text-gray-500">
                        {file.tipo}
                        {file.tamano ? ` · ${formatBytes(file.tamano)}` : ""}
                        {" · "}
                        {new Date(file.createdAt).toLocaleDateString("es")}
                      </p>
                    </div>
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-[#1a3a5c] transition-colors flex-shrink-0"
                    >
                      <Download className="h-4 w-4" />
                    </a>
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
