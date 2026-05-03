"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Check, Info, Loader2, X } from "lucide-react"
import {
  STATUS_DEFINITIONS,
  type WorkspaceStatus,
} from "@core/system/workspace-status"

/**
 * Inline status editor used inside the detail page's StatusCard.
 *
 * Design notes:
 *
 *   1. Importing `STATUS_DEFINITIONS` directly. The status module is a
 *      pure catalogue (no DB import, no server-only side effects) so it
 *      is safe in a client bundle and gives us a single source of truth
 *      for labels + descriptions.
 *
 *   2. NO ENFORCEMENT today. `suspended` and `archived` are observational
 *      metadata only — login still works, workspace access still works,
 *      channels still sync. The helper copy below makes that explicit so
 *      operators don't mistakenly assume changing the status will boot
 *      live users out of a tenant.
 *
 *   3. Render contract:
 *      - Always renders the selector (so SUPPORT/BILLING admins can see
 *        the gate; only ADMIN+ can submit).
 *      - When `canMutate=false`: select + button are disabled, footer
 *        text explains the requirement.
 *      - When `canMutate=true`: changes that move TO `suspended` or
 *        `archived` show an "intent" panel and require an acknowledgment
 *        checkbox before the Save button enables. This is purely a
 *        speed-bump — defence in depth: the API still enforces
 *        `requirePlatformAdmin()` and `isWorkspaceStatus()`.
 */

const STATUS_OPTIONS: ReadonlyArray<{ value: WorkspaceStatus; label: string }> = [
  { value: "active", label: STATUS_DEFINITIONS.active.label },
  { value: "trial", label: STATUS_DEFINITIONS.trial.label },
  { value: "suspended", label: STATUS_DEFINITIONS.suspended.label },
  { value: "archived", label: STATUS_DEFINITIONS.archived.label },
]

/**
 * Statuses that warrant an explicit "are you sure?" acknowledgment when
 * picked from the editor. Both are administrative-only today but they
 * carry an obvious negative connotation if the user reads the label
 * without context — the acknowledgment makes clear that nothing is
 * actually getting blocked.
 */
const WARN_STATUSES: ReadonlySet<WorkspaceStatus> = new Set([
  "suspended",
  "archived",
])

interface Props {
  workspaceId: string
  /**
   * Resolved current status key — always one of the four valid
   * `WorkspaceStatus` values, even when the DB has a misconfigured
   * value (the resolver falls back to `active`). Saving from there is
   * also how an operator fixes the misconfigured row.
   */
  currentStatus: WorkspaceStatus
  canMutate: boolean
}

export function WorkspaceStatusEditor({
  workspaceId,
  currentStatus,
  canMutate,
}: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [selected, setSelected] = useState<WorkspaceStatus>(currentStatus)
  const [acknowledged, setAcknowledged] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  /**
   * Reset acknowledgment + transient feedback whenever the selection
   * changes. The checkbox applies to a specific transition; if the
   * operator picks a different destination status, they must re-confirm
   * with the new context.
   */
  useEffect(() => {
    setAcknowledged(false)
    setError(null)
    setSuccess(null)
  }, [selected])

  const dirty = selected !== currentStatus
  const selectedDef = STATUS_DEFINITIONS[selected]
  const warnIntent = WARN_STATUSES.has(selected) && selected !== currentStatus

  const saveDisabled =
    !canMutate || !dirty || submitting || (warnIntent && !acknowledged)

  async function handleSave() {
    if (saveDisabled) return
    setError(null)
    setSuccess(null)
    setSubmitting(true)
    try {
      const res = await fetch(`/api/system/workspaces/${workspaceId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: selected }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setError(json?.error?.message ?? "No se pudo cambiar el status")
        return
      }
      setSuccess(`Status actualizado a ${selectedDef.label}.`)
      // Re-runs the server component (detail page) so the StatusCard
      // above us picks up the new value + audit log line.
      startTransition(() => router.refresh())
    } catch {
      setError("Error de conexión")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Selector row */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label
            htmlFor={`status-${workspaceId}`}
            className="text-[10px] font-semibold uppercase tracking-wide text-amber-900/60 dark:text-amber-100/50"
          >
            Cambiar status
          </label>
          <select
            id={`status-${workspaceId}`}
            value={selected}
            onChange={(e) => setSelected(e.target.value as WorkspaceStatus)}
            disabled={!canMutate || submitting}
            className="rounded-md border border-amber-300/70 bg-white px-2.5 py-1.5 text-sm text-amber-950 outline-none focus:border-amber-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-50"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saveDisabled}
          title={
            !canMutate
              ? "Requiere rol de plataforma ADMIN o superior"
              : !dirty
                ? "El status seleccionado coincide con el actual"
                : warnIntent && !acknowledged
                  ? "Confirma el cambio antes de guardar"
                  : undefined
          }
          className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-amber-500 dark:hover:bg-amber-400"
        >
          {submitting ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          <span>Guardar status</span>
        </button>
      </div>

      {/* Descripción del status seleccionado — siempre visible para que
          el operador entienda qué significa cada opción. */}
      <div className="flex items-start gap-2 rounded-md border border-amber-200/60 bg-white/60 p-2.5 text-[11px] dark:border-amber-900/30 dark:bg-amber-950/20">
        <Info size={12} className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-300" />
        <p className="text-amber-900 dark:text-amber-100">
          <span className="font-semibold">{selectedDef.label}:</span>{" "}
          {selectedDef.description}
        </p>
      </div>

      {/* Helper copy — explicit reminder that the status is administrative
          only. Required by the task brief; rendered always so it's
          visible even before the operator interacts. */}
      <p className="text-[10px] italic text-amber-900/60 dark:text-amber-100/50">
        Status is currently administrative only. Suspension is not enforced yet.
      </p>

      {/* Acknowledgment for negative-connotation transitions */}
      {canMutate && warnIntent ? (
        <label className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50/80 p-2 text-[11px] text-amber-900 dark:border-amber-700/40 dark:bg-amber-950/40 dark:text-amber-100">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            disabled={submitting}
            className="mt-0.5"
          />
          <span>
            Entiendo que <strong>{selectedDef.label}</strong> es metadata
            administrativa: hoy no se aplica enforcement, los usuarios del
            workspace conservan su acceso normal.
          </span>
        </label>
      ) : null}

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
          Requiere rol de plataforma ADMIN o superior para cambiar el status.
        </p>
      ) : null}
    </div>
  )
}
