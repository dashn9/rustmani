"use client";

import type RFBType from "@novnc/novnc/lib/rfb";
import { loadConfig } from "@/lib/config";
import { useEffect, useRef, useState } from "react";

type Props = {
  browserId: string;
  viewOnly?: boolean;
  className?: string;
};

export function DisplayStream({ browserId: id, viewOnly = false, className }: Props) {
  const targetRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const cfg = loadConfig();
    const target = targetRef.current;
    if (!cfg?.serverUrl || !target) return;

    const wsBase = cfg.serverUrl.replace(/^http/, "ws");
    const url = `${wsBase}/browsers/${encodeURIComponent(id)}/stream/`;

    let rfb: { disconnect: () => void } | null = null;
    let cancelled = false;

    (async () => {
      // @ts-expect-error @types/novnc__novnc only declares the @novnc/novnc/lib/rfb subpath,
      // but the package's runtime `exports` field only allows the bare specifier.
      const { default: RFB } = (await import("@novnc/novnc")) as { default: typeof RFBType };
      if (cancelled) return;

      const instance = new RFB(target, url, {
        wsProtocols: cfg.apiKey ? [cfg.apiKey] : [],
      });
      instance.scaleViewport = true;
      instance.viewOnly = viewOnly;
      instance.addEventListener("connect", () => setConnected(true));
      instance.addEventListener("disconnect", (e: { detail?: { clean?: boolean } }) => {
        setConnected(false);
        if (!e?.detail?.clean) setError("Disconnected");
      });
      instance.addEventListener("securityfailure", (e: { detail?: { reason?: string } }) => {
        setError(e?.detail?.reason ?? "Authentication failed");
      });
      rfb = instance;
    })().catch((e) => setError((e as Error).message));

    return () => {
      cancelled = true;
      rfb?.disconnect();
    };
  }, [id, viewOnly]);

  return (
    <div className={`relative rounded-md border border-border bg-black overflow-hidden ${className ?? ""}`}>
      <div ref={targetRef} className="relative w-full aspect-video" />
      {!connected && !error && (
        <div className="absolute inset-x-0 bottom-0 px-3 py-1 text-[10px] text-muted-foreground bg-black/60">
          Connecting…
        </div>
      )}
      {error && (
        <div className="absolute inset-x-0 bottom-0 px-3 py-1 text-[10px] text-[var(--error)] bg-black/60">
          {error}
        </div>
      )}
    </div>
  );
}
