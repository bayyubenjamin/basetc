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

// warna dari palette light
const COLORS = {
  active: "var(--accent)",
  inactive: "var(--muted)",
  labelActive: "var(--text)",
  labelInactive: "var(--muted)",
};

const ICON_DIM = 16;
const ICON_BOX = 26;

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
        position: "fixed",
        left: "50%",
        transform: "translateX(-50%)",
        width: "min(calc(100% - 20px), 980px)",
        paddingLeft: "max(14px, env(safe-area-inset-left))",
        paddingRight: "max(14px, env(safe-area-inset-right))",
        alignItems: "center",

        // ★ Neumorphism container: gradient + multi shadows
        background: "linear-gradient(145deg, #ffffff, #eaf1ff)",
        border: "1px solid rgba(0,0,0,.06)",
        borderRadius: 28,
        boxShadow:
          "12px 12px 24px rgba(0,0,0,.20), -10px -10px 20px rgba(255,255,255,.85), inset 0 1px 0 rgba(255,255,255,.65)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      }}
    >
      {/* sheen & bottom glow (layer dekoratif) */}
      <div
        aria-hidden
        className="pointer-events-none"
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 28,
          background:
            "linear-gradient(180deg, rgba(255,255,255,.35), rgba(255,255,255,0))",
          mixBlendMode: "soft-light",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none"
        style={{
          position: "absolute",
          left: 24,
          right: 24,
          bottom: 6,
          height: 12,
          borderRadius: 12,
          background:
            "radial-gradient(50% 100% at 50% 100%, rgba(43,123,255,.22), rgba(43,123,255,0))",
          filter: "blur(6px)",
        }}
      />

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
              paddingTop: 8,
              paddingBottom: 12,
              color: isActive ? COLORS.labelActive : COLORS.labelInactive,
            }}
          >
            {/* ★ Icon pill dengan efek timbul */}
            <span
              className="relative grid place-items-center rounded-full"
              style={{
                width: ICON_BOX,
                height: ICON_BOX,
                background: isActive
                  ? "linear-gradient(145deg, rgba(43,123,255,.22), rgba(43,123,255,.12))"
                  : "linear-gradient(145deg, #f9fbff, #e9f0ff)",
                boxShadow: isActive
                  ? "6px 6px 12px rgba(43,123,255,.22), -6px -6px 12px rgba(255,255,255,.9), inset 0 0 0 1px rgba(43,123,255,.35)"
                  : "6px 6px 12px rgba(0,0,0,.10), -6px -6px 12px rgba(255,255,255,.9), inset 0 0 0 1px rgba(0,0,0,.04)",
                color: isActive ? COLORS.active : COLORS.inactive,
                transition: "transform .12s ease, box-shadow .12s ease",
              }}
            >
              {/* highlight kecil di atas */}
              <i
                aria-hidden
                style={{
                  position: "absolute",
                  top: 2,
                  left: 2,
                  right: 2,
                  height: 10,
                  borderRadius: 999,
                  background:
                    "linear-gradient(180deg, rgba(255,255,255,.9), rgba(255,255,255,0))",
                  pointerEvents: "none",
                }}
              />
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.7}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                style={{ width: ICON_DIM, height: ICON_DIM, position: "relative", zIndex: 1 }}
              >
                <path d={item.iconPath} />
              </svg>
            </span>

            {/* Label + underline glow saat aktif */}
            <span
              className="fin-nav-label"
              style={{
                position: "relative",
                zIndex: 1,
                fontSize: 12,
                fontWeight: 700,
                color: isActive ? COLORS.labelActive : COLORS.labelInactive,
                textShadow: "0 1px 0 rgba(255,255,255,.55)",
                letterSpacing: 0.1,
              }}
            >
              {item.label}
              {isActive && (
                <>
                  <i
                    aria-hidden
                    className="block mx-auto mt-[4px] rounded-full"
                    style={{
                      width: 22,
                      height: 2,
                      background:
                        "linear-gradient(90deg, rgba(43,123,255,0), rgba(43,123,255,0.95), rgba(43,123,255,0))",
                      boxShadow:
                        "0 0 10px rgba(43,123,255,0.35), 0 6px 12px rgba(43,123,255,0.20)",
                    }}
                  />
                  {/* glow lembut di bawah label */}
                  <i
                    aria-hidden
                    style={{
                      position: "absolute",
                      left: "50%",
                      transform: "translateX(-50%)",
                      bottom: -2,
                      width: 26,
                      height: 8,
                      borderRadius: 999,
                      background:
                        "radial-gradient(50% 80% at 50% 50%, rgba(43,123,255,.25), rgba(43,123,255,0))",
                      filter: "blur(4px)",
                    }}
                  />
                </>
              )}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

export default Navigation;