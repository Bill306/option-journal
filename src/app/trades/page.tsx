"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { STRATEGY_LABELS } from "@/lib/constants";
import { formatCurrency, formatDate, pnlColor, cn } from "@/lib/utils";
import { Loading } from "@/components/ui/loading";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TradeLeg {
  id: string;
  optionType: string;
  side: string;
  strike: number;
  expiration: string;
  contracts: number;
  entryPrice: number;
  exitPrice: number | null;
  deltaEntry: number | null;
  ivEntry: number | null;
}

interface Trade {
  id: string;
  underlying: string;
  strategyType: string;
  direction: string;
  status: string;
  entryDatetime: string;
  exitDatetime: string | null;
  entryPriceTotal: number;
  exitPriceTotal: number | null;
  qty: number;
  fees: number;
  pnl: number | null;
  maxRisk: number | null;
  thesis: string | null;
  setupType: string | null;
  ruleCompliant: boolean;
  emotionScore: number | null;
  marketTrend: string | null;
  vixLevel: number | null;
  earningsEvent: boolean;
  tags: string | null;
  createdAt: string;
  updatedAt: string;
  legs: TradeLeg[];
}

// ---------------------------------------------------------------------------
// Filters state shape
// ---------------------------------------------------------------------------

interface Filters {
  status: string;
  strategyType: string;
  underlying: string;
  direction: string;
  dateFrom: string;
  dateTo: string;
}

