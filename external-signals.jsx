/* external-signals.jsx — the "traceable lines" from the research, computed from
 * data (no paid API):
 *   1. BTC↔Nasdaq correlation regime — when high, crypto is driven by macro
 *      risk-on/off, not crypto factors (corr hit 0.87 in 2024). Data: BTC daily
 *      (Bybit) + QQQ daily (backend Yahoo proxy).
 *   2. Stablecoin peg health — a depeg is the earliest systemic warning
 *      (Terra/UST, USDC/SVB). Data: USDC/USDT on Bybit spot.
 * Both degrade gracefully when the backend/pair is unavailable. */

function pearson(a, b) {
  const n = Math.min(a.length, b.length);
  if (n < 5) return 0;
  const x = a.slice(-n), y = b.slice(-n);
  const mx = x.reduce((s, v) => s + v, 0) / n, my = y.reduce((s, v) => s + v, 0) / n;
  let cov = 0, vx = 0, vy = 0;
  for (let i = 0; i < n; i++) { cov += (x[i] - mx) * (y[i] - my); vx += (x[i] - mx) ** 2; vy += (y[i] - my) ** 2; }
  return (vx > 0 && vy > 0) ? cov / Math.sqrt(vx * vy) : 0;
}

/* Align two dated daily series and correlate their daily returns over `window`. */
function correlateDaily(btcDaily, stock, window = 30) {
  if (!btcDaily || !stock || !stock.closes) return null;
  const stockByDate = {};
  stock.dates.forEach((d, i) => { stockByDate[d] = stock.closes[i]; });
  // BTC candle.start (ms) → ISO date
  const paired = [];
  btcDaily.forEach(c => {
    const d = new Date(c.start).toISOString().slice(0, 10);
    if (stockByDate[d] != null) paired.push({ d, btc: c.close, stk: stockByDate[d] });
  });
  if (paired.length < window + 2) return null;
  const seg = paired.slice(-(window + 1));
  const rb = [], rs = [];
  for (let i = 1; i < seg.length; i++) {
    rb.push(Math.log(seg[i].btc / seg[i - 1].btc));
    rs.push(Math.log(seg[i].stk / seg[i - 1].stk));
  }
  return { corr: pearson(rb, rs), days: rb.length };
}

/* Full external context. Async — fetches BTC daily + backend stocks + USDC peg. */
async function externalContext() {
  const out = { corr: null, peg: null, stocks: null };

  // stocks (backend) + BTC daily (Bybit) in parallel
  const [stocksRes, btcDaily, usdc] = await Promise.all([
    fetch("/api/stocks").then(r => (r.ok ? r.json() : null)).catch(() => null),
    (typeof bybitFetchKlines === "function" ? bybitFetchKlines("BTCUSDT", "D", 90) : Promise.resolve(null)).catch(() => null),
    (typeof bybitFetchTicker === "function" ? bybitFetchTicker("USDCUSDT") : Promise.resolve(null)).catch(() => null),
  ]);

  if (stocksRes && stocksRes.ok && stocksRes.stocks) {
    out.stocks = stocksRes.stocks;
    if (btcDaily) {
      const nasdaq = correlateDaily(btcDaily, stocksRes.stocks.nasdaq, 30);
      const dxy = correlateDaily(btcDaily, stocksRes.stocks.dxy, 30);
      if (nasdaq) {
        const c = nasdaq.corr;
        out.corr = {
          nasdaq: c, dxy: dxy ? dxy.corr : null, days: nasdaq.days,
          regime: c > 0.6 ? "risk-driven" : c > 0.3 ? "mixed" : c < -0.2 ? "decoupled" : "crypto-native",
          note: c > 0.6
            ? "крипта следует за Nasdaq — рынком правит risk-on/off, не крипто-факторы"
            : c > 0.3 ? "умеренная связь с фондовым — учитывай макро-фон"
            : c < -0.2 ? "движется против фондового — работает как хедж"
            : "крипта живёт своей жизнью — TA-сигналы чище",
        };
      }
    }
  }

  if (usdc && usdc.lastPrice) {
    const p = usdc.lastPrice;
    const devBps = (p - 1) * 10000;   // basis points off the $1 peg
    out.peg = {
      usdc: p, devBps,
      status: Math.abs(devBps) > 100 ? "depeg" : Math.abs(devBps) > 30 ? "strained" : "healthy",
      note: Math.abs(devBps) > 100 ? "СЕРЬЁЗНЫЙ ДЕПЕГ USDC — системный риск, уходи в кэш"
        : Math.abs(devBps) > 30 ? "USDC отклонился от $1 — следи внимательно"
        : "стейблкоины держат привязку",
    };
  }
  return out;
}

