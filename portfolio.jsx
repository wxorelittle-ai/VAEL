/* portfolio.jsx — Portfolio Manager page with PnL, allocation, performance */

/* ─────────────────────────────────────────────────────────
 *  Portfolio data
 * ────────────────────────────────────────────────────────*/

const PORTFOLIO_POSITIONS = [
  { id: "P-001", sym: "ETH",  name: "Ethereum",   side: "long",  size: 28400, entry: 2380.42, current: 2412.18, opened: "23.05 14:08", strategy: "ai-signals", days: 4 },
  { id: "P-002", sym: "BTC",  name: "Bitcoin",    side: "long",  size: 32000, entry: 63820.0,  current: 64280.0, opened: "21.05 09:42", strategy: "manual",     days: 6 },
  { id: "P-003", sym: "SOL",  name: "Solana",     side: "long",  size: 12000, entry: 138.40,   current: 142.84,  opened: "24.05 11:22", strategy: "ai-momentum", days: 3 },
  { id: "P-004", sym: "AVAX", name: "Avalanche",  side: "short", size: 8000,  entry: 30.40,    current: 28.42,   opened: "22.05 18:14", strategy: "ai-signals", days: 5 },
  { id: "P-005", sym: "LINK", name: "Chainlink",  side: "long",  size: 6400,  entry: 14.82,    current: 15.04,   opened: "25.05 12:00", strategy: "ai-momentum", days: 2 },
  { id: "P-006", sym: "USDC", name: "USD Coin",   side: "stable",size: 14200, entry: 1.0,      current: 1.0,     opened: "—",            strategy: "—",            days: 28 },
];

const CLOSED_TRADES = [
  { id: "T-841", sym: "ETH",  side: "long",  size: 5000, entry: 2280, exit: 2364, pnl: 184,  pnlPct: 3.68, closedAt: "24.05 18:42", reason: "tp", strategy: "ai-signals" },
  { id: "T-840", sym: "SOL",  side: "long",  size: 3000, entry: 132,  exit: 142,  pnl: 227,  pnlPct: 7.58, closedAt: "24.05 11:14", reason: "tp", strategy: "ai-momentum" },
  { id: "T-839", sym: "AVAX", side: "short", size: 4000, entry: 31.2, exit: 30.4, pnl: 103,  pnlPct: 2.56, closedAt: "23.05 21:08", reason: "manual", strategy: "manual" },
  { id: "T-838", sym: "BTC",  side: "long",  size: 8000, entry: 64200,exit: 63800,pnl: -50,  pnlPct: -0.62, closedAt: "23.05 14:22", reason: "sl", strategy: "manual" },
  { id: "T-837", sym: "MATIC",side: "long",  size: 2400, entry: 0.71, exit: 0.74, pnl: 102,  pnlPct: 4.23, closedAt: "23.05 09:08", reason: "tp", strategy: "ai-signals" },
  { id: "T-836", sym: "ETH",  side: "short", size: 6200, entry: 2420, exit: 2380, pnl: 102,  pnlPct: 1.65, closedAt: "22.05 19:48", reason: "tp", strategy: "ai-signals" },
  { id: "T-835", sym: "DOT",  side: "long",  size: 1800, entry: 7.2,  exit: 7.0,  pnl: -50,  pnlPct: -2.78, closedAt: "22.05 11:14", reason: "sl", strategy: "ai-momentum" },
  { id: "T-834", sym: "BTC",  side: "long",  size: 10000,entry: 63000,exit: 64100,pnl: 175,  pnlPct: 1.74, closedAt: "21.05 22:30", reason: "tp", strategy: "manual" },
  { id: "T-833", sym: "SOL",  side: "short", size: 2400, entry: 145,  exit: 138,  pnl: 116,  pnlPct: 4.83, closedAt: "21.05 16:08", reason: "manual", strategy: "ai-signals" },
];

const STRATEGY_PERFORMANCE = [
  { id: "ai-signals",  name: "AI Signals",       trades: 47, wins: 31, totalPnl: 1842, accuracy: 65.9, sharpe: 1.42, color: "var(--accent)" },
  { id: "ai-momentum", name: "AI Momentum",      trades: 28, wins: 16, totalPnl: 642,  accuracy: 57.1, sharpe: 1.08, color: "var(--blue)" },
  { id: "manual",      name: "Ручные сделки",    trades: 12, wins: 6,  totalPnl: 187,  accuracy: 50.0, sharpe: 0.62, color: "var(--text-mid)" },
  { id: "onchain",     name: "On-chain Whale",   trades: 14, wins: 11, totalPnl: 924,  accuracy: 78.5, sharpe: 1.84, color: "var(--green)" },
];

/* ─────────────────────────────────────────────────────────
 *  Helpers
 * ────────────────────────────────────────────────────────*/

function computePnl(p) {
  if (p.side === "stable") return { pnl: 0, pnlPct: 0 };
  const pnl = p.side === "long"
    ? (p.current - p.entry) * (p.size / p.entry)
    : (p.entry - p.current) * (p.size / p.entry);
  const pnlPct = p.side === "long"
    ? ((p.current - p.entry) / p.entry) * 100
    : ((p.entry - p.current) / p.entry) * 100;
  return { pnl, pnlPct };
}

