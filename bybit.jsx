/* bybit.jsx — real market data from Bybit v5 public API (REST bootstrap + WebSocket live)
 *
 * Public market endpoints only — no API key, no signing. Safe to call from the browser.
 *   REST : https://api.bybit.com/v5/market/{kline,tickers}
 *   WS   : wss://stream.bybit.com/v5/public/spot   (topics: kline.{iv}.{sym}, tickers.{sym})
 *
 * Exposes:
 *   toBybitSymbol("ETH/USDT") -> "ETHUSDT"
 *   bybitFetchKlines(sym, interval, limit) -> Promise<candle[]>   chronological, oldest→newest
 *   bybitFetchTicker(sym) -> Promise<ticker>
 *   useBybitMarket(sym, interval, maxCandles) -> { candles, ticker, status }
 *
 * candle: { start, open, hi, lo, close, v }   (shape consumed by ChartWithSignals)
 * ticker: { lastPrice, prevPrice24h, price24hPcnt, highPrice24h, lowPrice24h, volume24h, turnover24h }
 * status: "connecting" | "rest" | "live" | "error"
 */

const BYBIT_REST = "https://api.bybit.com";
const BYBIT_WS_SPOT = "wss://stream.bybit.com/v5/public/spot";
const BYBIT_WS_LINEAR = "wss://stream.bybit.com/v5/public/linear";
/* Coins added from the scanner are linear perpetuals (leverage-tradable);
 * the four built-ins stay on spot. Category threads through REST + WS. */
const bybitWsUrl = (category) => (category === "linear" ? BYBIT_WS_LINEAR : BYBIT_WS_SPOT);

function toBybitSymbol(sym) {
  return String(sym).replace(/[\/\s]/g, "").toUpperCase();
}

/* ── Timeframes Bybit does NOT serve natively (2m/10m/45m) are rebuilt from a
 * coarser native base by bucketing on the candle timestamp. ── */
function aggregateCandles(candles, baseMs, mult) {
  if (!candles || !candles.length || mult <= 1) return candles || [];
  const bucketMs = baseMs * mult;
  const map = new Map();
  for (const c of candles) {
    const key = Math.floor(c.start / bucketMs) * bucketMs;
    const b = map.get(key);
    if (!b) map.set(key, { start: key, open: c.open, hi: c.hi, lo: c.lo, close: c.close, v: c.v });
    else { b.hi = Math.max(b.hi, c.hi); b.lo = Math.min(b.lo, c.lo); b.close = c.close; b.v += c.v; }
  }
  return [...map.values()].sort((a, b) => a.start - b.start);
}

/* ── Second-level candles. Bybit has NO sub-minute klines, so there is no history
 * to fetch — we build them live from the public trade stream. The chart starts
 * empty and fills as trades arrive. Honest limitation, not a bug. ── */
function useSecondCandles(symbol, seconds, category = "spot", maxCandles = 400) {
  const [candles, setCandles] = useState([]);
  const bufRef = useRef([]);

  useEffect(() => {
    if (!seconds) return;
    let cancelled = false, ws = null, pingId = null, reconnectId = null;
    const bucketMs = seconds * 1000;
    bufRef.current = [];
    setCandles([]);

    const push = (price, size, ts) => {
      const key = Math.floor(ts / bucketMs) * bucketMs;
      const arr = bufRef.current;
      const last = arr[arr.length - 1];
      if (last && last.start === key) {
        last.hi = Math.max(last.hi, price);
        last.lo = Math.min(last.lo, price);
        last.close = price;
        last.v += size;
      } else if (!last || key > last.start) {
        arr.push({ start: key, open: price, hi: price, lo: price, close: price, v: size });
        if (arr.length > maxCandles) arr.shift();
      }
      if (!cancelled) setCandles(arr.slice());
    };

    function connect() {
      try { ws = new WebSocket(bybitWsUrl(category)); }
      catch { reconnectId = setTimeout(connect, 3000); return; }
      ws.onopen = () => {
        ws.send(JSON.stringify({ op: "subscribe", args: [`publicTrade.${symbol}`] }));
        pingId = setInterval(() => { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ op: "ping" })); }, 20000);
      };
      ws.onmessage = ev => {
        if (cancelled) return;
        let msg; try { msg = JSON.parse(ev.data); } catch { return; }
        if (!msg.topic || msg.topic.indexOf("publicTrade.") !== 0) return;
        (msg.data || []).forEach(t => push(+t.p, +t.v, +t.T));
      };
      ws.onclose = () => { clearInterval(pingId); if (!cancelled) reconnectId = setTimeout(connect, 2500); };
      ws.onerror = () => { try { ws.close(); } catch (_) {} };
    }
    connect();

    return () => {
      cancelled = true;
      clearInterval(pingId); clearTimeout(reconnectId);
      if (ws) { ws.onclose = null; try { ws.close(); } catch (_) {} }
    };
  }, [symbol, seconds, category, maxCandles]);

  return candles;
}