const CORR_CFG = {
  "risk-driven":  { color: "var(--amber)", label: "RISK-DRIVEN" },
  "mixed":        { color: "var(--blue)",  label: "СМЕШАННЫЙ" },
  "crypto-native":{ color: "var(--green)", label: "КРИПТО-НАТИВНЫЙ" },
  "decoupled":    { color: "var(--accent-2)", label: "РАЗВЯЗАН" },
};
const PEG_CFG = {
  healthy:  { color: "var(--green)", label: "ПРИВЯЗКА ОК" },
  strained: { color: "var(--amber)", label: "НАПРЯЖЕНИЕ" },
  depeg:    { color: "var(--red)",   label: "ДЕПЕГ" },
};

/* Panel for the AI Brain page. */
function ExternalSignalsPanel() {
  const [ctx, setCtx] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    const run = () => externalContext().then(c => { if (!cancelled) { setCtx(c); setLoading(false); } }).catch(() => { if (!cancelled) setLoading(false); });
    run();
    const id = setInterval(run, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const macro = typeof macroRisk === "function" ? macroRisk() : null;
  const macroCfg = macro && typeof MACRO_LEVELS !== "undefined" ? MACRO_LEVELS[macro.level] : null;

  return (
    <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <PanelHeader title="ВНЕШНИЙ КОНТЕКСТ" meta="макро · фондовый рынок · стейблкоины" />
      <div style={{ padding: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {/* Macro fuse */}
        <ExtCell label="Макро-событие"
          value={macro && macro.next ? (macroCfg ? macroCfg.label : macro.level) : "—"}
          color={macroCfg ? macroCfg.color : "var(--text-dim)"}
          sub={macro ? macro.note : "нет данных"} />

        {/* Correlation regime */}
        <ExtCell label="Режим (BTC vs Nasdaq)"
          value={ctx && ctx.corr ? (CORR_CFG[ctx.corr.regime] ? CORR_CFG[ctx.corr.regime].label : ctx.corr.regime) : (loading ? "…" : "—")}
          color={ctx && ctx.corr && CORR_CFG[ctx.corr.regime] ? CORR_CFG[ctx.corr.regime].color : "var(--text-dim)"}
          sub={ctx && ctx.corr ? `corr ${ctx.corr.nasdaq.toFixed(2)} · ${ctx.corr.note}` : "нужен бэкенд /api/stocks"} />

        {/* Stablecoin peg */}
        <ExtCell label="Стейблкоины · USDC"
          value={ctx && ctx.peg ? (PEG_CFG[ctx.peg.status] ? PEG_CFG[ctx.peg.status].label : ctx.peg.status) : (loading ? "…" : "—")}
          color={ctx && ctx.peg && PEG_CFG[ctx.peg.status] ? PEG_CFG[ctx.peg.status].color : "var(--text-dim)"}
          sub={ctx && ctx.peg ? `$${ctx.peg.usdc.toFixed(4)} · ${ctx.peg.devBps >= 0 ? "+" : ""}${ctx.peg.devBps.toFixed(0)} б.п. от $1` : "—"} />

        {/* Traditional markets snapshot */}
        <ExtCell label="Фондовый рынок · 24ч"
          value={ctx && ctx.stocks && ctx.stocks.nasdaq ? `Nasdaq ${ctx.stocks.nasdaq.chgPct >= 0 ? "+" : ""}${ctx.stocks.nasdaq.chgPct.toFixed(2)}%` : (loading ? "…" : "—")}
          color={ctx && ctx.stocks && ctx.stocks.nasdaq ? (ctx.stocks.nasdaq.chgPct >= 0 ? "var(--green)" : "var(--red)") : "var(--text-dim)"}
          sub={ctx && ctx.stocks ? `DXY ${ctx.stocks.dxy ? ctx.stocks.dxy.last.toFixed(1) : "—"} · золото $${ctx.stocks.gold ? Math.round(ctx.stocks.gold.last) : "—"}` : "—"} />
      </div>
    </div>
  );
}

function ExtCell({ label, value, color, sub }) {
  return (
    <div style={{ background: "var(--bg-0)", border: "1px solid var(--line)", borderLeft: `2px solid ${color}`, borderRadius: 3, padding: "8px 10px" }}>
      <div style={{ fontSize: 8.5, color: "var(--text-dim)", letterSpacing: 0.1, fontWeight: 600, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color, marginTop: 2, fontWeight: 600 }}>{value}</div>
      {sub && <div style={{ fontSize: 9.5, color: "var(--text-dim)", marginTop: 2, lineHeight: 1.35 }}>{sub}</div>}
    </div>
  );
}

Object.assign(window, { externalContext, correlateDaily, ExternalSignalsPanel });
