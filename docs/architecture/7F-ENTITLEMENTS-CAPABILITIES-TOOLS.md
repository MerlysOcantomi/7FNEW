# 7F — Entitlements → Capabilities → Tools (Product Access Architecture)

> **STATUS: TARGET ARCHITECTURE / DESIGN. NOT YET IMPLEMENTED.**
>
> ARCH-02 (2026-08-24). This document designs the product-access model
> mandated by [`7F-FUTURE-PLATFORM-ARCHITECTURE.md`](7F-FUTURE-PLATFORM-ARCHITECTURE.md)
> §5 (Entitlements → Capabilities → Tools), §2 (standalone = packaging) and
> §6 (land and expand). It creates no tables, no runtime, no billing, no
> refactors. Every mechanism below is design intent; the only things that
> exist today are the "current state" items explicitly labeled as such.

---

## 1. Concept model — nine words, nine different things

| Concept | Definition | Lives in | Example |
|---|---|---|---|
| **Product** | A sellable unit of the platform. | Code catalog | `smart_inbox`, `growth`, `finance` |
| **Plan / Package** | A commercial bundle: products + limit values + price point. Marketing names live here and **only** here. | Code catalog (versioned) | "Starter", "Finesse Solo" |
| **Entitlement** | The fact that a Workspace has a product/add-on enabled, with status and validity. | Data (per workspace) | `smart_inbox = active` |
| **Capability** | One concrete functionality the platform can grant, named by business domain. | Code catalog | `conversation.reply`, `invoice.create` |
| **Limit / Quota** | How much of a metered resource the workspace may use. Separate from whether it can use it at all. | Data (per workspace, defaulted by package) | `ai.credits.monthly = 3000` |
| **Permission** | Whether **this user** may exercise a capability in this workspace. | `WorkspaceMember` role → permission set | María may `invoice.create`; Ana may only `invoice.read` |
| **Tool** | One executable action, for a human surface or for SevenF Intelligence, mapped to required capabilities + effect. | Code catalog | `draft_reply`, `create_task` |
| **Experience** | The shell: navigation, home, terminology, workflow emphasis. Never an authorization source. | Code (+ workspace selection) | `inbox_focus`, `sevenf`, `finesse` |
| **Vertical** | Domain adaptation (labels, defaults, specialist agent, domain capabilities) applied over the same core. | `Vertical` row + vertical packs | `beauty` |

The load-bearing separations:

- **Product ≠ capability namespace.** Products *grant* capabilities; they do
  not own the nouns (see §5 — this is what makes person convergence and
  land-and-expand possible).
- **Entitlement ≠ permission.** Workspace CAN (entitlement/capability)
  **AND** user MAY (permission). Both must hold; neither implies the other.
- **Experience ≠ authorization.** The shell decides what is *visible*;
  the resolver decides what is *allowed*. A hidden surface is still
  server-side-forbidden if the capability is absent, and a visible one is
  still forbidden if the user lacks permission.
- **Plan name ≠ logic input.** Runtime code never branches on "starter" or
  "pro". Packages compile to products + limits; runtime reads those.

---

## 2. Access resolution

Canonical resolution chain (server-side, fail-closed at every step):

```txt
1. Workspace valid?            (exists, not suspended)          → else DENY
2. Workspace CAN?              entitlement → product active
                               → capability in product's set
                               → not disabled by override        → else DENY
3. User MAY?                   membership exists
                               → role/permission set includes
                                 the capability's permission     → else DENY
4. Context constraints         tenant scope of the resource,
                               safety policies (e.g. AI never
                                 auto-sends), tool effect policy → else DENY
5. → ALLOW (and, for metered capabilities, record usage — §9)
```

Precedence rules:

- **Deny wins.** Any failed step denies; there is no later step that can
  re-allow.
- **Entitlement before permission.** A platform admin's role never
  manufactures a capability the workspace is not entitled to (support
  tooling goes through the platform plane, not through tenant capabilities).
- **Overrides are narrow.** A workspace override (§12) may grant or revoke a
  *specific* capability or limit; it cannot invent unknown keys (§17).
