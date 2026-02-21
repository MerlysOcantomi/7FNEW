"use client"

import { useState, useMemo, useCallback } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { useFetch } from "@/hooks/use-fetch"
import { apiPatch, displayLabel, estadoLabel } from "@/lib/api-client"
import { CanEdit } from "@/components/role-gate"
import { DetailEmpty } from "@/components/detail-section"
import { AssignModal } from "@/components/assign-modal"
import { toast } from "sonner"
import { Plus, Link2, Unlink, Loader2 } from "lucide-react"
import type { LucideIcon } from "lucide-react"

interface FormComponentProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  data?: any
}

interface RelationListProps {
  title: string
  icon: LucideIcon
  module: string
  parentField: string
  parentId: string
  titleField?: string
  statusField?: string
  dateField?: string
  items?: any[]
  canCreate?: boolean
  canAssign?: boolean
  canUnlink?: boolean
  FormComponent?: React.ComponentType<FormComponentProps>
  formData?: Record<string, any>
  onRefresh?: () => void
  statusBadge?: (value: string) => string
  emptyMessage?: string
}

const DEFAULT_BADGE = "bg-muted text-muted-foreground"

function formatDateShort(value: string | null | undefined): string {
  if (!value) return ""
  try {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return ""
    return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" })
  } catch {
    return ""
  }
}

export function RelationList({
  title,
  icon: Icon,
  module,
  parentField,
  parentId,
  titleField = "nombre",
  statusField = "estado",
  dateField,
  items: externalItems,
  canCreate = true,
  canAssign = true,
  canUnlink = false,
  FormComponent,
  formData,
  onRefresh,
  statusBadge,
  emptyMessage,
}: RelationListProps) {
  const [formOpen, setFormOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [unlinking, setUnlinking] = useState<string | null>(null)

  const fetchUrl = externalItems ? null : `/api/${module}?${parentField}=${parentId}`
  const { data: fetchedRaw, refetch } = useFetch<any>(fetchUrl)

  const items = useMemo(() => {
    if (externalItems) return externalItems
    if (fetchedRaw == null) return []
    if (Array.isArray(fetchedRaw)) return fetchedRaw
    if (fetchedRaw.data && Array.isArray(fetchedRaw.data)) return fetchedRaw.data
    return []
  }, [externalItems, fetchedRaw])

  const linkedIds = useMemo(() => items.map((i: any) => i.id), [items])

  const refresh = useCallback(() => {
    refetch()
    onRefresh?.()
  }, [refetch, onRefresh])

  const handleUnlink = useCallback(
    async (recordId: string) => {
      setUnlinking(recordId)
      try {
        await apiPatch(`/api/${module}/${recordId}`, { [parentField]: null })
        toast.success("Desvinculado")
        refresh()
      } catch (err: any) {
        toast.error(err.message ?? "Error al desvincular")
      } finally {
        setUnlinking(null)
      }
    },
    [module, parentField, refresh]
  )

  const getBadgeClass = (value: string) => statusBadge?.(value) ?? DEFAULT_BADGE

  return (
    <>
      <section className="rounded-xl border border-border bg-card p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">{title}</h2>
            <span className="text-sm text-muted-foreground">({items.length})</span>
          </div>
          <CanEdit>
            <div className="flex items-center gap-2">
              {canAssign && (
                <button
                  onClick={() => setAssignOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
                >
                  <Link2 className="h-3.5 w-3.5" /> Asignar
                </button>
              )}
              {canCreate && FormComponent && (
                <button
                  onClick={() => setFormOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" /> Crear
                </button>
              )}
            </div>
          </CanEdit>
        </div>

        {items.length === 0 ? (
          <DetailEmpty message={emptyMessage ?? `No hay ${title.toLowerCase()} vinculados.`} />
        ) : (
          <div className="space-y-1.5">
            {items.map((item: any) => {
              const name = item[titleField] ?? item.titulo ?? item.numero ?? item.id
              const status = item[statusField] ?? null
              const date = dateField ? item[dateField] : null
              const isUnlinking = unlinking === item.id

              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-background/50 px-4 py-3 hover:bg-accent/30 transition-colors group"
                >
                  <Link
                    href={`/${module}/${item.id}`}
                    className="min-w-0 flex-1 text-sm font-medium text-foreground hover:underline truncate"
                  >
                    {name}
                  </Link>
                  {status && (
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", getBadgeClass(status))}>
                      {displayLabel(status, estadoLabel)}
                    </span>
                  )}
                  {date && (
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDateShort(date)}</span>
                  )}
                  {canUnlink && (
                    <CanEdit>
                      <button
                        onClick={() => handleUnlink(item.id)}
                        disabled={isUnlinking}
                        className="opacity-0 group-hover:opacity-100 rounded-md p-1 text-muted-foreground hover:text-destructive transition-all"
                        title="Desvincular"
                      >
                        {isUnlinking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlink className="h-3.5 w-3.5" />}
                      </button>
                    </CanEdit>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {FormComponent && (
        <FormComponent
          open={formOpen}
          onClose={() => setFormOpen(false)}
          onSuccess={refresh}
          data={{ [parentField]: parentId, ...formData }}
        />
      )}

      <AssignModal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        onSuccess={refresh}
        title={`Asignar ${title.toLowerCase()}`}
        module={module}
        parentField={parentField}
        parentId={parentId}
        titleField={titleField}
        statusField={statusField}
        alreadyLinkedIds={linkedIds}
      />
    </>
  )
}
