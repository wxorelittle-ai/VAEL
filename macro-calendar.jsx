/* macro-calendar.jsx — the most reliable "traceable line": FOMC & CPI dates are
 * KNOWN IN ADVANCE, so the system can prepare instead of react. Around these
 * high-impact prints crypto reprices violently and TA edge collapses, so we use
 * the calendar as a RISK FUSE: near an event → cut leverage / widen stops /
 * warn before opening. Dates are official (federalreserve.gov / bls.gov).
 *
 * All times are the US Eastern release time converted to a fixed UTC instant
 * (ET = UTC−4 during Mar–Nov DST, which covers every 2026 event below; the two
 * Dec events use UTC−5). Statement/press times: FOMC 18:00Z (14:00 ET) result;
 * CPI 12:30Z (08:30 ET). Good enough for a risk fuse measured in hours. */

const MACRO_EVENTS = [
  // ── FOMC rate decisions (2:00pm ET on the 2nd day) ──
  { type: "FOMC", label: "Решение ФРС по ставке", ts: Date.UTC(2026, 0, 28, 19, 0) }, // Jan 28 (EST −5)
  { type: "FOMC", label: "Решение ФРС по ставке", ts: Date.UTC(2026, 2, 18, 18, 0) }, // Mar 18
  { type: "FOMC", label: "Решение ФРС по ставке", ts: Date.UTC(2026, 3, 29, 18, 0) }, // Apr 29
  { type: "FOMC", label: "Решение ФРС по ставке", ts: Date.UTC(2026, 5, 17, 18, 0) }, // Jun 17
  { type: "FOMC", label: "Решение ФРС по ставке", ts: Date.UTC(2026, 6, 29, 18, 0) }, // Jul 29
  { type: "FOMC", label: "Решение ФРС по ставке", ts: Date.UTC(2026, 8, 16, 18, 0) }, // Sep 16
  { type: "FOMC", label: "Решение ФРС по ставке", ts: Date.UTC(2026, 9, 28, 18, 0) }, // Oct 28
  { type: "FOMC", label: "Решение ФРС по ставке", ts: Date.UTC(2026, 11, 9, 19, 0) }, // Dec 9 (EST −5)
  // ── CPI prints (8:30am ET) ──
  { type: "CPI", label: "Инфляция США (CPI)", ts: Date.UTC(2026, 0, 13, 13, 30) }, // Jan 13 (EST)
  { type: "CPI", label: "Инфляция США (CPI)", ts: Date.UTC(2026, 1, 13, 13, 30) }, // Feb 13 (EST)
  { type: "CPI", label: "Инфляция США (CPI)", ts: Date.UTC(2026, 2, 11, 12, 30) }, // Mar 11
  { type: "CPI", label: "Инфляция США (CPI)", ts: Date.UTC(2026, 3, 10, 12, 30) }, // Apr 10
  { type: "CPI", label: "Инфляция США (CPI)", ts: Date.UTC(2026, 4, 12, 12, 30) }, // May 12
  { type: "CPI", label: "Инфляция США (CPI)", ts: Date.UTC(2026, 5, 10, 12, 30) }, // Jun 10
  { type: "CPI", label: "Инфляция США (CPI)", ts: Date.UTC(2026, 6, 14, 12, 30) }, // Jul 14
  { type: "CPI", label: "Инфляция США (CPI)", ts: Date.UTC(2026, 7, 12, 12, 30) }, // Aug 12
  { type: "CPI", label: "Инфляция США (CPI)", ts: Date.UTC(2026, 8, 11, 12, 30) }, // Sep 11
  { type: "CPI", label: "Инфляция США (CPI)", ts: Date.UTC(2026, 9, 14, 12, 30) }, // Oct 14
  { type: "CPI", label: "Инфляция США (CPI)", ts: Date.UTC(2026, 10, 10, 13, 30) }, // Nov 10 (EST)
  { type: "CPI", label: "Инфляция США (CPI)", ts: Date.UTC(2026, 11, 10, 13, 30) }, // Dec 10 (EST)
];

