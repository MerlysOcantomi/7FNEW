# 7F — Vertical Navigation & Activation Model (architecture)

Status: **Accepted (docs-only, PR-N1)** · 2026-07-04 · Scope: navigation
resolution + vertical activation doctrine. No product code changes.

This document is the canonical reference for how 7F becomes a *verticalized*
product (7F Beauty, and later 7F Agency, Construction, Clinic, …) without
duplicating the core or overloading the sidebar. Read it before adding a
vertical, wiring a nav profile, changing the sidebar resolver, or deciding
whether a vertical is "real".

It **describes the model that already exists in code** and fixes the doctrine
for the follow-up PRs (PR-N2…PR-N6). It does **not** change navigation,
routes, the sidebar, or the Beauty profile.

Related code (read-only references for this PR):

- Nav profiles + resolver: [`core/vertical-packs/nav-profile.ts`](../core/vertical-packs/nav-profile.ts)
- Resolved experience: [`core/vertical-packs/experience.ts`](../core/vertical-packs/experience.ts)
- Beauty pack (data): [`core/vertical-packs/beauty.ts`](../core/vertical-packs/beauty.ts)
- Vertical specialists: [`core/vertical-packs/specialists.ts`](../core/vertical-packs/specialists.ts)
- Vocabulary/personalization: [`core/personalization/resolve.ts`](../core/personalization/resolve.ts)
- Workspace config + vertical setter: [`core/workspace.ts`](../core/workspace.ts) · [`core/verticals.ts`](../core/verticals.ts)
- Sidebar consumer: [`components/sidebar-nav.tsx`](../components/sidebar-nav.tsx)
- Today operating model (adjacent): [`docs/today-layout-modes.md`](./today-layout-modes.md)
- Tests: [`core/vertical-packs/nav-profile.test.ts`](../core/vertical-packs/nav-profile.test.ts) · [`core/vertical-packs/experience.test.ts`](../core/vertical-packs/experience.test.ts)

---

## 1. Purpose

7F is a multi-tenant business operating system: **one core + vertical packs**.
The same product should be able to *feel like* 7F Beauty for a salon and 7F
Agency for a creative studio, without:

- forking the core per vertical,
- stacking every vertical's modules onto one giant sidebar,
- or shipping a vertical that *looks* finished before it actually is.

The mechanism is small and additive by design: a workspace declares its
vertical, a pure resolver maps that to an optional **nav profile** (plus
vocabulary, theme keys, specialist agent, recommended modules), and the shell
renders it. A vertical with no profile falls back to the full default core
navigation, byte-for-byte. **Adding a vertical never changes another
vertical's navigation.**

---

## 2. Source of truth

- **The active vertical is selected by `Workspace.verticalKey`.** It is a
  string column on the workspace (`@default("creative-agency")` in
  `prisma/schema.prisma`). Everything vertical-aware resolves *from* this key —
  no other place decides "which vertical is this".
- A workspace runs on exactly one of two shapes:
  - the **default core experience** (`experienceState: "default"`), or
  - a **verticalized experience** (`experienceState: "complete"`).
- `verticalKey` is set/changed through `setWorkspaceVertical()` in
  `core/workspace.ts`, which also merges the vertical's `defaultConfig` into the
  workspace config. Unknown/inactive keys fall back safely to
  `creative-agency`.
- Resolution from the key is **pure and total**: `resolveNavProfile(key)` and
  `resolveWorkspaceExperience(key)` never throw and never touch the DB, so they
  are safe on the client sidebar, on the server, and in tests.

---

## 3. Navigation resolution model

A vertical *may* provide a **declarative nav profile** (`VerticalNavProfile` in
`nav-profile.ts`). The profile is pure data — it imports no React, no icon
library, no Prisma.

The resolution rule the sidebar already follows:

```
verticalKey ──▶ resolveNavProfile(verticalKey)
                 ├─ profile found  ▶ sidebar renders the vertical nav
                 └─ null           ▶ sidebar renders the full default core nav
```

Doctrine:

- A nav profile **shapes what the user sees in the sidebar** — which items,
  their order, and their labels. Icons are *not* in the profile; the sidebar
  maps them by stable item `id` (`VERTICAL_NAV_ICONS`), so core never depends on
  an icon library.
- A vertical nav profile **simplifies or replaces** the visible core
  navigation. It is a *replacement view*, not an *additive layer*.
- It must **not stack more modules on top of the full core nav**. The vertical
  menu is the whole menu for that workspace, not "core + extras".
- If a vertical has **no complete nav profile**, 7F **falls back to the default
  core navigation**. Fallback is the safety net, not a failure state.
- **Hiding is by omission.** A route left out of a vertical profile is still a
  live route in 7F Core — it is just not surfaced in that vertical's sidebar.
  Nothing is deleted.

### What this PR does *not* change

