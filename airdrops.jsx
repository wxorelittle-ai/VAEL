/* airdrops.jsx — two agent windows:
 *   AirdropRadarPage  — evaluates airdrop-candidate projects by objective criteria
 *                       (funding, backers, TVL, activity, scam-risk) → prospect score + verdict.
 *   FreeAirdropsPage  — tracker of FREE airdrop opportunities: steps, cost, deadline, status.
 * Data is a curated watchlist (no free live airdrop API exists). The verdict is an
 * algorithmic prospect rating, NOT investment advice. */

/* ── Prospect radar dataset ── */
const AIRDROP_PROJECTS = [
  { id: "monad",    name: "Monad",        cat: "L1 · EVM",      chain: "Monad",   stage: "testnet", fundingM: 244, tier1: true,  tvlM: 0,    activity: 88, scamRisk: 8,  note: "Параллельный EVM · крупный раунд" },
  { id: "megaeth",  name: "MegaETH",      cat: "L2 · real-time",chain: "MegaETH", stage: "testnet", fundingM: 27,  tier1: true,  tvlM: 0,    activity: 82, scamRisk: 10, note: "Real-time rollup · Vitalik-backed" },
  { id: "hyperliq", name: "Hyperliquid",  cat: "Perp DEX",      chain: "Hyperl.", stage: "mainnet", fundingM: 0,   tier1: false, tvlM: 2400, activity: 95, scamRisk: 6,  note: "Уже раздавал · L1 perp, высокий объём" },
  { id: "eigen",    name: "EigenLayer",   cat: "Restaking",     chain: "Ethereum",stage: "mainnet", fundingM: 165, tier1: true,  tvlM: 12000,activity: 79, scamRisk: 7,  note: "Restaking-лидер · часть уже роздана" },
  { id: "berachain",name: "Berachain",    cat: "L1 · PoL",      chain: "Bera",    stage: "mainnet", fundingM: 142, tier1: true,  tvlM: 3100, activity: 84, scamRisk: 12, note: "Proof-of-Liquidity · сильное комьюнити" },
  { id: "scroll2",  name: "Scroll · S2",  cat: "L2 · zkEVM",    chain: "Scroll",  stage: "mainnet", fundingM: 80,  tier1: true,  tvlM: 720,  activity: 61, scamRisk: 9,  note: "zkEVM · возможен второй сезон" },
  { id: "fuel",     name: "Fuel",         cat: "L2 · modular",  chain: "Fuel",    stage: "mainnet", fundingM: 81,  tier1: true,  tvlM: 140,  activity: 55, scamRisk: 14, note: "Modular execution · невысокий TVL" },
  { id: "grass",    name: "Grass",        cat: "DePIN",         chain: "Solana",  stage: "mainnet", fundingM: 4,   tier1: false, tvlM: 0,    activity: 72, scamRisk: 22, note: "DePIN-скрейпинг · раздача была" },
  { id: "unknownX", name: "ZenChain",     cat: "L1 · testnet",  chain: "Zen",     stage: "testnet", fundingM: 3,   tier1: false, tvlM: 0,    activity: 40, scamRisk: 55, note: "Малоизвестный · осторожно" },
  { id: "farmz",    name: "YieldFarm∞",   cat: "DeFi · farm",   chain: "BSC",     stage: "mainnet", fundingM: 0,   tier1: false, tvlM: 6,    activity: 35, scamRisk: 82, note: "Анонимная команда · признаки скама" },
];

function scoreAirdrop(p) {
  let s = 0; const reasons = [];
  const fund = Math.min(25, (p.fundingM / 150) * 25);
  s += fund; if (p.fundingM >= 80) reasons.push(`финансирование $${p.fundingM}M`);
  if (p.tier1) { s += 18; reasons.push("tier-1 инвесторы"); }
  const act = (p.activity / 100) * 20; s += act; if (p.activity >= 75) reasons.push(`высокая активность ${p.activity}/100`);
  const tvl = Math.min(15, (p.tvlM / 3000) * 15); s += tvl; if (p.tvlM >= 500) reasons.push(`TVL $${p.tvlM >= 1000 ? (p.tvlM / 1000).toFixed(1) + "B" : p.tvlM + "M"}`);
  if (p.stage === "testnet") { s += 12; reasons.push("pre-TGE — потенциал раздачи выше"); }
  else if (p.stage === "mainnet") { s += 4; }
  const penalty = (p.scamRisk / 100) * 30; s -= penalty; if (p.scamRisk >= 40) reasons.push(`риск скама ${p.scamRisk}%`);
  const score = Math.max(0, Math.min(100, Math.round(s)));
  const verdict = score >= 68 ? "Перспективно" : score >= 45 ? "Осторожно" : "Высокий риск";
  const vColor = score >= 68 ? "var(--green)" : score >= 45 ? "var(--amber)" : "var(--red)";
  return { score, verdict, vColor, reasons: reasons.slice(0, 3) };
}

