"use client";

import { isConfigured } from "@/lib/config";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace(isConfigured() ? "/overview" : "/setup");
  }, [router]);
  return null;
}
