/* alert-rules.jsx — Visual if-then rule builder for alerts page */

const TRIGGER_TYPES = [
  { id: "price",    ru: "Цена актива",         icon: "$"  },
  { id: "volume",   ru: "Объём за период",     icon: "◇"  },
  { id: "wallet",   ru: "Активность кошелька", icon: "◉"  },
  { id: "signal",   ru: "AI-сигнал агента",    icon: "◆"  },
  { id: "news",     ru: "Новостной триггер",   icon: "▤"  },
  { id: "anomaly",  ru: "Аномалия (σ)",        icon: "△"  },
];

const ACTIONS = [
  { id: "notify",   ru: "Уведомление в системе",     icon: "!"  },
  { id: "telegram", ru: "Telegram-сообщение",        icon: "✈"  },
  { id: "email",    ru: "Email",                     icon: "✉"  },
  { id: "mission",  ru: "Запустить миссию",          icon: "▶"  },
  { id: "tag",      ru: "Пометить кошелёк тегом",    icon: "❖"  },
  { id: "trade",    ru: "Сигнал в трейд-терминал",   icon: "▲"  },
];

const SEVERITIES = [
  { id: "info", ru: "ИНФО", color: "var(--blue)" },
  { id: "warn", ru: "ВНИМ", color: "var(--amber)" },
  { id: "crit", ru: "КРИТ", color: "var(--red)" },
];

const SAMPLE_RULES = [
  {
    id: "R-001",
    name: "Whale-движение > 10K ETH",
    trigger: "wallet",
    condition: "amount > 10000 ETH AND wallet.tag IN [whale, fund]",
    actions: ["notify", "telegram"],
    severity: "crit",
    enabled: true,
    fired: 14,
  },
  {
    id: "R-002",
    name: "Резкая волатильность BTC",
    trigger: "anomaly",
    condition: "volatility(BTC) > 3σ за 1h",
    actions: ["notify", "trade"],
    severity: "warn",
    enabled: true,
    fired: 42,
  },
  {
    id: "R-003",
    name: "AI-сигнал с confidence ≥ 85%",
    trigger: "signal",
    condition: "agent IN [strategy, forecast] AND confidence ≥ 85%",
    actions: ["notify", "telegram", "trade"],
    severity: "info",
    enabled: true,
    fired: 168,
  },
  {
    id: "R-004",
    name: "Suspicious wallet contact",
    trigger: "wallet",
    condition: "wallet.risk ≥ 70 AND tx.in IN watchlist",
    actions: ["notify", "tag", "mission"],
    severity: "crit",
    enabled: true,
    fired: 3,
  },
  {
    id: "R-005",
    name: "Прорыв цены через ключевой уровень",
    trigger: "price",
    condition: "price.cross('EMA200', '4h')",
    actions: ["notify"],
    severity: "info",
    enabled: false,
    fired: 28,
  },
];

function AlertRulesPanel({ lang }) {
  const [rules, setRules] = useState(SAMPLE_RULES);
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(rules[0].id);

  const sel = rules.find(r => r.id === selected) || rules[0];

  function toggleRule(id) {
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  }

  function deleteRule(id) {
    setRules(prev => prev.filter(r => r.id !== id));
  }

  function saveEditing(rule) {
    if (rule.isNew) {
      setRules(prev => [...prev, { ...rule, id: `R-${String(rules.length + 1).padStart(3, "0")}`, fired: 0 }]);
    } else {
      setRules(prev => prev.map(r => r.id === rule.id ? rule : r));
    }
    setEditing(null);
  }

  return (
    <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
      <PanelHeader
        title="ПРАВИЛА АЛЕРТОВ"
        meta={`${rules.filter(r => r.enabled).length} активных / ${rules.length}`}
        action={
          <button onClick={() => setEditing({
            isNew: true, name: "", trigger: "price",
            condition: "", actions: ["notify"], severity: "info", enabled: true,
          })} className="btn btn-accent" style={{ padding: "1px 8px", fontSize: 10 }}>
            + ПРАВИЛО
          </button>
        }
      />
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1.4fr 1fr", minHeight: 0, overflow: "hidden" }}>
        {/* Rules list */}
        <div className="scroll" style={{ overflowY: "auto", borderRight: "1px solid var(--line)" }}>
          {rules.map(r => (
            <RuleRow key={r.id} r={r}
              selected={selected === r.id}
              onSelect={() => setSelected(r.id)}
              onToggle={() => toggleRule(r.id)}
              onEdit={() => setEditing({ ...r })}
              onDelete={() => deleteRule(r.id)}
            />
          ))}
        </div>
        {/* Detail */}
        {sel && <RuleDetail rule={sel} onEdit={() => setEditing({ ...sel })} />}
      </div>

      {editing && <RuleEditor rule={editing} onSave={saveEditing} onCancel={() => setEditing(null)} />}
    </div>
  );
}

