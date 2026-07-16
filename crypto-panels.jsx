/* crypto-panels.jsx — the terminal's presentational furniture, extracted from
 * crypto.jsx: modals, the signal/plan cards, the manual trade form, the derivatives
 * strip and the small atoms they share. None of it owns terminal state — it is all
 * driven by props — so it lives better beside the panel than inside it.
 *
 * Also home to the trading constants (FEE_RATE / tradeFee) and the budget accessor,
 * because the form and the tables both need them and neither should reach into the
 * panel for them. Exposed on window; loaded before crypto.jsx. */

/* ─── Monte Carlo forecast modal — probability cone from real Bybit volatility ─── */
function MonteCarloModal({ open, onClose, candles, asset, price }) {
  const [horizon, setHorizon] = useState(24);
  const [runId, setRunId] = useState(0);
  const [fc, setFc] = useState(null);

  useEffect(() => {
    if (!open) return;
    if (typeof monteCarloForecast !== "function" || !candles || candles.length < 20) { setFc(null); return; }
    setFc(monteCarloForecast(candles, horizon, 400));
    // deliberately not depending on `candles` ticks — a stable cone the user re-runs
    // eslint-disable-next-line
  }, [open, horizon, runId]);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;
  const dec = price < 10 ? 3 : price < 1000 ? 2 : 1;
  const upColor = fc && fc.probUp >= 0.5 ? "var(--green)" : "var(--red)";

  // SVG cone
  const W = 660, H = 300, padL = 8, padR = 8, padT = 12, padB = 22;
  let chart = null;
  if (fc) {
    const hist = candles.slice(-20).map(c => c.close);
    const cone = fc.steps;
    const lows = [...hist, ...cone.map(s => s.p5), fc.S0];
    const highs = [...hist, ...cone.map(s => s.p95), fc.S0];
    const lo = Math.min(...lows), hi = Math.max(...highs), range = (hi - lo) || 1;
    const totalN = hist.length + cone.length;
    const x = i => padL + (i / (totalN - 1)) * (W - padL - padR);
    const y = v => padT + (1 - (v - lo) / range) * (H - padT - padB);
    const ci = t => hist.length + t;               // x-index of cone step t
    const nowX = x(hist.length - 1), nowY = y(fc.S0);

    const band = (loKey, hiKey) => {
      const top = cone.map((s, t) => `${x(ci(t))},${y(s[hiKey])}`);
      const bot = cone.map((s, t) => `${x(ci(t))},${y(s[loKey])}`).reverse();
      return `M${nowX},${nowY} L${top.join(" L")} L${bot.join(" L")} L${nowX},${nowY} Z`;
    };
    const medianPath = `M${nowX},${nowY} ` + cone.map((s, t) => `L${x(ci(t))},${y(s.p50)}`).join(" ");
    const histPath = hist.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");

    chart = (
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: "block", background: "var(--bg-1)", borderRadius: 4 }}>
        <path d={band("p5", "p95")} fill="var(--blue)" opacity={0.1} stroke="none" />
        <path d={band("p25", "p75")} fill="var(--blue)" opacity={0.18} stroke="none" />
        <path d={medianPath} fill="none" stroke="var(--blue)" strokeWidth={1.4} />
        <path d={histPath} fill="none" stroke="var(--text-mid)" strokeWidth={1.2} />
        <line x1={nowX} y1={padT} x2={nowX} y2={H - padB} stroke="var(--line-bright)" strokeWidth={0.7} strokeDasharray="3 3" />
        <circle cx={nowX} cy={nowY} r={2.5} fill="var(--text-bright)" />
      </svg>
    );
  }

  const rangeLoPct = fc ? (fc.terminal.p5 - fc.S0) / fc.S0 * 100 : 0;
  const rangeHiPct = fc ? (fc.terminal.p95 - fc.S0) / fc.S0 * 100 : 0;

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "oklch(0 0 0 / 0.6)",
      backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", zIndex: 9988,
      display: "flex", alignItems: "center", justifyContent: "center", animation: "cpFade 0.18s ease-out",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "min(760px, 95vw)", background: "var(--bg-1)",
        border: "1px solid var(--line-bright)", borderRadius: 8,
        boxShadow: "0 24px 60px -12px oklch(0 0 0 / 0.7), var(--glow-strong)",
        display: "flex", flexDirection: "column", overflow: "hidden", animation: "cpScale 0.2s cubic-bezier(0.16,1,0.3,1)",
      }}>
        <header style={{ padding: "12px 18px", borderBottom: "1px solid var(--line)", background: "var(--bg-2)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ color: "var(--blue)", fontFamily: "var(--font-mono)", fontSize: 16 }}>∿</div>
          <div>
            <div style={{ fontSize: 12, color: "var(--text-bright)", fontWeight: 500 }}>MONTE CARLO ПРОГНОЗ · {asset.sym}</div>
            <div className="mono" style={{ fontSize: 9.5, color: "var(--text-dim)" }}>{fc ? fc.sims : "…"} симуляций · GBM на волатильности Bybit 15m</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 4, alignItems: "center" }}>
            {[12, 24, 48].map(h => (
              <button key={h} onClick={() => setHorizon(h)} style={{
                fontFamily: "var(--font-mono)", fontSize: 10, padding: "3px 9px", borderRadius: 3, cursor: "pointer",
                background: horizon === h ? "oklch(0.7 0.15 240 / 0.15)" : "var(--bg-0)",
                color: horizon === h ? "var(--blue)" : "var(--text-dim)",
                border: `1px solid ${horizon === h ? "oklch(0.7 0.15 240 / 0.5)" : "var(--line)"}`,
              }}>{h}с</button>
            ))}
            <button onClick={() => setRunId(r => r + 1)} title="Пересчитать" style={{
              fontFamily: "var(--font-mono)", fontSize: 10, padding: "3px 9px", borderRadius: 3, cursor: "pointer",
              background: "var(--bg-0)", color: "var(--accent)", border: "1px solid oklch(0.78 0.16 var(--accent-h) / 0.4)", marginLeft: 4,
            }}>↻ пересчёт</button>
            <button onClick={onClose} style={{ marginLeft: 6, background: "transparent", border: "none", color: "var(--text-dim)", fontSize: 16, cursor: "pointer" }}>✕</button>
          </div>
        </header>

        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          {chart || <div style={{ height: 300, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 11 }}>недостаточно свечей для симуляции…</div>}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
            <McStat label={`P(рост) · ${fc ? fc.horizon : horizon}св`} v={fc ? `${(fc.probUp * 100).toFixed(0)}%` : "…"} c={upColor} />
            <McStat label="МЕДИАНА · ожид." v={fc ? `${fc.expectedPct >= 0 ? "+" : ""}${fc.expectedPct.toFixed(2)}%` : "…"} c={fc && fc.expectedPct >= 0 ? "var(--green)" : "var(--red)"} />
            <McStat label="ДИАПАЗОН 90%" v={fc ? `${rangeLoPct.toFixed(1)} … +${rangeHiPct.toFixed(1)}%` : "…"} c="var(--text-bright)" />
            <McStat label="σ · на свечу" v={fc ? `${fc.sigmaPct.toFixed(2)}%` : "…"} c="var(--accent-2)" />
          </div>

          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--text-dim)" }}>
            <span><span style={{ color: "var(--blue)" }}>▬</span> медиана (p50)</span>
            <span><span style={{ color: "var(--blue)", opacity: 0.5 }}>▬</span> 50% исходов (p25–p75)</span>
            <span><span style={{ color: "var(--blue)", opacity: 0.3 }}>▬</span> 90% исходов (p5–p95)</span>
            <span><span style={{ color: "var(--text-mid)" }}>▬</span> история (20 свечей)</span>
          </div>

          <div style={{ background: "var(--bg-2)", border: "1px dashed var(--line-bright)", borderRadius: 3, padding: "8px 10px", fontSize: 10.5, color: "var(--text-mid)", lineHeight: 1.5 }}>
            <span className="accent">↳ </span>Это вероятностная модель (геом. броуновское движение на реальном распределении доходностей Bybit), а <b>не</b> предсказание. Показывает диапазон исходов, который подразумевает недавняя волатильность. Не является инвестиционной рекомендацией.
          </div>
        </div>
      </div>
    </div>
  );
}

