# 7F — Future Platform Architecture & Development Guardrails

> **STATUS: FUTURE ARCHITECTURE / DEVELOPMENT GUARDRAIL.**
> **NOT: fully implemented current state.**
>
> This document records the platform architecture approved by the owner
> (mission ARCH-01, 2026-08-24) as the direction every new design must be
> checked against. It describes where SevenF is going, not what is already
> built. Sections marked **FUTURE** have no runtime today — on purpose.
>
> Companions: `docs/ways-of-working.md` (operating contract),
> `docs/execution-workflow.md` (delivery protocol),
> `docs/product/7f-professional-direction-audit.md` (2026-07-12 repo compass),
> `docs/evolution/EVOLUTION-CLOSED.md` (schema/Evolution closure).

---

## 1. What SevenF is

**One platform + several products + several experiences.**

SevenF (7F) is a single multi-tenant SaaS platform for intelligent business
work. Products (Smart Inbox, Growth, Finance, …) and vertical experiences
(Finesse) are *packaging and surface* over one shared platform — never
parallel technical applications.

```txt
7F PLATFORM
│
├── CORE                       (shared domain — §3)
│
├── Smart Inbox                (product)
├── Growth                     (product — includes Presence)
├── Finance                    (product)
├── other future modules       (products)
│
├── SevenF Intelligence        (shared AI layer — §7)
│
└── Experiences / Verticals
    └── Finesse                (Beauty vertical experience — §12)
```

SevenF must **not** become a collection of technically independent
applications that duplicate data and functionality. That failure mode —
several inboxes, several client lists, several identity systems, several
AIs — is the single most expensive mistake this document exists to prevent.

---

## 2. Standalone = commercial packaging, not a separate platform

Smart Inbox, Growth, Finance and future modules **can each be sold alone**.
"Standalone" describes the **product**: packaging, navigation, price and
experience. It never describes a separate technical platform.

```txt
Workspace
├── Core          ACTIVE   (always)
├── Smart Inbox   ACTIVE
├── Growth        INACTIVE
├── Finance       INACTIVE
└── others        INACTIVE
```

- A customer who buys only Smart Inbox must feel they bought a complete
  product. They need not see a huge SevenF full of locked modules.
- Internally that customer still runs on **7F Platform + Core + Smart
  Inbox**. There is no "other" Smart Inbox codebase, schema or deployment.
- What differs between a standalone sale and a full-platform sale is the
  workspace's **entitlements** (§5) and the experience shell — nothing else.

Precedent already encoded in the repo: standalone Smart Inbox still ships
with a minimal Workspace Profile (`docs/workspace-profile-for-inbox.md`) —
"Inbox-only" means *Inbox + lite profile on the shared core*, not an empty
parallel shell.

---

## 3. Shared Core

The Core is the shared domain every product consumes. A module must never
recreate a concept that belongs to the Core.

Core domains (extend only deliberately, with owner approval):

- **Workspace** — the tenant. `workspaceId` is respected in every read/write.
- **Users / Memberships / Identity** — one identity system; membership and
  roles live on `WorkspaceMember`.
- **Permissions** — derived from membership/roles, compatible with
  `WorkspaceMember`; never a per-product permission system.
- **People / Clients** — single person record per workspace (§4).
- **Tasks** — `WorkspaceTask` is canonical for confirmed/proposed work.
- **Notes, Files, Events** — shared, workspace-scoped.
- **Search** — over shared data, not per-module silos.
- **Integrations / Channels** — channel and provider connections
  (`ChannelConnection` pattern: connections are core; products consume them).
- **Billing** — one billing relationship per workspace.
- **AI context** — Business/Workspace Profile as the single source of
  business context for all AI (`docs/workspace-profile-for-inbox.md`).
- **Audit** — what changed and who did it (distinct from telemetry, §9).

Rule of thumb: if two products would both need it, it is Core. Build it
once, workspace-scoped, and let products consume it.

---

## 4. Single Client / Person

**A person exists exactly once inside a Workspace.**

```txt
Ana López (one Client record)
├── conversations   (Smart Inbox)
├── appointments    (Finesse / Calendar)
├── campaigns       (Growth)
├── purchases
├── invoices        (Finance)
├── payments        (Finance)
├── reviews
└── tasks           (Core)
```

