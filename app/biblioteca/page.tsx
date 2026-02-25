"use client"

import { AppShell } from "@/components/app-shell"
import { SectionPage } from "@/components/section-page"
import { BookOpen, FileText, Image, Video, File, Download } from "lucide-react"

const resources = [
  { name: "Guia de Marca 7F", type: "PDF", size: "4.2 MB", category: "Branding", date: "10 ene 2026" },
  { name: "Plantilla Propuesta Comercial", type: "DOCX", size: "1.8 MB", category: "Templates", date: "15 ene 2026" },
  { name: "Kit de Redes Sociales", type: "ZIP", size: "28.4 MB", category: "Social", date: "20 ene 2026" },
  { name: "Manual de Procesos", type: "PDF", size: "6.1 MB", category: "Operaciones", date: "1 feb 2026" },
  { name: "Banco de Imagenes Q1", type: "ZIP", size: "156 MB", category: "Media", date: "5 feb 2026" },
  { name: "Contrato Tipo A", type: "PDF", size: "890 KB", category: "Legal", date: "8 feb 2026" },
  { name: "Video Onboarding", type: "MP4", size: "245 MB", category: "Capacitacion", date: "12 feb 2026" },
  { name: "Checklist de Proyecto", type: "PDF", size: "520 KB", category: "Templates", date: "14 feb 2026" },
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
      breadcrumbs={[{ label: "7F" }, { label: "Biblioteca" }]}
    >
      <SectionPage
        title="Biblioteca"
        description="Recursos, plantillas, documentos y archivos compartidos del equipo."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {["Branding", "Templates", "Media", "Legal"].map((cat) => (
            <div key={cat} className="rounded-xl border border-border bg-card shadow-sm p-5 hover:bg-muted/40 transition-colors cursor-pointer group">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted mb-3">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-sm font-semibold text-foreground group-hover:text-primary">{cat}</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {resources.filter((r) => r.category === cat).length} archivos
              </p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-5 py-4">
            <BookOpen className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Todos los Recursos</h2>
          </div>
          <div className="divide-y divide-border">
            {resources.map((res, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/40 transition-colors group">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground flex-shrink-0">
                  {typeIcons[res.type] || <File className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate group-hover:text-primary">{res.name}</p>
                  <p className="text-xs text-muted-foreground">{res.type} &middot; {res.size} &middot; {res.category}</p>
                </div>
                <span className="hidden sm:block text-xs text-muted-foreground flex-shrink-0">{res.date}</span>
                <button className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors flex-shrink-0" aria-label={`Descargar ${res.name}`}>
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
