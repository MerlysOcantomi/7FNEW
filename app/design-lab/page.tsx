"use client"

import { useMemo, useState, type CSSProperties } from "react"
import {
  Check,
  ChevronRight,
  Monitor,
  Smartphone,
  Tablet,
  WandSparkles,
} from "lucide-react"

import {
  DEFAULT_DESIGN_CONTRACT,
  type DesignContract,
  type DesignSurfacePreset,
  type PreviewContext,
  type PreviewViewport,
} from "@/core/design/contracts"
import {
  MOTION_PRESETS,
  PALETTES,
  SURFACE_PRESETS,
  TYPOGRAPHY_PRESETS,
  paletteById,
} from "@/core/design/presets"

import "./design-lab.css"

const SECTIONS = [
  "Brand",
  "Color",
  "Typography",
  "Surfaces",
  "Shape",
  "Motion",
  "Components",
  "Page patterns",
  "Design recipes",
  "Export",
] as const

type Section = (typeof SECTIONS)[number]

const RADIUS_PRESETS = [
  { id: "precise", label: "Precise", note: "Técnico y contenido" },
  { id: "soft", label: "Soft", note: "Amable y profesional" },
  { id: "rounded-premium", label: "Rounded premium", note: "Más suave y editorial" },
  { id: "borderless", label: "Borderless", note: "Contenido sin contenedor visible" },
] as const

function designVars(contract: DesignContract): CSSProperties {
  const palette = paletteById(contract.palette.family)
  return {
    "--lab-canvas": palette.colors.canvas,
    "--lab-surface": palette.colors.surface,
    "--lab-strong": palette.colors.surfaceStrong,
    "--lab-text": palette.colors.text,
    "--lab-muted": palette.colors.muted,
    "--lab-accent": palette.colors.accent,
    "--lab-accent-2": palette.colors.accent2,
    "--lab-border": palette.colors.border,
  } as CSSProperties
}

function Preview({
  contract,
  context,
  viewport,
}: {
  contract: DesignContract
  context: PreviewContext
  viewport: PreviewViewport
}) {
  const vars = designVars(contract)
  const width = viewport === "desktop" ? "100%" : viewport === "tablet" ? "760px" : "390px"
  const radius =
    contract.shape.radius === "precise"
      ? "8px"
      : contract.shape.radius === "soft"
        ? "16px"
        : contract.shape.radius === "borderless"
          ? "0px"
          : "24px"

  return (
    <div className="lab-device" style={{ ...vars, width }}>
      <div
        className={[
          "lab-preview",
          `motion-${contract.motion.reveal}`,
          `density-${contract.density}`,
        ].join(" ")}
        style={{ borderRadius: radius }}
      >
        <header className="lab-preview-nav">
          <div className="lab-wordmark">
            <span>SEVEN</span>
            <b>EF</b>
            <i />
          </div>
          <nav>
            <span>Producto</span>
            <span>Presence</span>
            <span>Recursos</span>
          </nav>
          <button type="button">Entrar</button>
        </header>

        {context === "landing" && (
          <main className="lab-hero">
            <div className="lab-kicker">
              <span />
              FORTE DESIGN FOUNDATION
            </div>
            <h1>
              Una identidad visual que <em>se comporta</em> como tu producto.
            </h1>
            <p>Color, tipografía, superficies y movimiento trabajando como un solo sistema.</p>
            <div className="lab-actions">
              <button type="button">
                Explorar sistema <ChevronRight size={16} />
              </button>
              <button type="button" className="secondary">
                Ver Presence
              </button>
            </div>

            <div className="lab-hero-panels">
              <article className={`surface-${contract.surfaces.default}`}>
                <small>HOY</small>
                <strong>Tu negocio, bajo control.</strong>
                <p>3 citas · 2 mensajes · 1 acción importante</p>
              </article>
              <article className={`surface-${contract.surfaces.focus}`}>
                <small>FORTE</small>
                <strong>Todo está conectado.</strong>
                <p>He preparado la siguiente acción.</p>
                <div className="lab-ai-orb" />
              </article>
            </div>
          </main>
        )}

        {context === "dashboard" && (
          <main className="lab-dashboard">
            <div>
              <small>DOMINGO · 21 SEPTIEMBRE</small>
              <h2>Buenas noches.</h2>
              <p>Esto es lo que merece tu atención.</p>
            </div>
            <div className="lab-metrics">
              <article>
                <small>HOY</small>
                <strong>08</strong>
                <span>acciones</span>
              </article>
              <article>
                <small>MENSAJES</small>
                <strong>12</strong>
                <span>3 nuevos</span>
              </article>
              <article>
                <small>AGENDA</small>
                <strong>06</strong>
                <span>completadas</span>
              </article>
            </div>
            <article className={`lab-focus surface-${contract.surfaces.operational}`}>
              <div>
                <small>PRÓXIMO PASO</small>
                <h3>Confirma las citas de mañana</h3>
                <p>Forte encontró tres citas todavía sin confirmar.</p>
              </div>
              <button type="button">Revisar</button>
            </article>
          </main>
        )}

        {context === "presence" && (
          <main className="lab-presence">
            <small>BEAUTY STUDIO · MADRID</small>
            <h1>
              Tu tiempo también merece <em>Finesse.</em>
            </h1>
            <p>Reserva tu próxima cita en segundos.</p>
            <button type="button">Reservar ahora</button>
            <div className="lab-presence-image">
              <div>Presence</div>
              <span>Chat · Reservas · Tu marca</span>
            </div>
          </main>
        )}
      </div>
    </div>
  )
}

