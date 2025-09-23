"use client";

import type { FC } from 'react';

/**
 * A union type representing the names of each tab in the application.
 */
export type TabName = 'monitoring' | 'rakit' | 'market' | 'profil';

interface NavItem {
  id: TabName;
  label: string;
  iconPath: string; // Heroicon path data
}

// Define the navigation items with labels and simple SVG paths from Heroicons
const NAV_ITEMS: NavItem[] = [
  {
    id: 'monitoring',
    label: 'Monitoring',
    iconPath: 'M3 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75L12 13.5H3z',
  },
  {
    id: 'rakit',
    label: 'Rakit',
    iconPath:
      'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.332.183.582.495.645.87l.213 1.281c.09.543.56.94 1.11.94h2.593c.55 0 1.02-.398 1.11-.94l.213-1.281',
  },
  {
    id: 'market',
    label: 'Market',
    iconPath:
      'M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c.51 0 .962-.343 1.087-.835l.383-1.437',
  },
  {
    id: 'profil',
    label: 'Profil',
    iconPath:
      'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z',
  },
];

const Navigation: FC<{
  activeTab: TabName;
  setActiveTab: (tab: TabName) => void;
}> = ({ activeTab, setActiveTab }) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-neutral-900 border-t border-neutral-700 p-2">
      <div className="flex justify-around">
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === activeTab;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={[
                'group flex flex-col items-center justify-center rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                isActive
                  ? 'bg-neutral-800 text-white'
                  : 'text-neutral-400 hover:bg-neutral-800 hover:text-white',
              ].join(' ')}
              aria-current={isActive ? 'page' : undefined}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5 mb-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d={item.iconPath} />
              </svg>
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default Navigation;