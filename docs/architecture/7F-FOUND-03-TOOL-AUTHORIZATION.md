# 7F — FOUND-03: Canonical Tool Resolution & Fail-Closed Authorization

> **STATUS: IMPLEMENTED FOUNDATION — READ-ONLY DECISIONS + ONE BOUNDED
> LEGACY GUARDRAIL. NOT platform-wide enforcement.**
>
> FOUND-03 (2026-08-25) connects the FOUND-01 tool catalog and the
> FOUND-02a access foundation into one deterministic tool-authorization
> layer (ARCH-02 §2 / ARCH-03 §7–§8), and closes one confirmed legacy
> authorization bypass. Zero schema/migration/production changes.

## Problem and boundaries

FOUND-01/02a/02b shared a vocabulary but nothing answered "may THIS
context use THIS tool, and why?". Meanwhile the legacy agent path had a
confirmed bypass (verified from code in this mission):
`app/api/ai/agent/route.ts` requires only read access; the Forte adapter
appended non-bridged legacy tools **unfiltered**; and
`agents/forte/executor.ts` executed legacy WRITE tools with no
role/permission check — so a VIEWER (or a missing/corrupt role) could
create tareas/campañas/contenido/ideas and spend image generation through
the agent. FOUND-03 builds the canonical decision layer and applies the
smallest safe guardrail to that path only. It does NOT do AI-06 (tool-loop
migration), route-by-route enforcement, persistent entitlements, the
Usage Meter, or handler bindings.

## Canonical inputs and outputs

`core/platform/tool-authorization.ts` — pure, no DB/network/provider/UI:

```txt
authorizeToolInvocation(context, toolKey, {requireExecutable=true})
resolveAvailableTools(context)                     // discovery
contextExcludes(definition, narrowing)             // pure narrowing predicate

ToolResolutionContext = { snapshot   (FOUND-02a WorkspaceCapabilitySnapshot | null)
                          membership (MembershipEvidence | null)
                          narrowing? (persona/experience/channel/vertical) }

ToolAccessDecision = { allowed, reasons[], toolKey, definition|null,
                       requiredCapabilities[], requiredPermissions[],
                       missingCapabilities[], missingPermissions[],
                       executable }
```

Reasons (stable, deduplicated, deny wins): `allowed · unknown_tool ·
workspace_not_found · workspace_suspended · capability_not_granted ·
no_membership · unknown_role · permission_denied · tool_not_executable ·
context_excluded`. Denials are typed results, never exceptions; decisions
expose requirement sets and missing sets but no secrets and no raw
membership records.

## Resolution algorithm

```txt
1. Catalog gate      toolKey ∈ TOOL_KEYS, else unknown_tool
2. Workspace gate    EVERY requiresCapabilities passes canWorkspace()
                     (full set preserved — no invented "primary capability")
3. User gate         membership present → strict role parse →
                     EVERY required permission (getToolRequiredPermissions,
                     i.e. explicit stricter-only list or the capability set)
                     ∈ role permission set
4. Execution gate    handler binding must exist when execution is requested
                     (all FOUND-01 catalog tools are unbound today → real
                     invocations fail closed with tool_not_executable)
5. Narrowing         availability allowlists may EXCLUDE; by construction
                     narrowing only appends denials — it can never grant
```

**Discovery vs execution:** `resolveAvailableTools` evaluates the catalog
without the binding requirement — unbound definitions are discoverable
metadata, never reported executable (`executable: []` today). A discovery
result is not a durable token: every invocation re-runs
`authorizeToolInvocation`. Personas/experiences are not security
boundaries (ARCH-03 §10).

## The bounded legacy guardrail (the one behavior change)

`agents/forte/legacy-tool-guardrail.ts` maps the gated legacy tools to the
canonical capabilities they exercise — `crear_tarea→task.write`,
`crear_campana→campaign.create`, `crear_contenido/crear_idea/
generar_imagen→content.create` (image generation produces content
assets), `buscar_facturas→invoice.read` — and permits only roles whose
FOUND-02a permission set holds every one (no detached allowlist; canonical
policy only). Enforced at **two** points: the executor denies before any
tool logic runs (a model-invented call gains no authority), and the
adapter no longer appends non-permitted legacy tools to discovery.

Effect: VIEWER and missing/corrupt roles can no longer see or execute the
legacy write/generate tools through the agent route; MEMBER/ADMIN/OWNER
behavior is unchanged (their role sets already hold the mapped
capabilities); `buscar_facturas` is unchanged for every valid role.
Workspace-CAPABILITY enforcement is deliberately NOT activated on this
path (it would change behavior for valid members); that arrives with
AI-06 on the full decision.

## Runtime enforcement map (no ambiguity)

- **Enforced now:** only the legacy agent executor/adapter permission
  guardrail above.
- **Not enforced anywhere yet:** `authorizeToolInvocation` /
  `resolveAvailableTools` (no live route consumes them), workspace
  capability gating, entitlements, limits. The live agent route is NOT
  "protected by FOUND-03" beyond the guardrail described.

## Relationships

- **FOUND-01:** consumes `TOOL_CATALOG`/`ToolKey`/`getToolRequiredPermissions`
  unchanged; catalog invariants still hold. `AIExecutionAttribution.tool`
  tightened from `string` to `ToolKey` (safe: no caller set it; no cycles —
  `core/platform` imports nothing from `engines/`). The singular
  `attribution.capability` stays optional-and-explicit; the resolver keeps
  the full capability set (never fabricate a primary).
- **FOUND-02a:** reuses `canWorkspace`, role parsing and permission sets —
  no second authorization system, no new vocabulary.
- **FOUND-02b:** untouched behaviorally; usage preservation intact;
  missing usage still never reads as zero.
- **Forte resolver (`capability-resolver.ts`):** classified, not rewritten
  — canonical-and-reusable: the context invariants and role/surface
  gating *shape*; legacy compatibility: action-id vocabulary
  (`clientes.list`…) and bridges; unsafe to promote: `config.modules`
  as an authority source and the (now closed) unfiltered append; deferred
  to AI-06: converging its resolution onto `resolveAvailableTools`.
- **AI-06 (next):** migrates the agent route onto `executeAI` + this
  layer, removes the duplicated OpenAI client, retires the legacy tool
  vocabulary, and activates the full workspace+user decision there.

## Deferred / known risks

Persistent entitlements (tables), Usage Meter persistence, route-by-route
enforcement, handler bindings (AI-04), `getAllowedTools` feeding real AI
sessions (AI-05), legacy `User.role` middleware retirement, and the agent
route's read-threshold + duplicated client (AI-06). Security follow-up
closed this mission: the VIEWER write bypass. No schema, no migrations,
no production connections, no production writes.