function McStat({ label, v, c }) {
  return (
    <div style={{ background: "var(--bg-0)", border: "1px solid var(--line)", borderRadius: 3, padding: "6px 9px" }}>
      <div style={{ fontSize: 8.5, color: "var(--text-dim)", letterSpacing: 0.1, fontWeight: 600, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: c, marginTop: 2 }}>{v}</div>
    </div>
  );
}

/* ─── Subcomponents ─── */

/* Live connection indicator — reflects the Bybit WebSocket/REST state */
function LiveTag({ status }) {
  const cfg = {
    live:       { color: "var(--blue)", label: "LIVE",  pulse: true  },
    rest:       { color: "var(--amber)", label: "REST",  pulse: false },
    connecting: { color: "var(--text-dim)", label: "СОЕД…", pulse: false },
    error:      { color: "var(--red)",   label: "ОФФЛАЙН", pulse: false },
  }[status] || { color: "var(--text-dim)", label: "—", pulse: false };
  return (
    <span title="Источник: Bybit · публичный API" style={{
      display: "inline-flex", alignItems: "center", gap: 5, marginLeft: 4,
      fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600, letterSpacing: 0.08,
      color: cfg.color, padding: "1px 6px", borderRadius: 3,
      border: `1px solid ${cfg.color}`, textTransform: "uppercase",
    }}>
      {cfg.pulse ? <PulseDot size={5} color={cfg.color} /> : <span className="dot" style={{ background: cfg.color }} />}
      {cfg.label}
      <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>· BYBIT</span>
    </span>
  );
}

