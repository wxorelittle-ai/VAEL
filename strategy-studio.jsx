/* strategy-studio.jsx — Visual strategy builder for AI trading signals */

const STRATEGY_BUILTIN = [
  { id: "ai-momentum", name: "AI Momentum + EMA", custom: false, last30d: 12.4, sharpe: 1.42, trades: 47, winRate: 64 },
  { id: "ai-mean-rev", name: "Reversion · v6.research",   custom: false, last30d: 8.2, sharpe: 1.18, trades: 92, winRate: 58 },
  { id: "ai-onchain",  name: "On-chain Whale Follower",   custom: false, last30d: 21.6, sharpe: 1.84, trades: 23, winRate: 78 },
  { id: "ai-news",     name: "News Sentiment Reactive",   custom: false, last30d: -3.2, sharpe: 0.42, trades: 38, winRate: 47 },
];

const SOURCE_TYPES = [
  { id: "price",   ru: "Цена и объём",         icon: "$",  desc: "Свечи, OHLCV, объём" },
  { id: "onchain", ru: "On-chain поток",       icon: "⬢",  desc: "Whale transfers, exchange flows" },
  { id: "news",    ru: "Новостной фид",        icon: "▤",  desc: "Sentiment, headlines, NER" },
  { id: "agent",   ru: "Агент-сигнал",         icon: "◆",  desc: "Strategy / Forecast / Risk agents" },
  { id: "social",  ru: "Социальный сигнал",    icon: "❉",  desc: "TG, X (Twitter), Reddit metrics" },
];

const INDICATOR_TYPES = [
  { id: "ema",    ru: "EMA (скользящая)",     params: ["period"], defaults: { period: 50 } },
  { id: "rsi",    ru: "RSI",                  params: ["period"], defaults: { period: 14 } },
  { id: "macd",   ru: "MACD",                 params: ["fast", "slow"], defaults: { fast: 12, slow: 26 } },
  { id: "vwap",   ru: "VWAP",                 params: [],         defaults: {} },
  { id: "vol",    ru: "Volume Profile",       params: ["window"], defaults: { window: 24 } },
  { id: "atr",    ru: "ATR (волатильность)",  params: ["period"], defaults: { period: 14 } },
];

const COND_OPS = [
  { id: "cross_above", ru: "пересекает сверху" },
  { id: "cross_below", ru: "пересекает снизу" },
  { id: "gt",          ru: ">" },
  { id: "lt",          ru: "<" },
  { id: "between",     ru: "в диапазоне" },
];

const EXIT_TYPES = [
  { id: "tp_sl",    ru: "Take Profit + Stop Loss" },
  { id: "trailing", ru: "Trailing Stop" },
  { id: "time",     ru: "Через N свечей" },
  { id: "signal",   ru: "Обратный сигнал" },
];

