export default function SettingsPage() {
  const recipes = [
    { crop: "Basil", temp: "21-28°C", humidity: "40-60%", moisture: "45-70%", ph: "5.8-6.8" },
    { crop: "Lettuce", temp: "16-24°C", humidity: "50-70%", moisture: "55-80%", ph: "5.5-6.5" },
    { crop: "Strawberry", temp: "18-26°C", humidity: "45-65%", moisture: "50-75%", ph: "5.5-6.5" },
  ];

  return (
    <div className="grid gap-6">
      <h2 className="text-2xl font-semibold text-ink">Crop Recipes & Settings</h2>
      
      <div className="rounded-lg border border-card-border bg-white overflow-hidden shadow-card">
        <table className="w-full text-left text-sm text-muted">
          <thead className="bg-light-green text-ink">
            <tr>
              <th className="px-6 py-4 font-medium">Crop</th>
              <th className="px-6 py-4 font-medium">Target Temp</th>
              <th className="px-6 py-4 font-medium">Target Humidity</th>
              <th className="px-6 py-4 font-medium">Target Moisture</th>
              <th className="px-6 py-4 font-medium">Target pH</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-card-border">
            {recipes.map((r) => (
              <tr key={r.crop} className="hover:bg-field-bg transition-colors">
                <td className="px-6 py-4 font-medium text-ink">{r.crop}</td>
                <td className="px-6 py-4">{r.temp}</td>
                <td className="px-6 py-4">{r.humidity}</td>
                <td className="px-6 py-4">{r.moisture}</td>
                <td className="px-6 py-4">{r.ph}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