function RuleRow({ r, selected, onSelect, onToggle, onEdit, onDelete }) {
  const sev = SEVERITIES.find(s => s.id === r.severity);
  const trig = TRIGGER_TYPES.find(t => t.id === r.trigger);
  return (
    <div onClick={onSelect} style={{
      display: "grid", gridTemplateColumns: "auto 1fr auto auto auto",
      gap: 8, alignItems: "center",
      padding: "8px 12px",
      borderBottom: "1px solid var(--line)",
      borderLeft: `2px solid ${selected ? "var(--accent)" : "transparent"}`,
      background: selected ? "var(--accent-soft)" : "transparent",
      cursor: "pointer",
      opacity: r.enabled ? 1 : 0.55,
    }}>
      {/* trigger glyph */}
      <span style={{
        width: 22, height: 22, borderRadius: 3,
        background: "var(--bg-2)",
        border: `1px solid ${sev.color}`,
        color: sev.color,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
      }}>{trig.icon}</span>

      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 12, color: "var(--text-bright)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 8.5, fontWeight: 700,
            color: sev.color, padding: "0 4px",
            border: `1px solid ${sev.color}`, borderRadius: 2,
            letterSpacing: 0.08,
          }}>{sev.ru}</span>
        </div>
        <div className="mono" style={{ fontSize: 9.5, color: "var(--text-dim)", marginTop: 1 }}>
          {r.id} · {trig.ru} · сработало {r.fired}×
        </div>
      </div>

      <button onClick={e => { e.stopPropagation(); onEdit(); }} style={iconBtnStyle} title="Изменить">✎</button>
      <button onClick={e => { e.stopPropagation(); onDelete(); }} style={iconBtnStyle} title="Удалить">✕</button>

      {/* toggle switch */}
      <button onClick={e => { e.stopPropagation(); onToggle(); }} style={{
        width: 32, height: 16,
        background: r.enabled ? "var(--accent)" : "var(--bg-3)",
        border: "none", borderRadius: 8,
        cursor: "pointer",
        position: "relative",
        boxShadow: r.enabled ? `0 0 6px oklch(0.78 0.16 var(--accent-h) / 0.4)` : "none",
        transition: "all 0.15s",
      }}>
        <span style={{
          position: "absolute", top: 2, left: r.enabled ? 18 : 2,
          width: 12, height: 12, borderRadius: "50%",
          background: r.enabled ? "var(--bg-0)" : "var(--text-mid)",
          transition: "left 0.15s",
        }} />
      </button>
    </div>
  );
}

const iconBtnStyle = {
  width: 22, height: 22,
  background: "var(--bg-2)",
  border: "1px solid var(--line)",
  color: "var(--text-dim)",
  borderRadius: 2,
  cursor: "pointer",
  fontFamily: "var(--font-mono)", fontSize: 10,
  display: "flex", alignItems: "center", justifyContent: "center",
};

function RuleDetail({ rule, onEdit }) {
  const trig = TRIGGER_TYPES.find(t => t.id === rule.trigger);
  const sev = SEVERITIES.find(s => s.id === rule.severity);
  const fireHistory = useMemo(() => genSpark(rule.fired || 1, 0.35, 18), [rule.id]);

  return (
    <div className="scroll" style={{ padding: 14, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 4,
            background: "var(--bg-2)", border: `1.5px solid ${sev.color}`,
            color: sev.color, display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700,
            boxShadow: `0 0 18px -4px ${sev.color}`,
          }}>{trig.icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, color: "var(--text-bright)", fontWeight: 500 }}>{rule.name}</div>
            <div className="mono" style={{ fontSize: 10, color: "var(--text-dim)" }}>{rule.id} · {rule.enabled ? "АКТИВНО" : "ОТКЛЮЧЕНО"}</div>
          </div>
          <button className="btn" onClick={onEdit}>✎ изменить</button>
        </div>
      </div>

      <RuleVisualPath rule={rule} />

      <div>
        <div style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.15, fontWeight: 600, textTransform: "uppercase", marginBottom: 5 }}>УСЛОВИЕ</div>
        <div style={{
          background: "var(--bg-0)", border: "1px solid var(--line)", borderRadius: 4,
          padding: "8px 10px",
          fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--text-bright)",
          lineHeight: 1.5,
        }}>
          {syntaxHighlight(rule.condition)}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.15, fontWeight: 600, textTransform: "uppercase", marginBottom: 6 }}>СТАТИСТИКА</div>
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
          gap: 6,
        }}>
          <RuleStat label="ВСЕГО" v={rule.fired} c="var(--text-bright)" />
          <RuleStat label="24Ч" v={Math.floor(rule.fired * 0.18)} c="var(--accent)" />
          <RuleStat label="ЛОЖНЫХ" v={Math.floor(rule.fired * 0.08)} c="var(--amber)" />
        </div>
        <div style={{ marginTop: 8 }}>
          <Sparkline data={fireHistory} width={280} height={40} color={sev.color} />
          <div className="mono" style={{ fontSize: 9.5, color: "var(--text-dim)", marginTop: 2 }}>
            частота срабатываний · 18 дней
          </div>
        </div>
      </div>
    </div>
  );
}

