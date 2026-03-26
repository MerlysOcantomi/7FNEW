"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { X, Search, Loader2, Check, Link as LinkIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { apiFetch, apiPatch, displayLabel, estadoLabel } from "@/lib/api-client"
import { toast } from "sonner"

interface AssignModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  title: string
  module: string
  parentField: string
  parentId: string
  titleField?: string
  statusField?: string
  alreadyLinkedIds?: string[]
}

export function AssignModal({
  open,
  onClose,
  onSuccess,
  title,
  module,
  parentField,
  parentId,
  titleField = "nombre",
  statusField = "estado",
  alreadyLinkedIds = [],
}: AssignModalProps) {
  const [search, setSearch] = useState("")
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [assigning, setAssigning] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setSearch("")
      setRecords([])
      return
    }
    setLoading(true)
    apiFetch<any>(`/api/${module}`)
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : data?.data ?? []
        setRecords(list)
      })
      .catch(() => setRecords([]))
      .finally(() => setLoading(false))
  }, [open, module])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    const available = records.filter((r) => !alreadyLinkedIds.includes(r.id))
    if (!q) return available
    return available.filter((r) => {
      const name = String(r[titleField] ?? r.titulo ?? r.numero ?? r.id).toLowerCase()
      return name.includes(q)
    })
  }, [records, search, alreadyLinkedIds, titleField])

  const handleAssign = useCallback(
    async (recordId: string) => {
      setAssigning(recordId)
      try {
        await apiPatch(`/api/${module}/${recordId}`, { [parentField]: parentId })
        toast.success("Assigned successfully")
        onSuccess()
        onClose()
      } catch (err: any) {
        toast.error(err.message ?? "Could not assign record")
      } finally {
        setAssigning(null)
      }
    },
    [module, parentField, parentId, onSuccess, onClose]
  )

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-card shadow-xl mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <LinkIcon className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold">{title}</h2>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              autoFocus
              className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              {search ? "No results" : "No records available"}
            </p>
          ) : (
            <div className="space-y-1">
              {filtered.map((record) => {
                const name = record[titleField] ?? record.titulo ?? record.numero ?? record.id
                const status = record[statusField] ?? null
                const isAssigning = assigning === record.id
                return (
                  <button
                    key={record.id}
                    onClick={() => handleAssign(record.id)}
                    disabled={!!assigning}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                      isAssigning ? "bg-accent" : "hover:bg-accent/60"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{name}</p>
                      {status && (
                        <p className="text-xs text-muted-foreground mt-0.5">{displayLabel(status, estadoLabel)}</p>
                      )}
                    </div>
                    {isAssigning ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground flex-shrink-0" />
                    ) : (
                      <Check className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 flex-shrink-0" />
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-3">
          <p className="text-xs text-muted-foreground">
            {filtered.length} available
          </p>
        </div>
      </div>
    </div>
  )
}
