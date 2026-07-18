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
4. The **React/server-aware translation boundary exists**: read-only server
   resolver (`core/i18n/{resolve,cookie,server}.ts`), client provider + hook
   (`components/i18n-provider.tsx`, `useI18n()`), dynamic `<html lang>`, cookie
   bridge, and functional personal (Account Center) + workspace
   (Administración) language controls.
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

### Resolution chains (implemented — two separate chains)

Implemented in `core/i18n/resolve.ts` (pure: both chains + the q-value-aware
`parseAcceptLanguage`), `core/i18n/cookie.ts` (7f-locale policy: HttpOnly, lax,
path=/, secure in prod) and `core/i18n/server.ts` (`getRequestLocale()`,
per-request memoized). Matrix coverage lives in `core/i18n/resolve.test.ts`.

Authenticated user (operator app):

```
User.locale                    — persisted personal source of truth
  → Accept-Language            — the browser's requested language (first opening)
  → English                    — DEFAULT_LOCALE = "en"
```

Anonymous visitor (login, future public pages):

```
cookie 7f-locale               — previous explicit choice, validated with isValidLocale
  → Accept-Language            — q-value aware, prefix fallback (es-MX → es)
  → English                    — DEFAULT_LOCALE = "en"
```

**The workspace language never decides the personal interface**
(P4.FINESSE-ENES §1.3): `Workspace.config.locale` is a separate setting for
customer-facing output only — public web, bookings, automatic messages,
business templates, client communications. An operator can use the app in
Spanish while the business publishes in German. Without a personal preference,
the interface follows the browser's supported language (es → Spanish,
en → English, anything else → English); the personal selector persists
`User.locale`, which then wins over any browser language.

The cookie is a **technical hint/mirror, never an authority above `User.locale`**: with
a valid session it does not participate in the decision — it is synchronized to the
resolution result so the pre-session first paint matches. If cookie and `User.locale`
disagree, `User.locale` wins and the cookie is rewritten.

`getRequestLocale()` (`core/i18n/server.ts`) is a **read-only resolver**: it never
writes cookies (Server Components must not) and never calls the workspace helper
that auto-writes `wf_workspace` — it mirrors those rules read-only. The cookie is
written only by authorized Route Handlers: `PUT /api/users/me/locale` (mirror after
a successful DB update; delete on cleared preference) and the technical bridge
`PUT /api/i18n/locale` (cookie only, no `User.locale`, no permissions — invoked by
the provider when the server reports `shouldSyncCookie`, at most once per mount).

### Where it executes (all shipped except the middleware option)

| Runtime | Responsibility |
| ------- | -------------- |
| Server helper | `getRequestLocale()` resolves per request (React `cache()`); RSCs translate via `getNamespace`. |
| Root layout | `<html lang={locale}>` + mounts the provider with SERIALIZABLE data only (locale + metadata — catalogs contain functions and never cross the RSC boundary; the client provider imports them itself). |
| Client provider | `components/i18n-provider.tsx` exposes `useI18n()` (`t`, `setUserLocale` with optimistic rollback, `router.refresh()` reconciliation, `document.documentElement.lang` sync). |
| Cookie | 7f-locale (HttpOnly) prevents first-paint mismatch; mirror only, never authority. |
| Middleware | Untouched. Optional cookie/header normalization remains a future option. **Never** route rewriting, never Prisma. |

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

## 9. Settings (implemented)

### User-level setting

Account Center → **Language / Idioma** section
(`components/account-center/language-preference-control.tsx`). Values: English,
Español, Deutsch (native names, never translated — `LOCALE_DISPLAY_NAMES`).
Behavior: `PUT /api/users/me/locale` persists `User.locale` (self-scoped), the
route mirrors the 7f-locale cookie after success, the provider applies the
change optimistically (rollback on failure) and `router.refresh()` re-renders
Server Components. A **"Use the workspace language" / "Usar el idioma del
negocio"** action clears the preference (`locale: null` → cookie deleted) so
resolution follows the workspace again; the following-the-business state stays
visually explicit. The whole Account Center chrome renders from
`settings.accountCenter` (P4.1) — the first fully localized surface.

### Workspace-level setting

Administración → **Workspace language** section (`WorkspaceLanguageSection` in
`components/administracion-content.tsx`, fed server-side by
`app/administracion/page.tsx`). Reuses `PUT /api/workspaces/[id]/locale`
(admin-gated — the endpoint stays the authority; non-admins see a read-only
control). Changes ONLY `Workspace.config.locale`: personal preferences are
untouched; members without one adopt the new fallback on refresh. Language
never implies currency, country or timezone.

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
5. **Locale resolver helper** — ✅ Landed (`core/i18n/{resolve,cookie,server}.ts`
   + `resolve.test.ts`).
