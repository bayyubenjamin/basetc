"use client";

import { usePathname, useRouter } from "next/navigation";
import { Home, Pickaxe, Swords, Trophy, User } from "lucide-react";

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();

  const navItems = [
    { name: "Home", icon: Home, path: "/" },
    { name: "Mine", icon: Pickaxe, path: "/rakit" }, // Asumsi path untuk Rakit/Mining
    { name: "Arena", icon: Swords, path: "/arena" }, // Asumsi path untuk Arena
    { name: "Rank", icon: Trophy, path: "/leaderboard" },
    { name: "Profile", icon: User, path: "/profile" },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      {/* Gradient Fade di atas Navigasi agar transisi halus */}
      <div className="absolute bottom-full left-0 right-0 h-12 bg-gradient-to-t from-black to-transparent pointer-events-none" />

      {/* Main Container - Diperkecil padding-nya (pb-5 pt-2) */}
      <nav className="bg-[#0a0a0a]/90 backdrop-blur-xl border-t border-white/10 pb-5 pt-2 px-2 shadow-2xl shadow-black">
        <ul className="flex justify-between items-center max-w-md mx-auto relative">
          
          {navItems.map((item) => {
            const isActive = pathname === item.path;
            const Icon = item.icon;

            return (
              <li key={item.name} className="flex-1">
                <button
                  onClick={() => router.push(item.path)}
                  className={`w-full flex flex-col items-center justify-center gap-0.5 py-1 transition-all duration-300 relative group ${
                    isActive ? "text-white" : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {/* Active Indicator (Glow Background) */}
                  {isActive && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-red-600/20 rounded-full blur-md -z-10 animate-pulse" />
                  )}

                  {/* Icon Wrapper */}
                  <div
                    className={`relative p-1.5 rounded-xl transition-all duration-300 ${
                      isActive
                        ? "bg-gradient-to-br from-red-600 to-red-800 shadow-lg shadow-red-900/40 translate-y-[-2px]"
                        : "bg-transparent group-hover:bg-white/5"
                    }`}
                  >
                    <Icon
                      size={20} // Ukuran ikon diperkecil agar tidak terlalu besar
                      strokeWidth={isActive ? 2.5 : 2}
                      className={`transition-transform duration-300 ${
                        isActive ? "scale-105" : "group-hover:scale-110"
                      }`}
                    />
                  </div>

                  {/* Label Text */}
                  <span
                    className={`text-[10px] font-medium tracking-wide transition-all duration-300 ${
                      isActive ? "text-red-100 opacity-100 font-bold" : "opacity-70 group-hover:opacity-100"
                    }`}
                  >
                    {item.name}
                  </span>
                  
                  {/* Active Dot di bawah */}
                  {isActive && (
                    <span className="absolute -bottom-1 w-1 h-1 bg-red-500 rounded-full shadow-[0_0_8px_2px_rgba(239,68,68,0.6)]" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
