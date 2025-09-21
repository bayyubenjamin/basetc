"use client";
import { FC } from "react";

type Tab = "monitoring" | "rakit" | "market" | "profil";

interface Props {
  activeTab: Tab;
  setActiveTab: (t: Tab) => void;
}

const Pill = ({ active }: { active: boolean }) => (
  <div className={`w-5 h-5 rounded ${active ? "bg-white" : "bg-white/15"}`} />
);

const NavBtn: FC<{ id: Tab; label: string; active: boolean; onClick: () => void }> = ({ id, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center justify-center py-1 gap-1 text-[11px] font-semibold ${
      active ? "text-white" : "text-[#9aacc6]"
    }`}
  >
    <Pill active={active} />
    <span className="leading-none">{label}</span>
  </button>
);

const Navigation: FC<Props> = ({ activeTab, setActiveTab }) => {
  return (
    <nav className="bottom-nav">
      {/* grid 4 kolom full width */}
      <div className="grid grid-cols-4 w-full h-full px-3">
        <NavBtn id="monitoring" label="Monitoring" active={activeTab === "monitoring"} onClick={() => setActiveTab("monitoring")} />
        <NavBtn id="rakit" label="Rakit" active={activeTab === "rakit"} onClick={() => setActiveTab("rakit")} />
        <NavBtn id="market" label="Market" active={activeTab === "market"} onClick={() => setActiveTab("market")} />
        <NavBtn id="profil" label="Profil" active={activeTab === "profil"} onClick={() => setActiveTab("profil")} />
      </div>
    </nav>
  );
};

export default Navigation;

