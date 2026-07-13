/* widgets.jsx — reusable building blocks */
const { useState, useEffect, useRef, useMemo, useCallback } = React;

/* ─────────────────────────────────────────────────────────
 * useInterval — animation-speed aware
 * ────────────────────────────────────────────────────────*/
function useInterval(fn, ms, deps = []) {
  const cb = useRef(fn);
  cb.current = fn;
  useEffect(() => {
    if (ms == null) return;
    const id = setInterval(() => cb.current(), ms);
    return () => clearInterval(id);
  }, [ms, ...deps]);
}

/* ─────────────────────────────────────────────────────────
 * Random helpers (deterministic-ish ticking)
 * ────────────────────────────────────────────────────────*/
function rand(min, max) { return min + Math.random() * (max - min); }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

/* ─────────────────────────────────────────────────────────
 * TickerNumber — animates between values
 * ────────────────────────────────────────────────────────*/
function TickerNumber({ value, decimals = 0, prefix = "", suffix = "", className = "" }) {
  const [shown, setShown] = useState(value);
  const prev = useRef(value);
  const [flash, setFlash] = useState(null); // 'up' | 'down' | null

  useEffect(() => {
    const from = prev.current;
    const to = value;
    if (from === to) return;
    setFlash(to > from ? "up" : "down");
    const steps = 12;
    let i = 0;
    const id = setInterval(() => {
      i++;
      const t = i / steps;
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(from + (to - from) * eased);
      if (i >= steps) {
        clearInterval(id);
        setShown(to);
        setTimeout(() => setFlash(null), 400);
      }
    }, 25);
    prev.current = to;
    return () => clearInterval(id);
  }, [value]);

  const flashColor =
    flash === "up" ? "var(--green)" :
    flash === "down" ? "var(--red)" : "inherit";

  const fmt = (n) => {
    const s = n.toFixed(decimals);
    // thousand separators with thin space
    const [int, dec] = s.split(".");
    const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, "\u202F");
    return dec != null ? `${grouped}.${dec}` : grouped;
  };

  return (
    <span
      className={`mono ${className}`}
      style={{ color: flashColor, transition: "color 0.4s" }}
    >
      {prefix}{fmt(shown)}{suffix}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────
 * Sparkline — animated mini-chart
 * ────────────────────────────────────────────────────────*/
function Sparkline({ data, width = 100, height = 28, color, fill = true, strokeW = 1.2 }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);

  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * (height - 2) - 1;
    return [x, y];
  });

  const path = points.map(([x, y], i) =>
    i === 0 ? `M${x},${y}` : `L${x},${y}`
  ).join(" ");
  const areaPath = `${path} L${width},${height} L0,${height} Z`;

  const stroke = color || "var(--accent)";
  const gradId = `sg-${Math.random().toString(36).slice(2, 8)}`;

  return (
    <svg width={width} height={height} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.4" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={areaPath} fill={`url(#${gradId})`} />}
      <path d={path} fill="none" stroke={stroke} strokeWidth={strokeW} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r={2} fill={stroke} />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────
 * Bars — small bar chart
 * ────────────────────────────────────────────────────────*/
function Bars({ data, width = 100, height = 28, color }) {
  if (!data) return null;
  const max = Math.max(...data, 1);
  const stroke = color || "var(--accent)";
  const barW = width / data.length - 1;
  return (
    <svg width={width} height={height}>
      {data.map((v, i) => {
        const h = (v / max) * (height - 2);
        return (
          <rect key={i}
            x={i * (barW + 1)} y={height - h}
            width={barW} height={h}
            fill={stroke} opacity={0.6 + (i / data.length) * 0.4}
          />
        );
      })}
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────
 * Ring gauge
 * ────────────────────────────────────────────────────────*/
function Ring({ value, size = 36, stroke = 3, color, label }) {
  const c = color || "var(--accent)";
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const off = circ * (1 - value / 100);
  return (
    <div style={{ position: "relative", width: size, height: size, display: "inline-block" }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke="var(--bg-3)" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={c} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={off}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease-out" }}
        />
      </svg>
      {label && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-bright)",
        }}>{label}</div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 * Pulse dot (active status)
 * ────────────────────────────────────────────────────────*/
function PulseDot({ color = "var(--green)", size = 6 }) {
  return (
    <span style={{ position: "relative", display: "inline-flex", width: size, height: size }}>
      <span style={{
        position: "absolute", inset: 0, borderRadius: "50%",
        background: color, animation: "pulse calc(1.6s / var(--speed)) ease-out infinite",
        opacity: 0.5,
      }} />
      <span style={{
        position: "relative", width: size, height: size, borderRadius: "50%",
        background: color, boxShadow: `0 0 6px ${color}`,
      }} />
    </span>
  );
}

/* ─────────────────────────────────────────────────────────
 * Waveform — animated signal
 * ────────────────────────────────────────────────────────*/
function Waveform({ width = 80, height = 18, color, bars = 18, speed = 1 }) {
  const [phase, setPhase] = useState(0);
  useInterval(() => setPhase(p => p + 1), 110 / speed);
  const c = color || "var(--accent)";
  const arr = Array.from({ length: bars }, (_, i) => {
    const v = 0.3 + 0.7 * Math.abs(Math.sin((i + phase) * 0.6 + i * 0.3));
    return v;
  });
  const barW = (width - (bars - 1) * 1) / bars;
  return (
    <svg width={width} height={height}>
      {arr.map((v, i) => {
        const h = Math.max(1.5, v * (height - 2));
        const y = (height - h) / 2;
        return (
          <rect key={i}
            x={i * (barW + 1)} y={y}
            width={barW} height={h}
            fill={c} opacity={0.5 + v * 0.5}
            rx={0.5}
          />
        );
      })}
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────
 * MetricCard — top-row card with title, value, sparkline
 * ────────────────────────────────────────────────────────*/
function MetricCard({ label, value, unit, delta, sparkData, color, sub, kind = "spark" }) {
  const c = color || "var(--accent)";
  const deltaPos = delta != null && delta >= 0;
  return (
    <div className="panel" style={{
      padding: "10px 12px",
      display: "flex", flexDirection: "column", gap: 6,
      minHeight: 96,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{
          fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase",
          color: "var(--text-dim)", fontWeight: 500,
        }}>{label}</div>
        {delta != null && (
          <div style={{
            fontFamily: "var(--font-mono)", fontSize: 10,
            color: deltaPos ? "var(--green)" : "var(--red)",
          }}>
            {deltaPos ? "▲" : "▼"} {Math.abs(delta).toFixed(2)}%
          </div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <div style={{
          fontFamily: "var(--font-mono)", fontWeight: 500,
          fontSize: 22, color: "var(--text-bright)", letterSpacing: "-0.01em",
        }}>
          {typeof value === "number" ? <TickerNumber value={value} /> : value}
        </div>
        {unit && (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>{unit}</div>
        )}
      </div>
      <div style={{ marginTop: "auto", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontSize: 10, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
          {sub}
        </div>
        {sparkData && kind === "spark" && <Sparkline data={sparkData} width={70} height={22} color={c} />}
        {sparkData && kind === "bars" && <Bars data={sparkData} width={70} height={22} color={c} />}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 * Agent meta + cards
 * ────────────────────────────────────────────────────────*/
const AGENT_DEFS = [
  { id: "planner",  name: "Planner",  ru: "Планировщик",   glyph: "PL", color: "var(--accent)" },
  { id: "executor", name: "Executor", ru: "Исполнитель",   glyph: "EX", color: "var(--blue)" },
  { id: "critic",   name: "Critic",   ru: "Критик",        glyph: "CR", color: "var(--accent-2)" },
  { id: "research", name: "Research", ru: "Исследователь", glyph: "RS", color: "var(--accent)" },
  { id: "news",     name: "News",     ru: "Новости",       glyph: "NW", color: "var(--blue)" },
  { id: "onchain",  name: "OnChain",  ru: "On-Chain",      glyph: "OC", color: "var(--green)" },
  { id: "alert",    name: "Alert",    ru: "Алерты",        glyph: "AL", color: "var(--amber)" },
  { id: "forecast", name: "Forecast", ru: "Прогноз",       glyph: "FC", color: "var(--accent-2)" },
  { id: "strategy", name: "Strategy", ru: "Стратегия",     glyph: "ST", color: "var(--accent)" },
  { id: "risk",     name: "Risk",     ru: "Риск",          glyph: "RK", color: "var(--red)" },
  { id: "memory",   name: "Memory",   ru: "Память",        glyph: "MM", color: "var(--blue)" },
  { id: "autofix",  name: "AutoFix",  ru: "AutoFix",       glyph: "AF", color: "var(--green)" },
];

const TOOL_POOL = ["fetch", "embed", "rag", "wallet", "kg", "tg", "py", "sql", "vector", "graph", "ws", "diff"];

function AgentCard({ agent, compact = false }) {
  const isActive = agent.status === "active";
  const isError = agent.status === "error";
  const isIdle = agent.status === "idle";
  const statusColor = isError ? "var(--red)" : isActive ? "var(--green)" : "var(--text-dim)";

  return (
    <div className="panel" style={{
      padding: 9,
      display: "flex", flexDirection: "column", gap: 6,
      borderColor: isActive ? "oklch(0.78 0.16 var(--accent-h) / 0.25)" : "var(--line)",
      boxShadow: isActive ? "var(--glow)" : "none",
      transition: "all 0.2s",
      position: "relative",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{
          width: 26, height: 26, borderRadius: 4,
          background: "var(--bg-2)",
          border: `1px solid ${agent.def.color}`,
          color: agent.def.color,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600,
          flexShrink: 0,
          boxShadow: isActive ? `0 0 12px -2px ${agent.def.color}` : "none",
        }}>{agent.def.glyph}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 500, color: "var(--text-bright)", display: "flex", alignItems: "center", gap: 5 }}>
            {agent.def.ru}
            {isActive && <PulseDot size={5} color={statusColor} />}
          </div>
          <div className="mono" style={{ fontSize: 9.5, color: "var(--text-dim)", letterSpacing: 0.04 }}>
            {agent.def.name.toUpperCase()}.AGT
          </div>
        </div>
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: 9,
          color: statusColor, textTransform: "uppercase", letterSpacing: 0.08,
        }}>
          {isActive ? "АКТИВ" : isError ? "СБОЙ" : "ОЖИД"}
        </div>
      </div>

      {!compact && (
        <div style={{
          fontSize: 11, color: "var(--text-mid)",
          overflow: "hidden", textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          paddingTop: 2, borderTop: "1px dashed var(--line)",
        }}>
          <span className="mono dim" style={{ fontSize: 9.5 }}>›</span> {agent.task}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <div style={{ display: "flex", gap: 8, fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--text-mid)" }}>
          <span>conf <span style={{ color: agent.confidence > 80 ? "var(--green)" : agent.confidence > 60 ? "var(--amber)" : "var(--red)" }}>{agent.confidence}%</span></span>
          <span>{agent.latency}ms</span>
        </div>
        <Waveform width={60} height={12} color={isActive ? agent.def.color : "var(--text-dim)"} bars={14} />
      </div>

      {!compact && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
          {agent.tools.slice(0, 4).map(t => (
            <span key={t} style={{
              fontFamily: "var(--font-mono)", fontSize: 9,
              padding: "0 4px", borderRadius: 2,
              background: "var(--bg-2)", color: "var(--text-dim)",
              border: "1px solid var(--line)",
            }}>{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 * Terminal log line
 * ────────────────────────────────────────────────────────*/
function LogLine({ entry }) {
  const levelColor = {
    info: "var(--accent)",
    ok: "var(--green)",
    warn: "var(--amber)",
    err: "var(--red)",
    thought: "var(--accent-2)",
    sys: "var(--text-mid)",
  }[entry.level] || "var(--text-mid)";

  const levelLabel = {
    info: "ИНФО",
    ok: "OK",
    warn: "ВНИМ",
    err: "ОШБ",
    thought: "МЫСЛЬ",
    sys: "СИС",
  }[entry.level] || "···";

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "auto auto auto 1fr",
      gap: 8,
      padding: "1px 0",
      fontFamily: "var(--font-mono)",
      fontSize: 11,
      lineHeight: 1.45,
      alignItems: "baseline",
    }}>
      <span style={{ color: "var(--text-dim)" }}>{entry.t}</span>
      <span style={{ color: levelColor, width: 46 }}>{levelLabel}</span>
      <span style={{ color: "var(--text-mid)", width: 82, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.agent || "system"}</span>
      <span style={{ color: entry.level === "thought" ? "var(--text-mid)" : "var(--text)", fontStyle: entry.level === "thought" ? "italic" : "normal" }}>
        {entry.msg}
        {entry.streaming && <span style={{
          display: "inline-block", width: 6, height: 11, marginLeft: 2,
          background: "var(--accent)",
          animation: "blink 1s steps(2) infinite",
          verticalAlign: "middle",
        }} />}
      </span>
    </div>
  );
}

/* blink keyframe (injected once) */
if (typeof document !== "undefined" && !document.getElementById("__blink_kf")) {
  const s = document.createElement("style");
  s.id = "__blink_kf";
  s.textContent = "@keyframes blink { 0%, 50% { opacity: 1; } 50.01%, 100% { opacity: 0; } }";
  document.head.appendChild(s);
}

/* ─────────────────────────────────────────────────────────
 * Network graph — agents connected, pulsing edges
 * ────────────────────────────────────────────────────────*/
function NetworkGraph({ agents, width = 320, height = 260 }) {
  // Layout: planner center, others in ring(s)
  const nodes = useMemo(() => {
    const cx = width / 2, cy = height / 2;
    return agents.map((a, i) => {
      if (a.def.id === "planner") return { ...a, x: cx, y: cy, r: 16 };
      const idx = agents.filter((b, j) => b.def.id !== "planner" && j < i ? true : (b.def.id !== "planner" && j < i)).length;
      const others = agents.filter(b => b.def.id !== "planner");
      const myIdx = others.findIndex(b => b.def.id === a.def.id);
      const total = others.length;
      const angle = (myIdx / total) * Math.PI * 2 - Math.PI / 2;
      const ring = myIdx % 2 === 0 ? width * 0.32 : width * 0.4;
      return {
        ...a,
        x: cx + Math.cos(angle) * ring,
        y: cy + Math.sin(angle) * ring * 0.85,
        r: 11,
      };
    });
  }, [agents, width, height]);

  const planner = nodes.find(n => n.def.id === "planner");
  const [pulsePhase, setPulsePhase] = useState(0);
  useInterval(() => setPulsePhase(p => p + 1), 80);

  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <defs>
        <radialGradient id="ng-glow">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* edges */}
      {planner && nodes.filter(n => n.def.id !== "planner").map((n, i) => {
        const active = n.status === "active";
        return (
          <g key={n.def.id}>
            <line x1={planner.x} y1={planner.y} x2={n.x} y2={n.y}
              stroke={active ? "var(--accent)" : "var(--line)"}
              strokeWidth={active ? 0.8 : 0.5}
              strokeDasharray={active ? "2 4" : "1 3"}
              opacity={active ? 0.7 : 0.4}
              style={{
                strokeDashoffset: -(pulsePhase + i * 3),
                transition: "stroke 0.3s",
              }}
            />
            {active && (
              <circle
                cx={planner.x + (n.x - planner.x) * (((pulsePhase + i * 7) % 60) / 60)}
                cy={planner.y + (n.y - planner.y) * (((pulsePhase + i * 7) % 60) / 60)}
                r={1.6} fill="var(--accent)"
              />
            )}
          </g>
        );
      })}
      {/* nodes */}
      {nodes.map(n => {
        const active = n.status === "active";
        return (
          <g key={n.def.id}>
            {active && <circle cx={n.x} cy={n.y} r={n.r + 8} fill="url(#ng-glow)" />}
            <circle cx={n.x} cy={n.y} r={n.r}
              fill="var(--bg-2)"
              stroke={active ? n.def.color : "var(--line-bright)"}
              strokeWidth={1.5}
            />
            <text x={n.x} y={n.y + 3} textAnchor="middle"
              fontFamily="var(--font-mono)" fontSize={n.def.id === "planner" ? 11 : 8.5}
              fill={active ? n.def.color : "var(--text-mid)"}
              fontWeight={600}
            >{n.def.glyph}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────
 * Heatmap (embeddings)
 * ────────────────────────────────────────────────────────*/
function Heatmap({ cols = 24, rows = 8, cell = 12, seed }) {
  const cells = useMemo(() => {
    return Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => {
        const v = Math.sin((r * 7 + c * 3) * 0.3 + (seed || 0)) * 0.5 + 0.5;
        return v * (0.5 + Math.random() * 0.5);
      })
    );
  }, [cols, rows, seed]);
  return (
    <svg width={cols * cell} height={rows * cell}>
      {cells.map((row, r) =>
        row.map((v, c) => (
          <rect key={`${r}-${c}`}
            x={c * cell} y={r * cell}
            width={cell - 1} height={cell - 1}
            fill="var(--accent)" opacity={v * 0.8}
          />
        ))
      )}
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────
 * AreaChart — bigger chart for analytics
 * ────────────────────────────────────────────────────────*/
function AreaChart({ data, width = 600, height = 200, color, label }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const points = data.map((v, i) => [i * stepX, height - ((v - min) / range) * (height - 20) - 10]);
  const path = points.map(([x, y], i) => i === 0 ? `M${x},${y}` : `L${x},${y}`).join(" ");
  const areaPath = `${path} L${width},${height} L0,${height} Z`;
  const c = color || "var(--accent)";
  const gradId = `ac-${Math.random().toString(36).slice(2, 8)}`;
  const last = points[points.length - 1];

  // y grid
  const gridLines = 4;
  const gridY = Array.from({ length: gridLines + 1 }, (_, i) => (height / gridLines) * i);

  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c} stopOpacity="0.35" />
          <stop offset="100%" stopColor={c} stopOpacity="0" />
        </linearGradient>
      </defs>
      {gridY.map((y, i) => (
        <line key={i} x1={0} y1={y} x2={width} y2={y}
          stroke="var(--line)" strokeWidth={0.5} strokeDasharray="2 4" />
      ))}
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={path} fill="none" stroke={c} strokeWidth={1.5} strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r={3} fill={c} />
      <circle cx={last[0]} cy={last[1]} r={6} fill="none" stroke={c} opacity={0.5}>
        <animate attributeName="r" from="3" to="10" dur="1.4s" repeatCount="indefinite" />
        <animate attributeName="opacity" from="0.6" to="0" dur="1.4s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────
 * Section header inside panels
 * ────────────────────────────────────────────────────────*/
function PanelHeader({ title, meta, dot = true, action }) {
  return (
    <div className="panel-header">
      {dot && <span className="ph-dot" />}
      <span className="ph-title">{title}</span>
      {meta && <span className="ph-meta">{meta}</span>}
      {action && <span style={{ marginLeft: meta ? 8 : "auto" }}>{action}</span>}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 * Export
 * ────────────────────────────────────────────────────────*/
Object.assign(window, {
  useInterval, rand, randInt, pick,
  TickerNumber, Sparkline, Bars, Ring, PulseDot, Waveform,
  MetricCard, AgentCard, LogLine, NetworkGraph, Heatmap, AreaChart, PanelHeader,
  AGENT_DEFS, TOOL_POOL,
});