/* Shown while the initial REST history request for a symbol is loading */
function LoadingTerminal({ asset, status, assetIdx, onAsset, assets }) {
  const LIST = assets && assets.length ? assets : CRYPTO_ASSETS;
  const failed = status === "error";
  return (
    <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
      <PanelHeader
        title={`ТРЕЙДИНГ-ТЕРМИНАЛ · ${asset.sym}`}
        meta={`данные Bybit · ${asset.name}`}
        action={
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {LIST.map((a, i) => (
              <button key={a.bybit} onClick={() => onAsset(i)} style={{
                fontFamily: "var(--font-mono)", fontSize: 9.5, padding: "1px 6px", borderRadius: 2,
                background: i === assetIdx ? "var(--accent-soft)" : "transparent",
                color: i === assetIdx ? "var(--accent)" : "var(--text-dim)",
                border: `1px solid ${i === assetIdx ? "oklch(0.78 0.16 var(--accent-h) / 0.4)" : "var(--line)"}`,
                cursor: "pointer", letterSpacing: 0.06, textTransform: "uppercase",
              }}>{a.sym.split("/")[0]}</button>
            ))}
          </div>
        }
      />
      <div style={{
        flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 12, color: failed ? "var(--red)" : "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 12,
      }}>
        {failed ? (
          <>
            <div style={{ fontSize: 22 }}>⚠</div>
            <div>Не удалось загрузить рынок {asset.bybit} с Bybit</div>
            <div style={{ fontSize: 10, color: "var(--text-dim)", maxWidth: 320, textAlign: "center", lineHeight: 1.5 }}>
              Проверьте интернет-соединение. Если открыто через <span className="mono">file://</span> — запустите локальный сервер (см. README). Идёт автоповтор…
            </div>
          </>
        ) : (
          <>
            <Waveform width={120} height={20} color="var(--accent)" bars={24} />
            <div>Загрузка рыночных данных {asset.bybit}…</div>
            <div style={{ fontSize: 10, color: "var(--text-dim)" }}>Bybit · публичный API · REST + WebSocket</div>
          </>
        )}
      </div>
    </div>
  );
}

/* Live countdown to the next funding settlement */
function FundingCountdown({ target }) {
  const [now, setNow] = useState(() => Date.now());
  useInterval(() => setNow(Date.now()), 1000);
  if (!target) return <span>—</span>;
  let ms = target - now;
  if (ms < 0) ms = 0;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return <span>{h > 0 ? `${h}ч ` : ""}{String(m).padStart(2, "0")}м {String(s).padStart(2, "0")}с</span>;
}

/* Long/Short account ratio — split bar + percentages */
function LongShortBar({ data }) {
  const buy = data ? data.buyRatio * 100 : null;
  const sell = data ? data.sellRatio * 100 : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 8.5, color: "var(--text-dim)", letterSpacing: 0.1, textTransform: "uppercase" }}>Long / Short</span>
      {data ? (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 84, height: 8, borderRadius: 2, overflow: "hidden", background: "var(--red)", display: "flex" }}>
            <div style={{ width: `${buy}%`, background: "var(--green)", height: "100%" }} />
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>
            <span style={{ color: "var(--green)" }}>{buy.toFixed(1)}%</span>
            <span style={{ color: "var(--text-dim)" }}> / </span>
            <span style={{ color: "var(--red)" }}>{sell.toFixed(1)}%</span>
          </span>
        </div>
      ) : <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>…</span>}
    </div>
  );
}

