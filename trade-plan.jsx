/* trade-plan.jsx — "Trade Plan / Разбор монеты": per-coin deep dive.
 * Builds a chart with EMA + Supertrend + entry/SL/TP, explains WHY price is
 * moving from the real indicators, matches the best-fitting strategy from our
 * library, and gives a concrete entry point + Monte-Carlo forecast.
 * All grounded in live Bybit data. Not investment advice. */

const TP_COINS = [
  { sym: "BTC", bybit: "BTCUSDT" }, { sym: "ETH", bybit: "ETHUSDT" },
  { sym: "SOL", bybit: "SOLUSDT" }, { sym: "BNB", bybit: "BNBUSDT" },
  { sym: "XRP", bybit: "XRPUSDT" }, { sym: "AVAX", bybit: "AVAXUSDT" },
  { sym: "LINK", bybit: "LINKUSDT" }, { sym: "DOGE", bybit: "DOGEUSDT" },
];

function tpFmt(n) {
  if (n == null || isNaN(n)) return "—";
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 1 });
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(4);
}

/* Build the full plan from candles using the live TA engine + indicators. */
function buildTradePlan(candles) {
  if (!candles || candles.length < 60 || typeof analyzeMarket !== "function") return null;
  const closes = candles.map(c => c.close);
  const price = closes[closes.length - 1];
  const a = analyzeMarket(candles);
  const rsi = taRsi(closes, 14);
  const macd = taMacd(closes);
  const st = taSupertrend(candles, 3, 10);
  const dmi = taDmi(candles, 14);
  const bb = taBollinger(closes, 20, 2);
  const stoch = taStochastic(candles);
  const ema50 = taEma(closes, 50);
  const ema200 = closes.length >= 200 ? taEma(closes, 200) : taEma(closes, Math.min(100, closes.length - 1));
  const atr = taAtr(candles, 14);
  const atrPct = price ? atr / price * 100 : 0;
  const pats = typeof taCandlePatterns === "function" ? taCandlePatterns(candles, 3) : [];
  const lastPat = pats.length && pats[pats.length - 1].idx === candles.length - 1 ? pats[pats.length - 1] : null;

  const indicators = [
    { label: "Тренд · EMA50", value: price > ema50 ? (ema50 > ema200 ? "аптренд" : "разворот ↑") : (ema50 < ema200 ? "даунтренд" : "откат ↓"), bias: price > ema50 ? 1 : -1 },
    { label: "Supertrend", value: st.dir > 0 ? "вверх" : "вниз", bias: st.dir },
    { label: `RSI ${rsi.toFixed(0)}`, value: rsi > 70 ? "перекуплен" : rsi < 30 ? "перепродан" : rsi > 50 ? "бычий" : "медвежий", bias: rsi > 70 ? -1 : rsi < 30 ? 1 : (rsi > 50 ? 1 : -1) },
    { label: "MACD", value: macd.hist > 0 ? "импульс ↑" : "импульс ↓", bias: macd.hist > 0 ? 1 : -1 },
    { label: `ADX ${dmi.adx.toFixed(0)}`, value: dmi.adx > 25 ? "сильный тренд" : dmi.adx < 20 ? "флэт" : "умеренный", bias: dmi.plusDI > dmi.minusDI ? 1 : -1 },
    { label: `Bollinger %B ${(bb.pctB * 100).toFixed(0)}`, value: bb.pctB > 1 ? "выше полос" : bb.pctB < 0 ? "ниже полос" : bb.pctB > 0.5 ? "верх. половина" : "ниж. половина", bias: bb.pctB > 0.85 ? -1 : bb.pctB < 0.15 ? 1 : 0 },
    { label: `Stoch %K ${stoch.k.toFixed(0)}`, value: stoch.k > 80 ? "перекуплен" : stoch.k < 20 ? "перепродан" : "нейтр.", bias: stoch.k < 20 ? 1 : stoch.k > 80 ? -1 : 0 },
    { label: `Волат. ${atrPct.toFixed(2)}%`, value: atrPct > 1.2 ? "высокая" : atrPct < 0.45 ? "сжатие" : "норма", bias: 0 },
  ];
  if (lastPat) indicators.push({ label: "Свечной паттерн", value: lastPat.ru, bias: lastPat.bias === "bull" ? 1 : lastPat.bias === "bear" ? -1 : 0 });

  const strategy = matchStrategy({ a, dmi, rsi, bb, atrPct, ema50, ema200, price });
  const explain = explainMovement({ price, ema50, ema200, st, macd, rsi, dmi, atrPct, lastPat });

  return {
    price, a, indicators, strategy, explain,
    plan: (a && a.setup) ? { side: a.side, entry: price, sl: a.sl, tp: a.tp, rr: a.rr, conf: a.confidence, reasons: a.reasons } : null,
    series: { ema50, st, closes },
  };
}

