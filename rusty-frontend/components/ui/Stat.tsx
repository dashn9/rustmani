import { cn } from "@/lib/cn";
import { Skeleton } from "./Skeleton";

type Props = {
  label: string;
  value: number | string | null | undefined;
  hint?: string;
  tone?: "default" | "success" | "error" | "warning";
  loading?: boolean;
};

const TONES = {
  default: "text-foreground",
  success: "text-[var(--success)]",
  error:   "text-[var(--error)]",
  warning: "text-[oklch(0.55_0.16_68)]",
} as const;

export function Stat({ label, value, hint, tone = "default", loading }: Props) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 h-8 flex items-end">
        {loading
          ? <Skeleton className="h-7 w-16" />
          : <span className={cn("font-mono text-2xl font-semibold tabular-nums", TONES[tone])}>
              {value ?? "—"}
            </span>}
      </div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
