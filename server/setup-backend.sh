#!/usr/bin/env bash
# One-shot backend bring-up for VAEL. Run as root on the server:
#   cd /var/www/vael && git pull && bash server/setup-backend.sh
set -e
echo "== VAEL backend setup =="

# 1. Node 18+ (native fetch). Install via nodesource if missing.
if ! command -v node >/dev/null 2>&1; then
  echo "Node not found — installing Node 20 (nodesource)…"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
NODE_BIN="$(command -v node)"
echo "node: $NODE_BIN ($(node -v))"

# 2. Install the systemd unit, pointing ExecStart at the real node path.
sed "s#/usr/bin/node#${NODE_BIN}#" /var/www/vael/server/vael-api.service \
  > /etc/systemd/system/vael-api.service

# 3. Enable + (re)start the service.
systemctl daemon-reload
systemctl enable vael-api >/dev/null 2>&1 || true
systemctl restart vael-api
sleep 2

# 4. Verify.
echo "--- service status ---"
systemctl --no-pager --lines=5 status vael-api || true
echo "--- local health (127.0.0.1:8787) ---"
curl -s http://127.0.0.1:8787/api/health || echo "(no response)"
echo
echo "--- via nginx (https://vael.pro) ---"
curl -s https://vael.pro/api/health || true
echo
echo "== done — if you see {\"ok\":true,...} the backend is live =="