/* Pick the best-fitting strategy from our preset library for the current state. */
function matchStrategy({ a, dmi, rsi, atrPct }) {
  const trending = dmi.adx >= 23;
  const up = a.trendDir > 0, dn = a.trendDir < 0;
  if (atrPct < 0.45) return { name: "Keltner Squeeze Breakout", why: "низкая волатильность (сжатие полос) — рынок копит энергию, ждём пробой канала." };
  if (up && rsi < 38) return { name: "Bollinger + RSI (возврат к среднему)", why: "аптренд + RSI в перепроданности — откуп отката к средней полосе." };
  if (dn && rsi > 62) return { name: "Stochastic Reversal · шорт", why: "даунтренд + перекупленность — продажа технического отскока." };
  if (trending && up) return { name: "Supertrend + RSI", why: `устойчивый аптренд (ADX ${dmi.adx.toFixed(0)}) — следование за трендом с трейлингом.` };
  if (trending && dn) return { name: "Parabolic SAR Trend · шорт", why: `устойчивый даунтренд (ADX ${dmi.adx.toFixed(0)}) — трейлинг-шорт по тренду.` };
  if (!trending) return { name: "Вне рынка · флэт", why: `ADX ${dmi.adx.toFixed(0)} < 23 — направленного тренда нет, входить статистически невыгодно.` };
  return { name: "Hull MA Trend", why: "свежий импульс без явного ADX-тренда — быстрый вход по Hull MA." };
}

/* Explain WHY the coin is moving, in plain language, from the indicators. */
function explainMovement({ price, ema50, ema200, st, macd, rsi, dmi, atrPct, lastPat }) {
  const out = [];
  const trend = price > ema50 ? (ema50 > ema200 ? "устойчивый восходящий тренд (цена > EMA50 > EMA200)" : "разворот вверх — цена вернулась над EMA50")
    : (ema50 < ema200 ? "нисходящий тренд (цена < EMA50 < EMA200)" : "откат под EMA50 внутри более крупного тренда");
  out.push(`Структура: ${trend}. Supertrend направлен ${st.dir > 0 ? "вверх — поддержка под ценой" : "вниз — сопротивление над ценой"}.`);
  out.push(`Импульс: MACD-гистограмма ${macd.hist > 0 ? "положительная — инициатива у покупателей" : "отрицательная — давят продавцы"}; RSI ${rsi.toFixed(0)} (${rsi > 70 ? "перекупленность, риск отката" : rsi < 30 ? "перепроданность, возможен отскок" : "нейтральная зона"}).`);
  out.push(`Сила движения: ADX ${dmi.adx.toFixed(0)} — ${dmi.adx > 25 ? "тренд направленный, движения продлеваются" : dmi.adx < 20 ? "рынок во флэте, движения пилообразные и ложные" : "тренд умеренный"}. Волатильность ${atrPct.toFixed(2)}% ATR.`);
  if (lastPat) out.push(`Последняя свеча: паттерн «${lastPat.ru}» — ${lastPat.bias === "bull" ? "сигнал в пользу покупателей" : lastPat.bias === "bear" ? "сигнал в пользу продавцов" : "неопределённость/пауза"}.`);
  return out;
}

