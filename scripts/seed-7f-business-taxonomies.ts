import "dotenv/config"
import { PrismaLibSql } from "@prisma/adapter-libsql"
import { PrismaClient } from "../generated/prisma/client"

/**
 * Idempotent seed of the **taxonomy vocabularies** used in the internal
 * `7F Business` workspace.
 *
 * What this writes:
 *   `Workspace.config.taxonomies = { inbox, clients, projects, tasks }`
 *
 *   - `inbox`     classification labels for incoming messages
 *                 (Lead 7F, Support, Bug, Feature request, Onboarding,
 *                  Partnership, Billing question)
 *   - `clients`   segmentation labels for `Cliente` rows
 *                 (Leads, Active customers, Test/demo accounts, Partners)
 *   - `projects`  canonical project NAMES the team operates on
 *                 (7F Smart Inbox, 7F Agents, 7F Verticals, …)
 *   - `tasks`     bucket labels for `Tarea` rows
 *                 (Bugs, Product improvements, Sales follow-ups, …)
 *
 * What this does NOT do:
 *   - Does NOT create rows in `InboxEntry`, `Cliente`, `Proyecto`, or
 *     `Tarea`. The user picked the "config-only" scope: the lists are
 *     stored as taxonomy metadata so the UI / future consumers can
 *     surface them as labels, filters, or autocomplete suggestions
 *     without inventing fake records up-front.
 *   - Does NOT touch any other workspace. Only the workspace whose slug
 *     is `7f-business` (provisioned by `ensure-7f-business-workspace.ts`)
 *     is read or written.
 *   - Does NOT touch Skina, customer tenants, the control plane
 *     (`/system`), `PlatformAdmin`, channel credentials, or anything
 *     else outside of `Workspace.config` for this single row.
 *
 * Idempotency strategy (per the user's "skip if exists" choice):
 *   - For each canonical taxonomy item, we add it to the relevant array
 *     ONLY when it is not already present (case-sensitive match).
 *   - We NEVER remove an item that is already in the array. If an
 *     operator added a custom label or removed one of the canonical
 *     labels, re-running the script does not undo that — only missing
 *     canonical labels get added back.
 *   - If `config.taxonomies.<key>` is malformed (not an array), we
 *     LEAVE IT INTACT and report it as a warning rather than overwrite
 *     operator data. The operator must fix the shape manually.
 *
 * Same `PrismaLibSql` adapter pattern as `seed-skina-profile.ts` and
 * `ensure-7f-business-workspace.ts` so the script behaves identically
 * against `file:./dev.db` or libSQL.
 *
 * Usage (production):
 *   $env:DATABASE_URL = "libsql://7f-7frames.aws-eu-west-1.turso.io"
 *   npx tsx scripts/seed-7f-business-taxonomies.ts
 *   Remove-Item env:DATABASE_URL
 */

const SEVENF_BUSINESS_SLUG = "7f-business"

/**
 * Canonical taxonomy lists. Edit these in source if the vocabulary
 * needs to evolve — the script will then append the new items on the
 * next run while preserving everything already present.
 *
 * Order matters only for new installs: when a key has never been seeded
 * we persist this exact array; on subsequent runs new items are
 * appended after operator-added ones (we don't reorder).
 */
const CANONICAL_TAXONOMIES = {
  inbox: [
    "Lead 7F",
    "Support",
    "Bug",
    "Feature request",
    "Onboarding",
    "Partnership",
    "Billing question",
  ],
  clients: [
    "Leads",
    "Active customers",
    "Test/demo accounts",
    "Partners",
  ],
  projects: [
    "7F Smart Inbox",
    "7F Agents",
    "7F Verticals",
    "7F System Admin",
    "7F Website / Landing",
    "Customer onboarding",
  ],
  tasks: [
    "Bugs",
    "Product improvements",
    "Sales follow-ups",
    "Vertical ideas",
    "Support follow-ups",
  ],
} as const

type TaxonomyKey = keyof typeof CANONICAL_TAXONOMIES

const dbUrl = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL
if (!dbUrl) {
  console.error(
    "[seed-7f-business-taxonomies] Missing DATABASE_URL / TURSO_DATABASE_URL",
  )
  process.exit(1)
}

const adapter = new PrismaLibSql({
  url: dbUrl,
  authToken: process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN,
})
const db = new PrismaClient({ adapter })

interface MergeReport {
  added: string[]
  skipped: string[]
  /**
   * Set when `config.taxonomies.<key>` exists but is not an array.
   * In that case we leave it intact — the operator must reconcile.
   */
  malformed: boolean
}

/**
 * Merge a single taxonomy list. Returns the resulting array plus a
 * report of what changed. Pure function: takes the existing value as
 * input, never mutates it.
 */
function mergeTaxonomy(
  existing: unknown,
  canonical: readonly string[],
): { value: string[] | unknown; report: MergeReport } {
  if (existing !== undefined && !Array.isArray(existing)) {
    return {
      value: existing,
      report: { added: [], skipped: [], malformed: true },
    }
  }

  const base: string[] = Array.isArray(existing)
    ? existing.filter((v): v is string => typeof v === "string")
    : []

  const present = new Set(base)
  const added: string[] = []
  const skipped: string[] = []

  for (const item of canonical) {
    if (present.has(item)) {
      skipped.push(item)
    } else {
      base.push(item)
      present.add(item)
      added.push(item)
    }
  }

  return { value: base, report: { added, skipped, malformed: false } }
}

