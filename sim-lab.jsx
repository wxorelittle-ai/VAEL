/* sim-lab.jsx — the simulator's brain. Instead of 4 hardcoded strategies it:
 *   • precomputes indicator features once per candle set (fast),
 *   • backtests any strategy expressed as a mutable "genes" spec,
 *   • ships a library of named strategies (our indicator toolkit),
 *   • GENERATES its own strategies (random gene combos),
 *   • EVOLVES them — mutating the winners of the last run (learning from what
 *     worked / what the losers got wrong),
 *   • persists every strategy that was profitable on the day and tracks it across
 *     runs so you see performance IN DYNAMICS.
 * All backtests are on real Bybit candles — honest numbers. */

/* ── Precompute per-candle indicator arrays once (strategies just read them). ── */
function computeFeatures(candles) {
  const n = candles.length, closes = candles.map(c => c.close);
  const f = { n, closes, atr: [], rsi: [], macdHist: [], stDir: [], stFlip: [], bbPctB: [], adx: [], stochK: [], stochCross: [], ema50: [], donchU: [], donchL: [], trend: [] };
  for (let i = 0; i < n; i++) {
    if (i < 30) { f.atr[i] = 0; f.rsi[i] = 50; f.macdHist[i] = 0; f.stDir[i] = 0; f.stFlip[i] = 0; f.bbPctB[i] = 0.5; f.adx[i] = 0; f.stochK[i] = 50; f.stochCross[i] = 0; f.ema50[i] = closes[i]; f.donchU[i] = closes[i]; f.donchL[i] = closes[i]; f.trend[i] = 0; continue; }
    const sl = candles.slice(0, i + 1), cl = closes.slice(0, i + 1);
    f.atr[i] = taAtr(sl, 14);
    f.rsi[i] = taRsi(cl, 14);
    f.macdHist[i] = taMacd(cl).hist;
    const st = taSupertrend(sl, 3, 10); f.stDir[i] = st.dir; f.stFlip[i] = st.flipUp ? 1 : st.flipDown ? -1 : 0;
    f.bbPctB[i] = taBollinger(cl, 20, 2).pctB;
    f.adx[i] = taDmi(sl, 14).adx;
    const s = taStochastic(sl); f.stochK[i] = s.k; f.stochCross[i] = (s.kPrev <= s.dPrev && s.k > s.d) ? 1 : (s.kPrev >= s.dPrev && s.k < s.d) ? -1 : 0;
    const e50 = taEma(cl, 50), e9 = taEma(cl, 9), e21 = taEma(cl, 21);
    f.ema50[i] = e50;
    const dc = taDonchian(sl, 20); f.donchU[i] = dc.upper; f.donchL[i] = dc.lower;
    f.trend[i] = (closes[i] > e50 && e9 > e21) ? 1 : (closes[i] < e50 && e9 < e21) ? -1 : 0;
  }
  return f;
}

const TRIGGERS = ["rsiOversold", "rsiOverbought", "stFlipUp", "stFlipDown", "macdUp", "macdDown", "bbLower", "bbUpper", "stochCrossUp", "donchBreakUp", "donchBreakDown"];

function genesEntry(g, f, i) {
  if (i < 55) return false;
  if (g.trendFilter === "up" && f.trend[i] <= 0) return false;
  if (g.trendFilter === "down" && f.trend[i] >= 0) return false;
  if (g.adxMin && f.adx[i] < g.adxMin) return false;
  const c = f.closes;
  switch (g.trigger) {
    case "rsiOversold": return f.rsi[i] < g.rsiTh;
    case "rsiOverbought": return f.rsi[i] > 100 - g.rsiTh;
    case "stFlipUp": return f.stFlip[i] > 0;
    case "stFlipDown": return f.stFlip[i] < 0;
    case "macdUp": return f.macdHist[i] > 0 && f.macdHist[i - 1] <= 0;
    case "macdDown": return f.macdHist[i] < 0 && f.macdHist[i - 1] >= 0;
    case "bbLower": return f.bbPctB[i] < 0.05;
    case "bbUpper": return f.bbPctB[i] > 0.95;
    case "stochCrossUp": return f.stochCross[i] > 0 && f.stochK[i] < g.stochTh;
    case "donchBreakUp": return c[i] > f.donchU[i - 1];
    case "donchBreakDown": return c[i] < f.donchL[i - 1];
    default: return false;
  }
}

/* Backtest a genes strategy on precomputed features. Same rules as the terminal:
 * ATR stop/target, 0.02% fees, no overlapping trades. */
