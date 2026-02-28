"use client"

import { useState, useRef, useEffect, createContext, useContext } from "react"
import { cn } from "@/lib/utils"
import { Send, Bot, X, PanelRightClose, PanelRightOpen, Loader2 } from "lucide-react"
import { ContextBar } from "./context-bar"
import { toast } from "sonner"

interface CopilotCollapseContextType {
  copilotCollapsed: boolean
  setCopilotCollapsed: (v: boolean) => void
}
export const CopilotCollapseContext = createContext<CopilotCollapseContextType>({
  copilotCollapsed: false,
  setCopilotCollapsed: () => {},
})
export function useCopilotCollapse() {
  return useContext(CopilotCollapseContext)
}

interface Message {
  id: number
  role: "assistant" | "user"
  content: string
  timestamp: string
  tag?: string
}

function MessageBlock({ msg }: { msg: Message }) {
  const isAI = msg.role === "assistant"
  return (
    <div className={cn("flex flex-col gap-1.5", isAI ? "items-start" : "items-end")}>
      <div className="flex items-center gap-2 px-1">
        <span
          className={cn(
            "text-[9px] font-bold uppercase tracking-[0.12em]",
            isAI ? "text-[#3B82F6]" : "text-[#94A3B8]"
          )}
        >
          {isAI ? "Copilot" : "Tu"}
        </span>
        {msg.tag && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#DBEAFE] text-[#1D4ED8] font-semibold uppercase tracking-wider">
            {msg.tag}
          </span>
        )}
        <span className="text-[9px] text-[#CBD5E1] ml-auto">{msg.timestamp}</span>
      </div>
      <div
        className={cn(
          "w-full rounded-lg px-4 py-3 text-[13px] leading-relaxed",
          isAI
            ? "bg-[#EFF6FF] text-[#1E3A5F] border border-[#DBEAFE]"
            : "bg-[#F1F5F9] text-[#334155] border border-[#E2E8F0]"
        )}
      >
        <div className="whitespace-pre-line">{msg.content}</div>
      </div>
    </div>
  )
}

function InputArea({ onSend, loading }: { onSend: (text: string) => void; loading: boolean }) {
  const [input, setInput] = useState("")

  const handleSend = () => {
    const trimmed = input.trim()
    if (!trimmed || loading) return
    onSend(trimmed)
    setInput("")
  }

  return (
    <div className="px-4 pb-4 pt-3 border-t border-[#E2E8F0] shrink-0 bg-white">
      <div className="flex items-end gap-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 focus-within:border-[#3B82F6] focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.08)] transition-all">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder="Pregunta al copilot..."
          rows={1}
          disabled={loading}
          className="flex-1 resize-none bg-transparent text-sm text-[#0F172A] placeholder:text-[#94A3B8] outline-none leading-relaxed disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || loading}
          className="p-1.5 rounded-md bg-[#0F172A] text-white hover:bg-[#1E293B] disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
          aria-label="Enviar"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
        </button>
      </div>
    </div>
  )
}

function PanelContent({
  messages,
  defaultContext,
  bottomRef,
  onSend,
  onClose,
  showCloseButton,
  loading,
}: {
  messages: Message[]
  defaultContext: string
  bottomRef: React.RefObject<HTMLDivElement | null>
  onSend: (text: string) => void
  onClose?: () => void
  showCloseButton?: boolean
  loading: boolean
}) {
  return (
    <>
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E2E8F0] bg-white shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
          <span className="text-xs font-bold text-[#0F172A] tracking-wide uppercase">
            Intelligence
          </span>
        </div>
        {showCloseButton && onClose && (
          <button
            onClick={onClose}
            className="text-[#94A3B8] hover:text-[#0F172A] transition-colors p-1"
            aria-label="Cerrar Copilot"
          >
            <X size={15} />
          </button>
        )}
      </div>

      <div className="shrink-0">
        <ContextBar defaultChip={defaultContext} />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] flex items-center justify-center">
              <Bot size={18} className="text-[#3B82F6]" />
            </div>
            <p className="text-xs text-[#94A3B8] text-center max-w-[200px]">
              Pregunta lo que necesites sobre tu negocio
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBlock key={msg.id} msg={msg} />
        ))}
        {loading && (
          <div className="flex flex-col gap-1.5 items-start">
            <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#3B82F6] px-1">
              Copilot
            </span>
            <div className="w-full rounded-lg px-4 py-3 bg-[#EFF6FF] border border-[#DBEAFE] flex items-center gap-2">
              <Loader2 size={14} className="animate-spin text-[#3B82F6]" />
              <span className="text-[13px] text-[#64748B]">Procesando...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <InputArea onSend={onSend} loading={loading} />
    </>
  )
}

