"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { cn } from "@/lib/utils"
import { X, Download, Loader2, Eye, Maximize2, Minimize2 } from "lucide-react"
import type { DocumentProps } from "@react-pdf/renderer"
import type { ReactElement } from "react"

type PDFDocument = ReactElement<DocumentProps>

const PDFDownloadLink = dynamic(
  () => import("@react-pdf/renderer").then((mod) => mod.PDFDownloadLink),
  { ssr: false },
)

const BlobProvider = dynamic(
  () => import("@react-pdf/renderer").then((mod) => mod.BlobProvider),
  { ssr: false },
)

interface PDFViewerModalProps {
  open: boolean
  onClose: () => void
  document: PDFDocument
  filename: string
  title?: string
}

export function PDFViewerModal({
  open,
  onClose,
  document,
  filename,
  title = "Vista previa PDF",
}: PDFViewerModalProps) {
  const [fullscreen, setFullscreen] = useState(false)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          "relative flex flex-col rounded-xl bg-card border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200",
          fullscreen ? "w-full h-full max-w-none max-h-none rounded-none" : "max-w-4xl w-full max-h-[90vh]",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3 flex-shrink-0">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <div className="flex items-center gap-2">
            <PDFDownloadLink document={document} fileName={filename}>
              {({ loading }) => (
                <button
                  disabled={loading}
                  className="flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-80 transition-opacity disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  Descargar PDF
                </button>
              )}
            </PDFDownloadLink>
            <button
              onClick={() => setFullscreen(!fullscreen)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="flex-1 overflow-auto bg-muted/30 flex items-start justify-center p-6">
          <BlobProvider document={document}>
            {({ url, loading, error }) => {
              if (loading) {
                return (
                  <div className="flex flex-col items-center gap-3 py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Generando vista previa...</p>
                  </div>
                )
              }
              if (error) {
                return (
                  <div className="flex flex-col items-center gap-3 py-20">
                    <p className="text-sm text-destructive">Error al generar PDF</p>
                    <p className="text-xs text-muted-foreground">{String(error)}</p>
                  </div>
                )
              }
              if (url) {
                return (
                  <iframe
                    src={url}
                    className="w-full rounded border-0"
                    style={{ height: fullscreen ? "calc(100vh - 60px)" : "75vh", maxWidth: 800 }}
                    title="PDF Preview"
                  />
                )
              }
              return null
            }}
          </BlobProvider>
        </div>
      </div>
    </div>
  )
}

interface PDFExportButtonProps {
  document: PDFDocument
  filename: string
  label?: string
  className?: string
  variant?: "default" | "primary"
}

export function PDFExportButton({
  document,
  filename,
  label = "Descargar PDF",
  className,
  variant = "default",
}: PDFExportButtonProps) {
  return (
    <PDFDownloadLink document={document} fileName={filename}>
      {({ loading }) => (
        <button
          disabled={loading}
          className={cn(
            "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-50",
            variant === "primary"
              ? "bg-foreground text-background hover:opacity-80"
              : "border border-border bg-card text-foreground hover:bg-accent",
            className,
          )}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {label}
        </button>
      )}
    </PDFDownloadLink>
  )
}

interface PDFPreviewButtonProps {
  document: PDFDocument
  filename: string
  title?: string
  label?: string
  className?: string
}

export function PDFPreviewButton({
  document,
  filename,
  title,
  label = "Vista previa",
  className,
}: PDFPreviewButtonProps) {
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
        <Eye className="h-3.5 w-3.5" />
        {label}
      </button>
      <PDFViewerModal
        open={open}
        onClose={() => setOpen(false)}
        document={document}
        filename={filename}
        title={title}
      />
    </>
  )
}
