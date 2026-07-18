"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { AppShell } from "@/components/app-shell"
import { SectionPage } from "@/components/section-page"
import { UserCircle, Mail, Building2, FolderKanban, ExternalLink, Pencil, Trash2, Plus } from "lucide-react"
import { UsuarioForm } from "@/components/forms/usuario-form"
import { ConfirmModal } from "@/components/confirm-modal"
import { useFetch } from "@/hooks/use-fetch"
import { apiDelete } from "@/lib/api-client"
import { useI18n } from "@/components/i18n-provider"
import { resolveStatusLabel } from "@core/i18n/ui"
import { toast } from "sonner"

export default function UsuariosPage() {
  const { t } = useI18n()
  const T = t.team
  const [formOpen, setFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [deleteItem, setDeleteItem] = useState<any>(null)
  const { data: apiResponse, loading, error, refetch } = useFetch<any>("/api/usuarios")
  const users = useMemo((): any[] | undefined => {
    if (apiResponse == null) return undefined
    if (Array.isArray(apiResponse)) return apiResponse
    return (apiResponse as any)?.data ?? []
  }, [apiResponse])

  const totalUsuarios = users?.length ?? 0
  const activos = users?.filter((u) => u.estado === "activo").length ?? 0
  const rolesUnicos = users ? new Set(users.map((u) => u.rol)).size : 0

  const roleLabel = (rol: string): string =>
    (T.roles as Record<string, string>)[rol] ?? rol

  async function handleDelete() {
    if (!deleteItem) return
    try {
      await apiDelete(`/api/usuarios/${deleteItem.id}`)
      toast.success(T.toasts.deleted)
      refetch()
    } catch (err: unknown) {
      toast.error(err instanceof Error && err.message ? err.message : T.toasts.deleteError)
    } finally {
      setDeleteItem(null)
    }
  }

  return (
    <AppShell
      currentSection="usuarios"
      breadcrumbs={[{ label: "7F" }, { label: T.title }]}
    >
      <SectionPage title={T.title} description={T.description}>
        <div className="flex items-center justify-end">
          <button
            onClick={() => { setEditingItem(null); setFormOpen(true) }}
            className="flex items-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-80"
          >
            <Plus className="h-3.5 w-3.5" />
            {T.newUser}
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{T.stats.total}</p>
            <p className="mt-1 text-2xl font-semibold text-card-foreground">{loading ? "—" : totalUsuarios}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{T.stats.active}</p>
            <p className="mt-1 text-2xl font-semibold text-card-foreground">{loading ? "—" : activos}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{T.stats.uniqueRoles}</p>
            <p className="mt-1 text-2xl font-semibold text-card-foreground">{loading ? "—" : rolesUnicos}</p>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-5 animate-pulse">
                <div className="flex items-start gap-4">
                  <div className="h-11 w-11 rounded-full bg-muted flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-20 bg-muted rounded" />
                    <div className="h-3 w-32 bg-muted rounded" />
                    <div className="h-3 w-40 bg-muted rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : !users?.length ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
            <UserCircle className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">{T.empty.title}</p>
            <p className="text-xs text-muted-foreground mt-1">{T.empty.body}</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {users.map((user) => (
              <div key={user.id} className="rounded-xl border border-border bg-card p-5 hover:shadow-sm transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted flex-shrink-0">
                    <UserCircle className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-foreground truncate">{user.nombre}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{roleLabel(user.rol ?? "")}</p>
                    <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      <span className="truncate">{user.email}</span>
                    </div>
                    <Link
                      href="/departamentos"
                      className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Building2 className="h-3 w-3" />
                      <span>{user.departamento ?? "—"}</span>
                      <ExternalLink className="h-2.5 w-2.5 ml-0.5" />
                    </Link>
                    <div className="flex items-center gap-3 mt-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${user.estado === "activo" ? "bg-[var(--tab-phases)] text-foreground/70" : "bg-muted text-muted-foreground"}`}>
                        {resolveStatusLabel(t.statuses, user.estado)}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <FolderKanban className="h-3 w-3" />
                        {T.card.projectsPlaceholder}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border">
                      <button
                        onClick={() => { setEditingItem(user); setFormOpen(true) }}
                        className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
                      >
                        <Pencil className="h-3 w-3" /> {t.common.edit}
                      </button>
                      <button
                        onClick={() => setDeleteItem(user)}
                        className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-accent transition-colors"
                      >
                        <Trash2 className="h-3 w-3" /> {t.common.delete}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <UsuarioForm
          open={formOpen}
          onClose={() => { setFormOpen(false); setEditingItem(null) }}
          onSuccess={refetch}
          data={editingItem}
        />
        <ConfirmModal
          open={!!deleteItem}
          title={T.deleteDialog.title}
          description={T.deleteDialog.description(deleteItem?.nombre ?? "")}
          confirmLabel={T.deleteDialog.confirm}
          variant="danger"
          onConfirm={handleDelete}
          onCancel={() => setDeleteItem(null)}
        />
      </SectionPage>
    </AppShell>
  )
}