async function main() {
  console.log(
    `[seed-7f-business-taxonomies] Connecting to: ${dbUrl!.split("?")[0]}`,
  )

  const ws = await db.workspace.findUnique({
    where: { slug: SEVENF_BUSINESS_SLUG },
    select: { id: true, slug: true, nombre: true, config: true },
  })

  if (!ws) {
    console.error(
      `[seed-7f-business-taxonomies] Workspace "${SEVENF_BUSINESS_SLUG}" not found. Run scripts/ensure-7f-business-workspace.ts first. Aborting.`,
    )
    process.exit(1)
  }

  console.log(
    `[seed-7f-business-taxonomies] Target: ${ws.nombre} (${ws.id})`,
  )

  /**
   * Parse existing config defensively. If the column is missing or
   * malformed at the JSON level we keep going with an empty object
   * (never overwrite a non-JSON blob that an operator might have
   * intentionally placed there — the merge step also short-circuits on
   * malformed shapes per-key).
   */
  let configObj: Record<string, unknown> = {}
  if (ws.config) {
    try {
      const parsed = JSON.parse(ws.config) as unknown
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        configObj = parsed as Record<string, unknown>
      } else {
        console.warn(
          "[seed-7f-business-taxonomies] Existing Workspace.config is not a JSON object — aborting to avoid overwriting operator data.",
        )
        process.exit(1)
      }
    } catch {
      console.warn(
        "[seed-7f-business-taxonomies] Existing Workspace.config is not valid JSON — aborting to avoid overwriting operator data.",
      )
      process.exit(1)
    }
  }

  /**
   * The taxonomies live under a single sub-object so we don't scatter
   * keys on the root config. If the sub-object is missing we create it;
   * if it's malformed we abort (same reasoning as above).
   */
  const taxRaw = configObj["taxonomies"]
  let taxonomies: Record<string, unknown>
  if (taxRaw === undefined) {
    taxonomies = {}
  } else if (taxRaw && typeof taxRaw === "object" && !Array.isArray(taxRaw)) {
    taxonomies = { ...(taxRaw as Record<string, unknown>) }
  } else {
    console.warn(
      "[seed-7f-business-taxonomies] config.taxonomies exists but is not a JSON object — aborting to avoid overwriting operator data.",
    )
    process.exit(1)
  }

  const reports: Record<TaxonomyKey, MergeReport> = {
    inbox: { added: [], skipped: [], malformed: false },
    clients: { added: [], skipped: [], malformed: false },
    projects: { added: [], skipped: [], malformed: false },
    tasks: { added: [], skipped: [], malformed: false },
  }

  let totalAdded = 0
  for (const key of Object.keys(CANONICAL_TAXONOMIES) as TaxonomyKey[]) {
    const { value, report } = mergeTaxonomy(
      taxonomies[key],
      CANONICAL_TAXONOMIES[key],
    )
    reports[key] = report
    totalAdded += report.added.length

    if (report.malformed) {
      console.warn(
        `[seed-7f-business-taxonomies] config.taxonomies.${key} is not an array — left intact, no items added.`,
      )
      continue
    }

    taxonomies[key] = value
  }

  /**
   * Per-key change reporting. We print one line per taxonomy regardless
   * of whether anything changed — operators get a complete picture in
   * a single run.
   */
  for (const key of Object.keys(CANONICAL_TAXONOMIES) as TaxonomyKey[]) {
    const r = reports[key]
    if (r.malformed) {
      console.log(
        `  - ${key}: malformed (skipped) — operator must reconcile manually`,
      )
      continue
    }
    if (r.added.length === 0) {
      console.log(
        `  - ${key}: ${r.skipped.length} already present, 0 added`,
      )
    } else {
      console.log(
        `  - ${key}: ${r.skipped.length} already present, ${r.added.length} added [${r.added.join(", ")}]`,
      )
    }
  }

  if (totalAdded === 0) {
    console.log(
      "[seed-7f-business-taxonomies] No changes — config left untouched.",
    )
    console.log("[seed-7f-business-taxonomies] Done.")
    return
  }

  /**
   * Persist. We re-serialise the entire `configObj` (not just the
   * `taxonomies` slice) so the unrelated keys created by
   * `ensure-7f-business-workspace.ts` (kind, internalPurpose,
   * description) round-trip untouched.
   */
  configObj["taxonomies"] = taxonomies
  const nextJson = JSON.stringify(configObj)

  await db.workspace.update({
    where: { id: ws.id },
    data: { config: nextJson },
  })

  console.log(
    `[seed-7f-business-taxonomies] Workspace.config updated · added ${totalAdded} item(s) total`,
  )
  console.log("[seed-7f-business-taxonomies] Done.")
}

main()
  .then(() => db.$disconnect())
  .catch((err) => {
    console.error("[seed-7f-business-taxonomies] Failed:", err)
    db.$disconnect()
    process.exit(1)
  })