function RuleStat({ label, v, c }) {
  return (
    <div style={{ background: "var(--bg-0)", border: "1px solid var(--line)", borderRadius: 3, padding: "6px 8px" }}>
      <div style={{ fontSize: 8.5, color: "var(--text-dim)", letterSpacing: 0.15, fontWeight: 600 }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 16, color: c, marginTop: 1 }}>{v}</div>
    </div>
  );
}

function RuleVisualPath({ rule }) {
  const trig = TRIGGER_TYPES.find(t => t.id === rule.trigger);
  const sev = SEVERITIES.find(s => s.id === rule.severity);
  return (
    <div>
      <div style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.15, fontWeight: 600, textTransform: "uppercase", marginBottom: 6 }}>ЛОГИКА</div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
        <PathNode label="ЕСЛИ" color="var(--text-dim)" mono />
        <PathConn />
        <PathNode label={trig.ru} icon={trig.icon} color={sev.color} />
        <PathConn />
        <PathNode label="ТОГДА" color="var(--text-dim)" mono />
        {rule.actions.map((a, i) => {
          const action = ACTIONS.find(x => x.id === a);
          return (
            <React.Fragment key={a}>
              <PathConn />
              <PathNode label={action.ru} icon={action.icon} color="var(--accent)" />
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

function PathNode({ label, icon, color, mono }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "4px 8px",
      background: "var(--bg-2)", border: `1px solid ${color}`,
      color, borderRadius: 3,
      fontFamily: mono ? "var(--font-mono)" : "var(--font-ui)", fontSize: 10.5,
      fontWeight: mono ? 600 : 500,
      letterSpacing: mono ? 0.1 : 0,
    }}>
      {icon && <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700 }}>{icon}</span>}
      {label}
    </div>
  );
}

function PathConn() {
  return <span style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 12 }}>→</span>;
}

function syntaxHighlight(str) {
  // simple highlighter: numbers, operators, keywords
  const parts = [];
  const tokens = str.split(/(\s+|[<>=≥≤]+|AND|OR|IN|\(|\)|\[|\]|,)/g);
  tokens.forEach((t, i) => {
    if (!t) return;
    if (["AND", "OR", "IN", "NOT"].includes(t)) {
      parts.push(<span key={i} style={{ color: "var(--accent-2)", fontWeight: 600 }}>{t}</span>);
    } else if (/^[<>=≥≤]+$/.test(t)) {
      parts.push(<span key={i} style={{ color: "var(--amber)" }}>{t}</span>);
    } else if (/^\d/.test(t)) {
      parts.push(<span key={i} style={{ color: "var(--green)" }}>{t}</span>);
    } else if (/^[A-Z]+$/.test(t) && t.length > 1) {
      parts.push(<span key={i} style={{ color: "var(--accent)" }}>{t}</span>);
    } else {
      parts.push(<span key={i} style={{ color: "var(--text)" }}>{t}</span>);
    }
  });
  return parts;
}

/* ─────────────────────────────────────────────────────────
 * Rule editor modal
 * ────────────────────────────────────────────────────────*/