/* ── Leverage-tradable universe: every linear perpetual on Bybit (incl. memecoins),
 * merged with its max leverage. One tickers call + one instruments call. ── */
async function bybitFetchLeverageUniverse() {
  const [tRes, iRes] = await Promise.all([
    fetch(`${BYBIT_REST}/v5/market/tickers?category=linear`).then(r => r.json()),
    fetch(`${BYBIT_REST}/v5/market/instruments-info?category=linear&limit=1000`).then(r => r.json()),
  ]);
  const tickers = (tRes.result && tRes.result.list) || [];
  const instr = (iRes.result && iRes.result.list) || [];
  const levBySym = {};
  instr.forEach(x => { levBySym[x.symbol] = +(x.leverageFilter && x.leverageFilter.maxLeverage) || null; });
  return tickers
    .filter(t => /USDT$/.test(t.symbol))
    .map(t => ({
      symbol: t.symbol,
      base: t.symbol.replace(/USDT$/, ""),
      price: +t.lastPrice,
      chg24h: +t.price24hPcnt * 100,
      turnover24h: +t.turnover24h,
      maxLev: levBySym[t.symbol] || null,
    }))
    .sort((a, b) => b.turnover24h - a.turnover24h);
}

/* Bybit kline row: [startTime, open, high, low, close, volume, turnover] */
function parseKlineRow(row) {
  return {
    start: +row[0],
    open: +row[1],
    hi: +row[2],
    lo: +row[3],
    close: +row[4],
    v: +row[5],
  };
}

