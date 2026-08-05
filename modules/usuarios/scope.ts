import { db } from "@core/db"
import { WorkspaceError } from "@core/workspace-context"

/**
 * Usuario workspace-scope resolver (CORE-01 — legacy containment).
 *
 * WHY THIS EXISTS
 * ---------------
 * `Usuario` is a LEGACY, PLATFORM-GLOBAL model: it has no `workspaceId`
 * column and no `Workspace` relation (see `model Usuario` in
 * `prisma/schema.prisma`). Until that column exists, "does this Usuario
 * belong to the active workspace?" cannot be answered by a `where` clause —
 * it has to be DERIVED. This module is the single place that derives it.
 *
 * The definitive fix (adding `Usuario.workspaceId` plus a
 * `@@unique([workspaceId, email])` constraint) is deliberately OUT OF SCOPE
 * for CORE-01: it is a schema change and must wait until CORE-03 lands a
 * reproducible migration history. Everything here is containment.
 *
 * THE OWNERSHIP CONTRACT
 * ----------------------
 * A `Usuario` is only safe to treat as belonging to the active workspace
 * when ALL of the following hold:
 *
 *   1. its `email` matches a real `User` account;
 *   2. that `User` has a `WorkspaceMember` row in the ACTIVE workspace;
 *   3. nothing makes the row ambiguous across tenants.
 *
 * Point 3 is the part that a naive "is this email one of my members?" check
 * gets wrong. Two distinct sources of ambiguity are treated as disqualifying:
 *
 *   a. MULTI-WORKSPACE MEMBERSHIP. If the underlying `User` belongs to more
 *      than one workspace, the single global `Usuario` row is shared between
 *      them. Its `nombre`, `email`, `rol`, `departamento` and `estado` are
 *      global columns that cannot hold a different value per workspace, so
 *      writing to them from one workspace silently rewrites what the other
 *      workspace sees.
 *
 *   b. FOREIGN OR UNSCOPED TASK REFERENCES. If the row is referenced by a
 *      `Tarea` belonging to another workspace — or by a `Tarea` whose
 *      `workspaceId` is NULL, which is reachable from no workspace at all —
 *      then deleting it would `SetNull` that foreign assignment
 *      (`Tarea.usuarioId` is `onDelete: SetNull`). Mutating another tenant's
 *      data as a side effect of a local delete is exactly what CORE-00
 *      flagged.
 *
 * RESULTING CLASSIFICATION
 * ------------------------
 *   - `exclusive` — provably this workspace's, and only this workspace's.
 *                   The ONLY class that may be created, updated, deleted or
 *                   assigned to a `Tarea`.
 *   - `shared`    — a real member here, but also reachable from elsewhere.
 *                   READABLE (hiding a genuine team member from their own
 *                   workspace's directory would be a functional regression),
 *                   but never mutable and never assignable. Always surfaced
 *                   with an explicit marker so no caller can mistake it for
 *                   an exclusively-owned record.
 *   - `foreign`   — belongs to some other workspace. Invisible here.
 *   - `orphan`    — no `User` account, or no membership anywhere. Invisible
 *                   here; it cannot be proven to belong to anyone.
 *
 * `foreign` and `orphan` are deliberately NOT distinguished by any caller in
 * their responses: both behave as "not found" so a caller cannot use the
 * difference to probe whether an id exists in another tenant.
 *
 * TRUST BOUNDARY
 * --------------
 * `workspaceId` MUST come from `requireReadAccess` / `requireWriteAccess` /
 * `requireAdminAccess`. Nothing in this module accepts a workspace hint from
 * a request body, query string or route param, and no exported function
 * takes an "assume this is fine" escape hatch.
 */

/** Ownership classes a legacy `Usuario` row can fall into. */
export type UsuarioScope = "exclusive" | "shared" | "foreign" | "orphan"

/**
 * Machine-readable justification for a decision. Kept deliberately coarse:
 * these strings are safe to log and to assert on in tests, and they never
 * name another workspace, user or tenant.
 */
export type UsuarioScopeReason =
  | "no_email"
  | "no_user_account"
  | "not_a_member"
  | "multi_workspace_member"
  | "foreign_or_unscoped_tasks"