function RuleEditor({ rule, onSave, onCancel }) {
  const [r, setR] = useState(rule);
  function toggleAction(a) {
    setR(prev => ({
      ...prev,
      actions: prev.actions.includes(a) ? prev.actions.filter(x => x !== a) : [...prev.actions, a],
    }));
  }
  return (
    <div onClick={onCancel} style={{
      position: "fixed", inset: 0,
      background: "oklch(0 0 0 / 0.55)",
      backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
      zIndex: 9989,
      display: "flex", alignItems: "center", justifyContent: "center",
      animation: "cpFade 0.18s ease-out",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 640, maxHeight: "84vh",
        background: "var(--bg-1)",
        border: "1px solid var(--line-bright)",
        borderRadius: 8,
        boxShadow: "0 24px 60px -12px oklch(0 0 0 / 0.6), var(--glow-strong)",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        animation: "cpScale 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
      }}>
        <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--line)", background: "var(--bg-2)", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent)", letterSpacing: "0.18em" }}>
            {rule.isNew ? "НОВОЕ ПРАВИЛО" : `РЕДАКТИРОВАНИЕ · ${rule.id}`}
          </span>
          <button onClick={onCancel} style={{
            marginLeft: "auto", background: "transparent", border: "none",
            color: "var(--text-dim)", fontSize: 16, cursor: "pointer",
          }}>✕</button>
        </div>

        <div className="scroll" style={{ flex: 1, overflowY: "auto", padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Название">
            <input value={r.name} onChange={e => setR({ ...r, name: e.target.value })}
              placeholder="Например: Whale > 5K ETH"
              style={fieldStyle} />
          </Field>

          <Field label="Триггер">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
              {TRIGGER_TYPES.map(t => (
                <button key={t.id} onClick={() => setR({ ...r, trigger: t.id })} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 10px",
                  background: r.trigger === t.id ? "var(--accent-soft)" : "var(--bg-2)",
                  border: `1px solid ${r.trigger === t.id ? "oklch(0.78 0.16 var(--accent-h) / 0.5)" : "var(--line)"}`,
                  color: r.trigger === t.id ? "var(--accent)" : "var(--text-mid)",
                  borderRadius: 3, cursor: "pointer",
                  fontSize: 11.5, textAlign: "left",
                }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700 }}>{t.icon}</span>
                  {t.ru}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Условие" hint="используйте AND, OR, IN, операторы сравнения">
            <textarea value={r.condition} onChange={e => setR({ ...r, condition: e.target.value })}
              placeholder="amount > 10000 ETH AND wallet.tag IN [whale, fund]"
              rows={3} style={{ ...fieldStyle, fontFamily: "var(--font-mono)", fontSize: 11.5, lineHeight: 1.5, resize: "vertical" }} />
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 14 }}>
            <Field label="Severity">
              <div style={{ display: "flex", gap: 4 }}>
                {SEVERITIES.map(s => (
                  <button key={s.id} onClick={() => setR({ ...r, severity: s.id })} style={{
                    flex: 1, padding: "6px 8px",
                    background: r.severity === s.id ? `oklch(from ${s.color} l c h / 0.15)` : "var(--bg-2)",
                    color: r.severity === s.id ? s.color : "var(--text-dim)",
                    border: `1px solid ${r.severity === s.id ? s.color : "var(--line)"}`,
                    fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600,
                    borderRadius: 3, cursor: "pointer", letterSpacing: 0.08,
                  }}>{s.ru}</button>
                ))}
              </div>
            </Field>
            <Field label="Действия">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {ACTIONS.map(a => (
                  <button key={a.id} onClick={() => toggleAction(a.id)} style={{
                    display: "flex", alignItems: "center", gap: 4,
                    padding: "4px 8px",
                    background: r.actions.includes(a.id) ? "var(--accent-soft)" : "var(--bg-2)",
                    color: r.actions.includes(a.id) ? "var(--accent)" : "var(--text-mid)",
                    border: `1px solid ${r.actions.includes(a.id) ? "oklch(0.78 0.16 var(--accent-h) / 0.4)" : "var(--line)"}`,
                    borderRadius: 3, cursor: "pointer",
                    fontFamily: "var(--font-ui)", fontSize: 11,
                  }}>
                    <span style={{ fontFamily: "var(--font-mono)" }}>{a.icon}</span>
                    {a.ru}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          <Field label="Превью" hint="как правило будет выглядеть">
            <div style={{ background: "var(--bg-0)", padding: 12, borderRadius: 4, border: "1px solid var(--line)" }}>
              <RuleVisualPath rule={r} />
            </div>
          </Field>
        </div>

        <div style={{ display: "flex", gap: 8, padding: "12px 18px", borderTop: "1px solid var(--line)", background: "var(--bg-2)" }}>
          <button onClick={onCancel} className="btn">Отмена</button>
          <button className="btn" style={{ marginLeft: "auto" }}>Тест</button>
          <button onClick={() => onSave(r)} className="btn btn-accent" disabled={!r.name || !r.condition}>
            {rule.isNew ? "Создать" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { AlertRulesPanel });