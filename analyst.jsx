/* analyst.jsx — Trading Analyst agent: a real daily report synthesised from live
 * Bybit data. Cross-references anomalies vs market moves, reads crowd positioning
 * (long/short + funding), runs the 4 strategy presets in a real backtest, and
 * surfaces actionable setups. Output is algorithmic analysis, NOT investment advice. */

const ANALYST_COINS = [
  { sym: "BTC", bybit: "BTCUSDT" }, { sym: "ETH", bybit: "ETHUSDT" },
  { sym: "SOL", bybit: "SOLUSDT" }, { sym: "BNB", bybit: "BNBUSDT" },
  { sym: "XRP", bybit: "XRPUSDT" }, { sym: "AVAX", bybit: "AVAXUSDT" },
  { sym: "LINK", bybit: "LINKUSDT" }, { sym: "DOGE", bybit: "DOGEUSDT" },
];
const ANALYST_STRATEGIES = [
  { id: "momentum", name: "Momentum" },
  { id: "ai-signals", name: "AI Signals" },
  { id: "vol-breakout", name: "Vol Breakout" },
  { id: "mean-rev", name: "Mean Reversion" },
];

function anFmtPrice(n) {
  if (n == null || isNaN(n)) return "—";
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(4);
}

async function gatherAnalystData() {
  const out = [];
  await Promise.all(ANALYST_COINS.map(async c => {
    try {
      const [kl, tk, lin, ls] = await Promise.all([
        bybitFetchKlines(c.bybit, "15", 200),
        bybitFetchTicker(c.bybit).catch(() => null),
        (typeof bybitFetchLinearStats === "function" ? bybitFetchLinearStats(c.bybit) : Promise.resolve(null)).catch(() => null),
        (typeof bybitFetchLongShort === "function" ? bybitFetchLongShort(c.bybit) : Promise.resolve(null)).catch(() => null),
      ]);
      if (!kl || !kl.length) return;
      const m = computeMarketMetrics(kl, { ticker: tk, linear: lin, longShort: ls });
      const a = typeof analyzeMarket === "function" ? analyzeMarket(kl) : null;
      out.push({ ...c, kl, m, a });
    } catch (_) {}
  }));
  return out;
}

function buildAnalystReport(coins) {
  const valid = coins.filter(c => c.m);
  if (!valid.length) return null;
  const byChg = valid.filter(c => c.m.price24hPcnt != null).sort((a, b) => b.m.price24hPcnt - a.m.price24hPcnt);
  const gainers = byChg.slice(0, 3);
  const losers = byChg.slice(-3).reverse();
  const avgSent = valid.reduce((s, c) => s + c.m.sentiment, 0) / valid.length;
  const avgVol = valid.reduce((s, c) => s + c.m.atrPct, 0) / valid.length;

  const anomalies = valid.filter(c => Math.abs(c.m.anomalyZ) > 2).map(c => ({
    sym: c.sym, z: c.m.anomalyZ, chg: c.m.price24hPcnt,
    note: `объём z=${c.m.anomalyZ.toFixed(1)}σ${c.m.price24hPcnt != null ? ` · движение ${c.m.price24hPcnt >= 0 ? "+" : ""}${c.m.price24hPcnt.toFixed(1)}% за 24ч` : ""}`,
    verdict: Math.abs(c.m.price24hPcnt || 0) > 3 ? "аномальный объём подтверждает движение — тренд/слом" : "объём без движения — накопление/распределение",
  }));

  const setups = valid.filter(c => c.a && c.a.setup).map(c => ({
    sym: c.sym, side: c.a.side, conf: c.a.confidence, sl: c.a.sl, tp: c.a.tp, price: c.m.price, reasons: c.a.reasons,
  })).sort((a, b) => b.conf - a.conf);

  const funding = valid.filter(c => c.m.fundingRate != null).sort((a, b) => Math.abs(b.m.fundingRate) - Math.abs(a.m.fundingRate));
  const positioning = valid.filter(c => c.m.buyRatio != null).map(c => ({ sym: c.sym, buy: c.m.buyRatio })).sort((a, b) => b.buy - a.buy);

  // strategy simulation — real backtest of the 4 presets on BTC + ETH
  const strategies = [];
  ["BTCUSDT", "ETHUSDT"].forEach(bybit => {
    const c = valid.find(x => x.bybit === bybit);
    if (!c || typeof realBacktest !== "function") return;
    ANALYST_STRATEGIES.forEach(sc => {
      try {
        const r = realBacktest(c.kl, { capital: 10000, leverage: 1, fees: 0.02, strategy: sc.id });
        strategies.push({ coin: c.sym, strat: sc.name, roi: r.stats.totalReturn, wr: r.stats.winRate, trades: r.stats.trades, pf: r.stats.profitFactor });
      } catch (_) {}
    });
  });
  strategies.sort((a, b) => b.roi - a.roi);

  return {
    regime: avgSent > 0.15 ? "бычий" : avgSent < -0.15 ? "медвежий" : "нейтральный",
    avgSent, avgVol, coinCount: valid.length,
    gainers, losers, anomalies, setups, funding, positioning, strategies,
    best: strategies[0], worstFunding: funding[0],
  };
}

