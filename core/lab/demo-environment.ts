/**
 * Mr Forte Lab — demo environment assessment (DEV-PREVIEW-01C).
 *
 * Decides whether the connected database is the expected, safe, fully
 * provisioned demo environment before ANY normal Sevenef session is issued.
 * The pure `evaluateLabDemoEnvironment` is unit-tested with fixtures; the
 * server `assessLabDemoEnvironment` gathers the same inputs from Prisma + env.
 *
 * It NEVER writes. Provisioning is an explicit CLI operation
 * (`scripts/provision-lab-preview.ts`) — a web request may only verify, read,
 * issue cookies and redirect. Any unexpected state fails closed with an
 * internal reason; the visitor sees only a generic message.
 */

import { readLabDataConfig, type LabDataConfigError } from "./data-config"
import { assertTursoUrlAllowed, verifyTursoFingerprint } from "./database-fingerprint"
import {
  LAB_DEMO_DATASET_MINIMUMS,
  LAB_DEMO_IDENTITY,
  LAB_DEMO_MAX_WORKSPACES,
} from "./demo-identity"
import { parseWorkspaceConfig } from "../../scripts/finesse-demo-utils"

export type LabDemoEnvironmentReason =
  | "disabled"
  | "invalid-configuration"
  | "database-fingerprint-mismatch"
  | "database-unavailable"
  | "unsafe-database"
  | "user-missing"
  | "user-mismatch"
  | "workspace-missing"
  | "workspace-mismatch"
  | "membership-missing"
  | "membership-mismatch"
  | "dataset-incomplete"

export type LabDemoEnvironmentDecision =
  | { allowed: true; userId: string; workspaceId: string; email: string; role: "editor" }
  | { allowed: false; reason: LabDemoEnvironmentReason }

export type LabDatasetCounts = {
  clients: number
  events: number
  conversations: number
  messages: number
  invoices: number
  workspaceTasks: number
}

export type LabDemoEnvironmentInput = {
  /** null when the data config validated; otherwise its error. */
  configError: LabDataConfigError | null
  fingerprintOk: boolean
  /**
   * Whether the Turso URL scheme is allowed for the current context
   * (DEV-PREVIEW-01D). `false` = a local URL on a deployment → fail closed
   * BEFORE connecting. Optional; `undefined` is treated as allowed.
   */
  urlContextOk?: boolean
  dbReachable: boolean
  workspaceCount: number
  foreignUserCount: number
  expected: {
    userId: string
    userEmail: string
    workspaceId: string
    workspaceSlug: string
    verticalKey: string
    membershipRole: string
    sessionRole: string
  }
  user: { id: string; email: string; role: string } | null
  workspace: { id: string; slug: string; verticalKey: string; demoFlagged: boolean } | null
  membership: { role: string } | null
  dataset: LabDatasetCounts
}

export function evaluateLabDemoEnvironment(
  input: LabDemoEnvironmentInput,
): LabDemoEnvironmentDecision {
  const deny = (reason: LabDemoEnvironmentReason): LabDemoEnvironmentDecision => ({
    allowed: false,
    reason,
  })

  // 1-3. Config, fingerprint, connectivity.
  if (input.configError === "disabled") return deny("disabled")
  if (input.configError !== null) return deny("invalid-configuration")
  if (!input.fingerprintOk) return deny("database-fingerprint-mismatch")
  // A local (file:/http:) URL on a deployment fails closed before connecting.
  if (input.urlContextOk === false) return deny("database-unavailable")
  if (!input.dbReachable) return deny("database-unavailable")

  // 4. Safety guard: only the demo workspace + the synthetic user may exist.
  if (input.workspaceCount > LAB_DEMO_MAX_WORKSPACES) return deny("unsafe-database")
  if (input.foreignUserCount > 0) return deny("unsafe-database")

  // 5. Synthetic user.
  if (!input.user) return deny("user-missing")
  if (input.user.email !== input.expected.userEmail) return deny("user-mismatch")
  if (input.user.id !== input.expected.userId) return deny("user-mismatch")
  if (input.user.role !== input.expected.sessionRole) return deny("user-mismatch")

  // 6. Demo workspace.
  if (!input.workspace) return deny("workspace-missing")
  if (input.workspace.id !== input.expected.workspaceId) return deny("workspace-mismatch")
  if (input.workspace.slug !== input.expected.workspaceSlug) return deny("workspace-mismatch")
  if (input.workspace.verticalKey !== input.expected.verticalKey) return deny("workspace-mismatch")
  // A workspace that is not explicitly demo-flagged is treated as unsafe.
  if (!input.workspace.demoFlagged) return deny("unsafe-database")

  // 7. Membership + role.
  if (!input.membership) return deny("membership-missing")
  if (input.membership.role !== input.expected.membershipRole) return deny("membership-mismatch")

  // 8. Minimum dataset.
  const m = LAB_DEMO_DATASET_MINIMUMS
  const d = input.dataset
  if (
    d.clients < m.clients ||
    d.events < m.events ||
    d.conversations < m.conversations ||
    d.messages < m.messages ||
    d.invoices < m.invoices ||
    d.workspaceTasks < m.workspaceTasks
  ) {
    return deny("dataset-incomplete")
  }

  return {
    allowed: true,
    userId: input.user.id,
    workspaceId: input.workspace.id,
    email: input.user.email,
    role: "editor",
  }
}

