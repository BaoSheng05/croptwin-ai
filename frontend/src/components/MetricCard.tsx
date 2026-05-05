import type { LucideIcon } from "lucide-react";

type MetricCardProps = {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone?: "green" | "amber" | "red" | "blue" | "mint" | "cyan";
};

const toneClass = {
  green: { text: "text-forest-green", iconBg: "bg-spring-green/30 text-forest-green" },
  mint:  { text: "text-forest-green", iconBg: "bg-spring-green/30 text-forest-green" },
  amber: { text: "text-status-warning", iconBg: "bg-amber-50 text-status-warning" },
  red:   { text: "text-status-critical", iconBg: "bg-red-50 text-status-critical" },
  blue:  { text: "text-sky-600", iconBg: "bg-sky-50 text-sky-600" },
  cyan:  { text: "text-sky-600", iconBg: "bg-sky-50 text-sky-600" },
};

export function MetricCard({ label, value, detail, icon: Icon, tone = "green" }: MetricCardProps) {
  const c = toneClass[tone] || toneClass.green;
  return (
    <div className="group relative overflow-hidden rounded-lg border border-card-border bg-white p-4 shadow-card transition-all duration-300 hover:shadow-md hover:scale-[1.02]">
      {/* Shimmer accent */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-shimmer pointer-events-none" />

      <div className="relative flex items-center justify-between gap-3">
        <span className="text-xs font-medium uppercase text-muted">{label}</span>
        <span className={`grid h-9 w-9 place-items-center rounded-md ${c.iconBg}`}>
          <Icon size={18} />
        </span>
      </div>
      <div className={`relative mt-4 text-3xl font-semibold ${c.text}`}>{value}</div>
      <div className="relative mt-1 text-sm text-muted">{detail}</div>
    </div>
  );
}