const DEFAULT_FILTERS: Filters = {
  status: "",
  strategyType: "",
  underlying: "",
  direction: "",
  dateFrom: "",
  dateTo: "",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TradesListPage() {
  const router = useRouter();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  // -----------------------------------------------------------------------
  // Fetch trades whenever filters change
  // -----------------------------------------------------------------------

  const fetchTrades = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();

      if (filters.status) params.set("status", filters.status);
      if (filters.strategyType) params.set("strategyType", filters.strategyType);
      if (filters.underlying) params.set("underlying", filters.underlying);
      if (filters.direction) params.set("direction", filters.direction);

      const qs = params.toString();
      const url = `/api/trades${qs ? `?${qs}` : ""}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch trades");

      const data: Trade[] = await res.json();

      // Client-side date range filtering
      let filtered = data;
      if (filters.dateFrom) {
        const from = new Date(filters.dateFrom);
        filtered = filtered.filter((t) => new Date(t.entryDatetime) >= from);
      }
      if (filters.dateTo) {
        const to = new Date(filters.dateTo);
        to.setHours(23, 59, 59, 999);
        filtered = filtered.filter((t) => new Date(t.entryDatetime) <= to);
      }

      setTrades(filtered);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  // -----------------------------------------------------------------------
  // Filter helpers
  // -----------------------------------------------------------------------

  const updateFilter = (key: keyof Filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => setFilters(DEFAULT_FILTERS);

  // -----------------------------------------------------------------------
  // Summary stats
  // -----------------------------------------------------------------------

  const totalTrades = trades.length;
  const openTrades = trades.filter((t) => t.status === "open").length;
  const closedTrades = trades.filter((t) => t.status === "closed").length;

  const totalPnl = trades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
  const winningTrades = trades.filter((t) => t.pnl !== null && t.pnl > 0).length;
  const losingTrades = trades.filter((t) => t.pnl !== null && t.pnl < 0).length;
  const winRate =
    closedTrades > 0
      ? ((winningTrades / closedTrades) * 100).toFixed(1)
      : "—";

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Trades</h1>
          <p className="text-sm text-gray-500 mt-1">
            {totalTrades} total &middot; {openTrades} open &middot;{" "}
            {closedTrades} closed
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => router.push("/trade/new")}
        >
          + New Trade
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="card-header">Total P&amp;L</div>
          <div className={cn("card-value", pnlColor(totalPnl))}>
            {formatCurrency(totalPnl)}
          </div>
        </div>
        <div className="card">
          <div className="card-header">Win Rate</div>
          <div className="card-value">{winRate}%</div>
        </div>
        <div className="card">
          <div className="card-header">Winners</div>
          <div className="card-value text-profit">{winningTrades}</div>
        </div>
        <div className="card">
          <div className="card-header">Losers</div>
          <div className="card-value text-loss">{losingTrades}</div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="card">
        <div className="flex flex-wrap items-end gap-4">
          {/* Status toggle buttons */}
          <div>
            <span className="label">Status</span>
            <div className="flex gap-1">
              {[
                { label: "All", value: "" },
                { label: "Open", value: "open" },
                { label: "Closed", value: "closed" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => updateFilter("status", opt.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                    filters.status === opt.value
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Strategy type dropdown */}
          <div>
            <span className="label">Strategy</span>
            <select
              className="select"
              value={filters.strategyType}
              onChange={(e) => updateFilter("strategyType", e.target.value)}
            >
              <option value="">All Strategies</option>
              {Object.entries(STRATEGY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Underlying search */}
          <div>
            <span className="label">Underlying</span>
            <input
              type="text"
              className="input"
              placeholder="e.g. AAPL"
              value={filters.underlying}
              onChange={(e) => updateFilter("underlying", e.target.value)}
            />
          </div>

          {/* Direction dropdown */}
          <div>
            <span className="label">Direction</span>
            <select
              className="select"
              value={filters.direction}
              onChange={(e) => updateFilter("direction", e.target.value)}
            >
              <option value="">All</option>
              <option value="bull">Bull</option>
              <option value="bear">Bear</option>
              <option value="neutral">Neutral</option>
            </select>
          </div>

          {/* Date from */}
          <div>
            <span className="label">From</span>
            <input
              type="date"
              className="input"
              value={filters.dateFrom}
              onChange={(e) => updateFilter("dateFrom", e.target.value)}
            />
          </div>

          {/* Date to */}
          <div>
            <span className="label">To</span>
            <input
              type="date"
              className="input"
              value={filters.dateTo}
              onChange={(e) => updateFilter("dateTo", e.target.value)}
            />
          </div>

          {/* Reset */}
          <button className="btn-secondary" onClick={resetFilters}>
            Reset
          </button>
        </div>
      </div>

      {/* Trades table */}
      {loading ? (
        <Loading />
      ) : error ? (
        <div className="card text-center text-red-600 py-8">{error}</div>
      ) : trades.length === 0 ? (
        <div className="card text-center text-gray-500 py-12">
          No trades found. Adjust your filters or create a new trade.
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Underlying</th>
                <th className="px-4 py-3">Strategy</th>
                <th className="px-4 py-3">Direction</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Entry Price</th>
                <th className="px-4 py-3 text-right">P&amp;L</th>
                <th className="px-4 py-3 text-center">Compliant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {trades.map((trade) => (
                <tr
                  key={trade.id}
                  onClick={() => router.push(`/trades/${trade.id}`)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatDate(trade.entryDatetime)}
                  </td>
                  <td className="px-4 py-3 font-semibold whitespace-nowrap">
                    {trade.underlying}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {STRATEGY_LABELS[trade.strategyType] ?? trade.strategyType}
                  </td>
                  <td className="px-4 py-3 capitalize whitespace-nowrap">
                    {trade.direction}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={
                        trade.status === "open" ? "badge-green" : "badge-gray"
                      }
                    >
                      {trade.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {formatCurrency(trade.entryPriceTotal)}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 text-right font-medium whitespace-nowrap",
                      trade.pnl !== null ? pnlColor(trade.pnl) : "text-gray-400"
                    )}
                  >
                    {trade.pnl !== null ? formatCurrency(trade.pnl) : "—"}
                  </td>
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    {trade.ruleCompliant ? (
                      <span className="badge-green">Yes</span>
                    ) : (
                      <span className="badge-red">No</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
