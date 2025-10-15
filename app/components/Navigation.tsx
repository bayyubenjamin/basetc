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

// Pakai CSS vars dari palet light
const COLORS = {
  active: "var(--accent)",          // #2b7bff
  inactive: "var(--muted)",         // #4a67a1 (lebih gelap, kontras bagus)
  labelActive: "var(--text)",       // #0a1833
  labelInactive: "var(--muted)",
  iconBgActive: "rgba(43,123,255,.16)",
  iconRingActive: "rgba(43,123,255,.35)",
};

const ICON_DIM = 16;
const ICON_BOX = 24;

const Navigation: FC<{
  activeTab: TabName;
  setActiveTab: (tab: TabName) => void;
}> = ({ activeTab, setActiveTab }) => {
  return (
    <nav
      className="fin-bottom-nav"
      role="navigation"
      aria-label="Main navigation"
      style={{
        left: "50%",
        transform: "translateX(-50%)",
        width: "min(calc(100% - 20px), 980px)",
        paddingLeft: "max(14px, env(safe-area-inset-left))",
        paddingRight: "max(14px, env(safe-area-inset-right))",
        alignItems: "center",
        // Bikin nav lebih “kelihatan” di atas gradient
        background: "rgba(255,255,255,.78)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        border: "1px solid rgba(0,0,0,.06)",
        boxShadow: "0 18px 42px rgba(0,0,0,.22)",
      }}
    >
      {NAV_ITEMS.map((item) => {
        const isActive = item.id === activeTab;

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
              paddingTop: 6,
              paddingBottom: 10,
              color: isActive ? COLORS.labelActive : COLORS.labelInactive, // pengaruh ke label (bawah)
            }}
          >
            <span
              className="relative grid place-items-center rounded-full"
              style={{
                width: ICON_BOX,
                height: ICON_BOX,
                background: isActive ? COLORS.iconBgActive : "transparent",
                boxShadow: isActive
                  ? `inset 0 0 0 1px ${COLORS.iconRingActive}, 0 6px 12px rgba(43,123,255,0.25)`
                  : "none",
                color: isActive ? COLORS.active : COLORS.inactive, // pengaruh ke svg currentColor
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.7}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                style={{
                  width: ICON_DIM,
                  height: ICON_DIM,
                  position: "relative",
                  zIndex: 1,
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
                fontSize: 12,                // sedikit lebih besar
                fontWeight: 700,             // lebih tebal agar jelas
                textShadow: "0 1px 0 rgba(255,255,255,.55)", // angkat label di atas blur
                letterSpacing: 0.1,
              }}
            >
              {item.label}
              {isActive && (
                <i
                  aria-hidden="true"
                  className="block mx-auto mt-[4px] rounded-full"
                  style={{
                    width: 20,
                    height: 2,
                    background:
                      "linear-gradient(90deg, rgba(43,123,255,0), rgba(43,123,255,0.95), rgba(43,123,255,0))",
                    boxShadow: "0 0 10px rgba(43,123,255,0.35)",
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