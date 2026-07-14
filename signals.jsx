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

/* Simple moving average → full series (needed for StochRSI smoothing) */
function taSmaSeries(values, period) {
  const out = new Array(values.length).fill(0);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    out[i] = i >= period - 1 ? sum / period : values[i];
  }
  return out;
}

/* Wilder RSI → full series (needed for StochRSI) */
function taRsiSeries(values, period = 14) {
  const n = values.length;
  const out = new Array(n).fill(50);
  if (n < period + 1) return out;
  let avgG = 0, avgL = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) avgG += d; else avgL -= d;
  }
  avgG /= period; avgL /= period;
  out[period] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
  for (let i = period + 1; i < n; i++) {
    const d = values[i] - values[i - 1];
    const g = d > 0 ? d : 0, l = d < 0 ? -d : 0;
    avgG = (avgG * (period - 1) + g) / period;
    avgL = (avgL * (period - 1) + l) / period;
    out[i] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
  }
  return out;
}

/* Stochastic RSI → { k, d, kPrev, dPrev } (0..100). Cross of K over D = momentum trigger.
 * Ported (logic, not source) from Alorse/pinescript-strategies StochRSI setups. */
function taStochRsi(values, lenRSI = 14, lenStoch = 14, smoothK = 3, smoothD = 3) {
  const rsi = taRsiSeries(values, lenRSI);
  const n = rsi.length;
  if (n < lenRSI + lenStoch + smoothK + smoothD) return { k: 50, d: 50, kPrev: 50, dPrev: 50 };
  const raw = new Array(n).fill(50);
  for (let i = lenStoch - 1; i < n; i++) {
    let hi = -Infinity, lo = Infinity;
    for (let j = i - lenStoch + 1; j <= i; j++) { if (rsi[j] > hi) hi = rsi[j]; if (rsi[j] < lo) lo = rsi[j]; }
    raw[i] = hi === lo ? 0 : (rsi[i] - lo) / (hi - lo) * 100;
  }
  const k = taSmaSeries(raw, smoothK);
  const d = taSmaSeries(k, smoothD);
  const m = k.length;
  return { k: k[m - 1], d: d[m - 1], kPrev: k[m - 2], dPrev: d[m - 2] };
}

/* Supertrend(factor, atrPeriod) → { value, dir(+1 up / -1 down), dirPrev, flipUp, flipDown }.
 * Standard Wilder-ATR band with carry-over rules — the backbone of most strategies
 * in the ported PineScript library. */
function taSupertrend(candles, factor = 3, atrPeriod = 10) {
  const n = candles ? candles.length : 0;
  if (n < atrPeriod + 2) return { value: 0, dir: 0, dirPrev: 0, flipUp: false, flipDown: false };
  const tr = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    const c = candles[i], p = candles[i - 1];
    tr[i] = Math.max(c.hi - c.lo, Math.abs(c.hi - p.close), Math.abs(c.lo - p.close));
  }
  const atr = new Array(n).fill(0);
  let seed = 0;
  for (let i = 1; i <= atrPeriod; i++) seed += tr[i];
  atr[atrPeriod] = seed / atrPeriod;
  for (let i = atrPeriod + 1; i < n; i++) atr[i] = (atr[i - 1] * (atrPeriod - 1) + tr[i]) / atrPeriod;

  const fUpper = new Array(n).fill(0), fLower = new Array(n).fill(0), st = new Array(n).fill(0);
  const dir = new Array(n).fill(1);
  for (let i = atrPeriod; i < n; i++) {
    const c = candles[i], hl2 = (c.hi + c.lo) / 2;
    const bU = hl2 + factor * atr[i], bL = hl2 - factor * atr[i];
    if (i === atrPeriod) { fUpper[i] = bU; fLower[i] = bL; st[i] = bU; dir[i] = -1; continue; }
    const pClose = candles[i - 1].close;
    fUpper[i] = (bU < fUpper[i - 1] || pClose > fUpper[i - 1]) ? bU : fUpper[i - 1];
    fLower[i] = (bL > fLower[i - 1] || pClose < fLower[i - 1]) ? bL : fLower[i - 1];
    st[i] = st[i - 1] === fUpper[i - 1]
      ? (c.close > fUpper[i] ? fLower[i] : fUpper[i])
      : (c.close < fLower[i] ? fUpper[i] : fLower[i]);
    dir[i] = st[i] === fUpper[i] ? -1 : 1;   // line above price ⇒ downtrend
  }
  const d = dir[n - 1], dp = dir[n - 2];
  return { value: st[n - 1], dir: d, dirPrev: dp, flipUp: dp < 0 && d > 0, flipDown: dp > 0 && d < 0 };
}

