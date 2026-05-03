import { getSessionFromCookies, type SessionUser } from "@core/auth/session"
import { db } from "@core/db"

/**
 * Roles del control plane (SevenF System Admin / `/system`).
 *
 * Son ORTOGONALES a `WorkspaceMember.role`. Ser PlatformAdmin no implica
 * acceso a workspaces cliente; los datos privados de tenants (Inbox,
 * mensajes, conversaciones, contactos) requieren un flujo de impersonation
 * explícito que no existe en esta fase.
 *
 * Niveles (de mayor a menor):
 *   - SUPER_ADMIN: control total. Único que puede gestionar otros admins.
 *   - ADMIN:       operaciones del SaaS (tenants, planes, suspensión).
 *   - SUPPORT:     soporte al cliente (lectura + impersonation con consent).
 *   - BILLING:     solo lectura del área de billing.
 */
export type PlatformRole = "SUPER_ADMIN" | "ADMIN" | "SUPPORT" | "BILLING"

const PLATFORM_LEVEL: Record<PlatformRole, number> = {
  SUPER_ADMIN: 4,
  ADMIN: 3,
  SUPPORT: 2,
  BILLING: 1,
}

const VALID_PLATFORM_ROLES = new Set<string>(["SUPER_ADMIN", "ADMIN", "SUPPORT", "BILLING"])

export function isPlatformRole(value: unknown): value is PlatformRole {
  return typeof value === "string" && VALID_PLATFORM_ROLES.has(value)
}

export class PlatformError extends Error {
  status: number
  code: "UNAUTHORIZED" | "NOT_PLATFORM_ADMIN" | "INSUFFICIENT_PLATFORM_ROLE"
  constructor(
    code: "UNAUTHORIZED" | "NOT_PLATFORM_ADMIN" | "INSUFFICIENT_PLATFORM_ROLE",
    message: string,
    status?: number,
  ) {
    super(message)
    this.code = code
    this.name = "PlatformError"
    this.status = status ?? (code === "UNAUTHORIZED" ? 401 : 403)
  }
}

export interface PlatformAuth {
  session: SessionUser
  platformRole: PlatformRole
}

/**
 * Validación estricta de rol de plataforma. Reglas:
 *
 *  1. Debe haber sesión válida (cookie `7f-session`). Si no, 401.
 *  2. El JWT debe llevar `platformRole`. Esto lo rellena el callback de
 *     Google login leyendo `PlatformAdmin`. Si el claim no existe, 403.
 *  3. **Defensa en profundidad**: aunque el JWT tenga el claim, re-leemos
 *     `PlatformAdmin` por `userId` para rechazar tokens viejos cuyo dueño
 *     ya fue revocado. El JWT es solo el fast-path; la BD es la verdad.
 *  4. El rol actual debe ser >= `min`.
 *
 * NUNCA usa `wf_workspace` ni resuelve workspace activo. El control plane no
 * vive dentro de un workspace.
 */
export async function requirePlatformRole(min: PlatformRole): Promise<PlatformAuth> {
  const session = await getSessionFromCookies()
  if (!session) {
    throw new PlatformError("UNAUTHORIZED", "No autenticado", 401)
  }

  /**
   * Fast-path: si el JWT no trae claim, ni siquiera consultamos BD. Esto
   * cubre el caso normal de "usuario sin rol de plataforma" sin un round-trip
   * extra.
   */
  if (!isPlatformRole(session.platformRole)) {
    throw new PlatformError(
      "NOT_PLATFORM_ADMIN",
      "Esta área requiere ser PlatformAdmin",
    )
  }

  /**
   * Defensa en profundidad: confirmamos que la fila sigue existiendo y
   * coincide con lo que firma el JWT. Esto invalida JWTs de admins revocados
   * antes de que les caduque la sesión.
   */
  const row = await db.platformAdmin.findUnique({
    where: { userId: session.userId },
    select: { role: true },
  })

  if (!row || !isPlatformRole(row.role)) {
    throw new PlatformError(
      "NOT_PLATFORM_ADMIN",
      "Tu acceso de plataforma fue revocado. Vuelve a iniciar sesión.",
    )
  }

  if (PLATFORM_LEVEL[row.role] < PLATFORM_LEVEL[min]) {
    throw new PlatformError(
      "INSUFFICIENT_PLATFORM_ROLE",
      `Requiere rol de plataforma ${min} o superior`,
    )
  }

  return { session, platformRole: row.role }
}

/**
 * Aliases por nivel — preferir éstos en sitios concretos para que el lector
 * vea de un vistazo qué nivel mínimo se exige sin tener que mirar el string.
 */
export const requirePlatformSuper = () => requirePlatformRole("SUPER_ADMIN")
export const requirePlatformAdmin = () => requirePlatformRole("ADMIN")
export const requirePlatformSupport = () => requirePlatformRole("SUPPORT")
export const requirePlatformBilling = () => requirePlatformRole("BILLING")

/**
 * "Cualquier PlatformAdmin sirve". Equivalente al nivel mínimo (`BILLING`)
 * pero más expresivo en la lectura: deja claro que el endpoint solo necesita
 * que el caller esté dentro del control plane, no un nivel concreto.
 *
 * Útil para `/api/system/me` y otros endpoints puramente informacionales.
 */
export const requireAnyPlatformRole = () => requirePlatformRole("BILLING")
