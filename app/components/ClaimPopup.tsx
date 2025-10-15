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
        className="fixed inset-0 z-40"
        onClick={onClose}
        style={{
          background: "rgba(0,0,0,.45)",
          backdropFilter: "blur(2px)",
          WebkitBackdropFilter: "blur(2px)",
        }}
      />
      {/* modal */}
      <div className="fixed inset-0 z-50 grid place-items-center p-4">
        <div
          className="w-full max-w-sm fin-card fin-card-trans neu rounded-2xl"
          style={{
            // glass terang + kontras teks
            background: "rgba(255,255,255,.78)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            border: "1px solid rgba(0,0,0,.06)",
            color: "var(--text)",
          }}
        >
          <div className="p-5 text-center">
            <div className="flex justify-center">
              <div
                className="neu-inner rounded-xl p-3"
                style={{ background: "linear-gradient(145deg,#ffffff,#eaf1ff)" }}
              >
                <Image
                  src="/img/vga_basic.png"
                  alt="Basic Rig"
                  width={96}
                  height={96}
                  className="object-contain"
                />
              </div>
            </div>

            <h2 className="text-xl font-bold mt-4" style={{ color: "var(--text)" }}>
              BaseTC Console!
            </h2>
            <p
              className="text-sm mt-2 mb-6 font-semibold"
              style={{ color: "var(--muted)" }}
            >
              Claim your free Basic Rig to start mining on the BaseTC Console.
            </p>

            <div className="flex flex-col gap-2">
              {/* Primary CTA */}
              <button
                onClick={onClaim}
                className="w-full rounded-md px-4 py-3 text-sm font-semibold fin-btn neu-btn"
                // neu-btn sudah gradient biru + teks putih → kontras aman
              >
                Go to Market to Claim
              </button>

              {/* Secondary / ghost */}
              <button
                onClick={onClose}
                className="w-full rounded-md px-4 py-2 text-sm font-semibold"
                style={{
                  background:
                    "linear-gradient(145deg, rgba(255,255,255,.9), rgba(234,241,255,.9))",
                  border: "1px solid rgba(0,0,0,.06)",
                  boxShadow:
                    "4px 4px 8px rgba(0,0,0,.10), -4px -4px 8px rgba(255,255,255,.9), inset 0 0 0 1px rgba(255,255,255,.5)",
                  color: "var(--text)",
                }}
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