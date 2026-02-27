"use client"

import { useState, useRef, useEffect } from "react"
import { AppShell } from "@/components/app-shell"
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
  Lightbulb,
  BarChart3,
  CheckCircle2,
  Zap,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  ArrowRight,
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

const primaryActions = [
  {
    id: "prioridades",
    label: "Prioridades de hoy",
    description: "Tareas urgentes y deadlines proximos",
    icon: ListChecks,
    prompt: "Dame las prioridades de hoy. Revisa tareas pendientes, facturas vencidas y deadlines proximos. Ordenalas por urgencia.",
  },
  {
    id: "resumen",
    label: "Resumen semanal",
    description: "Estado general de tu empresa",
    icon: Clock,
    prompt: "Prepara un resumen semanal: estado de proyectos, tareas completadas, facturas pendientes, campanas activas y proximos deadlines.",
  },
  {
    id: "calendario",
    label: "Revisar calendario",
    description: "Conflictos y eventos de la semana",
    icon: Calendar,
    prompt: "Revisa mi calendario de esta semana. Identifica conflictos, deadlines y prioridades.",
  },
  {
    id: "clientes",
    label: "Estado de clientes",
    description: "Seguimiento y facturas pendientes",
    icon: Users,
    prompt: "Dame un resumen del estado de mis clientes: proyectos activos, facturas pendientes y si alguno necesita seguimiento.",
  },
]

const moreActions = [
  { id: "factura", label: "Redactar factura", description: "Genera una factura profesional", icon: FileText, prompt: "Necesito redactar una factura. Preguntame los datos: cliente, servicios, cantidades, precios e idioma." },
  { id: "email", label: "Redactar email", description: "Email profesional multilingue", icon: Mail, prompt: "Ayudame a redactar un email profesional. Preguntame el destinatario, el asunto y el idioma." },
  { id: "contenido", label: "Plan de contenido", description: "Estrategia semanal de redes", icon: Megaphone, prompt: "Propone un plan de contenido para esta semana para Instagram y LinkedIn. Incluye tipo de post, copy y hashtags. Crea las piezas directamente en el modulo." },
  { id: "ideas", label: "Generar ideas", description: "Ideas creativas para contenido", icon: Lightbulb, prompt: "Genera 5 ideas creativas de contenido para redes sociales para esta semana. Guardalas en el banco de ideas." },
  { id: "imagen", label: "Generar imagen", description: "Imagen editorial con IA", icon: ImageIcon, prompt: "Genera una imagen editorial minimalista en estilo Skina para un post de Instagram. Tema: inspiracion, creatividad y diseno suizo." },
  { id: "campana", label: "Crear campana", description: "Campana de marketing completa", icon: Zap, prompt: "Crea una campana de marketing para esta quincena con nombre, descripcion, objetivos y fechas. Marca: Skina." },
  { id: "analisis", label: "Analisis de riesgos", description: "Detectar problemas del negocio", icon: BarChart3, prompt: "Analiza los riesgos actuales del negocio: proyectos retrasados, facturas vencidas, clientes sin respuesta y tareas urgentes sin asignar." },
  { id: "traducir", label: "Traducir contenido", description: "Traduccion profesional", icon: Languages, prompt: "Necesito traducir contenido. Preguntame el texto, el idioma de origen y el de destino." },
]

const allActionsForChips = [...primaryActions, ...moreActions]

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

const capabilities = [
  {
    title: "Operativo",
    color: "bg-blue-600",
    items: ["Priorizar tareas del dia", "Detectar facturas vencidas", "Revisar proyectos en riesgo", "Alertas de clientes", "Informes semanales", "Emails multilingues"],
  },
  {
    title: "Creativo",
    color: "bg-purple-600",
    items: ["Generar ideas de contenido", "Planificar campanas", "Copywriting profesional", "Guiones para reels", "Hashtags y titulos", "Calendarios editoriales"],
  },
  {
    title: "Generativo",
    color: "bg-emerald-600",
    items: ["Imagenes con IA", "Crear piezas de contenido", "Crear tareas y campanas", "Guardar ideas al banco", "Facturas en 6 idiomas", "Acciones en base de datos"],
  },
]

