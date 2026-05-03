/**
 * Workspace lifecycle status — single source of truth for the SevenF SaaS.
 *
 * Mirrors the comment on `Workspace.status` in `prisma/schema.prisma`. Same
 * design philosophy as `core/system/plans.ts`:
 *
 *   - Pure module: no DB import, no server-only side effects. Safe to
 *     consume from a client bundle.
 *   - Resolver is permissive: unknown raw values fall back to `active` and
 *     flag `isUnknownStatus=true` so an operator can spot the
 *     misconfiguration without a runtime crash.
 *   - NO ENFORCEMENT today. `suspended` and `archived` are observational
 *     metadata only — login still works, workspace access still works,
 *     channels still sync. A future PR will read these to gate access.
 */

export type WorkspaceStatus = "active" | "trial" | "suspended" | "archived"

export interface WorkspaceStatusDefinition {
  key: WorkspaceStatus
  label: string
  /**
   * Short operator-facing description. Used by the UI to explain the
   * intent of each state without hardcoded copy in the components.
   */
  description: string
}

/**
 * Status catalogue. Order matters for the UI selector — it follows the
 * lifecycle progression operators are most likely to walk through:
 * trial → active → suspended → archived.
 */
export const STATUS_DEFINITIONS: Readonly<
  Record<WorkspaceStatus, WorkspaceStatusDefinition>
> = {
  active: {
    key: "active",
    label: "Active",
    description: "Workspace operativo. Es el estado por defecto.",
  },
  trial: {
    key: "trial",
    label: "Trial",
    description: "Periodo de prueba. Aún no se ha convertido en cliente pago.",
  },
  suspended: {
    key: "suspended",
    label: "Suspended",
    description:
      "Suspendido administrativamente. Hoy no se aplica enforcement; en el futuro bloqueará el acceso.",
  },
  archived: {
    key: "archived",
    label: "Archived",
    description:
      "Workspace archivado. Conserva los datos pero se considera inactivo.",
  },
}

const VALID_STATUS_KEYS = new Set<string>(Object.keys(STATUS_DEFINITIONS))

/**
 * Type guard. Useful at API boundaries where the body comes in as `unknown`.
 */
export function isWorkspaceStatus(value: unknown): value is WorkspaceStatus {
  return typeof value === "string" && VALID_STATUS_KEYS.has(value)
}

/**
 * Resolution result. `rawStatus` keeps the original DB value so the UI
 * can show what was misconfigured when `isUnknownStatus=true`.
 */
export interface ResolvedWorkspaceStatus {
  statusKey: WorkspaceStatus
  label: string
  description: string
  isUnknownStatus: boolean
  rawStatus: string
}

/**
 * Permissive resolver — never throws. Trims + lower-cases the input;
 * unknown values fall back to `active` and flag `isUnknownStatus=true`.
 *
 * The argument shape is an object so we can extend it later (e.g. with
 * `workspace.config` overrides) without breaking callers.
 */
export function resolveWorkspaceStatus(input: {
  status: string | null | undefined
}): ResolvedWorkspaceStatus {
  const raw = (input.status ?? "").toString()
  const normalized = raw.trim().toLowerCase()

  if (isWorkspaceStatus(normalized)) {
    const def = STATUS_DEFINITIONS[normalized]
    return {
      statusKey: def.key,
      label: def.label,
      description: def.description,
      isUnknownStatus: false,
      rawStatus: raw,
    }
  }

  const fallback = STATUS_DEFINITIONS.active
  return {
    statusKey: fallback.key,
    label: fallback.label,
    description: fallback.description,
    isUnknownStatus: true,
    rawStatus: raw,
  }
}