/* Directional Movement Index → { plusDI, minusDI, adx }. ADX>20-25 = trending market;
 * use as a "don't trade the chop" gate. Wilder smoothing throughout. */
function taDmi(candles, period = 14) {
  const n = candles ? candles.length : 0;
  if (n < 2 * period + 1) return { plusDI: 0, minusDI: 0, adx: 0 };
  let smTR = 0, smPlus = 0, smMinus = 0;
  const dm = (c, p) => {
    const up = c.hi - p.hi, dn = p.lo - c.lo;
    return {
      plus: (up > dn && up > 0) ? up : 0,
      minus: (dn > up && dn > 0) ? dn : 0,
      tr: Math.max(c.hi - c.lo, Math.abs(c.hi - p.close), Math.abs(c.lo - p.close)),
    };
  };
  for (let i = 1; i <= period; i++) {
    const m = dm(candles[i], candles[i - 1]);
    smTR += m.tr; smPlus += m.plus; smMinus += m.minus;
  }
  const dxSeries = [];
  for (let i = period + 1; i < n; i++) {
    const m = dm(candles[i], candles[i - 1]);
    smTR = smTR - smTR / period + m.tr;
    smPlus = smPlus - smPlus / period + m.plus;
    smMinus = smMinus - smMinus / period + m.minus;
    const pDI = smTR ? 100 * smPlus / smTR : 0, mDI = smTR ? 100 * smMinus / smTR : 0;
    dxSeries.push((pDI + mDI) ? 100 * Math.abs(pDI - mDI) / (pDI + mDI) : 0);
  }
  const plusDI = smTR ? 100 * smPlus / smTR : 0, minusDI = smTR ? 100 * smMinus / smTR : 0;
  let adx = 0;
  if (dxSeries.length >= period) {
    adx = dxSeries.slice(0, period).reduce((s, x) => s + x, 0) / period;
    for (let i = period; i < dxSeries.length; i++) adx = (adx * (period - 1) + dxSeries[i]) / period;
  } else if (dxSeries.length) {
    adx = dxSeries.reduce((s, x) => s + x, 0) / dxSeries.length;
  }
  return { plusDI, minusDI, adx };
}

/* Bollinger Bands(period, mult) → { upper, mid, lower, pctB, bandwidth }.
 * SMA basis ± mult·σ. Independent implementation (own math, no GPL code) — unlocks
 * mean-reversion setups (e.g. long when price rides the lower band + RSI oversold).
 * pctB: 0 at lower band, 1 at upper. bandwidth (%): squeeze/expansion gauge. */
function taBollinger(values, period = 20, mult = 2) {
  const n = values ? values.length : 0;
  if (n < period) { const p = (values && values[n - 1]) || 0; return { upper: p, mid: p, lower: p, pctB: 0.5, bandwidth: 0 }; }
  const win = values.slice(n - period);
  const mid = win.reduce((s, v) => s + v, 0) / period;
  const sd = Math.sqrt(win.reduce((s, v) => s + (v - mid) ** 2, 0) / period);
  const upper = mid + mult * sd, lower = mid - mult * sd;
  const price = values[n - 1];
  return {
    upper, mid, lower,
    pctB: upper === lower ? 0.5 : (price - lower) / (upper - lower),
    bandwidth: mid ? (upper - lower) / mid * 100 : 0,
  };
}

