/* crypto-tables.jsx — bottom-panel tables + shared table helpers, extracted from
 * crypto.jsx: open positions, resting limit orders, trade history, signals, the
 * order book, the trade feed, and the portfolio summary. Presentational, prop-driven.
 * Uses FEE_RATE from crypto.jsx (exposed on window). All exposed on window so the
 * terminal renders them by name. */

function OpenPositionsTable({ positions, onClose }) {
  if (positions.length === 0) {
    return <EmptyState text="Нет открытых позиций. Откройте демо-сделку или используйте сигнал AI." />;
  }
  return (
    <div>
      <THead cols={["Тип", "Маржа", "Плечо", "Позиция", "Вход", "Цена", "Ликв.", "Комис.", "P&L $", "ROE %", ""]}
        grid="66px 62px 50px 70px 74px 74px 74px 58px 70px 66px 66px" />
      {positions.map(p => {
        const isBuy = p.side === "buy";
        const color = isBuy ? "var(--green)" : "var(--red)";
        const pnlColor = p.pnl >= 0 ? "var(--green)" : "var(--red)";
        const lev = p.lev || 1;
        const margin = p.margin != null ? p.margin : p.size;
        const dec = p.entry < 10 ? 4 : 2;
        // full trade commission (entry + exit) so it matches what closing actually
        // charges — the exit leg is estimated at the current price, same formula as
        // closePosition. Showing only the entry leg made the close look 2× bigger.
        const entryFee = p.entryFee != null ? p.entryFee : p.size * FEE_RATE;
        const exitFeeEst = p.size * ((p.currentPrice || p.entry) / p.entry) * FEE_RATE;
        const feeRoundTrip = entryFee + exitFeeEst;
        return (
          <div key={p.id} style={{
            display: "grid", gridTemplateColumns: "66px 62px 50px 70px 74px 74px 74px 58px 70px 66px 66px",
            alignItems: "center", padding: "5px 12px",
            borderBottom: "1px solid var(--line)",
            fontFamily: "var(--font-mono)", fontSize: 10.5,
            background: p.signalId ? "oklch(0.78 0.16 var(--accent-h) / 0.04)" : "transparent",
          }}>
            <span style={{ color, fontWeight: 600 }}>{p.signalId === "auto" ? <span title="сделка агента" style={{ marginRight: 2 }}>🤖</span> : null}{isBuy ? "▲ ЛОНГ" : "▼ ШОРТ"}{p.trail ? <span title={`трейлинг-стоп ${(p.trail * 100).toFixed(1)}%`} style={{ color: "var(--accent-2)", fontSize: 8.5, marginLeft: 3 }}>⇡T</span> : null}</span>
            <span style={{ color: "var(--text-mid)" }}>{margin}$</span>
            <span style={{ color: lev >= 25 ? "var(--red)" : lev >= 10 ? "var(--amber)" : "var(--accent)", fontWeight: 600 }}>{lev}x</span>
            <span style={{ color: "var(--text)" }}>{p.size}$</span>
            <span style={{ color: "var(--text-mid)" }}>{p.entry.toFixed(dec)}</span>
            <span style={{ color: "var(--text-bright)" }}>{p.currentPrice.toFixed(dec)}</span>
            <span style={{ color: p.liq ? "var(--red)" : "var(--text-dim)" }}>{p.liq ? p.liq.toFixed(dec) : "—"}</span>
            <span style={{ color: "var(--amber)" }} title="комиссия за сделку: вход + выход (round-trip, выход оценён по текущей цене)">−{feeRoundTrip.toFixed(2)}</span>
            <span style={{ color: pnlColor }}>{p.pnl >= 0 ? "+" : ""}{p.pnl.toFixed(2)}</span>
            <span style={{ color: pnlColor, fontWeight: 600 }}>{p.pnlPct >= 0 ? "+" : ""}{p.pnlPct.toFixed(1)}%</span>
            <button onClick={() => onClose(p.id)} style={{
              padding: "2px 8px",
              background: "var(--bg-2)", border: "1px solid var(--line-bright)",
              color: "var(--text-mid)", cursor: "pointer", borderRadius: 2,
              fontFamily: "var(--font-mono)", fontSize: 9.5,
            }}>ЗАКРЫТЬ</button>
          </div>
        );
      })}
    </div>
  );
}

