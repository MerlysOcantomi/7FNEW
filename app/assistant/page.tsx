"use client";

import { useState, useRef, useEffect } from "react";
import { Send, ArrowLeft, Sparkles, TrendingUp, AlertTriangle, Lightbulb } from "lucide-react";
import Link from "next/link";
import { SidebarNav, MobileSidebarNav } from "@/components/sidebar-nav";
import { ContextBar } from "@/components/context-bar";
import { LegacyTodayChrome } from "@/components/today/legacy-today-chrome";
import { cn } from "@/lib/utils";

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  highlight?: boolean;
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: 1,
    role: "assistant",
    content:
      "Good morning. I have a comprehensive view of your current workspace. Core operations are stable, but one active project needs attention because a delivery dependency was flagged earlier today.",
    timestamp: "09:14",
    highlight: false,
  },
  {
    id: 2,
    role: "user",
    content: "Give me a full risk assessment for this week.",
    timestamp: "09:15",
  },
  {
    id: 3,
    role: "assistant",
    content:
      "This week's risk assessment across your workspace identifies three priority areas:\n\n1. Delivery dependency in one active project — two external confirmations are still pending. Recommend escalation before the end of the week.\n\n2. Finance allocation variance — a 3.2% deviation from target has accumulated over the last 6 weeks. Review allocation before month close.\n\n3. Client renewal cycle — several active accounts enter renewal within the next 30 days. Proactive outreach should begin this week to protect recurring revenue.",
    timestamp: "09:15",
    highlight: true,
  },
  {
    id: 4,
    role: "user",
    content: "Prioritize the fund reallocation for me.",
    timestamp: "09:18",
  },
  {
    id: 5,
    role: "assistant",
    content:
      "To prioritize the reallocation: one finance pool currently holds $640K in underperforming instruments. Moving 15% ($96K) to a stronger allocation aligns with the current quarter strategy. I can prepare a proposal for your review — would you like me to route it through the finance workspace or generate a standalone executive brief?",
    timestamp: "09:18",
    highlight: true,
  },
];

