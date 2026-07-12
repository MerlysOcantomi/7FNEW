# 7F — Agents surface (AI Team Control Center)

Status: **Accepted** · 2026-06-15 · Scope: `/agents` (+ compact panel)

`/agents` is the **AI Team Control Center**: an agent-centric, live view that
answers *"what is my AI team doing right now?"*. It is built ON TOP of the
existing read-only projection — it adds no persistence and performs no writes.

Related code:

- Page: [`app/agents/page.tsx`](../app/agents/page.tsx)
- Board (live view): [`components/agents/agents-activity-board.tsx`](../components/agents/agents-activity-board.tsx)
- Detail drawer: [`components/agents/agent-detail-drawer.tsx`](../components/agents/agent-detail-drawer.tsx)
- Roster + projection: [`modules/agents/roster.ts`](../modules/agents/roster.ts) · tests [`modules/agents/roster.test.ts`](../modules/agents/roster.test.ts)
- Visual tokens/helpers: [`components/agents/agent-visuals.ts`](../components/agents/agent-visuals.ts)
- Data (unchanged): [`modules/agents/activity-aggregator.ts`](../modules/agents/activity-aggregator.ts) · [`modules/agents/types.ts`](../modules/agents/types.ts) · `GET /api/agents/activity`

---

## 1. What it is (and what it is not)

| Surface | The one question it answers |
|---|---|
| **Smart Inbox** | What arrived, and what action resolves it? (intake / triage) |
| **Today** | What confirmed work do I execute today? |
| **Agents** | **What is my AI team doing — and what needs my decision?** (delegated AI work) |
| **Vertical Overview** (future) | How is the business doing? (health) |
| **Modules** | Records & depth per area |

Agents must NOT become another Today, another Inbox, or a technical list of
runs. It is the visibility + decision plane over the AI team.

**Visible language is human** — Working · Waiting for you · Idle · Watching ·
Coming online · Needs your review · Handled · Suggested. Technical words are
never shown in the primary UI: no `run` / `execution` / `job` / `worker` /
`process id`, and no raw lane names (`automated` / `executed`) as labels.

---

## 2. Layout

Standard AppShell + Midnight/Lavender tokens. The board owns its own header, so
the page renders it directly (no duplicate "Agents" title).

1. **Summary bar** — "Agents" + a pulsing **Live** dot + "7 agents · N working
   now · N awaiting you", plus KPI pills (Working now · Needs review · Automated
   today · Attention) read from `AgentsActivityPayload.counts` + the projection.
2. **Francis hero** — the CEO leads from a token-only orb (no rainbow). A live,
   derived briefing ("Right now: Fanny is on your inbox — N proposals waiting…")
   + CTAs: **Review N proposals** (scrolls to the decision rail) and **Adjust
   autonomy** (disabled — coming soon).
3. **Your agents · live** — a grid of the **6 specialists** (Francis stays in
   the hero). Each card: identity halo, name, autonomy chip, role, status pill,
   current activity (with typing dots when working), footer meta. Click → the
   detail drawer.
4. **Live activity** — a supporting stream projected from the `executed` lane
   (newest first; "From Inbox" when traceable).
5. **Decision rail** (right) — **Needs your review** (`needs_review` lane,
   Approve/Dismiss are inert), **Attention** (`attention` lane), and an
   **Autonomy legend** (Auto / Suggests / Needs approval).

---

## 3. The roster

Seven 7F agents (`modules/agents/roster.ts`). Identity colors are **tokens**
only (the `--agent-teal`/`--agent-rose` tokens were added for Fiona/Freya; the
rest reuse the semantic palette) — never the old blue→pink gradient.

| Agent | Function | Autonomy | Section | Wired today? |
|---|---|---|---|---|
| **Francis** | CEO · Operations & Coordination | — (lead) | — (hero) | Narrative lead |
| **Mr. Forte** | Architecture · Modules · Lab | Suggests | `/forte` | Coming online |
| **Fanny** | Conversations · Inbox | Auto | `/inbox` | **Yes — the only wired agent** |
| **Freya** | Creative Studio · Visual | Suggests | `/contenido` | Coming online |
| **Fiona** | 7F Growth · Marketing | Auto | `/clientes` | Coming online |
| **Felix** | Finance · Invoices | Suggests | `/finanzas` | Coming online |
| **Fathom** | Research · Vertical trends | Suggests | — (no route yet) | Coming online |

**Honesty rule (enforced by the projection).** Only Fanny has real items today,
so only Fanny shows a real Working/Waiting/Idle status. Every other agent is
`active: false` and renders as **Coming online** — present in the registry,
never shown as if it were executing. `projectAgentLiveStates(lanes)` derives
each agent's status/activity from the existing lanes by matching
`AgentActivityItem.agentName`; un-matched agents get no fabricated activity.

`Fathom`'s `/insights` route does not exist yet, so its drawer footer renders a
disabled "Section coming online" button rather than linking somewhere wrong.

---

## 4. Agent detail drawer

Clicking an agent card opens a right-side drawer (overlay + scrim), no route
change. It closes with the **X**, a **click on the scrim**, or **Escape**; focus
moves to the close button on open and is restored on close; body scroll is
locked while open; `role="dialog"` + `aria-modal` + `aria-label`.

Sections: **Doing now** (current activity, honest), **Today** (this agent's real
items), **Works with the team** (static collaboration note), **Watching** (what
it conceptually monitors), **Recently handled** (executed items, if any), and a
footer **Open in {section}** that links to the agent's 7F route (or a disabled
"coming online" button when no route exists).

---

## 5. Autonomy language

- **Auto** — runs low-risk work on its own.
- **Suggests** — proposes, waits for your yes.
- **Needs approval** — never acts without your approval.

These are product-facing capability labels for the roster; they are not wired to
the engineering policy in the manifests yet.

---

## 6. Data mapping (no new persistence)

Everything is projected, exactly as before this change:

- status (working / waiting / idle / coming online) ← projected from each
  agent's items + lane (`projectAgentLiveStates`).
- Live activity ← `executed` lane.
- Needs your review ← `needs_review` lane.
- Attention ← `attention` lane.
- "Recently handled" / "N done today" ← `executed` + `automated` items.

The aggregator, types, and API route are **unchanged**. The roster is a new
static display registry; it does not touch `AgentSummary` or the manifests.

---

## 7. Non-goals (this PR)

- No real writes; **Approve / Dismiss / Adjust autonomy are inert**.
- No new persistence, tables, or API routes.
- No fake automation — un-wired agents are never shown as executing.
- No technical run/execution/job language; no raw lane names as labels.
- No off-brand blue→pink gradient (removed app-wide in the agents components).
- No duplicate Today / Inbox; no new routes; no broad refactor.

---

## 8. Future

- Real **Approve / Dismiss** from the decision rail.
- **Autonomy settings** ("Adjust autonomy") wired per agent.
- Real **watchers** and per-agent **execution state** as agents come online.
- A real **cross-agent handoff** model (today collaboration is static drawer
  context, since handoffs are not derivable from the current data).
- A per-mode **Agents peek** for the global panel.
