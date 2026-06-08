"use client"

import { AppShell } from "@/components/app-shell"
import { InboxOverview } from "@/components/inbox/overview/inbox-overview"

/**
 * `/inbox/overview` — Smart Inbox Daily Overview (PR3 foundation).
 *
 * The operator's first daily doorway into the Inbox: a short, warm Fanny briefing built from
 * real, workspace-scoped counts, plus "act here next" blocks that link into the Inbox and
 * Today. NOT a marketing landing and NOT a KPI dashboard — it organises attention and hands
 * off to the Inbox / Today, never duplicating Today's execution surface.
 *
 * Layout: rendered inside `AppShell` (viewport-bounded per docs/app-shell-contract.md). The
 * page introduces NO `min-h-screen` and NO document/body scroll — `main` inside AppShell owns
 * the scrollport. `currentSection="inbox"` keeps the Smart Inbox nav highlighted. We do NOT
 * redirect `/inbox` here in this PR — this is an additive route only.
 */
export default function InboxOverviewPage() {
  return (
    <AppShell
      currentSection="inbox"
      breadcrumbs={[{ label: "7F" }, { label: "Inbox", href: "/inbox" }, { label: "Overview" }]}
      contentClassName="max-w-5xl"
    >
      <InboxOverview />
    </AppShell>
  )
}
