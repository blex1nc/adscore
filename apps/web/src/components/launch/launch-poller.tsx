"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Wizard'da süren iş (RUNNING/QUEUED) varken sayfayı tazeler
// (components/research/research-poller.tsx deseni). Yalnızca süren iş
// varken mount edilir; iş bitince sunucu bileşeni poller'ı render etmez.
// Arena'yı ilerleten A'nın sayfasıdır; bu poller yalnız görüntüyü tazeler.
export function LaunchPoller({ intervalMs = 3000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(interval);
  }, [router, intervalMs]);

  return null;
}
