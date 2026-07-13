/* assistant.jsx — VAEL AI Assistant chat panel with real claude.complete integration */

const ASSISTANT_GREETINGS = [
  "VAEL готов. Я вижу 12 агентов в сети, 6 активных миссий и 7 алертов. Чем помочь?",
  "Подключён к ядру v6.2.41. Сеть стабильна, latency 42ms. Спросите про сигналы, позиции или анализ.",
  "AI-оператор VAEL на связи. Могу объяснить решения агентов, проанализировать сигнал, рассказать про миссию.",
];

const SYSTEM_CONTEXT = `Ты VAEL — AI-оператор крипто-аналитической платформы агентов. Отвечай кратко (1-4 предложения), технологично, на русском.

Контекст системы:
- 12 агентов: Planner (декомпозиция миссий), Executor (выполнение), Critic (верификация), Research (поиск), News (парсинг новостей), OnChain (анализ блокчейна), Alert (уведомления), Forecast (прогнозы), Strategy (торговые стратегии), Risk (риск-оценка), Memory (долгосрочная память), AutoFix (восстановление).
- Активные миссии: M-2841 (сканирование whale-кошельков ETH, прогресс 67%), M-2840 (анализ настроений L2, 42%), M-2839 (backtest стратегии #14, 91%), M-2836 (мониторинг бридж-контрактов).
- Watchlist: 10 кошельков, 3 помечены как подозрительные (0xdead...beef, TKL2...M3kp, 0x91a4...4f02).
- Алерты: 7 активных, включая критическое движение 12800 ETH в CEX от whale-кошелька 0x7a2c.
- Векторная память: 2.4M embeddings, 847 entities, 14 индексов.
- Текущий AI Confidence: ~87%, точность сигналов 60-70% на исторических данных.

Стиль: точный, без эмоций, используй термины (confidence, sentiment, drawdown, latency, sigma, whale). Если вопрос вне домена (общие темы, болтовня) — мягко возвращай к работе платформы.`;

const SUGGESTED_QUERIES = [
  "Что показывает текущий сигнал?",
  "Объясни последнюю критическую тревогу",
  "Какие миссии сейчас идут?",
  "Что такое risk score 92?",
  "Какие агенты сейчас неактивны?",
  "Как работает планировщик миссий?",
];

function nowMsgTs() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

function AssistantChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(() => [
    { role: "assistant", content: pick(ASSISTANT_GREETINGS), ts: nowMsgTs() },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // expose global so other UI can ping the assistant
  useEffect(() => {
    window.__openAssistant = () => { setOpen(true); setUnread(0); };
    window.__assistantSay = (text) => {
      setMessages(prev => [...prev, { role: "system", content: text, ts: nowMsgTs() }]);
      if (!open) setUnread(u => u + 1);
    };
  }, [open]);

  // scroll on new message
  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open, loading]);

  // focus on open
  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  async function send(text) {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    const userMsg = { role: "user", content, ts: nowMsgTs() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const conversation = messages
        .filter(m => m.role !== "system")
        .slice(-6)
        .map(m => `${m.role === "user" ? "Пользователь" : "VAEL"}: ${m.content}`)
        .join("\n\n");
      const prompt = `${SYSTEM_CONTEXT}\n\n${conversation ? "Контекст диалога:\n" + conversation + "\n\n" : ""}Пользователь: ${content}\n\nVAEL (краткий ответ, 1-4 предложения):`;
      const response = await window.claude.complete(prompt);
      setMessages(prev => [...prev, { role: "assistant", content: response.trim(), ts: nowMsgTs() }]);
    } catch (e) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Соединение с моделью прервано. Повторите запрос или проверьте статус WS.",
        ts: nowMsgTs(),
        error: true,
      }]);
    }
    setLoading(false);
  }

  function onKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <>
      {/* Floating toggle */}
      <button onClick={() => setOpen(o => !o)} style={{
        position: "fixed", bottom: 16, left: 16,
        width: 46, height: 46,
        borderRadius: "50%",
        background: open ? "var(--bg-2)" : "var(--bg-1)",
        border: "1px solid oklch(0.78 0.16 var(--accent-h) / 0.6)",
        color: "var(--accent)",
        fontSize: 18, fontWeight: 600,
        cursor: "pointer",
        zIndex: 9989,
        boxShadow: "var(--glow), 0 4px 12px -2px oklch(0 0 0 / 0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "var(--font-mono)",
        position: "fixed",
        transition: "all 0.15s",
      }}>
        {open ? "✕" : "◆"}
        {!open && unread > 0 && (
          <span style={{
            position: "absolute", top: -2, right: -2,
            minWidth: 16, height: 16, padding: "0 4px",
            borderRadius: 8,
            background: "var(--red)", color: "var(--bg-0)",
            fontFamily: "var(--font-mono)", fontSize: 9.5, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>{unread}</span>
        )}
        {!open && (
          <span style={{
            position: "absolute", inset: -3,
            borderRadius: "50%",
            background: "oklch(0.78 0.16 var(--accent-h) / 0.4)",
            animation: "pulse calc(2.4s / var(--speed)) ease-out infinite",
            zIndex: -1,
          }} />
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div style={{
          position: "fixed", bottom: 72, left: 16,
          width: 420, height: 520,
          background: "var(--bg-1)",
          border: "1px solid var(--line-bright)",
          borderRadius: 8,
          boxShadow: "0 24px 60px -12px oklch(0 0 0 / 0.7), var(--glow-strong)",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
          zIndex: 9988,
          animation: "assistantIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
        }}>
          {/* Header */}
          <header style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 14px",
            borderBottom: "1px solid var(--line)",
            background: "var(--bg-2)",
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 4,
              background: "var(--bg-0)",
              border: "1px solid oklch(0.78 0.16 var(--accent-h) / 0.6)",
              color: "var(--accent)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700,
              boxShadow: "var(--glow)",
            }}>VAEL</div>
            <div>
              <div style={{ fontSize: 12, color: "var(--text-bright)", fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                VAEL ASSISTANT <PulseDot size={5} color="var(--green)" />
              </div>
              <div className="mono" style={{ fontSize: 9.5, color: "var(--text-dim)", letterSpacing: 0.06 }}>
                claude · ядро 6.2.41 · online
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={{
              marginLeft: "auto",
              background: "transparent", border: "none",
              color: "var(--text-dim)", fontSize: 16, cursor: "pointer", padding: 2,
            }}>✕</button>
          </header>

          {/* Messages */}
          <div ref={scrollRef} className="scroll" style={{
            flex: 1, padding: "12px 14px",
            overflowY: "auto",
            display: "flex", flexDirection: "column", gap: 10,
            background: "var(--bg-0)",
            backgroundImage: "linear-gradient(to right, oklch(0.78 0.16 var(--accent-h) / 0.015) 1px, transparent 1px), linear-gradient(to bottom, oklch(0.78 0.16 var(--accent-h) / 0.015) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}>
            {messages.map((m, i) => <Message key={i} m={m} />)}
            {loading && <ThinkingMessage />}

            {/* Suggested queries appear only at start */}
            {messages.length <= 1 && !loading && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 9.5, color: "var(--text-dim)", letterSpacing: 0.15, fontWeight: 600, textTransform: "uppercase", marginBottom: 6 }}>
                  ↳ предложения
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {SUGGESTED_QUERIES.map(q => (
                    <button key={q} onClick={() => send(q)} style={{
                      padding: "6px 10px",
                      background: "var(--bg-1)",
                      border: "1px solid var(--line)",
                      color: "var(--text-mid)",
                      fontFamily: "var(--font-ui)", fontSize: 11.5,
                      textAlign: "left", cursor: "pointer",
                      borderRadius: 3,
                      transition: "all 0.1s",
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = "var(--accent-soft)";
                      e.currentTarget.style.color = "var(--accent)";
                      e.currentTarget.style.borderColor = "oklch(0.78 0.16 var(--accent-h) / 0.4)";
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = "var(--bg-1)";
                      e.currentTarget.style.color = "var(--text-mid)";
                      e.currentTarget.style.borderColor = "var(--line)";
                    }}
                    >› {q}</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <footer style={{
            padding: "8px 12px",
            borderTop: "1px solid var(--line)",
            background: "var(--bg-2)",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ color: "var(--accent)", fontFamily: "var(--font-mono)", fontSize: 12 }}>›</span>
            <input ref={inputRef}
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder="спросите про систему..."
              disabled={loading}
              style={{
                flex: 1, background: "transparent", border: "none",
                color: "var(--text-bright)", fontFamily: "var(--font-ui)", fontSize: 12.5,
                outline: "none",
              }}
            />
            <button onClick={() => send()} disabled={loading || !input.trim()} style={{
              padding: "4px 10px",
              background: input.trim() && !loading ? "var(--accent-soft)" : "var(--bg-3)",
              color: input.trim() && !loading ? "var(--accent)" : "var(--text-dim)",
              border: `1px solid ${input.trim() && !loading ? "oklch(0.78 0.16 var(--accent-h) / 0.4)" : "var(--line)"}`,
              fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600,
              borderRadius: 3, cursor: input.trim() && !loading ? "pointer" : "default",
              letterSpacing: 0.06,
            }}>↵</button>
          </footer>
        </div>
      )}
    </>
  );
}

function Message({ m }) {
  const isUser = m.role === "user";
  const isSystem = m.role === "system";
  const isAssistant = m.role === "assistant";
  if (isSystem) {
    return (
      <div style={{
        fontFamily: "var(--font-mono)", fontSize: 10.5,
        color: "var(--text-dim)", letterSpacing: 0.06,
        textAlign: "center", padding: "4px 8px",
        borderTop: "1px dashed var(--line)",
        borderBottom: "1px dashed var(--line)",
        margin: "4px 0",
      }}>
        ⌖ {m.content} · {m.ts}
      </div>
    );
  }
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: isUser ? "flex-end" : "flex-start",
      gap: 2,
    }}>
      <div style={{
        display: "flex", alignItems: "baseline", gap: 6,
        flexDirection: isUser ? "row-reverse" : "row",
      }}>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 9.5, fontWeight: 600,
          color: isUser ? "var(--text-mid)" : "var(--accent)",
          letterSpacing: 0.08,
        }}>{isUser ? "ВЫ" : "VAEL"}</span>
        <span className="mono" style={{ fontSize: 9, color: "var(--text-dim)" }}>{m.ts}</span>
      </div>
      <div style={{
        maxWidth: "85%",
        padding: "8px 12px",
        background: isUser ? "var(--accent-soft)" : "var(--bg-1)",
        border: `1px solid ${isUser ? "oklch(0.78 0.16 var(--accent-h) / 0.4)" : m.error ? "oklch(0.70 0.20 25 / 0.4)" : "var(--line)"}`,
        borderRadius: 4,
        fontSize: 12.5,
        color: m.error ? "var(--red)" : isUser ? "var(--text-bright)" : "var(--text)",
        lineHeight: 1.5,
        whiteSpace: "pre-wrap",
      }}>
        {m.content}
      </div>
    </div>
  );
}

