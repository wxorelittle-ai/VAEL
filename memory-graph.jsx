/* memory-graph.jsx — Live force-directed knowledge graph */

/* ─────────────────────────────────────────────────────────
 *  Entity dataset
 * ────────────────────────────────────────────────────────*/

const ENTITY_TYPES = {
  wallet:  { ru: "КОШЕЛ",   color: "var(--blue)",      glyph: "$" },
  org:     { ru: "ОРГ",     color: "var(--accent-2)",  glyph: "◆" },
  event:   { ru: "СОБЫТ",   color: "var(--accent)",    glyph: "◉" },
  proto:   { ru: "ПРОТО",   color: "var(--green)",     glyph: "⬡" },
  news:    { ru: "НОВОСТЬ", color: "var(--amber)",     glyph: "▤" },
  token:   { ru: "ТОКЕН",   color: "var(--accent)",    glyph: "⬢" },
  report:  { ru: "ОТЧЁТ",   color: "var(--text-mid)",  glyph: "▦" },
  cluster: { ru: "КЛАСТЕР", color: "var(--red)",       glyph: "✕" },
};

const KG_NODES = [
  { id: "w_7a2c", type: "wallet",  label: "0x7a2c…ef91", refs: 124, risk: 24, info: "Whale-04 · 47 крупных tx за 30d" },
  { id: "w_dead", type: "wallet",  label: "0xdead…beef", refs: 67,  risk: 92, info: "Связан с mixer · флаг RISK" },
  { id: "w_9b4f", type: "wallet",  label: "0x9b4f…",     refs: 38,  risk: 18, info: "CEX hot wallet · Binance" },
  { id: "w_91a4", type: "wallet",  label: "0x91a4…4f02", refs: 31,  risk: 67, info: "Unknown cluster · мониторинг" },
  { id: "w_fe44", type: "wallet",  label: "0xfe44…aa01", refs: 22,  risk: 6,  info: "Treasury · protocol" },

  { id: "o_alm",  type: "org",     label: "Alameda Research", refs: 89, info: "Fund · history" },
  { id: "o_bin",  type: "org",     label: "Binance",          refs: 142, info: "Exchange · tier 1" },
  { id: "o_cb",   type: "org",     label: "Coinbase",         refs: 76, info: "Exchange · США" },

  { id: "ev_l2",  type: "event",   label: "L2 Rollup launch · 14.05", refs: 67, info: "Mainnet · 1.2B$ TVL прогноз" },
  { id: "ev_h",   type: "event",   label: "Exploit · Curve · 18M$",   refs: 54, info: "Re-entrancy · 22.04" },
  { id: "ev_dump",type: "event",   label: "Whale dump 12.8K ETH",     refs: 42, info: "0x7a2c → Binance · 14:08" },

  { id: "p_aave", type: "proto",   label: "Aave v3",      refs: 54, info: "Lending · TVL 6.8B$" },
  { id: "p_uni",  type: "proto",   label: "Uniswap V3",   refs: 92, info: "DEX · daily 1.2B$" },
  { id: "p_lido", type: "proto",   label: "Lido",         refs: 48, info: "LST · 28B$ stETH" },
  { id: "p_curve",type: "proto",   label: "Curve",        refs: 28, info: "Stable swap" },

  { id: "n_reg",  type: "news",    label: "Регулятор США · 12.03",    refs: 41, info: "Headline · negative" },
  { id: "n_l2",   type: "news",    label: "L2 Anchor: mainnet live",  refs: 38, info: "Positive · 24h reach" },
  { id: "n_hack", type: "news",    label: "Curve exploit · breaking", refs: 31, info: "Critical · negative" },

  { id: "t_usdc", type: "token",   label: "USDC",  refs: 38, info: "Stablecoin · USD-pegged" },
  { id: "t_eth",  type: "token",   label: "ETH",   refs: 187, info: "Native · L1" },
  { id: "t_btc",  type: "token",   label: "BTC",   refs: 124, info: "Native · L1" },
  { id: "t_sol",  type: "token",   label: "SOL",   refs: 62,  info: "Native · L1" },

  { id: "r_str14",type: "report",  label: "Шифт стратегии #14",       refs: 28, info: "Backtest report · 22.05" },
  { id: "r_brief",type: "report",  label: "Daily Brief · 24.05",      refs: 24, info: "Intelligence summary" },

  { id: "c_mix",  type: "cluster", label: "Mixer cluster #14",        refs: 31, risk: 88, info: "Tornado-related · 47 addrs" },
  { id: "c_whale",type: "cluster", label: "Whale cluster · 14 кош.",  refs: 56, risk: 32, info: "Coordinated movements" },
];

