"use client"

import { useState, useCallback } from "react"
import { useFetch } from "@/hooks/use-fetch"
import { useUser } from "@/hooks/use-user"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  QrCode,
  Download,
  Trash2,
  Loader2,
  Link2,
  Copy,
  Clock,
} from "lucide-react"

interface QRCodeData {
  id: string
  url: string
  imageData: string
  label: string | null
  createdAt: string
}

interface SavedQRCodesProps {
  module: string
  recordId: string
  refreshKey?: number
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return "now"
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(dateStr).toLocaleDateString("en-US", { day: "numeric", month: "short" })
}

export function SavedQRCodes({ module, recordId, refreshKey }: SavedQRCodesProps) {
  const { canEdit } = useUser()
  const { data: rawQRCodes, refetch } = useFetch<QRCodeData[]>(
    `/api/qr/${module}/${recordId}`,
    { refreshKey },
  )
  const qrCodes = Array.isArray(rawQRCodes) ? rawQRCodes : []
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)

  const handleDelete = useCallback(
    async (id: string) => {
      setDeletingId(id)
      try {
        const res = await fetch(`/api/qr/delete/${id}`, { method: "DELETE" })
        const json = await res.json()
        if (!json.success) throw new Error(json.error?.message)
        toast.success("QR code deleted")
        refetch()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not delete QR code")
      } finally {
        setDeletingId(null)
      }
    },
    [refetch],
  )

  const downloadQR = useCallback((imageData: string, qrLabel: string | null) => {
    const link = document.createElement("a")
    link.href = imageData
    link.download = `qr-${qrLabel || module}-${recordId}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [module, recordId])

  const copyUrl = useCallback((url: string) => {
    navigator.clipboard.writeText(url)
    toast.success("URL copied")
  }, [])

  if (qrCodes.length === 0) return null

  const previewQR = previewId ? qrCodes.find((q) => q.id === previewId) : null

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <QrCode className="h-4 w-4 text-[#1a3a5c]" />
        <h2 className="text-sm font-semibold text-foreground">QR codes</h2>
        <span className="text-xs text-muted-foreground">({qrCodes.length})</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {qrCodes.map((qr) => (
          <div
            key={qr.id}
            className="group rounded-lg border border-border bg-background p-3 transition-all hover:shadow-sm hover:border-[#1a3a5c]/30"
          >
            <button
              onClick={() => setPreviewId(previewId === qr.id ? null : qr.id)}
              className="w-full"
            >
              <div className="flex justify-center mb-2">
                <img
                  src={qr.imageData}
                  alt={qr.label || "QR Code"}
                  className="h-20 w-20 rounded"
                />
              </div>
            </button>

            {qr.label && (
              <p className="text-xs font-medium text-foreground truncate text-center mb-1">
                {qr.label}
              </p>
            )}

            <p className="text-[10px] text-muted-foreground truncate text-center mb-2 flex items-center justify-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              {timeAgo(qr.createdAt)}
            </p>

            <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => downloadQR(qr.imageData, qr.label)}
                className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                title="Download"
              >
                <Download className="h-3 w-3" />
              </button>
              <button
                onClick={() => copyUrl(qr.url)}
                className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                title="Copy URL"
              >
                <Copy className="h-3 w-3" />
              </button>
              {canEdit && (
                <button
                  onClick={() => handleDelete(qr.id)}
                  disabled={deletingId === qr.id}
                  className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                  title="Delete"
                >
                  {deletingId === qr.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Preview modal */}
      {previewQR && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setPreviewId(null)}
          />
          <div className="relative rounded-xl bg-card border border-border shadow-2xl p-6 animate-in zoom-in-95 fade-in duration-200 max-w-sm w-full">
            <div className="flex justify-center mb-4">
              <div className="rounded-xl border-2 border-[#1a3a5c]/20 bg-white p-5 shadow-sm">
                <img src={previewQR.imageData} alt="QR" className="h-56 w-56" />
              </div>
            </div>

            {previewQR.label && (
              <p className="text-sm font-medium text-foreground text-center mb-1">
                {previewQR.label}
              </p>
            )}

            <p className="text-xs text-muted-foreground text-center truncate mb-4 flex items-center justify-center gap-1">
              <Link2 className="h-3 w-3" />
              {previewQR.url}
            </p>

            <div className="flex items-center gap-2">
              <button
                onClick={() => downloadQR(previewQR.imageData, previewQR.label)}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[#1a3a5c] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1a3a5c]/90 transition-colors"
              >
                <Download className="h-4 w-4" />
                Download
              </button>
              <button
                onClick={() => copyUrl(previewQR.url)}
                className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>

            <button
              onClick={() => setPreviewId(null)}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors mt-3"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