function TradePlanPage({ lang }) {
  const [idx, setIdx] = useState(0);
  const [candles, setCandles] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const A = TP_COINS[idx];

  useEffect(() => {
    if (typeof bybitFetchKlines !== "function") { setLoading(false); setErr(true); return; }
    let cancelled = false;
    setLoading(true); setErr(false);
    bybitFetchKlines(A.bybit, "15", 200)
      .then(kl => { if (!cancelled) { setCandles(kl); setLoading(false); } })
      .catch(() => { if (!cancelled) { setErr(true); setLoading(false); } });
    return () => { cancelled = true; };
  }, [idx]);

  const plan = useMemo(() => (candles ? buildTradePlan(candles) : null), [candles]);
  const fc = useMemo(() => (candles && typeof monteCarloForecast === "function") ? monteCarloForecast(candles, 24, 300) : null, [candles]);

  const chartCandles = useMemo(() => (candles ? candles.slice(-60) : []), [candles]);
  const emaSeries = useMemo(() => {
    if (!candles) return null;
    const cl = candles.map(c => c.close); const out = [];
    for (let i = candles.length - 60; i < candles.length; i++) out.push(taEma(cl.slice(0, i + 1), 50));
    return out;
  }, [candles]);
  const stSeries = useMemo(() => {
    if (!candles || typeof taSupertrend !== "function") return null;
    const out = [];
    for (let i = candles.length - 60; i < candles.length; i++) { const r = taSupertrend(candles.slice(0, i + 1), 3, 10); out.push({ v: r.value, dir: r.dir }); }
    return out;
  }, [candles]);

  const p = plan ? plan.plan : null;
  const sideColor = p ? (p.side === "buy" ? "var(--green)" : "var(--red)") : "var(--amber)";

  return (
    <div className="scroll" style={{ height: "100%", overflowY: "auto", padding: "var(--gap)", display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-bright)", letterSpacing: "-0.01em" }}>
            Trade Plan <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>· разбор монеты</span>
          </div>
          <div className="mono" style={{ fontSize: 10.5, color: "var(--text-dim)", marginTop: 3 }}>
            график + объяснение движения + подбор стратегии + точка входа · Bybit 15m
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {TP_COINS.map((c, i) => (
            <button key={c.sym} onClick={() => setIdx(i)} style={{
              fontFamily: "var(--font-mono)", fontSize: 10.5, padding: "3px 10px", borderRadius: 3,
              background: i === idx ? "var(--accent-soft)" : "var(--bg-2)",
              color: i === idx ? "var(--accent)" : "var(--text-mid)",
              border: `1px solid ${i === idx ? "oklch(0.78 0.16 var(--accent-h) / 0.4)" : "var(--line)"}`, cursor: "pointer",
            }}>{c.sym}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="panel" style={{ padding: 40, textAlign: "center", color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 12 }}>загрузка свечей {A.sym}…</div>
      ) : err || !plan ? (
        <div className="panel" style={{ padding: 40, textAlign: "center", color: "var(--red)", fontFamily: "var(--font-mono)", fontSize: 12 }}>нет данных · проверьте соединение</div>
      ) : (
        <>
          {/* Chart */}
          <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
            <PanelHeader title={`ГРАФИК · ${A.sym} · 15m`} meta={`цена ${tpFmt(plan.price)} · EMA50 + Supertrend${p ? " + вход/стоп/цель" : ""}`} />
            <div style={{ padding: 12 }}>
              <TradePlanChart candles={chartCandles} ema={emaSeries} st={stSeries} plan={p} width={880} height={260} />
            </div>
          </div>

          {/* Verdict + plan */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--gap)", alignItems: "start" }}>
            {/* Trade plan card */}
            <div className="panel" style={{ padding: "14px 16px", borderLeft: `3px solid ${sideColor}` }}>
              <div style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.12, fontWeight: 600, textTransform: "uppercase" }}>Точка входа</div>
              {p ? (
                <>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 22, color: sideColor, fontWeight: 700, marginTop: 4 }}>
                    {p.side === "buy" ? "▲ ЛОНГ" : "▼ ШОРТ"} {A.sym}
                    <span style={{ fontSize: 12, color: "var(--accent)", marginLeft: 10 }}>conf {p.conf}%</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginTop: 12 }}>
                    <PlanCell label="Вход" v={tpFmt(p.entry)} c="var(--text-bright)" />
                    <PlanCell label="Стоп (SL)" v={tpFmt(p.sl)} c="var(--red)" />
                    <PlanCell label="Цель (TP)" v={tpFmt(p.tp)} c="var(--green)" />
                    <PlanCell label="R:R" v={`1:${p.rr.toFixed(1)}`} c="var(--accent)" />
                  </div>
                  <div style={{ marginTop: 10, fontSize: 11, color: "var(--text-mid)", lineHeight: 1.5 }}>
                    <span style={{ color: "var(--accent-2)" }}>↳ подтверждение: </span>{p.reasons.join(" · ")}
                  </div>
                </>
              ) : (
                <div style={{ marginTop: 6, fontSize: 12.5, color: "var(--amber)", fontFamily: "var(--font-mono)" }}>
                  ⏸ Готового входа нет
                  <div style={{ fontSize: 11, color: "var(--text-mid)", fontFamily: "var(--font-ui)", marginTop: 6, lineHeight: 1.5 }}>
                    Движок не видит качественного сетапа (нет совпадения тренд + импульс + подтверждение). Вход против отсутствия конфлюенса статистически убыточен — ждём.
                  </div>
                </div>
              )}
            </div>

            {/* Recommended strategy */}
            <div className="panel" style={{ padding: "14px 16px" }}>
              <div style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.12, fontWeight: 600, textTransform: "uppercase" }}>Подходящая стратегия</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 16, color: "var(--accent)", marginTop: 4 }}>{plan.strategy.name}</div>
              <div style={{ fontSize: 11.5, color: "var(--text-mid)", marginTop: 6, lineHeight: 1.5 }}>{plan.strategy.why}</div>
              {fc && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)", display: "flex", gap: 16, fontFamily: "var(--font-mono)", fontSize: 11 }}>
                  <span style={{ color: "var(--text-dim)" }}>Прогноз 6ч:</span>
                  <span style={{ color: fc.probUp >= 0.5 ? "var(--green)" : "var(--red)" }}>P(рост) {(fc.probUp * 100).toFixed(0)}%</span>
                  <span style={{ color: fc.expectedPct >= 0 ? "var(--green)" : "var(--red)" }}>медиана {fc.expectedPct >= 0 ? "+" : ""}{fc.expectedPct.toFixed(2)}%</span>
                </div>
              )}
            </div>
          </div>

          {/* Why is it moving */}
          <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
            <PanelHeader title="ПОЧЕМУ ТАК ДВИЖЕТСЯ" meta="разбор от TA-движка" />
            <div style={{ padding: "10px 16px", display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "var(--text)", lineHeight: 1.55 }}>
              {plan.explain.map((line, i) => <div key={i}><span style={{ color: "var(--accent)" }}>▸ </span>{line}</div>)}
            </div>
          </div>

          {/* Indicator readout */}
          <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
            <PanelHeader title="ПОКАЗАНИЯ ИНДИКАТОРОВ" meta="зелёный = бычий · красный = медвежий" />
            <div style={{ padding: 12, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
              {plan.indicators.map((ind, i) => {
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

          <div style={{ background: "var(--bg-2)", border: "1px dashed var(--line-bright)", borderRadius: 3, padding: "8px 12px", fontSize: 10.5, color: "var(--text-mid)", lineHeight: 1.5 }}>
            <span className="accent">↳ </span>План строится живым TA-движком на реальных свечах Bybit: вход/стоп/цель — от текущего сетапа (ATR-риск), стратегия подбирается по состоянию рынка, прогноз — Monte-Carlo. Не является инвестиционной рекомендацией.
          </div>
        </>
      )}
    </div>
  );
}

function PlanCell({ label, v, c }) {
  return (
    <div style={{ background: "var(--bg-0)", border: "1px solid var(--line)", borderRadius: 3, padding: "6px 8px" }}>
      <div style={{ fontSize: 8.5, color: "var(--text-dim)", letterSpacing: 0.08, fontWeight: 600, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: c, marginTop: 2 }}>{v}</div>
    </div>
  );
}

function TradePlanChart({ candles, ema, st, plan, width = 880, height = 260 }) {
  if (!candles || !candles.length) return null;
  const lows = candles.map(c => c.lo), highs = candles.map(c => c.hi);
  const stVals = st ? st.map(p => p.v).filter(v => isFinite(v) && v > 0) : [];
  const planVals = plan ? [plan.entry, plan.sl, plan.tp].filter(v => v != null) : [];
  const min = Math.min(...lows, ...stVals, ...planVals);
  const max = Math.max(...highs, ...stVals, ...planVals);
  const range = (max - min) * 1.04 || 1;
  const padT = 10, padB = 10, padR = 60;
  const innerW = width - padR;
  const stepX = innerW / candles.length;
  const candleW = Math.max(2, stepX * 0.6);
  const y = v => padT + (1 - (v - min) / range) * (height - padT - padB);
  const emaPath = ema ? ema.map((v, i) => `${i === 0 ? "M" : "L"}${i * stepX + stepX / 2},${y(v)}`).join(" ") : null;
  const stSegs = [];
  if (st) for (let i = 1; i < st.length; i++) {
    if (!isFinite(st[i].v) || st[i].v <= 0 || !isFinite(st[i - 1].v) || st[i - 1].v <= 0) continue;
    stSegs.push({ x1: (i - 1) * stepX + stepX / 2, y1: y(st[i - 1].v), x2: i * stepX + stepX / 2, y2: y(st[i].v), color: st[i].dir > 0 ? "var(--green)" : "var(--red)" });
  }
  const planLine = (v, color, label, dash) => v == null ? null : (
    <g>
      <line x1={0} y1={y(v)} x2={innerW} y2={y(v)} stroke={color} strokeWidth={0.9} strokeDasharray={dash} opacity={0.85} />
      <rect x={innerW} y={y(v) - 8} width={padR} height={16} fill={color} />
      <text x={innerW + padR / 2} y={y(v) + 4} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={9} fontWeight={600} fill="var(--bg-0)">{tpFmt(v)}</text>
      <text x={4} y={y(v) - 3} fontFamily="var(--font-mono)" fontSize={8.5} fill={color}>{label}</text>
    </g>
  );
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: "block", background: "var(--bg-1)", borderRadius: 4 }}>
      {candles.map((c, i) => {
        const cx = i * stepX + stepX / 2, up = c.close >= c.open, color = up ? "var(--green)" : "var(--red)";
        return (
          <g key={i}>
            <line x1={cx} y1={y(c.hi)} x2={cx} y2={y(c.lo)} stroke={color} strokeWidth={0.7} />
            <rect x={cx - candleW / 2} y={y(Math.max(c.open, c.close))} width={candleW} height={Math.max(0.8, Math.abs(y(c.open) - y(c.close)))} fill={up ? "transparent" : color} stroke={color} strokeWidth={0.9} />
          </g>
        );
      })}
      {emaPath && <path d={emaPath} fill="none" stroke="var(--accent)" strokeWidth={1.2} opacity={0.85} />}
      {stSegs.map((s, i) => <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={s.color} strokeWidth={1.3} opacity={0.9} />)}
      {plan && planLine(plan.tp, "var(--green)", "TP", "4 3")}
      {plan && planLine(plan.entry, "var(--accent)", "ВХОД", "0")}
      {plan && planLine(plan.sl, "var(--red)", "SL", "4 3")}
    </svg>
  );
}

Object.assign(window, { TradePlanPage, buildTradePlan });
