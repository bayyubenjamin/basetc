// app/components/Navigation.tsx
"use client";

import type { FC } from "react";

export type TabName = "monitoring" | "rakit" | "market" | "profil" | "event";

interface NavItem { id: TabName; label: string; iconPath: string; }

const NAV_ITEMS: NavItem[] = [
  { id: "monitoring", label: "Monitoring", iconPath: "M3 15l4-6 4 8 4-12 4 6" },
  { id: "rakit",      label: "Build",      iconPath: "M4 16l8-8m4 0l2 2m-6 6l2 2M14 6l4 4" },
  { id: "market",     label: "Market",     iconPath: "M9 7a3 3 0 016 0M6 7h12l1 12H5L6 7z" },
  { id: "event",      label: "Event",      iconPath: "M12 4.5l1.8 4.2 4.2 1.8-4.2 1.8-1.8 4.2-1.8-4.2L6 10.5l4.2-1.8L12 4.5z" },
  { id: "profil",     label: "Profil",     iconPath: "M12 14a5 5 0 100-10 5 5 0 000 10zm-7 7a7 7 0 0114 0" },
];

const ACTIVE_BLUE = "#6aa8ff";
const ICON_DIM = 15;
const ICON_BOX = 20;

const Navigation: FC<{
  activeTab: TabName;
  setActiveTab: (tab: TabName) => void;
}> = ({ activeTab, setActiveTab }) => {
  return (
    <nav
      className="fin-bottom-nav neu"
      role="navigation"
      aria-label="Main navigation"
      style={{
        left: "50%",
        transform: "translateX(-50%)",
        width: "min(calc(100% - 20px), 980px)",
        paddingLeft: "max(14px, env(safe-area-inset-left))",
        paddingRight: "max(14px, env(safe-area-inset-right))",
        alignItems: "center",
        /* ▼ BAYANGAN DITURUNKAN (offset-Y 18px) */
        boxShadow:
          "0 18px 42px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.06) inset",
      }}
    >
      {NAV_ITEMS.map((item) => {
        const isActive = item.id === activeTab;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveTab(item.id)}
            className={`fin-nav-tab relative overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(43,123,255,0.55)] ${
              isActive ? "is-active" : ""
            }`}
            aria-current={isActive ? "page" : undefined}
            aria-label={item.label}
            style={{ gap: 4, paddingTop: 6, paddingBottom: 8 }}
          >
            <span
              className="relative grid place-items-center rounded-full"
              style={{
                width: ICON_BOX,
                height: ICON_BOX,
                background: isActive ? "rgba(90, 162, 255, 0.12)" : "transparent",
                /* ▼ BAYANGAN IKON SEDIKIT DITURUNKAN (offset-Y 6px) */
                boxShadow: isActive
                  ? "inset 0 0 0 1px rgba(90,162,255,0.25), 0 6px 12px rgba(90,162,255,0.25)"
                  : "none",
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                style={{
                  width: ICON_DIM,
                  height: ICON_DIM,
                  position: "relative",
                  zIndex: 1,
                  color: isActive ? ACTIVE_BLUE : "#c5d2f5",
                  opacity: isActive ? 1 : 0.92,
                }}
              >
                <path d={item.iconPath} />
              </svg>
            </span>

            <span
              className="fin-nav-label"
              style={{
                position: "relative",
                zIndex: 1,
                fontSize: 11,
                color: isActive ? ACTIVE_BLUE : "#c5d2f5",
                opacity: isActive ? 1 : 0.92,
              }}
            >
              {item.label}
              {isActive && (
                <i
                  aria-hidden="true"
                  className="block mx-auto mt-[3px] rounded-full"
                  style={{
                    width: 18,
                    height: 2,
                    background:
                      "linear-gradient(90deg, rgba(106,168,255,0), rgba(106,168,255,0.95), rgba(106,168,255,0))",
                    boxShadow: "0 0 10px rgba(106,168,255,0.35)",
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