/* Commodity Channel Index(period) → scalar. <-100 oversold, >+100 overbought.
 * Own implementation; only the CCI-reversal *idea* is reused from the GPL catalog. */
function taCci(candles, period = 20) {
  const n = candles ? candles.length : 0;
  if (n < period) return 0;
  const tp = candles.map(c => (c.hi + c.lo + c.close) / 3);
  const win = tp.slice(n - period);
  const sma = win.reduce((s, v) => s + v, 0) / period;
  const meanDev = win.reduce((s, v) => s + Math.abs(v - sma), 0) / period;
  return meanDev === 0 ? 0 : (tp[n - 1] - sma) / (0.015 * meanDev);
}

/* Parabolic SAR(step, maxAf) → { value, dir(+1 up / -1 down), flip }. Trailing
 * trend/stop dots. Standard Wilder iterative algorithm (own implementation). */
function taParabolicSar(candles, step = 0.02, maxAf = 0.2) {
  const n = candles ? candles.length : 0;
  if (n < 3) return { value: n ? candles[n - 1].close : 0, dir: 1, flip: false };
  let isUp = candles[1].close >= candles[0].close;
  let af = step;
  let ep = isUp ? candles[0].hi : candles[0].lo;
  let sar = isUp ? candles[0].lo : candles[0].hi;
  let dirBefore = isUp;
  for (let i = 1; i < n; i++) {
    const c = candles[i];
    dirBefore = isUp;
    let next = sar + af * (ep - sar);
    if (isUp) {
      next = Math.min(next, candles[i - 1].lo, candles[i >= 2 ? i - 2 : i - 1].lo);
      if (c.lo < next) { isUp = false; next = ep; ep = c.lo; af = step; }
      else if (c.hi > ep) { ep = c.hi; af = Math.min(maxAf, af + step); }
    } else {
      next = Math.max(next, candles[i - 1].hi, candles[i >= 2 ? i - 2 : i - 1].hi);
      if (c.hi > next) { isUp = true; next = ep; ep = c.hi; af = step; }
      else if (c.lo < ep) { ep = c.lo; af = Math.min(maxAf, af + step); }
    }
    sar = next;
  }
  return { value: sar, dir: isUp ? 1 : -1, flip: dirBefore !== isUp };
}

/* Awesome Oscillator → { value, prev }. SMA(median,5) − SMA(median,34); median=(hi+lo)/2.
 * Zero-cross / twin-peaks momentum. Own implementation. */
function taAwesome(candles, fast = 5, slow = 34) {
  const n = candles ? candles.length : 0;
  if (n < slow + 1) return { value: 0, prev: 0 };
  const mp = candles.map(c => (c.hi + c.lo) / 2);
  const sma = (p, end) => { let s = 0; for (let i = end - p + 1; i <= end; i++) s += mp[i]; return s / p; };
  const ao = end => sma(fast, end) - sma(slow, end);
  return { value: ao(n - 1), prev: ao(n - 2) };
}

/* Classic Stochastic → { k, d, kPrev, dPrev } (0..100). Slow %K = SMA(raw%K, smoothK),
 * %D = SMA(%K, smoothD). K crossing D from <20 = bullish trigger. Own implementation. */
