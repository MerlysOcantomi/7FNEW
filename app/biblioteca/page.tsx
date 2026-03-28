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
        title="Library"
        description="Resources, templates, documents, and shared team files."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {["Branding", "Templates", "Media", "Legal"].map((cat) => (
            <div key={cat} className="rounded-xl border border-border bg-card p-5 hover:shadow-sm transition-shadow cursor-pointer">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted mb-3">
                <BookOpen className="h-5 w-5 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">{cat}</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {resources.filter((r) => r.category === cat).length} files
              </p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-5 py-4">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">All Resources</h2>
          </div>
          <div className="divide-y divide-border">
            {resources.map((res, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/50 transition-colors">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground flex-shrink-0">
                  {typeIcons[res.type] || <File className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{res.name}</p>
                  <p className="text-xs text-muted-foreground">{res.type} &middot; {res.size} &middot; {res.category}</p>
                </div>
                <span className="hidden sm:block text-xs text-muted-foreground flex-shrink-0">{res.date}</span>
                <button className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors flex-shrink-0" aria-label={`Download ${res.name}`}>
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
