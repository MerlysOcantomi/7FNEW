interface SectionPageProps {
  title: string
  description: string
  children?: React.ReactNode
  /** Light text tokens for headings over the AppShell dark canvas (`--text-primary-light` / `--text-secondary-light`). */
  tone?: "default" | "canvas"
}

export function SectionPage({ title, description, children, tone = "default" }: SectionPageProps) {
  const titleClass =
    tone === "canvas"
      ? "text-2xl font-semibold tracking-tight text-[var(--text-primary-light)] text-balance"
      : "text-2xl font-semibold tracking-tight text-foreground text-balance"
  const descClass =
    tone === "canvas"
      ? "mt-1.5 text-sm leading-relaxed text-[var(--text-secondary-light)] text-pretty max-w-xl"
      : "mt-1.5 text-sm leading-relaxed text-muted-foreground text-pretty max-w-xl"

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className={titleClass}>{title}</h1>
        <p className={descClass}>{description}</p>
      </div>
      {children}
    </div>
  )
}