function taStochastic(candles, length = 14, smoothK = 3, smoothD = 3) {
  const n = candles ? candles.length : 0;
  if (n < length + smoothK + smoothD) return { k: 50, d: 50, kPrev: 50, dPrev: 50 };
  const rawK = [];
  for (let i = length - 1; i < n; i++) {
    let hh = -Infinity, ll = Infinity;
    for (let j = i - length + 1; j <= i; j++) { if (candles[j].hi > hh) hh = candles[j].hi; if (candles[j].lo < ll) ll = candles[j].lo; }
    rawK.push(hh === ll ? 50 : (candles[i].close - ll) / (hh - ll) * 100);
  }
  const k = taSmaSeries(rawK, smoothK);
  const d = taSmaSeries(k, smoothD);
  const m = k.length;
  return { k: k[m - 1], d: d[m - 1], kPrev: k[m - 2], dPrev: d[m - 2] };
}

/* Williams %R(period) → −100..0. <−80 oversold, >−20 overbought. Own implementation. */
function taWilliamsR(candles, period = 14) {
  const n = candles ? candles.length : 0;
  if (n < period) return -50;
  let hh = -Infinity, ll = Infinity;
  for (let j = n - period; j < n; j++) { if (candles[j].hi > hh) hh = candles[j].hi; if (candles[j].lo < ll) ll = candles[j].lo; }
  return hh === ll ? -50 : (hh - candles[n - 1].close) / (hh - ll) * -100;
}

/* Money Flow Index(period) → 0..100. Volume-weighted RSI; >80 overbought, <20 oversold.
 * Own implementation. */
function taMfi(candles, period = 14) {
  const n = candles ? candles.length : 0;
  if (n < period + 1) return 50;
  const tp = i => (candles[i].hi + candles[i].lo + candles[i].close) / 3;
  let pos = 0, neg = 0;
  for (let i = n - period; i < n; i++) {
    const t = tp(i), tPrev = tp(i - 1), mf = t * (candles[i].v || 0);
    if (t > tPrev) pos += mf; else if (t < tPrev) neg += mf;
  }
  if (neg === 0) return pos === 0 ? 50 : 100;
  return 100 - 100 / (1 + pos / neg);
}

/* Ichimoku Kinko Hyo → tenkan/kijun/spanA/spanB + cloud position. Signal uses the
 * current-candle values (common simplification; the classic cloud is shifted 26
 * forward). aboveCloud = price over both spans (bullish). Own implementation. */
function taIchimoku(candles, conv = 9, base = 26, spanBLen = 52) {
  const n = candles ? candles.length : 0;
  const hh = (p, end) => { let m = -Infinity; for (let i = end - p + 1; i <= end; i++) if (candles[i].hi > m) m = candles[i].hi; return m; };
  const ll = (p, end) => { let m = Infinity; for (let i = end - p + 1; i <= end; i++) if (candles[i].lo < m) m = candles[i].lo; return m; };
  if (n < spanBLen) { const p = n ? candles[n - 1].close : 0; return { tenkan: p, kijun: p, spanA: p, spanB: p, price: p, aboveCloud: false, belowCloud: false }; }
  const e = n - 1;
  const tenkan = (hh(conv, e) + ll(conv, e)) / 2;
  const kijun = (hh(base, e) + ll(base, e)) / 2;
  const spanA = (tenkan + kijun) / 2;
  const spanB = (hh(spanBLen, e) + ll(spanBLen, e)) / 2;
  const price = candles[e].close;
  const top = Math.max(spanA, spanB), bot = Math.min(spanA, spanB);
  return { tenkan, kijun, spanA, spanB, price, aboveCloud: price > top, belowCloud: price < bot };
}

/* Keltner Channels(period, mult) → { upper, mid, lower }. EMA basis ± mult·ATR.
 * Bollinger inside Keltner = "squeeze" (low volatility → breakout ahead). Own impl. */
function taKeltner(candles, period = 20, mult = 2) {
  const n = candles ? candles.length : 0;
  if (n < period + 1) { const p = n ? candles[n - 1].close : 0; return { upper: p, mid: p, lower: p }; }
  const mid = taEma(candles.map(c => c.close), period);
  const atr = taAtr(candles, period);
  return { upper: mid + mult * atr, mid, lower: mid - mult * atr };
}

