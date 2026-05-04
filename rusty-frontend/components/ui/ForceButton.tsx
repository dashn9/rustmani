"use client";

import { cn } from "@/lib/cn";
import { IconZap } from "@/components/ui/Icon";

type Props = {
  force: boolean;
  onToggleForce: (v: boolean) => void;
  onClick: () => void;
  loading?: boolean;
  children: React.ReactNode;
};

export function ForceButton({ force, onToggleForce, onClick, loading, children }: Props) {
  return (
    <div className="inline-flex rounded-md overflow-hidden">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium bg-error text-white hover:opacity-90 disabled:opacity-50 transition-colors"
      >
        {loading && (
          <span className="inline-block w-3 h-3 rounded-full border-2 border-current border-r-transparent animate-spin" />
        )}
        {children}
      </button>
      <button
        type="button"
        onClick={() => onToggleForce(!force)}
        title={force ? "Force enabled" : "Force disabled"}
        className={cn(
          "inline-flex items-center h-8 px-2 border-l transition-colors",
          force
            ? "bg-error text-white border-white/20 hover:opacity-90"
            : "bg-error/80 text-white/30 border-white/10 hover:text-white/60",
        )}
      >
        <IconZap size={12} />
      </button>
    </div>
  );
}
