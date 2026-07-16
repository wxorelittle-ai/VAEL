/* auto-trader.jsx — the autonomous demo-trading agent's brain (paper only).
 *
 * It composes the pieces already in the app:
 *   • picks the strategy to trade now by running the strategy lab and evolving this
 *     asset's champions (learn / improve over time),
 *   • decides entries by evaluating that strategy's rules on the live candles,
 *   • sizes the trade with the capital-aware plan (genesPlan) and trails the stop to
 *     lock profit.
 * The dashboard drives the loop (start/stop, opening demo positions); this module is
 * the pure decision engine. It never places a real order. */

/* Quality bar a strategy must clear before the agent will risk anything on it.
 * minTrades kills the "100% win rate on 1 trade" curve-fits — a couple of lucky
 * bars is noise, not an edge. */
const AUTO_GATE = { minTrades: 8, minPf: 1.2, minRoi: 0 };

/* Pick the strategy the agent should trade now.
 *
 * runSimLab already walk-forwards internally: it searches on the older bars and
 * reports totalReturn / trades / profitFactor from the held-out recent slice, ranked
 * by that out-of-sample result (trainReturn is kept alongside for the overfit gap).
 * So the honest job here is simply to gate on those out-of-sample numbers — and to
 * refuse when nothing clears the bar, rather than trading the least-bad loser.
 *
 * Feed this a LONG series (~1000 bars). On the chart's 200 the held-out slice holds
 * about two trades, which no honest gate can pass. */
function autoPickStrategy(candles, asset, cfg) {
  if (!candles || candles.length < 300 || typeof runSimLab !== "function") return null;
  cfg = cfg || {};
  const capital = cfg.capital || 10000;
  const gate = cfg.gate || AUTO_GATE;

  const champs = (typeof loadChampions === "function" ? loadChampions() : []).filter(c => c.asset === asset && c.genes);
  const seeds = champs.slice(0, 4).map(c => c.genes);
  const rows = runSimLab(candles, { capital, leverage: 1, fees: 0.055, genCount: 8 }, seeds);
  if (!rows || !rows.length) return null;
  if (typeof recordChampions === "function") { try { recordChampions(rows, asset, Date.now()); } catch (_) {} }

  // Gate on the OUT-OF-SAMPLE result. No fallback to "least-bad loser".
  const passing = rows.filter(r => r.genes
    && r.trades >= gate.minTrades
    && r.profitFactor >= gate.minPf
    && r.totalReturn > gate.minRoi);
  if (!passing.length) return null;

  // Regime check — used as a VETO, never as a promoter.
  // A regime holds only 2-4 trades in a 1000-bar series: far too thin to CONFIRM an
  // edge, and promoting a candidate on that basis would smuggle back the same curve-fit
  // the gate exists to stop. But a candidate that has lost repeatedly in the regime
  // we're actually in is real evidence to stand down.
  let regimeNote = null;
  const chosen = passing[0];
  if (cfg.useRegime !== false && typeof autoRegimeFit === "function") {
    const fit = autoRegimeFit(candles, chosen.genes, cfg);
    const now = fit && fit.now ? fit.now.key : null;
    const here = fit ? fit.rows.find(x => x.regime === now) : null;
    regimeNote = { key: now, trades: here ? here.trades : 0, avgR: here ? here.avgR : null, seen: !!here, vetoed: false };
    if (here && here.trades >= 3 && here.netR < 0) return null;   // proven to bleed here
  }

  const top = chosen;   // runSimLab already ranks by out-of-sample return
  return {
    genes: top.genes, name: top.name, source: top.source,
    roi: top.totalReturn, win: top.winRate, trades: top.trades, pf: top.profitFactor,
    inRoi: top.trainReturn,                 // in-sample score, to show the overfit gap
    considered: rows.length, passed: passing.length, oos: true,
    regime: regimeNote,
  };
}

// Should the agent enter now with this strategy? Returns a capital-aware sizing plan
// (side, entry, sl, tp, slPct, lev, margin, …) when the strategy's entry rule fires
// on the latest bar, else null.
function autoEntry(candles, genes, cfg) {
  if (!genes || typeof computeFeatures !== "function" || typeof genesEntry !== "function" || typeof genesPlan !== "function") return null;
  if (!candles || candles.length < 60) return null;
  const f = computeFeatures(candles);
  const i = candles.length - 1;
  if (!genesEntry(genes, f, i)) return null;
  cfg = cfg || {};
  return genesPlan(candles, f, genes, {
    capital: cfg.capital || 10000, maxLev: cfg.maxLev || 50,
    riskPct: cfg.riskPct != null ? cfg.riskPct : 0.02, levCap: cfg.levCap || 20,
  });
}

