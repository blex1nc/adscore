// C1 — Kampanya planındaki "Meta'dan sonuçları çek" bölümü (server component).
// Kampanya Meta'da yayınlanmamışsa dürüst bilgi verir; bağlantı yoksa aksiyon
// BLOCKED döner. Elle giriş ve CSV yolları KALIR — bu bölüm alternatiftir.

import { prisma } from "@adscore/db";
import { getCurrentUser } from "@/lib/auth";
import { MetaSyncForm } from "@/components/insights/meta-sync-form";

const SYNC_STATUS_LABELS: Record<string, string> = {
  QUEUED: "Sırada",
  RUNNING: "Çekiliyor",
  COMPLETED: "Tamamlandı",
  FAILED: "Başarısız",
};

export async function MetaSyncSection({ planId }: { planId: string }) {
  const user = await getCurrentUser();
  if (!user?.workspace) return null;

  const plan = await prisma.campaignPlan.findFirst({
    where: { id: planId, brand: { workspaceId: user.workspace.id } },
    select: {
      id: true,
      metaCampaignId: true,
      metaPublishedAt: true,
      brand: { select: { insightSyncs: { where: { planId }, orderBy: { createdAt: "desc" }, take: 3 } } },
    },
  });
  if (!plan) return null;

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const defaultSince = plan.metaPublishedAt
    ? plan.metaPublishedAt.toISOString().slice(0, 10)
    : new Date(now.getTime() - 29 * 86_400_000).toISOString().slice(0, 10);

  return (
    <div className="mt-4 rounded-xl border border-border bg-muted/30 p-4">
      <h4 className="text-sm font-medium">Meta&apos;dan sonuç senkronu</h4>
      {plan.metaCampaignId ? (
        <>
          <p className="mt-1 text-xs text-muted-foreground">
            Yayınlanan kampanyanın ({plan.metaCampaignId}) gerçek performans
            verisi Meta&apos;dan çekilir ve aynı doğrulamadan geçerek sonuç
            listesine yazılır. Dönüşüm sayıları attribution penceresine
            bağlıdır ve Meta tarafında geriye dönük değişebilir; çekilme tarihi
            sonuç kartında yazar. Aynı dönem tekrar çekilirse satır güncellenir.
          </p>
          <MetaSyncForm
            planId={plan.id}
            defaultSince={defaultSince}
            defaultUntil={today}
          />
          {plan.brand.insightSyncs.length > 0 ? (
            <ul className="mt-3 space-y-1 border-t border-border pt-3 text-[11px] text-muted-foreground">
              {plan.brand.insightSyncs.map((s) => (
                <li key={s.id}>
                  {s.createdAt.toLocaleString("tr-TR")} ·{" "}
                  {s.since.toISOString().slice(0, 10)} →{" "}
                  {s.until.toISOString().slice(0, 10)} ·{" "}
                  {SYNC_STATUS_LABELS[s.status] ?? s.status}
                  {s.error ? ` — ${s.error}` : ""}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">
          Bu plan Meta&apos;da bu panelden yayınlanmadığı için otomatik sonuç
          çekilemez. Sonuçları elle veya CSV ile girebilirsin; yayın akışı
          tamamlanınca bu bölüm aktifleşir.
        </p>
      )}
    </div>
  );
}