const KG_EDGES = [
  ["w_7a2c", "w_9b4f", 0.9, "tx"],
  ["w_7a2c", "o_bin", 0.8, "deposit"],
  ["w_7a2c", "c_whale", 1.0, "member"],
  ["w_7a2c", "ev_dump", 1.0, "source"],
  ["ev_dump", "n_hack", 0.4, "related"],
  ["w_dead", "c_mix", 1.0, "member"],
  ["w_dead", "p_uni", 0.5, "interaction"],
  ["w_91a4", "c_whale", 0.6, "member"],
  ["w_91a4", "p_aave", 0.5, "user"],
  ["w_fe44", "p_lido", 0.7, "treasury"],
  ["o_alm", "w_7a2c", 0.5, "linked"],
  ["o_alm", "t_eth", 0.6, "holding"],
  ["o_bin", "w_9b4f", 0.9, "owned"],
  ["o_bin", "t_btc", 0.8, "lists"],
  ["o_cb", "t_eth", 0.7, "lists"],
  ["o_cb", "t_btc", 0.7, "lists"],
  ["ev_l2", "n_l2", 0.9, "covered"],
  ["ev_l2", "p_uni", 0.5, "uses"],
  ["ev_h", "p_curve", 1.0, "affects"],
  ["ev_h", "n_hack", 0.95, "covered"],
  ["p_aave", "t_eth", 0.7, "uses"],
  ["p_aave", "t_usdc", 0.6, "uses"],
  ["p_uni", "t_eth", 0.7, "uses"],
  ["p_uni", "t_usdc", 0.6, "uses"],
  ["p_lido", "t_eth", 0.9, "uses"],
  ["p_curve", "t_usdc", 0.7, "uses"],
  ["r_str14", "t_eth", 0.6, "covers"],
  ["r_str14", "p_uni", 0.5, "covers"],
  ["r_brief", "ev_dump", 0.7, "mentions"],
  ["r_brief", "ev_l2", 0.6, "mentions"],
  ["n_reg", "o_cb", 0.4, "subject"],
  ["c_mix", "w_dead", 1.0, "contains"],
  ["c_whale", "w_7a2c", 1.0, "contains"],
  ["c_whale", "w_91a4", 0.7, "contains"],
];

/* ─────────────────────────────────────────────────────────
 * Force simulation
 * ────────────────────────────────────────────────────────*/

