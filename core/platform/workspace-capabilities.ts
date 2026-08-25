/**
 * FOUND-02a — Read-only workspace capability resolver (ARCH-02 Phase 2).
 *
 * Resolves, ONCE, a workspace's canonical capability snapshot from the
 * sources that exist today:
 *
 *   1. Core capabilities        always granted to a valid workspace
 *   2. `Workspace.plan`         via `core/system/plans.ts` (OBSERVATIONAL —
 *                               plan metadata is not billing truth)
 *   3. `Workspace.config.modules`  platform-admin module flags
 *   4. Presence standalone      the one real entitlement in the repo
 *                               (`PresenceSubscription`) → site.* add-on
 *
 * Pure and database-provider-neutral: the caller supplies already-loaded
 * evidence; nothing here touches `@core/db`, Turso or Neon, performs writes,
 * or calls a billing provider. Legacy vocabularies are mapped to canonical
 * product/capability keys through the explicit tables below — no fourth
 * module vocabulary is introduced. Divergent or unknown legacy values NEVER
 * widen access: they become diagnostics, and unknown plans/modules grant
 * nothing beyond valid Core (fail closed).
 *
 * READ-ONLY FOUNDATION: no route, UI or AI tool consumes this snapshot as
 * enforcement yet.
 */

import { isWorkspaceStatus, type WorkspaceStatus } from "@core/system/workspace-status"
import { resolveWorkspacePlan } from "@core/system/plans"
import type { CapabilityKey } from "./capabilities"
import { ADDON_GRANTED_CAPABILITIES, PRODUCT_CAPABILITIES } from "./catalog"
import type { ProductKey } from "./products"

/** Evidence the caller loads (from DB or fixtures) before resolving. */
export interface WorkspaceCapabilitySources {
  workspace: {
    id: string
    /** `Workspace.status` raw string (active | trial | suspended | archived). */
    status: string | null | undefined
    /** `Workspace.plan` free-form string. */
    plan: string | null | undefined
    /** Parsed `Workspace.config.modules` object, when present. */
    configModules: Readonly<Record<string, unknown>> | null | undefined
  } | null
  /** Whether an active standalone Presence subscription exists. */
  presenceStandaloneActive?: boolean
}

export interface InferredProduct {
  product: ProductKey
  /** Which legacy sources support this product (evidence, not proof of payment). */
  sources: readonly string[]
}

export interface WorkspaceCapabilitySnapshot {
  workspaceId: string
  /** Strictly parsed status; unparseable values surface as "unknown". */
  status: WorkspaceStatus | "unknown"
  /** Products inferred from legacy sources (plus implicit `core`). */
  products: readonly InferredProduct[]
  /** Canonical capabilities the workspace CAN use (union of product sets + add-ons). */
  capabilities: ReadonlySet<CapabilityKey>
  /** Capabilities granted by an add-on rather than a product (Presence today). */
  addonCapabilities: readonly CapabilityKey[]
  /** Divergences and unknown legacy values — recorded, never access-widening. */
  diagnostics: readonly string[]
  /**
   * Honesty flag: plan/config sources are observational metadata, not a paid
   * entitlement record. A persistent entitlement store replaces them later.
   */
  observational: true
  /** Snapshot shape version, for future caching/invalidation. */
  version: 1
}

/**
 * `core/system/plans.ts` `enabledModules` vocabulary → canonical products.
 * `null` = known key with no canonical product yet (diagnostic, no grant).
 */
const PLAN_MODULE_TO_PRODUCT: Readonly<Record<string, ProductKey | null>> = {
  inbox: "smart_inbox",
  invoices: "finance",
  clients: "core",
  tasks: "core",
  projects: null,
  agents: null,
}

/** `Workspace.config.modules` vocabulary → canonical products. */
const CONFIG_MODULE_TO_PRODUCT: Readonly<Record<string, ProductKey | null>> = {
  inbox: "smart_inbox",
  crm: "core",
  campaigns: "growth",
  finance: "finance",
  automation: null,
}

/** Capabilities the active standalone Presence subscription grants (ARCH-02 §4). */
export const PRESENCE_ADDON_CAPABILITIES = [
  "site.publish",
  "site.manage",
] as const satisfies readonly CapabilityKey[]

function addProduct(
  inferred: Map<ProductKey, string[]>,
  product: ProductKey,
  source: string,
): void {
  const sources = inferred.get(product) ?? []
  sources.push(source)
  inferred.set(product, sources)
}

/**
 * Resolve the capability snapshot for one workspace. Pure and deterministic:
 * same sources in, same snapshot out; no I/O, no writes, no mutation of
 * inputs. `workspace: null` yields an empty, fail-closed snapshot.
 */
