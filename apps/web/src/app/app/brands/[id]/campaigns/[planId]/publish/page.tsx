import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { MetaBlockedError, requireBrandBinding } from "@/lib/meta/client";
import { matchCta, matchObjective } from "@/lib/publish-kit/build";
import {
  loadPublishSource,
  planObjectiveKey,
  publishBlockers,
} from "@/lib/meta-publish/access";
import {
  adsManagerAdSetUrl,
  adsManagerAdUrl,
  adsManagerCampaignUrl,
  CUSTOM_EVENT_TYPES,
  isSupportedObjective,
} from "@/lib/meta-publish/payloads";
import { readStoredTargeting } from "@/lib/meta-publish/stages";
import type { PublishSnapshot } from "@/lib/meta-publish/run";
import { PublishFlow, type FlowCreative } from "@/components/publish/publish-flow";
import { TargetingForm } from "@/components/publish/targeting-form";

export const metadata = { title: "Meta'da yayınla (PAUSED) | AdScore" };

export default async function PublishPage({
  params,
}: {
  params: Promise<{ id: string; planId: string }>;
}) {
  const { id, planId } = await params;
  const user = await getCurrentUser();
  if (!user?.workspace) redirect("/login");

  const source = await loadPublishSource(planId, user.id);
  if (!source || source.brand.id !== id) notFound();

  // Meta bağlantısı/varlıkları — eksikse dürüst BLOCKED (mock yok, CLAUDE.md §33)
  let binding: Awaited<ReturnType<typeof requireBrandBinding>> | null = null;
  let blockedMsg: string | null = null;
  try {
    binding = await requireBrandBinding(source.brand.id);
  } catch (e) {
    blockedMsg =
      e instanceof MetaBlockedError
        ? e.userMessage
        : "Meta istemcisi şu anda kullanılamıyor. Daha sonra tekrar deneyin.";
  }

  const objectiveKey = planObjectiveKey(source);
  const objective = matchObjective(objectiveKey ?? undefined, undefined);
  const result = (source.result ?? {}) as {
    audience?: { suggestion?: { interests_behaviors?: string; detailed_targeting?: string[] } };
  };
  const aiSuggestion =
    result.audience?.suggestion?.detailed_targeting?.join(", ") ??
    result.audience?.suggestion?.interests_behaviors ??
    null;

  const stored = readStoredTargeting(source.metaTargeting);
  const blockers = publishBlockers(source);
  const budgetDisplay = `${source.budgetAmount.toString()} ${source.currency} (${
    source.budgetType === "DAILY" ? "günlük" : "toplam"
  })`;

  const creatives: FlowCreative[] = source.creatives
    .filter((c) => c.images.length > 0)
    .map((c) => {
      const cta = matchCta(c.cta);
      return {
        id: c.id,
        headline: c.headline,
        primaryText: c.primaryText,
        ctaRaw: c.cta,
        ctaEnum: cta.apiEnum,
        ctaLabel: cta.label,
        images: c.images.map((i) => ({ id: i.id })),
      };
    });

  const latest = source.publishes[0] ?? null;
  const initialSnapshot: PublishSnapshot | null =
    latest && latest.status !== "DRAFT"
      ? {
          id: latest.id,
          status: latest.status,
          stage: latest.stage,
          error: latest.error,
          ids: {
            campaign: latest.metaCampaignId,
            adSet: latest.metaAdSetId,
            creative: latest.metaCreativeId,
            ad: latest.metaAdId,
          },
          links: {
            campaign:
              binding && latest.metaCampaignId
                ? adsManagerCampaignUrl(binding.adAccountId, latest.metaCampaignId)
                : null,
            adSet:
              binding && latest.metaAdSetId
                ? adsManagerAdSetUrl(binding.adAccountId, latest.metaAdSetId)
                : null,
            ad:
              binding && latest.metaAdId
                ? adsManagerAdUrl(binding.adAccountId, latest.metaAdId)
                : null,
          },
        }
      : null;

  const unsupported = objectiveKey != null && !isSupportedObjective(objectiveKey);

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href={`/app/brands/${source.brand.id}/campaigns`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-300 hover:text-foreground"
      >
        <ArrowLeft size={14} />
        {source.brand.name} · Kampanya kiti
      </Link>
      <div className="mt-3">
        <h1 className="font-display text-3xl">Meta’da yayınla — hepsi PAUSED</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Onaylı creative + plan, bağlı reklam hesabında <span className="font-medium">duraklatılmış</span> taslak
          nesnelere dönüştürülür. Harcama başlamaz; aktifleştirme yalnız Ads Manager’dan, senin tarafından yapılır.
          Amaç: {objective ? `${objective.labelTr} (${objective.apiEnum})` : "plandan çıkarılamadı"} · Bütçe: {budgetDisplay}.
          Elle kurulum istersen{" "}
          <Link href={`/app/brands/${source.brand.id}/campaigns/${source.id}/kit`} className="text-accent hover:underline">
            PublishKit
          </Link>{" "}
          her zaman açık.
        </p>
      </div>

      {blockedMsg ? (
        <div className="mt-6 rounded-2xl border border-border bg-card p-6">
          <p className="text-sm font-medium">BLOCKED — Meta bağlantısı hazır değil</p>
          <p className="mt-1 text-sm text-muted-foreground">{blockedMsg}</p>
          <Link href="/app/settings/meta" className="mt-3 inline-block text-sm text-accent hover:underline">
            Ayarlar → Meta bağlantısı
          </Link>
        </div>
      ) : unsupported ? (
        <div className="mt-6 rounded-2xl border border-border bg-card p-6 text-sm">
          <p className="font-medium">Bu amaç için API yayın yolu bu sprintte kapalı</p>
          <p className="mt-1 text-muted-foreground">
            “{objective?.labelTr ?? objectiveKey}” amacı için yalnız doğrulanmış kombinasyonları gönderiyoruz
            (şimdilik Trafik ve Satışlar). Kampanyayı{" "}
            <Link href={`/app/brands/${source.brand.id}/campaigns/${source.id}/kit`} className="text-accent hover:underline">
              PublishKit
            </Link>{" "}
            ile Ads Manager’da elle kurabilirsin.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          <TargetingForm
            planId={source.id}
            brandId={source.brand.id}
            aiSuggestion={aiSuggestion}
            initial={stored}
            initialSpecial={source.specialAdCategories}
            suggestedCountry={source.brand.targetMarket}
          />
          <PublishFlow
            planId={source.id}
            creatives={creatives}
            objectiveKey={objectiveKey ?? ""}
            hasPixel={Boolean(binding?.pixelId)}
            budgetType={source.budgetType}
            budgetDisplay={budgetDisplay}
            defaultUrl={source.brand.website ?? ""}
            defaultCampaignName={`AdScore | ${source.brand.name} | ${objective?.labelTr ?? "Kampanya"}`}
            defaultAdSetName={`${source.brand.name} — ${stored?.countries.join("+") ?? "hedef"} seti`}
            eventOptions={CUSTOM_EVENT_TYPES.map((e) => ({ value: e.value, label: e.label }))}
            initialSnapshot={initialSnapshot}
            blockers={blockers}
            estimateDisabledReason={stored ? null : "Önce hedeflemeyi kaydet."}
          />
        </div>
      )}
    </div>
  );
}
