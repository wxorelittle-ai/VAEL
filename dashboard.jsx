/* dashboard.jsx — main command center page */

/* ─────────────────────────────────────────────────────────
 * Mission Control Terminal — live log stream + agent thoughts
 * ────────────────────────────────────────────────────────*/

const TERM_TEMPLATES = {
  info: [
    "Получен входящий запрос #{id} от orchestrator",
    "Маршрутизация задачи в очередь {q}",
    "Запрос к векторной памяти k={k} top={t}",
    "Embedding модель {m} загружена ({d}ms)",
    "Обновлён контекст сессии sid={sid}",
    "Снимок состояния сохранён в kv-store",
    "Connection pool: {n}/256 активных",
  ],
  ok: [
    "Задача {tid} завершена · {ms}ms · tokens={tk}",
    "Backtest подтвердил гипотезу с confidence {c}%",
    "Sync с Supabase: OK ({n} записей)",
    "Проверка целостности · 12/12 узлов согласованы",
    "Контракт верифицирован, sig=OK",
    "Граф связей перестроен · {n} рёбер",
  ],
  thought: [
    "Анализирую корреляцию между потоком {x} и активностью {y}",
    "Гипотеза: накопление позиций в кошельках кластера #{n}",
    "Сравниваю текущий паттерн с историческими аномалиями",
    "Декомпозиция миссии на 4 подзадачи: scan → enrich → score → report",
    "Risk Agent сигналит о растущей волатильности в окне 1h",
    "Memory Agent предлагает релевантный фрагмент из 12.03.26",
    "Оцениваю достоверность источника на основе цепочки доверия",
    "Если индикатор пробьёт {v}σ — эскалирую на Strategy",
    "Confidence повышается с {a}% до {b}% после кросс-валидации",
    "Запрашиваю дополнительный контекст у Research Agent",
  ],
  warn: [
    "Latency источника {src} превысил порог: {ms}ms",
    "Обнаружены частичные коллизии embeddings (k={k})",
    "Rate-limit от внешнего API ({n}/min), ввожу backoff",
    "Confidence ниже порога (62%) — требуется ревизия",
    "Дрифт модели зафиксирован: Δ={d}",
  ],
  err: [
    "Сбой запроса к node #{n} · повтор через {ms}ms",
    "Невалидный ответ от tool={t} · отброшен",
    "Сетевой таймаут / WS reconnect inflight",
  ],
  sys: [
    "GC цикл завершён · освобождено {mb}MB",
    "Heartbeat 30s · OK",
    "Routing table обновлён · {n} agent-узлов",
    "Watchdog: все агенты отзывчивы",
  ],
};

const AGENT_NAMES = [
  "planner.agt", "executor.agt", "critic.agt", "research.agt",
  "news.agt", "onchain.agt", "alert.agt", "forecast.agt",
  "strategy.agt", "risk.agt", "memory.agt", "autofix.agt",
];

function tmpl(s) {
  return s
    .replace(/\{id\}/g, randInt(1000, 9999))
    .replace(/\{q\}/g, pick(["high", "normal", "low", "burst"]))
    .replace(/\{k\}/g, randInt(8, 64))
    .replace(/\{t\}/g, randInt(3, 16))
    .replace(/\{m\}/g, pick(["bge-m3", "e5-large", "v6-embed-2", "nomic-v1.5"]))
    .replace(/\{d\}/g, randInt(40, 220))
    .replace(/\{sid\}/g, "S-" + randInt(10000, 99999))
    .replace(/\{n\}/g, randInt(2, 200))
    .replace(/\{tid\}/g, "T-" + randInt(100, 999))
    .replace(/\{ms\}/g, randInt(50, 2400))
    .replace(/\{tk\}/g, randInt(120, 4800))
    .replace(/\{c\}/g, randInt(72, 96))
    .replace(/\{x\}/g, pick(["whale-flow", "stable-bridges", "cex-deposits", "L2-bridges"]))
    .replace(/\{y\}/g, pick(["sentiment", "news-pulse", "options-skew", "social-burst"]))
    .replace(/\{v\}/g, (rand(1, 3)).toFixed(1))
    .replace(/\{a\}/g, randInt(60, 78))
    .replace(/\{b\}/g, randInt(80, 94))
    .replace(/\{src\}/g, pick(["alpha", "beta", "delta", "echo"]))
    .replace(/\{mb\}/g, randInt(120, 480));
}