/* Perp derivatives stats strip: funding · open interest · 24h turnover · next funding · long/short */
function DerivStatsBar({ stats, longShort }) {
  const Item = ({ label, children, color }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <span style={{ fontSize: 8.5, color: "var(--text-dim)", letterSpacing: 0.1, textTransform: "uppercase" }}>{label}</span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: color || "var(--text-bright)" }}>{children}</span>
    </div>
  );
  const fr = stats ? stats.fundingRate * 100 : null;
  const frColor = fr == null ? "var(--text-dim)" : fr >= 0 ? "var(--green)" : "var(--red)";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 22,
      padding: "5px 14px", borderBottom: "1px solid var(--line)", background: "var(--bg-1)",
    }}>
      <span style={{ fontSize: 8.5, color: "var(--accent)", letterSpacing: 0.14, fontWeight: 600, fontFamily: "var(--font-mono)" }}>PERP</span>
      <Item label="Funding" color={frColor}>{fr == null ? "…" : `${fr >= 0 ? "+" : ""}${fr.toFixed(4)}%`}</Item>
      <Item label="Open Interest">{stats ? fmtMktUsd(stats.openInterestValue) : "…"}</Item>
      <Item label="Объём 24ч">{stats ? fmtMktUsd(stats.turnover24h) : "…"}</Item>
      <Item label="След. фандинг"><FundingCountdown target={stats ? stats.nextFundingTime : null} /></Item>
      <LongShortBar data={longShort} />
    </div>
  );
}

function TabBtn({ active, onClick, label, count }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "8px 14px",
      background: "transparent", border: "none",
      color: active ? "var(--accent)" : "var(--text-mid)",
      borderBottom: `2px solid ${active ? "var(--accent)" : "transparent"}`,
      fontFamily: "var(--font-ui)", fontSize: 11.5, fontWeight: 500,
      cursor: "pointer",
      letterSpacing: 0.02,
    }}>
      {label}
      <span className="mono" style={{ fontSize: 10, color: active ? "var(--accent)" : "var(--text-dim)" }}>{count}</span>
    </button>
  );
}

function ActiveSignalCard({ signal, read, onOpen, flash }) {
  if (!signal) {
    // no full setup fired — show the engine's live read so the panel is never empty
    if (read) {
      const isBuy = read.side === "buy";
      const col = isBuy ? "var(--green)" : "var(--red)";
      const pct = Math.min(100, Math.abs(read.score) / 2.0 * 100);
      return (
        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 8, minHeight: 96 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, color: "var(--text-mid)", padding: "2px 7px", border: "1px solid var(--line-bright)", borderRadius: 3, letterSpacing: 0.08 }}>⌖ НАБЛЮДЕНИЕ</span>
            <span className="mono" style={{ fontSize: 11, color: col }}>{isBuy ? "↑ уклон вверх" : "↓ уклон вниз"}</span>
            <span className="mono" style={{ marginLeft: "auto", fontSize: 10, color: "var(--text-dim)" }}>RSI {read.rsi.toFixed(0)} · {read.trendDir > 0 ? "up" : read.trendDir < 0 ? "down" : "flat"}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 9.5, color: "var(--text-dim)" }}>до сигнала</span>
            <div style={{ flex: 1, height: 3, background: "var(--bg-3)", borderRadius: 1, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: col, borderRadius: 1, transition: "width 0.4s" }} />
            </div>
            <span className="mono" style={{ fontSize: 10, color: col }}>{Math.abs(read.score).toFixed(1)}/2.0</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-mid)", lineHeight: 1.4 }}>
            <span className="mono" style={{ color: "var(--accent)" }}>↳ </span>
            {read.reasons[0] || "движок анализирует рынок"} · ждёт усиления конфлюенса.
          </div>
        </div>
      );
    }
    return (
      <div style={{
        padding: "12px 14px",
        borderBottom: "1px solid var(--line)",
        fontSize: 11, color: "var(--text-dim)",
        display: "flex", alignItems: "center", gap: 8,
        minHeight: 96,
      }}>
        <span className="mono" style={{ fontSize: 10.5 }}>⌖ загрузка анализа рынка…</span>
      </div>
    );
  }
  const isBuy = signal.side === "buy";
  const color = isBuy ? "var(--green)" : "var(--red)";
  return (
    <div style={{
      padding: "10px 14px",
      borderBottom: "1px solid var(--line)",
      background: flash ? "oklch(0.78 0.16 var(--accent-h) / 0.10)" : "transparent",
      transition: "background 1.4s",
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600,
          color, padding: "2px 7px",
          border: `1px solid ${color}`, borderRadius: 3,
          background: isBuy ? "oklch(0.78 0.16 155 / 0.08)" : "oklch(0.70 0.20 25 / 0.08)",
          letterSpacing: 0.08,
        }}>
          {isBuy ? "▲ ПОКУПКА" : "▼ ПРОДАЖА"}
        </span>
        <span className="mono" style={{ fontSize: 11, color: "var(--text-bright)" }}>@ {signal.price.toFixed(2)}</span>
        <span className="mono" style={{ marginLeft: "auto", fontSize: 10, color: "var(--text-dim)" }}>{signal.id} · {signal.ts}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, position: "relative", height: 3, background: "var(--bg-3)", borderRadius: 1 }}>
          <div style={{ position: "absolute", inset: 0, width: `${signal.confidence}%`, background: color, borderRadius: 1, boxShadow: `0 0 6px ${color}` }} />
        </div>
        <span className="mono" style={{ fontSize: 10.5, color: color, minWidth: 32 }}>{signal.confidence}%</span>
        <span className="mono" style={{ fontSize: 9.5, color: "var(--text-dim)" }}>{signal.agent}</span>
      </div>
      <div style={{ fontSize: 11, color: "var(--text-mid)", lineHeight: 1.4 }}>
        <span className="mono" style={{ color: "var(--accent)" }}>↳ </span>
        {signal.reasoning}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button className="btn btn-accent" style={{ flex: 1 }} onClick={() => onOpen(signal)}>
          ▸ Сделать демо-сделку
        </button>
        <button className="btn" title="Игнорировать сигнал">✕</button>
      </div>
    </div>
  );
}

