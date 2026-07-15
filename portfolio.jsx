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

/* ─── Real demo-trading state: the budget you set in Settings + every trade the
 * terminal actually made (localStorage vael.trades.<symbol>). No seed data. ─── */
function loadDemoState() {
  let budget = 10000;
  try { budget = +localStorage.getItem("vael.budget") || 10000; } catch (_) {}
  const positions = [], history = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || k.indexOf("vael.trades.") !== 0) continue;
      const bybit = k.slice("vael.trades.".length);
      const v = JSON.parse(localStorage.getItem(k) || "null");
      if (!v) continue;
      (v.positions || []).forEach(p => positions.push({ ...p, bybit: p.bybit || bybit, sym: p.sym || bybit.replace("USDT", "") }));
      (v.history || []).forEach(h => history.push({ ...h, bybit: h.bybit || bybit, sym: h.sym || bybit.replace("USDT", "") }));
    }
  } catch (_) {}
  history.sort((a, b) => (b.closedTs || 0) - (a.closedTs || 0));
  return { budget, positions, history };
}

const PF_PERIODS = [
  { id: "1d",  label: "День",   days: 1 },
  { id: "7d",  label: "Неделя", days: 7 },
  { id: "30d", label: "Месяц",  days: 30 },
  { id: "365d",label: "Год",    days: 365 },
  { id: "all", label: "Всё",    days: null },
  { id: "custom", label: "Период…", days: null },
];

