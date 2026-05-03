"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Check, Loader2, Trash2, X, UserPlus, Edit3 } from "lucide-react"
import type { SystemAllowedEmailSummary } from "@core/system/allowed-emails"

/**
 * Client component that renders the allowed-emails table + create form.
 *
 * Mutations call `/api/system/allowed-emails` directly and, on success, run
 * `router.refresh()` so the parent server component re-fetches via
 * `listAllowedEmails()`. This keeps the server as the single source of
 * truth — we never maintain a parallel client cache that could drift.
 *
 * `canMutate` is forwarded from the page (`platformRole >= ADMIN`). When
 * false, the form and per-row buttons are disabled with a tooltip; even if
 * a user bypasses the disabled state, the API still enforces the same rule.
 */

const ALLOWED_ROLES = ["admin", "editor", "viewer"] as const
type AllowedRole = (typeof ALLOWED_ROLES)[number]

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  editor: "Editor",
  viewer: "Solo lectura",
}

interface Props {
  initial: SystemAllowedEmailSummary[]
  canMutate: boolean
}

export function AllowedEmailsManager({ initial, canMutate }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Create form state
  const [newEmail, setNewEmail] = useState("")
  const [newRole, setNewRole] = useState<AllowedRole>("viewer")

  // Per-row edit state. We track only one row at a time — keeps the UI
  // simple and avoids a confusing "multiple half-edited rows" scenario.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingRole, setEditingRole] = useState<AllowedRole>("viewer")

  // Async UX state
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  /**
   * Refresh helper. Wrapped in `startTransition` so the spinner state on the
   * row stays steady while React re-renders the server component above us.
   */
  function refresh() {
    startTransition(() => router.refresh())
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!canMutate) return
    if (!newEmail.trim()) return
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch("/api/system/allowed-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail.trim(), role: newRole }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setError(json?.error?.message ?? "No se pudo crear el email")
        return
      }
      setNewEmail("")
      setNewRole("viewer")
      refresh()
    } catch {
      setError("Error de conexión")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUpdateRole(id: string) {
    if (!canMutate) return
    setError(null)
    setActionLoadingId(id)
    try {
      const res = await fetch(`/api/system/allowed-emails/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: editingRole }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setError(json?.error?.message ?? "No se pudo actualizar el rol")
        return
      }
      setEditingId(null)
      refresh()
    } catch {
      setError("Error de conexión")
    } finally {
      setActionLoadingId(null)
    }
  }

  async function handleDelete(id: string, email: string) {
    if (!canMutate) return
    if (!confirm(`¿Eliminar ${email} de la allowlist?`)) return
    setError(null)
    setActionLoadingId(id)
    try {
      const res = await fetch(`/api/system/allowed-emails/${id}`, {
        method: "DELETE",
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setError(json?.error?.message ?? "No se pudo eliminar el email")
        return
      }
      refresh()
    } catch {
      setError("Error de conexión")
    } finally {
      setActionLoadingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <div className="flex items-center gap-2 rounded-md border border-red-300/70 bg-red-50/80 px-3 py-2 text-xs text-red-800 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
          <AlertTriangle size={14} className="shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-700/80 hover:text-red-900 dark:text-red-200/70 dark:hover:text-red-100"
            aria-label="Cerrar"
          >
            <X size={12} />
          </button>
        </div>
      ) : null}

      {/* Create form */}
      <form
        onSubmit={handleCreate}
        className="flex flex-col gap-2 rounded-lg border border-amber-200/60 bg-white/70 p-3 sm:flex-row sm:items-end dark:border-amber-900/30 dark:bg-amber-950/10"
      >
        <div className="flex flex-1 flex-col gap-1">
          <label
            htmlFor="ae-email"
            className="text-[10px] font-semibold uppercase tracking-wide text-amber-900/70 dark:text-amber-100/60"
          >
            Email
          </label>
          <input
            id="ae-email"
            type="email"
            placeholder="alice@example.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            disabled={!canMutate || submitting}
            className="rounded-md border border-amber-300/70 bg-white px-2.5 py-1.5 text-sm text-amber-950 outline-none placeholder:text-amber-900/30 focus:border-amber-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-50"
          />
        </div>
        <div className="flex flex-col gap-1 sm:w-44">
          <label
            htmlFor="ae-role"
            className="text-[10px] font-semibold uppercase tracking-wide text-amber-900/70 dark:text-amber-100/60"
          >
            Rol
          </label>
          <select
            id="ae-role"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as AllowedRole)}
            disabled={!canMutate || submitting}
            className="rounded-md border border-amber-300/70 bg-white px-2.5 py-1.5 text-sm text-amber-950 outline-none focus:border-amber-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-50"
          >
            {ALLOWED_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={!canMutate || submitting || !newEmail.trim()}
          title={!canMutate ? "Requiere rol ADMIN o superior" : undefined}
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-amber-500 dark:hover:bg-amber-400"
        >
          {submitting ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />}
          <span>Añadir</span>
        </button>
      </form>

      {/* List */}
      <section className="overflow-hidden rounded-lg border border-amber-200/60 bg-white/60 dark:border-amber-900/30 dark:bg-amber-950/10">
        <div className="flex items-center justify-between px-3 py-2 text-[11px] uppercase tracking-wide text-amber-900/60 dark:text-amber-100/50">
          <span>{initial.length} emails</span>
          {isPending ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 size={10} className="animate-spin" />
              Actualizando…
            </span>
          ) : null}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-amber-100/60 text-left text-[11px] font-semibold uppercase tracking-wide text-amber-900/80 dark:bg-amber-950/30 dark:text-amber-100/70">
              <tr>
                <Th>Email</Th>
                <Th>Rol</Th>
                <Th>Creado</Th>
                <Th align="right">Acciones</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-200/40 dark:divide-amber-900/20">
              {initial.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-8 text-center text-xs text-amber-900/60 dark:text-amber-100/50"
                  >
                    No hay emails en la allowlist todavía.
                  </td>
                </tr>
              ) : (
                initial.map((entry) => {
                  const isEditing = editingId === entry.id
                  const isLoading = actionLoadingId === entry.id
                  return (
                    <tr key={entry.id} className="text-amber-950 align-top dark:text-amber-50">
                      <Td>
                        <span className="text-xs">{entry.email}</span>
                      </Td>
                      <Td>
                        {isEditing ? (
                          <select
                            value={editingRole}
                            onChange={(e) => setEditingRole(e.target.value as AllowedRole)}
                            disabled={isLoading}
                            className="rounded-md border border-amber-300/70 bg-white px-1.5 py-0.5 text-xs text-amber-950 outline-none focus:border-amber-500 disabled:opacity-50 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-50"
                          >
                            {ALLOWED_ROLES.map((r) => (
                              <option key={r} value={r}>
                                {ROLE_LABELS[r]}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-amber-300/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:border-amber-700/40 dark:text-amber-300">
                            {entry.role}
                          </span>
                        )}
                      </Td>
                      <Td>
                        <span
                          title={new Date(entry.createdAt).toISOString()}
                          className="text-[11px] text-amber-900/70 dark:text-amber-100/60"
                        >
                          {formatDate(entry.createdAt)}
                        </span>
                      </Td>
                      <Td align="right">
                        <div className="flex items-center justify-end gap-1">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleUpdateRole(entry.id)}
                                disabled={isLoading}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 dark:bg-amber-500 dark:hover:bg-amber-400"
                                title="Guardar"
                              >
                                {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                disabled={isLoading}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-amber-300/70 text-amber-900 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-700/40 dark:text-amber-100 dark:hover:bg-amber-950/40"
                                title="Cancelar"
                              >
                                <X size={12} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingId(entry.id)
                                  setEditingRole(
                                    (ALLOWED_ROLES as readonly string[]).includes(entry.role)
                                      ? (entry.role as AllowedRole)
                                      : "viewer",
                                  )
                                }}
                                disabled={!canMutate || isLoading}
                                title={!canMutate ? "Requiere rol ADMIN o superior" : "Cambiar rol"}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-amber-100 dark:hover:bg-amber-950/40"
                              >
                                <Edit3 size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(entry.id, entry.email)}
                                disabled={!canMutate || isLoading}
                                title={!canMutate ? "Requiere rol ADMIN o superior" : "Eliminar"}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-red-300 dark:hover:bg-red-950/40"
                              >
                                {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                              </button>
                            </>
                          )}
                        </div>
                      </Td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode
  align?: "left" | "right"
}) {
  return (
    <th className="px-3 py-2" style={{ textAlign: align }}>
      {children}
    </th>
  )
}

function Td({
  children,
  align = "left",
}: {
  children: React.ReactNode
  align?: "left" | "right"
}) {
  return (
    <td className="px-3 py-2 align-top" style={{ textAlign: align }}>
      {children}
    </td>
  )
}

function formatDate(iso: string): string {
  return iso.slice(0, 10)
}