// Look for the agent's entry signal on OTHER symbols. A strategy is a rule set, so
// it applies to any market — this lets the agent trade wherever the setup actually
// appears instead of only the chart you happen to be on. Sequential (not parallel)
// to stay polite to the REST endpoint. Returns the first hit {symbol, plan} or null.
async function autoScanAssets(symbols, interval, limit, category, genes, cfg) {
  if (!genes || typeof bybitFetchKlines !== "function") return null;
  for (let i = 0; i < symbols.length; i++) {
    try {
      const c = await bybitFetchKlines(symbols[i], interval, limit || 200, category || "spot");
      const plan = autoEntry(c, genes, cfg);
      if (plan && plan.margin > 0) return { symbol: symbols[i], plan };
    } catch (_) { /* skip a symbol that fails to load */ }
  }
  return null;
}

/* ── Sandbox training: instead of waiting for live signals, replay a long slice of
 * history fast. Each round walks a different window of the candles, evolves from the
 * champions found so far, and banks the profitable ones — so the agent arrives at
 * live trading already trained. Returns a summary of what it learned. ── */
async function autoTrain(symbols, interval, category, cfg, onProgress) {
  if (typeof runSimLab !== "function" || typeof bybitFetchKlines !== "function") return null;
  cfg = cfg || {};
  const rounds = cfg.rounds || 3;
  const capital = cfg.capital || 10000;
  let tested = 0, kept = 0;
  const best = [];

  for (let s = 0; s < symbols.length; s++) {
    const sym = symbols[s];
    let candles = null;
    try { candles = await bybitFetchKlines(sym, interval || "15", 1000, category || "spot"); } catch (_) { continue; }
    if (!candles || candles.length < 200) continue;

    for (let r = 0; r < rounds; r++) {
      // walk a different slice each round → the strategy must work on unseen windows
      const span = Math.floor(candles.length / rounds);
      const slice = candles.slice(r * span, r * span + span);
      if (slice.length < 120) continue;
      const champs = (typeof loadChampions === "function" ? loadChampions() : []).filter(c => c.asset === sym && c.genes);
      const seeds = champs.slice(0, 4).map(c => c.genes);
      const rows = runSimLab(slice, { capital, leverage: 1, fees: 0.055, genCount: 8, genSeed: r * 8 }, seeds);
      if (!rows || !rows.length) continue;
      tested += rows.length;
      kept += rows.filter(x => x.totalReturn > 0).length;
      if (typeof recordChampions === "function") { try { recordChampions(rows, sym, Date.now()); } catch (_) {} }
      const top = rows[0];
      if (top && top.totalReturn > 0) best.push({ symbol: sym, name: top.name, roi: top.totalReturn });
      if (typeof onProgress === "function") onProgress({ symbol: sym, round: r + 1, rounds, tested, kept });
      await new Promise(res => setTimeout(res, 0));   // yield so the UI stays responsive
    }
  }
  best.sort((a, b) => b.roi - a.roi);
  const champions = typeof loadChampions === "function" ? loadChampions() : [];
  return { tested, kept, best: best.slice(0, 3), champions: champions.length };
}

/* ── Market regime, from INTERNAL factors only (the ones we have history for).
 *
 * External factors — funding, long/short crowding, news, macro — exist only as a
 * live snapshot in this app; there is no historical series for them, so they cannot
 * honestly be correlated against past trades. They stay what they already are: a live
 * risk brake (macroRisk / microstructureRisk cap leverage and flag chasing).
 *
 * Regime = direction × trend strength × volatility, e.g. "up·strong·calm". A strategy
 * that earns in a strong trend usually bleeds in a chop, so knowing which regime a
 * strategy's edge lives in — and whether we're in that regime now — is the honest way
 * to adjust selection. ── */
