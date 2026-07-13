# V6 Agent Network — Центр управления

## Запуск

Нужен любой локальный HTTP-сервер (браузер блокирует загрузку .jsx файлов через file://).

### Вариант 1 — Node.js
```bash
npx serve .
```
Открыть http://localhost:3000

### Вариант 2 — Python
```bash
python3 -m http.server 8080
```
Открыть http://localhost:8080

### Вариант 3 — VS Code
Установить расширение "Live Server", нажать "Go Live".

## Структура файлов

| Файл | Назначение |
|------|-----------|
| `index.html` | Точка входа, глобальные стили, подключение скриптов |
| `tweaks-panel.jsx` | Панель настроек UI (палитра, плотность, скорость) |
| `widgets.jsx` | Базовые компоненты: Sparkline, Ring, AgentCard, LogLine, NetworkGraph |
| `layout.jsx` | Sidebar + TopBar |
| `dashboard.jsx` | Главная страница: метрики, терминал, алерты, миссии |
| `crypto.jsx` | Торговый терминал: свечи, сигналы, позиции |
| `pages.jsx` | Страницы: Агенты, Миссии, Память, Аналитика, Watchlist, Алерты, Отчёты, Настройки |
| `extras.jsx` | Command Palette (⌘K), Mission Modal, расширенная аналитика |
| `notifications.jsx` | Toast-уведомления |
| `tools.jsx` | Drawer, детали кошелька, бэктест |
| `news.jsx` | Новостной тикер + drawer |
| `alert-rules.jsx` | Панель правил алертов |
| `strategy-studio.jsx` | Конструктор стратегий |
| `agent-live.jsx` | Live-детали агента + leaderboard |
| `scenarios.jsx` | Сценарный анализ (what-if) |
| `memory-graph.jsx` | Граф знаний + расширенная страница Memory |
| `opportunities.jsx` | Возможности: airdrops, presales, scam-scan |
| `copilot.jsx` | AI Co-Pilot (проактивные подсказки) |
| `portfolio.jsx` | Страница портфеля |
| `smart-money.jsx` | Smart Money: топ кошельки, copy-трейдинг |
| `actions.jsx` | Quick Actions панель |
| `assistant.jsx` | AI-ассистент V6 (чат с Claude) |
| `app.jsx` | Корневой компонент: роутинг, realtime-тики, state |

## Горячие клавиши

| Клавиша | Действие |
|---------|----------|
| `⌘K` / `Ctrl+K` | Command Palette |
| `⌘N` / `Ctrl+N` | Новая миссия |
| `⌘J` / `Ctrl+J` | AI-ассистент |
| `/` | Command Palette |

## Данные

Все данные — симуляция. Реальный API-запрос только один: AI-ассистент использует Claude через `window.claude.complete()`.