export interface UsuarioScopeDecision {
  scope: UsuarioScope
  /** True only for `exclusive`. The single flag every write path must honour. */
  mutable: boolean
  /** True for `exclusive` and `shared` — i.e. a real member of this workspace. */
  visible: boolean
  reasons: UsuarioScopeReason[]
}

/** Minimal shape the resolvers need. Accepts any row that carries id + email. */
export interface UsuarioScopeCandidate {
  id: string
  email: string | null
}

/**
 * Guard for the tenant argument itself. Every exported entry point calls it
 * BEFORE issuing a query or a write, so a caller that forgets to thread the
 * workspace through fails loudly instead of silently operating platform-wide.
 *
 * Throws a plain `Error` (not a `WorkspaceError`) on purpose: reaching this
 * means an internal caller is wired wrong, not that a client sent bad input.
 * Mirrors the same defence in `modules/today/aggregator.ts`.
 */
export function requireWorkspaceScope(workspaceId: string | null | undefined): string {
  if (!workspaceId || typeof workspaceId !== "string" || workspaceId.trim().length === 0) {
    throw new Error("Usuario scope requires a non-empty workspaceId resolved from the session")
  }
  return workspaceId
}

/**
 * Canonical email form used for every cross-model comparison.
 *
 * `User.email` is written lowercase everywhere it is created (the Google
 * callback and the dev-login route both lowercase it before persisting), but
 * `Usuario.email` has never been normalised — `createUsuarioSchema` only
 * validates the shape. Comparing raw values would therefore mis-classify a
 * legitimate member as `orphan`, so both sides are normalised here.
 */
export function normalizeEmail(email: string | null | undefined): string | null {
  if (typeof email !== "string") return null
  const normalized = email.trim().toLowerCase()
  return normalized.length > 0 ? normalized : null
}

/**
 * Facts needed to classify one row. Split out from the DB access so the rule
 * itself is pure and exhaustively testable without a database.
 */
export interface UsuarioScopeFacts {
  email: string | null
  /** A `User` row exists for this email. */
  userExists: boolean
  /** That `User` has a `WorkspaceMember` row in the ACTIVE workspace. */
  isMemberOfActiveWorkspace: boolean
  /** How many workspaces that `User` belongs to in total. */
  membershipCount: number
  /** The row is referenced by a `Tarea` of another workspace, or with `workspaceId = NULL`. */
  hasForeignOrUnscopedTasks: boolean
}

/**
 * The ownership rule. Pure: same facts in, same decision out, no I/O.
 *
 * Order matters — the checks run from "cannot be attributed to anyone" to
 * "attributable but ambiguous", so the reported reason is always the most
 * fundamental one.
 */
export function classifyUsuarioScope(facts: UsuarioScopeFacts): UsuarioScopeDecision {
  const reasons: UsuarioScopeReason[] = []

  if (!normalizeEmail(facts.email)) {
    return { scope: "orphan", mutable: false, visible: false, reasons: ["no_email"] }
  }
  if (!facts.userExists) {
    return { scope: "orphan", mutable: false, visible: false, reasons: ["no_user_account"] }
  }
  if (!facts.isMemberOfActiveWorkspace) {
    /**
     * A `User` with zero memberships anywhere is an orphan; one with
     * memberships that simply do not include the active workspace belongs to
     * somebody else. Neither is visible here, and callers must not be able to
     * tell them apart from the outside.
     */
    const scope: UsuarioScope = facts.membershipCount === 0 ? "orphan" : "foreign"
    return { scope, mutable: false, visible: false, reasons: ["not_a_member"] }
  }

  if (facts.membershipCount > 1) reasons.push("multi_workspace_member")
  if (facts.hasForeignOrUnscopedTasks) reasons.push("foreign_or_unscoped_tasks")

  if (reasons.length > 0) {
    return { scope: "shared", mutable: false, visible: true, reasons }
  }
  return { scope: "exclusive", mutable: true, visible: true, reasons: [] }
}

interface UserMembershipFacts {
  userExists: boolean
  isMemberOfActiveWorkspace: boolean
  membershipCount: number
}