function backtestGenes(candles, f, g, cfg) {
  const cap0 = cfg.capital, lev = cfg.leverage || 1, feeRate = (cfg.fees != null ? cfg.fees : 0.02) / 100, riskFrac = 0.01, H = 24;
  const long = g.side === "buy";
  let equity = cap0, wins = 0, losses = 0, gW = 0, gL = 0;
  const curve = [{ v: equity }];
  let i = 55;
  while (i <= candles.length - 2) {
    if (!genesEntry(g, f, i)) { i++; continue; }
    const entry = f.closes[i], atr = f.atr[i] || entry * 0.004;
    const slD = atr * (g.slAtr || 1.5);
    const sl = long ? entry - slD : entry + slD;
    const tp = long ? entry + slD * (g.tpR || 1.8) : entry - slD * (g.tpR || 1.8);
    let R = null, xi = Math.min(i + H, candles.length - 1);
    for (let j = i + 1; j <= Math.min(i + H, candles.length - 1); j++) {
      const c = candles[j];
      if (long) { if (c.lo <= sl) { R = -1; xi = j; break; } if (c.hi >= tp) { R = g.tpR || 1.8; xi = j; break; } }
      else { if (c.hi >= sl) { R = -1; xi = j; break; } if (c.lo <= tp) { R = g.tpR || 1.8; xi = j; break; } }
    }
    if (R === null) { const xp = f.closes[xi]; const mv = long ? xp - entry : entry - xp; R = Math.max(-1, Math.min(g.tpR || 1.8, mv / slD)); }
    const riskAmt = equity * riskFrac * lev;
    const notional = riskAmt / (slD / entry);
    equity = Math.max(1, equity + R * riskAmt - notional * feeRate * 2);
    if (R > 0) { wins++; gW += R * riskAmt; } else { losses++; gL += Math.abs(R * riskAmt); }
    curve.push({ v: equity });
    i = xi + 1;
  }
  const trades = wins + losses;
  const totalReturn = (equity - cap0) / cap0 * 100;
  let peak = cap0, maxDD = 0;
  curve.forEach(p => { peak = Math.max(peak, p.v); const dd = (peak - p.v) / peak * 100; if (dd > maxDD) maxDD = dd; });
  return { curve, stats: { totalReturn, trades, winRate: trades ? wins / trades * 100 : 0, profitFactor: gL > 0 ? gW / gL : (gW > 0 ? 9.99 : 0), maxDD, last: equity } };
}

/* Named library — our indicator toolkit as concrete strategies. */
function strategyLibrary() {
  return [
    { name: "Supertrend + RSI", source: "builtin", genes: { side: "buy", trendFilter: "up", trigger: "rsiOversold", rsiTh: 45, adxMin: 20, slAtr: 1.5, tpR: 2 } },
    { name: "Supertrend Flip", source: "builtin", genes: { side: "buy", trendFilter: "any", trigger: "stFlipUp", slAtr: 1.5, tpR: 1.8 } },
    { name: "Bollinger Reversion", source: "builtin", genes: { side: "buy", trendFilter: "up", trigger: "bbLower", slAtr: 1.5, tpR: 1.6 } },
    { name: "Donchian Breakout", source: "builtin", genes: { side: "buy", trendFilter: "up", trigger: "donchBreakUp", adxMin: 22, slAtr: 2, tpR: 2.2 } },
    { name: "MACD Trend", source: "builtin", genes: { side: "buy", trendFilter: "up", trigger: "macdUp", slAtr: 1.5, tpR: 1.8 } },
    { name: "Stochastic Reversal", source: "builtin", genes: { side: "buy", trendFilter: "up", trigger: "stochCrossUp", stochTh: 25, slAtr: 1.5, tpR: 1.8 } },
    { name: "MACD Short", source: "builtin", genes: { side: "sell", trendFilter: "down", trigger: "macdDown", slAtr: 1.5, tpR: 1.8 } },
    { name: "Supertrend Short", source: "builtin", genes: { side: "sell", trendFilter: "any", trigger: "stFlipDown", slAtr: 1.5, tpR: 1.8 } },
  ];
}

/* Deterministic-ish generator: vary the gene by index so runs differ without RNG state. */
function generateGenes(seed) {
  const pick = (arr, k) => arr[(seed * 2654435761 + k * 40503) % arr.length];
  const trig = pick(TRIGGERS, 1);
  const bearish = trig.includes("Down") || trig === "rsiOverbought" || trig === "bbUpper";
  const side = bearish ? "sell" : "buy";
  const trendFilter = pick(["up", "down", "any"], 2 + seed);
  return {
    side, trendFilter: side === "buy" && trendFilter === "down" ? "up" : side === "sell" && trendFilter === "up" ? "down" : trendFilter,
    trigger: trig,
    rsiTh: 25 + (seed % 4) * 5, stochTh: 15 + (seed % 3) * 5, adxMin: (seed % 3) * 11,
    slAtr: 1.2 + (seed % 4) * 0.3, tpR: 1.5 + (seed % 4) * 0.4,
  };
}

