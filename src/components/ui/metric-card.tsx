import { cn, pnlColor } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  isPnl?: boolean;
  numericValue?: number;
}

export function MetricCard({
  title,
  value,
  subtitle,
  isPnl,
  numericValue,
}: MetricCardProps) {
  return (
    <div className="card">
      <div className="card-header">{title}</div>
      <div
        className={cn(
          "card-value",
          isPnl && numericValue !== undefined && pnlColor(numericValue)
        )}
      >
        {value}
      </div>
      {subtitle && (
        <div className="text-xs text-gray-400 mt-1">{subtitle}</div>
      )}
    </div>
  );
}