- **UI is downstream.** Navigation, plan names and frontend state are never
  inputs to `can()`. The same resolver answers the API route, the AI tool
  loop and the navigation builder.

Conceptual check: `can(workspace, user, "invoice.create")` considers
workspace entitlement → capability, membership, role/permission set,
context (tenant scope of the target resource), and nothing else.

---

## 3. Core: always available ≠ always visible

Two different statements, kept apart:

- **CORE INTERNAL INFRASTRUCTURE** — exists for every valid workspace, not
  entitlement-gated: Workspace, Membership, Identity/auth, Person/Client
  records, Tasks write layer, Files/Notes/Events storage, Audit, Business
  Profile ("Workspace Profile Lite" minimum per
  `docs/workspace-profile-for-inbox.md`), channel connection plumbing.
- **FEATURE VISIBLE TO USER** — whether an experience exposes a full surface
  for that infrastructure is an experience/product decision.

Core capability set (granted to every workspace, `core` pseudo-product):

```txt
workspace.read        workspace.settings      member.read
person.read           person.write            task.read
task.write            note.read/write         file.read/write
event.read            profile.read            profile.write
audit.read
```

This is exactly what lets **Smart Inbox standalone use clients without
shipping a mandatory "full CRM" product**: `person.read/write` is core
infrastructure; the *Clients-lite* surface in the inbox experience uses it;
a richer Clients surface is an experience decision, not a new entitlement.

---

## 4. Product catalog (target)

```txt
PRODUCTS                          sellable, entitlement-bearing
├── smart_inbox                   conversations, channels, Fanny assist
├── growth                        campaigns, content, segmentation
│   └── presence                  FEATURE PACKAGE of growth (see below)
└── finance                       invoices, payments, money view

VERTICAL OFFERINGS                sellable packages, not new platforms
└── finesse                       beauty vertical experience bundle

ADD-ONS                           attach to an active workspace
├── limit add-ons                 extra seats / locations / ai credits /
│                                 voice minutes / storage
└── capability add-ons            e.g. presence sold onto a non-growth
                                  workspace, voice
```

**Presence** is modeled as a **feature package inside growth**: its
capabilities (`site.*`, `domain.*`) belong to the growth product's set. It
remains independently sellable — as the entitlement `growth.presence`
(a capability add-on granting just that subset) — which preserves both the
ARCH-01 decision ("Presence is part of Growth") and the existing commercial
reality (`PresenceSubscription` standalone sales). It is never a platform.

**Finesse** is a **vertical offering**: a package that (a) entitles a
product set (typically `smart_inbox` + calendar/appointment capabilities +
selected `growth` capabilities + later `finance`), (b) adds beauty domain
capabilities (`appointment.*`, `service.*`, beauty taxonomies), and (c)
pins the `finesse` experience and `beauty` vertical config. Finesse defines
**no duplicate technical modules** — it is a capability selection plus an
experience over the same core (ARCH-01 §12).

---

## 5. Canonical key vocabulary

### 5.1 Current vocabulary audit (2026-08-24)

| Vocabulary | Source | Keys | Runtime relevance |
|---|---|---|---|
| Plan keys | `core/system/plans.ts` (`TenantPlan`) | `free, starter, business, enterprise` | Display + observational limits; `Workspace.plan` free-form string |
| Plan `enabledModules` | `core/system/plans.ts` | `inbox, clients, projects, invoices, tasks, agents, all` | Read for a decision only by `engines/presence/resolve.ts` |
| Workspace module flags | `Workspace.config.modules`, written via `/administracion` (`ITEM_TO_CONFIG_KEY` in `components/administracion-content.tsx`) | `inbox, crm, campaigns, finance, automation` | Platform-admin-set booleans; not consulted by sidebar or APIs |
| Module manifest ids | `modules/*/manifest.ts` | `inbox, clientes, campanas, contenido, finanzas, facturacion, automatizaciones, calendario, documentos, notas, proyectos, tareas, usuarios` | UI/module identity; Forte capability resolver |
| Registry action ids | `core/registry`, `agents/forte/runtime` | `clientes.list, tareas.list, …` | Forte tool→action bridging |
| Presence entitlement | `PresenceSubscription` + `engines/presence/resolve.ts` | product-local | The only real entitlement check in the repo |
| Workspace roles | `core/auth/workspace-auth.ts` | `OWNER, ADMIN, MEMBER, VIEWER` | Enforced on APIs |
| Legacy global roles | `User.role` via `middleware.ts` | `admin, editor, viewer` | Deprecated route gating (debt — §14) |
| Vertical keys | `Vertical` row / `verticalKey` | `beauty` | Vertical packs, experience resolution |