/* Mutate a winner — small parameter jitter + occasional trigger swap. Learning
 * from what worked: keep the structure, nudge the knobs. */
function mutateGenes(g, k) {
  const j = (v, step, min, max) => Math.max(min, Math.min(max, +(v + ((k % 3) - 1) * step).toFixed(2)));
  const swap = (k % 5) === 0;
  return {
    side: g.side,
    trendFilter: g.trendFilter,
    trigger: swap ? TRIGGERS[(TRIGGERS.indexOf(g.trigger) + k) % TRIGGERS.length] : g.trigger,
    rsiTh: j(g.rsiTh || 35, 5, 20, 45),
    stochTh: j(g.stochTh || 20, 5, 10, 35),
    adxMin: j(g.adxMin || 0, 5, 0, 35),
    slAtr: j(g.slAtr || 1.5, 0.3, 0.9, 3),
    tpR: j(g.tpR || 1.8, 0.3, 1.2, 3.2),
  };
}

function genesLabel(g) {
  const t = { rsiOversold: "RSI↓", rsiOverbought: "RSI↑", stFlipUp: "ST↗", stFlipDown: "ST↘", macdUp: "MACD↗", macdDown: "MACD↘", bbLower: "BB↓", bbUpper: "BB↑", stochCrossUp: "Stoch×", donchBreakUp: "Donch↑", donchBreakDown: "Donch↓" }[g.trigger] || g.trigger;
  return `${g.side === "buy" ? "L" : "S"}·${t}·${g.trendFilter[0]}·${g.tpR}R`;
}

/* Full lab run: library + a fresh generation + (optionally) evolved winners. */
function runSimLab(candles, cfg, seedGenes) {
  const f = computeFeatures(candles);
  const rows = [];
  const bt = (name, source, genes) => {
    const r = backtestGenes(candles, f, genes, cfg);
    rows.push({ name, source, genes, ...r.stats, curve: r.curve, profit: cfg.capital * r.stats.totalReturn / 100 });
  };
  strategyLibrary().forEach(s => bt(s.name, s.source, s.genes));
  // a generation of generated strategies
  for (let s = 0; s < (cfg.genCount || 8); s++) { const g = generateGenes(s + (cfg.genSeed || 0)); bt(`Gen ${genesLabel(g)}`, "generated", g); }
  // evolve the seeds passed in (winners of the previous run)
  (seedGenes || []).forEach((g, idx) => { for (let k = 1; k <= 2; k++) { const m = mutateGenes(g, k + idx); bt(`Evo ${genesLabel(m)}`, "evolved", m); } });
  rows.sort((a, b) => b.totalReturn - a.totalReturn);
  return rows;
}

/* ── Champions: any strategy profitable on the day is kept and tracked across
 * runs so you see it in dynamics. Stored per (asset, name). ── */
const SIMLAB_LS = "vael.simlab.champions";
function loadChampions() { try { return JSON.parse(localStorage.getItem(SIMLAB_LS) || "[]"); } catch (_) { return []; } }
function saveChampions(list) { try { localStorage.setItem(SIMLAB_LS, JSON.stringify(list.slice(0, 40))); } catch (_) {} }
function recordChampions(rows, asset, tsMs) {
  const champs = loadChampions();
  const byKey = {}; champs.forEach(c => { byKey[c.key] = c; });
  rows.filter(r => r.totalReturn > 0).slice(0, 10).forEach(r => {
    const key = `${asset}:${r.name}`;
    const point = { ts: tsMs, roi: +r.totalReturn.toFixed(2), profit: +r.profit.toFixed(2), win: +r.winRate.toFixed(0), trades: r.trades };
    if (byKey[key]) {
      byKey[key].history.push(point);
      byKey[key].history = byKey[key].history.slice(-60);
      byKey[key].source = r.source; byKey[key].genes = r.genes;
    } else {
      byKey[key] = { key, asset, name: r.name, source: r.source, genes: r.genes, history: [point] };
      champs.push(byKey[key]);
    }
  });
  // rank champions by cumulative ROI across their history
  const out = Object.values(byKey).sort((a, b) => cumRoi(b) - cumRoi(a));
  saveChampions(out);
  return out;
}
function cumRoi(c) { return (c.history || []).reduce((s, p) => s + p.roi, 0); }

Object.assign(window, {
  computeFeatures, backtestGenes, strategyLibrary, generateGenes, mutateGenes, genesLabel,
  runSimLab, loadChampions, saveChampions, recordChampions, cumRoi,
});
