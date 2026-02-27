"use client"

import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"

const ERROR_MESSAGES: Record<string, string> = {
  invalid_state: "Error de seguridad. Intenta de nuevo.",
  not_allowed: "Tu email no tiene acceso a esta plataforma. Contacta a la administradora.",
  auth_failed: "Error al autenticarse con Google. Intenta de nuevo.",
  config: "Error de configuracion del servidor.",
  forbidden: "No tienes permisos para acceder a esa seccion.",
  google_disabled: "Google Auth deshabilitado. Usa el formulario de desarrollo.",
}

// TEMP: hardcoded true for multi-tenant testing
// Revert: change to `process.env.NEXT_PUBLIC_DISABLE_GOOGLE_AUTH === "true"`
const GOOGLE_DISABLED = true

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  )
}

function LoginContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")
  const detail = searchParams.get("detail")

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-foreground mb-4">
            <span className="text-xl font-bold text-background">7F</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">7F Platform</h1>
          <p className="mt-1.5 text-sm text-muted-foreground text-center">
            Plataforma de gestion empresarial
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
            <p className="text-xs text-destructive text-center">
              {ERROR_MESSAGES[error] || error}
            </p>
            {detail && (
              <p className="text-[10px] text-destructive/70 text-center mt-1">{detail}</p>
            )}
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card p-8">
          {GOOGLE_DISABLED ? (
            <DevLoginForm />
          ) : (
            <>
              <p className="text-sm text-muted-foreground text-center mb-6">
                Inicia sesion con tu cuenta de Google autorizada
              </p>

              <a
                href="/api/auth/login/google"
                className="flex items-center justify-center gap-3 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Continuar con Google
              </a>
            </>
          )}
        </div>

        <p className="mt-6 text-[10px] text-muted-foreground text-center">
          {GOOGLE_DISABLED
            ? "Modo desarrollo — Google Auth deshabilitado"
            : "Solo usuarios autorizados pueden acceder. Si no tienes acceso, contacta a la administradora."}
        </p>

        <p className="mt-2 text-[10px] text-muted-foreground text-center">
          &copy; {new Date().getFullYear()} 7F Platform
        </p>
      </div>
    </div>
  )
}

function DevLoginForm() {
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("admin")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/auth/dev-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Error de autenticación")
        return
      }
      window.location.href = "/"
    } catch {
      setError("Error de conexión")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <p className="text-sm text-muted-foreground text-center mb-4">
        Dev Login — Multi-tenant testing
      </p>
      <div className="space-y-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="admin">Admin</option>
          <option value="editor">Editor</option>
          <option value="viewer">Viewer</option>
        </select>
        {error && <p className="text-xs text-destructive text-center">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
        >
          {loading ? "Iniciando..." : "Entrar (Dev)"}
        </button>
      </div>
    </form>
  )
}
