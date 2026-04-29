import { cn } from "@/lib/cn";
import type { BrowserStatus } from "@/lib/api";

type Tone = "neutral" | "success" | "error" | "warning" | "info";

const TONES: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  success: "bg-[color-mix(in_oklch,var(--success)_18%,transparent)] text-[var(--success)]",
  error:   "bg-[color-mix(in_oklch,var(--error)_18%,transparent)] text-[var(--error)]",
  warning: "bg-[color-mix(in_oklch,var(--warning)_22%,transparent)] text-[oklch(0.45_0.16_68)]",
  info:    "bg-[color-mix(in_oklch,var(--accent)_15%,transparent)] text-[var(--accent)]",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider font-mono",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const STATUS_TONE: Record<BrowserStatus, Tone> = {
  active: "success",
  idle: "neutral",
  error: "error",
  spawning: "warning",
  closed: "neutral",
};

export function StatusBadge({ status }: { status: BrowserStatus }) {
  const tone = STATUS_TONE[status] ?? "neutral";
  return (
    <Badge tone={tone}>
      <span className={cn(
        "h-1.5 w-1.5 rounded-full",
        tone === "success" && "bg-[var(--success)] wb-pulse",
        tone === "error" && "bg-[var(--error)]",
        tone === "warning" && "bg-[var(--warning)] wb-pulse",
        tone === "neutral" && "bg-muted-foreground",
      )} />
      {status}
    </Badge>
  );
}

export function CountBadge({ count }: { count: number | null | undefined }) {
  if (count == null) return null;
  return (
    <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-wb-800 px-1.5 text-[10px] font-mono font-medium text-wb-inverse">
      {count}
    </span>
  );
}
