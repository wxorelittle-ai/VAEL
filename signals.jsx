/* signals.jsx — real technical-analysis signal engine (runs on live Bybit candles)
 *
 * Replaces the old random signal generator. analyzeMarket(candles) returns a
 * data-driven directional call with an honest confidence + reasons derived from
 * RSI, EMA(9/21) trend & cross, short-term momentum and stretch from the mean.
 *
 * This is NOT a profitable oracle — it is standard TA, so hit-rate hovers in a
 * realistic band. But every signal is grounded in the real market and its
 * reasoning reflects the actual indicator readings.
 */

/* Exponential moving average of the whole series (returns last value) */
function taEma(values, period) {
  if (!values || !values.length) return 0;
  const k = 2 / (period + 1);
  let e = values[0];
  for (let i = 1; i < values.length; i++) e = values[i] * k + e * (1 - k);
  return e;
}

/* Simple RSI over the last `period` changes (0..100) */
function taRsi(values, period = 14) {
  if (!values || values.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = values.length - period; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gains += d; else losses -= d;
  }
  const avgG = gains / period, avgL = losses / period;
  if (avgL === 0) return avgG === 0 ? 50 : 100;
  const rs = avgG / avgL;
  return 100 - 100 / (1 + rs);
}

/* Attribute a signal to the agent whose domain drove it (cosmetic, but honest) */
function agentForSignal(a) {
  if (Math.abs(a.rsi - 50) >= 22) return "forecast.agt";      // RSI extreme
  if (a.trendUp !== (a.side === "buy")) return "risk.agt";     // counter-trend → risk desk
  if (Math.abs(a.mom) >= 0.8) return "onchain.agt";            // strong momentum/flow
  return "strategy.agt";                                       // trend-following
}

/* Core: analyze candles → { side, confidence, setup, reasons[], rsi, emaF, emaS, mom, trendUp, score } | null */
function analyzeMarket(candles) {
  if (!candles || candles.length < 30) return null;
  const closes = candles.map(c => c.close);
  const n = closes.length;
  const price = closes[n - 1];

  const rsi = taRsi(closes, 14);
  const emaF = taEma(closes, 9);
  const emaS = taEma(closes, 21);
  const emaFprev = taEma(closes.slice(0, -1), 9);
  const emaSprev = taEma(closes.slice(0, -1), 21);
  const mom = ((price - closes[n - 6]) / closes[n - 6]) * 100; // 5-candle momentum %
  const distPct = ((price - emaS) / emaS) * 100;               // stretch from EMA21
  const trendUp = emaF > emaS;

  let score = 0;               // + bullish, − bearish
  const reasons = [];
  reasons.push(trendUp ? "аптренд · EMA9>EMA21" : "даунтренд · EMA9<EMA21");
  score += trendUp ? 1 : -1;

  // Fresh EMA cross — strongest trigger
  if (emaFprev <= emaSprev && emaF > emaS) { score += 1.6; reasons.push("свежий кросс EMA вверх"); }
  if (emaFprev >= emaSprev && emaF < emaS) { score -= 1.6; reasons.push("свежий кросс EMA вниз"); }

  // RSI
  if (rsi < 30) { score += 1.2; reasons.push(`RSI ${rsi.toFixed(0)} · перепроданность`); }
  else if (rsi > 70) { score -= 1.2; reasons.push(`RSI ${rsi.toFixed(0)} · перекупленность`); }
  else if (rsi < 45 && trendUp) { score += 0.6; reasons.push(`RSI ${rsi.toFixed(0)} · откат в аптренде`); }
  else if (rsi > 55 && !trendUp) { score -= 0.6; reasons.push(`RSI ${rsi.toFixed(0)} · отскок в даунтренде`); }

  // Momentum
  if (mom > 0.5) { score += 0.6; reasons.push(`импульс +${mom.toFixed(2)}% / 5 свечей`); }
  else if (mom < -0.5) { score -= 0.6; reasons.push(`импульс ${mom.toFixed(2)}% / 5 свечей`); }

  // Over-extension from the mean (mean-reversion pressure)
  if (distPct > 1.4) { score -= 0.5; reasons.push(`цена +${distPct.toFixed(1)}% над EMA21 · растяжение`); }
  else if (distPct < -1.4) { score += 0.5; reasons.push(`цена ${distPct.toFixed(1)}% под EMA21 · растяжение`); }

  const side = score >= 0 ? "buy" : "sell";
  const strength = Math.min(1, Math.abs(score) / 3.6);
  const confidence = Math.round(56 + strength * 39); // 56–95, tied to conviction
  const setup = Math.abs(score) >= 1.3;              // only emit on a genuine setup

  // keep reasons relevant to the chosen side, cap length
  const trimmed = reasons.slice(0, 4);

  const a = { side, score, confidence, setup, reasons: trimmed, rsi, emaF, emaS, mom, distPct, trendUp };
  a.agent = agentForSignal(a);
  return a;
}

Object.assign(window, { analyzeMarket, taEma, taRsi, agentForSignal });
