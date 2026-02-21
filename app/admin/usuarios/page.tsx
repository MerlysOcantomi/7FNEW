"use client"

import { useState, useEffect } from "react"
import { AppShell } from "@/components/app-shell"
import { SectionPage } from "@/components/section-page"
import { cn } from "@/lib/utils"
import { useFetch } from "@/hooks/use-fetch"
import { RoleGate } from "@/components/role-gate"
import {
  Shield,
  UserPlus,
  Trash2,
  Edit3,
  Check,
  X,
  Loader2,
  Mail,
  Clock,
  AlertTriangle,
} from "lucide-react"

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  editor: "Editor",
  viewer: "Solo lectura",
}

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-500/10 text-red-600",
  editor: "bg-blue-500/10 text-blue-600",
  viewer: "bg-gray-500/10 text-gray-600",
}

export default function AdminUsuariosPage() {
  const { data: usersData, loading: usersLoading, refetch: refetchUsers } = useFetch<any>("/api/admin/users")
  const { data: emailsData, loading: emailsLoading, refetch: refetchEmails } = useFetch<any>("/api/admin/allowed-emails")
  const users = Array.isArray(usersData) ? usersData : []
  const allowedEmails = Array.isArray(emailsData) ? emailsData : []

  const [activeTab, setActiveTab] = useState<"users" | "whitelist">("users")
  const [showAddForm, setShowAddForm] = useState(false)
  const [newEmail, setNewEmail] = useState("")
  const [newRole, setNewRole] = useState("viewer")
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState("")

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRole, setEditRole] = useState("")
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionError, setActionError] = useState("")

  async function handleAddEmail() {
    if (!newEmail.trim()) return
    setAddLoading(true)
    setAddError("")
    try {
      const res = await fetch("/api/admin/allowed-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail.trim(), role: newRole }),
      })
      const json = await res.json()
      if (!json.success) {
        setAddError(json.error?.message ?? "Error")
        return
      }
      setNewEmail("")
      setNewRole("viewer")
      setShowAddForm(false)
      refetchEmails()
    } catch {
      setAddError("Error de conexion")
    } finally {
      setAddLoading(false)
    }
  }

  async function handleUpdateRole(type: "user" | "email", id: string, role: string) {
    setActionLoading(id)
    setActionError("")
    try {
      if (type === "user") {
        const res = await fetch("/api/admin/users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: id, role }),
        })
        const json = await res.json()
        if (!json.success) { setActionError(json.error?.message ?? "Error"); return }
        refetchUsers()
        refetchEmails()
      } else {
        const res = await fetch(`/api/admin/allowed-emails/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role }),
        })
        const json = await res.json()
        if (!json.success) { setActionError(json.error?.message ?? "Error"); return }
        refetchEmails()
        refetchUsers()
      }
      setEditingId(null)
    } catch {
      setActionError("Error de conexion")
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDeleteUser(userId: string) {
    if (!confirm("¿Seguro que deseas eliminar este usuario y revocar su acceso?")) return
    setActionLoading(userId)
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      })
      const json = await res.json()
      if (!json.success) { setActionError(json.error?.message ?? "Error"); return }
      refetchUsers()
      refetchEmails()
    } catch {
      setActionError("Error de conexion")
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDeleteEmail(id: string) {
    if (!confirm("¿Seguro que deseas eliminar este correo de la lista blanca?")) return
    setActionLoading(id)
    try {
      const res = await fetch(`/api/admin/allowed-emails/${id}`, { method: "DELETE" })
      const json = await res.json()
      if (!json.success) { setActionError(json.error?.message ?? "Error"); return }
      refetchEmails()
    } catch {
      setActionError("Error de conexion")
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <AppShell currentSection="admin" breadcrumbs={[{ label: "7F" }, { label: "Admin" }, { label: "Usuarios" }]}>
      <SectionPage title="Administracion de Usuarios" description="Gestiona correos autorizados, roles y accesos. Solo la administradora puede modificar permisos.">
        <RoleGate requiredRole="admin">

        {/* Tabs */}
        <div className="flex items-center gap-1.5">
          {([["users", "Usuarios activos"], ["whitelist", "Lista blanca"]] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                activeTab === id ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Error banner */}
        {actionError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
            <p className="text-xs text-destructive">{actionError}</p>
            <button onClick={() => setActionError("")} className="ml-auto text-destructive hover:text-destructive/80">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* ── Users Tab ── */}
        {activeTab === "users" && (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-2xl font-semibold text-foreground">{users.length}</p>
                  <p className="text-xs text-muted-foreground">Usuarios registrados</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">{users.filter((u: any) => u.role === "admin").length}</p>
                  <p className="text-xs text-muted-foreground">Administradores</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">{users.filter((u: any) => u.role === "editor").length}</p>
                  <p className="text-xs text-muted-foreground">Editores</p>
                </div>
              </div>
            </div>

            {usersLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : users.length === 0 ? (
              <div className="rounded-xl border border-border bg-card px-5 py-12 text-center">
                <p className="text-sm text-muted-foreground">No hay usuarios registrados aun</p>
              </div>
            ) : (
              users.map((user: any) => (
                <div key={user.id} className="rounded-xl border border-border bg-card px-5 py-4">
                  <div className="flex items-center gap-4">
                    {user.avatar ? (
                      <img src={user.avatar} alt="" className="h-10 w-10 rounded-full flex-shrink-0" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted flex-shrink-0">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{user.nombre ?? user.email}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>

                    {editingId === user.id ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value)}
                          className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                        >
                          <option value="admin">Administrador</option>
                          <option value="editor">Editor</option>
                          <option value="viewer">Solo lectura</option>
                        </select>
                        <button
                          onClick={() => handleUpdateRole("user", user.id, editRole)}
                          disabled={actionLoading === user.id}
                          className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-background hover:opacity-80"
                        >
                          {actionLoading === user.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        </button>
                        <button onClick={() => setEditingId(null)} className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-medium", ROLE_COLORS[user.role] ?? ROLE_COLORS.viewer)}>
                          {ROLE_LABELS[user.role] ?? user.role}
                        </span>
                        <button
                          onClick={() => { setEditingId(user.id); setEditRole(user.role) }}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                          title="Cambiar rol"
                        >
                          <Edit3 className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          disabled={actionLoading === user.id}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          title="Bloquear acceso"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                  {user.lastLogin && (
                    <div className="flex items-center gap-1 mt-2 ml-14 text-[10px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>Ultimo acceso: {new Date(user.lastLogin).toLocaleString("es")}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Whitelist Tab ── */}
        {activeTab === "whitelist" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="rounded-xl border border-border bg-card p-4 flex-1">
                <p className="text-2xl font-semibold text-foreground">{allowedEmails.length}</p>
                <p className="text-xs text-muted-foreground">Correos autorizados</p>
              </div>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="ml-3 flex items-center gap-1.5 rounded-lg bg-foreground px-3.5 py-2 text-xs font-medium text-background transition-opacity hover:opacity-80"
              >
                <UserPlus className="h-3.5 w-3.5" /> Agregar correo
              </button>
            </div>

            {/* Add form */}
            {showAddForm && (
              <div className="rounded-xl border border-border bg-card p-5">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Agregar correo permitido</p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="correo@ejemplo.com"
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                  >
                    <option value="viewer">Solo lectura</option>
                    <option value="editor">Editor</option>
                    <option value="admin">Administrador</option>
                  </select>
                  <button
                    onClick={handleAddEmail}
                    disabled={addLoading || !newEmail.trim()}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium transition-all",
                      addLoading || !newEmail.trim()
                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                        : "bg-foreground text-background hover:opacity-80"
                    )}
                  >
                    {addLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
                    Agregar
                  </button>
                </div>
                {addError && <p className="mt-2 text-xs text-destructive">{addError}</p>}
              </div>
            )}

            {emailsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : allowedEmails.length === 0 ? (
              <div className="rounded-xl border border-border bg-card px-5 py-12 text-center">
                <Shield className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No hay correos en la lista blanca</p>
                <p className="text-xs text-muted-foreground mt-1">Agrega correos para permitir el acceso</p>
              </div>
            ) : (
              allowedEmails.map((entry: any) => (
                <div key={entry.id} className="rounded-xl border border-border bg-card px-5 py-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted flex-shrink-0">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{entry.email}</p>
                      <p className="text-[10px] text-muted-foreground">Agregado: {new Date(entry.createdAt).toLocaleDateString("es")}</p>
                    </div>

                    {editingId === entry.id ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value)}
                          className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                        >
                          <option value="admin">Administrador</option>
                          <option value="editor">Editor</option>
                          <option value="viewer">Solo lectura</option>
                        </select>
                        <button
                          onClick={() => handleUpdateRole("email", entry.id, editRole)}
                          disabled={actionLoading === entry.id}
                          className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-background hover:opacity-80"
                        >
                          {actionLoading === entry.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        </button>
                        <button onClick={() => setEditingId(null)} className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-medium", ROLE_COLORS[entry.role] ?? ROLE_COLORS.viewer)}>
                          {ROLE_LABELS[entry.role] ?? entry.role}
                        </span>
                        <button
                          onClick={() => { setEditingId(entry.id); setEditRole(entry.role) }}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                          title="Editar rol"
                        >
                          <Edit3 className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteEmail(entry.id)}
                          disabled={actionLoading === entry.id}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          title="Eliminar"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
        </RoleGate>
      </SectionPage>
    </AppShell>
  )
}
