"use client";

import { loadConfig } from "@/lib/config";
import { useEffect, useRef, useState } from "react";

type Props = { browserId: string };

export function DisplayStream({ browserId: id }: Props) {
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
      const { default: RFB } = await import("@novnc/novnc/lib/rfb");
      if (cancelled) return;

      const instance = new RFB(target, url, {
        wsProtocols: cfg.apiKey ? [cfg.apiKey] : [],
      });
      instance.scaleViewport = true;
      instance.viewOnly = false;
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
  }, [id]);

  return (
    <div className="rounded-md border border-border bg-black overflow-hidden">
      <div ref={targetRef} className="w-full aspect-video" />
      {!connected && !error && (
        <div className="px-3 py-2 text-xs text-muted-foreground">Connecting…</div>
      )}
      {error && (
        <div className="px-3 py-2 text-xs text-[var(--error)]">{error}</div>
      )}
    </div>
  );
}
