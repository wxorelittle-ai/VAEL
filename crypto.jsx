/* crypto.jsx — Crypto signals + demo trading panel for dashboard */

/* ─────────────────────────────────────────────────────────
 * Asset pool — symbols we track
 * ────────────────────────────────────────────────────────*/
const CRYPTO_ASSETS = [
  { sym: "BTC/USDT",  bybit: "BTCUSDT",  name: "Bitcoin" },   // main chart
  { sym: "ETH/USDT",  bybit: "ETHUSDT",  name: "Ethereum" },
  { sym: "SOL/USDT",  bybit: "SOLUSDT",  name: "Solana"  },
  { sym: "AVAX/USDT", bybit: "AVAXUSDT", name: "Avalanche" },
];

/* ─── Timeframes.
 * Bybit klines exist only for 1/3/5/15/30/60/120/240m + D — there are NO
 * sub-minute klines and no 2/10/45m. So:
 *   native — served by Bybit as-is
 *   agg    — rebuilt from a coarser native base (bucketed by timestamp)
 *   sec    — built live from the public trade stream (no history exists) */
const MIN = 60000;
const TF_MAP = {
  "1s":  { kind: "sec", seconds: 1,  label: "1с" },
  "5s":  { kind: "sec", seconds: 5,  label: "5с" },
  "10s": { kind: "sec", seconds: 10, label: "10с" },
  "15s": { kind: "sec", seconds: 15, label: "15с" },
  "30s": { kind: "sec", seconds: 30, label: "30с" },
  "45s": { kind: "sec", seconds: 45, label: "45с" },
  "1m":  { kind: "native", base: "1",  label: "1м" },
  "2m":  { kind: "agg", base: "1",  baseMs: MIN,      mult: 2, label: "2м" },
  "3m":  { kind: "native", base: "3",  label: "3м" },
  "5m":  { kind: "native", base: "5",  label: "5м" },
  "10m": { kind: "agg", base: "5",  baseMs: 5 * MIN,  mult: 2, label: "10м" },
  "15m": { kind: "native", base: "15", label: "15м" },
  "30m": { kind: "native", base: "30", label: "30м" },
  "45m": { kind: "agg", base: "15", baseMs: 15 * MIN, mult: 3, label: "45м" },
  "1h":  { kind: "native", base: "60", label: "1ч" },
  "4h":  { kind: "native", base: "240", label: "4ч" },
  "1D":  { kind: "native", base: "D",  label: "1D" },
};
const TF_ORDER = ["1s", "5s", "10s", "15s", "30s", "45s", "1m", "2m", "3m", "5m", "10m", "15m", "30m", "45m", "1h", "4h", "1D"];

/* ─── Coin scanner: every leverage-tradable coin on Bybit (linear perpetuals,
 * incl. memecoins). Added coins persist locally and trade in the terminal. ─── */
const USER_ASSETS_LS = "vael.assets";
function loadUserAssets() { try { return JSON.parse(localStorage.getItem(USER_ASSETS_LS) || "[]"); } catch (_) { return []; } }
function saveUserAssets(a) { try { localStorage.setItem(USER_ASSETS_LS, JSON.stringify(a)); } catch (_) {} }

/* Bybit doesn't tag memecoins — curated base-symbol list, substring match. */
const MEME_KEYS = ["DOGE", "SHIB", "PEPE", "WIF", "BONK", "FLOKI", "POPCAT", "MEME", "BRETT", "MOG",
  "TURBO", "NEIRO", "PNUT", "GOAT", "CHILLGUY", "BABYDOGE", "ELON", "LADYS", "MEW", "SLERF", "BOME",
  "MYRO", "PONKE", "TRUMP", "MELANIA", "FARTCOIN", "MOODENG", "BANANA", "INU", "WOJAK", "APU", "GIGA",
  "SPX", "DEGEN", "HIPPO", "SUNDOG", "TOSHI", "MUMU", "CAT"];
const isMemeCoin = base => MEME_KEYS.some(k => base.includes(k));

