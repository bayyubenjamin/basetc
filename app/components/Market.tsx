"use client";

import { FC } from "react";
import Image from "next/image";

// Jenis tier yang didukung
type TierID = "basic" | "pro" | "legend";

// Struktur data setiap tier NFT
interface NFTTier {
  id: TierID;
  name: string;
  image: string;
  hashrateHint: string;
  price: string;
  description: string;
}

// Data dummy untuk setiap tier — ganti sesuai data aktual jika perlu
const NFT_DATA: NFTTier[] = [
  {
    id: "basic",
    name: "Basic Rig",
    image: "/img/vga_basic.png",
    hashrateHint: "~1.5 H/s",
    price: "FREE",
    description: "Claim your first rig for free to start mining.",
  },
  {
    id: "pro",
    name: "Pro Rig",
    image: "/img/vga_pro.png",
    hashrateHint: "~5.0 H/s",
    price: "TBA",
    description: "Upgrade for a significant boost in hashrate.",
  },
  {
    id: "legend",
    name: "Legend Rig",
    image: "/img/vga_legend.png",
    hashrateHint: "~25.0 H/s",
    price: "TBA",
    description: "The ultimate rig for professional miners.",
  },
];

/**
 * Properti komponen Market. onTransactionSuccess sekarang opsional,
 * sehingga ketika komponen ini dipanggil tanpa prop tersebut, tidak terjadi error.
 */
export interface MarketProps {
  onTransactionSuccess?: () => void;
}

/**
 * Komponen Market menampilkan daftar NFT rig yang tersedia.
 * Hanya tier "basic" yang dapat di-claim gratis; tier lain akan segera hadir.
 */
const Market: FC<MarketProps> = ({ onTransactionSuccess }) => {
  return (
    <section className="panel">
      {/* Judul bagian Market */}
      <div className="heading">
        <div className="title">Market</div>
        <div className="small">Mint &amp; Listing</div>
      </div>

      {/* Deretan kartu NFT */}
      <div className="summaries" style={{ marginTop: 8 }}>
        {NFT_DATA.map((tier) => (
          <div key={tier.id} className="sum-tile" style={{ minWidth: "100%" }}>
            {/* Gambar rig */}
            <div className="rig-image">
              {/* Jika kamu memakai Next.js <Image>, pastikan file ada di folder /public/img/ */}
              <Image
                src={tier.image}
                alt={tier.name}
                width={300}
                height={160}
                style={{ objectFit: "contain" }}
              />
            </div>

            {/* Nama + harga */}
            <div className="k" style={{ marginTop: 6 }}>
              {tier.name}
            </div>
            <div className="v">{tier.price}</div>

            {/* Deskripsi dan hashrate hint */}
            <div className="k" style={{ marginTop: 4 }}>
              {tier.description}
            </div>
            <div className="k">Est. Hashrate: {tier.hashrateHint}</div>

            {/* Tombol aksi */}
            <div style={{ marginTop: 8 }}>
              <button
                className={`btn ${tier.id === "basic" ? "primary" : ""}`}
                disabled={tier.id !== "basic"}
                onClick={() => {
                  if (tier.id === "basic") {
                    // Jika user klik Claim Free Rig, jalankan callback bila ada
                    onTransactionSuccess?.();
                  }
                }}
              >
                {tier.id === "basic" ? "Claim Free Rig" : "Coming Soon"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default Market;

