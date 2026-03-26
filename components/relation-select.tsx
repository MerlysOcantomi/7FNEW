"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { apiFetch, apiPatch, displayLabel, estadoLabel } from "@/lib/api-client"
import { CanEdit } from "@/components/role-gate"
import { toast } from "sonner"
import { Search, X, Loader2, ExternalLink, ChevronDown, Check } from "lucide-react"
import type { LucideIcon } from "lucide-react"

interface RelationSelectProps {
  label: string
  icon?: LucideIcon
  value: string | null
  field: string
  targetModule: string
  sourceModule: string
  sourceId: string
  displayField?: string
  statusField?: string
  currentDisplay?: string | null
  onSaved?: () => void
}

export function RelationSelect({
  label,
  icon: Icon,
  value,
  field,
  targetModule,
  sourceModule,
  sourceId,
  displayField = "nombre",
  statusField = "estado",
  currentDisplay,
  onSaved,
}: RelationSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    apiFetch<any>(`/api/${targetModule}`)
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : data?.data ?? []
        setRecords(list)
      })
      .catch(() => setRecords([]))
      .finally(() => setLoading(false))
  }, [open, targetModule])

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch("")
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return records
    return records.filter((r) => {
      const name = String(r[displayField] ?? r.titulo ?? r.numero ?? r.id).toLowerCase()
      return name.includes(q)
    })
  }, [records, search, displayField])

  const handleSelect = useCallback(
    async (recordId: string | null) => {
      setSaving(true)
      try {
        await apiPatch(`/api/${sourceModule}/${sourceId}`, { [field]: recordId })
        toast.success("Saved")
        onSaved?.()
      } catch (err: any) {
        toast.error(err.message ?? "Could not save")
      } finally {
        setSaving(false)
        setOpen(false)
        setSearch("")
      }
    },
    [sourceModule, sourceId, field, onSaved]
  )

  const selectedName = useMemo(() => {
    if (currentDisplay) return currentDisplay
    if (!value) return null
    const found = records.find((r) => r.id === value)
    return found ? (found[displayField] ?? found.titulo ?? found.numero ?? found.id) : null
  }, [value, currentDisplay, records, displayField])

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Read mode */}
      <div className="flex items-center gap-2">
        {value && selectedName ? (
          <div className="flex items-center gap-1.5">
            {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
            <Link
              href={`/${targetModule}/${value}`}
              className="text-sm text-foreground hover:underline"
            >
              {selectedName}
            </Link>
            <Link
              href={`/${targetModule}/${value}`}
              className="text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">No {label.toLowerCase()}</span>
        )}

        <CanEdit>
          <button
            onClick={() => setOpen(!open)}
            disabled={saving}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </CanEdit>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-72 rounded-xl border border-border bg-card shadow-lg overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}...`}
                className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {/* Options */}
          <div className="max-h-48 overflow-y-auto py-1">
            {/* None option */}
            <button
              onClick={() => handleSelect(null)}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent/60 transition-colors",
                !value && "bg-accent/40"
              )}
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">None</span>
              {!value && <Check className="h-3.5 w-3.5 ml-auto text-foreground" />}
            </button>

            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-3">No results</p>
            ) : (
              filtered.map((record) => {
                const name = record[displayField] ?? record.titulo ?? record.numero ?? record.id
                const status = record[statusField] ?? null
                const isSelected = record.id === value
                return (
                  <button
                    key={record.id}
                    onClick={() => handleSelect(record.id)}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent/60 transition-colors",
                      isSelected && "bg-accent/40"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground truncate">{name}</p>
                      {status && (
                        <p className="text-[10px] text-muted-foreground">{displayLabel(status, estadoLabel)}</p>
                      )}
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 text-foreground flex-shrink-0" />}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
