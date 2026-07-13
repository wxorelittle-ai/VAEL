/* signals.jsx — real technical-analysis signal engine (runs on live Bybit candles)
 *
 * analyzeMarket(candles) returns a data-driven directional call with an honest
 * confidence, ATR-based SL/TP levels, and reasons derived from a confluence of:
 *   • dominant trend  — price vs EMA50 + EMA9/EMA21 stack
 *   • momentum        — MACD(12,26,9) histogram direction
 *   • trigger         — fresh EMA9/EMA21 cross
 *   • entry timing    — RSI pullback IN the trend direction (not knife-catching)
 *   • confirmation    — relative volume + ATR volatility gate
 *
 * Signals only fire on genuine, trend-aligned setups (|score| ≥ 2.0), which is
 * what makes the output far less noisy than a raw 1-indicator flip. This is
 * standard TA, not an oracle — but every call is grounded in the real market.
 */

/* EMA of the whole series → last value */
function taEma(values, period) {
  if (!values || !values.length) return 0;
  const k = 2 / (period + 1);
  let e = values[0];
  for (let i = 1; i < values.length; i++) e = values[i] * k + e * (1 - k);
  return e;
}

/* EMA of the whole series → full series (needed for MACD) */
function taEmaSeries(values, period) {
  const k = 2 / (period + 1);
  const out = [];
  let e = values[0];
  out.push(e);
  for (let i = 1; i < values.length; i++) { e = values[i] * k + e * (1 - k); out.push(e); }
  return out;
}

/* Wilder-ish RSI over the last `period` changes (0..100) */
function taRsi(values, period = 14) {
  if (!values || values.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = values.length - period; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gains += d; else losses -= d;
  }
  const avgG = gains / period, avgL = losses / period;
  if (avgL === 0) return avgG === 0 ? 50 : 100;
  return 100 - 100 / (1 + avgG / avgL);
}

/* MACD(12,26,9) → current + previous histogram */
function taMacd(values, fast = 12, slow = 26, signalP = 9) {
  if (!values || values.length < slow + signalP) return { macd: 0, signal: 0, hist: 0, histPrev: 0 };
  const ef = taEmaSeries(values, fast);
  const es = taEmaSeries(values, slow);
  const macdLine = values.map((_, i) => ef[i] - es[i]);
  const sig = taEmaSeries(macdLine, signalP);
  const n = macdLine.length;
  return {
    macd: macdLine[n - 1], signal: sig[n - 1],
    hist: macdLine[n - 1] - sig[n - 1],
    histPrev: macdLine[n - 2] - sig[n - 2],
  };
}

/* Average True Range over `period` candles */
function taAtr(candles, period = 14) {
  if (!candles || candles.length < period + 1) return 0;
  let sum = 0;
  for (let i = candles.length - period; i < candles.length; i++) {
    const c = candles[i], p = candles[i - 1];
    sum += Math.max(c.hi - c.lo, Math.abs(c.hi - p.close), Math.abs(c.lo - p.close));
  }
  return sum / period;
}

/* Attribute a signal to the agent whose domain drove it (cosmetic, but honest) */
function agentForSignal(a) {
  const macdTurn = a.macd && ((a.side === "buy" && a.macd.hist > 0 && a.macd.histPrev <= 0) ||
                              (a.side === "sell" && a.macd.hist < 0 && a.macd.histPrev >= 0));
  if (!a.aligned) return "risk.agt";            // counter-trend → risk desk
  if (macdTurn) return "forecast.agt";          // momentum inflection
  if (a.volRatio >= 1.6) return "onchain.agt";  // volume/flow surge
  return "strategy.agt";                        // trend-following
}

