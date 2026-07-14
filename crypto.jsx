/* crypto.jsx — Crypto signals + demo trading panel for dashboard */

/* ─────────────────────────────────────────────────────────
 * Asset pool — symbols we track
 * ────────────────────────────────────────────────────────*/
const CRYPTO_ASSETS = [
  { sym: "ETH/USDT",  bybit: "ETHUSDT",  name: "Ethereum" },
  { sym: "BTC/USDT",  bybit: "BTCUSDT",  name: "Bitcoin" },
  { sym: "SOL/USDT",  bybit: "SOLUSDT",  name: "Solana"  },
  { sym: "AVAX/USDT", bybit: "AVAXUSDT", name: "Avalanche" },
];

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
  for (let idx = 55; idx <= candles.length - HORIZON - 1; idx += 2) {
    const a = analyzeMarket(candles.slice(0, idx + 1));
    if (!a || !a.setup) continue;
    const entry = candles[idx].close;
    const future = candles[idx + HORIZON].close;
    const movedPct = ((future - entry) / entry) * 100;
    const success = a.side === "buy" ? movedPct > 0 : movedPct < 0;
    out.push({
      id: `S-${id++}`, candleIdx: idx, price: entry, side: a.side,
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
    out.push({
      id: `S-${id++}`, candleIdx: candles.length - 2, price: candles[candles.length - 1].close,
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

/* ─────────────────────────────────────────────────────────
 * Chart with signal markers + position lines
 * ────────────────────────────────────────────────────────*/
function ChartWithSignals({ candles, signals, positions, hoveredSignalId, onHoverSignal, width = 700, height = 280 }) {
  const minV = Math.min(...candles.map(c => c.lo));
  const maxV = Math.max(...candles.map(c => c.hi));
  const padBottom = 50; // for volume row
  const padTop = 14;
  const padRight = 56; // for price axis
  const chartH = height - padBottom - padTop;
  const innerW = width - padRight;
  const range = (maxV - minV) * 1.04 || 1;
  const baseY = (maxV - minV) * 0.02 + minV;
  const stepX = innerW / Math.max(candles.length, 30);
  const candleW = Math.max(2, stepX * 0.65);
  const y = (v) => padTop + (1 - (v - baseY) / range) * chartH;
  const maxVol = Math.max(...candles.map(c => c.v), 1);

  const last = candles[candles.length - 1];
  const lastY = y(last.close);

  const priceLevels = [0.2, 0.4, 0.6, 0.8];

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none"
      style={{ display: "block" }}
      onMouseLeave={() => onHoverSignal?.(null)}
    >
      <defs>
        <linearGradient id="cws-vol-up" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="var(--green)" stopOpacity="0.05" />
          <stop offset="100%" stopColor="var(--green)" stopOpacity="0.4" />
        </linearGradient>
        <linearGradient id="cws-vol-dn" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="var(--red)" stopOpacity="0.05" />
          <stop offset="100%" stopColor="var(--red)" stopOpacity="0.4" />
        </linearGradient>
      </defs>

      {/* y grid */}
      {priceLevels.map((p, i) => {
        const yy = padTop + chartH * p;
        const v = baseY + range * (1 - p);
        return (
          <g key={i}>
            <line x1={0} y1={yy} x2={innerW} y2={yy}
              stroke="var(--line)" strokeWidth={0.5} strokeDasharray="2 4" />
            <text x={width - 6} y={yy + 3} textAnchor="end"
              fontFamily="var(--font-mono)" fontSize={9.5} fill="var(--text-dim)">
              {v < 10 ? v.toFixed(2) : v < 1000 ? v.toFixed(1) : v.toFixed(0)}
            </text>
          </g>
        );
      })}

      {/* candles */}
      {candles.map((c, i) => {
        const cx = i * stepX + stepX / 2;
        const up = c.close >= c.open;
        const color = up ? "var(--green)" : "var(--red)";
        const top = y(Math.max(c.open, c.close));
        const bot = y(Math.min(c.open, c.close));
        const volH = (c.v / maxVol) * 36;
        return (
          <g key={i}>
            {/* wick */}
            <line x1={cx} y1={y(c.hi)} x2={cx} y2={y(c.lo)} stroke={color} strokeWidth={0.8} />
            {/* body */}
            <rect x={cx - candleW / 2} y={top}
              width={candleW} height={Math.max(0.8, bot - top)}
              fill={up ? "transparent" : color} stroke={color} strokeWidth={1} />
            {/* volume bar */}
            <rect x={cx - candleW / 2} y={height - 4 - volH}
              width={candleW} height={volH}
              fill={`url(#cws-vol-${up ? "up" : "dn"})`} />
          </g>
        );
      })}

      {/* position lines (entry + TP/SL) */}
      {positions.map((p, i) => {
        const yEntry = y(p.entry);
        const yTp = p.tp ? y(p.tp) : null;
        const ySl = p.sl ? y(p.sl) : null;
        const c = p.side === "buy" ? "var(--green)" : "var(--red)";
        return (
          <g key={p.id}>
            <line x1={0} y1={yEntry} x2={innerW} y2={yEntry}
              stroke={c} strokeWidth={0.8} strokeDasharray="4 2" opacity={0.6} />
            <rect x={innerW - 70} y={yEntry - 8} width={66} height={14}
              fill="var(--bg-0)" stroke={c} strokeWidth={0.5} />
            <text x={innerW - 6} y={yEntry + 3} textAnchor="end"
              fontFamily="var(--font-mono)" fontSize={9.5} fontWeight={600} fill={c}>
              {p.side === "buy" ? "LONG" : "SHORT"} {p.entry.toFixed(2)}
            </text>
            {yTp && (
              <>
                <line x1={0} y1={yTp} x2={innerW} y2={yTp}
                  stroke="var(--green)" strokeWidth={0.4} strokeDasharray="1 3" opacity={0.5} />
                <text x={6} y={yTp - 3} fontFamily="var(--font-mono)" fontSize={8.5} fill="var(--green)">TP {p.tp.toFixed(2)}</text>
              </>
            )}
            {ySl && (
              <>
                <line x1={0} y1={ySl} x2={innerW} y2={ySl}
                  stroke="var(--red)" strokeWidth={0.4} strokeDasharray="1 3" opacity={0.5} />
                <text x={6} y={ySl - 3} fontFamily="var(--font-mono)" fontSize={8.5} fill="var(--red)">SL {p.sl.toFixed(2)}</text>
              </>
            )}
          </g>
        );
      })}

      {/* signal markers */}
      {signals.map(s => {
        if (s.candleIdx >= candles.length) return null;
        const cx = s.candleIdx * stepX + stepX / 2;
        const cy = y(s.price);
        const isBuy = s.side === "buy";
        const yMarker = isBuy ? cy + 14 : cy - 14;
        const color = s.status === "verified" ? "var(--green)" :
                      s.status === "failed"   ? "var(--red)"   :
                      isBuy ? "var(--green)" : "var(--red)";
        const hover = hoveredSignalId === s.id;
        const isActive = s.status === "active";
        const triPath = isBuy
          ? `M${cx},${yMarker-7} L${cx-5.5},${yMarker+2} L${cx+5.5},${yMarker+2} Z`
          : `M${cx},${yMarker+7} L${cx-5.5},${yMarker-2} L${cx+5.5},${yMarker-2} Z`;
        return (
          <g key={s.id} style={{ cursor: "pointer" }}
             onMouseEnter={() => onHoverSignal?.(s.id)}
             onMouseLeave={() => onHoverSignal?.(null)}>
            {/* connector */}
            <line x1={cx} y1={cy} x2={cx} y2={yMarker} stroke={color} strokeWidth={0.6} strokeDasharray="1 2" opacity={0.7} />
            {isActive && (
              <circle cx={cx} cy={yMarker} r={9} fill={color} opacity={0.18}>
                <animate attributeName="r" from="6" to="14" dur="1.6s" repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.4" to="0" dur="1.6s" repeatCount="indefinite" />
              </circle>
            )}
            <path d={triPath} fill={color} opacity={hover || isActive ? 1 : 0.85}
              stroke={hover ? "var(--text-bright)" : "none"} strokeWidth={0.6} />
            {hover && (
              <g>
                <rect x={cx - 84} y={isBuy ? yMarker + 8 : yMarker - 36}
                  width={168} height={28}
                  fill="var(--bg-1)" stroke={color} strokeWidth={0.6} rx={3} />
                <text x={cx} y={isBuy ? yMarker + 21 : yMarker - 23} textAnchor="middle"
                  fontFamily="var(--font-mono)" fontSize={9.5} fontWeight={600} fill={color}>
                  {isBuy ? "ПОКУПКА" : "ПРОДАЖА"} @ {s.price.toFixed(2)}
                </text>
                <text x={cx} y={isBuy ? yMarker + 32 : yMarker - 12} textAnchor="middle"
                  fontFamily="var(--font-mono)" fontSize={9} fill="var(--text-mid)">
                  {s.confidence}% · {s.status === "verified" ? `+${s.outcome.toFixed(2)}%` : s.status === "failed" ? `${s.outcome.toFixed(2)}%` : "активный"}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* current price line */}
      <line x1={0} y1={lastY} x2={innerW} y2={lastY}
        stroke="var(--accent)" strokeWidth={0.8} strokeDasharray="3 3" opacity={0.7} />
      <rect x={innerW} y={lastY - 9} width={padRight} height={18}
        fill="var(--accent)" />
      <text x={innerW + padRight / 2} y={lastY + 4} textAnchor="middle"
        fontFamily="var(--font-mono)" fontSize={10} fontWeight={600} fill="var(--bg-0)">
        {last.close < 10 ? last.close.toFixed(3) : last.close < 1000 ? last.close.toFixed(2) : last.close.toFixed(0)}
      </text>
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────
 * CryptoSignalsPanel — main component
 * ────────────────────────────────────────────────────────*/
function CryptoSignalsPanel({ lang }) {
  const [assetIdx, setAssetIdx] = useState(0);
  const asset = CRYPTO_ASSETS[assetIdx];

  // ─── real market data from Bybit (REST history + live WebSocket) ───
  // 1-minute candles keep the chart lively; the agent signal/trade layer runs on top.
  // 15-minute candles: the timeframe where the TA engine shows a real positive
  // edge in backtest (5m was too noisy/negative, 1h too slow). EMA50/MACD/ATR.
  const { candles, ticker, status } = useBybitMarket(asset.bybit, "15", 120);
  const { orderbook, trades } = useBybitL2(asset.bybit, 50, 40);
  const deriv = useBybitLinearStats(asset.bybit, 15000);
  const longShort = useBybitLongShort(asset.bybit, 60000);

  const [signals, setSignals] = useState([]);
  const [positions, setPositions] = useState([]);
  const [history, setHistory] = useState([]);
  const [form, setForm] = useState({ side: "buy", amount: 500, useSlTp: true });
  const [hoveredSignalId, setHoveredSignalId] = useState(null);
  const [tab, setTab] = useState("open"); // 'open' | 'history' | 'signals'
  const [pendingFlash, setPendingFlash] = useState(null); // signal id of flash
  const [backtestOpen, setBacktestOpen] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const [mcOpen, setMcOpen] = useState(false);
  const [customStrategies, setCustomStrategies] = useState([]);
  const seededRef = useRef(null);

  // Tracks which asset the persisted trades belong to — guards the persist effect
  // from writing stale (old-asset) trades under the new key during a switch.
  const hydratedKeyRef = useRef(null);

  // On asset switch: signals are ephemeral (re-seeded from candles), but demo
  // trades persist per-asset in localStorage so a page reload keeps open positions.
  useEffect(() => {
    setSignals([]);
    seededRef.current = null;
    try {
      const saved = JSON.parse(localStorage.getItem(`vael.trades.${asset.bybit}`) || "null");
      setPositions(Array.isArray(saved?.positions) ? saved.positions : []);
      setHistory(Array.isArray(saved?.history) ? saved.history : []);
    } catch (_) { setPositions([]); setHistory([]); }
    hydratedKeyRef.current = asset.bybit;
  }, [assetIdx]);

  // Persist demo trades (open positions + closed history) whenever they change,
  // keyed per asset. Reload / reopen restores exactly what was on screen.
  useEffect(() => {
    if (hydratedKeyRef.current !== asset.bybit) return; // don't write during a switch
    try { localStorage.setItem(`vael.trades.${asset.bybit}`, JSON.stringify({ positions, history })); } catch (_) {}
  }, [positions, history, asset.bybit]);

  // seed the initial signal set once real candles for this asset have loaded
  useEffect(() => {
    if (candles.length >= 20 && seededRef.current !== asset.bybit) {
      seededRef.current = asset.bybit;
      setSignals(makeInitialSignals(candles));
    }
  }, [candles, asset.bybit]);

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

    // update PnL on positions
    setPositions(prev => prev.map(p => {
      const pnl = p.side === "buy"
        ? (price - p.entry) * (p.size / p.entry)
        : (p.entry - price) * (p.size / p.entry);
      const pnlPct = p.side === "buy"
        ? (price - p.entry) / p.entry * 100
        : (p.entry - price) / p.entry * 100;
      return { ...p, currentPrice: price, pnl, pnlPct };
    }));

    // auto-close TP/SL
    const toClose = [];
    positions.forEach(p => {
      const hitTp = p.tp && (p.side === "buy" ? price >= p.tp : price <= p.tp);
      const hitSl = p.sl && (p.side === "buy" ? price <= p.sl : price >= p.sl);
      if (hitTp || hitSl) toClose.push({ id: p.id, exitPrice: price, reason: hitTp ? "tp" : "sl" });
    });
    if (toClose.length > 0) {
      toClose.forEach(({ id, exitPrice, reason }) => closePosition(id, exitPrice, reason));
    }
  // eslint-disable-next-line
  }, [candles]);

  // ─── new signals + verification (every ~5s) ────
  useInterval(() => {
    if (candles.length < 6) return;
    const lastPrice = candles[candles.length - 1].close;
    const firstOpen = candles[0].open;
    // verify active signals: if older than 8 candles, mark verified/failed
    setSignals(prev => prev.map(s => {
      if (s.status !== "active") return s;
      const agePrice = candles[Math.max(0, s.candleIdx)]?.close ?? s.price;
      // only verify if the active signal's candle is at least 6 candles back
      if (candles.length - s.candleIdx >= 6) {
        const moved = ((lastPrice - s.price) / s.price) * 100;
        const success = s.side === "buy" ? moved > 0 : moved < 0;
        return {
          ...s,
          status: success ? "verified" : "failed",
          outcome: s.side === "buy" ? moved : -moved,
        };
      }
      return s;
    }));

    // emit a new active signal ONLY when the TA engine finds a genuine setup.
    // Side effects are kept OUT of the setSignals updater (no setState-in-render).
    if (!signals.some(s => s.status === "active")) {
      const a = typeof analyzeMarket === "function" ? analyzeMarket(candles) : null;
      if (a && a.setup) {
        const newSig = {
          id: `S-${1845 + signals.length}`,
          candleIdx: candles.length - 1,
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
    const newPos = {
      id: `P-${Date.now()}`,
      side: signal.side,
      entry: price,
      size: form.amount,
      sl: signal.sl != null ? signal.sl : (signal.side === "buy" ? price * (1 - slPct) : price * (1 + slPct)),
      tp: signal.tp != null ? signal.tp : (signal.side === "buy" ? price * (1 + tpPct) : price * (1 - tpPct)),
      signalId: signal.id,
      openedAt: nowTsHM(),
      pnl: 0, pnlPct: 0, currentPrice: price,
    };
    setPositions(prev => [...prev, newPos]);
    setTab("open");
    window.__emitToast?.({
      kind: "open",
      title: `${asset.sym} · ${signal.side === "buy" ? "ЛОНГ" : "ШОРТ"} по сигналу`,
      body: `Открыта демо-позиция ${form.amount}$ по ${price.toFixed(2)} · TP ${newPos.tp.toFixed(2)} / SL ${newPos.sl.toFixed(2)}`,
      meta: `источник: ${signal.id} · ${signal.agent}`,
    });
  }

  function openManual() {
    const price = candles[candles.length - 1].close;
    const slPct = 0.02, tpPct = 0.04;
    const newPos = {
      id: `P-${Date.now()}`,
      side: form.side,
      entry: price,
      size: form.amount,
      sl: form.useSlTp ? (form.side === "buy" ? price * (1 - slPct) : price * (1 + slPct)) : null,
      tp: form.useSlTp ? (form.side === "buy" ? price * (1 + tpPct) : price * (1 - tpPct)) : null,
      signalId: null,
      openedAt: nowTsHM(),
      pnl: 0, pnlPct: 0, currentPrice: price,
    };
    setPositions(prev => [...prev, newPos]);
    setTab("open");
    window.__emitToast?.({
      kind: "open",
      title: `${asset.sym} · ${form.side === "buy" ? "ЛОНГ" : "ШОРТ"} (вручную)`,
      body: `Открыта демо-позиция ${form.amount}$ по ${price.toFixed(2)}`,
    });
  }

  function closePosition(id, exitPriceOverride, reason = "manual") {
    const closing = positions.find(p => p.id === id);
    if (!closing) return;
    const exitPrice = exitPriceOverride ?? candles[candles.length - 1].close;
    const pnl = closing.side === "buy"
      ? (exitPrice - closing.entry) * (closing.size / closing.entry)
      : (closing.entry - exitPrice) * (closing.size / closing.entry);
    const pnlPct = closing.side === "buy"
      ? (exitPrice - closing.entry) / closing.entry * 100
      : (closing.entry - exitPrice) / closing.entry * 100;
    // pure state updates (functional — safe when several positions close in one tick)
    setPositions(prev => prev.filter(p => p.id !== id));
    setHistory(prev => [{ ...closing, exitPrice, pnl, pnlPct, closedAt: nowTsHM(), reason }, ...prev].slice(0, 24));
    // side effect outside any updater
    const reasonLabel = reason === "tp" ? "Take Profit" : reason === "sl" ? "Stop Loss" : "ручное закрытие";
    window.__emitToast?.({
      kind: reason === "tp" ? "win" : reason === "sl" ? "loss" : "close",
      title: `${asset.sym} · позиция закрыта · ${reasonLabel}`,
      body: `${closing.side === "buy" ? "ЛОНГ" : "ШОРТ"} ${closing.size}$ · вход ${closing.entry.toFixed(2)} → выход ${exitPrice.toFixed(2)}`,
      meta: `P&L: ${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}$ (${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%)`,
    });
  }

  // ─── loading state while Bybit REST history is still in-flight ───
  if (!candles.length) {
    return <LoadingTerminal asset={asset} status={status} assetIdx={assetIdx} onAsset={setAssetIdx} />;
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
          <div style={{ display: "flex", gap: 4 }}>
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
            {CRYPTO_ASSETS.map((a, i) => (
              <button key={a.sym} onClick={() => setAssetIdx(i)} style={{
                fontFamily: "var(--font-mono)", fontSize: 9.5,
                padding: "1px 6px", borderRadius: 2,
                background: i === assetIdx ? "var(--accent-soft)" : "transparent",
                color: i === assetIdx ? "var(--accent)" : "var(--text-dim)",
                border: `1px solid ${i === assetIdx ? "oklch(0.78 0.16 var(--accent-h) / 0.4)" : "var(--line)"}`,
                cursor: "pointer", letterSpacing: 0.06, textTransform: "uppercase",
              }}>{a.sym.split("/")[0]}</button>
            ))}
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

      {/* DERIVATIVES STATS BAR */}
      <DerivStatsBar stats={deriv} longShort={longShort} />

      {/* CHART + SIGNAL PANEL */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1.6fr 0.85fr", minHeight: 0, overflow: "hidden" }}>
        {/* Chart */}
        <div style={{ position: "relative", minHeight: 0, overflow: "hidden" }}>
          <ChartWithSignals
            candles={candles} signals={signals} positions={positions}
            hoveredSignalId={hoveredSignalId}
            onHoverSignal={setHoveredSignalId}
            width={700} height={320}
          />
        </div>

        {/* Right: signal + trade form */}
        <div style={{ borderLeft: "1px solid var(--line)", display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
          <ActiveSignalCard signal={activeSignal} read={currentRead} onOpen={openFromSignal} flash={pendingFlash === activeSignal?.id} />
          <DemoTradeForm form={form} setForm={setForm} onSubmit={openManual} price={priceNow} />
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
          {tab === "history" && <HistoryTable history={history} />}
          {tab === "signals" && <SignalsTable signals={[...signals].reverse()} hoveredId={hoveredSignalId} onHover={setHoveredSignalId} onTrade={openFromSignal} />}
          {tab === "book" && <OrderbookView book={orderbook} lastPrice={priceNow} />}
          {tab === "trades" && <TradesView trades={trades} />}
        </div>
      </div>

      <BacktestModal open={backtestOpen} onClose={() => setBacktestOpen(false)} asset={asset.sym} lang={lang} />
      <MonteCarloModal open={mcOpen} onClose={() => setMcOpen(false)} candles={candles} asset={asset} price={priceNow} />
      <StrategyStudio open={studioOpen} onClose={() => setStudioOpen(false)} asset={asset.sym} lang={lang}
        onSave={(s) => setCustomStrategies(prev => [...prev, s])} />
    </div>
  );
}

/* ─── Monte Carlo forecast modal — probability cone from real Bybit volatility ─── */
function MonteCarloModal({ open, onClose, candles, asset, price }) {
  const [horizon, setHorizon] = useState(24);
  const [runId, setRunId] = useState(0);
  const [fc, setFc] = useState(null);

  useEffect(() => {
    if (!open) return;
    if (typeof monteCarloForecast !== "function" || !candles || candles.length < 20) { setFc(null); return; }
    setFc(monteCarloForecast(candles, horizon, 400));
    // deliberately not depending on `candles` ticks — a stable cone the user re-runs
    // eslint-disable-next-line
  }, [open, horizon, runId]);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;
  const dec = price < 10 ? 3 : price < 1000 ? 2 : 1;
  const upColor = fc && fc.probUp >= 0.5 ? "var(--green)" : "var(--red)";

  // SVG cone
  const W = 660, H = 300, padL = 8, padR = 8, padT = 12, padB = 22;
  let chart = null;
  if (fc) {
    const hist = candles.slice(-20).map(c => c.close);
    const cone = fc.steps;
    const lows = [...hist, ...cone.map(s => s.p5), fc.S0];
    const highs = [...hist, ...cone.map(s => s.p95), fc.S0];
    const lo = Math.min(...lows), hi = Math.max(...highs), range = (hi - lo) || 1;
    const totalN = hist.length + cone.length;
    const x = i => padL + (i / (totalN - 1)) * (W - padL - padR);
    const y = v => padT + (1 - (v - lo) / range) * (H - padT - padB);
    const ci = t => hist.length + t;               // x-index of cone step t
    const nowX = x(hist.length - 1), nowY = y(fc.S0);

    const band = (loKey, hiKey) => {
      const top = cone.map((s, t) => `${x(ci(t))},${y(s[hiKey])}`);
      const bot = cone.map((s, t) => `${x(ci(t))},${y(s[loKey])}`).reverse();
      return `M${nowX},${nowY} L${top.join(" L")} L${bot.join(" L")} L${nowX},${nowY} Z`;
    };
    const medianPath = `M${nowX},${nowY} ` + cone.map((s, t) => `L${x(ci(t))},${y(s.p50)}`).join(" ");
    const histPath = hist.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");

    chart = (
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: "block", background: "var(--bg-1)", borderRadius: 4 }}>
        <path d={band("p5", "p95")} fill="var(--blue)" opacity={0.1} stroke="none" />
        <path d={band("p25", "p75")} fill="var(--blue)" opacity={0.18} stroke="none" />
        <path d={medianPath} fill="none" stroke="var(--blue)" strokeWidth={1.4} />
        <path d={histPath} fill="none" stroke="var(--text-mid)" strokeWidth={1.2} />
        <line x1={nowX} y1={padT} x2={nowX} y2={H - padB} stroke="var(--line-bright)" strokeWidth={0.7} strokeDasharray="3 3" />
        <circle cx={nowX} cy={nowY} r={2.5} fill="var(--text-bright)" />
      </svg>
    );
  }

  const rangeLoPct = fc ? (fc.terminal.p5 - fc.S0) / fc.S0 * 100 : 0;
  const rangeHiPct = fc ? (fc.terminal.p95 - fc.S0) / fc.S0 * 100 : 0;

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "oklch(0 0 0 / 0.6)",
      backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", zIndex: 9988,
      display: "flex", alignItems: "center", justifyContent: "center", animation: "cpFade 0.18s ease-out",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "min(760px, 95vw)", background: "var(--bg-1)",
        border: "1px solid var(--line-bright)", borderRadius: 8,
        boxShadow: "0 24px 60px -12px oklch(0 0 0 / 0.7), var(--glow-strong)",
        display: "flex", flexDirection: "column", overflow: "hidden", animation: "cpScale 0.2s cubic-bezier(0.16,1,0.3,1)",
      }}>
        <header style={{ padding: "12px 18px", borderBottom: "1px solid var(--line)", background: "var(--bg-2)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ color: "var(--blue)", fontFamily: "var(--font-mono)", fontSize: 16 }}>∿</div>
          <div>
            <div style={{ fontSize: 12, color: "var(--text-bright)", fontWeight: 500 }}>MONTE CARLO ПРОГНОЗ · {asset.sym}</div>
            <div className="mono" style={{ fontSize: 9.5, color: "var(--text-dim)" }}>{fc ? fc.sims : "…"} симуляций · GBM на волатильности Bybit 15m</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 4, alignItems: "center" }}>
            {[12, 24, 48].map(h => (
              <button key={h} onClick={() => setHorizon(h)} style={{
                fontFamily: "var(--font-mono)", fontSize: 10, padding: "3px 9px", borderRadius: 3, cursor: "pointer",
                background: horizon === h ? "oklch(0.7 0.15 240 / 0.15)" : "var(--bg-0)",
                color: horizon === h ? "var(--blue)" : "var(--text-dim)",
                border: `1px solid ${horizon === h ? "oklch(0.7 0.15 240 / 0.5)" : "var(--line)"}`,
              }}>{h}с</button>
            ))}
            <button onClick={() => setRunId(r => r + 1)} title="Пересчитать" style={{
              fontFamily: "var(--font-mono)", fontSize: 10, padding: "3px 9px", borderRadius: 3, cursor: "pointer",
              background: "var(--bg-0)", color: "var(--accent)", border: "1px solid oklch(0.78 0.16 var(--accent-h) / 0.4)", marginLeft: 4,
            }}>↻ пересчёт</button>
            <button onClick={onClose} style={{ marginLeft: 6, background: "transparent", border: "none", color: "var(--text-dim)", fontSize: 16, cursor: "pointer" }}>✕</button>
          </div>
        </header>

        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          {chart || <div style={{ height: 300, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 11 }}>недостаточно свечей для симуляции…</div>}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
            <McStat label={`P(рост) · ${fc ? fc.horizon : horizon}св`} v={fc ? `${(fc.probUp * 100).toFixed(0)}%` : "…"} c={upColor} />
            <McStat label="МЕДИАНА · ожид." v={fc ? `${fc.expectedPct >= 0 ? "+" : ""}${fc.expectedPct.toFixed(2)}%` : "…"} c={fc && fc.expectedPct >= 0 ? "var(--green)" : "var(--red)"} />
            <McStat label="ДИАПАЗОН 90%" v={fc ? `${rangeLoPct.toFixed(1)} … +${rangeHiPct.toFixed(1)}%` : "…"} c="var(--text-bright)" />
            <McStat label="σ · на свечу" v={fc ? `${fc.sigmaPct.toFixed(2)}%` : "…"} c="var(--accent-2)" />
          </div>

          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--text-dim)" }}>
            <span><span style={{ color: "var(--blue)" }}>▬</span> медиана (p50)</span>
            <span><span style={{ color: "var(--blue)", opacity: 0.5 }}>▬</span> 50% исходов (p25–p75)</span>
            <span><span style={{ color: "var(--blue)", opacity: 0.3 }}>▬</span> 90% исходов (p5–p95)</span>
            <span><span style={{ color: "var(--text-mid)" }}>▬</span> история (20 свечей)</span>
          </div>

          <div style={{ background: "var(--bg-2)", border: "1px dashed var(--line-bright)", borderRadius: 3, padding: "8px 10px", fontSize: 10.5, color: "var(--text-mid)", lineHeight: 1.5 }}>
            <span className="accent">↳ </span>Это вероятностная модель (геом. броуновское движение на реальном распределении доходностей Bybit), а <b>не</b> предсказание. Показывает диапазон исходов, который подразумевает недавняя волатильность. Не является инвестиционной рекомендацией.
          </div>
        </div>
      </div>
    </div>
  );
}

function McStat({ label, v, c }) {
  return (
    <div style={{ background: "var(--bg-0)", border: "1px solid var(--line)", borderRadius: 3, padding: "6px 9px" }}>
      <div style={{ fontSize: 8.5, color: "var(--text-dim)", letterSpacing: 0.1, fontWeight: 600, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: c, marginTop: 2 }}>{v}</div>
    </div>
  );
}

/* ─── Subcomponents ─── */

/* Live connection indicator — reflects the Bybit WebSocket/REST state */
function LiveTag({ status }) {
  const cfg = {
    live:       { color: "var(--blue)", label: "LIVE",  pulse: true  },
    rest:       { color: "var(--amber)", label: "REST",  pulse: false },
    connecting: { color: "var(--text-dim)", label: "СОЕД…", pulse: false },
    error:      { color: "var(--red)",   label: "ОФФЛАЙН", pulse: false },
  }[status] || { color: "var(--text-dim)", label: "—", pulse: false };
  return (
    <span title="Источник: Bybit · публичный API" style={{
      display: "inline-flex", alignItems: "center", gap: 5, marginLeft: 4,
      fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600, letterSpacing: 0.08,
      color: cfg.color, padding: "1px 6px", borderRadius: 3,
      border: `1px solid ${cfg.color}`, textTransform: "uppercase",
    }}>
      {cfg.pulse ? <PulseDot size={5} color={cfg.color} /> : <span className="dot" style={{ background: cfg.color }} />}
      {cfg.label}
      <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>· BYBIT</span>
    </span>
  );
}

/* Shown while the initial REST history request for a symbol is loading */
function LoadingTerminal({ asset, status, assetIdx, onAsset }) {
  const failed = status === "error";
  return (
    <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
      <PanelHeader
        title={`ТРЕЙДИНГ-ТЕРМИНАЛ · ${asset.sym}`}
        meta={`данные Bybit · ${asset.name}`}
        action={
          <div style={{ display: "flex", gap: 4 }}>
            {CRYPTO_ASSETS.map((a, i) => (
              <button key={a.sym} onClick={() => onAsset(i)} style={{
                fontFamily: "var(--font-mono)", fontSize: 9.5, padding: "1px 6px", borderRadius: 2,
                background: i === assetIdx ? "var(--accent-soft)" : "transparent",
                color: i === assetIdx ? "var(--accent)" : "var(--text-dim)",
                border: `1px solid ${i === assetIdx ? "oklch(0.78 0.16 var(--accent-h) / 0.4)" : "var(--line)"}`,
                cursor: "pointer", letterSpacing: 0.06, textTransform: "uppercase",
              }}>{a.sym.split("/")[0]}</button>
            ))}
          </div>
        }
      />
      <div style={{
        flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 12, color: failed ? "var(--red)" : "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 12,
      }}>
        {failed ? (
          <>
            <div style={{ fontSize: 22 }}>⚠</div>
            <div>Не удалось загрузить рынок {asset.bybit} с Bybit</div>
            <div style={{ fontSize: 10, color: "var(--text-dim)", maxWidth: 320, textAlign: "center", lineHeight: 1.5 }}>
              Проверьте интернет-соединение. Если открыто через <span className="mono">file://</span> — запустите локальный сервер (см. README). Идёт автоповтор…
            </div>
          </>
        ) : (
          <>
            <Waveform width={120} height={20} color="var(--accent)" bars={24} />
            <div>Загрузка рыночных данных {asset.bybit}…</div>
            <div style={{ fontSize: 10, color: "var(--text-dim)" }}>Bybit · публичный API · REST + WebSocket</div>
          </>
        )}
      </div>
    </div>
  );
}

/* Live countdown to the next funding settlement */
function FundingCountdown({ target }) {
  const [now, setNow] = useState(() => Date.now());
  useInterval(() => setNow(Date.now()), 1000);
  if (!target) return <span>—</span>;
  let ms = target - now;
  if (ms < 0) ms = 0;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return <span>{h > 0 ? `${h}ч ` : ""}{String(m).padStart(2, "0")}м {String(s).padStart(2, "0")}с</span>;
}

/* Long/Short account ratio — split bar + percentages */
function LongShortBar({ data }) {
  const buy = data ? data.buyRatio * 100 : null;
  const sell = data ? data.sellRatio * 100 : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 8.5, color: "var(--text-dim)", letterSpacing: 0.1, textTransform: "uppercase" }}>Long / Short</span>
      {data ? (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 84, height: 8, borderRadius: 2, overflow: "hidden", background: "var(--red)", display: "flex" }}>
            <div style={{ width: `${buy}%`, background: "var(--green)", height: "100%" }} />
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>
            <span style={{ color: "var(--green)" }}>{buy.toFixed(1)}%</span>
            <span style={{ color: "var(--text-dim)" }}> / </span>
            <span style={{ color: "var(--red)" }}>{sell.toFixed(1)}%</span>
          </span>
        </div>
      ) : <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>…</span>}
    </div>
  );
}

/* Perp derivatives stats strip: funding · open interest · 24h turnover · next funding · long/short */
function DerivStatsBar({ stats, longShort }) {
  const Item = ({ label, children, color }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <span style={{ fontSize: 8.5, color: "var(--text-dim)", letterSpacing: 0.1, textTransform: "uppercase" }}>{label}</span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: color || "var(--text-bright)" }}>{children}</span>
    </div>
  );
  const fr = stats ? stats.fundingRate * 100 : null;
  const frColor = fr == null ? "var(--text-dim)" : fr >= 0 ? "var(--green)" : "var(--red)";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 22,
      padding: "5px 14px", borderBottom: "1px solid var(--line)", background: "var(--bg-1)",
    }}>
      <span style={{ fontSize: 8.5, color: "var(--accent)", letterSpacing: 0.14, fontWeight: 600, fontFamily: "var(--font-mono)" }}>PERP</span>
      <Item label="Funding" color={frColor}>{fr == null ? "…" : `${fr >= 0 ? "+" : ""}${fr.toFixed(4)}%`}</Item>
      <Item label="Open Interest">{stats ? fmtMktUsd(stats.openInterestValue) : "…"}</Item>
      <Item label="Объём 24ч">{stats ? fmtMktUsd(stats.turnover24h) : "…"}</Item>
      <Item label="След. фандинг"><FundingCountdown target={stats ? stats.nextFundingTime : null} /></Item>
      <LongShortBar data={longShort} />
    </div>
  );
}

