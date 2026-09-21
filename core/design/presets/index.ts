import type { DesignContract, DesignMotionPreset, DesignSurfacePreset } from "@/core/design/contracts"

export type PalettePreset = {
  id: string
  name: string
  note: string
  mode: DesignContract["palette"]["mode"]
  colors: {
    canvas: string
    surface: string
    surfaceStrong: string
    text: string
    muted: string
    accent: string
    accent2: string
    border: string
  }
}

export const PALETTES: PalettePreset[] = [
  { id: "midnight", name: "Midnight", note: "Profundo · premium · operacional", mode: "dark", colors: { canvas:"#151126",surface:"#211a3a",surfaceStrong:"#2c2448",text:"#f2eeff",muted:"#b8aed0",accent:"#8b5cff",accent2:"#c4b2ff",border:"rgba(255,255,255,.11)" } },
  { id: "north-sea", name: "North Sea", note: "Tecnología · confianza · precisión", mode: "dark", colors: { canvas:"#07151d",surface:"#0d2530",surfaceStrong:"#123542",text:"#edf8fa",muted:"#9db8bf",accent:"#56c5d0",accent2:"#9de5e7",border:"rgba(157,229,231,.16)" } },
  { id: "petrol", name: "Petrol", note: "Finesse · elegante · contemporáneo", mode: "dark", colors: { canvas:"#07191b",surface:"#0d292b",surfaceStrong:"#123638",text:"#f1fbfa",muted:"#a9c4c1",accent:"#4fb9b4",accent2:"#b4e3dc",border:"rgba(180,227,220,.16)" } },
  { id: "rose-nude", name: "Rose Nude", note: "Suave · beauty · editorial", mode: "light", colors: { canvas:"#fbf6f5",surface:"#fffafa",surfaceStrong:"#f3e5e2",text:"#35292b",muted:"#806c70",accent:"#b87882",accent2:"#d9a9ae",border:"rgba(90,55,62,.13)" } },
  { id: "sage-luxe", name: "Sage Luxe", note: "Natural · calmado · sofisticado", mode: "light", colors: { canvas:"#f4f6f0",surface:"#fbfcf8",surfaceStrong:"#e4e9dd",text:"#263128",muted:"#687568",accent:"#758d72",accent2:"#b4c2a8",border:"rgba(50,70,50,.13)" } },
  { id: "noir-or", name: "Noir / Or", note: "Lujo · contraste · presencia", mode: "dark", colors: { canvas:"#0c0c0d",surface:"#171719",surfaceStrong:"#222225",text:"#f7f3e8",muted:"#b9b2a2",accent:"#c7a75a",accent2:"#ead79b",border:"rgba(234,215,155,.16)" } },
]

export const TYPOGRAPHY_PRESETS = [
  { id:"product", name:"Product Sans", display:"Inter / Sans", note:"Producto digital limpio" },
  { id:"editorial", name:"Editorial Contrast", display:"Serif + Sans", note:"Presencia y lujo" },
  { id:"technical", name:"Technical", display:"Grotesk + Mono", note:"Tecnología y precisión" },
] as const

export const SURFACE_PRESETS: { id: DesignSurfacePreset; name: string; note: string }[] = [
  { id:"quiet", name:"Quiet", note:"Jerarquía sin caja visible" },
  { id:"glass", name:"Glass", note:"Transparencia ligera" },
  { id:"glass-strong", name:"Glass Strong", note:"Más separación y blur" },
  { id:"tinted", name:"Tinted", note:"Superficie teñida por la marca" },
  { id:"elevated", name:"Elevated", note:"Profundidad operacional" },
  { id:"luminous", name:"Luminous", note:"Foco, IA y selección" },
]

export const MOTION_PRESETS: { id: DesignMotionPreset; name: string; note: string }[] = [
  { id:"fade-reveal", name:"Fade Reveal", note:"Entrada sobria" },
  { id:"center-reveal", name:"Center Reveal", note:"Aparece desde el centro" },
  { id:"line-reveal", name:"Line Reveal", note:"Firma lineal SevenEF" },
  { id:"panel-depth", name:"Panel Depth", note:"Panel con profundidad" },
  { id:"hover-lift", name:"Hover Lift", note:"Respuesta ligera" },
  { id:"ai-breathe", name:"AI Breathe", note:"Estado activo de IA" },
]

export function paletteById(id: string) {
  return PALETTES.find((palette) => palette.id === id) ?? PALETTES[1]
}
