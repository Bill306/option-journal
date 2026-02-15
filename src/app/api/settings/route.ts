import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [templates, bucketConfigs] = await Promise.all([
      prisma.strategyTemplate.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.bucketConfig.findMany({ orderBy: { createdAt: "desc" } }),
    ]);

    return NextResponse.json({ templates, bucketConfigs });
  } catch (error) {
    console.error("Settings GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, data } = body;

    if (!type || !data) {
      return NextResponse.json(
        { error: "Missing required fields: type and data" },
        { status: 400 }
      );
    }

    if (type === "template") {
      const { name, strategyType, defaultLegs } = data;

      if (!name || !strategyType || !defaultLegs) {
        return NextResponse.json(
          { error: "Template requires name, strategyType, and defaultLegs" },
          { status: 400 }
        );
      }

      const template = await prisma.strategyTemplate.create({
        data: {
          name,
          strategyType,
          defaultLegs:
            typeof defaultLegs === "string"
              ? defaultLegs
              : JSON.stringify(defaultLegs),
        },
      });

      return NextResponse.json(template, { status: 201 });
    }

    if (type === "bucket") {
      const { category, buckets } = data;

      if (!category || !buckets) {
        return NextResponse.json(
          { error: "BucketConfig requires category and buckets" },
          { status: 400 }
        );
      }

      const bucketConfig = await prisma.bucketConfig.create({
        data: {
          category,
          buckets:
            typeof buckets === "string" ? buckets : JSON.stringify(buckets),
        },
      });

      return NextResponse.json(bucketConfig, { status: 201 });
    }

    return NextResponse.json(
      { error: 'Invalid type. Must be "template" or "bucket"' },
      { status: 400 }
    );
  } catch (error) {
    console.error("Settings PUT error:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
