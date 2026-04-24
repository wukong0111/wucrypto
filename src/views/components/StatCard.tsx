import type { FC } from "hono/jsx";

type Tone = "neutral" | "positive" | "negative";

type StatCardProps = {
  label: string;
  value: string;
  sublabel?: string | undefined;
  tone?: Tone;
};

const toneClasses: Record<Tone, string> = {
  neutral: "text-white",
  positive: "text-pnl-positive",
  negative: "text-pnl-negative",
};

export const StatCard: FC<StatCardProps> = ({ label, value, sublabel, tone = "neutral" }) => (
  <div class="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
    <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</div>
    <div class={`text-xl font-bold ${toneClasses[tone]}`}>{value}</div>
    {sublabel && <div class="text-xs text-gray-500 mt-0.5">{sublabel}</div>}
  </div>
);
