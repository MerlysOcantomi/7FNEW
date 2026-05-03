"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Check, Loader2, X, ArrowRight, Info } from "lucide-react"
import { PLAN_DEFINITIONS, type TenantPlan } from "@core/system/plans"

/**
 * Inline plan editor used inside the detail page's PlanCard.
 *
 * Beyond the plain selector, this component now renders a structured
 * "impact preview" comparing the workspace's CURRENT state with the NEXT
 * plan's limits + modules. Two design notes:
 *
 *   1. Importing `PLAN_DEFINITIONS` directly. The plans module is a pure
 *      catalogue of constants and types — no DB import, no server-only
 *      side effects — so it's safe to consume from a client bundle. Doing
 *      so keeps a single source of truth (no parallel JSON serialisation
 *      via props).
 *
 *   2. Warnings are observational. Even when the editor surfaces a
 *      "current usage exceeds next plan" warning, the API will still
 *      accept the change. The platform deliberately does NOT enforce
 *      plan limits today — the warning + acknowledgment checkbox is the
 *      only safeguard, and it's purely informative. When enforcement
 *      lands later, the same UX hooks will be reused for the harder gate.
 *
 * Render contract:
 *   - Always renders the selector + preview (so SUPPORT/BILLING admins
 *     discover the gate; only ADMIN+ can submit).
 *   - When `canMutate=false`: select + button are disabled, footer text
 *     explains the requirement.
 *   - When `canMutate=true`: warnings (if any) gate the Save button via
 *     a required acknowledgment checkbox.
 *
 * Defence in depth: even if `canMutate` were spoofed client-side, the API
 * still enforces `requirePlatformAdmin()` and `isTenantPlan()`.
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
  /**
   * Counts already computed by the page's accessor. Passed as primitives
   * (not re-derived here) so the warning math is exact and matches what
   * the rest of the PlanCard shows.
   */
  seatUsage: number
  channelUsage: number
  currentEnabledModules: readonly string[]
  canMutate: boolean
}

