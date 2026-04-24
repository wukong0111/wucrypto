export function fmtUsd(value: number | null): string {
  if (value === null) return "—";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

export function fmtPct(value: number | null): string {
  if (value === null) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function pnlColor(value: number | null): string {
  if (value === null) return "";
  return value >= 0 ? "text-pnl-positive" : "text-pnl-negative";
}

export function pnlTone(value: number | null): "neutral" | "positive" | "negative" {
  if (value === null || value === 0) return "neutral";
  return value > 0 ? "positive" : "negative";
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
