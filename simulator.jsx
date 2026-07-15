/* simulator.jsx — Strategy Lab. Backtests the built-in strategy library, GENERATES
 * its own strategies and EVOLVES the winners of the previous run, all on real
 * Bybit candles. Any strategy profitable on the day is kept as a "champion" and
 * tracked across runs so you see performance in dynamics. Engine: sim-lab.jsx. */

const SIM_COINS = [
  { sym: "BTC", bybit: "BTCUSDT" }, { sym: "ETH", bybit: "ETHUSDT" },
  { sym: "SOL", bybit: "SOLUSDT" }, { sym: "BNB", bybit: "BNBUSDT" },
  { sym: "XRP", bybit: "XRPUSDT" }, { sym: "AVAX", bybit: "AVAXUSDT" },
  { sym: "LINK", bybit: "LINKUSDT" }, { sym: "DOGE", bybit: "DOGEUSDT" },
];
const SIM_PERIODS = [
  { id: "day", label: "День", interval: "15", limit: 200 },
  { id: "week", label: "Неделя", interval: "60", limit: 200 },
  { id: "month", label: "Месяц", interval: "240", limit: 200 },
];
const SRC_CFG = {
  builtin:   { label: "встроенная", color: "var(--accent)" },
  generated: { label: "сгенерирована", color: "var(--blue)" },
  evolved:   { label: "эволюция", color: "var(--accent-2)" },
};

