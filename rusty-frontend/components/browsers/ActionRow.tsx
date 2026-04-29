"use client";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useState } from "react";

export type ActionField =
  | { kind: "text"; name: string; placeholder?: string; mono?: boolean; required?: boolean }
  | { kind: "number"; name: string; placeholder?: string; required?: boolean }
  | { kind: "textarea"; name: string; placeholder?: string; mono?: boolean; required?: boolean };

type Values = Record<string, string>;

type Props = {
  label: string;
  fields: ActionField[];
  buttonLabel?: string;
  onRun: (values: Values) => Promise<React.ReactNode | void>;
};

export function ActionRow({ label, fields, buttonLabel = "Run", onRun }: Props) {
  const [values, setValues] = useState<Values>({});
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState<React.ReactNode | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const result = await onRun(values);
      setOutput(result ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-md border border-border bg-card">
      <form onSubmit={submit} className="flex flex-wrap items-center gap-2 p-3">
        <span className="text-xs font-medium min-w-24">{label}</span>
        {fields.map((f) => (
          <Input
            key={f.name}
            type={f.kind === "number" ? "number" : "text"}
            placeholder={f.placeholder}
            mono={"mono" in f ? f.mono : false}
            required={f.required}
            value={values[f.name] ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
            className="flex-1 min-w-32"
          />
        ))}
        <Button size="sm" type="submit" loading={busy}>{buttonLabel}</Button>
      </form>
      {(output || error) && (
        <div className="border-t border-border p-3 text-xs">
          {error && <div className="text-[var(--error)]">{error}</div>}
          {output && <div className="text-foreground">{output}</div>}
        </div>
      )}
    </div>
  );
}
