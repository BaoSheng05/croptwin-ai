import { MapPin, Trophy } from "lucide-react";
import type { MarketCitySummary } from "../../types";

type PodiumRank = 1 | 2 | 3;

const styles: Record<PodiumRank, { height: string; color: string; label: string; icon: string }> = {
  1: {
    height: "h-52 md:h-60",
    color: "from-teal-400 to-forest-green",
    label: "text-white",
    icon: "bg-white/20 text-white",
  },
  2: {
    height: "h-44 md:h-52",
    color: "from-yellow-300 to-status-warning",
    label: "text-white",
    icon: "bg-white/20 text-white",
  },
  3: {
    height: "h-40 md:h-48",
    color: "from-red-400 to-red-600",
    label: "text-white",
    icon: "bg-white/20 text-white",
  },
};

export function PodiumCard({ city, rank, onClick }: { city: MarketCitySummary; rank: PodiumRank; onClick: () => void }) {
  const style = styles[rank];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full flex-col justify-end overflow-hidden rounded-t-xl bg-gradient-to-br ${style.color} ${style.height} px-5 pb-5 pt-4 text-left shadow-card transition hover:-translate-y-1 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-forest-green focus:ring-offset-2`}
    >
      <div className="mb-auto flex items-center justify-between gap-3">
        <span className="text-5xl font-semibold leading-none text-white/95">{rank}</span>
        <span className={`grid h-9 w-9 place-items-center rounded-full ${style.icon}`}>
          <Trophy size={18} />
        </span>
      </div>
      <div className={style.label}>
        <p className="text-xs font-semibold uppercase tracking-wider opacity-90">Rank #{rank}</p>
        <h3 className="mt-1 text-lg font-semibold leading-tight">{city.city_name}</h3>
        <p className="mt-1 flex items-center gap-1 text-xs opacity-90"><MapPin size={13} />{city.state}</p>
        <p className="mt-3 text-sm font-semibold">Score <span className="text-2xl">{city.overall_score}</span></p>
      </div>
    </button>
  );
}
