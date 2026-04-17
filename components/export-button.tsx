"use client"

import { useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import { Download, FileSpreadsheet, FileText, ChevronDown, Loader2 } from "lucide-react"
import { generateCSV, downloadCSV, type CSVColumn } from "@/lib/export/csv"

interface ExportButtonProps {
  data: Record<string, unknown>[]
  columns: CSVColumn[]
  filename: string
  className?: string
  /** Button label (defaults to Spanish for existing usages). */
  label?: string
}

export function ExportCSVButton({ data, columns, filename, className, label = "Exportar CSV" }: ExportButtonProps) {
  const [exporting, setExporting] = useState(false)

  const handleExport = useCallback(() => {
    setExporting(true)
    try {
      const csv = generateCSV(data, columns)
      downloadCSV(csv, filename)
    } finally {
      setTimeout(() => setExporting(false), 500)
    }
  }, [data, columns, filename])

  return (
    <button
      onClick={handleExport}
      disabled={exporting || data.length === 0}
      className={cn(
        "flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50",
        className,
      )}
    >
      {exporting ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <FileSpreadsheet className="h-3.5 w-3.5" />
      )}
      {label}
    </button>
  )
}

interface ExportMenuProps {
  onExportCSV?: () => void
  onExportPDF?: () => void
  className?: string
  disabled?: boolean
}

export function ExportMenu({ onExportCSV, onExportPDF, className, disabled }: ExportMenuProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={disabled}
        className={cn(
          "flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50",
          className,
        )}
      >
        <Download className="h-3.5 w-3.5" />
        Exportar
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-40 w-48 rounded-lg border border-border bg-card shadow-lg py-1 animate-in fade-in zoom-in-95 duration-100">
            {onExportCSV && (
              <button
                onClick={() => { onExportCSV(); setOpen(false) }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-foreground hover:bg-accent transition-colors"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />
                Exportar CSV
              </button>
            )}
            {onExportPDF && (
              <button
                onClick={() => { onExportPDF(); setOpen(false) }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-foreground hover:bg-accent transition-colors"
              >
                <FileText className="h-3.5 w-3.5 text-red-500" />
                Exportar PDF
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