function TabBtn({ active, onClick, label, count }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "8px 14px",
      background: "transparent", border: "none",
      color: active ? "var(--accent)" : "var(--text-mid)",
      borderBottom: `2px solid ${active ? "var(--accent)" : "transparent"}`,
      fontFamily: "var(--font-ui)", fontSize: 11.5, fontWeight: 500,
      cursor: "pointer",
      letterSpacing: 0.02,
    }}>
      {label}
      <span className="mono" style={{ fontSize: 10, color: active ? "var(--accent)" : "var(--text-dim)" }}>{count}</span>
    </button>
  );
}

function ActiveSignalCard({ signal, read, onOpen, flash }) {
  if (!signal) {
    // no full setup fired — show the engine's live read so the panel is never empty
    if (read) {
      const isBuy = read.side === "buy";
      const col = isBuy ? "var(--green)" : "var(--red)";
      const pct = Math.min(100, Math.abs(read.score) / 2.0 * 100);
      return (
        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 8, minHeight: 96 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, color: "var(--text-mid)", padding: "2px 7px", border: "1px solid var(--line-bright)", borderRadius: 3, letterSpacing: 0.08 }}>⌖ НАБЛЮДЕНИЕ</span>
            <span className="mono" style={{ fontSize: 11, color: col }}>{isBuy ? "↑ уклон вверх" : "↓ уклон вниз"}</span>
            <span className="mono" style={{ marginLeft: "auto", fontSize: 10, color: "var(--text-dim)" }}>RSI {read.rsi.toFixed(0)} · {read.trendDir > 0 ? "up" : read.trendDir < 0 ? "down" : "flat"}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 9.5, color: "var(--text-dim)" }}>до сигнала</span>
            <div style={{ flex: 1, height: 3, background: "var(--bg-3)", borderRadius: 1, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: col, borderRadius: 1, transition: "width 0.4s" }} />
            </div>
            <span className="mono" style={{ fontSize: 10, color: col }}>{Math.abs(read.score).toFixed(1)}/2.0</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-mid)", lineHeight: 1.4 }}>
            <span className="mono" style={{ color: "var(--accent)" }}>↳ </span>
            {read.reasons[0] || "движок анализирует рынок"} · ждёт усиления конфлюенса.
          </div>
        </div>
      );
    }
    return (
      <div style={{
        padding: "12px 14px",
        borderBottom: "1px solid var(--line)",
        fontSize: 11, color: "var(--text-dim)",
        display: "flex", alignItems: "center", gap: 8,
        minHeight: 96,
      }}>
        <span className="mono" style={{ fontSize: 10.5 }}>⌖ загрузка анализа рынка…</span>
      </div>
    );
  }
  const isBuy = signal.side === "buy";
  const color = isBuy ? "var(--green)" : "var(--red)";
  return (
    <div style={{
      padding: "10px 14px",
      borderBottom: "1px solid var(--line)",
      background: flash ? "oklch(0.78 0.16 var(--accent-h) / 0.10)" : "transparent",
      transition: "background 1.4s",
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600,
          color, padding: "2px 7px",
          border: `1px solid ${color}`, borderRadius: 3,
          background: isBuy ? "oklch(0.78 0.16 155 / 0.08)" : "oklch(0.70 0.20 25 / 0.08)",
          letterSpacing: 0.08,
        }}>
          {isBuy ? "▲ ПОКУПКА" : "▼ ПРОДАЖА"}
        </span>
        <span className="mono" style={{ fontSize: 11, color: "var(--text-bright)" }}>@ {signal.price.toFixed(2)}</span>
        <span className="mono" style={{ marginLeft: "auto", fontSize: 10, color: "var(--text-dim)" }}>{signal.id} · {signal.ts}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, position: "relative", height: 3, background: "var(--bg-3)", borderRadius: 1 }}>
          <div style={{ position: "absolute", inset: 0, width: `${signal.confidence}%`, background: color, borderRadius: 1, boxShadow: `0 0 6px ${color}` }} />
        </div>
        <span className="mono" style={{ fontSize: 10.5, color: color, minWidth: 32 }}>{signal.confidence}%</span>
        <span className="mono" style={{ fontSize: 9.5, color: "var(--text-dim)" }}>{signal.agent}</span>
      </div>
      <div style={{ fontSize: 11, color: "var(--text-mid)", lineHeight: 1.4 }}>
        <span className="mono" style={{ color: "var(--accent)" }}>↳ </span>
        {signal.reasoning}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button className="btn btn-accent" style={{ flex: 1 }} onClick={() => onOpen(signal)}>
          ▸ Сделать демо-сделку
        </button>
        <button className="btn" title="Игнорировать сигнал">✕</button>
      </div>
    </div>
  );
}

