"use client"

import type { DesignContract } from "../../core/design/contracts"
import { compareDesignChoices } from "../../core/design/comparison"
import styles from "./comparison.module.css"

type Props = {
  reference: DesignContract | null
  working: DesignContract
  showingReference: boolean
  canCapture: boolean
  onCapture: () => void
  onShow: (reference: boolean) => void
  onUseReference: () => void
}

/** A/B uses the same preview page, size and motion preference for a fair comparison. */
export default function ComparisonToolbar({ reference, working, showingReference, canCapture, onCapture, onShow, onUseReference }: Props) {
  const differences = reference ? compareDesignChoices(reference, working) : []
  return <section className={styles.comparison} aria-label="Design comparison">
    <div className={styles.row}>
      <button type="button" disabled={!canCapture} onClick={onCapture}>
        {reference ? "Replace reference A" : "Capture reference A"}
      </button>
      <div className={styles.switcher} role="group" aria-label="Compare A and B">
        <button type="button" disabled={!reference} aria-pressed={showingReference} onClick={() => onShow(true)}>Reference A</button>
        <button type="button" aria-pressed={!showingReference} onClick={() => onShow(false)}>Working B</button>
      </div>
      <button type="button" disabled={!reference || differences.length === 0} onClick={onUseReference}>Use A as working</button>
    </div>
    <p className={styles.caption}>
      {showingReference ? "Showing reference A. Editing any choice returns to working B." : "Showing working B. Capture A, then change colors, type or surfaces to compare."}
      {reference && " Reference A is temporary; reloading clears it. Save and Export keep B only."}
    </p>
    {reference && <details className={styles.details}>
      <summary>{differences.length === 0 ? "Same visual choices" : `${differences.length} design sections differ`}</summary>
      {differences.length === 0 ? <p className={styles.caption}>Preview page and viewport are not counted as design differences.</p> : <dl className={styles.differences}>
        {differences.map(item => <div key={item.section}><dt>{item.label}</dt><dd>A: {item.reference}</dd><dd>B: {item.working}</dd></div>)}
      </dl>}
    </details>}
  </section>
}
