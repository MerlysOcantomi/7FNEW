"use client"

import { AppShell } from "@/components/app-shell"
import { SectionPage } from "@/components/section-page"
import { AgentsActivityBoard } from "@/components/agents/agents-activity-board"

/**
 * `/agents` — read-only Global Agents activity surface (PR 1).
 *
 * Sibling of New (create) / Today (execute) / Search (find): Agents is
 * the visibility plane over AI work — what Fanny (and, later, the other
 * 7F agents) automated, what is waiting for review, what executed, and
 * what needs human intervention.
 *
 * NOT to be confused with `/agente` (the static "Francis" business-
 * insights mock) or `/assistant` (the chat). This is a distinct,
 * data-backed operational surface.
 *
 * Layout: AppShell (viewport-bounded `fixed inset-0` per
 * docs/app-shell-contract.md). The page introduces NO `min-h-screen`
 * and NO document/body scroll — `main` inside AppShell owns the
 * scrollport. Widened to `max-w-7xl` so the four lanes have room on
 * desktop (same treatment as Today's workboard).
 *
 * PR 1 scope: page + read-only board. The global toolbar trigger and
 * panel (sibling of New/Today/Search) are intentionally deferred to PR 2.
 */
export default function AgentsPage() {
  return (
    <AppShell
      breadcrumbs={[{ label: "7F" }, { label: "Agents" }]}
      contentClassName="max-w-7xl"
    >
      <SectionPage
        tone="canvas"
        title="Agents"
        description="What your AI agents are doing — automated work, proposals awaiting review, executed actions, and anything that needs your attention."
      >
        <AgentsActivityBoard />
      </SectionPage>
    </AppShell>
  )
}