function DemoTradeForm({ form, setForm, onSubmit, price }) {
  return (
    <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
      <div style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.15em", fontWeight: 600 }}>
        РУЧНАЯ ДЕМО-СДЕЛКА
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        <button onClick={() => setForm({ ...form, side: "buy" })} style={tradeBtnStyle(form.side === "buy", "var(--green)")}>
          ▲ ЛОНГ
        </button>
        <button onClick={() => setForm({ ...form, side: "sell" })} style={tradeBtnStyle(form.side === "sell", "var(--red)")}>
          ▼ ШОРТ
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 8, alignItems: "center", fontSize: 11 }}>
        <span style={{ color: "var(--text-dim)" }}>Размер</span>
        <input type="number" value={form.amount}
          onChange={e => setForm({ ...form, amount: Math.max(10, +e.target.value || 0) })}
          style={{
            background: "var(--bg-0)", border: "1px solid var(--line-bright)",
            color: "var(--text-bright)", padding: "5px 8px", fontFamily: "var(--font-mono)", fontSize: 12,
            outline: "none", borderRadius: 3, textAlign: "right",
          }} />
        <span className="mono" style={{ color: "var(--text-dim)" }}>USDT</span>
      </div>
      <div style={{ display: "flex", gap: 4, fontFamily: "var(--font-mono)", fontSize: 9.5 }}>
        {[100, 250, 500, 1000].map(v => (
          <button key={v} onClick={() => setForm({ ...form, amount: v })} style={{
            flex: 1, padding: "3px 4px",
            background: form.amount === v ? "var(--accent-soft)" : "var(--bg-2)",
            color: form.amount === v ? "var(--accent)" : "var(--text-dim)",
            border: `1px solid ${form.amount === v ? "oklch(0.78 0.16 var(--accent-h) / 0.4)" : "var(--line)"}`,
            borderRadius: 2, cursor: "pointer",
          }}>{v}</button>
        ))}
      </div>
      <label style={{
        display: "flex", alignItems: "center", gap: 6,
        fontSize: 10.5, color: "var(--text-mid)", cursor: "pointer",
      }}>
        <input type="checkbox" checked={form.useSlTp}
          onChange={e => setForm({ ...form, useSlTp: e.target.checked })}
          style={{ accentColor: "var(--accent)" }} />
        Авто TP/SL (±2% / ±4%)
      </label>
      <button className="btn btn-accent" onClick={onSubmit} style={{ marginTop: "auto" }}>
        ▸ Открыть позицию по ~{price < 10 ? price.toFixed(3) : price < 1000 ? price.toFixed(2) : price.toFixed(0)}
      </button>
    </div>
  );
}