function nowTs() {
  const d = new Date();
  return d.toTimeString().slice(0, 8) + "." + String(d.getMilliseconds()).padStart(3, "0").slice(0, 2);
}

function MissionTerminal({ paused, onPause }) {
  const [lines, setLines] = useState(() => seedLines());
  const [filter, setFilter] = useState("all"); // all | think | ok | warn
  const scrollRef = useRef(null);
  const [autoscroll, setAutoscroll] = useState(true);

  function seedLines() {
    const out = [];
    for (let i = 0; i < 18; i++) {
      const level = pick(["info", "thought", "thought", "ok", "info", "sys", "warn"]);
      out.push({
        t: nowTs(),
        level,
        agent: pick(AGENT_NAMES),
        msg: tmpl(pick(TERM_TEMPLATES[level])),
      });
    }
    return out;
  }

  useInterval(() => {
    if (paused) return;
    setLines(prev => {
      const level = pick([
        "info", "info", "thought", "thought", "thought",
        "ok", "ok", "sys", "warn", "info", "thought",
      ]);
      const next = {
        t: nowTs(),
        level,
        agent: pick(AGENT_NAMES),
        msg: tmpl(pick(TERM_TEMPLATES[level] || TERM_TEMPLATES.info)),
        streaming: level === "thought" && Math.random() < 0.4,
      };
      const arr = [...prev, next];
      return arr.length > 80 ? arr.slice(-80) : arr;
    });
  }, 700);

  useEffect(() => {
    if (autoscroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines, autoscroll]);

  const filtered = lines.filter(l => {
    if (filter === "all") return true;
    if (filter === "think") return l.level === "thought";
    return l.level === filter;
  });

  return (
    <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
      <PanelHeader
        title="MISSION CONTROL · ПОТОК"
        meta={`${lines.length} строк · stream://orchestrator.v6`}
        action={
          <div style={{ display: "flex", gap: 6 }}>
            {["all", "think", "ok", "warn"].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{
                  fontFamily: "var(--font-mono)", fontSize: 9.5,
                  padding: "1px 6px", borderRadius: 2,
                  background: filter === f ? "var(--accent-soft)" : "transparent",
                  color: filter === f ? "var(--accent)" : "var(--text-dim)",
                  border: `1px solid ${filter === f ? "oklch(0.78 0.16 var(--accent-h) / 0.4)" : "var(--line)"}`,
                  cursor: "pointer", letterSpacing: 0.06,
                  textTransform: "uppercase",
                }}>{f}</button>
            ))}
            <button onClick={onPause}
              style={{
                fontFamily: "var(--font-mono)", fontSize: 9.5,
                padding: "1px 6px", borderRadius: 2,
                background: paused ? "oklch(0.82 0.16 75 / 0.15)" : "transparent",
                color: paused ? "var(--amber)" : "var(--text-dim)",
                border: `1px solid ${paused ? "oklch(0.82 0.16 75 / 0.4)" : "var(--line)"}`,
                cursor: "pointer", letterSpacing: 0.06,
              }}>{paused ? "▶ RESUME" : "❚❚ PAUSE"}</button>
          </div>
        }
      />
      <div ref={scrollRef} className="scroll grid-bg" style={{
        flex: 1, padding: "8px 12px",
        overflowY: "auto",
        background: "var(--bg-0)",
        position: "relative",
      }}>
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: 10,
          color: "var(--accent)", marginBottom: 6, opacity: 0.6,
        }}>
          ▸ v6.orchestrator init · session S-78421 · listening on ws://kernel.v6/stream
        </div>
        {filtered.map((l, i) => <LogLine key={i + l.t} entry={l} />)}
      </div>
      <div style={{
        padding: "6px 12px",
        borderTop: "1px solid var(--line)",
        background: "var(--bg-2)",
        display: "flex", alignItems: "center", gap: 8,
        fontFamily: "var(--font-mono)", fontSize: 10.5,
        color: "var(--text-mid)",
      }}>
        <span style={{ color: "var(--accent)" }}>▸</span>
        <span style={{ color: "var(--text-dim)" }}>orchestrator@vael ~ ❯</span>
        <input
          placeholder="введите команду или цель миссии..."
          style={{
            flex: 1, background: "transparent", border: "none",
            color: "var(--text-bright)", fontFamily: "var(--font-mono)", fontSize: 11,
            outline: "none",
          }}
        />
        <span className="chip">ENTER</span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 * Top metrics row
 * ────────────────────────────────────────────────────────*/

