/* vael-api.js — tiny zero-dependency backend for VAEL.
 * Runs on the server (Node 18+), sits behind nginx at /api/*, and provides data
 * the browser can't fetch directly (CORS / secrets). Start: `node vael-api.js`.
 *
 * Endpoints:
 *   GET /api/health   → { ok:true }
 *   GET /api/news     → real crypto headlines aggregated from free RSS feeds
 *   GET /api/assistant?q=... → optional LLM proxy (needs ANTHROPIC_API_KEY env)
 */

const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 8787;

/* ── Cloud save: persist a per-device state blob (demo trades, champions, budget)
 * to a JSON file so it survives a browser wipe / device switch. No auth — keyed by
 * a client-generated device id. Single small blob per device. ── */
const DATA_DIR = process.env.VAEL_DATA_DIR || path.join(__dirname, "data");
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}
/* ── Polymarket calibration dataset ────────────────────────────────────────────
 * The one testable question worth asking about prediction markets: does an outcome
 * priced at X% actually happen X% of the time? If yes, the market is calibrated and
 * there is no edge to take. If favourites systematically resolve MORE often than
 * their price, buying them has positive expectancy — and vice versa.
 *
 * Method, and why each choice matters:
 *   • price is read 7 days BEFORE resolution, never near it — close to the end the
 *     price has already collapsed to 0/1 and the test would be trivially "calibrated";
 *   • only binary Yes/No markets that resolved cleanly (outcomePrices 0/1);
 *   • only real volume (>$20k) — dead markets are noise, not opinion;
 *   • the market price is compared against the 95% CI of the realised rate. If the
 *     price sits inside that interval we CANNOT claim a mispricing. That is the
 *     honest null, and it is the default.
 * Collection is incremental and stored, so the sample grows instead of being refetched. */
// Several horizons, each analysed SEPARATELY: within one horizon every market
// contributes exactly one point, so the samples stay independent. (Pooling all
// horizons would double-count the same outcome — the same overlap trap that turned a
// "0.74 correlation" into noise earlier.)
const PM_LOOKBACKS = [1, 3, 7, 14, 30];
const PM_MIN_VOLUME = 20000;
const PM_MAX_AGE_DAYS = 120;   // CLOB keeps no history for older markets — see pmCollectPage
function pmFile() { return path.join(DATA_DIR, "polymarket-calibration.json"); }
function pmLoad() { try { return JSON.parse(fs.readFileSync(pmFile(), "utf8")); } catch (_) { return { rows: [], offset: 0, scanned: 0 }; } }
function pmSave(d) { try { fs.writeFileSync(pmFile(), JSON.stringify(d)); return true; } catch (_) { return false; } }

async function pmCollectPage(state) {
  /* Two traps found the hard way, both worth keeping written down:
   *  • the sortable/filterable field is volumeNum — `order=volume` silently does NOT
   *    sort, which had this scanning random $100 micro-markets (2 usable rows / 300);
   *  • CLOB serves NO price history for old markets. Unfiltered `closed=true` returns
   *    2020-21 questions ("Will Trump win the 2020 election") whose history is long
   *    pruned — every one returns {"history":[]}. Only recent resolutions are usable,
   *    so the window is bounded. That bounds the sample too: this measures RECENT
   *    Polymarket, and cannot speak for earlier regimes. */
  const since = new Date(Date.now() - PM_MAX_AGE_DAYS * 86400000).toISOString();
  const url = `https://gamma-api.polymarket.com/markets?closed=true&limit=100`
    + `&volume_num_min=${PM_MIN_VOLUME}&end_date_min=${encodeURIComponent(since)}&offset=${state.offset}`;
  const res = await fetch(url);
  const j = await res.json();
  const list = Array.isArray(j) ? j : (j.data || []);
  state.offset += 100;
  state.scanned += list.length;
  const seen = new Set(state.rows.map(r => r.id + "@" + r.lookback));
  let added = 0, markets = 0;
  for (const m of list) {
    let outcomes, prices, ids;
    try {
      outcomes = JSON.parse(m.outcomes || "[]");
      prices = JSON.parse(m.outcomePrices || "[]");
      ids = JSON.parse(m.clobTokenIds || "[]");
    } catch (_) { continue; }
    if (outcomes.length !== 2 || prices.length !== 2 || !ids[0]) continue;
    if (+m.volume < PM_MIN_VOLUME) continue;
    /* Resolution must be read numerically, not by string match. Two real cases here:
     *   ["0","0"]                          → void/broken market. A `=== "0"` test would
     *                                        silently score this as a NO and poison the study.
     *   ["0.000001…","0.999998…"]          → a genuine NO that never equals the string "0".
     * So: require the pair to sum to 1 (kills the void case) and land on an extreme. */
    const p0 = +prices[0], p1 = +prices[1];
    if (!isFinite(p0) || !isFinite(p1)) continue;
    if (Math.abs(p0 + p1 - 1) > 0.01) continue;                   // void / unresolved
    const resolvedYes = p0 > 0.99 ? 1 : (p0 < 0.01 ? 0 : null);
    if (resolvedYes === null) continue;                           // never settled cleanly
    try {
      const h = await fetch(`https://clob.polymarket.com/prices-history?market=${ids[0]}&interval=max&fidelity=1440`);
      const hj = await h.json();
      const pts = hj.history || [];
      if (pts.length < 3) continue;
      markets++;
      const endT = pts[pts.length - 1].t;
      const yesWon = resolvedYes;
      for (const lb of PM_LOOKBACKS) {
        if (seen.has(m.id + "@" + lb)) continue;
        const target = endT - lb * 86400;
        let pick = null;
        for (const p of pts) { if (p.t <= target) pick = p; else break; }
        if (!pick) continue;                                       // market shorter than this horizon
        state.rows.push({
          id: m.id, lookback: lb, price: +pick.p, yesWon,
          vol: Math.round(+m.volume), q: String(m.question || "").slice(0, 90),
        });
        seen.add(m.id + "@" + lb);
        added++;
      }
    } catch (_) { /* skip a market whose history won't load */ }
  }
  state.markets = (state.markets || 0) + markets;
  return added;
}