/* Always show cents — a demo P&L of +$0.34 must not vanish into rounding. */
function pfMoney(n) {
  const s = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n < 0 ? "−" : ""}$${s}`;
}

function PortfolioPage({ lang }) {
  const [period, setPeriod] = useState("30d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [activeTab, setActiveTab] = useState("positions");
  const [state, setState] = useState(loadDemoState);

  // re-read whenever the terminal writes a trade or Settings changes the budget
  useEffect(() => {
    const sync = () => setState(loadDemoState());
    window.addEventListener("vael:budget", sync);
    window.addEventListener("storage", sync);
    const id = setInterval(sync, 2000);
    return () => { window.removeEventListener("vael:budget", sync); window.removeEventListener("storage", sync); clearInterval(id); };
  }, []);

  const { budget, positions: rawPos, history } = state;

  // live prices for the open positions
  const symbols = useMemo(() => [...new Set(rawPos.map(p => p.bybit))], [rawPos]);
  const { prices, status: liveStatus } = useBybitTickers(symbols, 6000);

  const positions = useMemo(() => rawPos.map(p => {
    const t = prices[p.bybit];
    const cur = t ? t.lastPrice : (p.currentPrice || p.entry);
    const pnl = p.side === "buy"
      ? (cur - p.entry) * (p.size / p.entry)
      : (p.entry - cur) * (p.size / p.entry);
    const margin = p.margin != null ? p.margin : p.size;
    return { ...p, cur, pnl, roe: margin ? pnl / margin * 100 : 0, margin };
  }), [rawPos, prices]);

  // ─── balance: budget + everything realised; equity adds open PnL ───
  const realizedAll = history.reduce((s, t) => s + (t.pnl || 0), 0);
  const balance = budget + realizedAll;
  const unrealized = positions.reduce((s, p) => s + p.pnl, 0);
  const equityNow = balance + unrealized;
  const marginUsed = positions.reduce((s, p) => s + (p.margin || 0), 0);
  const free = Math.max(0, balance - marginUsed);

  // ─── period slice ───
  const range = useMemo(() => {
    const p = PF_PERIODS.find(x => x.id === period);
    if (period === "custom") {
      const a = from ? new Date(from + "T00:00:00").getTime() : 0;
      const b = to ? new Date(to + "T23:59:59").getTime() : Date.now();
      return [a, b];
    }
    if (!p || p.days == null) return [0, Date.now()];
    return [Date.now() - p.days * 864e5, Date.now()];
  }, [period, from, to]);

  const inPeriod = useMemo(
    () => history.filter(t => t.closedTs && t.closedTs >= range[0] && t.closedTs <= range[1]),
    [history, range]
  );

  // ─── stats for the selected period ───
  const st = useMemo(() => {
    const n = inPeriod.length;
    const wins = inPeriod.filter(t => t.pnl > 0);
    const losses = inPeriod.filter(t => t.pnl <= 0);
    const gross = wins.reduce((s, t) => s + t.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
    const realized = inPeriod.reduce((s, t) => s + t.pnl, 0);
    const sorted = [...inPeriod].sort((a, b) => b.pnl - a.pnl);
    // equity curve over the period (chronological)
    const chrono = [...inPeriod].sort((a, b) => (a.closedTs || 0) - (b.closedTs || 0));
    const startCap = budget + (realizedAll - realized);        // capital at period start
    let run = startCap;
    const curve = [{ t: range[0] || (chrono[0] ? chrono[0].closedTs : Date.now()), v: startCap }];
    let peak = startCap, maxDD = 0;
    chrono.forEach(t => {
      run += t.pnl;
      curve.push({ t: t.closedTs, v: run });
      peak = Math.max(peak, run);
      maxDD = Math.max(maxDD, peak > 0 ? (peak - run) / peak * 100 : 0);
    });
    // Sharpe over per-trade returns
    const rets = chrono.map(t => t.pnl / (t.margin != null ? t.margin : t.size || 1));
    const mean = rets.length ? rets.reduce((s, x) => s + x, 0) / rets.length : 0;
    const sd = rets.length ? Math.sqrt(rets.reduce((s, x) => s + (x - mean) ** 2, 0) / rets.length) : 0;
    // edge breakdown: average win / loss, payoff ratio, expectancy, fees paid
    const avgWin = wins.length ? gross / wins.length : 0;
    const avgLoss = losses.length ? grossLoss / losses.length : 0;   // positive magnitude
    const payoff = avgLoss > 0 ? avgWin / avgLoss : (avgWin > 0 ? Infinity : 0);
    const pWin = n ? wins.length / n : 0;
    const expectancy = n ? pWin * avgWin - (1 - pWin) * avgLoss : 0;  // expected $ per trade
    const feesPaid = inPeriod.reduce((s, t) => s + (t.fee || 0), 0);  // commission already netted from pnl
    return {
      n, wins: wins.length, losses: losses.length,
      winRate: n ? wins.length / n * 100 : 0,
      realized, roi: startCap ? realized / startCap * 100 : 0,
      pf: grossLoss > 0 ? gross / grossLoss : (gross > 0 ? Infinity : 0),
      best: sorted[0] || null, worst: sorted[sorted.length - 1] || null,
      avg: n ? realized / n : 0,
      avgWin, avgLoss, payoff, expectancy, feesPaid,
      curve, maxDD,
      sharpe: sd > 0 ? (mean / sd) * Math.sqrt(Math.max(1, n)) : 0,
      startCap,
    };
  }, [inPeriod, budget, realizedAll, range]);

  const periodLabel = (PF_PERIODS.find(p => p.id === period) || {}).label || "";

  return (
    <div data-screen-label="12 Portfolio" style={{
      minHeight: "100%", padding: "var(--gap)",
      display: "flex", flexDirection: "column",
    }}>
      <PageHeader title={lang === "en" ? "PORTFOLIO" : "ПОРТФЕЛЬ"}
        sub={`демо-счёт · старт $${budget.toLocaleString("en-US")} (из настроек) · ${positions.length} открытых · ${history.length} закрытых сделок`}
        actions={
          <>
            {typeof LiveTag === "function" && <LiveTag status={liveStatus} />}
            {PF_PERIODS.map(p => (
              <button key={p.id} onClick={() => setPeriod(p.id)}
                className={`btn ${period === p.id ? "btn-accent" : ""}`}>{p.label}</button>
            ))}
          </>
        }
      />

      {period === "custom" && (
        <div className="panel" style={{ padding: "8px 14px", marginBottom: "var(--gap)", display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
          <span className="mono" style={{ fontSize: 10.5, color: "var(--text-dim)" }}>период с</span>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={pfDateStyle} />
          <span className="mono" style={{ fontSize: 10.5, color: "var(--text-dim)" }}>по</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} style={pfDateStyle} />
          <span className="mono" style={{ fontSize: 10, color: "var(--text-dim)", marginLeft: 6 }}>
            {inPeriod.length} сделок в диапазоне
          </span>
        </div>
      )}

      {/* Real Bybit account (appears only when the backend has a read-only key) */}
      <RealAccountPanel />

      {/* Real on-chain balances from the user's own wallet addresses */}
      <WalletsPanel />

      {/* Balance row — derived from the budget and actual trades */}
      <div className="panel" style={{ display: "flex", flexShrink: 0, marginBottom: "var(--gap)", flexWrap: "wrap" }}>
        <BigPfStat label="БАЛАНС" v={pfMoney(balance)} c="var(--text-bright)"
          sub={`старт $${budget.toLocaleString("en-US")} · реализовано ${realizedAll >= 0 ? "+" : "−"}$${Math.abs(realizedAll).toFixed(2)}`} />
        <BigPfStat label="ЭКВИТИ (с открытыми)" v={pfMoney(equityNow)}
          c={equityNow >= budget ? "var(--green)" : "var(--red)"}
          sub={`${((equityNow - budget) / budget * 100).toFixed(2)}% от старта`} />
        <BigPfStat label="НЕРЕАЛИЗ. P&L" v={`${unrealized >= 0 ? "+" : "−"}$${Math.abs(unrealized).toFixed(2)}`}
          c={unrealized >= 0 ? "var(--green)" : "var(--red)"}
          sub={`${positions.length} открытых · маржа $${marginUsed.toLocaleString("en-US")}`} />
        <BigPfStat label={`P&L · ${periodLabel.toUpperCase()}`}
          v={`${st.realized >= 0 ? "+" : "−"}$${Math.abs(st.realized).toFixed(2)}`}
          c={st.realized >= 0 ? "var(--green)" : "var(--red)"}
          sub={`${st.n} сделок · ${st.winRate.toFixed(0)}% winrate · ROI ${st.roi >= 0 ? "+" : ""}${st.roi.toFixed(2)}%`} />
        <BigPfStat label="СВОБОДНО" v={pfMoney(free)} c="var(--accent)"
          sub={`использовано ${balance > 0 ? (marginUsed / balance * 100).toFixed(0) : 0}%`} />
      </div>

      {/* Main grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: "var(--gap)", alignItems: "start" }}>
        {/* Equity curve from real closed trades */}
        <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <PanelHeader title={`КРИВАЯ КАПИТАЛА · ${periodLabel.toUpperCase()}`}
            meta={`старт $${Math.round(st.startCap).toLocaleString("en-US")} · по закрытым сделкам`}
            action={
              <span className="mono" style={{ fontSize: 10, color: st.realized >= 0 ? "var(--green)" : "var(--red)" }}>
                {st.realized >= 0 ? "+" : "−"}${Math.abs(st.realized).toFixed(2)}
              </span>
            }
          />
          <div style={{ padding: 12 }}>
            <DemoEquityChart curve={st.curve} start={st.startCap} width={800} height={220} />
          </div>
        </div>

        {/* Period stats */}
        <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <PanelHeader title={`СТАТИСТИКА · ${periodLabel.toUpperCase()}`} meta={`${st.n} закрытых сделок`} />
          <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <RiskMetric label="Win Rate" v={`${st.winRate.toFixed(1)}%`} bar={st.winRate}
              c={st.winRate >= 50 ? "var(--green)" : "var(--amber)"} detail={`${st.wins}W / ${st.losses}L`} />
            <RiskMetric label="Profit Factor" v={st.pf === Infinity ? "∞" : st.pf.toFixed(2)}
              bar={Math.min(100, st.pf * 33)} c={st.pf >= 1 ? "var(--green)" : "var(--red)"}
              detail="валовая прибыль / валовый убыток" />
            <RiskMetric label="Sharpe" v={st.sharpe.toFixed(2)} bar={Math.min(100, Math.abs(st.sharpe) * 33)}
              c={st.sharpe >= 1 ? "var(--green)" : "var(--amber)"} detail="по доходности сделок" />
            <RiskMetric label="Max Drawdown" v={`−${st.maxDD.toFixed(1)}%`} bar={Math.min(100, st.maxDD * 4)}
              c={st.maxDD < 15 ? "var(--green)" : "var(--red)"} detail="макс. просадка капитала" />
            <RiskMetric label="Средняя сделка" v={`${st.avg >= 0 ? "+" : "−"}$${Math.abs(st.avg).toFixed(2)}`}
              bar={50} c={st.avg >= 0 ? "var(--green)" : "var(--red)"} detail="P&L на сделку" />
            <RiskMetric label="Payoff" v={st.payoff === Infinity ? "∞" : st.payoff.toFixed(2)}
              bar={Math.min(100, st.payoff * 33)} c={st.payoff >= 1 ? "var(--green)" : "var(--amber)"}
              detail={`ср. +$${st.avgWin.toFixed(2)} / −$${st.avgLoss.toFixed(2)}`} />
            <RiskMetric label="Ожидание на сделку" v={`${st.expectancy >= 0 ? "+" : "−"}$${Math.abs(st.expectancy).toFixed(2)}`}
              bar={50} c={st.expectancy >= 0 ? "var(--green)" : "var(--red)"} detail="матожидание P&L (edge)" />

            {st.best && (
              <div style={{ borderTop: "1px solid var(--line)", paddingTop: 8, display: "flex", flexDirection: "column", gap: 5, fontFamily: "var(--font-mono)", fontSize: 10.5 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-dim)" }}>лучшая · {st.best.sym}</span>
                  <span style={{ color: "var(--green)" }}>+${st.best.pnl.toFixed(2)}</span>
                </div>
                {st.worst && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-dim)" }}>худшая · {st.worst.sym}</span>
                    <span style={{ color: "var(--red)" }}>{st.worst.pnl >= 0 ? "+" : "−"}${Math.abs(st.worst.pnl).toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-dim)" }}>комиссии уплачено</span>
                  <span style={{ color: "var(--amber)" }} title="уже вычтены из P&L (чистый)">−${st.feesPaid.toFixed(2)}</span>
                </div>
              </div>
            )}
            {st.n === 0 && (
              <div style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)", lineHeight: 1.5 }}>
                За выбранный период закрытых сделок нет. Открой демо-сделку в терминале — статистика появится здесь.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Positions / trades */}
      <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden", marginTop: "var(--gap)" }}>
        <div style={{ display: "flex", borderBottom: "1px solid var(--line)", background: "var(--bg-2)" }}>
          <PfTabBtn active={activeTab === "positions"} onClick={() => setActiveTab("positions")} label="Открытые" count={positions.length} />
          <PfTabBtn active={activeTab === "trades"} onClick={() => setActiveTab("trades")} label={`Закрытые · ${periodLabel}`} count={inPeriod.length} />
        </div>
        <div className="scroll" style={{ maxHeight: 340, overflowY: "auto" }}>
          {activeTab === "positions" && <DemoPositionsTable positions={positions} />}
          {activeTab === "trades" && <DemoTradesTable trades={inPeriod} />}
        </div>
      </div>
    </div>
  );
}

const pfDateStyle = {
  background: "var(--bg-0)", border: "1px solid var(--line-bright)",
  color: "var(--text-bright)", fontFamily: "var(--font-mono)", fontSize: 11,
  padding: "4px 8px", borderRadius: 3, outline: "none",
};

function DemoEquityChart({ curve, start, width = 800, height = 220 }) {
  if (!curve || curve.length < 2) {
    return <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
      нет закрытых сделок за период
    </div>;
  }
  const vals = curve.map(p => p.v);
  const lo = Math.min(...vals, start), hi = Math.max(...vals, start);
  const pad = (hi - lo) * 0.08 || 1;
  const min = lo - pad, max = hi + pad, range = max - min;
  const padT = 10, padB = 10;
  const stepX = width / (curve.length - 1);
  const y = v => padT + (1 - (v - min) / range) * (height - padT - padB);
  const path = curve.map((p, i) => `${i === 0 ? "M" : "L"}${i * stepX},${y(p.v)}`).join(" ");
  const area = path + ` L${width},${y(min)} L0,${y(min)} Z`;
  const up = vals[vals.length - 1] >= start;
  const col = up ? "var(--green)" : "var(--red)";
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: "block", background: "var(--bg-1)", borderRadius: 4 }}>
      <defs>
        <linearGradient id="pf-eq" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={col} stopOpacity="0.25" />
          <stop offset="100%" stopColor={col} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <line x1={0} y1={y(start)} x2={width} y2={y(start)} stroke="var(--text-dim)" strokeWidth={0.7} strokeDasharray="3 3" opacity={0.6} />
      <text x={4} y={y(start) - 3} fill="var(--text-dim)" style={{ fontFamily: "var(--font-mono)", fontSize: 9 }}>
        старт ${Math.round(start).toLocaleString("en-US")}
      </text>
      <path d={area} fill="url(#pf-eq)" stroke="none" />
      <path d={path} fill="none" stroke={col} strokeWidth={1.6} />
      <circle cx={(curve.length - 1) * stepX} cy={y(vals[vals.length - 1])} r={2.8} fill={col} />
    </svg>
  );
}

function DemoPositionsTable({ positions }) {
  if (!positions.length) return <EmptyState text="Нет открытых демо-позиций. Открой сделку в терминале." />;
  const G = "70px 66px 60px 46px 74px 84px 84px 84px 70px";
  return (
    <div>
      <THead cols={["Актив", "Тип", "Маржа", "Плечо", "Позиция", "Вход", "Цена", "P&L $", "ROE %"]} grid={G} />
      {positions.map(p => {
        const c = p.pnl >= 0 ? "var(--green)" : "var(--red)";
        const dec = p.entry < 10 ? 4 : 2;
        return (
          <div key={p.id} style={{ display: "grid", gridTemplateColumns: G, alignItems: "center", padding: "6px 12px", borderBottom: "1px solid var(--line)", fontFamily: "var(--font-mono)", fontSize: 10.5 }}>
            <span style={{ color: "var(--text-bright)", fontWeight: 600 }}>{p.sym}</span>
            <span style={{ color: p.side === "buy" ? "var(--green)" : "var(--red)", fontWeight: 600 }}>{p.side === "buy" ? "▲ ЛОНГ" : "▼ ШОРТ"}</span>
            <span style={{ color: "var(--text-mid)" }}>${p.margin}</span>
            <span style={{ color: (p.lev || 1) >= 10 ? "var(--amber)" : "var(--accent)" }}>{p.lev || 1}x</span>
            <span style={{ color: "var(--text)" }}>${p.size}</span>
            <span style={{ color: "var(--text-mid)" }}>{p.entry.toFixed(dec)}</span>
            <span style={{ color: "var(--text-bright)" }}>{p.cur.toFixed(dec)}</span>
            <span style={{ color: c }}>{p.pnl >= 0 ? "+" : "−"}${Math.abs(p.pnl).toFixed(2)}</span>
            <span style={{ color: c, fontWeight: 600 }}>{p.roe >= 0 ? "+" : ""}{p.roe.toFixed(1)}%</span>
          </div>
        );
      })}
    </div>
  );
}

function DemoTradesTable({ trades }) {
  if (!trades.length) return <EmptyState text="За выбранный период закрытых сделок нет." />;
  const G = "104px 70px 66px 60px 46px 84px 84px 84px 70px";
  return (
    <div>
      <THead cols={["Закрыта", "Актив", "Тип", "Маржа", "Плечо", "Вход", "Выход", "P&L $", "ROE %"]} grid={G} />
      {trades.map((t, i) => {
        const c = t.pnl >= 0 ? "var(--green)" : "var(--red)";
        const dec = t.entry < 10 ? 4 : 2;
        const d = t.closedTs ? new Date(t.closedTs) : null;
        const when = d ? `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` : (t.closedAt || "—");
        return (
          <div key={t.id + "-" + i} style={{ display: "grid", gridTemplateColumns: G, alignItems: "center", padding: "6px 12px", borderBottom: "1px solid var(--line)", fontFamily: "var(--font-mono)", fontSize: 10.5 }}>
            <span style={{ color: "var(--text-dim)" }}>{when}</span>
            <span style={{ color: "var(--text-bright)", fontWeight: 600 }}>{t.sym}</span>
            <span style={{ color: t.side === "buy" ? "var(--green)" : "var(--red)", fontWeight: 600 }}>{t.side === "buy" ? "▲ ЛОНГ" : "▼ ШОРТ"}</span>
            <span style={{ color: "var(--text-mid)" }}>${t.margin != null ? t.margin : t.size}</span>
            <span style={{ color: "var(--accent)" }}>{t.lev || 1}x</span>
            <span style={{ color: "var(--text-mid)" }}>{t.entry.toFixed(dec)}</span>
            <span style={{ color: "var(--text-mid)" }}>{(t.exitPrice ?? 0).toFixed(dec)}</span>
            <span style={{ color: c }}>{t.pnl >= 0 ? "+" : "−"}${Math.abs(t.pnl).toFixed(2)}</span>
            <span style={{ color: c, fontWeight: 600 }}>{t.pnlPct >= 0 ? "+" : ""}{(t.pnlPct || 0).toFixed(1)}%</span>
          </div>
        );
      })}
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