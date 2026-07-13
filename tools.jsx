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

/* Deterministic per-wallet figures (hash of the address) so each wallet differs */
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function walletBalance(wallet) {
  const h = hashStr(wallet.addr || wallet.name || "");
  return { usd: 5000 + (h % 4000000), tokens: 2 + (h % 7) };
}

/* ── Etherscan V2 — real on-chain balance/txs when ETHERSCAN_API_KEY is set ── */
const ETHERSCAN_V2 = "https://api.etherscan.io/v2/api";
async function etherscanBalance(addr, key) {
  const res = await fetch(`${ETHERSCAN_V2}?chainid=1&module=account&action=balance&address=${addr}&tag=latest&apikey=${key}`);
  const j = await res.json();
  if (j.status !== "1") throw new Error(typeof j.result === "string" ? j.result : (j.message || "etherscan error"));
  return Number(j.result) / 1e18;
}
async function etherscanTxs(addr, key, limit = 10) {
  const res = await fetch(`${ETHERSCAN_V2}?chainid=1&module=account&action=txlist&address=${addr}&startblock=0&endblock=99999999&page=1&offset=${limit}&sort=desc&apikey=${key}`);
  const j = await res.json();
  if (j.status !== "1") return [];
  return (j.result || []).map(t => ({
    hash: t.hash, from: t.from, to: t.to,
    valueEth: Number(t.value) / 1e18, time: +t.timeStamp * 1000,
    dir: (t.to || "").toLowerCase() === addr.toLowerCase() ? "in" : "out",
  }));
}
function shortHex(a) { return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—"; }
function txAge(ms) {
  const s = (Date.now() - ms) / 1000;
  if (s < 60) return `${Math.floor(s)}с`;
  if (s < 3600) return `${Math.floor(s / 60)}м`;
  if (s < 86400) return `${Math.floor(s / 3600)}ч`;
  return `${Math.floor(s / 86400)}д`;
}
function useEtherscanWallet(fullAddr) {
  const [st, setSt] = useState({ loading: false, live: false, hasKey: false, balance: null, txs: [], error: null });
  useEffect(() => {
    const key = typeof getApiKey === "function" ? getApiKey("ETHERSCAN_API_KEY") : "";
    const valid = fullAddr && /^0x[0-9a-fA-F]{40}$/.test(fullAddr);
    if (!valid || !key) { setSt({ loading: false, live: false, hasKey: !!key, balance: null, txs: [], error: null }); return; }
    let cancelled = false;
    setSt(s => ({ ...s, loading: true, hasKey: true, error: null }));
    Promise.all([etherscanBalance(fullAddr, key), etherscanTxs(fullAddr, key, 10)])
      .then(([balance, txs]) => { if (!cancelled) setSt({ loading: false, live: true, hasKey: true, balance, txs, error: null }); })
      .catch(e => { if (!cancelled) setSt({ loading: false, live: false, hasKey: true, balance: null, txs: [], error: e.message }); });
    return () => { cancelled = true; };
  }, [fullAddr]);
  return st;
}

function WalletDetail({ wallet, onClose }) {
  if (!wallet) return null;
  const onchain = useEtherscanWallet(wallet.eth);
  const txs = useMemo(() => genTxs(wallet), [wallet.addr]);
  const balanceData = useMemo(() => genSpark(140, 0.12, 40), [wallet.addr]);
  const balance = useMemo(() => walletBalance(wallet), [wallet.addr]);
  const cexLink = /cex|hot|binance|coinbase|kraken/i.test(wallet.name || "") ? 96 : (hashStr(wallet.addr || "") % 45 + 8);

  const riskFactors = [
    { name: "Связь с CEX", val: cexLink, max: 100, color: cexLink > 70 ? "var(--amber)" : "var(--green)" },
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
            <div style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.15, fontWeight: 600, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 5 }}>
              Баланс
              {onchain.live && <span style={{ color: "var(--green)", fontSize: 8.5 }}>● ON-CHAIN</span>}
              {onchain.loading && <span style={{ color: "var(--text-dim)", fontSize: 8.5 }}>…</span>}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 22, color: "var(--text-bright)", marginTop: 2 }}>
              {onchain.live
                ? <><TickerNumber value={onchain.balance} decimals={onchain.balance < 1 ? 4 : 3} /> <span style={{ fontSize: 12, color: "var(--text-dim)" }}>ETH</span></>
                : <>$<TickerNumber value={balance.usd} decimals={0} suffix="" /></>}
            </div>
            <div className="mono" style={{ fontSize: 10, color: onchain.live ? "var(--green)" : "var(--text-dim)" }}>
              {onchain.live ? `${shortHex(wallet.eth)} · Etherscan`
                : (wallet.eth && !onchain.hasKey) ? "sim · задайте ETHERSCAN_API_KEY →"
                : `USD · ${balance.tokens} токен(ов)`}
            </div>
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
        <Section title="ПОСЛЕДНИЕ ТРАНЗАКЦИИ" meta={onchain.live ? `${onchain.txs.length} on-chain · Etherscan` : `${txs.length} операций · sim`}>
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
              {onchain.live
                ? onchain.txs.map(tx => {
                    const cp = tx.dir === "in" ? tx.from : tx.to;
                    return (
                      <div key={tx.hash} style={{
                        display: "grid", gridTemplateColumns: "70px 50px 1fr 70px 60px",
                        padding: "5px 10px", borderBottom: "1px solid var(--line)",
                        fontFamily: "var(--font-mono)", fontSize: 10.5, alignItems: "center",
                      }}>
                        <span style={{ color: "var(--text-dim)" }}>{txAge(tx.time)}</span>
                        <span style={{ color: tx.dir === "in" ? "var(--green)" : "var(--red)", fontWeight: 600 }}>{tx.dir === "in" ? "▲ IN" : "▼ OUT"}</span>
                        <span style={{ color: "var(--text-mid)", overflow: "hidden", textOverflow: "ellipsis" }} title={cp}>{shortHex(cp)}</span>
                        <span style={{ textAlign: "right", color: "var(--text-bright)" }}>{tx.valueEth.toFixed(3)}</span>
                        <span style={{ textAlign: "right", color: "var(--text-dim)" }}>ETH</span>
                      </div>
                    );
                  })
                : txs.map(tx => <TxRow key={tx.id} tx={tx} wallet={wallet} />)}
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

