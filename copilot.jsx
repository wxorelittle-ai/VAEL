/* copilot.jsx — AI Co-Pilot proactive suggestion engine */

/* ─────────────────────────────────────────────────────────
 * Suggestion pool — different types
 * ────────────────────────────────────────────────────────*/

const SUGGESTION_TYPES = {
  trade:    { ru: "ТРЕЙДИНГ",     color: "var(--accent)",     glyph: "▲" },
  risk:     { ru: "РИСК",         color: "var(--amber)",      glyph: "△" },
  security: { ru: "БЕЗОПАСНОСТЬ", color: "var(--red)",        glyph: "!" },
  airdrop:  { ru: "ЭИРДРОП",      color: "var(--green)",      glyph: "◈" },
  optimize: { ru: "ОПТИМИЗАЦИЯ",  color: "var(--blue)",       glyph: "◆" },
  scenario: { ru: "СЦЕНАРИЙ",     color: "var(--accent-2)",   glyph: "⟁" },
  agent:    { ru: "АГЕНТ",        color: "var(--accent-2)",   glyph: "⬢" },
};

const PRIORITIES = {
  critical: { ru: "КРИТ", color: "var(--red)", weight: 4 },
  high:     { ru: "ВЫС",  color: "var(--amber)", weight: 3 },
  medium:   { ru: "СРЕД", color: "var(--accent)", weight: 2 },
  low:      { ru: "НИЗ",  color: "var(--text-mid)", weight: 1 },
};

const INITIAL_SUGGESTIONS = [
  {
    id: "sug-001",
    type: "security",
    priority: "critical",
    title: "Whale-кошелёк 0x7a2c в активной фазе дампа",
    body: "Зафиксировано 12 800 ETH → Binance hot wallet за 8 минут. На ваших открытых ETH-лонгах ожидаемый downside −3.4% в окне 1-4ч. Risk Agent рекомендует ужесточить SL до 2380 (−0.8% от текущей цены) или захеджироваться шортом.",
    confidence: 91,
    sourceAgents: ["onchain.agt", "risk.agt", "strategy.agt"],
    actions: [
      { id: "act1", label: "Ужесточить SL", primary: true, navigate: "dashboard" },
      { id: "act2", label: "Создать хедж", primary: false },
      { id: "act3", label: "Игнорировать", primary: false },
    ],
    impact: "−3.4% downside risk",
    relevance: "ETH lonng position",
    age: 0,
  },
  {
    id: "sug-002",
    type: "airdrop",
    priority: "high",
    title: "Eclipse Network · snapshot через 4д 11ч",
    body: "Вы выполнили 1/3 задания. Оценка выплаты $120-800. Сложность LOW, рекомендуется завершить 2 квеста + mint NFT-бейдж сегодня для гарантии включения в snapshot.",
    confidence: 78,
    sourceAgents: ["research.agt"],
    actions: [
      { id: "act1", label: "Перейти к Эирдропам", primary: true, navigate: "opps" },
      { id: "act2", label: "Напомнить через 24ч", primary: false },
    ],
    impact: "≈ $400 ожид.",
    relevance: "AD-002 Eclipse",
    age: 1,
  },
  {
    id: "sug-003",
    type: "scenario",
    priority: "high",
    title: "Рекомендуется прогон сценария «Падение BTC −10%»",
    body: "Учитывая ваш текущий портфель ($142.5K, 87% long-exposure crypto), стресс-тест на −10% BTC покажет ожидаемый drawdown и какие правила сработают. Volatility 1ч превышает baseline в 2.1×.",
    confidence: 84,
    sourceAgents: ["risk.agt", "forecast.agt"],
    actions: [
      { id: "act1", label: "Запустить сценарий", primary: true, navigate: "scenarios" },
      { id: "act2", label: "Отложить", primary: false },
    ],
    impact: "−$11.8K ожид.",
    relevance: "Портфель",
    age: 3,
  },
  {
    id: "sug-004",
    type: "agent",
    priority: "medium",
    title: "Strategy Agent · точность снизилась до 58%",
    body: "За последние 14 дней accuracy упала с 72% до 58%. Возможные причины: shift в режиме рынка, дрифт модели. Рекомендуется backtest на свежих данных или включить второй strategy-агент с другой моделью.",
    confidence: 76,
    sourceAgents: ["critic.agt", "autofix.agt"],
    actions: [
      { id: "act1", label: "Запустить Backtest", primary: true },
      { id: "act2", label: "Открыть агента", primary: false, navigate: "agents" },
      { id: "act3", label: "Игнорировать", primary: false },
    ],
    impact: "Quality degradation",
    relevance: "strategy.agt",
    age: 8,
  },
  {
    id: "sug-005",
    type: "trade",
    priority: "medium",
    title: "SOL · новый AI-сигнал с confidence 89%",
    body: "Strategy Agent выявил bullish паттерн на SOL (4h таймфрейм): пробой 200 EMA + RSI выход из oversold + позитивный sentiment 0.42σ. Прогноз 4-12ч окно. Recommended size: 1.5-2.5% от капитала.",
    confidence: 89,
    sourceAgents: ["strategy.agt", "forecast.agt", "news.agt"],
    actions: [
      { id: "act1", label: "Открыть LONG SOL", primary: true, navigate: "dashboard" },
      { id: "act2", label: "Изучить сигнал", primary: false },
    ],
    impact: "+3.5% TP target",
    relevance: "SOL/USDT",
    age: 12,
  },
  {
    id: "sug-006",
    type: "optimize",
    priority: "low",
    title: "Memory · reindex рекомендуется",
    body: "Векторный индекс кластера #14 показывает дрифт 0.18 за 7 дней. Поисковая релевантность может снизиться на 12%. Reindex займёт ≈ 4 минуты, не влияет на работу остальных агентов.",
    confidence: 68,
    sourceAgents: ["memory.agt", "autofix.agt"],
    actions: [
      { id: "act1", label: "Reindex сейчас", primary: true, navigate: "memory" },
      { id: "act2", label: "Запланировать", primary: false },
    ],
    impact: "+12% retrieval",
    relevance: "cluster #14",
    age: 22,
  },
  {
    id: "sug-007",
    type: "security",
    priority: "high",
    title: "Новый контакт с подозрительным кошельком",
    body: "Один из ваших watchlist-кошельков (0xab12...0042) получил 248 ETH от 0xdead...beef — известного mixer-related адреса. Probability связи 78%. Рекомендуется поднять risk score и активировать enhanced monitoring.",
    confidence: 82,
    sourceAgents: ["onchain.agt", "risk.agt"],
    actions: [
      { id: "act1", label: "В Watchlist", primary: true, navigate: "watchlist" },
      { id: "act2", label: "Создать миссию", primary: false, navigate: "missions" },
    ],
    impact: "+47 risk pts",
    relevance: "0xab12…0042",
    age: 4,
  },
];

