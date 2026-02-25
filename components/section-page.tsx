interface SectionPageProps {
  title: string
  description: string
  actions?: React.ReactNode
  children?: React.ReactNode
}

export function SectionPage({ title, description, actions, children }: SectionPageProps) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty max-w-xl">{description}</p>
        </div>
        {actions && <div className="flex-shrink-0">{actions}</div>}
      </div>
      {children}
    </div>
  )
}
