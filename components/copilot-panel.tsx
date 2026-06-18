"use client";

import { useState, useRef, useEffect, useCallback, createContext, useContext } from "react";
import { cn } from "@/lib/utils";
import { Send, Bot, X, PanelRightClose, PanelRightOpen, Loader2 } from "lucide-react";
import { ContextBar } from "./context-bar";

// ── Collapse Context (shared with layout) ────────────────────────────────────
interface CopilotCollapseContextType {
  copilotCollapsed: boolean;
  setCopilotCollapsed: (v: boolean) => void;
}
export const CopilotCollapseContext = createContext<CopilotCollapseContextType>({
  copilotCollapsed: false,
  setCopilotCollapsed: () => {},
});
export function useCopilotCollapse() {
  return useContext(CopilotCollapseContext);
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface Message {
  id: number;
  role: "assistant" | "user";
  content: string;
  timestamp: string;
  tag?: string;
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: 1,
    role: "assistant",
    content:
      "Hello. I'm your workspace assistant powered by Mr. Forte. Ask me anything about your projects, clients, tasks, or business — I can look up real data and help you take action.",
    timestamp: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
  },
];

interface CopilotPanelProps {
  defaultContext?: string;
}

// ── Message Block ─────────────────────────────────────────────────────────────
function MessageBlock({ msg }: { msg: Message }) {
  const isAI = msg.role === "assistant";
  return (
    <div className={cn("flex flex-col gap-1.5", isAI ? "items-start" : "items-end")}>
      {/* Sender label + time */}
      <div className="flex items-center gap-2 px-1">
        <span
          className={cn(
            "text-[9px] font-bold uppercase tracking-[0.12em]",
            isAI ? "text-[#3B82F6]" : "text-muted-foreground"
          )}
        >
          {isAI ? "Copilot" : "You"}
        </span>
        {msg.tag && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#DBEAFE] text-[#1D4ED8] font-semibold uppercase tracking-wider">
            {msg.tag}
          </span>
        )}
        <span className="text-[9px] text-muted-foreground ml-auto">{msg.timestamp}</span>
      </div>

      {/* Content block */}
      <div
        className={cn(
          "w-full rounded-lg px-4 py-3 text-[13px] leading-relaxed",
          isAI
            ? "bg-[#EFF6FF] text-[#1E3A5F] border border-[#DBEAFE]"
            : "bg-muted text-foreground border border-border"
        )}
      >
        {msg.content}
      </div>
    </div>
  );
}

// ── Input Area ────────────────────────────────────────────────────────────────
function InputArea({ onSend, disabled }: { onSend: (text: string) => void; disabled?: boolean }) {
  const [input, setInput] = useState("");

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setInput("");
  };

  return (
    <div className="px-4 pb-4 pt-3 border-t border-border shrink-0 bg-card">
      <div className="flex items-end gap-2 bg-background border border-border rounded-lg px-3 py-2 focus-within:border-[#3B82F6] focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.08)] transition-all">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={disabled ? "Thinking..." : "Ask the assistant..."}
          rows={1}
          disabled={disabled}
          className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none leading-relaxed disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || disabled}
          className="p-1.5 rounded-md bg-foreground text-background hover:bg-foreground/90 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
          aria-label="Send"
        >
          {disabled ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
        </button>
      </div>
    </div>
  );
}