function pmCalibration(allRows, lookback) {
  // one horizon at a time → one point per market → independent samples
  const rows = lookback ? allRows.filter(r => r.lookback === lookback) : allRows;
  const edges = [[0, .05], [.05, .15], [.15, .25], [.25, .35], [.35, .45], [.45, .55],
                 [.55, .65], [.65, .75], [.75, .85], [.85, .95], [.95, 1.0001]];
  return edges.map(([lo, hi]) => {
    const r = rows.filter(x => x.price >= lo && x.price < hi);
    const n = r.length;
    if (!n) return null;
    const meanPrice = r.reduce((s, x) => s + x.price, 0) / n;
    const actual = r.reduce((s, x) => s + x.yesWon, 0) / n;
    /* WILSON interval, not Wald. Wald (p ± 1.96·√(p(1-p)/n)) collapses to zero width
     * when every market in a bucket resolved the same way — √(1·0/n) = 0 — so the CI
     * becomes [1.000, 1.000] and ANY price falls "outside" it. That is exactly the
     * favourites bucket, i.e. precisely where the interesting question lives: it would
     * manufacture a mispricing out of 5 samples. Wilson stays honest at the extremes. */
    const z = 1.96, z2 = z * z;
    const denom = 1 + z2 / n;
    const centre = (actual + z2 / (2 * n)) / denom;
    const half = (z / denom) * Math.sqrt(actual * (1 - actual) / n + z2 / (4 * n * n));
    const loCI = Math.max(0, centre - half), hiCI = Math.min(1, centre + half);
    return {
      range: `${Math.round(lo * 100)}-${Math.round(Math.min(hi, 1) * 100)}%`,
      n, meanPrice: +meanPrice.toFixed(3), actualRate: +actual.toFixed(3),
      deviation: +(actual - meanPrice).toFixed(3),
      ci95: `${loCI.toFixed(3)}…${hiCI.toFixed(3)}`,
      // The honest null: if the price sits inside the CI, calibration is not rejected.
      priceInsideCI: meanPrice >= loCI && meanPrice <= hiCI,
      evBuyYesPct: meanPrice > 0 ? +(((actual / meanPrice) - 1) * 100).toFixed(1) : null,
    };
  }).filter(Boolean);
}

