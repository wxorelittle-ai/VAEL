/* scenarios.jsx — What-if simulation lab */

const SCENARIO_PRESETS = [
  {
    id: "btc-crash",
    name: "Резкое падение BTC",
    icon: "▼",
    color: "var(--red)",
    desc: "Цена BTC падает на N% за 1ч окно. Симулирует панику и cascading liquidations.",
    params: {
      magnitude: { label: "Падение, %", default: -8, min: -50, max: -0.5, step: 0.5, format: v => `${v.toFixed(1)}%` },
      duration:  { label: "Период, мин",  default: 60, min: 5, max: 360, step: 5, format: v => `${v}м` },
      volume:    { label: "Объём ×",      default: 3.2, min: 0.5, max: 12, step: 0.1, format: v => `${v.toFixed(1)}×` },
    },
  },
  {
    id: "whale-dump",
    name: "Дамп крупного кита",
    icon: "$",
    color: "var(--amber)",
    desc: "Whale-кошелёк выводит N ETH на CEX за короткое окно. Поведенческий триггер.",
    params: {
      amount:   { label: "Объём, ETH",   default: 12800, min: 1000, max: 100000, step: 500, format: v => `${v.toLocaleString()} ETH` },
      window:   { label: "Окно, мин",     default: 30, min: 1, max: 240, step: 1, format: v => `${v}м` },
      cex:      { label: "Направление",   default: "binance", options: ["binance", "coinbase", "kraken", "okx"] },
    },
  },
  {
    id: "news-shock",
    name: "Новостной шок",
    icon: "▤",
    color: "var(--accent-2)",
    desc: "Внезапная новость с большим sentiment-impact. Тест реактивности news.agt.",
    params: {
      sentiment:{ label: "Sentiment", default: -0.85, min: -1, max: 1, step: 0.05, format: v => `${v >= 0 ? "+" : ""}${v.toFixed(2)}σ` },
      reach:    { label: "Охват ×",   default: 4.2, min: 0.5, max: 10, step: 0.1, format: v => `${v.toFixed(1)}×` },
      category: { label: "Категория", default: "regulatory", options: ["regulatory", "exploit", "biz", "tech"] },
    },
  },
  {
    id: "rate-hike",
    name: "Повышение ставок ФРС",
    icon: "%",
    color: "var(--blue)",
    desc: "Макро-событие: повышение ставки на N b.p. Долгосрочное давление на risk-on.",
    params: {
      bp:       { label: "Базисные пункты", default: 50, min: 0, max: 200, step: 25, format: v => `+${v} б.п.` },
      surprise: { label: "Сюрприз",          default: true, type: "bool" },
    },
  },
  {
    id: "exploit",
    name: "Эксплойт протокола",
    icon: "!",
    color: "var(--red)",
    desc: "Хак DeFi-протокола на N M$. Триггерит ускоренный отток ликвидности.",
    params: {
      amount:   { label: "Сумма, M$",    default: 18, min: 1, max: 500, step: 1, format: v => `${v}M$` },
      protocol: { label: "Протокол",      default: "uniswap", options: ["uniswap", "aave", "compound", "curve", "lido"] },
      contagion:{ label: "Заражение ×",   default: 2.1, min: 1, max: 8, step: 0.1, format: v => `${v.toFixed(1)}×` },
    },
  },
  {
    id: "bull-run",
    name: "Бычье ралли",
    icon: "▲",
    color: "var(--green)",
    desc: "Ускоренный рост на 24ч окне. Тест трейлинг-выходов и накопления прибыли.",
    params: {
      magnitude:{ label: "Рост, %",      default: 12, min: 1, max: 80, step: 1, format: v => `+${v}%` },
      duration: { label: "Период, ч",   default: 24, min: 1, max: 168, step: 1, format: v => `${v}ч` },
      volume:   { label: "Объём ×",      default: 2.6, min: 0.5, max: 8, step: 0.1, format: v => `${v.toFixed(1)}×` },
    },
  },
];

const PORTFOLIO_BASELINE = {
  totalValue: 142500,
  exposure: 87200,
  positions: [
    { sym: "ETH", side: "long",  size: 28000, entry: 2380, pct: 0.32 },
    { sym: "BTC", side: "long",  size: 32000, entry: 63800, pct: 0.36 },
    { sym: "SOL", side: "long",  size: 12000, entry: 138, pct: 0.14 },
    { sym: "AVAX", side: "short", size: 8000,  entry: 30.4, pct: 0.09 },
    { sym: "USDC", side: "stable", size: 7200, entry: 1.0,  pct: 0.09 },
  ],
};