export function resolveWorkspaceCapabilitySnapshot(
  sources: WorkspaceCapabilitySources,
): WorkspaceCapabilitySnapshot {
  const diagnostics: string[] = []

  if (!sources.workspace) {
    return {
      workspaceId: "",
      status: "unknown",
      products: [],
      capabilities: new Set(),
      addonCapabilities: [],
      diagnostics: ["workspace: not found — no capabilities resolved"],
      observational: true,
      version: 1,
    }
  }

  const { id, status: rawStatus, plan, configModules } = sources.workspace

  const status: WorkspaceStatus | "unknown" = isWorkspaceStatus(rawStatus) ? rawStatus : "unknown"
  if (status === "unknown") {
    diagnostics.push(`status: unknown value ${JSON.stringify(rawStatus ?? null)}`)
  }

  // Core is always available for a valid workspace (ARCH-02 §3).
  const inferred = new Map<ProductKey, string[]>()
  addProduct(inferred, "core", "core:always")

  // Source: Workspace.plan (observational).
  const resolvedPlan = resolveWorkspacePlan({ plan })
  if (resolvedPlan.isUnknownPlan) {
    diagnostics.push(
      `plan: unknown value ${JSON.stringify(resolvedPlan.rawPlan)} — grants nothing beyond core`,
    )
  } else {
    for (const moduleKey of resolvedPlan.enabledModules) {
      if (moduleKey === "all") {
        addProduct(inferred, "smart_inbox", `plan:${resolvedPlan.planKey}:all`)
        addProduct(inferred, "growth", `plan:${resolvedPlan.planKey}:all`)
        addProduct(inferred, "finance", `plan:${resolvedPlan.planKey}:all`)
        continue
      }
      const product = PLAN_MODULE_TO_PRODUCT[moduleKey]
      if (product === undefined) {
        diagnostics.push(`plan: unmapped module key "${moduleKey}" — no grant`)
      } else if (product === null) {
        diagnostics.push(`plan: module key "${moduleKey}" has no canonical product yet — no grant`)
      } else {
        addProduct(inferred, product, `plan:${resolvedPlan.planKey}:${moduleKey}`)
      }
    }
  }

  // Source: Workspace.config.modules (platform-admin flags).
  for (const [moduleKey, rawValue] of Object.entries(configModules ?? {})) {
    if (typeof rawValue !== "boolean") {
      diagnostics.push(`config.modules: non-boolean value for "${moduleKey}" — ignored`)
      continue
    }
    const product = CONFIG_MODULE_TO_PRODUCT[moduleKey]
    if (product === undefined) {
      diagnostics.push(`config.modules: unmapped key "${moduleKey}" — no grant`)
      continue
    }
    if (product === null) {
      if (rawValue) {
        diagnostics.push(
          `config.modules: key "${moduleKey}" has no canonical product yet — no grant`,
        )
      }
      continue
    }
    if (rawValue) {
      addProduct(inferred, product, `config.modules:${moduleKey}`)
    } else if (inferred.has(product)) {
      diagnostics.push(
        `divergence: config.modules disables "${moduleKey}" while another source grants ${product} — sources disagree (no source removes access in this observational resolver)`,
      )
    }
  }

  // Source: standalone Presence subscription → add-on capabilities only.
  const addonCapabilities: CapabilityKey[] = []
  if (sources.presenceStandaloneActive) {
    addonCapabilities.push(...PRESENCE_ADDON_CAPABILITIES)
  }

  const capabilities = new Set<CapabilityKey>()
  for (const product of inferred.keys()) {
    for (const capability of PRODUCT_CAPABILITIES[product]) capabilities.add(capability)
  }
  for (const capability of addonCapabilities) capabilities.add(capability)

  // Sanity: an add-on may only grant declared add-on capabilities or a
  // subset of an existing product's set (ARCH-02 §13). Record — never widen.
  const productGrantable = new Set<string>(Object.values(PRODUCT_CAPABILITIES).flat())
  for (const capability of addonCapabilities) {
    const declaredAddon = (ADDON_GRANTED_CAPABILITIES as readonly string[]).includes(capability)
    if (!declaredAddon && !productGrantable.has(capability)) {
      diagnostics.push(`addon: capability "${capability}" is not grantable by any add-on`)
    }
  }

  const products: InferredProduct[] = [...inferred.entries()].map(([product, sourceList]) => ({
    product,
    sources: sourceList,
  }))

  return {
    workspaceId: id,
    status,
    products,
    capabilities,
    addonCapabilities,
    diagnostics,
    observational: true,
    version: 1,
  }
}