function AnalystPage({ lang }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ts, setTs] = useState(null);

  async function generate() {
    setLoading(true);
    const coins = await gatherAnalystData();
    setReport(buildAnalystReport(coins));
    setTs(new Date());
    setLoading(false);
  }
  useEffect(() => { generate(); }, []); // auto-run on open

  return (
    <div data-screen-label="14 Analyst" style={{ height: "100%", padding: "var(--gap)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <PageHeader title={lang === "en" ? "TRADING ANALYST" : "АНАЛИТИК · ДНЕВНОЙ ОТЧЁТ"}
        sub={`AI-агент · синтез live-данных Bybit · ${ANALYST_COINS.length} активов · стратегии в симуляции`}
        actions={
          <>
            {typeof LiveTag === "function" && <LiveTag status={loading ? "connecting" : report ? "live" : "rest"} />}
            <button className="btn btn-accent" onClick={generate} disabled={loading}>
              {loading ? "⌛ анализ…" : "↻ Обновить отчёт"}
            </button>
          </>
        }
      />

      {!report ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 12, gap: 10 }}>
          {typeof Waveform === "function" && <Waveform width={120} height={20} color="var(--accent)" bars={24} />}
          Агент собирает данные по {ANALYST_COINS.length} активам и прогоняет стратегии…
        </div>
      ) : (
        <div className="scroll" style={{ flex: 1, overflowY: "auto", display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "var(--gap)", alignContent: "start", paddingRight: 4, minHeight: 0 }}>

          {/* Executive summary */}
          <AnSection title="РЕЗЮМЕ · РЫНОК" span meta={ts ? `сформирован ${ts.toLocaleTimeString("ru-RU", { hour12: false })}` : ""}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              <AnStat label="Режим" v={report.regime} c={report.regime === "бычий" ? "var(--green)" : report.regime === "медвежий" ? "var(--red)" : "var(--amber)"} />
              <AnStat label="Сентимент" v={`${report.avgSent >= 0 ? "+" : ""}${report.avgSent.toFixed(2)}`} c={report.avgSent >= 0 ? "var(--green)" : "var(--red)"} />
              <AnStat label="Волатильность ATR" v={`${report.avgVol.toFixed(2)}%`} c="var(--amber)" />
              <AnStat label="Активов" v={report.coinCount} c="var(--text-bright)" />
            </div>
            <div style={anProse}>
              <span style={{ color: "var(--accent)", fontWeight: 600 }}>↳ analyst.agt: </span>
              Рынок в <b style={{ color: "var(--text-bright)" }}>{report.regime}</b> режиме (средний сентимент {report.avgSent.toFixed(2)}), волатильность {report.avgVol.toFixed(2)}% ATR.
              {report.setups.length ? ` Найдено ${report.setups.length} активных TA-сетапов.` : " Активных сетапов нет — движок ждёт конфлюенса."}
              {report.best ? ` В симуляции лучшая стратегия — «${report.best.strat}» (${report.best.coin}, ${report.best.roi >= 0 ? "+" : ""}${report.best.roi.toFixed(1)}%).` : ""}
            </div>
          </AnSection>

          {/* Movers */}
          <AnSection title="ЛИДЕРЫ И АУТСАЙДЕРЫ · 24Ч">
            {report.gainers.map(c => <AnMoverRow key={c.sym} sym={c.sym} chg={c.m.price24hPcnt} price={c.m.price} up />)}
            <div style={{ height: 1, background: "var(--line)", margin: "4px 0" }} />
            {report.losers.map(c => <AnMoverRow key={c.sym} sym={c.sym} chg={c.m.price24hPcnt} price={c.m.price} />)}
          </AnSection>

          {/* Positioning */}
          <AnSection title="ПОЗИЦИОНИРОВАНИЕ ТОЛПЫ">
            <div style={{ fontSize: 10, color: "var(--text-dim)", marginBottom: 6, fontFamily: "var(--font-mono)" }}>long/short аккаунтов + funding (прокси «умных денег»)</div>
            {report.positioning.slice(0, 5).map(p => {
              const c = report.funding.find(f => f.sym === p.sym);
              return (
                <div key={p.sym} style={{ display: "grid", gridTemplateColumns: "48px 1fr auto", gap: 8, alignItems: "center", padding: "4px 0", fontFamily: "var(--font-mono)", fontSize: 11 }}>
                  <span style={{ color: "var(--text-bright)", fontWeight: 600 }}>{p.sym}</span>
                  <div style={{ display: "flex", height: 8, borderRadius: 2, overflow: "hidden", background: "var(--red)" }}>
                    <div style={{ width: `${p.buy * 100}%`, background: "var(--green)" }} />
                  </div>
                  <span style={{ color: p.buy >= 0.5 ? "var(--green)" : "var(--red)" }}>{(p.buy * 100).toFixed(0)}L</span>
                </div>
              );
            })}
          </AnSection>

          {/* Anomalies vs market */}
          <AnSection title="АНОМАЛИИ vs РЫНОК" span>
            {report.anomalies.length ? report.anomalies.map(a => (
              <div key={a.sym} style={{ padding: "7px 10px", background: "var(--bg-0)", border: "1px solid var(--line)", borderLeft: `2px solid ${Math.abs(a.z) > 3 ? "var(--red)" : "var(--amber)"}`, borderRadius: 3, marginBottom: 6 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--text-bright)" }}>{a.sym} · {a.note}</div>
                <div style={{ fontSize: 11, color: "var(--text-mid)", marginTop: 2 }}>↳ {a.verdict}</div>
              </div>
            )) : <div style={{ fontSize: 11.5, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>Заметных объёмных аномалий (|z|&gt;2σ) не обнаружено.</div>}
          </AnSection>

          {/* Strategy simulation */}
          <AnSection title="СТРАТЕГИИ В СИМУЛЯЦИИ" span meta="реальный бэктест · Bybit 15m · fee 0.02%">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 70px 60px 60px", padding: "4px 8px", background: "var(--bg-2)", borderBottom: "1px solid var(--line)", fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.08, textTransform: "uppercase" }}>
              <span>Стратегия · актив</span><span style={{ textAlign: "right" }}>ROI</span><span style={{ textAlign: "right" }}>Win</span><span style={{ textAlign: "right" }}>PF</span><span style={{ textAlign: "right" }}>Сделок</span>
            </div>
            {report.strategies.map((s, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 90px 70px 60px 60px", padding: "5px 8px", borderBottom: "1px solid var(--line)", fontFamily: "var(--font-mono)", fontSize: 11, background: i === 0 ? "var(--accent-soft)" : "transparent", alignItems: "center" }}>
                <span style={{ color: i === 0 ? "var(--accent)" : "var(--text)" }}>{i === 0 ? "★ " : ""}{s.strat} · {s.coin}</span>
                <span style={{ textAlign: "right", color: s.roi >= 0 ? "var(--green)" : "var(--red)", fontWeight: 600 }}>{s.roi >= 0 ? "+" : ""}{s.roi.toFixed(1)}%</span>
                <span style={{ textAlign: "right", color: "var(--text-mid)" }}>{s.wr.toFixed(0)}%</span>
                <span style={{ textAlign: "right", color: s.pf >= 1 ? "var(--green)" : "var(--red)" }}>{s.pf.toFixed(2)}</span>
                <span style={{ textAlign: "right", color: "var(--text-dim)" }}>{s.trades}</span>
              </div>
            ))}
          </AnSection>

          {/* Actionable ideas */}
          <AnSection title="ЧТО ПОПРОБОВАТЬ · ИДЕИ" span>
            {report.setups.length ? report.setups.map(s => (
              <div key={s.sym} style={{ padding: "9px 12px", background: "var(--bg-0)", border: "1px solid var(--line)", borderLeft: `3px solid ${s.side === "buy" ? "var(--green)" : "var(--red)"}`, borderRadius: 3, marginBottom: 7 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: s.side === "buy" ? "var(--green)" : "var(--red)" }}>{s.side === "buy" ? "▲ ПОКУПКА" : "▼ ПРОДАЖА"} {s.sym}</span>
                  <span className="chip chip-accent" style={{ fontSize: 9 }}>conf {s.conf}%</span>
                  <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-mid)" }}>вход ~{anFmtPrice(s.price)} · SL {anFmtPrice(s.sl)} · TP {anFmtPrice(s.tp)}</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-mid)", lineHeight: 1.4 }}>↳ {s.reasons.join(" · ")}</div>
              </div>
            )) : (
              <div style={{ fontSize: 11.5, color: "var(--text-dim)", fontFamily: "var(--font-mono)", lineHeight: 1.6 }}>
                Активных сетапов сейчас нет. Движок ждёт совпадения факторов (тренд + импульс + подтверждение). Форсировать входы против отсутствия конфлюенса статистически невыгодно.
              </div>
            )}
            <div style={{ marginTop: 8, fontSize: 10, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
              ⚠ Алгоритмический анализ на данных Bybit — не инвестиционная рекомендация.
            </div>
          </AnSection>

        </div>
      )}
    </div>
  );
}

