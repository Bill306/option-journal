"use client";

import { useEffect, useState, useCallback } from "react";
import {
  STRATEGY_TYPES,
  STRATEGY_LABELS,
  DTE_BUCKETS,
  DELTA_BUCKETS,
  IV_RANK_BUCKETS,
} from "@/lib/constants";
import { Loading } from "@/components/ui/loading";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StrategyTemplate {
  id: string;
  name: string;
  strategyType: string;
  defaultLegs: string; // JSON string
  createdAt: string;
}

interface BucketConfig {
  id: string;
  category: string;
  buckets: string; // JSON string
  createdAt: string;
}

type Tab = "templates" | "buckets" | "import-export";

// ---------------------------------------------------------------------------
// CSV helpers
// ---------------------------------------------------------------------------

const CSV_COLUMNS = [
  "underlying",
  "strategy_type",
  "direction",
  "status",
  "entry_datetime",
  "exit_datetime",
  "entry_price_total",
  "exit_price_total",
  "qty",
  "fees",
  "pnl",
  "max_risk",
  "thesis",
  "setup_type",
  "rule_compliant",
  "emotion_score",
  "market_trend",
  "vix_level",
  "earnings_event",
  "tags",
] as const;

function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function tradeToCsvRow(trade: Record<string, unknown>): string {
  return CSV_COLUMNS.map((col) => {
    const camelKey = col.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
    return escapeCsvField(trade[camelKey]);
  }).join(",");
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

function csvRowToTradePayload(
  headers: string[],
  values: string[]
): Record<string, unknown> {
  const raw: Record<string, string> = {};
  headers.forEach((h, i) => {
    raw[h.trim()] = (values[i] ?? "").trim();
  });

  const toFloat = (v: string | undefined) =>
    v && v !== "" ? parseFloat(v) : undefined;
  const toInt = (v: string | undefined) =>
    v && v !== "" ? parseInt(v, 10) : undefined;
  const toBool = (v: string | undefined) => {
    if (!v || v === "") return undefined;
    return v === "true" || v === "1";
  };

  return {
    underlying: raw["underlying"] ?? "",
    strategyType: raw["strategy_type"] ?? "",
    direction: raw["direction"] ?? "",
    status: raw["status"] || "open",
    entryDatetime: raw["entry_datetime"] ?? "",
    exitDatetime: raw["exit_datetime"] || undefined,
    entryPriceTotal: toFloat(raw["entry_price_total"]),
    exitPriceTotal: toFloat(raw["exit_price_total"]),
    qty: toInt(raw["qty"]) ?? 1,
    fees: toFloat(raw["fees"]) ?? 0,
    pnl: toFloat(raw["pnl"]),
    maxRisk: toFloat(raw["max_risk"]),
    thesis: raw["thesis"] || undefined,
    setupType: raw["setup_type"] || undefined,
    ruleCompliant: toBool(raw["rule_compliant"]),
    emotionScore: toInt(raw["emotion_score"]),
    marketTrend: raw["market_trend"] || undefined,
    vixLevel: toFloat(raw["vix_level"]),
    earningsEvent: toBool(raw["earnings_event"]),
    tags: raw["tags"] || undefined,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  // ---- tab state ----
  const [activeTab, setActiveTab] = useState<Tab>("templates");

  // ---- shared data ----
  const [templates, setTemplates] = useState<StrategyTemplate[]>([]);
  const [bucketConfigs, setBucketConfigs] = useState<BucketConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---- template form ----
  const [tplName, setTplName] = useState("");
  const [tplStrategy, setTplStrategy] = useState<string>(STRATEGY_TYPES[0]);
  const [tplLegsJson, setTplLegsJson] = useState(
    '[\n  { "optionType": "call", "side": "long", "strike": 0, "contracts": 1 }\n]'
  );
  const [tplSaving, setTplSaving] = useState(false);

  // ---- bucket form ----
  const [dteBuckets, setDteBuckets] = useState(JSON.stringify([...DTE_BUCKETS]));
  const [deltaBuckets, setDeltaBuckets] = useState(
    JSON.stringify([...DELTA_BUCKETS])
  );
  const [ivBuckets, setIvBuckets] = useState(
    JSON.stringify([...IV_RANK_BUCKETS])
  );
  const [bucketSaving, setBucketSaving] = useState<string | null>(null);

  // ---- import / export ----
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    total: number;
    done: number;
    errors: string[];
  } | null>(null);

  // -------------------------------------------------------------------
  // Fetch settings
  // -------------------------------------------------------------------
  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error("Failed to fetch settings");
      const data = await res.json();
      setTemplates(data.templates ?? []);
      setBucketConfigs(data.bucketConfigs ?? []);

      // Populate bucket inputs from saved configs
      const saved: Record<string, string> = {};
      (data.bucketConfigs ?? []).forEach((bc: BucketConfig) => {
        saved[bc.category] = bc.buckets;
      });
      if (saved["dte"]) setDteBuckets(saved["dte"]);
      if (saved["delta"]) setDeltaBuckets(saved["delta"]);
      if (saved["iv_rank"]) setIvBuckets(saved["iv_rank"]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // -------------------------------------------------------------------
  // Template CRUD
  // -------------------------------------------------------------------
  const handleAddTemplate = async () => {
    if (!tplName.trim()) {
      alert("Template name is required.");
      return;
    }

    let parsedLegs: unknown;
    try {
      parsedLegs = JSON.parse(tplLegsJson);
    } catch {
      alert("Default Legs must be valid JSON.");
      return;
    }

    setTplSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "template",
          data: {
            name: tplName.trim(),
            strategyType: tplStrategy,
            defaultLegs: parsedLegs,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to create template");
      }

      setTplName("");
      setTplLegsJson(
        '[\n  { "optionType": "call", "side": "long", "strike": 0, "contracts": 1 }\n]'
      );
      await fetchSettings();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error saving template");
    } finally {
      setTplSaving(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    try {
      const res = await fetch(`/api/settings?id=${id}&type=template`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as Record<string, string>).error ?? "Delete failed"
        );
      }
      await fetchSettings();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error deleting template");
    }
  };

  // -------------------------------------------------------------------
  // Bucket save
  // -------------------------------------------------------------------
  const handleSaveBucket = async (
    category: string,
    bucketsRaw: string
  ) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(bucketsRaw);
      if (!Array.isArray(parsed)) throw new Error();
    } catch {
      alert("Buckets must be a valid JSON array of strings.");
      return;
    }

    setBucketSaving(category);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "bucket",
          data: { category, buckets: parsed },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save bucket config");
      }

      await fetchSettings();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error saving buckets");
    } finally {
      setBucketSaving(null);
    }
  };

  // -------------------------------------------------------------------
  // Export
  // -------------------------------------------------------------------
  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/trades");
      if (!res.ok) throw new Error("Failed to fetch trades");
      const trades: Record<string, unknown>[] = await res.json();

      const header = CSV_COLUMNS.join(",");
      const rows = trades.map(tradeToCsvRow);
      const csv = [header, ...rows].join("\n");

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `option-journal-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  // -------------------------------------------------------------------
  // Import
  // -------------------------------------------------------------------
  const handleImport = async (file: File) => {
    setImporting(true);
    setImportProgress(null);

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
      if (lines.length < 2) {
        alert("CSV file must have a header row and at least one data row.");
        setImporting(false);
        return;
      }

      const headers = parseCsvLine(lines[0]);
      const dataLines = lines.slice(1);
      const progress = { total: dataLines.length, done: 0, errors: [] as string[] };
      setImportProgress({ ...progress });

      for (let i = 0; i < dataLines.length; i++) {
        const values = parseCsvLine(dataLines[i]);
        const payload = csvRowToTradePayload(headers, values);

        try {
          const res = await fetch("/api/trades", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            progress.errors.push(
              `Row ${i + 2}: ${(data as Record<string, string>).error ?? "Unknown error"}`
            );
          }
        } catch {
          progress.errors.push(`Row ${i + 2}: Network error`);
        }

        progress.done = i + 1;
        setImportProgress({ ...progress });
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  // -------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------
  function legsCount(legsJson: string): number {
    try {
      const arr = JSON.parse(legsJson);
      return Array.isArray(arr) ? arr.length : 0;
    } catch {
      return 0;
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "templates", label: "Strategy Templates" },
    { key: "buckets", label: "Bucket Configuration" },
    { key: "import-export", label: "Data Import / Export" },
  ];

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Settings</h1>
        <Loading />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Settings</h1>
        <div className="card text-red-600">
          <p>Error: {error}</p>
          <button className="btn-primary mt-4" onClick={fetchSettings}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      {/* ---- Tab Navigation ---- */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 pb-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={
              activeTab === t.key
                ? "btn-primary"
                : "btn-secondary"
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ================================================================ */}
      {/* Section 1: Strategy Templates                                    */}
      {/* ================================================================ */}
      {activeTab === "templates" && (
        <div className="space-y-6">
          {/* Existing Templates */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Existing Templates</h2>

            {templates.length === 0 ? (
              <p className="text-sm text-gray-500">
                No templates yet. Add one below.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-500">
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Strategy Type</th>
                      <th className="py-2 pr-4">Default Legs</th>
                      <th className="py-2 pr-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {templates.map((tpl) => (
                      <tr
                        key={tpl.id}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="py-2 pr-4 font-medium">{tpl.name}</td>
                        <td className="py-2 pr-4">
                          {STRATEGY_LABELS[tpl.strategyType] ??
                            tpl.strategyType}
                        </td>
                        <td className="py-2 pr-4">
                          {legsCount(tpl.defaultLegs)} leg
                          {legsCount(tpl.defaultLegs) !== 1 ? "s" : ""}
                        </td>
                        <td className="py-2 pr-4 text-right">
                          <button
                            className="btn-danger text-xs"
                            onClick={() => handleDeleteTemplate(tpl.id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Add Template Form */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Add Template</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="label" htmlFor="tpl-name">
                  Name
                </label>
                <input
                  id="tpl-name"
                  type="text"
                  className="input"
                  placeholder="e.g. My Iron Condor"
                  value={tplName}
                  onChange={(e) => setTplName(e.target.value)}
                />
              </div>

              <div>
                <label className="label" htmlFor="tpl-strategy">
                  Strategy Type
                </label>
                <select
                  id="tpl-strategy"
                  className="select"
                  value={tplStrategy}
                  onChange={(e) => setTplStrategy(e.target.value)}
                >
                  {STRATEGY_TYPES.map((st) => (
                    <option key={st} value={st}>
                      {STRATEGY_LABELS[st]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mb-4">
              <label className="label" htmlFor="tpl-legs">
                Default Legs (JSON)
              </label>
              <textarea
                id="tpl-legs"
                className="input font-mono text-xs"
                rows={6}
                value={tplLegsJson}
                onChange={(e) => setTplLegsJson(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">
                JSON array of leg objects. Each leg can have: optionType
                (call/put), side (long/short), strike, contracts.
              </p>
            </div>

            <button
              className="btn-primary"
              disabled={tplSaving}
              onClick={handleAddTemplate}
            >
              {tplSaving ? "Saving..." : "Add Template"}
            </button>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* Section 2: Bucket Configuration                                  */}
      {/* ================================================================ */}
      {activeTab === "buckets" && (
        <div className="space-y-6">
          {/* DTE Buckets */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-2">DTE Buckets</h2>
            <p className="text-xs text-gray-500 mb-3">
              Define days-to-expiration ranges used for analytics grouping.
            </p>
            <label className="label" htmlFor="dte-buckets">
              Ranges (JSON array)
            </label>
            <input
              id="dte-buckets"
              type="text"
              className="input mb-3"
              value={dteBuckets}
              onChange={(e) => setDteBuckets(e.target.value)}
            />
            <button
              className="btn-primary"
              disabled={bucketSaving === "dte"}
              onClick={() => handleSaveBucket("dte", dteBuckets)}
            >
              {bucketSaving === "dte" ? "Saving..." : "Save DTE Buckets"}
            </button>
          </div>

          {/* Delta Buckets */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-2">Delta Buckets</h2>
            <p className="text-xs text-gray-500 mb-3">
              Define delta ranges used for analytics grouping.
            </p>
            <label className="label" htmlFor="delta-buckets">
              Ranges (JSON array)
            </label>
            <input
              id="delta-buckets"
              type="text"
              className="input mb-3"
              value={deltaBuckets}
              onChange={(e) => setDeltaBuckets(e.target.value)}
            />
            <button
              className="btn-primary"
              disabled={bucketSaving === "delta"}
              onClick={() => handleSaveBucket("delta", deltaBuckets)}
            >
              {bucketSaving === "delta" ? "Saving..." : "Save Delta Buckets"}
            </button>
          </div>

          {/* IV Rank Buckets */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-2">IV Rank Buckets</h2>
            <p className="text-xs text-gray-500 mb-3">
              Define IV Rank ranges used for analytics grouping.
            </p>
            <label className="label" htmlFor="iv-buckets">
              Ranges (JSON array)
            </label>
            <input
              id="iv-buckets"
              type="text"
              className="input mb-3"
              value={ivBuckets}
              onChange={(e) => setIvBuckets(e.target.value)}
            />
            <button
              className="btn-primary"
              disabled={bucketSaving === "iv_rank"}
              onClick={() => handleSaveBucket("iv_rank", ivBuckets)}
            >
              {bucketSaving === "iv_rank"
                ? "Saving..."
                : "Save IV Rank Buckets"}
            </button>
          </div>

          {/* Current saved configs */}
          {bucketConfigs.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">
                Saved Bucket Configurations
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-500">
                      <th className="py-2 pr-4">Category</th>
                      <th className="py-2 pr-4">Buckets</th>
                      <th className="py-2 pr-4">Saved At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bucketConfigs.map((bc) => (
                      <tr
                        key={bc.id}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="py-2 pr-4 font-medium uppercase">
                          {bc.category}
                        </td>
                        <td className="py-2 pr-4 font-mono text-xs">
                          {bc.buckets}
                        </td>
                        <td className="py-2 pr-4 text-gray-500">
                          {new Date(bc.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* Section 3: Data Import / Export                                   */}
      {/* ================================================================ */}
      {activeTab === "import-export" && (
        <div className="space-y-6">
          {/* Export */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-2">Export Trades</h2>
            <p className="text-sm text-gray-500 mb-4">
              Download all trades as a CSV file with columns:{" "}
              <span className="font-mono text-xs">
                {CSV_COLUMNS.join(", ")}
              </span>
            </p>
            <button
              className="btn-primary"
              disabled={exporting}
              onClick={handleExport}
            >
              {exporting ? "Exporting..." : "Export CSV"}
            </button>
          </div>

          {/* Import */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-2">Import Trades</h2>
            <p className="text-sm text-gray-500 mb-4">
              Upload a CSV file to import trades. The CSV must have a header row
              matching the export column names. Each row will be created as a new
              trade.
            </p>

            <label className="label" htmlFor="csv-upload">
              Choose CSV File
            </label>
            <input
              id="csv-upload"
              type="file"
              accept=".csv"
              className="input mb-4"
              disabled={importing}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImport(file);
              }}
            />

            {importing && <Loading />}

            {importProgress && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${
                          importProgress.total > 0
                            ? Math.round(
                                (importProgress.done / importProgress.total) *
                                  100
                              )
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-700">
                    {importProgress.done} / {importProgress.total}
                  </span>
                </div>

                {!importing && importProgress.done === importProgress.total && (
                  <p className="text-sm text-green-600 font-medium">
                    Import complete.{" "}
                    {importProgress.total - importProgress.errors.length} of{" "}
                    {importProgress.total} rows imported successfully.
                  </p>
                )}

                {importProgress.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm font-medium text-red-600 mb-1">
                      Errors ({importProgress.errors.length}):
                    </p>
                    <ul className="list-disc list-inside text-xs text-red-500 max-h-40 overflow-y-auto">
                      {importProgress.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
