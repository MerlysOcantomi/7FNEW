"use client"

import { useState, useRef, useEffect } from "react"
import { AppShell } from "@/components/app-shell"
import { SectionPage } from "@/components/section-page"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  Bot,
  User,
  Send,
  Loader2,
  FileText,
  Mail,
  Calendar,
  Users,
  Megaphone,
  ListChecks,
  Languages,
  Sparkles,
  Trash2,
  Clock,
  Image as ImageIcon,
  PenLine,
  Lightbulb,
  BarChart3,
  CheckCircle2,
  Zap,
  ExternalLink,
} from "lucide-react"

interface AgentAction {
  tool: string
  args: Record<string, any>
  result: { success: boolean; data?: any; error?: string; imageUrl?: string }
}

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: string
  images?: string[]
  actions?: AgentAction[]
}

const quickActions = [
  { id: "prioridades", label: "Prioridades de hoy", icon: ListChecks, prompt: "Dame las prioridades de hoy. Revisa tareas pendientes, facturas vencidas y deadlines proximos. Ordenalas por urgencia." },
  { id: "resumen", label: "Resumen semanal", icon: Clock, prompt: "Prepara un resumen semanal: estado de proyectos, tareas completadas, facturas pendientes, campanas activas y proximos deadlines." },
  { id: "factura", label: "Redactar factura", icon: FileText, prompt: "Necesito redactar una factura. Preguntame los datos: cliente, servicios, cantidades, precios e idioma." },
  { id: "email", label: "Redactar email", icon: Mail, prompt: "Ayudame a redactar un email profesional. Preguntame el destinatario, el asunto y el idioma." },
  { id: "contenido", label: "Plan de contenido", icon: Megaphone, prompt: "Propone un plan de contenido para esta semana para Instagram y LinkedIn. Incluye tipo de post, copy y hashtags. Crea las piezas directamente en el modulo." },
  { id: "clientes", label: "Estado de clientes", icon: Users, prompt: "Dame un resumen del estado de mis clientes: proyectos activos, facturas pendientes y si alguno necesita seguimiento." },
  { id: "calendario", label: "Revisar calendario", icon: Calendar, prompt: "Revisa mi calendario de esta semana. Identifica conflictos, deadlines y prioridades." },
  { id: "ideas", label: "Generar ideas", icon: Lightbulb, prompt: "Genera 5 ideas creativas de contenido para redes sociales para esta semana. Guardalas en el banco de ideas." },
  { id: "imagen", label: "Generar imagen", icon: ImageIcon, prompt: "Genera una imagen editorial minimalista en estilo Skina para un post de Instagram. Tema: inspiracion, creatividad y diseno suizo." },
  { id: "campana", label: "Crear campana", icon: Zap, prompt: "Crea una campana de marketing para esta quincena con nombre, descripcion, objetivos y fechas. Marca: Skina." },
  { id: "analisis", label: "Analisis de riesgos", icon: BarChart3, prompt: "Analiza los riesgos actuales del negocio: proyectos retrasados, facturas vencidas, clientes sin respuesta y tareas urgentes sin asignar." },
  { id: "traducir", label: "Traducir contenido", icon: Languages, prompt: "Necesito traducir contenido. Preguntame el texto, el idioma de origen y el de destino." },
]

const TOOL_LABELS: Record<string, string> = {
  buscar_clientes: "Busco clientes",
  detalle_cliente: "Consulto cliente",
  detalle_proyecto: "Consulto proyecto",
  buscar_tareas: "Reviso tareas",
  buscar_facturas: "Reviso facturas",
  crear_contenido: "Creo contenido",
  crear_idea: "Guardo idea",
  crear_tarea: "Creo tarea",
  crear_campana: "Creo campana",
  generar_imagen: "Genero imagen",
}

