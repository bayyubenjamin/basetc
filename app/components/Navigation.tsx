"use client";
import { FC } from "react";

type TabName = "monitoring" | "rakit" | "market" | "profil";

const NAV_ITEMS = [
  { id: "monitoring", label: "Home" },
  { id: "rakit", label: "Workshop" },
  { id: "market", label: "Market" },
  { id: "profil", label: "Profil" },
];

interface NavigationProps {
  activeTab: TabName;
  setActiveTab: (tab: TabName) => void;
}

const Navigation: FC<NavigationProps> = ({ activeTab, setActiveTab }) => {
  return (
    <nav className="bottom-nav" role="navigation" aria-label="bottom nav">
      <div className="bottom-nav-inner">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id as TabName)}
            className={`bottom-nav-btn ${activeTab === item.id ? 'active' : ''}`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  );
};

export default Navigation;
