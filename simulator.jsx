/* simulator.jsx — "Симулятор стратегий": runs every strategy on real Bybit
 * candles for the chosen asset/period and shows the P&L per strategy as a ranked
 * leaderboard + overlaid equity curves. Reuses the real backtest engine
 * (realBacktest / strategyTrade from tools.jsx) — no invented numbers. */

const SIM_COINS = [
  { sym: "BTC", bybit: "BTCUSDT" }, { sym: "ETH", bybit: "ETHUSDT" },
  { sym: "SOL", bybit: "SOLUSDT" }, { sym: "BNB", bybit: "BNBUSDT" },
  { sym: "XRP", bybit: "XRPUSDT" }, { sym: "AVAX", bybit: "AVAXUSDT" },
  { sym: "LINK", bybit: "LINKUSDT" }, { sym: "DOGE", bybit: "DOGEUSDT" },
];
const SIM_STRATEGIES = [
  { id: "ai-signals",   name: "AI Signals",        color: "var(--accent)" },
  { id: "momentum",     name: "Momentum",          color: "var(--green)" },
  { id: "mean-rev",     name: "Mean Reversion",    color: "var(--blue)" },
  { id: "vol-breakout", name: "Volatility Breakout", color: "var(--accent-2)" },
];
const SIM_PERIODS = [
  { id: "day",   label: "День",   interval: "15",  limit: 200 },
  { id: "week",  label: "Неделя", interval: "60",  limit: 200 },
  { id: "month", label: "Месяц",  interval: "240", limit: 200 },
];