function ThinkingMessage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
      <span style={{
        fontFamily: "var(--font-mono)", fontSize: 9.5, fontWeight: 600,
        color: "var(--accent)", letterSpacing: 0.08,
      }}>VAEL</span>
      <div style={{
        padding: "8px 12px",
        background: "var(--bg-1)",
        border: "1px solid var(--line)",
        borderRadius: 4,
        fontSize: 12.5, color: "var(--text-mid)",
        display: "flex", alignItems: "center", gap: 6,
        fontFamily: "var(--font-mono)",
      }}>
        <span style={{ display: "inline-flex", gap: 3 }}>
          <ThinkDot delay={0} />
          <ThinkDot delay={0.18} />
          <ThinkDot delay={0.36} />
        </span>
        <span style={{ fontSize: 11, color: "var(--text-dim)" }}>анализ контекста…</span>
      </div>
    </div>
  );
}

function ThinkDot({ delay }) {
  return (
    <span style={{
      width: 5, height: 5, borderRadius: "50%",
      background: "var(--accent)",
      animation: `thinkBounce 1.2s ease-in-out infinite`,
      animationDelay: `${delay}s`,
      display: "inline-block",
    }} />
  );
}

if (typeof document !== "undefined" && !document.getElementById("__assistant_kf")) {
  const s = document.createElement("style");
  s.id = "__assistant_kf";
  s.textContent = `
    @keyframes assistantIn {
      0% { transform: translateY(20px) scale(0.97); opacity: 0; }
      100% { transform: translateY(0) scale(1); opacity: 1; }
    }
    @keyframes thinkBounce {
      0%, 80%, 100% { transform: scale(0.5); opacity: 0.4; }
      40% { transform: scale(1.2); opacity: 1; }
    }
  `;
  document.head.appendChild(s);
}

Object.assign(window, { AssistantChat });