6. **Client i18n provider** — ✅ Landed (`components/i18n-provider.tsx`, root
   layout `<html lang>`, cookie bridge `app/api/i18n/locale`).
7. **Settings language controls** — ✅ Landed (Account Center Language section +
   Administración Workspace language, both on the existing endpoints).
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

*Reference map. The locale-resolution/provider/settings entries below have
landed (P3): `core/i18n/{resolve,cookie,server}.ts`, `components/i18n-provider.tsx`,
`app/api/i18n/locale/route.ts`, the Account Center language control and the
Administración workspace-language section. `middleware.ts` was NOT modified.*

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

## 16b. Five official locales (P4.CORE-5L)

**7F is multilingual by Core design** — verticals (Finesse, Property, Build,
Clean, Hospitality, Kontor…) contribute vocabulary and their own namespaces,
never their own language runtime.

### Registry

`core/i18n/types.ts` → `SupportedLocale = "es" | "en" | "de" | "fr" | "it"`
(canonical presentation order) plus `LOCALE_REGISTRY` with per-locale
metadata: native name (Español/English/Deutsch/Français/Italiano — never
translated), `direction` (all ltr today; contract kept), the default REGIONAL
**Intl locale** (es-ES / en-GB / de-DE / fr-FR / it-IT) and the catalog
fallback (en terminal, acyclic — tested). **Translation locale ("de") ≠ format
locale ("de-CH")**: regional variants share the base catalog but format
through their own Intl tag.

### Catalog fallback per namespace + coverage

Locale files export `LocaleCatalogOverrides` — ONLY fully-translated
namespaces, each complete against its typed contract (no `any`, no casts, no
partial objects, no empty strings, no English copies). `ui/index.ts` composes
`English base + contribution`, so `getUIMessages` always returns a complete
`UIMessages` for all five locales and components never check keys.
`UI_NAMESPACE_COVERAGE` is **derived** from the contributions (cannot lie) and
`localeHasPendingCoverage` powers the discreet "Translation in progress" hint
in the language settings. Current real coverage: `en` complete; `es` native
except `calendar`/`billing`; `de`/`fr`/`it` registered + fully pending
(honest English fallback). The legacy `TranslationSet` (emails/notifications)
serves en/es/de natively and fr/it as explicit English fallback whose
`.locale` states the content language (ack `<html lang>` follows it).

### Regional formatters

`core/i18n/format.ts`: `toIntlLocale`, `formatDate/Time/DateTime`,
`formatNumber`, `formatPercent`, `formatCurrency`, `formatRelativeTime`.
Pure, Intl-native, server/client safe. Currency, timezone and `now` are
EXPLICIT inputs — never inferred from the language (Spanish UI + CHF, German
UI + EUR, French UI + GBP are first-class). Unknown locales fall back to the
registry default of `en` (en-GB — never a universal en-US).

### Vocabulary precedence (five layers)

workspace explicit override → localized vertical preset (by effective locale,
regional variants normalized) → base vertical preset (English) → locale
catalog fallback → English. `LOCALIZED_BUSINESS_PRESETS` is keyed by
`SupportedLocale`; validity comes from the single `isValidLocale` source; the
resolver has no vertical-specific logic. Standard Finesse stays
Cliente/Clientes (es) / Client/Clients (en); de/fr/it use the English base
until reviewed sector variants exist. Workspace `ui.labels` overrides win
under any language (still not visible to the client-side sidebar summary —
known limitation).

### Three language axes (do not collapse)

1. **User language** (`User.locale`, nullable = follow the business) — the
   member's private interface.
2. **Workspace language** (`Workspace.config.locale`) — the business default.
3. **Client communication language** (future: WhatsApp, reminders, campaigns,
   email, web, chatbot, voice) — per-client/per-conversation; today only
   `Conversation.detectedLanguage` exists for AI replies. `Client.locale` is
   deliberately NOT added yet (no consumer), and the `I18nProvider` locale
   must never be used as an automatic outbound-communication language.

## 16c. How to add a locale, a namespace, or a vertical

**A locale:** add its `LOCALE_REGISTRY` entry + the `SupportedLocale` union
member; add a legacy `TranslationSet` when email content is translated (else
it falls back honestly); create `core/i18n/ui/<code>/` files ONLY for fully
translated namespaces and register the contribution in `LOCALE_OVERRIDES`;
run `test:i18n` — registry, parity, coverage and fallback tests enforce the
rest. Controls pick the new locale up automatically from the registry.

