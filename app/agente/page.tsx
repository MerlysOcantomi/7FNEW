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
} from "lucide-react"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: string
}

const quickActions = [
  { id: "prioridades", label: "Prioridades de hoy", icon: ListChecks, prompt: "Dame las prioridades de hoy. Revisa tareas pendientes, facturas vencidas y deadlines proximos. Ordenalas por urgencia." },
  { id: "resumen", label: "Resumen semanal", icon: Clock, prompt: "Prepara un resumen semanal: estado de proyectos, tareas completadas, facturas pendientes, campanas activas y proximos deadlines." },
  { id: "factura-es", label: "Redactar factura", icon: FileText, prompt: "Necesito redactar una factura. Preguntame los datos: cliente, servicios, cantidades, precios e idioma." },
  { id: "email", label: "Redactar email", icon: Mail, prompt: "Ayudame a redactar un email profesional. Preguntame el destinatario, el asunto y el idioma." },
  { id: "contenido", label: "Plan de contenido", icon: Megaphone, prompt: "Propone un plan de contenido para esta semana para Instagram y LinkedIn. Incluye tipo de post, copy y hashtags." },
  { id: "clientes", label: "Estado de clientes", icon: Users, prompt: "Dame un resumen del estado de mis clientes: proyectos activos, facturas pendientes y si alguno necesita seguimiento." },
  { id: "calendario", label: "Revisar calendario", icon: Calendar, prompt: "Revisa mi calendario de esta semana. Identifica conflictos, deadlines y prioridades." },
  { id: "traducir", label: "Traducir contenido", icon: Languages, prompt: "Necesito traducir contenido. Preguntame el texto, el idioma de origen y el de destino." },
]

export default function AgentePage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
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
      const content = json.data?.respuesta ?? json.error?.message ?? "Sin respuesta del agente"
      const aiMsg: Message = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: typeof content === "string" ? content : JSON.stringify(content),
        timestamp: new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
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

  return (
    <AppShell currentSection="agente" breadcrumbs={[{ label: "7F" }, { label: "Agente Ejecutivo" }]}>
      <SectionPage title="Agente Ejecutivo 7F" description="Asistente autonomo con GPT-4.1. Gestiona facturas, emails, contenido, calendario y clientes.">

        {/* Quick actions */}
        {messages.length === 0 && (
          <div className="flex flex-col gap-5">
            <div className="text-center py-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mx-auto mb-4">
                <Bot className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Hola, Merlys</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                Soy tu agente ejecutivo. Conozco tus clientes, proyectos, facturas y calendario. 
                Preguntame lo que necesites o usa una accion rapida.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {quickActions.map((action) => {
                const Icon = action.icon
                return (
                  <button key={action.id} onClick={() => sendMessage(action.prompt)} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left hover:bg-muted/30 transition-colors group">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted flex-shrink-0 group-hover:bg-foreground/10 transition-colors">
                      <Icon className="h-4.5 w-4.5 text-muted-foreground" />
                    </div>
                    <span className="text-sm font-medium text-foreground">{action.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Chat */}
        {messages.length > 0 && (
          <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col" style={{ height: "calc(100vh - 280px)", minHeight: "400px" }}>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-semibold text-foreground">Agente Ejecutivo</span>
                <span className="rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-medium">GPT-4.1</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">{messages.length} msgs</span>
                <button onClick={() => setMessages([])} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground" title="Limpiar conversacion">
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
                  <div className={cn("rounded-xl px-4 py-3 max-w-[85%]", msg.role === "user" ? "bg-foreground text-background" : "bg-muted/50 border border-border text-foreground")}>
                    <div className="text-sm leading-relaxed whitespace-pre-line">{msg.content}</div>
                    <p className={cn("text-[10px] mt-1.5", msg.role === "user" ? "text-background/60" : "text-muted-foreground")}>{msg.timestamp}</p>
                  </div>
                  {msg.role === "user" && (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted flex-shrink-0 mt-0.5">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted flex-shrink-0 mt-0.5">
                    <Bot className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="rounded-xl px-4 py-3 bg-muted/50 border border-border flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Analizando...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick action chips */}
            <div className="border-t border-border px-4 py-2 flex items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              {quickActions.slice(0, 5).map((a) => (
                <button key={a.id} onClick={() => sendMessage(a.prompt)} disabled={loading} className="flex-shrink-0 rounded-full border border-border px-3 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50">
                  {a.label}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="border-t border-border p-4">
              <div className="flex items-end gap-3">
                <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Preguntale al agente..." rows={2} className="flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none" autoFocus />
                <button onClick={() => sendMessage(input)} disabled={loading || !input.trim()} className={cn("flex h-10 w-10 items-center justify-center rounded-lg transition-opacity flex-shrink-0", !input.trim() || loading ? "bg-muted text-muted-foreground" : "bg-foreground text-background hover:opacity-80")} aria-label="Enviar">
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Info footer when no messages */}
        {messages.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-semibold text-foreground">Que puede hacer el agente</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
              {[
                "Redactar facturas en 6 idiomas",
                "Preparar campanas de marketing",
                "Generar contenido editorial",
                "Clasificar y responder emails",
                "Priorizar tareas del dia",
                "Preparar resumenes semanales",
                "Conocer historial de clientes",
                "Gestionar el calendario",
                "Detectar facturas vencidas",
                "Sugerir seguimiento de clientes",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 py-1">
                  <div className="h-1 w-1 rounded-full bg-foreground/30 flex-shrink-0" />
                  <span className="text-xs text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Invisible input area when no chat yet */}
        {messages.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-end gap-3">
              <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Escribe tu primera consulta al agente..." rows={2} className="flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none" autoFocus />
              <button onClick={() => sendMessage(input)} disabled={loading || !input.trim()} className={cn("flex h-10 w-10 items-center justify-center rounded-lg transition-opacity flex-shrink-0", !input.trim() || loading ? "bg-muted text-muted-foreground" : "bg-foreground text-background hover:opacity-80")} aria-label="Enviar">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>
        )}

      </SectionPage>
    </AppShell>
  )
}
