# 7F — Ways of Working

The permanent operating contract for building 7F / SevenF. Read this before
proposing or implementing anything. It encodes how we work, the product
principles, the canonical architecture decisions, the product surface map, and
the rules that keep 7F from becoming a generic, mock-heavy SaaS.

7F is a multi-tenant SaaS platform for intelligent business work. Smart Inbox is
a fundamental piece — the natural entry point of live work — but it is **not**
all of 7F. The platform grows toward Home, Today, Calendar, Clients, Projects,
Finance, Marketing, Team, Documents, Automations, Agents, Mr. Forte, future
verticals, a public website and a chatbot.

---

## 1. Permanent workflow

Every task follows the same flow. No big-bang changes, no improvising.

1. **Audit first.** Inspect the current repo, identify relevant files, explain
   what exists, detect duplication / risk / tech debt, and call out anything
   that already exists and must not be duplicated.
2. **Propose a small plan.** State what you found, the problem to solve, the
   files you will likely touch, what you will **not** touch, the risk level
   (low / medium / high), and what to review in Vercel afterwards.
3. **Wait for approval** if the scope is not already approved. If the scope is
   clearly small and safe, you may proceed.
4. **Implement the minimal safe change.** One objective per PR. No unrelated
   edits riding along.
5. **Run reasonable checks** (see §8).
6. **Commit** with a clear conventional-commit message.
7. **Push** to the working branch.
8. **Final summary** in a `txt` block (see §8 format).
9. **Suggested next smart move** with the evaluation (see §7).

---

## 2. Product principles

- 7F is a full SaaS platform, not only Smart Inbox.
- Smart Inbox is fundamental but must not absorb all of 7F.
- Do not duplicate **Home, Inbox, Inbox Briefing, Today, Calendar, Dashboard or
  Work Queue**. If one screen starts saying what another already says, simplify.
- Each surface must answer **one clear question** (see §4).
- Premium, clear, professional, AI-first. Not another Gmail, not another Google
  Calendar, not another generic dashboard, not a heavy CRM, not a fake AI demo.

---

## 3. Canonical architecture decisions

Do not break these without auditing and justifying first.

- 7F is **multi-tenant**; `workspaceId` must be respected in every read and write.
- **`WorkspaceTask` is canonical** for confirmed and proposed work.
- **Proposed work must be approved or dismissed** (`proposed` → `open` on approve,
  `proposed` → `dismissed` on dismiss).
- **`InboxTodo` is legacy / audit only** — never the new write path. New writes go
  through the `WorkspaceTask` write layer.
- **`Conversation.intent` (AI classifier output) and `Conversation.category`
  (operator taxonomy) are separate fields.** Do not merge them.
- **Fanny belongs to Smart Inbox** (message interpretation, classification,
  suggested actions, drafts, follow-ups). Fanny suggests; the operator approves.
- **Mr. Forte is the future orchestrator / builder** for improvements and
  verticals. Prepare the architecture for Forte without breaking the core.
- **Verticals grow from a clean core + configuration / adaptation**, never from
  copy/paste of whole verticals.

### Known data debt (do not "fix" implicitly inside another PR)

- Three task models coexist: `WorkspaceTask` (canonical), `InboxTodo` (frozen for
  writes), `Tarea` (legacy CRM, still feeding `/tareas` and the Today fallback).
  Convergence of `Tarea` → `WorkspaceTask` is a dedicated future PR.
- Two "entry" models: `Conversation` (current) vs `InboxEntry` (legacy, still
  written by the widget).
- Two user-like models: `User` (auth) vs `Usuario` (task assignment), correlated
  by email, no FK.

---

## 4. Product surfaces

Current direction. Each surface answers one question and must not drift into
another's job.

| Surface | The one question it answers |
|---|---|
| **Home** | How is my business doing and what needs my attention? |
| **Smart Inbox** | What arrived, and what action resolves it? |
| **Inbox Briefing** | What happened in my channels and what needs attention? (Fanny briefing **inside** Inbox — not a competing general route.) |
| **Today** | What confirmed work do I have to execute? (reads `WorkspaceTask`) |
| **Calendar** | How is my time organized? |
| **Clients** | What context do I have on my customers? |
| **Projects** | What grouped deliverables and work exist? |
| **Business modules** (Finance, Marketing, Team, Documents…) | Real modules are promoted in nav; stubs must not look finished. |
| **Public website + chatbot** | Future greenfield track, separate from app-internal work. |

