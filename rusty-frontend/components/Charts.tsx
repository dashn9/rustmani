"use client";

type AreaPoint = { x: string | number; y: number };

export function AreaChart({
  data, height = 160, accent = "var(--accent)",
}: {
  data: AreaPoint[]; height?: number; accent?: string;
}) {
  const w = 600;
  const h = height;
  const pad = 24;
  if (data.length === 0) {
    return <EmptyChart height={h} />;
  }
  const max = Math.max(1, ...data.map((d) => d.y));
  const stepX = (w - pad * 2) / Math.max(1, data.length - 1);
  const points = data.map((d, i) => {
    const x = pad + i * stepX;
    const y = h - pad - (d.y / max) * (h - pad * 2);
    return [x, y] as const;
  });
  const path = points.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(" ");
  const area = `${path} L${points[points.length - 1][0]},${h - pad} L${pad},${h - pad} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" role="img">
      <defs>
        <linearGradient id="wb-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.35" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      <g stroke="var(--border)" strokeWidth="1">
        {[0.25, 0.5, 0.75, 1].map((t) => (
          <line key={t} x1={pad} x2={w - pad} y1={h - pad - t * (h - pad * 2)} y2={h - pad - t * (h - pad * 2)} />
        ))}
      </g>
      <path d={area} fill="url(#wb-area)" />
      <path d={path} stroke={accent} strokeWidth="1.75" fill="none" />
      {points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={2.5} fill={accent} />
      ))}
    </svg>
  );
}

export function BarChart({
  data, height = 160, accent = "var(--wb)",
}: {
  data: { label: string; value: number }[]; height?: number; accent?: string;
}) {
  const w = 600;
  const h = height;
  const pad = 24;
  if (data.length === 0) return <EmptyChart height={h} />;
  const max = Math.max(1, ...data.map((d) => d.value));
  const bw = (w - pad * 2) / data.length;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" role="img">
      <g stroke="var(--border)" strokeWidth="1">
        {[0.25, 0.5, 0.75, 1].map((t) => (
          <line key={t} x1={pad} x2={w - pad} y1={h - pad - t * (h - pad * 2)} y2={h - pad - t * (h - pad * 2)} />
        ))}
      </g>
      {data.map((d, i) => {
        const bh = (d.value / max) * (h - pad * 2);
        const x = pad + i * bw + bw * 0.15;
        const y = h - pad - bh;
        return (
          <g key={i}>
            <rect
              x={x} y={y}
              width={bw * 0.7} height={bh}
              rx="2" fill={accent}
            />
            <text
              x={x + bw * 0.35} y={h - pad + 14}
              textAnchor="middle"
              fontSize="9" fontFamily="var(--font-mono)"
              fill="var(--muted-foreground)"
            >
              {d.label.length > 8 ? `${d.label.slice(0, 6)}…` : d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

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
