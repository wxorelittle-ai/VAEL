/* onboarding.jsx — first-run account setup.
 *
 * This is a LOCAL paper-trading profile, not a real sign-up: no password, no server
 * auth, nothing leaves the device except the state sync the app already does. The
 * person names the account and sets their own starting capital; creating it wipes any
 * demo trades so the books start genuinely empty, and everything traded afterwards
 * accrues into the portfolio from that baseline. */

const ACCOUNT_LS = "vael.account";

function loadAccount() {
  try { return JSON.parse(localStorage.getItem(ACCOUNT_LS) || "null"); } catch (_) { return null; }
}
function saveAccount(acc) {
  try { localStorage.setItem(ACCOUNT_LS, JSON.stringify(acc)); } catch (_) {}
}
/* Create the account: set the starting capital and clear every demo trade so the
 * history is empty, as a new account should be. */
function createAccount({ name, startBalance }) {
  const acc = { name: (name || "Трейдер").slice(0, 32), startBalance, createdAt: Date.now() };
  try {
    Object.keys(localStorage).filter(k => k.indexOf("vael.trades.") === 0).forEach(k => localStorage.removeItem(k));
    localStorage.setItem("vael.budget", String(startBalance));
  } catch (_) {}
  saveAccount(acc);
  try { window.dispatchEvent(new Event("vael:budget")); } catch (_) {}
  return acc;
}

const START_PRESETS = [1000, 5000, 10000, 50000, 100000];

function AccountSetup({ onDone }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState(10000);
  const valid = amount >= 100 && isFinite(amount);

  function submit(e) {
    if (e) e.preventDefault();
    if (!valid) return;
    const acc = createAccount({ name: name.trim(), startBalance: Math.round(amount) });
    onDone?.(acc);
  }

  return (
    <div style={{
      height: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg-0)", padding: "var(--gap)",
    }}>
      <form onSubmit={submit} className="panel" style={{
        width: "100%", maxWidth: 460, padding: "26px 28px",
        display: "flex", flexDirection: "column", gap: 16,
        borderTop: "3px solid var(--accent)",
      }}>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent)", letterSpacing: 0.18 }}>VAEL</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: "var(--text-bright)", letterSpacing: "-0.01em", marginTop: 4 }}>
            Создание счёта
          </div>
          <div style={{ fontSize: 12, color: "var(--text-mid)", marginTop: 6, lineHeight: 1.5 }}>
            Это <b>тренировочный счёт</b>: сделки виртуальные, деньги не настоящие. Задайте стартовую
            сумму — от неё будет считаться весь ваш результат.
          </div>
        </div>

        <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 0.1 }}>Имя счёта</span>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Трейдер" maxLength={32}
            style={{
              background: "var(--bg-0)", border: "1px solid var(--line-bright)", color: "var(--text-bright)",
              fontFamily: "var(--font-mono)", fontSize: 13, padding: "8px 10px", borderRadius: 3, outline: "none",
            }} />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 0.1 }}>Стартовая сумма, $</span>
          <input type="number" value={amount} min={100} step={100}
            onChange={e => setAmount(Math.max(0, +e.target.value || 0))}
            style={{
              background: "var(--bg-0)", border: `1px solid ${valid ? "var(--line-bright)" : "var(--red)"}`,
              color: "var(--text-bright)", fontFamily: "var(--font-mono)", fontSize: 16, padding: "8px 10px",
              borderRadius: 3, outline: "none",
            }} />
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {START_PRESETS.map(v => (
              <button key={v} type="button" onClick={() => setAmount(v)} style={{
                fontFamily: "var(--font-mono)", fontSize: 10, padding: "3px 9px", borderRadius: 2, cursor: "pointer",
                background: amount === v ? "var(--accent-soft)" : "var(--bg-2)",
                color: amount === v ? "var(--accent)" : "var(--text-dim)",
                border: `1px solid ${amount === v ? "oklch(0.78 0.16 var(--accent-h) / 0.4)" : "var(--line)"}`,
              }}>${v.toLocaleString("en-US")}</button>
            ))}
          </div>
          {!valid && <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--red)" }}>минимум $100</span>}
        </label>

        <div style={{
          background: "var(--bg-2)", border: "1px dashed var(--line-bright)", borderRadius: 3,
          padding: "8px 10px", fontSize: 10.5, color: "var(--text-mid)", lineHeight: 1.5,
        }}>
          <span className="accent">↳ </span>История сделок начнётся с нуля. Каждая последующая сделка будет
          записываться и отображаться в «Портфеле».
        </div>

        <button type="submit" className="btn btn-accent" disabled={!valid} style={{ padding: "9px", fontSize: 12, opacity: valid ? 1 : 0.5 }}>
          ▸ Создать счёт{valid ? ` · $${Math.round(amount).toLocaleString("en-US")}` : ""}
        </button>
      </form>
    </div>
  );
}

Object.assign(window, { AccountSetup, loadAccount, saveAccount, createAccount, ACCOUNT_LS });
