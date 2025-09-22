"use client";
import { FC, useEffect, useLayoutEffect, useRef } from "react";

type TabName = "monitoring" | "rakit" | "market" | "profil";

interface NavItem {
  id: TabName;
  label: string;
  iconPath: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "monitoring", label: "Monitoring", iconPath: "M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" },
  { id: "rakit",      label: "Rakit",      iconPath: "M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.438.995s.145.755.438.995l1.003.827c.481.398.668 1.04.26 1.431l-1.296 2.247a1.125 1.125 0 01-1.37.49l-1.217-.456c-.355-.133-.75-.072-1.075.124a6.57 6.57 0 01-.22.127c-.332.183-.582.495-.645.87l-.213 1.281c-.09.543-.56.94-1.11.94h-2.593c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.063-.374-.313-.686-.645-.87a6.52 6.52 0 01-.22-.127c-.324-.196-.72-.257-1.075-.124l-1.217.456a1.125 1.125 0 01-1.37-.49l-1.296-2.247a1.125 1.125 0 01.26-1.431l1.003-.827c.293-.24.438-.613-.438.995s-.145-.755-.438-.995l-1.003-.827a1.125 1.125 0 01-.26-1.431l1.296-2.247a1.125 1.125 0 011.37-.49l1.217.456c.355.133.75.072 1.075-.124.073-.044.146-.087.22-.127.332-.183.582-.495-.645-.87l.213-1.281z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
  { id: "market",     label: "Market",     iconPath: "M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c.51 0 .962-.343 1.087-.835l.383-1.437M7.5 14.25L5.106 5.165A2.25 2.25 0 017.25 3h9.5a2.25 2.25 0 012.144 2.165L16.5 14.25" },
  { id: "profil",     label: "Profil",     iconPath: "M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" },
];

const NavBtn: FC<{ item: NavItem; isActive: boolean; onClick: () => void }> = ({ item, isActive, onClick }) => (
  <button onClick={onClick} className={`flex flex-col items-center justify-center gap-1 font-semibold ${isActive ? 'active' : ''}`}>
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={isActive ? 2 : 1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d={item.iconPath} />
    </svg>
    <span className="leading-none text-[11px]">{item.label}</span>
  </button>
);

const Navigation: FC<{ activeTab: TabName; setActiveTab: (tab: TabName) => void }> = ({ activeTab, setActiveTab }) => {
  const navRef = useRef<HTMLElement | null>(null);

  // Set CSS var --nav-h agar konten punya padding bawah sesuai tinggi nav
  useLayoutEffect(() => {
    const el = navRef.current;
    if (!el) return;

    const apply = () => {
      const h = el.getBoundingClientRect().height;
      document.documentElement.style.setProperty("--nav-h", `${Math.ceil(h)}px`);
    };

    apply();

    // re-apply saat ukuran berubah (keyboard, orientation, dll)
    const ro = new ResizeObserver(apply);
    ro.observe(el);

    // beberapa mobile browser gak trigger ResizeObserver pada safe-area change → fallback
    const onResize = () => apply();
    window.addEventListener("resize", onResize);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <nav ref={navRef} className="nav">
      <div className="nav-inner">
        {NAV_ITEMS.map((item) => (
          <NavBtn
            key={item.id}
            item={item}
            isActive={activeTab === item.id}
            onClick={() => setActiveTab(item.id)}
          />
        ))}
      </div>
    </nav>
  );
};

export default Navigation;

