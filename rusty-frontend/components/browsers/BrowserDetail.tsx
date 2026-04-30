"use client";

import { ActionRow } from "@/components/browsers/ActionRow";
import { LogStream } from "@/components/browsers/LogStream";
import { Button } from "@/components/ui/Button";
import { SlideOver } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { StateBadge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { describeError } from "@/lib/config";
import { usePolling } from "@/lib/hooks";
import { useState } from "react";

type Props = {
  browserId: string | null;
  onClose: () => void;
  onChanged: () => void;
};

export function BrowserDetail({ browserId, onClose, onChanged }: Props) {
  return (
    <SlideOver
      open={browserId !== null}
      onClose={onClose}
      title={browserId ? `Browser ${browserId.slice(0, 12)}…` : ""}
      width="max-w-3xl"
    >
      {browserId && <DetailBody id={browserId} onClose={onClose} onChanged={onChanged} />}
    </SlideOver>
  );
}

function DetailBody({
  id, onClose, onChanged,
}: { id: string; onClose: () => void; onChanged: () => void }) {
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
      onChanged(); onClose();
    } catch (e) {
      toast.push({ tone: "error", message: describeError(e) });
    }
  }

  if (error) {
    return <div className="p-6 text-sm text-[var(--error)]">{error.message}</div>;
  }

  return (
    <div className="p-5 space-y-6">
      <Section title="Info">
        {loading && !data ? (
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-9" />)}
          </div>
        ) : data ? (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Info label="Execution ID" value={<span className="font-mono text-xs">{data.execution_id}</span>} />
            <Info label="Browser ID" value={<span className="font-mono text-xs">{data.browser_id}</span>} />
            <Info label="State" value={<StateBadge state={data.state} />} />
            <Info label="Contexts" value={<span className="font-mono">{data.contexts.length}</span>} />
            <Info label="Public IP" value={<span className="font-mono text-xs">{data.public_ip || "—"}</span>} />
            <Info label="Private IP" value={<span className="font-mono text-xs">{data.private_ip || "—"}</span>} />
            <Info label="gRPC port" value={<span className="font-mono text-xs">{data.grpc_port || "—"}</span>} />
          </dl>
        ) : null}
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
          fields={[{ kind: "text", name: "selector", placeholder: "CSS selector", mono: true, required: true }]}
          onRun={async (v) => {
            const { node_id } = await api.findNode(id, v.selector);
            return api.nodeClick(id, node_id);
          }}
        />
        <ActionRow
          label="Type"
          fields={[
            { kind: "text", name: "text", placeholder: "text", required: true },
            { kind: "text", name: "selector", placeholder: "(optional) CSS selector", mono: true },
          ]}
          onRun={async (v) => {
            let nodeId: number | undefined;
            if (v.selector?.trim()) {
              const r = await api.findNode(id, v.selector);
              nodeId = r.node_id;
            }
            return api.type(id, v.text, nodeId);
          }}
        />
        <ActionRow
          label="Scroll by"
          fields={[{ kind: "number", name: "y", placeholder: "Y pixels", required: true }]}
          onRun={(v) => api.scrollBy(id, Number(v.y))}
        />
        <ActionRow
          label="Scroll to node"
          fields={[{ kind: "text", name: "selector", placeholder: "CSS selector", mono: true, required: true }]}
          onRun={async (v) => {
            const { node_id } = await api.findNode(id, v.selector);
            return api.scrollTo(id, node_id);
          }}
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
          fields={[{ kind: "text", name: "selector", placeholder: "(optional) CSS selector", mono: true }]}
          onRun={async (v) => {
            let nodeId: number | undefined;
            if (v.selector?.trim()) {
              const r = await api.findNode(id, v.selector);
              nodeId = r.node_id;
            }
            return api.fetchHtml(id, nodeId);
          }}
        />
        <ActionRow
          label="Fetch text"
          fields={[{ kind: "text", name: "selector", placeholder: "CSS selector", mono: true, required: true }]}
          onRun={async (v) => {
            const { node_id } = await api.findNode(id, v.selector);
            return api.fetchText(id, node_id);
          }}
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
        <div className="rounded-md border border-border bg-card flex items-center gap-2 p-3">
          <span className="text-xs font-medium min-w-24">UI map</span>
          <Button
            size="sm"
            onClick={async () => {
              try {
                const r = await api.uiMap(id);
                if (typeof navigator !== "undefined" && navigator.clipboard) {
                  await navigator.clipboard.writeText(JSON.stringify(r, null, 2));
                  toast.push({ tone: "info", message: "UI map copied" });
                } else {
                  toast.push({ tone: "info", message: "UI map fetched" });
                }
              } catch (e) {
                toast.push({ tone: "error", message: describeError(e) });
              }
            }}
          >
            Copy JSON
          </Button>
        </div>
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
                onChanged();
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
          onRun={async (v) => {
            const r = await api.closeContext(id, v.ctx);
            onChanged();
            return r;
          }}
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

      <Section title="Lifecycle">
        <div className="flex justify-end">
          <Button variant="danger" size="sm" onClick={closeBrowser}>
            Close browser
          </Button>
        </div>
      </Section>

      <Section title="Logs">
        <LogStream executionId={id} />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        {title}
      </h3>
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