async function bybitFetchKlines(symbol, interval = "1", limit = 90, category = "spot") {
  const url = `${BYBIT_REST}/v5/market/kline?category=${category}&symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`kline HTTP ${res.status}`);
  const json = await res.json();
  if (json.retCode !== 0) throw new Error(json.retMsg || "kline retCode≠0");
  // Bybit returns newest-first → reverse to chronological order
  return json.result.list.map(parseKlineRow).reverse();
}

async function bybitFetchTicker(symbol, category = "spot") {
  const url = `${BYBIT_REST}/v5/market/tickers?category=${category}&symbol=${symbol}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ticker HTTP ${res.status}`);
  const json = await res.json();
  if (json.retCode !== 0) throw new Error(json.retMsg || "ticker retCode≠0");
  const t = json.result.list[0];
  return {
    lastPrice: +t.lastPrice,
    prevPrice24h: +t.prevPrice24h,
    price24hPcnt: +t.price24hPcnt,
    highPrice24h: +t.highPrice24h,
    lowPrice24h: +t.lowPrice24h,
    volume24h: +t.volume24h,
    turnover24h: +t.turnover24h,
  };
}

/* Merge a ticker WS/REST patch onto the previous snapshot, keeping prev values for absent fields */
function mergeTicker(prev, d) {
  const num = (v, fb) => (v != null ? +v : fb);
  return {
    lastPrice:    num(d.lastPrice,    prev?.lastPrice),
    prevPrice24h: num(d.prevPrice24h, prev?.prevPrice24h),
    price24hPcnt: num(d.price24hPcnt, prev?.price24hPcnt),
    highPrice24h: num(d.highPrice24h, prev?.highPrice24h),
    lowPrice24h:  num(d.lowPrice24h,  prev?.lowPrice24h),
    volume24h:    num(d.volume24h,    prev?.volume24h),
    turnover24h:  num(d.turnover24h,  prev?.turnover24h),
  };
}

/* ─────────────────────────────────────────────────────────
 * useBybitMarket — REST bootstrap + live WebSocket for one symbol
 * ────────────────────────────────────────────────────────*/
function useBybitMarket(symbol, interval = "1", maxCandles = 90, category = "spot") {
  const [candles, setCandles] = useState([]);
  const [ticker, setTicker] = useState(null);
  const [status, setStatus] = useState("connecting");
  const candlesRef = useRef([]);
  const tickerRef = useRef(null);
  const lastWsRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let ws = null, pingId = null, reconnectId = null, pollId = null;

    candlesRef.current = [];
    tickerRef.current = null;
    setCandles([]);
    setTicker(null);
    setStatus("connecting");

    // 1) REST bootstrap — history + current 24h stats
    (async () => {
      try {
        const [kl, tk] = await Promise.all([
          bybitFetchKlines(symbol, interval, maxCandles, category),
          bybitFetchTicker(symbol, category),
        ]);
        if (cancelled) return;
        candlesRef.current = kl;
        tickerRef.current = tk;
        setCandles(kl);
        setTicker(tk);
        setStatus(s => (s === "live" ? "live" : "rest"));
      } catch (e) {
        if (!cancelled) {
          setStatus(s => (s === "live" ? "live" : "error"));
          console.warn("[bybit] REST bootstrap failed:", e.message);
        }
      }
    })();

    // 2) WebSocket live — forming candle + ticker
    function pushKline(k) {
      const candle = {
        start: +k.start, open: +k.open, hi: +k.high, lo: +k.low, close: +k.close, v: +k.volume,
      };
      const arr = candlesRef.current.slice();
      const lastIdx = arr.length - 1;
      if (lastIdx >= 0 && arr[lastIdx].start === candle.start) {
        arr[lastIdx] = candle;                       // update forming candle
      } else if (lastIdx < 0 || candle.start > arr[lastIdx].start) {
        arr.push(candle);                            // new candle rolled over
        if (arr.length > maxCandles) arr.shift();
      } else {
        return;                                      // stale/out-of-order
      }
      candlesRef.current = arr;
      lastWsRef.current = Date.now();
      setCandles(arr);
    }

    function connect() {
      try { ws = new WebSocket(bybitWsUrl(category)); }
      catch { reconnectId = setTimeout(connect, 3000); return; }

      ws.onopen = () => {
        ws.send(JSON.stringify({
          op: "subscribe",
          args: [`kline.${interval}.${symbol}`, `tickers.${symbol}`],
        }));
        pingId = setInterval(() => {
          if (ws && ws.readyState === 1) ws.send(JSON.stringify({ op: "ping" }));
        }, 20000);
      };

      ws.onmessage = (ev) => {
        if (cancelled) return;
        let msg;
        try { msg = JSON.parse(ev.data); } catch { return; }
        if (!msg.topic) return;                       // ack/pong frames
        if (msg.topic.indexOf("kline.") === 0) {
          const k = msg.data && msg.data[0];
          if (k) { pushKline(k); setStatus("live"); }
        } else if (msg.topic.indexOf("tickers.") === 0) {
          const d = msg.data;
          if (d) {
            const merged = mergeTicker(tickerRef.current, d);
            tickerRef.current = merged;
            lastWsRef.current = Date.now();
            setTicker(merged);
            setStatus("live");
          }
        }
      };

      ws.onclose = () => {
        clearInterval(pingId);
        if (!cancelled) reconnectId = setTimeout(connect, 2500);
      };
      ws.onerror = () => { try { ws.close(); } catch (_) {} };
    }
    connect();

    // 3) REST fallback — if the WS goes quiet (blocked / dropped / sparse market),
    //    re-poll klines+ticker so the chart never freezes. Skips when WS is fresh.
    pollId = setInterval(async () => {
      if (cancelled || Date.now() - lastWsRef.current < 10000) return;
      try {
        const [kl, tk] = await Promise.all([
          bybitFetchKlines(symbol, interval, maxCandles, category),
          bybitFetchTicker(symbol, category),
        ]);
        if (cancelled) return;
        candlesRef.current = kl; setCandles(kl);
        tickerRef.current = tk; setTicker(tk);
        setStatus(s => (s === "live" ? "live" : "rest"));
      } catch (_) {}
    }, 8000);

    return () => {
      cancelled = true;
      clearInterval(pingId);
      clearInterval(pollId);
      clearTimeout(reconnectId);
      if (ws) { ws.onclose = null; try { ws.close(); } catch (_) {} }
    };
  }, [symbol, interval, maxCandles, category]);

  return { candles, ticker, status };
}

/* ─────────────────────────────────────────────────────────
 * useBybitTickers — REST-poll live tickers for a set of symbols
 * Returns { prices: { SYMBOL: ticker }, status }. Symbols that fail are simply
 * omitted from the map (graceful) so one bad symbol never blanks the rest.
 * ────────────────────────────────────────────────────────*/
function useBybitTickers(symbols, ms = 8000) {
  const [prices, setPrices] = useState({});
  const [status, setStatus] = useState("connecting");
  const key = symbols.join(",");

  useEffect(() => {
    if (!symbols.length) { setStatus("live"); return; }
    let cancelled = false, id = null;

    async function load() {
      const results = await Promise.all(
        symbols.map(s => bybitFetchTicker(s).then(t => [s, t]).catch(() => [s, null]))
      );
      if (cancelled) return;
      const map = {};
      let ok = 0;
      for (const [s, t] of results) { if (t) { map[s] = t; ok++; } }
      setPrices(prev => ({ ...prev, ...map }));
      setStatus(ok > 0 ? "live" : "error");
    }

    load();
    id = setInterval(load, ms);
    return () => { cancelled = true; clearInterval(id); };
  }, [key, ms]);

  return { prices, status };
}

/* ─────────────────────────────────────────────────────────
 * Orderbook + recent trades (REST-polled)
 * ────────────────────────────────────────────────────────*/
async function bybitFetchOrderbook(symbol, limit = 25) {
  const url = `${BYBIT_REST}/v5/market/orderbook?category=spot&symbol=${symbol}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`orderbook HTTP ${res.status}`);
  const json = await res.json();
  if (json.retCode !== 0) throw new Error(json.retMsg || "orderbook retCode≠0");
  const r = json.result;
  return {
    asks: (r.a || []).map(x => [+x[0], +x[1]]), // ascending: best (lowest) ask first
    bids: (r.b || []).map(x => [+x[0], +x[1]]), // descending: best (highest) bid first
  };
}

