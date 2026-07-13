/* opportunities.jsx — Airdrops / Scam Scanner / Presales */

/* ═════════════════════════════════════════════════════════
 *  AIRDROPS DATA
 * ════════════════════════════════════════════════════════*/

const AIRDROP_DATA = [
  {
    id: "AD-001",
    name: "LayerN Protocol",
    ticker: "LYN",
    chain: "L2 · Arbitrum",
    estValue: { min: 280, max: 1400 },
    confidence: 87,
    deadline: Date.now() + 1000 * 60 * 60 * 24 * 14,
    snapshotDone: false,
    status: "open", // open | snapshot | claim | ended
    difficulty: "med",
    aiRating: "promising",
    tasks: [
      { id: 1, label: "Подключить кошелёк к layern.io", done: true },
      { id: 2, label: "Совершить минимум 5 транзакций bridge", done: true },
      { id: 3, label: "Удержать ≥ 0.1 ETH на L2 более 14 дней", done: false },
      { id: 4, label: "Голосовать в minimum 2 governance proposal", done: false },
      { id: 5, label: "Привести 3 рефералов с активностью", done: false },
    ],
    reasoning: "Сильная команда, привлечено 42M$ от Paradigm + Coinbase Ventures. TGE подтверждён на Q3, активная airdrop-программа объявлена официально.",
  },
  {
    id: "AD-002",
    name: "Eclipse Network",
    ticker: "ECL",
    chain: "Solana SVM",
    estValue: { min: 120, max: 800 },
    confidence: 74,
    deadline: Date.now() + 1000 * 60 * 60 * 24 * 4 + 1000 * 60 * 60 * 11,
    snapshotDone: false,
    status: "open",
    difficulty: "low",
    aiRating: "promising",
    tasks: [
      { id: 1, label: "Создать кошелёк (Backpack/Phantom)", done: true },
      { id: 2, label: "Завершить 3 квеста на eclipse.xyz/quest", done: false },
      { id: 3, label: "Mint NFT-бейдж раннего пользователя", done: false },
    ],
    reasoning: "Hot project с массивным сообществом. Snapshot закроется через 4 дня — высокий приоритет.",
  },
  {
    id: "AD-003",
    name: "Hyperliquid",
    ticker: "HYPE",
    chain: "Custom L1",
    estValue: { min: 800, max: 4200 },
    confidence: 92,
    deadline: Date.now() + 1000 * 60 * 60 * 24 * 28,
    snapshotDone: false,
    status: "open",
    difficulty: "high",
    aiRating: "promising",
    tasks: [
      { id: 1, label: "Депозит минимум 1000 USDC", done: false },
      { id: 2, label: "Торговать perpetuals · objem ≥ 50K$", done: false },
      { id: 3, label: "Использовать systematic trading > 30 дней", done: false },
      { id: 4, label: "Удержать стейк HLP > 14 дней", done: false },
    ],
    reasoning: "Революционный L1 для perps trading. Сильные команды Jane Street + Hudson River. Один из крупнейших ожидаемых airdrop'ов 2026.",
  },
  {
    id: "AD-004",
    name: "Gravity Bridge",
    ticker: "GRAV",
    chain: "Cosmos",
    estValue: { min: 40, max: 320 },
    confidence: 52,
    deadline: Date.now() + 1000 * 60 * 60 * 24 * 21,
    snapshotDone: false,
    status: "open",
    difficulty: "low",
    aiRating: "normal",
    tasks: [
      { id: 1, label: "Запустить Keplr wallet", done: false },
      { id: 2, label: "Сделать 3+ bridge транзакции", done: false },
      { id: 3, label: "Голосовать в Cosmos proposal", done: false },
    ],
    reasoning: "Базовый airdrop, не блокбастер, но cheap to farm. Конкуренция средняя.",
  },
  {
    id: "AD-005",
    name: "ZkBridge Universal",
    ticker: "ZBU",
    chain: "Multi-chain",
    estValue: { min: 0, max: 0 },
    confidence: 18,
    deadline: Date.now() + 1000 * 60 * 60 * 24 * 9,
    snapshotDone: false,
    status: "open",
    difficulty: "med",
    aiRating: "risky",
    tasks: [
      { id: 1, label: "Подключить кошелёк", done: false },
      { id: 2, label: "Mint sybil NFT (требует 0.05 ETH)", done: false },
    ],
    reasoning: "Подозрительные шаблоны: требование платы за участие, отсутствие верифицированной команды, нет VC-инвестиций. Рекомендуется пропустить.",
  },
  {
    id: "AD-006",
    name: "Berachain Testnet",
    ticker: "BERA",
    chain: "Cosmos EVM",
    estValue: { min: 500, max: 2800 },
    confidence: 84,
    deadline: Date.now() + 1000 * 60 * 60 * 24 * 42,
    snapshotDone: false,
    status: "open",
    difficulty: "med",
    aiRating: "promising",
    tasks: [
      { id: 1, label: "Получить тестовые BERA из crana", done: true },
      { id: 2, label: "Залить минимум 2 пары ликвидности", done: true },
      { id: 3, label: "Совершить 20+ swap-операций", done: false },
      { id: 4, label: "Lending + borrowing на Honeyfi", done: false },
    ],
    reasoning: "Сильная команда (бывшие OpenSea, Polychain). PoL модель уникальна. Высокий потенциал.",
  },
];

const AIRDROP_RATINGS = {
  promising: { ru: "ПЕРСПЕКТ", color: "var(--green)",   glyph: "▲" },
  normal:    { ru: "ОБЫЧНЫЙ",  color: "var(--blue)",    glyph: "●" },
  risky:     { ru: "РИСКОВ",   color: "var(--amber)",   glyph: "△" },
  scam:      { ru: "СКАМ",     color: "var(--red)",     glyph: "✕" },
};

