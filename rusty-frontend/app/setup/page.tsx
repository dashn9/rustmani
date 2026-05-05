"use client";

import { Button } from "@/components/ui/Button";
import { Input, Label, SecretInput } from "@/components/ui/Input";
import { connect, DEFAULT_FLUX_URL, DEFAULT_SERVER_URL, describeError } from "@/lib/config";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function SetupPage() {
  const router = useRouter();
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL);
  const [apiKey, setApiKey] = useState("");
  const [fluxUrl, setFluxUrl] = useState("");
  const [fluxKey, setFluxKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setConnecting(true);
    try {
      await connect({
        serverUrl,
        apiKey,
        fluxUrl: fluxUrl.trim() || undefined,
        fluxKey: fluxKey.trim() || undefined,
      });
      router.replace("/overview");
    } catch (e) {
      setError(describeError(e));
      setConnecting(false);
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <aside className="relative hidden lg:flex flex-col justify-between p-12 bg-wb text-wb-inverse overflow-hidden">
        <div className="relative z-10 flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logos/rusty-browser_inv.png" alt="" width={26} height={26} className="block" />
          <span className="text-base font-semibold tracking-tight">Rusty Browser</span>
        </div>
        <div className="relative z-10 max-w-md">
          <h1 className="text-3xl font-semibold tracking-tight leading-tight">
            Spawn, control, and observe<br />a browser cluster.
          </h1>
          <p className="mt-4 text-sm text-white/65 leading-relaxed">
            Connect to a rusty-server instance to manage browser agents, fan out
            commands, and drive flows with natural-language instructions.
          </p>
          <ul className="mt-8 space-y-2 text-xs text-white/55 font-mono">
            <li>→ multi-agent fan-out</li>
            <li>→ live screenshots & logs</li>
            <li>→ AI instruct loop</li>
          </ul>
        </div>
        <div className="relative z-10 text-[11px] font-mono text-white/40">
          v0.1 · console
        </div>
        <div
          className="pointer-events-none absolute -right-32 -bottom-32 h-[480px] w-[480px] rounded-full"
          style={{ background: "radial-gradient(circle, color-mix(in oklch, var(--accent) 40%, transparent) 0%, transparent 60%)" }}
        />
      </aside>
      <section className="flex flex-col justify-center px-6 sm:px-12 py-12">
        <form onSubmit={onSubmit} className="mx-auto w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logos/rusty-browser-black.png" alt="" width={22} height={22} className="block" />
            <span className="text-sm font-semibold">Rusty Browser</span>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">Connect</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Point the dashboard at a running rusty-server.
          </p>

          <div className="mt-8 space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="url">Server URL</Label>
              <Input
                id="url"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="http://localhost:1011"
                mono
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="key">API Key</Label>
              <SecretInput
                id="key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="•••••••••"
              />
              <p className="text-[11px] text-muted-foreground">
                Matches a value in <code className="font-mono">api_keys</code> in rusty.yaml.
              </p>
            </div>

            <details className="group rounded-md border border-border">
              <summary className="cursor-pointer list-none select-none px-3 py-2 text-xs text-muted-foreground hover:text-foreground flex items-center justify-between">
                <span>Other settings</span>
                <span className="text-[10px] font-mono transition-transform group-open:rotate-90">›</span>
              </summary>
              <div className="space-y-4 border-t border-border p-3">
                <div className="space-y-1.5">
                  <Label htmlFor="flux-url">Flux URL</Label>
                  <Input
                    id="flux-url"
                    value={fluxUrl}
                    onChange={(e) => setFluxUrl(e.target.value)}
                    placeholder={DEFAULT_FLUX_URL}
                    mono
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="flux-key">Flux Key</Label>
                  <SecretInput
                    id="flux-key"
                    value={fluxKey}
                    onChange={(e) => setFluxKey(e.target.value)}
                    placeholder="•••••••••"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Optional. Used by the Flux dashboard panel.
                  </p>
                </div>
              </div>
            </details>
          </div>

          {error && (
            <div className="mt-5 rounded-md border border-[var(--error)]/30 bg-[color-mix(in_oklch,var(--error)_8%,var(--card))] px-3 py-2 text-xs text-[var(--error)]">
              {error}
            </div>
          )}

          <Button type="submit" loading={connecting} className="mt-6 w-full" size="lg">
            {connecting ? "Connecting…" : "Connect"}
          </Button>

          <p className="mt-6 text-[11px] text-muted-foreground">
            The dashboard pings <code className="font-mono">GET /browsers/</code> to verify reachability before saving.
          </p>
        </form>
      </section>
    </div>
  );
}