/* Core analysis → signal object | null */
function analyzeMarket(candles) {
  if (!candles || candles.length < 55) return null;   // need EMA50 + MACD warmup
  const closes = candles.map(c => c.close);
  const vols = candles.map(c => c.v);
  const n = closes.length;
  const price = closes[n - 1];

  const rsi = taRsi(closes, 14);
  const emaF = taEma(closes, 9);
  const emaS = taEma(closes, 21);
  const ema50 = taEma(closes, 50);
  const emaFprev = taEma(closes.slice(0, -1), 9);
  const emaSprev = taEma(closes.slice(0, -1), 21);
  const macd = taMacd(closes);
  const atr = taAtr(candles, 14);
  const atrPct = price ? (atr / price) * 100 : 0;
  const mom = ((price - closes[n - 6]) / closes[n - 6]) * 100;
  const avgVol = vols.slice(-20).reduce((s, v) => s + v, 0) / Math.min(20, vols.length);
  const volRatio = avgVol > 0 ? vols[n - 1] / avgVol : 1;

  // Dominant trend: price vs EMA50 AND EMA9/21 stack must agree
  const trendUp = price > ema50 && emaF > emaS;
  const trendDn = price < ema50 && emaF < emaS;
  const trendDir = trendUp ? 1 : trendDn ? -1 : 0;

  let score = 0;
  const reasons = [];

  // 1) Dominant trend
  if (trendUp) { score += 1.4; reasons.push("аптренд · цена>EMA50 · EMA9>EMA21"); }
  else if (trendDn) { score -= 1.4; reasons.push("даунтренд · цена<EMA50 · EMA9<EMA21"); }
  else { reasons.push("боковик · тренд не подтверждён"); }

  // 2) MACD momentum
  if (macd.hist > 0 && macd.hist >= macd.histPrev) { score += 0.9; reasons.push("MACD-гистограмма растёт"); }
  else if (macd.hist < 0 && macd.hist <= macd.histPrev) { score -= 0.9; reasons.push("MACD-гистограмма падает"); }

  // 3) Fresh EMA cross — strongest trigger
  if (emaFprev <= emaSprev && emaF > emaS) { score += 1.2; reasons.push("свежий кросс EMA9↗EMA21"); }
  if (emaFprev >= emaSprev && emaF < emaS) { score -= 1.2; reasons.push("свежий кросс EMA9↘EMA21"); }

  // 4) RSI entry timing — pullback in the trend direction, not counter-trend
  if (trendUp && rsi < 45) { score += 0.9; reasons.push(`RSI ${rsi.toFixed(0)} · откат в аптренде — вход`); }
  else if (trendDn && rsi > 55) { score -= 0.9; reasons.push(`RSI ${rsi.toFixed(0)} · отскок в даунтренде — вход`); }
  else if (rsi > 72) { score -= 0.5; reasons.push(`RSI ${rsi.toFixed(0)} · перекупленность`); }
  else if (rsi < 28) { score += 0.5; reasons.push(`RSI ${rsi.toFixed(0)} · перепроданность`); }

  // 5) Volume confirmation (only credits the prevailing trend)
  if (volRatio > 1.6 && trendDir !== 0) {
    score += trendDir * 0.5;
    reasons.push(`объём ${volRatio.toFixed(1)}× среднего · подтверждение`);
  }

  const side = score >= 0 ? "buy" : "sell";
  const aligned = (side === "buy" && trendDir >= 0) || (side === "sell" && trendDir <= 0);
  const strength = Math.min(1, Math.abs(score) / 4.2);
  const confidence = Math.round(55 + strength * 40);   // 55–95, tied to conviction

  // A genuine setup needs conviction, trend alignment and real volatility
  const setup = Math.abs(score) >= 2.0 && aligned && atrPct > 0.05;

  // ATR-based risk levels (~1 : 1.8 reward:risk)
  const slDist = Math.max(atr * 1.5, price * 0.004);
  const tpDist = slDist * 1.8;
  const sl = side === "buy" ? price - slDist : price + slDist;
  const tp = side === "buy" ? price + tpDist : price - tpDist;

  const a = {
    side, score, confidence, setup, aligned,
    reasons: reasons.slice(0, 4),
    rsi, emaF, emaS, ema50, macd, atr, atrPct, mom, volRatio,
    trendUp: trendDir > 0, trendDir, sl, tp, rr: 1.8,
  };
  a.agent = agentForSignal(a);
  return a;
}

/* ─────────────────────────────────────────────────────────
 * Real market-metrics — replaces the old random анимация/genSpark tiles.
 * All values are derived from live Bybit candles + derivatives context.
 * ────────────────────────────────────────────────────────*/

