import { DEFAULT_DESIGN_CONTRACT, type DesignContract } from "./contracts"
import {
  APP_LUXE_DETAILS,
  APP_LUXE_THEME_KEYS,
  isAppLuxeThemeKey,
  type AppLuxeThemeKey,
} from "./luxe-palettes"
import { resolveDesignTokens } from "./resolve"

export function applicationLuxeContract(key: AppLuxeThemeKey): DesignContract {
  if (!isAppLuxeThemeKey(key)) throw new Error("Unsupported application luxe theme")
  return {
    ...DEFAULT_DESIGN_CONTRACT,
    brand: { name: "Finesse" },
    palette: { family: key, mode: "dark" },
  }
}

export function resolveApplicationLuxeTokens(key: AppLuxeThemeKey): Record<string, string> {
  if (!isAppLuxeThemeKey(key)) throw new Error("Unsupported application luxe theme")
  const f = resolveDesignTokens(applicationLuxeContract(key))
  const d = APP_LUXE_DETAILS[key]

  const aliases: Record<string, string> = {
    "--app-canvas": f["--fd-canvas"],
    "--app-sidebar": d.rail,
    "--app-sidebar-surface": f["--fd-surface"],
    "--app-surface-dark": f["--fd-surface"],
    "--app-surface-dark-elevated": f["--fd-strong"],
    "--app-surface-dark-hover": d.rail,
    "--accent-primary": f["--fd-accent"],
    "--accent-primary-hover": d.hover,
    "--accent-on-dark": f["--fd-accent-text"],
    "--accent-soft": f["--fd-surface"],
    "--accent-rich": f["--fd-accent-text"],
    "--accent-muted": f["--fd-wash"],
    "--accent-muted-border": f["--fd-border"],
    "--text-primary-light": f["--fd-text"],
    "--text-secondary-light": f["--fd-muted"],
    "--text-tertiary-light": f["--fd-muted"],
    "--border-dark": f["--fd-border"],
    "--border-dark-strong": f["--fd-border"],
    "--app-surface-subtle": f["--fd-wash"],
    "--app-surface-hover": "rgba(229, 196, 147, 0.07)",
    "--app-surface-active": "rgba(229, 196, 147, 0.12)",
    "--app-control-radius": "10px",
    "--app-shadow-subtle": f["--fd-shadow"],
    "--premium-glow": `color-mix(in srgb, ${d.glow} 15%, transparent)`,
    "--premium-edge": d.glow,
    "--premium-metal": d.metal,
    "--premium-glass": f["--fd-glass"],
    "--premium-panel-fill": `linear-gradient(150deg, ${f["--fd-strong"]} 0%, ${f["--fd-surface"]} 82%)`,
    "--premium-highlight": "inset 0 1px 0 rgba(248, 242, 232, 0.09)",
    "--premium-control-fill": `linear-gradient(180deg, ${f["--fd-accent"]}, ${d.hover})`,
    "--premium-duration": "180ms",
    "--inbox-list-selected-bg": f["--fd-wash"],
    "--inbox-chat-bubble-outbound": f["--fd-accent"],
    "--inbox-chat-bubble-outbound-gradient": `linear-gradient(142deg, ${f["--fd-accent"]}, ${d.hover})`,
    "--inbox-chat-bubble-outbound-shadow": "rgba(4, 15, 20, 0.24)",
    "--inbox-chat-bubble-outbound-shadow-hover": "rgba(4, 15, 20, 0.32)",
    "--inbox-chat-meta-outbound-bg": d.rail,
    "--inbox-chat-meta-outbound-border": f["--fd-border"],
    "--inbox-chat-meta-outbound-text": f["--fd-text"],
    "--inbox-chat-bubble-inbound": f["--fd-surface"],
    "--inbox-chat-bubble-inbound-hover": f["--fd-strong"],
    "--inbox-chat-bubble-inbound-border": f["--fd-border"],
    "--inbox-composer-input": d.rail,
    "--inbox-composer-toolbar": f["--fd-wash"],
    "--inbox-voice-compose-border": f["--fd-border"],
    "--inbox-unread-color": f["--fd-accent-text"],
    "--inbox-focus": f["--fd-accent-text"],
    "--inbox-focus-soft": f["--fd-wash"],
    "--inbox-archive-color": f["--fd-muted"],
    "--inbox-spam-color": f["--fd-muted"],
    "--inbox-border": f["--fd-border"],
    "--inbox-divider": "rgba(229, 196, 147, 0.10)",
    "--inbox-list-divider": "rgba(229, 196, 147, 0.10)",
    "--inbox-shadow-card": f["--fd-shadow"],
  }

  const refs: Record<string, string> = {
    "--background": "--app-canvas", "--foreground": "--text-primary-light",
    "--card": "--app-surface-dark", "--card-foreground": "--text-primary-light",
    "--popover": "--app-surface-dark-elevated", "--popover-foreground": "--text-primary-light",
    "--primary": "--accent-primary", "--primary-foreground": "--fd-on-accent",
    "--secondary": "--app-surface-hover", "--secondary-foreground": "--text-primary-light",
    "--muted": "--app-surface-subtle", "--muted-foreground": "--text-secondary-light",
    "--accent": "--app-surface-hover", "--accent-foreground": "--text-primary-light",
    "--border": "--border-dark", "--input": "--border-dark-strong", "--ring": "--premium-edge",
    "--surface": "--app-surface-dark", "--surface-elevated": "--app-surface-dark-elevated",
    "--surface-muted": "--app-canvas", "--surface-card": "--app-surface-dark",
    "--surface-card-foreground": "--text-primary-light", "--surface-card-border": "--border-dark",
    "--surface-selected": "--accent-muted", "--surface-hover": "--app-surface-hover",
    "--surface-overlay": "--app-surface-dark-elevated", "--surface-overlay-foreground": "--text-primary-light",
    "--surface-overlay-muted": "--text-secondary-light", "--surface-overlay-border": "--border-dark",
    "--app-shell-bg": "--app-canvas", "--app-sidebar-bg": "--app-sidebar",
    "--app-sidebar-text": "--text-primary-light", "--app-sidebar-text-muted": "--text-secondary-light",
    "--app-sidebar-border": "--border-dark", "--app-accent": "--accent-primary",
    "--app-accent-hover": "--accent-primary-hover", "--border-strong": "--border-dark-strong",
    "--sidebar": "--app-sidebar", "--sidebar-foreground": "--text-primary-light",
    "--sidebar-primary": "--accent-primary", "--sidebar-primary-foreground": "--primary-foreground",
    "--sidebar-accent": "--app-surface-active", "--sidebar-accent-foreground": "--text-primary-light",
    "--sidebar-border": "--border-dark", "--sidebar-ring": "--ring",
    "--shadow-soft": "--app-shadow-subtle", "--shadow-strong": "--fd-shadow",
    "--inbox-background": "--app-canvas", "--inbox-sidebar-dark": "--app-sidebar",
    "--inbox-sidebar-darker": "--app-sidebar", "--inbox-sidebar-text": "--text-primary-light",
    "--inbox-sidebar-text-secondary": "--text-secondary-light", "--inbox-sidebar-accent": "--accent-primary",
    "--inbox-sidebar-border": "--border-dark", "--inbox-list-background": "--app-surface-dark",
    "--inbox-list-surface": "--app-surface-dark-elevated", "--inbox-list-border": "--border-dark",
    "--inbox-list-text": "--text-primary-light", "--inbox-list-text-secondary": "--text-secondary-light",
    "--inbox-list-selected": "--accent-primary", "--inbox-chat-background": "--app-canvas",
    "--inbox-chat-surface": "--app-surface-dark-elevated", "--inbox-chat-text": "--text-primary-light",
    "--inbox-chat-text-secondary": "--text-secondary-light", "--inbox-chat-border": "--border-dark",
    "--inbox-composer-background": "--app-surface-dark-elevated", "--inbox-composer-input-text": "--text-primary-light",
    "--inbox-composer-placeholder": "--text-secondary-light", "--inbox-intelligence-background": "--app-surface-dark",
    "--inbox-intelligence-surface": "--app-surface-dark-elevated", "--inbox-intelligence-accent": "--accent-primary",
    "--inbox-intelligence-text": "--text-primary-light", "--inbox-intelligence-text-secondary": "--text-secondary-light",
    "--inbox-intelligence-border": "--border-dark", "--inbox-surface": "--inbox-chat-surface",
    "--inbox-surface-elevated": "--inbox-list-surface", "--inbox-card": "--inbox-surface-elevated",
    "--inbox-text": "--text-primary-light", "--inbox-text-secondary": "--text-secondary-light",
    "--inbox-muted": "--text-secondary-light", "--inbox-accent": "--accent-primary",
    "--inbox-accent-hover": "--accent-primary-hover", "--inbox-accent-soft": "--accent-muted",
    "--inbox-accent-rich": "--accent-on-dark", "--inbox-voice-compose-bg": "--accent-muted",
    "--inbox-voice-compose-text": "--accent-on-dark", "--status-info-bg": "--accent-muted",
    "--status-info-text": "--accent-on-dark", "--status-accent-bg": "--accent-muted",
    "--status-accent-text": "--accent-on-dark", "--status-neutral-bg": "--app-surface-subtle",
    "--status-neutral-text": "--text-secondary-light", "--scrollbar-thumb": "--border-dark-strong",
    "--scrollbar-thumb-hover": "--accent-muted-border",
  }

  return {
    ...f,
    ...aliases,
    ...Object.fromEntries(Object.entries(refs).map(([name, target]) => [name, `var(${target})`])),
  }
}

export function applicationLuxeStyles(): string {
  return APP_LUXE_THEME_KEYS.map((key) => {
    const declarations = Object.entries(resolveApplicationLuxeTokens(key))
      .map(([name, value]) => `  ${name}: ${value};`)
      .join("\n")
    return `:root[data-theme="${key}"], [data-theme="${key}"] {\n${declarations}\n}\n`
  }).join("\n")
}
