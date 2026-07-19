# Finesse demo workspace seed — runbook

The Finesse demo dataset turns a Beauty workspace into a credible, coherent
demo: clients with history, today's appointments, actionable tasks (including
honest risks), conversations, invoices in different states, content pieces and
a complete salon business profile. Everything is written to the **real
database** through the same models the product reads — no isolated mocks.

Code lives in three files:

| File | Role |
|---|---|
| `scripts/finesse-demo-data.ts` | Pure dataset + validation (no DB access, fully tested) |
| `scripts/finesse-demo-utils.ts` | Pure config parsing/merging helpers (tested) |
| `scripts/seed-finesse-demo.ts` | CLI runner (discover / dry-run / seed) |

Tests: `npm run test:finesse-demo`.

## What it seeds

- 8 clientas (`Cliente` + one `Contact` each) with preferences and history notes.
- 30 citas (`Evento`, tipo `cita`): 12 upcoming (today → +7 days) plus 18
  historical visits across the current month, the previous month (the
  comparison baseline for the overview) and one ~3-months-back visit that
  feeds the honest "clients without a recent visit" signal. Dates are
  recalculated relative to "today" on every run so the demo never goes stale.
- 5 conversations (`Conversation` + 12 `Message`) in the Inbox.
- 16 invoices (`Factura`) in states `pagada`, `enviada`, `borrador`, `vencida`
  — with coherent `fechaEmision`, `fechaVencimiento` and `paidAt`; the paid
  history gives the overview a real earnings KPI and revenue trend.
- 6 workspace tasks (`WorkspaceTask`) that drive Today's work lanes, honoring
  Today's visibility rules (dated tasks are due today; undated tasks are
  assigned to the owner). They include the honest risks the demo needs:
  - an **unconfirmed appointment** to chase (linked to the demo cita),
  - an **overdue invoice** to chase,
  - a **pending rebooking** proposed by Fanny (`status: proposed`, AI lane),
  - a waiting-on-supplier item for the Waiting lane.
- 3 legacy CRM tasks (`Tarea`) for the `/tareas` page (titles distinct from
  the WorkspaceTasks so Today never shows near-duplicates).
- 4 content pieces (`ContentPiece`) in draft/scheduled/published states.
- `Workspace.config.businessProfile` — the canonical source `/business-profile`
  and the agent context read: name, description, services, tone, region,
  languages, working hours, attention rules. **Fill-only-missing**: a field the
  owner already set is never overwritten.
- `Workspace.config.serviceCatalog` — only as a fallback when neither the
  vertical defaults nor the workspace provide a catalog (e.g. a Beauty-alias
  `verticalKey` with no seeded `Vertical` row). The canonical source always wins.

User-visible business content is Spanish; identifiers, keys and code are English.

## Safety model

- **Idempotent**: each record carries a demo marker and is looked up before
  writing — re-running updates dates/content instead of duplicating rows:
  - `Cliente.customId` / `Contact.source`: `FINESSE_DEMO:client|contact:NN`
  - `Evento.descripcion`: `FINESSE_DEMO:cita:NN`
  - `Conversation.source`: `FINESSE_DEMO:conv:NN`
  - `Factura.numero`: `DEMO-FINESSE-<ws-short>-NNN` (globally unique; aborts on
    cross-workspace collision)
  - `ContentPiece.notas`: `FINESSE_DEMO:content:NN`
  - `WorkspaceTask.sourceType/sourceId`: `finesse_demo` / `FINESSE_DEMO:task:NN`
  - `Tarea.descripcion` (last line): `FINESSE_DEMO:tarea:NN`
- **Never resurrects finished work**: a demo task the owner completed or
  dismissed keeps its terminal state on re-runs (dates/content still refresh).
- **Atomic**: all writes run inside one `db.$transaction`.
- **Scoped**: refuses non-Beauty workspaces (`BEAUTY_NAV_VERTICAL_KEYS`),
  requires the owner to be a member, and every row carries the `workspaceId`.
- **Confirmed**: the `seed` mode refuses to run without the
  `FINESSE_DEMO_CONFIRM=SEED:<workspaceId>` token, so it can never touch a
  workspace by accident.
- The workspace is flagged in `Workspace.config.demo`
  (`{ enabled: true, type: "finesse-internal", ownerEmail }`) with run metadata
  under `finesseDemoMetadata`.

## Safety model — target preflight (added in 7F-P01.B4)

Beyond the marker/token safeguards, both `dry-run` and `seed` now classify
the target workspace before anything else:

| Target state | Result |
|---|---|
| Flagged demo (`config.demo.enabled: true`, `type: "finesse-internal"`) | Seed/re-seed allowed |
| Not flagged, but zero unmarked clients/conversations (fresh workspace) | First activation allowed |
| Not flagged AND holds unmarked clients or conversations | **Seed refuses to write** — that is what a real operator's workspace (e.g. Skina) looks like |

The refusal can only be bypassed deliberately, with the workspace-bound
override `FINESSE_DEMO_ALLOW_UNFLAGGED=ALLOW:<WORKSPACE_ID>` — there is no
global "force" switch.

## How to run

Requires `DATABASE_URL` (or `TURSO_DATABASE_URL`) and, for Turso,
`DATABASE_AUTH_TOKEN` (or `TURSO_AUTH_TOKEN`) in the environment / `.env`.

