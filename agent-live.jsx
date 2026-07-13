/* agent-live.jsx — Deep agent view: thinking stream, decision tree, perf comparison */

const THINKING_PATTERNS = {
  planner: [
    "Анализирую очередь миссий · 6 активных, 1 в queue",
    "Декомпозирую M-2841: scan → enrich → classify → verify → report",
    "Оценка зависимостей: classify требует enrich, verify требует classify",
    "Маршрутизация: onchain.agt → research.agt → risk.agt → critic.agt",
    "ETA пересчитан с учётом latency сети: 16 → 14 минут",
    "Проверяю наличие свободных слотов агентов · 9/12 в работе",
  ],
  executor: [
    "Получен план от planner.agt · 5 шагов",
    "Запрос pool: fetch(source='alpha') → ожидание...",
    "Ответ получен · 247 записей · 184ms",
    "Сериализация в kv-store · ключ T-841",
    "Передача результата critic.agt для верификации",
  ],
  critic: [
    "Анализирую вывод research.agt · 4 источника",
    "Перекрёстная валидация: alpha vs beta · соответствие 91%",
    "Поиск противоречий в цепочке цитат...",
    "Финальная оценка confidence: 0.88 (было 0.76)",
    "ACK отправлен в memory.agt для сохранения",
  ],
  research: [
    "Поиск контекста по теме L2 · 24h окно",
    "RAG · k=12, top-3 кластера выделены",
    "Embedding similarity: 0.84 (порог 0.78)",
    "Сбор метаданных по 14 источникам",
    "Подготовка ответа в JSON формате",
  ],
  news: [
    "Парсинг RSS · 47 источников активны",
    "Кластеризация заголовков · DBSCAN, eps=0.32",
    "Sentiment scoring · модель v6-news-2",
    "Найдены 3 высоко-импактные новости за час",
    "Передача в alert.agt для оценки правил",
  ],
  onchain: [
    "Сканирую блок #19421837 · 184 транзакций",
    "Whale-filter: amount > 1000 ETH · найдено 3",
    "Перекрёстный матч с known-wallets (847 entities)",
    "Bridge detection · 1 транзакция через Arbitrum",
    "Граф связей обновлён · +12 рёбер",
  ],
  alert: [
    "Применяю правила к новому событию · 5 правил",
    "Match R-001 (Whale > 10K ETH) · TRUE",
    "Severity = CRIT · готовлю notification + telegram",
    "Запрос AI explanation у memory.agt + risk.agt",
    "Dispatch завершён · 2 канала уведомлений",
  ],
  forecast: [
    "Загружаю модель v6.2 для актива ETH",
    "Feature engineering · 24 признака",
    "Inference · 84ms · confidence 0.87",
    "Backtest на T-7 · точность 64%",
    "Сценарий A приоритетен · вероятность 0.87",
  ],
  strategy: [
    "Загружаю активные стратегии · 4 шт",
    "Проверка условий входа для STR-AI-MOM",
    "EMA(50) crossover · детектирован",
    "RSI(14) = 47 · в допустимом диапазоне",
    "Генерация BUY-сигнала · confidence 0.84",
  ],
  risk: [
    "Расчёт risk score кластера #14",
    "Sigma-baseline · текущий 2.4σ (limit 3.0)",
    "Concentration risk · OK (max 18%)",
    "Drawdown ограничение · 12% < 15%",
    "Vердикт: продолжать торговать · risk-on",
  ],
  memory: [
    "Обновляю векторный индекс · +24 embedding",
    "Reindex кластера #14 · сжатие 8%",
    "Сохранение фрагмента в долгосрочную память",
    "Knowledge graph · добавлено 12 рёбер",
    "Snapshot · 2.4M vectors · готов",
  ],
  autofix: [
    "Watchdog · все агенты отзывчивы",
    "Heartbeat проверки · OK",
    "Ожидание сбоев · idle",
    "Resource monitor · GPU 71%",
    "Self-test · OK",
  ],
};

/* ─────────────────────────────────────────────────────────
 * Performance Leaderboard
 * ────────────────────────────────────────────────────────*/