function DemoTradeForm({ form, setForm, onSubmit, price, maxLev = 100, budget }) {
  const lev = Math.max(1, +form.lev || 1);
  const notional = (form.amount || 0) * lev;
  const liq = lev > 1
    ? (form.side === "buy" ? price * (1 - 1 / lev) : price * (1 + 1 / lev))
    : null;
  const LEVS = [1, 2, 5, 10, 25, 50, 100].filter(l => l <= maxLev);
  const dec = price < 10 ? 4 : 2;
  return (
    <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
      <div style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.15em", fontWeight: 600 }}>
        РУЧНАЯ ДЕМО-СДЕЛКА
      </div>
      {budget != null && (
        <button onClick={() => window.__navTo?.("settings")} title="Изменить бюджет в настройках"
          style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            background: "var(--bg-0)", border: "1px dashed var(--line)", borderRadius: 3,
            padding: "4px 8px", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 10,
          }}>
          <span style={{ color: "var(--text-dim)" }}>бюджет</span>
          <span style={{ color: "var(--text-mid)" }}>${budget.toLocaleString("en-US")} <span style={{ color: "var(--text-dim)" }}>· изменить ›</span></span>
        </button>
      )}
      <div style={{ display: "flex", gap: 4 }}>
        <button onClick={() => setForm({ ...form, side: "buy" })} style={tradeBtnStyle(form.side === "buy", "var(--green)")}>
          ▲ ЛОНГ
        </button>
        <button onClick={() => setForm({ ...form, side: "sell" })} style={tradeBtnStyle(form.side === "sell", "var(--red)")}>
          ▼ ШОРТ
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 8, alignItems: "center", fontSize: 11 }}>
        <span style={{ color: "var(--text-dim)" }}>Маржа</span>
        <input type="number" value={form.amount}
          onChange={e => setForm({ ...form, amount: Math.max(10, +e.target.value || 0) })}
          style={{
            background: "var(--bg-0)", border: "1px solid var(--line-bright)",
            color: "var(--text-bright)", padding: "5px 8px", fontFamily: "var(--font-mono)", fontSize: 12,
            outline: "none", borderRadius: 3, textAlign: "right",
          }} />
        <span className="mono" style={{ color: "var(--text-dim)" }}>USDT</span>
      </div>
      <div style={{ display: "flex", gap: 4, fontFamily: "var(--font-mono)", fontSize: 9.5 }}>
        {[100, 250, 500, 1000].map(v => (
          <button key={v} onClick={() => setForm({ ...form, amount: v })} style={{
            flex: 1, padding: "3px 4px",
            background: form.amount === v ? "var(--accent-soft)" : "var(--bg-2)",
            color: form.amount === v ? "var(--accent)" : "var(--text-dim)",
            border: `1px solid ${form.amount === v ? "oklch(0.78 0.16 var(--accent-h) / 0.4)" : "var(--line)"}`,
            borderRadius: 2, cursor: "pointer",
          }}>{v}</button>
        ))}
      </div>

      {/* Leverage */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11 }}>
        <span style={{ color: "var(--text-dim)" }}>Плечо</span>
        <span className="mono" style={{ fontSize: 12, color: lev >= 25 ? "var(--red)" : lev >= 10 ? "var(--amber)" : "var(--accent)", fontWeight: 700 }}>{lev}x</span>
      </div>
      <div style={{ display: "flex", gap: 3, fontFamily: "var(--font-mono)", fontSize: 9.5, flexWrap: "wrap" }}>
        {LEVS.map(l => (
          <button key={l} onClick={() => setForm({ ...form, lev: l })} style={{
            flex: 1, minWidth: 30, padding: "3px 2px",
            background: lev === l ? (l >= 25 ? "oklch(0.65 0.13 35 / 0.16)" : "var(--accent-soft)") : "var(--bg-2)",
            color: lev === l ? (l >= 25 ? "var(--red)" : "var(--accent)") : "var(--text-dim)",
            border: `1px solid ${lev === l ? (l >= 25 ? "var(--red)" : "oklch(0.78 0.16 var(--accent-h) / 0.4)") : "var(--line)"}`,
            borderRadius: 2, cursor: "pointer",
          }}>{l}x</button>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
        <span>позиция <span style={{ color: "var(--text-bright)" }}>{notional.toLocaleString("en-US")}$</span></span>
        {liq && <span>ликв. <span style={{ color: "var(--red)" }}>{liq.toFixed(dec)}</span></span>}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
        <span>комиссия ({(FEE_RATE * 100).toFixed(3)}% × 2)</span>
        <span style={{ color: "var(--amber)" }}>≈ −{tradeFee(notional * 2).toFixed(2)}$</span>
      </div>
      {/* auto SL sits at 2% — warn when leverage puts liquidation closer than that */}
      {form.useSlTp && lev > 33 && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--red)", lineHeight: 1.4 }}>
          ⚠ при {lev}x ликвидация ближе стопа (−{(100 / lev).toFixed(1)}% против −2%) — ликвидирует раньше, чем сработает стоп. Безопасный максимум 33x.
        </div>
      )}

      <label style={{
        display: "flex", alignItems: "center", gap: 6,
        fontSize: 10.5, color: "var(--text-mid)", cursor: "pointer",
      }}>
        <input type="checkbox" checked={form.useSlTp}
          onChange={e => setForm({ ...form, useSlTp: e.target.checked })}
          style={{ accentColor: "var(--accent)" }} />
        Авто стоп −2% · цель +4% (цель не закрывает — прибыль бежит)
      </label>
      <label style={{
        display: "flex", alignItems: "center", gap: 6,
        fontSize: 10.5, color: "var(--text-mid)", cursor: "pointer",
      }}>
        <input type="checkbox" checked={form.trail}
          onChange={e => setForm({ ...form, trail: e.target.checked })}
          style={{ accentColor: "var(--accent-2)" }} />
        Трейлинг-стоп (−2%, подтягивается за ценой)
      </label>
      <button className="btn btn-accent" onClick={onSubmit} style={{ marginTop: "auto" }}>
        ▸ Открыть позицию по ~{price < 10 ? price.toFixed(3) : price < 1000 ? price.toFixed(2) : price.toFixed(0)}
      </button>
    </div>
  );
}

