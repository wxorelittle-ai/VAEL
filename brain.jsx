/* brain.jsx — "AI Brain": the synthesis layer that fuses everything the system
 * sees (TA across all assets, macro, news, Monte-Carlo) into one market verdict,
 * a forecast, and a trend map. Deterministic core (always works, grounded in real
 * data); optional LLM narrative via /api/assistant when the server has a key. */

const BRAIN_COINS = [
  { sym: "BTC", bybit: "BTCUSDT" }, { sym: "ETH", bybit: "ETHUSDT" },
  { sym: "SOL", bybit: "SOLUSDT" }, { sym: "BNB", bybit: "BNBUSDT" },
  { sym: "XRP", bybit: "XRPUSDT" }, { sym: "AVAX", bybit: "AVAXUSDT" },
  { sym: "LINK", bybit: "LINKUSDT" }, { sym: "DOGE", bybit: "DOGEUSDT" },
];

/* Fuse the per-asset engine reads + macro into one market view. */
function marketBrain(coins, macro) {
  const valid = coins.filter(c => c.m && c.a);
  if (!valid.length) return null;

  const assets = valid.map(c => {
    const a = c.a, m = c.m;
    let cls, dir;
    if (a.trendDir > 0 && a.score > 2) { cls = "strong_up"; dir = 1; }
    else if (a.trendDir > 0) { cls = "up"; dir = 1; }
    else if (a.trendDir < 0 && a.score < -2) { cls = "strong_down"; dir = -1; }
    else if (a.trendDir < 0) { cls = "down"; dir = -1; }
    else { cls = "range"; dir = 0; }
    return {
      sym: c.sym, bybit: c.bybit, cls, dir, score: a.score, conf: a.confidence,
      side: a.side, setup: !!a.setup, atrPct: m.atrPct, chg24h: m.price24hPcnt,
      sentiment: m.sentiment, anomalyZ: m.anomalyZ, fundingRate: m.fundingRate, price: m.price,
    };
  });

  const bull = assets.filter(x => x.dir > 0).length;
  const bear = assets.filter(x => x.dir < 0).length;
  const neutral = assets.length - bull - bear;
  const breadthPct = assets.length ? bull / assets.length * 100 : 50;
  const avgSent = valid.reduce((s, c) => s + c.m.sentiment, 0) / valid.length;
  const avgVol = valid.reduce((s, c) => s + c.m.atrPct, 0) / valid.length;
  const btc = assets.find(x => x.bybit === "BTCUSDT");
  const fng = macro && macro.fng ? macro.fng.value : null;

  // composite regime score (~ −1..+1)
  let rs = (breadthPct - 50) / 50 + Math.max(-1, Math.min(1, avgSent * 2));
  let terms = 2;
  if (fng != null) { rs += (fng - 50) / 50; terms++; }
  if (btc) { rs += btc.dir * 0.5; terms += 0.5; }
  rs = rs / terms;

  const regime = rs > 0.18 ? "risk-on" : rs < -0.18 ? "risk-off" : "нейтральный";
  const bias = rs > 0.1 ? "buy" : rs < -0.1 ? "sell" : "neutral";
  const biasConf = Math.round(52 + Math.min(43, Math.abs(rs) * 70));

  const trends = [...assets].sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
  const setups = assets.filter(x => x.setup).sort((a, b) => b.conf - a.conf);
  const risks = assets.filter(x =>
    x.atrPct > avgVol * 1.6 || Math.abs(x.anomalyZ) > 2.5 || (x.fundingRate != null && Math.abs(x.fundingRate) > 0.0004)
  ).map(x => ({
    sym: x.sym,
    why: x.atrPct > avgVol * 1.6 ? `волатильность ${x.atrPct.toFixed(2)}% (>×1.6 средней)`
      : Math.abs(x.anomalyZ) > 2.5 ? `объёмная аномалия ${x.anomalyZ.toFixed(1)}σ`
        : `funding ${(x.fundingRate * 100).toFixed(3)}% — перекос плечей`,
  }));

  return { regime, regimeScore: rs, bias, biasConf, breadthPct, bull, bear, neutral, avgSent, avgVol, assets, trends, setups, risks, fng, macro };
}