1. **Find the workspace** (lists all workspaces for an owner, tags Beauty ones):

   ```bash
   npm run demo:finesse:discover -- --owner owner@example.com
   ```

2. **Dry-run** (no writes; shows existing counts and what would be created):

   ```bash
   npm run demo:finesse:dry-run -- --workspace-id <WORKSPACE_ID> --owner owner@example.com
   ```

3. **Seed** (the dry-run prints this exact command, including the token):

   ```bash
   FINESSE_DEMO_CONFIRM=SEED:<WORKSPACE_ID> \
     npx tsx scripts/seed-finesse-demo.ts seed \
     --workspace-id <WORKSPACE_ID> --owner owner@example.com
   ```

Re-run step 3 whenever the demo should be "refreshed to today" — appointments,
task due-dates and invoice dates all recalculate relative to the current day.

`--owner` can be replaced by `FINESSE_OWNER_EMAIL`, `--workspace-id` by
`FINESSE_WORKSPACE_ID`.

## Activating the demo on the real Turso database

Run this from a machine that has the production credentials (e.g. a local
checkout with the production `.env`, or values copied from the Vercel project
settings). **Never paste tokens into a chat, commit, or log.**

```bash
# 1. Credentials — same variables the app uses (see .env.example).
export TURSO_DATABASE_URL="libsql://<database>-<org>.turso.io"   # Turso dashboard
export TURSO_AUTH_TOKEN="<auth token>"                            # Turso dashboard

# 2. Find the Beauty demo workspace (lists your workspaces, tags Beauty ones).
npm run demo:finesse:discover -- --owner <your login email>

# 3. Read-only preflight — verifies membership, Beauty vertical, config JSON,
#    the demo/fresh/real-workspace classification, and prints existing counts
#    next to what would be created. Nothing is written.
npm run demo:finesse:dry-run -- --workspace-id <WORKSPACE_ID> --owner <your login email>

# 4. Seed — the dry-run prints this exact command including the token.
FINESSE_DEMO_CONFIRM=SEED:<WORKSPACE_ID> \
  npx tsx scripts/seed-finesse-demo.ts seed \
  --workspace-id <WORKSPACE_ID> --owner <your login email>

# 5. Idempotency check — run step 4 again: every line should say [update]
#    and "Created" must be all zeros.
```

Then review in the deployment connected to that database:
`/` (Mi salón), `/today` (Beauty Hoy), `/today?todayLayout=work_first`
(workboard), `/business-profile`, `/calendario`, `/clientes`, `/inbox`,
`/tareas`, `/facturacion`, `/services`.

Notes:
- If the dry-run reports **BLOCKED**, you pointed at a workspace with real,
  unmarked data (for example the Skina workspace) — pick the demo workspace
  from the discover list instead.
- There is no `Workspace.timezone` field: "today" is always computed in the
  browser timezone of whoever is looking, and the seeder plants dates
  relative to the machine it runs on. Run the seed from your own timezone
  (or re-run it any morning) so today's citas land on your calendar day.

## What the surfaces show afterwards

- **Today** (`/today`, real `work_first` workboard): today's citas in the
  Schedule lane, the owner's tasks (confirm-appointment, overdue-invoice,
  reply-to-client) in My work, Fanny's rebooking proposal in the AI lane, the
  waiting-on-supplier item in Waiting, and the undated promo task.
- **Business Profile** (`/business-profile`): complete salon profile from
  `Workspace.config.businessProfile`.
- **Calendario / Clientes / Inbox / Tareas / Facturación**: real DB rows.
- **Services** (`/services`): the Beauty vertical catalog seed (or the demo
  fallback when no vertical defaults resolve).
- **Mi salón** (`/`, Beauty overview): REAL aggregation via `GET /api/overview`
  (`modules/overview/service.ts`) — earnings/visits/client-mix KPIs with a
  previous-period comparison, revenue trend, weekday demand, top clients,
  pending/overdue payment signals, the salon profile card and the "Hoy en el
  salón" operational card. Sections without a backend (drivers, per-service
  visits, booking attribution) render honest empty states. The demo adapter
  survives only behind `?overviewDemo=` QA modes, clearly chip-labeled.
- **Beauty Marketing** remains on its documented preview adapter — no
  aggregation backend yet; it honestly labels itself "Vista previa".

## Known limits (deliberate)

- No `Appointment`/`Service`/`Staff` Prisma models exist — citas are `Evento`
  rows without service/price/status; service duration & price have no backend
  yet (the service catalog schema is name/category/active only).
- No extra team members are created: `WorkspaceMember` requires real auth
  users, and inventing logins is out of scope for demo data.
- The Beauty `appointment_first` Today is REAL and active
  (`activateRealForRealWorkspaces: true` since 7F-P01.B3): `GET /api/today/beauty`
  composes today's citas (`Evento` + `Cliente`), honest free gaps, the SAME
  task reality as the workboard (via `aggregateToday`), pending messages and
  urgent collections. `Evento` still has no attendance/confirmation state or
  price, so the surface never claims completed/no-show or a booked value.
  The mock Studio preview survives only behind `?todayData=mock` (or the
  `?vertical=beauty` forced preview on a non-Beauty workspace); the work-first
  workboard stays reachable via `/today?todayLayout=work_first`.