function autoRegimeAt(f, i, volMed) {
  if (!f || i == null || i < 1) return null;
  const dir = f.trend[i] > 0 ? "up" : f.trend[i] < 0 ? "down" : "flat";
  const adx = f.adx[i] || 0;
  const strength = adx >= 25 ? "strong" : adx >= 18 ? "mild" : "weak";
  const atrPct = f.closes[i] ? (f.atr[i] / f.closes[i]) * 100 : 0;
  const vol = volMed > 0 ? (atrPct > volMed * 1.3 ? "wild" : atrPct < volMed * 0.7 ? "calm" : "normal") : "normal";
  return { key: `${dir}·${strength}·${vol}`, dir, strength, vol, adx, atrPct };
}

// median ATR% over the series — the yardstick "wild vs calm" is measured against
function autoVolMedian(f) {
  const v = [];
  for (let i = 55; i < f.n; i++) if (f.closes[i]) v.push((f.atr[i] / f.closes[i]) * 100);
  if (!v.length) return 0;
  v.sort((a, b) => a - b);
  return v[Math.floor(v.length / 2)];
}

/* Where does this strategy's edge actually live? Replays its trades and attributes
 * each outcome to the regime at ENTRY, so you can see it earns in trends and bleeds in
 * chop (or whatever the truth is). Returns per-regime stats + the current regime. */
function autoRegimeFit(candles, genes, cfg) {
  if (!candles || candles.length < 200 || typeof computeFeatures !== "function" || typeof genesEntry !== "function") return null;
  cfg = cfg || {};
  const f = computeFeatures(candles);
  const volMed = autoVolMedian(f);
  const long = genes.side === "buy";
  const H = 24, feeRate = 0.055 / 100, slipRate = 0.02 / 100;
  const by = {};
  let i = 55;
  while (i <= candles.length - 2) {
    if (!genesEntry(genes, f, i)) { i++; continue; }
    const reg = autoRegimeAt(f, i, volMed);
    const entry = f.closes[i], atr = f.atr[i] || entry * 0.004;
    const slD = atr * (genes.slAtr || 1.5);
    const sl = long ? entry - slD : entry + slD;
    const tp = long ? entry + slD * (genes.tpR || 1.8) : entry - slD * (genes.tpR || 1.8);
    let R = null, xi = Math.min(i + H, candles.length - 1);
    for (let j = i + 1; j <= Math.min(i + H, candles.length - 1); j++) {
      const c = candles[j];
      if (long) { if (c.lo <= sl) { R = -1; xi = j; break; } if (c.hi >= tp) { R = genes.tpR || 1.8; xi = j; break; } }
      else { if (c.hi >= sl) { R = -1; xi = j; break; } if (c.lo <= tp) { R = genes.tpR || 1.8; xi = j; break; } }
    }
    if (R === null) { const xp = f.closes[xi]; const mv = long ? xp - entry : entry - xp; R = Math.max(-1, Math.min(genes.tpR || 1.8, mv / slD)); }
    // costs in R terms, so regimes are compared after fees + slippage
    const costR = slD > 0 ? (entry * (feeRate + slipRate) * 2) / slD : 0;
    const net = R - costR;
    const k = reg.key;
    if (!by[k]) by[k] = { regime: k, trades: 0, wins: 0, netR: 0 };
    by[k].trades++; if (net > 0) by[k].wins++; by[k].netR += net;
    i = xi + 1;
  }
  const rows = Object.values(by).map(r => ({
    ...r, netR: +r.netR.toFixed(2), winRate: r.trades ? r.wins / r.trades * 100 : 0,
    avgR: +(r.netR / r.trades).toFixed(3),
  })).sort((a, b) => b.netR - a.netR);
  return { rows, now: autoRegimeAt(f, candles.length - 1, volMed), volMed };
}

/* ── Does the agent actually make money? Replays its WHOLE loop over history with no
 * lookahead: at every bar it may only use candles up to that bar. It re-picks its
 * strategy on the live cadence (walk-forward + gate), enters only when the rules fire,
 * manages with the trailing stop, and pays the same fee + slippage. This measures the
 * economics of the AGENT — not of a strategy hand-picked with hindsight. ── */