**A namespace:** define its interface in `ui/types.ts`, add the complete
English file, register it in `UIMessages` + `en/index.ts`; translate per
locale by adding the file to that locale's contribution (coverage updates
itself). Nouns come from vocabulary args, never keys; user data is never
translated; enum persisted values never change.

**A vertical:** map its keys in `mapVerticalKeyToBusinessType`, add a base
(English) preset in `BUSINESS_PRESETS` and per-locale variants in
`LOCALIZED_BUSINESS_PRESETS`; surfaces compose nouns via
`composeEntityLabel`/`useClientsNouns`-style hooks. The Core owns runtime,
registry, fallback, controls, formatters, types and tests — the vertical only
brings vocabulary, its namespaces and sector content.

### Known formatting debt (audited P4.CORE-5L)

~80 files still call `Intl.*`/`toLocale*` directly with literal locales
("en-US", "es-MX", "de-CH", "es-ES"). Migrate opportunistically to
`core/i18n/format.ts`. **Finesse Marketing is DONE (P4.MARKETING-5L):**
`components/marketing/*` and `modules/marketing/*` carry no literal locales —
scheduled dates and audience numbers go through `formatDateTime`/`formatNumber`
and editorial weekdays derive from Intl via `toIntlLocale`.

### Vertical namespace precedent — Finesse Marketing (P4.MARKETING-5L)

`modules/marketing/i18n/` is the reference implementation of a VERTICAL
namespace on top of the Core runtime: a typed `BeautyMarketingMessages`
contract with five complete catalogs (es/en/de/fr/it, `satisfies`-validated,
no English fallback inside the namespace — `parseLocale` only catches invalid
external locales), counted phrases as typed functions, localized draft
templates (`buildDraftPostFromWork`), localized product-owned demo content
(`MarketingDemoContent` → `demo-data.ts` owns only structure), and integrity
tests (`modules/marketing/i18n.test.ts`) enforcing parity, no empty strings,
no English copies and the banned `Clienta/Clientas` vocabulary. Components
consume the catalog resolved from the effective `useI18n()` locale — no second
resolution, no navigator/cookie reads.

## 17. Recommended next step

PRs 1–7 plus P4.1 have landed: the locale runtime is functional end to end, the
Spanish catalog exists (`core/i18n/ui/es/*`, typed parity with English enforced
by test), `settings`/`common` are really translated, the Account Center and the
Administración chrome render fully localized, and operators can follow the
business language again ("Usar el idioma del negocio"). Still pending inside
`es`: `nav`, `today`, `clients`, `calendar`, `billing` carry English values
until their surfaces are wired. `de` still falls back to English entirely.
P4.2 landed the Finesse SHELL: real Spanish `nav`/`globalSearch`/`globalNew`/
`today` catalogs, the `composeEntityLabel` bridge in `core/personalization`
(vocabulary noun wins, locale catalog is the generic fallback — Clientas/
Agenda/Mensajes/Cobros are never hardcoded in the shared catalog), the
Beauty nav profile now declares label SOURCES (entity/nav bindings; literals
are fallback/brand only), and the sidebar (desktop+mobile), search/New/Today
triggers and panel chromes render from the catalog. Known remaining hardcodes
(documented, next blocks): the default 7F Core nav (module-baked, non-reactive
— structural issue reported), global-search dialog interior (result groups,
quick links, example chips), New ITEM labels (need entity+gender composition,
e.g. "Nueva clienta"), Today peek body copy, notifications bell, and the
vertical profile's Spanish `helper` subtitles. P4.2.1 made vertical vocabulary LOCALE-AWARE (localized presets; workspace
`ui.labels` is the only explicit-personalization layer; standard Finesse is
neutral Cliente/Clientes). P4.3 landed the full **/clientes journey**: the
`clients` namespace covers list/detail/form with grammar-safe full-phrase
functions (lowercase noun args, per-locale capitalization), the shared
`useClientsNouns()` hook composes entity nouns once for the whole surface,
and the list page, detail page and client form render entirely from
catalog + vocabulary (persisted enum values untouched; DB/user content never
translated; dates follow the effective locale). Known remaining in that
journey (documented): project/invoice status badge labels still come from the
shared English enum maps (they belong to the Projects/Billing domains),
currency formatting is hardcoded es/CHF (functional bug, out of i18n scope),
and Spanish structure words keep masculine agreement under feminine workspace
overrides. Next: **P4.4 — Today and Agenda labels** (§11), then Cobros.