/* Generate equity curve (deterministic-ish) */
function genEquity(days = 30, start = 100000) {
  const out = [{ d: 0, v: start }];
  let cur = start;
  for (let i = 1; i <= days; i++) {
    const r = (Math.sin(i * 0.7) * 0.4 + Math.sin(i * 0.21) * 0.3 + (Math.random() - 0.5) * 0.4) * 0.018;
    cur = cur * (1 + r);
    out.push({ d: i, v: cur });
  }
  return out;
}

/* ─────────────────────────────────────────────────────────
 *  Equity / PnL chart
 * ────────────────────────────────────────────────────────*/
function EquityCurveChart({ curve, period, width = 800, height = 240 }) {
  if (!curve || curve.length < 2) return null;
  const vals = curve.map(p => p.v);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = (max - min) || 1;
  const start = vals[0];
  const last = vals[vals.length - 1];
  const isProfit = last >= start;
  const color = isProfit ? "var(--green)" : "var(--red)";
  const stepX = width / (curve.length - 1);
  const padT = 14, padB = 24;
  const y = v => padT + (1 - (v - min) / range) * (height - padT - padB);
  const pts = curve.map((p, i) => [i * stepX, y(p.v)]);
  const path = pts.map(([x, y], i) => i === 0 ? `M${x},${y}` : `L${x},${y}`).join(" ");
  const areaPath = `${path} L${width},${height - padB} L0,${height - padB} Z`;
  const startY = y(start);
  const gradId = "ec-grad";

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: "block" }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* y grid */}
      {[0.25, 0.5, 0.75].map((p, i) => (
        <line key={i} x1={0} y1={padT + (height - padT - padB) * p} x2={width}
          y2={padT + (height - padT - padB) * p}
          stroke="var(--line)" strokeWidth={0.5} strokeDasharray="2 4" />
      ))}
      {/* start baseline */}
      <line x1={0} y1={startY} x2={width} y2={startY}
        stroke="var(--text-dim)" strokeWidth={0.6} strokeDasharray="4 4" opacity={0.5} />
      <text x={6} y={startY - 4} fontFamily="var(--font-mono)" fontSize={10} fill="var(--text-dim)">
        старт · ${Math.round(start).toLocaleString()}
      </text>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={path} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r={4} fill={color} />
      <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r={9} fill="none" stroke={color} opacity={0.5}>
        <animate attributeName="r" from="4" to="14" dur="1.6s" repeatCount="indefinite" />
        <animate attributeName="opacity" from="0.6" to="0" dur="1.6s" repeatCount="indefinite" />
      </circle>
      {/* current value label */}
      <text x={pts[pts.length-1][0] - 6} y={pts[pts.length-1][1] - 12} textAnchor="end"
        fontFamily="var(--font-mono)" fontSize={11} fontWeight={600} fill={color}>
        ${Math.round(last).toLocaleString()}
      </text>
      {/* x labels */}
      {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
        const x = width * p;
        const day = Math.round(curve.length * p);
        return (
          <text key={i} x={x} y={height - 6}
            textAnchor={i === 0 ? "start" : i === 4 ? "end" : "middle"}
            fontFamily="var(--font-mono)" fontSize={9} fill="var(--text-dim)">
            {i === 4 ? "сейчас" : i === 0 ? `−${curve.length - 1}д` : `−${curve.length - 1 - day}д`}
          </text>
        );
      })}
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────
 *  Allocation donut
 * ────────────────────────────────────────────────────────*/
