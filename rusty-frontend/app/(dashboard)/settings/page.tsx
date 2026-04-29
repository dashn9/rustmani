"use client";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input, Label, SecretInput } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { ApiError, api } from "@/lib/api";
import { clearConfig, isValidUrl, loadConfig, saveConfig } from "@/lib/config";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function SettingsPage() {
  const router = useRouter();
  const toast = useToast();
  const [serverUrl, setServerUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [fluxUrl, setFluxUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const c = loadConfig();
    if (!c) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setServerUrl(c.serverUrl);
    setApiKey(c.apiKey);
    setFluxUrl(c.fluxUrl ?? "");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  async function save() {
    setBusy(true); setError(null);
    const url = serverUrl.trim().replace(/\/+$/, "");
    try {
      await api.ping(url, apiKey.trim());
      saveConfig({ serverUrl: url, apiKey: apiKey.trim(), fluxUrl: fluxUrl.trim() || undefined });
      toast.push({ tone: "success", message: "Connection updated" });
    } catch (e) {
      const msg = e instanceof ApiError
        ? `${e.status === 0 ? "Cannot reach server" : e.status} — ${e.message}`
        : (e as Error).message;
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  function disconnect() {
    if (!confirm("Disconnect and clear local credentials?")) return;
    clearConfig();
    router.replace("/setup");
  }

  async function teardown() {
    if (!confirm("Close all browsers and terminate Flux nodes? This cannot be undone.")) return;
    try {
      setBusy(true);
      await api.teardown();
      toast.push({ tone: "success", message: "Teardown complete" });
    } catch (e) {
      toast.push({ tone: "error", message: (e as Error).message });
    } finally { setBusy(false); }
  }

  return (
    <div>
      <PageHeader title="Settings" description="Connection and danger zone." />

      <div className="space-y-4 max-w-2xl">
        <Card>
          <CardHeader><CardTitle>Rusty Browser</CardTitle></CardHeader>
          <CardBody className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="url">Server URL</Label>
              <Input
                id="url"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                mono
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="key">API Key</Label>
              <SecretInput
                id="key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>
            {error && (
              <div className="rounded-md border border-[var(--error)]/30 bg-[color-mix(in_oklch,var(--error)_8%,var(--card))] px-3 py-2 text-xs text-[var(--error)]">
                {error}
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={save} loading={busy}>Save & reconnect</Button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Flux</CardTitle></CardHeader>
          <CardBody className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="flux">Flux URL</Label>
              <Input
                id="flux"
                value={fluxUrl}
                onChange={(e) => setFluxUrl(e.target.value)}
                mono
                placeholder="http://127.0.0.1:7227"
              />
              <p className="text-[11px] text-muted-foreground">
                Used by the Overview and Nodes pages. Leave blank if not deploying via Flux.
              </p>
            </div>
          </CardBody>
        </Card>

        <Card className="border-[var(--error)]/30">
          <CardHeader><CardTitle className="text-[var(--error)]">Danger zone</CardTitle></CardHeader>
          <CardBody className="space-y-3">
            <Row
              title="Disconnect"
              description="Clear local credentials and return to setup."
              action={<Button variant="secondary" size="sm" onClick={disconnect}>Disconnect</Button>}
            />
            <Row
              title="Teardown all"
              description="Close every browser and terminate all Flux nodes."
              action={<Button variant="danger" size="sm" onClick={teardown} loading={busy}>Teardown</Button>}
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Row({
  title, description, action,
}: { title: string; description: string; action: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-card p-3">
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      {action}
    </div>
  );
}
