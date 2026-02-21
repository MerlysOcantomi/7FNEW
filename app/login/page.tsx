"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

const ERROR_MESSAGES: Record<string, string> = {
  not_allowed: "Tu correo no esta autorizado para acceder a 7F. Contacta a la administradora.",
  auth_failed: "Error durante la autenticacion. Intenta de nuevo.",
  invalid_state: "Sesion de autenticacion invalida. Intenta de nuevo.",
  config: "Error de configuracion del sistema. Contacta al administrador.",
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  )
}

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const error = searchParams.get("error")
  const [checking, setChecking] = useState(true)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.authenticated) {
          router.replace("/")
        } else {
          setChecking(false)
        }
      })
      .catch(() => setChecking(false))
  }, [router])

  function handleLogin() {
    setLoading(true)
    window.location.href = "/api/auth/login/google"
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-foreground mb-4">
            <span className="text-xl font-bold text-background">7F</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">7F Platform</h1>
          <p className="mt-1.5 text-sm text-muted-foreground text-center">
            Plataforma de gestion empresarial
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
            <p className="text-xs text-destructive text-center">
              {ERROR_MESSAGES[error] ?? "Error desconocido. Intenta de nuevo."}
            </p>
          </div>
        )}

        {/* Login card */}
        <div className="rounded-2xl border border-border bg-card p-8">
          <p className="text-sm font-medium text-foreground text-center mb-6">
            Inicia sesion con tu cuenta autorizada
          </p>

          <button
            onClick={handleLogin}
            disabled={loading}
            className={cn(
              "flex w-full items-center justify-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all",
              loading
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-foreground text-background hover:opacity-90"
            )}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Conectando...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Entrar con Google
              </>
            )}
          </button>

          <p className="mt-4 text-[10px] text-muted-foreground text-center leading-relaxed">
            Solo correos autorizados por la administradora pueden acceder.
            Si no tienes acceso, solicita autorizacion.
          </p>
        </div>

        <p className="mt-6 text-[10px] text-muted-foreground text-center">
          &copy; {new Date().getFullYear()} 7F Platform
        </p>
      </div>
    </div>
  )
}
