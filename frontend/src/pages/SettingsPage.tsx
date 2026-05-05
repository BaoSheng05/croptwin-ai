import { Leaf } from "lucide-react";

export default function SettingsPage() {
  const recipes = [
    { crop: "Lettuce", temp: "16–24°C", humidity: "50–70%", moisture: "55–80%", ph: "5.5–6.5", light: "400–750", color: "bg-mint/10 text-mint" },
    { crop: "Basil", temp: "21–28°C", humidity: "40–60%", moisture: "45–70%", ph: "5.8–6.8", light: "500–900", color: "bg-lime/10 text-lime" },
    { crop: "Strawberry", temp: "18–26°C", humidity: "45–65%", moisture: "50–75%", ph: "5.5–6.5", light: "650–1000", color: "bg-coral/10 text-coral" },
    { crop: "Spinach", temp: "15–22°C", humidity: "45–65%", moisture: "50–75%", ph: "6.0–7.0", light: "350–700", color: "bg-cyan/10 text-cyan" },
    { crop: "Mint", temp: "18–25°C", humidity: "50–70%", moisture: "55–80%", ph: "6.0–7.0", light: "400–800", color: "bg-violet/10 text-violet" },
    { crop: "Tomato", temp: "20–30°C", humidity: "40–60%", moisture: "50–70%", ph: "5.5–6.8", light: "600–1000", color: "bg-amber/10 text-amber" },
  ];

  const areas = [
    { id: "area_a", name: "Area A — Leafy Greens Wing", layers: ["A-1 Lettuce", "A-2 Lettuce", "A-3 Spinach", "A-4 Spinach", "A-5 Lettuce"], color: "from-mint/10" },
    { id: "area_b", name: "Area B — Herbs Wing", layers: ["B-1 Basil", "B-2 Basil", "B-3 Mint", "B-4 Mint", "B-5 Basil"], color: "from-violet/10" },
    { id: "area_c", name: "Area C — Fruits Wing", layers: ["C-1 Strawberry", "C-2 Strawberry", "C-3 Tomato", "C-4 Tomato", "C-5 Strawberry"], color: "from-amber/10" },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Recipes */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="p-5 border-b border-white/[0.04]">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/20">Database</p>
          <h2 className="text-base font-semibold text-white mt-0.5">Crop Recipes</h2>
        </div>
        <table className="w-full text-left text-[12px] text-white/50">
          <thead>
            <tr className="border-b border-white/[0.04]">
              <th className="px-5 py-3 font-medium text-white/25 text-[10px] uppercase tracking-wider">Crop</th>
              <th className="px-5 py-3 font-medium text-white/25 text-[10px] uppercase tracking-wider">Temperature</th>
              <th className="px-5 py-3 font-medium text-white/25 text-[10px] uppercase tracking-wider">Humidity</th>
              <th className="px-5 py-3 font-medium text-white/25 text-[10px] uppercase tracking-wider">Moisture</th>
              <th className="px-5 py-3 font-medium text-white/25 text-[10px] uppercase tracking-wider">pH</th>
              <th className="px-5 py-3 font-medium text-white/25 text-[10px] uppercase tracking-wider">Light (lux)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {recipes.map((r) => (
              <tr key={r.crop} className="transition hover:bg-white/[0.02]">
                <td className="px-5 py-3.5">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${r.color}`}>
                    <Leaf size={10} />
                    {r.crop}
                  </span>
                </td>
                <td className="px-5 py-3.5">{r.temp}</td>
                <td className="px-5 py-3.5">{r.humidity}</td>
                <td className="px-5 py-3.5">{r.moisture}</td>
                <td className="px-5 py-3.5">{r.ph}</td>
                <td className="px-5 py-3.5">{r.light}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Farm Layout */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/20 mb-4">Farm Layout</p>
        <div className="grid gap-4 md:grid-cols-3 stagger">
          {areas.map((area) => (
            <div key={area.id} className={`rounded-2xl border border-white/[0.06] bg-gradient-to-b ${area.color} to-transparent p-5`}>
              <h4 className="text-[13px] font-semibold text-white/70 mb-4">{area.name}</h4>
              <ul className="space-y-2">
                {area.layers.map((l, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-[12px] text-white/40">
                    <span className="h-1.5 w-1.5 rounded-full bg-white/15" />
                    {l}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