/* ─────────────────────────────────────────────────────────
 * Impact computation
 * ────────────────────────────────────────────────────────*/
function computeImpact(scenario, params) {
  // base impact factors per scenario type
  const cfg = {
    "btc-crash": () => {
      const m = params.magnitude / 100;
      const vol = params.volume;
      const portfolioPct = m * 0.74 * vol * 0.4; // crypto correlation
      return {
        portfolioPct: portfolioPct * 100,
        riskDelta: Math.min(90, Math.abs(m) * 12 * vol * 0.3),
        triggeredRules: [
          { id: "R-002", name: "Резкая волатильность BTC", chance: 0.96 },
          { id: "R-004", name: "Suspicious wallet contact", chance: 0.42 },
          { id: "R-007", name: "Cascade liquidations", chance: Math.abs(m) > 5 ? 0.88 : 0.34 },
        ].filter(r => r.chance > 0.4),
        triggeredAgents: ["risk.agt", "strategy.agt", "alert.agt", "forecast.agt"],
        marketEvents: [
          "BTC -" + Math.abs(m * 100).toFixed(1) + "% за окно",
          vol > 2 ? "Объём " + vol.toFixed(1) + "× от 24ч-baseline" : null,
          Math.abs(m * 100) > 5 ? "Сработка cascading-liquidations на " + Math.floor(800 * Math.abs(m)) + "M$" : null,
        ].filter(Boolean),
        sentiment: m * 1.4,
        affectedAssets: ["BTC", "ETH", "SOL", "AVAX"],
      };
    },
    "whale-dump": () => {
      const dumpRatio = params.amount / 50000; // normalize
      const urgency = Math.max(0.3, 1 - params.window / 240);
      const pricePct = -dumpRatio * urgency * 6;
      return {
        portfolioPct: pricePct * 0.34,
        riskDelta: dumpRatio * urgency * 60,
        triggeredRules: [
          { id: "R-001", name: "Whale-движение > 10K ETH", chance: params.amount > 10000 ? 0.99 : 0.2 },
          { id: "R-004", name: "Suspicious wallet contact", chance: 0.68 },
        ].filter(r => r.chance > 0.3),
        triggeredAgents: ["onchain.agt", "risk.agt", "alert.agt"],
        marketEvents: [
          `Whale → ${params.cex}: ${params.amount.toLocaleString()} ETH`,
          `Ожидаемое давление на ETH: ${pricePct.toFixed(2)}%`,
          urgency > 0.7 ? "Sell-pressure классифицирован как «спешный»" : null,
        ].filter(Boolean),
        sentiment: -dumpRatio * 0.8,
        affectedAssets: ["ETH", "BTC"],
      };
    },
    "news-shock": () => {
      const impact = params.sentiment * params.reach;
      const portfolioPct = impact * 4;
      return {
        portfolioPct,
        riskDelta: Math.abs(impact) * 38,
        triggeredRules: [
          { id: "R-003", name: "AI-сигнал с confidence ≥ 85%", chance: 0.74 },
          { id: "R-006", name: "Новостной spike-impact", chance: Math.abs(impact) > 1 ? 0.92 : 0.4 },
        ].filter(r => r.chance > 0.3),
        triggeredAgents: ["news.agt", "forecast.agt", "strategy.agt"],
        marketEvents: [
          `Новость · sentiment ${impact >= 0 ? "+" : ""}${impact.toFixed(2)}σ`,
          `Охват: ${params.reach.toFixed(1)}× от baseline`,
          `Категория · ${params.category}`,
        ],
        sentiment: impact,
        affectedAssets: ["BTC", "ETH", "SOL", "AVAX"],
      };
    },
    "rate-hike": () => {
      const pct = -params.bp / 200 * 4 * (params.surprise ? 1.4 : 0.7);
      return {
        portfolioPct: pct,
        riskDelta: Math.abs(pct) * 12 + (params.surprise ? 18 : 4),
        triggeredRules: [
          { id: "R-008", name: "Макро-сдвиг risk-off", chance: params.bp >= 50 ? 0.86 : 0.42 },
        ].filter(r => r.chance > 0.3),
        triggeredAgents: ["risk.agt", "strategy.agt", "forecast.agt"],
        marketEvents: [
          `ФРС: +${params.bp} б.п.`,
          params.surprise ? "Решение неожиданное для рынка" : "Решение в рамках ожиданий",
          "Risk-off режим включён · 4-8ч окно",
        ],
        sentiment: -params.bp / 200 * 1.6,
        affectedAssets: ["BTC", "ETH", "SOL", "AVAX"],
      };
    },
    "exploit": () => {
      const sevPct = -Math.min(8, params.amount / 30) * params.contagion * 0.4;
      return {
        portfolioPct: sevPct,
        riskDelta: Math.min(96, params.amount / 5 * params.contagion),
        triggeredRules: [
          { id: "R-009", name: "Exploit detection", chance: 0.99 },
          { id: "R-004", name: "Suspicious wallet contact", chance: 0.78 },
          { id: "R-007", name: "Cascade liquidations", chance: params.contagion > 2 ? 0.74 : 0.34 },
        ].filter(r => r.chance > 0.4),
        triggeredAgents: ["onchain.agt", "news.agt", "risk.agt", "alert.agt"],
        marketEvents: [
          `Эксплойт ${params.protocol} · потери ${params.amount}M$`,
          `Заражение · ${params.contagion.toFixed(1)}× к related-протоколам`,
          "Ускоренный отток ликвидности",
        ],
        sentiment: -0.74 * params.contagion / 4,
        affectedAssets: ["ETH", "BTC", "SOL"],
      };
    },
    "bull-run": () => {
      const pct = params.magnitude * 0.74;
      return {
        portfolioPct: pct,
        riskDelta: -Math.min(40, params.magnitude * 1.4),
        triggeredRules: [
          { id: "R-003", name: "AI-сигнал с confidence ≥ 85%", chance: 0.92 },
          { id: "R-010", name: "Trailing-stop активирован", chance: 0.88 },
        ].filter(r => r.chance > 0.3),
        triggeredAgents: ["strategy.agt", "forecast.agt"],
        marketEvents: [
          `Рост +${params.magnitude}% за ${params.duration}ч`,
          `Объём · ${params.volume.toFixed(1)}× от baseline`,
          params.magnitude > 20 ? "Параболический паттерн обнаружен" : null,
        ].filter(Boolean),
        sentiment: params.magnitude / 50,
        affectedAssets: ["BTC", "ETH", "SOL", "AVAX"],
      };
    },
  };
  return cfg[scenario.id]();
}