function tradeBtnStyle(active, color) {
  return {
    flex: 1, padding: "7px 8px",
    background: active ? `oklch(from ${color} l c h / 0.15)` : "var(--bg-2)",
    color: active ? color : "var(--text-dim)",
    border: `1px solid ${active ? color : "var(--line)"}`,
    fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600,
    letterSpacing: 0.08, cursor: "pointer", borderRadius: 3,
    transition: "all 0.1s",
  };
}

function OpenPositionsTable({ positions, onClose }) {
  if (positions.length === 0) {
    return <EmptyState text="Нет открытых позиций. Откройте демо-сделку или используйте сигнал AI." />;
  }
  return (
    <div>
      <THead cols={["#", "Тип", "Объём", "Вход", "Цена", "P&L $", "P&L %", ""]} grid="60px 70px 70px 80px 80px 80px 70px 70px" />
      {positions.map(p => {
        const isBuy = p.side === "buy";
        const color = isBuy ? "var(--green)" : "var(--red)";
        const pnlColor = p.pnl >= 0 ? "var(--green)" : "var(--red)";
        return (
          <div key={p.id} style={{
            display: "grid", gridTemplateColumns: "60px 70px 70px 80px 80px 80px 70px 70px",
            alignItems: "center", padding: "5px 12px",
            borderBottom: "1px solid var(--line)",
            fontFamily: "var(--font-mono)", fontSize: 10.5,
            background: p.signalId ? "oklch(0.78 0.16 var(--accent-h) / 0.04)" : "transparent",
          }}>
            <span style={{ color: "var(--text-dim)" }}>{p.id.slice(2, 8)}</span>
            <span style={{ color, fontWeight: 600 }}>{isBuy ? "▲ ЛОНГ" : "▼ ШОРТ"}</span>
            <span style={{ color: "var(--text)" }}>{p.size}$</span>
            <span style={{ color: "var(--text-mid)" }}>{p.entry.toFixed(p.entry < 10 ? 3 : 2)}</span>
            <span style={{ color: "var(--text-bright)" }}>{p.currentPrice.toFixed(p.currentPrice < 10 ? 3 : 2)}</span>
            <span style={{ color: pnlColor }}>{p.pnl >= 0 ? "+" : ""}{p.pnl.toFixed(2)}</span>
            <span style={{ color: pnlColor, fontWeight: 600 }}>{p.pnlPct >= 0 ? "+" : ""}{p.pnlPct.toFixed(2)}%</span>
            <button onClick={() => onClose(p.id)} style={{
              padding: "2px 8px",
              background: "var(--bg-2)", border: "1px solid var(--line-bright)",
              color: "var(--text-mid)", cursor: "pointer", borderRadius: 2,
              fontFamily: "var(--font-mono)", fontSize: 9.5,
            }}>ЗАКРЫТЬ</button>
          </div>
        );
      })}
    </div>
  );
}

