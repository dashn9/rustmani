"use client";

import { cn } from "@/lib/cn";
import { useEffect } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
};

export function Modal({ open, onClose, title, children, className }: Props) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className={cn(
          "relative z-10 w-full max-w-md rounded-lg border border-border bg-card shadow-2xl",
          className,
        )}
      >
        {title && (
          <div className="border-b border-border px-5 py-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">{title}</h3>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function SlideOver({
  open,
  onClose,
  title,
  children,
  width = "max-w-2xl",
}: Props & { width?: string }) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 transition-opacity",
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
      )}
      aria-hidden={!open}
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className={cn(
          "absolute right-0 top-0 h-full w-full bg-card border-l border-border shadow-2xl transition-transform",
          width,
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        {title && (
          <div className="border-b border-border px-5 py-3 flex items-center justify-between sticky top-0 bg-card z-10">
            <h3 className="text-sm font-semibold">{title}</h3>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        )}
        <div className="overflow-y-auto wb-scroll" style={{ height: "calc(100% - 49px)" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