/* ─────────────────────────────────────────────────────────
 * SCENARIOS PAGE
 * ────────────────────────────────────────────────────────*/
const STRIP_COINS = [
  { sym: "BTC", bybit: "BTCUSDT" },
  { sym: "ETH", bybit: "ETHUSDT" },
  { sym: "SOL", bybit: "SOLUSDT" },
  { sym: "AVAX", bybit: "AVAXUSDT" },
  { sym: "BNB", bybit: "BNBUSDT" },
];

function ScenarioMarketStrip({ prices }) {
  const fmtP = n => n >= 1000 ? n.toLocaleString("en-US", { maximumFractionDigits: 0 }) : n >= 1 ? n.toFixed(2) : n.toFixed(4);
  return (
    <div className="panel" style={{ flexShrink: 0, marginBottom: "var(--gap)", display: "flex", alignItems: "stretch", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRight: "1px solid var(--line)", background: "var(--bg-2)" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, fontWeight: 600, letterSpacing: 0.12, color: "var(--accent)", textTransform: "uppercase" }}>Текущий рынок</span>
        {typeof LiveTag === "function" && <LiveTag status="live" />}
      </div>
      {STRIP_COINS.map(c => {
        const t = prices[c.bybit];
        const pct = t ? t.price24hPcnt * 100 : null;
        const up = pct != null && pct >= 0;
        return (
          <div key={c.bybit} style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "6px 16px", borderRight: "1px solid var(--line)", minWidth: 108 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.08 }}>{c.sym}/USDT</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-bright)" }}>{t ? fmtP(t.lastPrice) : "…"}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: pct == null ? "var(--text-dim)" : up ? "var(--green)" : "var(--red)" }}>{pct == null ? "" : `${up ? "+" : ""}${pct.toFixed(2)}%`}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ScenariosPage({ lang }) {
  const [selectedId, setSelectedId] = useState("btc-crash");
  const scenario = SCENARIO_PRESETS.find(s => s.id === selectedId);

  const [params, setParams] = useState(() => extractDefaults(scenario));
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  // live Bybit prices — anchor the what-if lab to the real current market
  const { prices: livePrices } = useBybitTickers(["BTCUSDT", "ETHUSDT", "SOLUSDT", "AVAXUSDT", "BNBUSDT"], 8000);

  // Reset params on scenario change
  useEffect(() => {
    setParams(extractDefaults(scenario));
    setResult(null);
  }, [selectedId]);

  function extractDefaults(s) {
    const out = {};
    Object.entries(s.params).forEach(([k, v]) => {
      out[k] = v.default;
    });
    return out;
  }

  function runSim() {
    setRunning(true);
    setResult(null);
    setTimeout(() => {
      const impact = computeImpact(scenario, params);
      setResult(impact);
      setHistory(h => [{
        ts: new Date(),
        id: `SIM-${Math.floor(Math.random() * 9000 + 1000)}`,
        scenario: scenario.name,
        scenarioId: scenario.id,
        portfolioPct: impact.portfolioPct,
        params: { ...params },
      }, ...h].slice(0, 12));
      setRunning(false);

      window.__emitToast?.({
        kind: impact.portfolioPct >= 0 ? "win" : "loss",
        title: `Сценарий «${scenario.name}» исполнен`,
        body: `Портфель: ${impact.portfolioPct >= 0 ? "+" : ""}${impact.portfolioPct.toFixed(2)}% · Δ-риск +${impact.riskDelta.toFixed(0)} pts`,
        meta: `Сработает правил: ${impact.triggeredRules.length} · агентов: ${impact.triggeredAgents.length}`,
      });
    }, 1100);
  }

  return (
    <div data-screen-label="10 Scenarios" style={{
      minHeight: "100%", padding: "var(--gap)",
      display: "flex", flexDirection: "column",
    }}>
      <PageHeader title={lang === "en" ? "SCENARIOS" : "СЦЕНАРИИ"}
        sub="WHAT-IF LAB · моделирование рыночных событий и реакции системы"
        actions={
          <>
            <button className="btn">Шаблоны</button>
            <button className="btn">Сохранить как</button>
            <button className="btn btn-accent" onClick={runSim} disabled={running}>
              {running ? "⌛ ИСПОЛНЕНИЕ…" : "▸ ЗАПУСТИТЬ СИМУЛЯЦИЮ"}
            </button>
          </>
        }
      />
      <ScenarioMarketStrip prices={livePrices} />
      <div style={{
        flex: 1, display: "grid",
        gridTemplateColumns: "260px 1fr 1fr",
        gap: "var(--gap)",
        minHeight: 0, overflow: "hidden",
      }}>
        {/* Left: preset list + history */}
        <div style={{ display: "grid", gridTemplateRows: "1.6fr 1fr", gap: "var(--gap)", minHeight: 0, overflow: "hidden" }}>
          <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
            <PanelHeader title="ПРЕСЕТЫ" meta={`${SCENARIO_PRESETS.length} · custom 0`} />
            <div className="scroll" style={{ flex: 1, overflowY: "auto" }}>
              {SCENARIO_PRESETS.map(s => (
                <ScenarioCard key={s.id} s={s}
                  selected={s.id === selectedId}
                  onClick={() => setSelectedId(s.id)} />
              ))}
            </div>
          </div>

          <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
            <PanelHeader title="ИСТОРИЯ" meta={`${history.length} запуск(ов)`} />
            <div className="scroll" style={{ flex: 1, overflowY: "auto" }}>
              {history.length === 0 && (
                <div style={{ padding: 16, textAlign: "center", color: "var(--text-dim)", fontSize: 11, fontFamily: "var(--font-mono)" }}>
                  Нет запусков · запустите сценарий
                </div>
              )}
              {history.map(h => <HistRow key={h.id} h={h} onReplay={() => { setSelectedId(h.scenarioId); setParams(h.params); }} />)}
            </div>
          </div>
        </div>

        {/* Center: scenario config */}
        <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
          <PanelHeader title={`КОНФИГ · ${scenario.name.toUpperCase()}`} meta={scenario.id} action={
            <span className="mono" style={{ fontSize: 9.5, color: scenario.color }}>{scenario.icon} {scenario.id}</span>
          } />
          <div className="scroll" style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 11.5, color: "var(--text-mid)", lineHeight: 1.5, padding: 10, background: "var(--bg-0)", border: "1px solid var(--line)", borderRadius: 4 }}>
              <span style={{ color: scenario.color, fontWeight: 600 }}>↳ </span>
              {scenario.desc}
            </div>

            {Object.entries(scenario.params).map(([key, p]) => (
              <ParamField key={key} k={key} p={p} value={params[key]}
                onChange={v => setParams(prev => ({ ...prev, [key]: v }))} />
            ))}

            {/* Live price projection (real Bybit BTC → what-if) */}
            {params.magnitude != null && livePrices.BTCUSDT && (() => {
              const cur = livePrices.BTCUSDT.lastPrice;
              const proj = cur * (1 + params.magnitude / 100);
              const down = params.magnitude < 0;
              const money = n => `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
              return (
                <div>
                  <div style={fieldLabel}>Проекция от реальной цены · BTC</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--bg-0)", border: "1px solid var(--line)", borderRadius: 4, fontFamily: "var(--font-mono)" }}>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontSize: 9, color: "var(--text-dim)" }}>СЕЙЧАС · Bybit</span>
                      <span style={{ fontSize: 14, color: "var(--text-bright)" }}>{money(cur)}</span>
                    </div>
                    <span style={{ color: "var(--text-dim)", fontSize: 16 }}>→</span>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontSize: 9, color: "var(--text-dim)" }}>ПРОЕКЦИЯ · {params.magnitude >= 0 ? "+" : ""}{params.magnitude}%</span>
                      <span style={{ fontSize: 14, color: down ? "var(--red)" : "var(--green)" }}>{money(proj)}</span>
                    </div>
                    <span style={{ marginLeft: "auto", fontSize: 11, color: down ? "var(--red)" : "var(--green)" }}>{down ? "▼" : "▲"} {money(Math.abs(proj - cur))}</span>
                  </div>
                </div>
              );
            })()}

            {/* Portfolio baseline */}
            <div>
              <div style={fieldLabel}>Портфель (baseline)</div>
              <div style={{ background: "var(--bg-0)", border: "1px solid var(--line)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{
                  padding: "6px 10px",
                  background: "var(--bg-2)", borderBottom: "1px solid var(--line)",
                  display: "flex", justifyContent: "space-between", alignItems: "baseline",
                  fontFamily: "var(--font-mono)", fontSize: 10,
                  color: "var(--text-dim)",
                }}>
                  <span>СУММАРНО</span>
                  <span style={{ fontSize: 14, color: "var(--text-bright)" }}>{PORTFOLIO_BASELINE.totalValue.toLocaleString()}$</span>
                </div>
                <div style={{ display: "flex", height: 16, background: "var(--bg-0)" }}>
                  {PORTFOLIO_BASELINE.positions.map(p => {
                    const c = p.side === "long" ? "var(--green)" : p.side === "short" ? "var(--red)" : "var(--text-dim)";
                    return (
                      <div key={p.sym} title={`${p.sym}: ${(p.pct * 100).toFixed(0)}%`} style={{
                        width: `${p.pct * 100}%`,
                        background: c,
                        opacity: 0.6,
                        position: "relative",
                        borderRight: "1px solid var(--bg-1)",
                      }}>
                        <span style={{
                          position: "absolute", inset: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontFamily: "var(--font-mono)", fontSize: 8.5, fontWeight: 700,
                          color: "var(--bg-0)",
                        }}>{p.sym}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ padding: "6px 10px", display: "flex", gap: 10, fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--text-dim)", flexWrap: "wrap" }}>
                  {PORTFOLIO_BASELINE.positions.map(p => (
                    <span key={p.sym}>
                      <span style={{ color: p.side === "long" ? "var(--green)" : p.side === "short" ? "var(--red)" : "var(--text-mid)" }}>●</span>{" "}
                      {p.sym} {p.side === "long" ? "L" : p.side === "short" ? "S" : ""} <span style={{ color: "var(--text)" }}>{p.size.toLocaleString()}$</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: results */}
        <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
          <PanelHeader title="РЕЗУЛЬТАТ СИМУЛЯЦИИ" meta={result ? `${scenario.name} · ${nowTsHM()}` : "ожидание запуска"} action={
            result && <span className="mono" style={{ fontSize: 9.5, color: result.portfolioPct >= 0 ? "var(--green)" : "var(--red)" }}>
              ● ИСПОЛНЕНО
            </span>
          } />
          <div className="scroll" style={{ flex: 1, overflowY: "auto" }}>
            {!result && !running && <EmptyResult />}
            {running && <RunningSim />}
            {result && <ResultPanel result={result} scenario={scenario} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function ScenarioCard({ s, selected, onClick }) {
  return (
    <div onClick={onClick} style={{
      padding: "10px 12px",
      borderBottom: "1px solid var(--line)",
      borderLeft: `3px solid ${selected ? s.color : "transparent"}`,
      background: selected ? "var(--accent-soft)" : "transparent",
      cursor: "pointer",
      display: "flex", alignItems: "center", gap: 10,
    }}>
      <span style={{
        width: 28, height: 28, borderRadius: 4,
        background: "var(--bg-0)",
        border: `1px solid ${s.color}`,
        color: s.color,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700,
        flexShrink: 0,
        boxShadow: selected ? `0 0 12px -2px ${s.color}` : "none",
      }}>{s.icon}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, color: selected ? s.color : "var(--text-bright)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
        <div className="mono" style={{ fontSize: 9.5, color: "var(--text-dim)", marginTop: 1 }}>{s.id} · {Object.keys(s.params).length} парам.</div>
      </div>
    </div>
  );
}

function HistRow({ h, onReplay }) {
  const c = h.portfolioPct >= 0 ? "var(--green)" : "var(--red)";
  return (
    <div onClick={onReplay} style={{
      padding: "5px 10px",
      borderBottom: "1px solid var(--line)",
      cursor: "pointer",
      display: "grid", gridTemplateColumns: "auto 1fr auto",
      gap: 6, alignItems: "center",
      fontFamily: "var(--font-mono)", fontSize: 10,
    }}>
      <span style={{ color: "var(--text-dim)" }}>{h.id}</span>
      <span style={{ color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.scenario}</span>
      <span style={{ color: c, fontWeight: 600 }}>{h.portfolioPct >= 0 ? "+" : ""}{h.portfolioPct.toFixed(2)}%</span>
    </div>
  );
}

function ParamField({ k, p, value, onChange }) {
  if (p.options) {
    return (
      <div>
        <div style={fieldLabel}>{p.label}</div>
        <div style={{ display: "flex", gap: 4 }}>
          {p.options.map(o => {
            const on = value === o;
            return (
              <button key={o} onClick={() => onChange(o)} style={{
                flex: 1, padding: "6px 8px",
                background: on ? "var(--accent-soft)" : "var(--bg-2)",
                color: on ? "var(--accent)" : "var(--text-mid)",
                border: `1px solid ${on ? "oklch(0.78 0.16 var(--accent-h) / 0.4)" : "var(--line)"}`,
                fontFamily: "var(--font-mono)", fontSize: 10.5,
                borderRadius: 3, cursor: "pointer", textTransform: "uppercase",
                letterSpacing: 0.06,
              }}>{o}</button>
            );
          })}
        </div>
      </div>
    );
  }
  if (p.type === "bool") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 3 }}>
        <span style={{ fontSize: 11.5, color: "var(--text-bright)" }}>{p.label}</span>
        <button onClick={() => onChange(!value)} style={{
          width: 32, height: 16,
          background: value ? "var(--accent)" : "var(--bg-3)",
          border: "none", borderRadius: 8, cursor: "pointer", position: "relative",
          boxShadow: value ? `0 0 6px oklch(0.78 0.16 var(--accent-h) / 0.4)` : "none",
        }}>
          <span style={{
            position: "absolute", top: 2, left: value ? 18 : 2,
            width: 12, height: 12, borderRadius: "50%",
            background: value ? "var(--bg-0)" : "var(--text-mid)",
            transition: "left 0.15s",
          }} />
        </button>
      </div>
    );
  }
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ ...fieldLabel, marginBottom: 0 }}>{p.label}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--accent)", fontWeight: 500 }}>{p.format(value)}</span>
      </div>
      <input type="range" min={p.min} max={p.max} step={p.step} value={value}
        onChange={e => onChange(+e.target.value)}
        style={{ width: "100%", accentColor: "var(--accent)" }} />
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", marginTop: 1 }}>
        <span>{p.format ? p.format(p.min) : p.min}</span>
        <span>{p.format ? p.format(p.max) : p.max}</span>
      </div>
    </div>
  );
}

function EmptyResult() {
  return (
    <div style={{
      padding: 40, textAlign: "center",
      color: "var(--text-dim)", fontSize: 12,
      display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
    }}>
      <div style={{
        width: 60, height: 60, borderRadius: 4,
        background: "var(--bg-0)", border: "1px dashed var(--line-bright)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "var(--font-mono)", fontSize: 22, color: "var(--text-dim)",
      }}>?</div>
      <div style={{ maxWidth: 240, lineHeight: 1.5 }}>
        Настройте параметры сценария слева и нажмите «<span className="accent">▸ ЗАПУСТИТЬ СИМУЛЯЦИЮ</span>».
        <br /><br />
        Система рассчитает реакцию портфеля, агентов и правил алертов на гипотетическое событие.
      </div>
    </div>
  );
}

function RunningSim() {
  return (
    <div style={{
      padding: 40, textAlign: "center",
      color: "var(--accent)", fontFamily: "var(--font-mono)",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
    }}>
      <div style={{ fontSize: 11, letterSpacing: 0.2 }}>ИСПОЛНЕНИЕ СИМУЛЯЦИИ…</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, width: 240, alignItems: "flex-start" }}>
        <SimStep label="Применение сценария к портфелю" delay={0} />
        <SimStep label="Расчёт impact на P&L" delay={0.2} />
        <SimStep label="Опрос агентов · ожидаемая реакция" delay={0.4} />
        <SimStep label="Проверка правил алертов" delay={0.6} />
        <SimStep label="Risk-аналитика · обновление scoring" delay={0.8} />
      </div>
    </div>
  );
}

function SimStep({ label, delay }) {
  return (
    <div style={{
      fontSize: 11, color: "var(--text-mid)",
      animation: `simStep 1.1s ease forwards`,
      animationDelay: `${delay}s`,
      opacity: 0,
    }}>
      <span style={{ color: "var(--green)", marginRight: 6 }}>✓</span>{label}
    </div>
  );
}

if (typeof document !== "undefined" && !document.getElementById("__sim_kf")) {
  const s = document.createElement("style");
  s.id = "__sim_kf";
  s.textContent = `
    @keyframes simStep {
      0% { opacity: 0; transform: translateX(-6px); }
      100% { opacity: 1; transform: translateX(0); }
    }
  `;
  document.head.appendChild(s);
}

/* ─────── Result rendering ─────── */
function ResultPanel({ result, scenario }) {
  const portfolioBefore = PORTFOLIO_BASELINE.totalValue;
  const portfolioAfter = portfolioBefore * (1 + result.portfolioPct / 100);
  const pnlAbs = portfolioAfter - portfolioBefore;
  const pnlColor = result.portfolioPct >= 0 ? "var(--green)" : "var(--red)";

  return (
    <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Headline */}
      <div style={{
        padding: "14px 16px",
        background: result.portfolioPct >= 0 ? "oklch(0.78 0.16 155 / 0.08)" : "oklch(0.70 0.20 25 / 0.08)",
        border: `1px solid ${result.portfolioPct >= 0 ? "oklch(0.78 0.16 155 / 0.3)" : "oklch(0.70 0.20 25 / 0.3)"}`,
        borderRadius: 4,
      }}>
        <div style={{ fontSize: 10.5, color: "var(--text-dim)", letterSpacing: 0.15, fontWeight: 600, textTransform: "uppercase" }}>
          ОЖИДАЕМЫЙ ЭФФЕКТ НА ПОРТФЕЛЬ
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 2 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 28, color: pnlColor, fontWeight: 500 }}>
            {result.portfolioPct >= 0 ? "+" : ""}{result.portfolioPct.toFixed(2)}%
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: pnlColor }}>
            {pnlAbs >= 0 ? "+" : ""}{pnlAbs.toFixed(0)}$
          </span>
          <span className="mono" style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-dim)" }}>
            {portfolioBefore.toLocaleString()}$ → {Math.round(portfolioAfter).toLocaleString()}$
          </span>
        </div>
      </div>

      {/* Risk + sentiment */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <ResultStat label="Δ RISK SCORE" v={`+${Math.round(result.riskDelta)}`} c="var(--amber)" sub="из 100" />
        <ResultStat label="SENTIMENT-IMPACT"
          v={`${result.sentiment >= 0 ? "+" : ""}${result.sentiment.toFixed(2)}σ`}
          c={result.sentiment >= 0 ? "var(--green)" : "var(--red)"}
          sub="vs baseline" />
      </div>

      {/* Affected assets impact bars */}
      <div>
        <div style={fieldLabel}>ЭФФЕКТ НА АКТИВЫ ПОРТФЕЛЯ</div>
        <div style={{ background: "var(--bg-0)", border: "1px solid var(--line)", borderRadius: 4, padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          {PORTFOLIO_BASELINE.positions.filter(p => p.side !== "stable").map(p => {
            const isAffected = result.affectedAssets.includes(p.sym);
            const sideMul = p.side === "short" ? -1 : 1;
            const pct = isAffected ? result.portfolioPct * (0.7 + Math.random() * 0.6) * sideMul : 0;
            const c = pct >= 0 ? "var(--green)" : "var(--red)";
            return (
              <div key={p.sym} style={{ display: "grid", gridTemplateColumns: "44px 1fr 80px", gap: 8, alignItems: "center" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-bright)", fontWeight: 600 }}>{p.sym}</span>
                <div style={{ position: "relative", height: 14 }}>
                  <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: 1, background: "var(--text-dim)" }} />
                  {isAffected && (
                    <div style={{
                      position: "absolute", top: 3, bottom: 3,
                      background: c,
                      left: pct >= 0 ? "50%" : `${50 - Math.min(40, Math.abs(pct) * 2)}%`,
                      width: `${Math.min(40, Math.abs(pct) * 2)}%`,
                      borderRadius: 1,
                    }} />
                  )}
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: isAffected ? c : "var(--text-dim)", textAlign: "right" }}>
                  {isAffected ? `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%` : "—"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Triggered rules */}
      <div>
        <div style={fieldLabel}>СРАБОТАЕТ ПРАВИЛ · {result.triggeredRules.length}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {result.triggeredRules.map(r => (
            <div key={r.id} style={{
              padding: "5px 10px",
              background: "var(--bg-0)", border: "1px solid var(--line)",
              borderLeft: "2px solid var(--amber)",
              borderRadius: 3,
              display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 8, alignItems: "center",
              fontSize: 11,
            }}>
              <span className="mono" style={{ fontSize: 9.5, color: "var(--text-dim)" }}>{r.id}</span>
              <span style={{ color: "var(--text)" }}>{r.name}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--amber)" }}>{Math.round(r.chance * 100)}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Triggered agents */}
      <div>
        <div style={fieldLabel}>ОТРЕАГИРУЕТ АГЕНТОВ · {result.triggeredAgents.length}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {result.triggeredAgents.map(a => (
            <span key={a} className="chip chip-accent" style={{ fontSize: 10.5 }}>
              <span style={{ color: "var(--green)", marginRight: 4 }}>●</span>{a}
            </span>
          ))}
        </div>
      </div>

      {/* Market events */}
      <div>
        <div style={fieldLabel}>РЫНОЧНЫЕ СОБЫТИЯ</div>
        <div style={{
          background: "var(--bg-0)", border: "1px solid var(--line)",
          borderRadius: 4, padding: "8px 12px",
          fontFamily: "var(--font-mono)", fontSize: 11,
          color: "var(--text-mid)", lineHeight: 1.7,
        }}>
          {result.marketEvents.map((e, i) => (
            <div key={i}><span style={{ color: "var(--accent)" }}>›</span> {e}</div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 6 }}>
        <button className="btn">Сохранить отчёт</button>
        <button className="btn">Развернуть как миссию</button>
        <button className="btn btn-accent" style={{ marginLeft: "auto" }}>Re-run ⟲</button>
      </div>
    </div>
  );
}

function ResultStat({ label, v, c, sub }) {
  return (
    <div style={{
      padding: "10px 12px",
      background: "var(--bg-0)", border: "1px solid var(--line)",
      borderRadius: 4,
    }}>
      <div style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.15, fontWeight: 600, textTransform: "uppercase" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 2 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 22, color: c, fontWeight: 500 }}>{v}</span>
        {sub && <span className="mono" style={{ fontSize: 9.5, color: "var(--text-dim)" }}>{sub}</span>}
      </div>
    </div>
  );
}

Object.assign(window, { ScenariosPage });