// app/components/ClaimPopup.tsx
"use client";

import { type FC } from "react";
import Image from "next/image";

interface ClaimPopupProps {
  onClose: () => void;
  onClaim: () => void;
}

const ClaimPopup: FC<ClaimPopupProps> = ({ onClose, onClaim }) => {
  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 grid place-items-center p-4">
        <div className="w-full max-w-sm rounded-2xl bg-neutral-900 text-white shadow-2xl border border-white/10 fin-card-trans">
          <div className="p-5 text-center">
            <div className="flex justify-center">
                <Image src="/img/vga_basic.png" alt="Basic Rig" width={96} height={96} />
            </div>
            <h2 className="text-xl font-bold mt-4">Welcome, Miner!</h2>
            <p className="text-sm text-neutral-300 mt-2 mb-6">
              Claim your free Basic Rig to start mining on the BaseTC Console.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={onClaim}
                className="w-full rounded-md px-4 py-3 text-sm font-semibold bg-blue-600 text-white hover:bg-blue-500 transition-colors"
              >
                Go to Market to Claim
              </button>
              <button
                onClick={onClose}
                className="w-full rounded-md px-4 py-2 text-sm text-neutral-400 hover:bg-neutral-800"
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ClaimPopup;
