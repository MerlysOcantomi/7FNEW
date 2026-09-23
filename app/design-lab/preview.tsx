"use client"

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { ArrowRight, Check, CalendarDays, MessageSquare, Users, X } from "lucide-react"
import type { DesignContract, PreviewContext, PreviewViewport } from "../../core/design/contracts"
import { resolveDesignTokens } from "../../core/design/resolve"
import styles from "./lab.module.css"

export const PREVIEW_WIDTHS = { desktop: 1180, tablet: 768, mobile: 390 } as const
const PREVIEW_HEIGHT = 820

/** Real layout widths; outer scaling fits the editor, container queries handle layout. */
export function PreviewFrame({ children, viewport }: { children: ReactNode; viewport: PreviewViewport }) {
  const host = useRef<HTMLDivElement>(null)
  const [available, setAvailable] = useState(0)
  useEffect(() => {
    const element = host.current
    if (!element) return
    const measure = () => setAvailable(element.clientWidth)
    const initialFrame = window.requestAnimationFrame(measure)
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure)
      return () => { window.cancelAnimationFrame(initialFrame); window.removeEventListener("resize", measure) }
    }
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => { window.cancelAnimationFrame(initialFrame); observer.disconnect() }
  }, [])
  const width = PREVIEW_WIDTHS[viewport]
  const scale = available > 0 ? Math.min(1, available / width) : 1
  return <div ref={host} className={styles.frameHost}>
    <div className={styles.frameFootprint} style={{ width: width * scale, height: PREVIEW_HEIGHT * scale }}>
      <div className={styles.frame} style={{ width, height: PREVIEW_HEIGHT, transform: `scale(${scale})` }}>{children}</div>
    </div>
    <p className={styles.frameCaption}>{width} px layout / {Math.round(scale * 100)}% display scale. Scroll inside the page.</p>
  </div>
}

