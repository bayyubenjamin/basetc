// app/components/Navigation.tsx
"use client";
import type { FC } from "react";
import { Activity, Hammer, ShoppingCart, Calendar, User, LucideIcon } from "lucide-react";

export type TabName = "monitoring" | "rakit" | "market" | "profil" | "event";


interface NavItem { 
  id: TabName; 
  label: string; 
  Icon: LucideIcon; 
}


const NAV_ITEMS: NavItem[] = [
  { id: "monitoring", label: "Monitoring", Icon: Activity },
  { id: "rakit",      label: "Build",      Icon: Hammer },
  { id: "market",     label: "Market",     Icon: ShoppingCart },
  { id: "event",      label: "Event",      Icon: Calendar },
  { id: "profil",     label: "Profile",    Icon: User },
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
        width: "min(calc(100% - 20px), 980px)",
        paddingLeft: "max(14px, env(safe-area-inset-left))",
        paddingRight: "max(14px, env(safe-area-inset-right))",
        alignItems: "center",
        

        background: "linear-gradient(145deg,#ffffff,#eaf1ff)",
        border: "1px solid rgba(0,0,0,.06)",
        borderRadius: 28,
        boxShadow: "4px 4px 10px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.05)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
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
            className="fin-nav-tab relative overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(43,123,255,0.45)]"
            aria-current={isActive ? "page" : undefined}
            aria-label={item.label}
            style={{
              gap: 6,
              paddingTop: 8,
              paddingBottom: 12,
              color: isActive ? COLORS.labelActive : COLORS.labelInactive,
            }}
          >
            {/* ICON PILL */}
            <span
              className="relative grid place-items-center rounded-full"
              style={{
                width: ICON_BOX,
                height: ICON_BOX,
                background: isActive
                  ? "rgba(43,123,255,.14)"          
                  : "rgba(10,30,60,.05)",           
                border: isActive
                  ? "1px solid rgba(43,123,255,.30)"
                  : "1px solid rgba(0,0,0,.06)",
                boxShadow: isActive
                  ? "4px 4px 8px rgba(43,123,255,.25), inset 0 0 0 1px rgba(43,123,255,.20)"
                  : "4px 4px 8px rgba(0,0,0,.18), inset 0 0 0 1px rgba(0,0,0,.04)",
                color: isActive ? COLORS.active : COLORS.inactive,
                transition: "transform .12s ease, box-shadow .12s ease, background .12s ease",
              }}
            >
              {/* IMPLEMENTASI LUCIDE REACT */}
              <IconComponent
                size={ICON_DIM}
                strokeWidth={1.7}
                style={{ 
                    position: "relative", 
                    zIndex: 1 
                }}
              />
            </span>

            <span
              className="fin-nav-label"
              style={{
                position: "relative",
                zIndex: 1,
                fontSize: 12,
                fontWeight: 700,
                color: isActive ? COLORS.labelActive : COLORS.labelInactive,
                letterSpacing: 0.1,
              }}
            >
              {item.label}
              {isActive && (
                <i
                  aria-hidden
                  className="block mx-auto mt-[4px] rounded-full"
                  style={{
                    width: 22,
                    height: 2,
                    background:
                      "linear-gradient(90deg, rgba(43,123,255,0), rgba(43,123,255,0.95), rgba(43,123,255,0))",
                    boxShadow: "0 0 10px rgba(43,123,255,0.28)",
                  }}
                />
              )}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

export default Navigation;
