import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";

type ChartPoint = { time: string; temperature: number; humidity: number; moisture: number; ph: number };
type ChartsPanelProps = { data: ChartPoint[]; layerLabel?: string };

export function ChartsPanel({ data, layerLabel }: ChartsPanelProps) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/20">Telemetry</p>
          <h2 className="text-base font-semibold text-white mt-0.5">Live Sensor Trends</h2>
          {layerLabel && <p className="mt-1 text-[11px] text-white/25">{layerLabel} telemetry history</p>}
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-mint/[0.08] border border-mint/15 px-3 py-1 text-[11px] font-medium text-mint">
          <span className="h-1.5 w-1.5 rounded-full bg-mint animate-pulse" />
          Live stream
        </span>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ left: -20, right: 8, top: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="gHumidity" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6bd8ff" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#6bd8ff" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gMoisture" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7ddf96" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#7ddf96" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.03)" vertical={false} />
            <XAxis dataKey="time" stroke="rgba(255,255,255,0.15)" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="rgba(255,255,255,0.15)" fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{
                background: "rgba(13, 22, 19, 0.95)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                color: "#fff",
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }} />
            <Area type="monotone" dataKey="humidity" name="Humidity" stroke="#6bd8ff" fill="url(#gHumidity)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="moisture" name="Moisture" stroke="#7ddf96" fill="url(#gMoisture)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="temperature" name="Temp" stroke="#f8c05a" fill="transparent" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
