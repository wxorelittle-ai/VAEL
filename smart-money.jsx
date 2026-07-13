/* smart-money.jsx — Smart Money Tracker / Copy Trading */

const SMART_WALLETS = [
  { id: "SM-001", addr: "0x7a2c…ef91", alias: "Whale-Alpha", tier: "ULTRA",
    portfolioUsd: 142_400_000, perf30d: 28.4, perf90d: 84.2, perf1y: 312.6,
    winRate: 76, sharpe: 2.4, totalTrades: 248, followers: 24481, copying: 8421,
    style_ru: "Свинг-трейдер", avgHold: "4.2д", tags: ["DeFi", "L2", "AI"],
    bio: "Ex-Jane Street trader. Фокус на L2-инфраструктуре, narrative-trading. 4 сделки в неделю.", color: "var(--green)" },
  { id: "SM-002", addr: "0x91a4…4f02", alias: "QuantPredator", tier: "TOP",
    portfolioUsd: 38_200_000, perf30d: 18.6, perf90d: 47.2, perf1y: 168.4,
    winRate: 68, sharpe: 1.84, totalTrades: 1242, followers: 12404, copying: 4211,
    style_ru: "Скальпер", avgHold: "47м", tags: ["scalp", "ETH", "perp"],
    bio: "Алго-трейдер. 200-300 сделок в неделю. Custom ML-модели для micro-movements.", color: "var(--accent)" },
  { id: "SM-003", addr: "0xfe44…aa01", alias: "DegenSensei", tier: "PRO",
    portfolioUsd: 8_400_000, perf30d: 142.4, perf90d: 384.6, perf1y: 2840.2,
    winRate: 42, sharpe: 1.18, totalTrades: 184, followers: 8241, copying: 2842,
    style_ru: "Дегенерат", avgHold: "8ч", tags: ["memes", "100×"],
    bio: "Memecoin-охотник. Большие убытки, но 1 из 8 сделок — 50×+. Strict risk-management обязателен.", color: "var(--amber)" },
  { id: "SM-004", addr: "0xcc88…b001", alias: "BridgeKing", tier: "TOP",
    portfolioUsd: 24_600_000, perf30d: 12.2, perf90d: 38.4, perf1y: 144.2,
    winRate: 71, sharpe: 1.62, totalTrades: 412, followers: 6421, copying: 1842,
    style_ru: "Арбитраж", avgHold: "32м", tags: ["arb", "bridges"],
    bio: "Cross-chain арбитраж. Bots на 4 моста одновременно. Низкий риск, стабильная доходность.", color: "var(--blue)" },
  { id: "SM-005", addr: "0x4a9e…b821", alias: "AlphaHunter", tier: "PRO",
    portfolioUsd: 14_800_000, perf30d: 22.4, perf90d: 68.2, perf1y: 248.4,
    winRate: 63, sharpe: 1.42, totalTrades: 318, followers: 4424, copying: 1124,
    style_ru: "Свинг-трейдер", avgHold: "6.4д", tags: ["alts", "narrative"],
    bio: "Sector rotation. Заранее покупает narrative до hype-цикла.", color: "var(--accent-2)" },
  { id: "SM-006", addr: "0x8a12…ff04", alias: "OldMoney", tier: "ULTRA",
    portfolioUsd: 412_000_000, perf30d: 8.4, perf90d: 22.4, perf1y: 88.4,
    winRate: 84, sharpe: 2.8, totalTrades: 48, followers: 38412, copying: 14212,
    style_ru: "Долгосрочный", avgHold: "240д", tags: ["BTC", "ETH", "blue"],
    bio: "Старый кит. 8 лет в крипте. Только BTC/ETH + blue-chip. Покупает на падениях.", color: "var(--green)" },
];

const TIERS = {
  ULTRA: { color: "var(--green)",  text: "ULTRA" },
  TOP:   { color: "var(--accent)", text: "TOP" },
  PRO:   { color: "var(--blue)",   text: "PRO" },
};

