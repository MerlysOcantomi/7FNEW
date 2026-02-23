"use client"

import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  Sparkles,
  Lightbulb,
  Type,
  FileText,
  Calendar,
  Search,
  Wand2,
  Send,
  Bot,
  User,
  Loader2,
} from "lucide-react"

const aiActions = [
  { id: "ideas", label: "Generar ideas", description: "Propone ideas creativas basadas en el contexto del proyecto", icon: Lightbulb, prompt: "Genera 5 ideas creativas de contenido editorial para redes sociales. " },
  { id: "mejorar", label: "Mejorar texto", description: "Refina y mejora la calidad de un copy o texto editorial", icon: Type, prompt: "Mejora y refina el siguiente texto editorial, haciendolo mas claro y atractivo: " },
  { id: "resumir", label: "Resumir contenido", description: "Genera un resumen conciso de documentos o piezas extensas", icon: FileText, prompt: "Resume el siguiente contenido de forma concisa y profesional: " },
  { id: "calendario", label: "Proponer calendario", description: "Sugiere una planificacion editorial basada en los proyectos activos", icon: Calendar, prompt: "Propone un calendario editorial semanal con contenido para Instagram, TikTok y LinkedIn. " },
  { id: "analizar", label: "Analizar pieza", description: "Evalua una pieza creativa y sugiere mejoras", icon: Search, prompt: "Analiza la siguiente pieza de contenido y sugiere mejoras editoriales: " },
  { id: "sugerir", label: "Sugerir mejoras", description: "Propone optimizaciones para contenido existente", icon: Wand2, prompt: "Sugiere optimizaciones y mejoras para el siguiente contenido: " },
]

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: string
}

export function ContentAI() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [activeAction, setActiveAction] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages])

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return

    const action = aiActions.find((a) => a.id === activeAction)
    const finalPrompt = action ? action.prompt + text : text
    const now = new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: text, timestamp: now }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setLoading(true)

    try {
      const history = messages.slice(-10).map((m) => ({ role: m.role, content: m.content }))
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "skina", message: finalPrompt, history }),
      })
      const json = await res.json()
      const aiContent = json.data?.respuesta ?? json.data ?? json.error?.message ?? "Sin respuesta"
      const aiMsg: Message = { id: `a-${Date.now()}`, role: "assistant", content: typeof aiContent === "string" ? aiContent : JSON.stringify(aiContent), timestamp: new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) }
      setMessages((prev) => [...prev, aiMsg])
    } catch {
      toast.error("Error al conectar con IA")
    } finally {
      setLoading(false)
      setActiveAction(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-lg font-semibold text-foreground">IA Editorial</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Co-creadora editorial con GPT-4.1. Genera ideas, mejora textos y planifica contenido.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {aiActions.map((action) => {
          const Icon = action.icon
          const isActive = activeAction === action.id
          return (
            <button key={action.id} onClick={() => { setActiveAction(isActive ? null : action.id) }} className={cn("rounded-xl border p-4 text-left transition-all", isActive ? "border-foreground/20 bg-card shadow-sm ring-1 ring-ring" : "border-border bg-card hover:bg-muted/30")}>
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted flex-shrink-0">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{action.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{action.description}</p>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground">Conversacion editorial</span>
          <span className="text-[10px] text-muted-foreground ml-auto">{messages.length} mensajes</span>
        </div>

        <div ref={scrollRef} className="max-h-[400px] overflow-y-auto p-5 flex flex-col gap-4">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <Bot className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">Escribe una consulta o selecciona una accion para empezar.</p>
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "")}>
              {msg.role === "assistant" && (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted flex-shrink-0 mt-0.5">
                  <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              )}
              <div className={cn("rounded-xl px-4 py-3 max-w-[85%]", msg.role === "user" ? "bg-foreground text-background" : "bg-muted/50 border border-border text-foreground")}>
                <p className="text-sm leading-relaxed whitespace-pre-line">{msg.content}</p>
                <p className={cn("text-[10px] mt-1.5", msg.role === "user" ? "text-background/60" : "text-muted-foreground")}>{msg.timestamp}</p>
              </div>
              {msg.role === "user" && (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted flex-shrink-0 mt-0.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted flex-shrink-0 mt-0.5">
                <Bot className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="rounded-xl px-4 py-3 bg-muted/50 border border-border">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border p-4">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() } }} placeholder={activeAction ? `Escribe instrucciones para: ${aiActions.find((a) => a.id === activeAction)?.label}...` : "Escribe una consulta editorial..."} rows={2} className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
            </div>
            <button onClick={handleSend} disabled={loading || !input.trim()} className={cn("flex h-10 w-10 items-center justify-center rounded-lg transition-opacity flex-shrink-0", !input.trim() || loading ? "bg-muted text-muted-foreground" : "bg-foreground text-background hover:opacity-80")} aria-label="Enviar">
              <Send className="h-4 w-4" />
            </button>
          </div>
          {activeAction && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">Accion activa:</span>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium">{aiActions.find((a) => a.id === activeAction)?.label}</span>
              <button onClick={() => setActiveAction(null)} className="text-[11px] text-muted-foreground hover:text-foreground ml-1">Cancelar</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
