"use client";
import { FC } from "react";

interface Props {
  activeTab: "monitoring" | "rakit" | "market" | "profil";
  setActiveTab: (t: any) => void;
}

const Navigation: FC<Props> = ({ activeTab, setActiveTab }) => {
  const Item = (props: { id: Props["activeTab"]; label: string; icon: React.ReactNode; }) => (
    <button
      onClick={() => setActiveTab(props.id)}
      className={`flex-1 flex flex-col items-center justify-center gap-1 text-xs font-semibold ${
        activeTab === props.id ? "text-white" : "text-[#9aacc6]"
      }`}
    >
      {props.icon}
      <span>{props.label}</span>
    </button>
  );

  return (
    <nav
      className="
        bottom-nav
        fixed bottom-0 left-1/2 -translate-x-1/2 z-50
        w-full max-w-[430px]
        border-t border-white/10
        bg-[#0b1118]/90 backdrop-blur
      "
    >
      <div className="grid grid-cols-4 px-3">
        <Item id="monitoring" label="Monitoring" icon={<div className="w-5 h-5 rounded bg-white/10" />} />
        <Item id="rakit" label="Rakit" icon={<div className="w-5 h-5 rounded bg-white/10" />} />
        <Item id="market" label="Market" icon={<div className="w-5 h-5 rounded bg-white/10" />} />
        <Item id="profil" label="Profil" icon={<div className="w-5 h-5 rounded bg-white/10" />} />
      </div>
    </nav>
  );
};

export default Navigation;

