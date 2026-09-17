"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"

const ERROR_MESSAGES: Record<string, string> = {
  invalid_state: "Security error. Please try again.",
  not_allowed: "Your email does not have access to this platform. Contact the administrator.",
  auth_failed: "Google authentication failed. Please try again.",
  config: "Server configuration error.",
  forbidden: "You do not have permission to access that section.",
  google_disabled: "Google Auth is disabled. Use the development form.",
}

const GOOGLE_DISABLED = process.env.NEXT_PUBLIC_DISABLE_GOOGLE_AUTH === "true"

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
  const queryProduct = searchParams.get("product")
  const [hostProduct, setHostProduct] = useState<string | null>(null)

  useEffect(() => {
    const hostname = window.location.hostname.toLowerCase()
    if (hostname === "getfinesse.app" || hostname.endsWith(".getfinesse.app")) {
      setHostProduct("finesse")
    }
  }, [])

  const product = queryProduct ?? hostProduct
  const isFinesse = product === "finesse"
  const googleHref = useMemo(
    () => (isFinesse ? "/api/auth/login/google?product=finesse" : "/api/auth/login/google"),
    [isFinesse],
  )

  return (
    <div
      data-theme={isFinesse ? "petrol-pearl" : undefined}
      className={
        isFinesse
          ? "flex min-h-screen items-center justify-center bg-[var(--app-canvas)] px-4 text-[var(--text-primary-light)]"
          : "flex min-h-screen items-center justify-center bg-background px-4"
      }
    >
      <div className="w-full max-w-sm">
        <div className="mb-10 flex flex-col items-center text-center">
          {isFinesse ? (
            <>
              <p className="text-[15px] font-medium italic tracking-wide text-[var(--accent-on-dark)]">Get</p>
              <h1 className="mt-1 text-4xl font-semibold tracking-[0.08em]">FINESSE</h1>
              <p className="mt-2 text-[11px] uppercase tracking-[0.22em] text-[var(--text-tertiary-light)]">by SevenF</p>
              <p className="mt-6 text-sm text-[var(--text-secondary-light)]">Tu negocio empieza aquí.</p>
            </>
          ) : (
            <>
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-foreground">
                <span className="text-xl font-bold text-background">7F</span>
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">7F Platform</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">Business management platform</p>
            </>
          )}
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
            <p className="text-center text-xs text-destructive">{ERROR_MESSAGES[error] || error}</p>
            {detail && <p className="mt-1 text-center text-[10px] text-destructive/70">{detail}</p>}
          </div>
        )}

        <div
          className={
            isFinesse
              ? "rounded-2xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-8 shadow-[var(--app-shadow-subtle)]"
              : "rounded-2xl border border-border bg-card p-8"
          }
        >
          {GOOGLE_DISABLED ? (
            <DevLoginForm />
          ) : (
            <>
              {!isFinesse && (
                <p className="mb-6 text-center text-sm text-muted-foreground">
                  Sign in with your authorized Google account
                </p>
              )}

              <a
                href={googleHref}
                className={
                  isFinesse
                    ? "flex w-full items-center justify-center gap-3 rounded-xl border border-[var(--border-dark-strong)] bg-[var(--app-surface-dark-elevated)] px-4 py-3 text-sm font-medium transition-colors hover:bg-[var(--app-surface-hover)]"
                    : "flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                }
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
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

        {!isFinesse && (
          <>
            <p className="mt-6 text-center text-[10px] text-muted-foreground">
              {GOOGLE_DISABLED
                ? "Development mode — Google Auth disabled"
                : "Only authorized users can access this platform. If you need access, contact the administrator."}
            </p>
            <p className="mt-2 text-center text-[10px] text-muted-foreground">
              &copy; {new Date().getFullYear()} 7F Platform
            </p>
          </>
        )}
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
        setError(data.error || "Authentication error")
        return
      }
      window.location.href = "/"
    } catch {
      setError("Connection error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <p className="mb-4 text-center text-sm text-muted-foreground">Dev Login — Multi-tenant testing</p>
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
        {error && <p className="text-center text-xs text-destructive">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Enter (Dev)"}
        </button>
      </div>
    </form>
  )
}
