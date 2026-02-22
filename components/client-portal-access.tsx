"use client"

import { useState, useEffect } from "react"
import { KeyRound, Loader2, Check, AlertCircle, Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"

interface Props {
  clienteId: string
  clienteEmail?: string
}

export function ClientPortalAccess({ clienteId, clienteEmail }: Props) {
  const [hasAccess, setHasAccess] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [email, setEmail] = useState(clienteEmail || "")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    checkAccess()
  }, [clienteId])

  async function checkAccess() {
    try {
      const res = await fetch("/api/cliente/auth/list")
      const list = await res.json()
      const found = Array.isArray(list) && list.some((a: any) => a.clienteId === clienteId)
      setHasAccess(found)
    } catch {
      setHasAccess(false)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    if (!email || !password) {
      toast.error("Email y contraseña son requeridos")
      return
    }
    if (password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres")
      return
    }
    setCreating(true)
    try {
      const res = await fetch("/api/cliente/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteId, email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Error al crear acceso")
        return
      }
      toast.success("Acceso al portal creado correctamente")
      setHasAccess(true)
      setShowForm(false)
    } catch {
      toast.error("Error de conexion")
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Verificando acceso al portal...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <KeyRound className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Portal de Clientes</h3>
      </div>

      {hasAccess ? (
        <div className="flex items-center gap-2">
          <Check className="h-4 w-4 text-green-500" />
          <span className="text-sm text-green-600">Este cliente tiene acceso al portal</span>
        </div>
      ) : showForm ? (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Email de acceso</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="cliente@email.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Contraseña</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 pr-10 text-sm"
                placeholder="Minimo 6 caracteres"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-2 rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-50"
            >
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
              {creating ? "Creando..." : "Crear acceso"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <span className="text-sm text-muted-foreground">Este cliente no tiene acceso al portal</span>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background transition-opacity hover:opacity-80"
          >
            <KeyRound className="h-3.5 w-3.5" />
            Dar acceso al portal
          </button>
        </div>
      )}
    </div>
  )
}