function SimulatorPage({ lang }) {
  const [coinIdx, setCoinIdx] = useState(0);
  const [periodId, setPeriodId] = useState("day");
  const [capital, setCapital] = useState(() => { try { return +localStorage.getItem("vael.budget") || 10000; } catch (_) { return 10000; } });
  const [lev, setLev] = useState(1);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState(null);
  const [ts, setTs] = useState(null);

  const coin = SIM_COINS[coinIdx];
  const period = SIM_PERIODS.find(p => p.id === periodId);

  async function run() {
    if (typeof bybitFetchKlines !== "function" || typeof realBacktest !== "function") return;
    setRunning(true); setResults(null);
    try {
      const candles = await bybitFetchKlines(coin.bybit, period.interval, period.limit);
      const rows = SIM_STRATEGIES.map(s => {
        try {
          const r = realBacktest(candles, { capital, leverage: lev, fees: 0.02, strategy: s.id });
          return { ...s, ...r.stats, curve: r.curve, profit: capital * r.stats.totalReturn / 100 };
        } catch (_) { return { ...s, totalReturn: 0, trades: 0, winRate: 0, sharpe: 0, maxDD: 0, profitFactor: 0, curve: [{ v: capital }], profit: 0 }; }
      }).sort((a, b) => b.totalReturn - a.totalReturn);
      setResults({ rows, candles: candles.length });
      setTs(new Date());
    } catch (_) { setResults({ rows: [], candles: 0 }); }
    setRunning(false);
  }
  useEffect(() => { run(); /* auto-run on open */ /* eslint-disable-next-line */ }, []);

  const best = results && results.rows[0];
  const totalProfit = results ? results.rows.reduce((s, r) => s + r.profit, 0) : 0;

  return (
    <div className="scroll" style={{ minHeight: "100%", overflowY: "auto", padding: "var(--gap)", display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-bright)", letterSpacing: "-0.01em" }}>
            Симулятор стратегий <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>· прибыль по стратегиям</span>
          </div>
          <div className="mono" style={{ fontSize: 10.5, color: "var(--text-dim)", marginTop: 3 }}>
            реальный бэктест движка на свечах Bybit · комиссия 0.02% · без наложения сделок
          </div>
        </div>
        {typeof LiveTag === "function" && <LiveTag status={running ? "connecting" : results ? "live" : "rest"} />}
      </div>

      {/* Controls */}
      <div className="panel" style={{ padding: "10px 14px", display: "flex", flexWrap: "wrap", gap: 18, alignItems: "center" }}>
        <SimGroup label="Актив">
          {SIM_COINS.map((c, i) => <SimBtn key={c.sym} on={i === coinIdx} onClick={() => setCoinIdx(i)}>{c.sym}</SimBtn>)}
        </SimGroup>
        <SimGroup label="Период">
          {SIM_PERIODS.map(p => <SimBtn key={p.id} on={periodId === p.id} onClick={() => setPeriodId(p.id)}>{p.label}</SimBtn>)}
        </SimGroup>
        <SimGroup label="Плечо">
          {[1, 2, 5, 10].map(l => <SimBtn key={l} on={lev === l} onClick={() => setLev(l)}>{l}x</SimBtn>)}
        </SimGroup>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", textTransform: "uppercase" }}>Капитал</span>
          <input type="number" value={capital} onChange={e => setCapital(Math.max(100, +e.target.value || 0))}
            style={{ width: 90, background: "var(--bg-0)", border: "1px solid var(--line-bright)", color: "var(--text-bright)", fontFamily: "var(--font-mono)", fontSize: 11, padding: "4px 7px", borderRadius: 3, outline: "none", textAlign: "right" }} />
          <span className="mono" style={{ fontSize: 10, color: "var(--text-dim)" }}>$</span>
        </div>
        <button onClick={run} disabled={running} className="btn btn-accent" style={{ marginLeft: "auto" }}>
          {running ? "⌛ считаю…" : "▸ Запустить симуляцию"}
        </button>
      </div>

      {running && !results ? (
        <div className="panel" style={{ padding: 40, textAlign: "center", color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
          прогоняю {SIM_STRATEGIES.length} стратегии на свечах {coin.sym}…
        </div>
      ) : results && results.rows.length ? (
        <>
          {/* Summary */}
          <div className="panel" style={{ display: "flex", flexWrap: "wrap" }}>
            <SimStat label={`ЛУЧШАЯ · ${period.label.toUpperCase()}`} v={best.name} c={best.color}
              sub={`${best.totalReturn >= 0 ? "+" : ""}${best.totalReturn.toFixed(1)}% · ${best.trades} сделок`} />
            <SimStat label="ПРИБЫЛЬ ЛУЧШЕЙ" v={`${best.profit >= 0 ? "+" : "−"}$${Math.abs(best.profit).toFixed(0)}`}
              c={best.profit >= 0 ? "var(--green)" : "var(--red)"} sub={`капитал $${capital.toLocaleString("en-US")} · ${lev}x`} />
            <SimStat label="ВИНРЕЙТ ЛУЧШЕЙ" v={`${best.winRate.toFixed(0)}%`} c={best.winRate >= 50 ? "var(--green)" : "var(--amber)"} sub={`PF ${best.profitFactor.toFixed(2)}`} />
            <SimStat label="СРЕДНЕЕ ПО СТРАТЕГИЯМ" v={`${totalProfit / results.rows.length >= 0 ? "+" : "−"}$${Math.abs(totalProfit / results.rows.length).toFixed(0)}`}
              c={totalProfit >= 0 ? "var(--green)" : "var(--red)"} sub={`${results.candles} свечей ${coin.sym}`} />
          </div>

          {/* Equity curves */}
          <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
            <PanelHeader title={`КРИВЫЕ КАПИТАЛА · ${coin.sym} · ${period.label.toUpperCase()}`} meta={`старт $${capital.toLocaleString("en-US")} · ${lev}x`} />
            <div style={{ padding: 12 }}>
              <SimCurves rows={results.rows} capital={capital} width={860} height={220} />
            </div>
          </div>

          {/* Leaderboard */}
          <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
            <PanelHeader title="РЕЙТИНГ СТРАТЕГИЙ" meta={ts ? `сформирован ${ts.toLocaleTimeString("ru-RU", { hour12: false })}` : ""} />
            <div style={{ display: "grid", gridTemplateColumns: "26px 1.4fr 90px 90px 70px 60px 70px 70px", padding: "6px 14px", background: "var(--bg-2)", fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.06, textTransform: "uppercase" }}>
              <span>#</span><span>Стратегия</span><span style={{ textAlign: "right" }}>Прибыль</span><span style={{ textAlign: "right" }}>ROI</span><span style={{ textAlign: "right" }}>Win</span><span style={{ textAlign: "right" }}>Сделок</span><span style={{ textAlign: "right" }}>PF</span><span style={{ textAlign: "right" }}>MaxDD</span>
            </div>
            {results.rows.map((r, i) => (
              <div key={r.id} style={{ display: "grid", gridTemplateColumns: "26px 1.4fr 90px 90px 70px 60px 70px 70px", padding: "7px 14px", borderBottom: "1px solid var(--line)", fontFamily: "var(--font-mono)", fontSize: 11, alignItems: "center", background: i === 0 ? "var(--accent-soft)" : "transparent" }}>
                <span style={{ color: i === 0 ? "var(--accent)" : "var(--text-dim)" }}>{i === 0 ? "★" : i + 1}</span>
                <span style={{ color: "var(--text-bright)", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: r.color, display: "inline-block" }} />{r.name}
                </span>
                <span style={{ textAlign: "right", color: r.profit >= 0 ? "var(--green)" : "var(--red)", fontWeight: 600 }}>{r.profit >= 0 ? "+" : "−"}${Math.abs(r.profit).toFixed(0)}</span>
                <span style={{ textAlign: "right", color: r.totalReturn >= 0 ? "var(--green)" : "var(--red)" }}>{r.totalReturn >= 0 ? "+" : ""}{r.totalReturn.toFixed(1)}%</span>
                <span style={{ textAlign: "right", color: r.winRate >= 50 ? "var(--green)" : "var(--amber)" }}>{r.winRate.toFixed(0)}%</span>
                <span style={{ textAlign: "right", color: "var(--text-dim)" }}>{r.trades}</span>
                <span style={{ textAlign: "right", color: r.profitFactor >= 1 ? "var(--green)" : "var(--red)" }}>{r.profitFactor.toFixed(2)}</span>
                <span style={{ textAlign: "right", color: "var(--amber)" }}>−{r.maxDD.toFixed(1)}%</span>
              </div>
            ))}
          </div>

          <div style={{ background: "var(--bg-2)", border: "1px dashed var(--line-bright)", borderRadius: 3, padding: "8px 12px", fontSize: 10.5, color: "var(--text-mid)", lineHeight: 1.5 }}>
            <span className="accent">↳ </span>Каждая стратегия прогнана по одним и тем же реальным свечам Bybit: вход по её правилам, ATR-стоп/цель, комиссия 0.02% на сторону, сделки не перекрываются. Прошлые результаты не гарантируют будущих — это не инвестиционная рекомендация.
          </div>
        </>
      ) : (
        <div className="panel" style={{ padding: 40, textAlign: "center", color: "var(--red)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
          не удалось загрузить свечи · проверьте соединение
        </div>
      )}
    </div>
  );
}

function SimCurves({ rows, capital, width = 860, height = 220 }) {
  const curves = rows.map(r => ({ color: r.color, name: r.name, pts: (r.curve || []).map(p => p.v) })).filter(c => c.pts.length > 1);
  if (!curves.length) return <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 11 }}>нет сделок</div>;
  const allVals = curves.flatMap(c => c.pts);
  const lo = Math.min(...allVals, capital), hi = Math.max(...allVals, capital);
  const pad = (hi - lo) * 0.08 || 1;
  const min = lo - pad, max = hi + pad, range = max - min;
  const padT = 10, padB = 10;
  const y = v => padT + (1 - (v - min) / range) * (height - padT - padB);
  const maxLen = Math.max(...curves.map(c => c.pts.length));
  const path = pts => pts.map((v, i) => `${i === 0 ? "M" : "L"}${(i / (maxLen - 1)) * width},${y(v)}`).join(" ");
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: "block", background: "var(--bg-1)", borderRadius: 4 }}>
      <line x1={0} y1={y(capital)} x2={width} y2={y(capital)} stroke="var(--text-dim)" strokeWidth={0.7} strokeDasharray="3 3" opacity={0.5} />
      <text x={4} y={y(capital) - 3} fill="var(--text-dim)" style={{ fontFamily: "var(--font-mono)", fontSize: 9 }}>старт ${capital.toLocaleString("en-US")}</text>
      {curves.map((c, i) => <path key={i} d={path(c.pts)} fill="none" stroke={c.color} strokeWidth={1.4} opacity={0.9} />)}
    </svg>
  );
}

function SimGroup({ label, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", textTransform: "uppercase" }}>{label}</span>
      <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>{children}</div>
    </div>
  );
}
function SimBtn({ on, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      fontFamily: "var(--font-mono)", fontSize: 10, padding: "2px 8px", borderRadius: 2, cursor: "pointer",
      background: on ? "var(--accent-soft)" : "transparent", color: on ? "var(--accent)" : "var(--text-dim)",
      border: `1px solid ${on ? "oklch(0.74 0.075 var(--accent-h) / 0.4)" : "var(--line)"}`,
    }}>{children}</button>
  );
}
function SimStat({ label, v, c, sub }) {
  return (
    <div style={{ flex: 1, minWidth: 160, padding: "12px 16px", borderRight: "1px solid var(--line)" }}>
      <div style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.12, fontWeight: 600, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, color: c, marginTop: 2, fontWeight: 500 }}>{v}</div>
      {sub && <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

Object.assign(window, { SimulatorPage });
