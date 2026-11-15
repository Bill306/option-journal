"use client";

import { useEffect, useState, useCallback } from "react";
import { startOfWeek, endOfWeek, addWeeks, subWeeks, format } from "date-fns";
import { MetricCard } from "@/components/ui/metric-card";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { STRATEGY_LABELS } from "@/lib/constants";
import { Loading } from "@/components/ui/loading";

interface StrategyResult {
  bucket: string;
  count: number;
  winRate: number;
  avgPnl: number;
  expectancy: number;
  totalPnl: number;
}

interface BucketResult {
  bucket: string;
  count: number;
  winRate: number;
  avgPnl: number;
  expectancy: number;
  totalPnl: number;
}

interface WeeklyReviewSummary {
  weekStart: string;
  weekEnd: string;
  totalTrades: number;
  closedTrades: number;
  totalPnl: number;
  winRate: number;
  expectancy: number;
  profitFactor: number | null;
  bestStrategy: StrategyResult | null;
  worstStrategy: StrategyResult | null;
  complianceComparison: BucketResult[];
  topMistakes: string[];
  topEdges: string[];
  suggestions: string[];
}

function getMonday(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

export default function WeeklyReviewPage() {
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()));
  const [review, setReview] = useState<WeeklyReviewSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReview = useCallback(async (monday: Date) => {
    setLoading(true);
    setError(null);
    try {
      const dateStr = format(monday, "yyyy-MM-dd");
      const res = await fetch(`/api/review?weekStart=${dateStr}`);
      if (!res.ok) {
        throw new Error("Failed to fetch weekly review");
      }
      const data: WeeklyReviewSummary = await res.json();
      setReview(data);
    } catch (err) {
      console.error("Failed to fetch weekly review:", err);
      setError("Failed to load weekly review data.");
      setReview(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReview(weekStart);
  }, [weekStart, fetchReview]);

  const goToPreviousWeek = () => {
    setWeekStart((prev) => subWeeks(prev, 1));
  };

  const goToNextWeek = () => {
    setWeekStart((prev) => addWeeks(prev, 1));
  };

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const headerLabel = `Weekly Review: ${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d, yyyy")}`;

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{headerLabel}</h1>
        </div>
        <Loading />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{headerLabel}</h1>
        </div>
        <div className="card text-center py-8 text-gray-500 text-sm">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Week Header with Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={goToPreviousWeek}
            className="btn-secondary flex items-center gap-1"
            aria-label="Previous week"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Prev
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{headerLabel}</h1>
          <button
            onClick={goToNextWeek}
            className="btn-secondary flex items-center gap-1"
            aria-label="Next week"
          >
            Next
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>

      {review && (
        <>
          {/* Overview Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Total PnL"
              value={formatCurrency(review.totalPnl)}
              isPnl
              numericValue={review.totalPnl}
            />
            <MetricCard
              title="Win Rate"
              value={formatPercent(review.winRate)}
              subtitle={`${review.closedTrades} closed trades`}
            />
            <MetricCard
              title="Expectancy"
              value={formatCurrency(review.expectancy)}
              subtitle="Per trade avg"
              isPnl
              numericValue={review.expectancy}
            />
            <MetricCard
              title="Profit Factor"
              value={review.profitFactor === null ? "∞" : review.profitFactor.toFixed(2)}
              subtitle={
                review.profitFactor === null || review.profitFactor >= 1.5 ? "Above target" : "Below target"
              }
            />
          </div>

          {/* Performance Summary */}
          <div className="card">
            <h2 className="text-sm font-medium text-gray-500 mb-3">
              Performance Summary
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-gray-500">Total Trades</span>
                <p className="text-xl font-bold text-gray-900">
                  {review.totalTrades}
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Closed Trades</span>
                <p className="text-xl font-bold text-gray-900">
                  {review.closedTrades}
                </p>
              </div>
            </div>
          </div>

          {/* Best & Worst Strategy */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Best Strategy */}
            <div className="bg-white rounded-lg border-2 border-green-300 p-4 shadow-sm">
              <h2 className="text-sm font-medium text-green-700 mb-3">
                Best Strategy
              </h2>
              {review.bestStrategy ? (
                <div className="space-y-2">
                  <p className="text-lg font-bold text-gray-900">
                    {STRATEGY_LABELS[review.bestStrategy.bucket] ||
                      review.bestStrategy.bucket}
                  </p>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">Count</span>
                      <p className="font-semibold text-gray-900">
                        {review.bestStrategy.count}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">Win Rate</span>
                      <p className="font-semibold text-gray-900">
                        {formatPercent(review.bestStrategy.winRate)}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">Expectancy</span>
                      <p className="font-semibold text-green-600">
                        {formatCurrency(review.bestStrategy.expectancy)}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400">
                  No strategy data available
                </p>
              )}
            </div>

            {/* Worst Strategy */}
            <div className="bg-white rounded-lg border-2 border-red-300 p-4 shadow-sm">
              <h2 className="text-sm font-medium text-red-700 mb-3">
                Worst Strategy
              </h2>
              {review.worstStrategy ? (
                <div className="space-y-2">
                  <p className="text-lg font-bold text-gray-900">
                    {STRATEGY_LABELS[review.worstStrategy.bucket] ||
                      review.worstStrategy.bucket}
                  </p>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">Count</span>
                      <p className="font-semibold text-gray-900">
                        {review.worstStrategy.count}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">Win Rate</span>
                      <p className="font-semibold text-gray-900">
                        {formatPercent(review.worstStrategy.winRate)}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">Expectancy</span>
                      <p className="font-semibold text-red-600">
                        {formatCurrency(review.worstStrategy.expectancy)}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400">
                  No strategy data available
                </p>
              )}
            </div>
          </div>

          {/* Top Mistakes, Edges, Suggestions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Top Mistakes */}
            <div className="bg-red-50 rounded-lg border border-red-200 p-4 shadow-sm">
              <h2 className="text-sm font-medium text-red-700 mb-3">
                Top Mistakes
              </h2>
              {review.topMistakes.length > 0 ? (
                <ol className="space-y-2">
                  {review.topMistakes.map((mistake, idx) => (
                    <li
                      key={idx}
                      className="text-sm text-red-800 flex items-start gap-2"
                    >
                      <span className="font-semibold text-red-600 shrink-0">
                        {idx + 1}.
                      </span>
                      {mistake}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-red-400">
                  No mistakes identified this week
                </p>
              )}
            </div>

            {/* Top Edges */}
            <div className="bg-green-50 rounded-lg border border-green-200 p-4 shadow-sm">
              <h2 className="text-sm font-medium text-green-700 mb-3">
                Top Edges
              </h2>
              {review.topEdges.length > 0 ? (
                <ol className="space-y-2">
                  {review.topEdges.map((edge, idx) => (
                    <li
                      key={idx}
                      className="text-sm text-green-800 flex items-start gap-2"
                    >
                      <span className="font-semibold text-green-600 shrink-0">
                        {idx + 1}.
                      </span>
                      {edge}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-green-400">
                  No edges identified this week
                </p>
              )}
            </div>

            {/* Suggestions for Next Week */}
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-4 shadow-sm">
              <h2 className="text-sm font-medium text-blue-700 mb-3">
                Suggestions for Next Week
              </h2>
              {review.suggestions.length > 0 ? (
                <ol className="space-y-2">
                  {review.suggestions.map((suggestion, idx) => (
                    <li
                      key={idx}
                      className="text-sm text-blue-800 flex items-start gap-2"
                    >
                      <span className="font-semibold text-blue-600 shrink-0">
                        {idx + 1}.
                      </span>
                      {suggestion}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-blue-400">No suggestions</p>
              )}
            </div>
          </div>

          {/* Compliance Comparison */}
          {review.complianceComparison.length > 0 && (
            <div className="card">
              <h2 className="text-sm font-medium text-gray-500 mb-4">
                Compliance Comparison
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 font-medium text-gray-500">
                        Compliance
                      </th>
                      <th className="text-right py-2 px-3 font-medium text-gray-500">
                        Trades
                      </th>
                      <th className="text-right py-2 px-3 font-medium text-gray-500">
                        Win Rate
                      </th>
                      <th className="text-right py-2 px-3 font-medium text-gray-500">
                        Avg PnL
                      </th>
                      <th className="text-right py-2 px-3 font-medium text-gray-500">
                        Expectancy
                      </th>
                      <th className="text-right py-2 px-3 font-medium text-gray-500">
                        Total PnL
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {review.complianceComparison.map((row) => {
                      const isCompliant =
                        row.bucket.toLowerCase() === "compliant";
                      return (
                        <tr
                          key={row.bucket}
                          className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                        >
                          <td className="py-2 px-3 font-medium">
                            <span
                              className={
                                isCompliant ? "badge-green" : "badge-red"
                              }
                            >
                              {row.bucket}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right text-gray-600">
                            {row.count}
                          </td>
                          <td className="py-2 px-3 text-right text-gray-600">
                            {formatPercent(row.winRate)}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <span
                              className={
                                row.avgPnl >= 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              }
                            >
                              {formatCurrency(row.avgPnl)}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right">
                            <span
                              className={
                                row.expectancy >= 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              }
                            >
                              {formatCurrency(row.expectancy)}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-medium">
                            <span
                              className={
                                row.totalPnl >= 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              }
                            >
                              {formatCurrency(row.totalPnl)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {!review && !error && (
        <div className="card text-center py-8 text-gray-400 text-sm">
          No review data available for this week.
        </div>
      )}
    </div>
  );
}
