"use client"

import { useState, type CSSProperties } from "react"
import { Check, Play, Layers } from "lucide-react"
import type { DesignContract, PreviewContext } from "../../core/design/contracts"
import { FONT_STACKS, MOTION_PRESETS, PALETTES, RADIUS_PRESETS, SURFACE_PRESETS, TYPOGRAPHY_PRESETS, paletteById } from "../../core/design/presets"
import { DESIGN_RECIPES } from "../../core/design/recipes"
import { contrastRatio, onAccentColor, resolveDesignTokens } from "../../core/design/resolve"
import styles from "./lab.module.css"

export const SECTIONS = ["Brand", "Color", "Typography", "Surfaces", "Shape", "Effects", "Motion", "Components", "Page patterns", "Design recipes", "Export"] as const
export type Section = typeof SECTIONS[number]
export type ChangeContract = (update: (current: DesignContract) => DesignContract) => void

function RecipeSample({ kind, play }: { kind: string; play: number }) {
  return <svg key={play} className={styles.recipeSvg} viewBox="0 0 240 110" fill="none" role="img" aria-label={kind === "hair-growth" ? "Illustrative hair-growth vector" : "Line-drawing example"}>
    {kind === "hair-growth" ? <>
      <path d="M100 40 C100 15 140 15 140 40 C140 65 130 70 120 76 C110 70 100 60 100 40" stroke="var(--fd-muted)" strokeWidth="2" />
      {["M109 24 C73 22 104 66 59 101", "M118 22 C72 32 110 84 77 103", "M130 25 C165 27 129 77 169 103", "M137 31 C179 55 153 82 189 101"].map((d,i) => <path key={d} pathLength="1" className="fd-draw" style={{ animationDelay: `${i * 120}ms` }} d={d} stroke="var(--fd-accent)" strokeWidth="3" strokeLinecap="round" />)}
    </> : <path pathLength="1" className="fd-draw" d="M20 75 H62 V35 H98 V75 H135 V35 H180 V75 H220" stroke="var(--fd-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
  </svg>
}

export default function Controls({ section, contract, change, setContext, replay, paused }: {
  section: Section; contract: DesignContract; change: ChangeContract; setContext: (context: PreviewContext) => void; replay: () => void; paused: boolean
}) {
  const [surfaceRole, setSurfaceRole] = useState<keyof DesignContract["surfaces"]>("default")
  const [motionRole, setMotionRole] = useState<keyof DesignContract["motion"]>("reveal")
  const [recipeReplay, setRecipeReplay] = useState(0)
  const palette = paletteById(contract.palette.family)
  const vars = resolveDesignTokens({ ...contract, brand: { name: contract.brand.name.trim() || "Your brand" } }) as CSSProperties
  const action = (update: (c: DesignContract) => DesignContract) => { change(update); replay() }

  if (section === "Brand") return <div className={styles.controlStack}>
    <label className={styles.fieldLabel}>Product or business name<input maxLength={80} value={contract.brand.name} onChange={event => { const value = event.target.value; change(c => ({ ...c, brand: { ...c.brand, name: value } })) }} placeholder="Your brand" /></label>
    <p className={styles.hint}>This name updates all page previews. It does not rename a workspace or publish a website.</p>
    <div className={styles.note}><Layers size={18}/><strong>Logo / brand extraction</strong><p>Planned for the Presence adapter. No automatic logo analysis or external upload is enabled here.</p></div>
  </div>

  if (section === "Color") return <>
    <div className={styles.optionGrid}>{PALETTES.map(item => <button type="button" key={item.id} className={styles.option} aria-pressed={contract.palette.family === item.id} onClick={() => action(c => ({ ...c, palette: { family: item.id, mode: item.mode } }))}>
      <span className={styles.swatches}>{[item.colors.canvas,item.colors.surfaceStrong,item.colors.accent,item.colors.accent2,item.colors.text].map((color,i) => <i key={i} style={{ background: color }}/>)}</span>
      <strong>{item.name}</strong><small>{item.note}</small><span className={styles.optionMeta}>{item.mode} / {item.status === "candidate" ? "Lab candidate" : "Existing family"}</span>
      <span className={styles.paletteMini} style={{ background: item.colors.canvas, color: item.colors.text }}><span>A clear view.</span><i style={{ background: item.colors.accent, color: onAccentColor(item.colors.accent) }}>Continue</i></span>
      {contract.palette.family === item.id && <Check className={styles.selectedMark} size={14}/>}</button>)}</div>
    <div className={styles.note}><strong>How these colors work together</strong><p>{palette.guidance}</p><small>Text on base: {contrastRatio(palette.colors.text, palette.colors.canvas).toFixed(2)}:1. Button label: {contrastRatio(onAccentColor(palette.colors.accent), palette.colors.accent).toFixed(2)}:1.</small><p className={styles.hint}>Solid-color checks only. Transparency, images, focus states and the complete page still require visual review. Existing production themes are unchanged.</p></div>
  </>

  if (section === "Typography") return <div className={styles.controlStack}>{TYPOGRAPHY_PRESETS.map(item => <button type="button" key={item.id} className={styles.option} aria-pressed={contract.typography.display === item.typography.display && contract.typography.scale === item.typography.scale} onClick={() => action(c => ({ ...c, typography: { ...item.typography } }))}>
    <span className={styles.typeSample} style={{ fontFamily: FONT_STACKS[item.typography.display as keyof typeof FONT_STACKS] }}>Aa / 012</span><strong>{item.name}</strong><small>{item.note}</small>
  </button>)}<p className={styles.hint}>Uses Inter when available and system serif/mono fallbacks. No paid fonts or external font downloads are introduced.</p></div>

  if (section === "Surfaces") return <>
    <label className={styles.fieldLabel}>Apply to<select value={surfaceRole} onChange={e => setSurfaceRole(e.target.value as keyof DesignContract["surfaces"])}><option value="default">General cards</option><option value="focus">Focus / assistant card</option><option value="operational">Operational panels</option></select></label>
    <div className={`${styles.optionGrid} fd-scope`} style={vars}>{SURFACE_PRESETS.map(item => <button type="button" key={item.id} className={styles.option} aria-pressed={contract.surfaces[surfaceRole] === item.id} onClick={() => action(c => ({ ...c, surfaces: { ...c.surfaces, [surfaceRole]: item.id } }))}>
      <span className={`${styles.surfaceSample} fd-surface`} data-surface={item.id}><span>09:30</span><small>Next appointment</small></span><strong>{item.name}</strong><small>{item.note}</small>
    </button>)}</div>
  </>

  if (section === "Shape") return <div className={styles.controlStack}>
    <div className={styles.optionGrid}>{Object.entries(RADIUS_PRESETS).map(([id, radius]) => <button key={id} type="button" className={styles.option} aria-pressed={contract.shape.radius === id} onClick={() => change(c => ({ ...c, shape: { ...c.shape, radius: id as DesignContract["shape"]["radius"], border: id === "borderless" ? "none" : c.shape.border } }))}><span className={styles.shapeSample} style={{ borderRadius: radius }} /><strong>{id.replaceAll("-", " ")}</strong><small>{radius} px / cards and controls</small></button>)}</div>
    <label className={styles.fieldLabel}>Border<select value={contract.shape.border} onChange={e => { const border = e.target.value as DesignContract["shape"]["border"]; change(c => ({ ...c, shape: { ...c.shape, border } })) }}>{["hairline","soft","none"].map(x => <option key={x}>{x}</option>)}</select></label>
    <label className={styles.fieldLabel}>Density<select value={contract.density} onChange={e => { const density = e.target.value as DesignContract["density"]; change(c => ({ ...c, density })) }}>{["compact","balanced","spacious"].map(x => <option key={x}>{x}</option>)}</select></label>
  </div>

  if (section === "Effects") return <div className={styles.controlStack}>
    <label className={styles.fieldLabel}>Glow<select value={contract.effects.glow} onChange={e => { const glow = e.target.value as DesignContract["effects"]["glow"]; change(c => ({ ...c, effects: { ...c.effects, glow } })) }}>{["off","subtle","medium"].map(x => <option key={x}>{x}</option>)}</select></label>
    <label className={styles.fieldLabel}>Glass blur<select value={contract.effects.blur} onChange={e => { const blur = e.target.value as DesignContract["effects"]["blur"]; change(c => ({ ...c, effects: { ...c.effects, blur } })) }}>{["off","soft","strong"].map(x => <option key={x}>{x}</option>)}</select></label>
    <label className={styles.fieldLabel}>Shadow<select value={contract.effects.shadow} onChange={e => { const shadow = e.target.value as DesignContract["effects"]["shadow"]; change(c => ({ ...c, effects: { ...c.effects, shadow } })) }}>{["flat","soft","deep"].map(x => <option key={x}>{x}</option>)}</select></label>
    <p className={styles.hint}>Effects change eligible surfaces, not every item. Glass has an opaque fallback when blur is unavailable.</p>
  </div>

  if (section === "Motion") return <>
    <label className={styles.fieldLabel}>Motion target<select value={motionRole} onChange={e => setMotionRole(e.target.value as keyof DesignContract["motion"])}><option value="reveal">Signature / reveal</option><option value="panel">Panels</option><option value="ai">Assistant state (Overview)</option></select></label>
    <div className={`${styles.optionGrid} fd-scope`} style={vars} data-motion-paused={paused}>{MOTION_PRESETS.map(item => <button type="button" className={styles.option} key={item.id} aria-pressed={contract.motion[motionRole] === item.id} onClick={() => action(c => ({ ...c, motion: { ...c.motion, [motionRole]: item.id } }))}><span className={styles.motionSample} key={`${item.id}-${contract.motion[motionRole]}`}><i data-motion={item.id} /></span><strong>{item.name}</strong><small>{item.note}</small></button>)}</div>
    <button className={styles.secondaryButton} type="button" onClick={replay}><Play size={14}/> Replay preview</button><p className={styles.hint}>Samples run once or for two slow cycles. Pause and system reduced-motion preferences always take priority. Hover Lift responds to pointer or keyboard focus.</p>
  </>

  if (section === "Components") return <div className={styles.note}><strong>Check the real component states</strong><p>Primary, secondary and disabled buttons; focus rings; text fields; selects; and a contained sample dialog.</p><button className={styles.secondaryButton} type="button" onClick={() => setContext("components")}>Open component playground</button><p className={styles.hint}>These are working demo controls, not production actions.</p></div>
  if (section === "Page patterns") return <div className={styles.controlStack}>{(["landing","dashboard","presence","components"] as PreviewContext[]).map(item => <button className={styles.option} key={item} type="button" onClick={() => setContext(item)}><strong>{item === "dashboard" ? "Overview" : item}</strong><small>Same contract, different page context.</small></button>)}</div>
  if (section === "Design recipes") return <div className={`${styles.controlStack} fd-scope`} style={vars} data-motion-paused={paused}>{DESIGN_RECIPES.map(recipe => <article key={recipe.id} className={styles.note}><strong>{recipe.name}</strong><span className={styles.optionMeta}>{recipe.status === "sample" ? "Working SVG sample" : "Idea / not implemented"}</span>{recipe.status === "sample" && <><RecipeSample kind={recipe.id} play={recipeReplay}/><button className={styles.secondaryButton} type="button" onClick={() => setRecipeReplay(n => n + 1)}><Play size={14}/> Replay SVG</button></>}<p>{recipe.use}</p><small>{recipe.mechanism}</small><p className={styles.hint}>Assets: {recipe.assets}</p></article>)}</div>
  return null
}
