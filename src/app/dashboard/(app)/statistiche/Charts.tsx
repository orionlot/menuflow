"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatEUR } from "@/lib/config/plans";

interface DayDatum {
  date: string;
  revenueCents: number;
  orders: number;
}
interface HourDatum {
  hour: number;
  orders: number;
  revenueCents: number;
}

// Abbreviated euro for axis ticks: 782715¢ -> "€7,8K" (it-IT compact, no overflow).
const eurCompact = new Intl.NumberFormat("it-IT", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const shortEuro = (cents: number) => `€${eurCompact.format(cents / 100)}`;

const dayLabel = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};

function TooltipBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs shadow-lg">
      {children}
    </div>
  );
}

function DayTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: DayDatum }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <TooltipBox>
      <div className="font-semibold text-neutral-900">{dayLabel(d.date)}</div>
      <div className="text-neutral-600">{formatEUR(d.revenueCents)}</div>
      <div className="text-neutral-400">
        {d.orders} {d.orders === 1 ? "ordine" : "ordini"}
      </div>
    </TooltipBox>
  );
}

function HourTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: HourDatum }>;
}) {
  if (!active || !payload?.length) return null;
  const h = payload[0].payload;
  return (
    <TooltipBox>
      <div className="font-semibold text-neutral-900">
        {String(h.hour).padStart(2, "0")}:00
      </div>
      <div className="text-neutral-600">
        {h.orders} {h.orders === 1 ? "ordine" : "ordini"}
      </div>
      <div className="text-neutral-400">{formatEUR(h.revenueCents)}</div>
    </TooltipBox>
  );
}

export function RevenueByDayChart({ data, color }: { data: DayDatum[]; color: string }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 6, left: -6, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
        <XAxis
          dataKey="date"
          tickFormatter={dayLabel}
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          interval={Math.max(0, Math.floor(data.length / 6))}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={shortEuro}
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          width={50}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<DayTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
        <Bar dataKey="revenueCents" fill={color} radius={[3, 3, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function OrdersByHourChart({ data, color }: { data: HourDatum[]; color: string }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
        <XAxis
          dataKey="hour"
          tickFormatter={(h: number) => String(h).padStart(2, "0")}
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          interval={2}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          width={30}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<HourTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
        <Bar dataKey="orders" fill={color} radius={[3, 3, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}