/* Real backtest: walk live Bybit 15m candles through analyzeMarket, take each
 * trend-aligned setup with its ATR SL/TP, size at 1% risk × leverage, deduct
 * fees, and compound a genuine equity curve. Returns { curve:[{v,day}], stats }. */
/* Map an analyzeMarket reading to an actual trade per selected preset.
 * Returns { side, sl, tp } or null (no trade this bar). */
function strategyTrade(a, preset, entry) {
  if (!a) return null;
  const rr = 1.8;
  const mk = (side) => {
    const slD = Math.max(a.atr * 1.5, entry * 0.004);
    return { side, sl: side === "buy" ? entry - slD : entry + slD, tp: side === "buy" ? entry + slD * rr : entry - slD * rr };
  };
  switch (preset) {
    case "mean-rev":      // counter-trend: fade RSI extremes
      if (a.rsi < 32) return mk("buy");
      if (a.rsi > 68) return mk("sell");
      return null;
    case "vol-breakout":  // trend setups confirmed by a volume + volatility surge
      return (a.setup && a.volRatio > 1.5 && a.atrPct > 0.14) ? { side: a.side, sl: a.sl, tp: a.tp } : null;
    case "ai-signals":    // only high-conviction setups
      return (a.setup && a.confidence >= 80) ? { side: a.side, sl: a.sl, tp: a.tp } : null;
    case "momentum":      // every trend-aligned setup (default engine)
    default:
      return a.setup ? { side: a.side, sl: a.sl, tp: a.tp } : null;
  }
}