function PendingOrdersTable({ pending, price, onCancel }) {
  if (pending.length === 0) {
    return <EmptyState text="Нет активных заявок. «Открыть по плану» с лимитным входом поставит заявку, ждущую свою цену." />;
  }
  return (
    <div>
      <THead cols={["Тип", "Маржа", "Плечо", "Лимит", "Рынок", "До цели", "Стоп", "Цель", "Выставлена", ""]}
        grid="66px 62px 50px 74px 74px 68px 74px 74px 84px 66px" />
      {pending.map(o => {
        const isBuy = o.side === "buy";
        const color = isBuy ? "var(--green)" : "var(--red)";
        const lev = o.lev || 1;
        const dec = o.entry < 10 ? 4 : 2;
        const distPct = price ? ((o.entry - price) / price) * 100 : 0;   // signed distance to the limit
        return (
          <div key={o.id} style={{
            display: "grid", gridTemplateColumns: "66px 62px 50px 74px 74px 68px 74px 74px 84px 66px",
            alignItems: "center", padding: "5px 12px",
            borderBottom: "1px solid var(--line)",
            fontFamily: "var(--font-mono)", fontSize: 10.5,
            background: "oklch(0.7 0.13 260 / 0.05)",
          }}>
            <span style={{ color, fontWeight: 600 }}>{isBuy ? "▲ ЛОНГ" : "▼ ШОРТ"} <span style={{ color: "var(--accent-2)", fontSize: 8.5 }}>лимит</span></span>
            <span style={{ color: "var(--text-mid)" }}>{o.margin}$</span>
            <span style={{ color: lev >= 25 ? "var(--red)" : lev >= 10 ? "var(--amber)" : "var(--accent)", fontWeight: 600 }}>{lev}x</span>
            <span style={{ color: "var(--accent-2)", fontWeight: 600 }}>{o.entry.toFixed(dec)}</span>
            <span style={{ color: "var(--text-bright)" }}>{price ? price.toFixed(dec) : "—"}</span>
            <span style={{ color: "var(--text-dim)" }}>{Math.abs(distPct).toFixed(2)}%</span>
            <span style={{ color: "var(--red)" }}>{o.sl.toFixed(dec)}</span>
            <span style={{ color: "var(--green)" }}>{o.tp.toFixed(dec)}</span>
            <span style={{ color: "var(--text-dim)" }}>{o.placedAt}</span>
            <button onClick={() => onCancel(o.id)} style={{
              padding: "2px 8px",
              background: "var(--bg-2)", border: "1px solid var(--line-bright)",
              color: "var(--text-mid)", cursor: "pointer", borderRadius: 2,
              fontFamily: "var(--font-mono)", fontSize: 9.5,
            }}>СНЯТЬ</button>
          </div>
        );
      })}
    </div>
  );
}

