"use client"

import { useState } from "react"
import { AppShell } from "@/components/app-shell"
import { SectionPage } from "@/components/section-page"
import { cn } from "@/lib/utils"
import {
  PenLine,
  Sparkles,
  Mic,
  Send,
  User,
  FolderKanban,
  CheckCircle2,
  FileText,
  MessageSquare,
  Clock,
  ArrowRight,
  Lightbulb,
  RefreshCw,
} from "lucide-react"

const recentEntries = [
  {
    id: "ent-1",
    text: "Maria de Alpha Corp llamo para decir que le gusto la version 3 del logotipo pero quiere el icono mas oscuro",
    time: "Hace 20 min",
    aiResult: {
      client: "Alpha Corp",
      project: "Rebranding Alpha Corp",
      actions: ["Crear tarea: Ajustar color de icono en logotipo v3", "Notificar a Ana Rodriguez (disenadora)"],
      type: "Solicitud de cambio",
      confidence: 94,
    },
    status: "aplicado",
  },
  {
    id: "ent-2",
    text: "Nuevo lead: Fernando Reyes de Nexus Solutions necesita sitio web corporativo con blog. Tel 55 9876 5432",
    time: "Hace 1h",
    aiResult: {
      client: "Nexus Solutions (nuevo)",
      project: null,
      actions: ["Crear cliente: Nexus Solutions", "Crear contacto: Fernando Reyes", "Crear proyecto prospecto"],
      type: "Nuevo prospecto",
      confidence: 87,
    },
    status: "pendiente",
  },
  {
    id: "ent-3",
    text: "Roberto confirmo la fase 2 de Beta Labs, dice que manda la OC manana",
    time: "Hace 3h",
    aiResult: {
      client: "Beta Labs",
      project: "Portal Beta Labs",
      actions: ["Mover proyecto a Fase 2", "Programar recordatorio: OC Beta Labs manana"],
      type: "Aprobacion de fase",
      confidence: 91,
    },
    status: "aplicado",
  },
  {
    id: "ent-4",
    text: "Sofia envio las fotos finales de Gamma. 45 imagenes en alta",
    time: "Hace 5h",
    aiResult: {
      client: "Gamma Inc",
      project: "Catalogo Gamma Inc",
      actions: ["Registrar entrega de materiales fotograficos", "Notificar al equipo de diseno"],
      type: "Entrega de materiales",
      confidence: 85,
    },
    status: "ignorado",
  },
]

const statusStyles: Record<string, string> = {
  aplicado: "bg-[var(--tab-phases)] text-foreground/70",
  pendiente: "bg-[var(--tab-tasks)] text-foreground/70",
  ignorado: "bg-muted text-muted-foreground",
}

export default function EntradaPage() {
  const [inputText, setInputText] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)

  const handleSubmit = () => {
    if (!inputText.trim()) return
    setIsProcessing(true)
    setTimeout(() => setIsProcessing(false), 1500)
  }

  return (
    <AppShell currentSection="entrada" breadcrumbs={[{ label: "7F" }, { label: "Entrada Manual" }]}>
      <SectionPage title="Entrada Manual" description="Escribe lo que dijo el cliente en lenguaje natural. La IA se encarga de clasificar, distribuir y crear las acciones correspondientes.">

        {/* Main input area */}
        <div className="rounded-xl border border-border bg-card shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <PenLine className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Que paso?</p>
              <p className="text-xs text-muted-foreground">Escribe lo que dijo el cliente, una nota de llamada, o cualquier informacion nueva.</p>
            </div>
          </div>

          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ej: 'Maria de Alpha Corp llamo para decir que le gusto la version 3 pero quiere cambios en el color...'"
            rows={4}
            className="w-full rounded-lg bg-muted/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none leading-relaxed"
          />

          <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent">
                <Mic className="h-3.5 w-3.5" /> Dictar
              </button>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lightbulb className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Escribe en lenguaje natural, la IA interpreta el contexto</span>
              </div>
            </div>
            <button
              onClick={handleSubmit}
              disabled={!inputText.trim()}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all",
                inputText.trim()
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              {isProcessing ? (
                <><RefreshCw className="h-4 w-4 animate-spin" /> Procesando...</>
              ) : (
                <><Send className="h-4 w-4" /> Procesar con IA</>
              )}
            </button>
          </div>
        </div>

        {/* AI processing preview placeholder */}
        <div className="rounded-xl border border-dashed border-[var(--tab-ai)]/50 bg-[var(--tab-ai)]/5 p-6 text-center">
          <Sparkles className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">El resultado del procesamiento aparecera aqui</p>
          <p className="text-xs text-muted-foreground/60 mt-1">La IA identificara cliente, proyecto, tipo de accion y creara tareas automaticamente</p>
        </div>

        {/* Recent entries */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Entradas recientes</h3>
            <p className="text-xs text-muted-foreground">{recentEntries.length} entradas</p>
          </div>

          <div className="flex flex-col gap-3">
            {recentEntries.map((entry) => (
              <div key={entry.id} className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                {/* Entry text */}
                <div className="px-5 py-4 border-b border-border">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-relaxed text-foreground">{entry.text}</p>
                      <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
                        <Clock className="h-3 w-3" /> {entry.time}
                      </p>
                    </div>
                    <span className={cn("rounded-md px-2.5 py-0.5 text-[10px] font-medium flex-shrink-0", statusStyles[entry.status])}>
                      {entry.status}
                    </span>
                  </div>
                </div>

                {/* AI interpretation */}
                <div className="px-5 py-4 bg-muted/20">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Interpretacion IA</p>
                    <span className="ml-auto text-[10px] text-muted-foreground">Confianza: {entry.aiResult.confidence}%</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                    <div className="flex items-center gap-2 text-xs">
                      <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground">Cliente:</span>
                      <span className="font-medium text-foreground">{entry.aiResult.client}</span>
                    </div>
                    {entry.aiResult.project && (
                      <div className="flex items-center gap-2 text-xs">
                        <FolderKanban className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <span className="text-muted-foreground">Proyecto:</span>
                        <span className="font-medium text-foreground">{entry.aiResult.project}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs">
                      <FileText className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground">Tipo:</span>
                      <span className="font-medium text-foreground">{entry.aiResult.type}</span>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Acciones propuestas:</p>
                    <div className="flex flex-col gap-1">
                      {entry.aiResult.actions.map((action, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span className="text-foreground/80">{action}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {entry.status === "pendiente" && (
                    <div className="flex items-center gap-2 mt-3">
                      <button className="flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:bg-primary/90 shadow-sm transition-opacity">
                        <CheckCircle2 className="h-3 w-3" /> Aplicar
                      </button>
                      <button className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                        Editar
                      </button>
                      <button className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                        Ignorar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </SectionPage>
    </AppShell>
  )
}