function makeTrade() {
  const w = pick(SMART_WALLETS);
  const sym = pick(["ETH", "BTC", "SOL", "AVAX", "ARB", "LINK", "OP", "WIF"]);
  const side = Math.random() > 0.5 ? "buy" : "sell";
  return {
    id: Math.random().toString(36).slice(2, 8),
    walletId: w.id,
    walletAlias: w.alias,
    walletColor: w.color,
    sym, side,
    size: Math.floor(Math.random() * 2400 + 80),
    price: sym === "BTC" ? 64280 + (Math.random() - 0.5) * 400 : sym === "ETH" ? 2412 + (Math.random() - 0.5) * 40 : sym === "SOL" ? 142 + (Math.random() - 0.5) * 4 : Math.random() * 100 + 0.5,
    ts: nowTsHM(),
    isNew: true,
  };
}

function SmartMoneyPage({ lang }) {
  const [selected, setSelected] = useState(SMART_WALLETS[0].id);
  const [followed, setFollowed] = useState(new Set(["SM-001", "SM-006"]));
  const [feed, setFeed] = useState(() => Array.from({ length: 14 }, () => ({ ...makeTrade(), isNew: false })));
  const [sortBy, setSortBy] = useState("perf30d");

  useInterval(() => {
    setFeed(prev => [{ ...makeTrade() }, ...prev.map(t => ({ ...t, isNew: false }))].slice(0, 24));
  }, 4500);

  const sel = SMART_WALLETS.find(w => w.id === selected);
  const sorted = useMemo(() => {
    return [...SMART_WALLETS].sort((a, b) => b[sortBy] - a[sortBy]);
  }, [sortBy]);

  function toggleFollow(id) {
    setFollowed(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      const w = SMART_WALLETS.find(x => x.id === id);
      window.__emitToast?.({
        kind: n.has(id) ? "agent" : "info",
        title: n.has(id) ? `Подписка на ${w.alias}` : `Отписка от ${w.alias}`,
        body: n.has(id) ? "Все сделки этого кошелька будут зеркалироваться в feed" : "Сделки больше не отображаются в priority feed",
        meta: w.addr,
      });
      return n;
    });
  }

  return (
    <div data-screen-label="13 Smart Money" style={{
      height: "100%", padding: "var(--gap)",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      <PageHeader title={lang === "en" ? "SMART MONEY" : "SMART MONEY"}
        sub={`COPY-TRADING · ${SMART_WALLETS.length} топ-кошельков · live feed`}
        actions={
          <>
            <button className={`btn ${sortBy === "perf30d" ? "btn-accent" : ""}`} onClick={() => setSortBy("perf30d")}>30Д PnL</button>
            <button className={`btn ${sortBy === "perf1y" ? "btn-accent" : ""}`} onClick={() => setSortBy("perf1y")}>1Г PnL</button>
            <button className={`btn ${sortBy === "winRate" ? "btn-accent" : ""}`} onClick={() => setSortBy("winRate")}>WIN RATE</button>
            <button className={`btn ${sortBy === "sharpe" ? "btn-accent" : ""}`} onClick={() => setSortBy("sharpe")}>SHARPE</button>
            <button className="btn">+ Добавить</button>
          </>
        }
      />

      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1.4fr 1.4fr 1fr", gap: "var(--gap)", minHeight: 0, overflow: "hidden" }}>
        {/* Leaderboard */}
        <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
          <PanelHeader title={`ЛИДЕРБОРД · sort: ${sortBy}`} meta={`${SMART_WALLETS.length} верифицированных`} />
          <div className="scroll" style={{ flex: 1, overflowY: "auto" }}>
            {sorted.map((w, i) => <SmRow key={w.id} w={w} rank={i + 1} selected={selected === w.id}
              followed={followed.has(w.id)}
              onSelect={() => setSelected(w.id)}
              onToggleFollow={() => toggleFollow(w.id)} />)}
          </div>
        </div>

        {/* Detail */}
        <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
          {sel && <SmDetail w={sel} followed={followed.has(sel.id)} onToggleFollow={() => toggleFollow(sel.id)} />}
        </div>

        {/* Live feed */}
        <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
          <PanelHeader title="ПОТОК СДЕЛОК · LIVE" meta="все smart-кошельки" action={
            <span className="mono" style={{ fontSize: 9.5, color: "var(--green)" }}>
              <PulseDot size={4} color="var(--green)" /> {feed.length}
            </span>
          } />
          <div className="scroll" style={{ flex: 1, overflowY: "auto" }}>
            {feed.map(t => <SmTradeRow key={t.id} t={t} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

function SmRow({ w, rank, selected, followed, onSelect, onToggleFollow }) {
  const tier = TIERS[w.tier];
  const perfColor = w.perf30d > 50 ? "var(--green)" : w.perf30d > 20 ? "var(--accent)" : w.perf30d > 0 ? "var(--amber)" : "var(--red)";
  return (
    <div onClick={onSelect} style={{
      padding: "10px 12px",
      borderBottom: "1px solid var(--line)",
      borderLeft: `3px solid ${selected ? w.color : "transparent"}`,
      background: selected ? "var(--accent-soft)" : "transparent",
      cursor: "pointer",
      display: "flex", flexDirection: "column", gap: 6,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{
          width: 22, height: 22, borderRadius: 3,
          background: "var(--bg-2)", border: `1px solid ${rank <= 3 ? "var(--amber)" : "var(--line)"}`,
          color: rank <= 3 ? "var(--amber)" : "var(--text-dim)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700,
        }}>#{rank}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 12, color: "var(--text-bright)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.alias}</span>
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: 8.5, fontWeight: 700,
              color: tier.color, padding: "0 4px",
              border: `1px solid ${tier.color}`, borderRadius: 2,
            }}>{tier.text}</span>
          </div>
          <div className="mono" style={{ fontSize: 9.5, color: "var(--text-dim)" }}>{w.addr} · {w.style_ru}</div>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onToggleFollow(); }} style={{
          padding: "2px 8px",
          background: followed ? "var(--accent-soft)" : "var(--bg-2)",
          color: followed ? "var(--accent)" : "var(--text-mid)",
          border: `1px solid ${followed ? "oklch(0.78 0.16 var(--accent-h) / 0.4)" : "var(--line)"}`,
          borderRadius: 2, fontFamily: "var(--font-mono)", fontSize: 9.5, fontWeight: 600,
          cursor: "pointer", letterSpacing: 0.06,
        }}>{followed ? "✓ ПОДПИСАН" : "+ КОПИРОВАТЬ"}</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 4, fontFamily: "var(--font-mono)", fontSize: 9.5 }}>
        <span><span style={{ color: "var(--text-dim)" }}>30Д:</span> <span style={{ color: perfColor, fontWeight: 600 }}>+{w.perf30d.toFixed(1)}%</span></span>
        <span><span style={{ color: "var(--text-dim)" }}>WIN:</span> <span style={{ color: w.winRate > 60 ? "var(--green)" : "var(--amber)" }}>{w.winRate}%</span></span>
        <span><span style={{ color: "var(--text-dim)" }}>SH:</span> <span style={{ color: w.sharpe > 1.5 ? "var(--green)" : "var(--amber)" }}>{w.sharpe.toFixed(1)}</span></span>
        <span><span style={{ color: "var(--text-dim)" }}>$:</span> <span style={{ color: "var(--text)" }}>${(w.portfolioUsd / 1_000_000).toFixed(1)}M</span></span>
      </div>
    </div>
  );
}