function AirdropRadarPage({ lang }) {
  const [sortBy, setSortBy] = useState("score");
  const [liveTvl, setLiveTvl] = useState(null); // real TVL from backend (DeFiLlama), graceful
  useEffect(() => {
    let cancelled = false;
    fetch("/api/airdrop-tvl").then(r => (r.ok ? r.json() : null))
      .then(j => { if (!cancelled && j && j.ok) setLiveTvl(j.tvl); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  const scored = useMemo(() => AIRDROP_PROJECTS.map(p => {
    const hasLive = liveTvl && liveTvl[p.id] != null;
    const proj = { ...p, tvlM: hasLive ? liveTvl[p.id] : p.tvlM, tvlLive: hasLive };
    return { ...proj, ...scoreAirdrop(proj) };
  }).sort((a, b) => sortBy === "score" ? b.score - a.score : sortBy === "risk" ? a.scamRisk - b.scamRisk : b.fundingM - a.fundingM), [sortBy, liveTvl]);
  const [sel, setSel] = useState(null);
  const promising = scored.filter(p => p.score >= 68).length;
  const liveCount = liveTvl ? Object.keys(liveTvl).length : 0;

  return (
    <div data-screen-label="15 Airdrops" style={{ minHeight: "100%", padding: "var(--gap)", display: "flex", flexDirection: "column" }}>
      <PageHeader title={lang === "en" ? "AIRDROP RADAR" : "AIRDROP · РАДАР"}
        sub={`AI-оценка перспектив · ${AIRDROP_PROJECTS.length} проектов · ${promising} перспективных · scam-scan${liveCount ? ` · ${liveCount} live TVL (DeFiLlama)` : ""}`}
        actions={<>
          {["score", "funding", "risk"].map(k => (
            <button key={k} onClick={() => setSortBy(k)} className={`btn ${sortBy === k ? "btn-accent" : ""}`}>
              {k === "score" ? "По оценке" : k === "funding" ? "По финанс." : "По риску"}
            </button>
          ))}
        </>}
      />
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: sel ? "1.5fr 1fr" : "1fr", gap: "var(--gap)", minHeight: 0, overflow: "hidden" }}>
        <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 90px 80px 70px 90px 100px", padding: "7px 14px", borderBottom: "1px solid var(--line)", background: "var(--bg-2)", fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.08, textTransform: "uppercase" }}>
            <span>Проект</span><span>Стадия</span><span style={{ textAlign: "right" }}>Финанс.</span><span style={{ textAlign: "right" }}>Риск</span><span style={{ textAlign: "right" }}>Оценка</span><span style={{ textAlign: "right" }}>Вердикт</span>
          </div>
          <div className="scroll" style={{ flex: 1, overflowY: "auto" }}>
            {scored.map(p => (
              <div key={p.id} onClick={() => setSel(p)} style={{ display: "grid", gridTemplateColumns: "1.4fr 90px 80px 70px 90px 100px", alignItems: "center", padding: "8px 14px", borderBottom: "1px solid var(--line)", cursor: "pointer", background: sel?.id === p.id ? "var(--accent-soft)" : "transparent", fontFamily: "var(--font-mono)", fontSize: 11 }}>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ color: "var(--text-bright)", fontWeight: 600 }}>{p.name}</span>
                  <span style={{ fontSize: 9, color: "var(--text-dim)" }}>{p.cat}</span>
                </div>
                <span className="chip" style={{ fontSize: 9, width: "fit-content", color: p.stage === "testnet" ? "var(--accent-2)" : "var(--text-mid)" }}>{p.stage}</span>
                <span style={{ textAlign: "right", color: "var(--text-mid)" }}>{p.fundingM ? `$${p.fundingM}M` : "—"}</span>
                <span style={{ textAlign: "right", color: p.scamRisk > 50 ? "var(--red)" : p.scamRisk > 25 ? "var(--amber)" : "var(--green)" }}>{p.scamRisk}%</span>
                <span style={{ textAlign: "right", color: p.vColor, fontWeight: 700 }}>{p.score}</span>
                <span style={{ textAlign: "right", color: p.vColor, fontSize: 9.5 }}>{p.verdict}</span>
              </div>
            ))}
          </div>
          <div style={{ padding: "8px 14px", borderTop: "1px solid var(--line)", fontSize: 10, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
            ⚠ Кураторский датасет + алгоритмическая оценка по критериям — не инвестиционная рекомендация. DYOR.
          </div>
        </div>

        {sel && (
          <div className="panel scroll" style={{ overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: 6, border: `1.5px solid ${sel.vColor}`, color: sel.vColor, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 700 }}>{sel.score}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, color: "var(--text-bright)", fontWeight: 600 }}>{sel.name}</div>
                <div className="mono" style={{ fontSize: 10, color: "var(--text-dim)" }}>{sel.cat} · {sel.chain}</div>
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: sel.vColor, padding: "3px 9px", border: `1px solid ${sel.vColor}`, borderRadius: 4 }}>{sel.verdict}</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-mid)", lineHeight: 1.5, padding: "8px 10px", background: "var(--bg-0)", border: "1px solid var(--line)", borderRadius: 4 }}>{sel.note}</div>
            <div>
              <div style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.15, fontWeight: 600, textTransform: "uppercase", marginBottom: 6 }}>Факторы оценки</div>
              {[["Финансирование", sel.fundingM ? `$${sel.fundingM}M` : "—"], ["Tier-1 инвесторы", sel.tier1 ? "да" : "нет"], ["TVL" + (sel.tvlLive ? " · live" : ""), (sel.tvlLive ? "● " : "") + (sel.tvlM ? (sel.tvlM >= 1000 ? `$${(sel.tvlM / 1000).toFixed(1)}B` : `$${sel.tvlM}M`) : "—")], ["Активность", `${sel.activity}/100`], ["Риск скама", `${sel.scamRisk}%`], ["Стадия", sel.stage]].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid var(--line)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
                  <span style={{ color: "var(--text-dim)" }}>{k}</span><span style={{ color: "var(--text)" }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ padding: "10px 12px", background: "oklch(0.72 0.17 var(--accent-h) / 0.06)", border: `1px solid ${sel.vColor}`, borderLeft: `3px solid ${sel.vColor}`, borderRadius: 4, fontSize: 11.5, color: "var(--text)", lineHeight: 1.5 }}>
              <span style={{ color: sel.vColor, fontWeight: 600 }}>↳ airdrop.agt: </span>
              {sel.verdict === "Перспективно" ? "Проект проходит ключевые критерии" : sel.verdict === "Осторожно" ? "Смешанные сигналы — взвесьте риск" : "Слабые/рискованные сигналы — вероятно, пропустить"}
              {sel.reasons.length ? ` (${sel.reasons.join(", ")}).` : "."} Оценка алгоритмическая, не инвест-совет.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Free airdrops tracker ── */
