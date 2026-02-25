"use client"

import { useEffect, useState } from "react"
import { ClientPortalShell } from "@/components/client-portal-shell"
import { useClientUser } from "@/hooks/use-client-user"
import { UserCircle, Save, Loader2, Check } from "lucide-react"

export default function ClientePerfilPage() {
  const { user } = useClientUser()
  const [perfil, setPerfil] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({ telefono: "", empresa: "", notas: "" })

  useEffect(() => {
    fetch("/api/cliente/perfil")
      .then((r) => r.json())
      .then((data) => {
        setPerfil(data)
        setForm({
          telefono: data.telefono || "",
          empresa: data.empresa || "",
          notas: data.notas || "",
        })
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch("/api/cliente/perfil", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch {
      // silently fail
    } finally {
      setSaving(false)
    }
  }

  return (
    <ClientPortalShell>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Mi Perfil</h1>
          <p className="text-sm text-muted-foreground">Informacion de tu cuenta</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !perfil ? (
          <p className="text-sm text-muted-foreground">Error al cargar perfil</p>
        ) : (
          <>
            {/* Profile header */}
            <div className="flex items-center gap-4 rounded-xl border border-border bg-card shadow-sm p-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground">
                {perfil.nombre?.charAt(0)?.toUpperCase() || "C"}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">{perfil.nombre}</h2>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                <span className={`mt-1 inline-block rounded-md px-2.5 py-0.5 text-xs font-medium ${
                  perfil.estado === "activo" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                }`}>
                  {perfil.estado}
                </span>
              </div>
            </div>

            {/* Stats */}
            <div className="grid gap-4 sm:grid-cols-4">
              <StatMini label="Proyectos" value={perfil._count?.proyectos ?? 0} />
              <StatMini label="Facturas" value={perfil._count?.facturas ?? 0} />
              <StatMini label="Tareas" value={perfil._count?.tareas ?? 0} />
              <StatMini label="Documentos" value={perfil._count?.documentos ?? 0} />
            </div>

            {/* Editable fields */}
            <div className="rounded-xl border border-border bg-card shadow-sm p-6 space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Informacion de contacto</h3>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Nombre</label>
                <input
                  type="text"
                  value={perfil.nombre}
                  disabled
                  className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground"
                />
                <p className="mt-1 text-xs text-muted-foreground">Contacta al administrador para cambiar tu nombre</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Telefono</label>
                <input
                  type="text"
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  className="w-full rounded-lg bg-muted/50 px-3 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-primary/20 focus:outline-none border border-border"
                  placeholder="+41 ..."
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Empresa</label>
                <input
                  type="text"
                  value={form.empresa}
                  onChange={(e) => setForm({ ...form, empresa: e.target.value })}
                  className="w-full rounded-lg bg-muted/50 px-3 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-primary/20 focus:outline-none border border-border"
                  placeholder="Nombre de empresa"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Notas</label>
                <textarea
                  value={form.notas}
                  onChange={(e) => setForm({ ...form, notas: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg bg-muted/50 px-3 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-primary/20 focus:outline-none border border-border resize-none"
                  placeholder="Notas adicionales..."
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm px-4 py-2.5 text-sm font-medium transition-opacity disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? "Guardando..." : "Guardar cambios"}
                </button>
                {saved && (
                  <span className="flex items-center gap-1 text-sm text-green-600">
                    <Check className="h-4 w-4" /> Guardado
                  </span>
                )}
              </div>
            </div>

            {/* Account info */}
            <div className="rounded-xl border border-border bg-card shadow-sm p-6">
              <h3 className="text-sm font-semibold text-foreground mb-3">Informacion de cuenta</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tipo</span>
                  <span className="text-foreground">{perfil.tipo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Miembro desde</span>
                  <span className="text-foreground">{new Date(perfil.createdAt).toLocaleDateString("es")}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </ClientPortalShell>
  )
}

function StatMini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm p-4 text-center">
      <p className="text-2xl font-semibold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