/* ─────────────────────────────────────────────────────────
 * Component
 * ────────────────────────────────────────────────────────*/

function CoPilot() {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState(INITIAL_SUGGESTIONS);
  const [dismissed, setDismissed] = useState(new Set());
  const [filter, setFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  // expose for command palette
  useEffect(() => {
    window.__openCoPilot = () => setOpen(true);
  }, []);

  // auto-add new suggestion every ~30-50s
  useInterval(() => {
    if (Math.random() < 0.4) return;
    const POOLS = [
      {
        type: "trade",
        priority: pick(["medium", "high"]),
        title: `${pick(["ETH", "BTC", "SOL", "AVAX"])} · ${pick(["short-сигнал детектирован", "пробой сопротивления", "divergence MACD"])}`,
        body: `Strategy Agent выявил ${pick(["bullish", "bearish"])} паттерн. Confidence ${randInt(74, 92)}%. Окно действия 1-6ч.`,
        confidence: randInt(74, 92),
        sourceAgents: ["strategy.agt", "forecast.agt"],
        actions: [{ id: "a1", label: "Открыть позицию", primary: true, navigate: "dashboard" }, { id: "a2", label: "Изучить", primary: false }],
        impact: `${pick(["+", "−"])}${(Math.random() * 4 + 1).toFixed(1)}% target`,
        relevance: pick(["ETH/USDT", "BTC/USDT", "SOL/USDT"]),
      },
      {
        type: "risk",
        priority: "high",
        title: `Аномалия volatility · ${pick(["BTC", "ETH"])}`,
        body: `1ч volatility превысил baseline в ${(Math.random() * 2 + 2).toFixed(1)}σ. Risk Agent рекомендует уменьшить экспозицию или захеджироваться.`,
        confidence: randInt(78, 92),
        sourceAgents: ["risk.agt"],
        actions: [{ id: "a1", label: "Снизить позиции", primary: true }, { id: "a2", label: "Отложить", primary: false }],
        impact: "−4.2% риск",
        relevance: "Портфель",
      },
      {
        type: "optimize",
        priority: "low",
        title: `Сбор GC в memory.agt · ${randInt(120, 480)}MB освобождено`,
        body: "Routine optimization. Никаких действий не требуется.",
        confidence: 100,
        sourceAgents: ["memory.agt"],
        actions: [{ id: "a1", label: "OK", primary: false }],
        impact: "info",
        relevance: "memory.agt",
      },
    ];
    const tpl = pick(POOLS);
    const newSug = {
      ...tpl,
      id: `sug-${Math.random().toString(36).slice(2, 6)}`,
      age: 0,
      isNew: true,
    };
    setSuggestions(prev => [newSug, ...prev].slice(0, 14));

    // toast for high/crit
    if (newSug.priority === "critical" || newSug.priority === "high") {
      window.__emitToast?.({
        kind: "agent",
        title: `Co-Pilot · ${SUGGESTION_TYPES[newSug.type].ru}`,
        body: newSug.title,
        meta: `Confidence ${newSug.confidence}% · ${newSug.sourceAgents.join(", ")}`,
      });
    }
  }, 32000);

  // increment age
  useInterval(() => {
    setSuggestions(prev => prev.map(s => ({ ...s, age: s.age + 1, isNew: false })));
  }, 60000);

  function dismiss(id) {
    setDismissed(prev => new Set([...prev, id]));
    setTimeout(() => {
      setSuggestions(prev => prev.filter(s => s.id !== id));
      setDismissed(prev => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
    }, 200);
  }

  function refresh() {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1100);
  }

  const visible = useMemo(() => {
    return suggestions
      .filter(s => filter === "all" || s.type === filter)
      .sort((a, b) => PRIORITIES[b.priority].weight - PRIORITIES[a.priority].weight);
  }, [suggestions, filter]);

  const counts = useMemo(() => {
    const crit = suggestions.filter(s => s.priority === "critical").length;
    const high = suggestions.filter(s => s.priority === "high").length;
    return { crit, high, total: suggestions.length };
  }, [suggestions]);

  return (
    <>
      {/* Floating toggle */}
      <button onClick={() => setOpen(o => !o)} style={{
        position: "fixed", bottom: 16, right: 16,
        width: 48, height: 48,
        borderRadius: 6,
        background: open ? "var(--bg-2)" : "var(--bg-1)",
        border: "1px solid oklch(0.72 0.18 var(--accent-h2) / 0.6)",
        color: "var(--accent-2)",
        fontSize: 18, fontWeight: 600,
        cursor: "pointer",
        zIndex: 9989,
        boxShadow: "0 0 18px -4px oklch(0.72 0.18 var(--accent-h2) / 0.5), 0 4px 12px -2px oklch(0 0 0 / 0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "var(--font-mono)",
        transition: "all 0.15s",
      }}>
        {open ? "✕" : "◉"}
        {!open && counts.crit + counts.high > 0 && (
          <span style={{
            position: "absolute", top: -3, right: -3,
            minWidth: 17, height: 17, padding: "0 4px",
            borderRadius: 9,
            background: counts.crit > 0 ? "var(--red)" : "var(--amber)",
            color: "var(--bg-0)",
            fontFamily: "var(--font-mono)", fontSize: 9.5, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: counts.crit > 0 ? "0 0 8px var(--red)" : "0 0 6px var(--amber)",
          }}>{counts.crit + counts.high}</span>
        )}
        {!open && (
          <span style={{
            position: "absolute", inset: -2,
            borderRadius: 6,
            border: "1px solid oklch(0.72 0.18 var(--accent-h2) / 0.4)",
            animation: "pulse calc(2.4s / var(--speed)) ease-out infinite",
            zIndex: -1,
          }} />
        )}
      </button>

      {open && (
        <div style={{
          position: "fixed", bottom: 76, right: 16,
          width: 460, maxHeight: "80vh",
          background: "var(--bg-1)",
          border: "1px solid var(--line-bright)",
          borderRadius: 8,
          boxShadow: "0 24px 60px -12px oklch(0 0 0 / 0.7), 0 0 24px -6px oklch(0.72 0.18 var(--accent-h2) / 0.4)",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
          zIndex: 9988,
          animation: "assistantIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
        }}>
          {/* Header */}
          <header style={{
            padding: "10px 14px",
            borderBottom: "1px solid var(--line)",
            background: "var(--bg-2)",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 4,
              background: "var(--bg-0)",
              border: "1px solid oklch(0.72 0.18 var(--accent-h2) / 0.6)",
              color: "var(--accent-2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700,
              boxShadow: "0 0 12px -3px oklch(0.72 0.18 var(--accent-h2) / 0.5)",
            }}>◉</div>
            <div>
              <div style={{ fontSize: 12, color: "var(--text-bright)", fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                AI CO-PILOT <PulseDot size={5} color="var(--accent-2)" />
              </div>
              <div className="mono" style={{ fontSize: 9.5, color: "var(--text-dim)", letterSpacing: 0.06 }}>
                {counts.total} рекомендаций · {counts.crit} крит. · {counts.high} высок.
              </div>
            </div>
            <button onClick={refresh} style={{
              marginLeft: "auto",
              background: "transparent", border: "1px solid var(--line)",
              color: "var(--text-mid)", fontFamily: "var(--font-mono)",
              fontSize: 10, padding: "3px 8px", borderRadius: 3, cursor: "pointer",
            }}>
              {refreshing ? "⌛" : "⟳"} обновить
            </button>
            <button onClick={() => setOpen(false)} style={{
              background: "transparent", border: "none",
              color: "var(--text-dim)", fontSize: 16, cursor: "pointer", padding: 2,
            }}>✕</button>
          </header>

          {/* Filters */}
          <div style={{
            display: "flex", flexWrap: "wrap", gap: 4,
            padding: "8px 14px",
            borderBottom: "1px solid var(--line)",
            background: "var(--bg-0)",
          }}>
            <CpFilter active={filter === "all"} onClick={() => setFilter("all")} label="Все" count={counts.total} />
            {Object.entries(SUGGESTION_TYPES).map(([k, v]) => {
              const c = suggestions.filter(s => s.type === k).length;
              if (c === 0) return null;
              return <CpFilter key={k} active={filter === k} onClick={() => setFilter(k)} label={v.ru} count={c} color={v.color} />;
            })}
          </div>

          {/* List */}
          <div className="scroll" style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
            {visible.length === 0 && (
              <div style={{
                padding: "40px 20px", textAlign: "center",
                color: "var(--text-dim)", fontSize: 12,
                display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
              }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 24, opacity: 0.4 }}>—</span>
                Нет активных рекомендаций по фильтру
              </div>
            )}
            {visible.map(s => (
              <SuggestionCard key={s.id} s={s}
                dismissed={dismissed.has(s.id)}
                onDismiss={() => dismiss(s.id)}
                onAction={(act) => {
                  if (act.navigate) {
                    window.__navTo?.(act.navigate);
                    setOpen(false);
                  }
                  if (act.primary) dismiss(s.id);
                }}
              />
            ))}
          </div>

          {/* Footer */}
          <footer style={{
            padding: "7px 14px",
            borderTop: "1px solid var(--line)",
            background: "var(--bg-2)",
            display: "flex", alignItems: "center", gap: 8,
            fontFamily: "var(--font-mono)", fontSize: 10,
            color: "var(--text-dim)",
          }}>
            <span>↳ proactive engine · auto-refresh каждые 30с</span>
            <span style={{ marginLeft: "auto", color: "var(--accent-2)" }}>
              <PulseDot size={4} color="var(--accent-2)" /> online
            </span>
          </footer>
        </div>
      )}
    </>
  );
}

function CpFilter({ active, onClick, label, count, color }) {
  const c = color || "var(--accent-2)";
  return (
    <button onClick={onClick} style={{
      padding: "2px 8px",
      background: active ? `oklch(from ${c} l c h / 0.15)` : "transparent",
      color: active ? c : "var(--text-dim)",
      border: `1px solid ${active ? c : "var(--line)"}`,
      borderRadius: 2,
      fontFamily: "var(--font-mono)", fontSize: 9.5, fontWeight: 600,
      letterSpacing: 0.06, cursor: "pointer", textTransform: "uppercase",
      display: "inline-flex", alignItems: "center", gap: 4,
    }}>
      {label}
      <span style={{ color: active ? c : "var(--text-dim)", opacity: 0.7 }}>{count}</span>
    </button>
  );
}

function SuggestionCard({ s, dismissed, onDismiss, onAction }) {
  const type = SUGGESTION_TYPES[s.type];
  const prio = PRIORITIES[s.priority];
  const [expanded, setExpanded] = useState(s.priority === "critical");

  return (
    <div style={{
      padding: "10px 14px",
      borderBottom: "1px solid var(--line)",
      borderLeft: `3px solid ${prio.color}`,
      background: s.isNew ? `oklch(from ${type.color} l c h / 0.06)` : "transparent",
      opacity: dismissed ? 0 : 1,
      transform: dismissed ? "translateX(40px)" : "translateX(0)",
      transition: "opacity 0.2s, transform 0.2s, background 1.5s",
      display: "flex", flexDirection: "column", gap: 6,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700,
          color: prio.color, padding: "1px 5px",
          border: `1px solid ${prio.color}`, borderRadius: 2,
          letterSpacing: 0.08,
        }}>{prio.ru}</span>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600,
          color: type.color, letterSpacing: 0.08,
        }}>{type.glyph} {type.ru}</span>
        <span className="mono" style={{ marginLeft: "auto", fontSize: 9.5, color: "var(--text-dim)" }}>
          {s.age === 0 ? "сейчас" : s.age < 60 ? `${s.age}м` : `${Math.floor(s.age / 60)}ч`} назад
        </span>
        <button onClick={onDismiss} style={{
          background: "transparent", border: "none",
          color: "var(--text-dim)", fontSize: 11, cursor: "pointer", padding: 2,
          fontFamily: "var(--font-mono)",
        }}>✕</button>
      </div>

      {/* Title */}
      <div style={{ fontSize: 12.5, color: "var(--text-bright)", fontWeight: 500, lineHeight: 1.4 }}>
        {s.title}
      </div>

      {/* Body — collapsible */}
      <div style={{
        fontSize: 11.5, color: "var(--text-mid)", lineHeight: 1.5,
        maxHeight: expanded ? 200 : 38,
        overflow: "hidden",
        transition: "max-height 0.2s",
        position: "relative",
        cursor: "pointer",
      }} onClick={() => setExpanded(!expanded)}>
        {s.body}
        {!expanded && s.body.length > 100 && (
          <span style={{
            position: "absolute", bottom: 0, right: 0,
            background: "linear-gradient(to right, transparent, var(--bg-1) 40%)",
            paddingLeft: 24, color: "var(--accent-2)",
            fontFamily: "var(--font-mono)", fontSize: 10,
          }}>раскрыть ↓</span>
        )}
      </div>

      {/* Meta row */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
        fontFamily: "var(--font-mono)", fontSize: 10,
      }}>
        <span><span style={{ color: "var(--text-dim)" }}>conf:</span> <span style={{ color: s.confidence > 80 ? "var(--green)" : "var(--amber)" }}>{s.confidence}%</span></span>
        <span style={{ color: "var(--text-dim)" }}>·</span>
        <span><span style={{ color: "var(--text-dim)" }}>impact:</span> <span style={{ color: "var(--text)" }}>{s.impact}</span></span>
        <span style={{ color: "var(--text-dim)" }}>·</span>
        <span style={{ color: "var(--text-dim)" }}>{s.relevance}</span>
      </div>

      {/* Source agents */}
      <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
        {s.sourceAgents.map(a => (
          <span key={a} className="chip mono" style={{ fontSize: 9 }}>
            <span style={{ color: "var(--green)", marginRight: 3 }}>●</span>{a}
          </span>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
        {s.actions.map(a => (
          <button key={a.id} onClick={() => onAction(a)} style={{
            flex: a.primary ? 1 : 0,
            padding: "5px 10px",
            background: a.primary ? `oklch(from ${type.color} l c h / 0.15)` : "var(--bg-2)",
            color: a.primary ? type.color : "var(--text-mid)",
            border: `1px solid ${a.primary ? type.color : "var(--line)"}`,
            borderRadius: 3,
            fontFamily: "var(--font-ui)", fontSize: 11,
            fontWeight: a.primary ? 600 : 400,
            cursor: "pointer",
            letterSpacing: 0.02,
            transition: "all 0.1s",
          }}>{a.label}</button>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { CoPilot });