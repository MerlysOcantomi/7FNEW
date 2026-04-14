"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ArrowUpRight, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_VOCABULARY } from "@core/personalization";

const v = DEFAULT_VOCABULARY;

// ── Workspace context chips ──────────────────────────────────────────────────
const CONTEXT_CHIPS = ["Overview", "Clients", "Projects", "Finance", "Invoices", "Improvements"] as const;
type ContextChip = (typeof CONTEXT_CHIPS)[number];

const CHIP_LABELS: Record<ContextChip, string> = {
  Overview: "Overview",
  Clients: v.client.plural,
  Projects: v.project.plural,
  Finance: v.finance.singular,
  Invoices: v.billing.singular,
  Improvements: "Improvements",
};

const CHIP_SUBTITLES: Record<ContextChip, string> = {
  Overview: "Business signals",
  Clients: "Relationships",
  Projects: "Execution",
  Finance: "Financial health",
  Invoices: "Collections",
  Improvements: "System upgrades",
};

const ENTITY_OPTIONS: Record<ContextChip, { label: string; href: string }[]> = {
  Overview: [
    { label: "Workspace overview", href: "/" },
    { label: "See what's coming", href: "/agente" },
    { label: "Recent activity", href: "/" },
  ],
  Clients: [
    { label: `Priority ${v.client.singular.toLowerCase()}`, href: "/clientes" },
    { label: `Active ${v.client.singular.toLowerCase()}`, href: "/clientes" },
    { label: `${v.client.singular} portfolio`, href: "/clientes" },
  ],
  Projects: [
    { label: `Current ${v.project.singular.toLowerCase()}`, href: "/proyectos" },
    { label: `Priority ${v.project.singular.toLowerCase()}`, href: "/proyectos" },
    { label: `${v.project.singular} portfolio`, href: "/proyectos" },
  ],
  Finance: [
    { label: `${v.finance.singular} workspace`, href: "/finanzas" },
    { label: "Operating reserve", href: "/finanzas" },
    { label: "Liquidity buffer", href: "/finanzas" },
  ],
  Invoices: [
    { label: "INV-2024-089", href: "/facturacion" },
    { label: `Pending ${v.invoice.plural.toLowerCase()}`, href: "/facturacion" },
    { label: "Collections review", href: "/facturacion" },
  ],
  Improvements: [
    { label: "Workspace improvements", href: "/forte/improvements" },
    { label: "AI workspace", href: "/motor" },
    { label: "Workspace settings", href: "/administracion" },
  ],
};

interface ContextBarProps {
  className?: string;
  defaultChip?: ContextChip | string;
}

export function ContextBar({ className, defaultChip = "Overview" }: ContextBarProps) {
  const safeDefault: ContextChip = CONTEXT_CHIPS.includes(defaultChip as ContextChip)
    ? (defaultChip as ContextChip)
    : "Overview";

  const [activeChip, setActiveChip] = useState<ContextChip>(safeDefault);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const entities = ENTITY_OPTIONS[activeChip];
  const selected = entities[selectedIdx] ?? entities[0];

  const handleChipChange = (chip: ContextChip) => {
    setActiveChip(chip);
    setSelectedIdx(0);
    setDropdownOpen(false);
  };

  return (
    <div className={cn("flex flex-col gap-2.5 px-4 py-3.5 border-b border-[#E2E8F0] bg-[#FAFCFF]", className)}>
      {/* Section label */}
      <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#94A3B8]">Context</p>

      {/* Context chips */}
      <div className="flex items-center gap-1 flex-wrap">
        {CONTEXT_CHIPS.map((chip) => (
          <button
            key={chip}
            onClick={() => handleChipChange(chip)}
            title={CHIP_SUBTITLES[chip]}
            className={cn(
              "flex flex-col items-center px-2.5 py-1 rounded-md text-[10px] font-semibold transition-colors leading-tight",
              activeChip === chip
                ? "bg-[#DBEAFE] text-[#1D4ED8]"
                : "bg-[#F1F5F9] text-[#64748B] hover:bg-[#EFF6FF] hover:text-[#3B82F6]"
            )}
          >
            {CHIP_LABELS[chip]}
          </button>
        ))}
      </div>

      {/* Entity Selector + View + Full Screen */}
      <div className="flex items-center gap-2">
        {/* Dropdown */}
        <div className="relative flex-1 min-w-0">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-md border border-[#E2E8F0] bg-white text-xs font-medium text-[#0F172A] hover:border-[#3B82F6] transition-colors"
          >
            <span className="truncate">{selected.label}</span>
            <ChevronDown
              size={12}
              className={cn("text-[#94A3B8] shrink-0 transition-transform", dropdownOpen && "rotate-180")}
            />
          </button>

          {dropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-white border border-[#E2E8F0] rounded-md shadow-lg overflow-hidden">
              {entities.map((option, idx) => (
                <button
                  key={option.label}
                  onClick={() => { setSelectedIdx(idx); setDropdownOpen(false); }}
                  className={cn(
                    "w-full text-left px-3 py-2 text-xs transition-colors",
                    selectedIdx === idx
                      ? "bg-[#EFF6FF] text-[#2563EB] font-semibold"
                      : "text-[#334155] hover:bg-[#F8FAFC]"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* View button */}
        <Link
          href={selected.href}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-semibold text-[#3B82F6] hover:bg-[#EFF6FF] border border-[#E2E8F0] hover:border-[#BFDBFE] transition-colors whitespace-nowrap"
          title="View entity"
        >
          View
          <ArrowUpRight size={11} />
        </Link>

        {/* Full Screen button */}
        <Link
          href="/assistant"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-semibold text-[#64748B] hover:bg-[#F1F5F9] border border-[#E2E8F0] transition-colors whitespace-nowrap"
          title="Open full screen assistant"
        >
          <Maximize2 size={11} />
        </Link>
      </div>
    </div>
  );
}
