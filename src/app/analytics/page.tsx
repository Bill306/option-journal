"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { STRATEGY_LABELS } from "@/lib/constants";
import { formatCurrency, formatPercent, cn, pnlColor } from "@/lib/utils";
import { Loading } from "@/components/ui/loading";

// ---------- Types ---------- //

interface BucketResult {
  bucket: string;
  count: number;
  winRate: number;
  avgPnl: number;
  expectancy: number;
  totalPnl: number;
}

interface EquityPoint {
  date: string;
  equity: number;
  drawdown: number;
}

interface AnalyticsData {
  overview: {
    totalTrades: number;
    closedTrades: number;
    openTrades: number;
    winRate: number;
    expectancy: number;
    profitFactor: number;
    maxDrawdown: number;
  };
  equityCurve: EquityPoint[];
  buckets: {
    strategy: BucketResult[];
    dte: BucketResult[];
    delta: BucketResult[];
    ivRank: BucketResult[];
    compliance: BucketResult[];
    emotion: BucketResult[];
    regime: BucketResult[];
  };
}

// ---------- Constants ---------- //

const COLORS = {
  profit: "#22c55e",
  loss: "#ef4444",
  blue: "#3b82f6",
};

const TABS = [
  { key: "strategy", label: "Strategy Edge" },
  { key: "regime", label: "Regime Edge" },
  { key: "dte-delta-iv", label: "DTE / Delta / IV" },
  { key: "behavior", label: "Behavior" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

// ---------- Reusable Sub-components ---------- //

function BucketTable({
  data,
  labelMap,
}: {
  data: BucketResult[];
  labelMap?: Record<string, string>;
}) {
  const sorted = [...data].sort((a, b) => b.expectancy - a.expectancy);

  if (sorted.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">No data available</div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 font-medium text-gray-500">
              Bucket
            </th>
            <th className="text-right py-3 px-4 font-medium text-gray-500">
              Count
            </th>
            <th className="text-right py-3 px-4 font-medium text-gray-500">
              Win Rate
            </th>
            <th className="text-right py-3 px-4 font-medium text-gray-500">
              Avg PnL
            </th>
            <th className="text-right py-3 px-4 font-medium text-gray-500">
              Expectancy
            </th>
            <th className="text-right py-3 px-4 font-medium text-gray-500">
              Total PnL
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={row.bucket}
              className="border-b border-gray-100 hover:bg-gray-50"
            >
              <td className="py-3 px-4 font-medium">
                {labelMap?.[row.bucket] ?? row.bucket}
              </td>
              <td className="py-3 px-4 text-right">{row.count}</td>
              <td className="py-3 px-4 text-right">
                {formatPercent(row.winRate)}
              </td>
              <td className={cn("py-3 px-4 text-right", pnlColor(row.avgPnl))}>
                {formatCurrency(row.avgPnl)}
              </td>
              <td
                className={cn(
                  "py-3 px-4 text-right font-semibold",
                  pnlColor(row.expectancy)
                )}
              >
                {formatCurrency(row.expectancy)}
              </td>
              <td
                className={cn("py-3 px-4 text-right", pnlColor(row.totalPnl))}
              >
                {formatCurrency(row.totalPnl)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExpectancyBarChart({
  data,
  labelMap,
}: {
  data: BucketResult[];
  labelMap?: Record<string, string>;
}) {
  const sorted = [...data].sort((a, b) => b.expectancy - a.expectancy);

  const chartData = sorted.map((row) => ({
    name: labelMap?.[row.bucket] ?? row.bucket,
    expectancy: row.expectancy,
  }));

  if (chartData.length === 0) {
    return null;
  }

  return (
    <div className="h-72 mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 10, right: 30, left: 20, bottom: 40 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12 }}
            angle={-30}
            textAnchor="end"
            height={60}
          />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={(value) => [formatCurrency(Number(value)), "Expectancy"]}
          />
          <Bar dataKey="expectancy" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell
                key={index}
                fill={
                  entry.expectancy >= 0 ? COLORS.profit : COLORS.loss
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function SectionPanel({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="card">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-left"
      >
        <h3 className="text-base font-semibold text-gray-800">{title}</h3>
        <span className="text-gray-400 text-lg">{open ? "\u25B2" : "\u25BC"}</span>
      </button>
      {open && <div className="mt-4">{children}</div>}
    </div>
  );
}

// ---------- Tab Content ---------- //

function StrategyEdgeTab({ data }: { data: BucketResult[] }) {
  return (
    <div className="space-y-6">
      <div className="card">
        <h3 className="text-base font-semibold text-gray-800 mb-4">
          Strategy Performance
        </h3>
        <BucketTable data={data} labelMap={STRATEGY_LABELS} />
        <ExpectancyBarChart data={data} labelMap={STRATEGY_LABELS} />
      </div>
    </div>
  );
}

function RegimeEdgeTab({ data }: { data: BucketResult[] }) {
  return (
    <div className="space-y-6">
      <div className="card">
        <h3 className="text-base font-semibold text-gray-800 mb-4">
          Market Regime Performance
        </h3>
        <BucketTable data={data} />
        <ExpectancyBarChart data={data} />
      </div>
    </div>
  );
}

function DteDeltaIvTab({
  dte,
  delta,
  ivRank,
}: {
  dte: BucketResult[];
  delta: BucketResult[];
  ivRank: BucketResult[];
}) {
  return (
    <div className="space-y-6">
      <SectionPanel title="DTE Buckets" defaultOpen={true}>
        <BucketTable data={dte} />
        <ExpectancyBarChart data={dte} />
      </SectionPanel>

      <SectionPanel title="Delta Buckets" defaultOpen={true}>
        <BucketTable data={delta} />
        <ExpectancyBarChart data={delta} />
      </SectionPanel>

      <SectionPanel title="IV Rank Buckets" defaultOpen={true}>
        <BucketTable data={ivRank} />
        <ExpectancyBarChart data={ivRank} />
      </SectionPanel>
    </div>
  );
}

function BehaviorTab({
  compliance,
  emotion,
}: {
  compliance: BucketResult[];
  emotion: BucketResult[];
}) {
  const compliant = compliance.find((b) => b.bucket === "Compliant");
  const nonCompliant = compliance.find((b) => b.bucket === "Non-compliant");

  // Derive insights
  const insights: string[] = [];
  if (compliant && nonCompliant) {
    if (compliant.expectancy > 0 && nonCompliant.expectancy <= 0) {
      insights.push(
        "Compliant trades are profitable while non-compliant trades lose money"
      );
    }
    if (
      compliant.expectancy > 0 &&
      nonCompliant.expectancy > 0 &&
      compliant.expectancy > nonCompliant.expectancy * 2
    ) {
      insights.push(
        `Compliant trades have ${Math.round(compliant.expectancy / nonCompliant.expectancy)}x better expectancy`
      );
    }
    if (compliant.winRate > nonCompliant.winRate) {
      insights.push(
        `Compliant trades win ${formatPercent(compliant.winRate)} vs ${formatPercent(nonCompliant.winRate)} for non-compliant`
      );
    }
  }

  const calmBucket = emotion.find((b) => b.bucket === "Calm (1-2)");
  const emotionalBucket = emotion.find((b) => b.bucket === "Emotional (4-5)");
  if (calmBucket && emotionalBucket) {
    if (calmBucket.expectancy > emotionalBucket.expectancy) {
      insights.push(
        "Calm trades outperform emotional trades - patience pays off"
      );
    }
  }

  return (
    <div className="space-y-6">
      {/* Compliance Comparison Cards */}
      <div>
        <h3 className="text-base font-semibold text-gray-800 mb-4">
          Rule Compliance Impact
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ComplianceCard
            title="Compliant Trades"
            data={compliant}
            accent="green"
          />
          <ComplianceCard
            title="Non-compliant Trades"
            data={nonCompliant}
            accent="red"
          />
        </div>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="card bg-blue-50 border-blue-200">
          <h3 className="text-base font-semibold text-blue-800 mb-3">
            Key Insights
          </h3>
          <ul className="space-y-2">
            {insights.map((insight, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-blue-700"
              >
                <span className="mt-0.5 shrink-0 h-1.5 w-1.5 rounded-full bg-blue-500" />
                {insight}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Emotion Analysis */}
      <div className="card">
        <h3 className="text-base font-semibold text-gray-800 mb-4">
          Emotion Analysis
        </h3>
        <BucketTable data={emotion} />
        <ExpectancyBarChart data={emotion} />
      </div>
    </div>
  );
}

function ComplianceCard({
  title,
  data,
  accent,
}: {
  title: string;
  data: BucketResult | undefined;
  accent: "green" | "red";
}) {
  const borderColor =
    accent === "green" ? "border-green-300" : "border-red-300";
  const headerBg =
    accent === "green" ? "bg-green-50" : "bg-red-50";
  const headerText =
    accent === "green" ? "text-green-800" : "text-red-800";

  if (!data) {
    return (
      <div className={cn("card border-2", borderColor)}>
        <div className={cn("text-sm font-semibold mb-3 -mx-4 -mt-4 px-4 py-2 rounded-t-lg", headerBg, headerText)}>
          {title}
        </div>
        <div className="text-center text-gray-400 text-sm py-4">
          No trades in this category
        </div>
      </div>
    );
  }

  return (
    <div className={cn("card border-2", borderColor)}>
      <div className={cn("text-sm font-semibold mb-3 -mx-4 -mt-4 px-4 py-2 rounded-t-lg", headerBg, headerText)}>
        {title}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-gray-500">Count</div>
          <div className="text-lg font-bold">{data.count}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Win Rate</div>
          <div className="text-lg font-bold">{formatPercent(data.winRate)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Avg PnL</div>
          <div className={cn("text-lg font-bold", pnlColor(data.avgPnl))}>
            {formatCurrency(data.avgPnl)}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Expectancy</div>
          <div
            className={cn("text-lg font-bold", pnlColor(data.expectancy))}
          >
            {formatCurrency(data.expectancy)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Overview Header ---------- //

function OverviewHeader({ overview }: { overview: AnalyticsData["overview"] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
      <div className="card">
        <div className="card-header">Total Trades</div>
        <div className="card-value">{overview.totalTrades}</div>
      </div>
      <div className="card">
        <div className="card-header">Win Rate</div>
        <div className="card-value">
          {formatPercent(overview.winRate * 100)}
        </div>
      </div>
      <div className="card">
        <div className="card-header">Expectancy</div>
        <div className={cn("card-value", pnlColor(overview.expectancy))}>
          {formatCurrency(overview.expectancy)}
        </div>
      </div>
      <div className="card">
        <div className="card-header">Profit Factor</div>
        <div className="card-value">
          {overview.profitFactor === Infinity
            ? "\u221E"
            : overview.profitFactor.toFixed(2)}
        </div>
      </div>
      <div className="card">
        <div className="card-header">Max Drawdown</div>
        <div className="card-value text-loss">
          {formatPercent(overview.maxDrawdown)}
        </div>
      </div>
      <div className="card">
        <div className="card-header">Closed / Open</div>
        <div className="card-value">
          {overview.closedTrades}
          <span className="text-base font-normal text-gray-400">
            {" "}
            / {overview.openTrades}
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------- Main Page ---------- //

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("strategy");

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const res = await fetch("/api/analytics");
        if (!res.ok) throw new Error("Failed to fetch analytics");
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Analytics</h1>
        <Loading />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Analytics</h1>
        <div className="card text-center py-12">
          <p className="text-red-500 font-medium">
            {error ?? "No data available"}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary mt-4"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Analytics</h1>

      {/* Overview Metrics */}
      <OverviewHeader overview={data.overview} />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
              activeTab === tab.key
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "strategy" && (
        <StrategyEdgeTab data={data.buckets.strategy} />
      )}

      {activeTab === "regime" && (
        <RegimeEdgeTab data={data.buckets.regime} />
      )}

      {activeTab === "dte-delta-iv" && (
        <DteDeltaIvTab
          dte={data.buckets.dte}
          delta={data.buckets.delta}
          ivRank={data.buckets.ivRank}
        />
      )}

      {activeTab === "behavior" && (
        <BehaviorTab
          compliance={data.buckets.compliance}
          emotion={data.buckets.emotion}
        />
      )}
    </div>
  );
}
