"use client"

import { useMemo, useState, type CSSProperties } from "react"\nimport { DEFAULT_DESIGN_CONTRACT, type DesignContract } from "@/core/design/contracts"\nimport { PALETTES, paletteById } from "@/core/design/presets"
import "./design-lab.css"

type ThemeKey =
  | "midnight"
  | "north-sea"
  | "petrol-pearl"
  | "rose-nude"
  | "sage-luxe"
  | "noir-or"
  | "lavender-mist"

const THEMES: Array<{ key: ThemeKey; label: string; note: string; swatch: string }> = [
  { key: "midnight", label: "Midnight", note: "Índigo profundo", swatch: "#16112A" },
  { key: "north-sea", label: "North Sea", note: "Navy azul", swatch: "#08131F" },
  { key: "petrol-pearl", label: "Petrol Pearl", note: "Finesse", swatch: "#145F7B" },
  { key: "rose-nude", label: "Rose Nude", note: "Finesse cálido", swatch: "#C15E7B" },
  { key: "sage-luxe", label: "Sage Luxe", note: "Finesse natural", swatch: "#5E8C5E" },
  { key: "noir-or", label: "Noir / Or", note: "Editorial", swatch: "#B8924B" },
  { key: "lavender-mist", label: "Lavender Mist", note: "Claro suave", swatch: "#9470FF" },
]

const NORTH_SEA_STYLE = {
  "--app-canvas": "#07121D",
  "--app-sidebar": "#091724",
  "--app-sidebar-surface": "#0D2130",
  "--app-surface-dark": "#0B1C2A",
  "--app-surface-dark-elevated": "#102839",
  "--app-surface-dark-hover": "#153448",
  "--accent-primary": "#2AA9D6",
  "--accent-primary-hover": "#43BDE7",
  "--accent-on-dark": "#7AD5F3",
  "--accent-muted": "rgba(42, 169, 214, 0.16)",
  "--accent-muted-border": "rgba(82, 196, 235, 0.34)",
  "--accent-soft": "#D9F3FC",
  "--accent-rich": "#147698",
  "--text-primary-light": "#F1F8FB",
  "--text-secondary-light": "#9DB7C6",
  "--text-tertiary-light": "#6F8A9A",
  "--text-primary-dark": "#11222C",
  "--text-secondary-dark": "#5D7482",
  "--border-dark": "rgba(158, 213, 235, 0.10)",
  "--border-dark-strong": "rgba(158, 213, 235, 0.18)",
  "--background": "#07121D",
  "--foreground": "#F1F8FB",
  "--card": "#0B1C2A",
  "--card-foreground": "#F1F8FB",
  "--popover": "#102839",
  "--popover-foreground": "#F1F8FB",
  "--primary": "#2AA9D6",
  "--primary-foreground": "#05131D",
  "--secondary": "rgba(255,255,255,0.06)",
  "--secondary-foreground": "#F1F8FB",
  "--muted": "rgba(255,255,255,0.04)",
  "--muted-foreground": "#9DB7C6",
  "--accent": "rgba(255,255,255,0.06)",
  "--accent-foreground": "#F1F8FB",
  "--border": "rgba(158, 213, 235, 0.10)",
  "--input": "rgba(158, 213, 235, 0.12)",
  "--ring": "rgba(42, 169, 214, 0.38)",
} as CSSProperties

const SURFACES = [
  { name: "Quiet", className: "design-lab-surface-quiet", use: "Contenido que necesita respirar" },
  { name: "Glass", className: "design-lab-surface-glass", use: "Paneles contextuales" },
  { name: "Glass Strong", className: "design-lab-surface-glass-strong", use: "Foco y decisión" },
  { name: "Tinted", className: "design-lab-surface-tinted", use: "Atmósfera de marca" },
  { name: "Elevated", className: "design-lab-surface-elevated", use: "Operación importante" },
  { name: "Luminous", className: "design-lab-surface-luminous", use: "IA, selección y estado activo" },
]

function SevenefWordmark() {
  return (
    <div className="relative inline-flex items-center">
      <span className="text-[1.05rem] font-medium tracking-[0.34em] text-[var(--text-primary-light)] sm:text-xl">
        SEVENEF
      </span>
      <span className="pointer-events-none absolute left-[-2%] top-1/2 h-px w-[104%] -translate-y-1/2 bg-gradient-to-r from-transparent via-[var(--accent-on-dark)] to-transparent shadow-[0_0_16px_var(--accent-primary)]" />
    </div>
  )
}