function genSpark(base, vol = 0.15, len = 24) {
  const arr = [base];
  for (let i = 1; i < len; i++) {
    const next = arr[i-1] + (Math.random() - 0.5) * base * vol;
    arr.push(Math.max(0.1, next));
  }
  return arr;
}

function MetricsRow({ metrics, lang }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(8, 1fr)",
      gap: "var(--gap)",
    }}>
      <MetricCard
        label={lang === "en" ? "Active Agents" : "Активные агенты"}
        value={metrics.activeAgents} unit="/12"
        delta={2.4}
        sparkData={metrics.spark1}
        sub={`uptime ${metrics.uptime}h`}
      />
      <MetricCard
        label={lang === "en" ? "Tasks Today" : "Задач сегодня"}
        value={metrics.tasks}
        delta={12.7}
        sparkData={metrics.spark2}
        sub="vs 24h"
        color="var(--blue)"
      />
      <MetricCard
        label={lang === "en" ? "Success Rate" : "Успешность"}
        value={metrics.success} unit="%"
        delta={0.8}
        sparkData={metrics.spark3}
        sub={`${metrics.failed} failed`}
        color="var(--green)"
      />
      <MetricCard
        label={lang === "en" ? "API Calls" : "API запросы"}
        value={metrics.apiCalls}
        delta={-3.2}
        sparkData={metrics.spark4}
        sub="rpm 1m"
        kind="bars"
      />
      <MetricCard
        label={lang === "en" ? "Wallets" : "Кошельки"}
        value={metrics.wallets}
        delta={5.1}
        sparkData={metrics.spark5}
        sub={`${metrics.walletsActive} active`}
        color="var(--accent-2)"
      />
      <MetricCard
        label={lang === "en" ? "Alerts" : "Алерты"}
        value={metrics.alerts}
        delta={-1.4}
        sparkData={metrics.spark6}
        sub={`${metrics.alertsCrit} crit · ${metrics.alertsWarn} warn`}
        color="var(--amber)"
      />
      <MetricCard
        label="AI Confidence"
        value={metrics.confidence} unit="%"
        delta={1.6}
        sparkData={metrics.spark7}
        sub="rolling 1h"
        color="var(--accent)"
      />
      <MetricCard
        label={lang === "en" ? "Memory" : "Память"}
        value={metrics.memUse} unit="GB"
        delta={4.1}
        sparkData={metrics.spark8}
        sub={`${metrics.memVectors}M vectors`}
        color="var(--blue)"
        kind="bars"
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 * Agent grid (right panel)
 * ────────────────────────────────────────────────────────*/