/* Your trading capital — all position sizing is derived from it. */
const BUDGET_LS = "vael.budget";
function loadBudget() { try { return +localStorage.getItem(BUDGET_LS) || 10000; } catch (_) { return 10000; } }

/* Trading commission — charged on the notional (size) each side, Bybit-like taker
 * rate. A trade pays it twice: once on entry, once on exit. Realized P&L is net. */
const FEE_RATE = 0.00055; // 0.055% per side
function tradeFee(notional) { return notional * FEE_RATE; }

/* The plan produced by "найти точку входа": which strategy fits, where to enter,
 * how much of YOUR budget to risk, and what leverage the setup justifies. */
function EntryPlanCard({ plan, sym, onApply, onClear, onFlip }) {
  const c = plan.side === "buy" ? "var(--green)" : "var(--red)";
  const dec = plan.entry < 10 ? 4 : 2;
  const alt = plan.alt;
  return (
    <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)", borderLeft: `3px solid ${c}`, background: "var(--bg-2)", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: c }}>
          ⌖ ПЛАН ВХОДА · {plan.side === "buy" ? "ЛОНГ" : "ШОРТ"} {sym.split("/")[0]}
        </span>
        <span className="mono" style={{ fontSize: 9.5, color: "var(--accent)" }}>conf {plan.conf}%</span>
        <button onClick={onClear} title="убрать план" style={{ marginLeft: "auto", background: "transparent", border: "none", color: "var(--text-dim)", cursor: "pointer", fontSize: 12 }}>✕</button>
      </div>

      {/* both directions scored — flip to the alternative (long ↔ short) */}
      {onFlip && alt && (
        <button onClick={onFlip} title="показать план в другую сторону"
          style={{
            display: "flex", alignItems: "center", gap: 6, width: "100%",
            fontFamily: "var(--font-mono)", fontSize: 9.5, cursor: "pointer",
            background: "var(--bg-0)", border: "1px dashed var(--line-bright)", borderRadius: 3, padding: "3px 7px",
            color: "var(--text-mid)",
          }}>
          <span style={{ color: alt.side === "buy" ? "var(--green)" : "var(--red)", fontWeight: 700 }}>
            ↔ {alt.side === "buy" ? "ЛОНГ" : "ШОРТ"}
          </span>
          <span>тоже рассмотрен · R:R 1:{alt.rr.toFixed(1)}{alt.evR != null ? ` · ожид. ${alt.evR >= 0 ? "+" : "−"}${Math.abs(alt.evR).toFixed(2)}R` : ""}</span>
          <span style={{ marginLeft: "auto", color: "var(--accent)" }}>переключить</span>
        </button>
      )}

      {/* market vs limit: the optimiser may want a better price than "right now" */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        fontFamily: "var(--font-mono)", fontSize: 9.5,
        background: "var(--bg-0)", border: `1px solid ${plan.entryType === "limit" ? "var(--accent-2)" : "var(--line)"}`,
        borderRadius: 3, padding: "4px 7px",
      }}>
        {plan.entryType === "limit" ? (
          <>
            <span style={{ color: "var(--accent-2)", fontWeight: 700 }}>ЛИМИТ</span>
            <span style={{ color: "var(--text-mid)" }}>
              ждём откат до {plan.entry.toFixed(dec)} (сейчас {plan.price.toFixed(dec)})
            </span>
            {plan.edgePct > 3 && (
              <span style={{ marginLeft: "auto", color: "var(--green)" }}>R:R +{plan.edgePct.toFixed(0)}%</span>
            )}
          </>
        ) : (
          <>
            <span style={{ color: "var(--accent)", fontWeight: 700 }}>ПО РЫНКУ</span>
            <span style={{ color: "var(--text-mid)" }}>цена уже у уровня — ждать нечего</span>
          </>
        )}
      </div>

      {plan.macro && (
        <div style={{
          fontSize: 9.5, fontFamily: "var(--font-mono)", lineHeight: 1.4,
          color: plan.macro.blockEntry ? "var(--red)" : "var(--amber)",
          background: "var(--bg-0)", border: `1px solid ${plan.macro.blockEntry ? "var(--red)" : "var(--amber)"}`,
          borderRadius: 3, padding: "4px 7px",
        }}>
          ◱ {plan.macro.note}{plan.macro.cap ? ` · плечо ограничено ${plan.macro.cap}x` : ""}
        </div>
      )}

      {plan.micro && plan.micro.flags.map((f, i) => (
        <div key={i} style={{
          fontSize: 9.5, fontFamily: "var(--font-mono)", lineHeight: 1.4,
          color: f.sev === 2 ? "var(--red)" : "var(--amber)",
          background: "var(--bg-0)", border: `1px solid ${f.sev === 2 ? "var(--red)" : "var(--amber)"}`,
          borderRadius: 3, padding: "4px 7px",
        }}>
          {f.kind === "pump" ? "⚡" : f.kind === "funding" ? "⚖" : "◑"} {f.text}
          {f.kind === "pump" && plan.micro.chasingPump ? " · вход в ЭТУ сторону = погоня" : ""}
        </div>
      ))}

      {plan.strategy && (
        <div style={{ fontSize: 10.5, color: "var(--text-mid)", lineHeight: 1.4 }}>
          <span style={{ color: "var(--accent-2)" }}>стратегия: </span>
          <span style={{ color: "var(--text-bright)" }}>{plan.strategy.name}</span> — {plan.strategy.why}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5, fontFamily: "var(--font-mono)", fontSize: 10 }}>
        <PlanBox label="Вход" v={plan.entry.toFixed(dec)} c={plan.entryType === "limit" ? "var(--accent-2)" : "var(--text-bright)"} />
        <PlanBox label="Стоп" v={plan.sl.toFixed(dec)} c="var(--red)" />
        <PlanBox label="Цель" v={plan.tp.toFixed(dec)} c="var(--green)" />
        <PlanBox label="Маржа" v={`$${plan.amount}`} c="var(--text-bright)" />
        <PlanBox label="Плечо" v={`${plan.lev}x`} c={plan.lev >= 10 ? "var(--amber)" : "var(--accent)"} />
        <PlanBox label="Позиция" v={`$${plan.notional}`} c="var(--accent-2)" />
      </div>

      {/* what the plan actually earns / risks in dollars */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, fontFamily: "var(--font-mono)", fontSize: 10 }}>
        <PlanBox label="Прибыль в цели" v={`+$${plan.profitAtTp.toFixed(0)}`} c="var(--green)" />
        <PlanBox label="Убыток по стопу" v={`−$${plan.lossAtSl.toFixed(0)}`} c="var(--red)" />
      </div>

      {/* expectancy — the number that decides if the trade is worth taking */}
      {plan.evR != null && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          fontFamily: "var(--font-mono)", fontSize: 10,
          background: plan.evR > 0 ? "oklch(0.72 0.14 150 / 0.10)" : "oklch(0.65 0.18 25 / 0.10)",
          border: `1px solid ${plan.evR > 0 ? "var(--green)" : "var(--red)"}`,
          borderRadius: 3, padding: "5px 8px",
        }}>
          <span style={{ color: "var(--text-dim)" }}>ожидание</span>
          <span style={{ color: plan.evR > 0 ? "var(--green)" : "var(--red)", fontWeight: 700, fontSize: 11.5 }}>
            {plan.evR >= 0 ? "+" : "−"}{Math.abs(plan.evR).toFixed(2)}R
          </span>
          <span style={{ color: plan.expectedUsd >= 0 ? "var(--green)" : "var(--red)" }}>
            ({plan.expectedUsd >= 0 ? "+" : "−"}${Math.abs(plan.expectedUsd).toFixed(0)}/сделка)
          </span>
          <span style={{ marginLeft: "auto", color: "var(--text-dim)" }}>P(win) {(plan.pWin * 100).toFixed(0)}%</span>
        </div>
      )}
      {plan.evR != null && plan.evR <= 0 && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--amber)", lineHeight: 1.4 }}>
          ⚠ отрицательное ожидание — статистически невыгодный вход. Лучше подождать сетап получше{plan.alt && plan.alt.evR > 0 ? " или переключиться на альтернативу выше" : ""}.
        </div>
      )}

      {/* liquidation is deliberately kept beyond the stop — the stop always fires first */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        fontFamily: "var(--font-mono)", fontSize: 9.5,
        background: "var(--bg-0)", border: "1px solid var(--line)", borderRadius: 3, padding: "4px 7px",
      }}>
        <span style={{ color: "var(--text-dim)" }}>ликвидация</span>
        <span style={{ color: plan.liq ? "var(--red)" : "var(--text-dim)" }}>
          {plan.liq ? plan.liq.toFixed(dec) : "нет (1x)"}
        </span>
        <span style={{ color: "var(--green)" }}>✓ за стопом</span>
      </div>

      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--text-dim)", lineHeight: 1.5 }}>
        риск ${plan.riskUsd} (2% от ${plan.budget}) · R:R 1:{plan.rr.toFixed(1)}{plan.setup ? "" : " · неполный сетап"}
        {plan.levCapped && (
          <div style={{ color: "var(--amber)" }}>
            ⚠ плечо урезано до {plan.lev}x — при бо́льшем ликвидация была бы ближе стопа (макс. безопасное {plan.maxSafeLev}x)
          </div>
        )}
      </div>

      <button className="btn btn-accent" onClick={onApply} style={{ fontSize: 11 }}>
        ▸ Открыть по плану
      </button>
    </div>
  );
}

