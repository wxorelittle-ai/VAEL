/* strategy-studio.jsx — Visual strategy builder for AI trading signals */

const SOURCE_TYPES = [
  { id: "price",   ru: "Цена и объём",         icon: "$",  desc: "Свечи, OHLCV, объём" },
  { id: "onchain", ru: "On-chain поток",       icon: "⬢",  desc: "Whale transfers, exchange flows" },
  { id: "news",    ru: "Новостной фид",        icon: "▤",  desc: "Sentiment, headlines, NER" },
  { id: "agent",   ru: "Агент-сигнал",         icon: "◆",  desc: "Strategy / Forecast / Risk agents" },
  { id: "social",  ru: "Социальный сигнал",    icon: "❉",  desc: "TG, X (Twitter), Reddit metrics" },
];

const INDICATOR_TYPES = [
  { id: "ema",        ru: "EMA (скользящая)",     params: ["period"], defaults: { period: 50 } },
  { id: "rsi",        ru: "RSI",                  params: ["period"], defaults: { period: 14 } },
  { id: "macd",       ru: "MACD",                 params: ["fast", "slow"], defaults: { fast: 12, slow: 26 } },
  { id: "supertrend", ru: "Supertrend",           params: ["factor", "atr"], defaults: { factor: 3, atr: 10 } },
  { id: "stochrsi",   ru: "Stoch RSI",            params: ["rsi", "stoch"], defaults: { rsi: 14, stoch: 14 } },
  { id: "dmi",        ru: "DMI / ADX",            params: ["period"], defaults: { period: 14 } },
  { id: "bb",         ru: "Bollinger Bands",      params: ["period", "mult"], defaults: { period: 20, mult: 2 } },
  { id: "cci",        ru: "CCI",                  params: ["period"], defaults: { period: 20 } },
  { id: "psar",       ru: "Parabolic SAR",        params: ["step", "max"], defaults: { step: 0.02, max: 0.2 } },
  { id: "ao",         ru: "Awesome Osc.",         params: ["fast", "slow"], defaults: { fast: 5, slow: 34 } },
  { id: "ichimoku",   ru: "Ichimoku Cloud",       params: ["conv", "base"], defaults: { conv: 9, base: 26 } },
  { id: "stoch",      ru: "Stochastic",           params: ["length", "smooth"], defaults: { length: 14, smooth: 3 } },
  { id: "willr",      ru: "Williams %R",          params: ["period"], defaults: { period: 14 } },
  { id: "mfi",        ru: "MFI (Money Flow)",     params: ["period"], defaults: { period: 14 } },
  { id: "keltner",    ru: "Keltner Channels",     params: ["period", "mult"], defaults: { period: 20, mult: 2 } },
  { id: "donchian",   ru: "Donchian Channels",    params: ["period"], defaults: { period: 20 } },
  { id: "obv",        ru: "OBV (объём)",          params: [],         defaults: {} },
  { id: "roc",        ru: "ROC (momentum)",       params: ["period"], defaults: { period: 12 } },
  { id: "aroon",      ru: "Aroon",                params: ["period"], defaults: { period: 25 } },
  { id: "vortex",     ru: "Vortex",               params: ["period"], defaults: { period: 14 } },
  { id: "trix",       ru: "TRIX",                 params: ["period"], defaults: { period: 15 } },
  { id: "cmf",        ru: "Chaikin MF",           params: ["period"], defaults: { period: 20 } },
  { id: "uo",         ru: "Ultimate Osc.",        params: ["s1", "s2"], defaults: { s1: 7, s2: 14 } },
  { id: "fisher",     ru: "Fisher Transform",     params: ["period"], defaults: { period: 9 } },
  { id: "elder",      ru: "Elder Ray",            params: ["period"], defaults: { period: 13 } },
  { id: "ppo",        ru: "PPO",                  params: ["fast", "slow"], defaults: { fast: 12, slow: 26 } },
  { id: "patterns",   ru: "Свечные паттерны",     params: [],         defaults: {} },
  { id: "vwap",       ru: "VWAP",                 params: [],         defaults: {} },
  { id: "vol",        ru: "Volume Profile",       params: ["window"], defaults: { window: 24 } },
  { id: "atr",        ru: "ATR (волатильность)",  params: ["period"], defaults: { period: 14 } },
];

/* Ready-made strategy templates — entry/exit logic ported (not source; MPL-2.0
 * originals) from the Alorse/pinescript-strategies TradingView library. One click
 * loads a full strategy into the wizard and live-backtests it on Bybit candles.
 * The engine (analyzeMarket) already fuses Supertrend + RSI + MACD confluence, so
 * these presets shape side / confidence / exits around proven rule sets. */
