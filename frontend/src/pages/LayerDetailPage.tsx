import { useOutletContext } from "react-router-dom";
import { useState } from "react";
import { LayerCard } from "../components/LayerCard";
import { ChartsPanel } from "../components/ChartsPanel";
import { DiagnosisPanel } from "../components/DiagnosisPanel";
import type { FarmStreamContext } from "../App";

export default function LayerDetailPage() {
  const { farm, chartData } = useOutletContext<FarmStreamContext>();
  const [selected, setSelected] = useState(farm.layers[0].id);

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-white">Layer Detail</h2>
        <div className="flex gap-2">
          {farm.layers.map(l => (
            <button 
              key={l.id} 
              onClick={() => setSelected(l.id)}
              className={`px-4 py-2 rounded-md text-sm transition-colors ${selected === l.id ? 'bg-mint text-ink font-medium' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}
            >
              {l.name}
            </button>
          ))}
        </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-3">
        {farm.layers.map((layer) => (
          <div key={layer.id} className={selected === layer.id ? "ring-2 ring-mint rounded-xl" : "opacity-60 grayscale-[0.3]"}>
            <LayerCard layer={layer} />
          </div>
        ))}
      </div>

      <div className="mt-4">
        <DiagnosisPanel layerId={selected} />
      </div>

      <div className="mt-4">
        <ChartsPanel data={chartData} />
      </div>
    </div>
  );
}
