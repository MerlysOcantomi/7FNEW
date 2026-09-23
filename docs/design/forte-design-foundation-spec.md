# Forte Design Foundation — Product & Implementation Spec

Status: working specification
Initial host repo: `MerlysOcantomi/7FNEW`
Initial branch: `codex/sevenef-premium-design-system`
First consumers: SevenEF SaaS + Presence
Future home: FORTE-FOUNDATION as a reusable package/module

## 1. Product definition

Forte Design Foundation is a reusable visual-system engine and design builder.

It is NOT only a documentation site and NOT only a set of CSS tokens.

It has two layers:

1. **Design Foundation Core** — reusable design primitives, schemas, presets and contracts.
2. **Design Lab** — an interactive visual builder where a person can choose design decisions and see a live preview.

SevenEF is the first full consumer. Presence is the first major page-generation consumer.

## 2. Primary jobs

The system must support these jobs:

- define a product visual language before implementation
- derive usable palettes from a brand/logo
- recommend combinations instead of isolated colors
- select typography, surfaces, shape, motion and effects
- preview choices in realistic product/page contexts
- save the result as a versioned Design Contract
- let SevenEF, Presence and future products consume that contract
- export reusable tokens/config without duplicating CSS
- preserve reusable visual ideas as Design Recipes

## 3. Design Lab navigation

The first Design Lab should contain these sections:

### 3.1 Brand
Inputs:
- product/business name
- optional logo
- product type / industry
- desired character: premium, technological, elegant, warm, natural, minimal, editorial, energetic
- existing brand colors (optional)

Outputs:
- brand profile
- source colors
- recommended direction
- optional brand-derived palette candidates

### 3.2 Color
Purpose: choose a complete color relationship, not a single color.

Show:
- existing SevenEF/Finesse palette families
- primary / secondary / accent / neutral / status colors
- light and dark companions where available
- usage guidance
- contrast status
- combinations: e.g. blue + pearl, blue + cyan, blue + gold, blue + coral
- mini page preview for every palette

Initial families:
- Midnight
- North Sea / Navy
- Petrol
- Rose
- Sage
- Noir / Gold
- Lavender / Pearl

Keep existing canonical palettes; modernize them through the new surface system.

### 3.3 Typography
Controls:
- display family
- body family
- mono/technical family
- scale
- weight rhythm
- letter spacing
- density

Show typography in:
- hero
- product title
- body
- label
- button
- KPI / numbers
- code/technical state

### 3.4 Layout & Density
Controls:
- content width
- spacing scale
- compact / balanced / spacious density
- grid
- section rhythm
- navigation density

### 3.5 Shape
Controls:
- corner radius family
- pill usage
- border thickness
- divider style
- icon container shape

Presets:
- precise
- soft
- rounded premium
- editorial
- borderless

### 3.6 Surfaces
Canonical surface roles:
- quiet
- glass
- glass-strong
- tinted
- elevated
- luminous

For each:
- live card
- hover
- selected
- disabled
- AI-working
- warning/success example
- recommended use / avoid guidance

### 3.7 Light, Depth & Effects
Controls:
- shadow depth
- inner highlight
- blur
- glow strength
- gradient intensity
- ambient radial light
- noise/grid texture
- focus ring

Rule: effects must be controlled and stateful, never decorative overload.

### 3.8 Motion
Motion primitives:
- fade reveal
- center reveal
- SevenEF line reveal
- panel open / depth fade
- hover lift
- selected glow pass
- AI thinking/breathe
- success settle
- SVG draw
- organic growth
- assembly
- morph

Every motion:
- Play / Replay
- duration
- easing
- intensity
- reduced-motion fallback
- usage recommendation

### 3.9 Iconography
Define:
- icon family/style
- stroke weight
- size scale
- active state
- icon containers
- branded icon exceptions

Avoid generic AI sparkle iconography as a default visual shorthand.

### 3.10 Imagery & Illustration
Define:
- photography tone
- crop style
- overlays
- illustration style
- background art
- character treatment
- image radius and framing

### 3.11 Components
Preview and choose patterns for:
- buttons
- chips
- inputs
- selects
- tabs
- cards
- nav
- modal
- drawer
- table/list
- empty state
- toast
- pricing
- AI state
- chatbot
- search
- calendar/event item

Components consume semantic Design Foundation tokens.

### 3.12 Page Patterns
Realistic preview canvases:
- Landing
- Product Overview / Dashboard
- Login / Signup
- Pricing
- Presence public site
- Customer portal
- Mobile view

A user should be able to switch preview context without losing the selected Design Contract.

### 3.13 AI / Agent States
Patterns for:
- idle
- listening
- thinking
- drafting
- tool/action running
- needs approval
- complete
- error

Motion and light communicate state without becoming distracting.

### 3.14 Brand Motion
Patterns for:
- logo reveal
- favicon-to-wordmark
- intro/outro
- loading mark
- transition mark

SevenEF first recipe:
dark canvas -> favicon/signature -> line extends -> wordmark reveals -> glow settles.

### 3.15 Design Recipes
Reusable creative techniques, stored separately from low-level tokens.