const CLS_CFG = {
  strong_up:   { label: "сильный ▲", color: "var(--green)", w: 1.0 },
  up:          { label: "аптренд ▲", color: "var(--green)", w: 0.6 },
  range:       { label: "боковик ◇", color: "var(--text-dim)", w: 0.25 },
  down:        { label: "даунтренд ▼", color: "var(--red)", w: 0.6 },
  strong_down: { label: "сильный ▼", color: "var(--red)", w: 1.0 },
};

function BrainPage({ lang }) {
  const [coins, setCoins] = useState(null);
  const [macro, setMacro] = useState(null);
  const [news, setNews] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ts, setTs] = useState(null);
  const [narrative, setNarrative] = useState("");
  const [llmMode, setLlmMode] = useState("local"); // local | llm
  // configurable parameters
  const [tf, setTf] = useState("15");        // analysis timeframe
  const [horizon, setHorizon] = useState(24); // Monte-Carlo forecast horizon (candles)
  const [excluded, setExcluded] = useState({}); // { SYM: true } removed from synthesis
  const [detailCoin, setDetailCoin] = useState(null); // coin object for the detail modal

  async function run(interval = tf) {
    if (typeof gatherAnalystData !== "function") { setLoading(false); return; }
    setLoading(true);
    const [cs, mk, nw] = await Promise.all([
      gatherAnalystData(interval),
      fetch("/api/market").then(r => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/news").then(r => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    setCoins(cs); setMacro(mk && mk.ok ? mk : null); setNews(nw && nw.ok ? nw : null);
    setTs(new Date()); setLoading(false);
  }
  useEffect(() => { run(tf); }, [tf]);
  useEffect(() => { const id = setInterval(() => run(tf), 90000); return () => clearInterval(id); }, [tf]);

  const included = useMemo(() => (coins ? coins.filter(c => !excluded[c.sym]) : null), [coins, excluded]);
  const brain = useMemo(() => (included ? marketBrain(included, macro) : null), [included, macro]);

  const btcForecast = useMemo(() => {
    const btc = coins && coins.find(c => c.bybit === "BTCUSDT");
    return (btc && btc.kl && typeof monteCarloForecast === "function") ? monteCarloForecast(btc.kl, horizon, 300) : null;
  }, [coins, horizon]);

  // narrative: try LLM (server key) → fall back to a deterministic synthesis
  useEffect(() => {
    if (!brain) return;
    const det = buildBrainNarrative(brain, btcForecast, news);
    setNarrative(det); setLlmMode("local");
    let cancelled = false;
    const summary = brainSummary(brain, btcForecast, news);
    fetch("/api/assistant", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ q: "Синтезируй рыночный вывод и прогноз в 3-4 предложениях на русском.", ctx: summary }),
    }).then(r => (r.ok ? r.json() : null)).then(j => {
      if (!cancelled && j && j.ok && j.text) { setNarrative(j.text.trim()); setLlmMode("llm"); }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [brain, btcForecast, news]);

  const biasCfg = {
    buy: { label: "ЛОНГ-УКЛОН", color: "var(--green)" },
    sell: { label: "ШОРТ-УКЛОН", color: "var(--red)" },
    neutral: { label: "НЕЙТРАЛЬНО", color: "var(--amber)" },
  }[brain ? brain.bias : "neutral"];
  const regimeColor = brain && brain.regime === "risk-on" ? "var(--green)" : brain && brain.regime === "risk-off" ? "var(--red)" : "var(--amber)";

  return (
    <div style={{ minHeight: "100%", padding: "var(--gap)", display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-bright)", letterSpacing: "-0.01em" }}>
            AI Мозг <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>· синтез рынка и прогноз</span>
          </div>
          <div className="mono" style={{ fontSize: 10.5, color: "var(--text-dim)", marginTop: 3 }}>
            сводит TA по {BRAIN_COINS.length} активам + макро + новости + Monte-Carlo · авто-обновление 90с
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {typeof LiveTag === "function" && <LiveTag status={loading ? "connecting" : brain ? "live" : "rest"} />}
          <button className="btn btn-accent" onClick={() => run(tf)} disabled={loading}>{loading ? "⌛ думает…" : "↻ Пересчитать"}</button>
        </div>
      </div>

      {/* Configurable parameters */}
      <div className="panel" style={{ padding: "9px 14px", display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center" }}>
        <SettingGroup label="Таймфрейм">
          {[{ c: "15", l: "15м" }, { c: "60", l: "1ч" }, { c: "240", l: "4ч" }].map(o => (
            <MiniBtn key={o.c} on={tf === o.c} onClick={() => setTf(o.c)}>{o.l}</MiniBtn>
          ))}
        </SettingGroup>
        <SettingGroup label="Прогноз · свечей">
          {[12, 24, 48].map(h => <MiniBtn key={h} on={horizon === h} onClick={() => setHorizon(h)}>{h}</MiniBtn>)}
        </SettingGroup>
        <SettingGroup label="Активы в синтезе">
          {BRAIN_COINS.map(c => (
            <MiniBtn key={c.sym} on={!excluded[c.sym]} onClick={() => setExcluded(e => ({ ...e, [c.sym]: !e[c.sym] }))}>{c.sym}</MiniBtn>
          ))}
        </SettingGroup>
      </div>

      {loading && !brain ? (
        <div className="panel" style={{ padding: 40, textAlign: "center", color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
          мозг собирает данные по {BRAIN_COINS.length} активам, макро и новостям…
        </div>
      ) : !brain ? (
        <div className="panel" style={{ padding: 40, textAlign: "center", color: "var(--red)", fontFamily: "var(--font-mono)", fontSize: 12 }}>нет данных · проверьте соединение</div>
      ) : (
        <>
          {/* Verdict + narrative */}
          <div className="panel" style={{ padding: "14px 18px", borderLeft: `3px solid ${biasCfg.color}` }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, marginBottom: 10 }}>
              <VerdictChip label="РЕЖИМ" v={brain.regime} c={regimeColor} />
              <VerdictChip label="УКЛОН РЫНКА" v={biasCfg.label} c={biasCfg.color} sub={`уверенность ${brain.biasConf}%`} />
              <VerdictChip label="ШИРИНА" v={`${brain.bull}/${brain.assets.length} ▲`} c={brain.breadthPct >= 50 ? "var(--green)" : "var(--red)"} sub={`${brain.breadthPct.toFixed(0)}% активов в тренде вверх`} />
              {btcForecast && <VerdictChip label={`ПРОГНОЗ BTC · ${horizon}св`} v={`P(рост) ${(btcForecast.probUp * 100).toFixed(0)}%`} c={btcForecast.probUp >= 0.5 ? "var(--green)" : "var(--red)"} sub={`медиана ${btcForecast.expectedPct >= 0 ? "+" : ""}${btcForecast.expectedPct.toFixed(2)}%`} />}
              <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 9, color: llmMode === "llm" ? "var(--accent)" : "var(--text-dim)", border: `1px solid ${llmMode === "llm" ? "var(--accent)" : "var(--line)"}`, borderRadius: 3, padding: "2px 7px" }}>
                {llmMode === "llm" ? "◆ LLM-синтез" : "◇ детерм. синтез"}
              </span>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ color: "var(--accent)", fontFamily: "var(--font-mono)", fontSize: 15, lineHeight: 1.2 }}>✦</span>
              <div style={{ fontSize: 12.5, color: "var(--text)", lineHeight: 1.6 }}>{narrative}</div>
            </div>
          </div>

          {/* External context — macro fuse, BTC↔Nasdaq regime, stablecoin peg */}
          {typeof ExternalSignalsPanel === "function" && <ExternalSignalsPanel />}

          {/* Coin tiles — click for a detailed breakdown */}
          <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
            <PanelHeader title="МОНЕТЫ · КЛИК ДЛЯ РАЗБОРА" meta={`${brain.bull} вверх · ${brain.bear} вниз · ${brain.neutral} боковик`} />
            <div style={{ padding: 12, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
              {brain.trends.map(t => {
                const coin = coins.find(c => c.sym === t.sym);
                return <CoinTile key={t.sym} t={t} onClick={() => coin && setDetailCoin(coin)} />;
              })}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--gap)", alignItems: "start" }}>
              {/* Top setups */}
              <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
                <PanelHeader title="СИЛЬНЕЙШИЕ СЕТАПЫ" meta="TA-движок · confluence" />
                <div style={{ padding: "6px 0" }}>
                  {brain.setups.length ? brain.setups.slice(0, 5).map(s => (
                    <div key={s.sym} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 14px", borderBottom: "1px solid var(--line)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
                      <span style={{ color: s.side === "buy" ? "var(--green)" : "var(--red)", fontWeight: 600 }}>{s.side === "buy" ? "▲ ЛОНГ" : "▼ ШОРТ"}</span>
                      <span style={{ color: "var(--text-bright)" }}>{s.sym}</span>
                      <span style={{ marginLeft: "auto", color: "var(--accent)" }}>conf {s.conf}%</span>
                    </div>
                  )) : <div style={{ padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-dim)" }}>Качественных сетапов нет — движок ждёт конфлюенса.</div>}
                </div>
              </div>

              {/* Risk radar */}
              <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
                <PanelHeader title="РАДАР РИСКОВ" meta={`${brain.risks.length} флагов`} />
                <div style={{ padding: "6px 0" }}>
                  {brain.risks.length ? brain.risks.map(r => (
                    <div key={r.sym} style={{ padding: "5px 14px", borderBottom: "1px solid var(--line)", fontSize: 11 }}>
                      <span style={{ fontFamily: "var(--font-mono)", color: "var(--amber)", fontWeight: 600 }}>{r.sym}</span>
                      <span style={{ color: "var(--text-mid)", marginLeft: 6 }}>{r.why}</span>
                    </div>
                  )) : <div style={{ padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-dim)" }}>Повышенных рисков не обнаружено.</div>}
                </div>
              </div>
          </div>

          {/* News pulse */}
          {news && news.items && news.items.length > 0 && (
            <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
              <PanelHeader title="НОВОСТНОЙ ПУЛЬС" meta={`${news.count} заголовков · реальные RSS-фиды`} />
              <div style={{ padding: "6px 0" }}>
                {news.items.slice(0, 4).map((n, i) => (
                  <a key={i} href={n.link} target="_blank" rel="noopener noreferrer" style={{ display: "grid", gridTemplateColumns: "84px 1fr", gap: 8, padding: "5px 14px", borderBottom: "1px solid var(--line)", textDecoration: "none" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--accent-2)" }}>{n.source}</span>
                    <span style={{ fontSize: 11, color: "var(--text-mid)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.title}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          <div style={{ background: "var(--bg-2)", border: "1px dashed var(--line-bright)", borderRadius: 3, padding: "8px 12px", fontSize: 10.5, color: "var(--text-mid)", lineHeight: 1.5 }}>
            <span className="accent">↳ </span>Синтез строится на реальных данных Bybit (TA по всем активам), макро (Fear&amp;Greed, доминация BTC) и живых новостях; прогноз — Monte-Carlo на волатильности. LLM-нарратив включается, когда на сервере задан ключ. Не является инвестиционной рекомендацией.
          </div>
        </>
      )}

      {detailCoin && <CoinDetailModal coin={detailCoin} horizon={horizon} onClose={() => setDetailCoin(null)} />}
    </div>
  );
}

/* Deterministic market synthesis (the always-on brain voice). */
function buildBrainNarrative(brain, fc, news) {
  const parts = [];
  parts.push(`Рынок в режиме ${brain.regime}: ${brain.bull} из ${brain.assets.length} активов в аптренде (${brain.breadthPct.toFixed(0)}% ширины), средний сентимент ${brain.avgSent >= 0 ? "+" : ""}${brain.avgSent.toFixed(2)}, волатильность ${brain.avgVol.toFixed(2)}% ATR.`);
  if (brain.fng != null) parts.push(`Fear & Greed ${brain.fng}${brain.macro && brain.macro.fng ? " (" + brain.macro.fng.label + ")" : ""}${brain.macro && brain.macro.global ? `, доминация BTC ${brain.macro.global.btcDom.toFixed(1)}%` : ""}.`);
  const biasWord = brain.bias === "buy" ? "лонг" : brain.bias === "sell" ? "шорт" : "нейтральный";
  parts.push(`Общий уклон — ${biasWord} (уверенность ${brain.biasConf}%).`);
  if (fc) parts.push(`Прогноз по BTC на ~6ч: вероятность роста ${(fc.probUp * 100).toFixed(0)}%, медианное движение ${fc.expectedPct >= 0 ? "+" : ""}${fc.expectedPct.toFixed(2)}% (диапазон 90% ${((fc.terminal.p5 - fc.S0) / fc.S0 * 100).toFixed(1)}…+${((fc.terminal.p95 - fc.S0) / fc.S0 * 100).toFixed(1)}%).`);
  if (brain.setups.length) parts.push(`Сильнейший сетап: ${brain.setups[0].side === "buy" ? "лонг" : "шорт"} ${brain.setups[0].sym} (conf ${brain.setups[0].conf}%).`);
  else parts.push("Качественных TA-сетапов сейчас нет — форсировать входы против конфлюенса статистически невыгодно.");
  if (brain.risks.length) parts.push(`Внимание к рискам: ${brain.risks.slice(0, 3).map(r => r.sym).join(", ")}.`);
  return parts.join(" ");
}

/* Compact context handed to the LLM when a server key is configured. */
function brainSummary(brain, fc, news) {
  const trend = brain.trends.slice(0, 6).map(t => `${t.sym}:${CLS_CFG[t.cls].label}${t.chg24h != null ? `(${t.chg24h >= 0 ? "+" : ""}${t.chg24h.toFixed(1)}%)` : ""}`).join(", ");
  const setups = brain.setups.slice(0, 4).map(s => `${s.side} ${s.sym} ${s.conf}%`).join("; ") || "нет";
  return [
    `Ты — аналитический мозг крипто-платформы VAEL. Данные (реальные, Bybit + макро):`,
    `Режим: ${brain.regime} (score ${brain.regimeScore.toFixed(2)}). Уклон: ${brain.bias} conf ${brain.biasConf}%. Ширина: ${brain.bull}/${brain.assets.length} вверх.`,
    `Сентимент ${brain.avgSent.toFixed(2)}, волатильность ${brain.avgVol.toFixed(2)}% ATR.`,
    brain.fng != null ? `Fear&Greed ${brain.fng}${brain.macro && brain.macro.global ? `, BTC.dom ${brain.macro.global.btcDom.toFixed(1)}%` : ""}.` : "",
    fc ? `Monte-Carlo BTC 6ч: P(рост) ${(fc.probUp * 100).toFixed(0)}%, медиана ${fc.expectedPct.toFixed(2)}%.` : "",
    `Тренды: ${trend}.`,
    `Сетапы: ${setups}.`,
    brain.risks.length ? `Риски: ${brain.risks.map(r => r.sym + " (" + r.why + ")").join("; ")}.` : "",
    news && news.items && news.items[0] ? `Топ-новость: ${news.items[0].title}.` : "",
  ].filter(Boolean).join("\n");
}

function VerdictChip({ label, v, c, sub }) {
  return (
    <div>
      <div style={{ fontSize: 8.5, color: "var(--text-dim)", letterSpacing: 0.12, fontWeight: 600, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 16, color: c, marginTop: 2, textTransform: "uppercase" }}>{v}</div>
      {sub && <div style={{ fontSize: 9.5, color: "var(--text-dim)", marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

function SettingGroup({ label, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.06, textTransform: "uppercase" }}>{label}</span>
      <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>{children}</div>
    </div>
  );
}
function MiniBtn({ on, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      fontFamily: "var(--font-mono)", fontSize: 10, padding: "2px 8px", borderRadius: 2, cursor: "pointer",
      background: on ? "var(--accent-soft)" : "transparent", color: on ? "var(--accent)" : "var(--text-dim)",
      border: `1px solid ${on ? "oklch(0.78 0.16 var(--accent-h) / 0.4)" : "var(--line)"}`,
    }}>{children}</button>
  );
}

function CoinTile({ t, onClick }) {
  const cfg = CLS_CFG[t.cls];
  return (
    <button onClick={onClick} style={{
      textAlign: "left", cursor: "pointer", background: "var(--bg-0)", border: "1px solid var(--line)",
      borderLeft: `3px solid ${cfg.color}`, borderRadius: 4, padding: "9px 11px", display: "flex", flexDirection: "column", gap: 5,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--text-bright)" }}>{t.sym}</span>
        {t.setup && <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 8.5, fontWeight: 700, color: t.side === "buy" ? "var(--green)" : "var(--red)", border: `1px solid ${t.side === "buy" ? "var(--green)" : "var(--red)"}`, borderRadius: 2, padding: "1px 4px" }}>{t.side === "buy" ? "LONG" : "SHORT"} {t.conf}%</span>}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 10.5 }}>
        <span style={{ color: cfg.color }}>{cfg.label}</span>
        <span style={{ color: t.chg24h >= 0 ? "var(--green)" : "var(--red)" }}>{t.chg24h != null ? `${t.chg24h >= 0 ? "+" : ""}${t.chg24h.toFixed(1)}%` : "—"}</span>
      </div>
      <div style={{ height: 4, background: "var(--bg-3)", borderRadius: 2, overflow: "hidden", position: "relative" }}>
        <div style={{ position: "absolute", left: t.dir < 0 ? "auto" : "50%", right: t.dir < 0 ? "50%" : "auto", top: 0, bottom: 0, width: `${cfg.w * 50}%`, background: cfg.color, opacity: 0.85 }} />
        <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "var(--line-bright)" }} />
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, color: "var(--text-dim)" }}>подробнее →</div>
    </button>
  );
}

/* Per-coin detailed breakdown — reuses buildTradePlan + TradePlanChart. */
function CoinDetailModal({ coin, horizon, onClose }) {
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const kl = coin.kl || [];
  const tp = typeof buildTradePlan === "function" ? buildTradePlan(kl) : null;
  const fc = (kl.length && typeof monteCarloForecast === "function") ? monteCarloForecast(kl, horizon, 300) : null;
  const chartCandles = kl.slice(-60);
  const ema = [], st = [];
  if (kl.length >= 60 && typeof taEma === "function") { const cl = kl.map(c => c.close); for (let i = kl.length - 60; i < kl.length; i++) ema.push(taEma(cl.slice(0, i + 1), 50)); }
  if (kl.length >= 60 && typeof taSupertrend === "function") { for (let i = kl.length - 60; i < kl.length; i++) { const r = taSupertrend(kl.slice(0, i + 1), 3, 10); st.push({ v: r.value, dir: r.dir }); } }
  const p = tp && tp.plan;
  const fmt = typeof tpFmt === "function" ? tpFmt : (n => (n == null ? "—" : n.toFixed(2)));
  const sideCol = p ? (p.side === "buy" ? "var(--green)" : "var(--red)") : "var(--amber)";

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "oklch(0 0 0 / 0.6)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", zIndex: 9990, display: "flex", alignItems: "center", justifyContent: "center", animation: "cpFade 0.18s ease-out" }}>
      <div onClick={e => e.stopPropagation()} className="scroll" style={{ width: "min(900px, 95vw)", maxHeight: "92vh", overflowY: "auto", background: "var(--bg-1)", border: "1px solid var(--line-bright)", borderRadius: 8, boxShadow: "0 24px 60px -12px oklch(0 0 0 / 0.7), var(--glow-strong)", animation: "cpScale 0.2s cubic-bezier(0.16,1,0.3,1)" }}>
        <header style={{ position: "sticky", top: 0, zIndex: 1, padding: "12px 18px", borderBottom: "1px solid var(--line)", background: "var(--bg-2)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 14, color: "var(--text-bright)", fontWeight: 600 }}>{coin.sym} · разбор и точка входа</div>
          {tp && <span className="mono" style={{ fontSize: 10.5, color: "var(--text-dim)" }}>цена {fmt(tp.price)} · Bybit 15m</span>}
          <button onClick={onClose} style={{ marginLeft: "auto", background: "transparent", border: "none", color: "var(--text-dim)", fontSize: 16, cursor: "pointer" }}>✕</button>
        </header>

        {!tp ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 12 }}>недостаточно данных для разбора</div>
        ) : (
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Chart */}
            {chartCandles.length > 0 && typeof window.TradePlanChart === "function" &&
              React.createElement(window.TradePlanChart, { candles: chartCandles, ema, st, plan: p, width: 860, height: 230 })}

            {/* Plan + strategy */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ background: "var(--bg-0)", border: "1px solid var(--line)", borderLeft: `3px solid ${sideCol}`, borderRadius: 4, padding: "12px 14px" }}>
                <div style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.1, fontWeight: 600, textTransform: "uppercase" }}>Точка входа</div>
                {p ? (
                  <>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, color: sideCol, fontWeight: 700, marginTop: 4 }}>{p.side === "buy" ? "▲ ЛОНГ" : "▼ ШОРТ"}<span style={{ fontSize: 11, color: "var(--accent)", marginLeft: 8 }}>conf {p.conf}%</span></div>
                    <div style={{ display: "flex", gap: 14, marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 11 }}>
                      <span><span style={{ color: "var(--text-dim)" }}>вход </span>{fmt(p.entry)}</span>
                      <span style={{ color: "var(--red)" }}>SL {fmt(p.sl)}</span>
                      <span style={{ color: "var(--green)" }}>TP {fmt(p.tp)}</span>
                      <span style={{ color: "var(--accent)" }}>1:{p.rr.toFixed(1)}</span>
                    </div>
                    <div style={{ marginTop: 8, fontSize: 10.5, color: "var(--text-mid)", lineHeight: 1.5 }}>↳ {p.reasons.join(" · ")}</div>
                  </>
                ) : <div style={{ marginTop: 6, fontSize: 12, color: "var(--amber)", fontFamily: "var(--font-mono)" }}>⏸ готового входа нет — движок ждёт конфлюенса</div>}
              </div>
              <div style={{ background: "var(--bg-0)", border: "1px solid var(--line)", borderRadius: 4, padding: "12px 14px" }}>
                <div style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.1, fontWeight: 600, textTransform: "uppercase" }}>Подходящая стратегия</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--accent)", marginTop: 4 }}>{tp.strategy.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-mid)", marginTop: 5, lineHeight: 1.5 }}>{tp.strategy.why}</div>
                {fc && <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--line)", display: "flex", gap: 14, fontFamily: "var(--font-mono)", fontSize: 11 }}>
                  <span style={{ color: "var(--text-dim)" }}>Прогноз {horizon}св:</span>
                  <span style={{ color: fc.probUp >= 0.5 ? "var(--green)" : "var(--red)" }}>P(рост) {(fc.probUp * 100).toFixed(0)}%</span>
                  <span style={{ color: fc.expectedPct >= 0 ? "var(--green)" : "var(--red)" }}>медиана {fc.expectedPct >= 0 ? "+" : ""}{fc.expectedPct.toFixed(2)}%</span>
                </div>}
              </div>
            </div>

            {/* Why moving */}
            <div style={{ background: "var(--bg-0)", border: "1px solid var(--line)", borderRadius: 4, padding: "10px 14px" }}>
              <div style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.1, fontWeight: 600, textTransform: "uppercase", marginBottom: 6 }}>Почему так движется</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: "var(--text)", lineHeight: 1.55 }}>
                {tp.explain.map((line, i) => <div key={i}><span style={{ color: "var(--accent)" }}>▸ </span>{line}</div>)}
              </div>
            </div>

            {/* Indicators */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
              {tp.indicators.map((ind, i) => {
                const c = ind.bias > 0 ? "var(--green)" : ind.bias < 0 ? "var(--red)" : "var(--text-dim)";
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "var(--bg-0)", border: "1px solid var(--line)", borderLeft: `2px solid ${c}`, borderRadius: 3 }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", flex: 1, minWidth: 0 }}>{ind.label}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: c, fontWeight: 600, whiteSpace: "nowrap" }}>{ind.value}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { BrainPage, marketBrain });
