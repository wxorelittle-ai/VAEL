/* crypto-chart.jsx — the dashboard price chart, extracted from crypto.jsx.
 * Pure presentational: candles + volume, the system's projection, open-position
 * lines, signal markers, the proposed entry plan, and the live-price axis. Driven
 * entirely by props; exposed on window so crypto.jsx renders it by name. */

function ChartWithSignals({ candles, signals, positions, hoveredSignalId, onHoverSignal, livePrice, plan, projection, width = 700, height = 280 }) {
  const proj = (projection && projection.path && projection.path.length) ? projection.path : null;
  const projVals = proj
    ? [...proj.flatMap(c => [c.hi, c.lo]), ...((projection.band || []).flatMap(b => [b.hi, b.lo]))].filter(v => isFinite(v))
    : [];
  const planVals = plan ? [plan.sl, plan.tp, plan.entry].filter(v => v != null && isFinite(v)) : [];
  const minV = Math.min(...candles.map(c => c.lo), ...planVals, ...projVals);
  const maxV = Math.max(...candles.map(c => c.hi), ...planVals, ...projVals);
  const padBottom = 50; // for volume row
  const padTop = 14;
  const padRight = 56; // for price axis
  const chartH = height - padBottom - padTop;
  const innerW = width - padRight;
  const range = (maxV - minV) * 1.04 || 1;
  const baseY = (maxV - minV) * 0.02 + minV;
  // reserve slots on the right for the projection so it doesn't overlap the axis
  const slots = candles.length + (proj ? proj.length : 0);
  const stepX = innerW / Math.max(slots, 30);
  const candleW = Math.max(2, stepX * 0.65);
  const y = (v) => padTop + (1 - (v - baseY) / range) * chartH;
  const maxVol = Math.max(...candles.map(c => c.v), 1);

  const last = candles[candles.length - 1];
  const lp = (livePrice != null && isFinite(livePrice)) ? livePrice : last.close;
  const lastY = y(lp);

  const priceLevels = [0.2, 0.4, 0.6, 0.8];

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none"
      style={{ display: "block" }}
      onMouseLeave={() => onHoverSignal?.(null)}
    >
      <defs>
        <linearGradient id="cws-vol-up" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="var(--green)" stopOpacity="0.05" />
          <stop offset="100%" stopColor="var(--green)" stopOpacity="0.4" />
        </linearGradient>
        <linearGradient id="cws-vol-dn" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="var(--red)" stopOpacity="0.05" />
          <stop offset="100%" stopColor="var(--red)" stopOpacity="0.4" />
        </linearGradient>
      </defs>

      {/* y grid */}
      {priceLevels.map((p, i) => {
        const yy = padTop + chartH * p;
        const v = baseY + range * (1 - p);
        return (
          <g key={i}>
            <line x1={0} y1={yy} x2={innerW} y2={yy}
              stroke="var(--line)" strokeWidth={0.5} strokeDasharray="2 4" />
            <text x={width - 6} y={yy + 3} textAnchor="end"
              fontFamily="var(--font-mono)" fontSize={9.5} fill="var(--text-dim)">
              {v < 10 ? v.toFixed(2) : v < 1000 ? v.toFixed(1) : v.toFixed(0)}
            </text>
          </g>
        );
      })}

      {/* candles */}
      {candles.map((c, i) => {
        const cx = i * stepX + stepX / 2;
        const up = c.close >= c.open;
        const color = up ? "var(--green)" : "var(--red)";
        const top = y(Math.max(c.open, c.close));
        const bot = y(Math.min(c.open, c.close));
        const volH = (c.v / maxVol) * 36;
        return (
          <g key={i}>
            {/* wick */}
            <line x1={cx} y1={y(c.hi)} x2={cx} y2={y(c.lo)} stroke={color} strokeWidth={0.8} />
            {/* body */}
            <rect x={cx - candleW / 2} y={top}
              width={candleW} height={Math.max(0.8, bot - top)}
              fill={up ? "transparent" : color} stroke={color} strokeWidth={1} />
            {/* volume bar */}
            <rect x={cx - candleW / 2} y={height - 4 - volH}
              width={candleW} height={volH}
              fill={`url(#cws-vol-${up ? "up" : "dn"})`} />
          </g>
        );
      })}

      {/* ── projection: the system's OPINION on where price goes — TA conviction +
           strategy target + trend strength, tilted by macro & news. Ghost candles
           follow that path; the faint band is the uncertainty around it. ── */}
      {proj && candles.length > 0 && (() => {
        const n = candles.length;
        const px = t => (n + t) * stepX + stepX / 2;
        const nowX = (n - 1) * stepX + stepX / 2;
        const nowY = y((livePrice != null && isFinite(livePrice)) ? livePrice : candles[n - 1].close);
        const up = projection.expectedPct >= 0;
        const col = up ? "var(--green)" : "var(--red)";
        const gw = Math.max(1.2, stepX * 0.6);

        const bandPath = (() => {
          if (!projection.band) return null;
          const top = projection.band.map((b, t) => `${px(t)},${y(b.hi)}`);
          const bot = projection.band.map((b, t) => `${px(t)},${y(b.lo)}`).reverse();
          return `M${nowX},${nowY} L${top.join(" L")} L${bot.join(" L")} Z`;
        })();
        const line = `M${nowX},${nowY} ` + proj.map((c, t) => `L${px(t)},${y(c.close)}`).join(" ");

        return (
          <g>
            {bandPath && <path d={bandPath} fill={col} opacity={0.07} stroke="none" />}
            {proj.map((c, t) => {
              const cx = px(t);
              const cc = c.up ? "var(--green)" : "var(--red)";
              const bTop = y(Math.max(c.open, c.close)), bBot = y(Math.min(c.open, c.close));
              return (
                <g key={`pj${t}`} opacity={0.32}>
                  <line x1={cx} y1={y(c.hi)} x2={cx} y2={y(c.lo)} stroke={cc} strokeWidth={0.55} />
                  <rect x={cx - gw / 2} y={bTop} width={gw} height={Math.max(0.9, bBot - bTop)}
                    fill="none" stroke={cc} strokeWidth={0.9} strokeDasharray="1.5 1.5" />
                </g>
              );
            })}
            <path d={line} fill="none" stroke={col} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
            {/* strategy target the path is heading to */}
            {isFinite(projection.target) && (
              <line x1={nowX} y1={y(projection.target)} x2={px(proj.length - 1)} y2={y(projection.target)}
                stroke={col} strokeWidth={0.5} strokeDasharray="1 4" opacity={0.5} />
            )}
            <line x1={nowX} y1={padTop} x2={nowX} y2={padTop + chartH}
              stroke="var(--line-bright)" strokeWidth={0.6} strokeDasharray="2 3" opacity={0.7} />
            <text x={px(0)} y={padTop + 9} fontFamily="var(--font-mono)" fontSize={8} fill={col} opacity={0.9}>
              прогноз {up ? "▲" : "▼"} {projection.expectedPct >= 0 ? "+" : ""}{projection.expectedPct.toFixed(2)}% · conf {projection.conf}%
            </text>
          </g>
        );
      })()}

      {/* position lines (entry + TP/SL) */}
      {positions.map((p, i) => {
        const yEntry = y(p.entry);
        const yTp = p.tp ? y(p.tp) : null;
        const ySl = p.sl ? y(p.sl) : null;
        const c = p.side === "buy" ? "var(--green)" : "var(--red)";
        return (
          <g key={p.id}>
            <line x1={0} y1={yEntry} x2={innerW} y2={yEntry}
              stroke={c} strokeWidth={0.8} strokeDasharray="4 2" opacity={0.6} />
            <rect x={innerW - 70} y={yEntry - 8} width={66} height={14}
              fill="var(--bg-0)" stroke={c} strokeWidth={0.5} />
            <text x={innerW - 6} y={yEntry + 3} textAnchor="end"
              fontFamily="var(--font-mono)" fontSize={9.5} fontWeight={600} fill={c}>
              {p.side === "buy" ? "LONG" : "SHORT"} {p.entry.toFixed(2)}
            </text>
            {yTp && (
              <>
                <line x1={0} y1={yTp} x2={innerW} y2={yTp}
                  stroke="var(--green)" strokeWidth={0.4} strokeDasharray="1 3" opacity={0.5} />
                <text x={6} y={yTp - 3} fontFamily="var(--font-mono)" fontSize={8.5} fill="var(--green)">TP {p.tp.toFixed(2)}</text>
              </>
            )}
            {ySl && (
              <>
                <line x1={0} y1={ySl} x2={innerW} y2={ySl}
                  stroke="var(--red)" strokeWidth={0.4} strokeDasharray="1 3" opacity={0.5} />
                <text x={6} y={ySl - 3} fontFamily="var(--font-mono)" fontSize={8.5} fill="var(--red)">SL {p.sl.toFixed(2)}</text>
              </>
            )}
          </g>
        );
      })}

      {/* signal markers */}
      {signals.map(s => {
        // anchor by candle timestamp — the array shifts, so a stored index goes stale
        const sIdx = s.ts0 != null ? candles.findIndex(c => c.start === s.ts0) : s.candleIdx;
        if (sIdx < 0 || sIdx >= candles.length) return null;
        const cx = sIdx * stepX + stepX / 2;
        const cy = y(s.price);
        const isBuy = s.side === "buy";
        const yMarker = isBuy ? cy + 14 : cy - 14;
        const color = s.status === "verified" ? "var(--green)" :
                      s.status === "failed"   ? "var(--red)"   :
                      isBuy ? "var(--green)" : "var(--red)";
        const hover = hoveredSignalId === s.id;
        const isActive = s.status === "active";
        const triPath = isBuy
          ? `M${cx},${yMarker-7} L${cx-5.5},${yMarker+2} L${cx+5.5},${yMarker+2} Z`
          : `M${cx},${yMarker+7} L${cx-5.5},${yMarker-2} L${cx+5.5},${yMarker-2} Z`;
        return (
          <g key={s.id} style={{ cursor: "pointer" }}
             onMouseEnter={() => onHoverSignal?.(s.id)}
             onMouseLeave={() => onHoverSignal?.(null)}>
            {/* connector */}
            <line x1={cx} y1={cy} x2={cx} y2={yMarker} stroke={color} strokeWidth={0.6} strokeDasharray="1 2" opacity={0.7} />
            {isActive && (
              <circle cx={cx} cy={yMarker} r={9} fill={color} opacity={0.18}>
                <animate attributeName="r" from="6" to="14" dur="1.6s" repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.4" to="0" dur="1.6s" repeatCount="indefinite" />
              </circle>
            )}
            <path d={triPath} fill={color} opacity={hover || isActive ? 1 : 0.85}
              stroke={hover ? "var(--text-bright)" : "none"} strokeWidth={0.6} />
            {hover && (
              <g>
                <rect x={cx - 84} y={isBuy ? yMarker + 8 : yMarker - 36}
                  width={168} height={28}
                  fill="var(--bg-1)" stroke={color} strokeWidth={0.6} rx={3} />
                <text x={cx} y={isBuy ? yMarker + 21 : yMarker - 23} textAnchor="middle"
                  fontFamily="var(--font-mono)" fontSize={9.5} fontWeight={600} fill={color}>
                  {isBuy ? "ПОКУПКА" : "ПРОДАЖА"} @ {s.price.toFixed(2)}
                </text>
                <text x={cx} y={isBuy ? yMarker + 32 : yMarker - 12} textAnchor="middle"
                  fontFamily="var(--font-mono)" fontSize={9} fill="var(--text-mid)">
                  {s.confidence}% · {s.status === "verified" ? `+${s.outcome.toFixed(2)}%` : s.status === "failed" ? `${s.outcome.toFixed(2)}%` : "активный"}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* proposed entry plan (from "найти точку входа") */}
      {plan && (() => {
        const c = plan.side === "buy" ? "var(--green)" : "var(--red)";
        const row = (v, col, label, dash) => (v == null || !isFinite(v)) ? null : (
          <g>
            <line x1={0} y1={y(v)} x2={innerW} y2={y(v)} stroke={col} strokeWidth={1} strokeDasharray={dash} opacity={0.9} />
            <text x={4} y={y(v) - 3} fontFamily="var(--font-mono)" fontSize={9} fontWeight={600} fill={col}>{label} {v < 10 ? v.toFixed(4) : v.toFixed(2)}</text>
          </g>
        );
        return (
          <g>
            {row(plan.tp, "var(--green)", "TP", "5 3")}
            {row(plan.entry, "var(--accent)", `${plan.side === "buy" ? "▲ ВХОД" : "▼ ВХОД"} · $${plan.amount}${plan.lev > 1 ? ` × ${plan.lev}x` : ""}`, "0")}
            {row(plan.sl, "var(--red)", "SL", "5 3")}
            <rect x={innerW - 118} y={padTop + 2} width={114} height={26} rx={3} fill="var(--bg-0)" stroke={c} strokeWidth={0.6} opacity={0.95} />
            <text x={innerW - 61} y={padTop + 13} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={9.5} fontWeight={700} fill={c}>
              {plan.side === "buy" ? "ЛОНГ" : "ШОРТ"} · ${plan.amount}{plan.lev > 1 ? ` × ${plan.lev}x` : ""}
            </text>
            <text x={innerW - 61} y={padTop + 23} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={8.5} fill="var(--text-dim)">
              conf {plan.conf}% · R:R 1:{plan.rr.toFixed(1)}{plan.setup ? "" : " · неполный"}
            </text>
          </g>
        );
      })()}

      {/* current price line — tracks the live ticker (updates every tick) */}
      <line x1={0} y1={lastY} x2={innerW} y2={lastY}
        stroke="var(--accent)" strokeWidth={0.8} strokeDasharray="3 3" opacity={0.7} />
      {/* pulsing live-price dot at the leading edge */}
      <circle cx={innerW} cy={lastY} r={3.2} fill="var(--accent)">
        <animate attributeName="r" from="3.2" to="9" dur="1.4s" repeatCount="indefinite" />
        <animate attributeName="opacity" from="0.7" to="0" dur="1.4s" repeatCount="indefinite" />
      </circle>
      <circle cx={innerW} cy={lastY} r={2.6} fill="var(--accent)" />
      <rect x={innerW} y={lastY - 9} width={padRight} height={18}
        fill="var(--accent)" />
      <text x={innerW + padRight / 2} y={lastY + 4} textAnchor="middle"
        fontFamily="var(--font-mono)" fontSize={10} fontWeight={600} fill="var(--bg-0)">
        {lp < 10 ? lp.toFixed(3) : lp < 1000 ? lp.toFixed(2) : lp.toFixed(0)}
      </text>
    </svg>
  );
}

Object.assign(window, { ChartWithSignals });
