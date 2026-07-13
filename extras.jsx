/* extras.jsx — Command Palette, Mission Modal, Candlestick chart, Order book */

/* ═════════════════════════════════════════════════════════
 *  COMMAND PALETTE  (⌘K / Ctrl+K)
 * ════════════════════════════════════════════════════════*/

function buildCommands(onNav, openMissionModal, lang) {
  const t = (ru, en) => (lang === "en" ? en : ru);
  return [
    // Navigation
    { id: "nav.dashboard", group: t("Навигация", "Navigation"), title: t("Дашборд", "Dashboard"), hint: "← командный центр", glyph: "◐", action: () => onNav("dashboard") },
    { id: "nav.portfolio", group: t("Навигация", "Navigation"), title: t("Портфель", "Portfolio"), hint: "PnL · позиции · стратегии", glyph: "◑", action: () => onNav("portfolio") },
    { id: "nav.smart", group: t("Навигация", "Navigation"), title: t("Smart Money", "Smart Money"), hint: "copy-trading · top wallets", glyph: "♕", action: () => onNav("smart") },
    { id: "nav.agents", group: t("Навигация", "Navigation"), title: t("Агенты", "Agents"), hint: "12 агентов", glyph: "⬢", action: () => onNav("agents") },
    { id: "nav.missions", group: t("Навигация", "Navigation"), title: t("Миссии", "Missions"), hint: "оркестрация", glyph: "▶", action: () => onNav("missions") },
    { id: "nav.scenarios", group: t("Навигация", "Navigation"), title: t("Сценарии", "Scenarios"), hint: "what-if лаборатория", glyph: "⟁", action: () => onNav("scenarios") },
    { id: "nav.opps", group: t("Навигация", "Navigation"), title: t("Возможности", "Opportunities"), hint: "airdrops · scam-scan · presales", glyph: "◈", action: () => onNav("opps") },
    { id: "nav.memory", group: t("Навигация", "Navigation"), title: t("Память", "Memory"), hint: "vector store", glyph: "❖", action: () => onNav("memory") },
    { id: "nav.analytics", group: t("Навигация", "Navigation"), title: t("Аналитика", "Analytics"), hint: "trading terminal", glyph: "▲", action: () => onNav("analytics") },
    { id: "nav.watchlist", group: t("Навигация", "Navigation"), title: t("Watchlist"), hint: "мониторинг", glyph: "◉", action: () => onNav("watchlist") },
    { id: "nav.alerts", group: t("Навигация", "Navigation"), title: t("Алерты", "Alerts"), hint: "realtime", glyph: "!", action: () => onNav("alerts") },
    { id: "nav.reports", group: t("Навигация", "Navigation"), title: t("Отчёты", "Reports"), hint: "intelligence briefs", glyph: "▤", action: () => onNav("reports") },
    { id: "nav.settings", group: t("Навигация", "Navigation"), title: t("Настройки", "Settings"), hint: "system", glyph: "✦", action: () => onNav("settings") },
    // Actions
    { id: "act.assistant", group: t("Действия", "Actions"), title: t("Открыть AI-ассистента VAEL", "Open VAEL AI assistant"), hint: "claude.complete · чат", glyph: "◆", action: () => window.__openAssistant?.(), accent: true },
    { id: "act.copilot", group: t("Действия", "Actions"), title: t("Открыть Co-Pilot · рекомендации", "Open Co-Pilot · recommendations"), hint: "proactive AI suggestions", glyph: "◉", action: () => window.__openCoPilot?.(), accent: true },
    { id: "act.new-mission", group: t("Действия", "Actions"), title: t("Создать миссию", "Create mission"), hint: "оркестратор · план", glyph: "+", action: openMissionModal, accent: true },
    { id: "act.deploy-all", group: t("Действия", "Actions"), title: t("Развернуть всех агентов", "Deploy all agents"), hint: "12 агентов", glyph: "↑", action: () => {} },
    { id: "act.snapshot", group: t("Действия", "Actions"), title: t("Снимок памяти", "Memory snapshot"), hint: "2.4M vectors → backup", glyph: "❖", action: () => {} },
    { id: "act.mute", group: t("Действия", "Actions"), title: t("Заглушить все алерты", "Mute all alerts"), hint: "30 минут", glyph: "✕", action: () => {} },
    { id: "act.brief", group: t("Действия", "Actions"), title: t("Сгенерировать ежедневный brief", "Generate daily brief"), hint: "planner + memory + forecast", glyph: "▤", action: () => {} },
    // Search
    { id: "srch.wallet", group: t("Поиск", "Search"), title: "0x7a2c…ef91", hint: t("кошелёк · whale-04", "wallet · whale-04"), glyph: "$", action: () => onNav("watchlist") },
    { id: "srch.wallet2", group: t("Поиск", "Search"), title: "0xdead…beef", hint: t("кошелёк · suspect", "wallet · suspect"), glyph: "$", action: () => onNav("watchlist") },
    { id: "srch.entity", group: t("Поиск", "Search"), title: "L2 Rollup · 14.05", hint: t("событие · 67 refs", "event · 67 refs"), glyph: "❖", action: () => onNav("memory") },
    // Agents quick-jump
    ...AGENT_DEFS.map(a => ({
      id: `agt.${a.id}`, group: t("Агенты", "Agents"), title: `${a.ru}`,
      hint: `${a.name.toLowerCase()}.agt`, glyph: a.glyph, action: () => onNav("agents"),
    })),
  ];
}

