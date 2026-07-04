"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Check, Loader2, X } from "lucide-react"
import {
  resolveWorkspaceExperience,
  type ExperienceState,
} from "@core/vertical-packs/experience"

/**
 * Inline vertical selector for the /system workspace detail page.
 *
 * Mirrors WorkspacePlanEditor: platform-admin only can submit (the API also
 * enforces `requirePlatformAdmin()`), a plain `<select>` of active verticals,
 * and a save button that PATCHes `/api/system/workspaces/[id]/vertical`.
 *
 * Beyond the selector it renders a read-only "Vertical experience" preview from
 * the pure `resolveWorkspaceExperience(verticalKey)` so an operator sees exactly
 * what the selected vertical implies (specialist, today mode, nav, theme key,
 * recommended channels/modules) BEFORE saving. Per-workspace module toggles are
 * not here — they live in /administracion.
 */

interface VerticalOption {
  key: string
  name: string
}

interface Props {
  workspaceId: string
  currentVerticalKey: string
  verticals: VerticalOption[]
  canMutate: boolean
}

export function WorkspaceVerticalEditor({
  workspaceId,
  currentVerticalKey,
  verticals,
  canMutate,
}: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [selected, setSelected] = useState(currentVerticalKey)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    setError(null)
    setSuccess(null)
  }, [selected])

  const dirty = selected !== currentVerticalKey
  const preview = useMemo(() => resolveWorkspaceExperience(selected), [selected])
  const saveDisabled = !canMutate || !dirty || submitting

  async function handleSave() {
    if (saveDisabled) return
    setError(null)
    setSuccess(null)
    setSubmitting(true)
    try {
      const res = await fetch(`/api/system/workspaces/${workspaceId}/vertical`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verticalKey: selected }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setError(json?.error?.message ?? "No se pudo cambiar la vertical")
        return
      }
      setSuccess(`Vertical actualizada a ${selected}.`)
      startTransition(() => router.refresh())
    } catch {
      setError("Error de conexión")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label
            htmlFor={`vertical-${workspaceId}`}
            className="text-[10px] font-semibold uppercase tracking-wide text-amber-900/60 dark:text-amber-100/50"
          >
            Cambiar vertical
          </label>
          <select
            id={`vertical-${workspaceId}`}
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={!canMutate || submitting}
            className="rounded-md border border-amber-300/70 bg-white px-2.5 py-1.5 text-sm text-amber-950 outline-none focus:border-amber-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-50"
          >
            {verticals.map((v) => (
              <option key={v.key} value={v.key}>
                {v.name} ({v.key})
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
                ? "La vertical seleccionada coincide con la actual"
                : undefined
          }
          className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-amber-500 dark:hover:bg-amber-400"
        >
          {submitting ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          <span>Guardar vertical</span>
        </button>
      </div>

      {/* Read-only "Vertical experience" preview from the pure resolver. */}
      <div className="flex flex-col gap-1.5 rounded-md border border-amber-200/60 bg-white/60 p-3 text-[11px] dark:border-amber-900/30 dark:bg-amber-950/20">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold uppercase tracking-wide text-amber-900/70 dark:text-amber-100/60">
            Vertical experience{dirty ? " (previsualización)" : ""}
          </span>
          <ExperienceStateBadge state={preview.experienceState} />
        </div>
        <ExperienceRow label="Business type" value={preview.businessType} />
        <ExperienceRow label="Vertical" value={preview.verticalName ?? preview.verticalKey} />
        <ExperienceRow
          label="Especialista"
          value={preview.specialistAgentId ? `${preview.specialistAgentId} · ${preview.brandLine ?? ""}` : "—"}
        />
        <ExperienceRow label="Today mode" value={preview.todayMode} />
        <ExperienceRow label="Nav profile" value={preview.navProfileId ?? "default"} />
        <ExperienceRow
          label="Theme (dato)"
          value={`${preview.defaultThemeKey} · [${preview.availableThemeKeys.join(", ")}]`}
        />
        <ExperienceRow
          label="Canales"
          value={preview.recommendedChannels.length ? preview.recommendedChannels.join(", ") : "—"}
        />
        <ExperienceRow
          label="Módulos rec."
          value={preview.recommendedModules.length ? preview.recommendedModules.join(", ") : "—"}
        />
        <p className="mt-1 text-[10px] italic text-amber-900/50 dark:text-amber-100/40">
          Los toggles de módulos por workspace se editan en /administracion. Los theme keys son dato
          (la theme foundation los aplicará después).
        </p>
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
          Requiere rol de plataforma ADMIN o superior para cambiar la vertical.
        </p>
      ) : null}
    </div>
  )
}

/**
 * State badge that makes it unambiguous whether a vertical is fully built
 * ("completa") or merely registered in seed with no pack yet ("default ·
 * pendiente de pack"). Prevents mistaking a seeded key (construction, clinic,
 * law, florals) for an available vertical.
 */
function ExperienceStateBadge({ state }: { state: ExperienceState }) {
  if (state === "complete") {
    return (
      <span className="inline-flex items-center rounded-full border border-emerald-300/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:border-emerald-700/40 dark:text-emerald-300">
        Experiencia: completa
      </span>
    )
  }
  return (
    <span
      title="Vertical registrada en seed pero sin pack propio todavía; usa la experiencia por defecto."
      className="inline-flex items-center rounded-full border border-amber-400/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:border-amber-700/40 dark:text-amber-300"
    >
      Experiencia: default · pendiente de pack
    </span>
  )
}

function ExperienceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-[10px] uppercase tracking-wide text-amber-900/60 dark:text-amber-100/50">
        {label}
      </span>
      <span className="text-right text-[11px] text-amber-900 dark:text-amber-100">{value}</span>
    </div>
  )
}