async function autoBacktestAgent(candles, asset, cfg, onProgress) {
  if (!candles || candles.length < 600) return null;
  if (typeof computeFeatures !== "function" || typeof genesEntry !== "function" || typeof genesPlan !== "function") return null;
  cfg = cfg || {};
  const capital = cfg.capital || 10000;
  const riskPct = cfg.riskPct != null ? cfg.riskPct : 0.02;
  const levCap = cfg.levCap || 20;
  const feeRate = 0.055 / 100, slipRate = 0.02 / 100;   // same costs the live agent pays
  const repick = cfg.repickBars || 120;
  const warmup = cfg.warmup || 400;                     // the picker needs history to walk forward
  // how wide the trailing stop rides, as a multiple of the strategy's stop distance.
  // 0 = no trail (fixed stop only). Too tight and normal noise takes every trade out.
  const trailMult = cfg.trailMult != null ? cfg.trailMult : 1;

  const f = computeFeatures(candles);   // values at i only ever use bars <= i
  let equity = capital, peak = capital, maxDD = 0;
  const trades = [];
  let strat = null, pos = null;
  let picks = 0, picksWithEdge = 0, barsFlat = 0, barsIn = 0;

  for (let i = warmup; i < candles.length - 1; i++) {
    // re-pick on cadence — the picker only ever sees the past
    if ((i - warmup) % repick === 0) {
      strat = autoPickStrategy(candles.slice(0, i + 1), asset, { capital: equity, gate: cfg.gate });
      picks++; if (strat) picksWithEdge++;
      if (typeof onProgress === "function") onProgress({ bar: i, total: candles.length, picks, picksWithEdge, trades: trades.length, equity });
      await new Promise(r => setTimeout(r, 0));   // yield so the UI stays responsive
    }

    const bar = candles[i];

    if (pos) {
      barsIn++;
      const long = pos.side === "buy";
      // advance the trailing stop on this bar's extreme, then test exits (stop first)
      if (pos.trail) {
        if (long) { pos.hiWater = Math.max(pos.hiWater, bar.hi); pos.sl = Math.max(pos.sl, pos.hiWater * (1 - pos.trail)); }
        else { pos.loWater = Math.min(pos.loWater, bar.lo); pos.sl = Math.min(pos.sl, pos.loWater * (1 + pos.trail)); }
      }
      let exit = null, reason = null;
      if (long) {
        if (pos.liq && bar.lo <= pos.liq) { exit = pos.liq; reason = "liq"; }
        else if (bar.lo <= pos.sl) { exit = pos.sl; reason = pos.trail ? "trail" : "sl"; }
      } else {
        if (pos.liq && bar.hi >= pos.liq) { exit = pos.liq; reason = "liq"; }
        else if (bar.hi >= pos.sl) { exit = pos.sl; reason = pos.trail ? "trail" : "sl"; }
      }
      if (exit != null) {
        const gross = long ? (exit - pos.entry) * (pos.size / pos.entry) : (pos.entry - exit) * (pos.size / pos.entry);
        const cost = pos.size * (feeRate + slipRate) * 2;
        const pnl = gross - cost;
        equity = Math.max(1, equity + pnl);
        trades.push({ side: pos.side, entry: pos.entry, exit, pnl, reason, bar: i, strat: pos.strat });
        peak = Math.max(peak, equity);
        maxDD = Math.max(maxDD, peak > 0 ? (peak - equity) / peak * 100 : 0);
        pos = null;
      }
    } else {
      barsFlat++;
      // enter only while a gate-passing strategy is active and its rule fires
      if (strat && genesEntry(strat.genes, f, i)) {
        const plan = genesPlan(candles, f, strat.genes, { capital: equity, riskPct, levCap, idx: i });
        if (plan && plan.margin > 0) {
          pos = {
            side: plan.side, entry: plan.entry, size: plan.notional, sl: plan.sl, liq: plan.liq,
            trail: trailMult > 0 ? plan.slPct * trailMult : 0,
            hiWater: plan.entry, loWater: plan.entry, strat: strat.name,
          };
        }
      }
    }
  }

  const wins = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl <= 0);
  const gW = wins.reduce((s, t) => s + t.pnl, 0);
  const gL = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const net = equity - capital;
  return {
    trades: trades.length, wins: wins.length, losses: losses.length,
    winRate: trades.length ? wins.length / trades.length * 100 : 0,
    net, roi: net / capital * 100, equity,
    pf: gL > 0 ? gW / gL : (gW > 0 ? Infinity : 0),
    maxDD, avg: trades.length ? net / trades.length : 0,
    picks, picksWithEdge, barsFlat, barsIn,
    byReason: trades.reduce((m, t) => { m[t.reason] = (m[t.reason] || 0) + 1; return m; }, {}),
    list: trades.slice(-8),
  };
}