/* Donchian Channels(period) → { upper, mid, lower }. Highest-high / lowest-low over N.
 * Turtle-style breakout channel. Own implementation. */
function taDonchian(candles, period = 20) {
  const n = candles ? candles.length : 0;
  if (n < period) { const p = n ? candles[n - 1].close : 0; return { upper: p, mid: p, lower: p }; }
  let hh = -Infinity, ll = Infinity;
  for (let i = n - period; i < n; i++) { if (candles[i].hi > hh) hh = candles[i].hi; if (candles[i].lo < ll) ll = candles[i].lo; }
  return { upper: hh, lower: ll, mid: (hh + ll) / 2 };
}

/* On-Balance Volume → { value, prev }. Cumulative volume ± by close direction;
 * OBV rising while price flat = accumulation. Own implementation. */
function taObv(candles) {
  const n = candles ? candles.length : 0;
  if (n < 2) return { value: 0, prev: 0 };
  let obv = 0, prev = 0;
  for (let i = 1; i < n; i++) {
    if (i === n - 1) prev = obv;
    const d = candles[i].close - candles[i - 1].close;
    if (d > 0) obv += candles[i].v || 0; else if (d < 0) obv -= candles[i].v || 0;
  }
  return { value: obv, prev };
}

/* Rate of Change(period) → % change vs `period` candles ago. Momentum. Own impl. */
function taRoc(values, period = 12) {
  const n = values ? values.length : 0;
  if (n < period + 1) return 0;
  const past = values[n - 1 - period];
  return past ? (values[n - 1] - past) / past * 100 : 0;
}

/* Aroon(period) → { up, down, osc } (0..100). Measures bars since the period's
 * high/low; up>70 & down<30 = strong uptrend. osc = up−down. Own implementation. */
function taAroon(candles, period = 25) {
  const n = candles ? candles.length : 0;
  if (n < period + 1) return { up: 50, down: 50, osc: 0 };
  let hi = -Infinity, lo = Infinity, hiIdx = n - 1, loIdx = n - 1;
  for (let i = n - period - 1; i < n; i++) {
    if (candles[i].hi >= hi) { hi = candles[i].hi; hiIdx = i; }
    if (candles[i].lo <= lo) { lo = candles[i].lo; loIdx = i; }
  }
  const up = 100 * (period - ((n - 1) - hiIdx)) / period;
  const down = 100 * (period - ((n - 1) - loIdx)) / period;
  return { up, down, osc: up - down };
}

/* Vortex Indicator(period) → { plus, minus }. VI+ crossing above VI− = bullish
 * trend start. Own implementation. */
function taVortex(candles, period = 14) {
  const n = candles ? candles.length : 0;
  if (n < period + 1) return { plus: 1, minus: 1 };
  let vmPlus = 0, vmMinus = 0, tr = 0;
  for (let i = n - period; i < n; i++) {
    const c = candles[i], p = candles[i - 1];
    vmPlus += Math.abs(c.hi - p.lo);
    vmMinus += Math.abs(c.lo - p.hi);
    tr += Math.max(c.hi - c.lo, Math.abs(c.hi - p.close), Math.abs(c.lo - p.close));
  }
  return { plus: tr ? vmPlus / tr : 1, minus: tr ? vmMinus / tr : 1 };
}

/* TRIX(period) → % ROC of a triple-smoothed EMA. Zero-cross momentum, filters noise.
 * Own implementation. */
function taTrix(values, period = 15) {
  const n = values ? values.length : 0;
  if (n < period * 3) return 0;
  const e3 = taEmaSeries(taEmaSeries(taEmaSeries(values, period), period), period);
  const m = e3.length, prev = e3[m - 2];
  return prev ? (e3[m - 1] - prev) / prev * 100 : 0;
}