function AgentLeaderboard({ agents, onSelect }) {
  // Generate performance per agent
  const perf = useMemo(() => {
    return agents.map(a => ({
      ...a,
      accuracy: 76 + Math.floor(Math.random() * 22),
      avgLatency: a.latency,
      tasksDone: Math.floor(Math.random() * 240 + 80),
      cost: +(Math.random() * 8 + 0.4).toFixed(2),
      uptime: 88 + Math.random() * 11,
    })).sort((a, b) => b.accuracy - a.accuracy);
  }, [agents.length]);

  const top3 = perf.slice(0, 3);
  const fastest = [...perf].sort((a, b) => a.avgLatency - b.avgLatency).slice(0, 1)[0];
  const costliest = [...perf].sort((a, b) => b.cost - a.cost).slice(0, 1)[0];

  return (
    <div className="panel" style={{ flexShrink: 0 }}>
      <PanelHeader title="ЛИДЕРБОРД АГЕНТОВ · 24Ч" meta="точность · скорость · cost" />
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(5, 1fr)",
        gap: 0,
      }}>
        {top3.map((a, i) => (
          <LbCell key={a.def.id} rank={i + 1} agent={a}
            label={["ТОП #1 · ТОЧНОСТЬ", "#2 · ТОЧНОСТЬ", "#3 · ТОЧНОСТЬ"][i]}
            value={`${a.accuracy}%`}
            valueColor={["var(--green)", "var(--text-bright)", "var(--text-bright)"][i]}
            crown={i === 0}
            onClick={() => onSelect(a.def.id)}
          />
        ))}
        <LbCell rank="⚡" agent={fastest}
          label="БЫСТРЕЙШИЙ"
          value={`${fastest.avgLatency}ms`}
          valueColor="var(--accent)"
          onClick={() => onSelect(fastest.def.id)}
        />
        <LbCell rank="$" agent={costliest}
          label="ДОРОЖЕ ВСЕХ · 24Ч"
          value={`${costliest.cost}$`}
          valueColor="var(--amber)"
          onClick={() => onSelect(costliest.def.id)}
        />
      </div>
    </div>
  );
}

function LbCell({ rank, agent, label, value, valueColor, crown, onClick }) {
  return (
    <div onClick={onClick} style={{
      padding: "10px 14px",
      borderRight: "1px solid var(--line)",
      cursor: "pointer",
      transition: "background 0.1s",
    }}
    onMouseEnter={e => e.currentTarget.style.background = "var(--bg-2)"}
    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 4,
          background: "var(--bg-2)",
          border: `1px solid ${agent.def.color}`,
          color: agent.def.color,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
          flexShrink: 0,
          boxShadow: crown ? `0 0 12px -2px ${agent.def.color}` : "none",
        }}>{agent.def.glyph}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 8.5, color: "var(--text-dim)", letterSpacing: 0.12, fontWeight: 600 }}>{label}</div>
          <div style={{ fontSize: 11.5, color: "var(--text-bright)", fontWeight: 500, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {crown && <span style={{ color: "var(--amber)", marginRight: 4 }}>♔</span>}
            {agent.def.ru}
          </div>
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, color: valueColor, fontWeight: 500 }}>{value}</div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 * Thinking Stream — live "consciousness" feed
 * ────────────────────────────────────────────────────────*/
function ThinkingStream({ agent }) {
  const [thoughts, setThoughts] = useState(() => seed(agent));
  const scrollRef = useRef(null);

  function seed(a) {
    const out = [];
    const pool = THINKING_PATTERNS[a.def.id] || THINKING_PATTERNS.executor;
    for (let i = 0; i < 8; i++) {
      out.push({
        id: Math.random().toString(36).slice(2, 8),
        t: pastTs(8 - i),
        msg: pool[Math.floor(Math.random() * pool.length)],
        type: pickType(),
        confidence: Math.floor(Math.random() * 20) + 76,
      });
    }
    return out;
  }

  // tick: append every 1.6-3s
  useEffect(() => {
    setThoughts(seed(agent));
  }, [agent.def.id]);

  useInterval(() => {
    if (agent.status !== "active") return;
    setThoughts(prev => {
      const pool = THINKING_PATTERNS[agent.def.id] || THINKING_PATTERNS.executor;
      const next = {
        id: Math.random().toString(36).slice(2, 8),
        t: nowTsHM(),
        msg: pool[Math.floor(Math.random() * pool.length)],
        type: pickType(),
        confidence: Math.floor(Math.random() * 20) + 76,
        streaming: Math.random() < 0.35,
      };
      return [...prev.slice(-14), next];
    });
  }, 2000);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [thoughts]);

  return (
    <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0, flex: 1 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "5px 12px", borderBottom: "1px solid var(--line)",
        background: "var(--bg-2)",
        fontFamily: "var(--font-mono)", fontSize: 9.5, fontWeight: 600,
        color: "var(--text-mid)", letterSpacing: 0.1,
        textTransform: "uppercase",
      }}>
        <PulseDot size={5} color={agent.status === "active" ? "var(--accent-2)" : "var(--text-dim)"} />
        STREAM OF CONSCIOUSNESS · {agent.def.name.toUpperCase()}
        <span className="mono" style={{ marginLeft: "auto", color: "var(--text-dim)", textTransform: "none" }}>
          {agent.status === "active" ? "live" : "paused"}
        </span>
      </div>
      <div ref={scrollRef} className="scroll" style={{ flex: 1, padding: "8px 12px", overflowY: "auto", background: "var(--bg-0)" }}>
        {thoughts.map(th => <Thought key={th.id} t={th} agent={agent} />)}
      </div>
    </div>
  );
}

