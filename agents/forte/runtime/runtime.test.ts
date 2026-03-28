import assert from "node:assert/strict"
import test from "node:test"
import type {
  ForteCapability,
  ForteContext,
  ForteEffectiveCapabilities,
} from "./types"
import type { ModuleManifest } from "@core/registry"

process.env.DATABASE_URL ??= "file:./dev.db"

const BASE_CONTEXT: ForteContext = {
  tenantId: "tenant_test",
  workspaceId: "ws_test",
  userId: "user_test",
  wsRole: "ADMIN",
  surface: "assistant",
  requestId: "req_test",
}

function fakeCapabilities(items: ForteCapability[]): ForteEffectiveCapabilities {
  return {
    modules: [],
    engines: [],
    registryTools: [],
    tools: [],
    capabilities: items.map((item) => item.capabilityId),
    actions: {
      read: items.filter((item) => item.kind === "read"),
      write: items.filter((item) => item.kind === "write"),
      generate: items.filter((item) => item.kind === "generate"),
    },
  }
}

test("falta workspaceId => deny", async () => {
  const { runFortePipeline } = await import("./pipeline")
  const result = await runFortePipeline({
    context: {
      tenantId: "tenant_test",
      workspaceId: "",
      userId: "user_test",
      wsRole: "ADMIN",
      surface: "assistant",
    },
    intent: "query",
    summary: "invalid context",
    actionId: "clientes.list",
  })

  assert.equal(result.decision.mode, "deny")
})

test("workspace default => deny", async () => {
  const { runFortePipeline } = await import("./pipeline")
  const result = await runFortePipeline({
    context: {
      tenantId: "tenant_test",
      workspaceId: "ws_default",
      userId: "user_test",
      wsRole: "ADMIN",
      surface: "assistant",
    },
    intent: "query",
    summary: "invalid default workspace",
    actionId: "clientes.list",
  })

  assert.equal(result.decision.mode, "deny")
})

test("read con handler => execute_now", async () => {
  const { buildFortePlan } = await import("./decision-engine")
  const { evaluateFortePlan } = await import("./policy-guard")
  const capabilities = fakeCapabilities([
    {
      capabilityId: "clientes.list",
      moduleId: "clientes",
      kind: "read",
      allowed: true,
      requiresApproval: false,
      source: "runtime-handler",
    },
  ])

  const plan = buildFortePlan({
    context: BASE_CONTEXT,
    intent: "query",
    summary: "listar clientes",
    capabilities,
    actionId: "clientes.list",
  })
  const decision = evaluateFortePlan(plan, BASE_CONTEXT)

  assert.equal(decision.mode, "execute_now")
})

test("write => execute_after_approval", async () => {
  const { buildFortePlan } = await import("./decision-engine")
  const { evaluateFortePlan } = await import("./policy-guard")
  const capabilities = fakeCapabilities([
    {
      capabilityId: "clientes.list",
      moduleId: "clientes",
      kind: "write",
      allowed: true,
      requiresApproval: true,
      source: "runtime-handler",
    },
  ])

  const plan = buildFortePlan({
    context: BASE_CONTEXT,
    intent: "create",
    summary: "crear algo",
    capabilities,
    actionId: "clientes.list",
  })
  const decision = evaluateFortePlan(plan, BASE_CONTEXT)

  assert.equal(decision.mode, "execute_after_approval")
})

test("generate persistente => deny", async () => {
  const { buildFortePlan } = await import("./decision-engine")
  const { evaluateFortePlan } = await import("./policy-guard")
  const { registerForteActionHandler } = await import("./handlers")
  try {
    registerForteActionHandler({
      actionId: "test.generate",
      moduleId: "clientes",
      kind: "generate",
      async run() {
        return { ok: true }
      },
    })
  } catch {}
  const capabilities = fakeCapabilities([
    {
      capabilityId: "test.generate",
      moduleId: "clientes",
      kind: "generate",
      allowed: true,
      requiresApproval: true,
      source: "runtime-handler",
    },
  ])

  const plan = buildFortePlan({
    context: BASE_CONTEXT,
    intent: "analysis",
    summary: "generate persistente",
    capabilities,
    actionId: "test.generate",
    inputs: { persist: true },
  })
  const decision = evaluateFortePlan(plan, BASE_CONTEXT)

  assert.equal(decision.mode, "deny")
})

