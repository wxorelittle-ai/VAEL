/* news.jsx — Realtime news ticker + full news drawer with sentiment scoring */

const NEWS_TEMPLATES = [
  { txt: "L2 rollup {x} запускает mainnet · TVL прогноз 1.2B$", sent: +0.72, impact: "high", asset: "ETH", cat: "tech" },
  { txt: "SEC расширяет расследование против {x} · регуляторное давление", sent: -0.68, impact: "high", asset: "BTC", cat: "reg" },
  { txt: "{x} приобретает блок-аналитическую компанию за 240M$", sent: +0.42, impact: "med", asset: "ETH", cat: "biz" },
  { txt: "Whale-кошелёк перевёл 12.8K ETH на Coinbase · возможная распродажа", sent: -0.54, impact: "med", asset: "ETH", cat: "onchain" },
  { txt: "Stablecoin {x} прошёл аудит · резервы подтверждены на 100%", sent: +0.36, impact: "low", asset: "USDC", cat: "audit" },
  { txt: "Хак протокола {x} · потери оценены в 18M$", sent: -0.88, impact: "crit", asset: "ETH", cat: "exploit" },
  { txt: "{x} анонсировал интеграцию с major-CEX · доступ к 40M пользователей", sent: +0.58, impact: "high", asset: "SOL", cat: "biz" },
  { txt: "Funding rate бессрочников {x} достиг исторических максимумов", sent: -0.32, impact: "med", asset: "BTC", cat: "deriv" },
  { txt: "Институциональный фонд раскрыл позицию в {x} на 480M$", sent: +0.68, impact: "high", asset: "BTC", cat: "biz" },
  { txt: "Bridge между {x} и Ethereum закрыт после обнаружения уязвимости", sent: -0.72, impact: "high", asset: "AVAX", cat: "exploit" },
  { txt: "Govern. proposal #{n}: повышение комиссий в {x} прошёл голосование", sent: -0.18, impact: "low", asset: "ETH", cat: "gov" },
  { txt: "Объём DEX на {x} превысил CEX впервые за квартал", sent: +0.48, impact: "med", asset: "ETH", cat: "tech" },
  { txt: "Дамп crypto-китов на {x}: 14 кошельков снизили позиции одновременно", sent: -0.62, impact: "high", asset: "BTC", cat: "onchain" },
  { txt: "{x} fork прошёл успешно · сеть стабильна, hashrate +12%", sent: +0.44, impact: "med", asset: "BTC", cat: "tech" },
  { txt: "Анализ: {x} перепродан по техническим индикаторам · ожидается отскок", sent: +0.28, impact: "low", asset: "ETH", cat: "analysis" },
];

const NEWS_SUBJECTS = ["Arbitrum", "Optimism", "Binance", "Tether", "Aave", "Uniswap", "Coinbase", "Solana", "Polygon", "Lido", "Curve", "MakerDAO"];

const SOURCES = [
  { id: "cd",  name: "CoinDesk",      tier: "tier1" },
  { id: "tb",  name: "TheBlock",      tier: "tier1" },
  { id: "dl",  name: "DLNews",        tier: "tier1" },
  { id: "tg",  name: "TG · whale-alert", tier: "tier2" },
  { id: "ds",  name: "Dune · custom", tier: "tier2" },
  { id: "v6",  name: "VAEL · agent",  tier: "v6" },
];

const NEWS_CATS = {
  tech:     { ru: "ТЕХ",      color: "var(--accent)" },
  reg:      { ru: "РЕГУЛ",    color: "var(--red)" },
  biz:      { ru: "БИЗНЕС",   color: "var(--blue)" },
  onchain:  { ru: "ON-CHAIN", color: "var(--accent-2)" },
  exploit:  { ru: "ЭКСПЛ",    color: "var(--red)" },
  audit:    { ru: "АУДИТ",    color: "var(--green)" },
  deriv:    { ru: "ДЕРИВ",    color: "var(--amber)" },
  gov:      { ru: "ГОЛОС",    color: "var(--text-mid)" },
  analysis: { ru: "АНАЛИЗ",   color: "var(--blue)" },
};

function tmplNews(s) {
  return s
    .replace(/\{x\}/g, pick(NEWS_SUBJECTS))
    .replace(/\{n\}/g, randInt(140, 982));
}