/* Risk state around the next high-impact print.
 * Windows (hours to event): ≤2h danger (block new entries), ≤24h caution
 * (cut leverage & widen stops), ≤72h watch (informational). After the event a
 * 1h "settle" window stays cautious while the initial spike mean-reverts. */
function macroRisk(now = null) {
  const t = now != null ? now : Date.now();
  const future = MACRO_EVENTS.filter(e => e.ts > t - 3600e3).sort((a, b) => a.ts - b.ts);
  const next = future[0] || null;
  if (!next) return { level: "clear", next: null, hoursTo: null, leverageCap: null, note: "нет ближайших макро-событий" };

  const hoursTo = (next.ts - t) / 3600e3;
  const justPassed = hoursTo < 0 && hoursTo > -1;   // within 1h after release

  let level, leverageCap, widenStop, blockEntry, note;
  if (justPassed) {
    level = "settle"; leverageCap = 3; widenStop = 1.5; blockEntry = false;
    note = `${next.label} только что вышел — рынок ещё дёргается, входить осторожно`;
  } else if (hoursTo <= 2) {
    level = "danger"; leverageCap = 1; widenStop = 2; blockEntry = true;
    note = `${next.label} через ${fmtHrs(hoursTo)} — новые входы заблокированы, жди`;
  } else if (hoursTo <= 24) {
    level = "caution"; leverageCap = 3; widenStop = 1.5; blockEntry = false;
    note = `${next.label} через ${fmtHrs(hoursTo)} — плечо срезано, стопы шире`;
  } else if (hoursTo <= 72) {
    level = "watch"; leverageCap = null; widenStop = 1; blockEntry = false;
    note = `${next.label} через ${fmtHrs(hoursTo)}`;
  } else {
    level = "clear"; leverageCap = null; widenStop = 1; blockEntry = false;
    note = `ближайшее: ${next.label} через ${Math.round(hoursTo / 24)}д`;
  }
  return { level, next, hoursTo, leverageCap, widenStop, blockEntry, note };
}

function fmtHrs(h) {
  const a = Math.abs(h);
  if (a < 1) return `${Math.round(a * 60)} мин`;
  if (a < 48) return `${a.toFixed(a < 6 ? 1 : 0)} ч`;
  return `${Math.round(a / 24)} д`;
}

const MACRO_LEVELS = {
  clear:   { color: "var(--text-dim)", label: "СПОКОЙНО" },
  watch:   { color: "var(--blue)",     label: "НА ГОРИЗОНТЕ" },
  caution: { color: "var(--amber)",    label: "ОСТОРОЖНО" },
  danger:  { color: "var(--red)",      label: "СОБЫТИЕ РЯДОМ" },
  settle:  { color: "var(--accent-2)", label: "ОСЕДАЕТ" },
};

/* Compact banner for the terminal — shows the fuse state + countdown. */
function MacroBanner() {
  const [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick(x => x + 1), 30000); return () => clearInterval(id); }, []);
  const r = macroRisk();
  if (!r.next || r.level === "clear") return null;
  const cfg = MACRO_LEVELS[r.level];
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, padding: "4px 14px",
      borderBottom: "1px solid var(--line)", background: "var(--bg-1)",
      fontFamily: "var(--font-mono)", fontSize: 9.5,
    }}>
      <span style={{ color: cfg.color, fontWeight: 700, letterSpacing: 0.06 }}>◱ МАКРО · {cfg.label}</span>
      <span style={{ color: "var(--text-mid)" }}>{r.note}</span>
      {r.leverageCap && <span style={{ marginLeft: "auto", color: "var(--amber)" }}>плечо ≤ {r.leverageCap}x</span>}
      {r.blockEntry && <span style={{ marginLeft: r.leverageCap ? 8 : "auto", color: "var(--red)" }}>входы off</span>}
    </div>
  );
}

Object.assign(window, { MACRO_EVENTS, macroRisk, MacroBanner, MACRO_LEVELS });