function SimulatorPage({ lang }) {
  const [coinIdx, setCoinIdx] = useState(0);
  const [periodId, setPeriodId] = useState("day");
  const [capital, setCapital] = useState(() => { try { return +localStorage.getItem("vael.budget") || 10000; } catch (_) { return 10000; } });
  const [lev, setLev] = useState(1);
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState(null);
  const [champs, setChamps] = useState(() => (typeof loadChampions === "function" ? loadChampions() : []));
  const [gen, setGen] = useState(0);
  const [ts, setTs] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const seedRef = useRef([]);
  const featRef = useRef(null);

  const coin = SIM_COINS[coinIdx];
  const period = SIM_PERIODS.find(p => p.id === periodId);

  async function run(evolve = false) {
    if (typeof bybitFetchKlines !== "function" || typeof runSimLab !== "function") return;
    setRunning(true);
    try {
      const candles = await bybitFetchKlines(coin.bybit, period.interval, period.limit);
      const seeds = evolve ? seedRef.current : [];
      const cfg = { capital, leverage: lev, fees: 0.055, genCount: 8, genSeed: (evolve ? gen * 8 : 0) };  // 0.055% taker, same as demo terminal
      const r = runSimLab(candles, cfg, seeds);
      featRef.current = { candles, f: (typeof computeFeatures === "function" ? computeFeatures(candles) : null) };
      setExpanded(null);
      setRows(r);
      seedRef.current = r.slice(0, 4).filter(x => x.genes).map(x => x.genes);   // winners → next evolution
      setGen(g => evolve ? g + 1 : 1);
      const nowMs = period.limit ? Date.now() : Date.now();
      if (typeof recordChampions === "function") setChamps(recordChampions(r, coin.sym, nowMs));
      setTs(new Date());
    } catch (_) { setRows([]); }
    setRunning(false);
  }
  useEffect(() => { run(false); /* eslint-disable-next-line */ }, []);
  useEffect(() => { setGen(0); seedRef.current = []; }, [coinIdx, periodId]);

  const best = rows && rows[0];
  const bySrc = rows ? { builtin: rows.filter(r => r.source === "builtin").length, generated: rows.filter(r => r.source === "generated").length, evolved: rows.filter(r => r.source === "evolved").length } : null;

  return (
    <div style={{ minHeight: "100%", padding: "var(--gap)", display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-bright)", letterSpacing: "-0.01em" }}>
            Лаборатория стратегий <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>· библиотека + генерация + эволюция</span>
          </div>
          <div className="mono" style={{ fontSize: 10.5, color: "var(--text-dim)", marginTop: 3 }}>
            реальный бэктест на свечах Bybit · комиссия 0.055% + проскальзывание 0.02% · прибыльные стратегии остаются и отслеживаются в динамике
          </div>
        </div>
        {typeof LiveTag === "function" && <LiveTag status={running ? "connecting" : rows ? "live" : "rest"} />}
      </div>

      {/* Controls */}
      <div className="panel" style={{ padding: "10px 14px", display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
        <SimGroup label="Актив">{SIM_COINS.map((c, i) => <SimBtn key={c.sym} on={i === coinIdx} onClick={() => setCoinIdx(i)}>{c.sym}</SimBtn>)}</SimGroup>
        <SimGroup label="Период">{SIM_PERIODS.map(p => <SimBtn key={p.id} on={periodId === p.id} onClick={() => setPeriodId(p.id)}>{p.label}</SimBtn>)}</SimGroup>
        <SimGroup label="Плечо">{[1, 2, 5, 10].map(l => <SimBtn key={l} on={lev === l} onClick={() => setLev(l)}>{l}x</SimBtn>)}</SimGroup>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", textTransform: "uppercase" }}>Капитал</span>
          <input type="number" value={capital} onChange={e => setCapital(Math.max(100, +e.target.value || 0))}
            style={{ width: 88, background: "var(--bg-0)", border: "1px solid var(--line-bright)", color: "var(--text-bright)", fontFamily: "var(--font-mono)", fontSize: 11, padding: "4px 7px", borderRadius: 3, outline: "none", textAlign: "right" }} />
          <span className="mono" style={{ fontSize: 10, color: "var(--text-dim)" }}>$</span>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button onClick={() => run(false)} disabled={running} className="btn">{running ? "⌛…" : "▸ Прогнать"}</button>
          <button onClick={() => run(true)} disabled={running || !rows} className="btn btn-accent" title="Мутирует лучших из прошлого прогона и тестирует потомков">
            ⟳ Эволюция{gen > 0 ? ` · пок.${gen}` : ""}
          </button>
        </div>
      </div>

      {running && !rows ? (
        <div className="panel" style={{ padding: 40, textAlign: "center", color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 12 }}>прогоняю стратегии на свечах {coin.sym}…</div>
      ) : rows && rows.length ? (
        <>
          {/* Summary */}
          <div className="panel" style={{ display: "flex", flexWrap: "wrap" }}>
            <SimStat label={`ЛУЧШАЯ · ${period.label.toUpperCase()}`} v={best.name} c={SRC_CFG[best.source].color}
              sub={`${best.totalReturn >= 0 ? "+" : ""}${best.totalReturn.toFixed(1)}% OOS · ${SRC_CFG[best.source].label}`} />
            <SimStat label="ПРИБЫЛЬ ЛУЧШЕЙ" v={`${best.profit >= 0 ? "+" : "−"}$${Math.abs(best.profit).toFixed(0)}`}
              c={best.profit >= 0 ? "var(--green)" : "var(--red)"} sub={`капитал $${capital.toLocaleString("en-US")} · ${lev}x · win ${best.winRate.toFixed(0)}%`} />
            <SimStat label="СТРАТЕГИЙ В ПРОГОНЕ" v={rows.length}
              c="var(--text-bright)" sub={bySrc ? `${bySrc.builtin} встр · ${bySrc.generated} ген · ${bySrc.evolved} эво` : ""} />
            <SimStat label="ПРИБЫЛЬНЫХ" v={rows.filter(r => r.totalReturn > 0).length}
              c="var(--green)" sub={`из ${rows.length} · чемпионов ${champs.length}`} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "var(--gap)", alignItems: "start" }}>
            {/* Leaderboard */}
            <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
              <PanelHeader title="РЕЙТИНГ ПРОГОНА" meta={ts ? ts.toLocaleTimeString("ru-RU", { hour12: false }) : ""} />
              <div style={{ display: "grid", gridTemplateColumns: "22px 1.5fr 66px 50px 54px 44px 38px 48px 16px", padding: "6px 12px", background: "var(--bg-2)", fontFamily: "var(--font-mono)", fontSize: 8.5, color: "var(--text-dim)", letterSpacing: 0.05, textTransform: "uppercase" }}>
                <span>#</span><span>Стратегия</span><span style={{ textAlign: "right" }}>Прибыль</span><span style={{ textAlign: "right" }} title="в выборке (обучение)">Train</span><span style={{ textAlign: "right", color: "var(--accent-2)" }} title="вне выборки — честный результат на тесте">OOS</span><span style={{ textAlign: "right" }}>Win</span><span style={{ textAlign: "right" }}>Сд.</span><span style={{ textAlign: "right" }}>PF</span><span />
              </div>
              <div className="scroll" style={{ maxHeight: 420, overflowY: "auto" }}>
                {rows.map((r, i) => (
                  <React.Fragment key={i}>
                    <div onClick={() => setExpanded(expanded === i ? null : i)} title="Показать правила и план входа"
                      style={{ display: "grid", gridTemplateColumns: "22px 1.5fr 66px 50px 54px 44px 38px 48px 16px", padding: "6px 12px", borderBottom: expanded === i ? "none" : "1px solid var(--line)", fontFamily: "var(--font-mono)", fontSize: 10.5, alignItems: "center", cursor: "pointer", background: expanded === i ? "var(--bg-2)" : i === 0 ? "var(--accent-soft)" : "transparent" }}>
                      <span style={{ color: i === 0 ? "var(--accent)" : "var(--text-dim)" }}>{i === 0 ? "★" : i + 1}</span>
                      <span style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ width: 6, height: 6, borderRadius: 2, background: SRC_CFG[r.source].color, flexShrink: 0 }} />
                        <span style={{ color: "var(--text-bright)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                      </span>
                      <span style={{ textAlign: "right", color: r.profit >= 0 ? "var(--green)" : "var(--red)", fontWeight: 600 }}>{r.profit >= 0 ? "+" : "−"}${Math.abs(r.profit).toFixed(0)}</span>
                      <span style={{ textAlign: "right", color: (r.trainReturn != null && r.trainReturn - r.totalReturn > 10) ? "var(--amber)" : "var(--text-dim)" }} title={r.trainReturn != null && r.trainReturn - r.totalReturn > 10 ? "сильно лучше в выборке — риск переобучения" : "результат на обучающей части"}>{r.trainReturn != null ? `${r.trainReturn >= 0 ? "+" : ""}${r.trainReturn.toFixed(1)}` : "—"}</span>
                      <span style={{ textAlign: "right", color: r.totalReturn >= 0 ? "var(--green)" : "var(--red)", fontWeight: 600 }}>{r.totalReturn >= 0 ? "+" : ""}{r.totalReturn.toFixed(1)}%</span>
                      <span style={{ textAlign: "right", color: r.winRate >= 50 ? "var(--green)" : "var(--amber)" }}>{r.winRate.toFixed(0)}%</span>
                      <span style={{ textAlign: "right", color: "var(--text-dim)" }}>{r.trades}</span>
                      <span style={{ textAlign: "right", color: r.profitFactor >= 1 ? "var(--green)" : "var(--red)" }}>{r.profitFactor.toFixed(2)}</span>
                      <span style={{ textAlign: "center", color: "var(--text-dim)", transform: expanded === i ? "rotate(90deg)" : "none", transition: "transform .12s" }}>›</span>
                    </div>
                    {expanded === i && <StrategyDetail row={r} feat={featRef.current} capital={capital} src={SRC_CFG[r.source]} />}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Champions in dynamics */}
            <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
              <PanelHeader title="ЧЕМПИОНЫ · ДИНАМИКА" meta={`${champs.length} прибыльных стратегий`} />
              {champs.length === 0 ? (
                <div style={{ padding: "14px 12px", fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-dim)", lineHeight: 1.5 }}>
                  Прибыльные стратегии появятся здесь и будут накапливать историю от прогона к прогону.
                </div>
              ) : (
                <div className="scroll" style={{ maxHeight: 360, overflowY: "auto", padding: "4px 0" }}>
                  {champs.slice(0, 12).map((c, i) => {
                    const cr = cumRoi(c), n = c.history.length;
                    return (
                      <div key={c.key} style={{ display: "grid", gridTemplateColumns: "1fr 80px 44px", gap: 6, alignItems: "center", padding: "6px 12px", borderBottom: "1px solid var(--line)" }}>
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <span style={{ width: 6, height: 6, borderRadius: 2, background: SRC_CFG[c.source] ? SRC_CFG[c.source].color : "var(--accent)", flexShrink: 0 }} />
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-bright)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                          </span>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, color: "var(--text-dim)" }}>{c.asset} · {n} прогон{n === 1 ? "" : "ов"}</span>
                        </span>
                        <ChampSpark history={c.history} width={80} height={22} />
                        <span style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, color: cr >= 0 ? "var(--green)" : "var(--red)" }}>{cr >= 0 ? "+" : ""}{cr.toFixed(0)}%</span>
                      </div>
                    );
                  })}
                  {champs.length > 0 && (
                    <div style={{ padding: "6px 12px" }}>
                      <button onClick={() => { saveChampions([]); setChamps([]); }} className="btn" style={{ fontSize: 9.5, width: "100%" }}>Сбросить чемпионов</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div style={{ background: "var(--bg-2)", border: "1px dashed var(--line-bright)", borderRadius: 3, padding: "8px 12px", fontSize: 10.5, color: "var(--text-mid)", lineHeight: 1.5 }}>
            <span className="accent">↳ </span>Walk-forward: свечи делятся на обучение (первые ~65%) и тест (остаток). Стратегии оцениваются на обеих частях, но в рейтинг, чемпионы и эволюцию идёт результат <b>OOS</b> — на тестовой части, которую стратегия «не видела». Столбец <b>Train</b> рядом: если он сильно выше OOS (подсвечен) — стратегия переобучена под историю. «Эволюция» мутирует лучших по OOS из прошлого прогона. Прошлые результаты не гарантируют будущих.
          </div>
        </>
      ) : (
        <div className="panel" style={{ padding: 40, textAlign: "center", color: "var(--red)", fontFamily: "var(--font-mono)", fontSize: 12 }}>не удалось загрузить свечи · проверьте соединение</div>
      )}
    </div>
  );
}

function StrategyDetail({ row, feat, capital, src }) {
  const rules = typeof genesRules === "function" && row.genes ? genesRules(row.genes) : [];
  const plan = feat && feat.candles && feat.f && typeof genesPlan === "function" && row.genes
    ? genesPlan(feat.candles, feat.f, row.genes, { capital, maxLev: 50 }) : null;
  const long = row.genes && row.genes.side === "buy";
  const px = v => v == null ? "—" : v < 1 ? v.toFixed(5) : v < 100 ? v.toFixed(3) : v.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return (
    <div style={{ padding: "10px 14px 14px", borderBottom: "1px solid var(--line)", background: "var(--bg-2)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      {/* Rulebook */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: 2, background: src.color }} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 0.08 }}>Правила стратегии · {src.label}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {rules.map((r, k) => (
            <div key={k} style={{ display: "grid", gridTemplateColumns: "104px 1fr", gap: 8, alignItems: "baseline" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--text-dim)" }}>{r.k}</span>
              <span style={{ fontSize: 11, color: "var(--text-bright)", lineHeight: 1.35 }}>{r.v}</span>
            </div>
          ))}
        </div>
      </div>
      {/* Capital-aware execution plan */}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 0.08, marginBottom: 6 }}>
          План входа · капитал ${capital.toLocaleString("en-US")}
        </div>
        {!plan ? (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-dim)" }}>нет данных свечей</div>
        ) : (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, padding: "2px 8px", borderRadius: 2, background: long ? "oklch(0.7 0.14 150 / 0.14)" : "oklch(0.65 0.18 25 / 0.14)", color: long ? "var(--green)" : "var(--red)", border: `1px solid ${long ? "oklch(0.7 0.14 150 / 0.3)" : "oklch(0.65 0.18 25 / 0.3)"}` }}>{long ? "▲ ЛОНГ" : "▼ ШОРТ"}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, padding: "2px 8px", borderRadius: 2, background: "var(--accent-soft)", color: "var(--accent)", border: "1px solid oklch(0.74 0.075 var(--accent-h) / 0.4)" }}>плечо {plan.lev}x{plan.levCapped ? " (огранич.)" : ""}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, padding: "2px 8px", borderRadius: 2, background: "var(--bg-0)", color: "var(--text-dim)", border: "1px solid var(--line)" }}>R:R {plan.rr}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px 12px" }}>
              <PlanRow k="Вход (рынок)" v={`$${px(plan.entry)}`} c="var(--text-bright)" />
              <PlanRow k="Ликвидация" v={plan.liq ? `$${px(plan.liq)}` : "нет (1x)"} c="var(--red)" sub={plan.liqDistPct ? `−${plan.liqDistPct.toFixed(1)}% от входа` : ""} />
              <PlanRow k="Стоп-лосс" v={`$${px(plan.sl)}`} c="var(--amber)" sub={`−${(plan.slPct * 100).toFixed(2)}%`} />
              <PlanRow k="Тейк-профит" v={`$${px(plan.tp)}`} c="var(--green)" sub={`+${(plan.slPct * plan.rr * 100).toFixed(2)}%`} />
              <PlanRow k="Маржа" v={`$${plan.margin.toFixed(0)}`} c="var(--text-bright)" sub={`${(plan.margin / plan.budget * 100).toFixed(0)}% капитала`} />
              <PlanRow k="Позиция" v={`$${plan.notional.toFixed(0)}`} c="var(--text-bright)" sub={`${plan.qty < 1 ? plan.qty.toFixed(4) : plan.qty.toFixed(3)} монет`} />
              <PlanRow k="Прибыль @TP" v={`+$${plan.profitAtTp.toFixed(0)}`} c="var(--green)" sub={`+${(plan.profitAtTp / plan.budget * 100).toFixed(1)}% счёта`} />
              <PlanRow k="Убыток @SL" v={`−$${plan.lossAtSl.toFixed(0)}`} c="var(--red)" sub={`риск ${(plan.lossAtSl / plan.budget * 100).toFixed(1)}% счёта`} />
            </div>
            <div style={{ marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 8.5, color: "var(--text-dim)", lineHeight: 1.45 }}>
              Плечо {plan.lev}x — наименьшее, при котором ликвидация ({plan.maxSafeLev}x потолок безопасности) остаётся за стопом; риск на сделку 2% счёта.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PlanRow({ k, v, c, sub }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6, borderBottom: "1px dotted var(--line)", paddingBottom: 3 }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--text-dim)" }}>{k}</span>
      <span style={{ textAlign: "right" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: c, fontWeight: 500 }}>{v}</span>
        {sub && <span style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-dim)" }}>{sub}</span>}
      </span>
    </div>
  );
}