const FREE_AIRDROPS = [
  { id: "monad-t",   name: "Monad Testnet",     chain: "Monad",   type: "testnet", cost: "бесплатно · ~gas testnet", diff: "легко",  pot: "high", status: "активно", deadline: "TGE ~Q3", steps: ["Подключить кошелёк к testnet.monad.xyz", "Получить тестовые токены из faucet", "Совершить 10+ swap/mint транзакций", "Держать активность 4+ недель"] },
  { id: "megaeth-t", name: "MegaETH Testnet",   chain: "MegaETH", type: "testnet", cost: "бесплатно · ~gas testnet", diff: "легко",  pot: "high", status: "активно", deadline: "н/д",     steps: ["Зайти на testnet.megaeth.com", "Запросить faucet", "Использовать dApps экосистемы", "Стабильная еженедельная активность"] },
  { id: "galxe-q",   name: "Galxe Quests",      chain: "multi",   type: "quest",   cost: "бесплатно",                diff: "легко",  pot: "med",  status: "активно", deadline: "ротация", steps: ["Аккаунт на galxe.com", "Выполнять квесты активных кампаний", "Собирать OATs/баллы", "Мониторить новые кампании L2"] },
  { id: "layer3",    name: "Layer3 Cubes",      chain: "multi",   type: "quest",   cost: "бесплатно",                diff: "легко",  pot: "med",  status: "активно", deadline: "ротация", steps: ["Профиль на layer3.xyz", "Проходить квесты (cubes)", "Поднимать streak", "L3 токен уже раздавался — 2 сезон возможен"] },
  { id: "hyperl-p",  name: "Hyperliquid points",chain: "Hyperl.", type: "trade",   cost: "бесплатно · нужен депозит",diff: "средне", pot: "high", status: "активно", deadline: "сезоны",  steps: ["Депозит USDC на app.hyperliquid.xyz", "Торговать perp (объём = баллы)", "Держать позиции/ликвидность", "Следить за сезонами баллов"] },
  { id: "scroll-s2", name: "Scroll Sessions 2", chain: "Scroll",  type: "onchain", cost: "~gas (дёшево)",            diff: "средне", pot: "med",  status: "слухи",   deadline: "н/д",     steps: ["Мост ETH в Scroll", "Использовать DeFi (Ambient, Aave)", "Держать баланс/LP", "Marks за активность"] },
  { id: "grass-2",   name: "Grass (DePIN)",     chain: "Solana",  type: "depin",   cost: "бесплатно · трафик",       diff: "легко",  pot: "med",  status: "активно", deadline: "сезоны",  steps: ["Установить расширение Grass", "Держать включённым (делит трафик)", "Копить баллы", "1 раздача была — возможны ещё"] },
  { id: "berps",     name: "Berachain квесты",  chain: "Bera",    type: "onchain", cost: "~gas (дёшево)",            diff: "средне", pot: "med",  status: "активно", deadline: "н/д",     steps: ["Использовать dApps Berachain", "Проходить PoL-механики (BGT)", "Держать/стейкать", "Мониторить сезоны"] },
];

