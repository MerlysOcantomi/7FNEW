# 7F Language Detection & Localization Architecture

**Status:** Canonical architecture. Originally an audit + proposal (PR 1); updated after
PRs 2–4 landed (`core/i18n/ui` scaffolding, locale-resolution tests, `User.locale` +
personal locale API). Sections marked "future" describe approved-but-unbuilt phases.
**Scope:** Language detection, locale resolution, and UI localization strategy for the 7F app.

---

## 0. Executive summary

7F already has a small but solid i18n foundation in `core/i18n`, with typed locale
sets, interpolation functions, locale parsing, and `en` as fallback. The main gap is
not the foundation itself — it is that the **app UI does not consume it yet**.

Recommended direction:

1. Keep **English as the permanent internal base language** (routes, identifiers,
   schema, APIs, logs, tests, translation keys).
2. **User-level UI locale exists**: `User.locale` (nullable) plus the self-scoped
   `GET/PUT /api/users/me/locale` API and the pure policy in `core/i18n/user-locale.ts`.
   Nothing renders from it yet — that is the resolver/provider work, not schema work.
3. Keep **workspace locale** for customer-facing output and workspace identity
   (`Workspace.config.locale`, admin-gated `/api/workspaces/[id]/locale`).
4. Introduce a **React/server-aware translation boundary** gradually, on top of the
   existing `core/i18n/ui` typed-namespace layer.
5. Pilot **Spanish Beauty** through the safest visible surfaces first.
6. **Defer Inbox UI localization** until Inbox stabilization lands.

No route renaming, no route duplication, no mass string migration.

---

## 1. Verification notes (findings confirmed against the codebase)

Every claim below was checked against the repository at the time of writing.

| Claim | Status | Evidence |
| ----- | ------ | -------- |
| `core/i18n` exists with `SupportedLocale = "en" \| "es" \| "de"`, `SUPPORTED_LOCALES`, `DEFAULT_LOCALE = "en"` | ✅ Confirmed | `core/i18n/types.ts` |
| `TranslationSet` is typed and supports strings + interpolation functions (`greeting(name)`, `outbound.footer(workspaceName)`) | ✅ Confirmed | `core/i18n/types.ts` |
| `parseLocale` accepts exact keys and prefix fallback (`es-ES`/`es_ES` → `es`), then falls back to `en` | ✅ Confirmed | `core/i18n/index.ts` |
| `getTranslations` eagerly imports `en`, `es`, `de` into a single `LOCALE_MAP` | ✅ Confirmed | `core/i18n/index.ts` |
| `en`, `es`, `de` locale files present and roughly parallel | ✅ Confirmed | `core/i18n/locales/{en,es,de}.ts` |
| `npm run test:i18n` exists | ✅ Confirmed | `package.json` |
| `getTranslations` consumed only by `core/email-templates.ts`, `core/notifications/inbox.ts`, `modules/inbox/email-outbound.ts` (+ the i18n test) | ✅ Confirmed | grep across repo |
| Workspace locale stored in `Workspace.config`, resolved via `resolveLocaleFromConfig(...)` / `getWorkspaceWithResolvedConfig` | ✅ Confirmed | `core/i18n/index.ts`, `lib/workspace` |
| `/api/workspaces/[id]/locale` exists, admin-gated, validates against `SUPPORTED_LOCALES` | ✅ Confirmed | `app/api/workspaces/[id]/locale/route.ts` |
| `User.locale String?` exists (nullable, canonical codes only), with self-scoped `GET/PUT /api/users/me/locale` and pure policy `core/i18n/user-locale.ts` | ✅ Landed after the original audit | `prisma/schema.prisma` (`model User`), `app/api/users/me/locale/route.ts` |
| Typed UI namespace layer exists: `core/i18n/ui/{types.ts,index.ts,en/*}` with `getUIMessages` / `getNamespace`, English-only content, es/de falling back to English, kept OFF the root barrel | ✅ Landed after the original audit | `core/i18n/ui/*`, `core/i18n/ui.test.ts` |
| Root layout hardcodes `<html lang="en">` | ✅ Confirmed | `app/layout.tsx:44` |
| Beauty nav renders Spanish labels (`Clientas`, `Cobros`, `Herramientas`, …) without creating routes | ✅ Confirmed | `core/vertical-packs/nav-profile.ts` |
| Beauty pack carries Spanish business vocabulary (`client.plural = "Clientas"`, `billing.plural = "Cobros"`, `locale: "es"`) | ✅ Confirmed | `core/vertical-packs/beauty.ts` |
| `core/personalization` resolves business vocabulary (default → preset → workspace overrides) | ✅ Confirmed | `core/personalization/*` |
| `WS_CTX_LABELS` in `core/workspace.ts` is a second `en/es/de` mini-dictionary **not** using `core/i18n` | ✅ Confirmed (drift) | `core/workspace.ts:67` |

