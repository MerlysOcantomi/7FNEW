"use client"

import { Briefcase, ChevronDown, ChevronRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ContextSection } from "@/components/inbox/context-section"

interface BusinessContextItem {
  label: string
  value: string | number | null | undefined
  href?: string
  tone?: "default" | "accent" | "warning"
}

interface BusinessContextSection {
  title: string
  summary?: string
  items: BusinessContextItem[]
  emptyLabel?: string
}

interface BusinessContextCardProps {
  expanded: boolean
  onExpandedChange: (value: boolean) => void
  summaryLabel: string
  summaryMeta: string[]
  core: BusinessContextSection[]
  finance?: BusinessContextSection[]
  activity?: BusinessContextSection[]
  alerts?: BusinessContextSection[]
}

export function BusinessContextCard({
  expanded,
  onExpandedChange,
  summaryLabel,
  summaryMeta,
  core,
  finance,
  activity,
  alerts,
}: BusinessContextCardProps) {
  return (
    <Card className="gap-0 overflow-hidden rounded-[var(--inbox-radius-panel)] border-[var(--inbox-border)] bg-[var(--inbox-surface)] py-0 shadow-[var(--inbox-panel-shadow-sm)]">
      <Collapsible open={expanded} onOpenChange={onExpandedChange}>
        <CardHeader className="px-4 py-0">
          <CollapsibleTrigger asChild>
            <button className="flex w-full items-center justify-between gap-3 py-4 text-left transition-colors hover:text-[var(--inbox-text)]">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--inbox-background)] text-[var(--inbox-text-secondary)]">
                  <Briefcase className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-sm text-[var(--inbox-text)]">Business context</CardTitle>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--inbox-text-secondary)]">
                    {summaryLabel}
                  </p>
                  {summaryMeta.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {summaryMeta.map((item) => (
                        <span
                          key={item}
                          className="rounded-full border border-[var(--inbox-divider)] bg-[var(--inbox-background)] px-2 py-0.5 text-[10px] font-medium text-[var(--inbox-text-secondary)]"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {expanded ? (
                <ChevronDown className="h-4 w-4 text-[var(--inbox-text-secondary)]" />
              ) : (
                <ChevronRight className="h-4 w-4 text-[var(--inbox-text-secondary)]" />
              )}
            </button>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-3 border-t border-[var(--inbox-divider)] px-4 py-4">
            {core.map((section) => (
              <ContextSection
                key={section.title}
                title={section.title}
                summary={section.summary}
                items={section.items}
                emptyLabel={section.emptyLabel}
              />
            ))}

            {finance?.length ? (
              finance.map((section) => (
                <ContextSection
                  key={`finance-${section.title}`}
                  title={section.title}
                  summary={section.summary}
                  items={section.items}
                  emptyLabel={section.emptyLabel}
                />
              ))
            ) : null}

            {activity?.length ? (
              activity.map((section) => (
                <ContextSection
                  key={`activity-${section.title}`}
                  title={section.title}
                  summary={section.summary}
                  items={section.items}
                  emptyLabel={section.emptyLabel}
                />
              ))
            ) : null}

            {alerts?.length ? (
              alerts.map((section) => (
                <ContextSection
                  key={`alerts-${section.title}`}
                  title={section.title}
                  summary={section.summary}
                  items={section.items}
                  emptyLabel={section.emptyLabel}
                />
              ))
            ) : null}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
