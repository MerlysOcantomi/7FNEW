"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface BreadcrumbItem {
  label: string
  href?: string
}

interface TabItem {
  key: string
  label: string
}

interface SectionPageProps {
  title: string
  description?: string
  breadcrumbs?: BreadcrumbItem[]
  actions?: React.ReactNode
  tabs?: TabItem[]
  defaultTab?: string
  children?: React.ReactNode | ((activeTab: string) => React.ReactNode)
}

export function SectionPage({
  title,
  description,
  breadcrumbs,
  actions,
  tabs,
  defaultTab,
  children,
}: SectionPageProps) {
  const [activeTab, setActiveTab] = useState(defaultTab ?? tabs?.[0]?.key ?? "")

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1.5 flex-wrap" aria-label="Breadcrumb">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight size={11} className="text-[#CBD5E1] shrink-0" />}
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="text-xs text-[#64748B] hover:text-[#0F172A] transition-colors font-medium"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-xs text-[#0F172A] font-semibold truncate max-w-[200px]">
                  {crumb.label}
                </span>
              )}
            </span>
          ))}
        </nav>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">{title}</h1>
          {description && (
            <p className="mt-1.5 text-sm leading-relaxed text-[#64748B] max-w-xl">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {actions}
          </div>
        )}
      </div>

      {/* Tabs */}
      {tabs && tabs.length > 0 && (
        <div className="overflow-x-auto scrollbar-none -mb-px">
          <div className="flex items-end gap-0 min-w-max border-b border-[#E2E8F0]">
            {tabs.map((tab) => {
              const isActive = tab.key === activeTab
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "relative px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-colors border-b-2",
                    isActive
                      ? "text-[#2563EB] border-[#3B82F6]"
                      : "text-[#94A3B8] border-transparent hover:text-[#334155] hover:border-[#CBD5E1]"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Content */}
      <div>
        {typeof children === "function" ? children(activeTab) : children}
      </div>
    </div>
  )
}
