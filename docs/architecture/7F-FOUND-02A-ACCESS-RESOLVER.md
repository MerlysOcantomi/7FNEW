# 7F — FOUND-02a: Read-Only Access Resolver & Role Permission Policy

> **STATUS: IMPLEMENTED FOUNDATION — READ-ONLY RESOLUTION, NO ENFORCEMENT.**
>
> FOUND-02a (2026-08-25) implements ARCH-02 Phase 2
> ([`7F-ENTITLEMENTS-CAPABILITIES-TOOLS.md`](7F-ENTITLEMENTS-CAPABILITIES-TOOLS.md))
> on the FOUND-01 vocabulary: canonical workspace roles, the role →
> permission-set policy, the read-only workspace capability resolver over
> today's real sources, and typed `canWorkspace()` / `canUser()` decisions.
> **Nothing consumes these decisions as enforcement**: every route keeps
> using the existing RBAC helpers. Zero schema changes, zero migrations,
> zero production access.

## Canonical role policy

- `core/platform/roles.ts` — single source for `WORKSPACE_ROLES`
  (OWNER/ADMIN/MEMBER/VIEWER), `WORKSPACE_ROLE_LEVELS`, strict
  `isWorkspaceRole` / `parseWorkspaceRole` (unknown → `null`, never a
  fallback). `core/auth/workspace-auth.ts` re-exports the type so existing
  imports keep working. The Prisma `role String` column is unchanged.
- `core/platform/role-policy.ts` — immutable `WorkspaceRole → ReadonlySet
  <CapabilityKey>` derived from **current route thresholds**
  (`requireReadAccess` = VIEWER, `requireWriteAccess` = MEMBER,
  `requireAdminAccess` = ADMIN): VIEWER = reads + read-side AI + voice
  session; MEMBER adds operational writes; ADMIN adds administrative
  permissions (business profile PATCH, team, channels, site publishing);
  OWNER = every declared capability. Monotonic
  `VIEWER ⊆ MEMBER ⊆ ADMIN ⊆ OWNER`; documented exception: OWNER == ADMIN
  today because no route enforces an OWNER-exclusive threshold yet.
  Background pipelines (Fanny ingestion) run as a system principal, not a
  member role — system-principal resolution is future work.

## Permission model (owner decision)

The permission atom **is** the canonical `CapabilityKey` — there is
deliberately **no parallel PermissionKey namespace** (ARCH-02 §11). The
same stable key passes two independent gates, kept apart by sets, stages
and denial reasons — never by a duplicated catalog:

```txt
Workspace capability    the workspace CAN   → capability_not_granted
Role permission         this user MAY       → permission_denied
Effective capability    CAN ∩ MAY           → resolveEffectiveCapabilities
```

`PlatformToolDefinition.requiresPermissions` therefore stays
`CapabilityKey`-based, defaults to `requiresCapabilities`, and is validated
**stricter-only** (an explicit list must include every required capability;
it can add, never drop). A finer permission namespace would require a
future explicit owner decision backed by real product evidence.

## Workspace capability resolver

`core/platform/workspace-capabilities.ts` —
`resolveWorkspaceCapabilitySnapshot(sources)`: pure, deterministic,
resolves ONCE into a snapshot (`products` with per-source evidence,
`capabilities`, `addonCapabilities`, `diagnostics`, `observational: true`,
`version`). Sources and mappings:

| Source | Mapping | Posture |
|---|---|---|
| Core | always granted to a valid workspace | ARCH-02 §3 |
| `Workspace.plan` via `core/system/plans.ts` | `inbox→smart_inbox`, `invoices→finance`, `clients/tasks→core`, `all→` all products; `projects`/`agents` → diagnostic, no grant | observational — never presented as paid entitlement |
| `Workspace.config.modules` | `inbox→smart_inbox`, `campaigns→growth`, `finance→finance`, `crm→core`; `automation`/unknown keys → diagnostic, no grant | admin flags |
| Presence standalone subscription | `site.publish`/`site.manage` as ADD-ON capabilities (no growth product implied) | the one real entitlement today |

Fail-closed rules: unknown plan/module/status values grant nothing beyond
valid Core; divergent sources (e.g. config disables what the plan grants)
produce diagnostics — no source widens and, in this observational resolver,
none removes; no DB writes, no billing calls, no fourth vocabulary.

## Access decisions

`core/platform/access.ts` — `canWorkspace(snapshot, capability)` and
`canUser(snapshot, membership, capability)` return a typed
`AccessDecision` with reasons: `allowed · workspace_not_found ·
workspace_suspended · no_membership · unknown_role · unknown_capability ·
capability_not_granted · permission_denied`. Workspace gate always runs
before the user gate; deny wins; all inputs treated as untrusted.
`workspace_suspended` reports the fail-closed posture enforcement will
adopt (`Workspace.status` stays observational — no behavior change today).

## Auth hardening (the one behavioral change)

`core/auth/workspace-auth.ts` had two unsafe paths, both closed:

- `requireWorkspaceRole`: missing membership defaulted to `VIEWER`, and an
  unknown/corrupt role string passed **every** threshold
  (`WS_ROLE_LEVEL[unknown]` is `undefined`, and `undefined < level` is
  `false`). Now: missing membership → 403 FORBIDDEN; unparseable role →
  403 FORBIDDEN.
- `requireRoleInWorkspace`: missing role string defaulted to `VIEWER`; now
  strict parse → 403 FORBIDDEN.

Valid OWNER/ADMIN/MEMBER/VIEWER members keep exactly the current behavior
(`resolveRequiredWorkspace` already validates membership on every path, so
the new denials only fire on corrupt data or TOCTOU). Tenant and header
restrictions unchanged; `PlatformAdmin` untouched and still orthogonal.

## Neon compatibility

Everything added is pure over evidence inputs (`WorkspaceCapabilitySources`,
membership role strings): no Turso/libSQL behavior, no SQL, no schema, no
provider-specific reads. The Turso→Neon cutover changes how callers *load*
the evidence, not one line of this resolution logic. Future additive
extensions (custom roles, per-member grants, entitlement tables,
`WorkspaceLimit`/`WorkspaceOverride`) are designed to land directly on
Neon/Postgres after product evidence — the extension point is
`getRolePermissions` (layer per-member grants over the role set) and the
snapshot's `sources`/`version` fields.

## Remains unenforced / out of scope

No route consumes `canUser()`; navigation, middleware and the deprecated
global `User.role` are untouched; no tool discovery (`getAllowedTools`) or
execution authorization; no entitlement/limit/override tables; no billing;
no custom roles. Schema changes 0 · migrations 0 · production connections 0
· production writes 0.
