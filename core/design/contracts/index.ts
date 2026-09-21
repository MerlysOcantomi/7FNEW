export type DesignThemeMode = "dark" | "light" | "adaptive"

export type DesignDensity = "compact" | "balanced" | "spacious"
export type DesignRadiusPreset = "precise" | "soft" | "rounded-premium" | "editorial" | "borderless"
export type DesignSurfacePreset = "quiet" | "glass" | "glass-strong" | "tinted" | "elevated" | "luminous"
export type DesignMotionPreset =
  | "fade-reveal"
  | "center-reveal"
  | "line-reveal"
  | "panel-depth"
  | "hover-lift"
  | "ai-breathe"

export type PreviewContext = "landing" | "dashboard" | "presence"
export type PreviewViewport = "desktop" | "tablet" | "mobile"

export type DesignContract = {
  version: "0.1"
  brand: {
    name: string
    logoRef?: string
  }
  palette: {
    family: string
    mode: DesignThemeMode
  }
  typography: {
    display: string
    body: string
    mono?: string
    scale: "compact" | "standard" | "editorial"
  }
  density: DesignDensity
  shape: {
    radius: DesignRadiusPreset
    border: "hairline" | "soft" | "none"
  }
  surfaces: {
    default: DesignSurfacePreset
    focus: DesignSurfacePreset
    operational: DesignSurfacePreset
  }
  effects: {
    glow: "off" | "subtle" | "medium"
    blur: "off" | "soft" | "strong"
    shadow: "flat" | "soft" | "deep"
  }
  motion: {
    reveal: DesignMotionPreset
    panel: DesignMotionPreset
    ai: DesignMotionPreset
  }
  componentPreset: "sevenef-premium"
  pagePreset?: string
}

export const DEFAULT_DESIGN_CONTRACT: DesignContract = {
  version: "0.1",
  brand: { name: "SevenEF" },
  palette: { family: "north-sea", mode: "dark" },
  typography: {
    display: "inter",
    body: "inter",
    mono: "geist-mono",
    scale: "standard",
  },
  density: "balanced",
  shape: { radius: "rounded-premium", border: "hairline" },
  surfaces: {
    default: "glass",
    focus: "luminous",
    operational: "elevated",
  },
  effects: { glow: "subtle", blur: "soft", shadow: "soft" },
  motion: {
    reveal: "line-reveal",
    panel: "panel-depth",
    ai: "ai-breathe",
  },
  componentPreset: "sevenef-premium",
}
