# Vertical specialist agents

Status: **Accepted** · Scope: agents surface + vertical packs

## Principle

7F has **7 core agents** (Francis, Mr. Forte, Fanny, Freya, Fiona, Felix, Fathom),
defined once in `modules/agents/roster.ts` (`AGENT_ROSTER`). These never change per vertical.

Each vertical **adds ONE specialist agent that leads that vertical's experience without
replacing the core agents.** For Beauty the specialist is **Finesse** — *"7F Beauty, powered by
Finesse"*.

> **Finesse leads Beauty, core agents stay intact.**

Finesse interprets the Beauty context, coordinates the day and can be the primary voice on Beauty
surfaces (header, Hoy, panels). But every action that belongs to a core agent still shows that
agent: *"Fanny detected 3 unanswered messages", "Freya can create a story", "Fiona recommends a
campaign", "Felix can prepare the charge", "Mr. Forte can activate this module"*.

## Rules

- A vertical specialist is **NOT** an 8th entry in `AGENT_ROSTER`. It is layered in additively,
  scoped to the workspace's `verticalKey`.
- It **coordinates with** the core agents (declared in data via `coordinatesWith`) — it never
  replaces them and never changes the global nav attributions.
- It is **branding + a lead presence**, backed by reusable voice strings so future surfaces
  (Home / Overview / Hoy) can speak as the specialist.

## Where it lives

| Concern | File |
|---|---|
| Specialist data + resolver | `core/vertical-packs/specialists.ts` (`VerticalSpecialistAgent`, `BEAUTY_SPECIALIST_AGENT`, `resolveVerticalSpecialist(verticalKey)`) |
| Pack reference | `core/vertical-packs/beauty.ts` (`BeautyPack.specialistAgent?`) |
| Forte playbook reference | `agents/forte/verticals/beauty.ts` (`ForteVerticalPlaybook.specialistAgent?`) |
| Roster surfacing (additive) | `modules/agents/roster.ts` (`VERTICAL_SPECIALIST_ROSTER`, `getVerticalSpecialists()`; `AgentRosterEntry.verticalKey?` / `isVerticalLead?`) |
| Icon | `components/agents/agent-visuals.ts` (`AGENT_ICON`) |
| Agents panel | `components/agents/agents-activity-board.tsx` (lead card + "powered by …" line, gated by active workspace `verticalKey`) |

## Adding the next vertical's specialist

1. Add a `VerticalSpecialistAgent` const in `specialists.ts` and register it in
   `VERTICAL_SPECIALISTS` (+ a case in `resolveVerticalSpecialist` if it needs alias keys).
2. Reference it from that vertical's pack + Forte playbook (`specialistAgent`).
3. Add its icon in `agent-visuals.ts`.
4. Nothing else: `AGENT_ROSTER` (the 7 core agents) and every other vertical stay untouched.

## Not in scope yet

- Home / Overview / Hoy do **not** yet render the specialist voice; the data
  (`resolveVerticalSpecialist`, `voice`) is prepared so they can, later.
- No real agent execution/automation is added — specialists are display/registry metadata, like
  the core roster.
