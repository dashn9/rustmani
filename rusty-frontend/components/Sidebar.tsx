"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { CountBadge } from "@/components/ui/Badge";
import {
  IconBrowsers,
  IconLogo,
  IconLogs,
  IconNodes,
  IconOverview,
  IconSettings,
} from "@/components/ui/Icon";
import { useFetch } from "@/lib/hooks";
import { api } from "@/lib/api";
import { loadConfig } from "@/lib/config";
import { useEffect, useState } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  count?: number | null;
};

export function Sidebar() {
  const pathname = usePathname();
  const browsers = useFetch((s) => api.listBrowsers(s), []);

  const items: NavItem[] = [
    { href: "/overview", label: "Overview", icon: IconOverview },
    { href: "/browsers", label: "Browsers", icon: IconBrowsers, count: browsers.data?.length ?? null },
    { href: "/logs", label: "Logs", icon: IconLogs },
    { href: "/flux", label: "Flux", icon: IconNodes },
    { href: "/settings", label: "Settings", icon: IconSettings },
  ];

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col bg-wb text-wb-inverse">
      <div className="flex items-center gap-2.5 px-5 h-14 border-b border-white/10">
        <IconLogo size={22} className="text-accent" />
        <span className="text-sm font-semibold tracking-tight">Rusty Browser</span>
      </div>
      <nav className="flex-1 p-3 space-y-0.5">
        {items.map((it) => {
          const active = pathname === it.href || pathname.startsWith(it.href + "/");
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 h-9 text-sm transition-colors",
                active ? "bg-wb-hover text-wb-inverse" : "text-white/70 hover:bg-wb-hover hover:text-wb-inverse",
              )}
            >
              <it.icon size={16} />
              <span>{it.label}</span>
              {it.count != null && <CountBadge count={it.count} />}
            </Link>
          );
        })}
      </nav>
      <ConnectionFooter ok={!browsers.error} />
    </aside>
  );
}

function ConnectionFooter({ ok }: { ok: boolean }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(loadConfig()?.serverUrl ?? "");
  }, []);
  return (
    <div className="border-t border-white/10 px-4 py-3 flex items-center gap-2 text-[11px]">
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          ok ? "bg-[var(--success)] wb-pulse" : "bg-[var(--error)]",
        )}
      />
      <span className="font-mono truncate text-white/70" title={url}>
        {url || "not configured"}
      </span>
    </div>
  );
}
