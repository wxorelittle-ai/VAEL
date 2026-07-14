/* app.jsx — root: state, realtime simulation, routing */

const AGENT_TASKS = {
  planner:  ["Декомпозиция миссии M-2841", "Маршрутизация запроса в Research", "Оценка приоритетов очереди", "Сборка плана #14"],
  executor: ["Выполнение tool-call fetch()", "Запрос к Postgres", "Сериализация результата", "Запись в kv-store"],
  critic:   ["Верификация ответа Research", "Проверка цитат в источнике", "Перекрёстная валидация"],
  research: ["Поиск по статьям 24h", "Сбор контекста по теме L2", "RAG · k=12"],
  news:     ["Парсинг RSS · 47 источников", "Кластеризация заголовков", "Sentiment scoring"],
  onchain:  ["Сканирование блока #19421837", "Анализ whale-кошелька 0x7a2c", "Bridge transfer detection"],
  alert:    ["Проверка правил severity ≥ WARN", "Telegram dispatch", "AI explanation"],
  forecast: ["Прогноз 1h · сценарий A", "Backtest стратегии #14"],
  strategy: ["Оптимизация портфеля", "Расчёт стоп-уровней"],
  risk:     ["Risk score кластера #14", "Sigma-baseline мониторинг"],
  memory:   ["Reindex embeddings", "Сохранение фрагмента", "Knowledge graph update"],
  autofix:  ["Watchdog · мониторинг здоровья", "Idle · ожидание сбоев"],
};

function buildInitialAgents() {
  return AGENT_DEFS.map((def, i) => {
    // 9 active, 2 idle, 1 error
    let status = "active";
    if (i === 9 || i === 11) status = "idle";
    if (i === 10) status = "active"; // memory active too
    if (def.id === "autofix") status = "idle";
    if (def.id === "strategy") status = "active";

    const isActive = status === "active";
    return {
      def,
      status,
      task: pick(AGENT_TASKS[def.id]) || "—",
      confidence: isActive ? randInt(72, 96) : randInt(40, 70),
      latency: isActive ? randInt(48, 320) : randInt(200, 1200),
      tools: AGENT_DEFS.find(d => d.id === def.id) ? pick([
        ["fetch", "rag", "embed", "kg"],
        ["py", "sql", "ws", "diff"],
        ["wallet", "fetch", "rag"],
        ["fetch", "tg", "embed"],
        ["vector", "graph", "kg", "diff"],
      ]) : [],
    };
  });
}

function buildInitialMetrics() {
  return {
    activeAgents: 9,
    tasks: 2841,
    success: 94.2,
    failed: 12,
    apiCalls: 18420,
    wallets: 247,
    walletsActive: 38,
    alerts: 7,
    alertsCrit: 2,
    alertsWarn: 3,
    confidence: 87.4,
    memUse: 14.2,
    memVectors: 2.4,
    uptime: 47,
    spark1: genSpark(9, 0.04),
    spark2: genSpark(2400, 0.08),
    spark3: genSpark(94, 0.012),
    spark4: genSpark(18, 0.18, 20),
    spark5: genSpark(240, 0.06),
    spark6: genSpark(7, 0.15, 20),
    spark7: genSpark(85, 0.04),
    spark8: genSpark(14, 0.08, 20),
  };
}