function CommandPalette({ open, onClose, onNav, openMissionModal, lang }) {
  const [query, setQuery] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const all = useMemo(() => buildCommands(onNav, openMissionModal, lang), [onNav, openMissionModal, lang]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all.slice(0, 28);
    return all.filter(c =>
      c.title.toLowerCase().includes(q) ||
      (c.hint || "").toLowerCase().includes(q) ||
      c.group.toLowerCase().includes(q)
    ).slice(0, 32);
  }, [all, query]);

  // grouped
  const grouped = useMemo(() => {
    const m = {};
    filtered.forEach(c => { (m[c.group] = m[c.group] || []).push(c); });
    return m;
  }, [filtered]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setIdx(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => { setIdx(0); }, [query]);

  // keyboard nav within palette
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === "Escape") { onClose(); e.preventDefault(); }
      if (e.key === "ArrowDown") { setIdx(i => Math.min(filtered.length - 1, i + 1)); e.preventDefault(); }
      if (e.key === "ArrowUp")   { setIdx(i => Math.max(0, i - 1)); e.preventDefault(); }
      if (e.key === "Enter") {
        const c = filtered[idx];
        if (c) { c.action(); onClose(); }
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, filtered, idx, onClose]);

  // scroll active into view
  useEffect(() => {
    if (!open) return;
    const node = listRef.current?.querySelector(`[data-idx="${idx}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [idx, open]);

  if (!open) return null;

  let runningIdx = 0;

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0,
      background: "oklch(0 0 0 / 0.55)",
      backdropFilter: "blur(4px)",
      WebkitBackdropFilter: "blur(4px)",
      zIndex: 9999,
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      paddingTop: "14vh",
      animation: "cpFade 0.18s ease-out",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 640, maxHeight: "70vh",
        background: "var(--bg-1)",
        border: "1px solid var(--line-bright)",
        borderRadius: 8,
        boxShadow: "0 24px 60px -12px oklch(0 0 0 / 0.6), var(--glow-strong)",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        animation: "cpScale 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
      }}>
        {/* input row */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "14px 18px",
          borderBottom: "1px solid var(--line)",
        }}>
          <span style={{ color: "var(--accent)", fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 600 }}>⌕</span>
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
            placeholder={lang === "en" ? "Type a command, agent, wallet, entity..." : "Команда, агент, кошелёк, сущность..."}
            style={{
              flex: 1, background: "transparent", border: "none",
              color: "var(--text-bright)", fontFamily: "var(--font-ui)", fontSize: 15,
              outline: "none",
            }}
          />
          <span className="chip mono" style={{ fontSize: 9.5 }}>ESC</span>
        </div>

        {/* list */}
        <div ref={listRef} className="scroll" style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
          {Object.keys(grouped).length === 0 && (
            <div style={{ padding: "32px 18px", textAlign: "center", color: "var(--text-dim)", fontSize: 12 }}>
              {lang === "en" ? "No results · try another query" : "Ничего не найдено · попробуйте другой запрос"}
            </div>
          )}
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group}>
              <div style={{
                padding: "8px 18px 4px",
                fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600,
                color: "var(--text-dim)", letterSpacing: "0.15em", textTransform: "uppercase",
              }}>{group}</div>
              {items.map(c => {
                const myIdx = runningIdx++;
                const active = myIdx === idx;
                return (
                  <div key={c.id} data-idx={myIdx}
                    onMouseEnter={() => setIdx(myIdx)}
                    onClick={() => { c.action(); onClose(); }}
                    style={{
                      display: "grid", gridTemplateColumns: "auto 1fr auto",
                      gap: 12, alignItems: "center",
                      padding: "8px 18px",
                      cursor: "pointer",
                      background: active ? "var(--accent-soft)" : "transparent",
                      borderLeft: `2px solid ${active ? "var(--accent)" : "transparent"}`,
                    }}>
                    <span style={{
                      fontFamily: "var(--font-mono)", fontSize: 12,
                      color: active || c.accent ? "var(--accent)" : "var(--text-mid)",
                      width: 18, textAlign: "center",
                    }}>{c.glyph}</span>
                    <span style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
                      <span style={{ fontSize: 13, color: active ? "var(--text-bright)" : "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {c.title}
                      </span>
                      <span className="mono" style={{ fontSize: 10.5, color: "var(--text-dim)", flexShrink: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {c.hint}
                      </span>
                    </span>
                    {active && <span className="mono" style={{ fontSize: 10, color: "var(--accent)" }}>↵</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* footer */}
        <div style={{
          display: "flex", alignItems: "center", gap: 14,
          padding: "8px 18px",
          borderTop: "1px solid var(--line)",
          background: "var(--bg-2)",
          fontFamily: "var(--font-mono)", fontSize: 10,
          color: "var(--text-dim)",
        }}>
          <span><span className="chip" style={{ marginRight: 4 }}>↑↓</span> навигация</span>
          <span><span className="chip" style={{ marginRight: 4 }}>↵</span> выполнить</span>
          <span><span className="chip" style={{ marginRight: 4 }}>esc</span> закрыть</span>
          <span style={{ marginLeft: "auto", color: "var(--text-dim)" }}>{filtered.length} результатов</span>
        </div>
      </div>
    </div>
  );
}

/* keyframes */
if (typeof document !== "undefined" && !document.getElementById("__cp_kf")) {
  const s = document.createElement("style");
  s.id = "__cp_kf";
  s.textContent = `
    @keyframes cpFade { 0% { opacity: 0; } 100% { opacity: 1; } }
    @keyframes cpScale { 0% { transform: translateY(-8px) scale(0.97); opacity: 0; } 100% { transform: translateY(0) scale(1); opacity: 1; } }
    @keyframes pageIn { 0% { opacity: 0; transform: translateY(4px); } 100% { opacity: 1; transform: translateY(0); } }
  `;
  document.head.appendChild(s);
}

/* ═════════════════════════════════════════════════════════
 *  MISSION CREATE MODAL
 * ════════════════════════════════════════════════════════*/

function MissionModal({ open, onClose, lang }) {
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [priority, setPriority] = useState("normal");
  const [selectedAgents, setSelectedAgents] = useState(["planner", "research", "onchain"]);
  const [schedule, setSchedule] = useState("now");

  const toggleAgent = (id) => {
    setSelectedAgents(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0,
      background: "oklch(0 0 0 / 0.55)",
      backdropFilter: "blur(4px)",
      WebkitBackdropFilter: "blur(4px)",
      zIndex: 9998,
      display: "flex", alignItems: "center", justifyContent: "center",
      animation: "cpFade 0.18s ease-out",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 720, maxHeight: "84vh",
        background: "var(--bg-1)",
        border: "1px solid var(--line-bright)",
        borderRadius: 8,
        boxShadow: "0 24px 60px -12px oklch(0 0 0 / 0.6), var(--glow-strong)",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        animation: "cpScale 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "12px 18px",
          borderBottom: "1px solid var(--line)",
          background: "var(--bg-2)",
        }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent)", letterSpacing: "0.18em" }}>NEW MISSION · M-2842</span>
          <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>orchestrator.v6</span>
          <button onClick={onClose} style={{
            background: "transparent", border: "none",
            color: "var(--text-dim)", fontSize: 16, cursor: "pointer", padding: 2,
          }}>✕</button>
        </div>

        <div className="scroll" style={{ flex: 1, overflowY: "auto", padding: 22, display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <Field label={lang === "en" ? "Mission name" : "Название миссии"}>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="Whale-scan · ETH mainnet · 24h"
                style={fieldStyle} />
            </Field>
          </div>

          <div>
            <Field label={lang === "en" ? "Objective" : "Цель миссии"}>
              <textarea value={goal} onChange={e => setGoal(e.target.value)}
                placeholder="Идентифицировать активные whale-кошельки, классифицировать по поведению, сопоставить с известными сущностями..."
                rows={3} style={{ ...fieldStyle, fontFamily: "var(--font-ui)", fontSize: 12.5, resize: "vertical", lineHeight: 1.5 }} />
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label={lang === "en" ? "Priority" : "Приоритет"}>
              <Segmented value={priority} onChange={setPriority}
                options={[
                  { v: "low",    label: lang === "en" ? "Low" : "Низкий" },
                  { v: "normal", label: lang === "en" ? "Normal" : "Обычный" },
                  { v: "high",   label: lang === "en" ? "High" : "Высокий" },
                  { v: "crit",   label: "CRIT" },
                ]}
              />
            </Field>
            <Field label={lang === "en" ? "Schedule" : "Запуск"}>
              <Segmented value={schedule} onChange={setSchedule}
                options={[
                  { v: "now",      label: lang === "en" ? "Now" : "Сейчас" },
                  { v: "in-1h",    label: "+1h" },
                  { v: "in-24h",   label: "+24h" },
                  { v: "custom",   label: lang === "en" ? "Custom" : "Cron" },
                ]}
              />
            </Field>
          </div>

          <Field label={lang === "en" ? "Select agents" : "Выбор агентов"}
            hint={`${selectedAgents.length} выбрано · orchestrator определит маршрут`}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
              {AGENT_DEFS.map(a => {
                const on = selectedAgents.includes(a.id);
                return (
                  <button key={a.id} onClick={() => toggleAgent(a.id)} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "6px 8px",
                    background: on ? "var(--accent-soft)" : "var(--bg-2)",
                    border: `1px solid ${on ? "oklch(0.78 0.16 var(--accent-h) / 0.5)" : "var(--line)"}`,
                    borderRadius: 3,
                    color: on ? "var(--accent)" : "var(--text-mid)",
                    fontFamily: "var(--font-ui)", fontSize: 11,
                    cursor: "pointer", textAlign: "left",
                    transition: "all 0.12s",
                  }}>
                    <span style={{
                      fontFamily: "var(--font-mono)", fontSize: 9.5, fontWeight: 600,
                      width: 22, height: 18, borderRadius: 2,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: on ? a.def?.color || a.color : "var(--text-dim)",
                      background: "var(--bg-0)",
                      border: `1px solid ${on ? a.color : "var(--line)"}`,
                    }}>{a.glyph}</span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.ru}</span>
                    {on && <span style={{ marginLeft: "auto", color: "var(--accent)", fontSize: 10 }}>✓</span>}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label={lang === "en" ? "Estimated plan" : "Предварительный план"}
            hint="planner.agt · auto-decomposition">
            <div style={{
              background: "var(--bg-0)", border: "1px solid var(--line)",
              borderRadius: 4, padding: 12, fontFamily: "var(--font-mono)", fontSize: 11,
              color: "var(--text-mid)", lineHeight: 1.7,
            }}>
              <div>1. <span className="accent">SCAN</span> → onchain.agt (≈ 4m)</div>
              <div>2. <span className="accent">ENRICH</span> → research.agt + memory.agt (≈ 6m)</div>
              <div>3. <span className="accent">CLASSIFY</span> → risk.agt (≈ 3m)</div>
              <div>4. <span className="accent">VERIFY</span> → critic.agt (≈ 2m)</div>
              <div>5. <span className="accent">REPORT</span> → planner.agt (≈ 1m)</div>
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed var(--line)", color: "var(--text-dim)" }}>
                ETA <span style={{ color: "var(--text-bright)" }}>~16 минут</span> · cost <span style={{ color: "var(--text-bright)" }}>≈ 0.42$</span> · tokens <span style={{ color: "var(--text-bright)" }}>~ 38K</span>
              </div>
            </div>
          </Field>
        </div>

        <div style={{
          display: "flex", gap: 8, padding: "12px 18px",
          borderTop: "1px solid var(--line)",
          background: "var(--bg-2)",
        }}>
          <button onClick={onClose} className="btn">{lang === "en" ? "Cancel" : "Отмена"}</button>
          <button className="btn">{lang === "en" ? "Save as template" : "Сохранить шаблон"}</button>
          <button className="btn" style={{ marginLeft: "auto" }}>{lang === "en" ? "Dry run" : "Сухой прогон"}</button>
          <button className="btn btn-accent" onClick={onClose}>{lang === "en" ? "Launch mission ▸" : "Запустить миссию ▸"}</button>
        </div>
      </div>
    </div>
  );
}

const fieldStyle = {
  width: "100%",
  padding: "8px 10px",
  background: "var(--bg-0)",
  border: "1px solid var(--line-bright)",
  color: "var(--text-bright)",
  fontFamily: "var(--font-mono)", fontSize: 12,
  outline: "none",
  borderRadius: 4,
};

function Field({ label, hint, children }) {
  return (
    <div>
      <div style={{
        display: "flex", alignItems: "baseline", justifyContent: "space-between",
        marginBottom: 6,
      }}>
        <span style={{
          fontSize: 9.5, fontWeight: 600, letterSpacing: "0.15em",
          textTransform: "uppercase", color: "var(--text-dim)",
        }}>{label}</span>
        {hint && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>{hint}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function Segmented({ value, onChange, options }) {
  return (
    <div style={{
      display: "flex", padding: 2, background: "var(--bg-0)",
      border: "1px solid var(--line)", borderRadius: 4,
    }}>
      {options.map(o => (
        <button key={o.v} onClick={() => onChange(o.v)} style={{
          flex: 1, padding: "6px 8px",
          background: value === o.v ? "var(--accent-soft)" : "transparent",
          color: value === o.v ? "var(--accent)" : "var(--text-mid)",
          border: "none", borderRadius: 3,
          fontFamily: "var(--font-ui)", fontSize: 11,
          cursor: "pointer",
          transition: "all 0.12s",
        }}>{o.label}</button>
      ))}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════
 *  CANDLESTICK CHART
 * ════════════════════════════════════════════════════════*/

function genCandles(n = 60, base = 2400, vol = 0.02) {
  const out = [];
  let prev = base;
  for (let i = 0; i < n; i++) {
    const open = prev;
    const drift = (Math.random() - 0.48) * base * vol;
    const close = open + drift;
    const hi = Math.max(open, close) + Math.random() * base * vol * 0.6;
    const lo = Math.min(open, close) - Math.random() * base * vol * 0.6;
    out.push({ open, close, hi, lo, v: Math.random() * 100 + 20 });
    prev = close;
  }
  return out;
}

function CandlestickChart({ candles, width = 600, height = 260 }) {
  const minV = Math.min(...candles.map(c => c.lo));
  const maxV = Math.max(...candles.map(c => c.hi));
  const range = maxV - minV || 1;
  const padY = 18;
  const chartH = height - 40; // leave room for vol bars
  const volH = 30;
  const stepX = width / candles.length;
  const candleW = Math.max(2, stepX * 0.6);
  const maxVol = Math.max(...candles.map(c => c.v));

  const y = (v) => padY + (1 - (v - minV) / range) * (chartH - padY * 2);

  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      {/* y grid */}
      {[0.2, 0.4, 0.6, 0.8].map((p, i) => (
        <g key={i}>
          <line x1={0} y1={padY + (chartH - padY * 2) * p} x2={width}
            y2={padY + (chartH - padY * 2) * p}
            stroke="var(--line)" strokeWidth={0.5} strokeDasharray="2 4" />
          <text x={width - 4} y={padY + (chartH - padY * 2) * p - 2} textAnchor="end"
            fontFamily="var(--font-mono)" fontSize={9} fill="var(--text-dim)">
            {(maxV - range * p).toFixed(0)}
          </text>
        </g>
      ))}
      {/* candles */}
      {candles.map((c, i) => {
        const cx = i * stepX + stepX / 2;
        const up = c.close >= c.open;
        const color = up ? "var(--green)" : "var(--red)";
        const top = y(Math.max(c.open, c.close));
        const bot = y(Math.min(c.open, c.close));
        return (
          <g key={i}>
            <line x1={cx} y1={y(c.hi)} x2={cx} y2={y(c.lo)} stroke={color} strokeWidth={1} />
            <rect x={cx - candleW / 2} y={top} width={candleW} height={Math.max(1, bot - top)}
              fill={up ? "transparent" : color} stroke={color} strokeWidth={1} />
            {/* volume bar */}
            <rect x={cx - candleW / 2} y={height - 8 - (c.v / maxVol) * volH}
              width={candleW} height={(c.v / maxVol) * volH}
              fill={color} opacity={0.35} />
          </g>
        );
      })}
      {/* current price line */}
      <line x1={0} y1={y(candles[candles.length - 1].close)} x2={width}
        y2={y(candles[candles.length - 1].close)}
        stroke="var(--accent)" strokeWidth={0.6} strokeDasharray="3 3" opacity={0.6} />
    </svg>
  );
}

/* ═════════════════════════════════════════════════════════
 *  ORDER BOOK LADDER
 * ════════════════════════════════════════════════════════*/

function OrderBook({ mid = 2408.42, lang }) {
  const rows = 11;
  const asks = useMemo(() => {
    return Array.from({ length: rows }, (_, i) => {
      const price = mid + (i + 1) * 0.42;
      const size = Math.random() * 18 + 0.5;
      return { price, size };
    }).reverse();
  }, [mid]);
  const bids = useMemo(() => {
    return Array.from({ length: rows }, (_, i) => {
      const price = mid - (i + 1) * 0.42;
      const size = Math.random() * 18 + 0.5;
      return { price, size };
    });
  }, [mid]);

  const maxSize = Math.max(...asks.map(a => a.size), ...bids.map(b => b.size));

  return (
    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5 }}>
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
        padding: "6px 10px",
        color: "var(--text-dim)", fontSize: 9, letterSpacing: 0.08,
        textTransform: "uppercase", borderBottom: "1px solid var(--line)",
        background: "var(--bg-2)",
      }}>
        <span>{lang === "en" ? "Price" : "Цена"}</span>
        <span style={{ textAlign: "right" }}>{lang === "en" ? "Size" : "Объём"}</span>
        <span style={{ textAlign: "right" }}>Σ</span>
      </div>
      {asks.map((a, i) => {
        const sum = asks.slice(i).reduce((s, x) => s + x.size, 0);
        return <OBRow key={`a${i}`} side="ask" price={a.price} size={a.size} sum={sum} maxSize={maxSize * 4} />;
      })}
      <div style={{
        padding: "5px 10px",
        background: "var(--bg-0)",
        borderTop: "1px solid var(--accent)",
        borderBottom: "1px solid var(--accent)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ color: "var(--accent)", fontWeight: 600, fontSize: 12 }}>
          {mid.toFixed(2)} <span style={{ fontSize: 9, color: "var(--text-dim)" }}>USD</span>
        </span>
        <span style={{ color: "var(--green)", fontSize: 9.5 }}>SPREAD 0.08 (0.003%)</span>
      </div>
      {bids.map((b, i) => {
        const sum = bids.slice(0, i + 1).reduce((s, x) => s + x.size, 0);
        return <OBRow key={`b${i}`} side="bid" price={b.price} size={b.size} sum={sum} maxSize={maxSize * 4} />;
      })}
    </div>
  );
}

function OBRow({ side, price, size, sum, maxSize }) {
  const color = side === "ask" ? "var(--red)" : "var(--green)";
  const pct = (size / maxSize) * 100;
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
      padding: "2.5px 10px",
      position: "relative", alignItems: "center",
      borderBottom: "1px solid var(--bg-2)",
    }}>
      <div style={{
        position: "absolute", top: 0, bottom: 0,
        right: 0, width: `${pct}%`,
        background: color, opacity: 0.08,
      }} />
      <span style={{ position: "relative", color, fontVariantNumeric: "tabular-nums" }}>{price.toFixed(2)}</span>
      <span style={{ position: "relative", textAlign: "right", color: "var(--text)" }}>{size.toFixed(2)}</span>
      <span style={{ position: "relative", textAlign: "right", color: "var(--text-dim)" }}>{sum.toFixed(1)}</span>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════
 *  FLOW HEATMAP (token movement)
 * ════════════════════════════════════════════════════════*/

function FlowHeatmap({ width = 380, height = 160 }) {
  const cols = 24; // hours
  const rows = 8;  // chain / segment
  const labels = ["ETH", "USDT", "USDC", "WBTC", "DAI", "L2-A", "L2-B", "BNB"];
  const cells = useMemo(() => {
    return Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => {
        const v = Math.sin((r * 3 + c * 0.7)) * 0.5 + 0.5;
        return v * (0.4 + Math.random() * 0.6);
      })
    );
  }, []);
  const cellW = (width - 50) / cols;
  const cellH = (height - 24) / rows;

  return (
    <svg width={width} height={height}>
      {cells.map((row, r) => (
        <g key={r}>
          <text x={4} y={28 + r * cellH + cellH / 2 + 3}
            fontFamily="var(--font-mono)" fontSize={9} fill="var(--text-dim)">{labels[r]}</text>
          {row.map((v, c) => {
            const color = v > 0.7 ? "var(--green)" : v > 0.4 ? "var(--accent)" : "var(--blue)";
            return (
              <rect key={c}
                x={48 + c * cellW} y={24 + r * cellH}
                width={cellW - 1} height={cellH - 1}
                fill={color} opacity={0.15 + v * 0.65}
              />
            );
          })}
        </g>
      ))}
      {/* x labels */}
      {[0, 6, 12, 18, 23].map(h => (
        <text key={h} x={48 + h * cellW + cellW / 2} y={18}
          textAnchor="middle"
          fontFamily="var(--font-mono)" fontSize={9} fill="var(--text-dim)">
          {String(h).padStart(2, "0")}:00
        </text>
      ))}
    </svg>
  );
}

/* ═════════════════════════════════════════════════════════
 *  ENHANCED ANALYTICS PAGE
 * ════════════════════════════════════════════════════════*/

function AnalyticsPageEnhanced({ lang }) {
  const SYMBOL = "BTCUSDT";
  // real Bybit market: 1H candles + live orderbook/trades
  const { candles, ticker, status } = useBybitMarket(SYMBOL, "60", 60);
  const { orderbook, trades } = useBybitL2(SYMBOL, 50, 20);
  const sentimentData = useMemo(() => genSpark(0.5, 0.18, 60), []);
  const anomalyData = useMemo(() => genSpark(12, 0.4, 40), []);

  if (!candles.length) {
    return (
      <div data-screen-label="05 Analytics" style={{ height: "100%", padding: "var(--gap)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
        Загрузка рынка BTC/USDT из Bybit…
      </div>
    );
  }

  const last = candles[candles.length - 1];
  const first = candles[0];
  const price = ticker ? ticker.lastPrice : last.close;
  const delta = ticker ? (price - ticker.prevPrice24h) : (last.close - first.open);
  const deltaPct = ticker ? (ticker.price24hPcnt * 100) : ((last.close - first.open) / first.open * 100);
  const high = ticker ? ticker.highPrice24h : Math.max(...candles.map(c => c.hi));
  const low  = ticker ? ticker.lowPrice24h : Math.min(...candles.map(c => c.lo));
  const turnover = ticker ? ticker.turnover24h : candles.reduce((s, c) => s + c.v, 0);
  const bestBid = orderbook.bids[0] ? orderbook.bids[0][0] : price;
  const bestAsk = orderbook.asks[0] ? orderbook.asks[0][0] : price;

  return (
    <div data-screen-label="05 Analytics" style={{ height: "100%", padding: "var(--gap)", display: "flex", flexDirection: "column", overflow: "hidden", animation: "pageIn 0.25s ease-out" }}>
      <PageHeader title={lang === "en" ? "ANALYTICS" : "АНАЛИТИКА"}
        sub="INSTITUTIONAL TERMINAL · BTC/USDT · Bybit realtime"
        actions={
          <>
            {typeof LiveTag === "function" && <LiveTag status={status} />}
            <button className="btn">1h</button>
            <button className="btn btn-accent">24h</button>
            <button className="btn">7d</button>
            <button className="btn">30d</button>
            <button className="btn">Экспорт</button>
          </>
        }
      />
      <div style={{
        flex: 1, minHeight: 0, overflow: "hidden",
        display: "grid",
        gridTemplateColumns: "1.8fr 0.9fr 1fr",
        gridTemplateRows: "1.5fr 1fr",
        gap: "var(--gap)",
      }}>
        {/* Main chart */}
        <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
          <PanelHeader title="BTC/USDT · 1H CANDLES"
            meta={`bid ${bestBid.toFixed(1)} · ask ${bestAsk.toFixed(1)}`}
            action={
              <span className="mono" style={{ fontSize: 10, color: delta >= 0 ? "var(--green)" : "var(--red)" }}>
                ● {delta >= 0 ? "+" : ""}{delta.toFixed(2)} ({deltaPct >= 0 ? "+" : ""}{deltaPct.toFixed(2)}%)
              </span>
            }
          />
          <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10, flex: 1, minHeight: 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 32, color: "var(--text-bright)", fontWeight: 300, letterSpacing: "-0.01em" }}>
                <TickerNumber value={price} decimals={price < 10 ? 3 : price < 1000 ? 2 : 1} />
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: delta >= 0 ? "var(--green)" : "var(--red)" }}>
                {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(2)} ({Math.abs(deltaPct).toFixed(2)}%)
              </span>
              <span className="mono" style={{ marginLeft: "auto", fontSize: 10, color: "var(--text-dim)" }}>UPDATED · 14:23:08 UTC · 24h window</span>
            </div>
            <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
              <svg width="100%" height="100%" viewBox="0 0 700 320" preserveAspectRatio="none">
                <CandlestickChartInner candles={candles} width={700} height={320} />
              </svg>
            </div>
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8,
              paddingTop: 8, borderTop: "1px solid var(--line)",
            }}>
              <Stat label="OPEN" v={first.open.toFixed(1)} />
              <Stat label="HIGH · 24h" v={high.toFixed(1)} c="var(--green)" />
              <Stat label="LOW · 24h" v={low.toFixed(1)} c="var(--red)" />
              <Stat label="ОБОРОТ · 24h" v={typeof fmtMktUsd === "function" ? fmtMktUsd(turnover) : `$${(turnover/1e9).toFixed(2)}B`} />
              <Stat label="VWAP" v={(first.open * 0.4 + last.close * 0.6).toFixed(1)} />
              <Stat label="VOLATILITY" v="2.4σ" c="var(--amber)" />
              <Stat label="AI CONF" v="87%" c="var(--accent)" />
            </div>
          </div>
        </div>

        {/* Order book */}
        <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
          <PanelHeader title="ORDER BOOK · L2" meta="Bybit · spot" action={
            typeof LiveTag === "function" ? <LiveTag status={status} />
            : <span className="mono" style={{ fontSize: 9.5, color: "var(--green)" }}><PulseDot size={4} color="var(--green)" /> LIVE</span>
          } />
          <div className="scroll" style={{ flex: 1, overflow: "auto" }}>
            <OrderbookView book={orderbook} lastPrice={price} />
          </div>
        </div>

        {/* Live trades */}
        <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
          <PanelHeader title={lang === "en" ? "RECENT TRADES" : "ПОТОК СДЕЛОК"} meta="Bybit · time & sales" />
          <div className="scroll" style={{ flex: 1, overflow: "auto" }}>
            <TradesView trades={trades} />
          </div>
        </div>

        {/* Sentiment */}
        <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
          <PanelHeader title="SENTIMENT · ROLLING 24h" meta="news + social + agent" />
          <div style={{ padding: 10, flex: 1, position: "relative", minHeight: 0 }}>
            <svg width="100%" height="100%" viewBox="0 0 400 160" preserveAspectRatio="none">
              <AreaChartInner data={sentimentData} width={400} height={160} color="var(--accent-2)" />
            </svg>
          </div>
        </div>

        {/* Flow heatmap */}
        <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
          <PanelHeader title={lang === "en" ? "MARKET HEATMAP · 24h" : "РЫНОК · ТЕПЛОВАЯ КАРТА · 24Ч"} meta="Bybit · 24h динамика"
            action={typeof LiveTag === "function" ? <LiveTag status="live" /> : null} />
          <div style={{ flex: 1, position: "relative", minHeight: 0, display: "flex", overflow: "auto" }}>
            <MarketHeatmap />
          </div>
        </div>

        {/* Anomaly */}
        <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
          <PanelHeader title={lang === "en" ? "ANOMALY DETECTION" : "ДЕТЕКТОР АНОМАЛИЙ"} meta="6 detected · last 1h" />
          <div style={{ padding: 10, flex: 1, position: "relative", minHeight: 0 }}>
            <svg width="100%" height="100%" viewBox="0 0 400 160" preserveAspectRatio="none">
              <AreaChartInner data={anomalyData} width={400} height={160} color="var(--red)" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Inner versions of charts that take width/height for viewBox use */
function CandlestickChartInner({ candles, width, height }) {
  const minV = Math.min(...candles.map(c => c.lo));
  const maxV = Math.max(...candles.map(c => c.hi));
  const range = maxV - minV || 1;
  const padY = 18;
  const chartH = height - 40;
  const volH = 30;
  const stepX = width / candles.length;
  const candleW = Math.max(2, stepX * 0.6);
  const maxVol = Math.max(...candles.map(c => c.v));
  const y = (v) => padY + (1 - (v - minV) / range) * (chartH - padY * 2);
  return (
    <>
      {[0.2, 0.4, 0.6, 0.8].map((p, i) => (
        <g key={i}>
          <line x1={0} y1={padY + (chartH - padY * 2) * p} x2={width}
            y2={padY + (chartH - padY * 2) * p}
            stroke="var(--line)" strokeWidth={0.5} strokeDasharray="2 4" />
          <text x={width - 4} y={padY + (chartH - padY * 2) * p - 2} textAnchor="end"
            fontFamily="var(--font-mono)" fontSize={9} fill="var(--text-dim)">
            {(maxV - range * p).toFixed(0)}
          </text>
        </g>
      ))}
      {candles.map((c, i) => {
        const cx = i * stepX + stepX / 2;
        const up = c.close >= c.open;
        const color = up ? "var(--green)" : "var(--red)";
        const top = y(Math.max(c.open, c.close));
        const bot = y(Math.min(c.open, c.close));
        return (
          <g key={i}>
            <line x1={cx} y1={y(c.hi)} x2={cx} y2={y(c.lo)} stroke={color} strokeWidth={1} />
            <rect x={cx - candleW / 2} y={top} width={candleW} height={Math.max(1, bot - top)}
              fill={up ? "transparent" : color} stroke={color} strokeWidth={1} />
            <rect x={cx - candleW / 2} y={height - 8 - (c.v / maxVol) * volH}
              width={candleW} height={(c.v / maxVol) * volH}
              fill={color} opacity={0.35} />
          </g>
        );
      })}
      <line x1={0} y1={y(candles[candles.length - 1].close)} x2={width}
        y2={y(candles[candles.length - 1].close)}
        stroke="var(--accent)" strokeWidth={0.6} strokeDasharray="3 3" opacity={0.6} />
    </>
  );
}

function AreaChartInner({ data, width, height, color }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const points = data.map((v, i) => [i * stepX, height - ((v - min) / range) * (height - 20) - 10]);
  const path = points.map(([x, y], i) => i === 0 ? `M${x},${y}` : `L${x},${y}`).join(" ");
  const areaPath = `${path} L${width},${height} L0,${height} Z`;
  const c = color || "var(--accent)";
  const gradId = `aci-${Math.random().toString(36).slice(2, 8)}`;
  const gridLines = 4;
  const gridY = Array.from({ length: gridLines + 1 }, (_, i) => (height / gridLines) * i);
  const last = points[points.length - 1];
  return (
    <>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c} stopOpacity="0.35" />
          <stop offset="100%" stopColor={c} stopOpacity="0" />
        </linearGradient>
      </defs>
      {gridY.map((y, i) => (
        <line key={i} x1={0} y1={y} x2={width} y2={y}
          stroke="var(--line)" strokeWidth={0.5} strokeDasharray="2 4" />
      ))}
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={path} fill="none" stroke={c} strokeWidth={1.5} strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r={3} fill={c} />
    </>
  );
}

function FlowHeatmapInner({ width, height }) {
  const cols = 24, rows = 8;
  const labels = ["ETH", "USDT", "USDC", "WBTC", "DAI", "L2-A", "L2-B", "BNB"];
  const cells = useMemo(() => {
    return Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => {
        const v = Math.sin((r * 3 + c * 0.7)) * 0.5 + 0.5;
        return v * (0.4 + Math.random() * 0.6);
      })
    );
  }, []);
  const cellW = (width - 50) / cols;
  const cellH = (height - 24) / rows;
  return (
    <>
      {cells.map((row, r) => (
        <g key={r}>
          <text x={4} y={28 + r * cellH + cellH / 2 + 3}
            fontFamily="var(--font-mono)" fontSize={9} fill="var(--text-dim)">{labels[r]}</text>
          {row.map((v, c) => {
            const color = v > 0.7 ? "var(--green)" : v > 0.4 ? "var(--accent)" : "var(--blue)";
            return (
              <rect key={c}
                x={48 + c * cellW} y={24 + r * cellH}
                width={cellW - 1} height={cellH - 1}
                fill={color} opacity={0.15 + v * 0.65}
              />
            );
          })}
        </g>
      ))}
      {[0, 6, 12, 18, 23].map(h => (
        <text key={h} x={48 + h * cellW + cellW / 2} y={18}
          textAnchor="middle"
          fontFamily="var(--font-mono)" fontSize={9} fill="var(--text-dim)">
          {String(h).padStart(2, "0")}:00
        </text>
      ))}
    </>
  );
}

/* ─────────────────────────────────────────────────────────
 * Live trades feed
 * ────────────────────────────────────────────────────────*/
function LiveTrades({ mid }) {
  const [trades, setTrades] = useState(() => {
    return Array.from({ length: 11 }).map(() => makeTrade(mid));
  });
  useInterval(() => {
    setTrades(prev => [makeTrade(mid), ...prev.slice(0, 10)]);
  }, 1200);
  return (
    <div className="scroll" style={{ flex: 1, overflow: "auto", fontFamily: "var(--font-mono)", fontSize: 10.5 }}>
      <div style={{
        display: "grid", gridTemplateColumns: "auto 1fr 1fr 1fr",
        gap: 6, padding: "6px 12px", borderBottom: "1px solid var(--line)",
        background: "var(--bg-2)", color: "var(--text-dim)", fontSize: 9,
        letterSpacing: 0.08, textTransform: "uppercase",
      }}>
        <span>Время</span><span>Цена</span><span style={{ textAlign: "right" }}>Объём</span><span style={{ textAlign: "right" }}>Стоимость</span>
      </div>
      {trades.map((tr, i) => (
        <div key={tr.id} style={{
          display: "grid", gridTemplateColumns: "auto 1fr 1fr 1fr",
          gap: 6, padding: "3px 12px", alignItems: "center",
          color: tr.side === "buy" ? "var(--green)" : "var(--red)",
          background: i === 0 ? (tr.side === "buy" ? "oklch(0.78 0.16 155 / 0.07)" : "oklch(0.70 0.20 25 / 0.07)") : "transparent",
          transition: "background 0.4s",
        }}>
          <span style={{ color: "var(--text-dim)" }}>{tr.t}</span>
          <span>{tr.side === "buy" ? "▲" : "▼"} {tr.price.toFixed(2)}</span>
          <span style={{ textAlign: "right", color: "var(--text)" }}>{tr.size.toFixed(2)}</span>
          <span style={{ textAlign: "right", color: "var(--text-dim)" }}>{(tr.size * tr.price).toFixed(0)}$</span>
        </div>
      ))}
    </div>
  );
}

function makeTrade(mid) {
  const side = Math.random() > 0.5 ? "buy" : "sell";
  const price = mid + (Math.random() - 0.5) * 0.8;
  const size = Math.random() * 4 + 0.05;
  const d = new Date();
  const t = `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}:${String(d.getSeconds()).padStart(2,"0")}`;
  return { id: Math.random(), side, price, size, t };
}

/* Export */
Object.assign(window, {
  CommandPalette, MissionModal,
  CandlestickChart, OrderBook, FlowHeatmap, LiveTrades,
  AnalyticsPageEnhanced,
});