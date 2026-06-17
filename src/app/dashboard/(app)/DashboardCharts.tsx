"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface HourPoint {
  hour: number;
  orders: number;
}

function Box({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: HourPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs shadow-md">
      <div className="font-semibold text-neutral-900">{String(d.hour).padStart(2, "0")}:00</div>
      <div className="text-neutral-500">
        {d.orders} {d.orders === 1 ? "ordine" : "ordini"}
      </div>
    </div>
  );
}

/** Orders-over-recent-hours timeline (replaces a static occupancy bar). */
export function OrdersTimeline({ data, color }: { data: HourPoint[]; color: string }) {
  return (
    <ResponsiveContainer width="100%" height={120}>
      <LineChart data={data} margin={{ top: 6, right: 10, left: -22, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
        <XAxis
          dataKey="hour"
          tickFormatter={(h: number) => String(h).padStart(2, "0")}
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#9ca3af" }} width={28} axisLine={false} tickLine={false} />
        <Tooltip content={<Box />} cursor={{ stroke: "rgba(0,0,0,0.1)" }} />
        <Line type="monotone" dataKey="orders" stroke={color} strokeWidth={2.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
