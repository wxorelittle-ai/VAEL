/* cloud-sync.jsx — mirror the durable localStorage state (demo trades, champions,
 * budget, custom coins) to the backend so it survives a browser wipe or a move to
 * another device. Keyed by a per-device id; no auth.
 *
 * Safety rule: on boot we adopt the server copy ONLY when this device has no
 * meaningful local data yet (fresh browser / new device). If local data exists it
 * WINS and gets pushed up — we never clobber newer local trades with an older
 * server snapshot. Pushes are debounced (only when something actually changed).
 *
 * Dev note: on localhost there's no /api proxy, so fetches just fail quietly and
 * the app runs off localStorage as before. Set window.VAEL_API_BASE to test against
 * a real backend from localhost (CORS is open). */

(function () {
  if (typeof localStorage === "undefined") return;

  const PID_KEY = "vael.pid";
  const SYNC_FLAG = "vael.cloudSynced";   // sessionStorage — guards the boot reload
  const API_BASE = (window.VAEL_API_BASE || "/api");

  function getPid() {
    let p = null;
    try { p = localStorage.getItem(PID_KEY); } catch (_) {}
    if (!p) {
      p = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
        : "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      try { localStorage.setItem(PID_KEY, p); } catch (_) {}
    }
    return p;
  }
  const pid = getPid();
  const url = API_BASE + "/state?pid=" + encodeURIComponent(pid);

  // which keys we mirror: everything under vael.* except the device id / sync flag
  function trackedKeys() {
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf("vael.") === 0 && k !== PID_KEY && k !== SYNC_FLAG) out.push(k);
    }
    return out;
  }
  function snapshot() {
    const o = {};
    trackedKeys().forEach(k => { try { o[k] = localStorage.getItem(k); } catch (_) {} });
    return o;
  }
  // meaningful data = actual trades or champions (a lone default budget doesn't count)
  function hasLocalData() {
    return trackedKeys().some(k => k.indexOf("vael.trades.") === 0 || k === "vael.simlab.champions");
  }

  let lastPushed = JSON.stringify(snapshot());
  function push() {
    let snap, s;
    try { snap = snapshot(); s = JSON.stringify(snap); } catch (_) { return; }
    if (s === lastPushed) return;            // nothing changed → no request
    lastPushed = s;
    try {
      fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ state: snap }) })
        .catch(() => {});
    } catch (_) {}
  }

  // periodic + on-exit push
  setInterval(push, 8000);
  window.addEventListener("beforeunload", push);

  // boot pull — adopt server copy only if this device has nothing of its own
  if (!sessionStorage.getItem(SYNC_FLAG)) {
    try {
      fetch(url).then(r => r.json()).then(j => {
        try { sessionStorage.setItem(SYNC_FLAG, "1"); } catch (_) {}
        const remote = j && j.state;
        const hasRemote = remote && typeof remote === "object" && Object.keys(remote).length > 0;
        if (hasRemote && !hasLocalData()) {
          Object.keys(remote).forEach(k => { try { localStorage.setItem(k, remote[k]); } catch (_) {} });
          lastPushed = JSON.stringify(snapshot());
          location.reload();                 // remount so components read the restored data
        }
      }).catch(() => { try { sessionStorage.setItem(SYNC_FLAG, "1"); } catch (_) {} });
    } catch (_) { try { sessionStorage.setItem(SYNC_FLAG, "1"); } catch (_) {} }
  }

  window.VAEL_CLOUD = {
    pid, push,
    pull: () => fetch(url).then(r => r.json()),
    status: () => ({ pid, tracked: trackedKeys().length, hasLocalData: hasLocalData() }),
  };
})();