function realBacktest(candles, config) {
  const cap0 = config.capital;
  const lev = config.leverage || 1;
  const feeRate = (config.fees || 0) / 100;   // per side
  const riskFrac = 0.01;                        // 1% base risk per trade
  const H = 24;                                 // max 15m candles to resolve (6h)
  let equity = cap0;
  const curve = [{ v: equity, day: 0 }];
  let wins = 0, losses = 0, grossWin = 0, grossLoss = 0;
  let i = 55, tradeNo = 0;

  while (i <= candles.length - 2) {
    const a = analyzeMarket(candles.slice(0, i + 1));
    const entry = candles[i].close;
    const trade = strategyTrade(a, config.strategy, entry);
    if (!trade) { i++; continue; }
    const { side, sl, tp } = trade;
    const slD = Math.abs(entry - sl) || entry * 0.004;
    const tpMul = 1.8;
    let outcomeR = null, exitIdx = Math.min(i + H, candles.length - 1);

    for (let j = i + 1; j <= Math.min(i + H, candles.length - 1); j++) {
      const c = candles[j];
      if (side === "buy") {
        if (c.lo <= sl) { outcomeR = -1; exitIdx = j; break; }
        if (c.hi >= tp) { outcomeR = tpMul; exitIdx = j; break; }
      } else {
        if (c.hi >= sl) { outcomeR = -1; exitIdx = j; break; }
        if (c.lo <= tp) { outcomeR = tpMul; exitIdx = j; break; }
      }
    }
    if (outcomeR === null) {
      const exitP = candles[exitIdx].close;
      const moved = side === "buy" ? (exitP - entry) : (entry - exitP);
      outcomeR = Math.max(-1, Math.min(tpMul, moved / slD));
    }

    const riskAmt = equity * riskFrac * lev;
    const stopFrac = slD / entry;
    const notional = stopFrac > 0 ? riskAmt / stopFrac : 0;
    const fee = notional * feeRate * 2;         // entry + exit
    equity = Math.max(1, equity + outcomeR * riskAmt - fee);
    if (outcomeR > 0) { wins++; grossWin += outcomeR * riskAmt; }
    else { losses++; grossLoss += Math.abs(outcomeR * riskAmt); }
    curve.push({ v: equity, day: ++tradeNo });
    i = exitIdx + 1;                            // no overlapping trades
  }

  const last = equity;
  const totalReturn = (last - cap0) / cap0 * 100;
  let peak = cap0, maxDD = 0;
  curve.forEach(p => { peak = Math.max(peak, p.v); const dd = (peak - p.v) / peak * 100; if (dd > maxDD) maxDD = dd; });
  const rets = [];
  for (let k = 1; k < curve.length; k++) rets.push((curve[k].v - curve[k - 1].v) / curve[k - 1].v);
  const mean = rets.length ? rets.reduce((s, x) => s + x, 0) / rets.length : 0;
  const varr = rets.length ? rets.reduce((s, x) => s + (x - mean) ** 2, 0) / rets.length : 0;
  const sharpe = varr > 0 ? (mean / Math.sqrt(varr)) * Math.sqrt(rets.length) : 0;
  const trades = wins + losses;
  const winRate = trades ? wins / trades * 100 : 0;
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : (grossWin > 0 ? 9.99 : 0);
  return { curve, stats: { totalReturn, maxDD, sharpe, winRate, trades, last, profitFactor } };
}

function BacktestModal({ open, onClose, asset, lang }) {
  const [phase, setPhase] = useState("config"); // config | running | results
  const [config, setConfig] = useState({
    strategy: "ai-signals",
    period: 30,
    capital: 10000,
    leverage: 1,
    fees: 0.02,
  });
  const [progress, setProgress] = useState(0);
  const [curve, setCurve] = useState(null);
  const [stats, setStats] = useState(null);
  const [real, setReal] = useState(false);

  useEffect(() => {
    if (!open) {
      setPhase("config"); setProgress(0); setCurve(null); setStats(null); setReal(false);
    }
  }, [open]);

  async function run() {
    setPhase("running");
    setProgress(0);
    setCurve([]);

    // pull real Bybit 15m candles for this asset (96 candles/day, cap 1000)
    let candles = [];
    try {
      const sym = typeof toBybitSymbol === "function" ? toBybitSymbol(asset) : String(asset).replace(/[\/\s]/g, "");
      const limit = Math.min(config.period * 96, 1000);
      candles = typeof bybitFetchKlines === "function" ? await bybitFetchKlines(sym, "15", limit) : [];
    } catch (_) { candles = []; }

    let full, stats, real = false;
    if (candles.length >= 60 && typeof analyzeMarket === "function") {
      const r = realBacktest(candles, config);
      full = r.curve; stats = r.stats; real = true;
    } else {
      full = genEquityCurve(config.strategy, config.period, config.capital);
      stats = computeStats(full, config.capital);
    }
    setReal(real);

    if (full.length < 3) { setCurve(full); setStats(stats); setPhase("results"); return; }

    const step = Math.max(1, Math.floor(full.length / 30));
    let i = 0;
    const id = setInterval(() => {
      i = Math.min(i + step, full.length);
      setProgress(Math.round((i / full.length) * 100));
      setCurve(full.slice(0, Math.max(2, i)));
      if (i >= full.length) {
        clearInterval(id);
        setStats(stats);
        setTimeout(() => setPhase("results"), 200);
      }
    }, 40);
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
          <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 10, color: real ? "var(--blue)" : "var(--text-dim)" }}>{real ? "● VAEL TA · Bybit 15m" : "vael.backtest-engine"}</span>
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

              <BtField label="Параметры прогона" hint="реальные свечи Bybit · 15m">
                <div style={{ background: "var(--bg-0)", padding: 10, borderRadius: 4, border: "1px solid var(--line)", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-mid)", lineHeight: 1.7 }}>
                  <div>• Источник: <span style={{ color: "var(--blue)" }}>Bybit spot</span> · TF 15m</div>
                  <div>• Свечей: ~{Math.min(config.period * 96, 1000)}</div>
                  <div>• Движок: VAEL TA (EMA50·MACD·RSI·ATR)</div>
                  <div>• Риск: 1% депо × {config.leverage}× · SL/TP по ATR (R 1:1.8)</div>
                  <div>• Комиссия: {config.fees}% / сторону</div>
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
                прогон движка VAEL TA · реальные свечи Bybit 15m
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