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

  async function run() {
    if (typeof gatherAnalystData !== "function") { setLoading(false); return; }
    setLoading(true);
    const [cs, mk, nw] = await Promise.all([
      gatherAnalystData(),
      fetch("/api/market").then(r => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/news").then(r => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    setCoins(cs); setMacro(mk && mk.ok ? mk : null); setNews(nw && nw.ok ? nw : null);
    setTs(new Date()); setLoading(false);
  }
  useEffect(() => { run(); const id = setInterval(run, 90000); return () => clearInterval(id); }, []);

  const brain = useMemo(() => (coins ? marketBrain(coins, macro) : null), [coins, macro]);

  const btcForecast = useMemo(() => {
    const btc = coins && coins.find(c => c.bybit === "BTCUSDT");
    return (btc && btc.kl && typeof monteCarloForecast === "function") ? monteCarloForecast(btc.kl, 24, 300) : null;
  }, [coins]);

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
    <div className="scroll" style={{ height: "100%", overflowY: "auto", padding: "var(--gap)", display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
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
          <button className="btn btn-accent" onClick={run} disabled={loading}>{loading ? "⌛ думает…" : "↻ Пересчитать"}</button>
        </div>
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
              {btcForecast && <VerdictChip label="ПРОГНОЗ BTC · 6ч" v={`P(рост) ${(btcForecast.probUp * 100).toFixed(0)}%`} c={btcForecast.probUp >= 0.5 ? "var(--green)" : "var(--red)"} sub={`медиана ${btcForecast.expectedPct >= 0 ? "+" : ""}${btcForecast.expectedPct.toFixed(2)}%`} />}
              <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 9, color: llmMode === "llm" ? "var(--accent)" : "var(--text-dim)", border: `1px solid ${llmMode === "llm" ? "var(--accent)" : "var(--line)"}`, borderRadius: 3, padding: "2px 7px" }}>
                {llmMode === "llm" ? "◆ LLM-синтез" : "◇ детерм. синтез"}
              </span>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ color: "var(--accent)", fontFamily: "var(--font-mono)", fontSize: 15, lineHeight: 1.2 }}>✦</span>
              <div style={{ fontSize: 12.5, color: "var(--text)", lineHeight: 1.6 }}>{narrative}</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "var(--gap)", alignItems: "start" }}>
            {/* Trend map */}
            <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
              <PanelHeader title="КАРТА ТРЕНДОВ" meta={`${brain.bull} вверх · ${brain.bear} вниз · ${brain.neutral} боковик`} />
              <div style={{ padding: "6px 0" }}>
                {brain.trends.map(t => {
                  const cfg = CLS_CFG[t.cls];
                  return (
                    <div key={t.sym} style={{ display: "grid", gridTemplateColumns: "52px 1fr 110px 70px", gap: 8, alignItems: "center", padding: "5px 14px", borderBottom: "1px solid var(--line)" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, color: "var(--text-bright)" }}>{t.sym}</span>
                      <div style={{ height: 6, background: "var(--bg-3)", borderRadius: 3, overflow: "hidden", position: "relative" }}>
                        <div style={{ position: "absolute", left: t.dir < 0 ? "auto" : "50%", right: t.dir < 0 ? "50%" : "auto", top: 0, bottom: 0, width: `${cfg.w * 50}%`, background: cfg.color, opacity: 0.85 }} />
                        <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "var(--line-bright)" }} />
                      </div>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: cfg.color, textAlign: "right" }}>{cfg.label}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: t.chg24h >= 0 ? "var(--green)" : "var(--red)", textAlign: "right" }}>{t.chg24h != null ? `${t.chg24h >= 0 ? "+" : ""}${t.chg24h.toFixed(1)}%` : "—"}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
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

Object.assign(window, { BrainPage, marketBrain });
