export default function SettingsPage() {
  const recipes = [
    { crop: "Lettuce", temp: "16–24°C", humidity: "50–70%", moisture: "55–80%", ph: "5.5–6.5", light: "400–750 lux" },
    { crop: "Basil", temp: "21–28°C", humidity: "40–60%", moisture: "45–70%", ph: "5.8–6.8", light: "500–900 lux" },
    { crop: "Strawberry", temp: "18–26°C", humidity: "45–65%", moisture: "50–75%", ph: "5.5–6.5", light: "650–1000 lux" },
    { crop: "Spinach", temp: "15–22°C", humidity: "45–65%", moisture: "50–75%", ph: "6.0–7.0", light: "350–700 lux" },
    { crop: "Mint", temp: "18–25°C", humidity: "50–70%", moisture: "55–80%", ph: "6.0–7.0", light: "400–800 lux" },
    { crop: "Tomato", temp: "20–30°C", humidity: "40–60%", moisture: "50–70%", ph: "5.5–6.8", light: "600–1000 lux" },
  ];

  const areas = [
    { id: "area_a", name: "Area A — Leafy Greens Wing", layers: ["A-1 Lettuce", "A-2 Lettuce", "A-3 Spinach", "A-4 Spinach", "A-5 Lettuce"] },
    { id: "area_b", name: "Area B — Herbs Wing", layers: ["B-1 Basil", "B-2 Basil", "B-3 Mint", "B-4 Mint", "B-5 Basil"] },
    { id: "area_c", name: "Area C — Fruits Wing", layers: ["C-1 Strawberry", "C-2 Strawberry", "C-3 Tomato", "C-4 Tomato", "C-5 Strawberry"] },
  ];

  return (
    <div className="grid gap-8">
      <h2 className="text-2xl font-semibold text-white">Crop Recipes & Settings</h2>

      {/* Crop Recipes Table */}
      <div className="rounded-lg border border-white/10 bg-panel overflow-hidden">
        <table className="w-full text-left text-sm text-white/70">
          <thead className="bg-ink text-white/90">
            <tr>
              <th className="px-5 py-3.5 font-medium">Crop</th>
              <th className="px-5 py-3.5 font-medium">Temperature</th>
              <th className="px-5 py-3.5 font-medium">Humidity</th>
              <th className="px-5 py-3.5 font-medium">Soil Moisture</th>
              <th className="px-5 py-3.5 font-medium">pH</th>
              <th className="px-5 py-3.5 font-medium">Light</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {recipes.map((r) => (
              <tr key={r.crop} className="hover:bg-white/5 transition-colors">
                <td className="px-5 py-3.5 font-medium text-white">{r.crop}</td>
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

      {/* Area Layout */}
      <h3 className="text-lg font-medium text-white">Farm Layout</h3>
      <div className="grid gap-4 md:grid-cols-3">
        {areas.map((area) => (
          <div key={area.id} className="rounded-lg border border-white/10 bg-panel p-5">
            <h4 className="text-sm font-semibold text-mint mb-3">{area.name}</h4>
            <ul className="space-y-1.5">
              {area.layers.map((l, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-white/60">
                  <span className="h-1.5 w-1.5 rounded-full bg-mint/50" />
                  {l}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