// ── Panel Inner Content ───────────────────────────────────────────────────────
function PanelContent({
  messages,
  defaultContext,
  bottomRef,
  onSend,
  onClose,
  showCloseButton,
  isLoading,
}: {
  messages: Message[];
  defaultContext: string;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  onSend: (text: string) => void;
  onClose?: () => void;
  showCloseButton?: boolean;
  isLoading?: boolean;
}) {
  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2">
          <div className={cn("w-1.5 h-1.5 rounded-full", isLoading ? "bg-[var(--status-warning-text)] animate-pulse" : "bg-[#3B82F6]")} />
          <span className="text-xs font-bold text-foreground tracking-wide uppercase">
            Intelligence
          </span>
        </div>
        {showCloseButton && onClose && (
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
            aria-label="Close Copilot"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Context Bar */}
      <div className="shrink-0">
        <ContextBar defaultChip={defaultContext} />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg) => (
          <MessageBlock key={msg.id} msg={msg} />
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 px-1">
            <Loader2 size={12} className="text-[#3B82F6] animate-spin" />
            <span className="text-[11px] text-muted-foreground">Thinking...</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <InputArea onSend={onSend} disabled={isLoading} />
    </>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────
export function CopilotPanel({ defaultContext = "Overview" }: CopilotPanelProps) {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [tabletOpen, setTabletOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { copilotCollapsed, setCopilotCollapsed } = useCopilotCollapse();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const [isLoading, setIsLoading] = useState(false);

  const handleSend = useCallback(async (text: string) => {
    const now = () =>
      new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

    const userMsg: Message = { id: Date.now(), role: "user", content: text, timestamp: now() };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const history = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-20)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/ai/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message ?? `Error ${res.status}`);
      }

      const data = await res.json();
      const respuesta = data.data?.respuesta ?? data.respuesta ?? "No response received.";

      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, role: "assistant", content: respuesta, timestamp: now() },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: `I couldn't process that request. ${err instanceof Error ? err.message : "Please try again."}`,
          timestamp: now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [messages]);

  return (
    <>
      {/* ── Desktop: collapsible right panel (lg+) ── */}
      <div className="hidden lg:flex items-stretch shrink-0 transition-all duration-300">
        {/* Collapse toggle tab */}
        <div className="flex items-start pt-4">
          <button
            onClick={() => setCopilotCollapsed(!copilotCollapsed)}
            className="flex items-center justify-center w-6 h-10 bg-muted hover:bg-border border border-border rounded-l-md transition-colors text-muted-foreground hover:text-foreground"
            aria-label={copilotCollapsed ? "Expand Copilot" : "Collapse Copilot"}
            title={copilotCollapsed ? "Expand Intelligence Panel" : "Collapse Intelligence Panel"}
          >
            {copilotCollapsed ? (
              <PanelRightOpen size={13} />
            ) : (
              <PanelRightClose size={13} />
            )}
          </button>
        </div>

        {/* Panel */}
        {!copilotCollapsed && (
          <aside className="flex min-h-0 h-dvh max-h-dvh w-[20rem] shrink-0 flex-col border-l border-border bg-card xl:w-[22rem] 2xl:w-[24rem] overflow-hidden">
            <PanelContent
              messages={messages}
              defaultContext={defaultContext}
              bottomRef={bottomRef}
              onSend={handleSend}
              isLoading={isLoading}
            />
          </aside>
        )}
      </div>

      {/* ── Tablet: slide-in panel (md–lg) ── */}
      <div className="hidden md:flex lg:hidden">
        {!tabletOpen && (
          <button
            onClick={() => setTabletOpen(true)}
            className="fixed right-0 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center justify-center gap-1.5 w-8 h-24 bg-foreground rounded-l-xl text-background/70 hover:text-background transition-colors shadow-lg"
            aria-label="Open Intelligence Panel"
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
            "fixed top-0 right-0 z-50 h-full w-full max-w-[24rem] bg-card border-l border-border flex flex-col shadow-2xl transition-transform duration-300",
            tabletOpen ? "translate-x-0" : "translate-x-full"
          )}
        >
          <PanelContent
            messages={messages}
            defaultContext={defaultContext}
            bottomRef={bottomRef}
            onSend={handleSend}
            isLoading={isLoading}
            showCloseButton
            onClose={() => setTabletOpen(false)}
          />
        </aside>
      </div>

      {/* ── Mobile: bottom sheet ── */}
      <div className="md:hidden">
        {!mobileOpen && (
          <button
            onClick={() => setMobileOpen(true)}
            className="fixed bottom-5 right-5 z-40 w-12 h-12 rounded-full bg-foreground text-background flex items-center justify-center shadow-xl hover:bg-foreground/90 transition-colors"
            aria-label="Open Intelligence"
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
            <div className="fixed bottom-0 left-0 right-0 z-50 h-[85dvh] sm:h-[88dvh] bg-card rounded-t-2xl flex flex-col shadow-2xl border-t border-border">
              <div className="flex justify-center pt-3 pb-1 shrink-0">
                <div className="w-10 h-1 rounded-full bg-border" />
              </div>
              <PanelContent
                messages={messages}
                defaultContext={defaultContext}
                bottomRef={bottomRef}
                onSend={handleSend}
                isLoading={isLoading}
                showCloseButton
                onClose={() => setMobileOpen(false)}
              />
            </div>
          </>
        )}
      </div>
    </>
  );
}