function useForceSimulation(nodes, edges, width, height) {
  const [positions, setPositions] = useState(() => {
    const pos = {};
    nodes.forEach((n, i) => {
      const angle = (i / nodes.length) * Math.PI * 2;
      const r = Math.min(width, height) * 0.32;
      pos[n.id] = {
        x: width / 2 + Math.cos(angle) * r,
        y: height / 2 + Math.sin(angle) * r,
        vx: 0,
        vy: 0,
        fixed: false,
      };
    });
    return pos;
  });

  const positionsRef = useRef(positions);
  positionsRef.current = positions;

  // params
  const REPULSION = 6800;
  const SPRING_K = 0.018;
  const SPRING_LEN = 92;
  const DAMPING = 0.78;
  const CENTER_K = 0.0042;

  useEffect(() => {
    let raf;
    function tick() {
      const p = { ...positionsRef.current };
      const ids = Object.keys(p);

      // Repulsion (Coulomb-like)
      for (let i = 0; i < ids.length; i++) {
        const a = p[ids[i]];
        if (a.fixed) continue;
        for (let j = 0; j < ids.length; j++) {
          if (i === j) continue;
          const b = p[ids[j]];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist2 = Math.max(40, dx * dx + dy * dy);
          const f = REPULSION / dist2;
          const dist = Math.sqrt(dist2);
          a.vx += (dx / dist) * f;
          a.vy += (dy / dist) * f;
        }
      }

      // Springs along edges
      edges.forEach(([from, to, w]) => {
        if (!p[from] || !p[to]) return;
        const a = p[from], b = p[to];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const f = SPRING_K * (dist - SPRING_LEN) * w;
        const fx = (dx / dist) * f;
        const fy = (dy / dist) * f;
        if (!a.fixed) { a.vx += fx; a.vy += fy; }
        if (!b.fixed) { b.vx -= fx; b.vy -= fy; }
      });

      // Center pull
      ids.forEach(id => {
        const node = p[id];
        if (node.fixed) return;
        node.vx += (width / 2 - node.x) * CENTER_K;
        node.vy += (height / 2 - node.y) * CENTER_K;
      });

      // Integrate + damping
      ids.forEach(id => {
        const node = p[id];
        if (node.fixed) { node.vx = 0; node.vy = 0; return; }
        node.vx *= DAMPING;
        node.vy *= DAMPING;
        node.x += node.vx;
        node.y += node.vy;
        // bounds
        const pad = 30;
        node.x = Math.max(pad, Math.min(width - pad, node.x));
        node.y = Math.max(pad, Math.min(height - pad, node.y));
      });

      setPositions({ ...p });
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [width, height]);

  const setNodePos = (id, x, y, fixed = false) => {
    setPositions(prev => ({
      ...prev,
      [id]: { ...prev[id], x, y, vx: 0, vy: 0, fixed },
    }));
  };

  return [positions, setNodePos];
}

/* ─────────────────────────────────────────────────────────
 * The Graph component
 * ────────────────────────────────────────────────────────*/
function KnowledgeGraph({ filter, search, onSelect, selected, width = 560, height = 440 }) {
  // Filter nodes
  const visibleNodes = useMemo(() => {
    return KG_NODES.filter(n => {
      if (filter !== "all" && n.type !== filter) return false;
      if (search && !n.label.toLowerCase().includes(search.toLowerCase()) && !n.info.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [filter, search]);

  // Filter edges to only those between visible nodes
  const visibleEdges = useMemo(() => {
    const ids = new Set(visibleNodes.map(n => n.id));
    return KG_EDGES.filter(([a, b]) => ids.has(a) && ids.has(b));
  }, [visibleNodes]);

  const [positions, setNodePos] = useForceSimulation(visibleNodes, visibleEdges, width, height);
  const [dragging, setDragging] = useState(null);
  const svgRef = useRef(null);
  const [hover, setHover] = useState(null);
  const [pulse, setPulse] = useState(0);

  useInterval(() => setPulse(p => p + 1), 60);

  const handleMouseDown = (id, e) => {
    e.stopPropagation();
    setDragging(id);
  };

  const handleMouseMove = (e) => {
    if (!dragging || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    setNodePos(dragging, x, y, true);
  };

  const handleMouseUp = () => {
    if (dragging) {
      setNodePos(dragging, positions[dragging]?.x || 0, positions[dragging]?.y || 0, false);
    }
    setDragging(null);
  };

  // Connected ids to selected
  const connectedIds = useMemo(() => {
    if (!selected) return new Set();
    const out = new Set([selected]);
    visibleEdges.forEach(([a, b]) => {
      if (a === selected) out.add(b);
      if (b === selected) out.add(a);
    });
    return out;
  }, [selected, visibleEdges]);

  return (
    <svg ref={svgRef} width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}
      onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
      style={{ background: "var(--bg-0)", cursor: dragging ? "grabbing" : "default", display: "block" }}
    >
      <defs>
        <radialGradient id="kg-glow">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Grid bg */}
      <pattern id="kg-grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="oklch(0.78 0.16 var(--accent-h) / 0.04)" strokeWidth="0.5" />
      </pattern>
      <rect width={width} height={height} fill="url(#kg-grid)" />

      {/* Edges */}
      {visibleEdges.map(([from, to, w, kind], i) => {
        const a = positions[from];
        const b = positions[to];
        if (!a || !b) return null;
        const isConnected = connectedIds.has(from) && connectedIds.has(to);
        const dim = selected && !isConnected;
        return (
          <g key={i}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={isConnected && selected ? "var(--accent)" : "var(--line-bright)"}
              strokeWidth={isConnected && selected ? 1.2 : Math.max(0.4, w * 0.9)}
              opacity={dim ? 0.12 : 0.45 + w * 0.25}
            />
            {isConnected && selected && (
              <circle cx={a.x + (b.x - a.x) * (((pulse + i * 7) % 60) / 60)}
                cy={a.y + (b.y - a.y) * (((pulse + i * 7) % 60) / 60)}
                r={1.5} fill="var(--accent)" />
            )}
          </g>
        );
      })}

      {/* Nodes */}
      {visibleNodes.map(n => {
        const pos = positions[n.id];
        if (!pos) return null;
        const meta = ENTITY_TYPES[n.type];
        const isSelected = selected === n.id;
        const isConnected = connectedIds.has(n.id);
        const isHovered = hover === n.id;
        const dim = selected && !isConnected;
        const r = isSelected ? 14 : isHovered ? 12 : Math.max(8, Math.min(13, 6 + n.refs / 18));
        const isRisky = n.risk && n.risk > 60;

        return (
          <g key={n.id}
            onMouseDown={(e) => handleMouseDown(n.id, e)}
            onMouseEnter={() => setHover(n.id)}
            onMouseLeave={() => setHover(null)}
            onClick={() => onSelect(n.id)}
            style={{ cursor: dragging === n.id ? "grabbing" : "pointer" }}
            opacity={dim ? 0.25 : 1}
          >
            {(isSelected || isHovered) && (
              <circle cx={pos.x} cy={pos.y} r={r + 14} fill="url(#kg-glow)" />
            )}
            {isRisky && (
              <circle cx={pos.x} cy={pos.y} r={r + 4}
                fill="none" stroke="var(--red)" strokeWidth={0.5}
                strokeDasharray="2 2" opacity={0.6} />
            )}
            <circle cx={pos.x} cy={pos.y} r={r}
              fill="var(--bg-2)" stroke={meta.color}
              strokeWidth={isSelected ? 2 : 1.2}
            />
            <text x={pos.x} y={pos.y + 3.5} textAnchor="middle"
              fontFamily="var(--font-mono)" fontSize={r > 11 ? 10 : 8.5} fontWeight={700}
              fill={meta.color} pointerEvents="none">
              {meta.glyph}
            </text>
            {/* label below */}
            {(r >= 10 || isHovered || isSelected) && (
              <g pointerEvents="none">
                <rect x={pos.x - 36} y={pos.y + r + 3} width={72} height={12}
                  fill="var(--bg-1)" stroke="var(--line)" strokeWidth={0.4}
                  rx={2} opacity={isSelected ? 1 : 0.85} />
                <text x={pos.x} y={pos.y + r + 11.5} textAnchor="middle"
                  fontFamily="var(--font-mono)" fontSize={8} fill={isSelected ? meta.color : "var(--text)"}
                  fontWeight={isSelected ? 600 : 400}>
                  {n.label.length > 11 ? n.label.slice(0, 11) + "…" : n.label}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* Empty state */}
      {visibleNodes.length === 0 && (
        <text x={width / 2} y={height / 2} textAnchor="middle"
          fontFamily="var(--font-mono)" fontSize={11} fill="var(--text-dim)">
          Нет узлов по выбранным фильтрам
        </text>
      )}
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────
 * Entity detail card
 * ────────────────────────────────────────────────────────*/
function EntityDetail({ node, onClose }) {
  const meta = ENTITY_TYPES[node.type];
  const connected = KG_EDGES
    .filter(([a, b]) => a === node.id || b === node.id)
    .map(([a, b, w, kind]) => {
      const otherId = a === node.id ? b : a;
      const other = KG_NODES.find(n => n.id === otherId);
      return other ? { ...other, weight: w, kind } : null;
    })
    .filter(Boolean);

  return (
    <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 4,
          background: "var(--bg-0)",
          border: `1.5px solid ${meta.color}`,
          color: meta.color,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700,
          boxShadow: `0 0 18px -4px ${meta.color}`,
        }}>{meta.glyph}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mono" style={{ fontSize: 9.5, fontWeight: 600, color: meta.color, letterSpacing: 0.12 }}>{meta.ru}</div>
          <div style={{ fontSize: 13, color: "var(--text-bright)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{node.label}</div>
        </div>
        <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--text-dim)", fontSize: 14, cursor: "pointer" }}>✕</button>
      </div>

      <div style={{
        background: "var(--bg-0)", border: "1px solid var(--line)", borderRadius: 4,
        padding: "8px 10px", fontSize: 11.5, color: "var(--text-mid)", lineHeight: 1.5,
      }}>
        {node.info}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <KgStat label="REFS" v={node.refs} c="var(--accent)" />
        {node.risk != null && <KgStat label="RISK" v={node.risk} c={node.risk > 70 ? "var(--red)" : node.risk > 40 ? "var(--amber)" : "var(--green)"} />}
        {node.risk == null && <KgStat label="ТИП" v={meta.ru} c={meta.color} />}
      </div>

      <div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.15, fontWeight: 600, marginBottom: 5 }}>
          СВЯЗИ · {connected.length}
        </div>
        <div className="scroll" style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
          {connected.length === 0 && (
            <div style={{ padding: 8, fontSize: 11, color: "var(--text-dim)", textAlign: "center" }}>Нет связей</div>
          )}
          {connected.sort((a, b) => b.weight - a.weight).map(c => {
            const cm = ENTITY_TYPES[c.type];
            return (
              <div key={c.id} style={{
                padding: "5px 8px",
                background: "var(--bg-0)", border: "1px solid var(--line)",
                borderLeft: `2px solid ${cm.color}`, borderRadius: 2,
                display: "grid", gridTemplateColumns: "auto 1fr auto auto",
                gap: 6, alignItems: "center",
                fontSize: 11,
              }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600, color: cm.color }}>{cm.glyph}</span>
                <span style={{ color: "var(--text-bright)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.label}</span>
                <span className="mono" style={{ fontSize: 9, color: "var(--text-dim)" }}>{c.kind}</span>
                <span className="mono" style={{ fontSize: 9.5, color: "var(--accent)" }}>{c.weight.toFixed(2)}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", gap: 4 }}>
        <button className="btn" style={{ flex: 1 }}>Открыть в Watchlist</button>
        <button className="btn btn-accent" style={{ flex: 1 }}>Запустить миссию</button>
      </div>
    </div>
  );
}

function KgStat({ label, v, c }) {
  return (
    <div style={{ background: "var(--bg-0)", border: "1px solid var(--line)", borderRadius: 3, padding: "6px 10px" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, color: "var(--text-dim)", letterSpacing: 0.12, fontWeight: 600 }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 16, color: c, marginTop: 1 }}>{v}</div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 * Semantic search results
 * ────────────────────────────────────────────────────────*/
function SemanticSearchResults({ query, onSelect }) {
  if (!query || query.length < 2) {
    return (
      <div style={{ padding: 12, fontSize: 11.5, color: "var(--text-dim)", lineHeight: 1.5 }}>
        Введите запрос (≥2 символа), чтобы получить семантически близкие результаты из векторной памяти.
      </div>
    );
  }
  // simulated semantic search: relevance based on substring + entity type weight
  const q = query.toLowerCase();
  const results = KG_NODES
    .map(n => {
      const text = (n.label + " " + n.info).toLowerCase();
      let score = 0;
      if (n.label.toLowerCase().includes(q)) score += 0.5;
      if (n.info.toLowerCase().includes(q)) score += 0.35;
      // jitter for "embedding similarity"
      score += (q.charCodeAt(0) % (n.id.length + 1)) / 100;
      return { ...n, score };
    })
    .filter(r => r.score > 0.1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  if (results.length === 0) {
    return (
      <div style={{ padding: 12, fontSize: 11.5, color: "var(--text-dim)", textAlign: "center" }}>
        Нет семантически близких результатов
      </div>
    );
  }

  return (
    <div style={{ padding: "6px 0" }}>
      {results.map((r, i) => {
        const meta = ENTITY_TYPES[r.type];
        return (
          <div key={r.id} onClick={() => onSelect(r.id)} style={{
            padding: "7px 12px",
            borderBottom: "1px solid var(--line)",
            cursor: "pointer",
            display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 8, alignItems: "center",
          }}>
            <span style={{
              width: 20, height: 20, borderRadius: 3,
              background: "var(--bg-2)", border: `1px solid ${meta.color}`,
              color: meta.color, fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>{meta.glyph}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11.5, color: "var(--text-bright)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</div>
              <div className="mono" style={{ fontSize: 9.5, color: "var(--text-dim)" }}>
                #{i + 1} · {meta.ru} · {r.refs} refs
              </div>
            </div>
            <div style={{
              fontFamily: "var(--font-mono)", fontSize: 10.5,
              color: r.score > 0.7 ? "var(--green)" : r.score > 0.4 ? "var(--accent)" : "var(--text-mid)",
              textAlign: "right",
            }}>
              {(Math.min(0.99, r.score)).toFixed(2)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 * Enhanced Memory Page
 * ────────────────────────────────────────────────────────*/
function MemoryPageEnhanced({ lang }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);

  const selected = selectedId ? KG_NODES.find(n => n.id === selectedId) : null;

  // Stats
  const stats = useMemo(() => {
    const out = { total: KG_NODES.length };
    Object.keys(ENTITY_TYPES).forEach(t => {
      out[t] = KG_NODES.filter(n => n.type === t).length;
    });
    return out;
  }, []);

  return (
    <div data-screen-label="04 Memory" style={{ height: "100%", padding: "var(--gap)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <PageHeader title={lang === "en" ? "MEMORY" : "ПАМЯТЬ"}
        sub="LONG-TERM VECTOR STORE · 2.4M embeddings · 847 entities · 14 indices"
        actions={
          <>
            <button className="btn">Reindex</button>
            <button className="btn">Snapshot</button>
            <button className="btn btn-accent" onClick={() => setSelectedId(null)}>Запрос ▸</button>
          </>
        }
      />

      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 2.4fr 1fr", gap: "var(--gap)", minHeight: 0, overflow: "hidden" }}>
        {/* Left: search + filters + results */}
        <div style={{ display: "grid", gridTemplateRows: "auto 1fr auto", gap: "var(--gap)", minHeight: 0, overflow: "hidden" }}>
          <div className="panel" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.15, fontWeight: 600 }}>
              SEMANTIC SEARCH
            </div>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="whale, exploit, L2, mixer..."
              style={{
                width: "100%", padding: "8px 10px",
                background: "var(--bg-0)", border: "1px solid var(--line-bright)",
                color: "var(--text-bright)", fontFamily: "var(--font-mono)", fontSize: 12,
                outline: "none", borderRadius: 4,
              }} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {["whale", "exploit", "L2", "stable", "bridge"].map(t => (
                <button key={t} onClick={() => setSearch(t)} className="chip" style={{ cursor: "pointer", border: "1px solid var(--line)" }}>#{t}</button>
              ))}
            </div>
          </div>

          <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
            <PanelHeader title="РЕЗУЛЬТАТЫ" meta={search ? `q="${search}"` : "нет запроса"} />
            <div className="scroll" style={{ flex: 1, overflowY: "auto" }}>
              <SemanticSearchResults query={search} onSelect={setSelectedId} />
            </div>
          </div>

          {/* Timeline */}
          <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0, height: 200 }}>
            <PanelHeader title="ВОСПОМИНАНИЯ · ПОСЛЕДНИЕ" meta="24ч · 47 событий" />
            <div className="scroll" style={{ flex: 1, overflowY: "auto", padding: 10 }}>
              <MiniTimeline />
            </div>
          </div>
        </div>

        {/* Center: knowledge graph */}
        <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
          <PanelHeader
            title="KNOWLEDGE GRAPH · LIVE"
            meta={`${KG_NODES.length} узлов · ${KG_EDGES.length} рёбер · force-layout`}
            action={
              <div style={{ display: "flex", gap: 4 }}>
                <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="Все" />
                {Object.entries(ENTITY_TYPES).map(([k, v]) => (
                  <FilterChip key={k} active={filter === k} onClick={() => setFilter(k)} label={v.ru} color={v.color} />
                ))}
              </div>
            }
          />
          <div style={{ flex: 1, position: "relative", minHeight: 0, overflow: "hidden" }}>
            <KnowledgeGraph
              filter={filter} search=""
              onSelect={setSelectedId} selected={selectedId}
              width={620} height={460}
            />
            <div style={{
              position: "absolute", bottom: 8, left: 12,
              fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)",
              display: "flex", gap: 14,
            }}>
              <span>↳ перетащите узлы · клик для деталей</span>
            </div>
            <div style={{
              position: "absolute", top: 10, right: 14,
              display: "flex", flexDirection: "column", gap: 3,
              fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)",
              background: "var(--bg-1)", padding: "6px 8px",
              border: "1px solid var(--line)", borderRadius: 3,
            }}>
              <div style={{ marginBottom: 2, letterSpacing: 0.1, fontWeight: 600 }}>СТАТИСТИКА</div>
              {Object.entries(ENTITY_TYPES).map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ color: v.color }}>{v.glyph} {v.ru}</span>
                  <span style={{ color: "var(--text)" }}>{stats[k] || 0}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: entity detail + heatmap */}
        <div style={{ display: "grid", gridTemplateRows: "1.6fr 1fr", gap: "var(--gap)", minHeight: 0, overflow: "hidden" }}>
          <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
            <PanelHeader title={selected ? "ENTITY · DETAIL" : "ENTITY · ВЫБЕРИТЕ"} meta={selected ? selected.id : "клик по узлу"} />
            <div className="scroll" style={{ flex: 1, overflowY: "auto" }}>
              {selected ? (
                <EntityDetail node={selected} onClose={() => setSelectedId(null)} />
              ) : (
                <div style={{
                  padding: 40, textAlign: "center", color: "var(--text-dim)",
                  fontSize: 11.5, display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
                }}>
                  <div style={{
                    width: 50, height: 50, borderRadius: 4,
                    background: "var(--bg-0)", border: "1px dashed var(--line-bright)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "var(--font-mono)", fontSize: 18, color: "var(--text-dim)",
                  }}>?</div>
                  <div style={{ maxWidth: 200, lineHeight: 1.5 }}>
                    Кликните по любому узлу графа, чтобы увидеть детализацию, связи и действия.
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
            <PanelHeader title="EMBEDDING HEATMAP" meta="cluster #14 · 192 dims" />
            <div className="scroll" style={{ flex: 1, padding: 10, overflowY: "auto" }}>
              <Heatmap cols={16} rows={10} cell={12} seed={1} />
              <div style={{ marginTop: 6, fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--text-dim)" }}>
                cosine similarity baseline · 0.84
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { MemoryPageEnhanced, KnowledgeGraph });