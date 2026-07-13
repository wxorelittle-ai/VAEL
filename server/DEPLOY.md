# VAEL backend — deploy on the Ubuntu server

Tiny zero-dependency Node service. Serves real crypto news (RSS aggregation) at
`/api/news`, plus an optional Claude proxy at `/api/assistant`. Sits behind nginx
on `127.0.0.1:8787`; the browser calls `/api/*` on the same origin (no CORS).

## 1. Node.js (once)
```bash
node -v || (curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt install -y nodejs)
```

## 2. Install the service
The code ships in the repo under `server/`. After `git pull`:
```bash
cp /var/www/vael/server/vael-api.service /etc/systemd/system/vael-api.service
systemctl daemon-reload
systemctl enable --now vael-api
systemctl status vael-api --no-pager     # should say active (running)
curl -s http://127.0.0.1:8787/api/health # {"ok":true,...}
```

## 3. nginx → proxy /api to the node service
Add this INSIDE the existing `server { ... }` block in
`/etc/nginx/sites-available/vael` (above the `location / {...}` line):
```nginx
    location /api/ {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
```
Then:
```bash
nginx -t && systemctl reload nginx
curl -s http://ВАШ_IP/api/health   # {"ok":true}
```

## 4. Update after code changes
```bash
cd /var/www/vael && git pull
systemctl restart vael-api
```

## Optional — real AI assistant (Claude)
Put your key in the service and restart:
```bash
systemctl edit vael-api      # add:  [Service]\nEnvironment=ANTHROPIC_API_KEY=sk-ant-...
systemctl restart vael-api
```
Then `/api/assistant?q=...` returns a grounded answer. The frontend assistant can
be pointed at it later (currently it runs the deterministic on-device analyst).