/* Chaikin Money Flow(period) → −1..+1. Volume-weighted accumulation/distribution;
 * >0 buying pressure, <0 selling. Own implementation. */
function taCmf(candles, period = 20) {
  const n = candles ? candles.length : 0;
  if (n < period) return 0;
  let mfv = 0, vol = 0;
  for (let i = n - period; i < n; i++) {
    const c = candles[i], range = c.hi - c.lo;
    mfv += (range ? ((c.close - c.lo) - (c.hi - c.close)) / range : 0) * (c.v || 0);
    vol += c.v || 0;
  }
  return vol ? mfv / vol : 0;
}

/* Ultimate Oscillator(s1,s2,s3) → 0..100. Weighted buying-pressure across three
 * timeframes; <30 oversold, >70 overbought. Own implementation. */
function taUltimate(candles, s1 = 7, s2 = 14, s3 = 28) {
  const n = candles ? candles.length : 0;
  if (n < s3 + 1) return 50;
  const bp = [], tr = [];
  for (let i = 1; i < n; i++) {
    const c = candles[i], p = candles[i - 1];
    const minLC = Math.min(c.lo, p.close), maxHC = Math.max(c.hi, p.close);
    bp.push(c.close - minLC); tr.push(maxHC - minLC);
  }
  const sum = (arr, len) => { let s = 0; for (let i = arr.length - len; i < arr.length; i++) s += arr[i]; return s; };
  const avg = len => { const t = sum(tr, len); return t ? sum(bp, len) / t : 0; };
  return 100 * (4 * avg(s1) + 2 * avg(s2) + avg(s3)) / 7;
}

/* Fisher Transform(period) → { value, prev }. Sharpens turning points by mapping
 * price to a Gaussian; zero-cross / extreme reversals. Own implementation. */
function taFisher(candles, period = 9) {
  const n = candles ? candles.length : 0;
  if (n < period + 1) return { value: 0, prev: 0 };
  const mp = candles.map(c => (c.hi + c.lo) / 2);
  let value = 0, fish = 0, fishPrev = 0;
  for (let i = period - 1; i < n; i++) {
    let hh = -Infinity, ll = Infinity;
    for (let j = i - period + 1; j <= i; j++) { if (mp[j] > hh) hh = mp[j]; if (mp[j] < ll) ll = mp[j]; }
    const range = (hh - ll) || 1e-9;
    let x = 0.66 * ((mp[i] - ll) / range - 0.5) + 0.67 * value;
    x = Math.max(-0.999, Math.min(0.999, x));
    value = x;
    fishPrev = fish;
    fish = 0.5 * Math.log((1 + x) / (1 - x)) + 0.5 * fish;
  }
  return { value: fish, prev: fishPrev };
}

/* Elder Ray(period) → { bull, bear }. bull = high−EMA, bear = low−EMA. bull>0 &
 * rising bear = buyers in control within an uptrend. Own implementation. */
function taElderRay(candles, period = 13) {
  const n = candles ? candles.length : 0;
  if (n < period) return { bull: 0, bear: 0 };
  const ema = taEma(candles.map(c => c.close), period);
  return { bull: candles[n - 1].hi - ema, bear: candles[n - 1].lo - ema };
}

/* Percentage Price Oscillator(fast,slow) → % MACD: (EMAfast−EMAslow)/EMAslow·100.
 * Scale-independent momentum, comparable across assets. Own implementation. */
function taPpo(values, fast = 12, slow = 26) {
  const n = values ? values.length : 0;
  if (n < slow) return 0;
  const ef = taEma(values, fast), es = taEma(values, slow);
  return es ? (ef - es) / es * 100 : 0;
}

/* Candlestick pattern recognition → [{ idx, name, ru, bias }] over the last
 * `lookback` candles. Detects reversal/indecision shapes: engulfing, hammer,
 * shooting star, doji. Own implementation; pattern *ideas* are public TA.
 * bias: "bull" | "bear" | "neutral". */