function ChampSpark({ history, width = 80, height = 22 }) {
  // cumulative ROI over runs
  let acc = 0; const pts = history.map(p => (acc += p.roi));
  if (pts.length < 2) return <div style={{ width, height, display: "flex", alignItems: "center", fontFamily: "var(--font-mono)", fontSize: 8.5, color: "var(--text-dim)" }}>1 прогон</div>;
  const lo = Math.min(0, ...pts), hi = Math.max(0, ...pts), range = (hi - lo) || 1;
  const y = v => 2 + (1 - (v - lo) / range) * (height - 4);
  const stepX = width / (pts.length - 1);
  const d = pts.map((v, i) => `${i === 0 ? "M" : "L"}${i * stepX},${y(v)}`).join(" ");
  const up = pts[pts.length - 1] >= 0;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      <line x1={0} y1={y(0)} x2={width} y2={y(0)} stroke="var(--line)" strokeWidth={0.5} strokeDasharray="1 2" />
      <path d={d} fill="none" stroke={up ? "var(--green)" : "var(--red)"} strokeWidth={1.2} />
    </svg>
  );
}

function SimGroup({ label, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", textTransform: "uppercase" }}>{label}</span>
      <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>{children}</div>
    </div>
  );
}
function SimBtn({ on, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      fontFamily: "var(--font-mono)", fontSize: 10, padding: "2px 8px", borderRadius: 2, cursor: "pointer",
      background: on ? "var(--accent-soft)" : "transparent", color: on ? "var(--accent)" : "var(--text-dim)",
      border: `1px solid ${on ? "oklch(0.74 0.075 var(--accent-h) / 0.4)" : "var(--line)"}`,
    }}>{children}</button>
  );
}
function SimStat({ label, v, c, sub }) {
  return (
    <div style={{ flex: 1, minWidth: 160, padding: "12px 16px", borderRight: "1px solid var(--line)" }}>
      <div style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.12, fontWeight: 600, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 17, color: c, marginTop: 2, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</div>
      {sub && <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--text-dim)", marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

Object.assign(window, { SimulatorPage });