function fmtVol(v) {
  if (!v) return "—";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function CoinScannerModal({ open, onClose, onAdd, existing }) {
  const [list, setList] = useState(null);
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState("vol");   // vol | chg | lev
  const [memeOnly, setMemeOnly] = useState(false);
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (!open || list) return;
    if (typeof bybitFetchLeverageUniverse !== "function") { setErr(true); return; }
    bybitFetchLeverageUniverse().then(setList).catch(() => setErr(true));
  }, [open, list]);

  useEffect(() => {
    if (!open) return;
    const h = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  const rows = useMemo(() => {
    if (!list) return [];
    const term = q.trim().toUpperCase();
    let r = list.filter(c => (!term || c.base.includes(term)) && (!memeOnly || isMemeCoin(c.base)));
    if (sortBy === "chg") r = [...r].sort((a, b) => b.chg24h - a.chg24h);
    else if (sortBy === "lev") r = [...r].sort((a, b) => (b.maxLev || 0) - (a.maxLev || 0));
    return r.slice(0, 150);   // list is already volume-sorted from the API layer
  }, [list, q, sortBy, memeOnly]);

  if (!open) return null;
  const sortBtn = (id, label) => (
    <button onClick={() => setSortBy(id)} style={{
      fontFamily: "var(--font-mono)", fontSize: 10, padding: "3px 9px", borderRadius: 3, cursor: "pointer",
      background: sortBy === id ? "var(--accent-soft)" : "var(--bg-0)",
      color: sortBy === id ? "var(--accent)" : "var(--text-dim)",
      border: `1px solid ${sortBy === id ? "oklch(0.78 0.16 var(--accent-h) / 0.4)" : "var(--line)"}`,
    }}>{label}</button>
  );

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "oklch(0 0 0 / 0.6)",
      backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", zIndex: 9989,
      display: "flex", alignItems: "center", justifyContent: "center", animation: "cpFade 0.18s ease-out",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "min(880px, 95vw)", height: "min(660px, 90vh)", background: "var(--bg-1)",
        border: "1px solid var(--line-bright)", borderRadius: 8, display: "flex", flexDirection: "column",
        overflow: "hidden", boxShadow: "0 24px 60px -12px oklch(0 0 0 / 0.7), var(--glow-strong)",
        animation: "cpScale 0.2s cubic-bezier(0.16,1,0.3,1)",
      }}>
        <header style={{ padding: "12px 18px", borderBottom: "1px solid var(--line)", background: "var(--bg-2)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--text-bright)", fontWeight: 500 }}>МОНЕТЫ С ПЛЕЧОМ · BYBIT</div>
            <div className="mono" style={{ fontSize: 9.5, color: "var(--text-dim)" }}>
              {list ? `${list.length} перпетуалов · мемкоины и альты · торгуются с плечом` : "загрузка списка…"}
            </div>
          </div>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="поиск: PEPE, WIF, DOGE…"
            style={{ marginLeft: "auto", width: 190, background: "var(--bg-0)", border: "1px solid var(--line-bright)", color: "var(--text-bright)", fontFamily: "var(--font-mono)", fontSize: 11, padding: "4px 8px", borderRadius: 3, outline: "none" }} />
          <button onClick={() => setMemeOnly(m => !m)} style={{
            fontFamily: "var(--font-mono)", fontSize: 10, padding: "3px 9px", borderRadius: 3, cursor: "pointer",
            background: memeOnly ? "oklch(0.66 0.12 var(--accent-h2) / 0.16)" : "var(--bg-0)",
            color: memeOnly ? "var(--accent-2)" : "var(--text-dim)",
            border: `1px solid ${memeOnly ? "var(--accent-2)" : "var(--line)"}`,
          }}>🐸 мемкоины</button>
          {sortBtn("vol", "объём")}{sortBtn("chg", "рост")}{sortBtn("lev", "плечо")}
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--text-dim)", fontSize: 16, cursor: "pointer" }}>✕</button>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 110px 90px 110px 80px 70px", padding: "5px 16px", background: "var(--bg-2)", borderBottom: "1px solid var(--line)", fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.06, textTransform: "uppercase" }}>
          <span>Монета</span><span style={{ textAlign: "right" }}>Цена</span><span style={{ textAlign: "right" }}>24ч</span><span style={{ textAlign: "right" }}>Объём 24ч</span><span style={{ textAlign: "right" }}>Плечо</span><span></span>
        </div>

        <div className="scroll" style={{ flex: 1, overflowY: "auto" }}>
          {err ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--red)", fontFamily: "var(--font-mono)", fontSize: 12 }}>не удалось загрузить список Bybit</div>
          ) : !list ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 12 }}>загрузка перпетуалов Bybit…</div>
          ) : rows.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 12 }}>ничего не найдено</div>
          ) : rows.map(c => {
            const added = existing.includes(c.symbol);
            const meme = isMemeCoin(c.base);
            return (
              <div key={c.symbol} style={{ display: "grid", gridTemplateColumns: "1fr 110px 90px 110px 80px 70px", padding: "6px 16px", borderBottom: "1px solid var(--line)", fontFamily: "var(--font-mono)", fontSize: 11, alignItems: "center" }}>
                <span style={{ color: "var(--text-bright)", fontWeight: 600 }}>
                  {c.base}{meme && <span style={{ color: "var(--accent-2)", fontSize: 9, marginLeft: 5 }}>meme</span>}
                </span>
                <span style={{ textAlign: "right", color: "var(--text-mid)" }}>{c.price < 0.01 ? c.price.toFixed(6) : c.price < 10 ? c.price.toFixed(4) : c.price.toFixed(2)}</span>
                <span style={{ textAlign: "right", color: c.chg24h >= 0 ? "var(--green)" : "var(--red)", fontWeight: 600 }}>{c.chg24h >= 0 ? "+" : ""}{c.chg24h.toFixed(1)}%</span>
                <span style={{ textAlign: "right", color: "var(--text-dim)" }}>{fmtVol(c.turnover24h)}</span>
                <span style={{ textAlign: "right", color: "var(--accent)" }}>{c.maxLev ? `${c.maxLev}x` : "—"}</span>
                <span style={{ textAlign: "right" }}>
                  {added ? (
                    <span style={{ color: "var(--green)", fontSize: 9.5 }}>✓ добавлена</span>
                  ) : (
                    <button onClick={() => onAdd(c)} className="btn btn-accent" style={{ fontSize: 10, padding: "2px 8px" }}>+ Добавить</button>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 * Reasoning bank
 * ────────────────────────────────────────────────────────*/
const REASONS = {
  buy: [
    "Накопление в whale-кошельках кластера #14 · позитивный sentiment · ожидаемый рост 1–4ч",
    "Пробой 200 EMA на 4ч · расширение объёма · bullish divergence на RSI",
    "Sell-pressure ослабла · удержание поддержки с откупом · сетка стоп-ловушек активна",
    "Bridge inflow в L2 ускоряется · корреляция с спот-объёмами 0.74",
    "Новостной триггер: positive · оценка влияния σ=+1.8 за 1ч окно",
    "Funding rate нормализуется · откат коротких позиций · потенциал short-squeeze",
  ],
  sell: [
    "Massive deposit на CEX из 0x7a2c…ef91 · ожидаемое давление на продажу",
    "Сентимент шифт в негатив · прорыв поддержки · краткосрочный downside",
    "Divergence MACD + слабеющий объём на росте · вероятна коррекция 2–4%",
    "Risk Agent в risk-off режиме · рекомендация закрыть лонги до подтверждения",
    "Whale 0x91a4 распределяет позицию · paтаt: 8 транзакций за 2ч",
    "Funding rate перегрет · перевернувшийся spread · risk asymmetry негативный",
  ],
};

const SIGNAL_AGENTS = ["strategy.agt", "forecast.agt", "risk.agt", "onchain.agt"];

/* ─────────────────────────────────────────────────────────
 * Candle + signal helpers
 * ────────────────────────────────────────────────────────*/
function genTrendCandles(n, base, vol = 0.01, trendBias = 0) {
  const out = [];
  let prev = base;
  for (let i = 0; i < n; i++) {
    const open = prev;
    const wave = Math.sin(i * 0.3) * base * vol * 0.4;
    const drift = (Math.random() - 0.48 + trendBias) * base * vol + wave * 0.3;
    const close = open + drift;
    const wick = base * vol * 0.6;
    const hi = Math.max(open, close) + Math.random() * wick;
    const lo = Math.min(open, close) - Math.random() * wick;
    out.push({ open, close, hi, lo, v: Math.random() * 80 + 20 });
    prev = close;
  }
  return out;
}

/* Real backtest: walk the historical candle window, run the TA engine at each
 * step, and keep the setups it would have fired — evaluated against the actual
 * subsequent price. Produces an honest track record (verified/failed). */
function makeInitialSignals(candles) {
  const out = [];
  if (!candles || candles.length < 62 || typeof analyzeMarket !== "function") return out;
  const HORIZON = 6; // candles ahead to judge outcome
  let id = 1840;
  const from = Math.max(55, candles.length - 200);   // keep the seed scan cheap
  for (let idx = from; idx <= candles.length - HORIZON - 1; idx += 2) {
    const a = analyzeMarket(candles.slice(0, idx + 1));
    if (!a || !a.setup) continue;
    const entry = candles[idx].close;
    const future = candles[idx + HORIZON].close;
    const movedPct = ((future - entry) / entry) * 100;
    const success = a.side === "buy" ? movedPct > 0 : movedPct < 0;
    out.push({
      id: `S-${id++}`, candleIdx: idx, ts0: candles[idx].start, price: entry, side: a.side,
      confidence: a.confidence, reasoning: a.reasons.join(" · "),
      agent: a.agent, status: success ? "verified" : "failed",
      sl: a.sl, tp: a.tp,
      outcome: a.side === "buy" ? movedPct : -movedPct, ts: nowTsHM(),
    });
    if (out.length >= 6) break;
  }
  // current live setup (if any) becomes the active signal
  const cur = analyzeMarket(candles);
  if (cur && cur.setup) {
    const last = candles.length - 1;
    out.push({
      id: `S-${id++}`, candleIdx: last, ts0: candles[last].start, price: candles[last].close,
      side: cur.side, confidence: cur.confidence, reasoning: cur.reasons.join(" · "),
      agent: cur.agent, status: "active", sl: cur.sl, tp: cur.tp, outcome: 0, ts: nowTsHM(),
    });
  }
  return out;
}

function nowTsHM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}:${String(d.getSeconds()).padStart(2,"0")}`;
}

/* ChartWithSignals moved to crypto-chart.jsx (loaded before this file). */

/* Auto-agent aggressiveness presets: how much of the budget it risks per trade,
 * the leverage ceiling, and how many positions it may hold at once. */
const AUTO_PRESETS = {
  safe:   { label: "Осторожно",  maxPos: 1, riskPct: 0.01, levCap: 5,  stopPct: 0.03 },
  normal: { label: "Норма",      maxPos: 2, riskPct: 0.02, levCap: 20, stopPct: 0.05 },
  bold:   { label: "Агрессивно", maxPos: 3, riskPct: 0.04, levCap: 20, stopPct: 0.10 },
};

/* ─────────────────────────────────────────────────────────
 * CryptoSignalsPanel — main component
 * ────────────────────────────────────────────────────────*/
function CryptoSignalsPanel({ lang }) {
  const [assetIdx, setAssetIdx] = useState(0);
  const [userAssets, setUserAssets] = useState(loadUserAssets);   // coins added from the scanner (linear perps)
  const ASSETS = useMemo(() => [...CRYPTO_ASSETS, ...userAssets], [userAssets]);
  const asset = ASSETS[Math.min(assetIdx, ASSETS.length - 1)] || ASSETS[0];
  const [tf, setTf] = useState("15m");
  const TFC = TF_MAP[tf] || TF_MAP["15m"];
  const [scanOpen, setScanOpen] = useState(false);

  function addAsset(coin) {
    if (ASSETS.some(a => a.bybit === coin.symbol)) return;
    const next = [...userAssets, { sym: `${coin.base}/USDT`, bybit: coin.symbol, name: coin.base, category: "linear", maxLev: coin.maxLev }];
    setUserAssets(next); saveUserAssets(next);
    setAssetIdx(CRYPTO_ASSETS.length + next.length - 1);   // jump to the new coin
    setScanOpen(false);
    window.__emitToast?.({ kind: "agent", title: `${coin.base}/USDT добавлена`, body: `Перпетуал Bybit · плечо до ${coin.maxLev || "—"}x`, meta: "торгуется в терминале" });
  }
  function removeAsset(bybit) {
    const next = userAssets.filter(a => a.bybit !== bybit);
    setUserAssets(next); saveUserAssets(next);
    setAssetIdx(0);
  }

  // ─── real market data from Bybit (REST history + live WebSocket) ───
  // 1-minute candles keep the chart lively; the agent signal/trade layer runs on top.
  // 15-minute candles: the timeframe where the TA engine shows a real positive
  // edge in backtest (5m was too noisy/negative, 1h too slow). EMA50/MACD/ATR.
  /* Candle source depends on the timeframe:
   *  · native  — Bybit serves it directly (1/3/5/15/30/60/240m, D)
   *  · agg     — rebuilt from a coarser native base (2/10/45m)
   *  · sec     — no history exists on Bybit; built live from the trade stream */
  const cat = asset.category || "spot";
  const restInterval = TFC.kind === "sec" ? "1" : TFC.base;
  const restLimit = TFC.kind === "agg" ? Math.min(1000, TFC.mult * 350) : 400;
  const market = useBybitMarket(asset.bybit, restInterval, restLimit, cat);
  const sec = useSecondCandles(asset.bybit, TFC.kind === "sec" ? TFC.seconds : 0, cat);

  const candles = useMemo(() => {
    if (TFC.kind === "sec") return sec.candles;
    if (TFC.kind === "agg") return aggregateCandles(market.candles, TFC.baseMs, TFC.mult);
    return market.candles;
  }, [TFC, market.candles, sec.candles]);
  const ticker = market.ticker;
  const status = TFC.kind === "sec" ? (sec.candles.length ? "live" : "connecting") : market.status;

  // zoom = how many candles fit on screen; pan = how far back from the live edge
  const [VIEW, setView] = useState(120);
  const [viewOffset, setViewOffset] = useState(0);
  useEffect(() => { setViewOffset(0); }, [assetIdx, tf]);
  const dragRef = useRef(null);                      // mouse-drag panning
  const maxOffset = Math.max(0, candles.length - VIEW);
  const off = Math.min(viewOffset, maxOffset);
  const zoomBy = (f) => setView(v => Math.max(30, Math.min(400, Math.round(v * f))));

  /* Forward projection — the system's OPINION on where price goes: TA conviction +
   * strategy target + trend strength, tilted by macro (Fear&Greed) and news
   * sentiment from the backend. Recomputed per candle → self-corrects. */
  const [projOn, setProjOn] = useState(true);
  const [projCtx, setProjCtx] = useState({});     // { fng, newsSent }
  const PROJ_STEPS = 20;

  useEffect(() => {
    let cancelled = false;
    const load = () => Promise.all([
      fetch("/api/market").then(r => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/news").then(r => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([mk, nw]) => {
      if (cancelled) return;
      setProjCtx({
        fng: mk && mk.ok && mk.fng ? mk.fng.value : null,
        newsSent: (nw && nw.ok && typeof newsSentiment === "function") ? newsSentiment(nw.items) : null,
      });
    });
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const lastStart = candles.length ? candles[candles.length - 1].start : 0;
  const projection = useMemo(() => {
    if (!projOn || candles.length < 60 || typeof projectPath !== "function") return null;
    return projectPath(candles, PROJ_STEPS, projCtx);
    // eslint-disable-next-line
  }, [projOn, candles.length, lastStart, projCtx]);
  const atLive = off === 0;
  const viewCandles = useMemo(
    () => (candles.length ? candles.slice(Math.max(0, candles.length - VIEW - off), candles.length - off) : []),
    [candles, off, VIEW]
  );
  const panBy = (n) => setViewOffset(o => Math.max(0, Math.min(maxOffset, o + n)));
  const { orderbook, trades } = useBybitL2(asset.bybit, 50, 40);
  const deriv = useBybitLinearStats(asset.bybit, 15000);
  const longShort = useBybitLongShort(asset.bybit, 60000);

  const [signals, setSignals] = useState([]);
  const [positions, setPositions] = useState([]);
  const [history, setHistory] = useState([]);
  const [pending, setPending] = useState([]); // resting limit orders waiting for their price
  const [form, setForm] = useState({ side: "buy", amount: 500, lev: 1, useSlTp: true, trail: false });
  // ─── autonomous agent (paper): trades the current best strategy, trails profit,
  // re-runs the lab to keep improving. Session-only (never auto-starts on reload).
  const [autoOn, setAutoOn] = useState(false);
  const [autoStrat, setAutoStrat] = useState(null);   // {genes, name, roi, win, …}
  const [autoLog, setAutoLog] = useState([]);          // recent action lines
  const [autoPreset, setAutoPreset] = useState("normal");   // aggressiveness
  const [autoScan, setAutoScan] = useState(true);           // hunt signals across assets
  const [autoTraining, setAutoTraining] = useState(null);   // sandbox-training progress text
  const [autoTesting, setAutoTesting] = useState(null);     // economics-replay progress text
  const autoRef = useRef({ lastEval: 0, lastPickTrades: 0, lastClosedAuto: 0, cooldownUntil: 0, lastScan: 0, scanning: false });
  const autoCfg = AUTO_PRESETS[autoPreset] || AUTO_PRESETS.normal;
  // Trading capital — owned by Settings; everything (margin, leverage) is derived from it.
  const [budget, setBudget] = useState(loadBudget);
  useEffect(() => {
    const sync = () => setBudget(loadBudget());
    window.addEventListener("vael:budget", sync);
    return () => window.removeEventListener("vael:budget", sync);
  }, []);
  const [hoveredSignalId, setHoveredSignalId] = useState(null);
  const [tab, setTab] = useState("open"); // 'open' | 'history' | 'signals'
  const [pendingFlash, setPendingFlash] = useState(null); // signal id of flash
  const [backtestOpen, setBacktestOpen] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const [mcOpen, setMcOpen] = useState(false);
  const [entryPlan, setEntryPlan] = useState(null); // proposed entry drawn on the chart
  const [customStrategies, setCustomStrategies] = useState([]);
  const seededRef = useRef(null);

  // Tracks which asset the persisted trades belong to — guards the persist effect
  // from writing stale (old-asset) trades under the new key during a switch.
  const hydratedKeyRef = useRef(null);

  // On asset switch: demo trades persist per-asset in localStorage, so a reload
  // (or coming back to the symbol) restores the open positions.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(`vael.trades.${asset.bybit}`) || "null");
      setPositions(Array.isArray(saved?.positions) ? saved.positions : []);
      setHistory(Array.isArray(saved?.history) ? saved.history : []);
      setPending(Array.isArray(saved?.pending) ? saved.pending : []);
    } catch (_) { setPositions([]); setHistory([]); setPending([]); }
    hydratedKeyRef.current = asset.bybit;
  }, [assetIdx]);

  // Signals are bound to the exact chart (symbol + timeframe): their candleIdx
  // stops mapping the moment either changes, so wipe them and re-seed. Without
  // this, switching timeframe left the previous chart's markers on screen.
  useEffect(() => {
    setSignals([]);
    seededRef.current = null;
  }, [assetIdx, tf]);

  // Persist demo trades (open positions + closed history) whenever they change,
  // keyed per asset. Reload / reopen restores exactly what was on screen.
  useEffect(() => {
    if (hydratedKeyRef.current !== asset.bybit) return; // don't write during a switch
    try { localStorage.setItem(`vael.trades.${asset.bybit}`, JSON.stringify({ positions, history, pending })); } catch (_) {}
  }, [positions, history, pending, asset.bybit]);

  // proposed entry is stale when the symbol or timeframe changes
  useEffect(() => { setEntryPlan(null); }, [assetIdx, tf]);

  /* ── Trade bridge: CoPilot (or any panel) asks for a demo trade via a
   * "vael:opentrade" event { symbol, side }. We switch to that symbol and open
   * the position as soon as its candles are in — so the button actually trades. */
  const pendingTradeRef = useRef(null);
  useEffect(() => {
    const handler = (e) => {
      const d = (e && e.detail) || {};
      const idx = ASSETS.findIndex(a => a.bybit === d.symbol);
      if (idx < 0) return;
      pendingTradeRef.current = { symbol: d.symbol, side: d.side };
      if (idx !== assetIdx) setAssetIdx(idx);
    };
    window.addEventListener("vael:opentrade", handler);
    return () => window.removeEventListener("vael:opentrade", handler);
  }, [ASSETS, assetIdx]);

  useEffect(() => {
    const p = pendingTradeRef.current;
    if (!p || p.symbol !== asset.bybit || !candles.length) return;
    pendingTradeRef.current = null;
    const price = candles[candles.length - 1].close;
    const a = typeof analyzeMarket === "function" ? analyzeMarket(candles) : null;
    const side = p.side || (a ? a.side : "buy");
    const useEngine = a && a.side === side;
    const newPos = makePosition({
      side, price,
      sl: useEngine ? a.sl : (side === "buy" ? price * 0.98 : price * 1.02),
      tp: useEngine ? a.tp : (side === "buy" ? price * 1.04 : price * 0.96),
      signalId: "copilot",
    });
    setPositions(prev => [...prev, newPos]);
    setTab("open");
    const dec = price < 10 ? 4 : 2;
    window.__emitToast?.({
      kind: "open",
      title: `${asset.sym} · сделка от CoPilot`,
      body: `${side === "buy" ? "ЛОНГ" : "ШОРТ"} · маржа ${newPos.margin}$ × ${newPos.lev}x = ${newPos.size}$ по ${price.toFixed(dec)}`,
      meta: `SL ${newPos.sl.toFixed(dec)} / TP ${newPos.tp.toFixed(dec)}`,
    });
  }, [candles, asset.bybit]);

  // "Найти точку входа" — read the live setup, draw entry/SL/TP + a 2%-risk size
  /* Builds the full plan: the PRICE to enter at (a support/resistance cluster,
   * not just "market now"), the stop beyond that structure, a target at the next
   * level, and the smallest safe leverage. See optimalEntry() in signals.jsx. */
  function findEntry() {
    if (!candles.length || typeof optimalEntry !== "function") return;
    const p = optimalEntry(candles, { budget, riskPct: 0.02, maxLev: asset.maxLev || 100, linear: deriv, longShort });
    if (!p) return;

    const a = analyzeMarket(candles);
    const strategy = (a && typeof matchStrategy === "function" && typeof taDmi === "function")
      ? matchStrategy({ a, dmi: taDmi(candles, 14), rsi: a.rsi, atrPct: a.atrPct })
      : null;

    const dec = p.price < 10 ? 4 : 2;
    setEntryPlan({ ...p, amount: p.margin, strategy });
    setForm(f => ({ ...f, side: p.side, amount: p.margin, lev: p.lev }));

    const isLimit = p.entryType === "limit";
    window.__emitToast?.({
      kind: p.side === "buy" ? "buy" : "sell",
      title: `${asset.sym} · ${isLimit ? "лимит: ждём откат" : "вход по рынку"}`,
      body: `${p.side === "buy" ? "ЛОНГ" : "ШОРТ"} @ ${p.entry.toFixed(dec)}${isLimit ? ` (сейчас ${p.price.toFixed(dec)})` : ""} · маржа $${p.margin} × ${p.lev}x = $${p.notional}`,
      meta: `R:R 1:${p.rr.toFixed(1)}${p.edgePct > 3 ? ` (+${p.edgePct.toFixed(0)}% к входу по рынку)` : ""} · прибыль ~$${p.profitAtTp.toFixed(0)} / риск $${p.lossAtSl.toFixed(0)}`,
    });
  }

  // flip the shown plan to the other direction (long ↔ short) that optimalEntry
  // also scored; rebuilds `.alt` so you can flip back.
  function flipPlan() {
    setEntryPlan(prev => {
      if (!prev || !prev.alt) return prev;
      const next = prev.alt;
      const back = { ...prev }; delete back.alt;
      setForm(f => ({ ...f, side: next.side, amount: next.margin, lev: next.lev }));
      return { ...next, alt: back, amount: next.margin, strategy: prev.strategy };
    });
  }

  // Seed the signal set once real candles for THIS chart (symbol + timeframe)
  // have loaded. Keyed on both — a timeframe switch must re-seed, not reuse.
  useEffect(() => {
    const key = `${asset.bybit}:${tf}`;
    if (candles.length >= 20 && seededRef.current !== key) {
      seededRef.current = key;
      setSignals(makeInitialSignals(candles));
    }
  }, [candles, asset.bybit, tf]);

  // active signal = the most recent 'active' one
  const activeSignal = useMemo(() => {
    return [...signals].reverse().find(s => s.status === "active");
  }, [signals]);

  // live read of the market from the TA engine — shown when no full setup fired
  const currentRead = useMemo(
    () => (candles.length >= 55 && typeof analyzeMarket === "function") ? analyzeMarket(candles) : null,
    [candles]
  );

  // verified accuracy stats
  const stats = useMemo(() => {
    const verified = signals.filter(s => s.status === "verified" || s.status === "failed");
    const wins = signals.filter(s => s.status === "verified").length;
    const total = verified.length;
    const accuracy = total > 0 ? (wins / total) * 100 : 0;
    const totalReturn = verified.reduce((s, x) => s + (x.outcome || 0), 0);
    return { wins, total, accuracy, totalReturn };
  }, [signals]);

  // ─── update positions & verify signals on every candles change ────
  useEffect(() => {
    if (!candles.length) return;
    const price = candles[candles.length - 1].close;

    // effective stop = the fixed stop, tightened by any trailing (never loosens):
    // long trails under the peak (hiWater·(1−trail)), short over the trough.
    const effStop = (p) => {
      if (!p.trail || p.trail <= 0) return p.sl;
      if (p.side === "buy") {
        const c = Math.max(p.hiWater != null ? p.hiWater : p.entry, price) * (1 - p.trail);
        return p.sl != null ? Math.max(p.sl, c) : c;
      }
      const c = Math.min(p.loWater != null ? p.loWater : p.entry, price) * (1 + p.trail);
      return p.sl != null ? Math.min(p.sl, c) : c;
    };

    // update PnL on positions + advance the trailing stop. P&L is on the notional
    // (size = margin × leverage); the % shown is ROE — return on the margin put up.
    setPositions(prev => prev.map(p => {
      const pnl = p.side === "buy"
        ? (price - p.entry) * (p.size / p.entry)
        : (p.entry - price) * (p.size / p.entry);
      const margin = p.margin != null ? p.margin : p.size;   // legacy positions: lev 1
      const pnlPct = margin ? (pnl / margin) * 100 : 0;
      const hiWater = p.trail ? Math.max(p.hiWater != null ? p.hiWater : p.entry, price) : p.hiWater;
      const loWater = p.trail ? Math.min(p.loWater != null ? p.loWater : p.entry, price) : p.loWater;
      const sl = effStop(p);
      return { ...p, currentPrice: price, pnl, pnlPct, sl, hiWater, loWater };
    }));

    // auto-close: liquidation and stop-loss only (stop includes the trail). Take-
    // profit does NOT auto-close — profit is left to run; the target stays on the
    // chart as a reference and the position closes by stop, liquidation, or manually.
    const toClose = [];
    positions.forEach(p => {
      const sl = effStop(p);
      const hitLiq = p.liq && (p.side === "buy" ? price <= p.liq : price >= p.liq);
      const hitSl = sl != null && (p.side === "buy" ? price <= sl : price >= sl);
      if (hitLiq) toClose.push({ id: p.id, exitPrice: p.liq, reason: "liq" });
      else if (hitSl) toClose.push({ id: p.id, exitPrice: price, reason: p.trail ? "trail" : "sl" });
    });
    if (toClose.length > 0) {
      toClose.forEach(({ id, exitPrice, reason }) => closePosition(id, exitPrice, reason));
    }

    // fill resting limit orders once the market TOUCHES their price — judged on the
    // candle's wick, not its close, so a limit fills the moment price traded through
    // it. A buy limit sits below and fills when the low reaches it (lo ≤ entry); a
    // sell limit sits above and fills when the high reaches it (hi ≥ entry).
    const bar = candles[candles.length - 1];
    const toFill = pending.filter(o => (o.side === "buy" ? bar.lo <= o.entry : bar.hi >= o.entry));
    if (toFill.length > 0) toFill.forEach(o => fillPending(o));
  // eslint-disable-next-line
  }, [candles]);

  function pushAutoLog(s) { setAutoLog(prev => [`${nowTsHM()} · ${s}`, ...prev].slice(0, 8)); }

  /* Sandbox: replay a long slice of history fast so the agent banks champions before
   * (or while) it trades live, instead of learning only at the pace of real signals. */
  function trainAgent() {
    if (autoTraining || typeof autoTrain !== "function") return;
    const syms = ASSETS.slice(0, 4).map(a => a.bybit);
    setAutoTraining("старт…");
    pushAutoLog(`🎓 обучение на истории · ${syms.length} актива × 3 окна…`);
    autoTrain(syms, restInterval, cat, { capital: budget, rounds: 3 },
      p => setAutoTraining(`${p.symbol.replace("USDT", "")} · окно ${p.round}/${p.rounds} · проверено ${p.tested}`))
      .then(r => {
        setAutoTraining(null);
        if (!r) { pushAutoLog("🎓 обучение не удалось"); return; }
        pushAutoLog(`🎓 готово · проверено ${r.tested} стратегий, прибыльных ${r.kept} · чемпионов ${r.champions}`);
        if (r.best[0]) pushAutoLog(`🏆 лучшая: «${r.best[0].name}» на ${r.best[0].symbol.replace("USDT", "")} (ROI ${r.best[0].roi.toFixed(1)}%)`);
        // re-test on unseen data before adopting anything it just learned
        pickStrategy("🧠 после обучения ·");
      })
      .catch(() => { setAutoTraining(null); pushAutoLog("🎓 обучение прервано"); });
  }

  /* Honest economics: replay the agent's whole loop over history with no lookahead and
   * report what its trades actually earn — after fees and slippage. This is the number
   * that matters; a strategy's backtest is not the agent's result. */
  function testEconomics() {
    if (autoTesting || typeof autoBacktestAgent !== "function") return;
    setAutoTesting("загружаю историю…");
    pushAutoLog("📊 тест экономики · воспроизвожу решения агента по истории…");
    bybitFetchKlines(asset.bybit, restInterval, 1000, cat)
      .then(c => {
        if (!c || c.length < 600) { setAutoTesting(null); pushAutoLog("📊 мало истории для теста"); return null; }
        return autoBacktestAgent(c, asset.bybit, { capital: budget, riskPct: autoCfg.riskPct, levCap: autoCfg.levCap },
          p => setAutoTesting(`бар ${p.bar}/${p.total} · сделок ${p.trades}`));
      })
      .then(r => {
        setAutoTesting(null);
        if (!r) return;
        if (r.trades === 0) {
          pushAutoLog(`📊 итог · сделок 0 — эдж не подтвердился ни разу (${r.picksWithEdge}/${r.picks} отборов). Ничего не потеряно`);
          return;
        }
        pushAutoLog(`📊 итог · ${r.trades} сд. · win ${r.winRate.toFixed(0)}% · ${r.net >= 0 ? "+" : "−"}$${Math.abs(r.net).toFixed(2)} (${r.roi >= 0 ? "+" : ""}${r.roi.toFixed(2)}%) · ср. сделка ${r.avg >= 0 ? "+" : "−"}$${Math.abs(r.avg).toFixed(2)}`);
        pushAutoLog(`📊 просадка ${r.maxDD.toFixed(1)}% · PF ${r.pf === Infinity ? "∞" : r.pf.toFixed(2)} · выходы: ${Object.entries(r.byReason).map(([k, v]) => `${k}×${v}`).join(", ") || "—"}`);
      })
      .catch(() => { setAutoTesting(null); pushAutoLog("📊 тест прерван"); });
  }

  /* Strategy selection needs a LONG history: runSimLab holds out a recent slice to
   * score candidates honestly, and on the chart's 200 bars that slice holds ~2 trades
   * — no honest gate can pass that. So pull a deeper series just for picking. Async;
   * the result lands in autoStrat a moment later. */
  function pickStrategy(tag) {
    if (typeof autoPickStrategy !== "function" || typeof bybitFetchKlines !== "function") return;
    const st = autoRef.current;
    if (st.picking) return;
    st.picking = true; st.lastSearch = Date.now();
    const cfg = { capital: budget, maxLev: asset.maxLev || 100, riskPct: autoCfg.riskPct, levCap: autoCfg.levCap };
    bybitFetchKlines(asset.bybit, restInterval, 1000, cat)
      .then(long => {
        st.picking = false;
        const strat = autoPickStrategy(long && long.length >= 300 ? long : candles, asset.bybit, cfg);
        if (strat) {
          setAutoStrat(strat);
          pushAutoLog(`${tag} «${strat.name}» · OOS ROI ${strat.roi.toFixed(1)}% · ${strat.trades} сд. · PF ${strat.pf === Infinity ? "∞" : strat.pf.toFixed(2)}`);
        } else {
          setAutoStrat(null);
          pushAutoLog(`${tag} эджа нет на невиданных данных — жду, не торгую (порог ≥${AUTO_GATE.minTrades} сд. · PF ≥${AUTO_GATE.minPf})`);
        }
      })
      .catch(() => { st.picking = false; });
  }

  function toggleAuto() {
    if (autoOn) { setAutoOn(false); pushAutoLog("⏸ агент остановлен"); return; }
    const st = autoRef.current;
    st.lastEval = 0; st.cooldownUntil = 0;
    st.lastPickTrades = history.filter(h => h.signalId === "auto").length;
    st.lastClosedAuto = st.lastPickTrades;
    st.startAutoNet = history.filter(h => h.signalId === "auto").reduce((s, h) => s + (h.pnl || 0), 0);   // drawdown baseline
    setAutoStrat(null);
    pushAutoLog("▶ старт · проверяю стратегии на невиданных данных…");
    pickStrategy("▶ старт ·");
    setAutoOn(true);
    setTab("open");
  }

  // ─── autonomous agent step (runs on each candle tick while ON) ───
  useEffect(() => {
    if (!autoOn || !candles.length || typeof autoEntry !== "function") return;
    const now = Date.now();
    const st = autoRef.current;
    const cfg = { capital: budget, maxLev: asset.maxLev || 100, riskPct: autoCfg.riskPct, levCap: autoCfg.levCap };

    // detect closed agent trades → log the result + a short cooldown before re-entry
    const closedAuto = history.filter(h => h.signalId === "auto").length;
    if (closedAuto > st.lastClosedAuto) {
      history.filter(h => h.signalId === "auto").slice(0, closedAuto - st.lastClosedAuto).forEach(h => {
        pushAutoLog(`${h.pnl >= 0 ? "✔ прибыль +" : "✖ убыток −"}$${Math.abs(h.pnl).toFixed(2)} · ${h.reason === "trail" ? "трейл" : h.reason === "sl" ? "стоп" : h.reason === "liq" ? "ликвидация" : h.reason}`);
      });
      st.lastClosedAuto = closedAuto;
      st.cooldownUntil = now + 15000;
    }

    // daily drawdown stop: if the agent's net (realized since start + open unrealised)
    // breaches the preset's loss limit, halt and flatten the agent's positions.
    const autoRealized = history.filter(h => h.signalId === "auto").reduce((s, h) => s + (h.pnl || 0), 0) - (st.startAutoNet || 0);
    const autoUnreal = positions.filter(p => p.signalId === "auto").reduce((s, p) => s + (p.pnl || 0), 0);
    const agentNet = autoRealized + autoUnreal;
    if (agentNet < -budget * autoCfg.stopPct) {
      pushAutoLog(`⛔ дневной стоп · просадка −$${Math.abs(agentNet).toFixed(2)} (лимит −${(autoCfg.stopPct * 100).toFixed(0)}%) · позиции закрыты`);
      positions.filter(p => p.signalId === "auto").forEach(p => closePosition(p.id, undefined, "daystop"));
      setAutoOn(false);
      return;
    }

    // learn: every 5 closed agent trades, re-test on unseen data and adopt the new best
    if (autoStrat && closedAuto - st.lastPickTrades >= 5) {
      st.lastPickTrades = closedAuto;
      pickStrategy("🧠 обучение ·");
    }

    // No validated edge → do NOT trade. Keep re-testing every 60s; the moment a
    // strategy clears the bar the agent starts working again.
    if (!autoStrat) {
      if (now - (st.lastSearch || 0) > 60000) pickStrategy("🔁 поиск ·");
      return;
    }

    // enter: up to maxPos agent positions, ≥6s between evals, cooldown after a close
    const openAuto = positions.filter(p => p.signalId === "auto").length;
    if (autoStrat && openAuto < autoCfg.maxPos && now - st.lastEval > 6000 && now > st.cooldownUntil) {
      st.lastEval = now;
      const plan = autoEntry(candles, autoStrat.genes, cfg);
      if (plan && plan.margin > 0) {
        const price = candles[candles.length - 1].close;
        const dec = price < 10 ? 4 : 2;
        const newPos = makePosition({
          side: plan.side, price,
          sl: plan.sl, tp: plan.tp, signalId: "auto",
          margin: plan.margin, lev: plan.lev,
          trail: plan.slPct,   // trail the stop so profit is locked as it runs
        });
        setPositions(prev => [...prev, newPos]);
        pushAutoLog(`${plan.side === "buy" ? "▲ ЛОНГ" : "▼ ШОРТ"} @ ${price.toFixed(dec)} · ${plan.lev}x · трейл ${(plan.slPct * 100).toFixed(1)}%`);
        window.__emitToast?.({ kind: "open", title: `${asset.sym} · агент открыл ${plan.side === "buy" ? "ЛОНГ" : "ШОРТ"}`, body: `«${autoStrat.name}» · маржа ${newPos.margin}$ × ${newPos.lev}x = ${newPos.size}$`, meta: `трейлинг-стоп ${(plan.slPct * 100).toFixed(1)}% · вход ${price.toFixed(dec)}` });
      } else if (autoScan && openAuto === 0 && !st.scanning && now - st.lastScan > 20000 && typeof autoScanAssets === "function") {
        // No setup here. A strategy is a rule set, so hunt the same rules across the
        // other watched assets; only while flat, so the position we open is always on
        // the asset the dashboard is showing (and therefore live-managed).
        st.scanning = true; st.lastScan = now;
        const others = ASSETS.filter((_, i) => i !== assetIdx).slice(0, 5).map(a => a.bybit);
        autoScanAssets(others, restInterval, 200, cat, autoStrat.genes, cfg)
          .then(hit => {
            st.scanning = false;
            if (!hit) return;
            const idx = ASSETS.findIndex(a => a.bybit === hit.symbol);
            if (idx < 0) return;
            pushAutoLog(`🔎 сигнал на ${ASSETS[idx].sym} — переключаюсь`);
            st.lastEval = 0;                 // let the entry fire as soon as its candles land
            setAssetIdx(idx);
          })
          .catch(() => { st.scanning = false; });
      }
    }
  // eslint-disable-next-line
  }, [candles, autoOn, autoPreset, autoScan]);

  // ─── new signals + verification (every ~5s) ────
  useInterval(() => {
    if (candles.length < 6) return;
    const lastPrice = candles[candles.length - 1].close;
    const firstOpen = candles[0].open;
    // verify active signals: if older than 8 candles, mark verified/failed
    // Verify active signals honestly: anchor the signal to its candle by TIMESTAMP
    // (the candle array shifts, so a stored index goes stale), and judge it on the
    // price exactly HORIZON candles later — not on the drifting "current" price.
    const HORIZON = 6;
    setSignals(prev => prev.map(s => {
      if (s.status !== "active") return s;
      const idx = s.ts0 != null ? candles.findIndex(c => c.start === s.ts0) : s.candleIdx;
      if (idx < 0) return s;                                   // candle scrolled out of the window
      if (candles.length - 1 - idx < HORIZON) return s;        // not enough time has passed yet
      const judgePrice = candles[idx + HORIZON].close;
      const moved = ((judgePrice - s.price) / s.price) * 100;
      const success = s.side === "buy" ? moved > 0 : moved < 0;
      return {
        ...s,
        status: success ? "verified" : "failed",
        outcome: s.side === "buy" ? moved : -moved,
      };
    }));

    // emit a new active signal ONLY when the TA engine finds a genuine setup.
    // Side effects are kept OUT of the setSignals updater (no setState-in-render).
    if (!signals.some(s => s.status === "active")) {
      const a = typeof analyzeMarket === "function" ? analyzeMarket(candles) : null;
      if (a && a.setup) {
        const newSig = {
          id: `S-${1845 + signals.length}`,
          candleIdx: candles.length - 1,
          ts0: candles[candles.length - 1].start,
          price: lastPrice,
          side: a.side,
          confidence: a.confidence,
          reasoning: a.reasons.join(" · "),
          agent: a.agent,
          status: "active",
          sl: a.sl, tp: a.tp,
          outcome: 0,
          ts: nowTsHM(),
        };
        setSignals(prev => (prev.some(s => s.status === "active") ? prev : [...prev.slice(-10), newSig]));
        setPendingFlash(newSig.id);
        setTimeout(() => setPendingFlash(null), 2000);
        window.__emitToast?.({
          kind: a.side === "buy" ? "buy" : "sell",
          title: `${asset.sym} · ${a.side === "buy" ? "ПОКУПКА" : "ПРОДАЖА"} @ ${lastPrice.toFixed(2)}`,
          body: newSig.reasoning,
          meta: `${newSig.agent} · conf ${newSig.confidence}% · RSI ${a.rsi.toFixed(0)}`,
        });
      }
    }
  }, 4800);

  // ─── trade actions ────
  function openFromSignal(signal) {
    if (!signal) return;
    const price = candles[candles.length - 1].close;
    const slPct = 0.018, tpPct = 0.035;
    const newPos = makePosition({
      side: signal.side, price,
      sl: signal.sl != null ? signal.sl : (signal.side === "buy" ? price * (1 - slPct) : price * (1 + slPct)),
      tp: signal.tp != null ? signal.tp : (signal.side === "buy" ? price * (1 + tpPct) : price * (1 - tpPct)),
      signalId: signal.id,
    });
    setPositions(prev => [...prev, newPos]);
    setTab("open");
    window.__emitToast?.({
      kind: "open",
      title: `${asset.sym} · ${signal.side === "buy" ? "ЛОНГ" : "ШОРТ"} по сигналу`,
      body: `Маржа ${newPos.margin}$ × ${newPos.lev}x = ${newPos.size}$ по ${price.toFixed(2)} · TP ${newPos.tp.toFixed(2)} / SL ${newPos.sl.toFixed(2)}`,
      meta: `${signal.id} · ${signal.agent}${newPos.liq ? ` · ликв. ${newPos.liq.toFixed(newPos.liq < 10 ? 4 : 2)}` : ""}`,
    });
  }

  /* A leveraged demo position: margin × leverage = notional size.
   * Liquidation ≈ entry ∓ entry/lev (simplified — no fees / maintenance margin). */
  function makePosition({ side, price, sl, tp, signalId, margin: marginArg, lev: levArg, trail }) {
    const margin = marginArg != null ? marginArg : form.amount;
    const lev = Math.max(1, +(levArg != null ? levArg : form.lev) || 1);
    const size = margin * lev;
    const liq = lev > 1
      ? (side === "buy" ? price * (1 - 1 / lev) : price * (1 + 1 / lev))
      : null;
    const entryFee = tradeFee(size);   // commission paid opening the position
    return {
      id: `P-${Date.now()}`, side, entry: price,
      margin, lev, size, liq, sl, tp, signalId,
      // trailing stop: `trail` = fraction the stop trails behind the peak price.
      // hiWater/loWater track the best price reached — the stop only ever tightens.
      trail: trail || 0, hiWater: price, loWater: price,
      feeRate: FEE_RATE, entryFee,
      sym: asset.sym, bybit: asset.bybit,
      openedAt: nowTsHM(), openedTs: Date.now(),   // real timestamp — portfolio needs it
      pnl: 0, pnlPct: 0, currentPrice: price,
    };
  }

  function openManual() {
    const price = candles[candles.length - 1].close;
    const slPct = 0.02, tpPct = 0.04;
    // trailing needs a stop to trail, so it also sets the initial stop even if the
    // fixed-bracket checkbox is off.
    const wantStop = form.useSlTp || form.trail;
    const newPos = makePosition({
      side: form.side, price,
      sl: wantStop ? (form.side === "buy" ? price * (1 - slPct) : price * (1 + slPct)) : null,
      tp: form.useSlTp ? (form.side === "buy" ? price * (1 + tpPct) : price * (1 - tpPct)) : null,
      signalId: null,
      trail: form.trail ? slPct : 0,
    });
    setPositions(prev => [...prev, newPos]);
    setTab("open");
    window.__emitToast?.({
      kind: "open",
      title: `${asset.sym} · ${form.side === "buy" ? "ЛОНГ" : "ШОРТ"} (вручную)`,
      body: `Маржа ${newPos.margin}$ × ${newPos.lev}x = позиция ${newPos.size}$ по ${price.toFixed(2)}`,
      meta: newPos.liq ? `ликвидация ~${newPos.liq.toFixed(newPos.liq < 10 ? 4 : 2)}` : "без плеча",
    });
  }

  /* Open EXACTLY the proposed plan — fill at the planned entry (a limit plan waits
   * for a pullback, so its entry ≠ current price), with the plan's own stop, target,
   * leverage and margin. Previously this reused openManual, which filled at the live
   * price with generic ±2/±4% brackets — so a limit plan opened "where price is now". */
  function openFromPlan(plan) {
    if (!plan) return;
    const entry = plan.entry;   // planned price, NOT candles[last].close
    const dec = entry < 10 ? 4 : 2;
    const isLimit = plan.entryType === "limit";
    // a limit whose price the market hasn't reached yet → REST the order and wait
    const reached = plan.side === "buy" ? plan.price <= entry : plan.price >= entry;
    if (isLimit && !reached) {
      const order = {
        id: `O-${Date.now()}`, side: plan.side, entry,
        sl: plan.sl, tp: plan.tp, lev: plan.lev, margin: plan.amount,
        trail: form.trail ? plan.slPct : 0,
        sym: asset.sym, bybit: asset.bybit, mktAtPlace: plan.price,
        placedAt: nowTsHM(), placedTs: Date.now(),
      };
      setPending(prev => [...prev, order]);
      setTab("pending");
      setEntryPlan(null);
      window.__emitToast?.({
        kind: plan.side === "buy" ? "buy" : "sell",
        title: `${asset.sym} · лимит-заявка выставлена`,
        body: `${plan.side === "buy" ? "ЛОНГ" : "ШОРТ"} ждёт цену ${entry.toFixed(dec)} (рынок ${plan.price.toFixed(dec)})`,
        meta: `маржа ${order.margin}$ × ${order.lev}x · TP ${plan.tp.toFixed(dec)} / SL ${plan.sl.toFixed(dec)}`,
      });
      return;
    }
    // market plan (or price already at/through the level) → fill now at the plan price
    const newPos = makePosition({
      side: plan.side, price: entry,
      sl: plan.sl, tp: plan.tp, signalId: null,
      margin: plan.amount, lev: plan.lev,
      trail: form.trail ? plan.slPct : 0,
    });
    setPositions(prev => [...prev, newPos]);
    setTab("open");
    setEntryPlan(null);
    window.__emitToast?.({
      kind: "open",
      title: `${asset.sym} · ${plan.side === "buy" ? "ЛОНГ" : "ШОРТ"} по плану`,
      body: `Маржа ${newPos.margin}$ × ${newPos.lev}x = ${newPos.size}$ @ ${entry.toFixed(dec)} · TP ${plan.tp.toFixed(dec)} / SL ${plan.sl.toFixed(dec)}`,
      meta: `по рынку${newPos.liq ? ` · ликв. ${newPos.liq.toFixed(newPos.liq < 10 ? 4 : 2)}` : ""}`,
    });
  }

  /* A resting limit order was touched — fill it into a real position at its limit
   * price with its own stop/target/leverage/margin. */
  function fillPending(order) {
    const newPos = makePosition({
      side: order.side, price: order.entry,
      sl: order.sl, tp: order.tp, signalId: "limit",
      margin: order.margin, lev: order.lev,
      trail: order.trail || 0,
    });
    setPending(prev => prev.filter(o => o.id !== order.id));
    setPositions(prev => [...prev, newPos]);
    const dec = order.entry < 10 ? 4 : 2;
    window.__emitToast?.({
      kind: "open",
      title: `${asset.sym} · заявка исполнена`,
      body: `${order.side === "buy" ? "ЛОНГ" : "ШОРТ"} @ ${order.entry.toFixed(dec)} · маржа ${newPos.margin}$ × ${newPos.lev}x = ${newPos.size}$`,
      meta: `TP ${order.tp.toFixed(dec)} / SL ${order.sl.toFixed(dec)}${newPos.liq ? ` · ликв. ${newPos.liq.toFixed(newPos.liq < 10 ? 4 : 2)}` : ""}`,
    });
  }

  function cancelPending(id) {
    const o = pending.find(x => x.id === id);
    setPending(prev => prev.filter(x => x.id !== id));
    if (o) window.__emitToast?.({
      kind: "close",
      title: `${asset.sym} · заявка отменена`,
      body: `${o.side === "buy" ? "ЛОНГ" : "ШОРТ"} лимит @ ${o.entry.toFixed(o.entry < 10 ? 4 : 2)} снят`,
      meta: "",
    });
  }

  function closePosition(id, exitPriceOverride, reason = "manual") {
    const closing = positions.find(p => p.id === id);
    if (!closing) return;
    const exitPrice = exitPriceOverride ?? candles[candles.length - 1].close;
    const grossPnl = closing.side === "buy"
      ? (exitPrice - closing.entry) * (closing.size / closing.entry)
      : (closing.entry - exitPrice) * (closing.size / closing.entry);
    // commission: entry fee (paid when opened) + exit fee on the notional at exit
    const feeRate = closing.feeRate != null ? closing.feeRate : FEE_RATE;
    const entryFee = closing.entryFee != null ? closing.entryFee : closing.size * feeRate;
    const exitFee = (closing.size * (exitPrice / closing.entry)) * feeRate;
    const fee = entryFee + exitFee;
    const pnl = grossPnl - fee;                          // realized P&L is net of commission
    const margin = closing.margin != null ? closing.margin : closing.size;
    const pnlPct = margin ? (pnl / margin) * 100 : 0;   // ROE on the margin, net of fees
    // pure state updates (functional — safe when several positions close in one tick)
    setPositions(prev => prev.filter(p => p.id !== id));
    setHistory(prev => [{
      ...closing, exitPrice, pnl, grossPnl, fee, pnlPct, reason,
      sym: closing.sym || asset.sym, bybit: closing.bybit || asset.bybit,
      closedAt: nowTsHM(), closedTs: Date.now(),   // real timestamp — portfolio stats need it
    }, ...prev].slice(0, 200));
    // side effect outside any updater
    const reasonLabel = reason === "tp" ? "Take Profit" : reason === "sl" ? "Stop Loss"
      : reason === "trail" ? "Трейлинг-стоп" : reason === "liq" ? "ЛИКВИДАЦИЯ"
      : reason === "daystop" ? "Дневной стоп" : "ручное закрытие";
    const dec = exitPrice < 10 ? 4 : 2;
    window.__emitToast?.({
      kind: reason === "tp" ? "win" : reason === "trail" ? (pnl >= 0 ? "win" : "loss")
        : (reason === "sl" || reason === "liq") ? "loss" : "close",
      title: `${asset.sym} · позиция закрыта · ${reasonLabel}`,
      body: `${closing.side === "buy" ? "ЛОНГ" : "ШОРТ"} ${closing.size}$${closing.lev > 1 ? ` (${closing.lev}x)` : ""} · вход ${closing.entry.toFixed(dec)} → выход ${exitPrice.toFixed(dec)}`,
      meta: `P&L: ${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}$ (чистыми) · комиссия −${fee.toFixed(2)}$ · ROE ${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(1)}%`,
    });
  }

  // ─── loading state while Bybit REST history is still in-flight ───
  if (!candles.length) {
    return <LoadingTerminal asset={asset} status={status} assetIdx={assetIdx} onAsset={setAssetIdx} assets={ASSETS} />;
  }

  const last = candles[candles.length - 1];
  const first = candles[0];
  const priceNow = ticker ? ticker.lastPrice : last.close;
  // 24h change from the live ticker (accurate rolling 24h); fall back to visible window
  const delta   = ticker ? (priceNow - ticker.prevPrice24h) : (last.close - first.open);
  const deltaPct = ticker ? (ticker.price24hPcnt * 100)      : ((last.close - first.open) / first.open * 100);

  return (
    <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
      <PanelHeader
        title={`ТРЕЙДИНГ-ТЕРМИНАЛ · ${asset.sym}`}
        meta={`TA-движок · 15m · ${asset.name}`}
        action={
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button onClick={() => setStudioOpen(true)} style={{
              fontFamily: "var(--font-mono)", fontSize: 9.5,
              padding: "1px 8px", borderRadius: 2,
              background: "var(--bg-2)", color: "var(--accent-2)",
              border: "1px solid oklch(0.72 0.18 var(--accent-h2) / 0.4)",
              cursor: "pointer", letterSpacing: 0.06, marginRight: 4,
            }}>◆ STUDIO</button>
            <button onClick={() => setBacktestOpen(true)} style={{
              fontFamily: "var(--font-mono)", fontSize: 9.5,
              padding: "1px 8px", borderRadius: 2,
              background: "var(--bg-2)", color: "var(--accent)",
              border: "1px solid oklch(0.78 0.16 var(--accent-h) / 0.4)",
              cursor: "pointer", letterSpacing: 0.06, marginRight: 4,
            }}>▸ BACKTEST</button>
            <button onClick={() => setMcOpen(true)} style={{
              fontFamily: "var(--font-mono)", fontSize: 9.5,
              padding: "1px 8px", borderRadius: 2,
              background: "var(--bg-2)", color: "var(--blue)",
              border: "1px solid oklch(0.7 0.15 240 / 0.45)",
              cursor: "pointer", letterSpacing: 0.06, marginRight: 6,
            }}>∿ MONTE CARLO</button>
            <button onClick={() => setScanOpen(true)} title="Найти монеты с плечом (перпетуалы, мемкоины)" style={{
              fontFamily: "var(--font-mono)", fontSize: 9.5,
              padding: "1px 8px", borderRadius: 2,
              background: "var(--bg-2)", color: "var(--accent-2)",
              border: "1px solid oklch(0.66 0.12 var(--accent-h2) / 0.5)",
              cursor: "pointer", letterSpacing: 0.06, marginRight: 6,
            }}>⌕ МОНЕТЫ</button>
            {ASSETS.map((a, i) => {
              const on = i === assetIdx, custom = i >= CRYPTO_ASSETS.length;
              return (
                <span key={a.bybit} style={{ display: "inline-flex", alignItems: "center" }}>
                  <button onClick={() => setAssetIdx(i)} title={custom ? `перпетуал · плечо до ${a.maxLev || "—"}x` : "спот"} style={{
                    fontFamily: "var(--font-mono)", fontSize: 9.5,
                    padding: "1px 6px", borderRadius: custom ? "2px 0 0 2px" : 2,
                    background: on ? "var(--accent-soft)" : "transparent",
                    color: on ? "var(--accent)" : "var(--text-dim)",
                    border: `1px solid ${on ? "oklch(0.78 0.16 var(--accent-h) / 0.4)" : "var(--line)"}`,
                    cursor: "pointer", letterSpacing: 0.06, textTransform: "uppercase",
                  }}>{a.sym.split("/")[0]}{custom && a.maxLev ? <span style={{ color: "var(--accent-2)", marginLeft: 3 }}>{a.maxLev}x</span> : null}</button>
                  {custom && (
                    <button onClick={() => removeAsset(a.bybit)} title="убрать монету" style={{
                      fontFamily: "var(--font-mono)", fontSize: 9, padding: "1px 3px",
                      borderRadius: "0 2px 2px 0", background: "transparent", color: "var(--text-dim)",
                      border: "1px solid var(--line)", borderLeft: "none", cursor: "pointer",
                    }}>✕</button>
                  )}
                </span>
              );
            })}
          </div>
        }
      />

      {/* PRICE BAR */}
      <div style={{
        display: "flex", alignItems: "baseline", gap: 12,
        padding: "8px 14px", borderBottom: "1px solid var(--line)",
        background: "var(--bg-2)",
      }}>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 500,
          color: "var(--text-bright)", letterSpacing: "-0.01em",
        }}>
          <TickerNumber value={priceNow} decimals={priceNow < 10 ? 3 : priceNow < 1000 ? 2 : 1} />
        </span>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 12,
          color: delta >= 0 ? "var(--green)" : "var(--red)",
        }}>
          {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(2)} ({Math.abs(deltaPct).toFixed(2)}%)
        </span>
        <span className="mono" style={{ fontSize: 10, color: "var(--text-dim)", marginLeft: 4 }}>24ч</span>
        <LiveTag status={status} />

        {/* portfolio summary */}
        {positions.length > 0 && <PortfolioSummary positions={positions} />}

        {/* mini stats */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 14, fontFamily: "var(--font-mono)", fontSize: 10 }}>
          <span><span style={{ color: "var(--text-dim)" }}>точность сигналов: </span>
            <span style={{ color: stats.accuracy >= 60 ? "var(--green)" : "var(--amber)" }}>
              {stats.accuracy.toFixed(0)}% <span style={{ color: "var(--text-dim)" }}>({stats.wins}/{stats.total})</span>
            </span>
          </span>
          <span><span style={{ color: "var(--text-dim)" }}>P&L истории: </span>
            <span style={{ color: stats.totalReturn >= 0 ? "var(--green)" : "var(--red)" }}>
              {stats.totalReturn >= 0 ? "+" : ""}{stats.totalReturn.toFixed(2)}%
            </span>
          </span>
        </div>
      </div>

      {/* TIMEFRAME + FIND-ENTRY BAR */}
      <div style={{
        display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap",
        padding: "5px 14px", borderBottom: "1px solid var(--line)", background: "var(--bg-1)",
      }}>
        <span className="mono" style={{ fontSize: 9, color: "var(--text-dim)", marginRight: 4, letterSpacing: 0.08 }}>ТФ</span>
        {TF_ORDER.map(id => {
          const o = TF_MAP[id], on = tf === id;
          const isSec = o.kind === "sec";
          return (
            <button key={id} onClick={() => setTf(id)}
              title={isSec ? "строится вживую из потока сделок · истории нет" : o.kind === "agg" ? `собран из ${o.base}м свечей` : "нативный таймфрейм Bybit"}
              style={{
                fontFamily: "var(--font-mono)", fontSize: 9.5, padding: "2px 7px", borderRadius: 2, cursor: "pointer",
                background: on ? "var(--accent-soft)" : "transparent",
                color: on ? "var(--accent)" : isSec ? "var(--text-dim)" : "var(--text-mid)",
                border: `1px solid ${on ? "oklch(0.74 0.075 var(--accent-h) / 0.45)" : "var(--line)"}`,
                letterSpacing: 0.04, opacity: isSec && !on ? 0.75 : 1,
              }}>{o.label}</button>
          );
        })}
        {TFC.kind === "sec" && (
          <span className="mono" style={{ fontSize: 9, marginLeft: 6, color: sec.source === "binance" ? "var(--blue)" : "var(--amber)" }}>
            {sec.source === "binance"
              ? `● секунды · Binance 1s (${candles.length} св) — у Bybit их нет`
              : `● строится вживую (${candles.length} св) · нет на Binance → без истории`}
          </span>
        )}
        <button onClick={() => setProjOn(p => !p)}
          title="Проекция: куда стремится цена (Monte-Carlo на реальной волатильности). Корректируется на каждой новой свече."
          style={{
            marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 9.5, padding: "2px 9px",
            borderRadius: 2, cursor: "pointer", marginRight: 6,
            background: projOn ? "oklch(0.7 0.06 240 / 0.16)" : "transparent",
            color: projOn ? "var(--blue)" : "var(--text-dim)",
            border: `1px solid ${projOn ? "var(--blue)" : "var(--line)"}`,
          }}>∿ ПРОГНОЗ</button>
        <button onClick={findEntry} style={{
          fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600,
          padding: "3px 12px", borderRadius: 3, cursor: "pointer",
          background: "oklch(0.78 0.16 var(--accent-h) / 0.14)", color: "var(--accent)",
          border: "1px solid oklch(0.78 0.16 var(--accent-h) / 0.5)", letterSpacing: 0.05,
        }}>⌖ НАЙТИ ТОЧКУ ВХОДА</button>
        {entryPlan && (
          <button onClick={() => setEntryPlan(null)} title="убрать план" style={{
            fontFamily: "var(--font-mono)", fontSize: 10, padding: "3px 8px", borderRadius: 3, cursor: "pointer",
            background: "transparent", color: "var(--text-dim)", border: "1px solid var(--line)",
          }}>✕</button>
        )}
        <button onClick={testEconomics} disabled={!!autoTesting}
          title="Честная экономика: воспроизводит решения агента по истории без заглядывания в будущее и показывает, что его сделки реально зарабатывают после комиссии и проскальзывания"
          style={{
            marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600,
            padding: "3px 10px", borderRadius: 3, cursor: autoTesting ? "default" : "pointer", letterSpacing: 0.05,
            background: "var(--bg-2)", color: autoTesting ? "var(--text-dim)" : "var(--amber)",
            border: `1px solid ${autoTesting ? "var(--line)" : "var(--amber)"}`, opacity: autoTesting ? 0.7 : 1,
          }}>{autoTesting ? `📊 ${autoTesting}` : "📊 ТЕСТ ЭКОНОМИКИ"}</button>
        <button onClick={trainAgent} disabled={!!autoTraining}
          title="Прогнать историю в песочнице: агент быстро тестирует и эволюционирует стратегии, накапливая чемпионов"
          style={{
            fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600,
            padding: "3px 10px", borderRadius: 3, cursor: autoTraining ? "default" : "pointer", letterSpacing: 0.05,
            background: "var(--bg-2)", color: autoTraining ? "var(--text-dim)" : "var(--accent-2)",
            border: `1px solid ${autoTraining ? "var(--line)" : "var(--accent-2)"}`, opacity: autoTraining ? 0.7 : 1,
          }}>{autoTraining ? `🎓 ${autoTraining}` : "🎓 ОБУЧИТЬ НА ИСТОРИИ"}</button>
        <button onClick={toggleAuto} title="Автоматическая торговля (симуляция): агент сам открывает сделки, трейлит прибыль и переобучается"
          style={{
            fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700,
            padding: "3px 12px", borderRadius: 3, cursor: "pointer", letterSpacing: 0.05,
            background: autoOn ? "oklch(0.7 0.14 150 / 0.16)" : "var(--bg-2)",
            color: autoOn ? "var(--green)" : "var(--accent-2)",
            border: `1px solid ${autoOn ? "var(--green)" : "var(--accent-2)"}`,
          }}>{autoOn ? "■ СТОП-АГЕНТ" : "▶ АВТО-ТОРГОВЛЯ"}</button>
      </div>

      {/* AGENT STATUS — visible while the autonomous agent is running */}
      {(autoOn || autoTraining || autoLog.length > 0) && (() => {
        const ah = history.filter(h => h.signalId === "auto");
        const wins = ah.filter(h => h.pnl > 0).length;
        const net = ah.reduce((s, h) => s + (h.pnl || 0), 0);
        const openA = positions.filter(p => p.signalId === "auto").length;
        return (
          <div className="panel" style={{ padding: "8px 12px", display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap", borderLeft: `3px solid ${autoOn ? "var(--green)" : autoTraining ? "var(--accent-2)" : "var(--line-bright)"}` }}>
            <div style={{ minWidth: 150 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.1 }}>
                <span style={{ color: autoOn ? "var(--green)" : autoTraining ? "var(--accent-2)" : "var(--text-dim)" }}>●</span> АГЕНТ · {autoOn ? "ТОРГУЕТ" : autoTraining ? "ОБУЧАЕТСЯ" : "ОСТАНОВЛЕН"} · СИМУЛЯЦИЯ
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: autoStrat ? "var(--text-bright)" : "var(--amber)", marginTop: 2 }}>
                {autoStrat ? autoStrat.name : autoOn ? "эджа нет — жду" : "стратегия не выбрана"}
              </div>
              {autoStrat
                ? <>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)" }} title="ROI на невиданной части свечей (walk-forward), а не на тех, где стратегию искали">
                      <span style={{ color: "var(--accent-2)" }}>OOS</span> ROI {autoStrat.roi.toFixed(1)}% · win {autoStrat.win.toFixed(0)}% · PF {autoStrat.pf === Infinity ? "∞" : autoStrat.pf.toFixed(2)} · {autoStrat.trades} сд.
                      {autoStrat.inRoi != null && <span style={{ opacity: 0.7 }}> · на обучении {autoStrat.inRoi.toFixed(1)}%</span>}
                    </div>
                    {autoStrat.regime && (
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, color: "var(--text-dim)" }} title="Режим рынка сейчас: направление · сила тренда · волатильность. Стратегия отсеивается, если в этом режиме она уже стабильно теряла.">
                        режим <span style={{ color: "var(--accent-2)" }}>{autoStrat.regime.key}</span>
                        {autoStrat.regime.seen
                          ? ` · здесь ${autoStrat.regime.trades} сд., ср. ${autoStrat.regime.avgR >= 0 ? "+" : ""}${autoStrat.regime.avgR}R`
                          : " · в этом режиме опыта нет"}
                      </div>
                    )}
                  </>
                : autoOn && <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)" }}>никто не прошёл walk-forward (≥{AUTO_GATE.minTrades} сд. · PF ≥{AUTO_GATE.minPf} на невиданных данных) · ищу каждые 60с</div>}
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, color: "var(--text-dim)", marginBottom: 3, textTransform: "uppercase" }}>агрессивность</div>
              <div style={{ display: "flex", gap: 3 }}>
                {Object.keys(AUTO_PRESETS).map(k => (
                  <button key={k} onClick={() => setAutoPreset(k)} style={{
                    fontFamily: "var(--font-mono)", fontSize: 9.5, padding: "2px 7px", borderRadius: 2, cursor: "pointer",
                    background: autoPreset === k ? "var(--accent-soft)" : "transparent",
                    color: autoPreset === k ? "var(--accent)" : "var(--text-dim)",
                    border: `1px solid ${autoPreset === k ? "oklch(0.78 0.16 var(--accent-h) / 0.4)" : "var(--line)"}`,
                  }}>{AUTO_PRESETS[k].label}</button>
                ))}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, color: "var(--text-dim)", marginTop: 3 }}>
                риск {(autoCfg.riskPct * 100).toFixed(0)}% · до {autoCfg.maxPos} позиц. · плечо ≤{autoCfg.levCap}x · дневной стоп −{(autoCfg.stopPct * 100).toFixed(0)}%
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4, cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-mid)" }}>
                <input type="checkbox" checked={autoScan} onChange={e => setAutoScan(e.target.checked)} style={{ accentColor: "var(--accent-2)" }} />
                искать сигнал по всем активам
              </label>
            </div>
            <div style={{ display: "flex", gap: 12, fontFamily: "var(--font-mono)", fontSize: 10.5 }}>
              <span>сделок <span style={{ color: "var(--text-bright)" }}>{ah.length}</span>{openA ? <span style={{ color: "var(--accent-2)" }}> (+{openA} откр.)</span> : null}</span>
              <span>winrate <span style={{ color: ah.length && wins / ah.length >= 0.5 ? "var(--green)" : "var(--amber)" }}>{ah.length ? (wins / ah.length * 100).toFixed(0) : "—"}%</span></span>
              <span>чистыми <span style={{ color: net >= 0 ? "var(--green)" : "var(--red)" }}>{net >= 0 ? "+" : "−"}${Math.abs(net).toFixed(2)}</span></span>
            </div>
            <div className="scroll" style={{ marginLeft: "auto", maxWidth: 380, maxHeight: 46, overflowY: "auto", fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", lineHeight: 1.5 }}>
              {autoLog.length ? autoLog.map((l, i) => <div key={i} style={{ color: i === 0 ? "var(--text-mid)" : "var(--text-dim)" }}>{l}</div>) : <div>ожидание сигнала…</div>}
            </div>
          </div>
        );
      })()}

      {/* MACRO FUSE — FOMC/CPI proximity (known-in-advance risk) */}
      {typeof MacroBanner === "function" && <MacroBanner />}

      {/* DERIVATIVES STATS BAR */}
      <DerivStatsBar stats={deriv} longShort={longShort} />

      {/* CHART + SIGNAL PANEL */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1.6fr 0.85fr", minHeight: 0, overflow: "hidden" }}>
        {/* Chart — drag to pan, wheel to zoom (TradingView-style) */}
        <div
          onWheel={e => { e.preventDefault(); zoomBy(e.deltaY > 0 ? 1.15 : 1 / 1.15); }}
          onMouseDown={e => { dragRef.current = { x: e.clientX, off, w: e.currentTarget.clientWidth }; }}
          onMouseMove={e => {
            const d = dragRef.current;
            if (!d) return;
            const pxPerCandle = Math.max(1, d.w / VIEW);
            const delta = Math.round((e.clientX - d.x) / pxPerCandle);   // drag right → go back in time
            setViewOffset(Math.max(0, Math.min(maxOffset, d.off + delta)));
          }}
          onMouseUp={() => { dragRef.current = null; }}
          onMouseLeave={() => { dragRef.current = null; }}
          style={{
            position: "relative", minHeight: 0, overflow: "hidden",
            cursor: dragRef.current ? "grabbing" : "grab", userSelect: "none",
          }}
        >
          <ChartWithSignals
            candles={viewCandles} signals={signals} positions={positions}
            hoveredSignalId={hoveredSignalId}
            onHoverSignal={setHoveredSignalId}
            livePrice={atLive ? priceNow : null} plan={atLive ? entryPlan : null}
            projection={atLive ? projection : null}
            width={700} height={320}
          />
          {/* pan controls */}
          <div style={{
            position: "absolute", left: 8, bottom: 8, display: "flex", gap: 4, alignItems: "center",
            background: "oklch(from var(--bg-0) l c h / 0.75)", padding: "3px 5px",
            border: "1px solid var(--line)", borderRadius: 4,
          }}>
            <PanBtn onClick={() => panBy(30)} disabled={off >= maxOffset} title="раньше">‹‹</PanBtn>
            <PanBtn onClick={() => panBy(6)} disabled={off >= maxOffset} title="назад">‹</PanBtn>
            <PanBtn onClick={() => panBy(-6)} disabled={atLive} title="вперёд">›</PanBtn>
            <PanBtn onClick={() => setViewOffset(0)} disabled={atLive} title="к текущему">››|</PanBtn>
            <span style={{ width: 1, height: 12, background: "var(--line)", margin: "0 2px" }} />
            <PanBtn onClick={() => zoomBy(1 / 1.3)} disabled={VIEW <= 30} title="приблизить (колесо вверх)">＋</PanBtn>
            <PanBtn onClick={() => zoomBy(1.3)} disabled={VIEW >= 400} title="отдалить (колесо вниз)">−</PanBtn>
            <span className="mono" style={{ fontSize: 9, color: "var(--text-dim)" }}>{VIEW}</span>
            <span className="mono" style={{ fontSize: 9, color: atLive ? "var(--green)" : "var(--amber)", marginLeft: 3 }}>
              {atLive ? "LIVE" : `−${off} св`}
            </span>
          </div>
        </div>

        {/* Right: active signal + entry plan + manual trade form flow together in one
            scrollable column — no split; scroll to reach the trade button when a tall
            entry plan is open. */}
        <div className="scroll" style={{ borderLeft: "1px solid var(--line)", display: "flex", flexDirection: "column", minHeight: 0, overflowY: "auto" }}>
          <ActiveSignalCard signal={activeSignal} read={currentRead} onOpen={openFromSignal} flash={pendingFlash === activeSignal?.id} />
          {entryPlan && <EntryPlanCard plan={entryPlan} sym={asset.sym} onApply={() => openFromPlan(entryPlan)} onClear={() => setEntryPlan(null)} onFlip={entryPlan.alt ? flipPlan : null} />}
          <DemoTradeForm form={form} setForm={setForm} onSubmit={openManual} price={priceNow} maxLev={asset.maxLev || 100}
            budget={budget} />
        </div>
      </div>

      {/* BOTTOM: positions / history tabs */}
      <div style={{
        borderTop: "1px solid var(--line)",
        display: "flex", flexDirection: "column",
        height: 132, flexShrink: 0,
      }}>
        <div style={{
          display: "flex", padding: "0 12px",
          borderBottom: "1px solid var(--line)",
          background: "var(--bg-2)",
        }}>
          <TabBtn active={tab === "open"} onClick={() => setTab("open")}
            label="Открытые" count={positions.length} />
          <TabBtn active={tab === "pending"} onClick={() => setTab("pending")}
            label="Заявки" count={pending.length} />
          <TabBtn active={tab === "history"} onClick={() => setTab("history")}
            label="История сделок" count={history.length} />
          <TabBtn active={tab === "signals"} onClick={() => setTab("signals")}
            label="Сигналы" count={signals.length} />
          <TabBtn active={tab === "book"} onClick={() => setTab("book")}
            label="Стакан" count={orderbook.asks.length} />
          <TabBtn active={tab === "trades"} onClick={() => setTab("trades")}
            label="Лента" count={trades.length} />
        </div>
        <div className="scroll" style={{ flex: 1, overflowY: "auto" }}>
          {tab === "open" && <OpenPositionsTable positions={positions} onClose={(id) => closePosition(id)} />}
          {tab === "pending" && <PendingOrdersTable pending={pending} price={priceNow} onCancel={cancelPending} />}
          {tab === "history" && <HistoryTable history={history} />}
          {tab === "signals" && <SignalsTable signals={[...signals].reverse()} hoveredId={hoveredSignalId} onHover={setHoveredSignalId} onTrade={openFromSignal} />}
          {tab === "book" && <OrderbookView book={orderbook} lastPrice={priceNow} />}
          {tab === "trades" && <TradesView trades={trades} />}
        </div>
      </div>

      <BacktestModal open={backtestOpen} onClose={() => setBacktestOpen(false)} asset={asset.sym} lang={lang} />
      <MonteCarloModal open={mcOpen} onClose={() => setMcOpen(false)} candles={candles} asset={asset} price={priceNow} />
      <CoinScannerModal open={scanOpen} onClose={() => setScanOpen(false)} onAdd={addAsset} existing={ASSETS.map(a => a.bybit)} />
      <StrategyStudio open={studioOpen} onClose={() => setStudioOpen(false)} asset={asset.sym} lang={lang}
        onSave={(s) => setCustomStrategies(prev => [...prev, s])} />
    </div>
  );
}

/* Modals, cards, the trade form and FEE_RATE/tradeFee moved to crypto-panels.jsx */

/* Tables (Open/Pending/History/Signals/Orderbook/Trades/Portfolio) moved to crypto-tables.jsx */

/* ─────────────────────────────────────────────────────────
 * MarketWatchlist — live multi-coin market table from Bybit
 * ────────────────────────────────────────────────────────*/
const WATCHLIST_COINS = [
  { sym: "BTC",  bybit: "BTCUSDT",  name: "Bitcoin" },
  { sym: "ETH",  bybit: "ETHUSDT",  name: "Ethereum" },
  { sym: "SOL",  bybit: "SOLUSDT",  name: "Solana" },
  { sym: "BNB",  bybit: "BNBUSDT",  name: "BNB" },
  { sym: "XRP",  bybit: "XRPUSDT",  name: "XRP" },
  { sym: "DOGE", bybit: "DOGEUSDT", name: "Dogecoin" },
  { sym: "AVAX", bybit: "AVAXUSDT", name: "Avalanche" },
  { sym: "LINK", bybit: "LINKUSDT", name: "Chainlink" },
  { sym: "TRX",  bybit: "TRXUSDT",  name: "TRON" },
  { sym: "ADA",  bybit: "ADAUSDT",  name: "Cardano" },
];

function fmtMktPrice(n) {
  if (n == null || isNaN(n)) return "—";
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n >= 1)    return n.toFixed(2);
  return n.toFixed(4);
}
function fmtMktUsd(n) {
  if (n == null || isNaN(n)) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function MarketWatchlist() {
  const symbols = useMemo(() => WATCHLIST_COINS.map(c => c.bybit), []);
  const { prices, status } = useBybitTickers(symbols, 6000);
  const [sparks, setSparks] = useState({}); // bybit symbol -> close[]

  // one-time 24h sparkline history (hourly candles)
  useEffect(() => {
    let cancelled = false;
    Promise.all(WATCHLIST_COINS.map(c =>
      bybitFetchKlines(c.bybit, "60", 24)
        .then(kl => [c.bybit, kl.map(k => k.close)])
        .catch(() => [c.bybit, null])
    )).then(res => {
      if (cancelled) return;
      const m = {};
      res.forEach(([s, arr]) => { if (arr && arr.length > 1) m[s] = arr; });
      setSparks(m);
    });
    return () => { cancelled = true; };
  }, []);

  const grid = "40px 1.3fr 1fr 90px 110px 1fr 1fr";
  return (
    <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
      <PanelHeader title="РЫНОК · WATCHLIST" meta={`${WATCHLIST_COINS.length} активов · spot`}
        action={<LiveTag status={status} />} />
      <div style={{
        display: "grid", gridTemplateColumns: grid,
        padding: "6px 14px", borderBottom: "1px solid var(--line)", background: "var(--bg-2)",
        fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)",
        letterSpacing: 0.08, textTransform: "uppercase",
      }}>
        <span>#</span><span>АКТИВ</span><span>ЦЕНА</span><span>24Ч %</span><span>ГРАФИК 24Ч</span><span>МАКС/МИН 24Ч</span><span>ОБЪЁМ 24Ч</span>
      </div>
      <div className="scroll" style={{ flex: 1, overflowY: "auto" }}>
        {WATCHLIST_COINS.map((c, i) => {
          const t = prices[c.bybit];
          const pct = t ? t.price24hPcnt * 100 : null;
          const up = pct != null && pct >= 0;
          const col = pct == null ? "var(--text-dim)" : up ? "var(--green)" : "var(--red)";
          const spark = sparks[c.bybit];
          return (
            <div key={c.bybit} style={{
              display: "grid", gridTemplateColumns: grid, alignItems: "center",
              padding: "7px 14px", borderBottom: "1px solid var(--line)",
              fontFamily: "var(--font-mono)", fontSize: 11,
              transition: "background 0.12s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--bg-2)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <span style={{ color: "var(--text-dim)" }}>{String(i + 1).padStart(2, "0")}</span>
              <span style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ color: "var(--text-bright)", fontWeight: 600 }}>{c.sym}<span style={{ color: "var(--text-dim)", fontWeight: 400 }}>/USDT</span></span>
                <span style={{ fontSize: 9, color: "var(--text-dim)" }}>{c.name}</span>
              </span>
              <span style={{ color: "var(--text-bright)" }}>{t ? fmtMktPrice(t.lastPrice) : "…"}</span>
              <span style={{ color: col, fontWeight: 600 }}>{pct == null ? "—" : `${up ? "▲" : "▼"} ${Math.abs(pct).toFixed(2)}%`}</span>
              <span style={{ display: "flex", alignItems: "center" }}>
                {spark ? <Sparkline data={spark} width={100} height={22} color={col} strokeW={1.2} />
                       : <span style={{ color: "var(--text-dim)", fontSize: 9 }}>загрузка…</span>}
              </span>
              <span style={{ color: "var(--text-mid)", fontSize: 10 }}>
                {t ? `${fmtMktPrice(t.highPrice24h)} / ${fmtMktPrice(t.lowPrice24h)}` : "—"}
              </span>
              <span style={{ color: "var(--text-mid)", fontSize: 10 }}>{t ? fmtMktUsd(t.turnover24h) : "—"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 * MarketHeatmap — 24h performance grid of top coins (live Bybit)
 * ────────────────────────────────────────────────────────*/
function MarketHeatmap() {
  const symbols = useMemo(() => WATCHLIST_COINS.map(c => c.bybit), []);
  const { prices } = useBybitTickers(symbols, 8000);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, padding: 10, width: "100%", alignContent: "center" }}>
      {WATCHLIST_COINS.map(c => {
        const t = prices[c.bybit];
        const pct = t ? t.price24hPcnt * 100 : null;
        const up = pct != null && pct >= 0;
        const intensity = pct == null ? 0 : Math.min(1, Math.abs(pct) / 8);
        const bg = pct == null ? "var(--bg-2)"
          : up ? `oklch(0.72 0.16 155 / ${0.12 + intensity * 0.55})`
               : `oklch(0.70 0.18 25 / ${0.12 + intensity * 0.55})`;
        return (
          <div key={c.bybit} title={c.name} style={{
            background: bg, border: "1px solid var(--line)", borderRadius: "var(--radius)",
            padding: "9px 6px", display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
          }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-bright)", fontWeight: 600 }}>{c.sym}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: pct == null ? "var(--text-dim)" : up ? "var(--green)" : "var(--red)" }}>
              {pct == null ? "…" : `${up ? "+" : ""}${pct.toFixed(1)}%`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

Object.assign(window, {
  CryptoSignalsPanel,
  CRYPTO_ASSETS,
  MarketWatchlist,
  WATCHLIST_COINS,
  MarketHeatmap,
  // FEE_RATE / tradeFee now live in crypto-panels.jsx and are exposed from there —
  // crypto-tables.jsx and the panel both read them off window.
});
