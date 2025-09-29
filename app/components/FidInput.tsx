// app/components/FidInput.tsx
//
// Alasan: Menyediakan UI fallback yang sederhana untuk pengguna di luar Farcaster App
// agar mereka bisa memasukkan FID secara manual dan menggunakan aplikasi.
// Dibuat sebagai komponen terpisah agar tidak mengotori layout utama.
"use client";

import { useState, type FC } from "react";

const FidInput: FC<{ setFid: (fid: number) => void }> = ({ setFid }) => {
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedFid = parseInt(inputValue, 10);
    if (!isNaN(parsedFid) && parsedFid > 0) {
      setFid(parsedFid);
    } else {
      setError("Please enter a valid Farcaster ID (FID).");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-950 text-neutral-50 p-4 text-center">
      <div className="max-w-sm w-full space-y-4">
        <h1 className="text-xl font-semibold">Welcome to BaseTC Miner</h1>
        <p className="text-neutral-400 text-sm">
          To continue, please provide your Farcaster ID (FID). You can find this on your Warpcast profile.
        </p>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            pattern="\d*"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Enter your FID"
            className="flex-1 px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-md text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Farcaster ID"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-md transition-colors"
          >
            Continue
          </button>
        </form>
        {error && <p className="text-xs text-red-400">{error}</p>}
         <p className="text-xs text-neutral-500 pt-4">
          If you are inside a Farcaster app, please try restarting it.
        </p>
      </div>
    </div>
  );
};

export default FidInput;
