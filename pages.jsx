/* pages.jsx — substantial stubs for non-dashboard pages */

/* ─────────────────────────────────────────────────────────
 * Generic page header
 * ────────────────────────────────────────────────────────*/
function PageHeader({ title, sub, actions }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-end", justifyContent: "space-between",
      padding: "0 0 12px 0",
      borderBottom: "1px solid var(--line)",
      marginBottom: "var(--gap)",
    }}>
      <div>
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: 10,
          color: "var(--accent)", letterSpacing: "0.18em",
        }}>{sub}</div>
        <div style={{
          fontFamily: "var(--font-ui)", fontSize: 20, fontWeight: 600,
          color: "var(--text-bright)", letterSpacing: "0.02em",
          marginTop: 2,
        }}>{title}</div>
      </div>
      {actions && <div style={{ display: "flex", gap: 6 }}>{actions}</div>}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════
 *  AGENTS PAGE
 * ════════════════════════════════════════════════════════*/
function AgentsPage({ agents, lang }) {
  const [selected, setSelected] = useState(agents[0]?.def.id);
  const sel = agents.find(a => a.def.id === selected) || agents[0];

  return (
    <div data-screen-label="02 Agents" style={{ height: "100%", padding: "var(--gap)", display: "flex", flexDirection: "column", gap: "var(--gap)", overflow: "hidden" }}>
      <PageHeader title={lang === "en" ? "AGENTS" : "АГЕНТЫ"}
        sub="РЕЕСТР · 12 активных / 14 зарегистрировано"
        actions={
          <>
            <button className="btn">+ Регистрировать</button>
            <button className="btn">Импорт</button>
            <button className="btn btn-accent">Развернуть всё</button>
          </>
        }
      />
      <AgentLeaderboard agents={agents} onSelect={setSelected} />
      <div style={{
        flex: 1,
        display: "grid",
        gridTemplateColumns: "1fr 1.6fr",
        gap: "var(--gap)",
        minHeight: 0,
        overflow: "hidden",
      }}>
        <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
          <PanelHeader title="ROSTER" meta={`${agents.length} agents`} />
          <div className="scroll" style={{ flex: 1, padding: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {agents.map(a => (
              <div key={a.def.id} onClick={() => setSelected(a.def.id)} style={{ cursor: "pointer" }}>
                <AgentCard agent={a} />
              </div>
            ))}
          </div>
        </div>

        <AgentLiveDetail agent={sel} />
      </div>
    </div>
  );
}

function AgentDetail({ agent }) {
  if (!agent) return null;
  const spark1 = useMemo(() => genSpark(80, 0.12, 60), []);
  const spark2 = useMemo(() => genSpark(40, 0.22, 40), []);

  return (
    <div className="panel scroll" style={{ display: "flex", flexDirection: "column", overflow: "auto", minHeight: 0 }}>
      <PanelHeader
        title={`AGENT · ${agent.def.name.toUpperCase()}.AGT`}
        meta={`uptime 47h 12m · ver 6.2.41`}
        action={<button className="btn btn-accent">РАЗВЕРНУТЬ ▸</button>}
      />
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Identity */}
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div style={{
            width: 56, height: 56,
            borderRadius: 6,
            background: "var(--bg-2)",
            border: `1.5px solid ${agent.def.color}`,
            color: agent.def.color,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 600,
            boxShadow: `0 0 24px -6px ${agent.def.color}`,
          }}>{agent.def.glyph}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-bright)" }}>{agent.def.ru}</div>
            <div className="mono" style={{ fontSize: 11, color: "var(--text-dim)" }}>
              {agent.def.name.toUpperCase()}.AGT · id={agent.def.id} · tier 2
            </div>
            <div style={{ marginTop: 4, fontSize: 11.5, color: "var(--text-mid)" }}>
              {agent.task}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <Ring value={agent.confidence} size={52} stroke={4} color={agent.def.color} label={`${agent.confidence}%`} />
            <span className="mono" style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.08 }}>CONFIDENCE</span>
          </div>
        </div>

        {/* Metrics grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          <DetailMetric label="LATENCY" value={agent.latency} unit="ms" data={spark2} />
          <DetailMetric label="TOKENS · 1h" value={Math.floor(agent.confidence * 384)} data={spark1} />
          <DetailMetric label="SUCCESS" value={94.2} unit="%" data={genSpark(90, 0.06, 30)} color="var(--green)" />
          <DetailMetric label="COST · USD" value={4.82} unit="/h" data={genSpark(4, 0.18, 30)} color="var(--amber)" />
        </div>

        {/* Tools */}
        <div>
          <div style={{ fontSize: 10, color: "var(--text-dim)", letterSpacing: "0.15em", marginBottom: 6, fontWeight: 600 }}>ИНСТРУМЕНТЫ</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {agent.tools.map(t => (
              <span key={t} className="chip chip-accent" style={{ fontSize: 10.5 }}>{t}()</span>
            ))}
          </div>
        </div>

        {/* Recent actions */}
        <div>
          <div style={{ fontSize: 10, color: "var(--text-dim)", letterSpacing: "0.15em", marginBottom: 6, fontWeight: 600 }}>ПОСЛЕДНИЕ ДЕЙСТВИЯ</div>
          <div style={{ background: "var(--bg-0)", border: "1px solid var(--line)", borderRadius: 4, padding: 8, fontFamily: "var(--font-mono)", fontSize: 11 }}>
            <ActionLine t="14:22:08" act="tool_call" what="fetch(source='alpha')" status="ok" />
            <ActionLine t="14:22:11" act="thought" what="Низкая уверенность в источнике alpha, запрашиваю beta" status="think" />
            <ActionLine t="14:22:14" act="tool_call" what="fetch(source='beta')" status="ok" />
            <ActionLine t="14:22:18" act="output" what="Кросс-валидация подтвердила гипотезу #14" status="ok" />
            <ActionLine t="14:22:20" act="route" what="→ critic.agt для верификации" status="info" />
            <ActionLine t="14:22:24" act="receive" what="critic.agt: ACK confidence 0.88" status="ok" />
          </div>
        </div>

        {/* Routing */}
        <div>
          <div style={{ fontSize: 10, color: "var(--text-dim)", letterSpacing: "0.15em", marginBottom: 6, fontWeight: 600 }}>МАРШРУТИЗАЦИЯ</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontFamily: "var(--font-mono)", fontSize: 11 }}>
            <span className="chip">planner.agt</span>
            <span style={{ color: "var(--text-dim)" }}>→</span>
            <span className="chip chip-accent">{agent.def.name.toLowerCase()}.agt</span>
            <span style={{ color: "var(--text-dim)" }}>→</span>
            <span className="chip">critic.agt</span>
            <span style={{ color: "var(--text-dim)" }}>→</span>
            <span className="chip">memory.agt</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailMetric({ label, value, unit, data, color }) {
  return (
    <div style={{
      padding: "8px 10px",
      background: "var(--bg-2)", border: "1px solid var(--line)",
      borderRadius: 4,
    }}>
      <div style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.12em", fontWeight: 600 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 4, marginTop: 2 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 17, color: "var(--text-bright)" }}>
          <TickerNumber value={value} decimals={value % 1 ? 1 : 0} />
          {unit && <span style={{ fontSize: 10, color: "var(--text-dim)", marginLeft: 2 }}>{unit}</span>}
        </span>
      </div>
      <div style={{ marginTop: 4 }}>
        <Sparkline data={data} width={140} height={20} color={color || "var(--accent)"} />
      </div>
    </div>
  );
}