Audit-derived direction (confirmed):

- **Home leads.** `Inbox Briefing` (formerly `/inbox/overview`) becomes the
  welcome state **inside** Smart Inbox, not a sibling route competing with Home.
- **Stubs are hidden from primary nav** until they have a real backend
  (`/entrada`, `/comunicacion`, `/motor`, `/finanzas`, `/departamentos`,
  `/biblioteca` were mock at audit time).

---

## 5. No fake product rule

7F must feel like a real, premium platform — not a demo full of empty screens.

- Do not present mock / stub routes as finished product.
- No fake APIs.
- No fake providers.
- No fake integrations presented as real.
- No fake agents (only **Fanny** and **Forte** have real runtime today; other
  named agents are planned personas, not operational).
- No fake "ready" states without real implementation behind them.
- Foundation / planning work must be **clearly labeled as foundation**.

Rule: if something is real, it can live in primary navigation. If it is
conceptual or mock, it must be hidden from primary nav or clearly marked as
future — per explicit approval.

---

## 6. Language rule

- **Speak to the maintainer in Spanish** — explanations, audits, plans, risks,
  recommendations and final summaries.
- **In the repo, use English** for code, naming, functions, components, types,
  new files and folders, new technical comments, new technical docs, commit
  messages, branch names, and new product labels.
- Do **not** translate 7F product labels into Spanish.
- Do **not** rename existing Spanish routes massively. If repo naming is mixed,
  document it as risk; language migration is a separate dedicated PR, never an
  accidental change inside another PR.

Correct naming examples: `WorkspaceTask`, `SmartInbox`, `FannyPanel`,
`BusinessOverview`, `CalendarFeed`, `VerticalConfig`,
`chore(nav): simplify app navigation around core 7F surfaces`.

---

## 7. Scalability / market / competition rule

Every proposal and every "next smart move" must consider:

- **Scalability** across many workspaces.
- **Multi-tenancy** correctness.
- **Future verticals** — is this core, vertical config, feature flag, template,
  taxonomy, or optional module? Could Mr. Forte enable/disable it per workspace?
- **Mr. Forte** — does this help or block the future orchestrator?
- **Market value** — does it solve a real business problem someone would pay for?
- **Competitive differentiation** — does it make 7F more sellable and less
  generic, with a real AI-first advantage, rather than blindly copying Gmail,
  Google Calendar, Notion, HubSpot, Slack, Monday, ClickUp or Superhuman?

Build simple, but in a scalable direction. Do not over-engineer; also do not
build something that only works for a local demo.

---

## 8. Checks and final summary

### Checks

After implementing, run reasonable checks for the change:

- `lint`, `typecheck`, targeted `tests`, and `build` only when relevant.
- If a check fails due to pre-existing debt, explain it clearly — never hide it.
- If a check is too heavy or unrelated to the change (e.g. running the full app
  build for a docs-only PR), explain why it was skipped.

### Final summary format

Every completed task ends with this `txt` block, easy to copy/paste:

```txt
Done.

Summary:
- ...

Files changed:
- ...

Checks:
- ...

Commit:
- ...

Pushed:
- ...

Review in Vercel:
- ...

Notes / risks:
- ...

Suggested next smart move:
- Valor para el usuario:
- Valor para el negocio/producto:
- Impacto en escalabilidad:
- Impacto en verticales:
- Impacto competitivo:
- Riesgo técnico:
- Riesgo de producto:
- Por qué este PR ahora y no después:
```

---

## 9. Philosophy

We work this way because 7F is growing into a complete platform. No disorganized
speed, no fake screens, no duplication, no Smart Inbox absorbing everything, no
Home / Today / Inbox Briefing / Calendar / Dashboard competing with each other.

Small, clean, strategic steps. Every PR should leave the product clearer, more
stable, and better prepared to grow.