The sidebar already implements this resolution
(`resolveNavProfile(workspace?.verticalKey)` → `buildVerticalNavSections` vs the
default `NAV_SECTIONS`). This document only formalizes it. **No sidebar behavior
changes in PR-N1.**

---

## 4. Vertical simplicity rules

A vertical should feel *focused for one business type*, not smaller or fake.

- **~6–7 primary entries.** A vertical normally exposes around six or seven
  primary nav items — the daily surfaces of that business.
- **Secondary items go into a "More" group** (`group: "more"`, rendered under
  the profile's `moreLabel`, e.g. "Más"). More is for real-but-occasional
  surfaces (billing, team, notifications, agent center), not a dumping ground
  for the rest of core.
- **Hiding ≠ deleting.** Omitting a route from a vertical nav removes it from
  that sidebar only; the underlying capability and route remain in core.
- **The goal is focus, not amputation.** A vertical should feel like a product
  built for *that* business, while every core capability stays reachable
  (direct URL, More group, search, or a later "full 7F" affordance).

---

## 5. Route policy

- **Point at existing, stable core routes.** Every profile `href` MUST resolve
  to a route that already exists in 7F Core. The nav layer reorders / relabels /
  hides — it never invents a page.
- **Do not mint new parallel language routes.** We do not want a second set of
  routes per language (e.g. adding a fresh `/entrada`, `/tareas`, `/clientes`
  *as vertical-specific duplicates*). Labels carry the language; routes do not.
- **Routes should trend to English and stay stable.** Visible **labels** can be
  localized later (Beauty labels are already Spanish: "Clientas", "Cobros"); the
  **route path** is an identity, not a translation surface.

### Honest note on the current route inventory (UX/route debt)

Today's core routes are a **mix of English and Spanish paths** (`/today`,
`/inbox` alongside `/clientes`, `/calendario`, `/contenido`, `/facturacion`,
`/usuarios`, `/notificaciones`, `/biblioteca`). The Beauty profile correctly
points its hrefs at these **existing** routes rather than creating new ones —
that is the right call and follows the policy above.

Reconciling the route names themselves (English canonicalization, retiring
Spanish-duplicate/orphan routes, redirects/archival) is **explicitly out of
scope here** and is deferred to **PR-N5**. PR-N1 does not rename, redirect, or
delete any route.

---

## 6. Layering model

A verticalized workspace is the composition of several independent layers.
Keeping them separate is what keeps the mechanism small. From "product shape"
down to "who can see what":

| Layer | Owns | Source in code |
| --- | --- | --- |
| **Workspace vertical setting** | *Which* vertical is active | `Workspace.verticalKey` |
| **Vertical nav profile** | The **product shape** — visible sidebar structure, order, labels | `resolveNavProfile()` / `VERTICAL_NAV_PROFILES` |
| **Personalization / vocabulary** | Entity wording ("Clienta" vs "Client") | `resolveVocabulary()` / `mapVerticalKeyToBusinessType()` |
| **Module visibility / toggles** | *Which modules* are available for a workspace (fine-tuning) | `VerticalConfig.modules` (e.g. `BEAUTY_MODULE_VISIBILITY`) |
| **Role permissions** | *Who can access* what | `WorkspaceMember.role` |
| **Experience state** | Whether the vertical is honestly "complete" or "default" | `experienceState` in `resolveWorkspaceExperience()` |

**Key distinctions (do not blur these):**

- **Vertical profile defines the product shape.** It is the primary answer to
  "what does this workspace's 7F look like".
- **Module toggles fine-tune** the modules available to a specific workspace.
  They adjust *availability*, not the overall navigation silhouette.
- **Role permissions control access.** They gate who may open a surface.
- **Roles must NOT define the overall navigation structure.** Navigation shape
  comes from the vertical profile; roles only hide/disable items a given user
  may not use. A role is not a vertical.

---

## 7. Experience state rules

`experienceState: "complete" | "default"` (`ExperienceState` in
`experience.ts`) is an **honesty flag**, not a feature switch.

- `"complete"` — the vertical has a **real** experience: a built pack, a nav
  profile, vocabulary, real routes (or safe route mappings), tests, and enough
  functionality to stand on its own. Beauty is the only `"complete"` vertical
  today.
- `"default"` — the vertical is **seeded but not built** (e.g. construction,
  clinic, law, florals are registered in seed but resolve to the default
  experience). It gets the safe default core experience.

Rules:

- A vertical must **not present itself as a complete product** unless it has
  real functionality, navigation, vocabulary, and tests.
- **Seeded or incomplete verticals must not look production-ready.** Being
  listed in the seed is not being built.
- **No fake product.** Do not dress up a `"default"` vertical as `"complete"`.

---

## 8. Beauty pilot nav proposal

