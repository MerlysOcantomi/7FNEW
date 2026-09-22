"use client"

import { useMemo, useRef, useState } from "react"
import { Download, Maximize2, Minimize2, Monitor, Pause, Play, Save, Smartphone, Tablet, Upload, Undo2, Check } from "lucide-react"
import { DEFAULT_DESIGN_CONTRACT, type DesignContract, type PreviewContext, type PreviewViewport } from "../../core/design/contracts"
import { paletteById } from "../../core/design/presets"
import { exportDesignCSS, exportDesignJSON, MAX_CONTRACT_SIZE, parseDesignContract, parseDesignJSON } from "../../core/design/resolve"
import { readDesignDraft, saveDesignDraft } from "../../core/design/draft"
import { captureDesignReference, applyDesignReference } from "../../core/design/comparison"
import ComparisonToolbar from "./comparison-toolbar"
import Controls, { SECTIONS, type Section, type ChangeContract } from "./controls"
import { PreviewContent, PreviewFrame } from "./preview"
import "../../core/design/foundation.css"
import styles from "./lab.module.css"

function downloadText(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const anchor = document.createElement("a")
  anchor.href = url; anchor.download = name
  document.body.appendChild(anchor); anchor.click(); anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export default function DesignLabClient() {
  const [contract, setContract] = useState<DesignContract>(() => JSON.parse(JSON.stringify(DEFAULT_DESIGN_CONTRACT)))
  const [section, setSection] = useState<Section>("Color")
  const [context, setContextState] = useState<PreviewContext>("landing")
  const [viewport, setViewport] = useState<PreviewViewport>("desktop")
  const [replay, setReplay] = useState(0)
  const [paused, setPaused] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [reference, setReference] = useState<DesignContract | null>(null)
  const [showReference, setShowReference] = useState(false)
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null)
  const [notice, setNotice] = useState("Local design sandbox. Nothing here publishes or changes your workspace.")
  const fileInput = useRef<HTMLInputElement>(null)
  const rawSnapshot = JSON.stringify(contract)
  const dirty = savedSnapshot !== rawSnapshot
  const palette = paletteById(contract.palette.family)
  const parsed = useMemo(() => parseDesignContract(contract), [contract])
  const exports = useMemo(() => parsed.ok ? { json: exportDesignJSON(parsed.contract), css: exportDesignCSS(parsed.contract) } : null, [parsed])
  const previewContract = showReference && reference ? reference : contract
  const change: ChangeContract = update => {
    setContract(current => update(current))
    setShowReference(false)
    if (showReference) setNotice("Editing working B. Reference A has not changed.")
  }
  const replayPreview = () => setReplay(n => n + 1)
  const setContext = (next: PreviewContext) => {
    setContextState(next)
    // Keep A/B on the same page. Page choice is navigation, not a visual decision.
    setContract(c => ({ ...c, pagePreset: next }))
  }

  function captureReference() {
    if (!parsed.ok) { setNotice(parsed.error); return }
    if (reference && !window.confirm("Replace reference A with the current working design B?")) return
    setReference(captureDesignReference(parsed.contract))
    setShowReference(false)
    setNotice("Reference A captured in memory. Adjust B and switch between them; export B before closing to keep a copy.")
  }
  function showComparison(show: boolean) {
    if (show && !reference) return
    setShowReference(show)
    replayPreview()
    setNotice(show ? "Showing reference A. Controls, Save and Export belong to working B." : "Showing working B. Reference A remains unchanged.")
  }
  function adoptReference() {
    if (!reference || !window.confirm("Replace the working design B with reference A? Unsaved B changes will be lost.")) return
    setContract(current => applyDesignReference(reference, current))
    setShowReference(false)
    replayPreview()
    setNotice("Reference A is now the working design B. Nothing has been saved or published automatically.")
  }

  function save() {
    try {
      const previous = readDesignDraft(window.localStorage)
      if (previous.ok && savedSnapshot === null && !window.confirm("Replace the saved local draft with this design?")) return
      const result = saveDesignDraft(window.localStorage, contract)
      if (!result.ok) { setNotice(result.error); return }
      setContract(result.contract); setShowReference(false); setSavedSnapshot(JSON.stringify(result.contract))
      setNotice("Saved in this browser only. Export JSON to keep or move a copy.")
    } catch { setNotice("Browser storage is unavailable. Use Export JSON instead.") }
  }
  function restore() {
    try {
      const result = readDesignDraft(window.localStorage)
      if (!result.ok) { setNotice(result.error); return }
      if (dirty && !window.confirm("Restore the saved draft and replace the current unsaved design?")) return
      setContract(result.contract); setShowReference(false); setContextState((result.contract.pagePreset as PreviewContext) ?? "landing")
      setSavedSnapshot(JSON.stringify(result.contract)); replayPreview()
      setNotice("Local draft restored. Production themes and data are unchanged.")
    } catch { setNotice("Browser storage is unavailable. Import a JSON copy instead.") }
  }
  function exportFile(format: "json" | "css") {
    if (!exports) { setNotice(parsed.ok ? "Invalid design" : parsed.error); return }
    const slug = contract.brand.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "brand"
    try {
      downloadText(exports[format], `${slug}-design.${format}`, format === "json" ? "application/json" : "text/css")
      setNotice(format === "json" ? "Design contract exported." : "CSS tokens exported. Pair them with Foundation primitives; this is not a published website.")
    } catch { setNotice("The download could not be started. Your current design is unchanged.") }
  }
  async function importFile(file: File | undefined) {
    if (!file) return
    if (file.size > MAX_CONTRACT_SIZE) { setNotice("File is too large. Choose a design JSON smaller than 24 KB."); return }
    try {
      const result = parseDesignJSON(await file.text())
      if (!result.ok) { setNotice(result.error); return }
      if (dirty && !window.confirm("Import this design and replace the current unsaved choices?")) return
      setContract(result.contract); setShowReference(false); setContextState((result.contract.pagePreset as PreviewContext) ?? "landing"); replayPreview()
      setNotice("Valid contract imported. Save it locally or export another copy; nothing was published.")
    } catch { setNotice("This file could not be read. The current design has not been changed.") }
  }
  function chooseSection(next: Section) { setSection(next); setShowReference(false); if (next === "Components") setContext("components") }

  return <main className={styles.shell} data-expanded={expanded}>
    <header className={styles.topbar}>
      <div className={styles.identity}><span className={styles.brandLines} aria-hidden="true"><i/><i/></span><div><strong>Forte Design</strong><small>FOUNDATION / LOCAL LAB</small></div></div>
      <div className={styles.topActions}>
        <span className={styles.saveState}>{dirty ? "Unsaved choices" : <><Check size={14}/> Saved locally</>}</span>
        <button type="button" aria-label="Restore local draft" className={styles.secondaryButton} onClick={restore}><Undo2 size={15}/><span>Restore</span></button>
        <button type="button" aria-label="Save design locally" className={styles.primaryButton} onClick={save} disabled={!parsed.ok}><Save size={15}/><span>Save locally</span></button>
      </div>
    </header>
    {!expanded && <aside className={styles.sidebar}>
      <div className={styles.project}><small>DESIGNING FOR</small><strong>{contract.brand.name.trim() || "Your brand"}</strong><span>Contract v0.1 / no database</span></div>
      <nav aria-label="Design sections">{SECTIONS.map((item,index) => <button type="button" key={item} aria-current={section === item ? "page" : undefined} onClick={() => chooseSection(item)}><span>{String(index + 1).padStart(2,"0")}</span>{item}</button>)}</nav>
      <div className={styles.sideNote}>Design Foundation first.<br />sevenef and Presence consume it.</div>
    </aside>}
    {!expanded && <section className={styles.controls} aria-labelledby="fd-controls-title">
      <header><span className={styles.editorEyebrow}>DESIGN DECISIONS</span><h1 id="fd-controls-title">{section}</h1><p>Choose. See. Refine.<br />The preview follows your contract.</p></header>
      {section !== "Export" ? <Controls section={section} contract={contract} change={change} setContext={setContext} replay={replayPreview} paused={paused}/> : <div className={styles.controlStack}>
        <div className={styles.note}><strong>Export working design B</strong><p>Reference A is temporary and is not exported. JSON stores the complete working design contract. CSS contains the same resolved tokens as the live preview. Motion and surface roles are in the contract; Foundation primitives supply their behavior.</p></div>
        <div className={styles.exportActions}><button className={styles.primaryButton} type="button" disabled={!exports} onClick={() => exportFile("json")}><Download size={15}/> Export JSON</button><button className={styles.secondaryButton} type="button" disabled={!exports} onClick={() => exportFile("css")}><Download size={15}/> CSS tokens</button><button className={styles.secondaryButton} type="button" onClick={() => fileInput.current?.click()}><Upload size={15}/> Import JSON</button></div>
        <input ref={fileInput} className={styles.fileInput} tabIndex={-1} type="file" accept=".json,application/json" aria-label="Import design JSON" onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; void importFile(file) }}/>
        <label className={styles.fieldLabel}>Current contract<textarea className={styles.exportText} readOnly spellCheck={false} value={exports?.json ?? (!parsed.ok ? parsed.error : "")}/></label>
        <p className={styles.hint}>No API keys, workspace data, billing, remote uploads or paid AI calls. The local draft belongs to this browser/origin, not your account.</p>
      </div>}
      <footer className={styles.contractSummary}><small>WORKING DESIGN B</small><strong>{palette.name} / {contract.surfaces.default}</strong><span>{contract.typography.display} / {contract.shape.radius}</span></footer>
    </section>}
    <section className={styles.stage} aria-label="Live design preview">
      <header className={styles.stageToolbar}>
        <div className={styles.segmented} aria-label="Preview page">{(["landing","dashboard","presence","components"] as PreviewContext[]).map(item => <button type="button" key={item} aria-pressed={context === item} onClick={() => setContext(item)}>{item === "dashboard" ? "Overview" : item}</button>)}</div>
        <div className={styles.toolbarTools}>
          <div className={styles.segmented} aria-label="Preview viewport">{[{id:"desktop",Icon:Monitor},{id:"tablet",Icon:Tablet},{id:"mobile",Icon:Smartphone}].map(({id,Icon}) => <button type="button" key={id} aria-label={`${id} preview`} title={`${id} preview`} aria-pressed={viewport === id} onClick={() => setViewport(id as PreviewViewport)}><Icon size={16}/></button>)}</div>
          <button type="button" className={styles.iconButton} aria-label={paused ? "Enable preview motion" : "Pause preview motion"} aria-pressed={paused} title="Pause / enable motion" onClick={() => setPaused(value => !value)}>{paused ? <Play size={16}/> : <Pause size={16}/>}</button>
          <button type="button" className={styles.iconButton} aria-label="Replay preview motion" title="Replay" onClick={replayPreview}><Undo2 size={16}/></button>
          <button type="button" className={styles.iconButton} aria-label={expanded ? "Show editor" : "Expand preview"} title={expanded ? "Show editor" : "Expand preview"} onClick={() => setExpanded(value => !value)}>{expanded ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}</button>
        </div>
      </header>
      <ComparisonToolbar reference={reference} working={contract} showingReference={showReference} canCapture={parsed.ok} onCapture={captureReference} onShow={showComparison} onUseReference={adoptReference}/>
      <div className={styles.stageCanvas}><PreviewFrame viewport={viewport}><PreviewContent key={`${context}-${showReference ? "reference" : "working"}`} contract={previewContract} context={context} replay={replay} paused={paused} onAction={setNotice}/></PreviewFrame></div>
      <div className={styles.notice} role="status" aria-live="polite">{notice}</div>
    </section>
  </main>
}