test("accion sin handler => deny", async () => {
  const { buildFortePlan } = await import("./decision-engine")
  const { evaluateFortePlan } = await import("./policy-guard")
  const capabilities = fakeCapabilities([])

  const plan = buildFortePlan({
    context: BASE_CONTEXT,
    intent: "query",
    summary: "accion inexistente",
    capabilities,
    actionId: "missing.action",
    moduleId: "clientes",
  })
  const decision = evaluateFortePlan(plan, BASE_CONTEXT)

  assert.equal(decision.mode, "deny")
})

test("modulo no activo => capability no disponible", async () => {
  const { resolveEffectiveModules } = await import("./capability-resolver")
  const modules: ModuleManifest[] = [
    {
      id: "clientes",
      name: "Clientes",
      description: "CRM",
      version: "1.0.0",
      dependencies: ["core/db"],
      capabilities: {
        crud: true,
        search: true,
        export: false,
        ai: false,
        portal: false,
      },
      models: ["Cliente"],
      optional: true,
    },
  ]

  const resolved = resolveEffectiveModules(modules, { clientes: false }, new Set())
  assert.equal(resolved.length, 0)
})

test("dependencia no satisfecha => capability no disponible", async () => {
  const { resolveEffectiveModules } = await import("./capability-resolver")
  const modules: ModuleManifest[] = [
    {
      id: "inbox",
      name: "Inbox",
      description: "Inbox",
      version: "1.0.0",
      dependencies: ["engines/ai"],
      capabilities: {
        crud: true,
        search: true,
        export: false,
        ai: true,
        portal: false,
      },
      models: ["Conversation"],
      optional: false,
    },
  ]

  const resolved = resolveEffectiveModules(modules, {}, new Set())
  assert.equal(resolved.length, 0)
})

test("createApprovalRequest serializa snapshot y contexto", async () => {
  const { createApprovalRequest } = await import("./approval")

  const plan = {
    intent: "create" as const,
    summary: "crear tarea",
    steps: [
      {
        id: "step-1",
        kind: "write" as const,
        moduleId: "tareas",
        actionId: "tareas.create",
        inputs: { titulo: "Nueva" },
        riskLevel: "high" as const,
        requiresApproval: true,
        reason: "write requiere approval",
      },
    ],
  }
  const decision = {
    mode: "execute_after_approval" as const,
    allowedSteps: plan.steps,
    blockedSteps: [],
    explanation: "approval required",
  }

  const request = await createApprovalRequest({
    plan,
    decision,
    context: BASE_CONTEXT,
  })

  assert.equal(request.status, "pending")
  assert.equal(request.approvalRequired, true)
  assert.equal(request.contextKey, "tenant_test:ws_test:user_test:assistant")
  assert.equal(request.snapshot.plan.summary, "crear tarea")
  assert.ok(request.fingerprint.length > 10)
})

test("approvePlan marca approved y filtra steps validos", async () => {
  const { createApprovalRequest, approvePlan } = await import("./approval")

  const plan = {
    intent: "create" as const,
    summary: "aprobar subset",
    steps: [
      {
        id: "step-1",
        kind: "write" as const,
        moduleId: "tareas",
        actionId: "tareas.create",
        inputs: {},
        riskLevel: "high" as const,
        requiresApproval: true,
        reason: "approval",
      },
      {
        id: "step-2",
        kind: "write" as const,
        moduleId: "clientes",
        actionId: "clientes.create",
        inputs: {},
        riskLevel: "high" as const,
        requiresApproval: true,
        reason: "approval",
      },
    ],
  }
  const decision = {
    mode: "execute_after_approval" as const,
    allowedSteps: plan.steps,
    blockedSteps: [],
    explanation: "approval required",
  }

  const request = await createApprovalRequest({ plan, decision, context: BASE_CONTEXT })
  const approved = approvePlan({
    request,
    approvedSteps: ["step-1", "step-missing"],
  })

  assert.equal(approved.status, "approved")
  assert.deepEqual(approved.approvedSteps, ["step-1"])
})