function AnSection({ title, meta, span, children }) {
  return (
    <div className="panel" style={{ gridColumn: span ? "1 / -1" : "auto", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <PanelHeader title={title} meta={meta} />
      <div style={{ padding: 12 }}>{children}</div>
    </div>
  );
}
function AnStat({ label, v, c }) {
  return (
    <div style={{ background: "var(--bg-0)", border: "1px solid var(--line)", borderRadius: 4, padding: "8px 10px" }}>
      <div style={{ fontSize: 8.5, color: "var(--text-dim)", letterSpacing: 0.12, fontWeight: 600, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, color: c, marginTop: 2, textTransform: "uppercase" }}>{v}</div>
    </div>
  );
}
function AnMoverRow({ sym, chg, price, up }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "48px 1fr auto", gap: 8, alignItems: "center", padding: "4px 0", fontFamily: "var(--font-mono)", fontSize: 11.5 }}>
      <span style={{ color: "var(--text-bright)", fontWeight: 600 }}>{sym}</span>
      <span style={{ color: "var(--text-mid)", fontSize: 10.5 }}>{anFmtPrice(price)}</span>
      <span style={{ color: (chg >= 0) ? "var(--green)" : "var(--red)", fontWeight: 600 }}>{chg >= 0 ? "▲ +" : "▼ "}{chg != null ? chg.toFixed(2) : "—"}%</span>
    </div>
  );
}

const anProse = { marginTop: 10, padding: "10px 12px", background: "oklch(0.72 0.17 var(--accent-h) / 0.06)", border: "1px solid oklch(0.72 0.17 var(--accent-h) / 0.25)", borderRadius: 4, fontSize: 12, color: "var(--text)", lineHeight: 1.55 };

Object.assign(window, { AnalystPage, gatherAnalystData, buildAnalystReport });
