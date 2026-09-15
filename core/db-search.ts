/**
 * Text filters for Prisma `where` clauses (NEON-01 / R1; PostgreSQL semantics
 * fixed in NEON-03).
 *
 * WHY THIS EXISTS
 * ---------------
 * Every "the user typed some text, find rows that contain it" filter in 7F was
 * a plain Prisma `{ contains: text }`. On SQLite/Turso that is CASE-INSENSITIVE
 * for ASCII because SQLite's `LIKE` is; on PostgreSQL the same filter is
 * case-sensitive, and search would silently stop matching `Acme` for `acme`.
 * PostgreSQL needs `mode: "insensitive"` (Prisma renders `ILIKE`).
 *
 * This module is the ONE place that decides how a text filter becomes a
 * Prisma string filter, so the provider flip changed search semantics in one
 * function instead of 100+ call sites.
 *
 * SEMANTIC FAMILIES (NEON-03 classification, decided with evidence per site)
 * -------------------------------------------------------------------------
 * A. FREE-TEXT SEARCH (`searchContains`, `searchStartsWith`): a human typed
 *    text into a search box (or an agent forwarded a query): nombre,
 *    descripción, subject, copy, notas, email, empresa… Case-insensitive on
 *    PostgreSQL — the behaviour users have today on Turso.
 * B. STRUCTURED PARTIAL FILTER (`structuredContains`): a named filter
 *    parameter with its own contract that happens to use a partial match.
 *    Each call site declares what the value IS:
 *      - `"identifier"` — a technical code (`Proyecto.customId`: generated or
 *        operator-entered project codes such as `PRJ-007`). Exact case on
 *        PostgreSQL: identifiers are compared as written.
 *      - `"text"` — human-typed text carried by a structured parameter
 *        (`Proyecto.assignedTo` and `ContentPiece.responsable` hold display
 *        names such as "Ana R.", `Proyecto.tags` free-form tags). Case-
 *        insensitive, like family A, because the values are prose.
 * C. JSON / STRUCTURED-STRING lookups keep their literal `{ contains }` at the
 *    call site, each with an explicit decision:
 *      - `Notification.link` contains a conversation id (exact, ids are
 *        case-sensitive cuids);
 *      - `Cliente.customId` `startsWith` the generated prefix (exact: the
 *        prefix constant and the generator share the same casing);
 *      - `Message.metadata` Message-ID lookups in
 *        `modules/inbox/email-inbound.ts`: the RFC id is normalised to
 *        lower-case before searching while the persisted header keeps its
 *        casing, so those three lookups carry `mode: "insensitive"` explicitly
 *        (pinned by `modules/inbox/email-message-id.postgres.integration.test.ts`);
 *        the historical `sourceId` fallback matches verbatim (exact).
 * D. AUTHORIZATION: `Proyecto.allowedUsers` contains a user id (JSON array).
 *    Exact, case-sensitive — an authorization check must never widen.
 */

/** Prisma's case-insensitive query mode; typed as the literal so no cast is needed at call sites. */
export type InsensitiveMode = "insensitive"

/** Shape accepted by every Prisma string filter (nullable or not): case-insensitive contains. */
export interface SearchTextFilter {
  readonly contains: string
  readonly mode: InsensitiveMode
}

export interface SearchPrefixFilter {
  readonly startsWith: string
  readonly mode: InsensitiveMode
}

/** Exact-case partial match (no `mode`): the PostgreSQL default. */
export interface IdentifierContainsFilter {
  readonly contains: string
}

export type StructuredContainsFilter = SearchTextFilter | IdentifierContainsFilter

/** Family A — "rows whose field contains this user-typed text" (case-insensitive). */
export function searchContains(text: string): SearchTextFilter {
  return { contains: text, mode: "insensitive" }
}

/** Family A — "rows whose field starts with this user-typed text" (case-insensitive). */
export function searchStartsWith(prefix: string): SearchPrefixFilter {
  return { startsWith: prefix, mode: "insensitive" }
}

/**
 * What a structured filter value IS. Required at every call site so a
 * structured parameter can never inherit search semantics by accident.
 */
export type StructuredSemantics = "identifier" | "text"

/**
 * Family B — partial match for a STRUCTURED filter parameter. `"identifier"`
 * compares exactly (case-sensitive); `"text"` is case-insensitive because the
 * value is human prose carried by a named parameter.
 */
export function structuredContains(value: string, semantics: StructuredSemantics): StructuredContainsFilter {
  return semantics === "text" ? { contains: value, mode: "insensitive" } : { contains: value }
}
