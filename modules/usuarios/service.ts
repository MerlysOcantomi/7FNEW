import { db } from "@core/db"
import type { Prisma } from "@/generated/prisma/client"
import { WorkspaceError } from "@core/workspace-context"
import {
  normalizeEmail,
  requireWorkspaceScope,
  resolveEmailScope,
  resolveUsuarioScope,
  resolveVisibleUsuarioIds,
  type UsuarioScope,
} from "./scope"
import { searchContains } from "@core/db-search"

/**
 * Usuario service — workspace-contained (CORE-01).
 *
 * `Usuario` is a legacy platform-global model with no `workspaceId` column,
 * so tenancy cannot be expressed as a `where` clause here. Every function
 * therefore takes a MANDATORY `workspaceId` and routes its ownership
 * decision through `./scope`, which is the single source of truth for
 * "does this row belong to this workspace?".
 *
 * Read/write asymmetry, stated once:
 *   - READS expose `exclusive` and `shared` rows, because a `shared` row is
 *     still a genuine member of this workspace and hiding them would make
 *     real teammates vanish from their own directory. Every returned record
 *     carries `workspaceScope` so no consumer can mistake a shared row for
 *     an exclusively-owned one.
 *   - WRITES accept `exclusive` rows only. `Usuario.nombre`, `.email`,
 *     `.rol`, `.departamento` and `.estado` are global columns; writing them
 *     from one workspace would rewrite what every other workspace sees.
 *
 * Out-of-scope ids resolve to `null` (which routes translate to 404) rather
 * than to an error that would confirm the id exists elsewhere.
 */

/** Public row shape: the Prisma row plus its resolved ownership class. */
export type ScopedUsuario<T> = T & { workspaceScope: UsuarioScope }

interface ListParams {
  skip?: number
  take?: number
  rol?: string
  departamento?: string
  estado?: string
  search?: string
  workspaceId: string
}

export async function list(params: ListParams) {
  const { skip = 0, take = 20, rol, departamento, estado, search, workspaceId } = params
  const activeWorkspaceId = requireWorkspaceScope(workspaceId)

  const filters: Prisma.UsuarioWhereInput = {
    ...(rol && { rol }),
    ...(departamento && { departamento }),
    ...(estado && { estado }),
    ...(search && {
      OR: [
        { nombre: searchContains(search) },
        { email: searchContains(search) },
      ],
    }),
  }

  /**
   * Phase 1 — narrow projection of the caller's filtered candidates. Only
   * `id` and `email` are read; the rest of the row is never materialised for
   * anything the workspace turns out not to own.
   */
  const candidates = await db.usuario.findMany({
    where: filters,
    select: { id: true, email: true },
  })

  const { ids, decisions } = await resolveVisibleUsuarioIds(activeWorkspaceId, candidates)

  /**
   * Phase 2 — the visible ids become the ONLY predicate, and `findMany` and
   * `count` share it verbatim. The caller's filters are already baked into
   * that id set, so the page and the total cannot drift apart.
   */
  const where: Prisma.UsuarioWhereInput = { id: { in: ids } }

  const [rows, total] = await Promise.all([
    db.usuario.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
    db.usuario.count({ where }),
  ])

  const data = rows.map((row) => ({
    ...row,
    workspaceScope: decisions.get(row.id)?.scope ?? "orphan",
  }))

  return { data, total }
}

export async function getById(id: string, workspaceId: string) {
  const activeWorkspaceId = requireWorkspaceScope(workspaceId)

  /**
   * The id lookup is a CANDIDATE fetch, never the authorisation decision —
   * the row is only released after `resolveUsuarioScope` proves ownership.
   * The related tasks are constrained by `workspaceId` inside the query
   * itself, so another tenant's task content can never ride along on the
   * relation (the exact leak CORE-00 recorded for the previous
   * `include: { tareas: true }`).
   */
  const record = await db.usuario.findFirst({
    where: { id },
    include: { tareas: { where: { workspaceId: activeWorkspaceId } } },
  })
  if (!record) return null

  const decision = await resolveUsuarioScope(activeWorkspaceId, record)
  if (!decision.visible) return null

  return { ...record, workspaceScope: decision.scope }
}