function ActionLine({ t, act, what, status }) {
  const sc = {
    ok: "var(--green)", err: "var(--red)", think: "var(--accent-2)",
    info: "var(--accent)", warn: "var(--amber)",
  }[status] || "var(--text-mid)";
  return (
    <div style={{ display: "grid", gridTemplateColumns: "auto auto 1fr", gap: 8, padding: "1px 0" }}>
      <span style={{ color: "var(--text-dim)" }}>{t}</span>
      <span style={{ color: sc, width: 70 }}>{act}</span>
      <span style={{ color: "var(--text)" }}>{what}</span>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════
 *  MISSIONS PAGE
 * ════════════════════════════════════════════════════════*/

const MISSION_DATA = [
  { id: "M-2841", name: "Сканирование whale-кошельков · ETH mainnet", progress: 67, agents: ["OC","RS","RK"], eta: "12m", status: "running", prio: "high", created: "14:08:21" },
  { id: "M-2840", name: "Анализ настроений · L2 ecosystem · 24h", progress: 42, agents: ["NW","FC"], eta: "28m", status: "running", prio: "normal", created: "14:05:12" },
  { id: "M-2839", name: "Backtest стратегии #14 на исторических данных", progress: 91, agents: ["ST","CR"], eta: "3m", status: "running", prio: "normal", created: "13:48:00" },
  { id: "M-2838", name: "Сводный отчёт за смену · 06:00–14:00", progress: 100, agents: ["MM","PL"], eta: "—", status: "done", prio: "low", created: "13:00:00" },
  { id: "M-2837", name: "Реконсиляция векторного индекса embeddings", progress: 23, agents: ["MM","AF"], eta: "44m", status: "running", prio: "low", created: "13:42:10" },
  { id: "M-2836", name: "Мониторинг бридж-контрактов · multi-chain", progress: 55, agents: ["OC","AL"], eta: "ongoing", status: "running", prio: "high", created: "12:00:00" },
  { id: "M-2835", name: "Триангуляция источника новости #2841", progress: 0, agents: ["NW","CR","RS"], eta: "queued", status: "queued", prio: "high", created: "—" },
  { id: "M-2834", name: "Профилирование странного клиента 0xdead…", progress: 100, agents: ["OC","RK"], eta: "—", status: "failed", prio: "high", created: "11:21:08" },
  { id: "M-2833", name: "Ежедневный intelligence brief", progress: 100, agents: ["PL","MM","FC"], eta: "—", status: "done", prio: "normal", created: "06:00:00" },
];

function MissionsPage({ lang }) {
  const [sel, setSel] = useState(MISSION_DATA[0].id);
  const selected = MISSION_DATA.find(m => m.id === sel);
  return (
    <div data-screen-label="03 Missions" style={{ minHeight: "100%", padding: "var(--gap)", display: "flex", flexDirection: "column" }}>
      <PageHeader title={lang === "en" ? "MISSIONS" : "МИССИИ"}
        sub="ОРКЕСТРАЦИЯ · 6 в работе · 1 в очереди · 47 за сутки"
        actions={
          <>
            <button className="btn">Шаблоны</button>
            <button className="btn">Планировщик</button>
            <button className="btn btn-accent" onClick={() => window.__openMissionModal?.()}>+ Новая миссия</button>
          </>
        }
      />
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: "var(--gap)", minHeight: 0, overflow: "hidden" }}>
        {/* Left: list + timeline */}
        <div style={{ display: "grid", gridTemplateRows: "auto 1fr", gap: "var(--gap)", minHeight: 0, overflow: "hidden" }}>
          <MissionStatusBar />
          <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
            <PanelHeader title="ОЧЕРЕДЬ ВЫПОЛНЕНИЯ" meta={`${MISSION_DATA.length} миссий · сортировка: приоритет`} />
            <div style={{
              display: "grid", gridTemplateColumns: "60px 1fr 110px 70px 80px 60px 60px",
              padding: "6px 12px",
              borderBottom: "1px solid var(--line)",
              background: "var(--bg-2)",
              fontFamily: "var(--font-mono)", fontSize: 9,
              color: "var(--text-dim)", letterSpacing: 0.08,
              textTransform: "uppercase",
            }}>
              <span>ID</span><span>НАЗВАНИЕ</span><span>АГЕНТЫ</span><span>ПРИОР.</span><span>ПРОГРЕСС</span><span>ETA</span><span>СТАТУС</span>
            </div>
            <div className="scroll" style={{ flex: 1 }}>
              {MISSION_DATA.map(m => (
                <MissionRowFull key={m.id} m={m} selected={sel === m.id} onClick={() => setSel(m.id)} />
              ))}
            </div>
          </div>
        </div>
        {/* Right: detail */}
        <MissionDetail m={selected} />
      </div>
    </div>
  );
}

function MissionStatusBar() {
  return (
    <div className="panel" style={{ display: "flex" }}>
      <StatusCell label="В РАБОТЕ" value="6" color="var(--green)" />
      <StatusCell label="В ОЧЕРЕДИ" value="1" color="var(--amber)" />
      <StatusCell label="ЗАВЕРШЕНО · 24Ч" value="47" color="var(--accent)" />
      <StatusCell label="СБОЙ · 24Ч" value="2" color="var(--red)" />
      <StatusCell label="СРЕДН. ВРЕМЯ" value="18:32" color="var(--text-bright)" mono />
      <StatusCell label="ПРОПУСКНАЯ СПОС." value="2.6/ч" color="var(--blue)" mono />
    </div>
  );
}

function StatusCell({ label, value, color, mono }) {
  return (
    <div style={{
      flex: 1, padding: "10px 14px",
      borderRight: "1px solid var(--line)",
    }}>
      <div style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.15em", fontWeight: 600 }}>{label}</div>
      <div style={{
        fontFamily: "var(--font-mono)", fontSize: 19, fontWeight: 500,
        color: color || "var(--text-bright)", marginTop: 2,
      }}>{value}</div>
    </div>
  );
}