function HistoryTable({ history }) {
  if (history.length === 0) {
    return <EmptyState text="История пуста — закрытые сделки появятся здесь." />;
  }
  return (
    <div>
      <THead cols={["#", "Тип", "Вход → Выход", "Объём", "P&L $", "P&L %", "Причина", "Время"]} grid="60px 60px 1fr 70px 70px 70px 80px 70px" />
      {history.map(h => {
        const isBuy = h.side === "buy";
        const color = isBuy ? "var(--green)" : "var(--red)";
        const pnlColor = h.pnl >= 0 ? "var(--green)" : "var(--red)";
        const reasonLabel = { tp: "TP", sl: "SL", manual: "вручную" }[h.reason] || h.reason;
        return (
          <div key={h.id} style={{
            display: "grid", gridTemplateColumns: "60px 60px 1fr 70px 70px 70px 80px 70px",
            alignItems: "center", padding: "5px 12px",
            borderBottom: "1px solid var(--line)",
            fontFamily: "var(--font-mono)", fontSize: 10.5,
          }}>
            <span style={{ color: "var(--text-dim)" }}>{h.id.slice(2, 8)}</span>
            <span style={{ color, fontWeight: 600 }}>{isBuy ? "ЛОНГ" : "ШОРТ"}</span>
            <span style={{ color: "var(--text)" }}>{h.entry.toFixed(2)} → {h.exitPrice.toFixed(2)}</span>
            <span style={{ color: "var(--text-mid)" }}>{h.size}$</span>
            <span style={{ color: pnlColor }}>{h.pnl >= 0 ? "+" : ""}{h.pnl.toFixed(2)}</span>
            <span style={{ color: pnlColor, fontWeight: 600 }}>{h.pnlPct >= 0 ? "+" : ""}{h.pnlPct.toFixed(2)}%</span>
            <span style={{ color: reasonLabel === "TP" ? "var(--green)" : reasonLabel === "SL" ? "var(--red)" : "var(--text-mid)" }}>{reasonLabel}</span>
            <span style={{ color: "var(--text-dim)" }}>{h.closedAt}</span>
          </div>
        );
      })}
    </div>
  );
}