function StrategyStudio({ open, onClose, asset, lang, onSave }) {
  const [step, setStep] = useState(0); // 0..4
  const [strategy, setStrategy] = useState(() => makeNewStrategy());
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep(0);
      setStrategy(makeNewStrategy());
      setRunning(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const stepsConfig = [
    { id: 0, label: "1. ИСТОЧНИК", valid: () => strategy.sources.length > 0 },
    { id: 1, label: "2. ИНДИКАТОРЫ", valid: () => strategy.indicators.length > 0 },
    { id: 2, label: "3. ВХОД", valid: () => strategy.entry.length > 0 },
    { id: 3, label: "4. ВЫХОД", valid: () => strategy.exit !== null },
    { id: 4, label: "5. ОБЗОР", valid: () => strategy.name.trim().length > 0 },
  ];

  const canAdvance = stepsConfig[step].valid();

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0,
      background: "oklch(0 0 0 / 0.6)",
      backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
      zIndex: 9988,
      display: "flex", alignItems: "center", justifyContent: "center",
      animation: "cpFade 0.18s ease-out",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "min(1100px, 95vw)", height: "min(720px, 92vh)",
        background: "var(--bg-1)",
        border: "1px solid var(--line-bright)",
        borderRadius: 8,
        boxShadow: "0 24px 60px -12px oklch(0 0 0 / 0.7), var(--glow-strong)",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        animation: "cpScale 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
      }}>
        {/* HEADER */}
        <header style={{
          padding: "12px 18px",
          borderBottom: "1px solid var(--line)",
          background: "var(--bg-2)",
          display: "flex", alignItems: "center", gap: 14,
        }}>
          <div style={{
            width: 26, height: 26, borderRadius: 4,
            background: "var(--bg-0)",
            border: "1px solid oklch(0.78 0.16 var(--accent-h) / 0.6)",
            color: "var(--accent)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700,
            boxShadow: "var(--glow)",
          }}>S</div>
          <div>
            <div style={{ fontSize: 12, color: "var(--text-bright)", fontWeight: 500 }}>STRATEGY STUDIO</div>
            <div className="mono" style={{ fontSize: 9.5, color: "var(--text-dim)", letterSpacing: 0.06 }}>
              визуальная сборка торговой стратегии · {asset}
            </div>
          </div>

          {/* Steps */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 22 }}>
            {stepsConfig.map((s, i) => {
              const isActive = step === i;
              const isDone = step > i && stepsConfig[i].valid();
              return (
                <React.Fragment key={s.id}>
                  <button onClick={() => setStep(i)} style={{
                    padding: "4px 10px",
                    background: isActive ? "var(--accent-soft)" : isDone ? "oklch(0.78 0.16 155 / 0.1)" : "var(--bg-2)",
                    color: isActive ? "var(--accent)" : isDone ? "var(--green)" : "var(--text-dim)",
                    border: `1px solid ${isActive ? "oklch(0.78 0.16 var(--accent-h) / 0.4)" : isDone ? "oklch(0.78 0.16 155 / 0.3)" : "var(--line)"}`,
                    borderRadius: 3, cursor: "pointer",
                    fontFamily: "var(--font-mono)", fontSize: 9.5, fontWeight: 600,
                    letterSpacing: 0.06,
                  }}>{isDone && "✓ "}{s.label}</button>
                  {i < stepsConfig.length - 1 && (
                    <span style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>›</span>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          <button onClick={onClose} style={{
            marginLeft: "auto",
            background: "transparent", border: "none",
            color: "var(--text-dim)", fontSize: 16, cursor: "pointer", padding: 2,
          }}>✕</button>
        </header>

        {/* BODY */}
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1.4fr 1fr", minHeight: 0, overflow: "hidden" }}>
          {/* Left: builder */}
          <div className="scroll" style={{
            overflowY: "auto", padding: 18,
            borderRight: "1px solid var(--line)",
          }}>
            {step === 0 && <SourceStep strategy={strategy} setStrategy={setStrategy} />}
            {step === 1 && <IndicatorStep strategy={strategy} setStrategy={setStrategy} />}
            {step === 2 && <EntryStep strategy={strategy} setStrategy={setStrategy} />}
            {step === 3 && <ExitStep strategy={strategy} setStrategy={setStrategy} />}
            {step === 4 && <ReviewStep strategy={strategy} setStrategy={setStrategy} />}
          </div>

          {/* Right: preview */}
          <div className="scroll" style={{ overflowY: "auto", padding: 18, background: "var(--bg-0)" }}>
            <StrategyPreview strategy={strategy} asset={asset} step={step} />
          </div>
        </div>

        {/* FOOTER */}
        <footer style={{
          padding: "10px 18px",
          borderTop: "1px solid var(--line)",
          background: "var(--bg-2)",
          display: "flex", gap: 8, alignItems: "center",
        }}>
          <button onClick={onClose} className="btn">Отмена</button>
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)} className="btn">‹ Назад</button>
          )}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <span className="mono" style={{ fontSize: 10, color: "var(--text-dim)" }}>
              ШАГ {step + 1} / {stepsConfig.length}
            </span>
            {step < stepsConfig.length - 1 ? (
              <button onClick={() => setStep(s => s + 1)} className="btn btn-accent" disabled={!canAdvance}
                style={{ opacity: canAdvance ? 1 : 0.5, cursor: canAdvance ? "pointer" : "default" }}>
                Далее ›
              </button>
            ) : (
              <>
                <button className="btn">▸ Backtest</button>
                <button onClick={() => { onSave?.(strategy); onClose(); window.__emitToast?.({ kind: "agent", title: "Стратегия сохранена", body: `«${strategy.name}» добавлена в библиотеку`, meta: `ID: ${strategy.id}` }); }}
                  className="btn btn-accent" disabled={!canAdvance}>
                  ▸ Сохранить и развернуть
                </button>
              </>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

function makeNewStrategy() {
  return {
    id: `STR-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    name: "",
    sources: [],
    indicators: [],
    entry: [],
    exit: null,
  };
}

/* ─────── Step 1: Source ─────── */
function SourceStep({ strategy, setStrategy }) {
  const toggle = (id) => {
    setStrategy(s => ({
      ...s,
      sources: s.sources.includes(id) ? s.sources.filter(x => x !== id) : [...s.sources, id],
    }));
  };
  return (
    <StepShell title="Источники данных" subtitle="Выберите 1 или более потоков, которые будет анализировать стратегия">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {SOURCE_TYPES.map(s => {
          const on = strategy.sources.includes(s.id);
          return (
            <button key={s.id} onClick={() => toggle(s.id)} style={blockBtnStyle(on)}>
              <span style={glyphStyle(on)}>{s.icon}</span>
              <div style={{ minWidth: 0, textAlign: "left" }}>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: on ? "var(--accent)" : "var(--text-bright)" }}>
                  {s.ru}
                  {on && <span style={{ marginLeft: 6, color: "var(--accent)", fontSize: 11 }}>✓</span>}
                </div>
                <div style={{ fontSize: 10.5, color: "var(--text-mid)", marginTop: 2, lineHeight: 1.35 }}>{s.desc}</div>
              </div>
            </button>
          );
        })}
      </div>
      <Hint text={`Выбрано ${strategy.sources.length} источник(ов). Для AI-стратегии рекомендуется минимум: Цена + 1 контекстный источник.`} />
    </StepShell>
  );
}

/* ─────── Step 2: Indicators ─────── */
function IndicatorStep({ strategy, setStrategy }) {
  const addIndicator = (id) => {
    const def = INDICATOR_TYPES.find(x => x.id === id);
    setStrategy(s => ({
      ...s,
      indicators: [...s.indicators, { uid: Math.random().toString(36).slice(2, 6), id, params: { ...def.defaults } }],
    }));
  };
  const removeIndicator = (uid) => {
    setStrategy(s => ({ ...s, indicators: s.indicators.filter(i => i.uid !== uid) }));
  };
  const updateParam = (uid, key, val) => {
    setStrategy(s => ({
      ...s,
      indicators: s.indicators.map(i => i.uid === uid ? { ...i, params: { ...i.params, [key]: val } } : i),
    }));
  };

  return (
    <StepShell title="Технические индикаторы" subtitle="Добавьте индикаторы для анализа выбранных источников">
      {/* Add buttons */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {INDICATOR_TYPES.map(i => (
          <button key={i.id} onClick={() => addIndicator(i.id)} style={chipBtnStyle()}>
            + {i.ru}
          </button>
        ))}
      </div>

      {/* Added list */}
      {strategy.indicators.length === 0 && (
        <Hint text="Нет добавленных индикаторов. Кликните по чипу выше, чтобы добавить." />
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {strategy.indicators.map(ind => {
          const def = INDICATOR_TYPES.find(x => x.id === ind.id);
          return (
            <div key={ind.uid} style={{
              padding: "8px 12px",
              background: "var(--bg-2)", border: "1px solid var(--line)",
              borderLeft: "3px solid var(--accent)",
              borderRadius: 3,
              display: "grid", gridTemplateColumns: "1fr auto auto",
              gap: 10, alignItems: "center",
            }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-bright)" }}>{def.ru}</div>
                <div className="mono" style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>{ind.uid}</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {def.params.map(p => (
                  <label key={p} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 10, color: "var(--text-dim)" }}>{p}</span>
                    <input type="number" value={ind.params[p]}
                      onChange={e => updateParam(ind.uid, p, +e.target.value)}
                      style={{
                        width: 50, padding: "3px 6px",
                        background: "var(--bg-0)", border: "1px solid var(--line-bright)",
                        color: "var(--text-bright)", fontFamily: "var(--font-mono)", fontSize: 11,
                        outline: "none", borderRadius: 2,
                      }}
                    />
                  </label>
                ))}
              </div>
              <button onClick={() => removeIndicator(ind.uid)} style={{
                width: 22, height: 22, background: "var(--bg-0)",
                border: "1px solid var(--line)", color: "var(--text-dim)",
                cursor: "pointer", borderRadius: 2, fontFamily: "var(--font-mono)",
              }}>✕</button>
            </div>
          );
        })}
      </div>
    </StepShell>
  );
}

/* ─────── Step 3: Entry rules ─────── */
function EntryStep({ strategy, setStrategy }) {
  const addRule = () => {
    setStrategy(s => ({
      ...s,
      entry: [...s.entry, {
        uid: Math.random().toString(36).slice(2, 6),
        left: s.indicators[0]?.id || "price",
        op: "cross_above",
        right: "ema",
        rightValue: 50,
        connector: s.entry.length > 0 ? "AND" : null,
      }],
    }));
  };
  const removeRule = (uid) => setStrategy(s => ({ ...s, entry: s.entry.filter(r => r.uid !== uid) }));
  const updateRule = (uid, key, val) => setStrategy(s => ({
    ...s, entry: s.entry.map(r => r.uid === uid ? { ...r, [key]: val } : r),
  }));

  const sideOptions = [
    { id: "buy",  ru: "ЛОНГ (покупка)",  color: "var(--green)" },
    { id: "sell", ru: "ШОРТ (продажа)", color: "var(--red)" },
    { id: "both", ru: "Обе стороны",     color: "var(--accent)" },
  ];

  return (
    <StepShell title="Условия входа" subtitle="Когда стратегия должна открыть позицию">
      <div>
        <div style={fieldLabel}>Сторона позиций</div>
        <div style={{ display: "flex", gap: 4 }}>
          {sideOptions.map(o => {
            const on = (strategy.side || "buy") === o.id;
            return (
              <button key={o.id} onClick={() => setStrategy(s => ({ ...s, side: o.id }))} style={{
                flex: 1, padding: "8px 10px",
                background: on ? `oklch(from ${o.color} l c h / 0.15)` : "var(--bg-2)",
                color: on ? o.color : "var(--text-mid)",
                border: `1px solid ${on ? o.color : "var(--line)"}`,
                borderRadius: 3, cursor: "pointer",
                fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600,
                letterSpacing: 0.06,
              }}>{o.ru}</button>
            );
          })}
        </div>
      </div>

      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={fieldLabel}>Правила (срабатывают вместе через AND)</div>
          <button onClick={addRule} className="btn btn-accent" style={{ padding: "2px 8px", fontSize: 10 }}>
            + ПРАВИЛО
          </button>
        </div>
        {strategy.entry.length === 0 && (
          <Hint text="Кликните «+ ПРАВИЛО» чтобы добавить условие. Например: цена пересекает EMA50 сверху." />
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
          {strategy.entry.map((rule, i) => (
            <div key={rule.uid}>
              {i > 0 && (
                <div style={{ padding: "3px 0", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent-2)", fontWeight: 600, letterSpacing: 0.1 }}>
                  AND
                </div>
              )}
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr auto 1fr auto",
                gap: 6, alignItems: "center",
                padding: "6px 8px",
                background: "var(--bg-2)", border: "1px solid var(--line)",
                borderRadius: 3,
              }}>
                <select value={rule.left} onChange={e => updateRule(rule.uid, "left", e.target.value)} style={selectStyle}>
                  <option value="price">цена</option>
                  <option value="volume">объём</option>
                  {strategy.indicators.map(i => {
                    const def = INDICATOR_TYPES.find(x => x.id === i.id);
                    return <option key={i.uid} value={i.uid}>{def.ru} #{i.uid}</option>;
                  })}
                </select>
                <select value={rule.op} onChange={e => updateRule(rule.uid, "op", e.target.value)} style={selectStyle}>
                  {COND_OPS.map(o => <option key={o.id} value={o.id}>{o.ru}</option>)}
                </select>
                <select value={rule.right} onChange={e => updateRule(rule.uid, "right", e.target.value)} style={selectStyle}>
                  <option value="value">значение</option>
                  {strategy.indicators.map(i => {
                    const def = INDICATOR_TYPES.find(x => x.id === i.id);
                    return <option key={i.uid} value={i.uid}>{def.ru} #{i.uid}</option>;
                  })}
                </select>
                <button onClick={() => removeRule(rule.uid)} style={{
                  width: 22, height: 22, background: "var(--bg-0)",
                  border: "1px solid var(--line)", color: "var(--text-dim)",
                  cursor: "pointer", borderRadius: 2, fontFamily: "var(--font-mono)",
                }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div style={fieldLabel}>Минимальный confidence от AI</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input type="range" min={50} max={95} step={5} value={strategy.minConfidence || 75}
            onChange={e => setStrategy(s => ({ ...s, minConfidence: +e.target.value }))}
            style={{ flex: 1, accentColor: "var(--accent)" }} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--accent)", minWidth: 40 }}>
            {strategy.minConfidence || 75}%
          </span>
        </div>
      </div>
    </StepShell>
  );
}

/* ─────── Step 4: Exit ─────── */
function ExitStep({ strategy, setStrategy }) {
  const t = strategy.exit?.type || "tp_sl";
  return (
    <StepShell title="Условия выхода" subtitle="Когда стратегия должна закрыть позицию">
      <div>
        <div style={fieldLabel}>Тип выхода</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {EXIT_TYPES.map(e => {
            const on = t === e.id;
            return (
              <button key={e.id} onClick={() => setStrategy(s => ({ ...s, exit: { type: e.id, tp: 4, sl: 2, trailing: 1.5, candles: 12 } }))} style={blockBtnStyle(on)}>
                <span style={glyphStyle(on)}>{on ? "✓" : "○"}</span>
                <span style={{ fontSize: 12, color: on ? "var(--accent)" : "var(--text-bright)" }}>{e.ru}</span>
              </button>
            );
          })}
        </div>
      </div>

      {t === "tp_sl" && strategy.exit && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <PctInput label="Take Profit · %" value={strategy.exit.tp || 4} color="var(--green)"
            onChange={v => setStrategy(s => ({ ...s, exit: { ...s.exit, tp: v } }))} />
          <PctInput label="Stop Loss · %" value={strategy.exit.sl || 2} color="var(--red)"
            onChange={v => setStrategy(s => ({ ...s, exit: { ...s.exit, sl: v } }))} />
        </div>
      )}
      {t === "trailing" && strategy.exit && (
        <PctInput label="Trailing distance · %" value={strategy.exit.trailing || 1.5} color="var(--accent)"
          onChange={v => setStrategy(s => ({ ...s, exit: { ...s.exit, trailing: v } }))} />
      )}
      {t === "time" && strategy.exit && (
        <div>
          <div style={fieldLabel}>Закрыть через N свечей (1ч TF)</div>
          <input type="number" value={strategy.exit.candles || 12} min={1} max={200}
            onChange={e => setStrategy(s => ({ ...s, exit: { ...s.exit, candles: +e.target.value } }))}
            style={inputStyle} />
        </div>
      )}

      <div>
        <div style={fieldLabel}>Размер позиции</div>
        <div style={{ display: "flex", gap: 4 }}>
          {[{ v: "fixed", l: "Фикс. USD" }, { v: "pct", l: "% от капитала" }, { v: "kelly", l: "Kelly criterion" }].map(o => {
            const on = (strategy.sizing || "fixed") === o.v;
            return (
              <button key={o.v} onClick={() => setStrategy(s => ({ ...s, sizing: o.v }))} style={{
                flex: 1, padding: "6px 8px",
                background: on ? "var(--accent-soft)" : "var(--bg-2)",
                color: on ? "var(--accent)" : "var(--text-mid)",
                border: `1px solid ${on ? "oklch(0.78 0.16 var(--accent-h) / 0.4)" : "var(--line)"}`,
                fontFamily: "var(--font-mono)", fontSize: 10.5,
                borderRadius: 3, cursor: "pointer",
              }}>{o.l}</button>
            );
          })}
        </div>
      </div>
    </StepShell>
  );
}

/* ─────── Step 5: Review ─────── */
function ReviewStep({ strategy, setStrategy }) {
  return (
    <StepShell title="Обзор стратегии" subtitle="Финальная проверка перед сохранением">
      <div>
        <div style={fieldLabel}>Название стратегии</div>
        <input value={strategy.name} onChange={e => setStrategy(s => ({ ...s, name: e.target.value }))}
          placeholder="Например: ETH Momentum · 1h · AI v3"
          style={{ ...inputStyle, fontFamily: "var(--font-ui)", fontSize: 13 }} />
      </div>

      <div style={{
        background: "var(--bg-0)",
        border: "1px solid var(--line)",
        borderRadius: 4,
        padding: 14,
        display: "flex", flexDirection: "column", gap: 10,
      }}>
        <ReviewRow label="ID" value={<span className="mono">{strategy.id}</span>} />
        <ReviewRow label="Источники" value={
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {strategy.sources.map(s => {
              const def = SOURCE_TYPES.find(x => x.id === s);
              return <span key={s} className="chip">{def.icon} {def.ru}</span>;
            })}
          </div>
        } />
        <ReviewRow label={`Индикаторы (${strategy.indicators.length})`} value={
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {strategy.indicators.map(i => {
              const def = INDICATOR_TYPES.find(x => x.id === i.id);
              return <span key={i.uid} className="chip chip-accent" style={{ fontSize: 10 }}>
                {def.ru}{Object.values(i.params).length > 0 && ` (${Object.values(i.params).join(",")})`}
              </span>;
            })}
          </div>
        } />
        <ReviewRow label="Сторона" value={
          <span className="mono" style={{ color: strategy.side === "sell" ? "var(--red)" : "var(--green)" }}>
            {strategy.side === "sell" ? "SHORT" : strategy.side === "both" ? "BOTH" : "LONG"}
          </span>
        } />
        <ReviewRow label="Правила входа" value={
          <span className="mono" style={{ fontSize: 11 }}>
            {strategy.entry.length} {strategy.entry.length === 1 ? "правило" : "правил"} · AND · min conf {strategy.minConfidence || 75}%
          </span>
        } />
        <ReviewRow label="Выход" value={
          <span className="mono" style={{ fontSize: 11 }}>
            {EXIT_TYPES.find(e => e.id === strategy.exit?.type)?.ru || "—"}
            {strategy.exit?.type === "tp_sl" && ` · TP ${strategy.exit.tp}% / SL ${strategy.exit.sl}%`}
            {strategy.exit?.type === "trailing" && ` · ${strategy.exit.trailing}%`}
          </span>
        } />
      </div>

      <Hint text="✓ Все блоки готовы. Нажмите «Сохранить и развернуть» — стратегия появится в библиотеке и подключится к strategy.agt для генерации live-сигналов." />
    </StepShell>
  );
}

function ReviewRow({ label, value }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 10, alignItems: "center" }}>
      <span style={{ fontSize: 10.5, color: "var(--text-dim)", letterSpacing: 0.06, textTransform: "uppercase", fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 12, color: "var(--text)" }}>{value}</span>
    </div>
  );
}

/* ─────── Preview ─────── */
function StrategyPreview({ strategy, asset, step }) {
  const candles = useMemo(() => genTrendCandles(50, 2408, 0.012), [asset]);
  // simulate strategy markers
  const markers = useMemo(() => {
    if (!strategy.entry.length) return [];
    const out = [];
    candles.forEach((c, i) => {
      if (i < 8) return;
      // mock condition: emaCross + RSI
      const isEntry = Math.sin(i * 0.5) > 0.4 && Math.random() < 0.18;
      if (isEntry) {
        out.push({ idx: i, side: strategy.side === "sell" ? "sell" : "buy", price: c.close });
      }
    });
    return out.slice(0, 8);
  }, [strategy.entry, strategy.side, candles]);

  // EMA50 overlay if applicable
  const ema = useMemo(() => {
    if (!strategy.indicators.find(i => i.id === "ema")) return null;
    const period = strategy.indicators.find(i => i.id === "ema")?.params?.period || 50;
    const arr = [];
    let avg = candles[0].close;
    candles.forEach((c, i) => {
      const k = 2 / (period + 1);
      avg = c.close * k + avg * (1 - k);
      arr.push(avg);
    });
    return arr;
  }, [candles, strategy.indicators]);

  // RSI overlay (mock)
  const rsi = useMemo(() => {
    if (!strategy.indicators.find(i => i.id === "rsi")) return null;
    return Array.from({ length: candles.length }, (_, i) => 30 + Math.sin(i * 0.4) * 25 + Math.cos(i * 0.21) * 12 + 50);
  }, [candles, strategy.indicators]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div style={fieldLabel}>LIVE PREVIEW · {asset}</div>
        <div style={{
          background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: 4,
          padding: 8,
        }}>
          <PreviewChart candles={candles} ema={ema} markers={markers} width={400} height={200} />
          {rsi && (
            <div style={{ marginTop: 4 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", marginBottom: 2 }}>RSI {strategy.indicators.find(i => i.id === "rsi").params.period}</div>
              <PreviewRsi data={rsi} width={400} height={50} />
            </div>
          )}
        </div>
      </div>

      <div>
        <div style={fieldLabel}>Симулированная производительность</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4 }}>
          <PreviewStat label="ROI · 30д" v={`+${(8 + strategy.entry.length * 2.4 + strategy.indicators.length * 1.2).toFixed(1)}%`} c="var(--green)" />
          <PreviewStat label="SHARPE" v={(1.0 + strategy.indicators.length * 0.18).toFixed(2)} c="var(--accent)" />
          <PreviewStat label="WIN RATE" v={`${52 + strategy.indicators.length * 2}%`} c="var(--green)" />
          <PreviewStat label="СДЕЛОК" v={markers.length * 6} c="var(--text-bright)" />
        </div>
        <div className="mono" style={{ fontSize: 9.5, color: "var(--text-dim)", marginTop: 6 }}>
          ≈ оценка на основе исторических данных за 30 дней
        </div>
      </div>

      {/* Logic recap */}
      <div>
        <div style={fieldLabel}>Логика</div>
        <div style={{
          background: "var(--bg-1)", border: "1px solid var(--line)",
          borderRadius: 4, padding: 10,
          fontFamily: "var(--font-mono)", fontSize: 10.5, lineHeight: 1.7,
          color: "var(--text-mid)",
        }}>
          <div><span style={{ color: "var(--accent-2)" }}>WHEN</span> <span style={{ color: "var(--accent)" }}>{strategy.sources.join(" + ") || "..."}</span> updated</div>
          <div><span style={{ color: "var(--accent-2)" }}>EVAL</span> {strategy.indicators.length || "..."} indicator(s)</div>
          <div><span style={{ color: "var(--accent-2)" }}>IF</span> {strategy.entry.length || "..."} entry rule(s) {strategy.entry.length > 1 ? "(AND)" : ""} AND confidence ≥ {strategy.minConfidence || 75}%</div>
          <div><span style={{ color: "var(--accent-2)" }}>THEN</span> open <span style={{ color: strategy.side === "sell" ? "var(--red)" : "var(--green)" }}>{(strategy.side || "buy").toUpperCase()}</span> position</div>
          <div><span style={{ color: "var(--accent-2)" }}>EXIT</span> {EXIT_TYPES.find(e => e.id === strategy.exit?.type)?.ru || "..."}</div>
        </div>
      </div>
    </div>
  );
}

function PreviewChart({ candles, ema, markers, width = 400, height = 200 }) {
  const min = Math.min(...candles.map(c => c.lo));
  const max = Math.max(...candles.map(c => c.hi));
  const range = (max - min) || 1;
  const stepX = width / candles.length;
  const candleW = Math.max(2, stepX * 0.6);
  const y = v => 8 + (1 - (v - min) / range) * (height - 16);

  const emaPath = ema ? ema.map((v, i) => `${i === 0 ? "M" : "L"}${i * stepX + stepX/2},${y(v)}`).join(" ") : null;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: "block" }}>
      {candles.map((c, i) => {
        const cx = i * stepX + stepX / 2;
        const up = c.close >= c.open;
        const color = up ? "var(--green)" : "var(--red)";
        return (
          <g key={i}>
            <line x1={cx} y1={y(c.hi)} x2={cx} y2={y(c.lo)} stroke={color} strokeWidth={0.6} />
            <rect x={cx - candleW / 2} y={y(Math.max(c.open, c.close))}
              width={candleW} height={Math.max(0.8, Math.abs(y(c.open) - y(c.close)))}
              fill={up ? "transparent" : color} stroke={color} strokeWidth={0.8} />
          </g>
        );
      })}
      {emaPath && (
        <path d={emaPath} fill="none" stroke="var(--accent)" strokeWidth={1.2} strokeDasharray="0" opacity={0.85} />
      )}
      {markers.map((m, i) => {
        const cx = m.idx * stepX + stepX / 2;
        const cy = y(m.price);
        const color = m.side === "buy" ? "var(--green)" : "var(--red)";
        const yPos = m.side === "buy" ? cy + 10 : cy - 10;
        const tri = m.side === "buy"
          ? `M${cx},${yPos - 5} L${cx-4},${yPos+2} L${cx+4},${yPos+2} Z`
          : `M${cx},${yPos + 5} L${cx-4},${yPos-2} L${cx+4},${yPos-2} Z`;
        return <path key={i} d={tri} fill={color} />;
      })}
    </svg>
  );
}

function PreviewRsi({ data, width = 400, height = 50 }) {
  const stepX = width / (data.length - 1);
  const y = v => 4 + (1 - v / 100) * (height - 8);
  const path = data.map((v, i) => `${i === 0 ? "M" : "L"}${i * stepX},${y(v)}`).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: "block" }}>
      <line x1={0} y1={y(70)} x2={width} y2={y(70)} stroke="var(--red)" strokeWidth={0.5} strokeDasharray="2 3" opacity={0.5} />
      <line x1={0} y1={y(30)} x2={width} y2={y(30)} stroke="var(--green)" strokeWidth={0.5} strokeDasharray="2 3" opacity={0.5} />
      <path d={path} fill="none" stroke="var(--accent-2)" strokeWidth={1} />
    </svg>
  );
}

function PreviewStat({ label, v, c }) {
  return (
    <div style={{ background: "var(--bg-1)", border: "1px solid var(--line)", padding: "6px 8px", borderRadius: 3 }}>
      <div style={{ fontSize: 8.5, color: "var(--text-dim)", letterSpacing: 0.12, fontWeight: 600 }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: c, marginTop: 1 }}>{v}</div>
    </div>
  );
}

/* shared bits */
function StepShell({ title, subtitle, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-bright)" }}>{title}</div>
        <div style={{ fontSize: 11.5, color: "var(--text-mid)", marginTop: 2, lineHeight: 1.4 }}>{subtitle}</div>
      </div>
      {children}
    </div>
  );
}

function Hint({ text }) {
  return (
    <div style={{
      background: "var(--bg-2)", padding: "8px 10px", borderRadius: 3,
      border: "1px dashed var(--line-bright)",
      fontSize: 11, color: "var(--text-mid)", lineHeight: 1.5,
    }}>
      <span className="accent">↳ </span>{text}
    </div>
  );
}

function PctInput({ label, value, color, onChange }) {
  return (
    <div>
      <div style={fieldLabel}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input type="range" min={0.5} max={20} step={0.1} value={value}
          onChange={e => onChange(+e.target.value)}
          style={{ flex: 1, accentColor: color }} />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, color, minWidth: 50, textAlign: "right" }}>
          {value.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

const fieldLabel = {
  fontSize: 9.5, fontWeight: 600, letterSpacing: 0.15,
  textTransform: "uppercase", color: "var(--text-dim)",
  marginBottom: 6,
};

const inputStyle = {
  width: "100%", padding: "7px 10px",
  background: "var(--bg-0)", border: "1px solid var(--line-bright)",
  color: "var(--text-bright)", fontFamily: "var(--font-mono)", fontSize: 12,
  outline: "none", borderRadius: 3,
};

const selectStyle = {
  padding: "5px 7px",
  background: "var(--bg-0)", border: "1px solid var(--line-bright)",
  color: "var(--text-bright)", fontFamily: "var(--font-mono)", fontSize: 11,
  outline: "none", borderRadius: 2, cursor: "pointer",
};

const chipBtnStyle = () => ({
  padding: "4px 10px",
  background: "var(--bg-2)", border: "1px solid var(--line)",
  color: "var(--text-mid)",
  fontFamily: "var(--font-mono)", fontSize: 10.5,
  borderRadius: 3, cursor: "pointer",
  transition: "all 0.1s",
});

const blockBtnStyle = (on) => ({
  display: "flex", alignItems: "center", gap: 10,
  padding: "10px 12px",
  background: on ? "var(--accent-soft)" : "var(--bg-2)",
  border: `1px solid ${on ? "oklch(0.78 0.16 var(--accent-h) / 0.5)" : "var(--line)"}`,
  borderRadius: 3, cursor: "pointer",
  textAlign: "left",
  transition: "all 0.1s",
});

const glyphStyle = (on) => ({
  width: 30, height: 30, borderRadius: 3,
  background: on ? "var(--bg-0)" : "var(--bg-3)",
  border: `1px solid ${on ? "var(--accent)" : "var(--line)"}`,
  color: on ? "var(--accent)" : "var(--text-dim)",
  display: "flex", alignItems: "center", justifyContent: "center",
  fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700,
  flexShrink: 0,
});

Object.assign(window, { StrategyStudio, STRATEGY_BUILTIN });