Three module vocabularies plus a product-local entitlement resolver: this
is the drift ARCH-02 exists to stop.

### 5.2 Canonical vocabulary (target)

**Products / entitlement keys** — `snake_case`, marketing-free:

```txt
smart_inbox · growth · finance · finesse (offering) · growth.presence (add-on)
addon.seats · addon.locations · addon.ai_credits · addon.voice_minutes · addon.storage
```

**Capabilities** — `<domain>.<action>` where the domain is a **business
noun, never a product name and never a storage model name**:

```txt
core:      workspace.* member.* person.* task.* note.* file.* event.*
           profile.* audit.*
inbox:     conversation.read conversation.reply conversation.assign
           conversation.convert channel.connect channel.manage
growth:    campaign.read campaign.create campaign.send segment.create
           content.create site.publish site.manage domain.manage
finance:   invoice.read invoice.create invoice.send payment.read
           payment.record transaction.read
scheduling: appointment.read appointment.create calendar.manage
vertical:  service.manage (catalog), beauty-specific additions
ai:        ai.assist ai.summarize ai.draft ai.classify ai.automate
voice:     voice.session voice.tools
```

Why domain-named, not product-prefixed: ARCH-01 §17 flagged the fragmented
person (`Contact`/`Cliente`/`ClientAuth`). Capability keys like
`inbox.contact.read` / `growth.cliente.read` / `finance.client.read` would
freeze that fragmentation into the access model. Instead there is exactly
**one** `person.*` domain; today's three storage models are an
implementation detail behind it, and the future person convergence changes
zero capability keys. The same applies to `task.*` (`WorkspaceTask` vs
legacy) and every other noun: **capabilities name the business concept,
products bundle capabilities, storage models stay invisible.**

**Tools** — `snake_case` verbs, each defined with `requires` (capabilities),
`effect` (`read | navigate | draft | propose | write` — adopting the
existing `core/voice/contracts.ts` effect vocabulary) and `activity` (§9):

```txt
search_client        requires person.read              effect read
read_conversation    requires conversation.read        effect read
summarize            requires ai.summarize             effect read
draft_reply          requires ai.draft                 effect draft
send_reply           requires conversation.reply       effect write
create_task          requires task.write               effect write
segment_clients      requires segment.create           effect read
create_campaign      requires campaign.create          effect write
create_invoice       requires invoice.create           effect write
```

**Experiences**: `sevenf` (full platform) · `inbox_focus` · `finesse` ·
future `growth_focus`, `finance_focus`.
**Verticals**: `beauty` (existing), future keys as needed.

---

## 6. Product vs experience

An **experience** determines navigation, home/dashboard, terminology,
workflow emphasis, and visible surfaces. It is selected per workspace
(derived from its offering/vertical, overridable), and it may only ever
**narrow** what is shown — never widen what is allowed.

| Situation | Experience | Authorization source |
|---|---|---|
| Smart Inbox standalone | `inbox_focus` | entitlements: core + smart_inbox |
| Finesse customer | `finesse` | entitlements: the finesse offering's product set |
| Full SevenF | `sevenf` | entitlements: whatever is active |

Rule: **authorization comes from entitlements + capabilities + permissions;
experience is presentation.** A request that bypasses the shell (direct
API, AI tool, deep link) hits the same server-side resolver and gets the
same answer. Today's inbox-focused sidebar (`components/sidebar-nav.tsx`)
is the embryo of `inbox_focus` — currently route-triggered; in the target
model it is entitlement/offering-derived.

---

## 7. Land and expand

Workspace buys Smart Inbox; later buys Growth.