function SignalsTable({ signals, hoveredId, onHover, onTrade }) {
  return (
    <div>
      <THead cols={["#", "Тип", "Цена", "Confidence", "Агент", "Результат", "Статус", ""]} grid="60px 70px 80px 90px 110px 90px 90px 70px" />
      {signals.map(s => {
        const isBuy = s.side === "buy";
        const color = s.status === "verified" ? "var(--green)" : s.status === "failed" ? "var(--red)" : isBuy ? "var(--green)" : "var(--red)";
        const status = {
          verified: "✓ ПОДТВ",
          failed:   "✕ НЕВЕР",
          active:   "● АКТИВЕН",
        }[s.status];
        const outcomeColor = s.outcome > 0 ? "var(--green)" : s.outcome < 0 ? "var(--red)" : "var(--text-dim)";
        return (
          <div key={s.id}
            onMouseEnter={() => onHover(s.id)}
            onMouseLeave={() => onHover(null)}
            style={{
              display: "grid", gridTemplateColumns: "60px 70px 80px 90px 110px 90px 90px 70px",
              alignItems: "center", padding: "5px 12px",
              borderBottom: "1px solid var(--line)",
              fontFamily: "var(--font-mono)", fontSize: 10.5,
              background: hoveredId === s.id ? "var(--bg-2)" : "transparent",
              cursor: "pointer",
            }}>
            <span style={{ color: "var(--text-dim)" }}>{s.id}</span>
            <span style={{ color: isBuy ? "var(--green)" : "var(--red)", fontWeight: 600 }}>
              {isBuy ? "▲ BUY" : "▼ SELL"}
            </span>
            <span style={{ color: "var(--text-bright)" }}>{s.price.toFixed(2)}</span>
            <span style={{ color: "var(--accent)" }}>{s.confidence}%</span>
            <span style={{ color: "var(--text-mid)" }}>{s.agent}</span>
            <span style={{ color: outcomeColor }}>
              {s.status === "active" ? "—" : `${s.outcome > 0 ? "+" : ""}${s.outcome.toFixed(2)}%`}
            </span>
            <span style={{ color }}>{status}</span>
            {s.status === "active" ? (
              <button onClick={() => onTrade(s)} style={{
                padding: "2px 8px",
                background: "var(--accent-soft)", border: "1px solid oklch(0.78 0.16 var(--accent-h) / 0.4)",
                color: "var(--accent)", cursor: "pointer", borderRadius: 2,
                fontFamily: "var(--font-mono)", fontSize: 9.5, fontWeight: 600,
              }}>ТОРГ.</button>
            ) : <span />}
          </div>
        );
      })}
    </div>
  );
}