function pickType() {
  const r = Math.random();
  if (r < 0.55) return "think";
  if (r < 0.75) return "action";
  if (r < 0.90) return "observe";
  return "decide";
}

function pastTs(secondsAgo) {
  const d = new Date(Date.now() - secondsAgo * 1000);
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}:${String(d.getSeconds()).padStart(2,"0")}`;
}

const THOUGHT_META = {
  think:   { glyph: "?", color: "var(--accent-2)", label: "МЫСЛЬ" },
  action:  { glyph: "›", color: "var(--accent)",   label: "ДЕЙСТВ" },
  observe: { glyph: "◉", color: "var(--blue)",     label: "НАБЛЮД" },
  decide:  { glyph: "✓", color: "var(--green)",    label: "РЕШЕН" },
};

function Thought({ t, agent }) {
  const m = THOUGHT_META[t.type];
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "auto auto 1fr auto",
      gap: 8, padding: "2px 0",
      fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.5,
      alignItems: "baseline",
    }}>
      <span style={{ color: "var(--text-dim)", fontSize: 10 }}>{t.t}</span>
      <span style={{ color: m.color, fontSize: 9.5, fontWeight: 600, width: 50, letterSpacing: 0.08 }}>
        {m.glyph} {m.label}
      </span>
      <span style={{
        color: t.type === "think" ? "var(--text-mid)" : "var(--text)",
        fontStyle: t.type === "think" ? "italic" : "normal",
      }}>
        {t.msg}
        {t.streaming && <span style={{
          display: "inline-block", width: 6, height: 11, marginLeft: 2,
          background: "var(--accent)",
          animation: "blink 1s steps(2) infinite",
          verticalAlign: "middle",
        }} />}
      </span>
      <span style={{
        fontFamily: "var(--font-mono)", fontSize: 9.5,
        color: t.confidence > 85 ? "var(--green)" : t.confidence > 70 ? "var(--amber)" : "var(--red)",
      }}>{t.confidence}%</span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 * Decision Tree — last decision visualised
 * ────────────────────────────────────────────────────────*/
function DecisionTree({ agent }) {
  // Build a mock decision tree relevant to agent
  const tree = useMemo(() => buildTree(agent), [agent.def.id]);
  return (
    <div style={{
      background: "var(--bg-0)", border: "1px solid var(--line)", borderRadius: 4,
      padding: 14, position: "relative",
    }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.15, fontWeight: 600, marginBottom: 8 }}>
        ПОСЛЕДНЕЕ РЕШЕНИЕ · DECISION PATH
      </div>
      <svg width="100%" height="160" viewBox="0 0 460 160" preserveAspectRatio="xMidYMid meet">
        {/* edges */}
        {tree.edges.map((e, i) => (
          <path key={i}
            d={`M${e.from.x},${e.from.y + 12} Q${e.from.x},${(e.from.y + e.to.y) / 2} ${e.to.x},${e.to.y - 12}`}
            stroke={e.taken ? "var(--accent)" : "var(--line-bright)"}
            strokeWidth={e.taken ? 1.4 : 0.6}
            strokeDasharray={e.taken ? "0" : "3 3"}
            fill="none"
            opacity={e.taken ? 0.9 : 0.4}
          />
        ))}
        {/* nodes */}
        {tree.nodes.map((n, i) => {
          const isFinal = n.type === "final";
          const isTaken = n.taken;
          const c = isFinal ? "var(--green)" : isTaken ? "var(--accent)" : "var(--text-dim)";
          return (
            <g key={i}>
              <rect x={n.x - 70} y={n.y - 12} width={140} height={24}
                fill="var(--bg-2)" stroke={c} strokeWidth={isTaken ? 1.4 : 0.8}
                rx={3}
                opacity={isTaken ? 1 : 0.5}
              />
              <text x={n.x} y={n.y + 4} textAnchor="middle"
                fontFamily="var(--font-mono)" fontSize={9.5} fontWeight={isTaken ? 600 : 400}
                fill={c} letterSpacing="0.04em">
                {n.label}
              </text>
              {n.score && (
                <text x={n.x} y={n.y + 24} textAnchor="middle"
                  fontFamily="var(--font-mono)" fontSize={8.5}
                  fill="var(--text-dim)">
                  conf {n.score}%
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div style={{
        marginTop: 4, padding: "6px 10px",
        background: "oklch(0.78 0.16 155 / 0.08)", border: "1px solid oklch(0.78 0.16 155 / 0.25)",
        borderRadius: 3,
        fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--green)",
      }}>
        ✓ Принято: <span style={{ color: "var(--text-bright)" }}>{tree.finalLabel}</span>
        <span style={{ marginLeft: 12, color: "var(--text-dim)" }}>· confidence {tree.confidence}%</span>
      </div>
    </div>
  );
}

function buildTree(agent) {
  const trees = {
    planner: {
      finalLabel: "Запустить M-2841 с приоритетом HIGH",
      confidence: 89,
      nodes: [
        { x: 230, y: 20, label: "Новая задача?", taken: true },
        { x: 110, y: 75, label: "Уже в очереди", taken: false, score: 23 },
        { x: 350, y: 75, label: "Новая миссия", taken: true, score: 89 },
        { x: 230, y: 140, label: "Запустить", type: "final", taken: true },
      ],
      edges: [
        { from: { x: 230, y: 20 }, to: { x: 110, y: 75 }, taken: false },
        { from: { x: 230, y: 20 }, to: { x: 350, y: 75 }, taken: true },
        { from: { x: 350, y: 75 }, to: { x: 230, y: 140 }, taken: true },
      ],
    },
    strategy: {
      finalLabel: "Открыть LONG · confidence 87%",
      confidence: 87,
      nodes: [
        { x: 230, y: 20, label: "EMA50 cross?", taken: true },
        { x: 110, y: 75, label: "Нет · игнор", taken: false, score: 34 },
        { x: 350, y: 75, label: "Да · проверка RSI", taken: true, score: 92 },
        { x: 230, y: 140, label: "LONG · sig 84%", type: "final", taken: true },
      ],
      edges: [
        { from: { x: 230, y: 20 }, to: { x: 110, y: 75 }, taken: false },
        { from: { x: 230, y: 20 }, to: { x: 350, y: 75 }, taken: true },
        { from: { x: 350, y: 75 }, to: { x: 230, y: 140 }, taken: true },
      ],
    },
    risk: {
      finalLabel: "Risk-on · продолжать",
      confidence: 91,
      nodes: [
        { x: 230, y: 20, label: "Volatility ≤ 3σ?", taken: true },
        { x: 110, y: 75, label: "Risk-off", taken: false, score: 18 },
        { x: 350, y: 75, label: "Дальше · DD < 15%", taken: true, score: 91 },
        { x: 230, y: 140, label: "Risk-on", type: "final", taken: true },
      ],
      edges: [
        { from: { x: 230, y: 20 }, to: { x: 110, y: 75 }, taken: false },
        { from: { x: 230, y: 20 }, to: { x: 350, y: 75 }, taken: true },
        { from: { x: 350, y: 75 }, to: { x: 230, y: 140 }, taken: true },
      ],
    },
  };
  // default
  return trees[agent.def.id] || {
    finalLabel: "Передать дальше по цепочке",
    confidence: 84,
    nodes: [
      { x: 230, y: 20, label: "Условие?", taken: true },
      { x: 110, y: 75, label: "Игнорировать", taken: false, score: 28 },
      { x: 350, y: 75, label: "Обработать", taken: true, score: 84 },
      { x: 230, y: 140, label: "Передать", type: "final", taken: true },
    ],
    edges: [
      { from: { x: 230, y: 20 }, to: { x: 110, y: 75 }, taken: false },
      { from: { x: 230, y: 20 }, to: { x: 350, y: 75 }, taken: true },
      { from: { x: 350, y: 75 }, to: { x: 230, y: 140 }, taken: true },
    ],
  };
}

/* ─────────────────────────────────────────────────────────
 * Performance vs peers — radar / mini bars
 * ────────────────────────────────────────────────────────*/
function PerfVsPeers({ agent, allAgents }) {
  const myAccuracy = 78 + ((agent.def.id.charCodeAt(0) % 18));
  const myLatency = agent.latency;
  const myCost = 2 + ((agent.def.id.charCodeAt(1) % 5));
  const myUptime = 92 + ((agent.def.id.charCodeAt(2) % 7));

  const meanAccuracy = 78;
  const meanLatency = 240;
  const meanCost = 3.4;
  const meanUptime = 94;

  const dims = [
    { label: "ТОЧНОСТЬ",   my: myAccuracy,  mean: meanAccuracy, suffix: "%", best: "high" },
    { label: "СКОРОСТЬ",   my: myLatency,   mean: meanLatency,  suffix: "ms", best: "low" },
    { label: "COST · ЧАС", my: myCost,      mean: meanCost,     suffix: "$", best: "low" },
    { label: "UPTIME",     my: myUptime,    mean: meanUptime,   suffix: "%", best: "high" },
  ];

  return (
    <div style={{ background: "var(--bg-0)", border: "1px solid var(--line)", borderRadius: 4, padding: 12 }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.15, fontWeight: 600, marginBottom: 8 }}>
        VS ОСТАЛЬНАЯ СЕТЬ · средние значения
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {dims.map(d => {
          const better = d.best === "high" ? d.my > d.mean : d.my < d.mean;
          const delta = d.best === "high" ? ((d.my - d.mean) / d.mean) * 100 : ((d.mean - d.my) / d.mean) * 100;
          return (
            <div key={d.label} style={{ display: "grid", gridTemplateColumns: "100px 1fr auto", gap: 8, alignItems: "center" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.06, fontWeight: 600 }}>{d.label}</span>
              <div style={{ position: "relative", height: 14 }}>
                {/* mean tick */}
                <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: 1, background: "var(--text-dim)" }} />
                {/* bar */}
                <div style={{
                  position: "absolute", top: 4, bottom: 4,
                  background: better ? "var(--green)" : "var(--red)",
                  left: better ? "50%" : `${50 - Math.min(40, Math.abs(delta) / 1.5)}%`,
                  width: `${Math.min(40, Math.abs(delta) / 1.5)}%`,
                  borderRadius: 1,
                }} />
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: better ? "var(--green)" : "var(--red)", minWidth: 70, textAlign: "right" }}>
                {d.my}{d.suffix} <span style={{ color: "var(--text-dim)", fontSize: 9 }}>({delta >= 0 ? "+" : ""}{delta.toFixed(0)}%)</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 * Token usage chart
 * ────────────────────────────────────────────────────────*/
function TokenUsage({ agent }) {
  const data = useMemo(() => genSpark(2400 + Math.random() * 1800, 0.18, 24), [agent.def.id]);
  const totalIn = data.reduce((s, x) => s + x, 0);
  const totalOut = totalIn * 0.34;
  const cost = (totalIn / 1000) * 0.0028 + (totalOut / 1000) * 0.0084;
  return (
    <div style={{ background: "var(--bg-0)", border: "1px solid var(--line)", borderRadius: 4, padding: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.15, fontWeight: 600 }}>
          ИСПОЛЬЗОВАНИЕ ТОКЕНОВ · 24Ч
        </div>
        <div className="mono" style={{ fontSize: 10, color: "var(--text-dim)" }}>${cost.toFixed(2)} оператив. затраты</div>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 4 }}>
        <div>
          <div className="mono" style={{ fontSize: 9, color: "var(--text-dim)" }}>INPUT</div>
          <div className="mono" style={{ fontSize: 16, color: "var(--blue)" }}>{Math.floor(totalIn / 1000)}K</div>
        </div>
        <div>
          <div className="mono" style={{ fontSize: 9, color: "var(--text-dim)" }}>OUTPUT</div>
          <div className="mono" style={{ fontSize: 16, color: "var(--accent-2)" }}>{Math.floor(totalOut / 1000)}K</div>
        </div>
        <div style={{ marginLeft: "auto", flex: 1, maxWidth: 240 }}>
          <Bars data={data} width={240} height={36} color="var(--accent)" />
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 * Event subscriptions
 * ────────────────────────────────────────────────────────*/
function EventSubscriptions({ agent }) {
  const subs = {
    planner: ["mission.created", "mission.completed", "agent.idle", "user.command"],
    executor: ["plan.ready", "tool.response", "queue.next"],
    critic: ["output.ready", "verification.request"],
    research: ["query.received", "context.request"],
    news: ["news.ingest.tick", "sentiment.scored"],
    onchain: ["block.new", "whale.transfer", "bridge.event"],
    alert: ["rule.match", "severity.update"],
    forecast: ["model.tick", "data.refresh"],
    strategy: ["price.tick", "indicator.update"],
    risk: ["volatility.update", "exposure.change"],
    memory: ["embedding.save", "graph.update"],
    autofix: ["agent.error", "watchdog.tick"],
  };
  const list = subs[agent.def.id] || ["task.received"];
  return (
    <div style={{ background: "var(--bg-0)", border: "1px solid var(--line)", borderRadius: 4, padding: 12 }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.15, fontWeight: 600, marginBottom: 6 }}>
        ПОДПИСКИ НА СОБЫТИЯ
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {list.map(s => (
          <span key={s} className="chip mono" style={{ fontSize: 10 }}>
            <span style={{ color: "var(--green)", marginRight: 4 }}>●</span>{s}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 * AgentLiveDetail — full panel replacing AgentDetail
 * ────────────────────────────────────────────────────────*/
function AgentLiveDetail({ agent }) {
  if (!agent) return null;
  const spark1 = useMemo(() => genSpark(80, 0.12, 60), [agent.def.id]);
  return (
    <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
      <PanelHeader
        title={`AGENT · ${agent.def.name.toUpperCase()}.AGT`}
        meta={`uptime 47ч 12м · ver 6.2.41`}
        action={<button className="btn btn-accent" style={{ padding: "1px 8px", fontSize: 10 }}>РАЗВЕРНУТЬ ▸</button>}
      />
      <div className="scroll" style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Identity row */}
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{
            width: 48, height: 48, borderRadius: 6,
            background: "var(--bg-0)",
            border: `1.5px solid ${agent.def.color}`,
            color: agent.def.color,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700,
            boxShadow: agent.status === "active" ? `0 0 20px -4px ${agent.def.color}` : "none",
            position: "relative",
          }}>
            {agent.def.glyph}
            {agent.status === "active" && (
              <span style={{
                position: "absolute", top: -3, right: -3,
                width: 8, height: 8, borderRadius: "50%",
                background: "var(--green)",
                boxShadow: "0 0 4px var(--green)",
                animation: "pulse calc(1.6s / var(--speed)) ease-out infinite",
              }} />
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-bright)" }}>{agent.def.ru}</div>
            <div className="mono" style={{ fontSize: 10, color: "var(--text-dim)" }}>
              {agent.def.name.toLowerCase()}.agt · {agent.status === "active" ? "АКТИВЕН" : "ОЖИДАНИЕ"} · tier 2
            </div>
            <div style={{ marginTop: 4, fontSize: 11.5, color: "var(--text-mid)" }}>
              <span className="mono" style={{ color: "var(--accent)" }}>↳ </span>{agent.task}
            </div>
          </div>
          <Ring value={agent.confidence} size={48} stroke={4} color={agent.def.color} label={`${agent.confidence}%`} />
        </div>

        {/* Thinking stream */}
        <div style={{
          background: "var(--bg-0)", border: "1px solid var(--line)", borderRadius: 4,
          height: 200, overflow: "hidden", display: "flex", flexDirection: "column",
        }}>
          <ThinkingStream agent={agent} />
        </div>

        {/* Decision tree */}
        <DecisionTree agent={agent} />

        {/* Two-column grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <PerfVsPeers agent={agent} />
          <TokenUsage agent={agent} />
        </div>

        {/* Subscriptions */}
        <EventSubscriptions agent={agent} />

        {/* Tools */}
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.15, fontWeight: 600, marginBottom: 6 }}>ИНСТРУМЕНТЫ</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {agent.tools.map(t => (
              <span key={t} className="chip chip-accent" style={{ fontSize: 10.5 }}>{t}()</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { AgentLeaderboard, AgentLiveDetail });