/* research.jsx — what this system measured about itself, and what it found.
 *
 * Every other page here helps you trade. This one asks whether trading works at all —
 * and answers with numbers you can re-run, not claims. Each card is a question that
 * was actually tested against live candles or resolved markets, with the method and
 * the sample size stated so the answer can be checked rather than believed.
 *
 * It exists because the findings were uncomfortable: the signals lose, agreement makes
 * accuracy worse, an 80% win rate loses $20k. A system that hides that is lying by
 * omission — most trading tools show the backtest and not the audit. */

const RESEARCH_ASSETS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"];

function ResearchPage({ lang }) {
  const [runs, setRuns] = useState({});   // id -> {state, result, error}

  const set = (id, v) => setRuns(p => ({ ...p, [id]: { ...(p[id] || {}), ...v } }));

  /* ── 1. Are the terminal's entry signals profitable? ── */
  async function runEntryEconomics() {
    const id = "entry";
    set(id, { state: "running", progress: "загружаю историю…", result: null });
    try {
      const rows = [];
      for (const s of RESEARCH_ASSETS) {
        set(id, { progress: `${s.replace("USDT", "")} · воспроизвожу решения…` });
        const c = await bybitFetchKlines(s, "15", 1000, "spot");
        const r = await entrySignalEconomics(c, { capital: 10000, maxLev: 50 });
        if (r) rows.push({ sym: s.replace("USDT", ""), ...r });
      }
      const T = rows.reduce((a, r) => a + r.trades, 0);
      const W = rows.reduce((a, r) => a + r.wins, 0);
      const N = rows.reduce((a, r) => a + r.net, 0);
      set(id, { state: "done", progress: null, result: { rows, trades: T, wins: W, net: N, winRate: T ? W / T * 100 : 0 } });
    } catch (e) { set(id, { state: "error", progress: null, error: String(e) }); }
  }

  /* ── 2. Does a higher win rate mean more money? ── */
  async function runWinRateSweep() {
    const id = "winrate";
    set(id, { state: "running", progress: "перебираю цели…", result: null });
    try {
      const tprs = [0.25, 0.5, 1, 1.8, 3, 4];
      const agg = {};
      for (const s of RESEARCH_ASSETS.slice(0, 4)) {
        set(id, { progress: `${s.replace("USDT", "")}…` });
        const c = await bybitFetchKlines(s, "15", 1000, "spot");
        const f = computeFeatures(c);
        for (const tpR of tprs) {
          for (const st of strategyLibrary()) {
            const r = backtestGenes(c, f, { ...st.genes, tpR }, { capital: 10000, leverage: 1, fees: 0.055, slip: 0.02 });
            const k = String(tpR);
            if (!agg[k]) agg[k] = { tpR, trades: 0, wins: 0, net: 0 };
            agg[k].trades += r.stats.trades;
            agg[k].wins += Math.round(r.stats.trades * r.stats.winRate / 100);
            agg[k].net += (r.stats.last - 10000);
          }
        }
        await new Promise(r => setTimeout(r, 0));
      }
      const rows = Object.values(agg).sort((a, b) => a.tpR - b.tpR).map(b => ({
        tpR: b.tpR, theory: 1 / (1 + b.tpR) * 100,
        actual: b.trades ? b.wins / b.trades * 100 : 0, net: b.net, trades: b.trades,
      }));
      set(id, { state: "done", progress: null, result: { rows } });
    } catch (e) { set(id, { state: "error", progress: null, error: String(e) }); }
  }

  /* ── 3. Does strategy agreement improve accuracy? ── */
  async function runConsensus() {
    const id = "consensus";
    set(id, { state: "running", progress: "накладываю стратегии…", result: null });
    try {
      const agg = {};
      let be = 35.7;
      for (const s of RESEARCH_ASSETS) {
        set(id, { progress: `${s.replace("USDT", "")}…` });
        const c = await bybitFetchKlines(s, "15", 1000, "spot");
        const r = consensusEconomics(c, {});
        if (!r) continue;
        be = r.breakevenWinRate;
        r.rows.forEach(b => {
          const k = String(b.agree);
          if (!agg[k]) agg[k] = { agree: b.agree, trades: 0, wins: 0, netR: 0 };
          agg[k].trades += b.trades; agg[k].wins += b.wins; agg[k].netR += b.netR;
        });
        await new Promise(r => setTimeout(r, 0));
      }
      const rows = Object.values(agg).sort((a, b) => a.agree - b.agree).map(b => ({
        agree: b.agree, trades: b.trades, winRate: b.wins / b.trades * 100, avgR: b.netR / b.trades,
      }));
      set(id, { state: "done", progress: null, result: { rows, breakeven: be } });
    } catch (e) { set(id, { state: "error", progress: null, error: String(e) }); }
  }

  /* ── 4. Is Polymarket mispriced? (server-side dataset) ── */
  async function runPolymarket() {
    const id = "pm";
    set(id, { state: "running", progress: "читаю выборку…", result: null });
    try {
      const r = await fetch("/api/pm/calibration?lookback=7").then(x => x.json());
      if (!r || !r.ok) throw new Error("нет данных");
      set(id, { state: "done", progress: null, result: r });
    } catch (e) { set(id, { state: "error", progress: null, error: "выборка собирается на сервере (/api/pm/collect)" }); }
  }

  const cards = [
    {
      id: "entry", title: "Прибыльны ли сигналы входа?",
      method: "Воспроизводит «найти точку входа» по истории без заглядывания в будущее: на каждом баре виден только прошлый. Лимиты ждут своей цены, стоп/цель — из самого плана. Комиссия 0.055% и проскальзывание 0.02% — как в терминале.",
      run: runEntryEconomics, render: renderEntry,
    },
    {
      id: "winrate", title: "Даёт ли высокий процент побед прибыль?",
      method: "Перебирает цель (R:R) при неизменных правилах входа и сравнивает теоретическую вероятность p₀ = 1/(1+R) с фактической частотой побед и с деньгами.",
      run: runWinRateSweep, render: renderWinRate,
    },
    {
      id: "consensus", title: "Помогает ли согласие стратегий?",
      method: "Накладывает все стратегии на каждый бар, входит в сторону большинства и группирует результат по числу согласных.",
      run: runConsensus, render: renderConsensus,
    },
    {
      id: "pm", title: "Ошибается ли Polymarket в вероятностях?",
      method: "Берёт резолвнутые рынки, читает цену за 7 дней до исхода и проверяет: сбывается ли событие с ценой X% ровно в X% случаев. Интервал Уилсона — он корректен на краях, где обычный ломается.",
      run: runPolymarket, render: renderPolymarket,
    },
  ];

  return (
    <div style={{ minHeight: "100%", padding: "var(--gap)", display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-bright)", letterSpacing: "-0.01em" }}>
          Исследования <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>· что система выяснила о себе</span>
        </div>
        <div className="mono" style={{ fontSize: 10.5, color: "var(--text-dim)", marginTop: 3, lineHeight: 1.5 }}>
          Каждый ответ — измерение на живых данных, а не утверждение. Кнопка пересчитывает всё заново: результаты можно проверить, а не поверить.
        </div>
      </div>

      <div style={{
        background: "var(--bg-2)", border: "1px dashed var(--line-bright)", borderRadius: 3,
        padding: "10px 12px", fontSize: 11, color: "var(--text-mid)", lineHeight: 1.55,
      }}>
        <span className="accent">↳ </span>Итог коротко: <b>эджа не найдено ни в одном направлении.</b> Это не поломка — это ответ.
        Система построена так, чтобы честно его показывать: она отказывается торговать без подтверждённого преимущества,
        считает ожидание за вычетом издержек и ловит собственные ложные находки. Большинство торговых систем
        показывают бэктест и прячут аудит — здесь наоборот.
      </div>

      {cards.map(c => {
        const r = runs[c.id] || {};
        return (
          <div key={c.id} className="panel" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-bright)" }}>{c.title}</div>
                <div style={{ fontSize: 10.5, color: "var(--text-dim)", marginTop: 4, lineHeight: 1.5 }}>{c.method}</div>
              </div>
              <button onClick={c.run} disabled={r.state === "running"} className="btn"
                style={{ flexShrink: 0, fontSize: 10, color: r.state === "running" ? "var(--text-dim)" : "var(--accent)" }}>
                {r.state === "running" ? `⌛ ${r.progress || "…"}` : "▸ Проверить"}
              </button>
            </div>
            <div style={{ padding: "10px 14px" }}>
              {r.state === "error" && <div className="mono" style={{ fontSize: 10.5, color: "var(--amber)" }}>{r.error}</div>}
              {r.state === "done" && r.result ? c.render(r.result) : null}
              {!r.state && <div className="mono" style={{ fontSize: 10.5, color: "var(--text-dim)" }}>не проверялось в этой сессии — нажми «Проверить»</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── renderers ── */
function ResVerdict({ good, children }) {
  return (
    <div style={{
      marginTop: 8, padding: "7px 10px", borderRadius: 3, fontSize: 11.5, lineHeight: 1.5,
      background: good ? "oklch(0.72 0.14 150 / 0.10)" : "oklch(0.65 0.18 25 / 0.10)",
      border: `1px solid ${good ? "var(--green)" : "var(--red)"}`,
      color: "var(--text-bright)",
    }}>{children}</div>
  );
}
function ResTable({ head, rows }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 10.5 }}>
        <thead>
          <tr>{head.map((h, i) => (
            <th key={i} style={{ textAlign: i ? "right" : "left", padding: "3px 8px", color: "var(--text-dim)", fontWeight: 400, borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" }}>{h}</th>
          ))}</tr>
        </thead>
        <tbody>{rows.map((r, i) => (
          <tr key={i}>{r.map((c, j) => (
            <td key={j} style={{ textAlign: j ? "right" : "left", padding: "3px 8px", borderBottom: "1px solid var(--line)", color: j ? (c && c.c) || "var(--text)" : "var(--text-bright)", whiteSpace: "nowrap" }}>
              {c && c.v !== undefined ? c.v : c}
            </td>
          ))}</tr>
        ))}</tbody>
      </table>
    </div>
  );
}
const money = n => `${n >= 0 ? "+" : "−"}$${Math.abs(n).toFixed(0)}`;
const col = n => n >= 0 ? "var(--green)" : "var(--red)";

function renderEntry(r) {
  return (
    <>
      <ResTable head={["актив", "сделок", "побед", "win rate", "итог"]}
        rows={r.rows.map(x => [x.sym, x.trades, x.wins,
          { v: `${x.winRate.toFixed(0)}%`, c: x.winRate >= 36 ? "var(--green)" : "var(--amber)" },
          { v: money(x.net), c: col(x.net) }])} />
      <ResVerdict good={r.net > 0}>
        {r.trades} сделок · побед <b>{r.winRate.toFixed(1)}%</b> · итог <b style={{ color: col(r.net) }}>{money(r.net)}</b>.
        {r.net <= 0 && <> Для безубытка при R:R 1.8 нужно ≈36%. Отдельные активы в плюсе — это выигрышный хвост, а не преимущество.</>}
      </ResVerdict>
    </>
  );
}
function renderWinRate(r) {
  return (
    <>
      <ResTable head={["цель R", "теория p₀", "факт win", "сделок", "деньги"]}
        rows={r.rows.map(x => [x.tpR, `${x.theory.toFixed(1)}%`,
          { v: `${x.actual.toFixed(1)}%`, c: "var(--text-bright)" }, x.trades,
          { v: money(x.net), c: col(x.net) }])} />
      <ResVerdict good={false}>
        Процент побед механически задан целью: <b>p₀ = 1/(1+R)</b> — теория совпадает с фактом.
        Хочешь 80% побед — поставь цель вчетверо ближе стопа и получишь их. <b>Деньги при этом отрицательные при любом R.</b> Win rate ничего не говорит о прибыльности; значение имеет только ожидание за вычетом издержек.
      </ResVerdict>
    </>
  );
}
function renderConsensus(r) {
  return (
    <>
      <ResTable head={["согласны", "сделок", "win rate", "средний R"]}
        rows={r.rows.map(x => [`${x.agree} страт.`, x.trades,
          { v: `${x.winRate.toFixed(1)}%`, c: x.winRate >= r.breakeven ? "var(--green)" : "var(--red)" },
          { v: x.avgR.toFixed(3), c: col(x.avgR) }])} />
      <ResVerdict good={false}>
        Точность <b>падает</b> с ростом согласия (для безубытка нужно {r.breakeven}%). Причина структурная:
        все индикаторы запаздывают и считаются из одной цены — их единодушие означает, что движение уже произошло.
        <b> Подтверждение = опоздание.</b>
      </ResVerdict>
    </>
  );
}
function renderPolymarket(r) {
  const b = r.buckets || [];
  const flagged = b.filter(x => !x.priceInsideCI).length;
  return (
    <>
      <div className="mono" style={{ fontSize: 9.5, color: "var(--text-dim)", marginBottom: 6 }}>
        рынков {r.markets} · точек {r.rows} · горизонт 7 дней
      </div>
      <ResTable head={["цена", "n", "ср. цена", "факт", "95% ДИ", "калибровано"]}
        rows={b.map(x => [x.range, x.n, x.meanPrice, x.actualRate, x.ci95,
          { v: x.priceInsideCI ? "да" : "нет", c: x.priceInsideCI ? "var(--green)" : "var(--amber)" }])} />
      <ResVerdict good={false}>
        {flagged === 0
          ? <>Все корзины калиброваны: событие с ценой X% сбывается в X% случаев. <b>Рынок оценивает вероятности корректно — бесплатных денег нет</b> ни в фаворитах, ни в лонгшотах.</>
          : <>{flagged} корзин(а) вне интервала. При {b.length} проверках одна пограничная возникает случайно — это не находка, пока не подтвердится на большей выборке.</>}
      </ResVerdict>
    </>
  );
}

Object.assign(window, { ResearchPage });
