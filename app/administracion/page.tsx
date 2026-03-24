"use client";

import { useState } from "react";
import { SidebarNav, MobileSidebarNav, SidebarCollapseContext } from "@/components/sidebar-nav";
import { CopilotPanel, CopilotCollapseContext } from "@/components/copilot-panel";
import { Save, ToggleLeft, ToggleRight, ChevronDown } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface CapabilityItem {
  id: string;
  label: string;
  locked?: boolean;
}
interface CapabilityGroup {
  section: string;
  items: CapabilityItem[];
}

// ── Core Capabilities ─────────────────────────────────────────────────────────
const CORE_CAPABILITIES: CapabilityGroup[] = [
  {
    section: "Core",
    items: [
      { id: "inbox", label: "Smart Inbox", locked: true },
      { id: "entrada", label: "Manual Intake", locked: true },
      { id: "clientes", label: "Clients", locked: true },
      { id: "proyectos", label: "Projects", locked: true },
      { id: "tareas", label: "Tasks", locked: true },
      { id: "calendario", label: "Calendar", locked: true },
      { id: "archivos", label: "Files", locked: true },
    ],
  },
  {
    section: "Growth",
    items: [
      { id: "campanas", label: "Marketing", locked: true },
    ],
  },
  {
    section: "Revenue",
    items: [
      { id: "finanzas", label: "Finance", locked: true },
      { id: "facturacion", label: "Billing", locked: true },
    ],
  },
  {
    section: "Advanced",
    items: [
      { id: "agente", label: "Overview insights", locked: true },
      { id: "motor", label: "AI workspace", locked: true },
      { id: "departamentos", label: "Departments", locked: true },
    ],
  },
];

// ── Extension Packs ────────────────────────────────────────────────────────────
type PackKey = "standard" | "construction" | "ecommerce";

const EXTENSION_PACKS: Record<PackKey, { label: string; groups: CapabilityGroup[] }> = {
  standard: {
    label: "Standard workspace",
    groups: [],
  },
  construction: {
    label: "Construction pack",
    groups: [
      {
        section: "Core",
        items: [
          { id: "subcontratistas", label: "Subcontractors" },
          { id: "control_obra", label: "Site control" },
          { id: "certificaciones", label: "Certifications" },
          { id: "avance_fisico", label: "Physical progress" },
        ],
      },
      {
        section: "Revenue",
        items: [
          { id: "pagos_avance", label: "Progress payments" },
          { id: "retenciones", label: "Retentions" },
        ],
      },
    ],
  },
  ecommerce: {
    label: "Ecommerce pack",
    groups: [
      {
        section: "Core",
        items: [
          { id: "pedidos", label: "Orders" },
          { id: "inventario", label: "Inventory" },
          { id: "productos", label: "Products" },
        ],
      },
      {
        section: "Revenue",
        items: [
          { id: "pagos_online", label: "Online payments" },
          { id: "reembolsos", label: "Refunds" },
        ],
      },
    ],
  },
};

// ── Advanced customization items ──────────────────────────────────────────────
const ADVANCED_ITEMS = [
  { id: "custom_fields", label: "Custom fields" },
  { id: "etiquetas", label: "Internal labels" },
  { id: "automatizaciones", label: "Specific automations" },
];

// ── Section label color map ────────────────────────────────────────────────────
const SECTION_COLOR: Record<string, string> = {
  Core: "text-[#2563EB]",
  Growth: "text-[#0F172A]",
  Revenue: "text-[#1D4ED8]",
  Advanced: "text-[#64748B]",
};

// ── Toggle component ──────────────────────────────────────────────────────────
function Toggle({
  enabled,
  locked,
  onToggle,
}: {
  enabled: boolean;
  locked?: boolean;
  onToggle: () => void;
}) {
  if (locked) {
    return (
      <div className="flex items-center gap-1.5">
        <ToggleRight size={22} className="text-[#3B82F6]" strokeWidth={1.5} />
        <span className="text-[10px] font-medium text-[#94A3B8] uppercase tracking-wide whitespace-nowrap">
          Always on
        </span>
      </div>
    );
  }
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-1.5 group"
      aria-label={enabled ? "Disable" : "Enable"}
    >
      {enabled ? (
        <ToggleRight size={22} className="text-[#3B82F6]" strokeWidth={1.5} />
      ) : (
        <ToggleLeft size={22} className="text-[#CBD5E1] group-hover:text-[#94A3B8]" strokeWidth={1.5} />
      )}
    </button>
  );
}