/** Minimal DB surface used by the assessor — satisfied by the Prisma client. */
export interface LabDemoDataSource {
  workspace: {
    count(): Promise<number>
    findUnique(args: {
      where: { id: string }
      select: { id: true; slug: true; verticalKey: true; config: true }
    }): Promise<{ id: string; slug: string; verticalKey: string; config: string | null } | null>
  }
  user: {
    count(args: { where: { id: { notIn: string[] } } }): Promise<number>
    findUnique(args: {
      where: { id: string }
      select: { id: true; email: true; role: true }
    }): Promise<{ id: string; email: string; role: string } | null>
  }
  workspaceMember: {
    findUnique(args: {
      where: { userId_workspaceId: { userId: string; workspaceId: string } }
      select: { role: true }
    }): Promise<{ role: string } | null>
  }
  cliente: { count(args: { where: { workspaceId: string } }): Promise<number> }
  evento: { count(args: { where: { workspaceId: string } }): Promise<number> }
  conversation: { count(args: { where: { workspaceId: string } }): Promise<number> }
  message: { count(args: { where: { workspaceId: string } }): Promise<number> }
  factura: { count(args: { where: { workspaceId: string } }): Promise<number> }
  workspaceTask: { count(args: { where: { workspaceId: string } }): Promise<number> }
}

function isDemoFlagged(configRaw: string | null): boolean {
  const config = parseWorkspaceConfig(configRaw)
  if (!config) return false
  const demo = config.demo
  if (typeof demo !== "object" || demo === null || Array.isArray(demo)) return false
  const d = demo as Record<string, unknown>
  return d.enabled === true && d.type === "finesse-internal"
}

/**
 * Gather + evaluate against a live database. `env` and `db` are injectable for
 * tests. Reads only; never writes. Fingerprint uses the raw TURSO URL from env.
 */
export async function assessLabDemoEnvironment(
  db: LabDemoDataSource,
  env: Record<string, string | undefined> = process.env,
): Promise<LabDemoEnvironmentDecision> {
  const configResult = readLabDataConfig(env)
  if (!configResult.ok) {
    // Still return the right typed reason without touching the DB.
    return evaluateLabDemoEnvironment(baseInput(configResult.reason))
  }
  const config = configResult.config

  const rawUrl = env.TURSO_DATABASE_URL ?? env.DATABASE_URL
  const fingerprintOk = verifyTursoFingerprint(rawUrl, config.expectedDbFingerprint)
  if (!fingerprintOk) {
    return evaluateLabDemoEnvironment({ ...baseInput(null), fingerprintOk: false })
  }
  // Protocol policy: refuse a local URL on a deployment BEFORE connecting.
  if (!assertTursoUrlAllowed(rawUrl, env).ok) {
    return evaluateLabDemoEnvironment({ ...baseInput(null), fingerprintOk: true, urlContextOk: false })
  }

  try {
    const [workspaceCount, foreignUserCount, user, workspace, membership] = await Promise.all([
      db.workspace.count(),
      db.user.count({ where: { id: { notIn: [config.userId] } } }),
      db.user.findUnique({ where: { id: config.userId }, select: { id: true, email: true, role: true } }),
      db.workspace.findUnique({
        where: { id: config.workspaceId },
        select: { id: true, slug: true, verticalKey: true, config: true },
      }),
      db.workspaceMember.findUnique({
        where: { userId_workspaceId: { userId: config.userId, workspaceId: config.workspaceId } },
        select: { role: true },
      }),
    ])

    const wsId = config.workspaceId
    const [clients, events, conversations, messages, invoices, workspaceTasks] = await Promise.all([
      db.cliente.count({ where: { workspaceId: wsId } }),
      db.evento.count({ where: { workspaceId: wsId } }),
      db.conversation.count({ where: { workspaceId: wsId } }),
      db.message.count({ where: { workspaceId: wsId } }),
      db.factura.count({ where: { workspaceId: wsId } }),
      db.workspaceTask.count({ where: { workspaceId: wsId } }),
    ])

    return evaluateLabDemoEnvironment({
      configError: null,
      fingerprintOk: true,
      dbReachable: true,
      workspaceCount,
      foreignUserCount,
      expected: {
        userId: config.userId,
        userEmail: config.userEmail,
        workspaceId: config.workspaceId,
        workspaceSlug: config.workspaceSlug,
        verticalKey: LAB_DEMO_IDENTITY.verticalKey,
        membershipRole: LAB_DEMO_IDENTITY.membershipRole,
        sessionRole: LAB_DEMO_IDENTITY.sessionRole,
      },
      user,
      workspace: workspace
        ? {
            id: workspace.id,
            slug: workspace.slug,
            verticalKey: workspace.verticalKey,
            demoFlagged: isDemoFlagged(workspace.config),
          }
        : null,
      membership,
      dataset: { clients, events, conversations, messages, invoices, workspaceTasks },
    })
  } catch {
    return evaluateLabDemoEnvironment({ ...baseInput(null), fingerprintOk: true, dbReachable: false })
  }
}

/** A denied-by-default input skeleton used when we short-circuit before the DB. */
function baseInput(configError: LabDataConfigError | null): LabDemoEnvironmentInput {
  return {
    configError,
    fingerprintOk: false,
    dbReachable: false,
    workspaceCount: 0,
    foreignUserCount: 0,
    expected: {
      userId: LAB_DEMO_IDENTITY.userId,
      userEmail: LAB_DEMO_IDENTITY.userEmail,
      workspaceId: LAB_DEMO_IDENTITY.workspaceId,
      workspaceSlug: LAB_DEMO_IDENTITY.workspaceSlug,
      verticalKey: LAB_DEMO_IDENTITY.verticalKey,
      membershipRole: LAB_DEMO_IDENTITY.membershipRole,
      sessionRole: LAB_DEMO_IDENTITY.sessionRole,
    },
    user: null,
    workspace: null,
    membership: null,
    dataset: { clients: 0, events: 0, conversations: 0, messages: 0, invoices: 0, workspaceTasks: 0 },
  }
}
