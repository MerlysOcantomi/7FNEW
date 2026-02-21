"use client"

import { useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  X,
  Download,
  Copy,
  Save,
  Loader2,
  QrCode,
  Link2,
  Zap,
  Database,
} from "lucide-react"

interface QRCodeModalProps {
  open: boolean
  onClose: () => void
  module: string
  recordId: string
  defaultUrl: string
  onSaved?: () => void
}

export function QRCodeModal({
  open,
  onClose,
  module,
  recordId,
  defaultUrl,
  onSaved,
}: QRCodeModalProps) {
  const [mode, setMode] = useState<"choose" | "fly" | "save">("choose")
  const [url, setUrl] = useState(defaultUrl)
  const [label, setLabel] = useState("")
  const [imageData, setImageData] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)

  const generateFly = useCallback(async () => {
    if (!url.trim()) { toast.error("Ingresa una URL"); return }
    setGenerating(true)
    try {
      const res = await fetch("/api/qr/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message)
      setImageData(json.data.imageData)
      setMode("fly")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al generar QR")
    } finally {
      setGenerating(false)
    }
  }, [url])

  const saveQR = useCallback(async () => {
    if (!url.trim()) { toast.error("Ingresa una URL"); return }
    setSaving(true)
    try {
      const res = await fetch("/api/qr/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, module, recordId, label: label || undefined }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message)
      setImageData(json.data.imageData)
      setMode("save")
      toast.success("QR guardado")
      onSaved?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar QR")
    } finally {
      setSaving(false)
    }
  }, [url, module, recordId, label, onSaved])

  const downloadQR = useCallback(() => {
    if (!imageData) return
    const link = document.createElement("a")
    link.href = imageData
    link.download = `qr-${module}-${recordId}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [imageData, module, recordId])

  const copyUrl = useCallback(() => {
    navigator.clipboard.writeText(url)
    toast.success("URL copiada")
  }, [url])

  const reset = useCallback(() => {
    setMode("choose")
    setImageData(null)
    setLabel("")
  }, [])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl bg-card border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <QrCode className="h-4 w-4 text-[#1a3a5c]" />
            Codigo QR
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          {/* Mode: Choose */}
          {mode === "choose" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">URL para el QR</label>
                <div className="relative">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={generateFly}
                  disabled={generating || !url.trim()}
                  className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border bg-background p-5 text-center transition-all hover:border-[#1a3a5c]/40 hover:bg-[#1a3a5c]/5 disabled:opacity-50"
                >
                  {generating ? (
                    <Loader2 className="h-6 w-6 animate-spin text-[#1a3a5c]" />
                  ) : (
                    <Zap className="h-6 w-6 text-[#1a3a5c]" />
                  )}
                  <span className="text-xs font-semibold text-foreground">QR rapido</span>
                  <span className="text-[10px] text-muted-foreground">Temporal, no se guarda</span>
                </button>

                <button
                  onClick={() => {
                    if (!url.trim()) { toast.error("Ingresa una URL"); return }
                    setMode("save")
                    setImageData(null)
                  }}
                  disabled={!url.trim()}
                  className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border bg-background p-5 text-center transition-all hover:border-[#1a3a5c]/40 hover:bg-[#1a3a5c]/5 disabled:opacity-50"
                >
                  <Database className="h-6 w-6 text-[#1a3a5c]" />
                  <span className="text-xs font-semibold text-foreground">QR permanente</span>
                  <span className="text-[10px] text-muted-foreground">Se guarda en el registro</span>
                </button>
              </div>
            </div>
          )}

          {/* Mode: Fly (generated) */}
          {mode === "fly" && imageData && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="rounded-xl border-2 border-[#1a3a5c]/20 bg-white p-4 shadow-sm">
                  <img src={imageData} alt="QR Code" className="h-48 w-48" />
                </div>
              </div>

              <p className="text-center text-xs text-muted-foreground truncate px-4">{url}</p>

              <div className="flex items-center gap-2">
                <button
                  onClick={downloadQR}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[#1a3a5c] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1a3a5c]/90 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  Descargar
                </button>
                <button
                  onClick={copyUrl}
                  className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors"
                >
                  <Copy className="h-4 w-4" />
                  Copiar URL
                </button>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-border">
                <button
                  onClick={reset}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  ← Volver
                </button>
                <button
                  onClick={() => { setMode("save"); setImageData(null) }}
                  className="ml-auto flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
                >
                  <Save className="h-3 w-3" />
                  Guardar este QR
                </button>
              </div>
            </div>
          )}

          {/* Mode: Save (form + result) */}
          {mode === "save" && !imageData && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">URL</label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Etiqueta (opcional)</label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Ej: Enlace de pago, perfil publico..."
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={saveQR}
                  disabled={saving || !url.trim()}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[#1a3a5c] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1a3a5c]/90 transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? "Guardando..." : "Generar y guardar"}
                </button>
                <button
                  onClick={reset}
                  className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Mode: Save (result) */}
          {mode === "save" && imageData && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="rounded-xl border-2 border-[#1a3a5c]/20 bg-white p-4 shadow-sm">
                  <img src={imageData} alt="QR Code" className="h-48 w-48" />
                </div>
              </div>

              <div className="text-center">
                <p className="text-xs font-medium text-emerald-600 flex items-center justify-center gap-1">
                  <Save className="h-3 w-3" />
                  QR guardado permanentemente
                </p>
                <p className="text-[11px] text-muted-foreground mt-1 truncate px-4">{url}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={downloadQR}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[#1a3a5c] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1a3a5c]/90 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  Descargar
                </button>
                <button
                  onClick={copyUrl}
                  className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>

              <button
                onClick={onClose}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors pt-2"
              >
                Cerrar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Trigger button ─── */

interface QRButtonProps {
  module: string
  recordId: string
  defaultUrl: string
  onSaved?: () => void
  className?: string
}

export function QRButton({ module, recordId, defaultUrl, onSaved, className }: QRButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-accent transition-colors",
          className,
        )}
      >
        <QrCode className="h-3.5 w-3.5" />
        QR
      </button>
      <QRCodeModal
        open={open}
        onClose={() => setOpen(false)}
        module={module}
        recordId={recordId}
        defaultUrl={defaultUrl}
        onSaved={onSaved}
      />
    </>
  )
}
