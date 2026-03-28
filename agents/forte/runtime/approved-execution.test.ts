import assert from "node:assert/strict"
import test from "node:test"
import type { ForteContext, FortePlan, ForteDecision } from "./types"
import type { ApprovalRequest } from "./approval"

process.env.DATABASE_URL ??= "file:./dev.db"

const BASE_CONTEXT: ForteContext = {
  tenantId: "tenant_test",
  workspaceId: "ws_test",
  userId: "user_test",
  wsRole: "ADMIN",
  surface: "assistant",
  requestId: "req_exec_test",
}

function makeWritePlan(overrides?: Partial<FortePlan>): FortePlan {
  return {
    intent: "create",
    summary: "crear tarea de prueba",
    steps: [
      {
        id: "step-write-1",
        kind: "write",
        moduleId: "tareas",
        actionId: "tareas.create",
        inputs: { titulo: "Tarea de test" },
        riskLevel: "high",
        requiresApproval: true,
        reason: "write requiere approval",
      },
    ],
    ...overrides,
  }
}

function makeDecision(plan: FortePlan): ForteDecision {
  return {
    mode: "execute_after_approval",
    allowedSteps: plan.steps,
    blockedSteps: [],
    explanation: "approval required",
  }
}

async function createApprovedRequest(
  context = BASE_CONTEXT,
  plan?: FortePlan,
): Promise<ApprovalRequest> {
  const { createApprovalRequest, approvePlan } = await import("./approval")
  const p = plan ?? makeWritePlan()
  const decision = makeDecision(p)
  const request = await createApprovalRequest({ plan: p, decision, context })
  return approvePlan({ request, approvedSteps: ["step-write-1"] })
}

// --- Test 1: request inexistente ---
test("no ejecutar request inexistente", async () => {
  const { createInMemoryForteApprovalStore } = await import("./approval-store")
  const { executeApprovedPlan } = await import("./approved-execution-service")

  const store = createInMemoryForteApprovalStore()
  const result = await executeApprovedPlan(
    { planId: "plan:nope", context: BASE_CONTEXT },
    store,
  )

  assert.equal(result.ok, false)
  assert.ok(result.message?.includes("no encontrada"))
})

// --- Test 2: request pending ---
test("no ejecutar request pending", async () => {
  const { createApprovalRequest } = await import("./approval")
  const { executeApprovedRequest } = await import("./approved-execution")

  const plan = makeWritePlan()
  const request = await createApprovalRequest({
    plan,
    decision: makeDecision(plan),
    context: BASE_CONTEXT,
  })

  const result = await executeApprovedRequest(request, BASE_CONTEXT)

  assert.equal(result.ok, false)
  assert.ok(result.message?.includes("no aprobada"))
})

// --- Test 3: request rejected ---
test("no ejecutar request rejected", async () => {
  const { createApprovalRequest, rejectPlan } = await import("./approval")
  const { executeApprovedRequest } = await import("./approved-execution")

  const plan = makeWritePlan()
  const request = await createApprovalRequest({
    plan,
    decision: makeDecision(plan),
    context: BASE_CONTEXT,
  })
  const rejected = rejectPlan({ request, reason: "no" })

  const result = await executeApprovedRequest(rejected, BASE_CONTEXT)

  assert.equal(result.ok, false)
  assert.ok(result.message?.includes("no aprobada"))
})

// --- Test 4: request expired ---
test("no ejecutar request expired", async () => {
  const { createApprovalRequest, approvePlan } = await import("./approval")
  const { executeApprovedRequest } = await import("./approved-execution")

  const plan = makeWritePlan()
  const request = await createApprovalRequest({
    plan,
    decision: makeDecision(plan),
    context: BASE_CONTEXT,
    expiresAt: new Date(Date.now() - 60_000),
  })
  const approved = approvePlan({ request })

  const result = await executeApprovedRequest(approved, BASE_CONTEXT)

  assert.equal(result.ok, false)
  assert.ok(result.message?.includes("expirado"))
})

