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

function toBybitSymbol(sym) {
  return String(sym).replace(/[\/\s]/g, "").toUpperCase();
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

async function bybitFetchKlines(symbol, interval = "1", limit = 90) {
  const url = `${BYBIT_REST}/v5/market/kline?category=spot&symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`kline HTTP ${res.status}`);
  const json = await res.json();
  if (json.retCode !== 0) throw new Error(json.retMsg || "kline retCode≠0");
  // Bybit returns newest-first → reverse to chronological order
  return json.result.list.map(parseKlineRow).reverse();
}

async function bybitFetchTicker(symbol) {
  const url = `${BYBIT_REST}/v5/market/tickers?category=spot&symbol=${symbol}`;
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
function useBybitMarket(symbol, interval = "1", maxCandles = 90) {
  const [candles, setCandles] = useState([]);
  const [ticker, setTicker] = useState(null);
  const [status, setStatus] = useState("connecting");
  const candlesRef = useRef([]);
  const tickerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let ws = null, pingId = null, reconnectId = null;

    candlesRef.current = [];
    tickerRef.current = null;
    setCandles([]);
    setTicker(null);
    setStatus("connecting");

    // 1) REST bootstrap — history + current 24h stats
    (async () => {
      try {
        const [kl, tk] = await Promise.all([
          bybitFetchKlines(symbol, interval, maxCandles),
          bybitFetchTicker(symbol),
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
      setCandles(arr);
    }

    function connect() {
      try { ws = new WebSocket(BYBIT_WS_SPOT); }
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

    return () => {
      cancelled = true;
      clearInterval(pingId);
      clearTimeout(reconnectId);
      if (ws) { ws.onclose = null; try { ws.close(); } catch (_) {} }
    };
  }, [symbol, interval, maxCandles]);

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

Object.assign(window, {
  toBybitSymbol, bybitFetchKlines, bybitFetchTicker, useBybitMarket, useBybitTickers,
  bybitFetchOrderbook, bybitFetchRecentTrades, useBybitOrderbook, useBybitTrades, useBybitL2,
  bybitFetchLinearStats, useBybitLinearStats, bybitFetchLongShort, useBybitLongShort,
  BYBIT_REST, BYBIT_WS_SPOT,
});
