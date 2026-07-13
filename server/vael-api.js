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

const PORT = process.env.PORT || 8787;

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
    res.statusCode = 404;
    res.end(JSON.stringify({ ok: false, error: "not found" }));
  } catch (e) {
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false, error: e.message }));
  }
});
server.listen(PORT, "127.0.0.1", () => console.log(`VAEL API listening on 127.0.0.1:${PORT}`));
