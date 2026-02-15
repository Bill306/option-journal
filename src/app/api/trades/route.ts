import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ============================================================
// GET /api/trades — List trades with filtering, search & sort
// ============================================================

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const status = searchParams.get("status");
    const strategyType = searchParams.get("strategyType");
    const underlying = searchParams.get("underlying");
    const direction = searchParams.get("direction");
    const search = searchParams.get("search");
    const sortBy = searchParams.get("sortBy") || "entryDatetime";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    // Build dynamic where clause
    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    if (strategyType) {
      where.strategyType = strategyType;
    }

    if (underlying) {
      where.underlying = { contains: underlying.toUpperCase() };
    }

    if (direction) {
      where.direction = direction;
    }

    if (search) {
      where.OR = [
        { underlying: { contains: search.toUpperCase() } },
        { thesis: { contains: search } },
        { setupType: { contains: search } },
        { tags: { contains: search } },
      ];
    }

    // Validate sortBy against allowed columns to prevent injection
    const allowedSortFields = [
      "entryDatetime",
      "exitDatetime",
      "underlying",
      "strategyType",
      "direction",
      "status",
      "pnl",
      "entryPriceTotal",
      "exitPriceTotal",
      "qty",
      "fees",
      "maxRisk",
      "emotionScore",
      "vixLevel",
      "createdAt",
      "updatedAt",
    ];

    const safeSortBy = allowedSortFields.includes(sortBy)
      ? sortBy
      : "entryDatetime";
    const safeSortOrder = sortOrder === "asc" ? "asc" : "desc";

    const trades = await prisma.trade.findMany({
      where,
      include: {
        legs: true,
        notes: {
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { [safeSortBy]: safeSortOrder },
    });

    return NextResponse.json(trades);
  } catch (error) {
    console.error("GET /api/trades error:", error);
    return NextResponse.json(
      { error: "Failed to fetch trades" },
      { status: 500 }
    );
  }
}

// ============================================================
// POST /api/trades — Create a new trade with legs
// ============================================================

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      underlying,
      strategyType,
      direction,
      status = "open",
      entryDatetime,
      exitDatetime,
      entryPriceTotal,
      exitPriceTotal,
      qty = 1,
      fees = 0,
      pnl,
      maxRisk,
      thesis,
      setupType,
      ruleCompliant = true,
      emotionScore,
      marketTrend,
      vixLevel,
      earningsEvent = false,
      tags,
      legs = [],
    } = body;

    // --- Validation ---
    if (!underlying || !strategyType || !direction || !entryDatetime || entryPriceTotal === undefined) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: underlying, strategyType, direction, entryDatetime, entryPriceTotal",
        },
        { status: 400 }
      );
    }

    // --- Auto-calculate PnL ---
    // (entryPriceTotal - exitPriceTotal) * qty * 100 - fees
    let calculatedPnl = pnl ?? null;
    if (
      calculatedPnl === null &&
      entryPriceTotal !== null &&
      entryPriceTotal !== undefined &&
      exitPriceTotal !== null &&
      exitPriceTotal !== undefined
    ) {
      calculatedPnl =
        (entryPriceTotal - exitPriceTotal) * qty * 100 - fees;
    }

    // Serialize tags if provided as array
    const tagsValue =
      tags !== undefined && tags !== null
        ? typeof tags === "string"
          ? tags
          : JSON.stringify(tags)
        : null;

    const trade = await prisma.trade.create({
      data: {
        underlying: underlying.toUpperCase(),
        strategyType,
        direction,
        status,
        entryDatetime: new Date(entryDatetime),
        exitDatetime: exitDatetime ? new Date(exitDatetime) : null,
        entryPriceTotal,
        exitPriceTotal: exitPriceTotal ?? null,
        qty,
        fees,
        pnl: calculatedPnl,
        maxRisk: maxRisk ?? null,
        thesis: thesis ?? null,
        setupType: setupType ?? null,
        ruleCompliant,
        emotionScore: emotionScore ?? null,
        marketTrend: marketTrend ?? null,
        vixLevel: vixLevel ?? null,
        earningsEvent,
        tags: tagsValue,
        legs: {
          create: legs.map(
            (leg: {
              optionType: string;
              side: string;
              strike: number;
              expiration: string;
              contracts?: number;
              entryPrice: number;
              exitPrice?: number | null;
              deltaEntry?: number | null;
              ivEntry?: number | null;
            }) => ({
              optionType: leg.optionType,
              side: leg.side,
              strike: leg.strike,
              expiration: new Date(leg.expiration),
              contracts: leg.contracts ?? 1,
              entryPrice: leg.entryPrice,
              exitPrice: leg.exitPrice ?? null,
              deltaEntry: leg.deltaEntry ?? null,
              ivEntry: leg.ivEntry ?? null,
            })
          ),
        },
      },
      include: {
        legs: true,
        notes: true,
      },
    });

    return NextResponse.json(trade, { status: 201 });
  } catch (error) {
    console.error("POST /api/trades error:", error);
    return NextResponse.json(
      { error: "Failed to create trade" },
      { status: 500 }
    );
  }
}
