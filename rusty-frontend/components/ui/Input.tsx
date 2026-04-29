"use client";

import { cn } from "@/lib/cn";
import { forwardRef, useState } from "react";

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  mono?: boolean;
};

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { className, mono, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-9 w-full rounded-md border border-border bg-card px-3 text-sm",
        "placeholder:text-muted-foreground",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-wb",
        "disabled:opacity-50",
        mono && "font-mono",
        className,
      )}
      {...rest}
    />
  );
});

type SecretProps = Props;

export function SecretInput({ className, ...rest }: SecretProps) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        {...rest}
        type={show ? "text" : "password"}
        mono
        className={cn("pr-12", className)}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        {show ? "Hide" : "Show"}
      </button>
    </div>
  );
}

type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;
export function Label({ className, ...rest }: LabelProps) {
  return (
    <label
      className={cn("text-xs font-medium text-muted-foreground tracking-wide uppercase", className)}
      {...rest}
    />
  );
}
