"use client"

import { AppShell } from "@/components/app-shell"
import { AgentsActivityBoard } from "@/components/agents/agents-activity-board"
import { useI18n } from "@/components/i18n-provider"

/**
 * `/agents` — the AI Team Control Center.
 *
 * An agent-centric LIVE view built on top of the read-only projection
 * (`/api/agents/activity`): Francis leads from a hero, the six specialists show
 * what they're doing right now, a stream shows what executed, and a decision
 * rail surfaces what needs you. Honest by construction — only Fanny is wired
 * today; the rest are registered and "coming online" (see
 * `modules/agents/roster.ts`). No new persistence, no writes.
 *
 * NOT to be confused with `/agente` (the static "Francis" business-insights
 * mock) or `/assistant` (the chat). Layout: AppShell (viewport-bounded per
 * docs/app-shell-contract.md); the board owns its own summary header, so the
 * page renders it directly (no SectionPage title) to avoid a duplicate "Agents".
 * Widened to `max-w-7xl` for the roster + decision-rail split.
 */
export default function AgentsPage() {
  const { t } = useI18n()
  return (
    <AppShell
      breadcrumbs={[{ label: "7F" }, { label: t.nav.agents }]}
      contentClassName="max-w-7xl"
    >
      <AgentsActivityBoard />
    </AppShell>
  )
}