export default function DesignLabPage() {
  const [contract, setContract] = useState<DesignContract>(DEFAULT_DESIGN_CONTRACT)
  const [section, setSection] = useState<Section>("Color")
  const [context, setContext] = useState<PreviewContext>("landing")
  const [viewport, setViewport] = useState<PreviewViewport>("desktop")

  const palette = useMemo(
    () => paletteById(contract.palette.family),
    [contract.palette.family],
  )

  function patch(next: Partial<DesignContract>) {
    setContract((current) => ({ ...current, ...next }))
  }

  return (
    <main className="design-lab-shell">
      <aside className="lab-sidebar">
        <div className="lab-brand">
          <div className="lab-mark">
            <span />
            <span />
          </div>
          <div>
            <b>Forte Design</b>
            <small>FOUNDATION · LAB</small>
          </div>
        </div>

        <div className="lab-project">
          <small>PROYECTO ACTUAL</small>
          <strong>SevenEF</strong>
          <span>Design Contract v0.1</span>
        </div>

        <nav>
          {SECTIONS.map((item, index) => (
            <button
              key={item}
              type="button"
              className={section === item ? "active" : ""}
              onClick={() => setSection(item)}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              {item}
            </button>
          ))}
        </nav>

        <div className="lab-save">
          <span>
            <Check size={13} />
            Cambios locales
          </span>
          <small>Sin afectar producción</small>
        </div>
      </aside>

      <section className="lab-controls">
        <div className="lab-controls-head">
          <small>DESIGN FOUNDATION</small>
          <h1>{section}</h1>
          <p>Construye una decisión visual y compruébala inmediatamente en un producto real.</p>
        </div>

        {section === "Color" && (
          <div className="lab-option-grid">
            {PALETTES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`lab-option ${item.id === contract.palette.family ? "selected" : ""}`}
                onClick={() =>
                  patch({
                    palette: { family: item.id, mode: item.mode },
                  })
                }
              >
                <div className="lab-swatches">
                  {[
                    item.colors.canvas,
                    item.colors.surface,
                    item.colors.surfaceStrong,
                    item.colors.accent,
                    item.colors.accent2,
                  ].map((color) => (
                    <i key={color} style={{ background: color }} />
                  ))}
                </div>
                <strong>{item.name}</strong>
                <span>{item.note}</span>
                {item.id === contract.palette.family && <Check size={15} />}
              </button>
            ))}
          </div>
        )}

        {section === "Typography" && (
          <div className="lab-option-grid">
            {TYPOGRAPHY_PRESETS.map((item) => {
              const selected =
                (item.id === "product" && contract.typography.scale === "standard") ||
                (item.id === "editorial" && contract.typography.scale === "editorial") ||
                (item.id === "technical" && contract.typography.scale === "compact")

              return (
                <button
                  key={item.id}
                  type="button"
                  className={`lab-option ${selected ? "selected" : ""}`}
                  onClick={() =>
                    patch({
                      typography: {
                        ...contract.typography,
                        scale:
                          item.id === "editorial"
                            ? "editorial"
                            : item.id === "technical"
                              ? "compact"
                              : "standard",
                      },
                    })
                  }
                >
                  <div className={`type-sample type-${item.id}`}>Aa</div>
                  <strong>{item.name}</strong>
                  <span>{item.display}</span>
                  <small>{item.note}</small>
                </button>
              )
            })}
          </div>
        )}

        {section === "Surfaces" && (
          <div className="lab-option-grid">
            {SURFACE_PRESETS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`lab-option surface-option ${item.id === contract.surfaces.default ? "selected" : ""}`}
                onClick={() =>
                  patch({
                    surfaces: {
                      ...contract.surfaces,
                      default: item.id as DesignSurfacePreset,
                    },
                  })
                }
              >
                <div className={`surface-sample surface-${item.id}`} />
                <strong>{item.name}</strong>
                <span>{item.note}</span>
              </button>
            ))}
          </div>
        )}

        {section === "Shape" && (
          <div className="lab-option-grid">
            {RADIUS_PRESETS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`lab-option ${item.id === contract.shape.radius ? "selected" : ""}`}
                onClick={() =>
                  patch({
                    shape: { ...contract.shape, radius: item.id },
                  })
                }
              >
                <div className={`shape-sample shape-${item.id}`} />
                <strong>{item.label}</strong>
                <span>{item.note}</span>
              </button>
            ))}
          </div>
        )}

        {section === "Motion" && (
          <div className="lab-option-grid">
            {MOTION_PRESETS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`lab-option ${item.id === contract.motion.reveal ? "selected" : ""}`}
                onClick={() =>
                  patch({
                    motion: { ...contract.motion, reveal: item.id },
                  })
                }
              >
                <div className={`motion-sample motion-${item.id}`}>
                  <i />
                </div>
                <strong>{item.name}</strong>
                <span>{item.note}</span>
                <small>Play / Replay</small>
              </button>
            ))}
          </div>
        )}

        {!["Color", "Typography", "Surfaces", "Shape", "Motion"].includes(section) && (
          <div className="lab-coming">
            <WandSparkles />
            <strong>{section}</strong>
            <p>
              La arquitectura de esta sección ya está definida. Entrará en la siguiente iteración del Lab.
            </p>
          </div>
        )}

        <div className="lab-contract">
          <div>
            <small>DESIGN CONTRACT</small>
            <strong>
              {palette.name} · {contract.surfaces.default} · {contract.shape.radius}
            </strong>
          </div>
          <code>{contract.palette.family} / {contract.motion.reveal}</code>
        </div>
      </section>

      <section className="lab-stage">
        <header>
          <div className="lab-context">
            {(["landing", "dashboard", "presence"] as PreviewContext[]).map((item) => (
              <button
                key={item}
                type="button"
                className={context === item ? "active" : ""}
                onClick={() => setContext(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="lab-viewport">
            <button
              type="button"
              aria-label="Desktop preview"
              onClick={() => setViewport("desktop")}
              className={viewport === "desktop" ? "active" : ""}
            >
              <Monitor size={16} />
            </button>
            <button
              type="button"
              aria-label="Tablet preview"
              onClick={() => setViewport("tablet")}
              className={viewport === "tablet" ? "active" : ""}
            >
              <Tablet size={16} />
            </button>
            <button
              type="button"
              aria-label="Mobile preview"
              onClick={() => setViewport("mobile")}
              className={viewport === "mobile" ? "active" : ""}
            >
              <Smartphone size={16} />
            </button>
          </div>
        </header>

        <div className="lab-stage-canvas">
          <Preview contract={contract} context={context} viewport={viewport} />
        </div>
      </section>
    </main>
  )
}