Initial recipe taxonomy:
- Reveal
- Draw
- Growth
- Assembly
- Morph
- Depth / Parallax
- Material / Particle
- Character
- Logo Motion

Each recipe stores:
- idea
- best uses
- assets required
- implementation technique
- motion primitives used
- example preview
- reusable code/template reference

Examples:
- Hair Growth — SVG path/mask animation for extensions/hair businesses
- Ink Reveal — ink line/material reveals logo or tattoo composition
- Assembly — objects organize into final identity
- Eye Reveal — eyes open and reveal interface
- Thread Draw — thread draws garment/wordmark
- Blueprint Build — technical lines assemble product/interface

### 3.16 Live Preview
Permanent preview area.

Modes:
- desktop
- tablet
- mobile

Contexts:
- landing
- dashboard
- pricing
- login
- Presence
- customer portal

Every change in the builder updates the preview immediately.

### 3.17 Design Contract
All choices resolve into a versioned serializable contract.

Example shape:

```ts
type DesignContract = {
  version: string
  brand: {
    name: string
    logoRef?: string
  }
  palette: {
    family: string
    mode: "dark" | "light" | "adaptive"
  }
  typography: {
    display: string
    body: string
    mono?: string
    scale: string
  }
  density: string
  shape: {
    radius: string
    border: string
  }
  surfaces: {
    default: string
    focus: string
    operational: string
  }
  effects: {
    glow: string
    blur: string
    shadow: string
  }
  motion: {
    reveal: string
    panel: string
    ai: string
  }
  componentPreset: string
  pagePreset?: string
}
```

The UI never hardcodes product colors where a semantic contract token exists.

### 3.18 Export & Consume
Initial exports:
- JSON Design Contract
- CSS variables
- Tailwind-compatible token map
- TypeScript config

Consumers:
- SevenEF SaaS
- Presence
- Finesse
- Oloju
- Scholara
- future products

Later:
- downloadable design documentation
- reusable component package
- v0 generation brief derived from Design Contract

## 4. Modes

### Guided Mode
For non-designers:
- choose style/industry
- receive 2–3 coherent visual directions
- adjust only high-value controls
- preview continuously

### Pro Mode
For SevenEF/Forte/agency work:
- tokens
- opacity
- radius
- blur
- glow
- shadow
- easing
- duration
- scale
- component-level variants

V1 can begin with Pro Mode internally while preserving the data model for Guided Mode.

## 5. Brand Adapter

For Presence and public pages:

If logo exists:
1. extract candidate colors
2. classify usable roles
3. generate neutrals/surfaces
4. verify contrast
5. produce 2–3 suggested Design Contracts

If no logo:
1. use industry + desired character
2. propose curated palette families
3. preview them
4. save selection

Never blindly apply raw logo colors to every surface.

## 6. First-consumer rules

### SevenEF SaaS
- premium operational UI
- dark/navy first impression
- restrained motion
- glass/elevated/luminous surfaces
- business branding only as subtle accent

### Presence
- business brand dominates
- Design Contract drives generation/rendering
- page structure/content remain Presence responsibilities
- chatbot, CTA, booking, forms and modules use the same visual contract

## 7. Code boundaries in 7FNEW

Build the first version with clean extraction boundaries:

```
core/design/
  contracts/
  palettes/
  typography/
  layout/
  shape/
  surfaces/
  effects/
  motion/
  iconography/
  recipes/
  brand/
  presets/

app/design-lab/
  components/
  previews/
  page.tsx

engines/presence/
  design-adapter/
```

Rules:
- `core/design` contains no Mr. Forte onboarding copy, no SevenEF page layout and no Finesse-specific business logic.
- `app/design-lab` is the interactive editor/preview shell.
- product-specific presets live in adapters/presets, not in primitives.

## 8. Implementation phases

### Phase A — Design Foundation skeleton
- create type-safe Design Contract
- create palette registry
- create typography registry
- create surface registry
- create motion registry
- create preset registry

### Phase B — Interactive Design Lab V1
- left-side section navigation
- center/left controls
- persistent live preview
- desktop/tablet/mobile switch
- local state first
- no database dependency required for first visual iteration

### Phase C — Core previews
- Landing
- Dashboard/Overview
- Presence
- Login
- Pricing

### Phase D — Save/version
- persist named Design Contracts
- duplicate/version
- compare
- restore

### Phase E — Presence adapter
- feed contract into Presence renderer/generator
- logo-derived brand palette
- chatbot/component styling

### Phase F — Extraction
- once stable, move reusable `core/design` into FORTE-FOUNDATION
- keep consumer adapters in their products
- change imports without changing visual output

## 9. V1 acceptance criteria

The first usable Design Lab is complete when:

- user can switch among at least Midnight, North Sea, Petrol, Rose and Sage
- user can choose typography pair
- user can choose surface family
- user can choose shape/radius preset
- user can choose at least 5 motion primitives
- selections update a realistic preview live
- preview switches between Landing and Dashboard
- desktop/tablet/mobile preview exists
- current selection is serializable as one Design Contract
- no production route is visually changed by the Lab
- reduced motion is respected
- no hardcoded white-card wall
- no dependency on live customer data