### Two drift corrections vs. the original brief

1. **`middleware.ts` already exists.** It is not a future file — it currently handles
   auth/session gating (`7f-session` / `7f-client-session` cookies, public paths, client
   portal routing) and legacy role gating for workspace pages. Future locale work would
   *extend* it (cookie/header normalization only), never introduce it. **It must not be
   used to rewrite routes into `/es/...`, `/de/...`, `/en/...` prefixes.**
2. **`navigator.language` is used exactly once — but not for locale detection.** The only
   occurrence is in `hooks/use-speech-recognition.ts` (`recognition.lang = lang ??
   navigator.language ?? "en-US"`), for speech recognition. So the brief's conclusion
   holds — there is **no browser *locale* detection** — but the search is not literally
   empty.

Otherwise the original audit is accurate.

---

## 2. Current language map

Rough counts are heat-map estimates from sampled high-impact surfaces, not an exhaustive
string inventory.

| Surface | Current language | Translation source | Rough visible load | Notes |
| ------- | ---------------- | ------------------ | -----------------: | ----- |
| Default sidebar / nav | Mostly English + vocabulary labels | Hardcoded + `core/personalization` | ~45–60 | `Overview`, `Today`, `Smart Inbox`, `Needs action`, `Manual Intake`, `Notifications`, `Business Profile`. Some entity labels come from vocabulary. |
| Beauty sidebar/nav | Spanish | `core/vertical-packs/nav-profile.ts` | ~11 | Intentional vertical-pack data, **not** app i18n. |
| Global search | Mostly English + Spanish example chips | Hardcoded | ~30–50 | Quick links English; example chips Spanish (`Ana factura`, `contrato Carlos`, `cita mañana`). |
| Account center | Mixed EN/ES | Hardcoded | ~25–35 | `Workspace settings`, `Members`, `Plan & usage`; some Spanish descriptions. |
| Workspace settings / admin | Mixed EN/ES | Hardcoded + vocabulary | ~60–90 | English headings; one Spanish explanatory banner; module labels partly vocabulary-driven. |
| Clients page | Mostly English, Spanish route/model names | Hardcoded + API labels | ~40–70 | `Clients`, `New client`, `Search clients`, `No clients yet`; route stays `/clientes`. |
| Forms | Mixed / mostly English | Hardcoded | High | clients, projects, invoices, transactions, tasks, documents. Migrate only after shell/nav + pilot surfaces are stable. |
| API errors | Mixed EN/ES | Hardcoded | Medium | Locale API uses Spanish: `Workspace no encontrado`, `locale es requerido`, `Locale ... no soportado`. |
| Outbound email | Localized | `core/i18n` | Low/med | Strongest current i18n usage (`email.ack`, `email.outbound`, `poweredBy`, `sentVia`). |
| Notifications | Localized (some inbox) | `core/i18n` | Low/med | `notifications.inbox` keys with functions/fallbacks. |
| Client portal / widget | Not fully audited | Likely hardcoded + partial | Unknown | Needs a separate small audit before customer-facing localization. |
| Inbox UI | Hardcoded / mixed | Hardcoded + i18n only for outbound/notifications | High | **Deferred** until Inbox stabilization. Sidebar may reference Inbox labels; Inbox internals must not be migrated now. |

---