Beauty is the first vertical we want to make feel real and focused. This section
is the **target doctrine** for the Beauty pilot menu. (Refining the live profile
to match is **PR-N4** — PR-N1 does not edit `BEAUTY_NAV_PROFILE`.)

**Recommended Beauty pilot nav**

Primary (~6):

- Today / Hoy
- Agenda
- Clients / Clientas
- Messages / Mensajes
- Marketing
- Services / Servicios

More / Más:

- Billing / Cobros
- Team / Equipo
- Mr Forte
- Notifications / Notificaciones

**Current live profile** (`BEAUTY_NAV_PROFILE`, for reference — not changed
here): primary is Hoy · Agenda · Clientas · Mensajes · Marketing · Servicios;
More is Cobros · Equipo · Mr Forte · **Herramientas** · Notificaciones. The live
"More" additionally carries **Herramientas (Tools / `/biblioteca`)**, which the
recommendation above does not list. Reconciling that one item is a PR-N4
decision; PR-N1 only records the intended target.

**Beauty doctrine notes:**

- Beauty should **not show the entire horizontal 7F core**. The vertical menu is
  the whole menu.
- **Tools / Biblioteca must not appear in the Beauty pilot *primary* nav.** (It
  is currently in More; whether it stays in More at all is a PR-N4 call.)
- Advanced finance, projects, docs, reports, and system-like areas stay
  **hidden or secondary** for the pilot (hidden by omission — still in core).
- **Services → `/business-profile` is acceptable as an interim destination** (the
  service catalog is configured there today), but it is **UX debt**: a dedicated
  services surface is a later, separate step, not part of this PR.
- **Appointment-first Today stays gated** until a real Appointment backend
  exists. `BEAUTY_PACK.today.mode` is declared `appointment_first`, but
  `activateRealForRealWorkspaces: false` keeps real Beauty workspaces on the
  safe default. See [`docs/today-layout-modes.md`](./today-layout-modes.md).
- **Do not present fake appointment functionality as real.** No demo bookings
  shown to a real operator.

---

## 9. Agency note

- Agency may be **close to the default core experience**, or a lightly *dieted*
  version of the core. It resolves to `experienceState: "default"` today
  (`creative-agency` is the default vertical key).
- **Avoid creating an unnecessary duplicate Agency nav profile if the core
  already fits.** A nav profile is justified only when it meaningfully simplifies
  or reshapes the core for the business — not for its own sake.
- Agency *can* later grow its own command center, clients/accounts, campaigns,
  approvals, creative/content, SEO, reports, and a billing snapshot. **This PR
  only records the concept**; it does not create an Agency profile.

---

## 10. Future vertical guidance

Construction, Nightlife, Education, Clinic, Law, Route, Clean, Fitness, etc.
follow the **same mechanism** — one shared model, not a new mechanism per
vertical:

1. add a `*_PACK` (data) under `core/vertical-packs/`,
2. add a `VerticalNavProfile` + a `*_NAV_VERTICAL_KEYS` set,
3. add a case in `resolveNavProfile` / `resolveWorkspaceExperience`,
4. map its `verticalKey` → business type for vocabulary.

**Do not invent a per-vertical mechanism.** A vertical is considered **complete**
only when it has all of:

- a vertical pack,
- a nav profile,
- vocabulary / personalization,
- real routes or safe route mappings,
- tests,
- an honest `experienceState`.

Until then it stays `"default"` and rides the core experience.

---

## 11. Non-goals (what NOT to build yet)

This PR — and the vertical-navigation track generally, at this stage — does
**not**:

- build Appointment (backend or real appointment Today);
- build WhatsApp, Instagram DM, web chat, or any channel work;
- touch Smart Inbox stabilization (owned by a separate effort) or
  `app/inbox/page.tsx`;
- build public booking;
- redesign the sidebar or change sidebar behavior;
- change the Beauty nav profile;
- create new vertical packs;
- clean up legacy routes, add redirects, rename routes, or delete routes;
- remove Spanish duplicate routes;
- implement Beauty backend or any backend change;
- translate the UI / touch i18n / localization;
- modify the Prisma schema;
- add demo or fake data.

**PR-N1 is documentation only.**

---

## 12. Future PR sequence

Documented here, **not implemented** in this PR:

| PR | Scope |
| --- | --- |
| **PR-N1** | Vertical navigation model docs only *(this PR)* |
| **PR-N2** | Audit current nav profiles and route mappings |
| **PR-N3** | Add tests for `resolveNavProfile` |
| **PR-N4** | Refine the Beauty nav profile if needed |
| **PR-N5** | Audit legacy duplicate/orphan routes; propose redirects/archive |
| **PR-N6** | Workspace vertical activation UX / settings |

Each later PR stays small and additive, and none of them is a prerequisite for
the fallback safety net: any vertical without a complete profile keeps the full
default core nav.