// ── Capability Row ─────────────────────────────────────────────────────────────
function CapabilityRow({
  item,
  enabled,
  onToggle,
}: {
  item: CapabilityItem;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 px-4 border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] transition-colors">
      <span className={`text-sm ${item.locked ? "text-[#334155] font-medium" : enabled ? "text-[#334155]" : "text-[#94A3B8]"}`}>
        {item.label}
      </span>
      <Toggle enabled={item.locked ? true : enabled} locked={item.locked} onToggle={onToggle} />
    </div>
  );
}

// ── Section Group ──────────────────────────────────────────────────────────────
function CapabilityGroupBlock({
  group,
  enabledMap,
  onToggle,
  bgClass,
}: {
  group: CapabilityGroup;
  enabledMap: Record<string, boolean>;
  onToggle: (id: string) => void;
  bgClass?: string;
}) {
  return (
    <div className={`rounded-xl overflow-hidden border border-[#E2E8F0] ${bgClass ?? "bg-white"}`}>
      <div className="px-4 py-2.5 border-b border-[#E2E8F0] flex items-center gap-2">
        <span className={`text-[11px] font-bold uppercase tracking-widest ${SECTION_COLOR[group.section] ?? "text-[#334155]"}`}>
          {group.section}
        </span>
      </div>
      <div>
        {group.items.map((item) => (
          <CapabilityRow
            key={item.id}
            item={item}
            enabled={item.locked ? true : (enabledMap[item.id] ?? false)}
            onToggle={() => onToggle(item.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Administracion() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [copilotCollapsed, setCopilotCollapsed] = useState(false);

  // Extension pack selection
  const [selectedPack, setSelectedPack] = useState<PackKey>("construction");
  const [packDropdownOpen, setPackDropdownOpen] = useState(false);

  // Extension toggles (keyed by item id)
  const [extensionEnabled, setExtensionEnabled] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    Object.values(EXTENSION_PACKS).forEach(({ groups }) => {
      groups.forEach(({ items }) => {
        items.forEach(({ id }) => { initial[id] = true; });
      });
    });
    return initial;
  });

  // Advanced toggles
  const [advancedEnabled, setAdvancedEnabled] = useState<Record<string, boolean>>({
    custom_fields: true,
    etiquetas: false,
    automatizaciones: false,
  });

  const toggleExtension = (id: string) => {
    setExtensionEnabled((prev) => ({ ...prev, [id]: !prev[id] }));
  };
  const toggleAdvanced = (id: string) => {
    setAdvancedEnabled((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const currentPack = EXTENSION_PACKS[selectedPack];

  return (
    <SidebarCollapseContext.Provider value={{ collapsed: sidebarCollapsed, setCollapsed: setSidebarCollapsed }}>
      <CopilotCollapseContext.Provider value={{ copilotCollapsed, setCopilotCollapsed }}>
        <div className="flex flex-col md:flex-row min-h-screen bg-[#F8FAFC] font-sans overflow-x-hidden">
          <SidebarNav />
          <MobileSidebarNav />

          {/* ── Main ── */}
          <main className="flex-1 min-w-0 overflow-y-auto">

            {/* Header */}
            <div className="px-4 md:px-8 pt-7 pb-5 border-b border-[#E2E8F0] bg-[#F8FAFC] flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                  <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-widest mb-1">
                  Improvements
                </p>
                <h1 className="text-xl font-semibold text-[#0F172A] tracking-tight">
                  Workspace improvements
                </h1>
                <p className="text-sm text-[#64748B] mt-1">
                  Review core capabilities, optional packs, and advanced upgrades for this workspace.
                </p>
                <p className="text-xs text-[#94A3B8] mt-1.5">
                  Mr. Forte uses this surface to suggest safe system upgrades and optional capabilities.
                </p>
              </div>
              <button className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#0F172A] text-white text-sm font-medium hover:bg-[#1E293B] transition-colors shadow-sm shrink-0 self-start sm:self-auto">
                <Save size={14} strokeWidth={1.75} />
                Save changes
              </button>
            </div>

            {/* Body */}
            <div className="px-4 md:px-8 py-8 space-y-10">

              {/* ── Section 1: Core capabilities ── */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-widest">
                    Core capabilities
                  </h2>
                  <span className="text-[10px] text-[#94A3B8] font-medium">
                    Always on
                  </span>
                </div>

                <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                  <div className="px-5 py-3.5 bg-[#EFF6FF] border-b border-[#DBEAFE]">
                    <p className="text-xs text-[#1D4ED8] font-medium">
                      These capabilities are the base of the workspace and remain enabled.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#F1F5F9]">
                    {CORE_CAPABILITIES.map((group) => (
                      <div key={group.section}>
                        <div className="px-5 py-2.5 border-b border-[#F1F5F9] bg-[#FAFAFA]">
                          <span className={`text-[11px] font-bold uppercase tracking-widest ${SECTION_COLOR[group.section] ?? "text-[#334155]"}`}>
                            {group.section}
                          </span>
                        </div>
                        <div className="divide-y divide-[#F1F5F9]">
                          {group.items.map((item) => (
                            <div key={item.id} className="flex items-center justify-between py-3 px-5 hover:bg-[#F8FAFC] transition-colors">
                              <span className="text-sm font-medium text-[#334155]">{item.label}</span>
                              <div className="flex items-center gap-1.5">
                                <ToggleRight size={20} className="text-[#3B82F6]" strokeWidth={1.5} />
                                <span className="text-[10px] font-medium text-[#94A3B8] uppercase tracking-wide hidden sm:block">
                                  Base
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* ── Section 2: Optional packs ── */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-widest">
                    Optional packs
                  </h2>
                </div>

                <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                  {/* Pack selector */}
                  <div className="px-5 py-4 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#0F172A]">Selected pack</p>
                      <p className="text-xs text-[#64748B] mt-0.5">
                        Choose the optional capability pack that best matches this workspace.
                      </p>
                    </div>

                    {/* Dropdown */}
                    <div className="relative shrink-0">
                      <button
                        onClick={() => setPackDropdownOpen((v) => !v)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] hover:border-[#BFDBFE] text-sm font-medium text-[#0F172A] transition-colors min-w-[180px] justify-between"
                      >
                        {currentPack.label}
                        <ChevronDown
                          size={14}
                          strokeWidth={2}
                          className={`text-[#64748B] transition-transform duration-200 ${packDropdownOpen ? "rotate-180" : ""}`}
                        />
                      </button>
                      {packDropdownOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setPackDropdownOpen(false)}
                          />
                          <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-[#E2E8F0] rounded-xl shadow-lg z-20 overflow-hidden">
                            {(Object.keys(EXTENSION_PACKS) as PackKey[]).map((key) => (
                              <button
                                key={key}
                                onClick={() => {
                                  setSelectedPack(key);
                                  setPackDropdownOpen(false);
                                }}
                                className={`w-full text-left px-4 py-3 text-sm hover:bg-[#EFF6FF] transition-colors ${
                                  selectedPack === key
                                    ? "bg-[#EFF6FF] text-[#1D4ED8] font-medium"
                                    : "text-[#334155]"
                                }`}
                              >
                                {EXTENSION_PACKS[key].label}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Extension groups */}
                  {currentPack.groups.length === 0 ? (
                    <div className="px-5 py-10 text-center">
                      <p className="text-sm text-[#94A3B8]">
                        The standard workspace does not include additional optional packs.
                      </p>
                      <p className="text-xs text-[#CBD5E1] mt-1">
                        Select a pack to review extra capabilities.
                      </p>
                    </div>
                  ) : (
                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {currentPack.groups.map((group) => (
                        <CapabilityGroupBlock
                          key={group.section}
                          group={group}
                          enabledMap={extensionEnabled}
                          onToggle={toggleExtension}
                          bgClass="bg-[#F8FAFC]"
                        />
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* ── Section 3: Advanced options ── */}
              <section>
                <div className="mb-4">
                  <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-widest">
                    Advanced options
                  </h2>
                </div>

                <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden max-w-lg">
                  <div className="divide-y divide-[#F1F5F9]">
                    {ADVANCED_ITEMS.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between py-3.5 px-5 hover:bg-[#F8FAFC] transition-colors"
                      >
                        <span className={`text-sm ${advancedEnabled[item.id] ? "text-[#334155] font-medium" : "text-[#94A3B8]"}`}>
                          {item.label}
                        </span>
                        <Toggle
                          enabled={advancedEnabled[item.id] ?? false}
                          onToggle={() => toggleAdvanced(item.id)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* ── Bottom save bar (mobile sticky) ── */}
              <div className="sm:hidden fixed bottom-0 left-0 right-0 z-30 px-4 py-3 bg-white border-t border-[#E2E8F0] shadow-lg">
                <button className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-[#0F172A] text-white text-sm font-medium hover:bg-[#1E293B] transition-colors">
                  <Save size={14} strokeWidth={1.75} />
                  Save changes
                </button>
              </div>

            </div>
          </main>

          {/* Copilot Panel */}
          <CopilotPanel defaultContext="Overview" />
        </div>
      </CopilotCollapseContext.Provider>
    </SidebarCollapseContext.Provider>
  );
}