function AllocationDonut({ positions, size = 180 }) {
  const total = positions.reduce((s, p) => s + p.size, 0);
  const cx = size / 2, cy = size / 2;
  const r = size / 2 - 8;
  const innerR = r * 0.62;
  let angle = -Math.PI / 2; // start at top

  const colorByAsset = {
    ETH: "var(--accent)",
    BTC: "var(--amber)",
    SOL: "var(--accent-2)",
    AVAX: "var(--red)",
    LINK: "var(--blue)",
    USDC: "var(--text-mid)",
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <svg width={size} height={size}>
        {positions.map((p, i) => {
          const pct = p.size / total;
          const startAngle = angle;
          const endAngle = angle + pct * Math.PI * 2;
          angle = endAngle;
          const x1 = cx + Math.cos(startAngle) * r;
          const y1 = cy + Math.sin(startAngle) * r;
          const x2 = cx + Math.cos(endAngle) * r;
          const y2 = cy + Math.sin(endAngle) * r;
          const x1i = cx + Math.cos(startAngle) * innerR;
          const y1i = cy + Math.sin(startAngle) * innerR;
          const x2i = cx + Math.cos(endAngle) * innerR;
          const y2i = cy + Math.sin(endAngle) * innerR;
          const largeArc = pct > 0.5 ? 1 : 0;
          const path = `M${x1},${y1} A${r},${r} 0 ${largeArc} 1 ${x2},${y2} L${x2i},${y2i} A${innerR},${innerR} 0 ${largeArc} 0 ${x1i},${y1i} Z`;
          return (
            <path key={p.sym} d={path}
              fill={colorByAsset[p.sym] || "var(--text-mid)"}
              opacity={0.85}
              stroke="var(--bg-1)" strokeWidth={1.5}
            />
          );
        })}
        <text x={cx} y={cy - 4} textAnchor="middle"
          fontFamily="var(--font-mono)" fontSize={9} fill="var(--text-dim)" letterSpacing="0.12em">ВСЕГО</text>
        <text x={cx} y={cy + 12} textAnchor="middle"
          fontFamily="var(--font-mono)" fontSize={16} fontWeight={500} fill="var(--text-bright)">
          ${(total / 1000).toFixed(1)}K
        </text>
      </svg>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
        {positions.map(p => {
          const pct = (p.size / total) * 100;
          return (
            <div key={p.sym} style={{
              display: "grid", gridTemplateColumns: "auto 1fr auto auto",
              gap: 8, alignItems: "center",
              fontFamily: "var(--font-mono)", fontSize: 11,
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: 2,
                background: colorByAsset[p.sym] || "var(--text-mid)",
              }} />
              <span style={{ color: "var(--text-bright)", fontWeight: 500 }}>{p.sym}</span>
              <span style={{ color: "var(--text-mid)" }}>${(p.size / 1000).toFixed(1)}K</span>
              <span style={{ color: "var(--text-dim)", minWidth: 36, textAlign: "right" }}>{pct.toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 *  Position table
 * ────────────────────────────────────────────────────────*/
function PositionsTable({ positions, onClose }) {
  return (
    <div>
      <div style={{
        display: "grid", gridTemplateColumns: "60px 70px 80px 80px 80px 90px 70px 90px 70px",
        gap: 4, padding: "6px 12px",
        borderBottom: "1px solid var(--line)", background: "var(--bg-2)",
        fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)",
        letterSpacing: 0.08, textTransform: "uppercase",
      }}>
        <span>АКТИВ</span><span>СТОР.</span><span>ОБЪЁМ</span><span>ВХОД</span><span>ТЕКУЩ</span><span>P&L $</span><span>P&L %</span><span>СТРАТЕГ.</span><span></span>
      </div>
      {positions.map(p => {
        const { pnl, pnlPct } = computePnl(p);
        const isStable = p.side === "stable";
        const pnlColor = pnl > 0 ? "var(--green)" : pnl < 0 ? "var(--red)" : "var(--text-dim)";
        const sideColor = p.side === "long" ? "var(--green)" : p.side === "short" ? "var(--red)" : "var(--text-mid)";
        return (
          <div key={p.id} style={{
            display: "grid", gridTemplateColumns: "60px 70px 80px 80px 80px 90px 70px 90px 70px",
            gap: 4, alignItems: "center",
            padding: "7px 12px",
            borderBottom: "1px solid var(--line)",
            fontFamily: "var(--font-mono)", fontSize: 10.5,
            transition: "background 0.1s",
            cursor: "pointer",
          }}
          onMouseEnter={e => e.currentTarget.style.background = "var(--bg-2)"}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <span style={{ color: "var(--text-bright)", fontWeight: 600 }}>{p.sym}</span>
            <span style={{ color: sideColor, fontWeight: 600 }}>
              {p.side === "long" ? "▲ ЛОНГ" : p.side === "short" ? "▼ ШОРТ" : "≡ STBL"}
            </span>
            <span style={{ color: "var(--text)" }}>${p.size.toLocaleString()}</span>
            <span style={{ color: "var(--text-mid)" }}>{isStable ? "—" : p.entry.toFixed(p.entry < 10 ? 3 : 2)}</span>
            <span style={{ color: "var(--text-bright)" }}>{isStable ? "—" : p.current.toFixed(p.current < 10 ? 3 : 2)}</span>
            <span style={{ color: pnlColor }}>{isStable ? "—" : `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}`}</span>
            <span style={{ color: pnlColor, fontWeight: 600 }}>
              {isStable ? "—" : `${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%`}
            </span>
            <span style={{ color: "var(--text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.strategy}</span>
            {!isStable ? (
              <button onClick={() => onClose?.(p.id)} style={{
                padding: "2px 6px",
                background: "var(--bg-2)", border: "1px solid var(--line-bright)",
                color: "var(--text-mid)", cursor: "pointer", borderRadius: 2,
                fontFamily: "var(--font-mono)", fontSize: 9,
              }}>ЗАКР</button>
            ) : <span />}
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 *  Trade table (closed)
 * ────────────────────────────────────────────────────────*/
function TradesTable({ trades }) {
  return (
    <div>
      <div style={{
        display: "grid", gridTemplateColumns: "70px 60px 60px 70px 70px 70px 70px 60px 80px",
        gap: 4, padding: "6px 12px",
        borderBottom: "1px solid var(--line)", background: "var(--bg-2)",
        fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)",
        letterSpacing: 0.08, textTransform: "uppercase",
      }}>
        <span>ID</span><span>АКТИВ</span><span>СТОР.</span><span>ВХОД</span><span>ВЫХОД</span><span>P&L $</span><span>P&L %</span><span>ПРИЧ.</span><span>ЗАКРЫТО</span>
      </div>
      {trades.map(t => {
        const pnlColor = t.pnl >= 0 ? "var(--green)" : "var(--red)";
        const reasonColor = t.reason === "tp" ? "var(--green)" : t.reason === "sl" ? "var(--red)" : "var(--text-mid)";
        return (
          <div key={t.id} style={{
            display: "grid", gridTemplateColumns: "70px 60px 60px 70px 70px 70px 70px 60px 80px",
            gap: 4, alignItems: "center",
            padding: "5px 12px",
            borderBottom: "1px solid var(--line)",
            fontFamily: "var(--font-mono)", fontSize: 10.5,
          }}>
            <span style={{ color: "var(--text-dim)" }}>{t.id}</span>
            <span style={{ color: "var(--text-bright)", fontWeight: 600 }}>{t.sym}</span>
            <span style={{ color: t.side === "long" ? "var(--green)" : "var(--red)", fontWeight: 600 }}>
              {t.side === "long" ? "L" : "S"}
            </span>
            <span style={{ color: "var(--text-mid)" }}>{t.entry < 10 ? t.entry.toFixed(3) : t.entry.toFixed(0)}</span>
            <span style={{ color: "var(--text)" }}>{t.exit < 10 ? t.exit.toFixed(3) : t.exit.toFixed(0)}</span>
            <span style={{ color: pnlColor }}>{t.pnl >= 0 ? "+" : ""}{t.pnl}</span>
            <span style={{ color: pnlColor, fontWeight: 600 }}>{t.pnlPct >= 0 ? "+" : ""}{t.pnlPct.toFixed(2)}%</span>
            <span style={{ color: reasonColor, textTransform: "uppercase" }}>{t.reason}</span>
            <span style={{ color: "var(--text-dim)" }}>{t.closedAt}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 *  Strategy comparison
 * ────────────────────────────────────────────────────────*/
function StrategyPerformance({ items }) {
  const maxPnl = Math.max(...items.map(s => Math.abs(s.totalPnl)));
  return (
    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map(s => (
        <div key={s.id} style={{
          background: "var(--bg-0)", border: "1px solid var(--line)",
          borderLeft: `2px solid ${s.color}`,
          borderRadius: 3,
          padding: "8px 12px",
          display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1fr",
          gap: 10, alignItems: "center",
        }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--text-bright)", fontWeight: 500 }}>{s.name}</div>
            <div className="mono" style={{ fontSize: 9.5, color: "var(--text-dim)", marginTop: 1 }}>{s.id} · {s.trades} сделок</div>
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.1, fontWeight: 600 }}>P&L</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: s.totalPnl >= 0 ? "var(--green)" : "var(--red)", fontWeight: 500 }}>
              {s.totalPnl >= 0 ? "+" : ""}${s.totalPnl}
            </div>
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.1, fontWeight: 600 }}>WIN RATE</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: s.accuracy >= 60 ? "var(--green)" : "var(--amber)" }}>
              {s.accuracy.toFixed(1)}%
            </div>
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.1, fontWeight: 600 }}>SHARPE</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: s.sharpe >= 1 ? "var(--green)" : s.sharpe >= 0.5 ? "var(--amber)" : "var(--red)" }}>
              {s.sharpe.toFixed(2)}
            </div>
          </div>
          <div>
            <div style={{ height: 4, background: "var(--bg-3)", borderRadius: 1, overflow: "hidden" }}>
              <div style={{
                width: `${(Math.abs(s.totalPnl) / maxPnl) * 100}%`,
                height: "100%",
                background: s.totalPnl >= 0 ? "var(--green)" : "var(--red)",
              }} />
            </div>
            <div className="mono" style={{ fontSize: 9, color: "var(--text-dim)", marginTop: 3, textAlign: "right" }}>
              {s.wins}/{s.trades} win
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 *  Asset performance heatmap (last 30d by asset)
 * ────────────────────────────────────────────────────────*/
function AssetHeatmap() {
  const assets = ["ETH", "BTC", "SOL", "AVAX", "LINK", "MATIC", "DOT", "ATOM"];
  const days = 14;
  const cells = useMemo(() => {
    return assets.map((a, ai) =>
      Array.from({ length: days }, (_, di) => {
        const v = Math.sin(ai * 0.7 + di * 0.3) * 0.5 + (Math.random() - 0.5) * 0.4;
        return v;
      })
    );
  }, []);
  return (
    <div style={{ padding: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: `60px repeat(${days}, 1fr)`, gap: 2, marginBottom: 4 }}>
        <span />
        {Array.from({ length: days }, (_, i) => (
          <span key={i} style={{
            fontFamily: "var(--font-mono)", fontSize: 8.5, color: "var(--text-dim)",
            textAlign: "center", letterSpacing: 0.04,
          }}>{i === 0 ? "−14д" : i === days - 1 ? "сегодня" : ""}</span>
        ))}
      </div>
      {assets.map((a, ai) => (
        <div key={a} style={{ display: "grid", gridTemplateColumns: `60px repeat(${days}, 1fr)`, gap: 2, marginBottom: 2 }}>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-bright)",
            fontWeight: 600, paddingRight: 6, alignSelf: "center",
          }}>{a}</span>
          {cells[ai].map((v, di) => {
            const isPos = v > 0;
            const intensity = Math.min(1, Math.abs(v) * 1.6);
            const color = isPos ? "var(--green)" : "var(--red)";
            return (
              <div key={di} title={`${(v * 100).toFixed(1)}%`} style={{
                height: 16, borderRadius: 1.5,
                background: color, opacity: 0.1 + intensity * 0.85,
                cursor: "pointer",
              }} />
            );
          })}
        </div>
      ))}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 10, fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--text-dim)" }}>
        <span><span style={{ color: "var(--red)" }}>■</span> убыток</span>
        <div style={{ display: "flex", gap: 1 }}>
          {[0.2, 0.4, 0.6, 0.8].map(o => (
            <span key={o} style={{ width: 16, height: 8, background: "var(--red)", opacity: o }} />
          ))}
          {[0.2, 0.4, 0.6, 0.8].map(o => (
            <span key={`g${o}`} style={{ width: 16, height: 8, background: "var(--green)", opacity: o }} />
          ))}
        </div>
        <span><span style={{ color: "var(--green)" }}>■</span> прибыль</span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 *  Portfolio Page (root)
 * ────────────────────────────────────────────────────────*/
/* Real Bybit account panel — self-fetches /api/bybit/account; renders nothing
 * unless the backend is up AND a read-only Bybit key is configured server-side. */
function RealAccountPanel() {
  const [acc, setAcc] = useState(undefined);
  useEffect(() => {
    let cancelled = false;
    const load = () => fetch("/api/bybit/account").then(r => r.json())
      .then(j => { if (!cancelled) setAcc(j && j.ok ? j : null); })
      .catch(() => { if (!cancelled) setAcc(null); });
    load();
    const id = setInterval(load, 20000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);
  if (!acc || !acc.ok) return null;
  const bal = acc.balance, pos = acc.positions || [];
  return (
    <div className="panel" style={{ flexShrink: 0, marginBottom: "var(--gap)", display: "flex", flexDirection: "column" }}>
      <PanelHeader title="РЕАЛЬНЫЙ АККАУНТ · BYBIT" meta="live · read-only"
        action={typeof LiveTag === "function" ? <LiveTag status="live" /> : null} />
      <div style={{ display: "flex", flexShrink: 0 }}>
        {bal && <BigPfStat label="EQUITY" v={`$${bal.totalEquity.toFixed(2)}`} c="var(--text-bright)" sub={`${(bal.coins || []).length} монет`} />}
        {bal && <BigPfStat label="ДОСТУПНО" v={`$${bal.totalAvailable.toFixed(2)}`} c="var(--green)" sub="свободно" />}
        <BigPfStat label="ОТКРЫТЫХ ПОЗИЦИЙ" v={pos.length} c="var(--accent)" sub={pos.length ? "linear · USDT" : "нет"} />
      </div>
      {pos.length > 0 && (
        <div style={{ borderTop: "1px solid var(--line)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "90px 70px 90px 100px 100px 90px", padding: "5px 14px", background: "var(--bg-2)", fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.08, textTransform: "uppercase" }}>
            <span>Символ</span><span>Сторона</span><span style={{ textAlign: "right" }}>Размер</span><span style={{ textAlign: "right" }}>Вход</span><span style={{ textAlign: "right" }}>Mark</span><span style={{ textAlign: "right" }}>uPnL</span>
          </div>
          {pos.map((p, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "90px 70px 90px 100px 100px 90px", padding: "5px 14px", borderBottom: "1px solid var(--line)", fontFamily: "var(--font-mono)", fontSize: 10.5, alignItems: "center" }}>
              <span style={{ color: "var(--text-bright)", fontWeight: 600 }}>{p.symbol}</span>
              <span style={{ color: p.side === "Buy" ? "var(--green)" : "var(--red)", fontWeight: 600 }}>{p.side === "Buy" ? "▲ LONG" : "▼ SHORT"}</span>
              <span style={{ textAlign: "right", color: "var(--text)" }}>{p.size}</span>
              <span style={{ textAlign: "right", color: "var(--text-mid)" }}>{p.entry}</span>
              <span style={{ textAlign: "right", color: "var(--text-bright)" }}>{p.mark}</span>
              <span style={{ textAlign: "right", color: p.pnl >= 0 ? "var(--green)" : "var(--red)", fontWeight: 600 }}>{p.pnl >= 0 ? "+" : ""}{p.pnl.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── My wallets: real on-chain balances from the user's public EVM addresses.
 * Addresses stored locally; balances/txs via the existing Etherscan integration
 * (needs a free ETHERSCAN_API_KEY set in Settings). Graceful without it. */
const WALLETS_LS = "vael.wallets";
function loadWalletsLS() { try { return JSON.parse(localStorage.getItem(WALLETS_LS) || "[]"); } catch (_) { return []; } }
function saveWalletsLS(a) { try { localStorage.setItem(WALLETS_LS, JSON.stringify(a)); } catch (_) {} }

function WalletsPanel() {
  const [wallets, setWallets] = useState(loadWalletsLS);
  const [input, setInput] = useState("");
  const [ethPrice, setEthPrice] = useState(null);
  const hasKey = typeof getApiKey === "function" && !!getApiKey("ETHERSCAN_API_KEY");

  useEffect(() => {
    let cancelled = false;
    if (typeof bybitFetchTicker === "function") {
      bybitFetchTicker("ETHUSDT").then(t => { if (!cancelled) setEthPrice(t.lastPrice); }).catch(() => {});
    }
    return () => { cancelled = true; };
  }, []);

  function add() {
    const a = input.trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(a)) {
      window.__emitToast?.({ kind: "loss", title: "Неверный адрес", body: "Ожидается EVM-адрес 0x… (40 hex-символов)" });
      return;
    }
    if (wallets.some(w => w.toLowerCase() === a.toLowerCase())) { setInput(""); return; }
    const next = [...wallets, a]; setWallets(next); saveWalletsLS(next); setInput("");
  }
  function remove(a) { const next = wallets.filter(w => w !== a); setWallets(next); saveWalletsLS(next); }

  return (
    <div className="panel" style={{ flexShrink: 0, marginBottom: "var(--gap)", display: "flex", flexDirection: "column" }}>
      <PanelHeader title="МОИ КОШЕЛЬКИ · ON-CHAIN"
        meta={hasKey ? "Etherscan · ETH mainnet · реальный баланс" : "добавьте ETHERSCAN_API_KEY в Настройках"}
        action={typeof LiveTag === "function" ? <LiveTag status={hasKey ? "live" : "rest"} /> : null} />

      <div style={{ display: "flex", gap: 6, padding: "8px 12px", borderBottom: "1px solid var(--line)" }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") add(); }}
          placeholder="0x… публичный адрес кошелька"
          style={{ flex: 1, background: "var(--bg-0)", border: "1px solid var(--line-bright)", color: "var(--text-bright)", fontFamily: "var(--font-mono)", fontSize: 11, padding: "5px 8px", borderRadius: 3, outline: "none" }} />
        <button onClick={add} className="btn btn-accent" style={{ fontSize: 11 }}>+ Добавить</button>
      </div>

      {!hasKey && (
        <div style={{ padding: "6px 12px", fontSize: 10.5, color: "var(--amber)", fontFamily: "var(--font-mono)", borderBottom: "1px solid var(--line)" }}>
          ⚠ Без ключа Etherscan баланс не подтянется. Бесплатный ключ на etherscan.io/apis → вставьте в Настройки → API-ключи → ETHERSCAN_API_KEY.
        </div>
      )}

      {wallets.length === 0 ? (
        <div style={{ padding: "14px 12px", textAlign: "center", color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
          Кошельки не добавлены. Вставьте свой публичный адрес — покажем реальный баланс ETH и последнюю активность.
        </div>
      ) : (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 120px 90px 34px", padding: "5px 14px", background: "var(--bg-2)", fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.06, textTransform: "uppercase" }}>
            <span>Адрес</span><span style={{ textAlign: "right" }}>Баланс ETH</span><span style={{ textAlign: "right" }}>≈ USD</span><span style={{ textAlign: "right" }}>Активность</span><span></span>
          </div>
          {wallets.map(a => <WalletRow key={a} addr={a} ethPrice={ethPrice} onRemove={() => remove(a)} />)}
        </div>
      )}
    </div>
  );
}

function WalletRow({ addr, ethPrice, onRemove }) {
  const w = typeof useEtherscanWallet === "function" ? useEtherscanWallet(addr) : { loading: false, live: false, hasKey: false, balance: null, txs: [] };
  const bal = w.balance;
  const usd = (bal != null && ethPrice) ? bal * ethPrice : null;
  const lastTx = w.txs && w.txs[0];
  const short = typeof shortHex === "function" ? shortHex(addr) : addr;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 120px 90px 34px", padding: "6px 14px", borderBottom: "1px solid var(--line)", fontFamily: "var(--font-mono)", fontSize: 11, alignItems: "center" }}>
      <a href={`https://etherscan.io/address/${addr}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)", textDecoration: "none" }}>{short}</a>
      <span style={{ textAlign: "right", color: "var(--text-bright)" }}>{w.loading ? "…" : bal != null ? bal.toFixed(4) : (w.hasKey ? "—" : "0.0000")}</span>
      <span style={{ textAlign: "right", color: "var(--green)" }}>{usd != null ? `$${usd.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—"}</span>
      <span style={{ textAlign: "right", color: "var(--text-dim)" }}>{lastTx ? (typeof txAge === "function" ? txAge(lastTx.time) : "") + " назад" : (w.live ? "нет tx" : "—")}</span>
      <button onClick={onRemove} title="убрать кошелёк" style={{ justifySelf: "end", width: 22, height: 20, background: "var(--bg-0)", border: "1px solid var(--line)", color: "var(--text-dim)", cursor: "pointer", borderRadius: 2, fontFamily: "var(--font-mono)" }}>✕</button>
    </div>
  );
}

function PortfolioPage({ lang }) {
  const [period, setPeriod] = useState("30d");
  const [activeTab, setActiveTab] = useState("positions");

  const equity = useMemo(() => {
    const days = period === "1d" ? 24 : period === "7d" ? 30 : period === "30d" ? 30 : 90;
    return genEquity(days, 124000);
  }, [period]);

  // ─── live current prices from Bybit (entry stays as cost basis) ───
  const priceSymbols = useMemo(
    () => PORTFOLIO_POSITIONS.filter(p => p.side !== "stable").map(p => `${p.sym}USDT`),
    []
  );
  const { prices, status: liveStatus } = useBybitTickers(priceSymbols, 8000);
  const positions = useMemo(() => PORTFOLIO_POSITIONS.map(p => {
    if (p.side === "stable") return p;
    const t = prices[`${p.sym}USDT`];
    return t ? { ...p, current: t.lastPrice } : p;
  }), [prices]);

  const total = positions.reduce((s, p) => s + p.size, 0);
  const unrealized = positions.reduce((s, p) => s + computePnl(p).pnl, 0);
  const realized = CLOSED_TRADES.reduce((s, t) => s + t.pnl, 0);
  const winCount = CLOSED_TRADES.filter(t => t.pnl > 0).length;
  const winRate = (winCount / CLOSED_TRADES.length) * 100;
  const longCount = positions.filter(p => p.side === "long").length;
  const shortCount = positions.filter(p => p.side === "short").length;
  const bestTrade = [...CLOSED_TRADES].sort((a, b) => b.pnlPct - a.pnlPct)[0];
  const worstTrade = [...CLOSED_TRADES].sort((a, b) => a.pnlPct - b.pnlPct)[0];
  const sharpe = 1.42;
  const maxDD = 4.8;

  return (
    <div data-screen-label="12 Portfolio" style={{
      minHeight: "100%", padding: "var(--gap)",
      display: "flex", flexDirection: "column",
    }}>
      <PageHeader title={lang === "en" ? "PORTFOLIO" : "ПОРТФЕЛЬ"}
        sub={`PORTFOLIO MANAGER · ${PORTFOLIO_POSITIONS.length} позиций · ${CLOSED_TRADES.length} закрытых сделок`}
        actions={
          <>
            {typeof LiveTag === "function" && <LiveTag status={liveStatus} />}
            <button onClick={() => setPeriod("1d")} className={`btn ${period === "1d" ? "btn-accent" : ""}`}>1Д</button>
            <button onClick={() => setPeriod("7d")} className={`btn ${period === "7d" ? "btn-accent" : ""}`}>7Д</button>
            <button onClick={() => setPeriod("30d")} className={`btn ${period === "30d" ? "btn-accent" : ""}`}>30Д</button>
            <button onClick={() => setPeriod("90d")} className={`btn ${period === "90d" ? "btn-accent" : ""}`}>90Д</button>
            <button className="btn">Экспорт CSV</button>
          </>
        }
      />

      {/* Real Bybit account (appears only when the backend has a read-only key) */}
      <RealAccountPanel />

      {/* Real on-chain balances from the user's own wallet addresses */}
      <WalletsPanel />

      {/* Big numbers row */}
      <div className="panel" style={{ display: "flex", flexShrink: 0, marginBottom: "var(--gap)" }}>
        <BigPfStat label="ОБЩАЯ СТОИМОСТЬ" v={`$${(total / 1000).toFixed(1)}K`} c="var(--text-bright)"
          sub={`+${(unrealized + realized > 0 ? unrealized + realized : 0).toFixed(0)}$ за период`} />
        <BigPfStat label="НЕРЕАЛИЗ. P&L" v={`${unrealized >= 0 ? "+" : ""}$${unrealized.toFixed(0)}`}
          c={unrealized >= 0 ? "var(--green)" : "var(--red)"}
          sub={`${PORTFOLIO_POSITIONS.length} открытых позиций`} />
        <BigPfStat label={`РЕАЛИЗ. P&L · ${period.toUpperCase()}`}
          v={`${realized >= 0 ? "+" : ""}$${realized}`} c={realized >= 0 ? "var(--green)" : "var(--red)"}
          sub={`${CLOSED_TRADES.length} закрытых · ${winRate.toFixed(0)}% win rate`} />
        <BigPfStat label="SHARPE" v={sharpe.toFixed(2)} c="var(--accent)"
          sub={`MaxDD −${maxDD}%`} />
        <BigPfStat label="LONG / SHORT" v={`${longCount} / ${shortCount}`} c="var(--text-bright)"
          sub={`stable: ${PORTFOLIO_POSITIONS.filter(p => p.side === "stable").length}`} />
      </div>

      {/* Main grid */}
      <div style={{
        flex: 1, display: "grid",
        gridTemplateColumns: "1.6fr 1fr",
        gridTemplateRows: "1.2fr 1fr",
        gap: "var(--gap)",
        minHeight: 0, overflow: "hidden",
      }}>
        {/* Equity curve */}
        <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
          <PanelHeader title={`КРИВАЯ КАПИТАЛА · ${period.toUpperCase()}`}
            meta="real-time tracking"
            action={
              <span className="mono" style={{ fontSize: 10, color: "var(--green)" }}>
                <PulseDot size={4} color="var(--green)" /> +{(unrealized + realized).toFixed(0)}$
              </span>
            }
          />
          <div style={{ flex: 1, padding: 12, position: "relative", minHeight: 0 }}>
            <EquityCurveChart curve={equity} period={period} width={800} height={260} />
          </div>
        </div>

        {/* Allocation */}
        <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
          <PanelHeader title="РАСПРЕДЕЛЕНИЕ" meta="по активам" />
          <div className="scroll" style={{ flex: 1, padding: 14, overflowY: "auto" }}>
            <AllocationDonut positions={positions} size={180} />

            <div style={{ marginTop: 16 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.15, fontWeight: 600, marginBottom: 6 }}>
                ЛУЧШАЯ / ХУДШАЯ СДЕЛКА
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <PnlRow trade={bestTrade} label="ЛУЧШАЯ" />
                <PnlRow trade={worstTrade} label="ХУДШАЯ" />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom: positions/trades tabs */}
        <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
          <div style={{ display: "flex", borderBottom: "1px solid var(--line)", background: "var(--bg-2)" }}>
            <PfTabBtn active={activeTab === "positions"} onClick={() => setActiveTab("positions")} label="Открытые" count={PORTFOLIO_POSITIONS.length} />
            <PfTabBtn active={activeTab === "trades"} onClick={() => setActiveTab("trades")} label="Закрытые сделки" count={CLOSED_TRADES.length} />
            <PfTabBtn active={activeTab === "strategies"} onClick={() => setActiveTab("strategies")} label="Стратегии" count={STRATEGY_PERFORMANCE.length} />
            <PfTabBtn active={activeTab === "heatmap"} onClick={() => setActiveTab("heatmap")} label="Heatmap" count={null} />
          </div>
          <div className="scroll" style={{ flex: 1, overflowY: "auto" }}>
            {activeTab === "positions" && <PositionsTable positions={positions} />}
            {activeTab === "trades" && <TradesTable trades={CLOSED_TRADES} />}
            {activeTab === "strategies" && <StrategyPerformance items={STRATEGY_PERFORMANCE} />}
            {activeTab === "heatmap" && <AssetHeatmap />}
          </div>
        </div>

        {/* Risk panel */}
        <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
          <PanelHeader title="РИСК · АНАЛИТИКА" meta="institutional metrics" />
          <div className="scroll" style={{ flex: 1, padding: 12, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
            <RiskMetric label="Sharpe Ratio" v={sharpe.toFixed(2)} bar={sharpe / 3 * 100} c="var(--green)" detail="за период · отлично >1.5" />
            <RiskMetric label="Max Drawdown" v={`-${maxDD}%`} bar={maxDD * 4} c="var(--amber)" detail="допустимо <15%" />
            <RiskMetric label="Volatility (σ)" v="2.4σ" bar={48} c="var(--accent)" detail="на baseline 2.0σ" />
            <RiskMetric label="Win Rate" v={`${winRate.toFixed(1)}%`} bar={winRate} c="var(--green)" detail="всех закрытых сделок" />
            <RiskMetric label="Profit Factor" v="2.18" bar={72} c="var(--green)" detail="gross profit / gross loss" />
            <RiskMetric label="Concentration" v="36%" bar={36} c="var(--amber)" detail="макс. позиция в портфеле" />

            <div style={{
              padding: 10, marginTop: 6,
              background: "oklch(0.78 0.16 var(--accent-h) / 0.06)",
              border: "1px solid oklch(0.78 0.16 var(--accent-h) / 0.3)",
              borderLeft: "3px solid var(--accent)",
              borderRadius: 3,
              fontSize: 11, color: "var(--text)", lineHeight: 1.5,
            }}>
              <span style={{ color: "var(--accent)", fontWeight: 600 }}>↳ risk.agt:</span> Портфель в зелёной зоне. Sharpe выше benchmark, drawdown в пределах нормы. Концентрация ETH+BTC 68% — рекомендуется диверсификация в Q3.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BigPfStat({ label, v, c, sub }) {
  return (
    <div style={{
      flex: 1, padding: "12px 16px",
      borderRight: "1px solid var(--line)",
    }}>
      <div style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.15, fontWeight: 600, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 22, color: c, fontWeight: 500, marginTop: 2, letterSpacing: "-0.01em" }}>{v}</div>
      {sub && <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

function PfTabBtn({ active, onClick, label, count }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "9px 14px",
      background: "transparent", border: "none",
      color: active ? "var(--accent)" : "var(--text-mid)",
      borderBottom: `2px solid ${active ? "var(--accent)" : "transparent"}`,
      fontFamily: "var(--font-ui)", fontSize: 11.5, fontWeight: 500,
      cursor: "pointer", letterSpacing: 0.02,
    }}>
      {label}
      {count != null && (
        <span className="mono" style={{ fontSize: 10, color: active ? "var(--accent)" : "var(--text-dim)" }}>{count}</span>
      )}
    </button>
  );
}

function PnlRow({ trade, label }) {
  if (!trade) return null;
  const c = trade.pnl >= 0 ? "var(--green)" : "var(--red)";
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "auto 1fr auto",
      gap: 8, alignItems: "center",
      padding: "6px 10px",
      background: "var(--bg-0)", border: "1px solid var(--line)",
      borderLeft: `2px solid ${c}`,
      borderRadius: 3,
    }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.08, fontWeight: 600 }}>{label}</span>
      <div>
        <div style={{ fontSize: 11, color: "var(--text-bright)" }}>
          {trade.sym} {trade.side === "long" ? "▲" : "▼"} <span className="mono" style={{ color: "var(--text-dim)" }}>{trade.id}</span>
        </div>
        <div className="mono" style={{ fontSize: 9.5, color: "var(--text-dim)" }}>{trade.closedAt} · {trade.strategy}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: c, fontWeight: 600 }}>
          {trade.pnlPct >= 0 ? "+" : ""}{trade.pnlPct.toFixed(2)}%
        </div>
        <div className="mono" style={{ fontSize: 9.5, color: c }}>{trade.pnl >= 0 ? "+" : ""}${trade.pnl}</div>
      </div>
    </div>
  );
}

function RiskMetric({ label, v, bar, c, detail }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11.5, color: "var(--text)" }}>{label}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: c, fontWeight: 500 }}>{v}</span>
      </div>
      <div style={{ height: 4, background: "var(--bg-3)", borderRadius: 1, overflow: "hidden" }}>
        <div style={{ width: `${Math.min(100, bar)}%`, height: "100%", background: c, boxShadow: `0 0 4px ${c}` }} />
      </div>
      <div className="mono" style={{ fontSize: 9.5, color: "var(--text-dim)", marginTop: 3 }}>{detail}</div>
    </div>
  );
}

Object.assign(window, { PortfolioPage });