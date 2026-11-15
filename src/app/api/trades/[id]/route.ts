import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { content } = await request.json();
  if (typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "Note content is required" }, { status: 400 });
  }
  const trade = await prisma.trade.findUnique({ where: { id: params.id } });
  if (!trade) {
    return NextResponse.json({ error: "Trade not found" }, { status: 404 });
  }
  const note = await prisma.note.create({ data: { tradeId: trade.id, content: content.trim() } });
  return NextResponse.json(note, { status: 201 });
}

// ============================================================
// GET /api/trades/[id] — Fetch a single trade with legs & notes
// ============================================================

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const trade = await prisma.trade.findUnique({
      where: { id },
      include: {
        legs: true,
        notes: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!trade) {
      return NextResponse.json(
        { error: "Trade not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(trade);
  } catch (error) {
    console.error(`GET /api/trades/[id] error:`, error);
    return NextResponse.json(
      { error: "Failed to fetch trade" },
      { status: 500 }
    );
  }
}

// ============================================================
// PUT /api/trades/[id] — Update a trade (fields, legs, close)
// ============================================================

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    // Verify the trade exists
    const existing = await prisma.trade.findUnique({
      where: { id },
      include: { legs: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Trade not found" },
        { status: 404 }
      );
    }

    // Destructure legs separately from trade-level fields
    const { legs, ...tradeFields } = body;

    // Build the trade update data, only including fields that are present
    const updateData: Record<string, unknown> = {};

    const directFields = [
      "underlying",
      "strategyType",
      "direction",
      "status",
      "entryPriceTotal",
      "exitPriceTotal",
      "qty",
      "fees",
      "pnl",
      "maxRisk",
      "thesis",
      "setupType",
      "ruleCompliant",
      "emotionScore",
      "marketTrend",
      "vixLevel",
      "earningsEvent",
    ] as const;

    for (const field of directFields) {
      if (tradeFields[field] !== undefined) {
        updateData[field] = tradeFields[field];
      }
    }

    // Handle underlying uppercase normalization
    if (typeof updateData.underlying === "string") {
      updateData.underlying = (updateData.underlying as string).toUpperCase();
    }

    // Handle datetime fields
    if (tradeFields.entryDatetime !== undefined) {
      updateData.entryDatetime = new Date(tradeFields.entryDatetime);
    }
    if (tradeFields.exitDatetime !== undefined) {
      updateData.exitDatetime = tradeFields.exitDatetime
        ? new Date(tradeFields.exitDatetime)
        : null;
    }

    // Handle tags — accept string or array
    if (tradeFields.tags !== undefined) {
      updateData.tags =
        tradeFields.tags === null
          ? null
          : typeof tradeFields.tags === "string"
            ? tradeFields.tags
            : JSON.stringify(tradeFields.tags);
    }

    // --- Auto-calculate PnL when closing ---
    // Determine the final values to use for calculation (prefer incoming, fall back to existing)
    const finalStatus =
      (updateData.status as string | undefined) ?? existing.status;
    const finalEntryPriceTotal =
      (updateData.entryPriceTotal as number | undefined) ??
      existing.entryPriceTotal;
    const finalExitPriceTotal =
      (updateData.exitPriceTotal as number | null | undefined) ??
      existing.exitPriceTotal;
    const finalQty =
      (updateData.qty as number | undefined) ?? existing.qty;
    const finalFees =
      (updateData.fees as number | undefined) ?? existing.fees;

    // Auto-set exitDatetime when status changes to closed and no explicit exitDatetime provided
    if (
      finalStatus === "closed" &&
      existing.status !== "closed" &&
      updateData.exitDatetime === undefined
    ) {
      updateData.exitDatetime = new Date();
    }

    // Auto-calculate PnL when status becomes "closed" and PnL is not explicitly provided
    if (
      finalStatus === "closed" &&
      updateData.pnl === undefined &&
      finalEntryPriceTotal !== null &&
      finalEntryPriceTotal !== undefined &&
      finalExitPriceTotal !== null &&
      finalExitPriceTotal !== undefined
    ) {
      updateData.pnl =
        (finalEntryPriceTotal - finalExitPriceTotal) *
          finalQty *
          100 -
        finalFees;
    }

    // --- Handle legs: upsert existing, create new, delete removed ---
    if (legs !== undefined && Array.isArray(legs)) {
      const incomingIds = legs
        .map(
          (leg: { id?: string }) => leg.id
        )
        .filter(Boolean) as string[];

      // Delete legs that are no longer present
      const existingLegIds = existing.legs.map((l) => l.id);
      const legsToDelete = existingLegIds.filter(
        (eid) => !incomingIds.includes(eid)
      );

      if (legsToDelete.length > 0) {
        await prisma.tradeLeg.deleteMany({
          where: { id: { in: legsToDelete } },
        });
      }

      // Upsert each leg
      for (const leg of legs as Array<{
        id?: string;
        optionType: string;
        side: string;
        strike: number;
        expiration: string;
        contracts?: number;
        entryPrice: number;
        exitPrice?: number | null;
        deltaEntry?: number | null;
        ivEntry?: number | null;
      }>) {
        const legData = {
          optionType: leg.optionType,
          side: leg.side,
          strike: leg.strike,
          expiration: new Date(leg.expiration),
          contracts: leg.contracts ?? 1,
          entryPrice: leg.entryPrice,
          exitPrice: leg.exitPrice ?? null,
          deltaEntry: leg.deltaEntry ?? null,
          ivEntry: leg.ivEntry ?? null,
        };

        if (leg.id && existingLegIds.includes(leg.id)) {
          // Update existing leg
          await prisma.tradeLeg.update({
            where: { id: leg.id },
            data: legData,
          });
        } else {
          // Create new leg
          await prisma.tradeLeg.create({
            data: {
              ...legData,
              tradeId: id,
            },
          });
        }
      }
    }

    // Perform the trade update
    const updatedTrade = await prisma.trade.update({
      where: { id },
      data: updateData,
      include: {
        legs: true,
        notes: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return NextResponse.json(updatedTrade);
  } catch (error) {
    console.error(`PUT /api/trades/[id] error:`, error);
    return NextResponse.json(
      { error: "Failed to update trade" },
      { status: 500 }
    );
  }
}

// ============================================================
// DELETE /api/trades/[id] — Delete a trade (cascades legs & notes)
// ============================================================

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Verify the trade exists
    const existing = await prisma.trade.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Trade not found" },
        { status: 404 }
      );
    }

    // Prisma schema has onDelete: Cascade on TradeLeg and Note,
    // so deleting the trade will automatically remove related legs and notes.
    // However, SQLite may not enforce cascades depending on pragma settings,
    // so we explicitly delete related records first for safety.
    await prisma.note.deleteMany({ where: { tradeId: id } });
    await prisma.tradeLeg.deleteMany({ where: { tradeId: id } });
    await prisma.trade.delete({ where: { id } });

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error(`DELETE /api/trades/[id] error:`, error);
    return NextResponse.json(
      { error: "Failed to delete trade" },
      { status: 500 }
    );
  }
}
