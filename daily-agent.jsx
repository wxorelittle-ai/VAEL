/* daily-agent.jsx — "Daily trend agent" screen.
 * Pulls a window of real Bybit 15m candles, has the TA engine (analyzeMarket)
 * walk the day forward, opens a simulated demo trade on every genuine setup,
 * and reports: the trend read, a full signal log, an equity curve, and how much
 * a fixed demo deposit would have earned. Honest backtest of the live engine. */

const DA_COINS = [
  { sym: "BTC", bybit: "BTCUSDT" }, { sym: "ETH", bybit: "ETHUSDT" },
  { sym: "SOL", bybit: "SOLUSDT" }, { sym: "BNB", bybit: "BNBUSDT" },
  { sym: "XRP", bybit: "XRPUSDT" }, { sym: "AVAX", bybit: "AVAXUSDT" },
  { sym: "LINK", bybit: "LINKUSDT" }, { sym: "DOGE", bybit: "DOGEUSDT" },
];
const DA_NOTIONAL = 1000;

function hhmm(ts) {
  try { const d = new Date(ts); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }
  catch (_) { return "—"; }
}

function DailyAgentPage({ lang }) {
  const [idx, setIdx] = useState(0);
  const [candles, setCandles] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const A = DA_COINS[idx];

  useEffect(() => {
    if (typeof bybitFetchKlines !== "function") { setLoading(false); setErr(true); return; }
    let cancelled = false;
    setLoading(true); setErr(false);
    bybitFetchKlines(A.bybit, "15", 200)
      .then(kl => { if (!cancelled) { setCandles(kl); setLoading(false); } })
      .catch(() => { if (!cancelled) { setErr(true); setLoading(false); } });
    return () => { cancelled = true; };
  }, [idx]);

  const sim = useMemo(
    () => (candles && typeof dailyAgentSim === "function") ? dailyAgentSim(candles, DA_NOTIONAL) : null,
    [candles]
  );

  const trendUp = sim ? sim.trend.chgPct >= 0 : true;
  const profit = sim ? sim.stats.profit : 0;
  const profitColor = profit >= 0 ? "var(--green)" : "var(--red)";

  // narrative — all derived from real numbers, no fabrication
  const narrative = sim ? [
    `Проанализировал ${sim.windowCandles} свечей 15m по ${A.sym} (≈${Math.round(sim.windowCandles * 15 / 60)}ч).`,
    `Тренд окна: ${trendUp ? "восходящий ▲" : "нисходящий ▼"} (${sim.trend.chgPct >= 0 ? "+" : ""}${sim.trend.chgPct.toFixed(2)}%), цена ${sim.trend.aboveEma ? "выше" : "ниже"} EMA50.`,
    `TA-движок зафиксировал ${sim.stats.trades} сетапов, винрейт ${sim.stats.winRate.toFixed(0)}%.`,
    `Демо-симуляция на депозите $${sim.notional}: ${profit >= 0 ? "+" : ""}$${profit.toFixed(2)} (ROI ${sim.stats.roi >= 0 ? "+" : ""}${sim.stats.roi.toFixed(2)}%).`,
  ] : [];

  return (
    <div className="scroll" style={{ height: "100%", overflowY: "auto", padding: "var(--gap)", display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-bright)", letterSpacing: "-0.01em" }}>
            Дневной тренд-агент <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>· авто-симуляция</span>
          </div>
          <div className="mono" style={{ fontSize: 10.5, color: "var(--text-dim)", marginTop: 3 }}>
            TA-движок гоняет день вперёд на реальных свечах Bybit 15m и считает демо-P&L
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {DA_COINS.map((c, i) => (
            <button key={c.sym} onClick={() => setIdx(i)} style={{
              fontFamily: "var(--font-mono)", fontSize: 10.5, padding: "3px 10px", borderRadius: 3,
              background: i === idx ? "var(--accent-soft)" : "var(--bg-2)",
              color: i === idx ? "var(--accent)" : "var(--text-mid)",
              border: `1px solid ${i === idx ? "oklch(0.78 0.16 var(--accent-h) / 0.4)" : "var(--line)"}`,
              cursor: "pointer",
            }}>{c.sym}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="panel" style={{ padding: 40, textAlign: "center", color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
          агент загружает свечи Bybit для {A.sym}…
        </div>
      ) : err || !sim ? (
        <div className="panel" style={{ padding: 40, textAlign: "center", color: "var(--red)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
          не удалось загрузить данные · проверьте соединение
        </div>
      ) : (
        <>
          {/* Agent narrative */}
          <div className="panel" style={{ padding: "12px 16px", borderLeft: `3px solid ${trendUp ? "var(--green)" : "var(--red)"}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ color: "var(--accent)", fontFamily: "var(--font-mono)", fontSize: 13 }}>✦</span>
              <span style={{ fontSize: 12, color: "var(--text-bright)", fontWeight: 500 }}>strategy.agt · разбор дня</span>
              <span className="mono" style={{ marginLeft: "auto", fontSize: 9.5, color: "var(--text-dim)" }}>движок analyzeMarket · 15m</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--text-mid)", lineHeight: 1.6 }}>
              {narrative.map((line, i) => <div key={i}><span style={{ color: "var(--accent-2)" }}>▸ </span>{line}</div>)}
            </div>
          </div>

          {/* Big stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--gap)" }}>
            <DaStat label={`ПРОФИТ · демо $${sim.notional}`} v={`${profit >= 0 ? "+" : ""}$${profit.toFixed(2)}`} c={profitColor} big />
            <DaStat label="ROI" v={`${sim.stats.roi >= 0 ? "+" : ""}${sim.stats.roi.toFixed(2)}%`} c={profitColor} big />
            <DaStat label="СИГНАЛОВ" v={sim.stats.trades} c="var(--text-bright)" sub={`${sim.stats.wins}W · ${sim.stats.losses}L`} />
            <DaStat label="ВИНРЕЙТ" v={`${sim.stats.winRate.toFixed(0)}%`} c={sim.stats.winRate >= 50 ? "var(--green)" : "var(--amber)"} />
          </div>

          {/* Equity curve */}
          <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
            <PanelHeader title="КРИВАЯ КАПИТАЛА · демо-симуляция" meta={`старт $${sim.notional} · риск 2%/сделку · ATR SL/TP`} />
            <div style={{ padding: 12 }}>
              <EquityCurve curve={sim.curve} notional={sim.notional} width={860} height={170} />
            </div>
          </div>

          {/* Signals log */}
          <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
            <PanelHeader title="ЖУРНАЛ СИГНАЛОВ" meta={`${sim.trades.length} демо-сделок за окно`} />
            {sim.trades.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
                за окно движок не нашёл ни одного качественного сетапа (боковик / низкая волатильность)
              </div>
            ) : (
              <div className="scroll" style={{ maxHeight: 300, overflowY: "auto" }}>
                <div style={{ display: "grid", gridTemplateColumns: "56px 70px 90px 90px 60px 90px 1fr", padding: "5px 14px", background: "var(--bg-2)", position: "sticky", top: 0, fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.06, textTransform: "uppercase" }}>
                  <span>Время</span><span>Сторона</span><span style={{ textAlign: "right" }}>Вход</span><span style={{ textAlign: "right" }}>Выход</span><span style={{ textAlign: "right" }}>Conf</span><span style={{ textAlign: "right" }}>P&L</span><span style={{ paddingLeft: 10 }}>Причина</span>
                </div>
                {sim.trades.slice().reverse().map((t, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "56px 70px 90px 90px 60px 90px 1fr", padding: "5px 14px", borderBottom: "1px solid var(--line)", fontFamily: "var(--font-mono)", fontSize: 10.5, alignItems: "center" }}>
                    <span style={{ color: "var(--text-dim)" }}>{hhmm(t.time)}</span>
                    <span style={{ color: t.side === "buy" ? "var(--green)" : "var(--red)", fontWeight: 600 }}>{t.side === "buy" ? "▲ LONG" : "▼ SHORT"}</span>
                    <span style={{ textAlign: "right", color: "var(--text-mid)" }}>{t.entry.toFixed(t.entry < 10 ? 4 : 2)}</span>
                    <span style={{ textAlign: "right", color: "var(--text-mid)" }}>{t.exit.toFixed(t.exit < 10 ? 4 : 2)}</span>
                    <span style={{ textAlign: "right", color: "var(--accent)" }}>{t.conf}%</span>
                    <span style={{ textAlign: "right", color: t.pnl >= 0 ? "var(--green)" : "var(--red)", fontWeight: 600 }}>{t.pnl >= 0 ? "+" : ""}{t.pnl.toFixed(2)}</span>
                    <span style={{ paddingLeft: 10, color: "var(--text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.reason}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ background: "var(--bg-2)", border: "1px dashed var(--line-bright)", borderRadius: 3, padding: "8px 12px", fontSize: 10.5, color: "var(--text-mid)", lineHeight: 1.5 }}>
            <span className="accent">↳ </span>Это бэктест живого TA-движка на реальных свечах: каждый сигнал открывает демо-сделку с ATR-стопом и целью, результат считается по факту движения цены. Прошлые результаты не гарантируют будущих. Не является инвестиционной рекомендацией.
          </div>
        </>
      )}
    </div>
  );
}

function DaStat({ label, v, c, sub, big }) {
  return (
    <div className="panel" style={{ padding: "12px 16px" }}>
      <div style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.1, fontWeight: 600, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: big ? 24 : 20, color: c, marginTop: 4 }}>{v}</div>
      {sub && <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function EquityCurve({ curve, notional, width = 860, height = 170 }) {
  if (!curve || curve.length < 2) {
    return <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 11 }}>нет сделок для построения кривой</div>;
  }
  const vals = curve.map(p => p.v);
  const lo = Math.min(...vals, notional), hi = Math.max(...vals, notional), range = (hi - lo) || 1;
  const padT = 10, padB = 10;
  const stepX = width / (curve.length - 1);
  const y = v => padT + (1 - (v - lo) / range) * (height - padT - padB);
  const path = curve.map((p, i) => `${i === 0 ? "M" : "L"}${i * stepX},${y(p.v)}`).join(" ");
  const area = path + ` L${width},${y(lo)} L0,${y(lo)} Z`;
  const up = vals[vals.length - 1] >= notional;
  const col = up ? "var(--green)" : "var(--red)";
  const baseY = y(notional);
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: "block", background: "var(--bg-1)", borderRadius: 4 }}>
      <defs>
        <linearGradient id="da-eq" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={col} stopOpacity="0.28" />
          <stop offset="100%" stopColor={col} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* start-deposit baseline */}
      <line x1={0} y1={baseY} x2={width} y2={baseY} stroke="var(--text-dim)" strokeWidth={0.7} strokeDasharray="3 3" opacity={0.6} />
      <text x={4} y={baseY - 3} fill="var(--text-dim)" style={{ fontFamily: "var(--font-mono)", fontSize: 9 }}>${notional}</text>
      <path d={area} fill="url(#da-eq)" stroke="none" />
      <path d={path} fill="none" stroke={col} strokeWidth={1.6} />
      <circle cx={(curve.length - 1) * stepX} cy={y(vals[vals.length - 1])} r={2.8} fill={col} />
    </svg>
  );
}

Object.assign(window, { DailyAgentPage });
