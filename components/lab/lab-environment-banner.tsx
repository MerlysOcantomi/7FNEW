/**
 * Persistent Mr Forte Lab marker (DEV-PREVIEW-01A). Used only inside `/lab`
 * for now; it joins the real surfaces once the Lab session exists (later
 * missions), so nothing rendered in the Lab can be mistaken for real data.
 */
export function LabEnvironmentBanner() {
  return (
    <div className="w-full border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-center text-xs font-medium uppercase tracking-widest text-amber-700 dark:text-amber-400">
      Mr Forte Lab · Preview · Fictional data
    </div>
  )
}
