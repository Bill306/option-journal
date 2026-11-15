import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";
import {
  generateWeeklyReview,
  type TradeForCalc,
} from "@/lib/calculations";

/**
 * Returns the Monday of the week that contains the given date.
 */
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday, 1 = Monday, ...
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const weekStartParam = searchParams.get("weekStart");

    // Determine week boundaries
    const weekStart = weekStartParam
      ? new Date(weekStartParam)
      : getMonday(new Date());
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // Fetch all trades (the review generator filters by date internally)
    const trades = await prisma.trade.findMany({
      include: { legs: true },
    });

    const tradesForCalc: TradeForCalc[] = trades.map((t) => ({
      pnl: t.pnl,
      status: t.status,
      entryPriceTotal: t.entryPriceTotal,
      exitPriceTotal: t.exitPriceTotal,
      qty: t.qty,
      fees: t.fees,
      strategyType: t.strategyType,
      direction: t.direction,
      ruleCompliant: t.ruleCompliant,
      emotionScore: t.emotionScore,
      earningsEvent: t.earningsEvent,
      vixLevel: t.vixLevel,
      marketTrend: t.marketTrend,
      entryDatetime: t.entryDatetime,
      exitDatetime: t.exitDatetime,
      legs: t.legs.map((l) => ({
        optionType: l.optionType,
        side: l.side,
        strike: l.strike,
        contracts: l.contracts,
        entryPrice: l.entryPrice,
        exitPrice: l.exitPrice,
        deltaEntry: l.deltaEntry,
        ivEntry: l.ivEntry,
        expiration: l.expiration,
      })),
    }));

    const review = generateWeeklyReview(tradesForCalc, weekStart, weekEnd);

    return NextResponse.json(review);
  } catch (error) {
    console.error("Review GET error:", error);
    return NextResponse.json(
      { error: "Failed to generate weekly review" },
      { status: 500 }
    );
  }
}
