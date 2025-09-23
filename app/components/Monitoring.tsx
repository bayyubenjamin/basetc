"use client";
export default function Monitoring() {
  return (
    <>
      {/* Monitor / Screen */}
      <section className="monitor-wrap">
        <div className="screen">
          {/* summaries horizontal */}
          <div className="summaries">
            <div className="sum-tile">
              <div className="k">Active Miners</div>
              <div className="v">12</div>
            </div>
            <div className="sum-tile">
              <div className="k">24h Yield</div>
              <div className="v">321 $BaseTC</div>
            </div>
            <div className="sum-tile">
              <div className="k">Uptime</div>
              <div className="v">99.2%</div>
            </div>
          </div>

          {/* area chart kecil */}
          <div className="chart-area">
            <div className="mini-plot" />
            <div className="panel-right">
              <div className="tile">
                <div className="k">Temp Avg</div>
                <div className="v">64°C</div>
              </div>
              <div className="tile">
                <div className="k">Power</div>
                <div className="v">1.2 kW</div>
              </div>
            </div>
          </div>

          {/* terminal log */}
          <div className="terminal no-scrollbar">
            <div className="term-line term-ok">[OK] Miner initialized…</div>
            <div className="term-line term-info">[INFO] Submitting share…</div>
            <div className="term-line term-warn">[WARN] Fan speed high…</div>
            <div className="term-line term-err">[ERR] GPU#3 throttled</div>
          </div>
        </div>
      </section>

      {/* Panel Rig + tabel GPU */}
      <section className="panel">
        <div className="heading">
          <div className="title">Rig Pro #A17</div>
          <div className="small">Legendary uptime</div>
        </div>

        <div className="rig-image">
          {/* ganti src sesuai asetmu */}
          <img src="/rig-pro.png" alt="Rig Pro" />
        </div>

        <table className="gputable">
          <thead>
            <tr>
              <th>GPU</th><th>Hashrate</th><th>Temp</th><th>Fan</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>GPU 1</td><td>62 MH/s</td><td>63°C</td><td>45%</td></tr>
            <tr><td>GPU 2</td><td>61 MH/s</td><td>65°C</td><td>47%</td></tr>
            <tr><td>GPU 3</td><td>60 MH/s</td><td>68°C</td><td>55%</td></tr>
          </tbody>
        </table>

        <div className="controls">
          <button className="btn">Restart</button>
          <button className="btn">Repair</button>
          <button className="btn primary">Boost</button>
        </div>
      </section>
    </>
  );
}

