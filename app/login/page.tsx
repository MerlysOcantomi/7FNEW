"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"

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
              {error}
            </p>
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card p-8">
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
              <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-foreground text-center">
              Login temporalmente desactivado
            </p>
            <p className="text-xs text-muted-foreground text-center leading-relaxed">
              El sistema de autenticacion esta en mantenimiento mientras se completa el deploy estable. Se reactivara pronto.
            </p>
          </div>
        </div>

        <p className="mt-6 text-[10px] text-muted-foreground text-center">
          &copy; {new Date().getFullYear()} 7F Platform
        </p>
      </div>
    </div>
  )
}