interface CopilotPanelProps {
  defaultContext?: string
}

export function CopilotPanel({ defaultContext = "Flow" }: CopilotPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [tabletOpen, setTabletOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const { copilotCollapsed, setCopilotCollapsed } = useCopilotCollapse()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  const handleSend = async (text: string) => {
    const now = new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
    setMessages((prev) => [...prev, { id: Date.now(), role: "user", content: text, timestamp: now }])
    setLoading(true)

    try {
      const history = messages.slice(-20).map((m) => ({ role: m.role, content: m.content }))
      const res = await fetch("/api/ai/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      })
      const json = await res.json()
      const data = json.data ?? {}
      const content = data.respuesta ?? json.error?.message ?? "Sin respuesta"

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: typeof content === "string" ? content : JSON.stringify(content),
          timestamp: new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
          tag: data.actions?.length ? "Accion" : undefined,
        },
      ])
    } catch {
      toast.error("Error de conexion con el copilot")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Desktop: collapsible right panel */}
      <div className="hidden lg:flex items-stretch shrink-0 transition-all duration-300">
        <div className="flex items-start pt-4">
          <button
            onClick={() => setCopilotCollapsed(!copilotCollapsed)}
            className="flex items-center justify-center w-6 h-10 bg-[#F1F5F9] hover:bg-[#E2E8F0] border border-[#E2E8F0] rounded-l-md transition-colors text-[#64748B] hover:text-[#0F172A]"
            aria-label={copilotCollapsed ? "Expandir Copilot" : "Colapsar Copilot"}
          >
            {copilotCollapsed ? <PanelRightOpen size={13} /> : <PanelRightClose size={13} />}
          </button>
        </div>

        {!copilotCollapsed && (
          <aside className="flex flex-col w-80 xl:w-[22rem] border-l border-[#E2E8F0] bg-white h-screen sticky top-0 overflow-hidden">
            <PanelContent
              messages={messages}
              defaultContext={defaultContext}
              bottomRef={bottomRef}
              onSend={handleSend}
              loading={loading}
            />
          </aside>
        )}
      </div>

      {/* Tablet: slide-in panel */}
      <div className="hidden md:flex lg:hidden">
        {!tabletOpen && (
          <button
            onClick={() => setTabletOpen(true)}
            className="fixed right-0 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center justify-center gap-1.5 w-8 h-24 bg-[#0F172A] rounded-l-xl text-[#94A3B8] hover:text-white transition-colors shadow-lg"
            aria-label="Abrir Copilot"
          >
            <Bot size={14} />
          </button>
        )}
        {tabletOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            onClick={() => setTabletOpen(false)}
          />
        )}
        <aside
          className={cn(
            "fixed top-0 right-0 z-50 h-full w-80 bg-white border-l border-[#E2E8F0] flex flex-col shadow-2xl transition-transform duration-300",
            tabletOpen ? "translate-x-0" : "translate-x-full"
          )}
        >
          <PanelContent
            messages={messages}
            defaultContext={defaultContext}
            bottomRef={bottomRef}
            onSend={handleSend}
            showCloseButton
            onClose={() => setTabletOpen(false)}
            loading={loading}
          />
        </aside>
      </div>

      {/* Mobile: bottom sheet */}
      <div className="md:hidden">
        {!mobileOpen && (
          <button
            onClick={() => setMobileOpen(true)}
            className="fixed bottom-5 right-5 z-40 w-12 h-12 rounded-full bg-[#0F172A] text-white flex items-center justify-center shadow-xl hover:bg-[#1E293B] transition-colors"
            aria-label="Abrir Copilot"
          >
            <Bot size={18} />
          </button>
        )}
        {mobileOpen && (
          <>
            <div
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <div className="fixed bottom-0 left-0 right-0 z-50 h-[88dvh] bg-white rounded-t-2xl flex flex-col shadow-2xl border-t border-[#E2E8F0]">
              <div className="flex justify-center pt-3 pb-1 shrink-0">
                <div className="w-10 h-1 rounded-full bg-[#E2E8F0]" />
              </div>
              <PanelContent
                messages={messages}
                defaultContext={defaultContext}
                bottomRef={bottomRef}
                onSend={handleSend}
                showCloseButton
                onClose={() => setMobileOpen(false)}
                loading={loading}
              />
            </div>
          </>
        )}
      </div>
    </>
  )
}
