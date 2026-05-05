import type { LucideIcon } from "lucide-react";

type MetricCardProps = {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone?: "mint" | "amber" | "coral" | "cyan";
};

const config = {
  mint:  { bg: "from-mint/10 to-mint/[0.02]", text: "text-mint",  glow: "shadow-[0_0_30px_rgba(125,223,150,0.06)]", iconBg: "bg-mint/10" },
  amber: { bg: "from-amber/10 to-amber/[0.02]", text: "text-amber", glow: "shadow-[0_0_30px_rgba(248,192,90,0.06)]",  iconBg: "bg-amber/10" },
  coral: { bg: "from-coral/10 to-coral/[0.02]", text: "text-coral", glow: "shadow-[0_0_30px_rgba(255,111,97,0.06)]",  iconBg: "bg-coral/10" },
  cyan:  { bg: "from-cyan/10 to-cyan/[0.02]",   text: "text-cyan",  glow: "shadow-[0_0_30px_rgba(107,216,255,0.06)]", iconBg: "bg-cyan/10" },
};

export function MetricCard({ label, value, detail, icon: Icon, tone = "mint" }: MetricCardProps) {
  const c = config[tone];
  return (
    <div className={`group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-b ${c.bg} p-5 ${c.glow} transition-all duration-300 hover:border-white/[0.1] hover:scale-[1.02]`}>
      {/* Shimmer accent */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-shimmer pointer-events-none" />

      <div className="relative flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-white/30">{label}</span>
        <span className={`grid h-10 w-10 place-items-center rounded-xl ${c.iconBg} ${c.text}`}>
          <Icon size={18} />
        </span>
      </div>
      <div className={`relative mt-4 text-3xl font-bold tracking-tight ${c.text}`}>{value}</div>
      <div className="relative mt-1 text-[12px] text-white/35">{detail}</div>
    </div>
  );
}