// --- Test 5: fingerprint no coincide ---
test("no ejecutar si fingerprint no coincide", async () => {
  const { executeApprovedRequest } = await import("./approved-execution")

  const approved = await createApprovedRequest()
  const tampered = { ...approved, fingerprint: "fingerprint_falso_abc123" }

  const result = await executeApprovedRequest(tampered, BASE_CONTEXT)

  assert.equal(result.ok, false)
  assert.ok(result.message?.includes("fingerprint"))
})

// --- Test 6: contextKey no coincide ---
test("no ejecutar si contextKey no coincide", async () => {
  const { executeApprovedRequest } = await import("./approved-execution")

  const approved = await createApprovedRequest()
  const differentContext: ForteContext = {
    ...BASE_CONTEXT,
    workspaceId: "ws_other",
  }

  const result = await executeApprovedRequest(approved, differentContext)

  assert.equal(result.ok, false)
  assert.ok(result.message?.includes("contexto"))
})

// --- Test 7: ejecutar solo approvedSteps ---
test("ejecutar solo approvedSteps y bloquear el resto", async () => {
  const { createApprovalRequest, approvePlan } = await import("./approval")
  const { executeApprovedRequest } = await import("./approved-execution")
  const { registerForteActionHandler, hasForteActionHandler } = await import("./handlers")

  if (!hasForteActionHandler("test.read_exec")) {
    registerForteActionHandler({
      actionId: "test.read_exec",
      moduleId: "tareas",
      kind: "read",
      async run() {
        return { items: [] }
      },
    })
  }

  const plan: FortePlan = {
    intent: "create",
    summary: "multi step",
    steps: [
      {
        id: "step-a",
        kind: "read",
        moduleId: "tareas",
        actionId: "test.read_exec",
        inputs: {},
        riskLevel: "low",
        requiresApproval: true,
        reason: "test",
      },
      {
        id: "step-b",
        kind: "write",
        moduleId: "tareas",
        actionId: "tareas.create",
        inputs: { titulo: "aprobada" },
        riskLevel: "high",
        requiresApproval: true,
        reason: "test",
      },
    ],
  }

  const request = await createApprovalRequest({
    plan,
    decision: makeDecision(plan),
    context: BASE_CONTEXT,
  })

  const approved = approvePlan({ request, approvedSteps: ["step-a"] })
  const result = await executeApprovedRequest(approved, BASE_CONTEXT)

  assert.equal(result.executedSteps.length, 1)
  assert.equal(result.executedSteps[0].stepId, "step-a")
  assert.ok(result.blockedSteps && result.blockedSteps.length > 0)
})

// --- Test 8: bloquear step sin handler (read sin handler registrado) ---
test("bloquear step si no hay handler", async () => {
  const { createApprovalRequest, approvePlan } = await import("./approval")
  const { executeApprovedRequest } = await import("./approved-execution")

  const plan: FortePlan = {
    intent: "query",
    summary: "sin handler",
    steps: [
      {
        id: "step-no-handler",
        kind: "read",
        moduleId: "tareas",
        actionId: "tareas.nonexistent_read",
        inputs: {},
        riskLevel: "low",
        requiresApproval: true,
        reason: "test",
      },
    ],
  }

  const request = await createApprovalRequest({
    plan,
    decision: makeDecision(plan),
    context: BASE_CONTEXT,
  })
  const approved = approvePlan({ request, approvedSteps: ["step-no-handler"] })
  const result = await executeApprovedRequest(approved, BASE_CONTEXT)

  assert.equal(result.ok, false)
  assert.ok(result.blockedSteps?.some((s) => s.reason.includes("No existe handler")))
})