export default function AgentePage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [toolsInProgress, setToolsInProgress] = useState<string[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, toolsInProgress])

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return
    const now = new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: text.trim(), timestamp: now }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setLoading(true)
    setToolsInProgress([])

    try {
      const history = messages.slice(-20).map((m) => ({ role: m.role, content: m.content }))
      const res = await fetch("/api/ai/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text.trim(), history }),
      })
      const json = await res.json()
      const data = json.data ?? {}
      const content = data.respuesta ?? json.error?.message ?? "Sin respuesta"
      const aiMsg: Message = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: typeof content === "string" ? content : JSON.stringify(content),
        timestamp: new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
        images: data.images ?? undefined,
        actions: data.actions ?? undefined,
      }
      setMessages((prev) => [...prev, aiMsg])
    } catch {
      toast.error("Error de conexion con el agente")
    } finally {
      setLoading(false)
      setToolsInProgress([])
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <AppShell currentSection="agente" breadcrumbs={[{ label: "7F" }, { label: "Agente Hibrido 7F–Skina" }]}>
      <SectionPage title="Agente Hibrido 7F–Skina" description="Operativo + Creativo + Autonomo. GPT-4.1 con acceso a tu negocio, DALL-E 3 para imagenes.">

        {/* Quick actions — initial state */}
        {messages.length === 0 && (
          <div className="flex flex-col gap-5">
            <div className="text-center py-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-muted to-muted/50 mx-auto mb-4 border border-border">
                <Bot className="h-8 w-8 text-foreground/60" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Hola, Merlys</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-lg mx-auto">
                Soy tu agente hibrido. Puedo operar tu empresa, crear contenido, generar imagenes, 
                planificar campanas y gestionar clientes. Todo desde aqui.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {quickActions.map((action) => {
                const Icon = action.icon
                return (
                  <button key={action.id} onClick={() => sendMessage(action.prompt)} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left hover:bg-muted/30 transition-colors group">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted flex-shrink-0 group-hover:bg-foreground/10 transition-colors">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <span className="text-sm font-medium text-foreground">{action.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Chat interface */}
        {messages.length > 0 && (
          <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col" style={{ height: "calc(100vh - 280px)", minHeight: "500px" }}>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-foreground/60" />
                <span className="text-xs font-semibold text-foreground">Agente Hibrido</span>
                <span className="rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-medium">GPT-4.1 + DALL-E 3</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">{messages.length} msgs</span>
                <button onClick={() => setMessages([])} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground" title="Limpiar">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
              {messages.map((msg) => (
                <div key={msg.id} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "")}>
                  {msg.role === "assistant" && (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted flex-shrink-0 mt-0.5">
                      <Bot className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className={cn("max-w-[85%] flex flex-col gap-2")}>
                    {/* Actions executed */}
                    {msg.actions && msg.actions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {msg.actions.map((a, i) => (
                          <span key={i} className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium", a.result.success ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400")}>
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            {TOOL_LABELS[a.tool] || a.tool}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Text */}
                    <div className={cn("rounded-xl px-4 py-3", msg.role === "user" ? "bg-foreground text-background" : "bg-muted/50 border border-border text-foreground")}>
                      <div className="text-sm leading-relaxed whitespace-pre-line">{msg.content}</div>
                      <p className={cn("text-[10px] mt-1.5", msg.role === "user" ? "text-background/60" : "text-muted-foreground")}>{msg.timestamp}</p>
                    </div>

                    {/* Images */}
                    {msg.images && msg.images.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {msg.images.map((url, i) => (
                          <div key={i} className="relative group">
                            <img src={url} alt={`Imagen generada ${i + 1}`} className="rounded-xl border border-border max-w-[300px] max-h-[300px] object-cover" />
                            <a href={url} target="_blank" rel="noopener noreferrer" className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-lg bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted flex-shrink-0 mt-0.5">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}

              {/* Loading state */}
              {loading && (
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted flex-shrink-0 mt-0.5">
                    <Bot className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="rounded-xl px-4 py-3 bg-muted/50 border border-border flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Procesando...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quick chips */}
            <div className="border-t border-border px-4 py-2 flex items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              {[
                { label: "Prioridades", prompt: quickActions[0].prompt },
                { label: "Ideas", prompt: quickActions[7].prompt },
                { label: "Contenido", prompt: quickActions[4].prompt },
                { label: "Imagen", prompt: quickActions[8].prompt },
                { label: "Clientes", prompt: quickActions[5].prompt },
                { label: "Campana", prompt: quickActions[9].prompt },
                { label: "Analisis", prompt: quickActions[10].prompt },
              ].map((c) => (
                <button key={c.label} onClick={() => sendMessage(c.prompt)} disabled={loading} className="flex-shrink-0 rounded-full border border-border px-3 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50">
                  {c.label}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="border-t border-border p-4">
              <div className="flex items-end gap-3">
                <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Preguntale al agente... (operativo, creativo, imagenes, campanas, lo que necesites)" rows={2} className="flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none" autoFocus />
                <button onClick={() => sendMessage(input)} disabled={loading || !input.trim()} className={cn("flex h-10 w-10 items-center justify-center rounded-lg transition-opacity flex-shrink-0", !input.trim() || loading ? "bg-muted text-muted-foreground" : "bg-foreground text-background hover:opacity-80")} aria-label="Enviar">
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Capabilities footer — initial state */}
        {messages.length === 0 && (
          <>
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-semibold text-foreground">Capacidades del agente</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Operativo</p>
                  {["Priorizar tareas del dia", "Detectar facturas vencidas", "Revisar proyectos en riesgo", "Alertas de clientes", "Informes semanales", "Emails multilingues"].map((item) => (
                    <div key={item} className="flex items-center gap-2 py-0.5">
                      <div className="h-1 w-1 rounded-full bg-blue-500 flex-shrink-0" />
                      <span className="text-xs text-muted-foreground">{item}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Creativo</p>
                  {["Generar ideas de contenido", "Planificar campanas", "Copywriting Skina/7F", "Guiones para reels", "Hashtags y titulos", "Calendarios editoriales"].map((item) => (
                    <div key={item} className="flex items-center gap-2 py-0.5">
                      <div className="h-1 w-1 rounded-full bg-purple-500 flex-shrink-0" />
                      <span className="text-xs text-muted-foreground">{item}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Generativo</p>
                  {["Imagenes con DALL-E 3", "Crear piezas de contenido", "Crear tareas y campanas", "Guardar ideas al banco", "Facturas en 6 idiomas", "Acciones en la base de datos"].map((item) => (
                    <div key={item} className="flex items-center gap-2 py-0.5">
                      <div className="h-1 w-1 rounded-full bg-emerald-500 flex-shrink-0" />
                      <span className="text-xs text-muted-foreground">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Initial input */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-end gap-3">
                <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Escribe tu primera consulta..." rows={2} className="flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none" autoFocus />
                <button onClick={() => sendMessage(input)} disabled={loading || !input.trim()} className={cn("flex h-10 w-10 items-center justify-center rounded-lg transition-opacity flex-shrink-0", !input.trim() || loading ? "bg-muted text-muted-foreground" : "bg-foreground text-background hover:opacity-80")} aria-label="Enviar">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </>
        )}

      </SectionPage>
    </AppShell>
  )
}