function SmDetail({ w, followed, onToggleFollow }) {
  const perfCurve = useMemo(() => genSpark(100, 0.12, 30), [w.id]);
  return (
    <div className="scroll" style={{ flex: 1, overflowY: "auto" }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", background: "var(--bg-2)", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 6,
          background: "var(--bg-0)", border: `1.5px solid ${w.color}`,
          color: w.color, display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700,
          boxShadow: `0 0 20px -5px ${w.color}`,
        }}>{w.alias.slice(0, 2).toUpperCase()}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, color: "var(--text-bright)", fontWeight: 500 }}>{w.alias}</div>
          <div className="mono" style={{ fontSize: 10.5, color: "var(--text-dim)" }}>{w.addr} · {w.style_ru} · avg {w.avgHold}</div>
        </div>
        <button onClick={onToggleFollow} className={followed ? "btn" : "btn btn-accent"}>
          {followed ? "✓ ПОДПИСАН" : "+ КОПИРОВАТЬ СДЕЛКИ"}
        </button>
      </div>
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.55, padding: 10, background: "var(--bg-0)", border: "1px solid var(--line)", borderLeft: `3px solid ${w.color}`, borderRadius: 4 }}>
          <span style={{ color: w.color, fontWeight: 600 }}>↳ BIO: </span>{w.bio}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          <SmStat label="30Д" v={`+${w.perf30d}%`} c={w.perf30d > 20 ? "var(--green)" : "var(--amber)"} />
          <SmStat label="90Д" v={`+${w.perf90d}%`} c="var(--green)" />
          <SmStat label="1Г" v={`+${w.perf1y}%`} c="var(--green)" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          <SmStat label="WIN RATE" v={`${w.winRate}%`} c={w.winRate > 60 ? "var(--green)" : "var(--amber)"} />
          <SmStat label="SHARPE" v={w.sharpe.toFixed(2)} c={w.sharpe > 1.5 ? "var(--green)" : "var(--amber)"} />
          <SmStat label="СДЕЛОК" v={w.totalTrades} c="var(--accent)" />
          <SmStat label="ПОДПИСЧИКОВ" v={(w.followers / 1000).toFixed(1) + "K"} c="var(--text-bright)" />
        </div>
        <div>
          <div style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.15, fontWeight: 600, marginBottom: 6 }}>ДОХОДНОСТЬ · 30Д</div>
          <div style={{ background: "var(--bg-0)", border: "1px solid var(--line)", borderRadius: 4, padding: 10 }}>
            <Sparkline data={perfCurve} width={420} height={80} color="var(--green)" />
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.15, fontWeight: 600, marginBottom: 6 }}>СТИЛЬ ТОРГОВЛИ</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {w.tags.map(t => <span key={t} className="chip chip-accent">#{t}</span>)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.15, fontWeight: 600, marginBottom: 6 }}>ПАРАМЕТРЫ КОПИРОВАНИЯ</div>
          <div style={{ background: "var(--bg-0)", border: "1px solid var(--line)", borderRadius: 4, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <CopyRow label="Размер копии" value="10% от его сделки" />
            <CopyRow label="Макс. позиция" value="$2 000" />
            <CopyRow label="Задержка" value="≤ 30 секунд" />
            <CopyRow label="Авто SL" value="−5% от входа" />
          </div>
        </div>
      </div>
    </div>
  );
}

function SmStat({ label, v, c }) {
  return (
    <div style={{ padding: "8px 10px", background: "var(--bg-0)", border: "1px solid var(--line)", borderRadius: 3 }}>
      <div style={{ fontSize: 8.5, color: "var(--text-dim)", letterSpacing: 0.12, fontWeight: 600 }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, color: c, marginTop: 1, fontWeight: 500 }}>{v}</div>
    </div>
  );
}

function CopyRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5 }}>
      <span style={{ color: "var(--text-mid)" }}>{label}</span>
      <span className="mono" style={{ color: "var(--text-bright)" }}>{value}</span>
    </div>
  );
}

