interface SectionPageProps {
  title: string
  description: string
  children?: React.ReactNode
}

export function SectionPage({ title, description, children }: SectionPageProps) {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground text-balance">{title}</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground text-pretty max-w-xl">{description}</p>
      </div>
      {children}
    </div>
  )
}