const MISSING_USER: UserMembershipFacts = {
  userExists: false,
  isMemberOfActiveWorkspace: false,
  membershipCount: 0,
}

/**
 * Resolve account + membership facts for a set of emails in ONE query.
 *
 * Both the raw and the normalised spelling of every email are sent to the
 * database because SQLite/libSQL `IN` is case-sensitive; the results are then
 * re-indexed by normalised email so the comparison itself is not.
 */
async function loadUserMembershipFacts(
  workspaceId: string,
  emails: ReadonlyArray<string | null>,
): Promise<Map<string, UserMembershipFacts>> {
  const lookup = new Map<string, UserMembershipFacts>()

  const variants = new Set<string>()
  for (const raw of emails) {
    const normalized = normalizeEmail(raw)
    if (!normalized) continue
    variants.add(normalized)
    if (typeof raw === "string" && raw.trim().length > 0) variants.add(raw.trim())
  }
  if (variants.size === 0) return lookup

  const users = await db.user.findMany({
    where: { email: { in: [...variants] } },
    select: {
      email: true,
      memberships: { select: { workspaceId: true } },
    },
  })

  for (const user of users) {
    const key = normalizeEmail(user.email)
    if (!key) continue
    const workspaceIds = new Set(user.memberships.map((m) => m.workspaceId))
    lookup.set(key, {
      userExists: true,
      isMemberOfActiveWorkspace: workspaceIds.has(workspaceId),
      membershipCount: workspaceIds.size,
    })
  }

  return lookup
}

/**
 * Which of these `Usuario` ids are referenced by a `Tarea` that this
 * workspace must not be able to disturb — another tenant's task, or a task
 * with a NULL `workspaceId` (unreachable from any tenant, and therefore
 * impossible to attribute).
 *
 * The explicit `workspaceId: null` branch is required: in SQL, `NOT` on a
 * nullable column does not match NULL rows, so `{ not: workspaceId }` alone
 * would silently miss exactly the unowned rows we care about.
 */
async function loadForeignTaskReferences(
  workspaceId: string,
  usuarioIds: ReadonlyArray<string>,
): Promise<Set<string>> {
  const flagged = new Set<string>()
  if (usuarioIds.length === 0) return flagged

  const rows = await db.tarea.findMany({
    where: {
      usuarioId: { in: [...usuarioIds] },
      OR: [{ workspaceId: null }, { workspaceId: { not: workspaceId } }],
    },
    select: { usuarioId: true },
    distinct: ["usuarioId"],
  })

  for (const row of rows) {
    if (row.usuarioId) flagged.add(row.usuarioId)
  }
  return flagged
}

/**
 * Classify a batch of candidate rows. Two queries total regardless of batch
 * size — one for accounts/memberships, one for foreign task references.
 *
 * Returns a map keyed by `Usuario.id`. Every input id is present in the
 * result, so callers never have to treat "missing" as a special case.
 */
export async function resolveUsuarioScopes(
  workspaceId: string,
  candidates: ReadonlyArray<UsuarioScopeCandidate>,
): Promise<Map<string, UsuarioScopeDecision>> {
  const activeWorkspaceId = requireWorkspaceScope(workspaceId)
  const decisions = new Map<string, UsuarioScopeDecision>()
  if (candidates.length === 0) return decisions

  const [userFacts, foreignTaskIds] = await Promise.all([
    loadUserMembershipFacts(
      activeWorkspaceId,
      candidates.map((c) => c.email),
    ),
    loadForeignTaskReferences(
      activeWorkspaceId,
      candidates.map((c) => c.id),
    ),
  ])

  for (const candidate of candidates) {
    const key = normalizeEmail(candidate.email)
    const facts = (key && userFacts.get(key)) || MISSING_USER
    decisions.set(
      candidate.id,
      classifyUsuarioScope({
        email: candidate.email,
        userExists: facts.userExists,
        isMemberOfActiveWorkspace: facts.isMemberOfActiveWorkspace,
        membershipCount: facts.membershipCount,
        hasForeignOrUnscopedTasks: foreignTaskIds.has(candidate.id),
      }),
    )
  }

  return decisions
}

