import Link from "next/link"
import { notFound } from "next/navigation"
import type { ComponentType } from "react"
import { AppShell } from "@/components/app-shell"
import { SectionPage } from "@/components/section-page"
import { ArrowLeft, Bell, Database, Globe, Palette, Settings } from "lucide-react"

type SeccionConfig = {
  title: string
  description: string
  Icon: ComponentType<{ className?: string }>
}

const secciones: Record<string, SeccionConfig> = {
  notificaciones: {
    title: "Notificaciones",
    description: "Gestiona alertas, emails y canales de comunicacion internos.",
    Icon: Bell,
  },
  datos: {
    title: "Datos",
    description: "Administra respaldos, exportacion e integraciones de datos.",
    Icon: Database,
  },
  general: {
    title: "General",
    description: "Configura idioma, zona horaria y formato de la plataforma.",
    Icon: Globe,
  },
  apariencia: {
    title: "Apariencia",
    description: "Personaliza tema, colores y opciones visuales globales.",
    Icon: Palette,
  },
  avanzado: {
    title: "Avanzado",
    description: "Ajustes tecnicos como API keys, webhooks y parametros avanzados.",
    Icon: Settings,
  },
}

export default async function AdministracionSeccionPage({
  params,
}: {
  params: Promise<{ seccion: string }>
}) {
  const { seccion } = await params
  const config = secciones[seccion]
  if (!config) {
    notFound()
  }

  const Icon = config.Icon

  return (
    <AppShell
      currentSection="administracion"
      breadcrumbs={[
        { label: "7F" },
        { label: "Administracion", href: "/administracion" },
        { label: config.title },
      ]}
    >
      <SectionPage title={config.title} description={config.description}>
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted flex-shrink-0">
              <Icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                Esta seccion ya tiene ruta activa.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Si quieres, en el siguiente paso te implemento la configuracion funcional completa de esta area.
              </p>
            </div>
          </div>
        </div>

        <Link
          href="/administracion"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Administracion
        </Link>
      </SectionPage>
    </AppShell>
  )
}