const DIFFICULTY = {
  low:  { ru: "ЛЁГКО",  color: "var(--green)" },
  med:  { ru: "СРЕДНЕ", color: "var(--amber)" },
  high: { ru: "СЛОЖНО", color: "var(--red)" },
};

/* ─────── Countdown helper ─────── */
function useCountdown(target) {
  const [now, setNow] = useState(Date.now());
  useInterval(() => setNow(Date.now()), 1000);
  const diff = Math.max(0, target - now);
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const secs = Math.floor((diff % (1000 * 60)) / 1000);
  return { days, hours, mins, secs, total: diff, ended: diff <= 0 };
}

function CountdownBadge({ target, size = "md" }) {
  const c = useCountdown(target);
  const urgent = c.days < 1;
  const veryUrgent = c.days === 0 && c.hours < 6;
  const color = c.ended ? "var(--text-dim)" : veryUrgent ? "var(--red)" : urgent ? "var(--amber)" : "var(--accent)";
  return (
    <span style={{
      fontFamily: "var(--font-mono)", fontSize: size === "lg" ? 13 : 10.5,
      color, letterSpacing: 0.04,
      display: "inline-flex", alignItems: "center", gap: 4,
    }}>
      {urgent && <PulseDot size={4} color={color} />}
      {c.ended ? "ЗАКРЫТО" : (
        c.days > 0 ?
        `${c.days}д ${String(c.hours).padStart(2,"0")}ч ${String(c.mins).padStart(2,"0")}м` :
        `${String(c.hours).padStart(2,"0")}:${String(c.mins).padStart(2,"0")}:${String(c.secs).padStart(2,"0")}`
      )}
    </span>
  );
}

/* ─────── Airdrop card ─────── */
function AirdropCard({ a, onSelect, selected }) {
  const r = AIRDROP_RATINGS[a.aiRating];
  const d = DIFFICULTY[a.difficulty];
  const progress = a.tasks.filter(t => t.done).length / a.tasks.length;
  return (
    <div onClick={onSelect} style={{
      padding: "12px 14px",
      borderBottom: "1px solid var(--line)",
      borderLeft: `3px solid ${selected ? r.color : "transparent"}`,
      background: selected ? "var(--accent-soft)" : "transparent",
      cursor: "pointer",
      display: "flex", flexDirection: "column", gap: 8,
      transition: "background 0.12s",
    }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 4,
          background: "var(--bg-2)", border: `1px solid ${r.color}`,
          color: r.color, display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700,
          boxShadow: selected ? `0 0 12px -2px ${r.color}` : "none",
          flexShrink: 0,
        }}>{a.ticker.slice(0, 2)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 13, color: "var(--text-bright)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span>
            <span className="chip mono" style={{ fontSize: 9 }}>{a.ticker}</span>
          </div>
          <div className="mono" style={{ fontSize: 9.5, color: "var(--text-dim)", marginTop: 1 }}>
            {a.id} · {a.chain}
          </div>
        </div>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600,
          color: r.color, padding: "1px 6px",
          border: `1px solid ${r.color}`, borderRadius: 2,
          letterSpacing: 0.08,
        }}>{r.glyph} {r.ru}</span>
      </div>

      {/* Value + countdown */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--font-mono)" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.12, fontWeight: 600 }}>ОЦЕНКА ЦЕНЫ</div>
          <div style={{ fontSize: 14, color: "var(--text-bright)" }}>
            {a.estValue.max === 0 ? "—" : `$${a.estValue.min}–${a.estValue.max}`}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.12, fontWeight: 600 }}>ОСТАЛОСЬ</div>
          <CountdownBadge target={a.deadline} />
        </div>
      </div>

      {/* Progress + difficulty */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, height: 3, background: "var(--bg-3)", borderRadius: 1, overflow: "hidden" }}>
          <div style={{ width: `${progress * 100}%`, height: "100%", background: progress === 1 ? "var(--green)" : "var(--accent)", borderRadius: 1, transition: "width 0.3s" }} />
        </div>
        <span className="mono" style={{ fontSize: 9.5, color: "var(--text-mid)" }}>{a.tasks.filter(t => t.done).length}/{a.tasks.length}</span>
        <span className="mono" style={{ fontSize: 9, color: d.color, fontWeight: 600, letterSpacing: 0.06 }}>{d.ru}</span>
      </div>
    </div>
  );
}

