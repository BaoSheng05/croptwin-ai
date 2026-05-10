import { Leaf } from "lucide-react";
import { useSettings } from "../contexts/SettingsContext";

export default function SettingsPage() {
  const { settings } = useSettings();

  const convertTempRange = (range: string) => {
    if (settings.tempUnit === "C") return range;

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
    <div className="grid gap-5 animate-fade-in md:gap-6">
      <h2 className="text-xl font-semibold text-ink md:text-2xl">Crop Recipes & Settings</h2>

      <div className="rounded-lg border border-card-border bg-white shadow-card">
        <div className="border-b border-card-border p-4">
          <p className="text-xs uppercase text-muted">Database</p>
          <h3 className="mt-0.5 text-lg font-semibold text-ink">Crop Recipes</h3>
        </div>

        <div className="grid gap-3 p-4 md:hidden">
          {recipes.map((r) => (
            <article key={r.crop} className="rounded-2xl border border-card-border bg-field-bg/50 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${r.color}`}>
                  <Leaf size={10} />
                  {r.crop}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <RecipeMetric label="Temp" value={r.temp} />
                <RecipeMetric label="Humidity" value={r.humidity} />
                <RecipeMetric label="Moisture" value={r.moisture} />
                <RecipeMetric label="pH" value={r.ph} />
                <div className="col-span-2">
                  <RecipeMetric label="Light" value={`${r.light} lux`} />
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[760px] text-left text-sm text-muted">
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
                <tr key={r.crop} className="transition-colors hover:bg-field-bg">
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
      </div>

      <div>
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted">Farm Layout</p>
        <div className="grid gap-4 md:grid-cols-3 stagger">
          {areas.map((area) => (
            <div key={area.id} className={`rounded-lg border border-card-border bg-gradient-to-b ${area.color} to-white p-5 shadow-card`}>
              <h4 className="mb-4 text-sm font-semibold text-ink">{area.name}</h4>
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

function RecipeMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white p-3 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-ink/80">{value}</p>
    </div>
  );
}