/** Single-row convenience wrapper over {@link resolveUsuarioScopes}. */
export async function resolveUsuarioScope(
  workspaceId: string,
  candidate: UsuarioScopeCandidate,
): Promise<UsuarioScopeDecision> {
  const decisions = await resolveUsuarioScopes(workspaceId, [candidate])
  return (
    decisions.get(candidate.id) ?? {
      scope: "orphan",
      mutable: false,
      visible: false,
      reasons: ["no_user_account"],
    }
  )
}

/**
 * Classify an EMAIL rather than an existing row — the pre-write check for
 * `create`, and for an `update` that changes the email.
 *
 * There is no `Usuario` row yet, so the task-reference dimension does not
 * apply; account existence and membership exclusivity still do.
 */
export async function resolveEmailScope(
  workspaceId: string,
  email: string | null | undefined,
): Promise<UsuarioScopeDecision> {
  const activeWorkspaceId = requireWorkspaceScope(workspaceId)
  const normalized = normalizeEmail(email)
  if (!normalized) {
    return { scope: "orphan", mutable: false, visible: false, reasons: ["no_email"] }
  }

  const userFacts = await loadUserMembershipFacts(activeWorkspaceId, [normalized])
  const facts = userFacts.get(normalized) ?? MISSING_USER

  return classifyUsuarioScope({
    email: normalized,
    userExists: facts.userExists,
    isMemberOfActiveWorkspace: facts.isMemberOfActiveWorkspace,
    membershipCount: facts.membershipCount,
    hasForeignOrUnscopedTasks: false,
  })
}

/**
 * The set of `Usuario` ids this workspace may see, resolved from the rows
 * that already match the caller's own filters.
 *
 * Why a two-phase resolution instead of a single `where` clause: ownership
 * depends on `User` + `WorkspaceMember` + `Tarea` state that no `Usuario`
 * column carries, and SQLite/libSQL has no case-insensitive `IN`. Phase one
 * therefore projects only `id` and `email` (two short columns) for the
 * caller's filtered candidates; phase two turns the surviving ids into an
 * exact filter that `findMany` and `count` can BOTH use, so the page and the
 * total can never disagree.
 *
 * The surviving set is bounded by the workspace's own membership count, not
 * by the size of the global table.
 */
export async function resolveVisibleUsuarioIds(
  workspaceId: string,
  candidates: ReadonlyArray<UsuarioScopeCandidate>,
): Promise<{ ids: string[]; decisions: Map<string, UsuarioScopeDecision> }> {
  const decisions = await resolveUsuarioScopes(workspaceId, candidates)
  const ids = candidates
    .filter((candidate) => decisions.get(candidate.id)?.visible === true)
    .map((candidate) => candidate.id)
  return { ids, decisions }
}

/**
 * Assignment gate for `Tarea.usuarioId`.
 *
 * Resolves to the id when the assignment is safe, or `null` when there is no
 * assignee. Throws a `WorkspaceError` (mapped to a 400 by `handleError`, so
 * no route needs its own translation) when the target cannot be proven to be
 * exclusively this workspace's.
 *
 * `shared` is rejected as well as `foreign`: a `Tarea` pointing at a row that
 * another workspace can also reach is precisely how a cross-tenant link gets
 * created, which is what CORE-01 exists to stop.
 *
 * The message names only the active workspace, never where the id actually
 * lives, so a rejection cannot be used to probe another tenant.
 */
export async function assertUsuarioAssignable(
  workspaceId: string,
  usuarioId: string | null | undefined,
): Promise<string | null> {
  const activeWorkspaceId = requireWorkspaceScope(workspaceId)
  if (usuarioId === null || usuarioId === undefined) return null
  if (typeof usuarioId !== "string" || usuarioId.trim().length === 0) return null

  const row = await db.usuario.findFirst({
    where: { id: usuarioId },
    select: { id: true, email: true },
  })

  if (row) {
    const decision = await resolveUsuarioScope(activeWorkspaceId, row)
    if (decision.mutable) return row.id
  }

  throw new WorkspaceError(
    "INVALID_ASSIGNEE",
    "El usuario indicado no pertenece de forma exclusiva a este workspace y no puede asignarse",
    400,
  )
}
