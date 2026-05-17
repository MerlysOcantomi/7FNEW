"use client"

import { AppShell } from "@/components/app-shell"
import { SectionPage } from "@/components/section-page"
import { BookOpen, FileText, Image, Video, File, Download } from "lucide-react"

const resources = [
  { name: "7F Brand Guide", type: "PDF", size: "4.2 MB", category: "Branding", date: "Jan 10, 2026" },
  { name: "Business Proposal Template", type: "DOCX", size: "1.8 MB", category: "Templates", date: "Jan 15, 2026" },
  { name: "Social Media Kit", type: "ZIP", size: "28.4 MB", category: "Social", date: "Jan 20, 2026" },
  { name: "Operations Manual", type: "PDF", size: "6.1 MB", category: "Operations", date: "Feb 1, 2026" },
  { name: "Q1 Image Bank", type: "ZIP", size: "156 MB", category: "Media", date: "Feb 5, 2026" },
  { name: "Standard Contract A", type: "PDF", size: "890 KB", category: "Legal", date: "Feb 8, 2026" },
  { name: "Onboarding Video", type: "MP4", size: "245 MB", category: "Training", date: "Feb 12, 2026" },
  { name: "Project Checklist", type: "PDF", size: "520 KB", category: "Templates", date: "Feb 14, 2026" },
]

const typeIcons: Record<string, React.ReactNode> = {
  PDF: <FileText className="h-4 w-4" />,
  DOCX: <File className="h-4 w-4" />,
  ZIP: <File className="h-4 w-4" />,
  MP4: <Video className="h-4 w-4" />,
}

export default function BibliotecaPage() {
  return (
    <AppShell
      currentSection="biblioteca"
      breadcrumbs={[{ label: "7F" }, { label: "Library" }]}
    >
      <SectionPage
        tone="canvas"
        title="Library"
        description="Resources, templates, documents, and shared team files."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {["Branding", "Templates", "Media", "Legal"].map((cat) => (
            <div
              key={cat}
              className="cursor-pointer rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-5 shadow-none ring-1 ring-white/[0.04] transition-shadow hover:bg-white/[0.03]"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--app-surface-dark-elevated)]">
                <BookOpen className="h-5 w-5 text-[var(--text-secondary-light)]" />
              </div>
              <h3 className="text-sm font-semibold text-[var(--text-primary-light)]">{cat}</h3>
              <p className="mt-1 text-xs text-[var(--text-secondary-light)]">
                {resources.filter((r) => r.category === cat).length} files
              </p>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] ring-1 ring-white/[0.04]">
          <div className="flex items-center gap-2 border-b border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] px-5 py-4">
            <BookOpen className="h-4 w-4 text-[var(--text-secondary-light)]" />
            <h2 className="text-sm font-semibold text-[var(--text-primary-light)]">All Resources</h2>
          </div>
          <div className="divide-y divide-[var(--border-dark)]">
            {resources.map((res, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-white/[0.04]">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--app-surface-dark-elevated)] text-[var(--text-secondary-light)]">
                  {typeIcons[res.type] || <File className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--text-primary-light)]">{res.name}</p>
                  <p className="text-xs text-[var(--text-secondary-light)]">
                    {res.type} &middot; {res.size} &middot; {res.category}
                  </p>
                </div>
                <span className="hidden shrink-0 text-xs text-[var(--text-secondary-light)] sm:block">{res.date}</span>
                <button
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--text-secondary-light)] transition-colors hover:bg-white/[0.08] hover:text-[var(--text-primary-light)]"
                  aria-label={`Download ${res.name}`}
                >
                  <Download className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </SectionPage>
    </AppShell>
  )
}
