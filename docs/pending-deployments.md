# Pending deployments & operational backlog

> Status board for work that is **committed to `master` but not yet live**, plus
> planned moves that were documented but never executed. Update this file in the
> same commit that resolves an item. Audit date: 2026-07-17.

## Why this file exists

`master` auto-deploys the **app code** (Vercel), but three kinds of work do NOT
ship automatically and were silently accumulating:

1. **Manual ops steps** — DB schema pushes (`prisma/push-turso.ts`), one-off
   `scripts/migrate-*.ts` runs, seeders, and env vars must be executed/configured
   by hand against production.
2. **Half-wired features** — backend landed, UI/consumption not built yet.
3. **Documented "next moves"** — decisions written in `docs/product/*` that no
   commit ever implemented.

Rule going forward (see "Workflow rule" at the bottom): any commit that needs a
manual step to be live MUST add a row to §1 here, and the row is only removed
when the step has been run against production.

---

## 1. Manual ops steps pending against production

| # | Item | What to run | Status |
|---|------|-------------|--------|
| 1 | `User.locale` column (commit `77876f4`) | `tsx prisma/push-turso.ts` with `TURSO_*` credentials | ⬜ NOT applied (commit message explicitly says "not performed here") |
| 2 | Finesse demo workspace seeder (commits `3999b1d`…`30c549e`) | `npm run demo:finesse:discover` → `dry-run` → `seed` with `--workspace-id`, `--owner`, `FINESSE_DEMO_CONFIRM=SEED:<id>` | ⬜ never run |
| 3 | Voice Lab env gate | Set `VOICE_LAB_ENABLED=true` + `OPENAI_API_KEY` in the env where you want to test (NOT prod per `.env.example`) | ⬜ unset |
| 4 | Schema drift check: `ForteSnapshot`, `ClientAsset`, `ClientRequest`, `ClientRequestAsset` exist in `schema.prisma` but have **no CREATE TABLE** in `push-turso.ts` nor any `scripts/migrate-*.ts` | Verify tables exist in Turso; if missing, add CREATE blocks to `push-turso.ts` and run it | ⬜ unverified |

## 2. Half-wired features (backend landed, consumption missing)

| Feature | Landed | Missing |
|---------|--------|---------|
| i18n personal locale | `User.locale` schema + policy (`core/i18n/user-locale.ts`) + `GET/PUT /api/users/me/locale` + tests | Locale resolution chain (PR5), client provider (PR6), Settings UI (PR7), actual es/de messages (PR8–11) — `es`/`de` currently alias to English (`core/i18n/ui/index.ts`) |
| Beauty "Hoy" appointment_first | Layout + Rose Nude skin + gate helper `shouldActivateVerticalToday()` | Real appointment backend (`modules/today/appointments.ts` is explicit: mock only); pack flag `activateRealForRealWorkspaces` still `false` |
| Finesse specialist voice | Data + resolver (`core/vertical-packs/specialists.ts`) | Surfaces don't render the voice yet (by design, still pending) |

## 3. Documented moves never executed

From `docs/product/7f-professional-direction-audit.md` §10 and
`docs/product/beauty-brand-web-i18n-architecture.md`:

| Move | Status |
|------|--------|
| Move 2 — hide demo/legacy surfaces from primary nav (`/finanzas`, `/entrada`, `/comunicacion`, `/identidad`, `/departamentos`, `/motor`) | ⬜ still promoted in `components/sidebar-nav.tsx` |
| Move 4 (currency half) — coherent workspace currency; today CHF (`app/facturacion/*`), MXN (`components/client-billing-tab.tsx`), USD (`core/dashboard/priority-actions.ts`) coexist | ⬜ |
| Move 5 — consolidate `/agente`, `/assistant`, `/motor` overlaps | ⬜ |
| 7F Clear light theme (`data-theme="clear"`) | ⬜ |
| Brand kit per workspace / palette-from-logo / public website | ⬜ (roadmap) |
| Theme: Lavender Mist light QA, remaining `dark:` variant migration, `global-search` chrome tokens | ⬜ (deferred in theme plan docs) |

## 4. Doc debt

- `docs/i18n-localization-architecture.md` is stale: it claims `User.locale`
  does not exist, but PR2–PR4 of its own sequence are implemented. Update its
  "current state" section when touching i18n next.

---

## Workflow rule (review → push → review, extended)

1. **Before push**: if the change needs any manual step to be live (schema,
   seed, env var, cron), add it to §1 of this file **in the same commit**.
2. **Push** to `master` as usual (Vercel deploys code automatically).
3. **After push (second review)**: run the pending ops step(s), verify in
   production, then remove the row here in a follow-up commit. A row older
   than a few days means something is silently not deployed.
4. Schema changes: every `schema.prisma` edit must ship its matching
   CREATE/ALTER in `prisma/push-turso.ts` in the same commit (idempotent),
   and `push-turso.ts` must actually be run — the run is the §1 row's exit
   condition.
