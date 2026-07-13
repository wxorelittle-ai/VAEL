/* tools.jsx — Slide-over drawer, Wallet detail panel, Backtest mini-lab */

/* ═════════════════════════════════════════════════════════
 *  GENERIC DRAWER
 * ════════════════════════════════════════════════════════*/
function Drawer({ open, onClose, width = 560, children }) {
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0,
        background: open ? "oklch(0 0 0 / 0.4)" : "transparent",
        backdropFilter: open ? "blur(3px)" : "none",
        WebkitBackdropFilter: open ? "blur(3px)" : "none",
        pointerEvents: open ? "auto" : "none",
        transition: "background 0.25s, backdrop-filter 0.25s",
        zIndex: 9985,
      }} />
      <aside style={{
        position: "fixed",
        top: 0, right: 0, bottom: 0,
        width,
        background: "var(--bg-1)",
        borderLeft: "1px solid var(--line-bright)",
        boxShadow: "-12px 0 40px -8px oklch(0 0 0 / 0.5)",
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        zIndex: 9986,
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        {open && children}
      </aside>
    </>
  );
}

/* ═════════════════════════════════════════════════════════
 *  WALLET DETAIL  — content for drawer
 * ════════════════════════════════════════════════════════*/

function genTxs(wallet) {
  const types = ["IN", "OUT", "SWAP", "BRIDGE", "CONTRACT"];
  const counterparties = ["0x9b4f…CEX-A", "0xdead…mixer", "0x7a2c…whale", "Uniswap V3", "Aave v3", "0xfe44…treasury", "Bridge·L2", "0x91a4…cluster"];
  return Array.from({ length: 14 }, (_, i) => {
    const type = pick(types);
    const isIn = type === "IN";
    const amount = (Math.random() * 80 + 0.4).toFixed(3);
    const tokens = pick(["ETH", "USDT", "USDC", "WBTC", "DAI"]);
    const mins = i * Math.floor(Math.random() * 28 + 4);
    return {
      id: `tx-${Math.random().toString(36).slice(2, 8)}`,
      time: minutesAgo(mins),
      type,
      from: isIn ? pick(counterparties) : wallet.addr,
      to: isIn ? wallet.addr : pick(counterparties),
      amount,
      token: tokens,
      usd: (parseFloat(amount) * (tokens === "ETH" ? 2408 : tokens === "WBTC" ? 64280 : 1)).toFixed(0),
      sig: Math.random() > 0.9 ? "flagged" : "ok",
    };
  });
}

function minutesAgo(m) {
  if (m < 1) return "сейчас";
  if (m < 60) return `${m}м назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}ч назад`;
  return `${Math.floor(h / 24)}д назад`;
}

