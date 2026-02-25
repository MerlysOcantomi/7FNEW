"use client"

import { useState } from "react"
import Link from "next/link"
import { AppShell } from "@/components/app-shell"
import { SectionPage } from "@/components/section-page"
import { Users, Mail, Building, Pencil, Trash2, Plus } from "lucide-react"
import { ClienteForm } from "@/components/forms/cliente-form"
import { ConfirmModal } from "@/components/confirm-modal"
import { useFetch } from "@/hooks/use-fetch"
import { apiDelete, displayLabel, estadoLabel } from "@/lib/api-client"
import { toast } from "sonner"
import { CanEdit, CanDelete } from "@/components/role-gate"
import { ExportCSVButton } from "@/components/export-button"
import { CLIENTE_COLUMNS } from "@/lib/export/csv"

export default function ClientesPage() {
  const [search, setSearch] = useState("")
  const [filterEstado, setFilterEstado] = useState<string>("")
  const params = new URLSearchParams()
  if (filterEstado) params.set("estado", filterEstado)
  if (search.trim()) params.set("search", search.trim())
  const query = params.toString()
  const url = `/api/clientes${query ? `?${query}` : ""}`
  const { data, loading, error, refetch } = useFetch<any>(url)
  const clientes = Array.isArray(data) ? data : []

  const [formOpen, setFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [deleteItem, setDeleteItem] = useState<any>(null)

  async function handleDelete() {
    if (!deleteItem) return
    try {
      await apiDelete(`/api/clientes/${deleteItem.id}`)
      toast.success("Cliente eliminado")
      refetch()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar")
    } finally {
      setDeleteItem(null)
    }
  }

  const total = Array.isArray(clientes) ? clientes.length : 0
  const activos = Array.isArray(clientes) ? clientes.filter((c: any) => c.estado === "activo").length : 0
  const prospectos = Array.isArray(clientes) ? clientes.filter((c: any) => c.estado === "prospecto").length : 0

  return (
    <AppShell
      currentSection="clientes"
      breadcrumbs={[{ label: "7F" }, { label: "Clientes" }]}
    >
      <SectionPage
        title="Clientes"
        description="Gestiona tu cartera de clientes, contactos y relaciones comerciales."
      >
        {/* Summary */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total clientes</p>
                <p className="mt-1 text-2xl font-semibold text-card-foreground">{loading ? "—" : total}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20">
                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Activos</p>
                <p className="mt-1 text-2xl font-semibold text-card-foreground">{loading ? "—" : activos}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 dark:bg-green-900/20">
                <Building className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Prospectos</p>
                <p className="mt-1 text-2xl font-semibold text-card-foreground">{loading ? "—" : prospectos}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-900/20">
                <Mail className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <div className="relative flex-1 max-w-sm">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar clientes..."
              className="w-full rounded-lg bg-muted/50 border border-border py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <CanEdit>
            <button
              onClick={() => { setEditingItem(null); setFormOpen(true) }}
              className="flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:bg-primary/90 shadow-sm whitespace-nowrap flex-shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              Nuevo cliente
            </button>
          </CanEdit>
          <ExportCSVButton
            data={clientes}
            columns={CLIENTE_COLUMNS}
            filename={`clientes-${new Date().toISOString().slice(0, 10)}`}
          />
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Estado:</span>
            {["", "activo", "inactivo", "prospecto"].map((estado) => (
              <button
                key={estado || "all"}
                onClick={() => setFilterEstado(estado)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  filterEstado === estado
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {estado ? displayLabel(estado, estadoLabel) : "Todos"}
              </button>
            ))}
          </div>
        </div>

        {/* Client list */}
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="flex items-center gap-2 border-b border-border px-5 py-4">
            <Users className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Directorio de Clientes</h2>
          </div>

          {loading ? (
            <div className="px-5 py-12 text-center text-sm text-muted-foreground">
              Cargando...
            </div>
          ) : error ? (
            <div className="px-5 py-12 text-center text-sm text-destructive">
              {error}
            </div>
          ) : !Array.isArray(clientes) || clientes.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-muted-foreground">
              No hay clientes registrados
            </div>
          ) : (
            <>
              {/* Table for desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Empresa</th>
                      <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Contacto</th>
                      <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Email</th>
                      <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Proyectos</th>
                      <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Estado</th>
                      <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {clientes.map((c: any) => (
                      <tr key={c.id} className="hover:bg-muted/40 transition-colors group">
                        <td className="px-5 py-4">
                          <Link href={`/clientes/${c.id}`} className="flex items-center gap-3 text-primary hover:text-primary/80">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                              <Building className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <span className="text-sm font-medium group-hover:text-primary">{c.nombre}</span>
                          </Link>
                        </td>
                        <td className="px-5 py-4 text-sm text-foreground">{c.empresa ?? "—"}</td>
                        <td className="px-5 py-4 text-sm text-muted-foreground">{c.email ?? "—"}</td>
                        <td className="px-5 py-4 text-sm text-foreground">{c.proyectos?.length ?? 0}</td>
                        <td className="px-5 py-4">
                          <span className={`rounded-md px-2.5 py-0.5 text-xs font-medium ${
                            c.estado === "activo" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" :
                            c.estado === "prospecto" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" :
                            "bg-muted text-muted-foreground"
                          }`}>
                            {displayLabel(c.estado ?? "", estadoLabel)}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1">
                            <CanEdit>
                              <button
                                onClick={(e) => { e.preventDefault(); setEditingItem(c); setFormOpen(true) }}
                                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-primary/10 transition-colors"
                                aria-label="Editar"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            </CanEdit>
                            <CanDelete>
                              <button
                                onClick={(e) => { e.preventDefault(); setDeleteItem(c) }}
                                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-destructive transition-colors"
                                aria-label="Eliminar"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </CanDelete>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Cards for mobile */}
              <div className="flex flex-col divide-y divide-border md:hidden">
                {clientes.map((c: any) => (
                  <div key={c.id} className="p-4 flex flex-col gap-2 hover:bg-muted/40 transition-colors group">
                    <Link href={`/clientes/${c.id}`} className="flex flex-col gap-2 text-primary hover:text-primary/80">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted flex-shrink-0">
                          <Building className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground group-hover:text-primary">{c.nombre}</p>
                          <p className="text-xs text-muted-foreground">{c.empresa ?? "—"}</p>
                        </div>
                        <span className={`ml-auto rounded-md px-2.5 py-0.5 text-xs font-medium flex-shrink-0 ${
                          c.estado === "activo" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" :
                          c.estado === "prospecto" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {displayLabel(c.estado ?? "", estadoLabel)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 ml-12 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {c.email ?? "—"}</span>
                        <span>{c.proyectos?.length ?? 0} proyectos</span>
                      </div>
                    </Link>
                    <div className="flex items-center gap-1 ml-12">
                      <CanEdit>
                        <button
                          onClick={(e) => { e.preventDefault(); setEditingItem(c); setFormOpen(true) }}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-primary/10 transition-colors"
                          aria-label="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </CanEdit>
                      <CanDelete>
                        <button
                          onClick={(e) => { e.preventDefault(); setDeleteItem(c) }}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-destructive transition-colors"
                                aria-label="Eliminar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </CanDelete>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <ClienteForm
          open={formOpen}
          onClose={() => { setFormOpen(false); setEditingItem(null) }}
          onSuccess={refetch}
          data={editingItem}
        />
        <ConfirmModal
          open={!!deleteItem}
          title="Eliminar cliente"
          description={`¿Seguro que quieres eliminar "${deleteItem?.nombre}"? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          variant="danger"
          onConfirm={handleDelete}
          onCancel={() => setDeleteItem(null)}
        />
      </SectionPage>
    </AppShell>
  )
}