function MissionRowFull({ m, selected, onClick }) {
  const statusColor = {
    running: "var(--green)", queued: "var(--amber)",
    done: "var(--accent)", failed: "var(--red)",
  }[m.status];
  const prioColor = m.prio === "high" ? "var(--red)" : m.prio === "low" ? "var(--text-dim)" : "var(--amber)";

  return (
    <div onClick={onClick} style={{
      display: "grid", gridTemplateColumns: "60px 1fr 110px 70px 80px 60px 60px",
      gap: 4, alignItems: "center",
      padding: "8px 12px",
      borderBottom: "1px solid var(--line)",
      background: selected ? "var(--accent-soft)" : "transparent",
      cursor: "pointer",
      fontSize: 11.5,
    }}>
      <span className="mono" style={{ fontSize: 10.5, color: "var(--text-dim)" }}>{m.id}</span>
      <span style={{ color: "var(--text-bright)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</span>
      <span style={{ display: "flex", gap: 2 }}>
        {m.agents.map(g => (
          <span key={g} style={{
            fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600,
            color: "var(--accent)", padding: "0 3px",
            border: "1px solid oklch(0.78 0.16 var(--accent-h) / 0.3)",
            borderRadius: 2, background: "var(--accent-soft)",
          }}>{g}</span>
        ))}
      </span>
      <span className="mono" style={{ fontSize: 10, color: prioColor, textTransform: "uppercase", letterSpacing: 0.06 }}>{m.prio}</span>
      <div style={{ position: "relative", height: 4, background: "var(--bg-3)", borderRadius: 1 }}>
        <div style={{ position: "absolute", inset: 0, width: `${m.progress}%`, background: statusColor, borderRadius: 1 }} />
      </div>
      <span className="mono" style={{ fontSize: 10, color: "var(--text-mid)" }}>{m.eta}</span>
      <span className="mono" style={{ fontSize: 9.5, color: statusColor, textTransform: "uppercase" }}>
        {m.status === "running" && <PulseDot size={4} color={statusColor} />}{" "}
        {{ running: "в работе", queued: "очередь", done: "готово", failed: "сбой" }[m.status] || m.status}
      </span>
    </div>
  );
}

function MissionDetail({ m }) {
  if (!m) return null;
  return (
    <div className="panel scroll" style={{ display: "flex", flexDirection: "column", overflow: "auto", minHeight: 0 }}>
      <PanelHeader title={`MISSION · ${m.id}`} meta={m.status.toUpperCase()} />
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <div style={{ fontSize: 15, color: "var(--text-bright)", fontWeight: 500 }}>{m.name}</div>
          <div className="mono" style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 4 }}>
            created {m.created} · priority {m.prio.toUpperCase()} · ETA {m.eta}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.15em", fontWeight: 600, marginBottom: 6 }}>ЦЕЛЬ МИССИИ</div>
          <div style={{ background: "var(--bg-0)", padding: 10, borderRadius: 4, border: "1px solid var(--line)", fontSize: 12, color: "var(--text)", lineHeight: 1.5 }}>
            Идентифицировать активные «китовые» кошельки на ETH mainnet с движениями >10K ETH за 24h, классифицировать по поведению (накопление / распределение / нейтральное), сопоставить с известными сущностями (CEX, mixer, fund).
          </div>
        </div>

        <div>
          <div style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.15em", fontWeight: 600, marginBottom: 6 }}>DEPENDENCY GRAPH</div>
          <DependencyGraph />
        </div>

        <div>
          <div style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.15em", fontWeight: 600, marginBottom: 6 }}>TIMELINE ВЫПОЛНЕНИЯ</div>
          <MiniTimeline />
        </div>

        <div>
          <div style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.15em", fontWeight: 600, marginBottom: 6 }}>ВЫХОДНЫЕ ДАННЫЕ</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-mid)" }}>
            <div>• 247 кошельков идентифицировано</div>
            <div>• 38 классифицированы как whale</div>
            <div>• 12 связаны с известными сущностями</div>
            <div>• 4 требуют ручной верификации</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DependencyGraph() {
  const nodes = [
    { id: "scan",    x: 30,  y: 30, label: "SCAN",     status: "done" },
    { id: "enrich",  x: 130, y: 30, label: "ENRICH",   status: "done" },
    { id: "classify",x: 230, y: 30, label: "CLASSIFY", status: "active" },
    { id: "verify",  x: 230, y: 100,label: "VERIFY",   status: "pending" },
    { id: "report",  x: 330, y: 65, label: "REPORT",   status: "pending" },
  ];
  const edges = [
    ["scan", "enrich"], ["enrich", "classify"],
    ["classify", "verify"], ["classify", "report"], ["verify", "report"],
  ];
  const sc = (s) => ({ done: "var(--green)", active: "var(--accent)", pending: "var(--text-dim)" }[s] || "var(--text-dim)");
  return (
    <svg width="100%" height="140" viewBox="0 0 400 140" style={{ background: "var(--bg-0)", border: "1px solid var(--line)", borderRadius: 4 }}>
      {edges.map(([a, b], i) => {
        const na = nodes.find(n => n.id === a), nb = nodes.find(n => n.id === b);
        return (
          <line key={i} x1={na.x + 30} y1={na.y} x2={nb.x - 30} y2={nb.y}
            stroke={na.status === "done" ? "var(--green)" : "var(--line-bright)"}
            strokeWidth={1} strokeDasharray={na.status === "done" ? "0" : "3 3"} />
        );
      })}
      {nodes.map(n => (
        <g key={n.id}>
          <rect x={n.x - 30} y={n.y - 12} width={60} height={24}
            fill="var(--bg-2)" stroke={sc(n.status)} strokeWidth={1}
            rx={3} />
          <text x={n.x} y={n.y + 4} textAnchor="middle"
            fontFamily="var(--font-mono)" fontSize={9.5} fontWeight={600}
            fill={sc(n.status)} letterSpacing="0.08em">{n.label}</text>
        </g>
      ))}
    </svg>
  );
}

