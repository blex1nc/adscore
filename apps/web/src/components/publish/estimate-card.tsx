"use client";
// B2 — Erişim/teslimat tahmini: SAYILAR YALNIZ META'NIN (CLAUDE.md §6/§31).
// Meta güven veremezse ekran "Insufficient Data" der; kendi sayımızı üretmeyiz.

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { getDeliveryEstimate, type DeliveryEstimateResult } from "@/actions/meta-publish";

type Props = {
  planId: string;
  disabled: boolean;
  disabledReason: string | null;
  customEventType: string | null;
  trafficGoal: "LINK_CLICKS" | "LANDING_PAGE_VIEWS" | null;
  budgetDisplay: string;
};

function num(n: number | null | undefined): string {
  return n == null ? "—" : n.toLocaleString("tr-TR");
}

export function EstimateCard({ planId, disabled, disabledReason, customEventType, trafficGoal, budgetDisplay }: Props) {
  const [result, setResult] = useState<DeliveryEstimateResult | null>(null);
  const [pending, start] = useTransition();

  const fetchEstimate = () => {
    start(async () => {
      setResult(await getDeliveryEstimate(planId, { customEventType, trafficGoal }));
    });
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <h2 className="text-base font-medium">2 · Erişim tahmini (Meta delivery estimate)</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Girdi: kaydettiğin hedefleme + optimizasyon hedefi. Bütçen ({budgetDisplay}) senin kararın; tahmin bütçeyi değiştirmez.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <Button type="button" variant="secondary" size="sm" onClick={fetchEstimate} disabled={disabled || pending}>
          {pending ? "Meta'dan alınıyor…" : "Tahmin al"}
        </Button>
        {disabled && disabledReason ? <span className="text-xs text-muted-foreground">{disabledReason}</span> : null}
      </div>

      {result && "error" in result && result.error ? (
        <p className="mt-3 text-sm text-destructive">{result.error}</p>
      ) : null}
      {result && "blocked" in result && result.blocked ? (
        <p className="mt-3 text-sm text-destructive">BLOCKED — {result.blocked.userMessage}</p>
      ) : null}

      {result && "status" in result && result.status === "insufficient" ? (
        <div className="mt-3 rounded-xl border border-border bg-muted p-4">
          <p className="text-sm font-medium">Insufficient Data</p>
          <p className="mt-1 text-xs text-muted-foreground">{result.note}</p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Kaynak: Meta delivery estimate · {new Date(result.retrievedAt).toLocaleString("tr-TR")}
          </p>
        </div>
      ) : null}

      {result && "status" in result && result.status === "ok" ? (
        <div className="mt-3 space-y-3">
          <p className="text-sm">
            Hedeflemenin tahmini aylık aktif kitle aralığı:{" "}
            <span className="font-medium">
              {num(result.mauLower)} – {num(result.mauUpper)} kişi
            </span>
          </p>
          {result.curve.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-96 text-xs">
                <caption className="mb-1 text-left text-[11px] text-muted-foreground">
                  Meta’nın günlük sonuç eğrisi (noktalar Meta’nın döndürdüğü gibidir; ara değer hesaplamayız)
                </caption>
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-1 pr-3 font-normal">Harcama (minör birim)</th>
                    <th className="py-1 pr-3 font-normal">Erişim</th>
                    <th className="py-1 pr-3 font-normal">Gösterim</th>
                    <th className="py-1 font-normal">Aksiyon</th>
                  </tr>
                </thead>
                <tbody>
                  {result.curve.map((p, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-1 pr-3">{num(p.spend)}</td>
                      <td className="py-1 pr-3">{num(p.reach)}</td>
                      <td className="py-1 pr-3">{num(p.impressions)}</td>
                      <td className="py-1">{num(p.actions)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <p className="text-[11px] text-muted-foreground">
            Kaynak: Meta delivery estimate · {new Date(result.retrievedAt).toLocaleString("tr-TR")}
          </p>
        </div>
      ) : null}
    </section>
  );
}
