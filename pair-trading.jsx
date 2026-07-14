/* pair-trading.jsx — statistical-arbitrage page.
 * Picks two assets, pulls real Bybit 15m candles, and runs pairAnalysis
 * (correlation, OLS hedge ratio, spread z-score, mean-reversion half-life).
 * A stretched spread (|z|≥2) is a convergence trade: long the cheap leg,
 * short the rich leg, exit as z reverts to 0. */

const PAIR_COINS = [
  { sym: "BTC", bybit: "BTCUSDT" }, { sym: "ETH", bybit: "ETHUSDT" },
  { sym: "SOL", bybit: "SOLUSDT" }, { sym: "BNB", bybit: "BNBUSDT" },
  { sym: "XRP", bybit: "XRPUSDT" }, { sym: "AVAX", bybit: "AVAXUSDT" },
  { sym: "LINK", bybit: "LINKUSDT" }, { sym: "DOGE", bybit: "DOGEUSDT" },
];

function PairTradingPage({ lang }) {
  const [aIdx, setAIdx] = useState(0);
  const [bIdx, setBIdx] = useState(1);
  const [candlesA, setCandlesA] = useState(null);
  const [candlesB, setCandlesB] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const A = PAIR_COINS[aIdx], B = PAIR_COINS[bIdx];
  const sameAsset = aIdx === bIdx;

  useEffect(() => {
    if (sameAsset || typeof bybitFetchKlines !== "function") { setLoading(false); return; }
    let cancelled = false;
    setLoading(true); setErr(false);
    Promise.all([bybitFetchKlines(A.bybit, "15", 200), bybitFetchKlines(B.bybit, "15", 200)])
      .then(([ka, kb]) => { if (!cancelled) { setCandlesA(ka); setCandlesB(kb); setLoading(false); } })
      .catch(() => { if (!cancelled) { setErr(true); setLoading(false); } });
    return () => { cancelled = true; };
  }, [aIdx, bIdx]);

  const pair = useMemo(
    () => (candlesA && candlesB && !sameAsset && typeof pairAnalysis === "function") ? pairAnalysis(candlesA, candlesB, 50) : null,
    [candlesA, candlesB, sameAsset]
  );

  const z = pair ? pair.z : 0;
  const sig = pair ? pair.signal : "hold";
  const sigCfg = {
    short_spread: { color: "var(--red)", label: "SHORT SPREAD", action: `ШОРТ ${A.sym} · ЛОНГ ${B.sym}`, note: "спред перегрет — ставка на схождение" },
    long_spread:  { color: "var(--green)", label: "LONG SPREAD", action: `ЛОНГ ${A.sym} · ШОРТ ${B.sym}`, note: "спред занижен — ставка на схождение" },
    flat:         { color: "var(--blue)", label: "ВНЕ ПОЗИЦИИ", action: "спред у среднего", note: "края нет — ждём расхождения" },
    hold:         { color: "var(--amber)", label: "НАБЛЮДЕНИЕ", action: "спред движется", note: "ждём |z| ≥ 2 для входа" },
  }[sig];

  const halfLifeH = pair && pair.halfLife ? (pair.halfLife * 15 / 60) : null; // candles(15m) → hours

  return (
    <div className="scroll" style={{ height: "100%", overflowY: "auto", padding: "var(--gap)", display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-bright)", letterSpacing: "-0.01em" }}>
            Парный трейдинг <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>· стат-арбитраж</span>
          </div>
          <div className="mono" style={{ fontSize: 10.5, color: "var(--text-dim)", marginTop: 3 }}>
            коинтеграция · z-score спреда · реальные свечи Bybit 15m
          </div>
        </div>
        <span className="mono" style={{ fontSize: 9.5, color: "var(--blue)", border: "1px solid oklch(0.7 0.15 240 / 0.4)", borderRadius: 3, padding: "2px 8px" }}>
          ⇄ {A.sym}/{B.sym}
        </span>
      </div>

      {/* Pair selectors */}
      <div className="panel" style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
        <PairPicker label="Актив A (длинная нога при z<0)" coins={PAIR_COINS} idx={aIdx} onPick={setAIdx} disabledIdx={bIdx} />
        <PairPicker label="Актив B (хедж-нога)" coins={PAIR_COINS} idx={bIdx} onPick={setBIdx} disabledIdx={aIdx} />
      </div>

      {sameAsset ? (
        <div className="panel" style={{ padding: 24, textAlign: "center", color: "var(--amber)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
          Выберите два разных актива для анализа пары.
        </div>
      ) : loading ? (
        <div className="panel" style={{ padding: 40, textAlign: "center", color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
          загрузка свечей Bybit для {A.sym} и {B.sym}…
        </div>
      ) : err || !pair ? (
        <div className="panel" style={{ padding: 40, textAlign: "center", color: "var(--red)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
          не удалось загрузить данные пары · проверьте соединение
        </div>
      ) : (
        <>
          {/* Signal + stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr 1fr", gap: "var(--gap)" }}>
            <div className="panel" style={{ padding: "12px 16px", borderLeft: `3px solid ${sigCfg.color}` }}>
              <div style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.12, fontWeight: 600, textTransform: "uppercase" }}>Сигнал по спреду</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, color: sigCfg.color, fontWeight: 600, marginTop: 4 }}>{sigCfg.label}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-bright)", marginTop: 3 }}>{sigCfg.action}</div>
              <div style={{ fontSize: 10.5, color: "var(--text-mid)", marginTop: 2 }}>{sigCfg.note}</div>
            </div>
            <PairStat label="Z-SCORE спреда" v={z.toFixed(2)} c={Math.abs(z) >= 2 ? sigCfg.color : "var(--text-bright)"} sub={`±2 = вход`} />
            <PairStat label="Корреляция (дох.)" v={pair.corr.toFixed(2)} c={pair.corr > 0.6 ? "var(--green)" : pair.corr > 0.3 ? "var(--amber)" : "var(--red)"} sub={pair.corr > 0.6 ? "сильная" : pair.corr > 0.3 ? "средняя" : "слабая"} />
            <PairStat label="Полужизнь возврата" v={halfLifeH ? `${halfLifeH.toFixed(1)}ч` : "—"} c="var(--accent-2)" sub={halfLifeH ? "скорость схождения" : "не сходится"} />
          </div>

          {/* Z-score chart */}
          <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
            <PanelHeader title="Z-SCORE СПРЕДА" meta={`hedge β=${pair.beta.toFixed(3)} · окно 50 свечей`} />
            <div style={{ padding: 12 }}>
              <ZScoreChart z={pair.zSeries} width={860} height={190} />
            </div>
          </div>

          {/* Normalized dual price */}
          <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
            <PanelHeader title={`НОРМИРОВАННАЯ ЦЕНА · ${A.sym} vs ${B.sym}`} meta="обе приведены к 100 в начале окна — видно расхождение/схождение" />
            <div style={{ padding: 12 }}>
              <DualPriceChart candlesA={candlesA} candlesB={candlesB} symA={A.sym} symB={B.sym} width={860} height={150} />
            </div>
          </div>

          <div style={{ background: "var(--bg-2)", border: "1px dashed var(--line-bright)", borderRadius: 3, padding: "8px 12px", fontSize: 10.5, color: "var(--text-mid)", lineHeight: 1.5 }}>
            <span className="accent">↳ </span>Логика: спред = log({A.sym}) − β·log({B.sym}). Когда z ≥ +2 — спред перегрет (шорт {A.sym}, лонг {B.sym}); z ≤ −2 — занижен (лонг {A.sym}, шорт {B.sym}); выход при возврате z к 0. Работает только на реально коррелированных парах (корреляция &gt; 0.6). Не является инвестиционной рекомендацией.
          </div>
        </>
      )}
    </div>
  );
}

function PairPicker({ label, coins, idx, onPick, disabledIdx }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 10, color: "var(--text-dim)", width: 220, flexShrink: 0, letterSpacing: 0.04 }}>{label}</span>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {coins.map((c, i) => {
          const on = i === idx, dis = i === disabledIdx;
          return (
            <button key={c.sym} onClick={() => onPick(i)} disabled={dis} style={{
              fontFamily: "var(--font-mono)", fontSize: 10.5, padding: "3px 10px", borderRadius: 3,
              background: on ? "var(--accent-soft)" : "var(--bg-2)",
              color: on ? "var(--accent)" : dis ? "var(--text-dim)" : "var(--text-mid)",
              border: `1px solid ${on ? "oklch(0.78 0.16 var(--accent-h) / 0.4)" : "var(--line)"}`,
              cursor: dis ? "not-allowed" : "pointer", opacity: dis ? 0.4 : 1,
            }}>{c.sym}</button>
          );
        })}
      </div>
    </div>
  );
}

function PairStat({ label, v, c, sub }) {
  return (
    <div className="panel" style={{ padding: "12px 16px" }}>
      <div style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.12, fontWeight: 600, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 22, color: c, marginTop: 4 }}>{v}</div>
      {sub && <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function ZScoreChart({ z, width = 860, height = 190 }) {
  const data = z.slice(-120);
  if (!data.length) return null;
  const maxAbs = Math.max(3, ...data.map(v => Math.abs(v)));
  const padT = 8, padB = 8;
  const stepX = width / (data.length - 1);
  const y = v => (height / 2) - (v / maxAbs) * (height / 2 - padT);
  const path = data.map((v, i) => `${i === 0 ? "M" : "L"}${i * stepX},${y(v)}`).join(" ");
  const level = (v, color, dash, w = 0.7) => (
    <line x1={0} y1={y(v)} x2={width} y2={y(v)} stroke={color} strokeWidth={w} strokeDasharray={dash} opacity={0.6} />
  );
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: "block", background: "var(--bg-1)", borderRadius: 4 }}>
      {/* entry zones */}
      <rect x={0} y={y(maxAbs)} width={width} height={y(2) - y(maxAbs)} fill="var(--red)" opacity={0.06} />
      <rect x={0} y={y(-2)} width={width} height={y(-maxAbs) - y(-2)} fill="var(--green)" opacity={0.06} />
      {level(2, "var(--red)", "4 3", 1)}
      {level(1, "var(--text-dim)", "2 3")}
      {level(0, "var(--line-bright)", "0", 0.8)}
      {level(-1, "var(--text-dim)", "2 3")}
      {level(-2, "var(--green)", "4 3", 1)}
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth={1.3} />
      {/* current dot */}
      <circle cx={(data.length - 1) * stepX} cy={y(data[data.length - 1])} r={2.6} fill="var(--text-bright)" />
      <text x={6} y={y(2) - 3} fill="var(--red)" style={{ fontFamily: "var(--font-mono)", fontSize: 9 }}>+2 σ</text>
      <text x={6} y={y(-2) + 10} fill="var(--green)" style={{ fontFamily: "var(--font-mono)", fontSize: 9 }}>−2 σ</text>
    </svg>
  );
}

function DualPriceChart({ candlesA, candlesB, symA, symB, width = 860, height = 150 }) {
  const n = Math.min(candlesA.length, candlesB.length, 120);
  const a = candlesA.slice(-n).map(c => c.close);
  const b = candlesB.slice(-n).map(c => c.close);
  if (a.length < 2 || !a[0] || !b[0]) return null;
  const normA = a.map(v => v / a[0] * 100);
  const normB = b.map(v => v / b[0] * 100);
  const all = [...normA, ...normB];
  const lo = Math.min(...all), hi = Math.max(...all), range = (hi - lo) || 1;
  const padT = 8, padB = 8;
  const stepX = width / (n - 1);
  const y = v => padT + (1 - (v - lo) / range) * (height - padT - padB);
  const line = arr => arr.map((v, i) => `${i === 0 ? "M" : "L"}${i * stepX},${y(v)}`).join(" ");
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: "block", background: "var(--bg-1)", borderRadius: 4 }}>
      <path d={line(normA)} fill="none" stroke="var(--accent)" strokeWidth={1.3} />
      <path d={line(normB)} fill="none" stroke="var(--blue)" strokeWidth={1.3} />
      <text x={6} y={14} fill="var(--accent)" style={{ fontFamily: "var(--font-mono)", fontSize: 9.5 }}>{symA}</text>
      <text x={40} y={14} fill="var(--blue)" style={{ fontFamily: "var(--font-mono)", fontSize: 9.5 }}>{symB}</text>
    </svg>
  );
}

Object.assign(window, { PairTradingPage });
