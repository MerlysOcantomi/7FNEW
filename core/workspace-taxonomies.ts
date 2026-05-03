import { db } from "@core/db"

/**
 * Read-only access to per-workspace taxonomy vocabularies stored in
 * `Workspace.config.taxonomies`.
 *
 * Why this module exists:
 *
 *   - `scripts/seed-7f-business-taxonomies.ts` writes a structured
 *     `taxonomies` sub-object inside `Workspace.config` for the internal
 *     `7F Business` workspace (config-only seed; no rows in `InboxEntry`,
 *     `Cliente`, `Proyecto`, or `Tarea`).
 *   - Any future UI that wants to surface those labels (filter chips,
 *     autocomplete, segments…) needs a SAFE, TYPED reader instead of
 *     calling `JSON.parse(workspace.config)` ad-hoc.
 *   - This module is the single source of truth for that read path. It
 *     intentionally does NOT mutate `Workspace.config`; mutations stay
 *     in the seed script + `core/workspace.ts#updateWorkspaceConfig`.
 *
 * Safety contract (enforced by `parseWorkspaceTaxonomies`):
 *
 *   - Never throws. Any malformed or missing input returns
 *     `DEFAULT_WORKSPACE_TAXONOMIES` (empty arrays per key) and silently
 *     drops the bad slice — UI consumers can render a generic empty
 *     state without try/catch noise.
 *   - Per-key isolation: a malformed `inbox` entry does NOT poison
 *     `clients`/`projects`/`tasks`. Each list is parsed independently.
 *   - Sanitisation pass: every string is trimmed, blanks are dropped,
 *     duplicates are removed (case-sensitive, first occurrence wins),
 *     non-strings are dropped silently.
 *   - The raw `config` blob NEVER leaves this module — callers receive
 *     only the parsed taxonomy view.
 */

export type WorkspaceTaxonomyKey = "inbox" | "clients" | "projects" | "tasks"

export type WorkspaceTaxonomies = Record<WorkspaceTaxonomyKey, string[]>

/**
 * Canonical empty taxonomies. Returned by every defensive code path
 * (invalid JSON, missing key, malformed shape). Frozen so accidental
 * `defaults.inbox.push(...)` from a caller does not mutate the shared
 * fallback.
 *
 * Note: each array is also frozen — callers MUST treat the return value
 * as immutable. Spread (`[...result.inbox]`) before mutating.
 */
export const DEFAULT_WORKSPACE_TAXONOMIES: WorkspaceTaxonomies = Object.freeze({
  inbox: Object.freeze([]),
  clients: Object.freeze([]),
  projects: Object.freeze([]),
  tasks: Object.freeze([]),
}) as unknown as WorkspaceTaxonomies

const TAXONOMY_KEYS: readonly WorkspaceTaxonomyKey[] = [
  "inbox",
  "clients",
  "projects",
  "tasks",
]

/**
 * Build a fresh, empty taxonomies object. We avoid returning
 * `DEFAULT_WORKSPACE_TAXONOMIES` directly when we KNOW we'll mutate it
 * during parsing — instead we mutate this fresh copy and return it.
 *
 * The frozen default is reserved for the "early-return on bad input"
 * path where we want maximum guarantees about non-mutation.
 */
function freshTaxonomies(): WorkspaceTaxonomies {
  return {
    inbox: [],
    clients: [],
    projects: [],
    tasks: [],
  }
}

/**
 * Sanitise one list:
 *   - keep only strings
 *   - trim
 *   - drop empties
 *   - dedup (case-sensitive, first occurrence wins)
 *   - preserve order
 *
 * Bounded (`MAX_ITEMS_PER_KEY`) so a malicious or runaway config can't
 * blow up the renderer. The cap is generous (200) — well above any
 * realistic operator vocabulary — but small enough to keep the JSON
 * payload of the API endpoint trivial.
 */
const MAX_ITEMS_PER_KEY = 200

function sanitiseList(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of input) {
    if (typeof raw !== "string") continue
    const trimmed = raw.trim()
    if (!trimmed) continue
    if (seen.has(trimmed)) continue
    seen.add(trimmed)
    out.push(trimmed)
    if (out.length >= MAX_ITEMS_PER_KEY) break
  }
  return out
}

/**
 * Pure parser. Takes the raw `Workspace.config` string (or null/undef)
 * and returns a fully sanitised taxonomies object. Never throws.
 *
 * Decision matrix:
 *
 *   input                                       → output
 *   ------------------------------------------- → -------------------------
 *   null / undefined / ""                       → DEFAULT_WORKSPACE_TAXONOMIES
 *   not parseable JSON                          → DEFAULT_WORKSPACE_TAXONOMIES
 *   parsed JSON is not a plain object           → DEFAULT_WORKSPACE_TAXONOMIES
 *   `taxonomies` key missing                    → DEFAULT_WORKSPACE_TAXONOMIES
 *   `taxonomies` is not a plain object          → DEFAULT_WORKSPACE_TAXONOMIES
 *   per-key value is not an array               → empty array for that key
 *   per-key value contains non-strings          → those entries are dropped
 *   per-key value contains blanks/duplicates    → trimmed + dedup
 */
export function parseWorkspaceTaxonomies(
  config: string | null | undefined,
): WorkspaceTaxonomies {
  if (!config) return DEFAULT_WORKSPACE_TAXONOMIES

  let parsed: unknown
  try {
    parsed = JSON.parse(config)
  } catch {
    return DEFAULT_WORKSPACE_TAXONOMIES
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return DEFAULT_WORKSPACE_TAXONOMIES
  }

  const taxRaw = (parsed as Record<string, unknown>)["taxonomies"]
  if (!taxRaw || typeof taxRaw !== "object" || Array.isArray(taxRaw)) {
    return DEFAULT_WORKSPACE_TAXONOMIES
  }

  const tax = taxRaw as Record<string, unknown>
  const out = freshTaxonomies()
  for (const key of TAXONOMY_KEYS) {
    out[key] = sanitiseList(tax[key])
  }
  return out
}

/**
 * Server-side reader. Selects ONLY `Workspace.config` (no other
 * columns), parses it, and returns the sanitised taxonomies.
 *
 * Behaviour:
 *   - Workspace not found       → `DEFAULT_WORKSPACE_TAXONOMIES`
 *   - Workspace.config is null  → `DEFAULT_WORKSPACE_TAXONOMIES`
 *   - Anything else             → result of `parseWorkspaceTaxonomies`
 *
 * Authorisation: this helper does NOT authenticate. Callers MUST run
 * `requireReadAccess()` (or equivalent) FIRST and pass an already
 * authorised `workspaceId`. Misuse from an unauthorised context would
 * leak the per-workspace label vocabulary across tenants.
 *
 * The raw `config` blob is intentionally NOT returned. Callers see only
 * the parsed view, so accidental over-exposure of unrelated config keys
 * (e.g. `businessProfile`, `kind`, custom operator data) is structurally
 * impossible from this helper.
 */
export async function getWorkspaceTaxonomies(
  workspaceId: string,
): Promise<WorkspaceTaxonomies> {
  const ws = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { config: true },
  })
  if (!ws) return DEFAULT_WORKSPACE_TAXONOMIES
  return parseWorkspaceTaxonomies(ws.config)
}