function SmTradeRow({ t }) {
  const sideColor = t.side === "buy" ? "var(--green)" : "var(--red)";
  return (
    <div style={{
      padding: "7px 12px",
      borderBottom: "1px solid var(--line)",
      display: "grid", gridTemplateColumns: "auto 1fr auto",
      gap: 8, alignItems: "center",
      animation: t.isNew ? "alertIn 0.5s ease-out" : "none",
    }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>{t.ts}</span>
      <div>
        <div style={{ fontSize: 11, color: "var(--text-bright)", display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ color: t.walletColor, fontWeight: 600 }}>{t.walletAlias}</span>
          <span style={{ color: sideColor, fontWeight: 600 }}>{t.side === "buy" ? "▲ BUY" : "▼ SELL"}</span>
          <span style={{ color: "var(--text)" }}>{t.sym}</span>
        </div>
        <div className="mono" style={{ fontSize: 9.5, color: "var(--text-dim)" }}>
          {t.size.toLocaleString()} @ ${t.price.toFixed(t.price < 10 ? 3 : 2)}
        </div>
      </div>
      <span className="mono" style={{ fontSize: 9.5, color: "var(--text-mid)" }}>
        ${(t.size * t.price / 1000).toFixed(1)}K
      </span>
    </div>
  );
}

Object.assign(window, { SmartMoneyPage });