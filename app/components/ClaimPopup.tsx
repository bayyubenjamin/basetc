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
      {/* backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* modal */}
      <div className="fixed inset-0 z-50 grid place-items-center p-4">
        <div className="w-full max-w-sm fin-card fin-card-trans neu rounded-2xl text-white">
          <div className="p-5 text-center">
            <div className="flex justify-center">
              <div className="neu-inner rounded-xl p-3">
                <Image
                  src="/img/vga_basic.png"
                  alt="Basic Rig"
                  width={96}
                  height={96}
                  className="object-contain"
                />
              </div>
            </div>

            <h2 className="text-xl font-bold mt-4">BaseTC Console!</h2>
            <p className="text-sm text-neutral-300 mt-2 mb-6">
              Claim your free Basic Rig to start mining on the BaseTC Console.
            </p>

            <div className="flex flex-col gap-2">
              <button
                onClick={onClaim}
                className="w-full rounded-md px-4 py-3 text-sm font-semibold fin-btn neu-btn"
              >
                Go to Market to Claim
              </button>
              <button
                onClick={onClose}
                className="w-full rounded-md px-4 py-2 text-sm text-neutral-300 hover:text-white neu-btn"
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