// --- Test 9: impedir doble ejecucion ---
test("impedir doble ejecucion del mismo plan", async () => {
  const { executeApprovedRequest } = await import("./approved-execution")

  const approved = await createApprovedRequest()
  const alreadyRun: ApprovalRequest = {
    ...approved,
    executionStatus: "completed",
    executedAt: new Date().toISOString(),
  }

  const result = await executeApprovedRequest(alreadyRun, BASE_CONTEXT)

  assert.equal(result.ok, false)
  assert.ok(result.message?.includes("executionStatus"))
})

// --- Test 10: ejecutar write soportado con handler mock controlado ---
test("ejecutar correctamente accion write soportada", async () => {
  const { createApprovalRequest, approvePlan } = await import("./approval")
  const { executeApprovedRequest, addSupportedWriteAction } = await import("./approved-execution")
  const { registerForteActionHandler, hasForteActionHandler } = await import("./handlers")

  const mockActionId = "test.write_mock_success"

  addSupportedWriteAction(mockActionId)

  if (!hasForteActionHandler(mockActionId)) {
    registerForteActionHandler({
      actionId: mockActionId,
      moduleId: "tareas",
      kind: "write",
      async run(ctx: ForteContext, input: Record<string, unknown>) {
        return {
          id: "tarea_mock_1",
          titulo: input.titulo,
          workspaceId: ctx.workspaceId,
        }
      },
    })
  }

  const plan: FortePlan = {
    intent: "create",
    summary: "write con mock controlado",
    steps: [
      {
        id: "step-mock-ok",
        kind: "write",
        moduleId: "tareas",
        actionId: mockActionId,
        inputs: { titulo: "Tarea Mock OK" },
        riskLevel: "high",
        requiresApproval: true,
        reason: "write test",
      },
    ],
  }

  const request = await createApprovalRequest({
    plan,
    decision: makeDecision(plan),
    context: BASE_CONTEXT,
  })
  const approved = approvePlan({ request, approvedSteps: ["step-mock-ok"] })

  const result = await executeApprovedRequest(approved, BASE_CONTEXT)

  assert.equal(result.ok, true)
  assert.equal(result.executedSteps.length, 1)
  assert.equal(result.executedSteps[0].actionId, mockActionId)
  assert.equal(result.executedSteps[0].ok, true)
  assert.deepEqual(result.executedSteps[0].data, {
    id: "tarea_mock_1",
    titulo: "Tarea Mock OK",
    workspaceId: "ws_test",
  })
})

// --- Test 11 (bonus): servicio orquestador con store ---
test("servicio orquestador marca completed en store", async () => {
  const { createApprovalRequest, approvePlan } = await import("./approval")
  const { createInMemoryForteApprovalStore } = await import("./approval-store")
  const { executeApprovedPlan } = await import("./approved-execution-service")
  const { registerForteActionHandler, hasForteActionHandler } = await import("./handlers")

  if (!hasForteActionHandler("test.read_service")) {
    registerForteActionHandler({
      actionId: "test.read_service",
      moduleId: "tareas",
      kind: "read",
      async run() {
        return { ok: true, data: [] }
      },
    })
  }

  const plan: FortePlan = {
    intent: "query",
    summary: "service test",
    steps: [
      {
        id: "step-svc",
        kind: "read",
        moduleId: "tareas",
        actionId: "test.read_service",
        inputs: {},
        riskLevel: "low",
        requiresApproval: true,
        reason: "test",
      },
    ],
  }

  const request = await createApprovalRequest({
    plan,
    decision: makeDecision(plan),
    context: BASE_CONTEXT,
  })
  const approved = approvePlan({ request, approvedSteps: ["step-svc"] })

  const store = createInMemoryForteApprovalStore()
  await store.create(approved)

  const result = await executeApprovedPlan(
    { planId: approved.planId, context: BASE_CONTEXT },
    store,
  )

  assert.equal(result.ok, true)
  assert.equal(result.executedSteps.length, 1)

  const final = await store.getById(approved.planId)
  assert.equal(final?.executionStatus, "completed")
  assert.ok(final?.executedAt)
})
