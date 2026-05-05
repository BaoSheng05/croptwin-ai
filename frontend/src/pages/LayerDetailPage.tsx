import { useOutletContext } from "react-router-dom";
import { LayerCard } from "../components/LayerCard";
import { ChartsPanel } from "../components/ChartsPanel";
import type { FarmStreamContext } from "../App";

export default function LayerDetailPage() {
  const { farm, chartData } = useOutletContext<FarmStreamContext>();

  return (
    <div className="grid gap-6">
      <h2 className="text-2xl font-semibold text-white">Layer Detail</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {farm.layers.map((layer) => (
          <LayerCard key={layer.id} layer={layer} />
        ))}
      </div>
      <div className="mt-4">
        <ChartsPanel data={chartData} />
      </div>
    </div>
  );
}
