"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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

interface Note {
  id: string;
  content: string;
  createdAt: string;
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
  notes: Note[];
}

// ---------------------------------------------------------------------------
// Close-trade form state
// ---------------------------------------------------------------------------

interface CloseFormState {
  exitPriceTotal: string;
  legExitPrices: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TradeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [trade, setTrade] = useState<Trade | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Close-trade modal
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [closeForm, setCloseForm] = useState<CloseFormState>({
    exitPriceTotal: "",
    legExitPrices: {},
  });
  const [closing, setClosing] = useState(false);

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // New note
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  // -----------------------------------------------------------------------
  // Fetch trade
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!id) return;

    const fetchTrade = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/trades/${id}`);
        if (!res.ok) throw new Error("Trade not found");
        const data: Trade = await res.json();
        setTrade(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchTrade();
  }, [id]);

  // -----------------------------------------------------------------------
  // Close trade handler
  // -----------------------------------------------------------------------

  const handleOpenCloseForm = () => {
    if (!trade) return;
    const legPrices: Record<string, string> = {};
    trade.legs.forEach((leg) => {
      legPrices[leg.id] = leg.exitPrice !== null ? String(leg.exitPrice) : "";
    });
    setCloseForm({
      exitPriceTotal: trade.exitPriceTotal !== null ? String(trade.exitPriceTotal) : "",
      legExitPrices: legPrices,
    });
    setShowCloseForm(true);
  };

  const handleCloseTrade = async () => {
    if (!trade) return;
    setClosing(true);
    try {
      const legs = trade.legs.map((leg) => ({
        id: leg.id,
        optionType: leg.optionType,
        side: leg.side,
        strike: leg.strike,
        expiration: leg.expiration,
        contracts: leg.contracts,
        entryPrice: leg.entryPrice,
        exitPrice: closeForm.legExitPrices[leg.id]
          ? parseFloat(closeForm.legExitPrices[leg.id])
          : leg.exitPrice,
        deltaEntry: leg.deltaEntry,
        ivEntry: leg.ivEntry,
      }));

      const body: Record<string, unknown> = {
        status: "closed",
        legs,
      };

      if (closeForm.exitPriceTotal) {
        body.exitPriceTotal = parseFloat(closeForm.exitPriceTotal);
      }

      const res = await fetch(`/api/trades/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Failed to close trade");

      const updated: Trade = await res.json();
      setTrade(updated);
      setShowCloseForm(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error closing trade");
    } finally {
      setClosing(false);
    }
  };

  // -----------------------------------------------------------------------
  // Delete handler
  // -----------------------------------------------------------------------

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/trades/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete trade");
      router.push("/trades");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error deleting trade");
      setDeleting(false);
    }
  };

  // -----------------------------------------------------------------------
  // Add note handler
  // -----------------------------------------------------------------------

  const handleAddNote = async () => {
    if (!newNote.trim() || !trade) return;
    setAddingNote(true);
    try {
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tradeId: trade.id,
          note: newNote.trim(),
        }),
      });

      // If a dedicated notes endpoint exists the POST would go there.
      // Fallback: re-fetch the trade to pick up any server-side note creation.
      if (res.ok) {
        setNewNote("");
      }

      // Refresh the trade to get updated notes
      const tradeRes = await fetch(`/api/trades/${id}`);
      if (tradeRes.ok) {
        const updated: Trade = await tradeRes.json();
        setTrade(updated);
      }
    } catch {
      // Silently handle — note was best-effort
    } finally {
      setAddingNote(false);
    }
  };

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  const parseTags = (tags: string | null): string[] => {
    if (!tags) return [];
    try {
      const parsed = JSON.parse(tags);
      return Array.isArray(parsed) ? parsed : [tags];
    } catch {
      return tags.split(",").map((t) => t.trim()).filter(Boolean);
    }
  };

  const renderStars = (score: number | null) => {
    if (score === null) return "—";
    return (
      <span className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <span
            key={s}
            className={cn(
              "text-base",
              s <= score ? "text-yellow-500" : "text-gray-300"
            )}
          >
            ★
          </span>
        ))}
        <span className="ml-1 text-xs text-gray-500">({score}/5)</span>
      </span>
    );
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (loading) return <Loading />;

  if (error || !trade) {
    return (
      <div className="card text-center py-12">
        <p className="text-red-600 mb-4">{error ?? "Trade not found"}</p>
        <button className="btn-secondary" onClick={() => router.push("/trades")}>
          Back to Trades
        </button>
      </div>
    );
  }

  const tags = parseTags(trade.tags);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* ----------------------------------------------------------------- */}
      {/* Header                                                            */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold">{trade.underlying}</h1>
            <span className="badge-blue">
              {STRATEGY_LABELS[trade.strategyType] ?? trade.strategyType}
            </span>
            <span
              className={trade.status === "open" ? "badge-green" : "badge-gray"}
            >
              {trade.status}
            </span>
          </div>
          <p className="text-sm text-gray-500">
            Opened {formatDate(trade.entryDatetime)}
            {trade.exitDatetime && <> &middot; Closed {formatDate(trade.exitDatetime)}</>}
          </p>
        </div>

        <div className="flex gap-2">
          {trade.status === "open" && (
            <button className="btn-primary" onClick={handleOpenCloseForm}>
              Close Trade
            </button>
          )}
          <button
            className="btn-secondary"
            onClick={() => router.push(`/trade/new?edit=${trade.id}`)}
          >
            Edit
          </button>
          <button
            className="btn-danger"
            onClick={() => setShowDeleteConfirm(true)}
          >
            Delete
          </button>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Trade info grid                                                   */}
      {/* ----------------------------------------------------------------- */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Trade Details</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4 text-sm">
          <div>
            <span className="label">Direction</span>
            <p className="capitalize font-medium">{trade.direction}</p>
          </div>
          <div>
            <span className="label">Entry Date</span>
            <p className="font-medium">{formatDate(trade.entryDatetime)}</p>
          </div>
          <div>
            <span className="label">Exit Date</span>
            <p className="font-medium">
              {trade.exitDatetime ? formatDate(trade.exitDatetime) : "—"}
            </p>
          </div>
          <div>
            <span className="label">Entry Price</span>
            <p className="font-medium">{formatCurrency(trade.entryPriceTotal)}</p>
          </div>
          <div>
            <span className="label">Exit Price</span>
            <p className="font-medium">
              {trade.exitPriceTotal !== null
                ? formatCurrency(trade.exitPriceTotal)
                : "—"}
            </p>
          </div>
          <div>
            <span className="label">Qty</span>
            <p className="font-medium">{trade.qty}</p>
          </div>
          <div>
            <span className="label">Fees</span>
            <p className="font-medium">${trade.fees.toFixed(2)}</p>
          </div>
          <div>
            <span className="label">P&amp;L</span>
            <p
              className={cn(
                "font-bold text-lg",
                trade.pnl !== null ? pnlColor(trade.pnl) : "text-gray-400"
              )}
            >
              {trade.pnl !== null ? formatCurrency(trade.pnl) : "—"}
            </p>
          </div>
          <div>
            <span className="label">Max Risk</span>
            <p className="font-medium">
              {trade.maxRisk !== null ? `$${trade.maxRisk.toFixed(2)}` : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Thesis                                                            */}
      {/* ----------------------------------------------------------------- */}
      {trade.thesis && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-2">Thesis</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">
            {trade.thesis}
          </p>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Setup info                                                        */}
      {/* ----------------------------------------------------------------- */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Setup &amp; Context</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4 text-sm">
          <div>
            <span className="label">Setup Type</span>
            <p className="font-medium capitalize">
              {trade.setupType?.replace(/_/g, " ") ?? "—"}
            </p>
          </div>
          <div>
            <span className="label">Emotion Score</span>
            <div className="font-medium">{renderStars(trade.emotionScore)}</div>
          </div>
          <div>
            <span className="label">Market Trend</span>
            <p className="font-medium capitalize">{trade.marketTrend ?? "—"}</p>
          </div>
          <div>
            <span className="label">VIX Level</span>
            <p className="font-medium">
              {trade.vixLevel !== null ? trade.vixLevel.toFixed(1) : "—"}
            </p>
          </div>
          <div>
            <span className="label">Earnings Event</span>
            <p className="font-medium">{trade.earningsEvent ? "Yes" : "No"}</p>
          </div>
          <div>
            <span className="label">Rule Compliant</span>
            <p>
              {trade.ruleCompliant ? (
                <span className="badge-green">Yes</span>
              ) : (
                <span className="badge-red">No</span>
              )}
            </p>
          </div>
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="mt-4">
            <span className="label">Tags</span>
            <div className="flex flex-wrap gap-2 mt-1">
              {tags.map((tag, idx) => (
                <span key={idx} className="badge-blue">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Legs table                                                        */}
      {/* ----------------------------------------------------------------- */}
      {trade.legs.length > 0 && (
        <div className="card overflow-x-auto p-0">
          <div className="px-4 pt-4 pb-2">
            <h2 className="text-lg font-semibold">Legs</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Side</th>
                <th className="px-4 py-3 text-right">Strike</th>
                <th className="px-4 py-3">Expiration</th>
                <th className="px-4 py-3 text-right">Contracts</th>
                <th className="px-4 py-3 text-right">Entry Price</th>
                <th className="px-4 py-3 text-right">Exit Price</th>
                <th className="px-4 py-3 text-right">Delta</th>
                <th className="px-4 py-3 text-right">IV</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {trade.legs.map((leg) => (
                <tr key={leg.id}>
                  <td className="px-4 py-3 uppercase font-medium">
                    {leg.optionType}
                  </td>
                  <td className="px-4 py-3 capitalize">{leg.side}</td>
                  <td className="px-4 py-3 text-right">
                    ${leg.strike.toFixed(2)}
                  </td>
                  <td className="px-4 py-3">{formatDate(leg.expiration)}</td>
                  <td className="px-4 py-3 text-right">{leg.contracts}</td>
                  <td className="px-4 py-3 text-right">
                    ${leg.entryPrice.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {leg.exitPrice !== null
                      ? `$${leg.exitPrice.toFixed(2)}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {leg.deltaEntry !== null
                      ? leg.deltaEntry.toFixed(2)
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {leg.ivEntry !== null
                      ? `${(leg.ivEntry * 100).toFixed(1)}%`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Notes                                                             */}
      {/* ----------------------------------------------------------------- */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Notes</h2>

        {/* Add new note */}
        <div className="flex gap-2 mb-4">
          <textarea
            className="input flex-1"
            rows={2}
            placeholder="Add a note..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
          />
          <button
            className="btn-primary self-end"
            disabled={addingNote || !newNote.trim()}
            onClick={handleAddNote}
          >
            {addingNote ? "Adding..." : "Add Note"}
          </button>
        </div>

        {/* Existing notes */}
        {trade.notes.length === 0 ? (
          <p className="text-sm text-gray-400">No notes yet.</p>
        ) : (
          <div className="space-y-3">
            {trade.notes.map((note) => (
              <div
                key={note.id}
                className="border border-gray-200 rounded-lg p-3"
              >
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {note.content}
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  {formatDate(note.createdAt)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Close Trade Modal (inline)                                        */}
      {/* ----------------------------------------------------------------- */}
      {showCloseForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="card w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">Close Trade</h2>

            {/* Total exit price */}
            <div className="mb-4">
              <span className="label">Exit Price Total</span>
              <input
                type="number"
                step="0.01"
                className="input"
                placeholder="Net exit price per unit"
                value={closeForm.exitPriceTotal}
                onChange={(e) =>
                  setCloseForm((prev) => ({
                    ...prev,
                    exitPriceTotal: e.target.value,
                  }))
                }
              />
            </div>

            {/* Per-leg exit prices */}
            {trade.legs.length > 0 && (
              <div className="mb-4">
                <span className="label">Leg Exit Prices</span>
                <div className="space-y-2 mt-1">
                  {trade.legs.map((leg) => (
                    <div key={leg.id} className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 w-40 truncate">
                        {leg.side.toUpperCase()} {leg.optionType.toUpperCase()}{" "}
                        ${leg.strike} &mdash;{" "}
                        {formatDate(leg.expiration)}
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        className="input flex-1"
                        placeholder="Exit price"
                        value={closeForm.legExitPrices[leg.id] ?? ""}
                        onChange={(e) =>
                          setCloseForm((prev) => ({
                            ...prev,
                            legExitPrices: {
                              ...prev.legExitPrices,
                              [leg.id]: e.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                className="btn-secondary"
                onClick={() => setShowCloseForm(false)}
                disabled={closing}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleCloseTrade}
                disabled={closing}
              >
                {closing ? "Closing..." : "Confirm Close"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Delete Confirmation Modal                                         */}
      {/* ----------------------------------------------------------------- */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="card w-full max-w-sm mx-4">
            <h2 className="text-lg font-semibold mb-2">Delete Trade</h2>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete this trade? This action cannot be
              undone. All legs and notes will also be removed.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                className="btn-secondary"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="btn-danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Back link */}
      <div>
        <button
          className="text-sm text-blue-600 hover:underline"
          onClick={() => router.push("/trades")}
        >
          &larr; Back to Trades
        </button>
      </div>
    </div>
  );
}