function safePid(pid) { return String(pid || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "default"; }
function stateFile(pid) { return path.join(DATA_DIR, safePid(pid) + ".json"); }
function loadState(pid) { try { return JSON.parse(fs.readFileSync(stateFile(pid), "utf8")); } catch (_) { return null; } }
function saveState(pid, state) { try { fs.writeFileSync(stateFile(pid), JSON.stringify({ state, savedAt: Date.now() })); return true; } catch (_) { return false; } }

/* ── Bybit private (READ-ONLY key recommended) — HMAC-signed v5 requests.
 * Keys stay in server env (BYBIT_API_KEY / BYBIT_API_SECRET), never in the browser. */
async function bybitSigned(path, query) {
  const key = process.env.BYBIT_API_KEY, secret = process.env.BYBIT_API_SECRET;
  if (!key || !secret) return { ok: false, error: "BYBIT_API_KEY/SECRET not set on server" };
  const ts = Date.now().toString(), recv = "5000";
  const sign = crypto.createHmac("sha256", secret).update(ts + key + recv + query).digest("hex");
  try {
    const res = await fetch(`https://api.bybit.com${path}?${query}`, {
      headers: { "X-BAPI-API-KEY": key, "X-BAPI-TIMESTAMP": ts, "X-BAPI-RECV-WINDOW": recv, "X-BAPI-SIGN": sign },
    });
    const j = await res.json();
    if (j.retCode !== 0) return { ok: false, error: j.retMsg || ("retCode " + j.retCode) };
    return { ok: true, result: j.result };
  } catch (e) { return { ok: false, error: e.message }; }
}
async function getBybitAccount() {
  const bal = await bybitSigned("/v5/account/wallet-balance", "accountType=UNIFIED");
  const pos = await bybitSigned("/v5/position/list", "category=linear&settleCoin=USDT");
  const out = { ok: !!(bal.ok || pos.ok) };
  if (bal.ok) {
    const acc = bal.result.list && bal.result.list[0];
    out.balance = acc ? {
      totalEquity: +acc.totalEquity, totalAvailable: +acc.totalAvailableBalance,
      coins: (acc.coin || []).filter(c => +c.walletBalance > 0).map(c => ({ coin: c.coin, bal: +c.walletBalance, usd: +c.usdValue })),
    } : null;
  }
  if (pos.ok) {
    out.positions = (pos.result.list || []).filter(p => +p.size > 0).map(p => ({
      symbol: p.symbol, side: p.side, size: +p.size, entry: +p.avgPrice, mark: +p.markPrice,
      pnl: +p.unrealisedPnl, lev: p.leverage,
    }));
  }
  if (!bal.ok && !pos.ok) out.error = bal.error || pos.error;
  return out;
}

/* ── Real crypto news via free RSS (no API key) ── */
const FEEDS = [
  { name: "Cointelegraph", url: "https://cointelegraph.com/rss" },
  { name: "CoinDesk",      url: "https://www.coindesk.com/arc/outboundfeeds/rss/" },
  { name: "CryptoPotato",  url: "https://cryptopotato.com/feed/" },
];
const NEWS_CACHE_MS = 5 * 60 * 1000;
let newsCache = { ts: 0, items: [] };

function decodeEntities(s) {
  return (s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ").trim();
}
function firstMatch(block, re) { const m = block.match(re); return m ? m[1] : ""; }
function parseFeed(xml, source) {
  const out = [];
  const blocks = xml.split(/<item[>\s]/i).slice(1);
  for (const b of blocks.slice(0, 15)) {
    const title = decodeEntities(firstMatch(b, /<title>([\s\S]*?)<\/title>/i));
    const link = decodeEntities(firstMatch(b, /<link>([\s\S]*?)<\/link>/i));
    const date = firstMatch(b, /<pubDate>([\s\S]*?)<\/pubDate>/i).trim();
    const desc = decodeEntities(firstMatch(b, /<description>([\s\S]*?)<\/description>/i)).slice(0, 220);
    if (title) out.push({ title, link, date, desc, source });
  }
  return out;
}
async function getNews() {
  if (newsCache.items.length && Date.now() - newsCache.ts < NEWS_CACHE_MS) return newsCache.items;
  const all = [];
  await Promise.all(FEEDS.map(async f => {
    try {
      const res = await fetch(f.url, { headers: { "User-Agent": "VAEL/1.0 (+news-proxy)" } });
      if (res.ok) all.push(...parseFeed(await res.text(), f.name));
    } catch (_) {}
  }));
  all.sort((a, b) => (new Date(b.date) || 0) - (new Date(a.date) || 0));
  newsCache = { ts: Date.now(), items: all.slice(0, 40) };
  return newsCache.items;
}

/* ── Macro market data (Fear&Greed + global cap / BTC dominance) ── */
const MARKET_CACHE_MS = 5 * 60 * 1000;
let marketCache = { ts: 0, data: null };
async function getMarket() {
  if (marketCache.data && Date.now() - marketCache.ts < MARKET_CACHE_MS) return marketCache.data;
  let fng = null, global = null;
  try {
    const j = await (await fetch("https://api.alternative.me/fng/")).json();
    const d = j.data && j.data[0];
    if (d) fng = { value: +d.value, label: d.value_classification };
  } catch (_) {}
  try {
    const j = await (await fetch("https://api.coingecko.com/api/v3/global")).json();
    const d = j.data;
    if (d) global = {
      mcapUsd: d.total_market_cap.usd, volUsd: d.total_volume.usd,
      btcDom: d.market_cap_percentage.btc, ethDom: d.market_cap_percentage.eth,
      chg24h: d.market_cap_change_percentage_24h_usd,
    };
  } catch (_) {}
  marketCache = { ts: Date.now(), data: { fng, global } };
  return marketCache.data;
}

/* ── Real TVL for Airdrop Radar projects (DeFiLlama, free) ── */
const AIRDROP_TVL_MAP = [
  { key: "hyperliq", type: "protocol", id: "hyperliquid" },
  { key: "eigen",    type: "protocol", id: "eigenlayer" },
  { key: "berachain",type: "chain",    id: "Berachain" },
  { key: "scroll2",  type: "chain",    id: "Scroll" },
  { key: "monad",    type: "chain",    id: "Monad" },
  { key: "fuel",     type: "chain",    id: "Fuel" },
];
let tvlCache = { ts: 0, data: null };
async function getAirdropTvl() {
  if (tvlCache.data && Date.now() - tvlCache.ts < 10 * 60 * 1000) return tvlCache.data;
  const out = {};
  try {
    const chains = await (await fetch("https://api.llama.fi/v2/chains")).json();
    const byName = {};
    (chains || []).forEach(c => { byName[c.name] = c.tvl; });
    AIRDROP_TVL_MAP.filter(m => m.type === "chain").forEach(m => { if (byName[m.id] != null) out[m.key] = Math.round(byName[m.id] / 1e6); });
  } catch (_) {}
  await Promise.all(AIRDROP_TVL_MAP.filter(m => m.type === "protocol").map(async m => {
    try { const v = await (await fetch("https://api.llama.fi/tvl/" + m.id)).json(); if (typeof v === "number") out[m.key] = Math.round(v / 1e6); } catch (_) {}
  }));
  tvlCache = { ts: Date.now(), data: out };
  return out;
}

/* ── Traditional markets (Yahoo Finance, free) — proxied because the browser is
 * CORS-blocked and Stooq gates with an anti-bot wall. Used to measure the
 * BTC↔Nasdaq correlation regime (risk-on/off). Daily bars → 30-min cache. ── */
const STOCK_SYMBOLS = { nasdaq: "QQQ", sp500: "%5EGSPC", dxy: "DX-Y.NYB", gold: "GC%3DF" };
let stocksCache = { ts: 0, data: null };
async function getStocks() {
  if (stocksCache.data && Date.now() - stocksCache.ts < 30 * 60 * 1000) return stocksCache.data;
  const out = {};
  await Promise.all(Object.entries(STOCK_SYMBOLS).map(async ([key, ysym]) => {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ysym}?interval=1d&range=3mo`;
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (VAEL)" } });
      const j = await res.json();
      const r = j && j.chart && j.chart.result && j.chart.result[0];
      if (!r) return;
      const ts = r.timestamp || [];
      const closesRaw = (r.indicators && r.indicators.quote && r.indicators.quote[0].close) || [];
      const dates = [], closes = [];
      for (let i = 0; i < ts.length; i++) {
        if (closesRaw[i] == null) continue;
        dates.push(new Date(ts[i] * 1000).toISOString().slice(0, 10));
        closes.push(+closesRaw[i]);
      }
      if (!closes.length) return;
      const last = closes[closes.length - 1], prev = closes[closes.length - 2] || last;
      out[key] = { symbol: ysym.replace(/%5E|%3D/g, ""), dates, closes, last, chgPct: prev ? (last - prev) / prev * 100 : 0 };
    } catch (_) {}
  }));
  stocksCache = { ts: Date.now(), data: out };
  return out;
}

/* ── Optional LLM proxy (keeps the Anthropic key on the server) ── */
async function askLLM(q, context) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, error: "ANTHROPIC_API_KEY not set on server" };
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 400,
        messages: [{ role: "user", content: `${context || ""}\n\nВопрос: ${q}\n\nОтветь кратко, технически, на русском. В конце добавь дисклеймер, что это не инвестиционная рекомендация.` }],
      }),
    });
    const j = await res.json();
    const text = j && j.content && j.content[0] && j.content[0].text;
    return text ? { ok: true, text } : { ok: false, error: j.error ? j.error.message : "no content" };
  } catch (e) { return { ok: false, error: e.message }; }
}

function readBody(req) {
  return new Promise(resolve => {
    let data = "";
    req.on("data", c => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on("end", () => resolve(data));
    req.on("error", () => resolve(""));
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method === "OPTIONS") { res.statusCode = 204; res.end(); return; }
  const u = new URL(req.url, "http://localhost");
  try {
    if (u.pathname === "/api/health") { res.end(JSON.stringify({ ok: true, ts: Date.now(), llm: !!process.env.ANTHROPIC_API_KEY, bybit: !!process.env.BYBIT_API_KEY })); return; }
    if (u.pathname === "/api/news") {
      const items = await getNews();
      res.end(JSON.stringify({ ok: true, count: items.length, items }));
      return;
    }
    if (u.pathname === "/api/market") {
      res.end(JSON.stringify({ ok: true, ...(await getMarket()) }));
      return;
    }
    if (u.pathname === "/api/airdrop-tvl") {
      res.end(JSON.stringify({ ok: true, tvl: await getAirdropTvl() }));
      return;
    }
    if (u.pathname === "/api/stocks") {
      res.end(JSON.stringify({ ok: true, stocks: await getStocks() }));
      return;
    }
    if (u.pathname === "/api/bybit/account") {
      const out = await getBybitAccount();
      res.statusCode = out.ok ? 200 : 503;
      res.end(JSON.stringify(out));
      return;
    }
    if (u.pathname === "/api/assistant") {
      let q = u.searchParams.get("q") || "", ctx = u.searchParams.get("ctx") || "";
      if (req.method === "POST") {
        try { const b = JSON.parse((await readBody(req)) || "{}"); q = b.q || q; ctx = b.ctx || ctx; } catch (_) {}
      }
      const out = await askLLM(q, ctx);
      res.statusCode = out.ok ? 200 : 503;
      res.end(JSON.stringify(out));
      return;
    }
    // Grow the calibration sample one page at a time (each page = 100 markets scanned).
    if (u.pathname === "/api/pm/collect") {
      const pages = Math.max(1, Math.min(+u.searchParams.get("pages") || 1, 5));
      const state = pmLoad();
      let added = 0;
      for (let i = 0; i < pages; i++) {
        try { added += await pmCollectPage(state); } catch (_) { break; }
      }
      pmSave(state);
      res.end(JSON.stringify({ ok: true, added, rows: state.rows.length, markets: state.markets || 0, scanned: state.scanned, nextOffset: state.offset }));
      return;
    }
    if (u.pathname === "/api/pm/calibration") {
      const state = pmLoad();
      const lb = +u.searchParams.get("lookback") || 0;
      const byHorizon = {};
      PM_LOOKBACKS.forEach(h => {
        const n = state.rows.filter(r => r.lookback === h).length;
        if (n) byHorizon[h + "d"] = { markets: n, buckets: pmCalibration(state.rows, h) };
      });
      res.end(JSON.stringify({
        ok: true, rows: state.rows.length, markets: state.markets || 0, scanned: state.scanned,
        minVolume: PM_MIN_VOLUME, horizons: PM_LOOKBACKS,
        note: "each horizon analysed separately — one point per market, so samples are independent",
        ...(lb ? { lookback: lb, buckets: pmCalibration(state.rows, lb) } : { byHorizon }),
      }));
      return;
    }
    if (u.pathname === "/api/pm/reset") { pmSave({ rows: [], offset: 0, scanned: 0 }); res.end(JSON.stringify({ ok: true })); return; }

    if (u.pathname === "/api/state") {
      const pid = safePid(u.searchParams.get("pid"));
      if (req.method === "POST") {
        let body = {};
        try { body = JSON.parse((await readBody(req)) || "{}"); } catch (_) {}
        const state = body && body.state !== undefined ? body.state : body;
        const ok = saveState(pid, state);
        res.statusCode = ok ? 200 : 500;
        res.end(JSON.stringify({ ok, pid }));
        return;
      }
      const saved = loadState(pid);
      res.end(JSON.stringify({ ok: true, pid, state: saved ? saved.state : null, savedAt: saved ? saved.savedAt : 0 }));
      return;
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ ok: false, error: "not found" }));
  } catch (e) {
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false, error: e.message }));
  }
});
server.listen(PORT, "127.0.0.1", () => console.log(`VAEL API listening on 127.0.0.1:${PORT}`));
