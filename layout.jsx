/* layout.jsx — Sidebar + TopBar */

/* Main nav stays focused on trading. Agents / Missions / Scenarios / Memory /
 * Smart Money moved into Settings → «Разделы системы» (routes still work). */
const NAV_ITEMS = [
  { id: "dashboard", ru: "Дашборд",     en: "Dashboard",     glyph: "◐" },
  { id: "brain",     ru: "AI Мозг",     en: "AI Brain",      glyph: "❂" },
  { id: "plan",      ru: "Trade Plan",  en: "Trade Plan",    glyph: "⌖" },
  { id: "portfolio", ru: "Портфель",    en: "Portfolio",     glyph: "◑" },
  { id: "pairs",     ru: "Парный трейдинг", en: "Pair Trading", glyph: "⇄" },
  { id: "daily",     ru: "Тренд-агент",  en: "Trend Agent",   glyph: "◎" },
  { id: "simulator", ru: "Симулятор",    en: "Simulator",     glyph: "⟳" },
  { id: "research",  ru: "Исследования", en: "Research",      glyph: "⚗" },
  { id: "opps",      ru: "Возможности", en: "Opportunities", glyph: "◈" },
  { id: "airdrops",  ru: "Airdrop радар",en: "Airdrop Radar", glyph: "◇" },
  { id: "freedrops", ru: "Free Airdrops",en: "Free Airdrops", glyph: "❋" },
  { id: "analyst",   ru: "Аналитик",    en: "Analyst",       glyph: "✦" },
  { id: "analytics", ru: "Аналитика",   en: "Analytics",     glyph: "📈", noEmoji: "▲" },
  { id: "alerts",    ru: "Алерты",      en: "Alerts",        glyph: "!" },
];

function Logo({ collapsed }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "14px 14px 14px 14px",
      borderBottom: "1px solid var(--line)",
      minHeight: 56,
    }}>
      <div style={{
        width: 28, height: 28,
        background: "var(--bg-0)",
        border: "1px solid oklch(0.78 0.16 var(--accent-h) / 0.6)",
        borderRadius: 4,
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative",
        boxShadow: "var(--glow)",
      }}>
        <svg width="18" height="18" viewBox="0 0 64 64" fill="none">
          <polygon points="32,6 54,19 54,45 32,58 10,45 10,19" fill="none" stroke="var(--accent)" strokeWidth="2" opacity="0.4" />
          <polygon points="32,14 47,22.5 47,41.5 32,50 17,41.5 17,22.5" fill="none" stroke="var(--accent)" strokeWidth="1.8" opacity="0.85" />
          <circle cx="32" cy="32" r="5.5" fill="var(--accent)" />
          <circle cx="32" cy="14" r="2.6" fill="var(--accent-2)" /><circle cx="47" cy="22.5" r="2.6" fill="var(--accent-2)" />
          <circle cx="47" cy="41.5" r="2.6" fill="var(--accent-2)" /><circle cx="32" cy="50" r="2.6" fill="var(--accent-2)" />
          <circle cx="17" cy="41.5" r="2.6" fill="var(--accent-2)" /><circle cx="17" cy="22.5" r="2.6" fill="var(--accent-2)" />
        </svg>
      </div>
      {!collapsed && (
        <div style={{
          fontWeight: 700, fontSize: 14,
          letterSpacing: "0.22em", color: "var(--text-bright)",
        }}>VAEL</div>
      )}
    </div>
  );
}

function NavItem({ item, active, onClick, lang }) {
  return (
    <button
      onClick={onClick}
      data-screen-label={`Nav: ${item.ru}`}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "7px 12px",
        background: active ? "var(--accent-soft)" : "transparent",
        color: active ? "var(--accent)" : "var(--text-mid)",
        border: "none",
        borderLeft: `2px solid ${active ? "var(--accent)" : "transparent"}`,
        width: "100%",
        textAlign: "left",
        cursor: "pointer",
        fontFamily: "var(--font-ui)",
        fontSize: 12.5,
        letterSpacing: "0.02em",
        transition: "all 0.12s",
        position: "relative",
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.color = "var(--text-bright)"; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.color = "var(--text-mid)"; }}
    >
      <span style={{
        fontFamily: "var(--font-mono)", fontSize: 11,
        width: 14, textAlign: "center",
        color: active ? "var(--accent)" : "var(--text-dim)",
      }}>{item.noEmoji || item.glyph}</span>
      <span>{lang === "en" ? item.en : item.ru}</span>
      {active && (
        <span className="mono" style={{
          marginLeft: "auto", fontSize: 9.5, color: "var(--accent)",
          opacity: 0.6,
        }}>●</span>
      )}
    </button>
  );
}

