import type { DesignContract } from "./contracts"

export type ComparisonSection = Exclude<keyof DesignContract, "version" | "pagePreset">
export type DesignDifference = {
  section: ComparisonSection
  label: string
  reference: string
  working: string
}

/** Copy a validated contract without sharing mutable objects with the editor. */
export function captureDesignReference(contract: DesignContract): DesignContract {
  return {
    ...contract,
    brand: { ...contract.brand },
    palette: { ...contract.palette },
    typography: { ...contract.typography },
    shape: { ...contract.shape },
    surfaces: { ...contract.surfaces },
    effects: { ...contract.effects },
    motion: { ...contract.motion },
  }
}

// Compare visual decisions, not the selected preview page or viewport. Adding a
// new contract section requires an explicit comparison rule at compile time.
const SECTIONS: Record<ComparisonSection, { label: string; describe: (c: DesignContract) => string }> = {
  brand: { label: "Brand", describe: c => JSON.stringify({ name: c.brand.name.trim(), logo: c.brand.logoRef ?? null }) },
  palette: { label: "Palette", describe: c => `${c.palette.family === "petrol" ? "petrol-night" : c.palette.family} / ${c.palette.mode}` },
  typography: { label: "Typography", describe: c => `${c.typography.display} / ${c.typography.body} / ${c.typography.mono ?? "system-mono"} / ${c.typography.scale}` },
  density: { label: "Density", describe: c => c.density },
  shape: { label: "Shape", describe: c => `${c.shape.radius} / ${c.shape.border}` },
  surfaces: { label: "Surfaces", describe: c => `general: ${c.surfaces.default}; focus: ${c.surfaces.focus}; operational: ${c.surfaces.operational}` },
  effects: { label: "Effects", describe: c => `glow: ${c.effects.glow}; blur: ${c.effects.blur}; shadow: ${c.effects.shadow}` },
  motion: { label: "Motion", describe: c => `reveal: ${c.motion.reveal}; panels: ${c.motion.panel}; assistant: ${c.motion.ai}` },
  componentPreset: { label: "Components", describe: c => c.componentPreset },
}

/** Human-readable differences; no persistence, rendering, AI or product imports. */
export function compareDesignChoices(reference: DesignContract, working: DesignContract): DesignDifference[] {
  return (Object.keys(SECTIONS) as ComparisonSection[]).flatMap(section => {
    const rule = SECTIONS[section]
    const before = rule.describe(reference), after = rule.describe(working)
    return before === after ? [] : [{ section, label: rule.label, reference: before, working: after }]
  })
}

/** Adopt A as B while keeping the working preview context. Never mutate A. */
export function applyDesignReference(reference: DesignContract, working: DesignContract): DesignContract {
  const next = captureDesignReference(reference)
  if (working.pagePreset === undefined) delete next.pagePreset
  else next.pagePreset = working.pagePreset
  return next
}
