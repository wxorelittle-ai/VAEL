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
 * ATR stop/target, 0.055% taker fee per side (matches the demo terminal's
 * FEE_RATE in crypto.jsx), plus a slippage cost so fills aren't at the ideal
 * price, no overlapping trades. */
function backtestGenes(candles, f, g, cfg) {
  const cap0 = cfg.capital, lev = cfg.leverage || 1, feeRate = (cfg.fees != null ? cfg.fees : 0.055) / 100, riskFrac = 0.01, H = 24;
  // slippage per side (fraction of notional) — real fills are worse than the mid.
  const slipRate = (cfg.slip != null ? cfg.slip : 0.02) / 100;
  // optional bar window [iStart, iEnd] — lets a caller backtest just the train or
  // just the test slice of the series (walk-forward). Defaults to the whole series.
  const iStart = Math.max(55, cfg.iStart != null ? cfg.iStart : 55);
  const iEnd = cfg.iEnd != null ? Math.min(cfg.iEnd, candles.length - 2) : candles.length - 2;
  const long = g.side === "buy";
  let equity = cap0, wins = 0, losses = 0, gW = 0, gL = 0;
  const curve = [{ v: equity }];
  let i = iStart;
  while (i <= iEnd) {
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
    const cost = notional * (feeRate + slipRate) * 2;   // fee + slippage, entry & exit
    equity = Math.max(1, equity + R * riskAmt - cost);
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

    /* Canonical public trading systems (the rules are common knowledge; expressed
     * here in our genes model). See Edwards & Magee, Murphy, and the Turtle rules. */
    // Turtle System — Donchian breakout, wide 2×ATR (2N) stop, let winners run.
    { name: "Turtle Breakout", source: "builtin", genes: { side: "buy", trendFilter: "any", trigger: "donchBreakUp", slAtr: 2, tpR: 3 } },
    { name: "Turtle Breakout Short", source: "builtin", genes: { side: "sell", trendFilter: "any", trigger: "donchBreakDown", slAtr: 2, tpR: 3 } },
    // Dow Theory — ride the confirmed primary uptrend only when it's strong (ADX≥25).
    { name: "Dow Trend Rider", source: "builtin", genes: { side: "buy", trendFilter: "up", trigger: "macdUp", adxMin: 25, slAtr: 1.8, tpR: 2.5 } },
    // Connors RSI-2 style — buy a deep pullback inside an uptrend, quick target.
    { name: "RSI-2 Pullback", source: "builtin", genes: { side: "buy", trendFilter: "up", trigger: "rsiOversold", rsiTh: 30, slAtr: 1.2, tpR: 1.4 } },
    // Bollinger fade — mean-revert the upper band poke while the trend is down.
    { name: "Bollinger Fade Short", source: "builtin", genes: { side: "sell", trendFilter: "down", trigger: "bbUpper", slAtr: 1.5, tpR: 1.6 } },
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

/* Plain-language rulebook for a strategy — what it actually does, step by step. */
function genesRules(g) {
  const long = g.side === "buy";
  const trigTxt = {
    rsiOversold: `RSI опускается ниже ${g.rsiTh || 45} (перепроданность)`,
    rsiOverbought: `RSI поднимается выше ${100 - (g.rsiTh || 45)} (перекупленность)`,
    stFlipUp: "Supertrend разворачивается вверх",
    stFlipDown: "Supertrend разворачивается вниз",
    macdUp: "гистограмма MACD пересекает ноль снизу вверх",
    macdDown: "гистограмма MACD пересекает ноль сверху вниз",
    bbLower: "цена прокалывает нижнюю полосу Боллинджера (%B < 0.05)",
    bbUpper: "цена прокалывает верхнюю полосу Боллинджера (%B > 0.95)",
    stochCrossUp: `бычье пересечение Stochastic ниже ${g.stochTh || 25}`,
    donchBreakUp: "цена пробивает верхнюю границу канала Дончиана (20)",
    donchBreakDown: "цена пробивает нижнюю границу канала Дончиана (20)",
  }[g.trigger] || g.trigger;
  const trendTxt = g.trendFilter === "up" ? "только в восходящем тренде (цена > EMA50, EMA9 > EMA21)"
    : g.trendFilter === "down" ? "только в нисходящем тренде (цена < EMA50, EMA9 < EMA21)"
    : "в любом тренде";
  const slAtr = g.slAtr || 1.5, tpR = g.tpR || 1.8;
  const rules = [
    { k: "Направление", v: long ? "Лонг · в покупку" : "Шорт · в продажу" },
    { k: "Фильтр тренда", v: trendTxt },
  ];
  if (g.adxMin) rules.push({ k: "Сила тренда", v: `входить только если ADX ≥ ${g.adxMin}` });
  rules.push({ k: "Триггер входа", v: trigTxt });
  rules.push({ k: "Стоп-лосс", v: `${slAtr}×ATR от входа` });
  rules.push({ k: "Тейк-профит", v: `${tpR}R · ${(slAtr * tpR).toFixed(1)}×ATR от входа` });
  rules.push({ k: "Тайм-аут", v: "выход через 24 бара, если ни стоп, ни цель не сработали" });
  return rules;
}

/* Capital-aware execution plan for a strategy at a candle — the same optimal-leverage
 * / liquidation logic the entry planner uses: pick the smallest leverage that keeps
 * margin near target, clamped so liquidation stays beyond the stop. Numbers are honest
 * given the strategy's own ATR stop.
 * Defaults to the LATEST candle; pass cfg.idx to size at an earlier bar (the agent's
 * own backtest needs this to replay decisions without seeing the future). */
function genesPlan(candles, f, g, cfg) {
  const n = candles.length; if (n < 2) return null;
  cfg = cfg || {};
  const i = cfg.idx != null ? cfg.idx : n - 1;
  if (i < 1 || i >= n) return null;
  const long = g.side === "buy";
  const price = f.closes[i];
  const atr = f.atr[i] || price * 0.004;
  const slAtr = g.slAtr || 1.5, tpR = g.tpR || 1.8;
  const slDist = atr * slAtr;
  const slPct = slDist / price;
  const sl = long ? price - slDist : price + slDist;
  const tp = long ? price + slDist * tpR : price - slDist * tpR;

  const budget = cfg.capital || 10000;
  const riskPct = cfg.riskPct != null ? cfg.riskPct : 0.02;   // fraction of capital risked per trade
  const LIQ_BUFFER = 1.5, HARD_LEV_CAP = cfg.levCap || 20, TGT_MARGIN_FRAC = 0.25, MAX_MARGIN_FRAC = 0.5;
  const exchMaxLev = cfg.maxLev || 50;
  const riskUsd = budget * riskPct;
  const maxSafeLev = Math.max(1, Math.floor(1 / (slPct * LIQ_BUFFER)));   // liq stays beyond the stop
  const marginAt1x = riskUsd / slPct;
  const levWanted = marginAt1x > budget * TGT_MARGIN_FRAC ? Math.ceil(marginAt1x / (budget * TGT_MARGIN_FRAC)) : 1;
  const lev = Math.max(1, Math.min(levWanted, maxSafeLev, exchMaxLev, HARD_LEV_CAP));
  const margin = Math.max(10, Math.min(budget * MAX_MARGIN_FRAC, riskUsd / (lev * slPct)));
  const notional = margin * lev;
  const qty = notional / price;
  const liq = lev > 1 ? (long ? price * (1 - 1 / lev) : price * (1 + 1 / lev)) : null;
  const liqDistPct = liq ? Math.abs(liq - price) / price * 100 : null;
  const profitAtTp = notional * Math.abs(tp - price) / price;
  const lossAtSl = notional * slPct;
  return {
    side: g.side, price, entry: price, sl, tp, rr: tpR, slPct, atr,
    lev, levWanted, levCapped: lev < levWanted, maxSafeLev,
    margin, notional, qty, liq, liqDistPct, riskUsd, budget, profitAtTp, lossAtSl,
  };
}

/* Full lab run: library + a fresh generation + (optionally) evolved winners.
 * Walk-forward: the series is split into train (first `split`) and test (the rest).
 * Every strategy is backtested on BOTH, but the HEADLINE numbers (ROI, win, PF,
 * champions, evolution seeds) come from the TEST slice — data the strategy was not
 * selected on. trainReturn is kept alongside so overfitting is visible (high train
 * + low test = curve-fit). This removes the in-sample bias where a strategy was
 * ranked on the very candles it was tuned to. */
function runSimLab(candles, cfg, seedGenes) {
  const f = computeFeatures(candles);
  const n = candles.length;
  const split = cfg.split != null ? cfg.split : 0.65;
  const cut = Math.max(80, Math.min(n - 30, Math.floor(n * split)));   // keep a usable test window
  const trainCfg = { ...cfg, iStart: 55, iEnd: cut - 1 };
  const testCfg = { ...cfg, iStart: cut, iEnd: n - 2 };
  const rows = [];
  const bt = (name, source, genes) => {
    const train = backtestGenes(candles, f, genes, trainCfg).stats;
    const test = backtestGenes(candles, f, genes, testCfg);
    const s = test.stats;
    rows.push({
      name, source, genes,
      // headline = out-of-sample (test)
      totalReturn: s.totalReturn, trades: s.trades, winRate: s.winRate,
      profitFactor: s.profitFactor, maxDD: s.maxDD, last: s.last,
      trainReturn: train.totalReturn, trainTrades: train.trades,   // in-sample, for overfit check
      curve: test.curve, profit: cfg.capital * s.totalReturn / 100,
    });
  };
  strategyLibrary().forEach(s => bt(s.name, s.source, s.genes));
  // a generation of generated strategies
  for (let s = 0; s < (cfg.genCount || 8); s++) { const g = generateGenes(s + (cfg.genSeed || 0)); bt(`Gen ${genesLabel(g)}`, "generated", g); }
  // evolve the seeds passed in (winners of the previous run)
  (seedGenes || []).forEach((g, idx) => { for (let k = 1; k <= 2; k++) { const m = mutateGenes(g, k + idx); bt(`Evo ${genesLabel(m)}`, "evolved", m); } });
  rows.sort((a, b) => b.totalReturn - a.totalReturn);   // rank by out-of-sample return
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
  genesRules, genesPlan, runSimLab, loadChampions, saveChampions, recordChampions, cumRoi,
});