## 3. Legacy Spanish route map

**Do not rename or consolidate in this workstream. Map only.**

| Existing route | User-visible concept | Recommendation |
| -------------- | -------------------- | -------------- |
| `/clientes` | Clients / Clientas | Keep. Localize label only. |
| `/tareas` | Tasks / Pendientes | Keep. Do not create `/tasks`. |
| `/proyectos` | Projects / Services | Keep. Do not create `/projects`. |
| `/facturacion` | Billing / Cobros / Invoices | Keep. Do not create `/billing` or `/invoices`. |
| `/finanzas` | Finance | Keep. |
| `/entrada` | Manual Intake | Keep. Later label should be localized. |
| `/calendario` | Calendar / Agenda | Keep. |
| `/archivos` | Files / Documents | Keep. |
| `/notificaciones` | Notifications | Keep. |
| `/historial` | History | Keep. |
| `/biblioteca` | Library / Tools | Keep. |
| `/usuarios` | Users / Team | Keep. |
| `/departamentos` | Departments | Keep. |
| `/comunicacion` | Communication | Keep. |
| `/identidad` | Contact Matching / Identity | Keep. |
| `/contenido` | Marketing / Content | Keep. |
| `/administracion` | Workspace settings | Keep. |
| `/motor` | AI workspace | Keep. |

English routes also exist for newer surfaces (`/today`, `/inbox`, `/requests`,
`/business-profile`, `/forte/improvements`, `/system`). This mix is acceptable for now.
**The architecture must not add locale variants of any route.**

---

## 4. Does the current i18n system suffice?

**Keep the typed i18n foundation, but evolve it structurally before moving lots of UI
strings.**

The existing structure is good for a small outbound/email dictionary. It is not enough
for full UI coverage because:

1. `getTranslations` eagerly imports all locale files into one map — fine today, not
   ideal once UI grows across nav, settings, onboarding, portal, widgets, forms.
2. `TranslationSet` is a single monolithic interface — it will become too large and
   conflict-prone.
3. The App Router has server/client boundaries. Client surfaces (sidebar, global search
   modal, settings panels, toasts) need a client-accessible provider; server-rendered
   surfaces need server helpers.
4. Root layout hardcodes `lang="en"`, so document language is not locale-aware.

### Canonical structure — typed namespaces (decided)

Operator-UI messages live in:

```
core/i18n/ui/<locale>/<namespace>.ts
```

with the interface contracts in `core/i18n/ui/types.ts` and the resolvers
(`getUIMessages` / `getNamespace`) in `core/i18n/ui/index.ts` — this layer is
deliberately kept OFF the root `@core/i18n` barrel so legacy email/notification
consumers never bundle UI dictionaries.

The alternative layout previously sketched here and in PR #25,

```
core/i18n/locales/<locale>/<namespace>.ts   // ❌ expressly discarded for UI messages
```

is **rejected for new UI messages**: it collides/shadows with the legacy
`core/i18n/locales/{en,es,de}.ts` files and would re-expose UI catalogs on the root
barrel. New namespaces are added under `core/i18n/ui/` only.

### Two message domains (shared infrastructure, separate catalogs)

| Domain | Audience & locale | Runtime | Status |
| ------ | ----------------- | ------- | ------ |
| `core/i18n/ui/` | Operator interface — resolved with the **viewer's** locale | Server + selectively client | Exists (en-only) |
| `core/i18n/communications/` | Emails, notifications, external comms — resolved with the **recipient's** locale (workspace/client) | **Server-only** | Future — NOT created yet |

The legacy monolithic `TranslationSet` (email/notifications/activity) will converge into
`communications/`, **not** into `ui/` — do not add email/notification strings to `ui/`
in the meantime. Both domains share the same infrastructure: `core/i18n/locale.ts`
(`parseLocale` / `isValidLocale`), the interface-per-namespace × file-per-locale typing
pattern, and the future `format.ts` helpers.

Do **not** jump to JSON unless a strong external translation workflow demands it. The
current TypeScript interpolation functions are a real strength and should be preserved.

---

## 5. Recommended i18n architecture

