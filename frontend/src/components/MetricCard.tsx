import type { LucideIcon } from "lucide-react";

type MetricCardProps = {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone?: "mint" | "amber" | "coral" | "cyan";
};

const toneClass = {
  mint: "text-mint bg-mint/10",
  amber: "text-amber bg-amber/10",
  coral: "text-coral bg-coral/10",
  cyan: "text-cyan bg-cyan/10",
};

export function MetricCard({ label, value, detail, icon: Icon, tone = "mint" }: MetricCardProps) {
  return (
    <div className="rounded-lg border border-white/10 bg-panel/90 p-4 shadow-glow">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium uppercase text-white/50">{label}</span>
        <span className={`grid h-9 w-9 place-items-center rounded-md ${toneClass[tone]}`}>
          <Icon size={18} />
        </span>
      </div>
      <div className="mt-4 text-3xl font-semibold text-white">{value}</div>
      <div className="mt-1 text-sm text-white/55">{detail}</div>
    </div>
  );
}