function HistoryTable({ history }) {
  if (history.length === 0) {
    return <EmptyState text="История пуста — закрытые сделки появятся здесь." />;
  }
  return (
    <div>
      <THead cols={["#", "Тип", "Вход → Выход", "Объём", "Комис.", "P&L $", "P&L %", "Причина", "Время"]} grid="56px 56px 1fr 64px 62px 66px 58px 74px 60px" />
      {history.map(h => {
        const isBuy = h.side === "buy";
        const color = isBuy ? "var(--green)" : "var(--red)";
        const pnlColor = h.pnl >= 0 ? "var(--green)" : "var(--red)";
        const reasonLabel = { tp: "TP", sl: "SL", trail: "Трейл", liq: "ЛИКВ", daystop: "Дн.стоп", manual: "вручную" }[h.reason] || h.reason;
        const fee = h.fee != null ? h.fee : 0;
        return (
          <div key={h.id} style={{
            display: "grid", gridTemplateColumns: "56px 56px 1fr 64px 62px 66px 58px 74px 60px",
            alignItems: "center", padding: "5px 12px",
            borderBottom: "1px solid var(--line)",
            fontFamily: "var(--font-mono)", fontSize: 10.5,
          }}>
            <span style={{ color: "var(--text-dim)" }}>{h.id.slice(2, 8)}</span>
            <span style={{ color, fontWeight: 600 }}>{isBuy ? "ЛОНГ" : "ШОРТ"}</span>
            <span style={{ color: "var(--text)" }}>{h.entry.toFixed(2)} → {h.exitPrice.toFixed(2)}</span>
            <span style={{ color: "var(--text-mid)" }}>{h.size}$</span>
            <span style={{ color: "var(--amber)" }} title="комиссия за сделку (вход + выход)">−{fee.toFixed(2)}</span>
            <span style={{ color: pnlColor }} title="P&L за вычетом комиссии">{h.pnl >= 0 ? "+" : ""}{h.pnl.toFixed(2)}</span>
            <span style={{ color: pnlColor, fontWeight: 600 }}>{h.pnlPct >= 0 ? "+" : ""}{h.pnlPct.toFixed(2)}%</span>
            <span style={{ color: reasonLabel === "TP" ? "var(--green)" : reasonLabel === "SL" ? "var(--red)" : "var(--text-mid)" }}>{reasonLabel}</span>
            <span style={{ color: "var(--text-dim)" }}>{h.closedAt}</span>
          </div>
        );
      })}
    </div>
  );
}

function SignalsTable({ signals, hoveredId, onHover, onTrade }) {
  return (
    <div>
      <THead cols={["#", "Тип", "Цена", "Confidence", "Агент", "Результат", "Статус", ""]} grid="60px 70px 80px 90px 110px 90px 90px 70px" />
      {signals.map(s => {
        const isBuy = s.side === "buy";
        const color = s.status === "verified" ? "var(--green)" : s.status === "failed" ? "var(--red)" : isBuy ? "var(--green)" : "var(--red)";
        const status = {
          verified: "✓ ПОДТВ",
          failed:   "✕ НЕВЕР",
          active:   "● АКТИВЕН",
        }[s.status];
        const outcomeColor = s.outcome > 0 ? "var(--green)" : s.outcome < 0 ? "var(--red)" : "var(--text-dim)";
        return (
          <div key={s.id}
            onMouseEnter={() => onHover(s.id)}
            onMouseLeave={() => onHover(null)}
            style={{
              display: "grid", gridTemplateColumns: "60px 70px 80px 90px 110px 90px 90px 70px",
              alignItems: "center", padding: "5px 12px",
              borderBottom: "1px solid var(--line)",
              fontFamily: "var(--font-mono)", fontSize: 10.5,
              background: hoveredId === s.id ? "var(--bg-2)" : "transparent",
              cursor: "pointer",
            }}>
            <span style={{ color: "var(--text-dim)" }}>{s.id}</span>
            <span style={{ color: isBuy ? "var(--green)" : "var(--red)", fontWeight: 600 }}>
              {isBuy ? "▲ BUY" : "▼ SELL"}
            </span>
            <span style={{ color: "var(--text-bright)" }}>{s.price.toFixed(2)}</span>
            <span style={{ color: "var(--accent)" }}>{s.confidence}%</span>
            <span style={{ color: "var(--text-mid)" }}>{s.agent}</span>
            <span style={{ color: outcomeColor }}>
              {s.status === "active" ? "—" : `${s.outcome > 0 ? "+" : ""}${s.outcome.toFixed(2)}%`}
            </span>
            <span style={{ color }}>{status}</span>
            {s.status === "active" ? (
              <button onClick={() => onTrade(s)} style={{
                padding: "2px 8px",
                background: "var(--accent-soft)", border: "1px solid oklch(0.78 0.16 var(--accent-h) / 0.4)",
                color: "var(--accent)", cursor: "pointer", borderRadius: 2,
                fontFamily: "var(--font-mono)", fontSize: 9.5, fontWeight: 600,
              }}>ТОРГ.</button>
            ) : <span />}
          </div>
        );
      })}
    </div>
  );
}

