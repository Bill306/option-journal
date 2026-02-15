// ============================================================
// Option Journal — Core Calculation Engine
// ============================================================

export const MULTIPLIER = 100;

// ---- Types ---- //

export interface TradeForCalc {
  pnl: number | null;
  status: string;
  entryPriceTotal: number;
  exitPriceTotal: number | null;
  qty: number;
  fees: number;
  strategyType: string;
  direction: string;
  ruleCompliant: boolean;
  emotionScore: number | null;
  earningsEvent: boolean;
  vixLevel: number | null;
  marketTrend: string | null;
  entryDatetime: string | Date;
  exitDatetime: string | Date | null;
  legs?: LegForCalc[];
}

export interface LegForCalc {
  optionType: string;
  side: string;
  strike: number;
  contracts: number;
  entryPrice: number;
  exitPrice: number | null;
  deltaEntry: number | null;
  ivEntry: number | null;
  expiration: string | Date;
}

// ---- PnL ---- //

export function calcTradePnl(trade: TradeForCalc): number {
  if (trade.pnl !== null && trade.pnl !== undefined) return trade.pnl;
  if (trade.exitPriceTotal === null || trade.exitPriceTotal === undefined) return 0;
  // entry_total is net credit (+) or debit (-).
  // For credit trades (positive entry): profit = entry - exit
  // For debit trades (negative entry): profit = exit - entry (but signs handle it)
  return (trade.entryPriceTotal - trade.exitPriceTotal) * trade.qty * MULTIPLIER - trade.fees;
}

// ---- Win Rate ---- //

export function calcWinRate(trades: TradeForCalc[]): number {
  const closed = trades.filter((t) => t.status === "closed");
  if (closed.length === 0) return 0;
  const wins = closed.filter((t) => calcTradePnl(t) > 0).length;
  return wins / closed.length;
}

// ---- Expectancy ---- //

export function calcExpectancy(trades: TradeForCalc[]): number {
  const closed = trades.filter((t) => t.status === "closed");
  if (closed.length === 0) return 0;

  const pnls = closed.map(calcTradePnl);
  const wins = pnls.filter((p) => p > 0);
  const losses = pnls.filter((p) => p < 0);

  const winRate = wins.length / closed.length;
  const lossRate = losses.length / closed.length;
  const avgWin = wins.length > 0 ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((a, b) => a + b, 0) / losses.length) : 0;

  return winRate * avgWin - lossRate * avgLoss;
}

// ---- Profit Factor ---- //

export function calcProfitFactor(trades: TradeForCalc[]): number {
  const closed = trades.filter((t) => t.status === "closed");
  const pnls = closed.map(calcTradePnl);

  const grossProfit = pnls.filter((p) => p > 0).reduce((a, b) => a + b, 0);
  const grossLoss = Math.abs(pnls.filter((p) => p < 0).reduce((a, b) => a + b, 0));

  if (grossLoss === 0) return grossProfit > 0 ? Infinity : 0;
  return grossProfit / grossLoss;
}

// ---- Equity Curve & Max Drawdown ---- //

export interface EquityPoint {
  date: string;
  equity: number;
  drawdown: number;
}

export function calcEquityCurve(trades: TradeForCalc[]): EquityPoint[] {
  const closed = trades
    .filter((t) => t.status === "closed" && t.exitDatetime)
    .sort((a, b) => new Date(a.exitDatetime!).getTime() - new Date(b.exitDatetime!).getTime());

  let equity = 0;
  let peak = 0;
  const points: EquityPoint[] = [];

  for (const trade of closed) {
    const pnl = calcTradePnl(trade);
    equity += pnl;
    if (equity > peak) peak = equity;
    const drawdown = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
    points.push({
      date: new Date(trade.exitDatetime!).toISOString().split("T")[0],
      equity: Math.round(equity * 100) / 100,
      drawdown: Math.round(drawdown * 100) / 100,
    });
  }

  return points;
}

export function calcMaxDrawdown(trades: TradeForCalc[]): number {
  const curve = calcEquityCurve(trades);
  if (curve.length === 0) return 0;
  return Math.max(...curve.map((p) => p.drawdown));
}

