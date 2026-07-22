# 7F Vertical Agent Architecture

This document records the product and naming decision for vertical-specific agents in 7F.

Status: **product architecture decision**  
Scope: **naming, verticalization, agent roles, pricing logic for Beauty**  
Applies to: **7F Beauty first, future verticals later**

---

## Decision

7F keeps its core agent system, but each major vertical may also have its own vertical specialist agent.

The vertical specialist does not replace the core 7F agents. It adds industry context and coordinates the core agents inside that vertical.

For the first vertical:

- Product / vertical: **7F Beauty**
- Vertical specialist agent: **Finesse**
- Commercial phrase: **7F Beauty, powered by Finesse**
- Plans: **Beauty Solo**, **Beauty Studio**, **Beauty Enterprise**

This keeps the vertical clear and sellable while giving it a premium agent identity.

---

## Core 7F agents

The core agents remain platform-wide. They are not renamed per vertical.

| Agent | Platform role |
|---|---|
| **Francis** | Direction, strategic decisions, executive perspective |
| **Fanny** | Smart Inbox, messages, incoming work, classification, suggested replies, follow-ups |
| **Freya** | Creative work, content, visual ideas, marketing assets |
| **Fiona** | Growth, campaigns, audience, channels, marketing strategy |
| **Felix** | Finance, subscriptions, payments, money signals |
| **Mr. Forte** | Orchestrator / module builder, workspace setup, vertical activation |
| **Fathom** | External intelligence, trends, competitors, market signals, regulatory or platform changes |

---

## Vertical specialist agents

A vertical specialist agent understands the workflows, language, priorities, risks and opportunities of one industry.

Examples:

| Vertical | Product name | Vertical specialist |
|---|---|---|
| Beauty | **7F Beauty** | **Finesse** |
| Construction | **7F Build** | **Forge** |
| Events | **7F Events** | TBD, possible **Fete** / **Fiesta** |
| Bar / Nightlife | **7F Bar** / **7F Nightlife** | TBD, possible **Flama** / **Fuego** |
| Education | **7F Education** | TBD, possible **Focus** |
| Cleaning | **7F Clean** | TBD, possible **Fresh** |

Future vertical names and agents must be validated before implementation.

---

## Role separation: Finesse vs. Fathom

Fathom is **not** the vertical specialist.

Fathom remains the platform-wide external intelligence agent. Fathom watches the world around the business: market shifts, competitor moves, platform changes, trends, prices, risks and opportunities.

Finesse is the Beauty specialist. Finesse understands beauty operations: appointments, clients, treatments, follow-ups, no-shows, content needs, booking gaps, salon/team operations and beauty-specific growth.

Canonical rule:

> **Fathom discovers what is changing outside. Finesse interprets what it means for Beauty. The core 7F agents execute within their own roles.**

Example:

1. **Fathom** detects a rising beauty trend on Instagram or TikTok.
2. **Finesse** decides whether it matters for the specific Beauty workspace.
3. **Freya** prepares the creative content.
4. **Fiona** turns it into a campaign.
5. **Fanny** prepares or routes messages through WhatsApp, Instagram DM, TikTok messages, Messenger or email.
6. **Felix** connects the action to revenue, payments or financial signals when relevant.
7. **Mr. Forte** helps activate or configure the needed module or workflow.

---

## 7F Beauty product direction

7F Beauty must not feel like a lightweight appointment widget or a small corner of 7F.

It should be positioned as a complete AI-powered beauty business suite.

Core value areas:

- Bookings and calendar
- Clients and beauty history
- WhatsApp-first messaging
- Instagram DM, TikTok messages and Messenger as important beauty channels
- Email when useful
- Reminders and confirmations
- Waitlist and booking gaps
- Marketing with AI
- Photo-to-caption content workflows
- Client follow-ups and reactivation
- Simple campaigns
- Today Beauty and intelligent tasks
- Simple reports
- Basic income tracking
- Basic inventory

The product can be built gradually, but the architecture and landing direction should communicate a serious, complete vertical suite.

---

## Beauty plan logic

Pricing should be based on business complexity, not by hiding essential solo features behind higher plans.

### Beauty Solo

For a solo beauty professional: manicure, esthetician, lash artist, brows, massage, solo hair professional or similar.

Beauty Solo should include everything a solo professional needs to operate seriously:

- Bookings
- Calendar
- Clients
- Client history
- WhatsApp-ready messages
- Instagram DM / TikTok / Messenger channel awareness
- Reminders
- Simple automations
- Waitlist
- AI marketing
- Photo-to-caption content
- Client follow-ups
- Simple campaigns
- Today Beauty
- Intelligent tasks
- Basic reports
- Basic income tracking
- Basic inventory

Beauty Solo must not feel like a reduced or incomplete version.

### Beauty Studio

For salons or small teams.

Adds complexity related to people and salon operations:

- Team members
- Multiple calendars
- Staff schedules
- Roles and permissions
- Services by professional
- Commissions
- Absences
- Salon-level operations
- Team-level reporting

### Beauty Enterprise

For larger or more advanced beauty businesses.

Adds deeper business management:

- Advanced finance
- Invoicing
- Expenses
- Advanced inventory
- Suppliers
- Packs / memberships
- Gift cards when relevant
- Advanced reports
- Deeper automation
- Multi-location support when ready
- Advanced integrations

---

## Product language

Recommended external language:

> **7F Beauty, powered by Finesse**

Recommended agent description:

> **Finesse is the AI beauty specialist inside 7F.**

Recommended explanation:

> Finesse understands beauty bookings, clients, treatments, content, follow-ups and salon operations. When messages arrive, Finesse works with Fanny. When content is needed, Finesse works with Freya. When growth is needed, Finesse works with Fiona. When money signals matter, Finesse works with Felix. When external signals matter, Finesse uses Fathom.

---

## Implementation guardrails

- Do not create fake operational agents in the product UI before runtime support exists.
- If a vertical specialist is only conceptual, label it as product direction or design foundation.
- Do not duplicate whole vertical codebases.
- Verticals must grow from a clean core plus configuration, templates, modules and adaptation.
- Channel UI for Beauty must account for WhatsApp, Instagram DM, TikTok messages, Messenger and email.
- Do not make Beauty Solo feel artificially limited. Higher plans should map to team, finance, inventory, reporting and operational complexity.
- Keep 7F as the parent brand and use vertical agents to add specialization, not fragmentation.