function AgentGrid({ agents, lang }) {
  return (
    <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
      <PanelHeader
        title={lang === "en" ? "AGENTS · LIVE GRID" : "АГЕНТЫ · СЕТКА"}
        meta={`${agents.filter(a => a.status === "active").length} активных / ${agents.length}`}
      />
      <div className="scroll" style={{ flex: 1, padding: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {agents.map(a => <AgentCard key={a.def.id} agent={a} />)}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 * Network graph panel
 * ────────────────────────────────────────────────────────*/
function NetworkPanel({ agents, lang }) {
  return (
    <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
      <PanelHeader
        title={lang === "en" ? "AGENT NETWORK · TOPOLOGY" : "СЕТЬ АГЕНТОВ · ТОПОЛОГИЯ"}
        meta="planner-centric · WS mesh"
      />
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        <NetworkGraph agents={agents} width={320} height={240} />
        {/* corner legend */}
        <div style={{
          position: "absolute", top: 8, right: 8,
          display: "flex", flexDirection: "column", gap: 3,
          fontFamily: "var(--font-mono)", fontSize: 9.5,
          color: "var(--text-dim)",
        }}>
          <div><span style={{ color: "var(--green)" }}>●</span> active</div>
          <div><span style={{ color: "var(--text-dim)" }}>●</span> idle</div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 * Alerts ticker
 * ────────────────────────────────────────────────────────*/

const ALERT_POOL = [
  { sev: "crit", text: "WHALE · 12 800 ETH перемещены с 0x7a2c→0x9b4f · CEX deposit" },
  { sev: "warn", text: "VOL · BTC 1h volatility +4.2σ от 24h baseline" },
  { sev: "info", text: "NEWS · breaking · L2 rollup launched mainnet (sentiment +0.62)" },
  { sev: "crit", text: "RISK · suspicious wallet 0xdead… связан с известным mixer" },
  { sev: "warn", text: "UNUSUAL · 3.4M USDT flow → derivatives exchange · 8m window" },
  { sev: "info", text: "FORECAST · model v6.2 confidence повышена до 87% по сценарию A" },
  { sev: "warn", text: "DRIFT · embedding-cluster #14 сместился на 0.18 vs T-7" },
  { sev: "crit", text: "AI RISK · prompt injection попытка отклонена · src=external-feed-3" },
];

function AlertsTicker({ lang }) {
  const [items, setItems] = useState(() => {
    return Array.from({ length: 6 }).map(() => ({
      ...pick(ALERT_POOL),
      t: nowTs(),
      id: Math.random(),
    }));
  });
  useInterval(() => {
    setItems(prev => {
      const next = { ...pick(ALERT_POOL), t: nowTs(), id: Math.random(), isNew: true };
      const arr = [next, ...prev];
      return arr.slice(0, 8);
    });
  }, 3200);

  return (
    <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
      <PanelHeader
        title={lang === "en" ? "REALTIME ALERTS" : "ПОТОК АЛЕРТОВ"}
        meta="severity ≥ INFO"
        action={
          <span className="mono" style={{ fontSize: 9.5, color: "var(--green)" }}>
            <PulseDot size={5} color="var(--green)" /> В ЭФИРЕ
          </span>
        }
      />
      <div className="scroll" style={{ flex: 1, padding: "4px 0" }}>
        {items.map((a) => (
          <AlertRow key={a.id} alert={a} />
        ))}
      </div>
    </div>
  );
}

function AlertRow({ alert }) {
  const color = alert.sev === "crit" ? "var(--red)" : alert.sev === "warn" ? "var(--amber)" : "var(--blue)";
  const label = { crit: "КРИТ", warn: "ВНИМ", info: "ИНФО" }[alert.sev] || alert.sev.toUpperCase();
  const [age, setAge] = useState(0);
  useInterval(() => setAge(a => a + 1), 1000);

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "auto auto 1fr auto",
      gap: 10,
      padding: "5px 12px",
      borderBottom: "1px solid var(--line)",
      fontSize: 11,
      alignItems: "center",
      animation: alert.isNew ? "alertIn 0.6s ease-out" : "none",
    }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--text-dim)" }}>{alert.t}</span>
      <span style={{
        fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600,
        color, padding: "1px 5px", borderRadius: 2,
        border: `1px solid ${color}`, background: "transparent",
        letterSpacing: 0.08,
      }}>{label}</span>
      <span style={{ color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{alert.text}</span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--text-dim)" }}>{age}s</span>
    </div>
  );
}

/* alert keyframe injection */
if (typeof document !== "undefined" && !document.getElementById("__alert_kf")) {
  const s = document.createElement("style");
  s.id = "__alert_kf";
  s.textContent = `
    @keyframes alertIn {
      0% { background: oklch(0.78 0.16 var(--accent-h) / 0.18); transform: translateX(-4px); opacity: 0; }
      100% { background: transparent; transform: translateX(0); opacity: 1; }
    }
  `;
  document.head.appendChild(s);
}

/* ─────────────────────────────────────────────────────────
 * Active missions panel (compact)
 * ────────────────────────────────────────────────────────*/
function ActiveMissions({ lang }) {
  const missions = [
    { id: "M-2841", name: "Сканирование whale-кошельков · ETH mainnet", progress: 67, agents: ["OC","RS","RK"], eta: "12m", status: "running" },
    { id: "M-2840", name: "Анализ настроений · L2 ecosystem · 24h", progress: 42, agents: ["NW","FC"], eta: "28m", status: "running" },
    { id: "M-2839", name: "Backtest стратегии #14 на исторических данных", progress: 91, agents: ["ST","CR"], eta: "3m", status: "running" },
    { id: "M-2838", name: "Сводный отчёт за смену · 06:00–14:00", progress: 100, agents: ["MM","PL"], eta: "—", status: "done" },
    { id: "M-2837", name: "Реконсиляция векторного индекса embeddings", progress: 23, agents: ["MM","AF"], eta: "44m", status: "running" },
    { id: "M-2836", name: "Мониторинг бридж-контрактов · multi-chain", progress: 55, agents: ["OC","AL"], eta: "ongoing", status: "running" },
  ];

  return (
    <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
      <PanelHeader
        title={lang === "en" ? "ACTIVE MISSIONS" : "АКТИВНЫЕ МИССИИ"}
        meta={`${missions.filter(m=>m.status==="running").length} running · queue 14`}
      />
      <div className="scroll" style={{ flex: 1 }}>
        {missions.map(m => <MissionRow key={m.id} mission={m} />)}
      </div>
    </div>
  );
}

function MissionRow({ mission }) {
  const isDone = mission.status === "done";
  const barColor = isDone ? "var(--green)" : "var(--accent)";
  return (
    <div style={{
      padding: "7px 12px",
      borderBottom: "1px solid var(--line)",
      display: "flex", flexDirection: "column", gap: 4,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="mono" style={{ fontSize: 10, color: "var(--text-dim)", letterSpacing: 0.04 }}>{mission.id}</span>
        <span style={{ fontSize: 11, color: "var(--text-bright)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {mission.name}
        </span>
        <span className="mono" style={{ fontSize: 10, color: isDone ? "var(--green)" : "var(--text-mid)" }}>
          {isDone ? "✓ ГОТОВ" : `${mission.progress}%`}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, height: 2, background: "var(--bg-3)", overflow: "hidden", position: "relative" }}>
          <div style={{
            position: "absolute", left: 0, top: 0, bottom: 0,
            width: `${mission.progress}%`,
            background: barColor,
            boxShadow: !isDone ? "var(--glow)" : "none",
            transition: "width 0.6s",
          }} />
          {!isDone && (
            <div style={{
              position: "absolute", top: 0, bottom: 0, left: 0,
              width: 30,
              background: `linear-gradient(to right, transparent, ${barColor})`,
              animation: "missionScan calc(2.4s / var(--speed)) linear infinite",
              opacity: 0.6,
            }} />
          )}
        </div>
        <div style={{ display: "flex", gap: 2 }}>
          {mission.agents.map(g => (
            <span key={g} style={{
              fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600,
              color: "var(--accent)", padding: "0 3px",
              border: "1px solid oklch(0.78 0.16 var(--accent-h) / 0.4)",
              borderRadius: 2,
              background: "var(--accent-soft)",
            }}>{g}</span>
          ))}
        </div>
        <span className="mono" style={{ fontSize: 9.5, color: "var(--text-dim)", minWidth: 38, textAlign: "right" }}>ETA {mission.eta}</span>
      </div>
    </div>
  );
}

if (typeof document !== "undefined" && !document.getElementById("__mission_kf")) {
  const s = document.createElement("style");
  s.id = "__mission_kf";
  s.textContent = `
    @keyframes missionScan {
      0% { transform: translateX(0); opacity: 0.6; }
      100% { transform: translateX(100%); opacity: 0.6; }
    }
  `;
  document.head.appendChild(s);
}

/* ─────────────────────────────────────────────────────────
 * Sentiment + Forecast strip (bottom)
 * ────────────────────────────────────────────────────────*/
function ForecastStrip({ lang }) {
  return (
    <div className="panel" style={{ display: "flex", overflow: "hidden", minHeight: 0 }}>
      <ForecastCell label="SENTIMENT 1h"  value={0.62} max={1} color="var(--green)" data={genSpark(60, 0.18)} />
      <ForecastCell label="VOLATILITY"    value={2.4} max={5} color="var(--amber)" data={genSpark(40, 0.32)} suffix="σ" />
      <ForecastCell label="RISK INDEX"    value={3.1} max={10} color="var(--red)"  data={genSpark(30, 0.22)} />
      <ForecastCell label="FLOW · NET"    value={+18.4} max={50} color="var(--blue)" data={genSpark(20, 0.42)} suffix="M$" signed />
      <ForecastCell label="AI FORECAST"   value={87}  max={100} color="var(--accent)" data={genSpark(80, 0.08)} suffix="%" />
      <ForecastCell label="ANOMALY"       value={0.42} max={1} color="var(--accent-2)" data={genSpark(0.4, 0.3)} />
    </div>
  );
}

function ForecastCell({ label, value, max, color, data, suffix = "", signed }) {
  const pct = Math.min(100, Math.abs(value) / max * 100);
  const displayValue = signed && value > 0 ? `+${value.toFixed(1)}` : value.toFixed(value < 10 ? 2 : 1);
  return (
    <div style={{
      flex: 1, padding: "10px 14px",
      borderRight: "1px solid var(--line)",
      display: "flex", flexDirection: "column", gap: 5,
      minWidth: 0,
    }}>
      <div style={{
        fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase",
        color: "var(--text-dim)", fontWeight: 600,
      }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 4 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, color: "var(--text-bright)" }}>
          {displayValue}<span style={{ fontSize: 11, color: "var(--text-dim)", marginLeft: 2 }}>{suffix}</span>
        </div>
        <Sparkline data={data} width={50} height={20} color={color} fill={false} />
      </div>
      <div style={{ height: 2, background: "var(--bg-3)", overflow: "hidden", position: "relative" }}>
        <div style={{
          position: "absolute", inset: 0, width: `${pct}%`,
          background: color,
          boxShadow: `0 0 8px ${color}`,
          transition: "width 0.6s",
        }} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 * DASHBOARD root layout
 * ────────────────────────────────────────────────────────*/
function DashboardPage({ agents, metrics, lang, mission }) {
  return (
    <div data-screen-label="01 Dashboard" style={{
      display: "grid",
      gridTemplateRows: "auto 1fr auto",
      gap: "var(--gap)",
      padding: "var(--gap)",
      height: "100%",
      overflow: "hidden",
      minHeight: 0,
    }}>
      {/* Row 1: top metrics */}
      <MetricsRow metrics={metrics} lang={lang} />

      {/* Row 2: crypto trading terminal — full width */}
      <CryptoSignalsPanel lang={lang} />

      {/* Row 3: forecast strip */}
      <ForecastStrip lang={lang} />
    </div>
  );
}

Object.assign(window, { DashboardPage, genSpark });