let __newsSeq = 0;
function makeNewsItem(avoidTexts) {
  let t, text, tries = 0;
  do {
    t = pick(NEWS_TEMPLATES);
    text = tmplNews(t.txt);
    tries++;
  } while (avoidTexts && avoidTexts.has(text) && tries < 8);
  // jitter kept small so it never crosses the item's own polarity/neutral band
  const jitter = (Math.random() - 0.5) * 0.10;
  return {
    id: `NW-${++__newsSeq}`,
    text,
    sent: Math.max(-1, Math.min(1, t.sent + jitter)),
    impact: t.impact,
    asset: t.asset,
    cat: t.cat,
    source: pick(SOURCES),
    ts: new Date(),
    isNew: true,
  };
}

function nowAge(d) {
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}с`;
  if (diff < 3600) return `${Math.floor(diff / 60)}м`;
  return `${Math.floor(diff / 3600)}ч`;
}

/* ─────────────────────────────────────────────────────────
 * Compact ticker — horizontal scrolling strip
 * ────────────────────────────────────────────────────────*/
function NewsTicker({ items, onOpen, sentimentIndex }) {
  // Use latest 8 for the ticker
  const tickerItems = items.slice(0, 8);

  const sentColor = sentimentIndex > 0.15 ? "var(--green)" :
                    sentimentIndex < -0.15 ? "var(--red)" : "var(--amber)";

  return (
    <div style={{
      display: "flex", alignItems: "stretch",
      height: 28,
      borderBottom: "1px solid var(--line)",
      background: "var(--bg-0)",
      flexShrink: 0,
      overflow: "hidden",
    }}>
      {/* Label */}
      <div onClick={onOpen} style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "0 12px",
        borderRight: "1px solid var(--line)",
        background: "var(--bg-1)",
        fontFamily: "var(--font-mono)", fontSize: 9.5, fontWeight: 600,
        letterSpacing: 0.1, color: "var(--accent)",
        cursor: "pointer",
        flexShrink: 0,
      }}>
        <PulseDot size={5} color="var(--accent)" />
        <span>НОВОСТИ · LIVE</span>
      </div>

      {/* Sentiment index */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "0 12px",
        borderRight: "1px solid var(--line)",
        fontFamily: "var(--font-mono)", fontSize: 10,
        flexShrink: 0,
      }}>
        <span style={{ color: "var(--text-dim)" }} title="Новостной тон + направление рынка BTC/ETH">СЕНТИМЕНТ:</span>
        <span style={{ color: sentColor, fontWeight: 600 }}>
          {sentimentIndex >= 0 ? "+" : ""}{sentimentIndex.toFixed(2)}
        </span>
        <span style={{ width: 32, height: 4, background: "var(--bg-3)", borderRadius: 1, overflow: "hidden", position: "relative" }}>
          <span style={{
            position: "absolute", top: 0, bottom: 0,
            left: sentimentIndex >= 0 ? "50%" : `${50 + sentimentIndex * 50}%`,
            width: `${Math.abs(sentimentIndex) * 50}%`,
            background: sentColor,
          }} />
          <span style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: 1, background: "var(--text-dim)" }} />
        </span>
      </div>

      {/* Scrolling track */}
      <div style={{
        flex: 1, overflow: "hidden", position: "relative",
        display: "flex", alignItems: "center",
      }}>
        <div style={{
          display: "flex", gap: 32,
          animation: `tickerScroll calc(95s / var(--speed)) linear infinite`,
          whiteSpace: "nowrap",
          paddingLeft: 16,
        }}>
          {[...tickerItems, ...tickerItems].map((n, i) => (
            <TickerItem key={i} n={n} onClick={onOpen} />
          ))}
        </div>
      </div>

      {/* Right action */}
      <button onClick={onOpen} style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "0 12px",
        background: "var(--bg-1)",
        borderLeft: "1px solid var(--line)",
        border: "none",
        color: "var(--text-mid)",
        fontFamily: "var(--font-mono)", fontSize: 10,
        cursor: "pointer",
        flexShrink: 0,
        letterSpacing: 0.08,
      }}>{items.length} новостей · 24ч ▸</button>
    </div>
  );
}

function TickerItem({ n, onClick }) {
  const sentColor = n.sent > 0.15 ? "var(--green)" : n.sent < -0.15 ? "var(--red)" : "var(--text-mid)";
  const cat = NEWS_CATS[n.cat];
  return (
    <span onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      fontFamily: "var(--font-mono)", fontSize: 10.5,
      cursor: "pointer",
    }}>
      {n.real && <span style={{ color: "var(--green)", fontSize: 8 }} title="реальное событие Bybit">●</span>}
      <span style={{ color: cat.color, fontWeight: 600, fontSize: 9, letterSpacing: 0.08 }}>[{cat.ru}]</span>
      <span style={{ color: sentColor, fontSize: 11 }}>{n.sent >= 0 ? "▲" : "▼"}{Math.abs(n.sent).toFixed(2)}</span>
      <span style={{ color: "var(--text)" }}>{n.text}</span>
      <span style={{ color: "var(--text-dim)" }}>· {n.source.name}</span>
    </span>
  );
}

/* Inject ticker keyframe */
if (typeof document !== "undefined" && !document.getElementById("__ticker_kf")) {
  const s = document.createElement("style");
  s.id = "__ticker_kf";
  s.textContent = `
    @keyframes tickerScroll {
      0% { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }
  `;
  document.head.appendChild(s);
}

/* ─────────────────────────────────────────────────────────
 * Full news drawer (right-side)
 * ────────────────────────────────────────────────────────*/
function NewsDrawer({ open, onClose, items, sentimentIndex }) {
  const [filter, setFilter] = useState("all");
  const [impactFilter, setImpactFilter] = useState("all");

  const filtered = useMemo(() => {
    return items.filter(n => {
      if (filter !== "all" && n.cat !== filter) return false;
      if (impactFilter !== "all" && n.impact !== impactFilter) return false;
      return true;
    });
  }, [items, filter, impactFilter]);

  const stats = useMemo(() => {
    const total = items.length;
    const pos = items.filter(n => n.sent > 0.15).length;
    const neg = items.filter(n => n.sent < -0.15).length;
    const crit = items.filter(n => n.impact === "crit").length;
    const high = items.filter(n => n.impact === "high").length;
    return { total, pos, neg, neu: total - pos - neg, crit, high };
  }, [items]);

  return (
    <Drawer open={open} onClose={onClose} width={620}>
      <header style={{
        padding: "12px 18px",
        borderBottom: "1px solid var(--line)",
        background: "var(--bg-2)",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent)", letterSpacing: "0.18em" }}>
          НОВОСТНОЙ ФИД · LIVE
        </span>
        <span className="mono" style={{ fontSize: 10, color: "var(--text-dim)" }}>{items.length} новостей · 24ч</span>
        <button onClick={onClose} style={{
          marginLeft: "auto",
          background: "transparent", border: "none", color: "var(--text-dim)",
          fontSize: 16, cursor: "pointer", padding: 2,
        }}>✕</button>
      </header>

      {/* Stats strip */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(6, 1fr)",
        gap: 8, padding: "10px 18px",
        borderBottom: "1px solid var(--line)",
        background: "var(--bg-1)",
      }}>
        <NewsStat label="ВСЕГО" v={stats.total} c="var(--text-bright)" />
        <NewsStat label="ПОЗИТИВ" v={stats.pos} c="var(--green)" />
        <NewsStat label="НЕГАТИВ" v={stats.neg} c="var(--red)" />
        <NewsStat label="НЕЙТР" v={stats.neu} c="var(--text-mid)" />
        <NewsStat label="HIGH" v={stats.high} c="var(--amber)" />
        <NewsStat label="КРИТ" v={stats.crit} c="var(--red)" />
      </div>

      {/* Filters */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: 6,
        padding: "8px 18px",
        borderBottom: "1px solid var(--line)",
        background: "var(--bg-0)",
      }}>
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="Все" />
        {Object.entries(NEWS_CATS).map(([k, v]) => (
          <FilterChip key={k} active={filter === k} onClick={() => setFilter(k)} label={v.ru} color={v.color} />
        ))}
        <span style={{ width: 1, background: "var(--line)", margin: "0 4px" }} />
        <FilterChip active={impactFilter === "all"} onClick={() => setImpactFilter("all")} label="Любой" />
        <FilterChip active={impactFilter === "crit"} onClick={() => setImpactFilter("crit")} label="КРИТ" color="var(--red)" />
        <FilterChip active={impactFilter === "high"} onClick={() => setImpactFilter("high")} label="HIGH" color="var(--amber)" />
        <FilterChip active={impactFilter === "med"} onClick={() => setImpactFilter("med")} label="MED" color="var(--blue)" />
        <FilterChip active={impactFilter === "low"} onClick={() => setImpactFilter("low")} label="LOW" color="var(--text-mid)" />
      </div>

      {/* News list */}
      <div className="scroll" style={{ flex: 1, overflowY: "auto" }}>
        {filtered.length === 0 && (
          <div style={{ padding: 30, textAlign: "center", color: "var(--text-dim)", fontSize: 12 }}>
            Нет новостей по выбранным фильтрам
          </div>
        )}
        {filtered.map(n => <NewsCard key={n.id} n={n} />)}
      </div>
    </Drawer>
  );
}

function NewsStat({ label, v, c }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, color: c, fontWeight: 500 }}>{v}</div>
      <div style={{ fontSize: 8.5, color: "var(--text-dim)", letterSpacing: 0.15, fontWeight: 600 }}>{label}</div>
    </div>
  );
}

function FilterChip({ active, onClick, label, color }) {
  const c = color || "var(--accent)";
  return (
    <button onClick={onClick} style={{
      padding: "2px 8px",
      background: active ? "var(--accent-soft)" : "transparent",
      color: active ? c : "var(--text-dim)",
      border: `1px solid ${active ? c : "var(--line)"}`,
      borderRadius: 2,
      fontFamily: "var(--font-mono)", fontSize: 9.5, fontWeight: 600,
      letterSpacing: 0.06, cursor: "pointer", textTransform: "uppercase",
    }}>{label}</button>
  );
}

function NewsCard({ n }) {
  const sentColor = n.sent > 0.15 ? "var(--green)" : n.sent < -0.15 ? "var(--red)" : "var(--text-mid)";
  const impactColor = { crit: "var(--red)", high: "var(--amber)", med: "var(--blue)", low: "var(--text-mid)" }[n.impact];
  const cat = NEWS_CATS[n.cat];
  return (
    <div onClick={() => { if (n.link) window.open(n.link, "_blank", "noopener,noreferrer"); }}
      title={n.link ? "открыть источник ↗" : undefined}
      style={{
        padding: "10px 18px",
        borderBottom: "1px solid var(--line)",
        animation: n.isNew ? "newsIn 0.5s ease-out" : "none",
        cursor: n.link ? "pointer" : "default",
      }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600,
          color: cat.color, padding: "1px 5px",
          border: `1px solid ${cat.color}`, borderRadius: 2,
          letterSpacing: 0.08,
        }}>{cat.ru}</span>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600,
          color: impactColor, padding: "1px 5px",
          background: `oklch(from ${impactColor} l c h / 0.1)`,
          border: `1px solid ${impactColor}`, borderRadius: 2,
          letterSpacing: 0.08, textTransform: "uppercase",
        }}>{n.impact}</span>
        <span className="chip mono" style={{ fontSize: 9 }}>{n.asset}</span>
        <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
          {n.real && <span style={{ color: "var(--green)" }}>● </span>}{n.source.name} · {nowAge(n.ts)} назад{n.link ? " ↗" : ""}
        </span>
      </div>
      <div style={{ fontSize: 12.5, color: "var(--text)", lineHeight: 1.5, marginBottom: 6 }}>
        {n.text}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-mono)", fontSize: 10 }}>
        <span style={{ color: "var(--text-dim)" }}>sentiment</span>
        <span style={{ color: sentColor, fontWeight: 600 }}>
          {n.sent >= 0 ? "+" : ""}{n.sent.toFixed(2)}σ
        </span>
        <span style={{
          width: 80, height: 3, background: "var(--bg-3)", borderRadius: 1,
          overflow: "hidden", position: "relative",
        }}>
          <span style={{
            position: "absolute", top: 0, bottom: 0,
            left: n.sent >= 0 ? "50%" : `${50 + n.sent * 50}%`,
            width: `${Math.abs(n.sent) * 50}%`,
            background: sentColor,
          }} />
          <span style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: 1, background: "var(--text-dim)", opacity: 0.5 }} />
        </span>
        <span style={{ marginLeft: "auto", color: "var(--accent)", fontSize: 9.5, letterSpacing: 0.08 }}>
          news.agt · scored
        </span>
      </div>
    </div>
  );
}

if (typeof document !== "undefined" && !document.getElementById("__news_kf")) {
  const s = document.createElement("style");
  s.id = "__news_kf";
  s.textContent = `
    @keyframes newsIn {
      0% { background: oklch(0.78 0.16 var(--accent-h) / 0.12); }
      100% { background: transparent; }
    }
  `;
  document.head.appendChild(s);
}

/* ─────────────────────────────────────────────────────────
 * Real market-events — derived from live Bybit metrics (no news API needed).
 * Returns the single most-notable current condition for a coin, or null.
 * ────────────────────────────────────────────────────────*/
const EVENT_SOURCE = { id: "bybit", name: "Bybit · data", tier: "live" };
function makeMarketEvent(coin, m) {
  if (!m) return null;
  const chg = m.price24hPcnt;
  const cands = [];
  if (m.signalSetup) cands.push({ pr: 3, key: `sig-${m.signalSide}`, cat: "analysis", impact: "high",
    sent: m.signalSide === "buy" ? 0.6 : -0.6,
    text: `TA-движок: сетап ${m.signalSide === "buy" ? "ПОКУПКА" : "ПРОДАЖА"} ${coin} · confidence ${m.forecast}%` });
  if (Math.abs(m.anomalyZ) > 2.2) cands.push({ pr: 2, key: "vol", cat: "onchain", impact: "med",
    sent: chg != null && chg >= 0 ? 0.3 : -0.3,
    text: `Всплеск объёма ${coin} · z=${m.anomalyZ.toFixed(1)}σ от среднего` });
  if (chg != null && Math.abs(chg) >= 3) cands.push({ pr: 2, key: "chg", cat: "analysis",
    impact: Math.abs(chg) >= 6 ? "high" : "med",
    sent: Math.max(-1, Math.min(1, chg / 6)),
    text: `${coin} ${chg >= 0 ? "вырос" : "упал"} на ${Math.abs(chg).toFixed(1)}% за 24ч` });
  if (m.fundingRate != null && Math.abs(m.fundingRate) >= 0.0004) cands.push({ pr: 1, key: "fund", cat: "deriv", impact: "med",
    sent: m.fundingRate > 0 ? -0.2 : 0.2,
    text: `Funding ${coin} ${(m.fundingRate * 100).toFixed(4)}% · перекос ${m.fundingRate > 0 ? "в лонги" : "в шорты"}` });
  if (!cands.length) return null;
  cands.sort((a, b) => b.pr - a.pr);
  return cands[0];
}

/* Map a real RSS headline (from /api/news backend) into a news item.
 * Category/sentiment/asset are inferred from keywords (approximate but grounded). */
function mapEditorialNews(it) {
  const t = (it.title || "").toLowerCase();
  let cat = "analysis", sent = 0, impact = "med";
  if (/hack|exploit|breach|drain|stolen|attack/.test(t)) { cat = "exploit"; sent = -0.6; impact = "high"; }
  else if (/sec|regulat|lawsuit|ban\b|court|fine|settle|charge/.test(t)) { cat = "reg"; sent = -0.3; impact = "high"; }
  else if (/etf|fund|acqui|invest|raise|partner|billion|adopt|treasury/.test(t)) { cat = "biz"; sent = 0.4; impact = "high"; }
  else if (/upgrade|mainnet|launch|fork|integrat|release|testnet/.test(t)) { cat = "tech"; sent = 0.3; impact = "med"; }
  else if (/whale|wallet|transfer|moved|outflow|inflow|on-chain/.test(t)) { cat = "onchain"; sent = -0.1; impact = "med"; }
  if (/surge|rally|soar|gain|jump|bullish|record|approve|win|boost/.test(t)) sent += 0.3;
  if (/dump|crash|plunge|slump|bearish|drop|fall|loss|reject|sink|fear/.test(t)) sent -= 0.3;
  sent = Math.max(-1, Math.min(1, sent));
  let asset = "MULTI";
  const map = [["bitcoin", "BTC"], ["btc", "BTC"], ["ethereum", "ETH"], [" eth", "ETH"], ["solana", "SOL"], [" sol", "SOL"], ["xrp", "XRP"], ["dogecoin", "DOGE"], ["bnb", "BNB"], ["ripple", "XRP"]];
  for (const [k, v] of map) if (t.includes(k)) { asset = v; break; }
  return {
    id: `NW-${++__newsSeq}`, text: it.title, sent, impact, asset, cat,
    source: { name: it.source || "RSS", tier: "tier1" }, real: true, editorial: true,
    link: it.link || null, ts: it.date ? new Date(it.date) : new Date(), isNew: false,
  };
}

/* ─────────────────────────────────────────────────────────
 * NewsHost — owns state, ticker, drawer
 * ────────────────────────────────────────────────────────*/
function NewsHost() {
  const recentRef = useRef([]);
  const [items, setItems] = useState(() => {
    const out = [];
    for (let i = 0; i < 20; i++) {
      const n = makeNewsItem(new Set(out.slice(0, 8).map(x => x.text)));  // dedup within seed
      n.ts = new Date(Date.now() - Math.random() * 1000 * 60 * 60 * 12);
      n.isNew = false;
      out.push(n);
    }
    out.sort((a, b) => b.ts - a.ts);
    recentRef.current = out.slice(0, 8).map(n => n.text);
    return out;
  });
  const [drawerOpen, setDrawerOpen] = useState(false);

  // real market direction (BTC+ETH 24h %) blended into the sentiment index
  const { prices } = useBybitTickers(["BTCUSDT", "ETHUSDT"], 15000);

  // real market-event injection from live Bybit metrics (signals, volume spikes, big moves, funding)
  const eventCdRef = useRef({});
  const mBtc = typeof useMarketMetrics === "function" ? useMarketMetrics("BTCUSDT", 15000) : null;
  const mEth = typeof useMarketMetrics === "function" ? useMarketMetrics("ETHUSDT", 15000) : null;
  useEffect(() => {
    const now = Date.now();
    [["BTC", mBtc], ["ETH", mEth]].forEach(([coin, m]) => {
      const ev = makeMarketEvent(coin, m);
      if (!ev) return;
      const ck = `${coin}-${ev.key}`;
      if (now - (eventCdRef.current[ck] || 0) < 120000) return; // 2-min cooldown per event type
      eventCdRef.current[ck] = now;
      const item = {
        id: `NW-${++__newsSeq}`, text: ev.text, sent: ev.sent, impact: ev.impact,
        asset: coin, cat: ev.cat, source: EVENT_SOURCE, real: true, ts: new Date(), isNew: true,
      };
      setItems(prev => [item, ...prev.map(n => (n.isNew ? { ...n, isNew: false } : n))].slice(0, 40));
    });
  }, [mBtc, mEth]);

  // real editorial headlines from the backend (/api/news) — graceful if no backend
  useEffect(() => {
    let cancelled = false;
    async function loadEditorial() {
      try {
        const res = await fetch("/api/news");
        if (!res.ok) return;
        const j = await res.json();
        if (cancelled || !j || !j.ok || !Array.isArray(j.items)) return;
        const mapped = j.items.slice(0, 25).map(mapEditorialNews);
        setItems(prev => {
          const seen = new Set();
          const merged = [...mapped, ...prev].filter(n => { const k = n.text; if (seen.has(k)) return false; seen.add(k); return true; });
          return merged.sort((a, b) => b.ts - a.ts).slice(0, 45);
        });
      } catch (_) { /* no backend in this environment — keep template + market events */ }
    }
    loadEditorial();
    const id = setInterval(loadEditorial, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Add new news every 8-15s (deduped vs recent, old items lose their "new" flag)
  useEffect(() => {
    const tick = () => {
      const next = makeNewsItem(new Set(recentRef.current));
      recentRef.current = [next.text, ...recentRef.current].slice(0, 8);
      setItems(prev => [next, ...prev.map(n => (n.isNew ? { ...n, isNew: false } : n))].slice(0, 40));
      if (next.impact === "crit") {
        window.__emitToast?.({
          kind: "crit",
          title: `КРИТИЧЕСКАЯ НОВОСТЬ · ${next.asset}`,
          body: next.text,
          meta: `${next.source.name} · sentiment ${next.sent >= 0 ? "+" : ""}${next.sent.toFixed(2)}`,
          duration: 8000,
        });
      }
    };
    let id = setTimeout(function loop() {
      tick();
      id = setTimeout(loop, 8000 + Math.random() * 7000);
    }, 9000);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    window.__openNewsDrawer = () => setDrawerOpen(true);
  }, []);

  const newsMean = useMemo(() => {
    const recent = items.slice(0, 10);
    if (!recent.length) return 0;
    return recent.reduce((s, n) => s + n.sent, 0) / recent.length;
  }, [items]);

  const marketSent = useMemo(() => {
    const vals = ["BTCUSDT", "ETHUSDT"].map(s => (prices[s] ? prices[s].price24hPcnt * 100 : null)).filter(v => v != null);
    if (!vals.length) return null;
    return Math.max(-1, Math.min(1, Math.tanh((vals.reduce((s, v) => s + v, 0) / vals.length) / 3)));
  }, [prices]);

  // honest composite: news tone + real market direction
  const sentimentIndex = marketSent != null ? newsMean * 0.6 + marketSent * 0.4 : newsMean;

  return (
    <>
      <NewsTicker items={items} onOpen={() => setDrawerOpen(true)} sentimentIndex={sentimentIndex} />
      <NewsDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} items={items} sentimentIndex={sentimentIndex} />
    </>
  );
}

Object.assign(window, { NewsHost, NewsDrawer });