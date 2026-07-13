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

function makeNewsItem() {
  const t = pick(NEWS_TEMPLATES);
  return {
    id: Math.random().toString(36).slice(2, 10),
    text: tmplNews(t.txt),
    sent: t.sent + (Math.random() - 0.5) * 0.18,
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
        <span style={{ color: "var(--text-dim)" }}>SENT 1ч:</span>
        <span style={{ color: sentColor, fontWeight: 600 }}>
          {sentimentIndex >= 0 ? "+" : ""}{sentimentIndex.toFixed(2)}σ
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
    <div style={{
      padding: "10px 18px",
      borderBottom: "1px solid var(--line)",
      animation: n.isNew ? "newsIn 0.5s ease-out" : "none",
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
          {n.source.name} · {nowAge(n.ts)} назад
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
 * NewsHost — owns state, ticker, drawer
 * ────────────────────────────────────────────────────────*/
function NewsHost() {
  const [items, setItems] = useState(() => {
    return Array.from({ length: 20 }).map(() => {
      const n = makeNewsItem();
      // backdate
      n.ts = new Date(Date.now() - Math.random() * 1000 * 60 * 60 * 12);
      n.isNew = false;
      return n;
    }).sort((a, b) => b.ts - a.ts);
  });
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Add new news every 8-15s
  useEffect(() => {
    const tick = () => {
      const next = makeNewsItem();
      setItems(prev => [next, ...prev].slice(0, 40));
      // toast if crit
      if (next.impact === "crit") {
        window.__emitToast?.({
          kind: "crit",
          title: `КРИТИЧЕСКАЯ НОВОСТЬ · ${next.asset}`,
          body: next.text,
          meta: `${next.source.name} · sentiment ${next.sent >= 0 ? "+" : ""}${next.sent.toFixed(2)}σ`,
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

  // Expose opener
  useEffect(() => {
    window.__openNewsDrawer = () => setDrawerOpen(true);
  }, []);

  const sentimentIndex = useMemo(() => {
    const recent = items.slice(0, 10);
    if (recent.length === 0) return 0;
    return recent.reduce((s, n) => s + n.sent, 0) / recent.length;
  }, [items]);

  return (
    <>
      <NewsTicker items={items} onOpen={() => setDrawerOpen(true)} sentimentIndex={sentimentIndex} />
      <NewsDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} items={items} sentimentIndex={sentimentIndex} />
    </>
  );
}

Object.assign(window, { NewsHost, NewsDrawer });