export async function create(data: Prisma.UsuarioCreateInput, workspaceId: string) {
  const activeWorkspaceId = requireWorkspaceScope(workspaceId)

  const email = normalizeEmail(data.email)
  const decision = await resolveEmailScope(activeWorkspaceId, email)
  if (!decision.mutable || !email) {
    /**
     * Known, accepted limitation of the containment layer: this module can
     * only register somebody who is ALREADY an exclusive member of the
     * workspace. Real invitation flows (creating a `User` and a
     * `WorkspaceMember`) are out of scope for CORE-01 and stay out until
     * `Usuario.workspaceId` exists.
     */
    throw new WorkspaceError(
      "FORBIDDEN",
      "Solo puede registrarse a una persona que ya sea miembro exclusivo de este workspace",
      403,
    )
  }

  /**
   * Persist the normalised email so newly created rows always correlate with
   * their `User` account, which is stored lowercase everywhere it is written.
   * A duplicate email still surfaces as Prisma `P2002` and is translated to a
   * 409 by `handleError` — conflict behaviour is unchanged.
   */
  return db.usuario.create({ data: { ...data, email } })
}

export async function update(
  id: string,
  data: Prisma.UsuarioUpdateInput,
  workspaceId: string,
) {
  const activeWorkspaceId = requireWorkspaceScope(workspaceId)

  const current = await db.usuario.findFirst({
    where: { id },
    select: { id: true, email: true },
  })
  if (!current) return null

  const decision = await resolveUsuarioScope(activeWorkspaceId, current)
  if (!decision.mutable) return null

  /**
   * A changed email can move the row out of this workspace, so the NEW value
   * is validated with the same rule before anything is written. Unlike an
   * out-of-scope id (which is indistinguishable from "not found"), this is a
   * genuine input problem in the caller's own workspace, so it is reported
   * as such — the message reveals nothing about any other tenant.
   */
  const nextEmail = extractScalar(data.email)
  if (nextEmail !== undefined) {
    const normalized = normalizeEmail(nextEmail)
    const nextDecision = await resolveEmailScope(activeWorkspaceId, normalized)
    if (!nextDecision.mutable || !normalized) {
      throw new WorkspaceError(
        "FORBIDDEN",
        "El email indicado no corresponde a un miembro exclusivo de este workspace",
        403,
      )
    }
    return db.usuario.update({ where: { id }, data: { ...data, email: normalized } })
  }

  return db.usuario.update({ where: { id }, data })
}

export async function remove(id: string, workspaceId: string) {
  const activeWorkspaceId = requireWorkspaceScope(workspaceId)

  const current = await db.usuario.findFirst({
    where: { id },
    select: { id: true, email: true },
  })
  if (!current) return null

  /**
   * `resolveUsuarioScope` already downgrades a row referenced by a foreign or
   * NULL-workspace `Tarea` to `shared`, so this single check also covers the
   * delete-side hazard: `Tarea.usuarioId` is `onDelete: SetNull`, and a
   * blocked delete leaves every one of those assignments untouched.
   */
  const decision = await resolveUsuarioScope(activeWorkspaceId, current)
  if (!decision.mutable) return null

  return db.usuario.delete({ where: { id } })
}

/**
 * Read a plain value out of a Prisma update input, which may be either the
 * bare scalar or a `{ set: ... }` field-update operation. Returns `undefined`
 * when the field is absent, so "not provided" stays distinguishable from
 * "provided as null".
 */
function extractScalar(
  value: Prisma.UsuarioUpdateInput["email"],
): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value === "string") return value
  if (typeof value === "object" && "set" in value) {
    const inner = value.set
    return typeof inner === "string" ? inner : null
  }
  return undefined
}

/**
 * Re-exported so `modules/tareas/service.ts` and future callers reach the
 * ownership rule through one documented door instead of re-deriving it.
 */
export { resolveUsuarioScopes, resolveUsuarioScope, assertUsuarioAssignable } from "./scope"