### Core principle — two separate layers

1. **i18n = language.** "Save changes" → "Guardar cambios". Controlled by
   user/workspace/browser locale resolution. Keys are English and stable.
2. **Vocabulary = business terminology.** "Client" → "Clienta" / "Patient" / "Student".
   Controlled by vertical/business type/workspace overrides. Already exists in
   `core/personalization` and the Beauty pack.

### Composition rule

> Translation resolves the sentence; vocabulary fills the business noun.

```ts
t.clients.searchPlaceholder({ clientPlural: vocab.client.plural.toLowerCase() })
// en:      "Search {clientPlural}, company, or email..."
// es/Beauty: "Buscar clientas, empresa o email..."
// de/clinic: "Patienten, Unternehmen oder E-Mail suchen..."
```

### Do NOT merge vocabulary into i18n

Avoid keys like `clienta.singular` or `beauty.client.plural`. Instead:
`nav.clients`, `clients.searchPlaceholder({ clientPlural })`,
`settings.modules.clientLabel({ clientPlural })`. Vocabulary stays a resolver layer on
top of locale strings.

---

## 6. Language preference location

| Preference | Owner | Purpose | Persistence |
| ---------- | ----- | ------- | ----------- |
| `User.locale` | Signed-in user | App UI language — **persisted source of truth for authenticated users** | Exists: nullable field + `GET/PUT /api/users/me/locale` |
| `Workspace.config.locale` | Workspace admin | Customer-facing output + default workspace language | Already exists (`/api/workspaces/[id]/locale`) |
| Cookie `7f-locale` | Browser/session bridge | Technical mirror/hint: first paint + pre-login only — **never outranks `User.locale`** | Future cookie, not source of truth |
| Browser language | Browser | Weak detection signal | Not persisted until user confirms |
| Region/country | Workspace/user metadata | Weak secondary signal only | Never overrides explicit language |

### Independent signals — do not collapse

These are five separate signals; none may be derived from another:

- `User.locale` — the person's own interface language.
- `Workspace.config.locale` — the business's default language and its customer-facing
  communications.
- `Conversation.detectedLanguage` — the detected language of a specific client/
  conversation (drives AI outbound replies; wider value set than `SupportedLocale`).
- Vertical vocabulary (`core/personalization`, vertical packs) — sector terminology,
  **not** a locale.
- Country, currency, and timezone — independent regional configuration. **Currency must
  never be inferred from language/locale**: `formatMoney`-style helpers take an explicit
  currency (workspace/document config); the viewer's locale only decides separators and
  digit grouping.

### Why `User.locale` is needed

A German-speaking employee can work inside a Spanish salon workspace:

- User UI: German · Workspace customer-facing emails/messages: Spanish · Beauty
  vocabulary: Spanish vertical terms · Internal routes/keys/schema: English.

Workspace locale alone cannot support this without forcing all employees into one UI
language. **Schema status:** `User.locale String?` already exists (nullable, canonical
codes only, `null` = no explicit preference), together with its API and pure policy.

---

## 7. Language detection flow

### Resolution chains (decided — two separate chains)

Authenticated user (operator app):

```
User.locale                    — persisted source of truth
  → Workspace.config.locale    — active workspace default
  → Accept-Language            — via parseLocale (prefix fallback, es-MX → es)
  → English                    — DEFAULT_LOCALE = "en"
```

Anonymous visitor (login, future public pages):

```
cookie 7f-locale               — previous explicit choice, validated with isValidLocale
  → Accept-Language
  → English
```

The cookie is a **technical hint/mirror, never an authority above `User.locale`**: with
a valid session it does not participate in the decision — it is synchronized to the
resolution result so the pre-session first paint matches. If cookie and `User.locale`
disagree, `User.locale` wins and the cookie is rewritten.

The future `getRequestLocale()` server helper is a **read-only resolver**: it must not
attempt to write cookies from a Server Component (Next.js forbids it). The cookie is
updated only through allowed write paths — a Route Handler (e.g. the existing
`PUT /api/users/me/locale`), a Server Action, or middleware cookie normalization.