/* ── Are the terminal's ENTRY POINTS actually profitable?
 *
 * The agent (lab strategies) and the "найти точку входа" planner are two different
 * systems — measuring one says nothing about the other. This replays optimalEntry
 * over history with no lookahead: at each flat bar it asks for a plan using only past
 * candles, takes it exactly as the terminal would (market now, or a limit that rests
 * and fills on a wick touch), manages to the plan's own stop/target, and pays the same
 * fee + slippage. Result: what the entry signals really earn. ── */
async function entrySignalEconomics(candles, cfg, onProgress) {
  if (!candles || candles.length < 400 || typeof optimalEntry !== "function") return null;
  cfg = cfg || {};
  const capital = cfg.capital || 10000;
  const feeRate = 0.055 / 100, slipRate = 0.02 / 100;
  const warmup = cfg.warmup || 120;      // optimalEntry needs history for its levels
  const restBars = cfg.restBars || 24;   // how long a limit order waits before it's cancelled
  let equity = capital, peak = capital, maxDD = 0;
  const trades = [];
  let pos = null, order = null;
  let evaluated = 0, plans = 0, taken = 0, expired = 0;

  for (let i = warmup; i < candles.length - 1; i++) {
    const bar = candles[i];

    // 1. manage an open position — stop first (conservative), then target
    if (pos) {
      const long = pos.side === "buy";
      let exit = null, reason = null;
      if (long) {
        if (bar.lo <= pos.sl) { exit = pos.sl; reason = "sl"; }
        else if (bar.hi >= pos.tp) { exit = pos.tp; reason = "tp"; }
      } else {
        if (bar.hi >= pos.sl) { exit = pos.sl; reason = "sl"; }
        else if (bar.lo <= pos.tp) { exit = pos.tp; reason = "tp"; }
      }
      if (exit != null) {
        const gross = long ? (exit - pos.entry) * (pos.size / pos.entry) : (pos.entry - exit) * (pos.size / pos.entry);
        const pnl = gross - pos.size * (feeRate + slipRate) * 2;
        equity = Math.max(1, equity + pnl);
        trades.push({ side: pos.side, entry: pos.entry, exit, pnl, reason, evR: pos.evR, conf: pos.conf, type: pos.type });
        peak = Math.max(peak, equity);
        maxDD = Math.max(maxDD, peak > 0 ? (peak - equity) / peak * 100 : 0);
        pos = null;
      }
      continue;
    }

    // 2. a resting limit fills on a wick touch, or expires
    if (order) {
      const hit = order.side === "buy" ? bar.lo <= order.entry : bar.hi >= order.entry;
      if (hit) { pos = { ...order, type: "limit" }; taken++; order = null; }
      else if (i - order.placed >= restBars) { order = null; expired++; }
      continue;
    }

    // 3. flat → ask the terminal for a plan, using only the past
    const hist = candles.slice(0, i + 1);
    let p = null;
    try { p = optimalEntry(hist, { budget: equity, maxLev: cfg.maxLev || 50 }); } catch (_) { p = null; }
    evaluated++;
    if (p && (!cfg.requireSetup || p.setup) && (!cfg.requireEdge || p.positiveEdge)) {
      plans++;
      const base = { side: p.side, entry: p.entry, sl: p.sl, tp: p.tp, size: p.notional, evR: p.evR, conf: p.conf };
      if (p.entryType === "limit") order = { ...base, placed: i };
      else { pos = { ...base, type: "market" }; taken++; }
    }
    if (evaluated % 20 === 0) {
      if (typeof onProgress === "function") onProgress({ bar: i, total: candles.length, trades: trades.length, equity });
      await new Promise(r => setTimeout(r, 0));
    }
  }

  const wins = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl <= 0);
  const gW = wins.reduce((s, t) => s + t.pnl, 0);
  const gL = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const net = equity - capital;
  return {
    trades: trades.length, wins: wins.length, losses: losses.length,
    winRate: trades.length ? wins.length / trades.length * 100 : 0,
    net, roi: net / capital * 100, equity,
    pf: gL > 0 ? gW / gL : (gW > 0 ? Infinity : 0),
    maxDD, avg: trades.length ? net / trades.length : 0,
    plans, taken, expired, evaluated,
    byReason: trades.reduce((m, t) => { m[t.reason] = (m[t.reason] || 0) + 1; return m; }, {}),
    byType: trades.reduce((m, t) => { m[t.type] = (m[t.type] || 0) + 1; return m; }, {}),
    avgEvR: trades.length ? trades.reduce((s, t) => s + (t.evR || 0), 0) / trades.length : 0,
  };
}