function THead({ cols, grid }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: grid,
      padding: "5px 12px", borderBottom: "1px solid var(--line)",
      background: "var(--bg-2)", position: "sticky", top: 0, zIndex: 1,
      fontFamily: "var(--font-mono)", fontSize: 9,
      color: "var(--text-dim)", letterSpacing: 0.08, textTransform: "uppercase",
    }}>
      {cols.map((c, i) => <span key={i}>{c}</span>)}
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div style={{
      padding: "24px 16px", textAlign: "center",
      color: "var(--text-dim)", fontSize: 11.5,
      fontFamily: "var(--font-ui)",
    }}>
      <div style={{
        fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--text-dim)",
        opacity: 0.5, marginBottom: 4,
      }}>—</div>
      {text}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 * Orderbook (live depth) + Trades feed — real Bybit market data
 * ────────────────────────────────────────────────────────*/
function fmtSize(s) {
  if (s == null || isNaN(s)) return "—";
  if (s >= 1000) return s.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (s >= 1)    return s.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return s.toFixed(4);
}

/* Price formatter that keeps decimals (needed for orderbook/trades granularity) */
function fmtBookPrice(n) {
  if (n == null || isNaN(n)) return "—";
  if (n >= 1000) return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 1)    return n.toFixed(4);
  return n.toFixed(5);
}

function OrderbookView({ book, lastPrice }) {
  const N = 12;
  const asksAsc = book.asks.slice(0, N);
  const bidsDesc = book.bids.slice(0, N);
  if (!asksAsc.length && !bidsDesc.length) {
    return <EmptyState text="Загрузка стакана из Bybit…" />;
  }
  let ca = 0; const asksCum = asksAsc.map(([p, s]) => ({ p, s, cum: (ca += s) }));
  let cb = 0; const bidsCum = bidsDesc.map(([p, s]) => ({ p, s, cum: (cb += s) }));
  const maxCum = Math.max(ca, cb, 1e-9);
  const bestAsk = asksAsc[0]?.[0];
  const bestBid = bidsDesc[0]?.[0];
  const spread = bestAsk != null && bestBid != null ? bestAsk - bestBid : null;
  const mid = bestAsk != null && bestBid != null ? (bestAsk + bestBid) / 2 : lastPrice;

  const Row = ({ p, s, cum, color }) => (
    <div style={{
      position: "relative", display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
      padding: "2px 12px", fontFamily: "var(--font-mono)", fontSize: 10.5, alignItems: "center",
    }}>
      <div style={{ position: "absolute", right: 0, top: 1, bottom: 1, width: `${(cum / maxCum) * 100}%`,
        background: color, opacity: 0.12 }} />
      <span style={{ color, zIndex: 1 }}>{fmtBookPrice(p)}</span>
      <span style={{ color: "var(--text-mid)", textAlign: "right", zIndex: 1 }}>{fmtSize(s)}</span>
      <span style={{ color: "var(--text-dim)", textAlign: "right", zIndex: 1 }}>{fmtSize(cum)}</span>
    </div>
  );

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "4px 12px",
        background: "var(--bg-2)", borderBottom: "1px solid var(--line)", position: "sticky", top: 0, zIndex: 2,
        fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.08, textTransform: "uppercase" }}>
        <span>Цена</span><span style={{ textAlign: "right" }}>Объём</span><span style={{ textAlign: "right" }}>Сумма</span>
      </div>
      {[...asksCum].reverse().map((r, i) => <Row key={`a${i}`} {...r} color="var(--red)" />)}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "4px 12px", background: "var(--bg-2)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)",
        fontFamily: "var(--font-mono)", fontSize: 11 }}>
        <span style={{ color: "var(--accent)", fontWeight: 600 }}>{fmtBookPrice(mid)}</span>
        <span style={{ color: "var(--text-dim)", fontSize: 10 }}>
          спред {spread != null ? fmtBookPrice(spread) : "—"}
          {spread != null && mid ? ` (${(spread / mid * 100).toFixed(3)}%)` : ""}
        </span>
      </div>
      {bidsCum.map((r, i) => <Row key={`b${i}`} {...r} color="var(--green)" />)}
    </div>
  );
}

