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

const PORT = process.env.PORT || 8787;

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

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  const u = new URL(req.url, "http://localhost");
  try {
    if (u.pathname === "/api/health") { res.end(JSON.stringify({ ok: true, ts: Date.now() })); return; }
    if (u.pathname === "/api/news") {
      const items = await getNews();
      res.end(JSON.stringify({ ok: true, count: items.length, items }));
      return;
    }
    if (u.pathname === "/api/assistant") {
      const out = await askLLM(u.searchParams.get("q") || "", u.searchParams.get("ctx") || "");
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