function PlanBox({ label, v, c }) {
  return (
    <div style={{ background: "var(--bg-0)", border: "1px solid var(--line)", borderRadius: 3, padding: "3px 6px" }}>
      <div style={{ fontSize: 8, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 0.06 }}>{label}</div>
      <div style={{ fontSize: 11, color: c, marginTop: 1 }}>{v}</div>
    </div>
  );
}

function PanBtn({ onClick, disabled, title, children }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title} style={{
      fontFamily: "var(--font-mono)", fontSize: 10, padding: "1px 6px", borderRadius: 2,
      background: "var(--bg-2)", color: disabled ? "var(--text-dim)" : "var(--accent)",
      border: "1px solid var(--line)", cursor: disabled ? "default" : "pointer",
      opacity: disabled ? 0.4 : 1,
    }}>{children}</button>
  );
}

function tradeBtnStyle(active, color) {
  return {
    flex: 1, padding: "7px 8px",
    background: active ? `oklch(from ${color} l c h / 0.15)` : "var(--bg-2)",
    color: active ? color : "var(--text-dim)",
    border: `1px solid ${active ? color : "var(--line)"}`,
    fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600,
    letterSpacing: 0.08, cursor: "pointer", borderRadius: 3,
    transition: "all 0.1s",
  };
}

Object.assign(window, {
  MonteCarloModal, McStat, LiveTag, LoadingTerminal, FundingCountdown, LongShortBar,
  DerivStatsBar, TabBtn, ActiveSignalCard, DemoTradeForm, EntryPlanCard, PlanBox, PanBtn,
  tradeBtnStyle, BUDGET_LS, loadBudget, FEE_RATE, tradeFee,
});
