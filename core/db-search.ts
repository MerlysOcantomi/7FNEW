/**
 * Text filters for Prisma `where` clauses (NEON-01 / R1).
 *
 * WHY THIS EXISTS
 * ---------------
 * Every "the user typed some text, find rows that contain it" filter in 7F is
 * a plain Prisma `{ contains: text }`. On SQLite/Turso that is CASE-INSENSITIVE
 * for ASCII because SQLite's `LIKE` is; on PostgreSQL the same filter is
 * case-sensitive, and search would silently stop matching `Acme` for `acme`.
 * PostgreSQL needs `mode: "insensitive"` — a key the SQLite-generated Prisma
 * client does not accept, so it cannot be written at the call sites today
 * without lying to the type checker.
 *
 * This module is the ONE place that decides how a text filter becomes a
 * Prisma string filter. Today every helper returns exactly what the call
 * sites used to write, so behaviour on Turso is byte-for-byte unchanged.
 *
 * TWO SEMANTIC FAMILIES — KEPT APART ON PURPOSE
 * ---------------------------------------------
 * A. FREE-TEXT SEARCH (`searchContains`, `searchStartsWith`): a human typed
 *    text into a search box (or an agent forwarded a query): nombre,
 *    descripción, subject, copy, notas, email, empresa… When the datasource
 *    provider flips to PostgreSQL (NEON-02), `mode: "insensitive"` is added
 *    to THESE helpers, once, against the PostgreSQL client's own types — no
 *    casts, no `any` — so search keeps the case-insensitive behaviour users
 *    have today.
 * B. STRUCTURED PARTIAL FILTER (`structuredContains`): a named filter
 *    parameter with its own contract — `customId`, `assignedTo`, `tag`,
 *    `responsable` — that happens to use a partial match. These are NOT
 *    search and must NOT change semantics as a side effect of NEON-02. Their
 *    PostgreSQL case behaviour is decided per parameter, with evidence of the
 *    functional contract, in NEON-02; until then the helper is a plain
 *    `{ contains }` and exists only so the two families cannot be confused.
 *
 * WHAT DOES NOT BELONG HERE
 * -------------------------
 * `contains` filters whose meaning is an IDENTITY match keep their literal
 * `{ contains }` at the call site and are listed in the NEON-01 report:
 *   - `Proyecto.allowedUsers` (authorization by id inside a JSON array),
 *   - `Notification.link` (conversation id inside a URL),
 *   - `Cliente.customId` `startsWith` (generated id prefix),
 *   - `Message.metadata` lookups in `modules/inbox/email-inbound.ts`. NOTE:
 *     the RFC Message-ID lookups there normalise the id to lower-case before
 *     searching while the persisted metadata keeps the header's original
 *     casing — they RELY on SQLite's case-insensitive `LIKE`. On PostgreSQL
 *     they must keep case-insensitive semantics (see
 *     `modules/inbox/email-message-id-casing.test.ts`); that is a NEON-02
 *     change against the PostgreSQL client, not a `searchContains` call.
 */

/** Shape accepted by every Prisma string filter (nullable or not) on both providers. */
export interface SearchTextFilter {
  readonly contains: string
}

export interface SearchPrefixFilter {
  readonly startsWith: string
}

/** Family A — "rows whose field contains this user-typed text" (case-insensitive search semantics). */
export function searchContains(text: string): SearchTextFilter {
  return { contains: text }
}

/** Family A — "rows whose field starts with this user-typed text" (case-insensitive search semantics). */
export function searchStartsWith(prefix: string): SearchPrefixFilter {
  return { startsWith: prefix }
}

/**
 * Family B — partial match for a STRUCTURED filter parameter (customId,
 * assignedTo, tag, responsable…). Deliberately a different function from
 * `searchContains`: NEON-02 changes free-text search in one place and must
 * not touch these. Case behaviour on PostgreSQL is decided per call site.
 */
export function structuredContains(value: string): SearchTextFilter {
  return { contains: value }
}
