import { db } from "@core/db"
import type { Prisma } from "@/generated/prisma/client"
import {
  assertUsuarioAssignable,
  requireWorkspaceScope,
  resolveUsuarioScopes,
} from "@modules/usuarios/scope"
import { searchContains } from "@core/db-search"

/**
 * Tarea service — workspace-scoped, with legacy-assignee containment (CORE-01).
 *
 * `Tarea` itself was already correctly scoped: every function takes a
 * mandatory `workspaceId` and filters on it exactly. What CORE-00 found was
 * the ASSIGNEE edge — `Tarea.usuarioId` points at the platform-global
 * `Usuario` model, so nothing stopped a task in workspace A from pointing at
 * a person who belongs to workspace B.
 *
 * CORE-01 closes both directions of that edge:
 *   - WRITE: `create` and `update` refuse an assignee that cannot be proven
 *     to belong exclusively to the active workspace, BEFORE any row is
 *     written. No new cross-workspace link can be created.
 *   - READ: `list` and `getById` keep the task (it is legitimately this
 *     workspace's) but blank the `usuario` relation when the assignee's
 *     ownership cannot be proven, so a pre-existing bad link cannot leak
 *     another tenant's person data.
 *
 * Reads deliberately do NOT repair anything. A task with a legacy foreign
 * assignee keeps its raw `usuarioId` — an opaque identifier carrying no
 * personal data — and stays fully visible to its own workspace. Rewriting
 * data to "fix" it would be a silent migration, which belongs to the
 * `Usuario.workspaceId` mission, not here.
 */

interface ListParams {
  skip?: number
  take?: number
  estado?: string
  prioridad?: string
  proyectoId?: string
  clienteId?: string
  usuarioId?: string
  search?: string
  workspaceId: string
}

/** The subset of the `usuario` relation these queries materialise. */
type TareaUsuarioRelation = { id: string; email: string | null }

/**
 * Blank out any `usuario` relation whose owner this workspace cannot prove.
 *
 * Mutates nothing in the database — it only narrows what leaves the service.
 * `visible` (exclusive OR shared) is the right bar here rather than
 * `mutable`: a person who legitimately works in this workspace should still
 * be shown on their own tasks, while anyone this workspace cannot account for
 * is dropped from the payload.
 */
async function sanitizeUsuarioRelation<
  T extends { usuario: TareaUsuarioRelation | null },
>(rows: T[], workspaceId: string): Promise<T[]> {
  const candidates = rows
    .map((row) => row.usuario)
    .filter((usuario): usuario is TareaUsuarioRelation => usuario !== null)

  if (candidates.length === 0) return rows

  const decisions = await resolveUsuarioScopes(workspaceId, candidates)

  return rows.map((row) => {
    if (!row.usuario) return row
    if (decisions.get(row.usuario.id)?.visible === true) return row
    return { ...row, usuario: null }
  })
}

export async function list(params: ListParams) {
  const { skip = 0, take = 20, estado, prioridad, proyectoId, clienteId, usuarioId, search, workspaceId } = params
  const activeWorkspaceId = requireWorkspaceScope(workspaceId)

  const where: Prisma.TareaWhereInput = {
    workspaceId: activeWorkspaceId,
    ...(estado && { estado }),
    ...(prioridad && { prioridad }),
    ...(proyectoId && { proyectoId }),
    ...(clienteId && { clienteId }),
    ...(usuarioId && { usuarioId }),
    ...(search && {
      OR: [
        { titulo: searchContains(search) },
        { descripcion: searchContains(search) },
      ],
    }),
  }

  const [rows, total] = await Promise.all([
    db.tarea.findMany({
      where,
      skip,
      take,
      include: { proyecto: true, cliente: true, usuario: true },
      orderBy: { createdAt: "desc" },
    }),
    db.tarea.count({ where }),
  ])

  const data = await sanitizeUsuarioRelation(rows, activeWorkspaceId)

  return { data, total }
}

export async function getById(id: string, workspaceId: string) {
  const activeWorkspaceId = requireWorkspaceScope(workspaceId)

  const record = await db.tarea.findFirst({
    where: { id, workspaceId: activeWorkspaceId },
    include: { proyecto: true, cliente: true, usuario: true },
  })
  if (!record) return null

  const [sanitized] = await sanitizeUsuarioRelation([record], activeWorkspaceId)
  return sanitized
}

export async function create(data: Prisma.TareaUncheckedCreateInput, workspaceId: string) {
  const activeWorkspaceId = requireWorkspaceScope(workspaceId)

  /**
   * Assignment gate runs BEFORE the insert. `assertUsuarioAssignable` throws a
   * `WorkspaceError` (translated to a 400 by `handleError`) for a foreign,
   * shared, orphan or otherwise ambiguous target, so no partially-valid task
   * is ever persisted. A null assignee stays "Unassigned" and is a no-op.
   */
  await assertUsuarioAssignable(activeWorkspaceId, data.usuarioId)

  return db.tarea.create({ data: { ...data, workspaceId: activeWorkspaceId } })
}

export async function update(
  id: string,
  data: Prisma.TareaUncheckedUpdateInput,
  workspaceId: string,
) {
  const activeWorkspaceId = requireWorkspaceScope(workspaceId)

  const existing = await db.tarea.findFirst({ where: { id, workspaceId: activeWorkspaceId } })
  if (!existing) return null

  /**
   * Only validate when the caller actually touches the assignee. An update
   * that leaves `usuarioId` alone must not start failing because of a legacy
   * link it did not create — that would make unrelated edits impossible on
   * exactly the rows that most need editing.
   */
  const nextAssignee = extractAssigneeId(data.usuarioId)
  if (nextAssignee !== undefined) {
    await assertUsuarioAssignable(activeWorkspaceId, nextAssignee)
  }

  return db.tarea.update({ where: { id }, data })
}

export async function remove(id: string, workspaceId: string) {
  const activeWorkspaceId = requireWorkspaceScope(workspaceId)

  const existing = await db.tarea.findFirst({ where: { id, workspaceId: activeWorkspaceId } })
  if (!existing) return null
  return db.tarea.delete({ where: { id } })
}

/**
 * Read the assignee out of a Prisma update input, which may be the bare
 * scalar or a `{ set: ... }` field-update operation. Returns `undefined` when
 * the field is absent so "not provided" stays distinguishable from
 * "explicitly cleared".
 */
function extractAssigneeId(
  value: Prisma.TareaUncheckedUpdateInput["usuarioId"],
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