async function bybitFetchRecentTrades(symbol, limit = 40) {
  const url = `${BYBIT_REST}/v5/market/recent-trade?category=spot&symbol=${symbol}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`recent-trade HTTP ${res.status}`);
  const json = await res.json();
  if (json.retCode !== 0) throw new Error(json.retMsg || "recent-trade retCode≠0");
  return (json.result.list || []).map(t => ({
    id: t.execId,
    price: +t.price,
    size: +t.size,
    side: t.side,          // "Buy" | "Sell"
    time: +t.time,
  }));
}

function useBybitOrderbook(symbol, ms = 1200, limit = 25) {
  const [book, setBook] = useState({ asks: [], bids: [] });
  useEffect(() => {
    let cancelled = false, id = null;
    setBook({ asks: [], bids: [] });
    async function load() {
      try { const b = await bybitFetchOrderbook(symbol, limit); if (!cancelled) setBook(b); }
      catch (_) {}
    }
    load();
    id = setInterval(load, ms);
    return () => { cancelled = true; clearInterval(id); };
  }, [symbol, ms, limit]);
  return book;
}

function useBybitTrades(symbol, ms = 2500, limit = 40) {
  const [trades, setTrades] = useState([]);
  useEffect(() => {
    let cancelled = false, id = null;
    setTrades([]);
    async function load() {
      try { const t = await bybitFetchRecentTrades(symbol, limit); if (!cancelled) setTrades(t); }
      catch (_) {}
    }
    load();
    id = setInterval(load, ms);
    return () => { cancelled = true; clearInterval(id); };
  }, [symbol, ms, limit]);
  return trades;
}

/* ─────────────────────────────────────────────────────────
 * useBybitL2 — live orderbook (snapshot+delta) + trade tape over one WebSocket
 * Subscribes to orderbook.{depth}.{sym} and publicTrade.{sym}.
 * Returns { orderbook: { asks:[[p,s]], bids:[[p,s]] }, trades:[{id,price,size,side,time}] }
 * ────────────────────────────────────────────────────────*/
function useBybitL2(symbol, depth = 50, tradeLimit = 40) {
  const [orderbook, setOrderbook] = useState({ asks: [], bids: [] });
  const [trades, setTrades] = useState([]);
  const asksRef = useRef(new Map());
  const bidsRef = useRef(new Map());

  useEffect(() => {
    let cancelled = false, ws = null, pingId = null, reconnectId = null;
    asksRef.current = new Map();
    bidsRef.current = new Map();
    setOrderbook({ asks: [], bids: [] });
    setTrades([]);

    function applyLevels(map, levels) {
      for (const lv of levels) {
        const price = +lv[0], size = +lv[1];
        if (size === 0) map.delete(price); else map.set(price, size);
      }
    }
    function publishBook() {
      const asks = [...asksRef.current.entries()].sort((a, b) => a[0] - b[0]).slice(0, depth);
      const bids = [...bidsRef.current.entries()].sort((a, b) => b[0] - a[0]).slice(0, depth);
      setOrderbook({ asks, bids });
    }

    function connect() {
      try { ws = new WebSocket(BYBIT_WS_SPOT); }
      catch { reconnectId = setTimeout(connect, 3000); return; }

      ws.onopen = () => {
        ws.send(JSON.stringify({ op: "subscribe", args: [`orderbook.${depth}.${symbol}`, `publicTrade.${symbol}`] }));
        pingId = setInterval(() => { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ op: "ping" })); }, 20000);
      };

      ws.onmessage = (ev) => {
        if (cancelled) return;
        let msg; try { msg = JSON.parse(ev.data); } catch { return; }
        if (!msg.topic) return;
        if (msg.topic.indexOf("orderbook.") === 0) {
          const d = msg.data; if (!d) return;
          if (msg.type === "snapshot") { asksRef.current = new Map(); bidsRef.current = new Map(); }
          applyLevels(asksRef.current, d.a || []);
          applyLevels(bidsRef.current, d.b || []);
          publishBook();
        } else if (msg.topic.indexOf("publicTrade.") === 0) {
          const arr = msg.data; if (!arr || !arr.length) return;
          // Bybit sends oldest→newest; reverse so newest ends up on top
          const mapped = arr.map(t => ({ id: t.i, price: +t.p, size: +t.v, side: t.S, time: +t.T })).reverse();
          setTrades(prev => [...mapped, ...prev].slice(0, tradeLimit));
        }
      };

      ws.onclose = () => { clearInterval(pingId); if (!cancelled) reconnectId = setTimeout(connect, 2500); };
      ws.onerror = () => { try { ws.close(); } catch (_) {} };
    }
    connect();

    return () => {
      cancelled = true;
      clearInterval(pingId);
      clearTimeout(reconnectId);
      if (ws) { ws.onclose = null; try { ws.close(); } catch (_) {} }
    };
  }, [symbol, depth, tradeLimit]);

  return { orderbook, trades };
}

/* ─────────────────────────────────────────────────────────
 * Derivatives (perp) stats — funding rate, open interest, volume
 * ────────────────────────────────────────────────────────*/
async function bybitFetchLinearStats(symbol) {
  const url = `${BYBIT_REST}/v5/market/tickers?category=linear&symbol=${symbol}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`linear HTTP ${res.status}`);
  const json = await res.json();
  if (json.retCode !== 0) throw new Error(json.retMsg || "linear retCode≠0");
  const t = json.result.list[0];
  if (!t) throw new Error("no linear ticker");
  return {
    lastPrice: +t.lastPrice,
    fundingRate: +t.fundingRate,
    nextFundingTime: +t.nextFundingTime,
    openInterest: +t.openInterest,
    openInterestValue: +t.openInterestValue,
    turnover24h: +t.turnover24h,
    volume24h: +t.volume24h,
  };
}