```txt
BEFORE  entitlements: core (implicit) + smart_inbox
        experience:   inbox_focus
AFTER   entitlements: core + smart_inbox + growth
        experience:   sevenf (or growth-aware shell) — offered, not forced
```

What changes: one entitlement row appears; the capability snapshot (§18)
now includes `campaign.* / segment.* / content.* / site.*`; navigation
gains Growth surfaces; SevenF Intelligence's allowed toolset gains Growth
tools (§10) on the next resolution.

What must NOT happen (guardrail, ARCH-01 §6): new workspace, new identity,
client re-import, conversation migration, Business Profile duplication.
The same `person`, `conversation`, `profile` records simply become
addressable by more capabilities. Deactivation is the mirror: entitlement
ends → capabilities disappear from the snapshot → surfaces/tools vanish —
**data is never deleted by an entitlement change**.

---

## 8. Limits / quotas

Three separate questions, never merged:

```txt
ENTITLEMENT   voice.enabled = true            can it use voice at all?
LIMIT         voice.minutes.monthly = 100     how much may it use?
USAGE         voice.minutes.used = 62         how much has it used?   (Usage Meter — future)
```

Limit categories (keys are canonical, values come from package defaults +
add-ons + overrides):

```txt
seats.max · locations.max · ai.credits.monthly · voice.minutes.monthly
storage.gb · messages.monthly · automation.executions.monthly
```

Design decisions:

- Limits are **data per workspace** (defaulted from the package, adjusted
  by add-ons/overrides), so sales exceptions don't fork packages.
- Enforcement posture is per-limit (`hard` block vs `soft` warn) and is
  part of the limit definition, not scattered in call sites.
- Usage tracking itself is the future Usage Meter (ARCH-01 §10). This model
  only guarantees the *shape*: every metered capability names its limit key,
  so the meter can attach without redesign.
- Current state: `core/system/plans.ts` limits are observational
  (`seatLimitReached` display only) — they map cleanly onto this model as
  package defaults.

---

## 9. Telemetry & Usage Meter compatibility

Every capability and tool definition carries attribution metadata so the
future layers can hook in without remodeling:

```txt
capability: campaign.create
  product:  growth
tool: draft_reply
  requires: ai.draft
  activity: ai.reply_draft        ← Usage Meter activity key (future)
  product:  smart_inbox
```

Therefore a future telemetry event can always be attributed as
`{workspace, product, capability, experience}` (e.g.
`first_campaign_created` → growth / `campaign.create` / `finesse`), and a
future usage record as `{workspace, product, activity, provider, model,
units, cost}` — because the resolver context (§18) already knows workspace,
product, capability, experience and (via the AI gateway, §16) provider and
model at the moment of execution. **No events and no meter are implemented
by ARCH-02**; the design simply refuses to lose the attribution keys.

---

## 10. SevenF Intelligence tool resolution

Target rule — the allowed toolset is **derived, never hardcoded per agent**:

```txt
workspace capabilities            (entitlements → §2 step 2)
∩ user permissions                (the human the agent acts for — §11)
∩ persona scope                   (which tools this persona/surface uses)
∩ experience surface              (which tools this surface exposes)
= allowed toolset for this session
```

- Example: Fanny inside Finesse resolves `person.read`,
  `appointment.read/create`, `conversation.reply` tools — and **cannot**
  resolve `create_invoice` while `finance` is not entitled. Activate Growth
  and compatible Growth tools appear on the next resolution, with zero
  agent code changes.
- **Persona ≠ permission boundary.** A persona (Fanny, Finesse, Freya,
  Forte) is scope and voice — a *filter* over the allowed set, never an
  *authority*. Security comes from capabilities + permissions + tool effect
  policy; renaming or adding personas moves no security boundary.
- Tool `effect` + execution policy (`immediate / controlled /
  confirmation_required`, from `core/voice/contracts.ts`) survive into this
  model: `write`-effect tools remain approval-gated where policy says so
  (Fanny proposes; the operator approves — unchanged).
