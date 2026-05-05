import type { LucideIcon } from "lucide-react";

type MetricCardProps = {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone?: "green" | "amber" | "red" | "blue";
};

const toneClass = {
  green: "text-forest-green bg-spring-green/30",
  amber: "text-status-warning bg-amber-50",
  red:   "text-status-critical bg-red-50",
  blue:  "text-sky-600 bg-sky-50",
};

export function MetricCard({ label, value, detail, icon: Icon, tone = "green" }: MetricCardProps) {
  return (
    <div className="rounded-lg border border-card-border bg-white p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium uppercase text-muted">{label}</span>
        <span className={`grid h-9 w-9 place-items-center rounded-md ${toneClass[tone]}`}>
          <Icon size={18} />
        </span>
      </div>
      <div className="mt-4 text-3xl font-semibold text-ink">{value}</div>
      <div className="mt-1 text-sm text-muted">{detail}</div>
    </div>
  );
}
