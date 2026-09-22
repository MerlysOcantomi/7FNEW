# SESSION 7F-DESIGN-01.2 - Reference / working design comparison

Base reviewed: `e19c6246b3a833a019f3cf4a102f378a9acccf84`.
Working branch: `codex/sevenef-premium-design-system`; PR #37 stays draft.
Status: implemented and unit-tested; browser integration and owner visual approval are still required.

## Why this iteration

The previous iteration already connected palette, type, surface roles, shape,
density and effects to the preview. Local save/restore and JSON/CSS export also
exist. This work builds on that implementation rather than replacing it.

The Lab now supports comparing a captured reference A against working design B.
For example, keep North Sea as A and explore a petrol direction as B. Both use
the same preview context, layout width and motion preference.

## Behavior

- Capture A from a validated design; later mutations of B cannot mutate A.
- Switch A/B in the current Landing, Overview, Presence or Components page.
- The reference does not change the editor controls. Editing returns to B.
- Changing the preview page or viewport keeps the A/B selection; page choice is
  not counted as a visual difference.
- The difference list explains changes in brand, palette, typography, density,
  shape, surfaces, effects, motion and component preset.
- Replacing an existing A and adopting A as B require confirmation.
- Adopting A keeps the working preview page and does not save/publish automatically.
- A is temporary memory in the current tab. Reloading clears it. Existing Save
  and Export always operate on B, and the interface states that explicitly.
- No CSS values, production theme keys or existing palettes are changed.

## Visual reference

The owner supplied a Finesse salon-entry reference with deep petrol, warm
lighting and clean foreground contrast. It is a direction to evaluate for
Finesse, not a mandate to recolor sevenef or every vertical. No screenshot was
inserted as a fake working UI or published as a public asset in this iteration.
Fonts, final logo artwork and cinematic assets remain separate approval items.

## Checks actually run

- Strict TypeScript compilation of the comparison module, its tests and the
  existing contract type: passed.
- Eleven comparison unit tests: passed, zero failures.
- TSX syntax/transpilation of both touched client components: passed. This is
  not a full React/Next.js typecheck.
- New CSS Module parsed with PostCSS: passed.
- Local baseline contract and client file were matched to the Git blob hashes
  before edits; no older client implementation was substituted.

The current execution container cannot resolve github.com to install the full
app and its dependencies. Full repository lint/typecheck/build and live-browser
interaction checks have not been run here. A green Vercel deployment is NOT
claimed. The earlier 16 core tests were not rerun in this comparison-only check.

## Acceptance checks for the configured workspace

```sh
npx tsx --test core/design/design.test.ts core/design/comparison.test.ts
npx eslint core/design app/design-lab
npm run typecheck
npm run build
```

Open `/design-lab`: capture North Sea A; select Petrol Night B; verify A/B uses
identical page and viewport; inspect differences; edit while viewing A; save B;
restore B; confirm replacing A; cancel adopting A; adopt A and confirm B remains
unsaved unless it equals the local saved draft. Test light palettes, keyboard,
expanded preview, mobile layout, reduced motion, and local JSON export/import.

## Boundaries

Only design helpers, Lab UI and this record change. No database/schema,
authentication, DNS, environment, workflow or production settings are touched.
No new dependency, network call, AI usage or automatic publishing is added.
This is still one reusable Foundation core with product consumers, not another
standalone technical copy of Presence or sevenef.
