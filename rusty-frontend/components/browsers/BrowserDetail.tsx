"use client";

import { ActionRow } from "@/components/browsers/ActionRow";
import { DisplayStream } from "@/components/browsers/DisplayStream";
import { LogStream } from "@/components/browsers/LogStream";
import { UIMap } from "@/components/browsers/UIMap";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { StateBadge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { describeError } from "@/lib/config";
import { usePolling } from "@/lib/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = { browserId: string };

export function BrowserDetail({ browserId: id }: Props) {
  const router = useRouter();
  const toast = useToast();
  const { data, loading, error } = usePolling(
    (s) => api.getBrowser(id, s), 4000, [id],
  );
  const [screenshot, setScreenshot] = useState<string | null>(null);

  async function closeBrowser() {
    if (!confirm("Close this browser?")) return;
    try {
      await api.closeBrowser(id);
      toast.push({ tone: "success", message: "Browser closed" });
      router.push("/browsers");
    } catch (e) {
      toast.push({ tone: "error", message: describeError(e) });
    }
  }

  if (error) {
    return (
      <Card>
        <CardBody>
          <div className="text-sm text-[var(--error)]">{error.message}</div>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Info</CardTitle></CardHeader>
        <CardBody>
          {loading && !data ? (
            <div className="grid grid-cols-2 gap-3">
              {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-9" />)}
            </div>
          ) : data ? (
            <dl className="grid grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
              <Info label="Execution ID" value={<span className="font-mono text-xs">{data.execution_id}</span>} />
              <Info label="Browser ID" value={<span className="font-mono text-xs">{data.browser_id}</span>} />
              <Info label="State" value={<StateBadge state={data.state} />} />
              <Info label="Contexts" value={<span className="font-mono">{data.contexts.length}</span>} />
              <Info label="Public IP" value={<span className="font-mono text-xs">{data.public_ip || "—"}</span>} />
              <Info label="Private IP" value={<span className="font-mono text-xs">{data.private_ip || "—"}</span>} />
              <Info label="gRPC port" value={<span className="font-mono text-xs">{data.grpc_port || "—"}</span>} />
            </dl>
          ) : null}
        </CardBody>
      </Card>

      <Section title="Display">
        <DisplayStream browserId={id} />
      </Section>

      <Section title="Interaction">
        <ActionRow
          label="Navigate"
          fields={[{ kind: "text", name: "url", placeholder: "https://example.com", mono: true, required: true }]}
          onRun={(v) => api.navigate(id, v.url)}
        />
        <ActionRow
          label="Click"
          fields={[
            { kind: "number", name: "x", placeholder: "x", required: true },
            { kind: "number", name: "y", placeholder: "y", required: true },
          ]}
          onRun={(v) => api.click(id, Number(v.x), Number(v.y))}
        />
        <ActionRow
          label="Node click"
          fields={[{ kind: "number", name: "node_id", placeholder: "node_id", required: true }]}
          onRun={(v) => api.nodeClick(id, Number(v.node_id))}
        />
        <ActionRow
          label="Type"
          fields={[
            { kind: "text", name: "text", placeholder: "text", required: true },
            { kind: "number", name: "node_id", placeholder: "node_id (optional, focus default)" },
          ]}
          onRun={(v) => api.type(id, v.text, v.node_id?.trim() ? Number(v.node_id) : undefined)}
        />
        <ActionRow
          label="Scroll by"
          fields={[{ kind: "number", name: "y", placeholder: "Y pixels", required: true }]}
          onRun={(v) => api.scrollBy(id, Number(v.y))}
        />
        <ActionRow
          label="Scroll to node"
          fields={[{ kind: "number", name: "node_id", placeholder: "node_id", required: true }]}
          onRun={(v) => api.scrollTo(id, Number(v.node_id))}
        />
        <ActionRow
          label="Send keys"
          fields={[{ kind: "text", name: "keys", placeholder: "Enter, Tab, Ctrl+A…", mono: true, required: true }]}
          onRun={(v) => api.sendKeys(id, v.keys)}
        />
        <ActionRow
          label="Hold key"
          fields={[{ kind: "text", name: "key", placeholder: "Shift, Control…", mono: true, required: true }]}
          onRun={(v) => api.holdKey(id, v.key)}
        />
        <ActionRow
          label="Eval JS"
          fields={[{ kind: "text", name: "script", placeholder: "1 + 1", mono: true, required: true }]}
          onRun={(v) => api.evaluate(id, v.script)}
        />
      </Section>

      <Section title="Inspection">
        <div className="rounded-md border border-border bg-card flex items-center gap-2 p-3">
          <span className="text-xs font-medium min-w-24">Screenshot</span>
          <Button
            size="sm"
            onClick={async () => {
              try {
                const r = await api.screenshot(id);
                setScreenshot(r.data);
                toast.push({ tone: "success", message: "Screenshot captured" });
              } catch (e) {
                toast.push({ tone: "error", message: describeError(e) });
              }
            }}
          >
            Capture
          </Button>
          {screenshot && (
            <Button size="sm" variant="ghost" onClick={() => setScreenshot(null)}>Clear</Button>
          )}
        </div>
        {screenshot && (
          <div className="rounded-md border border-border overflow-hidden bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/jpeg;base64,${screenshot}`}
              alt="Screenshot"
              className="w-full h-auto"
            />
          </div>
        )}
        <ActionRow
          label="Fetch HTML"
          fields={[{ kind: "number", name: "node_id", placeholder: "node_id (optional, full page)" }]}
          onRun={(v) => api.fetchHtml(id, v.node_id?.trim() ? Number(v.node_id) : undefined)}
        />
        <ActionRow
          label="Fetch text"
          fields={[{ kind: "number", name: "node_id", placeholder: "node_id", required: true }]}
          onRun={(v) => api.fetchText(id, Number(v.node_id))}
        />
        <ActionRow
          label="Find node"
          fields={[{ kind: "text", name: "selector", placeholder: "CSS selector", mono: true, required: true }]}
          onRun={(v) => api.findNode(id, v.selector)}
        />
        <ActionRow
          label="Wait for node"
          fields={[
            { kind: "text", name: "selector", placeholder: "CSS selector", mono: true, required: true },
            { kind: "number", name: "timeout_ms", placeholder: "timeout ms", required: true },
          ]}
          onRun={(v) => api.waitForNode(id, v.selector, Number(v.timeout_ms))}
        />
      </Section>

      <Section title="UI map">
        <UIMap browserId={id} />
      </Section>

      <Section title="Contexts">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              try {
                const r = await api.createContext(id);
                toast.push({ tone: "success", message: `Context ${r.context_id} opened` });
              } catch (e) {
                toast.push({ tone: "error", message: describeError(e) });
              }
            }}
          >
            Create context
          </Button>
        </div>
        <ActionRow
          label="Close context"
          fields={[{ kind: "text", name: "ctx", placeholder: "context id", mono: true, required: true }]}
          onRun={(v) => api.closeContext(id, v.ctx)}
        />
      </Section>

      <Section title="AI">
        <ActionRow
          label="Instruct"
          fields={[{ kind: "text", name: "instruction", placeholder: "Find the sign-up button and click it…", required: true }]}
          buttonLabel="Send"
          onRun={(v) => api.instruct(id, v.instruction)}
        />
      </Section>

      <Section title="Logs">
        <LogStream executionId={id} height="h-96" />
      </Section>

      <Section title="Lifecycle">
        <div className="flex justify-end">
          <Button variant="danger" size="sm" onClick={closeBrowser}>
            Close browser
          </Button>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}

