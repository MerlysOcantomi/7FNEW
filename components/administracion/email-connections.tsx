"use client"

import { useState, useCallback } from "react"
import { useFetch } from "@/hooks/use-fetch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Mail, Plus, Loader2, CheckCircle2, XCircle, ChevronDown, ChevronUp,
  RefreshCw, Trash2, Star, Eye, EyeOff, AlertCircle, Download,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface ConnectionItem {
  id: string
  channelType: string
  provider: string
  name: string
  config: string | null
  status: string
  externalAccountId: string | null
  isDefault: boolean
  lastSyncAt: string | null
  lastError: string | null
  createdAt: string
}

interface ValidationDetail {
  ok: boolean
  error?: string
}

interface Props {
  workspaceId: string
}

type FormStep = "idle" | "form" | "testing" | "success" | "error"

export function EmailConnectionsManager({ workspaceId }: Props) {
  const [refreshKey, setRefreshKey] = useState(0)
  const { data: connections, loading } = useFetch<ConnectionItem[]>(
    `/api/workspaces/${workspaceId}/connections`,
    { refreshKey },
  )

  const [step, setStep] = useState<FormStep>("idle")
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [syncResult, setSyncResult] = useState<{ connId: string; msg: string } | null>(null)

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    fromName: "",
    imapHost: "",
    imapPort: "",
    smtpHost: "",
    smtpPort: "",
    setAsDefault: false,
  })

  const [result, setResult] = useState<{
    connected?: boolean
    validation?: { ok: boolean; imap: ValidationDetail; smtp: ValidationDetail }
    resolvedSettings?: Record<string, unknown>
    error?: string
    /**
     * Set when we detected leading/trailing whitespace in the typed password before the
     * request. Surfaced as a hint inside the error panel so the operator can fix the source
     * (paste from a password manager, accidental newline). We never auto-trim — passwords
     * are user secrets and their semantics belong to the operator.
     */
    passwordHadEdgeWhitespace?: boolean
  } | null>(null)

  const resetForm = useCallback(() => {
    setStep("idle")
    setForm({ name: "", email: "", password: "", fromName: "", imapHost: "", imapPort: "", smtpHost: "", smtpPort: "", setAsDefault: false })
    setResult(null)
    setShowAdvanced(false)
    setShowPassword(false)
  }, [])

  const handleConnect = useCallback(async () => {
    setStep("testing")
    setResult(null)

    try {
      /**
       * Normalize email + password before sending. Email goes through `.trim().toLowerCase()`
       * because IMAP/SMTP servers (Titan included) match credentials case-insensitively but
       * reject leading/trailing whitespace silently — a frequent root cause of "535 5.7.8
       * authentication failed" when the operator pastes from a password manager.
       *
       * Password is NOT auto-trimmed (a legitimate password may end with a space and the
       * server cares about it), but we surface a UI warning if we detect whitespace at the
       * boundaries so the operator can fix the source instead of guessing.
       */
      const normalizedEmail = form.email.trim().toLowerCase()
      const passwordHadEdgeWhitespace = form.password !== form.password.trim()

      const body: Record<string, unknown> = {
        name: form.name.trim() || normalizedEmail,
        email: normalizedEmail,
        password: form.password,
        fromName: form.fromName.trim() || undefined,
        setAsDefault: form.setAsDefault,
      }
      if (form.imapHost.trim()) body.imapHost = form.imapHost.trim()
      if (form.imapPort.trim()) body.imapPort = Number(form.imapPort.trim())
      if (form.smtpHost.trim()) body.smtpHost = form.smtpHost.trim()
      if (form.smtpPort.trim()) body.smtpPort = Number(form.smtpPort.trim())

      /**
       * Sanitized client-side log: keys + non-secret payload. The previous version dumped
       * the full body (including the password!) to the browser console — a real leak
       * because anyone with devtools open could read the password. Don't log secrets.
       */
      console.log(
        `[email-connections] submit keys=${Object.keys(body).join(",")} email=${normalizedEmail} pwLen=${form.password.length} pwEdgeWs=${passwordHadEdgeWhitespace}`,
      )

      const res = await fetch(`/api/workspaces/${workspaceId}/connections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const json = await res.json()

      if (!res.ok) {
        setResult({ error: json.error?.message || "Error al conectar", passwordHadEdgeWhitespace })
        setStep("error")
        return
      }

      const data = json.data ?? json
      if (data.connected) {
        setResult({ connected: true })
        setStep("success")
        setRefreshKey((k) => k + 1)
      } else {
        setResult({
          connected: false,
          validation: data.validation,
          resolvedSettings: data.resolvedSettings,
          passwordHadEdgeWhitespace,
        })
        setStep("error")
        if (!showAdvanced) setShowAdvanced(true)
      }
    } catch {
      setResult({ error: "No se pudo conectar al servidor" })
      setStep("error")
    }
  }, [form, workspaceId, showAdvanced])

  /** Detect password whitespace live so the hint is visible in the form too. */
  const passwordHasEdgeWhitespace =
    form.password.length > 0 && form.password !== form.password.trim()

  const handleTestExisting = useCallback(async (connId: string) => {
    setTestingId(connId)
    try {
      await fetch(`/api/workspaces/${workspaceId}/connections/${connId}/test`, { method: "POST" })
      setRefreshKey((k) => k + 1)
    } catch { /* ignore */ }
    setTestingId(null)
  }, [workspaceId])

  const handleDelete = useCallback(async (connId: string) => {
    if (!confirm("¿Eliminar esta conexión de email?")) return
    try {
      await fetch(`/api/workspaces/${workspaceId}/connections/${connId}`, { method: "DELETE" })
      setRefreshKey((k) => k + 1)
    } catch { /* ignore */ }
  }, [workspaceId])

  const handleSync = useCallback(async (connId: string) => {
    setSyncingId(connId)
    setSyncResult(null)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/connections/${connId}/sync`, { method: "POST" })
      const json = await res.json()
      const data = json.data ?? json
      const msg = data.ok
        ? `Sync OK: ${data.ingested} nuevos, ${data.skipped} omitidos`
        : `Sync con errores: ${(data.errors ?? []).join("; ")}`
      setSyncResult({ connId, msg })
      setRefreshKey((k) => k + 1)
    } catch {
      setSyncResult({ connId, msg: "Error al sincronizar" })
    }
    setSyncingId(null)
  }, [workspaceId])

  const handleSetDefault = useCallback(async (connId: string) => {
    try {
      await fetch(`/api/workspaces/${workspaceId}/connections/${connId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setAsDefault: true }),
      })
      setRefreshKey((k) => k + 1)
    } catch { /* ignore */ }
  }, [workspaceId])

  return (
    <div className="space-y-6">
      {/* Existing connections */}
      <div className="space-y-3">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando conexiones...
          </div>
        )}
        {!loading && connections && connections.length === 0 && step === "idle" && (
          <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
            <Mail className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-foreground">No hay cuentas de email conectadas</p>
            <p className="text-xs text-muted-foreground mt-1">Conecta tu primera cuenta para enviar y recibir desde el inbox.</p>
          </div>
        )}
        {connections && connections.length > 0 && (
          <div className="space-y-2">
            {connections.map((conn) => {
              const cfg = conn.config ? JSON.parse(conn.config) : {}
              return (
                <div key={conn.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
                  <div className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0",
                    conn.status === "active" ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-500",
                  )}>
                    {conn.status === "active" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate">{conn.name}</span>
                      {conn.isDefault && (
                        <span className="text-[10px] font-medium uppercase tracking-wider bg-primary/10 text-primary px-1.5 py-0.5 rounded">Default</span>
                      )}
                      <span className="text-[10px] font-medium uppercase tracking-wider bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                        {conn.provider === "imap_smtp" ? "IMAP/SMTP" : conn.provider}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {conn.externalAccountId}
                      {cfg.smtpHost ? ` — ${cfg.smtpHost}` : ""}
                    </p>
                    {conn.lastError && (
                      <p className="text-xs text-red-500 mt-0.5 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{conn.lastError}</span>
                      </p>
                    )}
                    {syncResult?.connId === conn.id && (
                      <p className="text-xs text-muted-foreground mt-0.5">{syncResult.msg}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!conn.isDefault && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Marcar como default" onClick={() => handleSetDefault(conn.id)}>
                        <Star className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {conn.provider === "imap_smtp" && (
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7" title="Sync now (descargar emails)"
                        disabled={syncingId === conn.id}
                        onClick={() => handleSync(conn.id)}
                      >
                        {syncingId === conn.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                      </Button>
                    )}
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7" title="Testear conexión"
                      disabled={testingId === conn.id}
                      onClick={() => handleTestExisting(conn.id)}
                    >
                      {testingId === conn.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" title="Eliminar" onClick={() => handleDelete(conn.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Add connection */}
      {step === "idle" && (
        <Button variant="outline" className="gap-2" onClick={() => setStep("form")}>
          <Plus className="h-4 w-4" /> Conectar cuenta de email
        </Button>
      )}

      {(step === "form" || step === "testing" || step === "error") && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Conectar email personalizado</h3>
            <Button variant="ghost" size="sm" onClick={resetForm} className="text-xs h-7">Cancelar</Button>
          </div>

          <div className="grid gap-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Nombre visible</label>
                <Input placeholder="Soporte Skina" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} disabled={step === "testing"} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">From name (opcional)</label>
                <Input placeholder="Skina Digital" value={form.fromName} onChange={(e) => setForm((f) => ({ ...f, fromName: e.target.value }))} disabled={step === "testing"} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Email</label>
              <Input type="email" placeholder="inbox@skina.digital" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} disabled={step === "testing"} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Password / App password</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  disabled={step === "testing"}
                  className="pr-9"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordHasEdgeWhitespace && (
                <p className="text-[11px] text-amber-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 flex-shrink-0" />
                  La contraseña tiene espacios al inicio o al final — probable causa de un fallo de autenticación. Revísala antes de continuar.
                </p>
              )}
            </div>

            <button
              type="button"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground py-1"
              onClick={() => {
                setShowAdvanced((v) => {
                  if (!v && form.email.includes("@") && !form.imapHost && !form.smtpHost) {
                    const domain = form.email.split("@")[1]?.toLowerCase() ?? ""
                    const known: Record<string, { imap: string; smtp: string; iPort: string; sPort: string }> = {
                      "titan.email":   { imap: "imap.titan.email",   smtp: "smtp.titan.email",   iPort: "993", sPort: "465" },
                      "hostinger.com": { imap: "imap.hostinger.com", smtp: "smtp.hostinger.com", iPort: "993", sPort: "465" },
                      "gmail.com":     { imap: "imap.gmail.com",     smtp: "smtp.gmail.com",     iPort: "993", sPort: "465" },
                    }
                    const match = Object.entries(known).find(([k]) => domain === k || domain.endsWith(`.${k}`))
                    const defaults = match ? match[1] : { imap: `imap.${domain}`, smtp: `smtp.${domain}`, iPort: "993", sPort: "465" }
                    setForm((f) => ({ ...f, imapHost: defaults.imap, imapPort: defaults.iPort, smtpHost: defaults.smtp, smtpPort: defaults.sPort }))
                  }
                  return !v
                })
              }}
            >
              {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              Configuración avanzada
            </button>

            {showAdvanced && (
              <div className="grid sm:grid-cols-2 gap-3 pl-1 border-l-2 border-border ml-1">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">IMAP Host</label>
                  <Input placeholder="imap.titan.email" value={form.imapHost} onChange={(e) => setForm((f) => ({ ...f, imapHost: e.target.value }))} disabled={step === "testing"} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">IMAP Port</label>
                  <Input placeholder="993" value={form.imapPort} onChange={(e) => setForm((f) => ({ ...f, imapPort: e.target.value }))} disabled={step === "testing"} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">SMTP Host</label>
                  <Input placeholder="smtp.titan.email" value={form.smtpHost} onChange={(e) => setForm((f) => ({ ...f, smtpHost: e.target.value }))} disabled={step === "testing"} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">SMTP Port</label>
                  <Input placeholder="465" value={form.smtpPort} onChange={(e) => setForm((f) => ({ ...f, smtpPort: e.target.value }))} disabled={step === "testing"} />
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="setAsDefault"
                checked={form.setAsDefault}
                onChange={(e) => setForm((f) => ({ ...f, setAsDefault: e.target.checked }))}
                className="rounded"
                disabled={step === "testing"}
              />
              <label htmlFor="setAsDefault" className="text-xs text-muted-foreground">Usar como cuenta por defecto</label>
            </div>
          </div>

          {result && !result.connected && (
            <div className="rounded-lg bg-red-500/5 border border-red-500/20 p-3 space-y-1">
              {result.error && <p className="text-xs text-red-600">{result.error}</p>}
              {result.validation && !result.validation.imap.ok && (
                <p className="text-xs text-red-600">IMAP: {result.validation.imap.error}</p>
              )}
              {result.validation && !result.validation.smtp.ok && (
                <p className="text-xs text-red-600">SMTP: {result.validation.smtp.error}</p>
              )}
              {result.resolvedSettings && (
                <p className="text-xs text-muted-foreground mt-1">
                  Configuración usada: IMAP {String(result.resolvedSettings.imapHost)}:{String(result.resolvedSettings.imapPort)} secure={String(result.resolvedSettings.imapSecure ?? true)}, SMTP {String(result.resolvedSettings.smtpHost)}:{String(result.resolvedSettings.smtpPort)} secure={String(result.resolvedSettings.smtpSecure ?? true)}.
                  Usuario: {String(result.resolvedSettings.username ?? result.resolvedSettings.email ?? "")}.
                  Si estos hosts no son correctos, ajústalos en configuración avanzada.
                </p>
              )}
              {result.passwordHadEdgeWhitespace && (
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 flex-shrink-0" />
                  La contraseña enviada incluía espacios al inicio o al final. Revísala (frecuente al pegar desde gestores) y vuelve a intentar.
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={resetForm} disabled={step === "testing"}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="gap-2"
              disabled={!form.email || !form.password || step === "testing"}
              onClick={handleConnect}
            >
              {step === "testing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              {step === "testing" ? "Verificando..." : "Conectar y verificar"}
            </Button>
          </div>
        </div>
      )}

      {step === "success" && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Cuenta conectada correctamente</p>
            <p className="text-xs text-muted-foreground mt-0.5">IMAP y SMTP verificados. La cuenta ya está lista para usar en el inbox.</p>
          </div>
          <Button variant="outline" size="sm" onClick={resetForm}>Cerrar</Button>
        </div>
      )}
    </div>
  )
}