- Smart Inbox may show a simple view of her. Growth may segment her.
  Finance may invoice her. Finesse may manage her appointments and
  treatments. **All of them consume the same client/person identity.**
- Domain-specific data is welcome — as satellite records **linked to the
  same client**, never as a copy of the person.

**PROHIBITED designs:** `SmartInboxClient`, `GrowthClient`, `FinanceClient`,
`FinesseClient` (or any per-product copy of the same human being).

Known legacy debt (documented, not a license to add more): today one person
can exist as `Contact` (inbox), `Cliente` (CRM/billing/portal) and
`ClientAuth` (portal login), joined only by optional pointers; user-like
models are also duplicated (`User` vs `Usuario`), as are legacy task/entry
models (`InboxTodo`, `Tarea`, `InboxEntry`). All of this predates this
guardrail, is recorded as CONFLICT/FOLLOW-UP in §17, and converges toward
the single Person — it must never gain a fourth representation.

---

## 5. Entitlements → Capabilities → Tools  *(FUTURE)*

Target architecture for product enablement. **Not implemented — do not
implement it as a side effect of another change (see §16).**

```txt
ENTITLEMENTS  →  what the Workspace has contracted/enabled
CAPABILITIES  →  which concrete functionalities that grants
TOOLS         →  which actions the user or SevenF Intelligence can execute
```

Entitlements answer *what does this workspace have?*:

```txt
Smart Inbox    ACTIVE          AI credits      3000
Growth         ACTIVE          Voice minutes   100
Finance        INACTIVE        Users           3 / 5
Presence       ACTIVE          Locations       1 / 1
```

Capabilities answer *what functionality does that unlock?* Tools answer
*what actions can be executed?* — by a human in the UI or by SevenF
Intelligence (§7).

Direction rule, applicable **today**: avoid scattering hundreds of
`if (plan === "pro")` conditions through the runtime. Plan/packaging logic
must converge toward explicit, centrally resolved capabilities
(`core/system/plans.ts` is the current observational seed of this layer).
New feature gates should be written so they can be re-pointed at the future
entitlements resolver without rewrites.

---

## 6. Land and expand

A Workspace can start with only Smart Inbox and later add Growth, Finance
or other products **without**:

- creating another account,
- creating another Workspace,
- re-importing clients,
- migrating conversations,
- duplicating data.

The Workspace is already part of SevenF; activation of a new product only
changes its entitlements/capabilities. Any design that would force a
"migration into SevenF" when a standalone customer expands is a **no-go**
(§14).

---

## 7. SevenF Intelligence  *(FUTURE)*

Do **not** build separate, isolated intelligences ("AI Smart Inbox",
"AI Growth", "AI Finance"). The platform evolves toward **one shared
intelligence layer** that receives different *context, permissions,
capabilities and tools* per product and surface.

```txt
SEVENF INTELLIGENCE (one layer)
        │  context + permissions + capabilities + tools
        ▼
Smart Inbox tools:   search_client, read_conversation, summarize,
                     draft_reply, create_task
Growth adds:         segment_clients, create_campaign, generate_content,
                     analyze_conversion, manage_presence
Finance adds:        read_invoice, create_invoice, analyze_payment
```

Same intelligence; different tools and context.

The agent personas (Fanny, Freya, Fiona, Felix, Fathom, Francis, Mr. Forte,
and vertical specialists like Finesse — see
`docs/vertical-specialist-agents.md`) are **faces and scopes of this shared
layer**, not independent AI stacks. The existing shared pieces
(`engines/ai` provider facade, `core/registry` agent/tool manifests, shared
Business Profile context) are the seeds; the unified runtime is future work
and is **not** to be implemented under ARCH-01.

---

## 8. Provider abstraction

SevenF owns: **data, permissions, context, business logic, agents,
workflows.** External providers (OpenAI, ElevenLabs, Google, Microsoft,
WhatsApp, Stripe, …) contribute *capabilities* and must be substitutable
whenever reasonable.

- Do not model the domain around a single vendor.
- Keep vendor specifics behind facades (`engines/ai`, `ChannelConnection`
  provider configs, `core/storage.ts` are the current pattern to follow).
- Vendor lock-in that leaks into schema or domain language is a no-go (§14).

---

## 9. Product Telemetry  *(FUTURE)*

A future Core/platform layer to measure **adoption** per Workspace:

