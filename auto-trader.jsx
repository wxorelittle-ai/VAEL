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

/* Pick the strategy the agent should trade now — WALK-FORWARD.
 *
 * The trap this avoids: running the lab on a window and then trading whatever scored
 * best on that same window is selection on noise — you pick the curve that happened
 * to fit those exact bars. So we split the candles:
 *   • TRAIN (older ~60%) — the lab searches here: library + a fresh generation +
 *     strategies evolved from this asset's champions.
 *   • TEST (recent ~40%) — every candidate is then re-backtested on these bars,
 *     which the search never saw, and the gate is applied to THAT result.
 * Only a strategy that keeps its edge out-of-sample is tradable; otherwise null and
 * the agent waits. Champions are still recorded from the train run (that's the
 * learning), but they never buy a pass on their own. */
function autoPickStrategy(candles, asset, cfg) {
  if (!candles || candles.length < 160 || typeof runSimLab !== "function") return null;
  cfg = cfg || {};
  const capital = cfg.capital || 10000;
  const gate = cfg.gate || AUTO_GATE;

  const split = Math.floor(candles.length * 0.6);
  const train = candles.slice(0, split);
  const test = candles.slice(split);
  if (train.length < 100 || test.length < 60) return null;

  const champs = (typeof loadChampions === "function" ? loadChampions() : []).filter(c => c.asset === asset && c.genes);
  const seeds = champs.slice(0, 4).map(c => c.genes);
  const rows = runSimLab(train, { capital, leverage: 1, fees: 0.055, genCount: 8 }, seeds);
  if (!rows || !rows.length) return null;
  if (typeof recordChampions === "function") { try { recordChampions(rows, asset, Date.now()); } catch (_) {} }

  // re-test every candidate on the unseen slice — this is the number that counts
  if (typeof computeFeatures !== "function" || typeof backtestGenes !== "function") return null;
  const tf = computeFeatures(test);
  const oos = rows.filter(r => r.genes).map(r => {
    const b = backtestGenes(test, tf, r.genes, { capital, leverage: 1, fees: 0.055 });
    return { name: r.name, source: r.source, genes: r.genes, inRoi: r.totalReturn, ...b.stats };
  });

  // Gate on OUT-OF-SAMPLE performance. No fallback to "least-bad loser".
  const passing = oos.filter(r => r.trades >= gate.minTrades
    && r.profitFactor >= gate.minPf
    && r.totalReturn > gate.minRoi);
  if (!passing.length) return null;

  passing.sort((a, b) => b.totalReturn - a.totalReturn);
  const top = passing[0];
  return {
    genes: top.genes, name: top.name, source: top.source,
    roi: top.totalReturn, win: top.winRate, trades: top.trades, pf: top.profitFactor,
    inRoi: top.inRoi,                       // what it scored on the train slice
    considered: oos.length, passed: passing.length, oos: true,
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

Object.assign(window, { autoPickStrategy, autoEntry, autoScanAssets, autoTrain, AUTO_GATE });
