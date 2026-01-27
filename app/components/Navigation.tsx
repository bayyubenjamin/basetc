"use client";
import type { FC } from "react";
import { Activity, Hammer, ShoppingCart, User, Swords, type LucideIcon } from "lucide-react";

// PERBAIKAN: Tambahkan 'event' ke dalam tipe union TabName di bawah ini
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
  { id: "profil",     label: "Profile",  Icon: User },
  // Catatan: Jika Anda ingin tab "Event" muncul sebagai tombol navigasi di bawah,
  // Anda bisa menambahkannya ke sini (perlu import icon yang sesuai):
  // { id: "event", label: "Event", Icon: Activity }, 
];

const COLORS = {
  active: "var(--accent)",
  inactive: "var(--muted)",
  labelActive: "var(--text)",
  labelInactive: "var(--muted)",
};

const ICON_DIM = 18; 
const ICON_BOX = 28; 

const Navigation: FC<{ activeTab: TabName; setActiveTab: (t: TabName) => void; }>
= ({ activeTab, setActiveTab }) => {
  return (
    <nav
      className="fin-bottom-nav"
      role="navigation"
      aria-label="Main navigation"
      style={{
        position: "fixed",
        left: "50%",
        transform: "translateX(-50%)",
        bottom: 20,
        width: "min(calc(100% - 20px), 980px)",
        paddingLeft: "max(14px, env(safe-area-inset-left))",
        paddingRight: "max(14px, env(safe-area-inset-right))",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        background: "linear-gradient(145deg,#ffffff,#eaf1ff)",
        border: "1px solid rgba(0,0,0,.06)",
        borderRadius: 28,
        boxShadow: "4px 4px 10px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.05)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        zIndex: 9999,
      }}
    >
      {NAV_ITEMS.map((item) => {
        const isActive = item.id === activeTab;
        const IconComponent = item.Icon;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveTab(item.id)}
            className="fin-nav-tab relative overflow-hidden focus:outline-none"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              padding: "8px 0 10px",
              flex: 1,
              color: isActive ? COLORS.labelActive : COLORS.labelInactive,
            }}
          >
            <span
              className="relative grid place-items-center rounded-full transition-all duration-200"
              style={{
                width: ICON_BOX,
                height: ICON_BOX,
                background: isActive ? "rgba(43,123,255,.14)" : "rgba(10,30,60,.05)",           
                border: isActive ? "1px solid rgba(43,123,255,.30)" : "1px solid rgba(0,0,0,.06)",
                color: isActive ? COLORS.active : COLORS.inactive,
              }}
            >
              <IconComponent size={ICON_DIM} strokeWidth={2} />
            </span>

            <span style={{ fontSize: 10, fontWeight: 700, opacity: isActive ? 1 : 0.7 }}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

export default Navigation;