/* ── Consensus: overlay every strategy on the same bar and count the votes.
 * A strategy is a fixed-side rule set, so "voting" = how many of them fire long vs
 * short right now. NOTE the library is structurally long-biased (9 buy / 4 sell), so
 * raw vote counts are not symmetric — compare agreement levels, not sides. ── */
function consensusVotes(f, i, lib) {
  let long = 0, short = 0;
  const who = [];
  lib.forEach(s => {
    if (typeof genesEntry === "function" && genesEntry(s.genes, f, i)) {
      if (s.genes.side === "buy") long++; else short++;
      who.push(s.name);
    }
  });
  return { long, short, net: long - short, total: long + short, who };
}

/* Does agreement actually predict anything? For every bar, count the votes, take the
 * majority side with a standard ATR stop/target, and record the outcome bucketed by
 * how many strategies agreed. If accuracy rises with agreement there is something to
 * use; if it is flat, overlaying strategies adds nothing but the illusion of support.
 * Costs (fee + slippage) are charged in R, same as everywhere else. */
function consensusEconomics(candles, cfg) {
  if (!candles || candles.length < 300 || typeof computeFeatures !== "function" || typeof strategyLibrary !== "function") return null;
  cfg = cfg || {};
  const lib = strategyLibrary();
  const f = computeFeatures(candles);
  const H = cfg.horizon || 24, slAtrMult = cfg.slAtr || 1.5, tpR = cfg.tpR || 1.8;
  const FEE = 0.00055, SLIP = 0.0002;
  const buckets = {};   // agreement level -> stats

  let i = 55;
  while (i <= candles.length - 2) {
    const v = consensusVotes(f, i, lib);
    if (v.total < 1) { i++; continue; }
    const side = v.net > 0 ? "buy" : v.net < 0 ? "sell" : null;
    if (!side) { i++; continue; }
    const agree = Math.abs(v.net);                 // how many net strategies agree
    const long = side === "buy";
    const entry = f.closes[i], atr = f.atr[i] || entry * 0.004;
    const slD = atr * slAtrMult;
    const sl = long ? entry - slD : entry + slD;
    const tp = long ? entry + slD * tpR : entry - slD * tpR;
    let R = null, xi = Math.min(i + H, candles.length - 1);
    for (let j = i + 1; j <= Math.min(i + H, candles.length - 1); j++) {
      const c = candles[j];
      if (long) { if (c.lo <= sl) { R = -1; xi = j; break; } if (c.hi >= tp) { R = tpR; xi = j; break; } }
      else { if (c.hi >= sl) { R = -1; xi = j; break; } if (c.lo <= tp) { R = tpR; xi = j; break; } }
    }
    if (R === null) { const xp = f.closes[xi]; const mv = long ? xp - entry : entry - xp; R = Math.max(-1, Math.min(tpR, mv / slD)); }
    const costR = slD > 0 ? (entry * (FEE + SLIP) * 2) / slD : 0;
    const net = R - costR;
    const k = String(agree);
    if (!buckets[k]) buckets[k] = { agree, trades: 0, wins: 0, netR: 0 };
    buckets[k].trades++; if (net > 0) buckets[k].wins++; buckets[k].netR += net;
    i = xi + 1;
  }

  const rows = Object.values(buckets).map(b => ({
    agree: b.agree, trades: b.trades, wins: b.wins,
    winRate: b.trades ? +(b.wins / b.trades * 100).toFixed(1) : 0,
    avgR: +(b.netR / b.trades).toFixed(3), netR: +b.netR.toFixed(2),
  })).sort((a, b) => a.agree - b.agree);
  return { rows, breakevenWinRate: +(1 / (1 + tpR) * 100).toFixed(1) };
}