// ---- Bucketing / Edge Engine ---- //

export interface BucketResult {
  bucket: string;
  count: number;
  winRate: number;
  avgPnl: number;
  expectancy: number;
  totalPnl: number;
}

export function bucketByStrategy(trades: TradeForCalc[]): BucketResult[] {
  return bucketBy(trades, (t) => t.strategyType);
}

export function bucketByDTE(trades: TradeForCalc[]): BucketResult[] {
  return bucketBy(trades, (t) => {
    const legs = t.legs || [];
    if (legs.length === 0) return "unknown";
    const dte = Math.round(
      (new Date(legs[0].expiration).getTime() - new Date(t.entryDatetime).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    if (dte <= 7) return "0-7";
    if (dte <= 21) return "7-21";
    if (dte <= 45) return "21-45";
    return "45+";
  });
}

export function bucketByDelta(trades: TradeForCalc[]): BucketResult[] {
  return bucketBy(trades, (t) => {
    const legs = t.legs || [];
    const deltas = legs.map((l) => l.deltaEntry).filter((d): d is number => d !== null);
    if (deltas.length === 0) return "unknown";
    const avgDelta = Math.abs(deltas.reduce((a, b) => a + b, 0) / deltas.length);
    if (avgDelta < 0.2) return "0.1-0.2";
    if (avgDelta < 0.4) return "0.2-0.4";
    if (avgDelta < 0.6) return "0.4-0.6";
    return "0.6+";
  });
}

export function bucketByIVRank(trades: TradeForCalc[]): BucketResult[] {
  return bucketBy(trades, (t) => {
    const legs = t.legs || [];
    const ivs = legs.map((l) => l.ivEntry).filter((v): v is number => v !== null);
    if (ivs.length === 0) return "unknown";
    const avgIV = ivs.reduce((a, b) => a + b, 0) / ivs.length;
    if (avgIV < 20) return "0-20";
    if (avgIV < 40) return "20-40";
    if (avgIV < 60) return "40-60";
    if (avgIV < 80) return "60-80";
    return "80-100";
  });
}

export function bucketByCompliance(trades: TradeForCalc[]): BucketResult[] {
  return bucketBy(trades, (t) => (t.ruleCompliant ? "Compliant" : "Non-compliant"));
}

export function bucketByEmotion(trades: TradeForCalc[]): BucketResult[] {
  return bucketBy(trades, (t) => {
    if (!t.emotionScore) return "unknown";
    if (t.emotionScore <= 2) return "Calm (1-2)";
    if (t.emotionScore <= 3) return "Neutral (3)";
    return "Emotional (4-5)";
  });
}

export function bucketByRegime(trades: TradeForCalc[]): BucketResult[] {
  return bucketBy(trades, (t) => {
    const parts: string[] = [];
    if (t.vixLevel !== null && t.vixLevel !== undefined) {
      parts.push(t.vixLevel >= 25 ? "High IV" : "Low IV");
    }
    if (t.earningsEvent) parts.push("Earnings");
    if (t.marketTrend) parts.push(t.marketTrend);
    return parts.length > 0 ? parts.join(" / ") : "unknown";
  });
}

// ---- Generic bucket helper ---- //

function bucketBy(
  trades: TradeForCalc[],
  keyFn: (t: TradeForCalc) => string
): BucketResult[] {
  const closed = trades.filter((t) => t.status === "closed");
  const groups = new Map<string, TradeForCalc[]>();

  for (const t of closed) {
    const key = keyFn(t);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }

  const results: BucketResult[] = [];
  for (const [bucket, group] of groups) {
    const pnls = group.map(calcTradePnl);
    const wins = pnls.filter((p) => p > 0);
    const losses = pnls.filter((p) => p < 0);
    const totalPnl = pnls.reduce((a, b) => a + b, 0);
    const winRate = wins.length / group.length;
    const avgPnl = totalPnl / group.length;
    const avgWin = wins.length > 0 ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((a, b) => a + b, 0) / losses.length) : 0;
    const lossRate = losses.length / group.length;
    const expectancy = winRate * avgWin - lossRate * avgLoss;

    results.push({
      bucket,
      count: group.length,
      winRate: Math.round(winRate * 10000) / 100,
      avgPnl: Math.round(avgPnl * 100) / 100,
      expectancy: Math.round(expectancy * 100) / 100,
      totalPnl: Math.round(totalPnl * 100) / 100,
    });
  }

  return results.sort((a, b) => b.expectancy - a.expectancy);
}

// ---- Weekly Review Generator ---- //

export interface WeeklyReviewSummary {
  weekStart: string;
  weekEnd: string;
  totalTrades: number;
  closedTrades: number;
  totalPnl: number;
  winRate: number;
  expectancy: number;
  profitFactor: number;
  bestStrategy: BucketResult | null;
  worstStrategy: BucketResult | null;
  complianceComparison: BucketResult[];
  topMistakes: string[];
  topEdges: string[];
  suggestions: string[];
}

export function generateWeeklyReview(
  trades: TradeForCalc[],
  weekStart: Date,
  weekEnd: Date
): WeeklyReviewSummary {
  const weekTrades = trades.filter((t) => {
    const d = new Date(t.exitDatetime || t.entryDatetime);
    return d >= weekStart && d <= weekEnd;
  });

  const closed = weekTrades.filter((t) => t.status === "closed");
  const pnl = closed.reduce((sum, t) => sum + calcTradePnl(t), 0);
  const winRate = calcWinRate(weekTrades);
  const expectancy = calcExpectancy(weekTrades);
  const profitFactor = calcProfitFactor(weekTrades);

  const strategyBuckets = bucketByStrategy(weekTrades);
  const bestStrategy = strategyBuckets.length > 0 ? strategyBuckets[0] : null;
  const worstStrategy =
    strategyBuckets.length > 0 ? strategyBuckets[strategyBuckets.length - 1] : null;

  const complianceComparison = bucketByCompliance(weekTrades);

  // Generate mistake patterns
  const topMistakes: string[] = [];
  const nonCompliant = weekTrades.filter((t) => !t.ruleCompliant);
  if (nonCompliant.length > 0) {
    topMistakes.push(`${nonCompliant.length} non-compliant trades this week`);
  }
  const emotional = weekTrades.filter((t) => t.emotionScore && t.emotionScore >= 4);
  if (emotional.length > 0) {
    topMistakes.push(`${emotional.length} trades made under high emotion`);
  }
  const earningsLosses = closed.filter((t) => t.earningsEvent && calcTradePnl(t) < 0);
  if (earningsLosses.length > 0) {
    topMistakes.push(`${earningsLosses.length} losing earnings trades`);
  }

  // Generate edges
  const topEdges: string[] = [];
  if (bestStrategy && bestStrategy.expectancy > 0) {
    topEdges.push(`${bestStrategy.bucket} has positive expectancy ($${bestStrategy.expectancy})`);
  }
  const compliant = complianceComparison.find((b) => b.bucket === "Compliant");
  if (compliant && compliant.expectancy > 0) {
    topEdges.push(`Compliant trades have $${compliant.expectancy} expectancy`);
  }

  // Suggestions
  const suggestions: string[] = [];
  if (nonCompliant.length > 0) {
    suggestions.push("Stick to your trading rules - non-compliant trades are hurting performance");
  }
  if (worstStrategy && worstStrategy.expectancy < 0) {
    suggestions.push(`Consider reducing ${worstStrategy.bucket} trades`);
  }
  if (emotional.length > 0) {
    suggestions.push("Take breaks when emotional - high emotion trades underperform");
  }

  return {
    weekStart: weekStart.toISOString().split("T")[0],
    weekEnd: weekEnd.toISOString().split("T")[0],
    totalTrades: weekTrades.length,
    closedTrades: closed.length,
    totalPnl: Math.round(pnl * 100) / 100,
    winRate: Math.round(winRate * 10000) / 100,
    expectancy: Math.round(expectancy * 100) / 100,
    profitFactor: Math.round(profitFactor * 100) / 100,
    bestStrategy,
    worstStrategy,
    complianceComparison,
    topMistakes,
    topEdges,
    suggestions,
  };
}
