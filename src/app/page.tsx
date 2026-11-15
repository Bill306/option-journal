"use client";

import { useEffect, useState } from "react";
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
} from "recharts";
import { MetricCard } from "@/components/ui/metric-card";
import { formatCurrency, formatPercent, formatDate } from "@/lib/utils";
import { STRATEGY_LABELS } from "@/lib/constants";
import { Loading } from "@/components/ui/loading";

interface Trade {
  id: string;
  underlying: string;
  strategyType: string;
  direction: string;
  entryDatetime: string;
  entryPriceTotal: number;
  maxRisk: number | null;
  status: string;
  pnl?: number;
}

interface EquityPoint {
  date: string;
  equity: number;
  drawdown: number;
}

interface Analytics {
  overview: {
    winRate: number;
    expectancy: number;
    profitFactor: number | null;
    maxDrawdown: number;
  };
  equityCurve: EquityPoint[];
}

export default function DashboardPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [tradesRes, analyticsRes] = await Promise.all([
          fetch("/api/trades"),
          fetch("/api/analytics"),
        ]);

        if (tradesRes.ok) {
          const tradesData = await tradesRes.json();
          setTrades(tradesData);
        }

        if (analyticsRes.ok) {
          const analyticsData = await analyticsRes.json();
          setAnalytics(analyticsData);
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return <Loading />;
  }

  const totalPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const openTrades = trades.filter((t) => t.status === "open");

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">{today}</p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total PnL"
          value={formatCurrency(totalPnl)}
          isPnl
          numericValue={totalPnl}
        />
        <MetricCard
          title="Win Rate"
          value={analytics ? formatPercent(analytics.overview.winRate) : "--"}
          subtitle={
            analytics
              ? `${trades.filter((t) => t.status === "closed" && (t.pnl ?? 0) > 0).length} wins / ${trades.filter((t) => t.status === "closed").length} closed`
              : undefined
          }
        />
        <MetricCard
          title="Expectancy"
          value={analytics ? formatCurrency(analytics.overview.expectancy) : "--"}
          subtitle="Per trade avg"
          isPnl
          numericValue={analytics?.overview.expectancy}
        />
        <MetricCard
          title="Profit Factor"
          value={analytics ? (analytics.overview.profitFactor === null ? "∞" : analytics.overview.profitFactor.toFixed(2)) : "--"}
          subtitle={
            analytics && (analytics.overview.profitFactor === null || analytics.overview.profitFactor >= 1.5)
              ? "Above target"
              : analytics
                ? "Below target"
                : undefined
          }
        />
      </div>

      {/* Equity Curve and Max Drawdown */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="card lg:col-span-3">
          <h2 className="text-sm font-medium text-gray-500 mb-4">
            Equity Curve
          </h2>
          {analytics && analytics.equityCurve.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={analytics.equityCurve}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12, fill: "#6b7280" }}
                    tickFormatter={(value: string) => {
                      const d = new Date(value);
                      return `${d.getMonth() + 1}/${d.getDate()}`;
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#6b7280" }}
                    tickFormatter={(value: number) =>
                      `$${value.toLocaleString()}`
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(value: unknown, name: unknown) => [
                      `$${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                      String(name) === "equity" ? "Equity" : "Drawdown",
                    ]}
                    labelFormatter={(label: unknown) => formatDate(String(label))}
                  />
                  <Area
                    type="monotone"
                    dataKey="drawdown"
                    fill="#ef4444"
                    fillOpacity={0.15}
                    stroke="none"
                  />
                  <Line
                    type="monotone"
                    dataKey="equity"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: "#22c55e" }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-72 flex items-center justify-center text-gray-400 text-sm">
              No equity data available yet. Start logging trades to see your
              equity curve.
            </div>
          )}
        </div>

        {/* Max Drawdown Card */}
        <div className="card flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-medium text-gray-500 mb-1">
              Max Drawdown
            </h2>
            <div className="text-2xl font-bold text-loss">
              {analytics
                ? formatPercent(analytics.overview.maxDrawdown)
                : "--"}
            </div>
            {analytics && (
              <p className="text-xs text-gray-400 mt-1">
                Of cumulative profit peak
              </p>
            )}
          </div>
          <div className="mt-4">
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className="bg-loss rounded-full h-2 transition-all"
                style={{
                  width: `${analytics ? Math.min(analytics.overview.maxDrawdown, 100) : 0}%`,
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>0%</span>
              <span>100%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Open Positions Table */}
      <div className="card">
        <h2 className="text-sm font-medium text-gray-500 mb-4">
          Open Positions
          {openTrades.length > 0 && (
            <span className="ml-2 badge-blue">{openTrades.length}</span>
          )}
        </h2>
        {openTrades.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-medium text-gray-500">
                    Underlying
                  </th>
                  <th className="text-left py-2 px-3 font-medium text-gray-500">
                    Strategy
                  </th>
                  <th className="text-left py-2 px-3 font-medium text-gray-500">
                    Direction
                  </th>
                  <th className="text-left py-2 px-3 font-medium text-gray-500">
                    Entry Date
                  </th>
                  <th className="text-right py-2 px-3 font-medium text-gray-500">
                    Entry Price
                  </th>
                  <th className="text-right py-2 px-3 font-medium text-gray-500">
                    Max Risk
                  </th>
                </tr>
              </thead>
              <tbody>
                {openTrades.map((trade) => (
                  <tr
                    key={trade.id}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-2 px-3 font-medium text-gray-900">
                      {trade.underlying}
                    </td>
                    <td className="py-2 px-3 text-gray-600">
                      {STRATEGY_LABELS[trade.strategyType] || trade.strategyType}
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={
                          trade.direction === "bull"
                            ? "badge-green"
                            : trade.direction === "bear"
                              ? "badge-red"
                              : "badge-gray"
                        }
                      >
                        {trade.direction.charAt(0).toUpperCase() +
                          trade.direction.slice(1)}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-gray-600">
                      {formatDate(trade.entryDatetime)}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-600">
                      {formatCurrency(trade.entryPriceTotal)}
                    </td>
                    <td className="py-2 px-3 text-right text-loss font-medium">
                      {trade.maxRisk === null ? "—" : formatCurrency(trade.maxRisk)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400 text-sm">
            No open positions. Click &quot;New Trade&quot; to log a trade.
          </div>
        )}
      </div>
    </div>
  );
}