function App() {
  // tweaks
  const [t, setTweak] = useTweaks(/*EDITMODE-BEGIN*/{
    "palette": "purple",
    "density": "normal",
    "speed": 1,
    "glow": true,
    "lang": "ru"
  }/*EDITMODE-END*/);

  // global app state
  const [page, setPage] = useState("dashboard");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [missionModalOpen, setMissionModalOpen] = useState(false);

  // expose openers globally so deep child components can trigger without prop drilling
  useEffect(() => {
    window.__openPalette = () => setPaletteOpen(true);
    window.__openMissionModal = () => setMissionModalOpen(true);
    window.__navTo = setPage;
  }, []);

  // ⌘K / Ctrl+K to open palette · Cmd+N for new mission
  useEffect(() => {
    const handler = (e) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setPaletteOpen(true);
      } else if (meta && (e.key === "n" || e.key === "N")) {
        e.preventDefault();
        setMissionModalOpen(true);
      } else if (meta && (e.key === "j" || e.key === "J")) {
        e.preventDefault();
        window.__openAssistant?.();
      } else if (e.key === "/" && !e.target.matches("input,textarea")) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  const [agents, setAgents] = useState(buildInitialAgents);
  const [metrics, setMetrics] = useState(buildInitialMetrics);
  const [sysStats, setSysStats] = useState({
    latency: 42, backendLoad: 64, activeAgents: 9, cpu: 38, gpu: 71, mem: 14.2,
  });
  const mission = {
    name: "M-2841 · WHALE-SCAN",
    progress: 67,
    status: "running",
  };

  // ─── apply tweaks to :root ────
  useEffect(() => {
    const root = document.documentElement;
    if (t.palette === "cyan") {
      root.style.setProperty("--accent-h", "180");
      root.style.setProperty("--accent-h2", "270");
    } else if (t.palette === "purple") {
      root.style.setProperty("--accent-h", "278");
      root.style.setProperty("--accent-h2", "292");
    } else if (t.palette === "amber") {
      root.style.setProperty("--accent-h", "60");
      root.style.setProperty("--accent-h2", "20");
    } else if (t.palette === "green") {
      root.style.setProperty("--accent-h", "150");
      root.style.setProperty("--accent-h2", "180");
    }
    root.setAttribute("data-density", t.density);
    root.setAttribute("data-glow", t.glow ? "on" : "off");
    root.style.setProperty("--speed", t.speed);
  }, [t.palette, t.density, t.speed, t.glow]);

  // ─── realtime tick: metrics ────
  useInterval(() => {
    setMetrics(prev => ({
      ...prev,
      activeAgents: Math.max(7, Math.min(12, prev.activeAgents + (Math.random() > 0.6 ? (Math.random() > 0.5 ? 1 : -1) : 0))),
      tasks: prev.tasks + randInt(1, 4),
      failed: prev.failed + (Math.random() > 0.92 ? 1 : 0),
      success: Math.max(91, Math.min(98, prev.success + (Math.random() - 0.5) * 0.4)),
      apiCalls: prev.apiCalls + randInt(20, 80),
      wallets: prev.wallets + (Math.random() > 0.7 ? 1 : 0),
      alerts: Math.max(2, Math.min(14, prev.alerts + (Math.random() > 0.85 ? 1 : Math.random() > 0.92 ? -1 : 0))),
      confidence: Math.max(76, Math.min(96, prev.confidence + (Math.random() - 0.5) * 1.2)),
      memUse: Math.max(12, Math.min(18, prev.memUse + (Math.random() - 0.5) * 0.15)),
      spark1: [...prev.spark1.slice(1), Math.max(7, Math.min(12, prev.spark1[prev.spark1.length-1] + (Math.random() - 0.5) * 0.4))],
      spark2: [...prev.spark2.slice(1), prev.spark2[prev.spark2.length-1] + (Math.random() - 0.3) * 80],
      spark3: [...prev.spark3.slice(1), Math.max(88, Math.min(98, prev.spark3[prev.spark3.length-1] + (Math.random() - 0.5) * 0.5))],
      spark4: [...prev.spark4.slice(1), Math.max(8, prev.spark4[prev.spark4.length-1] + (Math.random() - 0.5) * 3)],
      spark5: [...prev.spark5.slice(1), prev.spark5[prev.spark5.length-1] + (Math.random() - 0.4) * 8],
      spark6: [...prev.spark6.slice(1), Math.max(2, Math.min(14, prev.spark6[prev.spark6.length-1] + (Math.random() - 0.5) * 1.5))],
      spark7: [...prev.spark7.slice(1), Math.max(76, Math.min(96, prev.spark7[prev.spark7.length-1] + (Math.random() - 0.5) * 1.4))],
      spark8: [...prev.spark8.slice(1), Math.max(12, Math.min(18, prev.spark8[prev.spark8.length-1] + (Math.random() - 0.5) * 0.3))],
    }));
  }, 1600);

  // ─── realtime tick: agents (occasional state change, confidence drift, task swap) ───
  useInterval(() => {
    setAgents(prev => prev.map(a => {
      const r = Math.random();
      let next = { ...a };
      if (r < 0.06) {
        // toggle status occasionally between idle and active for non-critical
        if (a.def.id !== "planner" && a.def.id !== "memory") {
          next.status = a.status === "active" ? "idle" : "active";
        }
      }
      next.confidence = Math.max(40, Math.min(98,
        a.confidence + (Math.random() - 0.5) * 4
      ));
      next.latency = Math.max(40, Math.min(1400,
        a.latency + Math.floor((Math.random() - 0.5) * 60)
      ));
      if (r > 0.85) {
        next.task = pick(AGENT_TASKS[a.def.id]) || a.task;
      }
      return next;
    }));
  }, 2400);

  // ─── system stats tick ────
  useInterval(() => {
    setSysStats(prev => ({
      latency: Math.max(28, Math.min(120, prev.latency + Math.floor((Math.random() - 0.5) * 12))),
      backendLoad: Math.max(40, Math.min(92, prev.backendLoad + Math.floor((Math.random() - 0.5) * 8))),
      activeAgents: agents.filter(a => a.status === "active").length,
      cpu: Math.max(20, Math.min(85, prev.cpu + Math.floor((Math.random() - 0.5) * 6))),
      gpu: Math.max(50, Math.min(95, prev.gpu + Math.floor((Math.random() - 0.5) * 4))),
      mem: Math.max(11, Math.min(18, +(prev.mem + (Math.random() - 0.5) * 0.2).toFixed(1))),
    }));
  }, 2000);

  // ─── route ────
  const renderPage = () => {
    switch (page) {
      case "dashboard": return <DashboardPage agents={agents} metrics={metrics} lang={t.lang} mission={mission} />;
      case "brain":     return <BrainPage lang={t.lang} />;
      case "portfolio": return <PortfolioPage lang={t.lang} />;
      case "smart":     return <SmartMoneyPage lang={t.lang} />;
      case "agents":    return <AgentsPage agents={agents} lang={t.lang} />;
      case "missions":  return <MissionsPage lang={t.lang} />;
      case "scenarios": return <ScenariosPage lang={t.lang} />;
      case "opps":      return <OpportunitiesPage lang={t.lang} />;
      case "pairs":     return <PairTradingPage lang={t.lang} />;
      case "daily":     return <DailyAgentPage lang={t.lang} />;
      case "memory":    return <MemoryPageEnhanced lang={t.lang} />;
      case "analytics": return <AnalyticsPageEnhanced lang={t.lang} />;
      case "analyst":   return <AnalystPage lang={t.lang} />;
      case "airdrops":  return <AirdropRadarPage lang={t.lang} />;
      case "freedrops": return <FreeAirdropsPage lang={t.lang} />;
      case "watchlist": return <WatchlistPage lang={t.lang} />;
      case "alerts":    return <AlertsPage lang={t.lang} />;
      case "reports":   return <ReportsPage lang={t.lang} />;
      case "settings":  return <SettingsPage lang={t.lang} />;
      default: return <DashboardPage agents={agents} metrics={metrics} lang={t.lang} mission={mission} />;
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Sidebar active={page} onNav={setPage} lang={t.lang} sysStats={sysStats} />
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        <TopBar lang={t.lang} mission={mission} sysStats={sysStats} onSearch={() => setPaletteOpen(true)} />
        <NewsHost />
        <div key={page} style={{ flex: 1, overflow: "hidden", minHeight: 0, animation: "pageIn 0.22s ease-out" }}>
          {renderPage()}
        </div>
      </main>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNav={setPage}
        openMissionModal={() => setMissionModalOpen(true)}
        lang={t.lang}
      />
      <MissionModal
        open={missionModalOpen}
        onClose={() => setMissionModalOpen(false)}
        lang={t.lang}
      />

      <ToastContainer />
      <AssistantChat />
      <CoPilot />

      <TweaksPanel title="Tweaks · Интерфейс">
        <TweakSection label="Палитра">
          <TweakRadio
            label="Акцент" value={t.palette}
            options={[
              { value: "purple", label: "Nexus" },
              { value: "cyan",   label: "Cyan" },
              { value: "amber",  label: "Янтарь" },
              { value: "green",  label: "Зелёный" },
            ]}
            onChange={v => setTweak("palette", v)}
          />
        </TweakSection>
        <TweakSection label="Плотность">
          <TweakRadio
            label="Layout" value={t.density}
            options={[
              { value: "compact",  label: "Плотно" },
              { value: "normal",   label: "Норм" },
              { value: "spacious", label: "Просторно" },
            ]}
            onChange={v => setTweak("density", v)}
          />
        </TweakSection>
        <TweakSection label="Realtime">
          <TweakSlider label="Скорость" value={t.speed}
            min={0.25} max={2.5} step={0.05} unit="×"
            onChange={v => setTweak("speed", v)} />
        </TweakSection>
        <TweakSection label="Эффекты">
          <TweakToggle label="Свечение / glow" value={t.glow}
            onChange={v => setTweak("glow", v)} />
        </TweakSection>
        <TweakSection label="Язык">
          <TweakRadio
            label="UI язык" value={t.lang}
            options={[
              { value: "ru", label: "Русский" },
              { value: "en", label: "English" },
            ]}
            onChange={v => setTweak("lang", v)}
          />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);