```txt
workspace_created · onboarding_started · onboarding_completed
whatsapp_connection_started · whatsapp_connected
client_import_started · client_import_completed
first_client_created · first_conversation_received · first_reply_sent
first_ai_action
first_campaign_created · presence_published · first_invoice_created
… future events
```

Goal: measure the funnel
`Signup → Onboarding → Activation → Adoption → Retention → Expansion`.

**Audit log ≠ product telemetry.** Audit answers *what changed and who did
it* (compliance/history — `core/activity.ts` today). Telemetry answers
*what is the user actually adopting* (product analytics). Keep them
separate; do not overload the audit trail as an analytics store.

No events are to be implemented yet — but new features should be designed
so their adoption *could* be expressed as workspace-scoped events later.

---

## 10. Usage Meter  *(FUTURE)*

A future layer to measure **consumption** per Workspace. Minimum meters:
LLM, Voice, WhatsApp, Email, Storage, External APIs, Automation executions.

Consumption must be attributable to:

```txt
workspace · product · capability · activity · provider · model
timestamp · units · estimated cost
```

Examples:

```txt
workspace=X  product=Smart Inbox  activity=conversation_summary
             provider=OpenAI  model=…  input_tokens=…  output_tokens=…
             estimated_cost=…

workspace=X  product=Growth   activity=campaign_generation
workspace=X  product=Finesse  activity=voice_appointment
```

Goal: real cost per workspace / product / activity / conversation /
campaign / call — and therefore real margin.

Not implemented yet — but **do not build features whose future consumption
could not be attributed to a Workspace** (§14). Every AI/voice/channel call
path should keep workspace + activity identifiable at the call site.

---

## 11. Business Graph

SevenF must be able to evolve toward a shared **Business Graph**:

```txt
CLIENT
├── conversation
├── appointment
├── campaign
├── purchase
├── invoice
├── payment
├── review
└── follow-up
```

This is **not** a mandate to adopt a graph database. It is a mandate to
keep one relational/domain model — everything workspace-scoped and linked
to the single client record — so SevenF Intelligence can understand the
connections of the business. Do not duplicate entities to simulate separate
products; that breaks the graph.

---

## 12. Finesse

Finesse is a **vertical experience** built on top of 7F Platform — the
Beauty vertical of 7F SaaS (`docs/vertical-specialist-agents.md`,
`core/vertical-packs/*`). It may use: Core, Clients, Smart Inbox, Growth,
Calendar/Scheduling, Presence, Fanny, Payments and Beauty-specific
capabilities.

- The Finesse user does not need to know which technical module executes
  each function.
- Finesse may have Beauty-specific UX, workflows and domain models —
  linked to the shared Core.
- Finesse must **not** duplicate Core. Verticals grow from a clean core +
  configuration/adaptation, never from copy/paste (`ways-of-working.md` §3).

---

## 13. Presence