/* ─────── Airdrop detail ─────── */
function AirdropDetail({ a, onToggleTask }) {
  if (!a) return null;
  const r = AIRDROP_RATINGS[a.aiRating];
  const c = useCountdown(a.deadline);
  const completed = a.tasks.filter(t => t.done).length;

  return (
    <div className="scroll" style={{ flex: 1, overflowY: "auto", padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 6,
          background: "var(--bg-0)", border: `1.5px solid ${r.color}`,
          color: r.color, display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700,
          boxShadow: `0 0 24px -6px ${r.color}`,
        }}>{a.ticker}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, color: "var(--text-bright)", fontWeight: 500 }}>{a.name}</div>
          <div className="mono" style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>{a.id} · {a.chain} · ticker ${a.ticker}</div>
        </div>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
          color: r.color, padding: "4px 10px",
          border: `1px solid ${r.color}`,
          background: `oklch(from ${r.color} l c h / 0.08)`,
          borderRadius: 3, letterSpacing: 0.1,
        }}>{r.glyph} {r.ru}</span>
      </div>

      {/* Big stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <BigStat label="ОЦЕНКА ВЫПЛАТЫ" v={a.estValue.max === 0 ? "—" : `$${a.estValue.min}-${a.estValue.max}`} c="var(--green)" sub="на 1 кошелёк" />
        <BigStat label="ДО SNAPSHOT" v={c.ended ? "ЗАКРЫТО" : `${c.days}д ${String(c.hours).padStart(2,"0")}ч`} c={c.days < 1 ? "var(--red)" : "var(--amber)"} sub={c.days < 1 ? "СРОЧНО" : "осталось"} />
        <BigStat label="CONFIDENCE" v={`${a.confidence}%`} c={a.confidence > 80 ? "var(--green)" : a.confidence > 60 ? "var(--amber)" : "var(--red)"} sub="AI-оценка" />
      </div>

      {/* AI reasoning */}
      <div style={{
        background: `oklch(from ${r.color} l c h / 0.06)`,
        border: `1px solid ${r.color}`, borderLeft: `3px solid ${r.color}`,
        borderRadius: 4, padding: "10px 14px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: r.color, letterSpacing: 0.15, fontWeight: 600 }}>
            AI ЗАКЛЮЧЕНИЕ · research.agt + risk.agt
          </span>
        </div>
        <div style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.55 }}>{a.reasoning}</div>
      </div>

      {/* Tasks */}
      <div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={fieldLabel}>ЗАДАНИЯ · {completed}/{a.tasks.length}</span>
          <span className="mono" style={{ fontSize: 10, color: "var(--text-dim)" }}>отметьте выполненные шаги</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {a.tasks.map(t => (
            <button key={t.id} onClick={() => onToggleTask(a.id, t.id)} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "9px 12px", textAlign: "left",
              background: t.done ? "oklch(0.78 0.16 155 / 0.08)" : "var(--bg-0)",
              border: `1px solid ${t.done ? "oklch(0.78 0.16 155 / 0.3)" : "var(--line)"}`,
              borderRadius: 3, cursor: "pointer",
            }}>
              <span style={{
                width: 18, height: 18, borderRadius: 2,
                background: t.done ? "var(--green)" : "var(--bg-2)",
                border: `1px solid ${t.done ? "var(--green)" : "var(--line-bright)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "var(--font-mono)", fontSize: 10, color: t.done ? "var(--bg-0)" : "var(--text-dim)",
                flexShrink: 0,
              }}>{t.done && "✓"}</span>
              <span style={{ flex: 1, fontSize: 12, color: t.done ? "var(--text-mid)" : "var(--text-bright)", textDecoration: t.done ? "line-through" : "none" }}>
                {t.label}
              </span>
              <span className="mono" style={{ fontSize: 9, color: "var(--text-dim)" }}>#{t.id}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        <button className="btn">Открыть сайт</button>
        <button className="btn">Гайд</button>
        <button className="btn btn-accent" style={{ marginLeft: "auto" }}>Добавить в Watchlist</button>
      </div>
    </div>
  );
}

function BigStat({ label, v, c, sub }) {
  return (
    <div style={{
      padding: "10px 12px",
      background: "var(--bg-0)", border: "1px solid var(--line)",
      borderRadius: 4,
    }}>
      <div style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.15, fontWeight: 600, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, color: c, fontWeight: 500, marginTop: 2 }}>{v}</div>
      {sub && <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--text-dim)", marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════
 *  SCAM SCANNER
 * ════════════════════════════════════════════════════════*/

const SAMPLE_TOKENS = [
  "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984", // UNI
  "0xa0b86a33e6411e2a9b3b6e7a8e1f8e2e8d0b6e9a", // suspicious
  "0xdeadbeef00000000000000000000000000000001", // scam
  "0x1234567890abcdef1234567890abcdef12345678", // unknown
];

const RISK_FACTORS_TEMPLATES = [
  { id: "liq",     label: "Заблокированная ликвидность",       weight: 18 },
  { id: "audit",   label: "Аудит smart-contract",              weight: 14 },
  { id: "team",    label: "Верифицированная команда (KYC)",    weight: 12 },
  { id: "honey",   label: "Тест на honeypot",                   weight: 16 },
  { id: "owner",   label: "Renounced ownership",                weight: 10 },
  { id: "tax",     label: "Скрытые комиссии (tax)",            weight: 10 },
  { id: "concent", label: "Концентрация холдеров",              weight: 8 },
  { id: "social",  label: "Социальный графф (X, TG, GitHub)",   weight: 6 },
  { id: "code",    label: "Качество кода контракта",            weight: 6 },
];

function genScamScan(contract) {
  // generate deterministic-ish randomness based on contract string
  const seed = (contract || "0x").split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  const rand = (i) => {
    const x = Math.sin(seed * 1000 + i * 137) * 10000;
    return x - Math.floor(x);
  };

  // detect known patterns
  const isObviousScam = contract.includes("dead") || contract.includes("bad");
  const isPromising = contract.toLowerCase().includes("1f98") || contract === "0xa0b8";

  const factors = RISK_FACTORS_TEMPLATES.map((f, i) => {
    let pass;
    let detail;
    if (isObviousScam) {
      pass = rand(i) > 0.78;
    } else if (isPromising) {
      pass = rand(i) > 0.15;
    } else {
      pass = rand(i) > 0.45;
    }
    const score = pass ? Math.floor(rand(i + 100) * 30 + 70) : Math.floor(rand(i + 200) * 50);
    const detailsPool = {
      liq: pass ? "$2.4M заблокировано на 12 месяцев · Pinksale" : "Ликвидность не заблокирована, owner может вывести",
      audit: pass ? "Аудит CertiK · 91/100 · 0 critical" : "Аудита нет в открытых базах",
      team: pass ? "3 публичных co-founder · LinkedIn verified" : "Анонимная команда · нет KYC",
      honey: pass ? "Покупка и продажа симулируются успешно" : "Sell tx fail · возможен honeypot",
      owner: pass ? "Ownership renounced (0x0)" : "Owner активен · может изменить tax/blacklist",
      tax: pass ? "Buy 2% · Sell 2% · transparent" : "Скрытый tax 18% при больших sell-операциях",
      concent: pass ? "Top-10 wallets держат 32% · приемлемо" : "1 wallet держит 87% supply · риск дампа",
      social: pass ? "Активный Discord 12K · GitHub commits 24/7d" : "Шаблонный сайт, фейковые followers",
      code: pass ? "Verified · OpenZeppelin libs · clean" : "Obfuscated · suspicious selfdestruct",
    };
    return { ...f, pass, score, detail: detailsPool[f.id] };
  });

  const totalScore = factors.reduce((s, f) => s + (f.pass ? f.weight : 0), 0);
  const maxScore = factors.reduce((s, f) => s + f.weight, 0);
  const safetyScore = Math.round((totalScore / maxScore) * 100);

  let verdict, color;
  if (safetyScore >= 80) { verdict = "promising"; color = "var(--green)"; }
  else if (safetyScore >= 60) { verdict = "normal"; color = "var(--blue)"; }
  else if (safetyScore >= 35) { verdict = "risky"; color = "var(--amber)"; }
  else { verdict = "scam"; color = "var(--red)"; }

  return {
    contract,
    safetyScore,
    verdict,
    color,
    factors,
    name: isPromising ? "PromisingToken (PRT)" : isObviousScam ? "SafeMoonInu V77" : "Unknown Token",
    chain: "ETH mainnet",
    age: isPromising ? "847 дней" : isObviousScam ? "3 часа" : "47 дней",
    holders: isPromising ? "248,420" : isObviousScam ? "84" : "2,148",
    liquidity: isPromising ? "$12.4M" : isObviousScam ? "$8.2K" : "$184K",
  };
}

const SCAM_VERDICTS = {
  promising: { ru: "ПЕРСПЕКТИВНЫЙ", color: "var(--green)", glyph: "▲" },
  normal:    { ru: "ОБЫЧНЫЙ",       color: "var(--blue)",  glyph: "●" },
  risky:     { ru: "РИСКОВАННЫЙ",   color: "var(--amber)", glyph: "△" },
  scam:      { ru: "СКАМ",          color: "var(--red)",   glyph: "✕" },
};

function ScamScanner() {
  const [input, setInput] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState("");

  const phases = [
    "Декодирование контракта",
    "Анализ holders distribution",
    "Проверка locked liquidity",
    "Honeypot simulation",
    "Audit DB lookup",
    "Social graph анализ",
    "Code review · AI",
    "Финальный scoring",
  ];

  function startScan() {
    if (!input.trim()) return;
    setScanning(true);
    setResult(null);
    setProgress(0);
    setPhase(phases[0]);
    let i = 0;
    const id = setInterval(() => {
      i++;
      setProgress(Math.round((i / phases.length) * 100));
      setPhase(phases[Math.min(i, phases.length - 1)]);
      if (i >= phases.length) {
        clearInterval(id);
        setTimeout(() => {
          const res = genScamScan(input);
          setResult(res);
          setScanning(false);
          window.__emitToast?.({
            kind: res.verdict === "scam" ? "crit" : res.verdict === "promising" ? "win" : "info",
            title: `Сканирование завершено · ${res.verdict.toUpperCase()}`,
            body: `${res.name} · safety score ${res.safetyScore}/100`,
            meta: input.slice(0, 22) + "…",
          });
        }, 350);
      }
    }, 300);
  }

  return (
    <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: "var(--gap)", minHeight: 0, overflow: "hidden" }}>
      {/* Input column */}
      <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
        <PanelHeader title="СКАНЕР · ВВОД" meta="contract / ticker / URL" />
        <div className="scroll" style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div style={fieldLabel}>Адрес контракта или ticker</div>
            <input value={input} onChange={e => setInput(e.target.value)}
              placeholder="0x... или TICKER"
              onKeyDown={e => e.key === "Enter" && !scanning && startScan()}
              style={{
                width: "100%", padding: "10px 12px",
                background: "var(--bg-0)", border: "1px solid var(--line-bright)",
                color: "var(--text-bright)", fontFamily: "var(--font-mono)", fontSize: 12,
                outline: "none", borderRadius: 4,
              }} />
          </div>

          <button onClick={startScan} disabled={scanning || !input.trim()}
            className="btn btn-accent" style={{
              padding: "10px 14px", justifyContent: "center",
              opacity: scanning || !input.trim() ? 0.5 : 1,
            }}>
            {scanning ? "⌛ СКАНИРОВАНИЕ…" : "▸ ЗАПУСТИТЬ SCAM-SCAN"}
          </button>

          <div>
            <div style={fieldLabel}>Быстрые примеры</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {SAMPLE_TOKENS.map(t => (
                <button key={t} onClick={() => setInput(t)} className="btn" style={{
                  fontFamily: "var(--font-mono)", fontSize: 10, padding: "5px 8px",
                  justifyContent: "flex-start", textAlign: "left",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {scanning && (
            <div style={{
              background: "var(--bg-0)", border: "1px solid var(--line)", borderRadius: 4,
              padding: 12, display: "flex", flexDirection: "column", gap: 8,
            }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent)", letterSpacing: 0.15 }}>
                ЭТАП {Math.ceil((progress / 100) * phases.length)} / {phases.length}
              </div>
              <div style={{ width: "100%", height: 4, background: "var(--bg-3)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ width: `${progress}%`, height: "100%", background: "var(--accent)", boxShadow: "var(--glow)", transition: "width 0.2s" }} />
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text)" }}>
                <span style={{ color: "var(--green)", marginRight: 4 }}>✓</span>{phase}
                <span style={{ display: "inline-block", width: 6, height: 11, marginLeft: 4, background: "var(--accent)", animation: "blink 1s steps(2) infinite", verticalAlign: "middle" }} />
              </div>
            </div>
          )}

          <div style={{
            background: "var(--bg-2)", padding: "8px 10px", borderRadius: 3,
            border: "1px dashed var(--line-bright)",
            fontSize: 11, color: "var(--text-mid)", lineHeight: 1.5,
          }}>
            <span className="accent">↳ </span>Сканер использует 9 факторов: ликвидность, аудит, KYC команды, honeypot, ownership, tax, концентрация холдеров, социальный граф, код контракта.
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
        <PanelHeader title={result ? `РЕЗУЛЬТАТ · ${result.name}` : "РЕЗУЛЬТАТ"} meta={result ? result.contract.slice(0, 20) + "…" : "ожидание сканирования"} />
        <div className="scroll" style={{ flex: 1, overflowY: "auto" }}>
          {!result && !scanning && <ScamEmpty />}
          {result && <ScamResult result={result} />}
        </div>
      </div>
    </div>
  );
}

function ScamEmpty() {
  return (
    <div style={{
      padding: 40, textAlign: "center", color: "var(--text-dim)", fontSize: 12,
      display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
    }}>
      <div style={{
        width: 60, height: 60, borderRadius: 4,
        background: "var(--bg-0)", border: "1px dashed var(--line-bright)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "var(--font-mono)", fontSize: 22, color: "var(--text-dim)",
      }}>?</div>
      <div style={{ maxWidth: 280, lineHeight: 1.5 }}>
        Введите адрес smart-contract или ticker токена слева и нажмите «<span className="accent">▸ ЗАПУСТИТЬ SCAM-SCAN</span>».
        <br /><br />
        Система проанализирует 9 факторов риска и выдаст вердикт от <span style={{ color: "var(--green)" }}>ПЕРСПЕКТ</span> до <span style={{ color: "var(--red)" }}>СКАМ</span>.
      </div>
    </div>
  );
}

function ScamResult({ result }) {
  const v = SCAM_VERDICTS[result.verdict];
  return (
    <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Headline verdict */}
      <div style={{
        padding: "18px 20px",
        background: `oklch(from ${v.color} l c h / 0.08)`,
        border: `1px solid ${v.color}`,
        borderLeft: `4px solid ${v.color}`,
        borderRadius: 4,
        display: "flex", alignItems: "center", gap: 16,
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: 6,
          background: "var(--bg-0)", border: `2px solid ${v.color}`,
          color: v.color, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--font-mono)",
          boxShadow: `0 0 28px -8px ${v.color}`,
        }}>
          <span style={{ fontSize: 24, fontWeight: 700 }}>{v.glyph}</span>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.12, marginTop: 2 }}>{v.ru}</span>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: v.color, letterSpacing: 0.15, fontWeight: 600 }}>SAFETY SCORE</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 2 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 42, color: v.color, fontWeight: 300, lineHeight: 1 }}>{result.safetyScore}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--text-dim)" }}>/100</span>
          </div>
          <div style={{ marginTop: 6, height: 4, background: "var(--bg-3)", borderRadius: 2, overflow: "hidden", maxWidth: 240 }}>
            <div style={{ width: `${result.safetyScore}%`, height: "100%", background: v.color, boxShadow: `0 0 6px ${v.color}` }} />
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        <BigStat label="ВОЗРАСТ" v={result.age} c="var(--text-bright)" />
        <BigStat label="ХОЛДЕРЫ" v={result.holders} c="var(--text-bright)" />
        <BigStat label="ЛИКВИДНОСТЬ" v={result.liquidity} c="var(--accent)" />
        <BigStat label="ЦЕПЬ" v={result.chain} c="var(--text-bright)" />
      </div>

      {/* Factor breakdown */}
      <div>
        <div style={fieldLabel}>ФАКТОРЫ РИСКА · {result.factors.filter(f => f.pass).length} из {result.factors.length} пройдено</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {result.factors.map(f => (
            <div key={f.id} style={{
              display: "grid", gridTemplateColumns: "24px 1fr auto auto",
              gap: 10, alignItems: "center",
              padding: "8px 12px",
              background: "var(--bg-0)", border: "1px solid var(--line)",
              borderLeft: `2px solid ${f.pass ? "var(--green)" : "var(--red)"}`,
              borderRadius: 3,
            }}>
              <span style={{
                width: 18, height: 18, borderRadius: 2,
                background: f.pass ? "oklch(0.78 0.16 155 / 0.15)" : "oklch(0.70 0.20 25 / 0.15)",
                color: f.pass ? "var(--green)" : "var(--red)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
              }}>{f.pass ? "✓" : "✕"}</span>
              <div>
                <div style={{ fontSize: 11.5, color: "var(--text-bright)", fontWeight: 500 }}>{f.label}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", marginTop: 1 }}>{f.detail}</div>
              </div>
              <div style={{ minWidth: 50, textAlign: "right" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: f.pass ? "var(--green)" : "var(--red)" }}>{f.score}/100</div>
              </div>
              <div className="mono" style={{ fontSize: 9, color: "var(--text-dim)", minWidth: 30, textAlign: "right" }}>×{f.weight}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        <button className="btn">Полный отчёт PDF</button>
        <button className="btn">В Watchlist</button>
        <button className="btn btn-accent" style={{ marginLeft: "auto" }}>Новый скан</button>
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════
 *  PRESALES
 * ════════════════════════════════════════════════════════*/

const PRESALE_DATA = [
  {
    id: "PS-001",
    name: "Synthora AI",
    ticker: "SNTR",
    category: "AI · L2",
    raise: { current: 14.2, target: 18.0 },
    fdv: 142,
    price: 0.084,
    vesting: "6м cliff + 24м linear",
    launch: Date.now() + 1000 * 60 * 60 * 24 * 12,
    presaleEnd: Date.now() + 1000 * 60 * 60 * 24 * 3,
    rating: "promising",
    confidence: 84,
    factors: {
      team:    { score: 88, note: "Ex-Google AI · ex-Anthropic · KYC'd" },
      tech:    { score: 82, note: "Open-source · 4.2K stars · аудит OK" },
      vc:      { score: 92, note: "a16z + Polychain · $9M seed" },
      tokeno:  { score: 76, note: "Длинный vesting · low FDV at TGE" },
      hype:    { score: 78, note: "X 84K followers · GitHub активный" },
    },
  },
  {
    id: "PS-002",
    name: "QuantumX",
    ticker: "QNTM",
    category: "Infra · Privacy",
    raise: { current: 4.8, target: 12.0 },
    fdv: 380,
    price: 0.142,
    vesting: "0м cliff + 6м linear",
    launch: Date.now() + 1000 * 60 * 60 * 24 * 24,
    presaleEnd: Date.now() + 1000 * 60 * 60 * 24 * 9,
    rating: "risky",
    confidence: 48,
    factors: {
      team:    { score: 42, note: "Анонимная команда · нет KYC" },
      tech:    { score: 62, note: "Whitepaper только · нет MVP" },
      vc:      { score: 38, note: "Только community-fundraising" },
      tokeno:  { score: 28, note: "Высокий FDV · короткий vesting" },
      hype:    { score: 84, note: "X 240K · подозрительно для нового" },
    },
  },
  {
    id: "PS-003",
    name: "MeshNet Protocol",
    ticker: "MESH",
    category: "DePIN · IoT",
    raise: { current: 24.0, target: 24.0 },
    fdv: 280,
    price: 0.048,
    vesting: "3м cliff + 18м linear",
    launch: Date.now() + 1000 * 60 * 60 * 24 * 6,
    presaleEnd: Date.now() - 1000 * 60 * 60 * 6,
    rating: "promising",
    confidence: 78,
    factors: {
      team:    { score: 76, note: "Ex-Helium core team · KYC'd" },
      tech:    { score: 84, note: "Working hardware · 4K nodes online" },
      vc:      { score: 82, note: "Multicoin + Borderless · $7M seed" },
      tokeno:  { score: 72, note: "Reasonable FDV · долгий cliff" },
      hype:    { score: 68, note: "Community 32K · стабильный рост" },
    },
  },
  {
    id: "PS-004",
    name: "ChonkyMoonInu V99",
    ticker: "CHONKV99",
    category: "Meme · Inflationary",
    raise: { current: 0.4, target: 0.5 },
    fdv: 8.2,
    price: 0.0000028,
    vesting: "Нет",
    launch: Date.now() + 1000 * 60 * 60 * 24 * 2,
    presaleEnd: Date.now() + 1000 * 60 * 60 * 18,
    rating: "scam",
    confidence: 8,
    factors: {
      team:    { score: 4,  note: "Анонимные dev · сайт-шаблон" },
      tech:    { score: 12, note: "Стандартный ERC-20 fork · нет утилиты" },
      vc:      { score: 0,  note: "Нет VC · нет публичных инвесторов" },
      tokeno:  { score: 8,  note: "Нет vesting · 100% разлок на TGE" },
      hype:    { score: 22, note: "Накрученные TG-чаты · фейковые followers" },
    },
  },
  {
    id: "PS-005",
    name: "Atlas Compute",
    ticker: "ATL",
    category: "DePIN · GPU",
    raise: { current: 8.4, target: 22.0 },
    fdv: 320,
    price: 0.18,
    vesting: "12м cliff + 24м linear",
    launch: Date.now() + 1000 * 60 * 60 * 24 * 32,
    presaleEnd: Date.now() + 1000 * 60 * 60 * 24 * 16,
    rating: "normal",
    confidence: 64,
    factors: {
      team:    { score: 68, note: "Ex-NVIDIA + ex-Crusoe · 2 founders KYC'd" },
      tech:    { score: 74, note: "Testnet с 1.2K GPU online" },
      vc:      { score: 62, note: "Pantera + Hashed · $4M strategic" },
      tokeno:  { score: 58, note: "Очень длинный vesting · low circ at TGE" },
      hype:    { score: 48, note: "Скромный социальный охват · качество > quantity" },
    },
  },
];

function PresalesView() {
  const [selected, setSelected] = useState(PRESALE_DATA[0].id);
  const sel = PRESALE_DATA.find(p => p.id === selected);
  return (
    <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: "var(--gap)", minHeight: 0, overflow: "hidden" }}>
      <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
        <PanelHeader title="ПРЕСЕЙЛЫ · ОТКРЫТЫЕ" meta={`${PRESALE_DATA.length} · sort: confidence`} />
        <div className="scroll" style={{ flex: 1, overflowY: "auto" }}>
          {PRESALE_DATA.map(p => <PresaleRow key={p.id} p={p} selected={selected === p.id} onClick={() => setSelected(p.id)} />)}
        </div>
      </div>

      <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
        <PanelHeader title={sel ? `${sel.name} · ${sel.ticker}` : "ДЕТАЛИЗАЦИЯ"} meta={sel?.id} />
        <div className="scroll" style={{ flex: 1, overflowY: "auto" }}>
          {sel && <PresaleDetail p={sel} />}
        </div>
      </div>
    </div>
  );
}

function PresaleRow({ p, selected, onClick }) {
  const r = AIRDROP_RATINGS[p.rating];
  const filled = (p.raise.current / p.raise.target) * 100;
  return (
    <div onClick={onClick} style={{
      padding: "10px 12px",
      borderBottom: "1px solid var(--line)",
      borderLeft: `3px solid ${selected ? r.color : "transparent"}`,
      background: selected ? "var(--accent-soft)" : "transparent",
      cursor: "pointer",
      display: "flex", flexDirection: "column", gap: 7,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 4,
          background: "var(--bg-2)", border: `1px solid ${r.color}`,
          color: r.color, display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
        }}>{p.ticker.slice(0, 3)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: "var(--text-bright)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
          <div className="mono" style={{ fontSize: 9.5, color: "var(--text-dim)" }}>{p.category}</div>
        </div>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 8.5, fontWeight: 700,
          color: r.color, padding: "1px 5px",
          border: `1px solid ${r.color}`, borderRadius: 2,
        }}>{r.glyph} {r.ru}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, fontFamily: "var(--font-mono)", fontSize: 9.5 }}>
        <span><span style={{ color: "var(--text-dim)" }}>RAISE: </span><span style={{ color: "var(--text-bright)" }}>${p.raise.current}M</span></span>
        <span><span style={{ color: "var(--text-dim)" }}>FDV: </span><span style={{ color: "var(--text-bright)" }}>${p.fdv}M</span></span>
        <span><span style={{ color: "var(--text-dim)" }}>CONF: </span><span style={{ color: r.color }}>{p.confidence}%</span></span>
      </div>
      <div style={{ height: 3, background: "var(--bg-3)", borderRadius: 1, overflow: "hidden" }}>
        <div style={{ width: `${Math.min(100, filled)}%`, height: "100%", background: filled >= 100 ? "var(--green)" : r.color, borderRadius: 1 }} />
      </div>
    </div>
  );
}

function PresaleDetail({ p }) {
  const r = AIRDROP_RATINGS[p.rating];
  const filled = (p.raise.current / p.raise.target) * 100;
  return (
    <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 6,
          background: "var(--bg-0)", border: `1.5px solid ${r.color}`,
          color: r.color, display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700,
          boxShadow: `0 0 24px -6px ${r.color}`,
        }}>{p.ticker}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, color: "var(--text-bright)", fontWeight: 500 }}>{p.name}</div>
          <div className="mono" style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>{p.id} · {p.category} · ${p.price}/токен</div>
        </div>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
          color: r.color, padding: "4px 10px",
          border: `1px solid ${r.color}`,
          background: `oklch(from ${r.color} l c h / 0.08)`,
          borderRadius: 3, letterSpacing: 0.1,
        }}>{r.glyph} {r.ru}</span>
      </div>

      {/* Sale progress */}
      <div style={{
        padding: "14px 16px",
        background: "var(--bg-0)", border: "1px solid var(--line)",
        borderRadius: 4,
      }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--text-dim)", letterSpacing: 0.12, fontWeight: 600 }}>СБОР СРЕДСТВ</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--accent)", fontWeight: 500 }}>
            ${p.raise.current}M / ${p.raise.target}M <span style={{ fontSize: 11, color: "var(--text-dim)" }}>({filled.toFixed(0)}%)</span>
          </span>
        </div>
        <div style={{ height: 6, background: "var(--bg-3)", borderRadius: 3, overflow: "hidden", position: "relative" }}>
          <div style={{ width: `${Math.min(100, filled)}%`, height: "100%", background: filled >= 100 ? "var(--green)" : r.color, boxShadow: `0 0 8px ${r.color}` }} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        <BigStat label="FDV" v={`$${p.fdv}M`} c="var(--text-bright)" sub="fully diluted" />
        <BigStat label="ПРЕСЕЙЛ ДО" v={<CountdownBadge target={p.presaleEnd} size="lg" />} c="var(--amber)" />
        <BigStat label="TGE / LAUNCH" v={<CountdownBadge target={p.launch} size="lg" />} c="var(--accent)" />
      </div>

      <div style={{
        background: "var(--bg-0)", border: "1px solid var(--line)", borderRadius: 4,
        padding: "10px 14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10,
      }}>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.15, fontWeight: 600 }}>VESTING</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text)", marginTop: 2 }}>{p.vesting}</div>
        </div>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.15, fontWeight: 600 }}>ЦЕНА</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text)", marginTop: 2 }}>${p.price}</div>
        </div>
      </div>

      {/* Factor analysis */}
      <div>
        <div style={fieldLabel}>АНАЛИЗ ФАКТОРОВ · AI</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {[
            { k: "team", label: "Команда + KYC" },
            { k: "tech", label: "Технология + продукт" },
            { k: "vc", label: "VC-инвесторы" },
            { k: "tokeno", label: "Tokenomics + vesting" },
            { k: "hype", label: "Hype / community" },
          ].map(({ k, label }) => {
            const f = p.factors[k];
            const c = f.score >= 75 ? "var(--green)" : f.score >= 50 ? "var(--amber)" : "var(--red)";
            return (
              <div key={k} style={{
                padding: "8px 12px",
                background: "var(--bg-0)", border: "1px solid var(--line)",
                borderLeft: `2px solid ${c}`,
                borderRadius: 3,
                display: "grid", gridTemplateColumns: "140px 1fr 100px", gap: 10, alignItems: "center",
              }}>
                <span style={{ fontSize: 11.5, color: "var(--text-bright)", fontWeight: 500 }}>{label}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-mid)" }}>{f.note}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ flex: 1, height: 4, background: "var(--bg-3)", borderRadius: 1, overflow: "hidden" }}>
                    <div style={{ width: `${f.score}%`, height: "100%", background: c }} />
                  </div>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: c, minWidth: 28, textAlign: "right" }}>{f.score}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        <button className="btn">Whitepaper</button>
        <button className="btn">Discord</button>
        <button className="btn btn-accent" style={{ marginLeft: "auto" }}
          disabled={p.rating === "scam"}
          style={{
            marginLeft: "auto",
            opacity: p.rating === "scam" ? 0.4 : 1,
            cursor: p.rating === "scam" ? "not-allowed" : "pointer",
          }}
        >
          {p.rating === "scam" ? "✕ НЕ РЕКОМЕНДУЕТСЯ" : "▸ Участвовать"}
        </button>
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════
 *  OPPORTUNITIES PAGE (parent)
 * ════════════════════════════════════════════════════════*/

function OpportunitiesPage({ lang }) {
  const [tab, setTab] = useState("airdrops");
  const [airdrops, setAirdrops] = useState(AIRDROP_DATA);
  const [selectedAirdrop, setSelectedAirdrop] = useState(AIRDROP_DATA[0].id);

  const selA = airdrops.find(a => a.id === selectedAirdrop);

  function toggleTask(adId, taskId) {
    setAirdrops(prev => prev.map(a => a.id === adId ? {
      ...a,
      tasks: a.tasks.map(t => t.id === taskId ? { ...t, done: !t.done } : t),
    } : a));
  }

  // counters
  const promisingAd = airdrops.filter(a => a.aiRating === "promising").length;
  const totalEstValue = airdrops.reduce((s, a) => s + (a.estValue.max || 0), 0);

  return (
    <div data-screen-label="11 Opportunities" style={{
      height: "100%", padding: "var(--gap)",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      <PageHeader title={lang === "en" ? "OPPORTUNITIES" : "ВОЗМОЖНОСТИ"}
        sub="AIRDROPS · SCAM-SCANNER · PRESALES · AI-анализ риска и потенциала"
        actions={
          <>
            <button className="btn">Импорт кошелька</button>
            <button className="btn">Telegram-бот</button>
            <button className="btn btn-accent">+ Добавить</button>
          </>
        }
      />

      {/* Tabs */}
      <div className="panel" style={{
        display: "flex", padding: "0 14px",
        borderBottom: "1px solid var(--line)",
        background: "var(--bg-2)",
        borderRadius: "6px 6px 0 0",
        flexShrink: 0,
      }}>
        <OpTabBtn active={tab === "airdrops"} onClick={() => setTab("airdrops")}
          label="Эирдропы" glyph="◈" count={airdrops.length} accent={`${promisingAd} перспект.`} />
        <OpTabBtn active={tab === "scam"} onClick={() => setTab("scam")}
          label="Скам-сканер" glyph="⚲" count={null} accent="9 факторов" />
        <OpTabBtn active={tab === "presales"} onClick={() => setTab("presales")}
          label="Пресейлы" glyph="◇" count={PRESALE_DATA.length} accent={`${PRESALE_DATA.filter(p => p.rating === "promising").length} перспект.`} />

        {/* Right side: stats summary */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 14, alignItems: "center", padding: "0 8px", fontFamily: "var(--font-mono)", fontSize: 10 }}>
          {tab === "airdrops" && (
            <>
              <span><span style={{ color: "var(--text-dim)" }}>оценка пула: </span><span style={{ color: "var(--green)", fontWeight: 600 }}>≈ ${totalEstValue.toLocaleString()}</span></span>
              <span><span style={{ color: "var(--text-dim)" }}>срочных: </span><span style={{ color: "var(--red)" }}>2</span></span>
            </>
          )}
          {tab === "scam" && (
            <>
              <span><span style={{ color: "var(--text-dim)" }}>проверено за 24ч: </span><span style={{ color: "var(--text-bright)" }}>148</span></span>
              <span><span style={{ color: "var(--text-dim)" }}>скам выявлено: </span><span style={{ color: "var(--red)" }}>42</span></span>
            </>
          )}
          {tab === "presales" && (
            <>
              <span><span style={{ color: "var(--text-dim)" }}>в работе: </span><span style={{ color: "var(--accent)" }}>{PRESALE_DATA.filter(p => p.presaleEnd > Date.now()).length}</span></span>
              <span><span style={{ color: "var(--text-dim)" }}>средний FDV: </span><span style={{ color: "var(--text-bright)" }}>${(PRESALE_DATA.reduce((s,p)=>s+p.fdv,0) / PRESALE_DATA.length).toFixed(0)}M</span></span>
            </>
          )}
        </div>
      </div>

      {/* Content per tab */}
      <div style={{ flex: 1, marginTop: "var(--gap)", display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
        {tab === "airdrops" && (
          <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: "var(--gap)", minHeight: 0, overflow: "hidden" }}>
            <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
              <PanelHeader title="АКТИВНЫЕ ЭИРДРОПЫ" meta={`${airdrops.length} · sort: deadline`} />
              <div className="scroll" style={{ flex: 1, overflowY: "auto" }}>
                {airdrops.map(a => <AirdropCard key={a.id} a={a} selected={selectedAirdrop === a.id} onSelect={() => setSelectedAirdrop(a.id)} />)}
              </div>
            </div>
            <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
              <PanelHeader title={selA ? `${selA.name} · ДЕТАЛИЗАЦИЯ` : "ВЫБЕРИТЕ ЭИРДРОП"} meta={selA?.id} />
              {selA && <AirdropDetail a={selA} onToggleTask={toggleTask} />}
            </div>
          </div>
        )}
        {tab === "scam" && <ScamScanner />}
        {tab === "presales" && <PresalesView />}
      </div>
    </div>
  );
}

function OpTabBtn({ active, onClick, label, glyph, count, accent }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "10px 18px",
      background: "transparent", border: "none",
      color: active ? "var(--accent)" : "var(--text-mid)",
      borderBottom: `2px solid ${active ? "var(--accent)" : "transparent"}`,
      fontFamily: "var(--font-ui)", fontSize: 12.5, fontWeight: 500,
      cursor: "pointer", letterSpacing: 0.02,
    }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: active ? "var(--accent)" : "var(--text-dim)" }}>{glyph}</span>
      <span>{label}</span>
      {count !== null && (
        <span className="mono" style={{ fontSize: 10, color: active ? "var(--accent)" : "var(--text-dim)" }}>{count}</span>
      )}
      {accent && active && (
        <span className="mono" style={{ fontSize: 9.5, color: "var(--green)", marginLeft: 6 }}>· {accent}</span>
      )}
    </button>
  );
}

Object.assign(window, { OpportunitiesPage });