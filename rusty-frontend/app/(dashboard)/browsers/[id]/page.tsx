"use client";

import { BrowserDetail } from "@/components/browsers/BrowserDetail";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { IconChevronRight } from "@/components/ui/Icon";
import Link from "next/link";
import { use } from "react";

export default function BrowserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <div>
      <div className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/browsers" className="hover:text-foreground">Browsers</Link>
        <IconChevronRight size={12} />
        <span className="font-mono">{id}</span>
      </div>
      <PageHeader
        title="Browser"
        description={<span className="font-mono text-xs">{id}</span>}
        actions={
          <Link href="/browsers">
            <Button variant="secondary" size="sm">Back</Button>
          </Link>
        }
      />
      <BrowserDetail browserId={id} />
    </div>
  );
}