- Current state to evolve, not multiply: Forte's
  `agents/forte/runtime/capability-resolver.ts` (context → capabilities →
  plan → policy → execution) is the closest existing implementation and the
  seed of this design; Fanny/Finesse hardcoded prompt+action lists migrate
  onto the same resolution path in the SevenF Intelligence missions.

---

## 11. Permissions × entitlements

```txt
Workspace CAN   (entitlement → capability)     — §2 step 2
AND
User MAY        (membership → role → permission set)   — §2 step 3
```

- `WorkspaceMember` is **not replaced**. The existing ladder
  `OWNER > ADMIN > MEMBER > VIEWER` (`core/auth/workspace-auth.ts`) remains
  the enforcement backbone.
- Evolution path (design, not implementation): each role maps to a
  **permission set** — a named list of capabilities it may exercise
  (e.g. VIEWER → `*.read`; MEMBER → + `conversation.reply`, `task.write`;
  ADMIN → + `channel.manage`, `member.manage`, `invoice.create`; OWNER →
  everything + `workspace.settings`). Sufficient for the near future.
- If finer grain is ever needed (María creates invoices, Ana only reads
  them, both MEMBER), the extension is **per-member capability grants**
  layered on top of the role's set — additive data, no new role names, no
  ladder change. Do not build it until a real customer case demands it.
- Platform roles (`PlatformAdmin`) stay orthogonal: they operate the
  platform plane and never appear in tenant capability resolution.

---

## 12. Conceptual data model (no Prisma, no tables)

Question asked by the mission: *do we store each capability per workspace?*
**No.** Capabilities derive from products in code; the database stores only
facts that vary per workspace:

```txt
CODE-DEFINED (versioned with the repo)
  CapabilityDefinition   key, domain, product, description,
                         limitKey?, activityKey?, effect?
  ProductDefinition      key, capability set, default limits,
                         feature packages (e.g. growth → presence)
  PackageDefinition      commercial bundles: product set + limit values
                         (+ trial config); marketing names live here
  ToolDefinition         key, requires[], effect, activityKey, policy
  ExperienceDefinition   key, navigation profile, terminology

DATA (per workspace — future tables, NOT created now)
  WorkspaceEntitlement   workspaceId, kind (product|addon|offering),
                         key, status (active|trial|suspended|expired),
                         source (billing|manual|migration),
                         startsAt, endsAt?, packageRef?
  WorkspaceLimit         workspaceId, limitKey, value, source
  WorkspaceOverride      workspaceId, capabilityKey, grant|revoke,
                         reason, audited — EXCEPTIONAL, rare by design
```

Resolution: `entitlements → union of product capability sets → minus/plus
overrides → capability snapshot` + `limits = package defaults → +add-ons →
+overrides`. This covers product packages, limits, add-ons, trials, feature
rollout (via flags, §15 — separate axis), standalone products and
land-and-expand, with three small tables and zero per-capability rows.

### Defaults / overrides hierarchy

```txt
Platform defaults        code     (core capability set, global safety)
→ Product definition     code     (what the product grants)
→ Package configuration  code     (which products + limit values)
→ Workspace entitlement  data     (which packages/products this tenant has)
→ Workspace override     data     (exceptional, audited, expiring)
```

Code-defined: everything above the entitlement line (catalogs change by
deploy, are reviewed, and stay consistent). Data-driven: only the
per-workspace facts. This avoids the unmaintainable matrix: no per-plan
capability tables in the DB, no per-workspace capability dumps.

---

## 13. Trials and add-ons

**Trials** are entitlements with `status = trial` and an `endsAt`
(e.g. Finesse 15-day trial → one `WorkspaceEntitlement{kind: offering,
key: finesse, status: trial, endsAt: +15d}`). Expiry flips status →
capabilities leave the snapshot → fail closed; **no data is deleted**, so
conversion to paid is a status change, honoring land-and-expand. Billing
logic (charging, dunning) is out of scope (§16).

**Add-ons** are entitlement rows, not new mechanisms:

- *Limit add-ons* (extra seats/locations/AI credits/voice minutes/storage)
  → entitlement rows whose effect is a `WorkspaceLimit` adjustment.
