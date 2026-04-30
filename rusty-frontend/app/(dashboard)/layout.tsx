"use client";

import { Sidebar } from "@/components/Sidebar";
import { isConfigured } from "@/lib/config";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!isConfigured()) router.replace("/setup");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    else setReady(true);
  }, [router]);

  if (!ready) return null;

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 min-w-0 bg-background">
        <div className="mx-auto max-w-7xl px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