export function WorkspacePlanEditor({
  workspaceId,
  currentPlan,
  seatUsage,
  channelUsage,
  currentEnabledModules,
  canMutate,
}: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [selected, setSelected] = useState<TenantPlan>(currentPlan)
  const [acknowledged, setAcknowledged] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  /**
   * Reset acknowledgment whenever the selection changes. The checkbox
   * applies to a specific transition; if the operator picks a different
   * destination plan, they must re-confirm the new impact.
   */
  useEffect(() => {
    setAcknowledged(false)
    setError(null)
    setSuccess(null)
  }, [selected])

  const dirty = selected !== currentPlan
  const nextDef = PLAN_DEFINITIONS[selected]
  const currentDef = PLAN_DEFINITIONS[currentPlan]

  /**
   * Impact computation. We avoid `Set` churn by sorting once and using
   * `includes` for the small lists we have.
   *
   * Edge case: enterprise's `["all"]` sentinel. We treat it specially in
   * both directions:
   *   - current=normal → next=enterprise → "modules added: all"
   *   - current=enterprise → next=normal → "modules removed: full module access"
   *
   * Otherwise we compute the diff in plain JS.
   */
  const impact = useMemo(() => {
    const isCurrentAll =
      currentEnabledModules.length === 1 && currentEnabledModules[0] === "all"
    const isNextAll = nextDef.enabledModules.length === 1 && nextDef.enabledModules[0] === "all"

    let modulesAdded: string[] = []
    let modulesRemoved: string[] = []
    let modulesAllAdded = false
    let modulesAllRemoved = false

    if (!isCurrentAll && isNextAll) {
      modulesAllAdded = true
    } else if (isCurrentAll && !isNextAll) {
      modulesAllRemoved = true
    } else if (!isCurrentAll && !isNextAll) {
      const cur = new Set(currentEnabledModules)
      const next = new Set(nextDef.enabledModules)
      modulesAdded = nextDef.enabledModules.filter((m) => !cur.has(m))
      modulesRemoved = currentEnabledModules.filter((m) => !next.has(m))
    }

    const seatLimit = nextDef.limits.includedSeats
    const channelLimit = nextDef.limits.maxChannels
    const seatOverLimit = seatLimit !== null && seatUsage > seatLimit
    const channelOverLimit = channelLimit !== null && channelUsage > channelLimit

    const hasWarnings =
      seatOverLimit ||
      channelOverLimit ||
      modulesRemoved.length > 0 ||
      modulesAllRemoved

    return {
      seatOverLimit,
      channelOverLimit,
      seatLimit,
      channelLimit,
      modulesAdded,
      modulesRemoved,
      modulesAllAdded,
      modulesAllRemoved,
      hasWarnings,
    }
  }, [currentEnabledModules, nextDef, seatUsage, channelUsage])

  const saveDisabled =
    !canMutate ||
    !dirty ||
    submitting ||
    (impact.hasWarnings && !acknowledged)

  async function handleSave() {
    if (saveDisabled) return
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
    <div className="flex flex-col gap-3">
      {/* Selector row */}
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
            disabled={!canMutate || submitting}
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
          disabled={saveDisabled}
          title={
            !canMutate
              ? "Requiere rol de plataforma ADMIN o superior"
              : !dirty
                ? "El plan seleccionado coincide con el actual"
                : impact.hasWarnings && !acknowledged
                  ? "Confirma el impacto antes de guardar"
                  : undefined
          }
          className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-amber-500 dark:hover:bg-amber-400"
        >
          {submitting ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          <span>Guardar plan</span>
        </button>
      </div>

      {/* Preview shown only when there's an actual change */}
      {dirty ? (
        <div className="flex flex-col gap-2 rounded-md border border-amber-200/60 bg-white/60 p-3 text-[11px] dark:border-amber-900/30 dark:bg-amber-950/20">
          <div className="flex items-center gap-1.5 text-amber-900/70 dark:text-amber-100/60">
            <Info size={12} />
            <span className="font-semibold uppercase tracking-wide">Impacto del cambio</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <PreviewColumn
              title={`Actual · ${currentDef.label}`}
              tone="muted"
              seatLimit={currentDef.limits.includedSeats}
              channelLimit={currentDef.limits.maxChannels}
              aiCredits={currentDef.limits.aiCreditsMonthly}
              modules={currentEnabledModules}
              seatUsage={seatUsage}
              channelUsage={channelUsage}
            />
            <PreviewColumn
              title={`Nuevo · ${nextDef.label}`}
              tone="emphasis"
              seatLimit={nextDef.limits.includedSeats}
              channelLimit={nextDef.limits.maxChannels}
              aiCredits={nextDef.limits.aiCreditsMonthly}
              modules={nextDef.enabledModules}
              seatUsage={seatUsage}
              channelUsage={channelUsage}
              warnSeat={impact.seatOverLimit}
              warnChannel={impact.channelOverLimit}
            />
          </div>

          {/* Warnings block — only renders if there's something to warn about */}
          {impact.hasWarnings ? (
            <div className="flex flex-col gap-1.5 rounded-md border border-amber-300/70 bg-amber-50/80 p-2.5 dark:border-amber-700/40 dark:bg-amber-950/40">
              <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-200">
                <AlertTriangle size={12} />
                <span className="text-[11px] font-semibold uppercase tracking-wide">
                  Avisos
                </span>
              </div>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-[11px] text-amber-900 dark:text-amber-100">
                {impact.seatOverLimit ? (
                  <li>
                    Este workspace usa <strong>{seatUsage}</strong> seats, pero el
                    plan {nextDef.label} incluye <strong>{impact.seatLimit}</strong>.
                  </li>
                ) : null}
                {impact.channelOverLimit ? (
                  <li>
                    Este workspace usa <strong>{channelUsage}</strong> canales,
                    pero el plan {nextDef.label} incluye{" "}
                    <strong>{impact.channelLimit}</strong>.
                  </li>
                ) : null}
                {impact.modulesAllRemoved ? (
                  <li>Se pierde acceso a todos los módulos extra (downgrade desde Enterprise).</li>
                ) : null}
                {impact.modulesRemoved.length > 0 ? (
                  <li>
                    Módulos que dejarán de estar incluidos:{" "}
                    <code className="rounded bg-amber-100/70 px-1 py-0.5 font-mono dark:bg-amber-950/60">
                      {impact.modulesRemoved.join(", ")}
                    </code>
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}

          {/* Modules added — informational only, no checkbox required */}
          {impact.modulesAllAdded || impact.modulesAdded.length > 0 ? (
            <div className="flex flex-col gap-1 rounded-md border border-emerald-300/60 bg-emerald-50/70 p-2.5 dark:border-emerald-900/30 dark:bg-emerald-950/30">
              <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-200">
                <Check size={12} />
                <span className="text-[11px] font-semibold uppercase tracking-wide">
                  Cambios positivos
                </span>
              </div>
              <p className="text-[11px] text-emerald-900 dark:text-emerald-100">
                {impact.modulesAllAdded ? (
                  <>Acceso completo a todos los módulos (upgrade a Enterprise).</>
                ) : (
                  <>
                    Módulos añadidos:{" "}
                    <code className="rounded bg-emerald-100/70 px-1 py-0.5 font-mono dark:bg-emerald-950/60">
                      {impact.modulesAdded.join(", ")}
                    </code>
                  </>
                )}
              </p>
            </div>
          ) : null}

          {/* Acknowledgment — only required when there are warnings */}
          {canMutate && impact.hasWarnings ? (
            <label className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-white/40 p-2 text-[11px] text-amber-900 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-100">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                disabled={submitting}
                className="mt-0.5"
              />
              <span>
                Entiendo que los límites son observacionales y este cambio no
                aplica enforcement ni facturación automática.
              </span>
            </label>
          ) : null}
        </div>
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
          Requiere rol de plataforma ADMIN o superior para cambiar el plan.
        </p>
      ) : null}
    </div>
  )
}

/**
 * One side of the impact preview. `tone="muted"` is the current plan
 * column (de-emphasised); `tone="emphasis"` is the next plan column with
 * the active accent. The `warn*` props tint the seat/channel rows amber
 * when current usage already exceeds the next plan's cap.
 */
function PreviewColumn({
  title,
  tone,
  seatLimit,
  channelLimit,
  aiCredits,
  modules,
  seatUsage,
  channelUsage,
  warnSeat,
  warnChannel,
}: {
  title: string
  tone: "muted" | "emphasis"
  seatLimit: number | null
  channelLimit: number | null
  aiCredits: number | null
  modules: readonly string[]
  seatUsage: number
  channelUsage: number
  warnSeat?: boolean
  warnChannel?: boolean
}) {
  const headerCls =
    tone === "emphasis"
      ? "text-amber-900 dark:text-amber-100"
      : "text-amber-900/60 dark:text-amber-100/50"

  return (
    <div className="flex flex-col gap-1.5">
      <div className={`flex items-center gap-1 text-[11px] font-semibold ${headerCls}`}>
        {tone === "emphasis" ? <ArrowRight size={10} /> : null}
        <span className="uppercase tracking-wide">{title}</span>
      </div>
      <Row
        label="Seats"
        value={`${seatUsage} / ${seatLimit === null ? "Unlimited" : seatLimit}`}
        warn={warnSeat}
      />
      <Row
        label="Channels"
        value={`${channelUsage} / ${channelLimit === null ? "Unlimited" : channelLimit}`}
        warn={warnChannel}
      />
      <Row
        label="AI credits / month"
        value={aiCredits === null ? "Unlimited" : aiCredits.toLocaleString("en-US")}
      />
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] uppercase tracking-wide text-amber-900/60 dark:text-amber-100/50">
          Modules
        </span>
        <span className="text-[11px] text-amber-900 dark:text-amber-100">
          {modules.length === 1 && modules[0] === "all"
            ? "All modules"
            : modules.join(", ")}
        </span>
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  warn,
}: {
  label: string
  value: React.ReactNode
  warn?: boolean
}) {
  const valueCls = warn
    ? "text-amber-700 dark:text-amber-300 font-semibold"
    : "text-amber-900 dark:text-amber-100"
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] uppercase tracking-wide text-amber-900/60 dark:text-amber-100/50">
        {label}
      </span>
      <span className={`tabular-nums text-[11px] ${valueCls}`}>{value}</span>
    </div>
  )
}
