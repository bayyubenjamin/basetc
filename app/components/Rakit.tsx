"use client";

import type { FC } from "react";
// Jika memang butuh TabName untuk props/callback, import dari Navigation:
import type { TabName } from "./Navigation";

// NOTE: Kalau komponen ini TIDAK butuh TabName, baris di atas bisa dihapus.

// Definisikan tipe Nft lokal HANYA jika kamu pakai anotasi Nft di file ini.
// Kalau tidak ada penggunaan Nft sama sekali, hapus tipe ini.
type Nft = {
  id: number;
  tier?: "Basic" | "Pro" | "Legend";
  name?: string;
};

const Rakit: FC = () => {
  return (
    <section className="panel">
      <div className="heading">
        <div className="title">Workshop / Rakit</div>
        <div className="small">Upgrade &amp; Merge</div>
      </div>

      <div className="summaries" style={{ marginTop: 8 }}>
        <div className="sum-tile">
          <div className="k">Basic</div>
          <div className="v">x7</div>
        </div>
        <div className="sum-tile">
          <div className="k">Pro</div>
          <div className="v">x2</div>
        </div>
        <div className="sum-tile">
          <div className="k">Legend</div>
          <div className="v">x0</div>
        </div>
      </div>

      <div className="controls">
        <button className="btn">10 Basic → 1 Pro</button>
        <button className="btn">5 Pro → 1 Legend</button>
        <button className="btn primary">Unlock Slot</button>
      </div>
    </section>
  );
};

export default Rakit;