function MiniTimeline() {
  const events = [
    { t: "14:08:21", text: "Миссия создана · planner.agt", c: "info" },
    { t: "14:08:24", text: "Декомпозиция на 5 подзадач", c: "info" },
    { t: "14:09:01", text: "SCAN: запущен (onchain.agt)", c: "ok" },
    { t: "14:14:38", text: "SCAN: завершён · 247 wallets", c: "ok" },
    { t: "14:14:42", text: "ENRICH: запущен (research.agt)", c: "ok" },
    { t: "14:19:11", text: "ENRICH: завершён · метаданные обогащены", c: "ok" },
    { t: "14:19:14", text: "CLASSIFY: в работе (risk.agt)", c: "active" },
  ];
  return (
    <div style={{ position: "relative", paddingLeft: 16 }}>
      <div style={{ position: "absolute", left: 4, top: 4, bottom: 4, width: 1, background: "var(--line-bright)" }} />
      {events.map((e, i) => {
        const c = { ok: "var(--green)", info: "var(--accent)", active: "var(--amber)", err: "var(--red)" }[e.c];
        return (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 8, padding: "3px 0", fontSize: 11 }}>
            <span style={{ position: "absolute", left: 0, width: 9, height: 9, borderRadius: "50%", background: c, boxShadow: e.c === "active" ? `0 0 6px ${c}` : "none", marginTop: 4 }} />
            <span className="mono" style={{ color: "var(--text-dim)", fontSize: 10 }}>{e.t}</span>
            <span style={{ color: "var(--text)" }}>{e.text}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════
 *  MEMORY PAGE
 * ════════════════════════════════════════════════════════*/
function MemoryPage({ lang }) {
  return (
    <div data-screen-label="04 Memory" style={{ minHeight: "100%", padding: "var(--gap)", display: "flex", flexDirection: "column" }}>
      <PageHeader title={lang === "en" ? "MEMORY" : "ПАМЯТЬ"}
        sub="LONG-TERM VECTOR STORE · 2.4M embeddings · 14 indices"
        actions={
          <>
            <button className="btn">Reindex</button>
            <button className="btn">Snapshot</button>
            <button className="btn btn-accent">Запрос</button>
          </>
        }
      />
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1.5fr 1fr", gap: "var(--gap)", minHeight: 0, overflow: "hidden" }}>
        {/* Left: search + entities */}
        <div style={{ display: "grid", gridTemplateRows: "auto 1fr", gap: "var(--gap)", minHeight: 0, overflow: "hidden" }}>
          <div className="panel" style={{ padding: 10 }}>
            <div style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.15em", marginBottom: 6, fontWeight: 600 }}>SEMANTIC SEARCH</div>
            <input placeholder="что искать в памяти..." style={{
              width: "100%", padding: "8px 10px",
              background: "var(--bg-0)", border: "1px solid var(--line-bright)",
              color: "var(--text-bright)", fontFamily: "var(--font-mono)", fontSize: 12,
              outline: "none", borderRadius: 4,
            }} />
            <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
              {["whale", "L2", "exploit", "audit", "bridge", "stablecoin"].map(t => (
                <span key={t} className="chip">#{t}</span>
              ))}
            </div>
          </div>
          <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
            <PanelHeader title="ENTITIES" meta="847 объектов" />
            <div className="scroll" style={{ flex: 1 }}>
              {[
                { type: "WALLET", name: "0x7a2c…ef91", c: 124 },
                { type: "ORG",    name: "Alameda Research", c: 89 },
                { type: "EVENT",  name: "L2 Rollup launch · 14.05", c: 67 },
                { type: "PROTO",  name: "Aave v3", c: 54 },
                { type: "NEWS",   name: "Регулятор США · хедлайн 12.03", c: 41 },
                { type: "TOKEN",  name: "USDC stablecoin", c: 38 },
                { type: "WALLET", name: "0xdead…beef", c: 31 },
                { type: "REPORT", name: "Шифт стратегии #14", c: 28 },
              ].map((e, i) => <EntityRow key={i} e={e} />)}
            </div>
          </div>
        </div>

        {/* Center: graph */}
        <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
          <PanelHeader title="KNOWLEDGE GRAPH" meta="2 hops · 124 nodes" />
          <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <MemoryGraph />
          </div>
        </div>

        {/* Right: embedding heatmap + timeline */}
        <div style={{ display: "grid", gridTemplateRows: "1fr 1fr", gap: "var(--gap)", minHeight: 0, overflow: "hidden" }}>
          <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
            <PanelHeader title="EMBEDDING HEATMAP" meta="cluster #14 · dims 0-191" />
            <div className="scroll" style={{ flex: 1, padding: 10 }}>
              <Heatmap cols={16} rows={12} cell={14} seed={1} />
              <div style={{ marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
                density · cosine similarity baseline 0.84
              </div>
            </div>
          </div>
          <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
            <PanelHeader title="TIMELINE ВОСПОМИНАНИЙ" meta="last 24h · 47 events" />
            <div className="scroll" style={{ flex: 1, padding: 10 }}>
              <MiniTimeline />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EntityRow({ e }) {
  const typeColor = { WALLET: "var(--blue)", ORG: "var(--accent-2)", EVENT: "var(--accent)", PROTO: "var(--green)", NEWS: "var(--amber)", TOKEN: "var(--accent)", REPORT: "var(--text-mid)" }[e.type] || "var(--text-mid)";
  return (
    <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 8, padding: "6px 12px", borderBottom: "1px solid var(--line)", fontSize: 11, alignItems: "center" }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600, color: typeColor, padding: "1px 4px", border: `1px solid ${typeColor}`, borderRadius: 2, letterSpacing: 0.08 }}>{e.type}</span>
      <span style={{ color: "var(--text-bright)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</span>
      <span className="mono" style={{ color: "var(--text-dim)", fontSize: 10 }}>{e.c} refs</span>
    </div>
  );
}

function MemoryGraph() {
  const cx = 200, cy = 160;
  const nodes = [
    { id: "0", x: cx, y: cy, label: "0x7a2c", r: 14, c: "var(--accent)" },
    { id: "1", x: cx - 110, y: cy - 70, label: "CEX-A", r: 10, c: "var(--blue)" },
    { id: "2", x: cx + 100, y: cy - 90, label: "EVT-14", r: 10, c: "var(--accent-2)" },
    { id: "3", x: cx + 130, y: cy + 30, label: "0xdead", r: 9, c: "var(--red)" },
    { id: "4", x: cx - 80, y: cy + 80, label: "USDC", r: 9, c: "var(--green)" },
    { id: "5", x: cx + 50, y: cy + 110, label: "NEWS-21", r: 9, c: "var(--amber)" },
    { id: "6", x: cx - 150, y: cy + 30, label: "Aave", r: 8, c: "var(--green)" },
    { id: "7", x: cx - 30, y: cy - 110, label: "0x91a4", r: 8, c: "var(--blue)" },
  ];
  const edges = [["0","1"],["0","2"],["0","3"],["0","4"],["0","5"],["0","6"],["0","7"],["1","6"],["2","5"],["3","5"]];
  return (
    <svg width="100%" height="100%" viewBox="0 0 400 320">
      {edges.map(([a,b],i) => {
        const na = nodes.find(n => n.id === a), nb = nodes.find(n => n.id === b);
        return <line key={i} x1={na.x} y1={na.y} x2={nb.x} y2={nb.y}
          stroke="var(--line-bright)" strokeWidth={0.6} opacity={0.6} />;
      })}
      {nodes.map(n => (
        <g key={n.id}>
          <circle cx={n.x} cy={n.y} r={n.r + 4} fill={n.c} opacity={0.1} />
          <circle cx={n.x} cy={n.y} r={n.r} fill="var(--bg-2)" stroke={n.c} strokeWidth={1.2} />
          <text x={n.x} y={n.y + 3} textAnchor="middle"
            fontFamily="var(--font-mono)" fontSize={9} fontWeight={600}
            fill="var(--text-bright)">{n.label}</text>
        </g>
      ))}
    </svg>
  );
}

/* ═════════════════════════════════════════════════════════
 *  ANALYTICS PAGE
 * ════════════════════════════════════════════════════════*/
function AnalyticsPage({ lang }) {
  const data1 = useMemo(() => genSpark(2400, 0.06, 80), []);
  const data2 = useMemo(() => genSpark(0.6, 0.18, 60), []);
  const data3 = useMemo(() => genSpark(12, 0.22, 40), []);

  return (
    <div data-screen-label="05 Analytics" style={{ minHeight: "100%", padding: "var(--gap)", display: "flex", flexDirection: "column" }}>
      <PageHeader title={lang === "en" ? "ANALYTICS" : "АНАЛИТИКА"}
        sub="INSTITUTIONAL TERMINAL · multi-source · realtime"
        actions={
          <>
            <button className="btn">1h</button>
            <button className="btn btn-accent">24h</button>
            <button className="btn">7d</button>
            <button className="btn">30d</button>
            <button className="btn">Экспорт</button>
          </>
        }
      />
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1.6fr 1fr", gridTemplateRows: "1fr 1fr", gap: "var(--gap)", minHeight: 0, overflow: "hidden" }}>
        <div className="panel" style={{ gridRow: "1 / 3", display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
          <PanelHeader title="ОСНОВНОЙ ИНДИКАТОР · v6.composite-index" meta="bid 2 408.42 · ask 2 408.51" action={
            <span className="mono" style={{ fontSize: 10, color: "var(--green)" }}>● +1.84%</span>
          } />
          <div style={{ flex: 1, padding: 14, display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 36, color: "var(--text-bright)", fontWeight: 300 }}>
                <TickerNumber value={2408.42} decimals={2} />
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--green)" }}>+43.62 (+1.84%)</span>
              <span className="mono" style={{ marginLeft: "auto", fontSize: 10, color: "var(--text-dim)" }}>UPDATED · 14:23:08 UTC</span>
            </div>
            <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
              <AreaChart data={data1} width={700} height={300} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, paddingTop: 8, borderTop: "1px solid var(--line)" }}>
              <Stat label="OPEN" v="2 364.80" />
              <Stat label="HIGH" v="2 421.18" c="var(--green)" />
              <Stat label="LOW" v="2 359.04" c="var(--red)" />
              <Stat label="VOL · 24h" v="14.2B$" />
              <Stat label="VOLATILITY" v="2.4σ" c="var(--amber)" />
              <Stat label="AI CONF" v="87%" c="var(--accent)" />
            </div>
          </div>
        </div>

        <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
          <PanelHeader title="SENTIMENT · ROLLING 24h" meta="news + social + agent" />
          <div style={{ flex: 1, padding: 10, position: "relative", minHeight: 0 }}>
            <AreaChart data={data2} width={400} height={140} color="var(--accent-2)" />
          </div>
        </div>

        <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
          <PanelHeader title="ANOMALY DETECTION" meta="6 detected · last 1h" />
          <div style={{ flex: 1, padding: 10, position: "relative", minHeight: 0 }}>
            <AreaChart data={data3} width={400} height={140} color="var(--red)" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, v, c }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.15em", fontWeight: 600 }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: c || "var(--text-bright)", marginTop: 2 }}>{v}</div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════
 *  WATCHLIST PAGE
 * ════════════════════════════════════════════════════════*/

/* ETH entries carry a real public address (`eth`) so a set ETHERSCAN_API_KEY
 * fetches genuine on-chain balance/txs; non-ETH nets stay simulated. */
const WATCH_DATA = [
  { addr: "0x7a2c...ef91", name: "Whale-04",          net: "ETH",  eth: "0xF977814e90dA44bFA03b6295A0616a897441aceC", last: "2m ago",  risk: 24, flow: "+128.4 ETH",  status: "track" },
  { addr: "0xdead...beef", name: "Suspect · mixer",   net: "ETH",  eth: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", last: "now",     risk: 92, flow: "−4 200 USDT", status: "flag" },
  { addr: "TKf3W...P9aR",  name: "CEX hot wallet",    net: "TRON", last: "8m ago",  risk: 12, flow: "+1.2M USDT",  status: "track" },
  { addr: "0xab12...0042", name: "Fund · alpha",      net: "ETH",  eth: "0x2910543Af39abA0Cd09dBb2D50200b3E800A63D2", last: "1h ago",  risk: 35, flow: "−812 ETH",    status: "track" },
  { addr: "5Hd9...Kpw2",   name: "Validator-A",       net: "DOT",  last: "12m ago", risk: 8,  flow: "+0",          status: "track" },
  { addr: "bc1q...l8mk",   name: "Cold storage",      net: "BTC",  last: "2d ago",  risk: 4,  flow: "+0",          status: "track" },
  { addr: "0x91a4...4f02", name: "Unknown · cluster", net: "ETH",  eth: "0x28C6c06298d514Db089934071355E5743bf21d60", last: "now",     risk: 67, flow: "+248 ETH",    status: "watch" },
  { addr: "0xcc88...b001", name: "Bridge · L2",       net: "ETH",  eth: "0x21a31Ee1afC51d94C2eFcCAa2092aD1028285549", last: "4m ago",  risk: 18, flow: "+8.4M USDC",  status: "track" },
  { addr: "TKL2...M3kp",   name: "Suspect · phishing",net: "TRON", last: "15m ago", risk: 88, flow: "+12 800 USDT",status: "flag" },
  { addr: "0xfe44...aa01", name: "Treasury · proto",  net: "ETH",  eth: "0xDFd5293D8e347dFe59E90eFd55b2956a1343963d", last: "1d ago",  risk: 6,  flow: "+0",          status: "track" },
];

function WatchlistPage({ lang }) {
  const [selected, setSelected] = useState(null);
  return (
    <div data-screen-label="06 Watchlist" style={{ minHeight: "100%", padding: "var(--gap)", display: "flex", flexDirection: "column" }}>
      <PageHeader title="WATCHLIST"
        sub={`РЫНОК · Bybit live · ${WATCHLIST_COINS.length} активов · КОШЕЛЬКИ · ${WATCH_DATA.length} entities · 3 flagged`}
        actions={
          <>
            <button className="btn">Импорт CSV</button>
            <button className="btn">Теги</button>
            <button className="btn btn-accent">+ Добавить</button>
          </>
        }
      />
      <div style={{ flex: 1, display: "grid", gridTemplateRows: "1.1fr 0.9fr", gap: "var(--gap)", minHeight: 0, overflow: "hidden" }}>
        {/* Live market prices from Bybit */}
        <MarketWatchlist />

        {/* On-chain wallet monitor */}
        <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
          <PanelHeader title="КОШЕЛЬКИ · МОНИТОРИНГ" meta={`${WATCH_DATA.length} entities · on-chain`} />
          <div style={{ display: "grid", gridTemplateColumns: "180px 1.4fr 70px 110px 60px 140px 90px",
            padding: "8px 14px", borderBottom: "1px solid var(--line)", background: "var(--bg-2)",
            fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.08, textTransform: "uppercase",
          }}>
            <span>АДРЕС</span><span>НАЗВАНИЕ</span><span>СЕТЬ</span><span>АКТИВНОСТЬ</span><span>RISK</span><span>NET FLOW</span><span>СТАТУС</span>
          </div>
          <div className="scroll" style={{ flex: 1 }}>
            {WATCH_DATA.map((w) => <WatchRow key={w.addr} w={w} onClick={() => setSelected(w)} />)}
          </div>
        </div>
      </div>

      <Drawer open={!!selected} onClose={() => setSelected(null)} width={580}>
        {selected && <WalletDetail wallet={selected} onClose={() => setSelected(null)} />}
      </Drawer>
    </div>
  );
}

function WatchRow({ w, onClick }) {
  const sColor = w.status === "flag" ? "var(--red)" : w.status === "watch" ? "var(--amber)" : "var(--green)";
  const riskColor = w.risk > 70 ? "var(--red)" : w.risk > 40 ? "var(--amber)" : "var(--green)";
  const flowPositive = w.flow.startsWith("+");
  const flowZero = w.flow === "+0";
  return (
    <div onClick={onClick} style={{
      display: "grid", gridTemplateColumns: "180px 1.4fr 70px 110px 60px 140px 90px",
      alignItems: "center",
      padding: "8px 14px", borderBottom: "1px solid var(--line)",
      fontSize: 11.5,
      cursor: "pointer",
      transition: "background 0.12s",
    }}
    onMouseEnter={e => e.currentTarget.style.background = "var(--bg-2)"}
    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >
      <span className="mono" style={{ fontSize: 10.5, color: "var(--text)" }}>{w.addr}</span>
      <span style={{ color: "var(--text-bright)" }}>{w.name}</span>
      <span className="chip" style={{ width: "fit-content", fontSize: 9.5 }}>{w.net}</span>
      <span className="mono" style={{ fontSize: 10, color: "var(--text-mid)" }}>
        {w.last === "now" && <PulseDot size={4} color="var(--green)" />} {w.last}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 32, height: 4, background: "var(--bg-3)", borderRadius: 1, overflow: "hidden" }}>
          <div style={{ width: `${w.risk}%`, height: "100%", background: riskColor }} />
        </div>
        <span className="mono" style={{ fontSize: 10, color: riskColor, minWidth: 18 }}>{w.risk}</span>
      </div>
      <span className="mono" style={{ fontSize: 10.5, color: flowZero ? "var(--text-dim)" : flowPositive ? "var(--green)" : "var(--red)" }}>{w.flow}</span>
      <span style={{
        fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600, letterSpacing: 0.08,
        color: sColor, padding: "1px 5px", border: `1px solid ${sColor}`, borderRadius: 2,
        textTransform: "uppercase", width: "fit-content",
      }}>
        {{ flag: "ФЛАГ", watch: "НАБЛ", track: "ТРЕК" }[w.status] || w.status}
      </span>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════
 *  ALERTS PAGE
 * ════════════════════════════════════════════════════════*/
function AlertsPage({ lang }) {
  return (
    <div data-screen-label="07 Alerts" style={{ minHeight: "100%", padding: "var(--gap)", display: "flex", flexDirection: "column" }}>
      <PageHeader title={lang === "en" ? "ALERTS" : "АЛЕРТЫ"}
        sub="ЦЕНТР УВЕДОМЛЕНИЙ · realtime · severity ≥ INFO · правила·источники"
        actions={
          <>
            <button className="btn">Mute all</button>
            <button className="btn">Telegram <span style={{ color: "var(--green)" }}>●</span></button>
            <button className="btn btn-accent">+ Правило</button>
          </>
        }
      />
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "var(--gap)", minHeight: 0, overflow: "hidden" }}>
        <AlertsTicker lang={lang} />
        <AlertRulesPanel lang={lang} />
      </div>
      <div style={{ marginTop: "var(--gap)", flexShrink: 0, height: 240 }}>
        <div className="panel scroll" style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "auto", minHeight: 0 }}>
          <PanelHeader title="AI EXPLANATION" meta="last alert · severity CRIT" />
          <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.55 }}>
              <span className="chip chip-red">КРИТ</span>{" "}
              Зафиксировано аномальное движение средств: <span className="mono accent">12 800 ETH</span> из кошелька-«кита» <span className="mono">0x7a2c…ef91</span> в адрес <span className="mono">0x9b4f…</span>, идентифицированный как горячий кошелёк биржи.
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn">Подтвердить</button>
              <button className="btn">Отложить 15м</button>
              <button className="btn btn-accent">Эскалировать ▸</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════
 *  REPORTS PAGE
 * ════════════════════════════════════════════════════════*/
const REPORTS = [
  { id: "R-2105", title: "Ежедневная разведсводка · 24.05.2026", time: "06:00", agent: "PL+MM+FC", status: "ready" },
  { id: "R-2104", title: "Inflow/outflow analysis · L2 ecosystem", time: "23.05 18:30", agent: "OC+FC", status: "ready" },
  { id: "R-2103", title: "Watchlist · weekly summary", time: "23.05 09:00", agent: "MM+RK", status: "ready" },
  { id: "R-2102", title: "Sentiment shift · breaking news cluster #14", time: "22.05 22:14", agent: "NW+CR", status: "ready" },
  { id: "R-2101", title: "Backtest report · strategy v6.2", time: "22.05 12:00", agent: "ST+CR", status: "ready" },
];

function ReportsPage({ lang }) {
  return (
    <div data-screen-label="08 Reports" style={{ minHeight: "100%", padding: "var(--gap)", display: "flex", flexDirection: "column" }}>
      <PageHeader title={lang === "en" ? "REPORTS" : "ОТЧЁТЫ"}
        sub="INTELLIGENCE BRIEFS · AI-generated · 47 за 7d"
        actions={
          <>
            <button className="btn">PDF</button>
            <button className="btn">Markdown</button>
            <button className="btn btn-accent">+ Создать</button>
          </>
        }
      />
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "0.9fr 1.4fr", gap: "var(--gap)", minHeight: 0, overflow: "hidden" }}>
        <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
          <PanelHeader title="ОТЧЁТЫ" meta={`${REPORTS.length} последних · auto-generated`} />
          <div className="scroll" style={{ flex: 1 }}>
            {REPORTS.map(r => (
              <div key={r.id} style={{
                padding: "10px 14px", borderBottom: "1px solid var(--line)",
                cursor: "pointer",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="mono" style={{ fontSize: 10, color: "var(--text-dim)" }}>{r.id}</span>
                  <span style={{ fontSize: 12, color: "var(--text-bright)", flex: 1 }}>{r.title}</span>
                  <span className="chip chip-green">ГОТОВ</span>
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 4, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
                  <span>{r.time}</span><span>·</span><span>{r.agent}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="panel scroll" style={{ display: "flex", flexDirection: "column", overflow: "auto", minHeight: 0 }}>
          <PanelHeader title="R-2105 · ЕЖЕДНЕВНАЯ РАЗВЕДСВОДКА" meta="confidential · tier 2" action={
            <span style={{ display: "flex", gap: 4 }}>
              <button className="btn">PDF</button>
              <button className="btn">MD</button>
            </span>
          } />
          <div style={{ padding: "18px 22px", maxWidth: 720, fontSize: 13, lineHeight: 1.65, color: "var(--text)" }}>
            <div style={{ fontSize: 9.5, color: "var(--accent)", letterSpacing: "0.2em", marginBottom: 4 }}>INTELLIGENCE BRIEF · CLASSIFICATION T2</div>
            <h2 style={{ margin: "0 0 4px", fontSize: 20, color: "var(--text-bright)", fontWeight: 500, letterSpacing: 0.01 }}>Ежедневная разведсводка · 24 мая 2026</h2>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--text-dim)" }}>Auto-generated · planner.agt + memory.agt + forecast.agt · 06:00 UTC</div>

            <h3 style={{ marginTop: 22, marginBottom: 6, fontSize: 11, color: "var(--text-dim)", letterSpacing: "0.18em", fontWeight: 600 }}>EXECUTIVE SUMMARY</h3>
            <p style={{ margin: 0 }}>
              За отчётный период (24h) система зарегистрировала <span className="accent mono">847</span> событий, из которых <span className="amber mono">38</span> отнесены к категории «high-impact». Ключевая активность сосредоточена в L2-экосистеме: фиксируется устойчивый приток ликвидности (<span className="green mono">+18.4M$ net</span>), сопровождаемый умеренным сдвигом сентимента (<span className="green mono">+0.12σ</span>).
            </p>

            <h3 style={{ marginTop: 22, marginBottom: 6, fontSize: 11, color: "var(--text-dim)", letterSpacing: "0.18em", fontWeight: 600 }}>KEY FINDINGS</h3>
            <ul style={{ paddingLeft: 18, margin: 0 }}>
              <li><strong>Whale activity</strong> — 12 кошельков с движениями >5K ETH; 4 классифицированы как новые игроки в кластере.</li>
              <li><strong>Bridge flows</strong> — мост Arbitrum → L1 показал нетипичный паттерн в 03:42 UTC; требуется ручная верификация.</li>
              <li><strong>Sentiment</strong> — новостной фон позитивен; драйвер — анонс mainnet-запуска rollup-проекта.</li>
              <li><strong>Risk</strong> — отмечен 1 кошелёк с признаками связи с известным mixer (confidence 91%).</li>
            </ul>

            <h3 style={{ marginTop: 22, marginBottom: 6, fontSize: 11, color: "var(--text-dim)", letterSpacing: "0.18em", fontWeight: 600 }}>ВЫВОДЫ</h3>
            <p style={{ margin: 0 }}>
              Модель v6.2 присваивает базовому сценарию (плавный рост активности в L2) вероятность <span className="accent mono">87%</span>. Альтернативные сценарии (резкий шифт ликвидности обратно в L1) оцениваются ниже порога эскалации.
            </p>

            <div style={{ marginTop: 24, padding: 10, background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 4, fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-dim)" }}>
              hash · 0x4f2a…91be · signed by planner.agt:7a · v6.2.41
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════
 *  SETTINGS PAGE
 * ════════════════════════════════════════════════════════*/
/* ── API keys: persisted in this browser's localStorage (client-side only) ── */
const API_KEYS_LS = "vael.apiKeys";
const API_KEY_DEFS = [
  { name: "COINGECKO_API_KEY",  hint: "рыночные данные · read-only",        safe: true },
  { name: "ETHERSCAN_API_KEY",  hint: "on-chain данные кошельков · read-only", safe: true },
  { name: "CRYPTOPANIC_API_KEY",hint: "новостной поток · read-only",        safe: true },
  { name: "ANTHROPIC_API_KEY",  hint: "LLM для ассистента · секрет",        safe: false },
  { name: "BYBIT_API_KEY",      hint: "приватный API Bybit · нужен бэкенд",  safe: false },
  { name: "BYBIT_API_SECRET",   hint: "секрет Bybit · НЕ храните в браузере", safe: false },
  { name: "TELEGRAM_BOT_TOKEN", hint: "бот для алертов · секрет",           safe: false },
];
function loadApiKeys() { try { return JSON.parse(localStorage.getItem(API_KEYS_LS) || "{}"); } catch (_) { return {}; } }
function saveApiKeys(obj) { try { localStorage.setItem(API_KEYS_LS, JSON.stringify(obj)); } catch (_) {} window.__apiKeys = obj; }
function getApiKey(name) { const k = loadApiKeys(); return (k && k[name]) || ""; }
window.__apiKeys = loadApiKeys();
Object.assign(window, { getApiKey, loadApiKeys });

function ApiKeyRow({ def, value, show, onChange, onToggle }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "230px 1fr auto", gap: 8, padding: "6px 14px", borderBottom: "1px solid var(--line)", alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span className="mono" style={{ fontSize: 11, color: "var(--text-mid)", display: "flex", alignItems: "center", gap: 5 }}>
          {def.name}{!def.safe && <span style={{ color: "var(--amber)" }} title="секретный ключ — виден на клиенте в браузерной сборке">⚠</span>}
        </span>
        <span style={{ fontSize: 9, color: "var(--text-dim)" }}>{def.hint}</span>
      </div>
      <input type={show ? "text" : "password"} value={value}
        onChange={e => onChange(e.target.value)} placeholder="не задан"
        spellCheck={false} autoComplete="off"
        style={{ background: "var(--bg-0)", border: "1px solid var(--line)", color: "var(--text-bright)", fontFamily: "var(--font-mono)", fontSize: 11, padding: "5px 8px", borderRadius: 3, outline: "none", width: "100%" }} />
      <button onClick={onToggle} title={show ? "скрыть" : "показать"} style={{
        background: "var(--bg-2)", border: "1px solid var(--line)", color: "var(--text-dim)",
        borderRadius: 3, cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 12, padding: "3px 9px",
      }}>{show ? "◉" : "○"}</button>
    </div>
  );
}

function ApiKeysCard() {
  const [keys, setKeys] = useState(() => loadApiKeys());
  const [revealed, setRevealed] = useState({});
  const [dirty, setDirty] = useState(false);
  const setCount = API_KEY_DEFS.filter(d => (keys[d.name] || "").trim()).length;

  function set(name, val) { setKeys(prev => ({ ...prev, [name]: val })); setDirty(true); }
  function save() {
    const cleaned = {};
    Object.keys(keys).forEach(k => { if ((keys[k] || "").trim()) cleaned[k] = keys[k].trim(); });
    saveApiKeys(cleaned);
    setKeys(cleaned);
    setDirty(false);
    window.__emitToast?.({ kind: "win", title: "API-ключи сохранены", body: "Хранятся локально в этом браузере (localStorage), на сервер не отправляются." });
  }

  return (
    <div className="panel" style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column" }}>
      <PanelHeader title="API-КЛЮЧИ" meta={`${setCount}/${API_KEY_DEFS.length} заданы · localStorage`}
        action={<button className="btn btn-accent" onClick={save} disabled={!dirty}
          style={{ padding: "1px 10px", fontSize: 10, opacity: dirty ? 1 : 0.5 }}>{dirty ? "Сохранить" : "Сохранено"}</button>} />
      <div style={{ padding: "4px 0" }}>
        {API_KEY_DEFS.map(def => (
          <ApiKeyRow key={def.name} def={def} value={keys[def.name] || ""} show={!!revealed[def.name]}
            onChange={v => set(def.name, v)}
            onToggle={() => setRevealed(r => ({ ...r, [def.name]: !r[def.name] }))} />
        ))}
      </div>
      <div style={{ padding: "9px 14px", borderTop: "1px solid var(--line)", fontSize: 10.5, color: "var(--text-dim)", lineHeight: 1.55, display: "flex", gap: 8 }}>
        <span style={{ color: "var(--amber)", flexShrink: 0 }}>⚠</span>
        <span>Ключи хранятся только в этом браузере и не уходят на сервер. <b style={{ color: "var(--green)" }}>Безопасно</b> держать read-only ключи (CoinGecko, Etherscan, CryptoPanic). <b style={{ color: "var(--amber)" }}>Секретные/торговые</b> (Bybit secret, Anthropic, Telegram) в браузерной сборке видны на клиенте — для них нужен серверный прокси.</span>
      </div>
    </div>
  );
}

function SettingsPage({ lang }) {
  return (
    <div data-screen-label="09 Settings" style={{ minHeight: "100%", padding: "var(--gap)", display: "flex", flexDirection: "column" }}>
      <PageHeader title={lang === "en" ? "SETTINGS" : "НАСТРОЙКИ"}
        sub="API-КЛЮЧИ · РАЗДЕЛЫ СИСТЕМЫ"
      />
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "var(--gap)", alignItems: "start" }}>
        <ApiKeysCard />
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
          <BudgetCard />
          <SystemSectionsCard />
        </div>
      </div>
    </div>
  );
}

/* Trading capital — the single source of truth for every position size the
 * system suggests (margin = budget·risk% / (leverage · stop-distance)). */
const BUDGET_LS_KEY = "vael.budget";
function BudgetCard() {
  const [budget, setBudget] = useState(() => {
    try { return +localStorage.getItem(BUDGET_LS_KEY) || 10000; } catch (_) { return 10000; }
  });
  const [risk, setRisk] = useState(2);

  function apply(v) {
    const b = Math.max(100, Math.round(v || 0));
    setBudget(b);
    try { localStorage.setItem(BUDGET_LS_KEY, String(b)); } catch (_) {}
    window.dispatchEvent(new CustomEvent("vael:budget"));   // terminal picks it up live
  }

  return (
    <div className="panel" style={{ display: "flex", flexDirection: "column" }}>
      <PanelHeader title="ТОРГОВЫЙ БЮДЖЕТ" meta="от него считаются все размеры позиций" />
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 8, alignItems: "center", fontSize: 12 }}>
          <span style={{ color: "var(--text-dim)" }}>Капитал</span>
          <input type="number" value={budget} onChange={e => apply(+e.target.value)}
            style={{
              background: "var(--bg-0)", border: "1px solid var(--line-bright)",
              color: "var(--text-bright)", padding: "7px 10px",
              fontFamily: "var(--font-mono)", fontSize: 15, outline: "none", borderRadius: 3, textAlign: "right",
            }} />
          <span className="mono" style={{ color: "var(--text-dim)" }}>USDT</span>
        </div>

        <div style={{ display: "flex", gap: 4 }}>
          {[1000, 5000, 10000, 50000].map(v => (
            <button key={v} onClick={() => apply(v)} style={{
              flex: 1, padding: "4px 6px", borderRadius: 3, cursor: "pointer",
              fontFamily: "var(--font-mono)", fontSize: 10.5,
              background: budget === v ? "var(--accent-soft)" : "var(--bg-2)",
              color: budget === v ? "var(--accent)" : "var(--text-dim)",
              border: `1px solid ${budget === v ? "oklch(0.74 0.075 var(--accent-h) / 0.4)" : "var(--line)"}`,
            }}>${(v / 1000)}K</button>
          ))}
        </div>

        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 10, display: "flex", flexDirection: "column", gap: 5, fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-dim)" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>риск на сделку ({risk}%)</span>
            <span style={{ color: "var(--red)" }}>${Math.round(budget * risk / 100).toLocaleString("en-US")}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>макс. маржа в одну позицию (50%)</span>
            <span style={{ color: "var(--text-bright)" }}>${Math.round(budget * 0.5).toLocaleString("en-US")}</span>
          </div>
        </div>

        <div style={{ fontSize: 10.5, color: "var(--text-mid)", lineHeight: 1.5 }}>
          <span className="accent">↳ </span>Кнопка «найти точку входа» подбирает стратегию, рекомендует плечо и считает маржу так, чтобы срабатывание стопа стоило ровно {risk}% капитала.
        </div>
      </div>
    </div>
  );
}

/* Secondary screens live here now — the main sidebar stays focused on trading. */
const SYSTEM_SECTIONS = [
  { id: "agents",    glyph: "⬢", ru: "Агенты",      desc: "сетка агентов, статусы, нагрузка" },
  { id: "missions",  glyph: "▶", ru: "Миссии",      desc: "очередь задач и прогресс выполнения" },
  { id: "scenarios", glyph: "⟁", ru: "Сценарии",    desc: "what-if лаборатория рыночных событий" },
  { id: "memory",    glyph: "❖", ru: "Память",      desc: "векторный индекс и граф связей" },
  { id: "smart",     glyph: "♕", ru: "Smart Money", desc: "топ-кошельки и копи-трейдинг" },
];

function SystemSectionsCard() {
  return (
    <div className="panel" style={{ display: "flex", flexDirection: "column" }}>
      <PanelHeader title="РАЗДЕЛЫ СИСТЕМЫ" meta="вынесены из основного меню" />
      <div style={{ padding: "6px 0" }}>
        {SYSTEM_SECTIONS.map(s => (
          <button key={s.id} onClick={() => window.__navTo?.(s.id)} style={{
            width: "100%", display: "grid", gridTemplateColumns: "26px 1fr auto",
            gap: 10, alignItems: "center", padding: "9px 14px",
            background: "transparent", border: "none", borderBottom: "1px solid var(--line)",
            cursor: "pointer", textAlign: "left",
          }}>
            <span style={{
              width: 22, height: 22, borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center",
              background: "var(--bg-0)", border: "1px solid var(--line-bright)", color: "var(--accent)",
              fontFamily: "var(--font-mono)", fontSize: 11,
            }}>{s.glyph}</span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 12, color: "var(--text-bright)", fontWeight: 500 }}>{s.ru}</span>
              <span style={{ display: "block", fontSize: 10.5, color: "var(--text-dim)", marginTop: 1 }}>{s.desc}</span>
            </span>
            <span style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 12 }}>›</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SettingsCard({ title, children }) {
  return (
    <div className="panel" style={{ display: "flex", flexDirection: "column" }}>
      <PanelHeader title={title} />
      <div style={{ padding: "4px 0" }}>{children}</div>
    </div>
  );
}

function KvRow({ k, v, status }) {
  const sc = { ok: "var(--green)", warn: "var(--amber)", err: "var(--red)" }[status] || "var(--text-dim)";
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr auto", gap: 8, padding: "6px 14px", borderBottom: "1px solid var(--line)", alignItems: "center", fontSize: 11.5 }}>
      <span className="mono" style={{ color: "var(--text-mid)" }}>{k}</span>
      <span className="mono" style={{ color: "var(--text-bright)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>
      {status && <span style={{ color: sc, fontSize: 10 }}>●</span>}
    </div>
  );
}

/* Export */
Object.assign(window, {
  AgentsPage, MissionsPage, MemoryPage, AnalyticsPage,
  WatchlistPage, AlertsPage, ReportsPage, SettingsPage,
  PageHeader,
});