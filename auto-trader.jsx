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

// Pick the strategy the agent should trade now. Runs the lab (library + a fresh
// generation + strategies evolved from this asset's champions), records the positive
// ones as champions (so performance accrues across runs), and returns the top
// performer's genes + a stats summary. This is the "it learns" step.
function autoPickStrategy(candles, asset, cfg) {
  if (!candles || candles.length < 60 || typeof runSimLab !== "function") return null;
  cfg = cfg || {};
  const champs = (typeof loadChampions === "function" ? loadChampions() : []).filter(c => c.asset === asset && c.genes);
  const seeds = champs.slice(0, 4).map(c => c.genes);
  const rows = runSimLab(candles, { capital: cfg.capital || 10000, leverage: 1, fees: 0.055, genCount: 8 }, seeds);
  if (!rows || !rows.length) return null;
  if (typeof recordChampions === "function") { try { recordChampions(rows, asset, Date.now()); } catch (_) {} }
  const top = rows.find(r => r.totalReturn > 0) || rows[0];
  if (!top || !top.genes) return null;
  return {
    genes: top.genes, name: top.name, source: top.source,
    roi: top.totalReturn, win: top.winRate, trades: top.trades, pf: top.profitFactor,
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

Object.assign(window, { autoPickStrategy, autoEntry, autoScanAssets });