function THead({ cols, grid }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: grid,
      padding: "5px 12px", borderBottom: "1px solid var(--line)",
      background: "var(--bg-2)", position: "sticky", top: 0, zIndex: 1,
      fontFamily: "var(--font-mono)", fontSize: 9,
      color: "var(--text-dim)", letterSpacing: 0.08, textTransform: "uppercase",
    }}>
      {cols.map((c, i) => <span key={i}>{c}</span>)}
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div style={{
      padding: "24px 16px", textAlign: "center",
      color: "var(--text-dim)", fontSize: 11.5,
      fontFamily: "var(--font-ui)",
    }}>
      <div style={{
        fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--text-dim)",
        opacity: 0.5, marginBottom: 4,
      }}>—</div>
      {text}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 * Orderbook (live depth) + Trades feed — real Bybit market data
 * ────────────────────────────────────────────────────────*/
function fmtSize(s) {
  if (s == null || isNaN(s)) return "—";
  if (s >= 1000) return s.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (s >= 1)    return s.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return s.toFixed(4);
}

/* Price formatter that keeps decimals (needed for orderbook/trades granularity) */
function fmtBookPrice(n) {
  if (n == null || isNaN(n)) return "—";
  if (n >= 1000) return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 1)    return n.toFixed(4);
  return n.toFixed(5);
}

