# Workspace Profile & Smart Inbox standalone

Last updated: 2026-05-08

Product/architecture decision: **Smart Inbox offered as a standalone product is not “Inbox without any workspace profile.”** It is **Smart Inbox plus a minimal Workspace Profile** — enough business/workspace context for classification, prioritisation, summaries, and safe automation.

---

## 1. Decision

- Every workspace has a **base Workspace Profile** (identity + minimum operational context).
- **Business Profile / Workspace Profile** is **core workspace infrastructure**, not an optional premium module you can turn off while keeping Fanny useful.
- **Inbox standalone** still includes:
  - workspace identity  
  - basic business context  
  - connected channels  
  - basic team/operators  
  - Inbox preferences  
  - Fanny preferences  
- **7F Business / full product** may expose a **deeper** Business Profile and broader operations context on top of that base.
- **UI depth by plan** (conceptual — no rename of code concepts here):
  - **Inbox-only:** “Workspace Profile Lite” — guided minimum fields, focused setup.
  - **7F Business:** full Business Profile / operations context where the product exposes it.

Naming in code and billing can stay as-is; this doc defines the **product expectation** that the workspace always carries profile-shaped context for AI.

---

## 2. Why Fanny needs Workspace Profile context

Fanny uses workspace-level context to interpret conversations **in domain**, not only with generic heuristics:

- Industry, services, urgency norms, language and tone expectations  
- What counts as a safe **internal** follow-up vs something that needs human review  
- Routing and handoff signals aligned with how the business actually works  

Without profile context, behaviour collapses toward **generic rules**: weaker classification, weaker prioritisation, fewer safe automation opportunities, and higher risk of tone or intent mismatches.

With profile context, Fanny can classify and automate **more usefully** while still respecting **global safety limits** (see §5).

**Inbox-only customers still need enough profile data** for reliable, trustworthy AI behaviour — not an empty workspace shell.

---

## 3. Inbox-only minimum profile (“Workspace Profile Lite”)

Minimum fields / areas the standalone Inbox offering should assume exist or strongly guide the customer to complete:

| Area | Examples |
|------|----------|
| Identity | Business/workspace display name |
| Sector | Industry or category |
| Narrative | Short business description (“what we do”) |
| Locale | Primary language; timezone (IANA) |
| Voice | Default communication tone guidance |
| Offering | Main services or products (high level) |
| Channels | Connected inbox channels |
| People | Basic operators / team membership |
| Taxonomy | Inbox categories / labels as used by the workspace |
| Fanny | Automation mode and preferences (how aggressive/contextual automation may be within policy) |

This is **not** full CRM or project depth — it is the **smallest** slice that makes classification and safe automation credible.

**Product implementation:** The Business Profile screen (`/business-profile`) stores identity and operating context in `Workspace.config.businessProfile`. Operators can edit **region / market**, **working hours**, and **attention rules** (short bullet-style reminders) there; `resolveWorkspaceContext` and `buildWorkspaceContextBlock` in `core/workspace.ts` already merge these into the workspace context block passed to Fanny.

---

## 4. Full 7F Business profile (additional depth)

Beyond the lite minimum, the full product may attach richer context such as:

- Deeper CRM (accounts, contacts, history)  
- Projects and delivery context  
- Advanced roles and permissions  
- Advanced routing rules  
- Vertical-specific settings  
- Analytics and reporting  
- Workflow / operations preferences  

Full profile **extends** the base; it does not replace the idea that **every** workspace has profile infrastructure.

---

## 5. Automation layering and safety

Fanny’s effective behaviour is the intersection of several layers, applied **top-down** (highest authority wins):

1. **Global hard safety policy (code)** — non-negotiable caps: what must never auto-execute, what always needs approval, deny-lists, multi-tenant isolation, etc. Implemented in services/policies/planners (e.g. inbox automation gates), not in workspace JSON alone.
2. **Workspace Profile** — who the business is, how they work, language/tone/service boundaries so automation is **contextual** not blind.
3. **Inbox / Fanny preferences** — stricter or more permissive *within* global policy (e.g. auto-task thresholds, tone, category defaults).
4. **Explicitly approved learned patterns** (future) — only after human/system approval; never overrides layers 1–3.

**Rule:** Workspace preferences (and any future “learned” layer) may make automation **stricter** or **more contextual**, but **must never bypass** the global hard safety policy.

---

## 6. Future implications

- **Fanny preferences UI** should be framed as “how much automation we allow **within** safety,” not “disable safety.”  
- **Learned automation** should be stored and gated so it cannot widen execution beyond what layers 1–3 allow.  
- **Plan tiers** can hide **depth** of profile UI (lite vs full), not whether a **minimal** profile exists for AI.

---

## See also

- [Smart Inbox — Technical Decisions Log](inbox-technical-decisions.md) — operational inbox trade-offs and cross-links.  
- [Inbox pipeline testing: pure planners first](inbox-pipeline-testing.md) — how inbox write/automation logic is tested safely in code.
