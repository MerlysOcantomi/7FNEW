"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Check, Loader2, X } from "lucide-react"
import type { TenantPlan } from "@core/system/plans"

/**
 * Inline plan editor used inside the detail page's PlanCard.
 *
 * Render contract:
 *   - Always renders (so SUPPORT/BILLING admins see that this control
 *     exists and is governed by ADMIN-level access — discoverable but
 *     not actionable).
 *   - When `canMutate=false`: select + button are disabled with a tooltip;
 *     a small footer text explains the requirement.
 *   - When `canMutate=true`: user picks a plan, clicks Save, and the page
 *     re-renders via `router.refresh()` so the rest of the PlanCard
 *     (limits, modules, AI credits) reflects the new plan immediately.
 *
 * Defence in depth: even if `canMutate` were spoofed client-side, the API
 * still enforces `requirePlatformAdmin()`. The button is the discoverability
 * layer, not the security layer.
 */

const PLAN_OPTIONS: ReadonlyArray<{ value: TenantPlan; label: string }> = [
  { value: "free", label: "Free" },
  { value: "starter", label: "Starter" },
  { value: "business", label: "Business" },
  { value: "enterprise", label: "Enterprise" },
]

interface Props {
  workspaceId: string
  /**
   * Resolved current plan key. We deliberately accept the resolved key
   * (always one of the four valid `TenantPlan` values) instead of the raw
   * `Workspace.plan` string so an "unknown plan" tenant starts the editor
   * pointing at `free` (the resolver's fallback). Saving from there is
   * also how an operator fixes the misconfigured row.
   */
  currentPlan: TenantPlan
  canMutate: boolean
}

export function WorkspacePlanEditor({ workspaceId, currentPlan, canMutate }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [selected, setSelected] = useState<TenantPlan>(currentPlan)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const dirty = selected !== currentPlan
  const disabled = !canMutate || submitting

  async function handleSave() {
    if (!canMutate || !dirty || submitting) return
    setError(null)
    setSuccess(null)
    setSubmitting(true)
    try {
      const res = await fetch(`/api/system/workspaces/${workspaceId}/plan`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: selected }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setError(json?.error?.message ?? "No se pudo cambiar el plan")
        return
      }
      setSuccess(`Plan actualizado a ${selected}.`)
      // router.refresh() re-runs the server component (detail page) so the
      // PlanCard above us picks up the new plan, modules, and limits.
      startTransition(() => router.refresh())
    } catch {
      setError("Error de conexión")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label
            htmlFor={`plan-${workspaceId}`}
            className="text-[10px] font-semibold uppercase tracking-wide text-amber-900/60 dark:text-amber-100/50"
          >
            Cambiar plan
          </label>
          <select
            id={`plan-${workspaceId}`}
            value={selected}
            onChange={(e) => setSelected(e.target.value as TenantPlan)}
            disabled={disabled}
            className="rounded-md border border-amber-300/70 bg-white px-2.5 py-1.5 text-sm text-amber-950 outline-none focus:border-amber-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-50"
          >
            {PLAN_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={disabled || !dirty}
          title={
            !canMutate
              ? "Requiere rol de plataforma ADMIN o superior"
              : !dirty
                ? "El plan seleccionado coincide con el actual"
                : undefined
          }
          className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-amber-500 dark:hover:bg-amber-400"
        >
          {submitting ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          <span>Guardar plan</span>
        </button>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-md border border-red-300/70 bg-red-50/80 px-2 py-1.5 text-[11px] text-red-800 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
          <AlertTriangle size={12} className="shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-700/80 hover:text-red-900 dark:text-red-200/70 dark:hover:text-red-100"
            aria-label="Cerrar"
          >
            <X size={10} />
          </button>
        </div>
      ) : null}

      {success ? (
        <div className="flex items-center gap-2 rounded-md border border-emerald-300/70 bg-emerald-50/80 px-2 py-1.5 text-[11px] text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200">
          <Check size={12} className="shrink-0" />
          <span className="flex-1">{success}</span>
        </div>
      ) : null}

      {!canMutate ? (
        <p className="text-[10px] italic text-amber-900/50 dark:text-amber-100/40">
          Requiere rol de plataforma ADMIN o superior para cambiar el plan.
        </p>
      ) : null}
    </div>
  )
}