function OrderbookView({ book, lastPrice }) {
  const N = 12;
  const asksAsc = book.asks.slice(0, N);
  const bidsDesc = book.bids.slice(0, N);
  if (!asksAsc.length && !bidsDesc.length) {
    return <EmptyState text="Загрузка стакана из Bybit…" />;
  }
  let ca = 0; const asksCum = asksAsc.map(([p, s]) => ({ p, s, cum: (ca += s) }));
  let cb = 0; const bidsCum = bidsDesc.map(([p, s]) => ({ p, s, cum: (cb += s) }));
  const maxCum = Math.max(ca, cb, 1e-9);
  const bestAsk = asksAsc[0]?.[0];
  const bestBid = bidsDesc[0]?.[0];
  const spread = bestAsk != null && bestBid != null ? bestAsk - bestBid : null;
  const mid = bestAsk != null && bestBid != null ? (bestAsk + bestBid) / 2 : lastPrice;

  const Row = ({ p, s, cum, color }) => (
    <div style={{
      position: "relative", display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
      padding: "2px 12px", fontFamily: "var(--font-mono)", fontSize: 10.5, alignItems: "center",
    }}>
      <div style={{ position: "absolute", right: 0, top: 1, bottom: 1, width: `${(cum / maxCum) * 100}%`,
        background: color, opacity: 0.12 }} />
      <span style={{ color, zIndex: 1 }}>{fmtBookPrice(p)}</span>
      <span style={{ color: "var(--text-mid)", textAlign: "right", zIndex: 1 }}>{fmtSize(s)}</span>
      <span style={{ color: "var(--text-dim)", textAlign: "right", zIndex: 1 }}>{fmtSize(cum)}</span>
    </div>
  );

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "4px 12px",
        background: "var(--bg-2)", borderBottom: "1px solid var(--line)", position: "sticky", top: 0, zIndex: 2,
        fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.08, textTransform: "uppercase" }}>
        <span>Цена</span><span style={{ textAlign: "right" }}>Объём</span><span style={{ textAlign: "right" }}>Сумма</span>
      </div>
      {[...asksCum].reverse().map((r, i) => <Row key={`a${i}`} {...r} color="var(--red)" />)}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "4px 12px", background: "var(--bg-2)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)",
        fontFamily: "var(--font-mono)", fontSize: 11 }}>
        <span style={{ color: "var(--accent)", fontWeight: 600 }}>{fmtBookPrice(mid)}</span>
        <span style={{ color: "var(--text-dim)", fontSize: 10 }}>
          спред {spread != null ? fmtBookPrice(spread) : "—"}
          {spread != null && mid ? ` (${(spread / mid * 100).toFixed(3)}%)` : ""}
        </span>
      </div>
      {bidsCum.map((r, i) => <Row key={`b${i}`} {...r} color="var(--green)" />)}
    </div>
  );
}

function TradesView({ trades, whaleUsd = 50000 }) {
  if (!trades.length) return <EmptyState text="Загрузка ленты сделок из Bybit…" />;
  const fmtTime = (ms) => {
    const d = new Date(ms);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
  };
  const maxUsd = Math.max(...trades.map(t => t.price * t.size), 1);
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", padding: "4px 12px",
        background: "var(--bg-2)", borderBottom: "1px solid var(--line)", position: "sticky", top: 0, zIndex: 2,
        fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.08, textTransform: "uppercase" }}>
        <span>Цена</span><span style={{ textAlign: "right" }}>Объём</span><span style={{ textAlign: "right" }}>Сторона</span><span style={{ textAlign: "right", minWidth: 62 }}>Время</span>
      </div>
      {trades.map((t) => {
        const buy = t.side === "Buy";
        const c = buy ? "var(--green)" : "var(--red)";
        const usd = t.price * t.size;
        const whale = usd >= whaleUsd;
        return (
          <div key={t.id} title={`$${usd.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
            style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", alignItems: "center",
            padding: "2px 12px", borderBottom: "1px solid var(--line)",
            background: whale ? (buy ? "oklch(0.78 0.16 155 / 0.12)" : "oklch(0.70 0.20 25 / 0.12)") : "transparent",
            fontFamily: "var(--font-mono)", fontSize: 10.5 }}>
            <div style={{ position: "absolute", right: 0, top: 1, bottom: 1, width: `${(usd / maxUsd) * 100}%`,
              background: c, opacity: 0.10 }} />
            <span style={{ color: c, zIndex: 1, fontWeight: whale ? 600 : 400 }}>{whale ? "🐋 " : ""}{fmtBookPrice(t.price)}</span>
            <span style={{ color: whale ? "var(--text-bright)" : "var(--text-mid)", textAlign: "right", zIndex: 1, fontWeight: whale ? 600 : 400 }}>{fmtSize(t.size)}</span>
            <span style={{ color: c, textAlign: "right", zIndex: 1 }}>{buy ? "▲ BUY" : "▼ SELL"}</span>
            <span style={{ color: "var(--text-dim)", textAlign: "right", minWidth: 62, zIndex: 1 }}>{fmtTime(t.time)}</span>
          </div>
        );
      })}
    </div>
  );
}

function PortfolioSummary({ positions }) {
  const totalExposure = positions.reduce((s, p) => s + p.size, 0);
  const totalPnl = positions.reduce((s, p) => s + p.pnl, 0);
  const totalPnlPct = totalExposure > 0 ? (totalPnl / totalExposure) * 100 : 0;
  const longCount = positions.filter(p => p.side === "buy").length;
  const shortCount = positions.length - longCount;
  const pnlColor = totalPnl >= 0 ? "var(--green)" : "var(--red)";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      marginLeft: 14, paddingLeft: 14,
      borderLeft: "1px solid var(--line)",
      fontFamily: "var(--font-mono)", fontSize: 10.5,
    }}>
      <span style={{
        fontSize: 9, fontWeight: 600, letterSpacing: 0.12,
        color: "var(--text-dim)", textTransform: "uppercase",
      }}>портфель</span>
      <span style={{ color: "var(--text-bright)" }}>
        {positions.length}<span style={{ color: "var(--text-dim)" }}>поз.</span>
      </span>
      <span style={{ color: "var(--green)" }}>{longCount}L</span>
      <span style={{ color: "var(--red)" }}>{shortCount}S</span>
      <span style={{ color: "var(--text-dim)" }}>·</span>
      <span><span style={{ color: "var(--text-dim)" }}>экспоз: </span>
        <span style={{ color: "var(--text-bright)" }}>{totalExposure.toFixed(0)}$</span>
      </span>
      <span><span style={{ color: "var(--text-dim)" }}>нереал P&L: </span>
        <span style={{ color: pnlColor, fontWeight: 600 }}>
          {totalPnl >= 0 ? "+" : ""}{totalPnl.toFixed(2)}$ ({totalPnlPct >= 0 ? "+" : ""}{totalPnlPct.toFixed(2)}%)
        </span>
      </span>
    </div>
  );
}

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
});