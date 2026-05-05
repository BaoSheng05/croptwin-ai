import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type ChartPoint = {
  time: string;
  temperature: number;
  humidity: number;
  moisture: number;
  ph: number;
};

type ChartsPanelProps = {
  data: ChartPoint[];
};

export function ChartsPanel({ data }: ChartsPanelProps) {
  return (
    <div className="rounded-lg border border-white/10 bg-panel p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase text-white/45">Telemetry</p>
          <h2 className="text-lg font-semibold text-white">Live Sensor Trends</h2>
        </div>
        <span className="rounded-md bg-mint/10 px-2.5 py-1 text-xs font-medium text-mint">2s stream</span>
      </div>

      <div className="mt-4 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ left: -20, right: 8, top: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="humidity" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6bd8ff" stopOpacity={0.55} />
                <stop offset="95%" stopColor="#6bd8ff" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="moisture" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7ddf96" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#7ddf96" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis dataKey="time" stroke="rgba(255,255,255,0.35)" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="rgba(255,255,255,0.35)" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{
                background: "#101714",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 8,
                color: "#fff",
              }}
            />
            <Area type="monotone" dataKey="humidity" stroke="#6bd8ff" fill="url(#humidity)" strokeWidth={2} />
            <Area type="monotone" dataKey="moisture" stroke="#7ddf96" fill="url(#moisture)" strokeWidth={2} />
            <Area type="monotone" dataKey="temperature" stroke="#f8c05a" fill="transparent" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