function Sidebar({ active, onNav, lang, sysStats }) {
  return (
    <aside style={{
      width: 224, flexShrink: 0,
      background: "var(--bg-1)",
      borderRight: "1px solid var(--line)",
      display: "flex", flexDirection: "column",
      height: "100%",
    }}>
      <Logo />

      <div style={{
        padding: "10px 14px 6px",
        fontSize: 9.5, letterSpacing: "0.12em", textTransform: "uppercase",
        color: "var(--text-dim)", fontWeight: 600,
      }}>
        {lang === "en" ? "Navigation" : "Навигация"}
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {NAV_ITEMS.map(item => (
          <NavItem key={item.id} item={item} active={active === item.id}
            onClick={() => onNav(item.id)} lang={lang} />
        ))}
      </nav>

    </aside>
  );
}

function SysRow({ label, value }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      fontSize: 11,
    }}>
      <span style={{ color: "var(--text-dim)", letterSpacing: 0.02 }}>{label}</span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text)" }}>{value}</span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 * TopBar
 * ────────────────────────────────────────────────────────*/
function TopBar({ lang, mission, sysStats, onSearch }) {
  const [now, setNow] = useState(new Date());
  useInterval(() => setNow(new Date()), 1000);
  const [searchOpen, setSearchOpen] = useState(false);

  const time = now.toLocaleTimeString("ru-RU", { hour12: false });
  const date = now.toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
  const utc = now.toUTCString().slice(17, 25);

  return (
    <header style={{
      height: 44,
      borderBottom: "1px solid var(--line)",
      background: "var(--bg-1)",
      display: "flex", alignItems: "stretch",
      flexShrink: 0,
      position: "relative",
    }}>
      {/* search */}
      <div onClick={() => window.__openPalette?.()} style={{
        flex: 1, display: "flex", alignItems: "center", gap: 10,
        padding: "0 16px",
        borderRight: "1px solid var(--line)",
        maxWidth: 480,
        cursor: "pointer",
      }}>
        <span style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 11 }}>⌕</span>
        <span style={{
          flex: 1, color: "var(--text-dim)",
          fontFamily: "var(--font-ui)", fontSize: 12,
        }}>
          {lang === "en" ? "Search agents, missions, wallets, entities..." : "Поиск агентов, миссий, кошельков, сущностей..."}
        </span>
        <span className="chip mono" style={{ fontSize: 9 }}>⌘K</span>
      </div>

      {/* mission status */}
      <TopStatus
        label={lang === "en" ? "MISSION" : "МИССИЯ"}
        value={mission.name}
        meta={`${mission.progress}%`}
        accent={mission.status === "running" ? "var(--accent)" : "var(--text-mid)"}
        live={mission.status === "running"}
      />

      {/* clock */}
      <TopStatus label="UTC" value={utc} meta={date} mono />
      <TopStatus label={lang === "en" ? "LOCAL" : "МСК"} value={time} meta="GMT+3" mono live />

      {/* load */}
      <TopLoad sysStats={sysStats} />

      {/* websocket */}
      <TopStatus label="WS" value={<span style={{ color: "var(--blue)" }}>● ЭФИР</span>} meta="42ms" mono />

      {/* notifications */}
      <button style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "0 14px",
        borderLeft: "1px solid var(--line)",
        background: "transparent", border: "none",
        color: "var(--text-mid)", cursor: "pointer",
        position: "relative",
      }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>⚲</span>
        <span style={{
          position: "absolute", top: 8, right: 10,
          minWidth: 14, height: 14, padding: "0 4px",
          borderRadius: 7,
          background: "var(--red)", color: "var(--bg-0)",
          fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>7</span>
      </button>

      {/* profile / личный кабинет — Settings lives in here now */}
      <ProfileMenu />
    </header>
  );
}

