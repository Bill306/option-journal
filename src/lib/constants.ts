export const STRATEGY_TYPES = [
  "covered_call",
  "cash_secured_put",
  "vertical_spread",
  "iron_condor",
  "iron_butterfly",
  "straddle",
  "strangle",
  "calendar_spread",
  "diagonal_spread",
  "long_call",
  "long_put",
  "naked_call",
  "naked_put",
  "collar",
  "butterfly",
  "custom",
] as const;

export const STRATEGY_LABELS: Record<string, string> = {
  covered_call: "Covered Call",
  cash_secured_put: "Cash Secured Put",
  vertical_spread: "Vertical Spread",
  iron_condor: "Iron Condor",
  iron_butterfly: "Iron Butterfly",
  straddle: "Straddle",
  strangle: "Strangle",
  calendar_spread: "Calendar Spread",
  diagonal_spread: "Diagonal Spread",
  long_call: "Long Call",
  long_put: "Long Put",
  naked_call: "Naked Call",
  naked_put: "Naked Put",
  collar: "Collar",
  butterfly: "Butterfly",
  custom: "Custom",
};

export const DIRECTIONS = ["bull", "bear", "neutral"] as const;

export const SETUP_TYPES = [
  "breakout",
  "pullback",
  "iv_play",
  "earnings",
  "mean_reversion",
  "trend_following",
  "support_resistance",
  "custom",
] as const;

export const MARKET_TRENDS = ["up", "down", "sideways"] as const;

export const DTE_BUCKETS = ["0-7", "7-21", "21-45", "45+"] as const;

export const DELTA_BUCKETS = ["0.1-0.2", "0.2-0.4", "0.4-0.6", "0.6+"] as const;

export const IV_RANK_BUCKETS = ["0-20", "20-40", "40-60", "60-80", "80-100"] as const;
