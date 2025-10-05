"use client";

import type { FC } from "react";

export type TabName = "monitoring" | "rakit" | "market" | "profil" | "event";

interface NavItem {
  id: TabName;
  label: string;
  iconPath: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: "monitoring",
    label: "Monitoring",
    iconPath: "M3 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75L12 13.5H3z",
  },
  {
    id: "rakit",
    label: "Build",
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
    id: "event",
    label: "Event",
    iconPath:
      "M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.504-1.125-1.125-1.125h-6.75c-.621 0-1.125.504-1.125 1.125v3.375m9 0h-9",
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
  setActiveTab: (tab: TabName) => void;
}> = ({ activeTab, setActiveTab }) => {
  return (
    <nav className="fin-bottom-nav" role="navigation" aria-label="Main navigation">
      {NAV_ITEMS.map((item) => {
        const isActive = item.id === activeTab;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveTab(item.id)}
            className={`fin-nav-tab${isActive ? " is-active" : ""}`}
            aria-current={isActive ? "page" : undefined}
            aria-label={item.label}
          >
            <svg
              className="fin-nav-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d={item.iconPath} />
            </svg>
            <span className="fin-nav-label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default Navigation;