function useBybitLinearStats(symbol, ms = 15000) {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    let cancelled = false, id = null;
    setStats(null);
    async function load() {
      try { const s = await bybitFetchLinearStats(symbol); if (!cancelled) setStats(s); }
      catch (_) {}
    }
    load();
    id = setInterval(load, ms);
    return () => { cancelled = true; clearInterval(id); };
  }, [symbol, ms]);
  return stats;
}

/* Long/Short account ratio — market sentiment (linear perp) */
async function bybitFetchLongShort(symbol, period = "1h") {
  const url = `${BYBIT_REST}/v5/market/account-ratio?category=linear&symbol=${symbol}&period=${period}&limit=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`account-ratio HTTP ${res.status}`);
  const json = await res.json();
  if (json.retCode !== 0) throw new Error(json.retMsg || "account-ratio retCode≠0");
  const t = json.result.list[0];
  if (!t) throw new Error("no ratio");
  return { buyRatio: +t.buyRatio, sellRatio: +t.sellRatio };
}

function useBybitLongShort(symbol, ms = 60000) {
  const [ls, setLs] = useState(null);
  useEffect(() => {
    let cancelled = false, id = null;
    setLs(null);
    async function load() {
      try { const r = await bybitFetchLongShort(symbol); if (!cancelled) setLs(r); }
      catch (_) {}
    }
    load();
    id = setInterval(load, ms);
    return () => { cancelled = true; clearInterval(id); };
  }, [symbol, ms]);
  return ls;
}

/* ─────────────────────────────────────────────────────────
 * useMarketMetrics — REST-poll candles + derivatives → real analytics metrics
 * (volatility, volume anomaly, sentiment, flow, risk, AI forecast)
 * ────────────────────────────────────────────────────────*/
function useMarketMetrics(symbol, ms = 12000) {
  const [metrics, setMetrics] = useState(null);
  useEffect(() => {
    if (typeof computeMarketMetrics !== "function") return;
    let cancelled = false, id = null;
    setMetrics(null);
    async function load() {
      try {
        const [kl, tk, lin, ls] = await Promise.all([
          bybitFetchKlines(symbol, "15", 100),
          bybitFetchTicker(symbol).catch(() => null),
          bybitFetchLinearStats(symbol).catch(() => null),
          bybitFetchLongShort(symbol).catch(() => null),
        ]);
        if (cancelled || !kl || !kl.length) return;
        setMetrics(computeMarketMetrics(kl, { ticker: tk, linear: lin, longShort: ls }));
      } catch (_) {}
    }
    load();
    id = setInterval(load, ms);
    return () => { cancelled = true; clearInterval(id); };
  }, [symbol, ms]);
  return metrics;
}

Object.assign(window, {
  toBybitSymbol, bybitFetchKlines, bybitFetchTicker, useBybitMarket, useBybitTickers,
  bybitFetchOrderbook, bybitFetchRecentTrades, useBybitOrderbook, useBybitTrades, useBybitL2,
  bybitFetchLinearStats, useBybitLinearStats, bybitFetchLongShort, useBybitLongShort,
  useMarketMetrics, bybitFetchLeverageUniverse,
  aggregateCandles, useSecondCandles,
  BYBIT_REST, BYBIT_WS_SPOT, BYBIT_WS_LINEAR,
});