test("rejectPlan marca rejected con metadata", async () => {
  const { createApprovalRequest, rejectPlan } = await import("./approval")

  const plan = {
    intent: "create" as const,
    summary: "rechazar plan",
    steps: [
      {
        id: "step-1",
        kind: "write" as const,
        moduleId: "tareas",
        actionId: "tareas.create",
        inputs: {},
        riskLevel: "high" as const,
        requiresApproval: true,
        reason: "approval",
      },
    ],
  }
  const decision = {
    mode: "execute_after_approval" as const,
    allowedSteps: plan.steps,
    blockedSteps: [],
    explanation: "approval required",
  }

  const request = await createApprovalRequest({ plan, decision, context: BASE_CONTEXT })
  const rejected = rejectPlan({
    request,
    reason: "No autorizado",
  })

  assert.equal(rejected.status, "rejected")
  assert.equal(rejected.metadata?.rejectionReason, "No autorizado")
})

test("rehydrateApprovedPlan valida fingerprint y contexto", async () => {
  const { createApprovalRequest, approvePlan, rehydrateApprovedPlan } = await import("./approval")

  const plan = {
    intent: "create" as const,
    summary: "rehydrate ok",
    steps: [
      {
        id: "step-1",
        kind: "write" as const,
        moduleId: "tareas",
        actionId: "tareas.create",
        inputs: {},
        riskLevel: "high" as const,
        requiresApproval: true,
        reason: "approval",
      },
    ],
  }
  const decision = {
    mode: "execute_after_approval" as const,
    allowedSteps: plan.steps,
    blockedSteps: [],
    explanation: "approval required",
  }

  const request = await createApprovalRequest({ plan, decision, context: BASE_CONTEXT })
  const approved = approvePlan({ request, approvedSteps: ["step-1"] })
  const rehydrated = await rehydrateApprovedPlan({
    request: approved,
    context: BASE_CONTEXT,
  })

  assert.equal(rehydrated.ok, true)
  assert.equal(rehydrated.plan?.summary, "rehydrate ok")
})

test("rehydrateApprovedPlan falla si cambia el contexto", async () => {
  const { createApprovalRequest, approvePlan, rehydrateApprovedPlan } = await import("./approval")

  const plan = {
    intent: "create" as const,
    summary: "rehydrate fail",
    steps: [
      {
        id: "step-1",
        kind: "write" as const,
        moduleId: "tareas",
        actionId: "tareas.create",
        inputs: {},
        riskLevel: "high" as const,
        requiresApproval: true,
        reason: "approval",
      },
    ],
  }
  const decision = {
    mode: "execute_after_approval" as const,
    allowedSteps: plan.steps,
    blockedSteps: [],
    explanation: "approval required",
  }

  const request = await createApprovalRequest({ plan, decision, context: BASE_CONTEXT })
  const approved = approvePlan({ request, approvedSteps: ["step-1"] })
  const rehydrated = await rehydrateApprovedPlan({
    request: approved,
    context: {
      ...BASE_CONTEXT,
      workspaceId: "ws_other",
    },
  })

  assert.equal(rehydrated.ok, false)
})

test("InMemoryForteApprovalStore crea, consulta y actualiza", async () => {
  const { createApprovalRequest, approvePlan } = await import("./approval")
  const { createInMemoryForteApprovalStore } = await import("./approval-store")

  const plan = {
    intent: "create" as const,
    summary: "store",
    steps: [
      {
        id: "step-1",
        kind: "write" as const,
        moduleId: "tareas",
        actionId: "tareas.create",
        inputs: {},
        riskLevel: "high" as const,
        requiresApproval: true,
        reason: "approval",
      },
    ],
  }
  const decision = {
    mode: "execute_after_approval" as const,
    allowedSteps: plan.steps,
    blockedSteps: [],
    explanation: "approval required",
  }

  const request = await createApprovalRequest({ plan, decision, context: BASE_CONTEXT })
  const store = createInMemoryForteApprovalStore()
  await store.create(request)

  const found = await store.getById(request.planId)
  assert.equal(found?.planId, request.planId)

  const approved = approvePlan({ request })
  await store.update(approved)

  const updated = await store.getById(request.planId)
  assert.equal(updated?.status, "approved")
})
