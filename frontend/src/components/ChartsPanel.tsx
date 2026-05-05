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
    <div className="rounded-lg border border-card-border bg-white p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase text-muted">Telemetry</p>
          <h2 className="text-lg font-semibold text-ink">Live Sensor Trends</h2>
        </div>
        <span className="rounded-md bg-spring-green/30 px-2.5 py-1 text-xs font-medium text-forest-green">2s stream</span>
      </div>

      <div className="mt-4 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ left: -20, right: 8, top: 10, bottom: 0 }}>
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
            <XAxis dataKey="time" stroke="#2D4A2D" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#2D4A2D" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{
                background: "#FFFFFF",
                border: "1px solid #B3D4B3",
                borderRadius: 8,
                color: "#000000",
              }}
            />
            <Area type="monotone" dataKey="humidity" stroke="#3498DB" fill="url(#humidity)" strokeWidth={2} />
            <Area type="monotone" dataKey="moisture" stroke="#228B22" fill="url(#moisture)" strokeWidth={2} />
            <Area type="monotone" dataKey="temperature" stroke="#C27B00" fill="transparent" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
