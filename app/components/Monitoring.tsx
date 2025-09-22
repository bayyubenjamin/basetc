import Image from "next/image";

const StatTile = ({ label, value }: { label: string; value: string }) => (
  <div className="summary-tile">
    <div className="k">{label}</div>
    <div className="v truncate">{value}</div>
  </div>
);

export default function Monitoring() {
  return (
    <>
      {/* Panel: Monitor */}
      <section className="panel monitor">
        {/* Summary row */}
        <div className="summary-row no-scrollbar -mx-1 px-1">
          <StatTile label="Pool" value="stratum+tcp://pool.base:3333" />
          <StatTile label="Total Hash" value="2.15 H/s" />
          <StatTile label="Uptime" value="00:15:42" />
        </div>

        {/* Chart (kiri) + info tiles (kanan) */}
        <div className="screen-grid">
          <div className="chart" />
          <div className="info-tiles">
            <div className="tile">
              <strong className="text-xs">Pool Status</strong>
              <div className="text-xs text-[color:var(--muted)]">Connected • No errors</div>
            </div>
            <div className="tile text-center">
              <strong className="text-xs">Power</strong>
              <div className="font-bold text-lg">250 W</div>
            </div>
          </div>
        </div>

        {/* Terminal — link style dibikin netral lewat CSS */}
        <div className="terminal">
          <p><span className="text-gray-500 mr-2">13:15:50</span><span className="term-ok">Accepted share - work 0x1234...</span></p>
          <p><span className="text-gray-500 mr-2">13:15:48</span>Pool ping OK</p>
        </div>
      </section>

      {/* Panel: Rig Room */}
      <section className="panel">
        <div className="flex justify-between items-baseline">
          <div>
            <strong className="text-sm">Rig Room</strong>
            <div className="text-xs text-[color:var(--muted)]">2 x GPUs • fan auto</div>
          </div>
          <div className="text-xs text-[color:var(--muted)]">Ping <span className="text-[color:var(--text)]">18 ms</span></div>
        </div>

        <div className="rig-wrap mt-2">
          <div className="rig-aspect">
            <Image src="/img/pro.png" alt="Rig" fill priority sizes="(max-width: 430px) 100vw, 430px" />
          </div>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th className="w-1/4">GPU</th>
              <th className="w-1/4">Temp</th>
              <th className="w-1/4">Fan</th>
              <th className="w-1/4">Hash</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>GPU 0</td><td>45 °C</td><td>45%</td><td>1.10 H/s</td>
            </tr>
            <tr>
              <td>GPU 1</td><td>46 °C</td><td>48%</td><td>1.05 H/s</td>
            </tr>
          </tbody>
        </table>

        <div className="grid grid-cols-3 gap-2 mt-2">
          <button className="btn">Start</button>
          <button className="btn">Fan +</button>
          <button className="btn">Fan −</button>
        </div>
      </section>
    </>
  );
}

