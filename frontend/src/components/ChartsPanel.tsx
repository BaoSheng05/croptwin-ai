import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { useSettings } from "../contexts/SettingsContext";

type ChartPoint = { time: string; temperature: number; humidity: number; moisture: number; ph: number };
type ChartsPanelProps = { data: ChartPoint[]; layerLabel?: string };

export function ChartsPanel({ data, layerLabel }: ChartsPanelProps) {
  const { settings } = useSettings();

  const processedData = settings.tempUnit === "F" 
    ? data.map(p => ({ ...p, temperature: Number(((p.temperature * 9/5) + 32).toFixed(1)) }))
    : data;

  return (
    <div className="rounded-lg border border-card-border bg-white p-4 shadow-card">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <p className="text-xs uppercase text-muted">Telemetry</p>
          <h2 className="text-lg font-semibold text-ink">Live Sensor Trends</h2>
          {layerLabel && <p className="mt-1 text-xs text-muted">{layerLabel} telemetry history</p>}
        </div>
        <span className="flex items-center gap-1.5 rounded-md bg-spring-green/30 px-2.5 py-1 text-xs font-medium text-forest-green">
          <span className="h-1.5 w-1.5 rounded-full bg-forest-green animate-pulse" />
          Live stream
        </span>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={processedData} margin={{ left: -20, right: 8, top: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="humidity" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3498DB" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#3498DB" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="moisture" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#228B22" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#228B22" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(0,0,0,0.06)" vertical={false} />
            <XAxis dataKey="time" stroke="#2D4A2D" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="#2D4A2D" fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{
                background: "#FFFFFF",
                border: "1px solid #B3D4B3",
                borderRadius: 8,
                color: "#000000",
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: "#2D4A2D" }} />
            <Area type="monotone" dataKey="humidity" name="Humidity" stroke="#3498DB" fill="url(#humidity)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="moisture" name="Moisture" stroke="#228B22" fill="url(#moisture)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="temperature" name={`Temp (°${settings.tempUnit})`} stroke="#C27B00" fill="transparent" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
