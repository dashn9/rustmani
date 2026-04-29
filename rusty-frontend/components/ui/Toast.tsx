"use client";

import { cn } from "@/lib/cn";
import { createContext, useCallback, useContext, useState } from "react";

type Toast = { id: number; message: string; tone: "success" | "error" | "info" };
type Ctx = { push: (t: Omit<Toast, "id">) => void };

const ToastCtx = createContext<Ctx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((cur) => [...cur, { ...t, id }]);
    setTimeout(() => setToasts((cur) => cur.filter((x) => x.id !== id)), 4000);
  }, []);
  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-80">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "rounded-md border px-3 py-2 text-sm shadow-lg backdrop-blur",
              t.tone === "success" && "border-[var(--success)]/30 bg-[color-mix(in_oklch,var(--success)_10%,var(--card))] text-foreground",
              t.tone === "error" && "border-[var(--error)]/30 bg-[color-mix(in_oklch,var(--error)_10%,var(--card))] text-foreground",
              t.tone === "info" && "border-border bg-card text-foreground",
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const c = useContext(ToastCtx);
  if (!c) throw new Error("useToast outside provider");
  return c;
}
