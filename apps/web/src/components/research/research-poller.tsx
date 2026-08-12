"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Süren araştırma varken sayfayı periyodik tazeler.
// Gerçek zamanlı kanal (SSE/websocket) worker altyapısıyla birlikte değerlendirilecek.
export function ResearchPoller() {
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(interval);
  }, [router]);

  return null;
}
