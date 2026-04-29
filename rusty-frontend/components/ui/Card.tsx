import { cn } from "@/lib/cn";

type Props = React.HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...rest }: Props) {
  return (
    <div
      className={cn("rounded-lg border border-border bg-card", className)}
      {...rest}
    />
  );
}

export function CardHeader({ className, ...rest }: Props) {
  return <div className={cn("p-4 border-b border-border", className)} {...rest} />;
}

export function CardBody({ className, ...rest }: Props) {
  return <div className={cn("p-4", className)} {...rest} />;
}

export function CardTitle({ className, ...rest }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-sm font-semibold tracking-tight", className)} {...rest} />;
}
