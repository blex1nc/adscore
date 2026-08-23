"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { advanceEvolutionRun } from "@/actions/evolution";

// Koşu RUNNING/QUEUED iken 3 sn'de bir advanceEvolutionRun(runId) çağırır (aşama sunucuda
// after() ile koşar, action hemen döner) VE sayfayı tazeler. Sekme kapanırsa
// koşu kaldığı aşamada bekler, sekme açılınca sürer (claim yarış koruması sunucuda).
export function ArenaPoller({ runId }: { runId: string }) {
  const router = useRouter();
  const inFlight = useRef(false);
  const done = useRef(false);

  useEffect(() => {
    const tick = async () => {
      if (done.current) return;
      if (!inFlight.current) {
        inFlight.current = true;
        try {
          const r = await advanceEvolutionRun(runId);
          if (r.status !== "RUNNING" && r.status !== "QUEUED") done.current = true;
        } catch {
          // Ağ/sunucu hatası: bir sonraki tikte tekrar denenir; sayfa tazelenince durum görünür
        } finally {
          inFlight.current = false;
        }
      }
      router.refresh();
    };
    void tick();
    const interval = setInterval(tick, 3000);
    return () => clearInterval(interval);
  }, [runId, router]);

  return null;
}