function TradesView({ trades, whaleUsd = 50000 }) {
  if (!trades.length) return <EmptyState text="Загрузка ленты сделок из Bybit…" />;
  const fmtTime = (ms) => {
    const d = new Date(ms);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
  };
  const maxUsd = Math.max(...trades.map(t => t.price * t.size), 1);
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", padding: "4px 12px",
        background: "var(--bg-2)", borderBottom: "1px solid var(--line)", position: "sticky", top: 0, zIndex: 2,
        fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: 0.08, textTransform: "uppercase" }}>
        <span>Цена</span><span style={{ textAlign: "right" }}>Объём</span><span style={{ textAlign: "right" }}>Сторона</span><span style={{ textAlign: "right", minWidth: 62 }}>Время</span>
      </div>
      {trades.map((t) => {
        const buy = t.side === "Buy";
        const c = buy ? "var(--green)" : "var(--red)";
        const usd = t.price * t.size;
        const whale = usd >= whaleUsd;
        return (
          <div key={t.id} title={`$${usd.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
            style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", alignItems: "center",
            padding: "2px 12px", borderBottom: "1px solid var(--line)",
            background: whale ? (buy ? "oklch(0.78 0.16 155 / 0.12)" : "oklch(0.70 0.20 25 / 0.12)") : "transparent",
            fontFamily: "var(--font-mono)", fontSize: 10.5 }}>
            <div style={{ position: "absolute", right: 0, top: 1, bottom: 1, width: `${(usd / maxUsd) * 100}%`,
              background: c, opacity: 0.10 }} />
            <span style={{ color: c, zIndex: 1, fontWeight: whale ? 600 : 400 }}>{whale ? "🐋 " : ""}{fmtBookPrice(t.price)}</span>
            <span style={{ color: whale ? "var(--text-bright)" : "var(--text-mid)", textAlign: "right", zIndex: 1, fontWeight: whale ? 600 : 400 }}>{fmtSize(t.size)}</span>
            <span style={{ color: c, textAlign: "right", zIndex: 1 }}>{buy ? "▲ BUY" : "▼ SELL"}</span>
            <span style={{ color: "var(--text-dim)", textAlign: "right", minWidth: 62, zIndex: 1 }}>{fmtTime(t.time)}</span>
          </div>
        );
      })}
    </div>
  );
}

function PortfolioSummary({ positions }) {
  const totalExposure = positions.reduce((s, p) => s + p.size, 0);
  const totalPnl = positions.reduce((s, p) => s + p.pnl, 0);
  const totalPnlPct = totalExposure > 0 ? (totalPnl / totalExposure) * 100 : 0;
  const longCount = positions.filter(p => p.side === "buy").length;
  const shortCount = positions.length - longCount;
  const pnlColor = totalPnl >= 0 ? "var(--green)" : "var(--red)";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      marginLeft: 14, paddingLeft: 14,
      borderLeft: "1px solid var(--line)",
      fontFamily: "var(--font-mono)", fontSize: 10.5,
    }}>
      <span style={{
        fontSize: 9, fontWeight: 600, letterSpacing: 0.12,
        color: "var(--text-dim)", textTransform: "uppercase",
      }}>портфель</span>
      <span style={{ color: "var(--text-bright)" }}>
        {positions.length}<span style={{ color: "var(--text-dim)" }}>поз.</span>
      </span>
      <span style={{ color: "var(--green)" }}>{longCount}L</span>
      <span style={{ color: "var(--red)" }}>{shortCount}S</span>
      <span style={{ color: "var(--text-dim)" }}>·</span>
      <span><span style={{ color: "var(--text-dim)" }}>экспоз: </span>
        <span style={{ color: "var(--text-bright)" }}>{totalExposure.toFixed(0)}$</span>
      </span>
      <span><span style={{ color: "var(--text-dim)" }}>нереал P&L: </span>
        <span style={{ color: pnlColor, fontWeight: 600 }}>
          {totalPnl >= 0 ? "+" : ""}{totalPnl.toFixed(2)}$ ({totalPnlPct >= 0 ? "+" : ""}{totalPnlPct.toFixed(2)}%)
        </span>
      </span>
    </div>
  );
}

Object.assign(window, {
  OpenPositionsTable, PendingOrdersTable, HistoryTable, SignalsTable, THead, EmptyState,
  OrderbookView, TradesView, PortfolioSummary, fmtSize, fmtBookPrice,
});
