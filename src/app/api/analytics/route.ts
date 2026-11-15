import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";
import {
  calcWinRate,
  calcExpectancy,
  calcProfitFactor,
  calcEquityCurve,
  calcMaxDrawdown,
  bucketByStrategy,
  bucketByDTE,
  bucketByDelta,
  bucketByIVRank,
  bucketByCompliance,
  bucketByEmotion,
  bucketByRegime,
  type TradeForCalc,
} from "@/lib/calculations";

export async function GET() {
  try {
    const trades = await prisma.trade.findMany({
      include: { legs: true },
    });

    // Cast Prisma records to the calculation interface
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

    const winRate = calcWinRate(tradesForCalc);
    const expectancy = calcExpectancy(tradesForCalc);
    const profitFactor = calcProfitFactor(tradesForCalc);
    const equityCurve = calcEquityCurve(tradesForCalc);
    const maxDrawdown = calcMaxDrawdown(tradesForCalc);

    const buckets = {
      strategy: bucketByStrategy(tradesForCalc),
      dte: bucketByDTE(tradesForCalc),
      delta: bucketByDelta(tradesForCalc),
      ivRank: bucketByIVRank(tradesForCalc),
      compliance: bucketByCompliance(tradesForCalc),
      emotion: bucketByEmotion(tradesForCalc),
      regime: bucketByRegime(tradesForCalc),
    };

    return NextResponse.json({
      overview: {
        totalTrades: trades.length,
        closedTrades: trades.filter((t) => t.status === "closed").length,
        openTrades: trades.filter((t) => t.status === "open").length,
        winRate: winRate * 100,
        expectancy,
        profitFactor: Number.isFinite(profitFactor) ? profitFactor : null,
        maxDrawdown,
      },
      equityCurve,
      buckets,
    });
  } catch (error) {
    console.error("Analytics GET error:", error);
    return NextResponse.json(
      { error: "Failed to compute analytics" },
      { status: 500 }
    );
  }
}
