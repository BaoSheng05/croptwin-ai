import { Leaf } from "lucide-react";
import { useSettings } from "../contexts/SettingsContext";

export default function SettingsPage() {
  const { settings } = useSettings();

  const convertTempRange = (range: string) => {
    if (settings.tempUnit === "C") return range;
    
    // Pattern matches "16–24°C" or "20-30°C"
    return range.replace(/(\d+)[–-](\d+)°C/, (match, low, high) => {
      const lowF = Math.round((parseInt(low) * 9) / 5 + 32);
      const highF = Math.round((parseInt(high) * 9) / 5 + 32);
      return `${lowF}–${highF}°F`;
    });
  };

  const recipes = [
    { crop: "Lettuce", temp: convertTempRange("16–24°C"), humidity: "50–70%", moisture: "55–80%", ph: "5.5–6.5", light: "400–750", color: "bg-spring-green/20 text-forest-green" },
    { crop: "Basil", temp: convertTempRange("21–28°C"), humidity: "40–60%", moisture: "45–70%", ph: "5.8–6.8", light: "500–900", color: "bg-spring-green/15 text-dark-green" },
    { crop: "Strawberry", temp: convertTempRange("18–26°C"), humidity: "45–65%", moisture: "50–75%", ph: "5.5–6.5", light: "650–1000", color: "bg-red-50 text-status-critical" },
    { crop: "Spinach", temp: convertTempRange("15–22°C"), humidity: "45–65%", moisture: "50–75%", ph: "6.0–7.0", light: "350–700", color: "bg-sky-50 text-sky-600" },
    { crop: "Mint", temp: convertTempRange("18–25°C"), humidity: "50–70%", moisture: "55–80%", ph: "6.0–7.0", light: "400–800", color: "bg-purple-50 text-purple-600" },
    { crop: "Tomato", temp: convertTempRange("20–30°C"), humidity: "40–60%", moisture: "50–70%", ph: "5.5–6.8", light: "600–1000", color: "bg-amber-50 text-status-warning" },
  ];

  const areas = [
    { id: "area_a", name: "Area A — Leafy Greens Wing", layers: ["A-1 Lettuce", "A-2 Lettuce", "A-3 Spinach", "A-4 Spinach", "A-5 Lettuce"], color: "from-spring-green/10" },
    { id: "area_b", name: "Area B — Herbs Wing", layers: ["B-1 Basil", "B-2 Basil", "B-3 Mint", "B-4 Mint", "B-5 Basil"], color: "from-purple-50" },
    { id: "area_c", name: "Area C — Fruits Wing", layers: ["C-1 Strawberry", "C-2 Strawberry", "C-3 Tomato", "C-4 Tomato", "C-5 Strawberry"], color: "from-amber-50" },
  ];

  return (
    <div className="grid gap-6 animate-fade-in">
      <h2 className="text-2xl font-semibold text-ink">Crop Recipes & Settings</h2>

      {/* Recipes table */}
      <div className="rounded-lg border border-card-border bg-white overflow-hidden shadow-card">
        <div className="p-4 border-b border-card-border">
          <p className="text-xs uppercase text-muted">Database</p>
          <h3 className="text-lg font-semibold text-ink mt-0.5">Crop Recipes</h3>
        </div>
        <table className="w-full text-left text-sm text-muted">
          <thead className="bg-light-green text-ink">
            <tr>
              <th className="px-6 py-4 font-medium">Crop</th>
              <th className="px-6 py-4 font-medium">Temperature</th>
              <th className="px-6 py-4 font-medium">Humidity</th>
              <th className="px-6 py-4 font-medium">Moisture</th>
              <th className="px-6 py-4 font-medium">pH</th>
              <th className="px-6 py-4 font-medium">Light (lux)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-card-border">
            {recipes.map((r) => (
              <tr key={r.crop} className="hover:bg-field-bg transition-colors">
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${r.color}`}>
                    <Leaf size={10} />
                    {r.crop}
                  </span>
                </td>
                <td className="px-6 py-4">{r.temp}</td>
                <td className="px-6 py-4">{r.humidity}</td>
                <td className="px-6 py-4">{r.moisture}</td>
                <td className="px-6 py-4">{r.ph}</td>
                <td className="px-6 py-4">{r.light}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Farm Layout */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-4">Farm Layout</p>
        <div className="grid gap-4 md:grid-cols-3 stagger">
          {areas.map((area) => (
            <div key={area.id} className={`rounded-lg border border-card-border bg-gradient-to-b ${area.color} to-white p-5 shadow-card`}>
              <h4 className="text-sm font-semibold text-ink mb-4">{area.name}</h4>
              <ul className="space-y-2">
                {area.layers.map((l, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-sm text-muted">
                    <span className="h-1.5 w-1.5 rounded-full bg-forest-green/40" />
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