const STRATEGY_PRESETS = [
  {
    key: "st_rsi",
    title: "Supertrend + RSI",
    tag: "тренд",
    desc: "Вход по тренду Supertrend, когда RSI пробивает 50. Выход по перекупу или смене Supertrend.",
    build: () => ({
      ...makeNewStrategy(),
      name: "Supertrend + RSI · 1h",
      sources: ["price"],
      indicators: [
        { uid: "st01", id: "supertrend", params: { factor: 3, atr: 10 } },
        { uid: "rs01", id: "rsi", params: { period: 14 } },
      ],
      side: "buy", minConfidence: 75,
      entry: [
        { uid: "e1", left: "supertrend", op: "gt", right: "value", rightValue: 0, connector: null },
        { uid: "e2", left: "rsi", op: "cross_above", right: "value", rightValue: 50, connector: "AND" },
      ],
      exit: { type: "tp_sl", tp: 4, sl: 2, trailing: 1.5, candles: 24 },
      sizing: "pct",
    }),
  },
  {
    key: "stochrsi_st",
    title: "StochRSI + Supertrend + EMA200",
    tag: "импульс",
    desc: "Цена выше EMA200, Supertrend вверх, StochRSI K пересекает D из зоны <20. Ранний вход по тренду.",
    build: () => ({
      ...makeNewStrategy(),
      name: "StochRSI + ST + EMA200",
      sources: ["price"],
      indicators: [
        { uid: "em01", id: "ema", params: { period: 200 } },
        { uid: "st02", id: "supertrend", params: { factor: 2, atr: 11 } },
        { uid: "sr01", id: "stochrsi", params: { rsi: 14, stoch: 14 } },
      ],
      side: "buy", minConfidence: 78,
      entry: [
        { uid: "e1", left: "price", op: "gt", right: "em01", connector: null },
        { uid: "e2", left: "st02", op: "gt", right: "value", rightValue: 0, connector: "AND" },
        { uid: "e3", left: "sr01", op: "cross_above", right: "value", rightValue: 20, connector: "AND" },
      ],
      exit: { type: "signal", tp: 5, sl: 2.5, trailing: 1.5, candles: 24 },
      sizing: "pct",
    }),
  },
  {
    key: "double_st",
    title: "Double Supertrend",
    tag: "тренд",
    desc: "Два Supertrend с разными факторами. Вход при согласии обоих — фильтрует ложные развороты.",
    build: () => ({
      ...makeNewStrategy(),
      name: "Double Supertrend · 1h",
      sources: ["price"],
      indicators: [
        { uid: "st03", id: "supertrend", params: { factor: 3, atr: 10 } },
        { uid: "st04", id: "supertrend", params: { factor: 1, atr: 10 } },
      ],
      side: "both", minConfidence: 80,
      entry: [
        { uid: "e1", left: "st03", op: "gt", right: "value", rightValue: 0, connector: null },
        { uid: "e2", left: "st04", op: "gt", right: "value", rightValue: 0, connector: "AND" },
      ],
      exit: { type: "trailing", tp: 6, sl: 3, trailing: 2, candles: 24 },
      sizing: "pct",
    }),
  },
  {
    key: "macd_bb_rsi",
    title: "MACD + BB + RSI",
    tag: "импульс",
    desc: "Классический трио-фильтр: импульс MACD + возврат от полос Боллинджера + подтверждение RSI.",
    build: () => ({
      ...makeNewStrategy(),
      name: "MACD + BB + RSI",
      sources: ["price"],
      indicators: [
        { uid: "mc01", id: "macd", params: { fast: 12, slow: 26 } },
        { uid: "rs02", id: "rsi", params: { period: 14 } },
        { uid: "at01", id: "atr", params: { period: 14 } },
      ],
      side: "buy", minConfidence: 76,
      entry: [
        { uid: "e1", left: "mc01", op: "cross_above", right: "value", rightValue: 0, connector: null },
        { uid: "e2", left: "rs02", op: "gt", right: "value", rightValue: 50, connector: "AND" },
      ],
      exit: { type: "tp_sl", tp: 4.5, sl: 2, trailing: 1.5, candles: 20 },
      sizing: "pct",
    }),
  },
  {
    key: "dmi_trend",
    title: "DMI Winner (ADX-фильтр)",
    tag: "тренд",
    desc: "Торговать только сильный тренд: ADX>20 и +DI над −DI. Отсекает боковик и пилу.",
    build: () => ({
      ...makeNewStrategy(),
      name: "DMI Winner · ADX>20",
      sources: ["price"],
      indicators: [
        { uid: "dm01", id: "dmi", params: { period: 14 } },
        { uid: "em02", id: "ema", params: { period: 50 } },
      ],
      side: "buy", minConfidence: 77,
      entry: [
        { uid: "e1", left: "dm01", op: "gt", right: "value", rightValue: 20, connector: null },
        { uid: "e2", left: "price", op: "gt", right: "em02", connector: "AND" },
      ],
      exit: { type: "tp_sl", tp: 5, sl: 2.5, trailing: 2, candles: 24 },
      sizing: "pct",
    }),
  },
  {
    key: "bb_rsi",
    title: "Bollinger + RSI (возврат к среднему)",
    tag: "возврат",
    desc: "Mean-reversion: лонг, когда цена проваливается под нижнюю полосу Боллинджера при RSI<30. Выход у перекупа.",
    build: () => ({
      ...makeNewStrategy(),
      name: "Bollinger + RSI · MR",
      sources: ["price"],
      indicators: [
        { uid: "bb01", id: "bb", params: { period: 20, mult: 2 } },
        { uid: "rs03", id: "rsi", params: { period: 14 } },
      ],
      side: "buy", minConfidence: 70,
      entry: [
        { uid: "e1", left: "price", op: "lt", right: "bb01", connector: null },
        { uid: "e2", left: "rs03", op: "lt", right: "value", rightValue: 30, connector: "AND" },
      ],
      exit: { type: "tp_sl", tp: 5, sl: 4, trailing: 2, candles: 24 },
      sizing: "pct",
    }),
  },
  {
    key: "bb_breakout",
    title: "Bollinger Breakout",
    tag: "пробой",
    desc: "Пробой: вход, когда цена закрывается выше верхней полосы и держится над EMA50. Ловит выход из сжатия.",
    build: () => ({
      ...makeNewStrategy(),
      name: "Bollinger Breakout · 1h",
      sources: ["price"],
      indicators: [
        { uid: "bb02", id: "bb", params: { period: 20, mult: 2 } },
        { uid: "em03", id: "ema", params: { period: 50 } },
      ],
      side: "both", minConfidence: 76,
      entry: [
        { uid: "e1", left: "price", op: "cross_above", right: "bb02", connector: null },
        { uid: "e2", left: "price", op: "gt", right: "em03", connector: "AND" },
      ],
      exit: { type: "trailing", tp: 6, sl: 3, trailing: 2, candles: 24 },
      sizing: "pct",
    }),
  },
  {
    key: "cci_rev",
    title: "CCI Reversal",
    tag: "возврат",
    desc: "Лонг из перепроданности: CCI ниже −100 при цене над EMA50 (тренд вверх, откуп отката).",
    build: () => ({
      ...makeNewStrategy(),
      name: "CCI Reversal · 1h",
      sources: ["price"],
      indicators: [
        { uid: "cc01", id: "cci", params: { period: 20 } },
        { uid: "em04", id: "ema", params: { period: 50 } },
      ],
      side: "buy", minConfidence: 72,
      entry: [
        { uid: "e1", left: "cc01", op: "lt", right: "value", rightValue: -100, connector: null },
        { uid: "e2", left: "price", op: "gt", right: "em04", connector: "AND" },
      ],
      exit: { type: "tp_sl", tp: 5, sl: 3, trailing: 2, candles: 24 },
      sizing: "pct",
    }),
  },
  {
    key: "psar_trend",
    title: "Parabolic SAR Trend",
    tag: "тренд",
    desc: "Трейлинг по тренду: SAR под ценой (аптренд) + подтверждение над EMA50. Выход по трейлинг-стопу.",
    build: () => ({
      ...makeNewStrategy(),
      name: "Parabolic SAR Trend · 1h",
      sources: ["price"],
      indicators: [
        { uid: "ps01", id: "psar", params: { step: 0.02, max: 0.2 } },
        { uid: "em05", id: "ema", params: { period: 50 } },
      ],
      side: "both", minConfidence: 76,
      entry: [
        { uid: "e1", left: "price", op: "gt", right: "ps01", connector: null },
        { uid: "e2", left: "price", op: "gt", right: "em05", connector: "AND" },
      ],
      exit: { type: "trailing", tp: 6, sl: 3, trailing: 2, candles: 24 },
      sizing: "pct",
    }),
  },
  {
    key: "ichimoku_trend",
    title: "Ichimoku Trend",
    tag: "тренд",
    desc: "Лонг, когда цена над облаком Ичимоку и Tenkan выше Kijun. Сильный трендовый фильтр.",
    build: () => ({
      ...makeNewStrategy(),
      name: "Ichimoku Trend · 1h",
      sources: ["price"],
      indicators: [
        { uid: "ic01", id: "ichimoku", params: { conv: 9, base: 26 } },
      ],
      side: "buy", minConfidence: 78,
      entry: [
        { uid: "e1", left: "price", op: "gt", right: "ic01", connector: null },
        { uid: "e2", left: "ic01", op: "gt", right: "value", rightValue: 0, connector: "AND" },
      ],
      exit: { type: "trailing", tp: 6, sl: 3, trailing: 2, candles: 26 },
      sizing: "pct",
    }),
  },
  {
    key: "stoch_rev",
    title: "Stochastic Reversal",
    tag: "возврат",
    desc: "Разворот из перепроданности: %K пересекает %D снизу в зоне <20, цена над EMA50.",
    build: () => ({
      ...makeNewStrategy(),
      name: "Stochastic Reversal · 1h",
      sources: ["price"],
      indicators: [
        { uid: "sc01", id: "stoch", params: { length: 14, smooth: 3 } },
        { uid: "em06", id: "ema", params: { period: 50 } },
      ],
      side: "buy", minConfidence: 72,
      entry: [
        { uid: "e1", left: "sc01", op: "cross_above", right: "value", rightValue: 20, connector: null },
        { uid: "e2", left: "price", op: "gt", right: "em06", connector: "AND" },
      ],
      exit: { type: "tp_sl", tp: 5, sl: 3, trailing: 2, candles: 24 },
      sizing: "pct",
    }),
  },
  {
    key: "donchian_bo",
    title: "Donchian Breakout (Turtle)",
    tag: "пробой",
    desc: "Черепашья классика: вход при пробое 20-периодного максимума канала Дончиана над EMA50.",
    build: () => ({
      ...makeNewStrategy(),
      name: "Donchian Breakout · Turtle",
      sources: ["price"],
      indicators: [
        { uid: "dc01", id: "donchian", params: { period: 20 } },
        { uid: "em07", id: "ema", params: { period: 50 } },
      ],
      side: "both", minConfidence: 76,
      entry: [
        { uid: "e1", left: "price", op: "cross_above", right: "dc01", connector: null },
        { uid: "e2", left: "price", op: "gt", right: "em07", connector: "AND" },
      ],
      exit: { type: "trailing", tp: 7, sl: 3, trailing: 2.5, candles: 26 },
      sizing: "pct",
    }),
  },
  {
    key: "keltner_squeeze",
    title: "Keltner Squeeze Breakout",
    tag: "пробой",
    desc: "TTM-идея: Bollinger сжимается внутри Keltner (низкая волатильность) → вход на пробое верхней полосы Keltner.",
    build: () => ({
      ...makeNewStrategy(),
      name: "Keltner Squeeze · BO",
      sources: ["price"],
      indicators: [
        { uid: "kc01", id: "keltner", params: { period: 20, mult: 2 } },
        { uid: "bb03", id: "bb", params: { period: 20, mult: 2 } },
        { uid: "em08", id: "ema", params: { period: 50 } },
      ],
      side: "buy", minConfidence: 77,
      entry: [
        { uid: "e1", left: "price", op: "cross_above", right: "kc01", connector: null },
        { uid: "e2", left: "price", op: "gt", right: "em08", connector: "AND" },
      ],
      exit: { type: "trailing", tp: 6, sl: 3, trailing: 2, candles: 24 },
      sizing: "pct",
    }),
  },
  {
    key: "aroon_trend",
    title: "Aroon Trend",
    tag: "тренд",
    desc: "Сильный тренд: Aroon Up выше 70 и над Aroon Down, цена над EMA50. Ранний вход в свежий импульс.",
    build: () => ({
      ...makeNewStrategy(),
      name: "Aroon Trend · 1h",
      sources: ["price"],
      indicators: [
        { uid: "ar01", id: "aroon", params: { period: 25 } },
        { uid: "em09", id: "ema", params: { period: 50 } },
      ],
      side: "buy", minConfidence: 75,
      entry: [
        { uid: "e1", left: "ar01", op: "gt", right: "value", rightValue: 70, connector: null },
        { uid: "e2", left: "price", op: "gt", right: "em09", connector: "AND" },
      ],
      exit: { type: "trailing", tp: 6, sl: 3, trailing: 2, candles: 26 },
      sizing: "pct",
    }),
  },
  {
    key: "vortex_cross",
    title: "Vortex Cross",
    tag: "тренд",
    desc: "Старт тренда: VI+ пересекает VI− снизу вверх при подтверждении ценой над EMA50.",
    build: () => ({
      ...makeNewStrategy(),
      name: "Vortex Cross · 1h",
      sources: ["price"],
      indicators: [
        { uid: "vx01", id: "vortex", params: { period: 14 } },
        { uid: "em10", id: "ema", params: { period: 50 } },
      ],
      side: "both", minConfidence: 76,
      entry: [
        { uid: "e1", left: "vx01", op: "cross_above", right: "value", rightValue: 1, connector: null },
        { uid: "e2", left: "price", op: "gt", right: "em10", connector: "AND" },
      ],
      exit: { type: "tp_sl", tp: 5, sl: 3, trailing: 2, candles: 24 },
      sizing: "pct",
    }),
  },
  {
    key: "uo_rev",
    title: "Ultimate Oscillator Reversal",
    tag: "возврат",
    desc: "Мультитаймфрейм-разворот: UO ниже 30 (перепроданность) при цене над EMA50 — откуп в тренде.",
    build: () => ({
      ...makeNewStrategy(),
      name: "Ultimate Osc. Reversal · 1h",
      sources: ["price"],
      indicators: [
        { uid: "uo01", id: "uo", params: { s1: 7, s2: 14 } },
        { uid: "em11", id: "ema", params: { period: 50 } },
      ],
      side: "buy", minConfidence: 72,
      entry: [
        { uid: "e1", left: "uo01", op: "lt", right: "value", rightValue: 30, connector: null },
        { uid: "e2", left: "price", op: "gt", right: "em11", connector: "AND" },
      ],
      exit: { type: "tp_sl", tp: 5, sl: 3, trailing: 2, candles: 24 },
      sizing: "pct",
    }),
  },
  {
    key: "fisher_rev",
    title: "Fisher Transform Reversal",
    tag: "возврат",
    desc: "Резкий разворот: Fisher пересекает 0 снизу вверх из перепроданности при цене над EMA50.",
    build: () => ({
      ...makeNewStrategy(),
      name: "Fisher Reversal · 1h",
      sources: ["price"],
      indicators: [
        { uid: "fs01", id: "fisher", params: { period: 9 } },
        { uid: "em12", id: "ema", params: { period: 50 } },
      ],
      side: "buy", minConfidence: 73,
      entry: [
        { uid: "e1", left: "fs01", op: "cross_above", right: "value", rightValue: 0, connector: null },
        { uid: "e2", left: "price", op: "gt", right: "em12", connector: "AND" },
      ],
      exit: { type: "tp_sl", tp: 5, sl: 3, trailing: 2, candles: 24 },
      sizing: "pct",
    }),
  },
  {
    key: "candle_rev",
    title: "Candle Reversal + RSI",
    tag: "возврат",
    desc: "Бычий свечной разворот (Молот / Бычье поглощение) при RSI<40 и цене над EMA50 — вход по подтверждённому развороту.",
    build: () => ({
      ...makeNewStrategy(),
      name: "Candle Reversal + RSI · 1h",
      sources: ["price"],
      indicators: [
        { uid: "pt01", id: "patterns", params: {} },
        { uid: "rs04", id: "rsi", params: { period: 14 } },
        { uid: "em13", id: "ema", params: { period: 50 } },
      ],
      side: "buy", minConfidence: 73,
      entry: [
        { uid: "e1", left: "pt01", op: "gt", right: "value", rightValue: 0, connector: null },
        { uid: "e2", left: "rs04", op: "lt", right: "value", rightValue: 40, connector: "AND" },
        { uid: "e3", left: "price", op: "gt", right: "em13", connector: "AND" },
      ],
      exit: { type: "tp_sl", tp: 5, sl: 3, trailing: 2, candles: 24 },
      sizing: "pct",
    }),
  },
];