const CONTEXT_SUMMARY = [
  { icon: AlertTriangle, label: "Active Risks", value: "3", color: "text-[#F59E0B]" },
  { icon: TrendingUp, label: "Opportunities", value: "2", color: "text-[#10B981]" },
  { icon: Lightbulb, label: "Insights", value: "7", color: "text-[#3B82F6]" },
];

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const now = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
    setMessages((prev) => [...prev, { id: Date.now(), role: "user", content: trimmed, timestamp: now }]);
    setInput("");
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          content:
            "I'm processing that request against your current operational context and available data. I'll surface the most relevant insights for your decision.",
          timestamp: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
          highlight: true,
        },
      ]);
    }, 900);
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-[#F8FAFC] font-sans overflow-x-hidden">
      <SidebarNav />
      <MobileSidebarNav />

      {/* Full Screen Assistant */}
      <main className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-4 md:px-8 py-4 border-b border-[#E2E8F0] bg-white shrink-0">
          <div className="flex items-center gap-3 min-w-0 overflow-hidden">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-xs text-[#64748B] hover:text-[#0F172A] transition-colors font-medium shrink-0"
            >
              <ArrowLeft size={13} />
              Overview
            </Link>
            <span className="text-[#E2E8F0] shrink-0">/</span>
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-2 h-2 rounded-full bg-[#3B82F6] shrink-0" />
              <span className="text-sm font-semibold text-[#0F172A] truncate">Assistant — Full Screen</span>
            </div>
          </div>
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#EFF6FF]">
            <Sparkles size={11} className="text-[#3B82F6]" />
            <span className="text-[10px] font-semibold text-[#2563EB] uppercase tracking-wider">Active</span>
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Conversation Area */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Context Bar */}
            <ContextBar className="bg-white shrink-0" />

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 md:px-10 xl:px-16 py-8 space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className={cn("max-w-[90%] sm:max-w-2xl", msg.role === "user" && "ml-auto")}>
                  <div className="flex items-center justify-between mb-1.5 gap-3">
                    <span className={cn("text-[10px] font-semibold uppercase tracking-wider", msg.role === "assistant" ? "text-[#3B82F6]" : "text-[#94A3B8]")}>
                      {msg.role === "assistant" ? "Assistant" : "You"}
                    </span>
                    <span className="text-[10px] text-[#94A3B8]">{msg.timestamp}</span>
                  </div>
                  <div
                    className={cn(
                      "rounded-xl px-5 py-4 text-sm leading-relaxed whitespace-pre-line",
                      msg.role === "assistant"
                        ? msg.highlight
                          ? "bg-[#DBEAFE] text-[#1E3A5F]"
                          : "bg-[#EFF6FF] text-[#1E3A5F]"
                        : "bg-[#F1F5F9] text-[#334155]"
                    )}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="px-4 md:px-10 xl:px-16 pb-7 pt-3 border-t border-[#E2E8F0] bg-white shrink-0">
              <div className="max-w-2xl mx-auto flex items-end gap-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-3 focus-within:border-[#3B82F6] transition-colors">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Ask the assistant anything about your operations..."
                  rows={2}
                  className="flex-1 resize-none bg-transparent text-sm text-[#0F172A] placeholder:text-[#94A3B8] outline-none leading-relaxed"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="p-2 rounded-lg bg-[#0F172A] text-white hover:bg-[#1E293B] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                  aria-label="Send message"
                >
                  <Send size={15} />
                </button>
              </div>
              <p className="text-[10px] text-[#94A3B8] text-center mt-2">Press Enter to send, Shift+Enter for new line</p>
            </div>
          </div>

          {/* Context Summary Sidebar */}
          <aside className="hidden xl:flex flex-col w-72 shrink-0 border-l border-[#E2E8F0] bg-white overflow-y-auto">
            <div className="px-5 py-4 border-b border-[#E2E8F0]">
              <p className="text-xs font-semibold text-[#0F172A] uppercase tracking-widest">Context Summary</p>
            </div>

            {/* Summary Stats */}
            <div className="px-5 py-4 border-b border-[#E2E8F0] space-y-2">
              {CONTEXT_SUMMARY.map(({ icon: Icon, label, value, color }) => (
                <div key={label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon size={13} className={color} strokeWidth={1.75} />
                    <span className="text-xs text-[#64748B]">{label}</span>
                  </div>
                  <span className="text-sm font-semibold text-[#0F172A]">{value}</span>
                </div>
              ))}
            </div>

            {/* Key Context Cards */}
            <div className="px-5 py-5 space-y-3">
              <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-widest mb-3">Active Context</p>

              <div className="bg-[#EFF6FF] rounded-lg p-3.5">
                <p className="text-[10px] font-semibold text-[#3B82F6] uppercase tracking-wider mb-1.5">Selected Project</p>
                <p className="text-sm font-semibold text-[#0F172A]">Current project</p>
                <p className="text-xs text-[#64748B] mt-0.5">Phase 3 of 5 — 60% complete</p>
              </div>

              <div className="bg-[#DBEAFE] rounded-lg p-3.5">
                <p className="text-[10px] font-semibold text-[#2563EB] uppercase tracking-wider mb-1.5">Priority Risk</p>
                <p className="text-sm font-semibold text-[#0F172A]">Vendor Delay — Tier 2</p>
                <p className="text-xs text-[#334155] mt-0.5">Escalation due by Thursday, Feb 27</p>
              </div>

              <div className="bg-[#DBEAFE] rounded-lg p-3.5">
                <p className="text-[10px] font-semibold text-[#2563EB] uppercase tracking-wider mb-1.5">Fund Alert</p>
                <p className="text-sm font-semibold text-[#0F172A]">Finance workspace — Deviation</p>
                <p className="text-xs text-[#334155] mt-0.5">3.2% below target over 6 weeks</p>
              </div>

              <div className="bg-[#EFF6FF] rounded-lg p-3.5">
                <p className="text-[10px] font-semibold text-[#3B82F6] uppercase tracking-wider mb-1.5">Upcoming Renewals</p>
                <p className="text-sm font-semibold text-[#0F172A]">4 enterprise accounts</p>
                <p className="text-xs text-[#64748B] mt-0.5">Within 30 days</p>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <LegacyTodayChrome />
    </div>
  );
}