export function PreviewContent({ contract, context, replay, paused, onAction }: {
  contract: DesignContract; context: PreviewContext; replay: number; paused: boolean; onAction: (message: string) => void
}) {
  const [dialog, setDialog] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { if (dialog) closeRef.current?.focus() }, [dialog])
  const safe = { ...contract, brand: { ...contract.brand, name: contract.brand.name.trim() || "Your brand" } }
  const vars = resolveDesignTokens(safe) as CSSProperties
  const name = safe.brand.name
  const sample = () => onAction("Visual example only. No booking, payment or message was sent.")
  const close = () => {
    setDialog(false)
    window.requestAnimationFrame(() => triggerRef.current?.focus())
  }
  return <div className={`${styles.preview} fd-scope`} style={vars} data-motion-paused={paused} data-appearance={contract.palette.mode}>
    <div inert={dialog}>
      <div className={styles.previewNav}>
        <strong className={styles.previewBrand}>{name}</strong>
        <nav aria-label="Sample navigation"><button onClick={sample} type="button">Services</button><button onClick={sample} type="button">About</button></nav>
        <button onClick={sample} type="button" className="fd-button">{context === "presence" ? "Book a visit" : "Get started"}</button>
      </div>
      <div className={styles.previewBody} key={`${context}-${replay}`}>
        <div className={styles.signature} data-motion={contract.motion.reveal} aria-hidden="true" />
        {(context === "landing" || context === "presence") && <>
          <section className={styles.hero}>
            <div>
              <span className={styles.eyebrow}>{context === "presence" ? "YOUR BUSINESS. YOUR IDENTITY." : "LESS FRICTION. MORE FOCUS."}</span>
              <h1>{context === "presence" ? <>Make room for <em>your next chapter.</em></> : <>Your business.<br /><em>Under control.</em></>}</h1>
              <p>{context === "presence" ? `Discover ${name}. Services, appointments and a personal welcome, in one place.` : "Bring your clients, conversations and daily work together. Start with what matters to you."}</p>
              <div className={styles.actions}><button className="fd-button" onClick={sample} type="button">{context === "presence" ? "Book a visit" : "Create your space"} <ArrowRight size={16} /></button><button className="fd-button" data-secondary onClick={sample} type="button">Explore</button></div>
            </div>
            <div className={`${styles.heroVisual} fd-surface`} data-surface={contract.surfaces.focus} data-motion={contract.motion.panel}>
              <div className={styles.orbits} aria-hidden="true"><i /><i /><i /><span /></div>
              <span className={styles.eyebrow}>CONNECTED BY DESIGN</span><h2>{name}</h2><p>One visual language.<br />Every touchpoint.</p>
            </div>
          </section>
          <section className={styles.cardGrid} aria-label="Sample services">
            {[{ icon: CalendarDays, title: "Appointments", text: "Your time, beautifully organized." }, { icon: Users, title: "People", text: "The details that make every visit personal." }, { icon: MessageSquare, title: "Conversations", text: "From a first question to the next step." }].map(({ icon: Icon, title, text }) => <article key={title} className="fd-surface" data-surface={contract.surfaces.default} data-motion={contract.motion.panel}><Icon size={22} aria-hidden="true" /><h3>{title}</h3><p>{text}</p></article>)}
          </section>
        </>}
        {context === "dashboard" && <>
          <header className={styles.overviewHeading}><div><span className={styles.eyebrow}>BUSINESS OVERVIEW / SAMPLE DATA</span><h1>A clear view.<br /><em>A calmer day.</em></h1><p>What matters now, without the noise.</p></div><button className="fd-button" data-secondary type="button" onClick={sample}>View agenda</button></header>
          <div className={styles.metrics}>{[{value:"06",label:"Appointments"},{value:"12",label:"Messages"},{value:"03",label:"To review"}].map(x => <article key={x.label} className="fd-surface" data-surface={contract.surfaces.default}><span>{x.label}</span><strong>{x.value}</strong><small>Example, not live data</small></article>)}</div>
          <section className={styles.overviewGrid}>
            <article className="fd-surface" data-surface={contract.surfaces.operational} data-motion={contract.motion.panel}><span className={styles.eyebrow}>NEXT APPOINTMENTS</span><h2>Today, at a glance.</h2>{["09:30 / First consultation", "11:00 / Follow-up", "15:30 / Studio visit"].map(x => <div key={x} className={styles.agendaRow}><CalendarDays size={18} aria-hidden="true"/><span>{x}</span><Check size={16} aria-hidden="true"/></div>)}</article>
            <article className="fd-surface" data-surface={contract.surfaces.focus}><div className={styles.aiMark} data-motion={contract.motion.ai} aria-hidden="true" /><span className={styles.eyebrow}>ASSISTANT / VISUAL EXAMPLE</span><h2>Two confirmations to review.</h2><p>This illustrates a suggestion state. It is not a running agent.</p><button className="fd-button" type="button" onClick={sample}>Review example</button></article>
          </section>
        </>}
        {context === "components" && <>
          <span className={styles.eyebrow}>COMPONENT PLAYGROUND</span><h1>One system.<br /><em>Real controls.</em></h1>
          <section className={styles.componentGrid}>
            <article className="fd-surface" data-surface={contract.surfaces.default}><h2>Actions</h2><div className={styles.actions}><button className="fd-button" onClick={sample} type="button">Primary</button><button className="fd-button" data-secondary onClick={sample} type="button">Secondary</button><button className="fd-button" disabled type="button">Disabled</button></div><p>Tab through controls to check the focus ring.</p></article>
            <article className="fd-surface" data-surface={contract.surfaces.operational}><h2>Form</h2><label className={styles.fieldLabel}>Business name<input className="fd-input" defaultValue={name} maxLength={80} /></label><label className={styles.fieldLabel}>Service<select className="fd-input" defaultValue="consultation"><option value="consultation">Consultation</option><option value="workshop">Workshop</option></select></label></article>
            <article className="fd-surface" data-surface={contract.surfaces.focus}><h2>Dialog</h2><p>A contained interaction. No data leaves the preview.</p><button ref={triggerRef} className="fd-button" type="button" onClick={() => setDialog(true)}>Open sample dialog</button></article>
          </section>
        </>}
        <footer className={styles.previewFooter}>{name} / Design Foundation preview. Sample content.</footer>
      </div>
    </div>
    {dialog && <div className={styles.dialogBackdrop} onKeyDown={event => {
      if (event.key === "Escape") { event.preventDefault(); close() }
    }}>
      <section role="dialog" aria-modal="false" aria-labelledby="fd-demo-dialog-title" className={`${styles.dialog} fd-surface`} data-surface={contract.surfaces.operational}>
        <button ref={closeRef} type="button" aria-label="Close sample dialog" className="fd-button" data-secondary onClick={close}><X size={18} /></button><h2 id="fd-demo-dialog-title">Preview only</h2><p>Your selected palette, fonts, radius and surface also apply here. No real transaction occurs.</p>
      </section>
    </div>}
  </div>
}