function WalletDetail({ wallet, onClose }) {
  if (!wallet) return null;
  const txs = useMemo(() => genTxs(wallet), [wallet.addr]);
  const balanceData = useMemo(() => genSpark(140, 0.12, 40), [wallet.addr]);

  const riskFactors = [
    { name: "Связь с CEX", val: 24, max: 100, color: "var(--green)" },
    { name: "Размер транзакций", val: 68, max: 100, color: "var(--amber)" },
    { name: "Частота операций", val: 45, max: 100, color: "var(--accent)" },
    { name: "Контакт с mixers", val: wallet.risk > 70 ? 92 : 8, max: 100, color: wallet.risk > 70 ? "var(--red)" : "var(--green)" },
    { name: "Возраст кошелька", val: 84, max: 100, color: "var(--green)" },
    { name: "Поведенческие паттерны", val: wallet.risk > 50 ? 71 : 32, max: 100, color: "var(--amber)" },
  ];

  const aiVerdict = wallet.risk > 70 ?
    { verdict: "ВЫСОКИЙ РИСК", color: "var(--red)",
      text: `Кошелёк связан с известным mixer-сервисом (confidence 91%). За последние 24ч зафиксированы аномальные паттерны транзакций. Запрашиваю эскалацию до tier-3.` } :
    wallet.risk > 40 ?
    { verdict: "СРЕДНИЙ РИСК", color: "var(--amber)",
      text: `Поведенческие паттерны соответствуют активному трейдеру или фонду. Требуется дополнительный мониторинг при операциях >5K USD. Подозрительной активности не выявлено.` } :
    { verdict: "НИЗКИЙ РИСК", color: "var(--green)",
      text: `Кошелёк демонстрирует стабильное предсказуемое поведение. Связи с подозрительными адресами не обнаружено. Рекомендуется стандартный мониторинг.` };

  return (
    <>
      {/* HEADER */}
      <header style={{
        padding: "14px 18px",
        borderBottom: "1px solid var(--line)",
        background: "var(--bg-2)",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 4,
          background: "var(--bg-0)",
          border: `1.5px solid ${wallet.risk > 70 ? "var(--red)" : wallet.risk > 40 ? "var(--amber)" : "var(--green)"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700,
          color: wallet.risk > 70 ? "var(--red)" : wallet.risk > 40 ? "var(--amber)" : "var(--green)",
        }}>$</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mono" style={{ fontSize: 12, color: "var(--text-bright)", overflow: "hidden", textOverflow: "ellipsis" }}>{wallet.addr}</div>
          <div style={{ fontSize: 11, color: "var(--text-mid)" }}>
            {wallet.name} · <span className="chip mono" style={{ fontSize: 9, padding: "0 4px" }}>{wallet.net}</span>
          </div>
        </div>
        <button className="btn">Экспорт</button>
        <button className="btn">Telegram</button>
        <button onClick={onClose} style={{
          background: "transparent", border: "none", color: "var(--text-dim)",
          fontSize: 16, cursor: "pointer", padding: 4,
        }}>✕</button>
      </header>

      {/* BODY */}
      <div className="scroll" style={{ flex: 1, overflowY: "auto", padding: "12px 18px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Top stats */}
        <div style={{
          display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr",
          gap: 10,
          background: "var(--bg-0)",
          border: "1px solid var(--line)",
          borderRadius: 4, padding: "12px 14px",
        }}>
          <div>
            <div style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.15, fontWeight: 600, textTransform: "uppercase" }}>Баланс</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 22, color: "var(--text-bright)", marginTop: 2 }}>
              <TickerNumber value={140842.42} decimals={2} suffix="" />
            </div>
            <div className="mono" style={{ fontSize: 10, color: "var(--text-dim)" }}>USD · 4 токена</div>
          </div>
          <div>
            <div style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.15, fontWeight: 600, textTransform: "uppercase" }}>NET 24Ч</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, color: wallet.flow.startsWith("+") ? "var(--green)" : "var(--red)", marginTop: 2 }}>
              {wallet.flow}
            </div>
            <Sparkline data={balanceData} width={110} height={20} color={wallet.flow.startsWith("+") ? "var(--green)" : "var(--red)"} />
          </div>
          <div>
            <div style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.15, fontWeight: 600, textTransform: "uppercase" }}>Risk Score</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 22, color: wallet.risk > 70 ? "var(--red)" : wallet.risk > 40 ? "var(--amber)" : "var(--green)", marginTop: 2 }}>
              {wallet.risk}<span style={{ fontSize: 11, color: "var(--text-dim)" }}>/100</span>
            </div>
            <div style={{ marginTop: 4, height: 3, background: "var(--bg-3)", borderRadius: 1, overflow: "hidden" }}>
              <div style={{ width: `${wallet.risk}%`, height: "100%", background: wallet.risk > 70 ? "var(--red)" : wallet.risk > 40 ? "var(--amber)" : "var(--green)" }} />
            </div>
          </div>
        </div>

        {/* AI verdict */}
        <Section title="AI АНАЛИЗ · РЕАЛЬНОЕ ВРЕМЯ">
          <div style={{
            background: "var(--bg-0)", border: `1px solid ${aiVerdict.color}`,
            borderLeft: `3px solid ${aiVerdict.color}`,
            borderRadius: 4, padding: "10px 14px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700,
                color: aiVerdict.color, padding: "2px 7px",
                border: `1px solid ${aiVerdict.color}`, borderRadius: 3,
                letterSpacing: 0.1,
              }}>{aiVerdict.verdict}</span>
              <span className="mono" style={{ fontSize: 10, color: "var(--text-dim)" }}>risk.agt + memory.agt · confidence 89%</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.55 }}>{aiVerdict.text}</div>
          </div>
        </Section>

        {/* Risk breakdown */}
        <Section title="ДЕКОМПОЗИЦИЯ РИСКА">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {riskFactors.map(rf => (
              <div key={rf.name} style={{
                background: "var(--bg-0)", border: "1px solid var(--line)",
                borderRadius: 3, padding: "7px 10px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "var(--text-mid)" }}>
                  <span>{rf.name}</span>
                  <span className="mono" style={{ color: rf.color }}>{rf.val}</span>
                </div>
                <div style={{ marginTop: 4, height: 3, background: "var(--bg-3)", borderRadius: 1, overflow: "hidden" }}>
                  <div style={{ width: `${(rf.val / rf.max) * 100}%`, height: "100%", background: rf.color }} />
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Transactions */}
        <Section title="ПОСЛЕДНИЕ ТРАНЗАКЦИИ" meta={`${txs.length} операций · 24ч`}>
          <div style={{ background: "var(--bg-0)", border: "1px solid var(--line)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{
              display: "grid", gridTemplateColumns: "70px 50px 1fr 70px 60px",
              padding: "5px 10px", borderBottom: "1px solid var(--line)",
              background: "var(--bg-2)",
              fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)",
              letterSpacing: 0.08, textTransform: "uppercase",
            }}>
              <span>Время</span><span>Тип</span><span>Контрагент</span><span style={{ textAlign: "right" }}>Сумма</span><span style={{ textAlign: "right" }}>USD</span>
            </div>
            <div className="scroll" style={{ maxHeight: 260, overflowY: "auto" }}>
              {txs.map(tx => (
                <TxRow key={tx.id} tx={tx} wallet={wallet} />
              ))}
            </div>
          </div>
        </Section>

        {/* Connected entities */}
        <Section title="СВЯЗАННЫЕ СУЩНОСТИ">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {[
              { type: "CEX",     name: "Binance hot",     refs: 12 },
              { type: "WALLET",  name: "0xdead…beef",     refs: 8,  flag: true },
              { type: "PROTO",   name: "Uniswap V3",      refs: 6 },
              { type: "WALLET",  name: "0x7a2c…ef91",     refs: 4 },
              { type: "EVENT",   name: "L2 launch · 14.05", refs: 3 },
              { type: "ORG",     name: "Alameda",         refs: 2 },
            ].map(e => (
              <div key={e.name} style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "4px 8px",
                background: e.flag ? "oklch(0.70 0.20 25 / 0.08)" : "var(--bg-0)",
                border: `1px solid ${e.flag ? "oklch(0.70 0.20 25 / 0.4)" : "var(--line)"}`,
                borderRadius: 3,
                fontSize: 11,
              }}>
                <span className="mono" style={{ fontSize: 8.5, color: e.flag ? "var(--red)" : "var(--accent)", fontWeight: 600, letterSpacing: 0.08 }}>{e.type}</span>
                <span style={{ color: e.flag ? "var(--red)" : "var(--text-bright)" }}>{e.name}</span>
                <span className="mono" style={{ fontSize: 9.5, color: "var(--text-dim)" }}>×{e.refs}</span>
              </div>
            ))}
          </div>
        </Section>

      </div>

      {/* footer */}
      <footer style={{
        padding: "10px 18px",
        borderTop: "1px solid var(--line)",
        background: "var(--bg-2)",
        display: "flex", gap: 8,
      }}>
        <button className="btn">Добавить теги</button>
        <button className="btn">Запустить миссию</button>
        <button className="btn btn-accent" style={{ marginLeft: "auto" }}>
          {wallet.risk > 70 ? "Эскалировать" : "Добавить в наблюдение"}
        </button>
      </footer>
    </>
  );
}

function TxRow({ tx, wallet }) {
  const typeColor = {
    IN: "var(--green)", OUT: "var(--red)",
    SWAP: "var(--accent)", BRIDGE: "var(--accent-2)", CONTRACT: "var(--blue)",
  }[tx.type];
  const isFlagged = tx.sig === "flagged";
  const counterparty = tx.type === "IN" ? tx.from : tx.to;
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "70px 50px 1fr 70px 60px",
      padding: "5px 10px", borderBottom: "1px solid var(--bg-2)",
      fontFamily: "var(--font-mono)", fontSize: 10.5,
      alignItems: "center",
      background: isFlagged ? "oklch(0.70 0.20 25 / 0.05)" : "transparent",
    }}>
      <span style={{ color: "var(--text-dim)" }}>{tx.time}</span>
      <span style={{ color: typeColor, fontWeight: 600, fontSize: 9.5 }}>{tx.type}</span>
      <span style={{ color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {isFlagged && <span style={{ color: "var(--red)", marginRight: 4 }}>!</span>}
        {counterparty}
      </span>
      <span style={{ textAlign: "right", color: "var(--text-bright)" }}>{tx.amount} {tx.token}</span>
      <span style={{ textAlign: "right", color: "var(--text-dim)" }}>{tx.usd}$</span>
    </div>
  );
}

function Section({ title, meta, children }) {
  return (
    <div>
      <div style={{
        display: "flex", alignItems: "baseline", justifyContent: "space-between",
        marginBottom: 6,
      }}>
        <span style={{
          fontSize: 9.5, fontWeight: 600, letterSpacing: 0.15,
          textTransform: "uppercase", color: "var(--text-dim)",
        }}>{title}</span>
        {meta && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>{meta}</span>
        )}
      </div>
      {children}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════
 *  BACKTEST MINI-LAB
 * ════════════════════════════════════════════════════════*/

const STRATEGY_PRESETS = [
  { id: "momentum", name: "Momentum", desc: "Покупка на пробое сопротивления, продажа по trailing-stop", risk: "средний" },
  { id: "mean-rev", name: "Mean Reversion", desc: "Покупка при отклонении вниз от средней, продажа при возврате", risk: "низкий" },
  { id: "ai-signals", name: "AI Signals", desc: "Следование сигналам страт-агента VAEL (только сигналы с conf ≥ 80%)", risk: "адаптивный" },
  { id: "vol-breakout", name: "Volatility Breakout", desc: "Вход на расширении волатильности с подтверждением объёмом", risk: "высокий" },
];

function genEquityCurve(strategy, period, capital) {
  const points = Math.max(40, period * 2);
  const out = [{ v: capital, day: 0 }];
  // Strategy-specific drift/vol
  const cfg = {
    momentum:    { drift: 0.0028, vol: 0.014 },
    "mean-rev":  { drift: 0.0016, vol: 0.008 },
    "ai-signals":{ drift: 0.0034, vol: 0.012 },
    "vol-breakout": { drift: 0.0042, vol: 0.024 },
  }[strategy] || { drift: 0.002, vol: 0.012 };

  let cur = capital;
  for (let i = 1; i < points; i++) {
    const r = (Math.random() - 0.48) * cfg.vol + cfg.drift;
    cur = Math.max(capital * 0.5, cur * (1 + r));
    out.push({ v: cur, day: i });
  }
  return out;
}

function computeStats(curve, capital) {
  const last = curve[curve.length - 1].v;
  const totalReturn = ((last - capital) / capital) * 100;
  let peak = capital, maxDD = 0;
  curve.forEach(p => {
    peak = Math.max(peak, p.v);
    const dd = ((peak - p.v) / peak) * 100;
    if (dd > maxDD) maxDD = dd;
  });
  const returns = [];
  for (let i = 1; i < curve.length; i++) returns.push((curve[i].v - curve[i-1].v) / curve[i-1].v);
  const mean = returns.reduce((s, x) => s + x, 0) / returns.length;
  const variance = returns.reduce((s, x) => s + (x - mean) ** 2, 0) / returns.length;
  const sharpe = mean / Math.sqrt(variance) * Math.sqrt(252);
  const trades = Math.floor(curve.length * 0.4 + Math.random() * 8);
  const winRate = 52 + Math.random() * 22;
  return { totalReturn, maxDD, sharpe, trades, winRate, last };
}

function EquityChart({ curve, capital, width = 540, height = 200 }) {
  if (!curve || curve.length < 2) return null;
  const min = Math.min(...curve.map(p => p.v));
  const max = Math.max(...curve.map(p => p.v));
  const range = (max - min) || 1;
  const stepX = width / (curve.length - 1);
  const padT = 8, padB = 18;
  const chartH = height - padT - padB;
  const y = (v) => padT + (1 - (v - min) / range) * chartH;
  const pts = curve.map((p, i) => [i * stepX, y(p.v)]);
  const path = pts.map(([x, y], i) => i === 0 ? `M${x},${y}` : `L${x},${y}`).join(" ");
  const areaPath = `${path} L${width},${height - padB} L0,${height - padB} Z`;
  const last = curve[curve.length - 1];
  const isProfit = last.v >= capital;
  const color = isProfit ? "var(--green)" : "var(--red)";
  // baseline line at capital
  const capY = y(capital);
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <defs>
        <linearGradient id="bt-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* grid */}
      {[0.25, 0.5, 0.75].map(p => (
        <line key={p} x1={0} y1={padT + chartH * p} x2={width} y2={padT + chartH * p}
          stroke="var(--line)" strokeWidth={0.5} strokeDasharray="2 4" />
      ))}
      {/* capital baseline */}
      <line x1={0} y1={capY} x2={width} y2={capY}
        stroke="var(--text-dim)" strokeWidth={0.6} strokeDasharray="4 4" opacity={0.6} />
      <text x={4} y={capY - 3} fontFamily="var(--font-mono)" fontSize={9} fill="var(--text-dim)">
        баз. {capital}$
      </text>
      <path d={areaPath} fill="url(#bt-grad)" />
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
      <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r={3} fill={color} />
    </svg>
  );
}

function BacktestModal({ open, onClose, asset, lang }) {
  const [phase, setPhase] = useState("config"); // config | running | results
  const [config, setConfig] = useState({
    strategy: "ai-signals",
    period: 30,
    capital: 10000,
    leverage: 1,
    fees: 0.05,
  });
  const [progress, setProgress] = useState(0);
  const [curve, setCurve] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!open) {
      setPhase("config"); setProgress(0); setCurve(null); setStats(null);
    }
  }, [open]);

  function run() {
    setPhase("running");
    setProgress(0);
    setCurve([]);
    const fullCurve = genEquityCurve(config.strategy, config.period, config.capital);
    let i = 0;
    const id = setInterval(() => {
      i = Math.min(i + 3, fullCurve.length);
      setProgress(Math.round((i / fullCurve.length) * 100));
      setCurve(fullCurve.slice(0, i));
      if (i >= fullCurve.length) {
        clearInterval(id);
        setStats(computeStats(fullCurve, config.capital));
        setTimeout(() => setPhase("results"), 200);
      }
    }, 35);
  }

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
      backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
      zIndex: 9988,
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
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent)", letterSpacing: "0.18em" }}>BACKTEST LAB · {asset}</span>
          <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>v6.backtest-engine</span>
          <button onClick={onClose} style={{
            background: "transparent", border: "none",
            color: "var(--text-dim)", fontSize: 16, cursor: "pointer", padding: 2,
          }}>✕</button>
        </div>

        <div className="scroll" style={{ flex: 1, overflowY: "auto", padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
          {phase === "config" && (
            <>
              <BtField label="Стратегия">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {STRATEGY_PRESETS.map(s => {
                    const on = config.strategy === s.id;
                    return (
                      <button key={s.id} onClick={() => setConfig({ ...config, strategy: s.id })} style={{
                        padding: "8px 10px",
                        background: on ? "var(--accent-soft)" : "var(--bg-2)",
                        border: `1px solid ${on ? "oklch(0.78 0.16 var(--accent-h) / 0.5)" : "var(--line)"}`,
                        borderRadius: 3, textAlign: "left", cursor: "pointer",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 500, color: on ? "var(--accent)" : "var(--text-bright)" }}>{s.name}</span>
                          <span className="mono" style={{ marginLeft: "auto", fontSize: 9.5, color: "var(--text-dim)" }}>риск · {s.risk}</span>
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-mid)", marginTop: 3, lineHeight: 1.4 }}>{s.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </BtField>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                <BtField label="Период">
                  <BtSeg value={config.period} onChange={v => setConfig({ ...config, period: v })}
                    options={[{ v: 7, label: "7 дней" }, { v: 30, label: "30 дней" }, { v: 90, label: "90 дней" }]} />
                </BtField>
                <BtField label="Начальный капитал">
                  <BtSeg value={config.capital} onChange={v => setConfig({ ...config, capital: v })}
                    options={[{ v: 1000, label: "1K" }, { v: 10000, label: "10K" }, { v: 100000, label: "100K" }]} />
                </BtField>
                <BtField label="Плечо">
                  <BtSeg value={config.leverage} onChange={v => setConfig({ ...config, leverage: v })}
                    options={[{ v: 1, label: "1×" }, { v: 3, label: "3×" }, { v: 5, label: "5×" }]} />
                </BtField>
              </div>

              <BtField label="Расчётная нагрузка" hint="оценка на симулированных свечах">
                <div style={{ background: "var(--bg-0)", padding: 10, borderRadius: 4, border: "1px solid var(--line)", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-mid)", lineHeight: 1.7 }}>
                  <div>• Свечей: ~{config.period * 24}</div>
                  <div>• Сценариев: 1 (основной)</div>
                  <div>• Комиссия: {config.fees}% / сделку</div>
                  <div>• Slippage: 0.02% (моделируется)</div>
                </div>
              </BtField>
            </>
          )}

          {phase === "running" && (
            <div style={{ padding: "40px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", letterSpacing: "0.2em" }}>
                ВЫПОЛНЕНИЕ BACKTEST · {progress}%
              </div>
              <div style={{ width: "100%", height: 4, background: "var(--bg-3)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{
                  width: `${progress}%`, height: "100%", background: "var(--accent)",
                  boxShadow: "var(--glow)",
                  transition: "width 0.1s linear",
                }} />
              </div>
              <div style={{ width: "100%" }}>
                <EquityChart curve={curve || []} capital={config.capital} width={620} height={180} />
              </div>
              <div className="mono" style={{ fontSize: 10.5, color: "var(--text-dim)" }}>
                симуляция {config.period} дней · {STRATEGY_PRESETS.find(s => s.id === config.strategy)?.name}
              </div>
            </div>
          )}

          {phase === "results" && stats && (
            <>
              <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 30, fontWeight: 500,
                  color: stats.totalReturn >= 0 ? "var(--green)" : "var(--red)" }}>
                  {stats.totalReturn >= 0 ? "+" : ""}{stats.totalReturn.toFixed(2)}%
                </span>
                <span className="mono" style={{ fontSize: 14, color: "var(--text-mid)" }}>
                  {config.capital}$ → {stats.last.toFixed(0)}$
                </span>
                <span style={{ marginLeft: "auto" }}>
                  <span className="chip mono" style={{ fontSize: 10 }}>
                    {STRATEGY_PRESETS.find(s => s.id === config.strategy)?.name} · {config.period}д · {config.leverage}×
                  </span>
                </span>
              </div>

              <EquityChart curve={curve} capital={config.capital} width={620} height={200} />

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                <BtStat label="Sharpe" value={stats.sharpe.toFixed(2)}
                  color={stats.sharpe >= 1 ? "var(--green)" : stats.sharpe >= 0 ? "var(--amber)" : "var(--red)"} />
                <BtStat label="Max DD" value={`-${stats.maxDD.toFixed(2)}%`} color="var(--red)" />
                <BtStat label="Win Rate" value={`${stats.winRate.toFixed(1)}%`}
                  color={stats.winRate >= 55 ? "var(--green)" : "var(--amber)"} />
                <BtStat label="Сделок" value={stats.trades} color="var(--text-bright)" />
              </div>

              <div style={{ background: "var(--bg-0)", border: "1px solid var(--line)", borderRadius: 4, padding: "10px 14px", fontSize: 12, color: "var(--text-mid)", lineHeight: 1.55 }}>
                <span style={{ color: "var(--accent)", fontWeight: 600 }}>↳ Заключение AI: </span>
                {stats.totalReturn > 15 && stats.maxDD < 15 ?
                  "Стратегия показывает уверенный результат. Sharpe-коэффициент устойчиво выше 1.0 — соотношение риск/доходность приемлемое для развёртывания на демо-счёте." :
                stats.totalReturn > 0 ?
                  "Стратегия прибыльна, но volatility выше ожидаемого. Рекомендуется ужесточить фильтр входов или снизить плечо до 1×." :
                  "Стратегия не показала прибыли в выбранных условиях. Перепроверьте параметры периода и/или попробуйте другой пресет."
                }
              </div>
            </>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, padding: "12px 18px", borderTop: "1px solid var(--line)", background: "var(--bg-2)" }}>
          <button onClick={onClose} className="btn">Закрыть</button>
          {phase === "config" && (
            <>
              <button className="btn" style={{ marginLeft: "auto" }}>Сохранить пресет</button>
              <button className="btn btn-accent" onClick={run}>▸ Запустить backtest</button>
            </>
          )}
          {phase === "running" && (
            <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)" }}>
              <PulseDot size={5} color="var(--accent)" /> вычисление…
            </span>
          )}
          {phase === "results" && (
            <>
              <button className="btn" onClick={() => setPhase("config")} style={{ marginLeft: "auto" }}>Перезапустить</button>
              <button className="btn btn-accent">Развернуть стратегию ▸</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function BtField({ label, hint, children }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: 0.15, textTransform: "uppercase", color: "var(--text-dim)" }}>{label}</span>
        {hint && <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function BtSeg({ value, onChange, options }) {
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
          fontFamily: "var(--font-mono)", fontSize: 11,
          cursor: "pointer",
        }}>{o.label}</button>
      ))}
    </div>
  );
}

function BtStat({ label, value, color }) {
  return (
    <div style={{
      padding: "10px 12px",
      background: "var(--bg-0)", border: "1px solid var(--line)",
      borderRadius: 4,
    }}>
      <div style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.15, fontWeight: 600, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 22, color, marginTop: 2 }}>{value}</div>
    </div>
  );
}

Object.assign(window, {
  Drawer, WalletDetail, BacktestModal,
});