### Where it executes

| Runtime | Responsibility |
| ------- | -------------- |
| Server helper | Resolve initial locale for server-rendered pages/layouts. |
| Root/app shell provider | Pass resolved locale + translations to client components. |
| Client provider | Expose `useI18n()` / `t` for client-only surfaces. |
| Cookie | Prevent first-paint mismatch after the user chooses a language. |
| Middleware | Optional later, cookie/header normalization only. **Never** route rewriting. |

### Middleware caution

`middleware.ts` already exists for auth/session gating. Do **not** extend it to create
`/es/...`, `/de/...`, `/en/...` route prefixes — that would violate the route constraint
and recreate the duplicate-route problem.

---

## 8. First-time language prompt

### When to show

Show a small, non-blocking prompt only when **all** hold: `User.locale` is empty, no
confirmed language cookie exists, browser/workspace signals disagree or are ambiguous,
and the user is signed in / has reached a stable app shell.

- Browser `de-CH`, workspace `es` → ask.
- Browser `es-ES`, workspace `es` → silently use Spanish, offer a setting later.
- Browser unsupported → use workspace or English; no prompt unless truly needed.

### UX pattern

Small top/bottom banner or account-center card — not a blocking modal (except rare
first-login ambiguity).

```
Which language should 7F use for your workspace view?
  English   Español   Deutsch
You can change this later in Settings.
```

- Choosing a language persists `User.locale`.
- "Not now" dismisses for the session.
- "Don't ask again" persists a lightweight dismissal only if a reliable fallback exists.

### Anti-annoyance rules

Never show on every page load. Never block work without real ambiguity. Never infer a
permanent preference from the browser alone. Never change workspace customer language
from a personal prompt.

---

## 9. Settings proposal

### User-level setting

Account Center → *My profile / Preferences*. Label: **Language**. Values: English,
Español, Deutsch. Behavior: updates `User.locale`, sets the locale cookie for first-paint
consistency, re-renders the app shell/client provider; server pages pick it up on next
navigation.

### Workspace-level setting

Workspace settings / Administration → **Workspace language**. Admin-gated. Reuse the
existing `/api/workspaces/[id]/locale` endpoint (already validates supported locales and
requires admin). Purpose: customer-facing communication language + default workspace
setup language (email/portal/widget output).

### Settings copy distinction

```
App language        — Used for your personal 7F interface.
Workspace language  — Used for customer-facing messages, emails, portal, and workspace defaults.
```

---

## 10. Translation file structure

Adopt **typed per-namespace TypeScript files**. For UI messages this is implemented as
`core/i18n/ui/<locale>/<namespace>.ts` (see §4 — the `core/i18n/locales/<locale>/` layout
is expressly discarded). Naming/shape conventions are frozen in `core/i18n/ui/types.ts`:
camelCase keys, nested objects for semantic units, typed functions for interpolation/
plurals/vocabulary composition, every locale satisfying the same interface.

| Option | Verdict |
| ------ | ------- |
| Current single `en.ts/es.ts/de.ts` | Legacy (email/notifications) only; converges into `communications/` later. |
| Per-namespace TS files | **Best fit.** Typed, scalable, supports functions/plurals, smaller PRs. Implemented for UI under `core/i18n/ui/`. |
| JSON + loader | Defer. Works with external tooling but loses typed functions. |
| Runtime DB translations | Do not use. Too much complexity now. |

### Namespaces

`common.*  nav.*  globalSearch.*  globalNew.*  settings.*  auth.*  today.*  clients.*
calendar.*  billing.*  marketing.*  notifications.*  email.*  portal.*  widget.*  beauty.*`

### Key-naming rules

English keys only. Stable semantic keys (not text-as-key). No route names in keys unless
the visible concept *is* the route surface. No Spanish keys. No vertical-specific business
nouns in global keys.

```
nav.today · nav.inbox.title · nav.inbox.needsAction
settings.language.appLabel · settings.language.workspaceLabel
clients.title · clients.newButton · clients.searchPlaceholder · clients.empty.title · clients.empty.body
email.ack.heading
```

