"use client"

import { useState, useEffect, useCallback } from "react"
import { AppShell } from "@/components/app-shell"
import { SectionPage } from "@/components/section-page"
import { cn } from "@/lib/utils"
import { Save, Plus, Trash2, Loader2, CheckCircle2 } from "lucide-react"
import type { ServiceCatalogItem } from "@core/services/catalog"

/**
 * Services — the generic (core) catalog surface. Visible text is Spanish; the
 * route and code stay English. Beauty only contributes the seed/labels via its
 * vertical pack; this page is the same for every vertical.
 *
 * Canonical source: `serviceCatalog` (structured). Saving here also refreshes
 * `businessProfile.services` (active names only) through the API bridge.
 */
export default function ServicesPage() {
  const [items, setItems] = useState<ServiceCatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newName, setNewName] = useState("")
  const [newCategory, setNewCategory] = useState("")

  const fetchCatalog = useCallback(async () => {
    try {
      const res = await fetch("/api/workspace/services")
      if (!res.ok) throw new Error("Failed to load catalog")
      const data = await res.json()
      setItems(Array.isArray(data.serviceCatalog) ? data.serviceCatalog : [])
    } catch {
      setError("No se pudo cargar el catálogo de servicios")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCatalog()
  }, [fetchCatalog])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch("/api/workspace/services", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceCatalog: items }),
      })
      if (!res.ok) throw new Error("Failed to save")
      const data = await res.json()
      if (Array.isArray(data.serviceCatalog)) setItems(data.serviceCatalog)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError("No se pudo guardar el catálogo")
    } finally {
      setSaving(false)
    }
  }

  const addService = () => {
    const name = newName.trim()
    if (!name) return
    const category = newCategory.trim()
    // Provisional client id; the API assigns the stable id on save.
    const provisionalId = `new-${items.length}-${name.toLowerCase().replace(/\s+/g, "-")}`
    setItems((prev) => [
      ...prev,
      { id: provisionalId, name, ...(category ? { category } : {}), active: true },
    ])
    setNewName("")
    setNewCategory("")
  }

  const updateItem = (id: string, patch: Partial<ServiceCatalogItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  }

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id))
  }

  const activeCount = items.filter((it) => it.active).length

  if (loading) {
    return (
      <AppShell>
        <SectionPage title="Servicios" description="Cargando…">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Cargando servicios…</span>
          </div>
        </SectionPage>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <SectionPage
        title="Servicios"
        description="El catálogo de lo que ofrece tu negocio. Tus agentes usan los servicios activos para entender qué vendes. Solo los servicios activos se comparten con ellos."
      >
        <div className="flex flex-col gap-6 max-w-2xl">
          {/* Add a service */}
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-medium text-foreground">Añadir servicio</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addService()
                  }
                }}
                placeholder="Nombre del servicio…"
                className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addService()
                  }
                }}
                placeholder="Categoría (opcional)"
                className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring sm:w-48"
              />
              <button
                type="button"
                onClick={addService}
                disabled={!newName.trim()}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="h-3.5 w-3.5" /> Añadir
              </button>
            </div>
          </div>

          {/* Catalog list */}
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no hay servicios. Añade el primero arriba.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {items.length} {items.length === 1 ? "servicio" : "servicios"} · {activeCount} activo
                  {activeCount === 1 ? "" : "s"}
                </p>
              </div>
              {items.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "flex flex-col gap-2 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center",
                    !item.active && "opacity-60",
                  )}
                >
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => updateItem(item.id, { name: e.target.value })}
                    className="flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-medium text-foreground focus:border-border focus:bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <input
                    type="text"
                    value={item.category ?? ""}
                    onChange={(e) => updateItem(item.id, { category: e.target.value })}
                    placeholder="Categoría"
                    className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-muted-foreground focus:border-border focus:bg-background focus:outline-none focus:ring-1 focus:ring-ring sm:w-40"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateItem(item.id, { active: !item.active })}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                        item.active
                          ? "bg-green-500/15 text-green-600 hover:bg-green-500/25 dark:text-green-400"
                          : "bg-muted text-muted-foreground hover:bg-accent",
                      )}
                      aria-pressed={item.active}
                    >
                      {item.active ? "Activo" : "Inactivo"}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="text-muted-foreground hover:text-red-500 transition-colors"
                      aria-label={`Eliminar ${item.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Save */}
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className={cn(
                "flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-colors",
                saving
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : "bg-foreground text-background hover:opacity-90",
              )}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Guardando…" : "Guardar servicios"}
            </button>
            {saved && (
              <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" /> Guardado
              </span>
            )}
            {error && <span className="text-sm text-red-500">{error}</span>}
          </div>
        </div>
      </SectionPage>
    </AppShell>
  )
}
