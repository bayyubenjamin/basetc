// app/components/HarvestPopup.tsx
"use client";

import { type FC } from "react";
// Pastikan install sdk: npm install @farcaster/miniapp-sdk
import { sdk } from "@farcaster/miniapp-sdk";

interface HarvestPopupProps {
  open: boolean;
  amount: string;
  onClose: () => void;
}

const HarvestPopup: FC<HarvestPopupProps> = ({ open, amount, onClose }) => {
  if (!open) return null;

  const handleShare = () => {
    const text = `I just harvested ${amount} from my mining rig! ⛏️💰\n\nReal yield on Base. Start your factory now! 👇\n\n#BaseTC #BuildOnBase #HarvestDay`;
    const embed = "https://basetc.xyz"; 
    const url = `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=${encodeURIComponent(embed)}`;
    try {
      sdk.actions.openUrl(url);
    } catch {
      window.open(url, "_blank");
    }
  };

  return (
    <>
      <div 
        className="fixed inset-0 z-[1100] bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[1200] grid place-items-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-sm rounded-3xl bg-white text-[var(--text)] shadow-2xl border border-[color:rgba(0,0,0,.06)] scale-100 animate-in zoom-in-95 duration-200 overflow-hidden">
          <div className="bg-gradient-to-b from-green-50 to-white p-6 pb-2 grid place-items-center">
             <div className="h-20 w-20 rounded-full bg-green-100 text-green-600 grid place-items-center text-4xl shadow-inner border-4 border-white">
                🤑
             </div>
          </div>
          <div className="p-6 pt-2 flex flex-col items-center text-center">
            <h3 className="text-2xl font-black text-gray-800 mb-1">HARVESTED!</h3>
            <p className="text-sm text-gray-500 font-medium mb-4">Rewards secured in your wallet</p>
            <div className="bg-green-50/50 border border-green-100 rounded-xl py-3 px-6 mb-6 w-full">
              <span className="block text-xs text-green-600 font-bold uppercase tracking-wider mb-1">Total Amount</span>
              <span className="block text-3xl font-black text-green-700 tracking-tight">{amount}</span>
            </div>
            <div className="flex flex-col gap-3 w-full">
              <button
                onClick={handleShare}
                className="w-full px-4 py-3.5 rounded-xl bg-[#855DCD] text-white font-bold text-sm hover:opacity-90 active:scale-[0.98] shadow-lg shadow-purple-200 flex items-center justify-center gap-2"
              >
                <span>🚀 Share on Warpcast</span>
              </button>
              <button
                onClick={onClose}
                className="w-full px-4 py-3.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 active:scale-[0.98]"
              >
                Close & Keep Mining
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
export default HarvestPopup;