const PROFILE_ITEMS = [
  { id: "settings",  glyph: "⚙", ru: "Настройки" },
  { id: "reports",   glyph: "▤", ru: "Отчёты" },
  { id: "watchlist", glyph: "◉", ru: "Watchlist" },
];

function ProfileMenu() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);

  return (
    <div style={{ position: "relative", borderLeft: "1px solid var(--line)", display: "flex" }}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        title="Личный кабинет"
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "0 14px", background: open ? "var(--bg-2)" : "transparent",
          border: "none", cursor: "pointer",
        }}
      >
        <div style={{
          width: 26, height: 26, borderRadius: "50%",
          background: "linear-gradient(135deg, var(--accent), var(--accent-2))",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--bg-0)", fontSize: 11, fontWeight: 700,
        }}>А</div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div onClick={e => e.stopPropagation()} style={{
          position: "absolute", top: "100%", right: 8, marginTop: 4, zIndex: 9995,
          minWidth: 210, background: "var(--bg-1)",
          border: "1px solid var(--line-bright)", borderRadius: 6,
          boxShadow: "0 16px 40px -10px oklch(0 0 0 / 0.6)", overflow: "hidden",
          animation: "cpScale 0.14s cubic-bezier(0.16,1,0.3,1)",
        }}>
          <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--line)", background: "var(--bg-2)" }}>
            <div style={{ fontSize: 12, color: "var(--text-bright)", fontWeight: 500 }}>Личный кабинет</div>
            <div className="mono" style={{ fontSize: 9.5, color: "var(--text-dim)", marginTop: 1 }}>analyst.7 · оператор</div>
          </div>
          {PROFILE_ITEMS.map(it => (
            <button key={it.id} onClick={() => { window.__navTo?.(it.id); setOpen(false); }} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10,
              padding: "9px 12px", background: "transparent", border: "none",
              borderBottom: "1px solid var(--line)", cursor: "pointer", textAlign: "left",
              color: "var(--text)", fontSize: 12,
            }}>
              <span style={{ color: "var(--accent)", fontFamily: "var(--font-mono)", fontSize: 12, width: 14 }}>{it.glyph}</span>
              {it.ru}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TopStatus({ label, value, meta, accent, mono, live }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", justifyContent: "center",
      padding: "0 14px", minWidth: 92,
      borderLeft: "1px solid var(--line)",
      lineHeight: 1.1,
    }}>
      <div style={{
        fontSize: 8.5, letterSpacing: "0.15em", textTransform: "uppercase",
        color: "var(--text-dim)", fontWeight: 600,
        display: "flex", alignItems: "center", gap: 4,
      }}>
        {label}
        {live && <span style={{
          width: 4, height: 4, borderRadius: "50%",
          background: "var(--blue)",
          boxShadow: "0 0 4px var(--blue)",
          animation: "pulse calc(1.6s / var(--speed)) ease-out infinite",
        }} />}
      </div>
      <div style={{
        fontFamily: mono ? "var(--font-mono)" : "var(--font-ui)",
        fontSize: 12, fontWeight: 500,
        color: accent || "var(--text-bright)",
        marginTop: 2,
      }}>{value}</div>
      {meta && (
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: 9,
          color: "var(--text-dim)", marginTop: 1,
        }}>{meta}</div>
      )}
    </div>
  );
}

function TopLoad({ sysStats }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "0 14px",
      borderLeft: "1px solid var(--line)",
    }}>
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
        <span style={{ fontSize: 8.5, letterSpacing: "0.15em", color: "var(--text-dim)", fontWeight: 600 }}>НАГР</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-bright)" }}>{sysStats.cpu}%</span>
      </div>
      <Waveform width={56} height={20} color="var(--accent)" bars={14} />
    </div>
  );
}

Object.assign(window, { Sidebar, TopBar, NAV_ITEMS });