### Interpolation & plurals

Use functions where grammar needs data:
`clients.count = (count, clientPlural) => ...`,
`email.outbound.footer = (workspaceName) => ...`. Start plurals simple with functions
(`common.itemCount = (count, singular, plural) => ...`); add `Intl.PluralRules` per locale
later only if needed. Do not overbuild before coverage exists.

---

## 11. Spanish Beauty pilot scope

**Goal:** make the first Spanish salon experience feel coherent without touching unstable
surfaces.

### Include first

| Surface | Scope |
| ------- | ----- |
| Beauty sidebar/nav | Already Spanish; keep and review consistency. |
| Auth/login | Basic visible labels, sign-in copy, user-facing errors. |
| App shell / global chrome | Search, New, Today trigger, account center, common buttons. |
| Today | Spanish headers, empty states, action copy. |
| Clientes | Title, filters, empty states, buttons, table headers. Compose vocabulary `Clienta/Clientas`. |
| Calendario/Agenda | Visible labels only. No calendar behavior changes. |
| Facturación/Cobros | Visible labels only. No Finance redesign. |
| Workspace settings | Language setting + business/service labels needed for Beauty setup. |
| Customer-facing email | Extend `email.*` carefully (already `core/i18n`-backed). |
| Notifications/toasts | Common success/error labels used by pilot surfaces. |

### Explicitly exclude first

`app/inbox/page.tsx` and Inbox internals · WhatsApp / Instagram DM / web chat · appointment
behavior · calendar behavior · route consolidation · full German/Switzerland coverage ·
full-app translation sweep. *(Inbox labels may be referenced in nav findings, but Inbox UI
localization waits for stabilization.)*

---

## 12. Deferred work

**German / Switzerland** — defer beyond the Spanish Beauty pilot. The existing `de` locale
is a head start. Decide formal `Sie` vs informal `du` (default formal `Sie` for Swiss
business SaaS). Use `Intl.DateTimeFormat` / `Intl.NumberFormat` / currency for `de-CH` /
CHF. Do not fork `de` into `de-CH` until real copy/formatting differences justify it.

**Additional locales** — defer until the namespace structure is stable, the Spanish pilot
proves the workflow, and a translation QA checklist exists.

**Full-app coverage** — defer; use small per-surface PRs.

**Route consolidation** — defer to the navigation-diet / `nav-vertical-audit-proposal`
workstream.

---

## 13. Risks

| Risk | Impact | Mitigation |
| ---- | ------ | ---------- |
| Collision with Inbox stabilization | High | Do not touch `app/inbox/page.tsx` or Inbox internals. Defer Inbox UI localization. |
| App Router server/client boundary | High | Provide a server helper + client provider. Avoid importing huge locale maps into every client component. |
| Bundle growth | Medium | Move to per-namespace typed files before full migration. Load only required namespaces where feasible. |
| Vocabulary/i18n drift | High | Keep the vocabulary resolver separate. Vocabulary is interpolation data, not translation keys. |
| Partial-translation UX | High | Pilot by coherent surfaces, not random strings. Avoid mixed ES/EN in one panel. |
| Locale persistence ambiguity | Medium | Add `User.locale`; keep workspace locale for customer-facing output. |
| Hardcoded API error strings | Medium | Treat user-visible API errors as translatable later; do not mass-rewrite technical errors/logs. |
| Existing Spanish routes confuse architecture | Medium | Document route map. No locale routes. No renames now. |
| Beauty Spanish strings in vertical pack | Medium | Keep for vertical vocabulary/nav; do not confuse with global app i18n. |
| Second mini-dictionary (`WS_CTX_LABELS`) | Low | Note the drift; fold into `core/i18n` only when that surface is localized. |

---

## 14. Small PR sequence

Each PR is single-objective and reviewable. **PRs 1–4 have landed.**

