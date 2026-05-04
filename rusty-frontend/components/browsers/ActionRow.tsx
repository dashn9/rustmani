"use client";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ActionField } from "@/lib/actionCatalog";
import { describeError } from "@/lib/config";
import { isValidElement, useState } from "react";

export type { ActionField };

type Values = Record<string, string>;

type Props = {
  label: string;
  fields: ActionField[];
  buttonLabel?: string;
  /** Return any value — strings, JSON, React nodes — and ActionRow will render it. */
  onRun: (values: Values) => Promise<unknown>;
};

export function ActionRow({ label, fields, buttonLabel = "Run", onRun }: Props) {
  const [values, setValues] = useState<Values>({});
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState<unknown>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [ranAt, setRanAt] = useState<number | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setOutput(undefined);
    try {
      const result = await onRun(values);
      setOutput(result);
      setRanAt(Date.now());
    } catch (e) {
      setError(describeError(e));
      setRanAt(Date.now());
    } finally {
      setBusy(false);
    }
  }

  const hasOutput = output !== undefined;

  return (
    <div className="rounded-md border border-border bg-card">
      <form onSubmit={submit} className="flex flex-wrap items-center gap-2 p-3">
        <span className="text-xs font-medium min-w-24">{label}</span>
        {fields.map((f) => (
          <Input
            key={f.name}
            type={f.kind === "number" ? "number" : "text"}
            placeholder={'placeholder' in f ? f.placeholder : undefined}
            mono={"mono" in f ? f.mono : false}
            required={'required' in f ? f.required : undefined}
            value={values[f.name] ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
            className="flex-1 min-w-32"
          />
        ))}
        <Button size="sm" type="submit" loading={busy}>{buttonLabel}</Button>
      </form>
      {(hasOutput || error) && (
        <div className="border-t border-border px-3 py-2.5 text-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className={error ? "text-[var(--error)] font-medium" : "text-[var(--success)] font-medium"}>
              {error ? "Failed" : "OK"}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">
              {ranAt ? new Date(ranAt).toLocaleTimeString() : ""}
            </span>
          </div>
          {error
            ? <div className="text-[var(--error)] font-mono break-all">{error}</div>
            : <Output value={output} />}
        </div>
      )}
    </div>
  );
}

function Output({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground italic">no body</span>;
  }
  if (isValidElement(value)) return <>{value}</>;
  if (typeof value === "string") {
    return <pre className="font-mono whitespace-pre-wrap break-all max-h-48 overflow-auto wb-scroll">{value}</pre>;
  }
  return (
    <pre className="font-mono whitespace-pre-wrap break-all max-h-48 overflow-auto wb-scroll">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}
