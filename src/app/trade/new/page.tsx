"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  STRATEGY_TYPES,
  STRATEGY_LABELS,
  DIRECTIONS,
  SETUP_TYPES,
  MARKET_TRENDS,
} from "@/lib/constants";

interface Leg {
  option_type: "call" | "put";
  side: "long" | "short";
  strike: string;
  expiration: string;
  contracts: string;
  entry_price: string;
  delta_entry: string;
  iv_entry: string;
}

function createEmptyLeg(): Leg {
  return {
    option_type: "call",
    side: "long",
    strike: "",
    expiration: "",
    contracts: "1",
    entry_price: "",
    delta_entry: "",
    iv_entry: "",
  };
}

export default function NewTradePage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Trade details state
  const [underlying, setUnderlying] = useState("");
  const [strategyType, setStrategyType] = useState<string>(STRATEGY_TYPES[0]);
  const [direction, setDirection] = useState<string>(DIRECTIONS[0]);
  const [entryDate, setEntryDate] = useState("");
  const [entryPriceTotal, setEntryPriceTotal] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [fees, setFees] = useState("0");
  const [maxRisk, setMaxRisk] = useState("");
  const [setupType, setSetupType] = useState("");
  const [thesis, setThesis] = useState("");
  const [ruleCompliant, setRuleCompliant] = useState(true);
  const [emotionScore, setEmotionScore] = useState("");
  const [marketTrend, setMarketTrend] = useState("");
  const [vixLevel, setVixLevel] = useState("");
  const [earningsEvent, setEarningsEvent] = useState(false);
  const [tags, setTags] = useState("");

  // Legs state
  const [legs, setLegs] = useState<Leg[]>([createEmptyLeg()]);

  function addLeg() {
    setLegs([...legs, createEmptyLeg()]);
  }

  function removeLeg(index: number) {
    setLegs(legs.filter((_, i) => i !== index));
  }

  function updateLeg(index: number, field: keyof Leg, value: string) {
    setLegs(
      legs.map((leg, i) => (i === index ? { ...leg, [field]: value } : leg))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = {
      underlying: underlying.toUpperCase().trim(),
      strategy_type: strategyType,
      direction,
      entry_date: entryDate,
      entry_price_total: parseFloat(entryPriceTotal),
      quantity: parseInt(quantity, 10),
      fees: parseFloat(fees) || 0,
      max_risk: maxRisk ? parseFloat(maxRisk) : null,
      setup_type: setupType || null,
      thesis: thesis.trim() || null,
      rule_compliant: ruleCompliant,
      emotion_score: emotionScore ? parseInt(emotionScore, 10) : null,
      market_trend: marketTrend || null,
      vix_level: vixLevel ? parseFloat(vixLevel) : null,
      earnings_event: earningsEvent,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      legs: legs.map((leg) => ({
        option_type: leg.option_type,
        side: leg.side,
        strike: parseFloat(leg.strike),
        expiration: leg.expiration,
        contracts: parseInt(leg.contracts, 10),
        entry_price: parseFloat(leg.entry_price),
        delta_entry: leg.delta_entry ? parseFloat(leg.delta_entry) : null,
        iv_entry: leg.iv_entry ? parseFloat(leg.iv_entry) : null,
      })),
    };

    try {
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Request failed with status ${res.status}`);
      }

      router.push("/trades");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">New Trade</h1>
        <p className="text-sm text-gray-500 mt-1">
          Enter the details for your new options trade.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Trade Details Section */}
        <div className="card mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Trade Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Underlying */}
            <div>
              <label htmlFor="underlying" className="label">
                Underlying *
              </label>
              <input
                id="underlying"
                type="text"
                className="input"
                placeholder="e.g. AAPL"
                value={underlying}
                onChange={(e) => setUnderlying(e.target.value)}
                required
              />
            </div>

            {/* Strategy Type */}
            <div>
              <label htmlFor="strategyType" className="label">
                Strategy Type *
              </label>
              <select
                id="strategyType"
                className="select"
                value={strategyType}
                onChange={(e) => setStrategyType(e.target.value)}
                required
              >
                {STRATEGY_TYPES.map((st) => (
                  <option key={st} value={st}>
                    {STRATEGY_LABELS[st]}
                  </option>
                ))}
              </select>
            </div>

            {/* Direction */}
            <div>
              <label htmlFor="direction" className="label">
                Direction *
              </label>
              <select
                id="direction"
                className="select"
                value={direction}
                onChange={(e) => setDirection(e.target.value)}
                required
              >
                {DIRECTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Entry Date */}
            <div>
              <label htmlFor="entryDate" className="label">
                Entry Date *
              </label>
              <input
                id="entryDate"
                type="datetime-local"
                className="input"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                required
              />
            </div>

            {/* Entry Price Total */}
            <div>
              <label htmlFor="entryPriceTotal" className="label">
                Entry Price Total *
              </label>
              <input
                id="entryPriceTotal"
                type="number"
                step="any"
                className="input"
                placeholder="+ credit / - debit"
                value={entryPriceTotal}
                onChange={(e) => setEntryPriceTotal(e.target.value)}
                required
              />
              <p className="text-xs text-gray-400 mt-1">
                Positive = net credit, Negative = net debit
              </p>
            </div>

            {/* Quantity */}
            <div>
              <label htmlFor="quantity" className="label">
                Quantity *
              </label>
              <input
                id="quantity"
                type="number"
                min="1"
                step="1"
                className="input"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>

            {/* Fees */}
            <div>
              <label htmlFor="fees" className="label">
                Fees
              </label>
              <input
                id="fees"
                type="number"
                step="any"
                min="0"
                className="input"
                value={fees}
                onChange={(e) => setFees(e.target.value)}
              />
            </div>

            {/* Max Risk */}
            <div>
              <label htmlFor="maxRisk" className="label">
                Max Risk
              </label>
              <input
                id="maxRisk"
                type="number"
                step="any"
                className="input"
                placeholder="Optional"
                value={maxRisk}
                onChange={(e) => setMaxRisk(e.target.value)}
              />
            </div>

            {/* Setup Type */}
            <div>
              <label htmlFor="setupType" className="label">
                Setup Type
              </label>
              <select
                id="setupType"
                className="select"
                value={setupType}
                onChange={(e) => setSetupType(e.target.value)}
              >
                <option value="">-- None --</option>
                {SETUP_TYPES.map((st) => (
                  <option key={st} value={st}>
                    {st
                      .split("_")
                      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                      .join(" ")}
                  </option>
                ))}
              </select>
            </div>

            {/* Emotion Score */}
            <div>
              <label htmlFor="emotionScore" className="label">
                Emotion Score
              </label>
              <select
                id="emotionScore"
                className="select"
                value={emotionScore}
                onChange={(e) => setEmotionScore(e.target.value)}
              >
                <option value="">-- None --</option>
                <option value="1">1 - Very Negative</option>
                <option value="2">2 - Negative</option>
                <option value="3">3 - Neutral</option>
                <option value="4">4 - Positive</option>
                <option value="5">5 - Very Positive</option>
              </select>
            </div>

            {/* Market Trend */}
            <div>
              <label htmlFor="marketTrend" className="label">
                Market Trend
              </label>
              <select
                id="marketTrend"
                className="select"
                value={marketTrend}
                onChange={(e) => setMarketTrend(e.target.value)}
              >
                <option value="">-- None --</option>
                {MARKET_TRENDS.map((mt) => (
                  <option key={mt} value={mt}>
                    {mt.charAt(0).toUpperCase() + mt.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* VIX Level */}
            <div>
              <label htmlFor="vixLevel" className="label">
                VIX Level
              </label>
              <input
                id="vixLevel"
                type="number"
                step="any"
                min="0"
                className="input"
                placeholder="Optional"
                value={vixLevel}
                onChange={(e) => setVixLevel(e.target.value)}
              />
            </div>

            {/* Tags */}
            <div className="md:col-span-2 lg:col-span-3">
              <label htmlFor="tags" className="label">
                Tags
              </label>
              <input
                id="tags"
                type="text"
                className="input"
                placeholder="Comma separated, e.g. earnings, high-iv, weekly"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
            </div>

            {/* Thesis */}
            <div className="md:col-span-2 lg:col-span-3">
              <label htmlFor="thesis" className="label">
                Thesis
              </label>
              <textarea
                id="thesis"
                className="input"
                rows={3}
                placeholder="Why are you entering this trade?"
                value={thesis}
                onChange={(e) => setThesis(e.target.value)}
              />
            </div>

            {/* Rule Compliant */}
            <div className="flex items-center gap-2">
              <input
                id="ruleCompliant"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={ruleCompliant}
                onChange={(e) => setRuleCompliant(e.target.checked)}
              />
              <label htmlFor="ruleCompliant" className="text-sm font-medium text-gray-700">
                Rule Compliant
              </label>
            </div>

            {/* Earnings Event */}
            <div className="flex items-center gap-2">
              <input
                id="earningsEvent"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={earningsEvent}
                onChange={(e) => setEarningsEvent(e.target.checked)}
              />
              <label htmlFor="earningsEvent" className="text-sm font-medium text-gray-700">
                Earnings Event
              </label>
            </div>
          </div>
        </div>

        {/* Legs Section */}
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Legs</h2>
            <button type="button" className="btn-secondary" onClick={addLeg}>
              + Add Leg
            </button>
          </div>

          {legs.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">
              No legs added. Click &quot;Add Leg&quot; to get started.
            </p>
          )}

          <div className="space-y-4">
            {legs.map((leg, index) => (
              <div
                key={index}
                className="border border-gray-200 rounded-lg p-4 bg-gray-50"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">
                    Leg {index + 1}
                  </span>
                  <button
                    type="button"
                    className="btn-danger text-xs px-2 py-1"
                    onClick={() => removeLeg(index)}
                  >
                    Remove
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {/* Option Type */}
                  <div>
                    <label className="label">Type</label>
                    <select
                      className="select"
                      value={leg.option_type}
                      onChange={(e) =>
                        updateLeg(index, "option_type", e.target.value)
                      }
                    >
                      <option value="call">Call</option>
                      <option value="put">Put</option>
                    </select>
                  </div>

                  {/* Side */}
                  <div>
                    <label className="label">Side</label>
                    <select
                      className="select"
                      value={leg.side}
                      onChange={(e) =>
                        updateLeg(index, "side", e.target.value)
                      }
                    >
                      <option value="long">Long</option>
                      <option value="short">Short</option>
                    </select>
                  </div>

                  {/* Strike */}
                  <div>
                    <label className="label">Strike *</label>
                    <input
                      type="number"
                      step="any"
                      className="input"
                      placeholder="Strike"
                      value={leg.strike}
                      onChange={(e) =>
                        updateLeg(index, "strike", e.target.value)
                      }
                      required
                    />
                  </div>

                  {/* Expiration */}
                  <div>
                    <label className="label">Expiration *</label>
                    <input
                      type="date"
                      className="input"
                      value={leg.expiration}
                      onChange={(e) =>
                        updateLeg(index, "expiration", e.target.value)
                      }
                      required
                    />
                  </div>

                  {/* Contracts */}
                  <div>
                    <label className="label">Contracts *</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      className="input"
                      value={leg.contracts}
                      onChange={(e) =>
                        updateLeg(index, "contracts", e.target.value)
                      }
                      required
                    />
                  </div>

                  {/* Entry Price */}
                  <div>
                    <label className="label">Entry Price *</label>
                    <input
                      type="number"
                      step="any"
                      className="input"
                      placeholder="Per contract"
                      value={leg.entry_price}
                      onChange={(e) =>
                        updateLeg(index, "entry_price", e.target.value)
                      }
                      required
                    />
                  </div>

                  {/* Delta Entry */}
                  <div>
                    <label className="label">Delta</label>
                    <input
                      type="number"
                      step="any"
                      className="input"
                      placeholder="Optional"
                      value={leg.delta_entry}
                      onChange={(e) =>
                        updateLeg(index, "delta_entry", e.target.value)
                      }
                    />
                  </div>

                  {/* IV Entry */}
                  <div>
                    <label className="label">IV Entry</label>
                    <input
                      type="number"
                      step="any"
                      className="input"
                      placeholder="Optional"
                      value={leg.iv_entry}
                      onChange={(e) =>
                        updateLeg(index, "iv_entry", e.target.value)
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="btn-primary"
            disabled={submitting}
          >
            {submitting ? "Submitting..." : "Create Trade"}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => router.push("/trades")}
            disabled={submitting}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
