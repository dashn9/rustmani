"use client";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input, Label, SecretInput } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { clearConfig, connect, DEFAULT_FLUX_URL, describeError, loadConfig } from "@/lib/config";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SettingsPage() {
  const router = useRouter();
  const toast = useToast();
  const initial = typeof window !== "undefined" ? loadConfig() : null;
  const [serverUrl, setServerUrl] = useState(initial?.serverUrl ?? "");
  const [apiKey, setApiKey] = useState(initial?.apiKey ?? "");
  const [fluxUrl, setFluxUrl] = useState(initial?.fluxUrl ?? DEFAULT_FLUX_URL);
  const [fluxKey, setFluxKey] = useState(initial?.fluxKey ?? "");
  const [saving, setSaving] = useState(false);
  const [tearing, setTearing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null); setSaving(true);
    try {
      await connect({ serverUrl, apiKey, fluxUrl: fluxUrl || undefined, fluxKey: fluxKey || undefined });
      toast.push({ tone: "success", message: "Connection updated" });
    } catch (e) {
      setError(describeError(e));
    } finally {
      setSaving(false);
    }
  }

  function disconnect() {
    if (!confirm("Disconnect and clear local credentials?")) return;
    clearConfig();
    router.replace("/setup");
  }

  async function teardown() {
    if (!confirm("Close all browsers and terminate Flux nodes? This cannot be undone.")) return;
    setTearing(true);
    try {
      await api.teardown();
      toast.push({ tone: "success", message: "Teardown complete" });
    } catch (e) {
      toast.push({ tone: "error", message: describeError(e) });
    } finally { setTearing(false); }
  }

  return (
    <div>
      <PageHeader title="Settings" description="Connection and danger zone." />

      <div className="space-y-4 max-w-2xl">
        <Card>
          <CardHeader><CardTitle>Connection</CardTitle></CardHeader>
          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Server URL" htmlFor="url">
                <Input id="url" mono value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} />
              </Field>
              <Field label="API Key" htmlFor="key">
                <SecretInput id="key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
              </Field>
              <Field
                label="Flux URL"
                htmlFor="flux-url"
                hint="Optional. Powers Overview and Nodes pages."
              >
                <Input id="flux-url" mono placeholder="http://127.0.0.1:7227" value={fluxUrl} onChange={(e) => setFluxUrl(e.target.value)} />
              </Field>
              <Field label="Flux API key" htmlFor="flux-key">
                <SecretInput id="flux-key" value={fluxKey} onChange={(e) => setFluxKey(e.target.value)} />
              </Field>
            </div>
            {error && (
              <div className="rounded-md border border-[var(--error)]/30 bg-[color-mix(in_oklch,var(--error)_8%,var(--card))] px-3 py-2 text-xs text-[var(--error)]">
                {error}
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={save} loading={saving}>Save & reconnect</Button>
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
              action={<Button variant="danger" size="sm" onClick={teardown} loading={tearing}>Teardown</Button>}
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Field({
  label, htmlFor, hint, children,
}: { label: string; htmlFor: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
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