- *Capability add-ons* (presence on a non-growth workspace, voice) →
  entitlement rows granting a named capability subset of an existing
  product. Never new products, never new namespaces.

---

## 14. ARCH-01 conflicts — how this design treats them

- **`User.role` global (middleware gating)** — classified **LEGACY
  AUTHORIZATION DEBT**. It is **not an input** to entitlements, capability
  resolution or permission sets — ever. Conceptual retirement: once
  route-level checks read the workspace-scoped resolver (§2), the
  middleware's `User.role` branch becomes redundant and is deleted in a
  dedicated mission. Until then it may only keep doing what it does today;
  no new code may read it. *(Not fixed in ARCH-02.)*
- **Person fragmentation (`Contact` / `Cliente` / `ClientAuth`)** — the
  capability vocabulary already assumes the future canonical person:
  a single `person.*` domain (§5.2). No capability key encodes any of the
  three storage models, so the convergence mission will not touch access
  keys. Entitlements must never gain per-model capabilities. *(Not fixed
  in ARCH-02.)*
- **Duplicate OpenAI client (`app/api/ai/agent/route.ts`)** — ARCH-02
  assumes a future **SevenF Intelligence / AI Gateway** layer that resolves
  provider, model, tools, usage, workspace and capabilities in one place
  (ARCH-01 §7). Entitlements and capabilities are provider-agnostic:
  nothing in this model depends on OpenAI or any vendor (`ai.*` and
  `voice.*` capabilities name platform functionality, not providers).
  *(Not refactored in ARCH-02.)*

---

## 15. Feature flags ≠ entitlements ≠ permissions

```txt
ENTITLEMENT    did the customer buy / is the workspace granted it?
FEATURE FLAG   does SevenF want this implementation live (rollout/experiment)?
PERMISSION     may this user exercise it?
```

All three are independent axes and all must pass. Flags are operational
(platform-controlled, can vanish any day, never sold, never a substitute
for billing/entitlements); entitlements are commercial facts; permissions
are per-user. A capability behind a disabled flag is simply *not yet
served*, even for entitled workspaces; a flag can never serve a capability
the workspace is not entitled to.

---

## 16. Billing boundary

```txt
Billing provider (Stripe, …)
      │  webhooks / reconciliation
      ▼
Entitlement writer  (the ONLY component that writes WorkspaceEntitlement
      │              from commercial events)
      ▼
SevenF entitlements  ←  runtime reads ONLY this
```

Runtime authorization never consults the billing provider. Stripe (or any
successor) is a *source of commercial events*, not the runtime source of
truth for capabilities — preserving provider substitutability (ARCH-01 §8)
and keeping resolution fast and offline-safe. Manual grants
(`source: manual`) and migration backfills (`source: migration`) flow
through the same writer, so entitlements have one audited write path.

---

## 17. Failure modes — fail closed

