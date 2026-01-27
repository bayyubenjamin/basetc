"use client";

import { Activity, Hammer, ShoppingCart, User, Swords, Calendar, type LucideIcon } from "lucide-react";

// PENTING: Export TabName agar page.tsx tidak error
export type TabName = "monitoring" | "rakit" | "market" | "profil" | "arena" | "event";

interface NavItem {
  id: TabName;
  label: string;
  Icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { id: "monitoring", label: "Home",     Icon: Activity },
  { id: "rakit",      label: "Build",    Icon: Hammer },
  { id: "arena",      label: "Battle",   Icon: Swords },
  { id: "market",     label: "Market",   Icon: ShoppingCart },
  { id: "event",      label: "Event",    Icon: Calendar },
  { id: "profil",     label: "Profile",  Icon: User },
];

interface NavigationProps {
  activeTab: TabName;
  setActiveTab: (tab: TabName) => void;
}

export default function Navigation({ activeTab, setActiveTab }: NavigationProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none flex justify-center pb-5 pt-2 px-2">
      {/* Container Navigasi Compact & Glassmorphism */}
      <nav className="pointer-events-auto bg-[#0a0a0a]/90 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl shadow-black/50 overflow-hidden max-w-md w-full relative transition-all">
        {/* Glow Effect Top Border */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        
        <ul className="flex justify-between items-center px-1">
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.Icon;

            return (
              <li key={item.id} className="flex-1">
                <button
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex flex-col items-center justify-center gap-1 py-3 transition-all duration-300 relative group active:scale-95 outline-none ${
                    isActive ? "text-white" : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {/* Active Indicator Background (Subtle) */}
                  {isActive && (
                    <div className="absolute inset-x-2 inset-y-1 bg-white/5 rounded-xl -z-10" />
                  )}

                  {/* Icon Wrapper */}
                  <div className={`relative transition-all duration-300 ${isActive ? "scale-110 -translate-y-0.5" : "scale-100"}`}>
                    <Icon
                      size={20}
                      strokeWidth={isActive ? 2.5 : 2}
                      className={`transition-colors duration-300 ${isActive ? "text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]" : "text-current"}`}
                    />
                  </div>

                  {/* Label */}
                  <span
                    className={`text-[10px] font-medium tracking-wide transition-all duration-300 ${
                      isActive ? "text-white opacity-100 font-bold" : "opacity-60"
                    }`}
                  >
                    {item.label}
                  </span>
                  
                  {/* Bottom Active Line Indicator */}
                  {isActive && (
                    <span className="absolute bottom-0 w-8 h-0.5 bg-red-500 rounded-t-full shadow-[0_-2px_6px_rgba(239,68,68,0.6)] animate-in fade-in zoom-in duration-300" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