/* ── Do positioning data actually predict price?
 *
 * Every indicator in this app re-reads the same candles, so none of them can know
 * anything the market has not already priced. Funding, open interest and the long/short
 * split are different in kind: they describe who is positioned how, not where price has
 * been. That makes them the first genuinely new information here — and therefore worth
 * measuring rather than assuming.
 *
 * Method: line each metric up with the hourly closes, then measure the return AFTER the
 * metric was known (never before), bucket by tercile, and report the correlation with
 * the sample size. No trading rule is derived here — first find out whether there is
 * any signal at all. ── */
async function derivPredictivePower(symbol, cfg) {
  cfg = cfg || {};
  if (typeof bybitFetchKlines !== "function" || typeof bybitFundingHistory !== "function") return null;
  const horizons = cfg.horizons || [1, 4, 8, 24];   // hours ahead
  const [k, fund, oi, ls] = await Promise.all([
    bybitFetchKlines(symbol, "60", 1000, "linear"),
    bybitFundingHistory(symbol, 200).catch(() => []),
    bybitOpenInterestHistory(symbol, "1h", 200).catch(() => []),
    bybitLongShortHistory(symbol, "1h", 200).catch(() => []),
  ]);
  if (!k || k.length < 100) return null;

  const HOUR = 3600000;
  const closeAt = new Map();
  k.forEach(c => closeAt.set(Math.floor(c.start / HOUR) * HOUR, c.close));
  const fwd = (ts, h) => {
    const t0 = Math.floor(ts / HOUR) * HOUR;
    const p0 = closeAt.get(t0), p1 = closeAt.get(t0 + h * HOUR);
    return (p0 == null || p1 == null) ? null : (p1 - p0) / p0 * 100;
  };
  const pearson = (xs, ys) => {
    const n = xs.length; if (n < 8) return null;
    const mx = xs.reduce((s, v) => s + v, 0) / n, my = ys.reduce((s, v) => s + v, 0) / n;
    let num = 0, dx = 0, dy = 0;
    for (let i = 0; i < n; i++) { const a = xs[i] - mx, b = ys[i] - my; num += a * b; dx += a * a; dy += b * b; }
    return (dx > 0 && dy > 0) ? +(num / Math.sqrt(dx * dy)).toFixed(3) : null;
  };
  // split the metric into terciles and report the mean forward return of each
  const terciles = pairs => {
    if (pairs.length < 12) return null;
    const sorted = [...pairs].sort((a, b) => a.x - b.x);
    const c = Math.floor(sorted.length / 3);
    const mean = arr => arr.length ? +(arr.reduce((s, p) => s + p.y, 0) / arr.length).toFixed(3) : null;
    return {
      low: { n: c, meanFwdPct: mean(sorted.slice(0, c)) },
      mid: { n: sorted.length - 2 * c, meanFwdPct: mean(sorted.slice(c, sorted.length - c)) },
      high: { n: c, meanFwdPct: mean(sorted.slice(-c)) },
    };
  };

  const out = { symbol, klines: k.length, metrics: {} };
  const study = (name, series, valueOf) => {
    if (!series || series.length < 12) { out.metrics[name] = { skipped: "мало данных", points: series ? series.length : 0 }; return; }
    const per = {};
    horizons.forEach(h => {
      const pairs = [];
      series.forEach((row, idx) => {
        const x = valueOf(row, idx, series);
        if (x == null || !isFinite(x)) return;
        const y = fwd(row.ts, h);
        if (y == null) return;
        pairs.push({ x, y });
      });
      per[`${h}ч`] = pairs.length < 12 ? { n: pairs.length, note: "мало пар" }
        : { n: pairs.length, corr: pearson(pairs.map(p => p.x), pairs.map(p => p.y)), terciles: terciles(pairs) };
    });
    out.metrics[name] = per;
  };

  study("funding", fund, r => r.rate * 100);                         // % per 8h
  study("longShortRatio", ls, r => r.buyRatio);                      // share of accounts long
  study("oiChangePct", oi, (r, i, s) => i === 0 ? null : (r.oi - s[i - 1].oi) / s[i - 1].oi * 100);
  return out;
}

Object.assign(window, {
  autoPickStrategy, autoEntry, autoScanAssets, autoTrain, autoBacktestAgent,
  autoRegimeAt, autoRegimeFit, autoVolMedian, entrySignalEconomics,
  consensusVotes, consensusEconomics, derivPredictivePower, AUTO_GATE,
});