function FreeAirdropsPage({ lang }) {
  const [filter, setFilter] = useState("all");
  const filtered = FREE_AIRDROPS.filter(a => filter === "all" || a.type === filter);
  const potColor = { high: "var(--green)", med: "var(--amber)", low: "var(--text-mid)" };
  const diffColor = { "легко": "var(--green)", "средне": "var(--amber)", "сложно": "var(--red)" };

  return (
    <div data-screen-label="16 FreeDrops" style={{ minHeight: "100%", padding: "var(--gap)", display: "flex", flexDirection: "column" }}>
      <PageHeader title={lang === "en" ? "FREE AIRDROPS" : "БЕСПЛАТНЫЕ AIRDROPS"}
        sub={`${FREE_AIRDROPS.length} возможностей · способы участия · дедлайны · статус`}
        actions={<>
          {[["all", "Все"], ["testnet", "Testnet"], ["quest", "Квесты"], ["onchain", "On-chain"], ["depin", "DePIN"]].map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} className={`btn ${filter === k ? "btn-accent" : ""}`}>{l}</button>
          ))}
        </>}
      />
      <div className="scroll" style={{ flex: 1, overflowY: "auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--gap)", alignContent: "start", paddingRight: 4, minHeight: 0 }}>
        {filtered.map(a => (
          <div key={a.id} className="panel" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, color: "var(--text-bright)", fontWeight: 600 }}>{a.name}</span>
              <span className="chip" style={{ fontSize: 9 }}>{a.chain}</span>
              <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 9, color: a.status === "активно" ? "var(--green)" : "var(--amber)", border: `1px solid ${a.status === "активно" ? "var(--green)" : "var(--amber)"}`, borderRadius: 2, padding: "1px 6px" }}>{a.status}</span>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", fontFamily: "var(--font-mono)", fontSize: 9.5 }}>
              <span style={{ color: "var(--blue)", border: "1px solid var(--line)", borderRadius: 2, padding: "1px 6px" }}>{a.type}</span>
              <span style={{ color: diffColor[a.diff], border: "1px solid var(--line)", borderRadius: 2, padding: "1px 6px" }}>{a.diff}</span>
              <span style={{ color: potColor[a.pot], border: "1px solid var(--line)", borderRadius: 2, padding: "1px 6px" }}>потенциал: {a.pot === "high" ? "высокий" : a.pot === "med" ? "средний" : "низкий"}</span>
              <span style={{ color: "var(--green)", border: "1px solid var(--line)", borderRadius: 2, padding: "1px 6px" }}>{a.cost}</span>
            </div>
            <div>
              <div style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.12, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Как получить</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {a.steps.map((s, i) => (
                  <div key={i} style={{ display: "flex", gap: 7, fontSize: 11, color: "var(--text-mid)", lineHeight: 1.4 }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--accent)", flexShrink: 0 }}>{i + 1}.</span>{s}
                  </div>
                ))}
              </div>
            </div>
            <div className="mono" style={{ fontSize: 9.5, color: "var(--text-dim)", marginTop: 2 }}>дедлайн: {a.deadline}</div>
          </div>
        ))}
        <div className="panel" style={{ gridColumn: "1 / -1", padding: "10px 14px", fontSize: 10.5, color: "var(--text-dim)", fontFamily: "var(--font-mono)", lineHeight: 1.5 }}>
          ⚠ Кураторский список. Airdrop не гарантирован. Никогда не платите за «клейм», не вводите seed-фразу, проверяйте официальные ссылки. Это не инвестиционная рекомендация.
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { AirdropRadarPage, FreeAirdropsPage, scoreAirdrop, AIRDROP_PROJECTS, FREE_AIRDROPS });