function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border-dark)] bg-white/[0.035] p-4 backdrop-blur-xl">
      <div className="text-2xl font-semibold tracking-tight text-[var(--text-primary-light)]">{value}</div>
      <div className="mt-1 text-xs text-[var(--text-secondary-light)]">{label}</div>
    </div>
  )
}

export default function DesignLabPage() {
  const [theme, setTheme] = useState<ThemeKey>("north-sea")\n  const [contract, setContract] = useState<DesignContract>(DEFAULT_DESIGN_CONTRACT)

  const rootStyle = useMemo<CSSProperties>(
    () => (theme === "north-sea" ? NORTH_SEA_STYLE : {}),
    [theme],
  )

  return (
    <main
      data-theme={theme === "north-sea" ? undefined : theme}
      data-lab-theme={theme}
      style={rootStyle}
      className="min-h-screen overflow-hidden bg-[var(--app-canvas)] text-[var(--text-primary-light)]"
    >
      <div className="pointer-events-none fixed inset-0 opacity-90">
        <div className="absolute -left-32 -top-40 h-[520px] w-[520px] rounded-full bg-[var(--accent-muted)] blur-[120px]" />
        <div className="absolute right-[-180px] top-[12%] h-[560px] w-[560px] rounded-full bg-[var(--accent-muted)] opacity-70 blur-[150px]" />
        <div className="absolute bottom-[-260px] left-[30%] h-[560px] w-[560px] rounded-full bg-[var(--accent-muted)] opacity-50 blur-[160px]" />
      </div>

      <div className="relative mx-auto max-w-[1680px] px-4 py-5 sm:px-6 lg:px-10">
        <header className="design-lab-surface-glass flex flex-col gap-5 rounded-[28px] border px-5 py-5 sm:px-7 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <SevenefWordmark />
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-secondary-light)]">
              Premium Surface + Motion Lab — una superficie aislada para decidir color, profundidad,
              transparencia, glow y movimiento antes de llevarlos al SaaS.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {THEMES.map((item) => {
              const active = item.key === theme
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => { setTheme(item.key); const match = PALETTES.find((p) => p.id === item.key || (item.key === "petrol-pearl" && p.id === "petrol")); if (match) setContract((current) => ({ ...current, palette: { family: match.id, mode: match.mode } })) }}
                  className={[
                    "group flex items-center gap-2 rounded-full border px-3 py-2 text-left transition-all duration-300",
                    active
                      ? "border-[var(--accent-primary)] bg-[var(--accent-muted)] shadow-[0_0_24px_var(--accent-muted)]"
                      : "border-[var(--border-dark)] bg-white/[0.025] hover:border-[var(--accent-muted-border)] hover:bg-white/[0.045]",
                  ].join(" ")}
                >
                  <span
                    className="h-4 w-4 rounded-full border border-white/15 shadow-inner"
                    style={{ background: item.swatch }}
                  />
                  <span>
                    <span className="block text-[11px] font-medium text-[var(--text-primary-light)]">{item.label}</span>
                    <span className="hidden text-[9px] text-[var(--text-secondary-light)] sm:block">{item.note}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </header>

        <section className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="design-lab-surface-glass-strong rounded-[30px] border p-6 sm:p-8">
            <div className="text-[10px] uppercase tracking-[0.32em] text-[var(--accent-on-dark)]">
              01 · Brand atmosphere
            </div>
            <h1 className="mt-4 max-w-xl text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
              SevenEF debe sentirse premium también después de entrar.
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-[var(--text-secondary-light)]">
              Esta pantalla no toca datos ni operaciones. Solo nos deja comparar el lenguaje visual real
              sobre una estructura de producto: capas, surfaces, IA, estados y overview.
            </p>

            <div className="mt-8 overflow-hidden rounded-[24px] border border-[var(--border-dark)] bg-black/10 p-5">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.28em] text-[var(--text-secondary-light)]">
                <span>SevenEF signature</span>
                <span>{THEMES.find((item) => item.key === theme)?.label}</span>
              </div>
              <div className="relative mt-8 flex h-24 items-center justify-center">
                <SevenefWordmark />
                <span className="design-lab-line-reveal absolute left-[12%] right-[12%] top-1/2 h-px bg-gradient-to-r from-transparent via-[var(--accent-primary)] to-transparent shadow-[0_0_20px_var(--accent-primary)]" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {SURFACES.map((surface, index) => (
              <article
                key={surface.name}
                className={[
                  surface.className,
                  surface.name === "Luminous" ? "design-lab-luminous-sweep" : "",
                  "min-h-[180px] rounded-[26px] border p-5 transition-transform duration-300 hover:-translate-y-1",
                ].join(" ")}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-[0.28em] text-[var(--text-secondary-light)]">
                    0{index + 1}
                  </span>
                  <span className="h-2 w-2 rounded-full bg-[var(--accent-primary)] shadow-[0_0_12px_var(--accent-primary)]" />
                </div>
                <h2 className="mt-8 text-lg font-medium">{surface.name}</h2>
                <p className="mt-2 text-xs leading-5 text-[var(--text-secondary-light)]">{surface.use}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="design-lab-surface-glass mt-5 rounded-[30px] border p-5 sm:p-7">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.32em] text-[var(--accent-on-dark)]">
                02 · Product overview
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">Command center, no pared de tarjetas.</h2>
            </div>
            <div className="text-xs text-[var(--text-secondary-light)]">Preview visual · sin datos reales</div>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="design-lab-surface-tinted rounded-[26px] border p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.28em] text-[var(--accent-on-dark)]">Hoy</div>
                  <div className="mt-2 text-3xl font-semibold tracking-tight">Todo bajo control.</div>
                  <div className="mt-2 text-sm text-[var(--text-secondary-light)]">
                    Lo importante primero. El resto aparece cuando lo necesitas.
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:min-w-[320px]">
                  <MiniStat value="12" label="Mensajes nuevos" />
                  <MiniStat value="4" label="Citas" />
                  <MiniStat value="3" label="Necesitan atención" />
                  <MiniStat value="2" label="Próximos pasos" />
                </div>
              </div>

              <div className="mt-6 grid gap-3 lg:grid-cols-3">
                <div className="design-lab-surface-glass rounded-2xl border p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Smart Inbox</span>
                    <span className="text-xs text-[var(--accent-on-dark)]">Ver →</span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {["Luna · nueva consulta", "Nora · respondió", "Equipo · seguimiento"].map((item, i) => (
                      <div key={item} className="flex items-center gap-3 border-b border-white/[0.05] pb-3 last:border-0 last:pb-0">
                        <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--accent-muted)] text-[10px] text-[var(--accent-on-dark)]">
                          {i + 1}
                        </span>
                        <span className="text-xs text-[var(--text-secondary-light)]">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="design-lab-surface-glass rounded-2xl border p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Agenda</span>
                    <span className="text-xs text-[var(--accent-on-dark)]">Hoy</span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {["09:00 · Primera cita", "11:30 · Revisión", "15:00 · Seguimiento"].map((item) => (
                      <div key={item} className="rounded-xl bg-white/[0.035] px-3 py-3 text-xs text-[var(--text-secondary-light)]">
                        {item}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="design-lab-surface-glass rounded-2xl border p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Atención</span>
                    <span className="h-2 w-2 rounded-full bg-[var(--accent-primary)] shadow-[0_0_12px_var(--accent-primary)]" />
                  </div>
                  <div className="mt-4 space-y-3 text-xs text-[var(--text-secondary-light)]">
                    <div>Confirmación pendiente</div>
                    <div>Una conversación lleva 18 h esperando</div>
                    <div>Revisar propuesta antes de las 16:00</div>
                  </div>
                </div>
              </div>
            </div>

            <aside className="design-lab-surface-luminous design-lab-luminous-sweep rounded-[26px] border p-5 sm:p-6">
              <div className="flex items-center gap-4">
                <div className="design-lab-orb h-14 w-14 rounded-full border border-[var(--accent-muted-border)] bg-[var(--accent-muted)]" />
                <div>
                  <div className="text-[10px] uppercase tracking-[0.28em] text-[var(--accent-on-dark)]">SevenEF AI</div>
                  <div className="mt-1 text-lg font-medium">3 cosas merecen tu atención.</div>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {[
                  "Responder una consulta con intención de reserva",
                  "Hay espacio libre a las 15:30",
                  "Una clienta puede necesitar seguimiento",
                ].map((item, i) => (
                  <div key={item} className="rounded-2xl border border-white/[0.06] bg-black/10 p-4">
                    <div className="text-[10px] text-[var(--accent-on-dark)]">0{i + 1}</div>
                    <div className="mt-1 text-sm leading-6 text-[var(--text-secondary-light)]">{item}</div>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <section className="mt-5 grid gap-4 lg:grid-cols-3">
          <article className="design-lab-surface-glass rounded-[26px] border p-5">
            <div className="text-[10px] uppercase tracking-[0.28em] text-[var(--accent-on-dark)]">03 · Motion</div>
            <h3 className="mt-3 text-lg font-medium">Reveal, no espectáculo.</h3>
            <div className="relative mt-8 h-20 overflow-hidden rounded-2xl border border-[var(--border-dark)] bg-black/10">
              <span className="design-lab-line-reveal absolute left-[12%] right-[12%] top-1/2 h-px bg-[var(--accent-primary)] shadow-[0_0_18px_var(--accent-primary)]" />
            </div>
          </article>

          <article className="design-lab-surface-glass rounded-[26px] border p-5">
            <div className="text-[10px] uppercase tracking-[0.28em] text-[var(--accent-on-dark)]">04 · AI state</div>
            <h3 className="mt-3 text-lg font-medium">La luz comunica estado.</h3>
            <div className="mt-7 flex items-center gap-4">
              <div className="design-lab-orb h-12 w-12 rounded-full border border-[var(--accent-muted-border)] bg-[var(--accent-muted)]" />
              <div>
                <div className="text-sm font-medium">Analizando</div>
                <div className="mt-1 text-xs text-[var(--text-secondary-light)]">Movimiento lento, claro y controlado.</div>
              </div>
            </div>
          </article>

          <article className="design-lab-surface-luminous design-lab-luminous-sweep rounded-[26px] border p-5">
            <div className="text-[10px] uppercase tracking-[0.28em] text-[var(--accent-on-dark)]">05 · Selected</div>
            <h3 className="mt-3 text-lg font-medium">Una pasada de luz. Después, calma.</h3>
            <button
              type="button"
              className="mt-7 w-full rounded-2xl border border-[var(--accent-muted-border)] bg-[var(--accent-muted)] px-4 py-3 text-sm font-medium text-[var(--text-primary-light)] transition"
            >
              Estado seleccionado
            </button>
          </article>
        </section>

        <section className="design-lab-surface-glass mt-5 rounded-[30px] border p-5 sm:p-7">\n          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">\n            <div><div className="text-[10px] uppercase tracking-[0.28em] text-[var(--accent-on-dark)]">Design Contract · live</div><h3 className="mt-2 text-xl font-medium">Una decisión visual, un contrato reutilizable.</h3><p className="mt-2 text-xs text-[var(--text-secondary-light)]">SevenEF y Presence podrán consumir el mismo lenguaje sin copiar CSS.</p></div>\n            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">\n              <div className="rounded-xl border border-[var(--border-dark)] bg-white/[0.03] px-3 py-2"><span className="block text-[var(--text-secondary-light)]">Palette</span>{paletteById(contract.palette.family).name}</div>\n              <div className="rounded-xl border border-[var(--border-dark)] bg-white/[0.03] px-3 py-2"><span className="block text-[var(--text-secondary-light)]">Surface</span>{contract.surfaces.default}</div>\n              <div className="rounded-xl border border-[var(--border-dark)] bg-white/[0.03] px-3 py-2"><span className="block text-[var(--text-secondary-light)]">Shape</span>{contract.shape.radius}</div>\n              <div className="rounded-xl border border-[var(--border-dark)] bg-white/[0.03] px-3 py-2"><span className="block text-[var(--text-secondary-light)]">Motion</span>{contract.motion.reveal}</div>\n            </div>\n          </div>\n        </section>\n\n        <footer className="mt-5 flex flex-col gap-2 border-t border-[var(--border-dark)] px-1 py-6 text-xs text-[var(--text-secondary-light)] sm:flex-row sm:items-center sm:justify-between">
          <span>SevenEF Premium Surface + Motion Lab</span>
          <span>Rama aislada · no modifica producción</span>
        </footer>
      </div>
    </main>
  )
}