function taCandlePatterns(candles, lookback = 50) {
  const n = candles ? candles.length : 0;
  const out = [];
  if (n < 5) return out;
  const start = Math.max(3, n - lookback);
  for (let i = start; i < n; i++) {
    const c = candles[i], p = candles[i - 1];
    const body = Math.abs(c.close - c.open);
    const range = (c.hi - c.lo) || 1e-9;
    const upper = c.hi - Math.max(c.open, c.close);
    const lower = Math.min(c.open, c.close) - c.lo;
    const trendUp = candles[i - 1].close > candles[i - 3].close;
    const trendDn = candles[i - 1].close < candles[i - 3].close;
    const pRed = p.close < p.open, pGreen = p.close > p.open;
    const cGreen = c.close > c.open, cRed = c.close < c.open;

    if (cGreen && pRed && c.close >= p.open && c.open <= p.close && body > 0) {
      out.push({ idx: i, name: "bull_engulf", ru: "Бычье поглощение", bias: "bull" }); continue;
    }
    if (cRed && pGreen && c.open >= p.close && c.close <= p.open && body > 0) {
      out.push({ idx: i, name: "bear_engulf", ru: "Медвежье поглощение", bias: "bear" }); continue;
    }
    if (lower >= body * 2 && upper <= body * 0.6 && body > 0 && trendDn) {
      out.push({ idx: i, name: "hammer", ru: "Молот", bias: "bull" }); continue;
    }
    if (upper >= body * 2 && lower <= body * 0.6 && body > 0 && trendUp) {
      out.push({ idx: i, name: "shooting_star", ru: "Падающая звезда", bias: "bear" }); continue;
    }
    if (body <= range * 0.1) {
      out.push({ idx: i, name: "doji", ru: "Дожи", bias: "neutral" }); continue;
    }
  }
  return out;
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
  const st = taSupertrend(candles, 3, 10);
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

  // 6) Supertrend — independent trend filter + fresh-flip trigger
  if (st.dir > 0) { score += 1.0; reasons.push("Supertrend вверх"); }
  else if (st.dir < 0) { score -= 1.0; reasons.push("Supertrend вниз"); }
  if (st.flipUp) { score += 0.6; reasons.push("свежий разворот Supertrend ↗"); }
  else if (st.flipDown) { score -= 0.6; reasons.push("свежий разворот Supertrend ↘"); }

  // 7) Candlestick pattern on the current candle — light confluence
  const pats = typeof taCandlePatterns === "function" ? taCandlePatterns(candles, 3) : [];
  const lastPat = pats.length && pats[pats.length - 1].idx === n - 1 ? pats[pats.length - 1] : null;
  if (lastPat && lastPat.bias === "bull") { score += 0.5; reasons.push(`свечной паттерн: ${lastPat.ru}`); }
  else if (lastPat && lastPat.bias === "bear") { score -= 0.5; reasons.push(`свечной паттерн: ${lastPat.ru}`); }

  const side = score >= 0 ? "buy" : "sell";
  const aligned = (side === "buy" && trendDir >= 0) || (side === "sell" && trendDir <= 0);
  const strength = Math.min(1, Math.abs(score) / 5.4);
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
    reasons: reasons.slice(0, 6),
    rsi, emaF, emaS, ema50, macd, atr, atrPct, mom, volRatio,
    supertrend: st.value, stDir: st.dir, pattern: lastPat ? lastPat.ru : null,
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
  taSmaSeries, taRsiSeries, taStochRsi, taSupertrend, taDmi, taBollinger,
  taCci, taParabolicSar, taAwesome,
  taStochastic, taWilliamsR, taMfi, taIchimoku,
  taKeltner, taDonchian, taObv, taRoc,
  taAroon, taVortex, taTrix, taCmf,
  taUltimate, taFisher, taElderRay, taPpo,
  taCandlePatterns,
});