export default function AgentePage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [capabilitiesOpen, setCapabilitiesOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages])

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return
    const now = new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: text.trim(), timestamp: now }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setLoading(true)

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
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const hasMessages = messages.length > 0

  return (
    <AppShell currentSection="agente" breadcrumbs={[{ label: "7F" }, { label: "Asistente" }]}>
      <div className="flex flex-col gap-6">

        {/* ─── HEADER ─── */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-[#111827]">Asistente</h1>
              <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-600 ring-1 ring-inset ring-purple-200">
                <Sparkles className="h-3 w-3" />
                AI
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Centro de control de tu empresa</p>
          </div>
          {hasMessages && (
            <button
              onClick={() => setMessages([])}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
              Nueva conversacion
            </button>
          )}
        </div>

        {/* ─── INITIAL STATE ─── */}
        {!hasMessages && (
          <>
            {/* Welcome */}
            <div className="rounded-xl border border-border bg-white shadow-sm">
              <div className="h-0.5 rounded-t-xl bg-purple-600/60" />
              <div className="px-6 py-5 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-50 mx-auto mb-3">
                  <Bot className="h-7 w-7 text-purple-600" />
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground max-w-md mx-auto">
                  Gestiona tu empresa desde aqui: revisa prioridades, genera contenido,
                  crea facturas y controla el estado de tus proyectos.
                </p>
              </div>
            </div>

            {/* Quick Actions — primary */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-3">Acciones rapidas</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {primaryActions.map((action) => {
                  const Icon = action.icon
                  return (
                    <button
                      key={action.id}
                      onClick={() => sendMessage(action.prompt)}
                      className="group flex flex-col gap-2 rounded-xl border border-border bg-card p-4 text-left transition-all hover:shadow-md hover:border-blue-200"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 group-hover:bg-blue-100 transition-colors">
                        <Icon className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#111827]">{action.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* More actions — expandable */}
            <div>
              <button
                onClick={() => setShowMore(!showMore)}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mb-3"
              >
                {showMore ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                Mas acciones ({moreActions.length})
              </button>
              {showMore && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {moreActions.map((action) => {
                    const Icon = action.icon
                    return (
                      <button
                        key={action.id}
                        onClick={() => sendMessage(action.prompt)}
                        className="group flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 text-left transition-all hover:shadow-md hover:border-blue-200"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted group-hover:bg-blue-50 transition-colors flex-shrink-0">
                          <Icon className="h-4 w-4 text-muted-foreground group-hover:text-blue-600 transition-colors" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#111827] truncate">{action.label}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{action.description}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Capabilities — collapsible */}
            <div className="rounded-xl border border-border bg-card">
              <button
                onClick={() => setCapabilitiesOpen(!capabilitiesOpen)}
                className="flex w-full items-center justify-between px-5 py-4 text-left"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50">
                    <Sparkles className="h-4 w-4 text-purple-600" />
                  </div>
                  <span className="text-sm font-semibold text-[#111827]">Capacidades del asistente</span>
                </div>
                {capabilitiesOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
              {capabilitiesOpen && (
                <div className="border-t border-border px-5 py-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    {capabilities.map((cat) => (
                      <div key={cat.title}>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-2.5">{cat.title}</p>
                        <div className="flex flex-col gap-1.5">
                          {cat.items.map((item) => (
                            <div key={item} className="flex items-center gap-2">
                              <div className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", cat.color)} />
                              <span className="text-xs text-muted-foreground">{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Initial input */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-end gap-3">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Escribe lo que necesitas..."
                  rows={2}
                  className="flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-none transition-shadow"
                  autoFocus
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={loading || !input.trim()}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg transition-all flex-shrink-0",
                    !input.trim() || loading
                      ? "bg-muted text-muted-foreground"
                      : "bg-[#2563eb] text-white hover:bg-[#1d4ed8] shadow-sm"
                  )}
                  aria-label="Enviar"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ─── CHAT STATE ─── */}
        {hasMessages && (
          <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col" style={{ height: "calc(100vh - 220px)", minHeight: "500px" }}>
            {/* Chat header */}
            <div className="flex items-center justify-between border-b border-border px-5 py-3 bg-white">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50">
                  <Bot className="h-4 w-4 text-purple-600" />
                </div>
                <span className="text-sm font-semibold text-[#111827]">Conversacion</span>
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </div>
              <span className="text-[10px] text-muted-foreground">{messages.length} mensaje{messages.length !== 1 ? "s" : ""}</span>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">
              {messages.map((msg) => (
                <div key={msg.id} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "")}>
                  {msg.role === "assistant" && (
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 flex-shrink-0 mt-0.5">
                      <Bot className="h-4 w-4 text-purple-600" />
                    </div>
                  )}
                  <div className="max-w-[80%] flex flex-col gap-2">
                    {msg.actions && msg.actions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {msg.actions.map((a, i) => (
                          <span
                            key={i}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium",
                              a.result.success
                                ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
                                : "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200"
                            )}
                          >
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            {TOOL_LABELS[a.tool] || a.tool}
                          </span>
                        ))}
                      </div>
                    )}

                    <div
                      className={cn(
                        "rounded-xl px-4 py-3",
                        msg.role === "user"
                          ? "bg-[#111827] text-white"
                          : "bg-muted/40 border border-border text-[#111827]"
                      )}
                    >
                      <div className="text-sm leading-relaxed whitespace-pre-line">{msg.content}</div>
                      <p className={cn("text-[10px] mt-2", msg.role === "user" ? "text-white/50" : "text-muted-foreground/60")}>
                        {msg.timestamp}
                      </p>
                    </div>

                    {msg.images && msg.images.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {msg.images.map((url, i) => (
                          <div key={i} className="relative group">
                            <img src={url} alt={`Imagen generada ${i + 1}`} className="rounded-xl border border-border max-w-[300px] max-h-[300px] object-cover" />
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-lg bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted flex-shrink-0 mt-0.5">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 flex-shrink-0 mt-0.5">
                    <Bot className="h-4 w-4 text-purple-600" />
                  </div>
                  <div className="rounded-xl px-4 py-3 bg-muted/40 border border-border flex items-center gap-2.5">
                    <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                    <span className="text-xs text-muted-foreground">Procesando tu solicitud...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick chips */}
            <div className="border-t border-border px-4 py-2.5 flex items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              {[
                allActionsForChips[0],
                allActionsForChips[1],
                allActionsForChips[2],
                allActionsForChips[3],
                allActionsForChips[7],
                allActionsForChips[8],
                allActionsForChips[10],
              ].map((c) => (
                <button
                  key={c.id}
                  onClick={() => sendMessage(c.prompt)}
                  disabled={loading}
                  className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50/50 transition-all disabled:opacity-50"
                >
                  <ArrowRight className="h-3 w-3" />
                  {c.label}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="border-t border-border p-4 bg-white">
              <div className="flex items-end gap-3">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Escribe lo que necesitas..."
                  rows={2}
                  className="flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-none transition-shadow"
                  autoFocus
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={loading || !input.trim()}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg transition-all flex-shrink-0",
                    !input.trim() || loading
                      ? "bg-muted text-muted-foreground"
                      : "bg-[#2563eb] text-white hover:bg-[#1d4ed8] shadow-sm"
                  )}
                  aria-label="Enviar"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