1. **Docs only** — this document. ✅ Landed.
2. **i18n namespace scaffolding, `en` only** — landed as `core/i18n/ui/` (common + nav),
   kept off the root barrel. ✅ Landed (supersedes the `locales/en/` variant of PR #25).
3. **Locale-resolution tests** — ✅ Landed (`i18n.test.ts`, `ui.test.ts`).
4. **`User.locale` schema field** — nullable field + self-scoped API + pure policy.
   ✅ Landed (`user-locale.ts`, `/api/users/me/locale`).
5. **Locale resolver helper** — read-only server-side chains from §7 (authenticated /
   anonymous) + cookie-mirror semantics + tests. No visible UI.
6. **Client i18n provider** — provider/hook, wire resolved locale into the app shell
   without moving copy yet, careful `<html lang>` strategy.
7. **Settings language controls** — user app-language setting + workspace language setting
   (reuse existing endpoint, admin-gated).
8. **Global chrome pilot** — localize sidebar / global search / global new / account
   center common labels. Beauty nav stays vertical-profile data unless/until converted to
   locale-aware labels.
9. **Spanish Beauty Clients surface** — move Clients page strings to i18n, compose with
   vocabulary for `Clienta/Clientas`.
10. **Spanish Beauty Today + Calendar labels** — visible labels only, no behavior changes.
11. **Customer-facing email expansion** — extend `email.*` carefully, keep workspace locale
    as the customer-facing source.
12. **Audit next pilot surface** — settings, billing/cobros, marketing, portal/widget as
    separate scoped audits/PRs.

---

## 15. What not to touch

Do not implement changes inside: `app/inbox/page.tsx` · Inbox technical refactor ·
WhatsApp · Instagram DM · web chat/channel work · appointment behavior · calendar behavior
· route consolidation · route renaming · locale-prefixed routes · mass find-and-replace
translation · Prisma model/field names (except the future tiny `User.locale` PR) · API
names · internal logs · technical docs/tests (except i18n-visible-copy tests).

---

## 16. Files likely involved later

*Future PRs only — not modified by this doc.*

**i18n core:** `core/i18n/{types.ts,index.ts,i18n.test.ts}`,
`core/i18n/locales/{en,es,de}.ts` (legacy), the existing UI tree
`core/i18n/ui/{types.ts,index.ts,<locale>/*}` growing to
`{common,nav,settings,today,clients,calendar,billing}`, and the future server-only
`core/i18n/communications/` domain for email/notification catalogs.

**Locale resolution / providers:** `app/layout.tsx`, `middleware.ts` *(exists — extend for
cookie/header only)*, `components/i18n-provider.tsx`, `core/i18n/server.ts`,
`core/i18n/resolve.ts`, `hooks/use-user.tsx`, `app/api/auth/me/route.ts`,
`app/api/system/me/route.ts`.

**User/workspace locale settings:** `prisma/schema.prisma`,
`app/api/users/me/locale/route.ts`, `app/api/workspaces/[id]/locale/route.ts`,
`components/account-center/account-center-panel.tsx`, `components/administracion-content.tsx`,
`app/administracion/page.tsx`.

**Navigation / global chrome:** `components/sidebar-nav.tsx`,
`core/vertical-packs/nav-profile.ts`, `components/global-search.tsx`,
`components/global-new/*`, `components/toast-provider.tsx`.

**Spanish Beauty pilot:** `core/vertical-packs/beauty.ts`,
`core/personalization/{resolve.ts,presets.ts}`, `app/clientes/page.tsx`,
`components/forms/cliente-form.tsx`, `components/today/*`, `components/calendar/*`,
`app/calendario/page.tsx`, `app/facturacion/page.tsx`, `components/forms/factura-form.tsx`,
`core/email-templates.ts`, `modules/inbox/email-outbound.ts`, `core/notifications/inbox.ts`.

**Explicitly deferred (do not modify for localization until Inbox stabilization):**
`app/inbox/page.tsx`, `components/inbox/*`, `modules/inbox/*`, `app/api/inbox/*`.

---

## 17. Recommended next step

PRs 1–4 have landed. Next: port the remaining English namespaces
(`settings,today,clients,calendar,billing`) onto `core/i18n/ui/` (superseding PR #25's
`locales/en/` layout), then **PR 5 — the read-only locale resolver helper** (§7 chains).
