/* notifications.jsx — global toast emitter + container */

const TOAST_TIMERS = new Map();

function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    window.__emitToast = (toast) => {
      const t = {
        id: Date.now() + Math.random(),
        ts: nowToastTs(),
        kind: "info",
        duration: 5500,
        ...toast,
      };
      setToasts(prev => [...prev.slice(-4), t]);
      const timer = setTimeout(() => {
        setToasts(prev => prev.filter(x => x.id !== t.id));
        TOAST_TIMERS.delete(t.id);
      }, t.duration);
      TOAST_TIMERS.set(t.id, timer);
    };
    return () => { window.__emitToast = null; };
  }, []);

  const dismiss = (id) => {
    setToasts(prev => prev.filter(x => x.id !== id));
    clearTimeout(TOAST_TIMERS.get(id));
    TOAST_TIMERS.delete(id);
  };

  return (
    <div style={{
      position: "fixed", top: 56, right: 14, zIndex: 9990,
      display: "flex", flexDirection: "column", gap: 8,
      pointerEvents: "none",
    }}>
      {toasts.map(t => <ToastItem key={t.id} t={t} onClose={() => dismiss(t.id)} />)}
    </div>
  );
}

function nowToastTs() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}:${String(d.getSeconds()).padStart(2,"0")}`;
}

const TOAST_KINDS = {
  signal: { color: "var(--accent)",   icon: "⌖", label: "СИГНАЛ" },
  buy:    { color: "var(--green)",    icon: "▲", label: "ПОКУПКА" },
  sell:   { color: "var(--red)",      icon: "▼", label: "ПРОДАЖА" },
  win:    { color: "var(--green)",    icon: "✓", label: "TP" },
  loss:   { color: "var(--red)",      icon: "✕", label: "SL" },
  close:  { color: "var(--blue)",     icon: "■", label: "ЗАКРЫТО" },
  open:   { color: "var(--accent)",   icon: "▸", label: "ОТКРЫТО" },
  alert:  { color: "var(--amber)",    icon: "!", label: "ВНИМАНИЕ" },
  crit:   { color: "var(--red)",      icon: "!", label: "КРИТ" },
  info:   { color: "var(--blue)",     icon: "i", label: "ИНФО" },
  agent:  { color: "var(--accent-2)", icon: "◆", label: "АГЕНТ" },
};

function ToastItem({ t, onClose }) {
  const meta = TOAST_KINDS[t.kind] || TOAST_KINDS.info;
  return (
    <div style={{
      width: 340,
      background: "var(--bg-1)",
      border: `1px solid var(--line-bright)`,
      borderLeft: `3px solid ${meta.color}`,
      borderRadius: 4,
      boxShadow: `0 8px 28px -6px oklch(0 0 0 / 0.6), 0 0 18px -4px ${meta.color}`,
      padding: "10px 12px",
      display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 10,
      alignItems: "start",
      pointerEvents: "auto",
      animation: "toastIn 0.32s cubic-bezier(0.16, 1, 0.3, 1)",
      position: "relative",
      overflow: "hidden",
    }}>
      <span style={{
        width: 26, height: 26, borderRadius: 3,
        background: "var(--bg-2)", border: `1px solid ${meta.color}`,
        color: meta.color,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700,
        flexShrink: 0,
      }}>{meta.icon}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 9.5, fontWeight: 600,
            letterSpacing: 0.1, color: meta.color,
          }}>{meta.label}</span>
          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-bright)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
          <span className="mono" style={{ marginLeft: "auto", fontSize: 9.5, color: "var(--text-dim)", flexShrink: 0 }}>{t.ts}</span>
        </div>
        {t.body && (
          <div style={{ fontSize: 11, color: "var(--text-mid)", marginTop: 3, lineHeight: 1.45 }}>{t.body}</div>
        )}
        {t.meta && (
          <div className="mono" style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 3 }}>{t.meta}</div>
        )}
      </div>
      <button onClick={onClose} style={{
        background: "transparent", border: "none", color: "var(--text-dim)",
        cursor: "pointer", fontSize: 13, padding: 2, lineHeight: 1,
      }}>✕</button>

      {/* progress bar at bottom */}
      <div style={{
        position: "absolute", bottom: 0, left: 0,
        height: 1.5, background: meta.color,
        animation: `toastBar ${t.duration}ms linear forwards`,
        opacity: 0.6,
      }} />
    </div>
  );
}

/* Keyframes */
if (typeof document !== "undefined" && !document.getElementById("__toast_kf")) {
  const s = document.createElement("style");
  s.id = "__toast_kf";
  s.textContent = `
    @keyframes toastIn {
      0% { transform: translateX(20px) scale(0.96); opacity: 0; }
      100% { transform: translateX(0) scale(1); opacity: 1; }
    }
    @keyframes toastBar {
      0% { width: 100%; }
      100% { width: 0%; }
    }
  `;
  document.head.appendChild(s);
}

Object.assign(window, { ToastContainer });