Current decision: **Presence is part of Growth.** It may keep its own
commercial/UX surfaces (including standalone packaging per §2), but it must
not fragment into another independent platform. Presence consumes the same
source of truth as everything else: the Business Profile and the Core
(`docs/presence-architecture.md` already encodes the "do not duplicate the
Business Profile — read from it" rule).

---

## 14. Architectural NO-GO rules

**DO NOT INTRODUCE:**

- another parallel Workspace concept;
- another identity system per product;
- another duplicated client/person model;
- another technically separate Smart Inbox;
- Growth as an application with a duplicated Core;
- Finance as an application with a duplicated Core;
- per-product isolated AI without an architectural necessity;
- plan logic dispersed across the runtime (`if plan == …` everywhere);
- data duplicated between products;
- unnecessary provider lock-in;
- features whose future consumption cannot be attributed to a Workspace;
- AI whose future cost cannot be measured;
- verticals that replicate the Core;
- permissions incompatible with `WorkspaceMember`;
- billing/capabilities hardcoded in the UI;
- new client imports when "activating another product";
- standalone products that would need a later migration into SevenF.

---

## 15. Development guardrail — check before designing

**Before designing any new feature** that touches: Core, Workspace,
Identity, People/Clients, Products, Standalone packaging, Permissions,
Billing, AI, Agents, Integrations, Telemetry, Usage, or Verticals —
**the design must be checked against this document.**

If a proposal contradicts these rules, **do not implement it silently**:

1. point out the contradiction;
2. propose a compatible alternative;
3. if the architecture itself genuinely needs to change, raise it as a new
   explicit **owner decision** (and update this document only after that
   decision).

---

## 16. Build now vs future

**BUILD ONLY WHAT IS NEEDED NOW.**
**BUT: DO NOT BUILD TODAY WHAT WE ALREADY KNOW WE WILL HAVE TO UNBUILD
TOMORROW.**

This document does not oblige anyone to implement Entitlements, SevenF
Intelligence, Telemetry or the Usage Meter now. It exists to keep the path
to them open: every new piece of work should be *compatible with* this
architecture, and no new piece of work should *foreclose* it.

---

## 17. Current implementation audit (read-only, 2026-08-24)

Snapshot of `master` @ `e390d5d6` against these guardrails. **No conflicts
were corrected in ARCH-01**; anything contrary is recorded as FOLLOW-UP.
Legend: **ALIGNED** (built and consistent) · **PARTIAL** (built, partially
consistent or with known debt) · **FUTURE** (not built; nothing contradicts
it) · **CONFLICT** (built and contradicts a guardrail — pre-existing, to be
converged deliberately, never silently extended).

| Area | Current state | Verdict | Notes |
|---|---|---|---|
| Workspace / multitenancy | `Workspace` is the tenant root; per-request membership-validated resolution (`core/workspace-context.ts`); newer models carry required `workspaceId` + cascade. But ~18 legacy models (`Cliente`, `Factura`, `Tarea`, `Campaign`, …) have nullable `workspaceId` with `SetNull`, and `ClientAuth`/`ClientRequestAsset` carry none. | PARTIAL | Enforcement at query layer (no RLS). FOLLOW-UP: tighten nullable tenant keys; `User.workspaceId` retirement already pending (`EVOLUTION-CLOSED.md`). |
| WorkspaceMember / permissions | Tenant authz centralized in `core/auth/workspace-auth.ts` (role ladder on `WorkspaceMember.role`); but `middleware.ts` still gates page routes on the deprecated **global** `User.role`, which is workspace-independent. | CONFLICT (legacy) | Contradicts "permissions compatible with `WorkspaceMember`". FOLLOW-UP: retire `User.role` route gating in favor of workspace-scoped authz. |
| Identity | One `core/auth` module, but three identity systems: operator (`User`, Google OAuth), client portal (`ClientAuth`, per-`Cliente`, globally-unique email), platform admin (`PlatformAdmin`, deliberately orthogonal). Legacy `Usuario` still coexists with `User` (email correlation, no FK). | PARTIAL | `PlatformAdmin` separation is by design. FOLLOW-UP: `Usuario` → `User` convergence (already flagged in `ways-of-working.md` §3). |
| Client / person model | Three person representations: `Contact` (inbox person, required `workspaceId`), `Cliente` (CRM/billing/portal customer), `ClientAuth` (portal login) — joined only by optional nullable pointers, no cross-uniqueness. Identity resolution (`ExternalIdentity`/`ContactIdentityLink`) resolves to `Contact`, not `Cliente`; promotion is one-way manual conversion. | CONFLICT (legacy) | Pre-dates §4; do **not** add a fourth representation. FOLLOW-UP: Contact/Cliente convergence toward the single Person of §4 (dedicated future mission). |
| Smart Inbox | `modules/inbox` + `core/inbox` on the shared core (`Contact.clienteId → Cliente`, `WorkspaceTask`, `ChannelConnection`); standalone = plan/nav packaging only (`free` plan `enabledModules: ["inbox"]`, inbox-focused sidebar, Workspace Profile Lite). | ALIGNED | The working model for §2. Debt: legacy `InboxEntry`/`InboxTodo` frozen paths. |
| Growth | No Growth product exists — only a settings section label, Fiona's roster role, and three unrelated surfaces (`modules/campanas`, `modules/contenido` real CRUD on the shared core; `modules/marketing` a Beauty-only demo-backed surface with no manifest). | FUTURE | Growth as packaged product is future; existing pieces already sit on the shared core. FOLLOW-UP: consolidate `modules/marketing` when Growth is designed. |
| Presence | `engines/presence` reads a projection of Business Profile + `ChannelConnection`; `no-profile-duplication.test.ts` is a CI guardrail forbidding duplicated business columns in `Presence*` models. Currently an independent optional engine with its own `PresenceSubscription` entitlement — no Growth container exists yet. | PARTIAL | Business-Profile single-source rule is ALIGNED and CI-enforced; "Presence inside Growth" (§13) is FUTURE packaging. Its product-local entitlement resolver should fold into §5 later. |
| Finance | `Factura` / `Transaccion` link to shared `Cliente`/`Proyecto`; no Payment model, no payment provider, no billing runtime. `Factura.numero` is globally `@unique` (cross-tenant). | ALIGNED (thin) | No Core duplication. FOLLOW-UPs: per-workspace invoice numbering, payments domain when Finance becomes a product. |
| Finesse / verticals | `core/vertical-packs/*` are data-only packs merged into `Workspace.config`; nav profiles may only reorder/relabel/hide; specialist agent layered additively by `verticalKey` — no forked core, no vertical-owned models. Growing `isBeauty*` branch-in-route UI forks are the drift to watch. | ALIGNED (core) / PARTIAL (UI) | Matches §12 at the data layer. FOLLOW-UP: keep Beauty UI branching from becoming parallel per-vertical apps. |
| AI layer | Shared entry point `engines/ai` (`askMotorIA`, OpenAI/DeepSeek by mode) used by Fanny/Finesse/automations — but Forte's agent route (`app/api/ai/agent/route.ts`) is a **second independent OpenAI client** with its own tool loop; four agents = three unrelated implementations; three parallel context builders. Forte's `runtime/` capability/policy model + `core/registry` is the aligned seed of §7. | CONFLICT (drift) | The "one shared intelligence layer" invariant is already broken by the duplicate client. FOLLOW-UP: unify call paths, context resolution and tools under SevenF Intelligence (ARCH-02+). Do not add further isolated AI stacks. |
| Entitlements / billing | `core/system/plans.ts` is explicit read-only plan metadata (no gating, no billing, no Stripe); no dispersed `if plan ==` logic found. But three module-key vocabularies coexist (`plan.enabledModules` vs `Workspace.config.modules` vs module ids) and are never reconciled; only real consumer of `enabledModules` is Presence's local resolver. | PARTIAL | Good seed for §5, deliberately unenforced. FOLLOW-UPs: unify the module-key vocabulary; point all future gates at one central resolver. |
| Product telemetry | None. Two audit planes exist and are cleanly separated (`Activity` tenant history, `PlatformAuditLog` control plane); the only analytics is Vercel page analytics; "telemetry" in inbox code is console logging. | FUTURE | §9 layer entirely future; audit vs telemetry separation already clean. |
| Usage meter | None for text AI: `askMotorIA` returns a bare string and discards the provider `usage` object; no usage/credit/quota model in schema. The only cost math (voice) lives client-side in the admin Voice Lab, unpersisted. | FUTURE | §10 layer entirely future. FOLLOW-UP: any `engines/ai` evolution must return usage so attribution becomes possible. |
| Integrations / channels | Contracts and capability truth are core-level (`core/inbox/channel-registry.ts`); transports are module-level adapters; `ChannelConnection` holds encrypted credentials per workspace; WhatsApp honestly `data_only`; webhook skeletons labeled as such. | ALIGNED | Matches §3/§8; verticals only declare channel preferences. |
| Provider abstraction | `askMotorIA` is a mode-switch, not a provider interface (model IDs/URLs inlined per vendor file); voice is hard-coupled to OpenAI Realtime; storage behind `core/storage.ts`. No schema-level vendor lock-in observed. | PARTIAL | Facade exists at the call site; a real provider seam is future (§8). No ElevenLabs/Stripe present yet. |

**FOLLOW-UPs recorded, nothing corrected here.** The CONFLICT rows
(Contact/Cliente/ClientAuth person split, deprecated `User.role` route
gating, the duplicate OpenAI client in the agent route) pre-date these
guardrails and are already partially flagged in `ways-of-working.md` §3.
ARCH-01 records them; converging them is dedicated future work. The
operative rule from today on: **do not extend any CONFLICT pattern** — new
work builds toward §§3–10, never adds a fourth person model, a new
per-product AI stack, or a new permission side-channel.

---

## 18. Next

Recommended next mission: **ARCH-02 — Entitlements / Capabilities / Tools
design** (design only, building on §5).
