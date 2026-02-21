"use client"

import { AppShell } from "@/components/app-shell"
import { SectionPage } from "@/components/section-page"
import { Settings, Shield, Bell, Database, Globe, Palette } from "lucide-react"

const settingsGroups = [
  { icon: Shield, title: "Seguridad", description: "Permisos, roles y politicas de acceso", items: "8 configuraciones" },
  { icon: Bell, title: "Notificaciones", description: "Alertas, emails y canales de comunicacion", items: "12 configuraciones" },
  { icon: Database, title: "Datos", description: "Respaldos, exportacion e integraciones", items: "5 configuraciones" },
  { icon: Globe, title: "General", description: "Idioma, zona horaria y formato", items: "6 configuraciones" },
  { icon: Palette, title: "Apariencia", description: "Tema, colores y personalizacion visual", items: "4 configuraciones" },
  { icon: Settings, title: "Avanzado", description: "API keys, webhooks y configuracion tecnica", items: "7 configuraciones" },
]

export default function AdministracionPage() {
  return (
    <AppShell
      currentSection="administracion"
      breadcrumbs={[{ label: "7F" }, { label: "Administracion" }]}
    >
      <SectionPage
        title="Administracion"
        description="Configura los ajustes generales del sistema, permisos y preferencias."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {settingsGroups.map((group) => {
            const Icon = group.icon
            return (
              <div
                key={group.title}
                className="rounded-xl border border-border bg-card p-5 hover:shadow-sm transition-shadow cursor-pointer"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted flex-shrink-0">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-foreground">{group.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{group.description}</p>
                    <p className="mt-2 text-xs text-muted-foreground/60">{group.items}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </SectionPage>
    </AppShell>
  )
}
