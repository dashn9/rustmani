"use client";

import { ReactElement, useEffect, useState } from "react";
import {
  Area,
  AreaChart as RAreaChart,
  Bar,
  BarChart as RBarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart as RPieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// ResponsiveContainer reads its parent's bounding rect on first render and warns
// "width(-1) and height(-1)" when the parent layout hasn't settled yet. Defer
// the mount one tick so the wrapper's width:100% has resolved.
function DeferredResponsive({ height, children }: { height: number; children: ReactElement }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <div style={{ width: "100%", height }}>
      {mounted && (
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          {children}
        </ResponsiveContainer>
      )}
    </div>
  );
}

const AXIS = {
  fontSize: 10,
  fill: "var(--muted-foreground)",
  fontFamily: "var(--font-mono)",
};

const TOOLTIP = {
  contentStyle: {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    fontSize: 11,
    padding: "6px 10px",
  },
  labelStyle: { color: "var(--muted-foreground)", fontSize: 10 },
  itemStyle: { color: "var(--foreground)", fontFamily: "var(--font-mono)" },
  cursor: { fill: "var(--muted)", opacity: 0.4 },
};

function EmptyChart({ height }: { height: number }) {
  return (
    <div
      className="flex items-center justify-center text-xs text-muted-foreground"
      style={{ height }}
    >
      No data yet
    </div>
  );
}

type AreaPoint = { x: string | number; y: number };

export function AreaChart({
  data, height = 200, accent = "var(--accent)",
}: { data: AreaPoint[]; height?: number; accent?: string }) {
  if (data.length === 0) return <EmptyChart height={height} />;
  return (
    <DeferredResponsive height={height}>
      <RAreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="wb-area-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity={0.4} />
              <stop offset="100%" stopColor={accent} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
          <XAxis dataKey="x" tick={AXIS} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
          <Tooltip {...TOOLTIP} />
          <Area
            type="monotone"
            dataKey="y"
            stroke={accent}
            strokeWidth={2}
            fill="url(#wb-area-fill)"
            dot={{ r: 2.5, fill: accent, strokeWidth: 0 }}
            activeDot={{ r: 4 }}
          />
        </RAreaChart>
    </DeferredResponsive>
  );
}

export function BarChart({
  data, height = 200, accent = "var(--wb)",
}: {
  data: { label: string; value: number }[]; height?: number; accent?: string;
}) {
  if (data.length === 0) return <EmptyChart height={height} />;
  return (
    <DeferredResponsive height={height}>
      <RBarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
        <XAxis
          dataKey="label"
          tick={AXIS}
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
          tickFormatter={(s: string) => (s?.length > 8 ? `${s.slice(0, 6)}…` : s)}
        />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
        <Tooltip {...TOOLTIP} />
        <Bar dataKey="value" fill={accent} radius={[3, 3, 0, 0]} maxBarSize={48} />
      </RBarChart>
    </DeferredResponsive>
  );
}

const DONUT_COLORS = [
  "var(--wb)",
  "var(--success)",
  "var(--warning)",
  "var(--accent)",
  "var(--error)",
];

export function DonutChart({
  data, height = 220,
}: {
  data: { label: string; value: number; color?: string }[];
  height?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <EmptyChart height={height} />;

  return (
    <DeferredResponsive height={height}>
      <RPieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          innerRadius="58%"
          outerRadius="86%"
          paddingAngle={1}
          stroke="var(--card)"
          strokeWidth={2}
        >
          {data.map((d, i) => (
            <Cell
              key={d.label}
              fill={d.color ?? DONUT_COLORS[i % DONUT_COLORS.length]}
            />
          ))}
        </Pie>
        <Tooltip {...TOOLTIP} />
        <Legend
          verticalAlign="bottom"
          height={28}
          iconType="square"
          iconSize={8}
          wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-mono)" }}
          formatter={(value: string) => (
            <span className="text-muted-foreground capitalize">{value}</span>
          )}
        />
      </RPieChart>
    </DeferredResponsive>
  );
}