/* Per-candle volume z-score vs trailing window → { series, count(spikes), last } */
function taVolAnomaly(vols, lookback = 20, tail = 40) {
  const z = [];
  for (let i = 0; i < vols.length; i++) {
    const w = vols.slice(Math.max(0, i - lookback), i);
    if (w.length < 5) { z.push(0); continue; }
    const m = w.reduce((s, v) => s + v, 0) / w.length;
    const sd = Math.sqrt(w.reduce((s, v) => s + (v - m) ** 2, 0) / w.length) || 1;
    z.push((vols[i] - m) / sd);
  }
  const series = z.slice(-tail);
  return { series, count: series.filter(x => x > 2).length, last: z[z.length - 1] || 0 };
}

/* candles + optional {ticker, linear, longShort} → real market metrics | null */
function computeMarketMetrics(candles, ctx = {}) {
  if (!candles || candles.length < 30) return null;
  const closes = candles.map(c => c.close);
  const vols = candles.map(c => c.v);
  const n = closes.length, price = closes[n - 1];
  const { ticker, linear, longShort } = ctx;

  // volatility
  const atr = taAtr(candles, 14);
  const atrPct = price ? atr / price * 100 : 0;
  const rets = [];
  for (let i = Math.max(1, n - 20); i < n; i++) rets.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  const meanRet = rets.reduce((s, x) => s + x, 0) / (rets.length || 1);
  const realizedVolPct = Math.sqrt(rets.reduce((s, x) => s + (x - meanRet) ** 2, 0) / (rets.length || 1)) * 100;

  // volume anomaly (z-score)
  const anom = taVolAnomaly(vols, 20, 40);

  // sentiment: crowd long/short + funding (fallback: price drift)
  let sentiment = 0, w = 0;
  if (longShort) { sentiment += (longShort.buyRatio - 0.5) * 2 * 0.6; w += 0.6; }
  if (linear) { sentiment += Math.tanh(linear.fundingRate * 2500) * 0.4; w += 0.4; }
  sentiment = w > 0 ? sentiment / w : Math.tanh(meanRet * 60);
  sentiment = Math.max(-1, Math.min(1, sentiment));

  // net flow ($M) — crowd skew applied to real 24h turnover
  const turnover = ticker ? ticker.turnover24h : (linear ? linear.turnover24h : 0);
  const skew = longShort ? (longShort.buyRatio - longShort.sellRatio) : Math.tanh(meanRet * 60);
  const flowNetM = skew * (turnover / 1e6) * 0.06;

  // composite risk index 0..10
  const fundingExt = linear ? Math.min(1, Math.abs(linear.fundingRate) / 0.0005) : 0;
  const riskIndex = Math.max(0, Math.min(10, atrPct * 2.2 + fundingExt * 3 + Math.min(3, Math.abs(anom.last))));

  // AI forecast — honest TA conviction
  const a = typeof analyzeMarket === "function" ? analyzeMarket(candles) : null;
  const forecast = a ? a.confidence : Math.round(60 + Math.min(30, Math.abs(meanRet) * 800));
  const forecastSide = a ? a.side : (meanRet >= 0 ? "buy" : "sell");

  // VWAP over the window
  let pv = 0, vv = 0;
  for (let i = 0; i < n; i++) { const tp = (candles[i].hi + candles[i].lo + candles[i].close) / 3; pv += tp * vols[i]; vv += vols[i]; }
  const vwap = vv > 0 ? pv / vv : price;

  const mom5 = n > 6 ? (price - closes[n - 6]) / closes[n - 6] * 100 : 0;

  return {
    price, atrPct, realizedVolPct, vwap, mom5,
    anomalyZ: anom.last, anomalyCount: anom.count, anomalySeries: anom.series,
    sentiment, flowNetM, riskIndex, forecast, forecastSide,
    signalSetup: a ? !!a.setup : false, signalSide: a ? a.side : null, signalConf: a ? a.confidence : forecast,
    volSeries: vols.slice(-40), closeSeries: closes.slice(-40),
    fundingRate: linear ? linear.fundingRate : null,
    buyRatio: longShort ? longShort.buyRatio : null,
    price24hPcnt: ticker && ticker.price24hPcnt != null ? ticker.price24hPcnt * 100 : null,
    turnover24h: turnover,
  };
}

Object.assign(window, {
  analyzeMarket, taEma, taEmaSeries, taRsi, taMacd, taAtr, agentForSignal,
  taVolAnomaly, computeMarketMetrics,
});