| Condition | Behavior |
|---|---|
| Entitlement store unavailable | Sensitive operations DENY. Core infrastructure (§3: session, workspace resolution, reads needed to render an error state) stays functional; nothing capability-gated auto-enables. |
| Unknown product key on an entitlement | Grants **nothing**; logged loudly for operators. Never "unknown → allow". |
| Unknown capability asked of `can()` | DENY + log. Unknown keys are bugs, not features. |
| Workspace missing / suspended | DENY everything tenant-scoped. |
| Membership missing | DENY (workspace CAN is irrelevant if user isn't a member). |
| Inconsistent plan/package data | Resolve to the **narrowest** consistent grant; flag for operators; never widen. |
| Expired trial / ended entitlement | Capabilities leave the snapshot; data untouched. |

The existing `Workspace.plan` permissive resolver (unknown plan → treated
leniently for display) is acceptable for observational metadata but is the
opposite of this posture — enforcement must come from the new resolver, not
from hardening the display path.

---

## 18. Performance / caching posture (design only)

Capability checks will run on virtually every request and every AI tool
resolution, so the unit of work is a **resolved snapshot, not a query per
capability**:

```txt
EntitlementContext (per workspace)
  { products, capabilitySet, limits, experience, version }
  — built in one read, cacheable, invalidated by entitlement writes

RequestAccessContext (per request)
  EntitlementContext + membership/role + permission set
  — resolved once per request, passed down; `can()` is then a set lookup
```

No distributed cache infrastructure is designed now; the contract is
simply: (a) one resolution per request, (b) `can()` is O(1) against the
snapshot, (c) entitlement writes bump a version so caches can invalidate.

---

## 19. Target API (conceptual signatures only)

```txt
getWorkspaceEntitlements(workspaceId)        → Entitlement[]
resolveWorkspaceCapabilities(workspaceId)    → EntitlementContext
getWorkspaceLimits(workspaceId)              → Record<LimitKey, Value>
canWorkspace(workspaceId, capability)        → boolean          (steps 1–2)
canUser(workspaceId, userId, capability)     → Decision {allowed, reason}  (steps 1–4)
getAllowedTools(context)                     → ToolDefinition[] (§10 intersection)
resolveExperience(workspaceId)               → ExperienceKey
```

Coherence check the API enables: navigation building
(`resolveWorkspaceCapabilities` + `resolveExperience`), API enforcement
(`canUser`), AI tool gating (`getAllowedTools`) and limit display
(`getWorkspaceLimits`) all read the same resolution — one truth, four
consumers. No implementation in ARCH-02.

---

## 20. Example matrices

| | A. Smart Inbox standalone | B. Growth standalone | C. Finance standalone | D. Finesse Solo | E. Full SevenF |
|---|---|---|---|---|---|
| **Products** | core + smart_inbox | core + growth | core + finance | core + finesse offering (smart_inbox + scheduling + growth subset + beauty domain) | core + smart_inbox + growth + finance (+ vertical if any) |
| **Experience** | `inbox_focus` | `growth_focus` | `finance_focus` | `finesse` | `sevenf` |
| **Capabilities (sketch)** | core.* + conversation.* channel.* ai.assist/summarize/draft | core.* + campaign.* segment.* content.* site.* ai.generate | core.* + invoice.* payment.* transaction.* | core.* + conversation.* appointment.* service.* site.publish ai.assist voice.session | union of active products |
| **Tools (sketch)** | search_client, read_conversation, summarize, draft_reply, send_reply, create_task | segment_clients, create_campaign, generate_content, publish_site | create_invoice, read_invoice, record_payment | inbox tools + book_appointment, manage_services, publish_site | union, permission-filtered |
| **Limits (sketch)** | seats, channels, ai.credits | seats, ai.credits, messages | seats | seats, ai.credits, voice.minutes | package-defined |
| **Hidden/inactive** | growth, finance not rendered (not "locked" tiles) | inbox, finance | inbox, growth | finance until activated | none active-hidden; inactive products simply absent |

In every column the workspace sits on the same platform: activating another
product edits the entitlement list, never the data (§7).

---

## 21. Current → future mapping

| Current concept | Future concept | KEEP / EVOLVE / RETIRE | Notes |
|---|---|---|---|
| `core/system/plans.ts` (`TenantPlan`, limits, `enabledModules`) | `PackageDefinition` seed (products + limit defaults) | EVOLVE | Already single-source and observational; its `enabledModules` vocabulary is replaced by canonical product keys. |
| `Workspace.plan` free-form string | Entitlement rows referencing a package | EVOLVE | Backfill via `source: migration`; permissive display resolver stays display-only. |
| `Workspace.config.modules` (`crm`, `campaigns`, …) | `WorkspaceEntitlement` / overrides | RETIRE (vocabulary) | The admin toggle intent survives as entitlement management; the third key vocabulary does not. |
| Module manifest ids (`clientes`, `campanas`, …) | Surface/module ids for UI + registry | KEEP | They identify surfaces, not access; never authorization keys. |
| `PresenceSubscription` + `resolvePresenceEntitlement` | `growth.presence` capability add-on through the shared resolver | EVOLVE | The one real entitlement check today; generalize, don't multiply. |
| `WorkspaceRole` ladder (`core/auth/workspace-auth.ts`) | Role → permission-set mapping (§11) | KEEP / EVOLVE | Backbone unchanged; capabilities attach to roles. |
| `User.role` middleware gating | — | RETIRE | Legacy authorization debt (§14); no new readers. |
| Forte `runtime/` capability resolver + registry action ids | SevenF Intelligence tool resolution (§10) | EVOLVE | Closest existing implementation of the target chain. |
| `core/voice/contracts.ts` tool effect/policy | `ToolDefinition.effect` + execution policy | KEEP | Adopted as the platform-wide tool governance vocabulary. |
| Vertical packs / `verticalKey` | Vertical config + experience input | KEEP | Already data-only; feeds `resolveExperience`. |
| Inbox-focused sidebar mode | `inbox_focus` experience | EVOLVE | From route-triggered to entitlement/offering-derived. |
| Agent personas (Fanny/Finesse/Freya/Forte) | SevenF Intelligence personas (scope filters) | KEEP / EVOLVE | Persona ≠ permission boundary (§10). |

---

## 22. Should entitlements be implemented before building more product surfaces?

**Answer: PARTIALLY — minimal foundation now.**

- **Why not NO:** the repo already shows what happens without a spine —
  three module vocabularies, a product-local entitlement resolver
  (Presence), and observational plans nobody enforces. Every new standalone
  surface (Growth, Finance) built before a canonical vocabulary + resolver
  exists will invent a fourth vocabulary and more product-local checks,
  which ARCH-01 forbids and which is expensive to unwind.
- **Why not full YES:** full enforcement, entitlement tables and billing
  integration are premature — there is no billing runtime, one real
  vertical, and few paying-tier decisions taken. Building the whole engine
  now violates "build only what is needed now".
- **The minimal foundation** = Phases 1–2 below (canonical vocabulary as
  code + a read-only resolver that wraps today's sources behind the target
  API). Cheap, deleteable-nothing, and every new Growth/Finance surface can
  then be written against `canUser()` from day one — enforcement arrives
  later by strengthening the resolver, not by rewriting call sites.

---

## 23. Implementation phases (future missions — none executed here)

```txt
Phase 1  Canonical vocabulary       CapabilityDefinition / ProductDefinition /
         (code-only)                ToolDefinition catalogs as typed constants;
                                    no behavior change.
Phase 2  Read-only resolver         resolveWorkspaceCapabilities()/canUser()
                                    wrapping plans.ts + config.modules +
                                    PresenceSubscription; logs divergence
                                    between the three vocabularies; still
                                    enforces nothing.
Phase 3  Entitlement data model     WorkspaceEntitlement / WorkspaceLimit (+
                                    overrides) tables; backfill from
                                    Workspace.plan + config.modules +
                                    PresenceSubscription (source: migration);
                                    resolver reads data first, legacy second.
Phase 4  Server-side enforcement    New surfaces (Growth, Finance) gated from
                                    day one; then retrofit existing APIs;
                                    fail-closed posture (§17) goes live.
Phase 5  Experience & navigation    Shells derived from entitlements +
                                    experience; /administracion module toggles
                                    become entitlement management; retire
                                    config.modules vocabulary.
Phase 6  AI tool gating             getAllowedTools() feeds Fanny/Finesse/
                                    Forte via the SevenF Intelligence / AI
                                    Gateway missions (includes unifying the
                                    duplicate OpenAI client).
Phase 7  Billing integration        Entitlement writer fed by the billing
                                    provider; trials/add-ons live; User.role
                                    middleware retirement completes alongside.
```

Ordering rationale: vocabulary before resolver (nothing to resolve
otherwise); resolver before tables (proves the API against real call sites
with zero migration risk); tables before enforcement (enforcement needs a
trustworthy source); navigation and AI gating after enforcement exists to
read; billing last (it only *writes* what everything else already reads).

---

*Next design mission recommended by ARCH-02: ARCH-03 — SevenF Intelligence /
AI Gateway design (tool runtime, provider abstraction, usage capture), which
consumes §10 and §14 of this document.
**COMPLETE** → [`7F-SEVENF-INTELLIGENCE-AI-GATEWAY.md`](7F-SEVENF-INTELLIGENCE-AI-GATEWAY.md).*