const COND_OPS = [
  { id: "cross_above", ru: "пересекает сверху" },
  { id: "cross_below", ru: "пересекает снизу" },
  { id: "gt",          ru: ">" },
  { id: "lt",          ru: "<" },
  { id: "between",     ru: "в диапазоне" },
];

const EXIT_TYPES = [
  { id: "tp_sl",    ru: "Take Profit + Stop Loss" },
  { id: "trailing", ru: "Trailing Stop" },
  { id: "time",     ru: "Через N свечей" },
  { id: "signal",   ru: "Обратный сигнал" },
];

function StrategyStudio({ open, onClose, asset, lang, onSave }) {
  const [step, setStep] = useState(0); // 0..4
  const [strategy, setStrategy] = useState(() => makeNewStrategy());
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep(0);
      setStrategy(makeNewStrategy());
      setRunning(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const stepsConfig = [
    { id: 0, label: "1. ИСТОЧНИК", valid: () => strategy.sources.length > 0 },
    { id: 1, label: "2. ИНДИКАТОРЫ", valid: () => strategy.indicators.length > 0 },
    { id: 2, label: "3. ВХОД", valid: () => strategy.entry.length > 0 },
    { id: 3, label: "4. ВЫХОД", valid: () => strategy.exit !== null },
    { id: 4, label: "5. ОБЗОР", valid: () => strategy.name.trim().length > 0 },
  ];

  const canAdvance = stepsConfig[step].valid();

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0,
      background: "oklch(0 0 0 / 0.6)",
      backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
      zIndex: 9988,
      display: "flex", alignItems: "center", justifyContent: "center",
      animation: "cpFade 0.18s ease-out",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "min(1100px, 95vw)", height: "min(720px, 92vh)",
        background: "var(--bg-1)",
        border: "1px solid var(--line-bright)",
        borderRadius: 8,
        boxShadow: "0 24px 60px -12px oklch(0 0 0 / 0.7), var(--glow-strong)",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        animation: "cpScale 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
      }}>
        {/* HEADER */}
        <header style={{
          padding: "12px 18px",
          borderBottom: "1px solid var(--line)",
          background: "var(--bg-2)",
          display: "flex", alignItems: "center", gap: 14,
        }}>
          <div style={{
            width: 26, height: 26, borderRadius: 4,
            background: "var(--bg-0)",
            border: "1px solid oklch(0.78 0.16 var(--accent-h) / 0.6)",
            color: "var(--accent)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700,
            boxShadow: "var(--glow)",
          }}>S</div>
          <div>
            <div style={{ fontSize: 12, color: "var(--text-bright)", fontWeight: 500 }}>STRATEGY STUDIO</div>
            <div className="mono" style={{ fontSize: 9.5, color: "var(--text-dim)", letterSpacing: 0.06 }}>
              визуальная сборка торговой стратегии · {asset}
            </div>
          </div>

          {/* Steps */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 22 }}>
            {stepsConfig.map((s, i) => {
              const isActive = step === i;
              const isDone = step > i && stepsConfig[i].valid();
              return (
                <React.Fragment key={s.id}>
                  <button onClick={() => setStep(i)} style={{
                    padding: "4px 10px",
                    background: isActive ? "var(--accent-soft)" : isDone ? "oklch(0.78 0.16 155 / 0.1)" : "var(--bg-2)",
                    color: isActive ? "var(--accent)" : isDone ? "var(--green)" : "var(--text-dim)",
                    border: `1px solid ${isActive ? "oklch(0.78 0.16 var(--accent-h) / 0.4)" : isDone ? "oklch(0.78 0.16 155 / 0.3)" : "var(--line)"}`,
                    borderRadius: 3, cursor: "pointer",
                    fontFamily: "var(--font-mono)", fontSize: 9.5, fontWeight: 600,
                    letterSpacing: 0.06,
                  }}>{isDone && "✓ "}{s.label}</button>
                  {i < stepsConfig.length - 1 && (
                    <span style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>›</span>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          <button onClick={onClose} style={{
            marginLeft: "auto",
            background: "transparent", border: "none",
            color: "var(--text-dim)", fontSize: 16, cursor: "pointer", padding: 2,
          }}>✕</button>
        </header>

        {/* BODY */}
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1.4fr 1fr", minHeight: 0, overflow: "hidden" }}>
          {/* Left: builder */}
          <div className="scroll" style={{
            overflowY: "auto", padding: 18,
            borderRight: "1px solid var(--line)",
          }}>
            {step === 0 && <SourceStep strategy={strategy} setStrategy={setStrategy}
              onPreset={(p) => { setStrategy(p.build()); setStep(4); }} />}
            {step === 1 && <IndicatorStep strategy={strategy} setStrategy={setStrategy} />}
            {step === 2 && <EntryStep strategy={strategy} setStrategy={setStrategy} />}
            {step === 3 && <ExitStep strategy={strategy} setStrategy={setStrategy} />}
            {step === 4 && <ReviewStep strategy={strategy} setStrategy={setStrategy} />}
          </div>

          {/* Right: preview */}
          <div className="scroll" style={{ overflowY: "auto", padding: 18, background: "var(--bg-0)" }}>
            <StrategyPreview strategy={strategy} asset={asset} step={step} />
          </div>
        </div>

        {/* FOOTER */}
        <footer style={{
          padding: "10px 18px",
          borderTop: "1px solid var(--line)",
          background: "var(--bg-2)",
          display: "flex", gap: 8, alignItems: "center",
        }}>
          <button onClick={onClose} className="btn">Отмена</button>
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)} className="btn">‹ Назад</button>
          )}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <span className="mono" style={{ fontSize: 10, color: "var(--text-dim)" }}>
              ШАГ {step + 1} / {stepsConfig.length}
            </span>
            {step < stepsConfig.length - 1 ? (
              <button onClick={() => setStep(s => s + 1)} className="btn btn-accent" disabled={!canAdvance}
                style={{ opacity: canAdvance ? 1 : 0.5, cursor: canAdvance ? "pointer" : "default" }}>
                Далее ›
              </button>
            ) : (
              <button onClick={() => {
                  try {
                    const lib = JSON.parse(localStorage.getItem("vael.strategies") || "[]");
                    lib.unshift({ ...strategy, savedAt: Date.now() });
                    localStorage.setItem("vael.strategies", JSON.stringify(lib.slice(0, 50)));
                  } catch (_) {}
                  onSave?.(strategy); onClose();
                  window.__emitToast?.({ kind: "agent", title: "Стратегия сохранена", body: `«${strategy.name}» сохранена локально`, meta: `ID: ${strategy.id}` });
                }}
                className="btn btn-accent" disabled={!canAdvance}>
                ▸ Сохранить и развернуть
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

function makeNewStrategy() {
  return {
    id: `STR-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    name: "",
    sources: [],
    indicators: [],
    entry: [],
    exit: null,
  };
}

/* ─────── Step 1: Source ─────── */
function SourceStep({ strategy, setStrategy, onPreset }) {
  const toggle = (id) => {
    setStrategy(s => ({
      ...s,
      sources: s.sources.includes(id) ? s.sources.filter(x => x !== id) : [...s.sources, id],
    }));
  };
  return (
    <StepShell title="Источники данных" subtitle="Выберите 1 или более потоков, которые будет анализировать стратегия">
      {/* Ready-made templates */}
      {onPreset && (
        <div>
          <div style={fieldLabel}>Готовые шаблоны · 1 клик → бэктест</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {STRATEGY_PRESETS.map(p => (
              <button key={p.key} onClick={() => onPreset(p)} style={{
                display: "grid", gridTemplateColumns: "auto 1fr", gap: 10, alignItems: "start",
                padding: "8px 11px", textAlign: "left",
                background: "var(--bg-2)", border: "1px solid var(--line)",
                borderLeft: "3px solid var(--accent-2)", borderRadius: 3, cursor: "pointer",
              }}>
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: 8.5, fontWeight: 700,
                  color: "var(--accent-2)", background: "var(--bg-0)",
                  border: "1px solid var(--line)", borderRadius: 2, padding: "2px 5px",
                  letterSpacing: 0.06, textTransform: "uppercase", whiteSpace: "nowrap", marginTop: 1,
                }}>{p.tag}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-bright)" }}>{p.title}</div>
                  <div style={{ fontSize: 10.5, color: "var(--text-mid)", marginTop: 2, lineHeight: 1.4 }}>{p.desc}</div>
                </div>
              </button>
            ))}
          </div>
          <div style={{
            textAlign: "center", margin: "10px 0 2px",
            fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--text-dim)", letterSpacing: 0.1,
          }}>— или собери с нуля —</div>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {SOURCE_TYPES.map(s => {
          const on = strategy.sources.includes(s.id);
          return (
            <button key={s.id} onClick={() => toggle(s.id)} style={blockBtnStyle(on)}>
              <span style={glyphStyle(on)}>{s.icon}</span>
              <div style={{ minWidth: 0, textAlign: "left" }}>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: on ? "var(--accent)" : "var(--text-bright)" }}>
                  {s.ru}
                  {on && <span style={{ marginLeft: 6, color: "var(--accent)", fontSize: 11 }}>✓</span>}
                </div>
                <div style={{ fontSize: 10.5, color: "var(--text-mid)", marginTop: 2, lineHeight: 1.35 }}>{s.desc}</div>
              </div>
            </button>
          );
        })}
      </div>
      <Hint text={`Выбрано ${strategy.sources.length} источник(ов). Для AI-стратегии рекомендуется минимум: Цена + 1 контекстный источник.`} />
    </StepShell>
  );
}

/* ─────── Step 2: Indicators ─────── */
function IndicatorStep({ strategy, setStrategy }) {
  const addIndicator = (id) => {
    const def = INDICATOR_TYPES.find(x => x.id === id);
    setStrategy(s => ({
      ...s,
      indicators: [...s.indicators, { uid: Math.random().toString(36).slice(2, 6), id, params: { ...def.defaults } }],
    }));
  };
  const removeIndicator = (uid) => {
    setStrategy(s => ({ ...s, indicators: s.indicators.filter(i => i.uid !== uid) }));
  };
  const updateParam = (uid, key, val) => {
    setStrategy(s => ({
      ...s,
      indicators: s.indicators.map(i => i.uid === uid ? { ...i, params: { ...i.params, [key]: val } } : i),
    }));
  };

  return (
    <StepShell title="Технические индикаторы" subtitle="Добавьте индикаторы для анализа выбранных источников">
      {/* Add buttons */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {INDICATOR_TYPES.map(i => (
          <button key={i.id} onClick={() => addIndicator(i.id)} style={chipBtnStyle()}>
            + {i.ru}
          </button>
        ))}
      </div>

      {/* Added list */}
      {strategy.indicators.length === 0 && (
        <Hint text="Нет добавленных индикаторов. Кликните по чипу выше, чтобы добавить." />
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {strategy.indicators.map(ind => {
          const def = INDICATOR_TYPES.find(x => x.id === ind.id);
          return (
            <div key={ind.uid} style={{
              padding: "8px 12px",
              background: "var(--bg-2)", border: "1px solid var(--line)",
              borderLeft: "3px solid var(--accent)",
              borderRadius: 3,
              display: "grid", gridTemplateColumns: "1fr auto auto",
              gap: 10, alignItems: "center",
            }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-bright)" }}>{def.ru}</div>
                <div className="mono" style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>{ind.uid}</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {def.params.map(p => (
                  <label key={p} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 10, color: "var(--text-dim)" }}>{p}</span>
                    <input type="number" value={ind.params[p]}
                      onChange={e => updateParam(ind.uid, p, +e.target.value)}
                      style={{
                        width: 50, padding: "3px 6px",
                        background: "var(--bg-0)", border: "1px solid var(--line-bright)",
                        color: "var(--text-bright)", fontFamily: "var(--font-mono)", fontSize: 11,
                        outline: "none", borderRadius: 2,
                      }}
                    />
                  </label>
                ))}
              </div>
              <button onClick={() => removeIndicator(ind.uid)} style={{
                width: 22, height: 22, background: "var(--bg-0)",
                border: "1px solid var(--line)", color: "var(--text-dim)",
                cursor: "pointer", borderRadius: 2, fontFamily: "var(--font-mono)",
              }}>✕</button>
            </div>
          );
        })}
      </div>
    </StepShell>
  );
}

/* ─────── Step 3: Entry rules ─────── */
function EntryStep({ strategy, setStrategy }) {
  const addRule = () => {
    setStrategy(s => ({
      ...s,
      entry: [...s.entry, {
        uid: Math.random().toString(36).slice(2, 6),
        left: s.indicators[0]?.id || "price",
        op: "cross_above",
        right: "ema",
        rightValue: 50,
        connector: s.entry.length > 0 ? "AND" : null,
      }],
    }));
  };
  const removeRule = (uid) => setStrategy(s => ({ ...s, entry: s.entry.filter(r => r.uid !== uid) }));
  const updateRule = (uid, key, val) => setStrategy(s => ({
    ...s, entry: s.entry.map(r => r.uid === uid ? { ...r, [key]: val } : r),
  }));

  const sideOptions = [
    { id: "buy",  ru: "ЛОНГ (покупка)",  color: "var(--green)" },
    { id: "sell", ru: "ШОРТ (продажа)", color: "var(--red)" },
    { id: "both", ru: "Обе стороны",     color: "var(--accent)" },
  ];

  return (
    <StepShell title="Условия входа" subtitle="Когда стратегия должна открыть позицию">
      <div>
        <div style={fieldLabel}>Сторона позиций</div>
        <div style={{ display: "flex", gap: 4 }}>
          {sideOptions.map(o => {
            const on = (strategy.side || "buy") === o.id;
            return (
              <button key={o.id} onClick={() => setStrategy(s => ({ ...s, side: o.id }))} style={{
                flex: 1, padding: "8px 10px",
                background: on ? `oklch(from ${o.color} l c h / 0.15)` : "var(--bg-2)",
                color: on ? o.color : "var(--text-mid)",
                border: `1px solid ${on ? o.color : "var(--line)"}`,
                borderRadius: 3, cursor: "pointer",
                fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600,
                letterSpacing: 0.06,
              }}>{o.ru}</button>
            );
          })}
        </div>
      </div>

      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={fieldLabel}>Правила (срабатывают вместе через AND)</div>
          <button onClick={addRule} className="btn btn-accent" style={{ padding: "2px 8px", fontSize: 10 }}>
            + ПРАВИЛО
          </button>
        </div>
        {strategy.entry.length === 0 && (
          <Hint text="Кликните «+ ПРАВИЛО» чтобы добавить условие. Например: цена пересекает EMA50 сверху." />
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
          {strategy.entry.map((rule, i) => (
            <div key={rule.uid}>
              {i > 0 && (
                <div style={{ padding: "3px 0", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent-2)", fontWeight: 600, letterSpacing: 0.1 }}>
                  AND
                </div>
              )}
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr auto 1fr auto",
                gap: 6, alignItems: "center",
                padding: "6px 8px",
                background: "var(--bg-2)", border: "1px solid var(--line)",
                borderRadius: 3,
              }}>
                <select value={rule.left} onChange={e => updateRule(rule.uid, "left", e.target.value)} style={selectStyle}>
                  <option value="price">цена</option>
                  <option value="volume">объём</option>
                  {strategy.indicators.map(i => {
                    const def = INDICATOR_TYPES.find(x => x.id === i.id);
                    return <option key={i.uid} value={i.uid}>{def.ru} #{i.uid}</option>;
                  })}
                </select>
                <select value={rule.op} onChange={e => updateRule(rule.uid, "op", e.target.value)} style={selectStyle}>
                  {COND_OPS.map(o => <option key={o.id} value={o.id}>{o.ru}</option>)}
                </select>
                <select value={rule.right} onChange={e => updateRule(rule.uid, "right", e.target.value)} style={selectStyle}>
                  <option value="value">значение</option>
                  {strategy.indicators.map(i => {
                    const def = INDICATOR_TYPES.find(x => x.id === i.id);
                    return <option key={i.uid} value={i.uid}>{def.ru} #{i.uid}</option>;
                  })}
                </select>
                <button onClick={() => removeRule(rule.uid)} style={{
                  width: 22, height: 22, background: "var(--bg-0)",
                  border: "1px solid var(--line)", color: "var(--text-dim)",
                  cursor: "pointer", borderRadius: 2, fontFamily: "var(--font-mono)",
                }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div style={fieldLabel}>Минимальный confidence от AI</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input type="range" min={50} max={95} step={5} value={strategy.minConfidence || 75}
            onChange={e => setStrategy(s => ({ ...s, minConfidence: +e.target.value }))}
            style={{ flex: 1, accentColor: "var(--accent)" }} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--accent)", minWidth: 40 }}>
            {strategy.minConfidence || 75}%
          </span>
        </div>
      </div>
    </StepShell>
  );
}

/* ─────── Step 4: Exit ─────── */
function ExitStep({ strategy, setStrategy }) {
  const t = strategy.exit?.type || "tp_sl";
  return (
    <StepShell title="Условия выхода" subtitle="Когда стратегия должна закрыть позицию">
      <div>
        <div style={fieldLabel}>Тип выхода</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {EXIT_TYPES.map(e => {
            const on = t === e.id;
            return (
              <button key={e.id} onClick={() => setStrategy(s => ({ ...s, exit: { tp: 4, sl: 2, trailing: 1.5, candles: 12, ...s.exit, type: e.id } }))} style={blockBtnStyle(on)}>
                <span style={glyphStyle(on)}>{on ? "✓" : "○"}</span>
                <span style={{ fontSize: 12, color: on ? "var(--accent)" : "var(--text-bright)" }}>{e.ru}</span>
              </button>
            );
          })}
        </div>
      </div>

      {t === "tp_sl" && strategy.exit && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <PctInput label="Take Profit · %" value={strategy.exit.tp || 4} color="var(--green)"
            onChange={v => setStrategy(s => ({ ...s, exit: { ...s.exit, tp: v } }))} />
          <PctInput label="Stop Loss · %" value={strategy.exit.sl || 2} color="var(--red)"
            onChange={v => setStrategy(s => ({ ...s, exit: { ...s.exit, sl: v } }))} />
        </div>
      )}
      {t === "trailing" && strategy.exit && (
        <PctInput label="Trailing distance · %" value={strategy.exit.trailing || 1.5} color="var(--accent)"
          onChange={v => setStrategy(s => ({ ...s, exit: { ...s.exit, trailing: v } }))} />
      )}
      {t === "time" && strategy.exit && (
        <div>
          <div style={fieldLabel}>Закрыть через N свечей (1ч TF)</div>
          <input type="number" value={strategy.exit.candles || 12} min={1} max={200}
            onChange={e => setStrategy(s => ({ ...s, exit: { ...s.exit, candles: +e.target.value } }))}
            style={inputStyle} />
        </div>
      )}

      <div>
        <div style={fieldLabel}>Размер позиции</div>
        <div style={{ display: "flex", gap: 4 }}>
          {[{ v: "fixed", l: "Фикс. USD" }, { v: "pct", l: "% от капитала" }, { v: "kelly", l: "Kelly criterion" }].map(o => {
            const on = (strategy.sizing || "fixed") === o.v;
            return (
              <button key={o.v} onClick={() => setStrategy(s => ({ ...s, sizing: o.v }))} style={{
                flex: 1, padding: "6px 8px",
                background: on ? "var(--accent-soft)" : "var(--bg-2)",
                color: on ? "var(--accent)" : "var(--text-mid)",
                border: `1px solid ${on ? "oklch(0.78 0.16 var(--accent-h) / 0.4)" : "var(--line)"}`,
                fontFamily: "var(--font-mono)", fontSize: 10.5,
                borderRadius: 3, cursor: "pointer",
              }}>{o.l}</button>
            );
          })}
        </div>
      </div>
    </StepShell>
  );
}

/* ─────── Step 5: Review ─────── */
function ReviewStep({ strategy, setStrategy }) {
  return (
    <StepShell title="Обзор стратегии" subtitle="Финальная проверка перед сохранением">
      <div>
        <div style={fieldLabel}>Название стратегии</div>
        <input value={strategy.name} onChange={e => setStrategy(s => ({ ...s, name: e.target.value }))}
          placeholder="Например: ETH Momentum · 1h · AI v3"
          style={{ ...inputStyle, fontFamily: "var(--font-ui)", fontSize: 13 }} />
      </div>

      <div style={{
        background: "var(--bg-0)",
        border: "1px solid var(--line)",
        borderRadius: 4,
        padding: 14,
        display: "flex", flexDirection: "column", gap: 10,
      }}>
        <ReviewRow label="ID" value={<span className="mono">{strategy.id}</span>} />
        <ReviewRow label="Источники" value={
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {strategy.sources.map(s => {
              const def = SOURCE_TYPES.find(x => x.id === s);
              return <span key={s} className="chip">{def.icon} {def.ru}</span>;
            })}
          </div>
        } />
        <ReviewRow label={`Индикаторы (${strategy.indicators.length})`} value={
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {strategy.indicators.map(i => {
              const def = INDICATOR_TYPES.find(x => x.id === i.id);
              return <span key={i.uid} className="chip chip-accent" style={{ fontSize: 10 }}>
                {def.ru}{Object.values(i.params).length > 0 && ` (${Object.values(i.params).join(",")})`}
              </span>;
            })}
          </div>
        } />
        <ReviewRow label="Сторона" value={
          <span className="mono" style={{ color: strategy.side === "sell" ? "var(--red)" : "var(--green)" }}>
            {strategy.side === "sell" ? "SHORT" : strategy.side === "both" ? "BOTH" : "LONG"}
          </span>
        } />
        <ReviewRow label="Правила входа" value={
          <span className="mono" style={{ fontSize: 11 }}>
            {strategy.entry.length} {strategy.entry.length === 1 ? "правило" : "правил"} · AND · min conf {strategy.minConfidence || 75}%
          </span>
        } />
        <ReviewRow label="Выход" value={
          <span className="mono" style={{ fontSize: 11 }}>
            {EXIT_TYPES.find(e => e.id === strategy.exit?.type)?.ru || "—"}
            {strategy.exit?.type === "tp_sl" && ` · TP ${strategy.exit.tp}% / SL ${strategy.exit.sl}%`}
            {strategy.exit?.type === "trailing" && ` · ${strategy.exit.trailing}%`}
          </span>
        } />
      </div>

      <Hint text="✓ Все блоки готовы. Превью выше — реальный бэктест стратегии на живых свечах Bybit (15m). При сохранении стратегия записывается локально (localStorage)." />
    </StepShell>
  );
}

function ReviewRow({ label, value }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 10, alignItems: "center" }}>
      <span style={{ fontSize: 10.5, color: "var(--text-dim)", letterSpacing: 0.06, textTransform: "uppercase", fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 12, color: "var(--text)" }}>{value}</span>
    </div>
  );
}

/* ─────── Preview (real Bybit backtest of the built strategy) ─────── */
function sideMatches(sigSide, stratSide) {
  if (stratSide === "both") return true;
  if (stratSide === "sell") return sigSide === "sell";
  return sigSide === "buy";
}
function studioBacktest(candles, strategy) {
  if (!candles || candles.length < 60 || typeof analyzeMarket !== "function") return null;
  const minConf = strategy.minConfidence || 75;
  const H = 24;
  const useTpSl = strategy.exit && strategy.exit.type === "tp_sl";
  const tpPct = useTpSl ? (strategy.exit.tp || 4) / 100 : null;
  const slPct = useTpSl ? (strategy.exit.sl || 2) / 100 : null;
  let equity = 100, wins = 0, losses = 0;
  const markers = [], curve = [{ v: 100 }];
  let i = 55;
  while (i <= candles.length - 2) {
    const a = analyzeMarket(candles.slice(0, i + 1));
    if (!a || !a.setup || a.confidence < minConf || !sideMatches(a.side, strategy.side)) { i++; continue; }
    const entry = candles[i].close, side = a.side;
    const sl = useTpSl ? (side === "buy" ? entry * (1 - slPct) : entry * (1 + slPct)) : a.sl;
    const tp = useTpSl ? (side === "buy" ? entry * (1 + tpPct) : entry * (1 - tpPct)) : a.tp;
    const slD = Math.abs(entry - sl) || entry * 0.004;
    const rr = Math.abs(tp - entry) / slD;
    let R = null, exitIdx = Math.min(i + H, candles.length - 1);
    for (let j = i + 1; j <= Math.min(i + H, candles.length - 1); j++) {
      const c = candles[j];
      if (side === "buy") { if (c.lo <= sl) { R = -1; exitIdx = j; break; } if (c.hi >= tp) { R = rr; exitIdx = j; break; } }
      else { if (c.hi >= sl) { R = -1; exitIdx = j; break; } if (c.lo <= tp) { R = rr; exitIdx = j; break; } }
    }
    if (R === null) { const xp = candles[exitIdx].close; const mv = side === "buy" ? xp - entry : entry - xp; R = Math.max(-1, Math.min(rr, mv / slD)); }
    equity += R * (equity * 0.02);
    if (R > 0) wins++; else losses++;
    markers.push({ idx: i, side, price: entry });
    curve.push({ v: equity });
    i = exitIdx + 1;
  }
  const trades = wins + losses;
  const rets = [];
  for (let k = 1; k < curve.length; k++) rets.push((curve[k].v - curve[k - 1].v) / curve[k - 1].v);
  const mean = rets.length ? rets.reduce((s, x) => s + x, 0) / rets.length : 0;
  const varr = rets.length ? rets.reduce((s, x) => s + (x - mean) ** 2, 0) / rets.length : 0;
  const sharpe = varr > 0 ? (mean / Math.sqrt(varr)) * Math.sqrt(rets.length) : 0;
  return { markers, stats: { roi: equity - 100, sharpe, winRate: trades ? wins / trades * 100 : 0, trades } };
}

function StrategyPreview({ strategy, asset, step }) {
  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const sym = typeof toBybitSymbol === "function" ? toBybitSymbol(asset) : String(asset).replace(/[\/\s]/g, "");
    if (typeof bybitFetchKlines === "function") {
      bybitFetchKlines(sym, "15", 200)
        .then(kl => { if (!cancelled) { setCandles(kl); setLoading(false); } })
        .catch(() => { if (!cancelled) setLoading(false); });
    } else setLoading(false);
    return () => { cancelled = true; };
  }, [asset]);

  const bt = useMemo(() => (candles.length ? studioBacktest(candles, strategy) : null), [candles, strategy]);
  const chartCandles = useMemo(() => candles.slice(-50), [candles]);
  const offset = candles.length - chartCandles.length;
  const chartMarkers = bt ? bt.markers.filter(m => m.idx >= offset).map(m => ({ ...m, idx: m.idx - offset })).slice(-10) : [];

  const ema = useMemo(() => {
    const has = strategy.indicators.find(i => i.id === "ema");
    if (!has || !candles.length) return null;
    const period = has.params?.period || 50;
    const closes = candles.map(c => c.close);
    const k = 2 / (period + 1); const out = []; let e = closes[0];
    closes.forEach((v, idx) => { e = idx === 0 ? v : v * k + e * (1 - k); out.push(e); });
    return out.slice(-50);
  }, [candles, strategy.indicators]);

  const rsi = useMemo(() => {
    const has = strategy.indicators.find(i => i.id === "rsi");
    if (!has || candles.length < 30 || typeof taRsi !== "function") return null;
    const period = has.params?.period || 14;
    const closes = candles.map(c => c.close);
    const out = [];
    for (let idx = candles.length - 50; idx < candles.length; idx++) out.push(taRsi(closes.slice(0, idx + 1), period));
    return out;
  }, [candles, strategy.indicators]);

  const st = useMemo(() => {
    const has = strategy.indicators.find(i => i.id === "supertrend");
    if (!has || candles.length < 20 || typeof taSupertrend !== "function") return null;
    const factor = has.params?.factor || 3, atrP = has.params?.atr || 10;
    const out = [];
    for (let idx = candles.length - 50; idx < candles.length; idx++) {
      const r = taSupertrend(candles.slice(0, idx + 1), factor, atrP);
      out.push({ v: r.value, dir: r.dir });
    }
    return out;
  }, [candles, strategy.indicators]);

  const bb = useMemo(() => {
    const has = strategy.indicators.find(i => i.id === "bb");
    if (!has || candles.length < 25 || typeof taBollinger !== "function") return null;
    const period = has.params?.period || 20, mult = has.params?.mult || 2;
    const closes = candles.map(c => c.close);
    const out = [];
    for (let idx = candles.length - 50; idx < candles.length; idx++) {
      const r = taBollinger(closes.slice(0, idx + 1), period, mult);
      out.push({ upper: r.upper, mid: r.mid, lower: r.lower });
    }
    return out;
  }, [candles, strategy.indicators]);

  const psar = useMemo(() => {
    const has = strategy.indicators.find(i => i.id === "psar");
    if (!has || candles.length < 20 || typeof taParabolicSar !== "function") return null;
    const step = has.params?.step || 0.02, mx = has.params?.max || 0.2;
    const out = [];
    for (let idx = candles.length - 50; idx < candles.length; idx++) {
      const r = taParabolicSar(candles.slice(0, idx + 1), step, mx);
      out.push({ v: r.value, dir: r.dir });
    }
    return out;
  }, [candles, strategy.indicators]);

  const ichi = useMemo(() => {
    const has = strategy.indicators.find(i => i.id === "ichimoku");
    if (!has || candles.length < 55 || typeof taIchimoku !== "function") return null;
    const conv = has.params?.conv || 9, base = has.params?.base || 26;
    const out = [];
    for (let idx = candles.length - 50; idx < candles.length; idx++) {
      const r = taIchimoku(candles.slice(0, idx + 1), conv, base);
      out.push({ tenkan: r.tenkan, kijun: r.kijun, spanA: r.spanA, spanB: r.spanB });
    }
    return out;
  }, [candles, strategy.indicators]);

  const chan = useMemo(() => {
    const kc = strategy.indicators.find(i => i.id === "keltner");
    const dc = strategy.indicators.find(i => i.id === "donchian");
    if ((!kc && !dc) || candles.length < 25) return null;
    const out = { keltner: null, donchian: null };
    if (kc && typeof taKeltner === "function") {
      const period = kc.params?.period || 20, mult = kc.params?.mult || 2;
      out.keltner = [];
      for (let idx = candles.length - 50; idx < candles.length; idx++) out.keltner.push(taKeltner(candles.slice(0, idx + 1), period, mult));
    }
    if (dc && typeof taDonchian === "function") {
      const period = dc.params?.period || 20;
      out.donchian = [];
      for (let idx = candles.length - 50; idx < candles.length; idx++) out.donchian.push(taDonchian(candles.slice(0, idx + 1), period));
    }
    return out;
  }, [candles, strategy.indicators]);

  const pats = useMemo(() => {
    const has = strategy.indicators.find(i => i.id === "patterns");
    if (!has || !chartCandles.length || typeof taCandlePatterns !== "function") return null;
    return taCandlePatterns(chartCandles, chartCandles.length);
  }, [chartCandles, strategy.indicators]);

  const s = bt ? bt.stats : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div style={fieldLabel}>LIVE PREVIEW · {asset} <span style={{ color: "var(--blue)", fontSize: 8.5 }}>● Bybit 15m</span></div>
        <div style={{ background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: 4, padding: 8 }}>
          {loading
            ? <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 11 }}>загрузка свечей Bybit…</div>
            : <PreviewChart candles={chartCandles} ema={ema} st={st} bb={bb} psar={psar} ichi={ichi} chan={chan} pats={pats} markers={chartMarkers} width={400} height={200} />}
          {rsi && !loading && (
            <div style={{ marginTop: 4 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", marginBottom: 2 }}>RSI {strategy.indicators.find(i => i.id === "rsi").params.period}</div>
              <PreviewRsi data={rsi} width={400} height={50} />
            </div>
          )}
        </div>
      </div>

      <div>
        <div style={fieldLabel}>Бэктест на данных Bybit · 15m</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4 }}>
          <PreviewStat label="ROI · бэктест" v={s ? `${s.roi >= 0 ? "+" : ""}${s.roi.toFixed(1)}%` : "…"} c={s && s.roi >= 0 ? "var(--green)" : "var(--red)"} />
          <PreviewStat label="SHARPE" v={s ? s.sharpe.toFixed(2) : "…"} c="var(--accent)" />
          <PreviewStat label="WIN RATE" v={s ? `${s.winRate.toFixed(0)}%` : "…"} c={s && s.winRate >= 50 ? "var(--green)" : "var(--amber)"} />
          <PreviewStat label="СДЕЛОК" v={s ? s.trades : "…"} c="var(--text-bright)" />
        </div>
        <div className="mono" style={{ fontSize: 9.5, color: "var(--text-dim)", marginTop: 6 }}>
          {s && s.trades === 0
            ? "нет сделок по стратегии в окне · ослабьте confidence или сторону"
            : `реальный прогон движка на ${candles.length} свечах Bybit`}
        </div>
      </div>

      {/* Logic recap */}
      <div>
        <div style={fieldLabel}>Логика</div>
        <div style={{
          background: "var(--bg-1)", border: "1px solid var(--line)",
          borderRadius: 4, padding: 10,
          fontFamily: "var(--font-mono)", fontSize: 10.5, lineHeight: 1.7,
          color: "var(--text-mid)",
        }}>
          <div><span style={{ color: "var(--accent-2)" }}>WHEN</span> <span style={{ color: "var(--accent)" }}>{strategy.sources.join(" + ") || "..."}</span> updated</div>
          <div><span style={{ color: "var(--accent-2)" }}>EVAL</span> analyzeMarket · {strategy.indicators.length || "0"} indicator(s)</div>
          <div><span style={{ color: "var(--accent-2)" }}>IF</span> setup AND confidence ≥ {strategy.minConfidence || 75}%</div>
          <div><span style={{ color: "var(--accent-2)" }}>THEN</span> open <span style={{ color: strategy.side === "sell" ? "var(--red)" : "var(--green)" }}>{(strategy.side || "buy").toUpperCase()}</span> position</div>
          <div><span style={{ color: "var(--accent-2)" }}>EXIT</span> {EXIT_TYPES.find(e => e.id === strategy.exit?.type)?.ru || "..."}{strategy.exit?.type === "tp_sl" ? ` · TP ${strategy.exit.tp}% / SL ${strategy.exit.sl}%` : ""}</div>
        </div>
      </div>
    </div>
  );
}

function PreviewChart({ candles, ema, st, bb, psar, ichi, chan, pats, markers, width = 400, height = 200 }) {
  const lows = candles.map(c => c.lo), highs = candles.map(c => c.hi);
  const stVals = st ? st.map(p => p.v).filter(v => isFinite(v) && v > 0) : [];
  const bbVals = bb ? bb.flatMap(p => [p.upper, p.lower]).filter(v => isFinite(v) && v > 0) : [];
  const psarVals = psar ? psar.map(p => p.v).filter(v => isFinite(v) && v > 0) : [];
  const ichiVals = ichi ? ichi.flatMap(p => [p.spanA, p.spanB, p.tenkan, p.kijun]).filter(v => isFinite(v) && v > 0) : [];
  const chanVals = chan ? [...(chan.keltner || []), ...(chan.donchian || [])].flatMap(p => [p.upper, p.lower]).filter(v => isFinite(v) && v > 0) : [];
  const min = Math.min(...lows, ...stVals, ...bbVals, ...psarVals, ...ichiVals, ...chanVals);
  const max = Math.max(...highs, ...stVals, ...bbVals, ...psarVals, ...ichiVals, ...chanVals);
  const range = (max - min) || 1;
  const stepX = width / candles.length;
  const candleW = Math.max(2, stepX * 0.6);
  const y = v => 8 + (1 - (v - min) / range) * (height - 16);

  const emaPath = ema ? ema.map((v, i) => `${i === 0 ? "M" : "L"}${i * stepX + stepX/2},${y(v)}`).join(" ") : null;

  // Bollinger bands — upper/lower dashed, mid faint solid
  const bbLine = (key) => bb ? bb.map((p, i) => `${i === 0 ? "M" : "L"}${i * stepX + stepX/2},${y(p[key])}`).join(" ") : null;
  const bbUpper = bbLine("upper"), bbMid = bbLine("mid"), bbLower = bbLine("lower");

  // Keltner / Donchian channels — line path over a series/key
  const chanLine = (arr, key) => arr ? arr.map((p, i) => `${i === 0 ? "M" : "L"}${i * stepX + stepX / 2},${y(p[key])}`).join(" ") : null;
  const kc = chan && chan.keltner, dc = chan && chan.donchian;

  // Ichimoku — shaded cloud between spanA/spanB (colour by last state) + tenkan/kijun lines
  let ichiCloud = null, ichiCloudColor = null, ichiTenkan = null, ichiKijun = null;
  if (ichi && ichi.length) {
    const aPts = ichi.map((p, i) => `${i * stepX + stepX / 2},${y(p.spanA)}`);
    const bPts = ichi.map((p, i) => `${i * stepX + stepX / 2},${y(p.spanB)}`).reverse();
    ichiCloud = "M" + aPts.join(" L") + " L" + bPts.join(" L") + " Z";
    const last = ichi[ichi.length - 1];
    ichiCloudColor = last.spanA >= last.spanB ? "var(--green)" : "var(--red)";
    ichiTenkan = ichi.map((p, i) => `${i === 0 ? "M" : "L"}${i * stepX + stepX / 2},${y(p.tenkan)}`).join(" ");
    ichiKijun = ichi.map((p, i) => `${i === 0 ? "M" : "L"}${i * stepX + stepX / 2},${y(p.kijun)}`).join(" ");
  }

  // Supertrend line — drawn as coloured segments (green in uptrend, red in downtrend)
  const stSegs = [];
  if (st) {
    for (let i = 1; i < st.length; i++) {
      if (!isFinite(st[i].v) || st[i].v <= 0 || !isFinite(st[i - 1].v) || st[i - 1].v <= 0) continue;
      stSegs.push({
        x1: (i - 1) * stepX + stepX / 2, y1: y(st[i - 1].v),
        x2: i * stepX + stepX / 2, y2: y(st[i].v),
        color: st[i].dir > 0 ? "var(--green)" : "var(--red)",
      });
    }
  }

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: "block" }}>
      {candles.map((c, i) => {
        const cx = i * stepX + stepX / 2;
        const up = c.close >= c.open;
        const color = up ? "var(--green)" : "var(--red)";
        return (
          <g key={i}>
            <line x1={cx} y1={y(c.hi)} x2={cx} y2={y(c.lo)} stroke={color} strokeWidth={0.6} />
            <rect x={cx - candleW / 2} y={y(Math.max(c.open, c.close))}
              width={candleW} height={Math.max(0.8, Math.abs(y(c.open) - y(c.close)))}
              fill={up ? "transparent" : color} stroke={color} strokeWidth={0.8} />
          </g>
        );
      })}
      {ichi && (
        <g>
          <path d={ichiCloud} fill={ichiCloudColor} stroke="none" opacity={0.14} />
          <path d={ichiTenkan} fill="none" stroke="var(--blue)" strokeWidth={0.9} opacity={0.75} />
          <path d={ichiKijun} fill="none" stroke="var(--amber)" strokeWidth={0.9} opacity={0.75} />
        </g>
      )}
      {bb && (
        <g>
          <path d={bbUpper} fill="none" stroke="var(--blue)" strokeWidth={0.9} strokeDasharray="3 2" opacity={0.7} />
          <path d={bbLower} fill="none" stroke="var(--blue)" strokeWidth={0.9} strokeDasharray="3 2" opacity={0.7} />
          <path d={bbMid} fill="none" stroke="var(--blue)" strokeWidth={0.7} opacity={0.35} />
        </g>
      )}
      {kc && (
        <g>
          <path d={chanLine(kc, "upper")} fill="none" stroke="var(--accent-2)" strokeWidth={0.9} opacity={0.7} />
          <path d={chanLine(kc, "lower")} fill="none" stroke="var(--accent-2)" strokeWidth={0.9} opacity={0.7} />
        </g>
      )}
      {dc && (
        <g>
          <path d={chanLine(dc, "upper")} fill="none" stroke="var(--text-dim)" strokeWidth={0.8} strokeDasharray="2 2" opacity={0.7} />
          <path d={chanLine(dc, "lower")} fill="none" stroke="var(--text-dim)" strokeWidth={0.8} strokeDasharray="2 2" opacity={0.7} />
        </g>
      )}
      {emaPath && (
        <path d={emaPath} fill="none" stroke="var(--accent)" strokeWidth={1.2} strokeDasharray="0" opacity={0.85} />
      )}
      {stSegs.map((s, i) => (
        <line key={`st${i}`} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={s.color} strokeWidth={1.3} opacity={0.9} />
      ))}
      {psar && psar.map((p, i) => (
        isFinite(p.v) && p.v > 0
          ? <circle key={`ps${i}`} cx={i * stepX + stepX / 2} cy={y(p.v)} r={1.1}
              fill={p.dir > 0 ? "var(--green)" : "var(--red)"} opacity={0.85} />
          : null
      ))}
      {pats && pats.map((pt, i) => {
        const cx = pt.idx * stepX + stepX / 2;
        const c = candles[pt.idx];
        if (!c) return null;
        const color = pt.bias === "bull" ? "var(--green)" : pt.bias === "bear" ? "var(--red)" : "var(--amber)";
        const yPos = pt.bias === "bear" ? y(c.hi) - 6 : y(c.lo) + 6;
        return <circle key={`pt${i}`} cx={cx} cy={yPos} r={1.6} fill={color} opacity={0.9} />;
      })}
      {markers.map((m, i) => {
        const cx = m.idx * stepX + stepX / 2;
        const cy = y(m.price);
        const color = m.side === "buy" ? "var(--green)" : "var(--red)";
        const yPos = m.side === "buy" ? cy + 10 : cy - 10;
        const tri = m.side === "buy"
          ? `M${cx},${yPos - 5} L${cx-4},${yPos+2} L${cx+4},${yPos+2} Z`
          : `M${cx},${yPos + 5} L${cx-4},${yPos-2} L${cx+4},${yPos-2} Z`;
        return <path key={i} d={tri} fill={color} />;
      })}
    </svg>
  );
}

function PreviewRsi({ data, width = 400, height = 50 }) {
  const stepX = width / (data.length - 1);
  const y = v => 4 + (1 - v / 100) * (height - 8);
  const path = data.map((v, i) => `${i === 0 ? "M" : "L"}${i * stepX},${y(v)}`).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: "block" }}>
      <line x1={0} y1={y(70)} x2={width} y2={y(70)} stroke="var(--red)" strokeWidth={0.5} strokeDasharray="2 3" opacity={0.5} />
      <line x1={0} y1={y(30)} x2={width} y2={y(30)} stroke="var(--green)" strokeWidth={0.5} strokeDasharray="2 3" opacity={0.5} />
      <path d={path} fill="none" stroke="var(--accent-2)" strokeWidth={1} />
    </svg>
  );
}

function PreviewStat({ label, v, c }) {
  return (
    <div style={{ background: "var(--bg-1)", border: "1px solid var(--line)", padding: "6px 8px", borderRadius: 3 }}>
      <div style={{ fontSize: 8.5, color: "var(--text-dim)", letterSpacing: 0.12, fontWeight: 600 }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: c, marginTop: 1 }}>{v}</div>
    </div>
  );
}

/* shared bits */
function StepShell({ title, subtitle, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-bright)" }}>{title}</div>
        <div style={{ fontSize: 11.5, color: "var(--text-mid)", marginTop: 2, lineHeight: 1.4 }}>{subtitle}</div>
      </div>
      {children}
    </div>
  );
}

function Hint({ text }) {
  return (
    <div style={{
      background: "var(--bg-2)", padding: "8px 10px", borderRadius: 3,
      border: "1px dashed var(--line-bright)",
      fontSize: 11, color: "var(--text-mid)", lineHeight: 1.5,
    }}>
      <span className="accent">↳ </span>{text}
    </div>
  );
}

function PctInput({ label, value, color, onChange }) {
  return (
    <div>
      <div style={fieldLabel}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input type="range" min={0.5} max={20} step={0.1} value={value}
          onChange={e => onChange(+e.target.value)}
          style={{ flex: 1, accentColor: color }} />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, color, minWidth: 50, textAlign: "right" }}>
          {value.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

const fieldLabel = {
  fontSize: 9.5, fontWeight: 600, letterSpacing: 0.15,
  textTransform: "uppercase", color: "var(--text-dim)",
  marginBottom: 6,
};

const inputStyle = {
  width: "100%", padding: "7px 10px",
  background: "var(--bg-0)", border: "1px solid var(--line-bright)",
  color: "var(--text-bright)", fontFamily: "var(--font-mono)", fontSize: 12,
  outline: "none", borderRadius: 3,
};

const selectStyle = {
  padding: "5px 7px",
  background: "var(--bg-0)", border: "1px solid var(--line-bright)",
  color: "var(--text-bright)", fontFamily: "var(--font-mono)", fontSize: 11,
  outline: "none", borderRadius: 2, cursor: "pointer",
};

const chipBtnStyle = () => ({
  padding: "4px 10px",
  background: "var(--bg-2)", border: "1px solid var(--line)",
  color: "var(--text-mid)",
  fontFamily: "var(--font-mono)", fontSize: 10.5,
  borderRadius: 3, cursor: "pointer",
  transition: "all 0.1s",
});

const blockBtnStyle = (on) => ({
  display: "flex", alignItems: "center", gap: 10,
  padding: "10px 12px",
  background: on ? "var(--accent-soft)" : "var(--bg-2)",
  border: `1px solid ${on ? "oklch(0.78 0.16 var(--accent-h) / 0.5)" : "var(--line)"}`,
  borderRadius: 3, cursor: "pointer",
  textAlign: "left",
  transition: "all 0.1s",
});

const glyphStyle = (on) => ({
  width: 30, height: 30, borderRadius: 3,
  background: on ? "var(--bg-0)" : "var(--bg-3)",
  border: `1px solid ${on ? "var(--accent)" : "var(--line)"}`,
  color: on ? "var(--accent)" : "var(--text-dim)",
  display: "flex", alignItems: "center", justifyContent: "center",
  fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700,
  flexShrink: 0,
});

Object.assign(window, { StrategyStudio });