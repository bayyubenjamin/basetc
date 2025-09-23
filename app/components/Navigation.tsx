"use client";

import type { FC } from "react";

export type TabName = "monitoring" | "rakit" | "market" | "profil";

interface NavItem {
  id: TabName;
  label: string;
  iconPath: string; // heroicons mini path
}

const NAV_ITEMS: NavItem[] = [
  {
    id: "monitoring",
    label: "Monitoring",
    iconPath:
      "M3 13.5 13.5 2.25 12 10.5h8.25L9.75 21.75 12 13.5H3Z",
  },
  {
    id: "rakit",
    label: "Rakit",
    iconPath:
      "M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.332.183.582.495.645.87l.213 1.281c.09.543.56.94 1.11.94h2.593c.55 0 1.02-.398 1.11-.94l.213-1.281",
  },
  {
    id: "market",
    label: "Market",
    iconPath:
      "M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c.51 0 .962-.343 1.087-.835l.383-1.437",
  },
  {
    id: "profil",
    label: "Profil",
    iconPath:
      "M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z",
  },
];

const Navigation: FC<{
  activeTab: TabName;
  setActiveTab: (t: TabName) => void;
}> = ({ activeTab, setActiveTab }) => {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30">
      <div className="mx-auto w-full max-w-[430px] px-3 pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-4 gap-2 rounded-xl border border-neutral-800 bg-neutral-900/90 p-1.5 shadow-[0_8px_24px_rgba(0,0,0,.3)] backdrop-blur">
          {NAV_ITEMS.map((it) => {
            const isActive = it.id === activeTab;
            return (
              <button
                key={it.id}
                onClick={() => setActiveTab(it.id)}
                className={[
                  "group inline-flex flex-col items-center justify-center rounded-lg px-2 py-1.5 transition-colors",
                  isActive
                    ? "bg-neutral-800 text-white"
                    : "text-neutral-400 hover:bg-neutral-800/50 hover:text-white",
                ].join(" ")}
                type="button"
                aria-current={isActive ? "page" : undefined}
              >
                <svg
                  aria-hidden
                  className="h-[18px] w-[18px] opacity-90"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d={it.iconPath} />
                </svg>
                <span className="mt-0.5 text-[10px] font-medium leading-none">
                  {it.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;

