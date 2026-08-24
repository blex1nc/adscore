"use client";
// B3+B4+B5 — Yayın akışı: seçim → önizleme → AÇIK ONAY → aşamalı oluşturma (hepsi PAUSED).
// Onaysız tek Meta nesnesi oluşmaz (CLAUDE.md §16/§20, HANDOFF §9).

import { useEffect, useRef, useState, useTransition } from "react";
import { ExternalLink } from "lucide-react";
import { Button, Input } from "@/components/ui";
import {
  advanceMetaPublish,
  confirmMetaPublish,
  getOfficialPreviews,
  prepareMetaPublish,
  retryMetaPublish,
  type OfficialPreviewResult,
  type PreviewPayloads,
} from "@/actions/meta-publish";
import type { PublishSnapshot } from "@/lib/meta-publish/run";
import { EstimateCard } from "./estimate-card";

export type FlowCreative = {
  id: string;
  headline: string;
  primaryText: string;
  ctaRaw: string;
  ctaEnum: string | null;
  ctaLabel: string | null;
  images: Array<{ id: string }>;
};

type Props = {
  planId: string;
  creatives: FlowCreative[];
  objectiveKey: string;
  hasPixel: boolean;
  budgetType: "DAILY" | "LIFETIME";
  budgetDisplay: string;
  defaultUrl: string;
  defaultCampaignName: string;
  defaultAdSetName: string;
  eventOptions: Array<{ value: string; label: string }>;
  initialSnapshot: PublishSnapshot | null;
  blockers: string[];
  /** Hedefleme kaydedilmemişse tahmin kapalı (nedeni yazılır) */
  estimateDisabledReason: string | null;
};

const STAGE_LABELS: Record<string, string> = {
  CAMPAIGN: "Kampanya",
  ADSET: "Reklam seti",
  MEDIA: "Görsel yükleme",
  CREATIVE: "Creative",
  AD: "Reklam",
  DONE: "Tamamlandı",
};

function errText(r: { error?: string; blocked?: { userMessage: string } }): string | null {
  if (r.blocked) return `BLOCKED — ${r.blocked.userMessage}`;
  return r.error ?? null;
}

export function PublishFlow(props: Props) {
  const firstCreative = props.creatives[0] ?? null;
  const [creativeId, setCreativeId] = useState(firstCreative?.id ?? "");
  const selCreative = props.creatives.find((c) => c.id === creativeId) ?? firstCreative;
  const [imageId, setImageId] = useState(selCreative?.images[0]?.id ?? "");
  const [url, setUrl] = useState(props.defaultUrl);
  const [campaignName, setCampaignName] = useState(props.defaultCampaignName);
  const [adSetName, setAdSetName] = useState(props.defaultAdSetName);
  const [adName, setAdName] = useState(selCreative ? `Reklam — ${selCreative.headline.slice(0, 60)}` : "Reklam");
  const [event, setEvent] = useState<string | null>(props.objectiveKey === "sales" ? null : null);
  const [trafficGoal, setTrafficGoal] = useState<"LINK_CLICKS" | "LANDING_PAGE_VIEWS">("LINK_CLICKS");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const [preview, setPreview] = useState<PreviewPayloads | null>(null);
  const [official, setOfficial] = useState<OfficialPreviewResult | null>(null);
  const [approved, setApproved] = useState(false);
  const [snapshot, setSnapshot] = useState<PublishSnapshot | null>(props.initialSnapshot);
  const [ackOrphan, setAckOrphan] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [preparing, startPrepare] = useTransition();
  const [previewing, startPreview] = useTransition();
  const [confirming, startConfirm] = useTransition();

  const running = snapshot?.status === "RUNNING";
  const completed = snapshot?.status === "COMPLETED";
  const failed = snapshot?.status === "FAILED";
  const snapshotId = snapshot?.id ?? null;
  const inFlight = useRef(false);

  // Poller: RUNNING iken 3 sn'de bir aşama ilerletilir (claim sunucuda — çift
  // tetikleme çift kampanya YAPMAZ, §5.5 testi bunun kanıtı).
  useEffect(() => {
    if (!running || !snapshotId) return;
    const id = snapshotId;
    const tick = async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const r = await advanceMetaPublish(id);
        if ("status" in r) setSnapshot(r as PublishSnapshot);
        else setMsg(errText(r));
      } catch {
        // ağ hatası: sonraki tik
      } finally {
        inFlight.current = false;
      }
    };
    void tick();
    const t = setInterval(tick, 3000);
    return () => clearInterval(t);
  }, [running, snapshotId]);

  const selectionPayload = () => ({
    creativeId,
    imageId,
    destinationUrl: url.trim(),
    ctaEnum: selCreative?.ctaEnum ?? null,
    customEventType: props.objectiveKey === "sales" ? event : null,
    trafficGoal: props.objectiveKey === "traffic" ? trafficGoal : null,
    campaignName: campaignName.trim(),
    adSetName: adSetName.trim(),
    adName: adName.trim(),
    startTime: props.budgetType === "LIFETIME" && startTime ? new Date(startTime).toISOString() : null,
    endTime: props.budgetType === "LIFETIME" && endTime ? new Date(endTime).toISOString() : null,
  });

  const prepare = () => {
    setMsg(null);
    setOfficial(null);
    startPrepare(async () => {
      const r = await prepareMetaPublish(props.planId, selectionPayload());
      if ("publishId" in r) {
        setPreview(r);
        setApproved(false);
      } else setMsg(errText(r));
    });
  };

  const fetchOfficial = () => {
    if (!preview) return;
    setMsg(null);
    startPreview(async () => {
      setOfficial(await getOfficialPreviews(preview.publishId));
    });
  };

  const confirmAndStart = () => {
    if (!preview) return;
    setMsg(null);
    startConfirm(async () => {
      const r = await confirmMetaPublish(preview.publishId);
      if ("ok" in r) {
        setSnapshot({
          id: preview.publishId,
          status: "RUNNING",
          stage: "CAMPAIGN",
          error: null,
          ids: { campaign: null, adSet: null, creative: null, ad: null },
          links: { campaign: null, adSet: null, ad: null },
        });
      } else setMsg(errText(r));
    });
  };

  const retry = () => {
    if (!snapshot) return;
    setMsg(null);
    startConfirm(async () => {
      const r = await retryMetaPublish(snapshot.id, ackOrphan);
      if ("ok" in r) {
        setSnapshot({ ...snapshot, status: "RUNNING", error: null });
        setAckOrphan(false);
      } else setMsg(errText(r));
    });
  };

  // ---- Sonuç / süreç ekranı (mevcut yayın varsa seçim yerine bu gösterilir) ----
  if (snapshot && (running || completed || failed)) {
    const rows = [
      ["Kampanya", snapshot.ids.campaign, snapshot.links.campaign],
      ["Reklam seti", snapshot.ids.adSet, snapshot.links.adSet],
      ["Creative", snapshot.ids.creative, null],
      ["Reklam", snapshot.ids.ad, snapshot.links.ad],
    ] as const;
    return (
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-base font-medium">3 · Meta yayını {completed ? "— tamamlandı (PAUSED)" : failed ? "— durdu" : "— sürüyor"}</h2>
        {running ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Aşama: <span className="font-medium text-foreground">{STAGE_LABELS[snapshot.stage] ?? snapshot.stage}</span> — nesneler sırayla, PAUSED olarak oluşturuluyor…
          </p>
        ) : null}
        {failed ? (
          <div className="mt-3 rounded-xl border border-destructive/40 bg-muted p-4 text-sm">
            <p className="font-medium">Yayın “{STAGE_LABELS[snapshot.stage] ?? snapshot.stage}” aşamasında durdu.</p>
            <p className="mt-1 text-muted-foreground">{snapshot.error}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Aşağıdaki tablo Meta’da ŞU ANA KADAR oluşan nesneleri gösterir; tekrar deneme bunları yeniden oluşturmaz.
            </p>
            {snapshot.error?.includes("Ads Manager") ? (
              <label className="mt-2 flex items-center gap-2 text-xs">
                <input type="checkbox" checked={ackOrphan} onChange={(e) => setAckOrphan(e.target.checked)} />
                Ads Manager’ı kontrol ettim; bu aşamada nesne oluşmamış — devam et
              </label>
            ) : null}
            <div className="mt-3">
              <Button type="button" size="sm" onClick={retry} disabled={confirming}>
                {confirming ? "Sürdürülüyor…" : "Kaldığı yerden sürdür"}
              </Button>
            </div>
          </div>
        ) : null}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-80 text-sm">
            <tbody>
              {rows.map(([label, idVal, link]) => (
                <tr key={label} className="border-b border-border/50">
                  <td className="py-2 pr-4 text-muted-foreground">{label}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{idVal ?? "—"}</td>
                  <td className="py-2">
                    {link ? (
                      <a href={link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
                        Ads Manager’da aç <ExternalLink size={11} />
                      </a>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {completed ? (
          <p className="mt-4 rounded-xl border border-border bg-muted p-4 text-sm">
            Tüm nesneler <span className="font-medium">PAUSED</span> durumda oluşturuldu ve para harcamıyor.
            Meta, reklamı incelemeye alır (PENDING_REVIEW) ve inceleme bitince PAUSED’a döner.{" "}
            <span className="font-medium">Yayına almak için Ads Manager’dan sen aktif edeceksin</span> — AdScore bu sprintte hiçbir nesneyi aktifleştirmez.
          </p>
        ) : null}
        {msg ? <p className="mt-3 text-sm text-destructive">{msg}</p> : null}
      </section>
    );
  }

  // ---- Seçim + önizleme + onay ----
  const disabled = props.blockers.length > 0 || !selCreative;
  return (
    <>
      <EstimateCard
        planId={props.planId}
        disabled={Boolean(props.estimateDisabledReason) || (props.objectiveKey === "sales" && !event)}
        disabledReason={
          props.estimateDisabledReason ??
          (props.objectiveKey === "sales" && !event
            ? "Önce aşağıdan dönüşüm olayını seç (satış tahmini olaysız istenemez)."
            : null)
        }
        customEventType={props.objectiveKey === "sales" ? event : null}
        trafficGoal={props.objectiveKey === "traffic" ? trafficGoal : null}
        budgetDisplay={props.budgetDisplay}
      />
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-base font-medium">3 · Yayın (önizleme → onay → PAUSED oluşturma)</h2>
        {props.blockers.length > 0 ? (
          <ul className="mt-2 list-disc pl-5 text-sm text-destructive">
            {props.blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        ) : null}

        {!disabled ? (
          <div className="mt-4 space-y-4">
            {/* Creative + görsel seçimi */}
            <div>
              <p className="text-sm font-medium">Onaylı creative</p>
              <div className="mt-1.5 space-y-1.5">
                {props.creatives.map((c) => (
                  <label key={c.id} className="flex items-start gap-2 text-sm">
                    <input
                      type="radio"
                      name="creative"
                      checked={creativeId === c.id}
                      onChange={() => {
                        setCreativeId(c.id);
                        setImageId(c.images[0]?.id ?? "");
                        setAdName(`Reklam — ${c.headline.slice(0, 60)}`);
                        setPreview(null);
                      }}
                    />
                    <span>
                      <span className="font-medium">{c.headline}</span>
                      <span className="block text-xs text-muted-foreground">
                        {c.primaryText.slice(0, 90)}
                        {c.primaryText.length > 90 ? "…" : ""} · CTA: {c.ctaLabel ?? c.ctaRaw}
                        {c.ctaEnum ? ` (${c.ctaEnum} — yaklaşık eşleme, doğrula)` : " (buton eşleşmedi; butonsuz gider)"}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              {selCreative && selCreative.images.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {selCreative.images.map((img) => (
                    <button
                      key={img.id}
                      type="button"
                      onClick={() => {
                        setImageId(img.id);
                        setPreview(null);
                      }}
                      className={
                        "overflow-hidden rounded-lg border " +
                        (imageId === img.id ? "border-accent ring-2 ring-accent" : "border-border")
                      }
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/creative-images/${img.id}`} alt="Creative görseli" className="h-24 w-24 object-cover" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Alanlar */}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block text-xs text-muted-foreground">Hedef URL</span>
                <Input value={url} onChange={(e) => { setUrl(e.target.value); setPreview(null); }} placeholder="https://…" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs text-muted-foreground">Kampanya adı</span>
                <Input value={campaignName} onChange={(e) => { setCampaignName(e.target.value); setPreview(null); }} />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs text-muted-foreground">Reklam seti adı</span>
                <Input value={adSetName} onChange={(e) => { setAdSetName(e.target.value); setPreview(null); }} />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs text-muted-foreground">Reklam adı</span>
                <Input value={adName} onChange={(e) => { setAdName(e.target.value); setPreview(null); }} />
              </label>
              {props.objectiveKey === "sales" ? (
                <label className="text-sm">
                  <span className="mb-1 block text-xs text-muted-foreground">
                    Dönüşüm olayı {props.hasPixel ? "(pixel bağlı)" : "(pixel YOK — satış yayını için gerekli)"}
                  </span>
                  <select
                    value={event ?? ""}
                    onChange={(e) => { setEvent(e.target.value || null); setPreview(null); }}
                    className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
                  >
                    <option value="">Seç (varsayılan yok)</option>
                    {props.eventOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {props.objectiveKey === "traffic" ? (
                <label className="text-sm">
                  <span className="mb-1 block text-xs text-muted-foreground">Optimizasyon hedefi</span>
                  <select
                    value={trafficGoal}
                    onChange={(e) => { setTrafficGoal(e.target.value as typeof trafficGoal); setPreview(null); }}
                    className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
                  >
                    <option value="LINK_CLICKS">Bağlantı tıklamaları (LINK_CLICKS)</option>
                    <option value="LANDING_PAGE_VIEWS">Yönlendirme sayfası görüntülemeleri (LANDING_PAGE_VIEWS)</option>
                  </select>
                </label>
              ) : null}
              {props.budgetType === "LIFETIME" ? (
                <>
                  <label className="text-sm">
                    <span className="mb-1 block text-xs text-muted-foreground">Başlangıç (toplam bütçe için zorunlu)</span>
                    <Input type="datetime-local" value={startTime} onChange={(e) => { setStartTime(e.target.value); setPreview(null); }} />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-xs text-muted-foreground">Bitiş (toplam bütçe için zorunlu)</span>
                    <Input type="datetime-local" value={endTime} onChange={(e) => { setEndTime(e.target.value); setPreview(null); }} />
                  </label>
                </>
              ) : null}
            </div>

            <div className="flex items-center gap-3">
              <Button type="button" variant="secondary" onClick={prepare} disabled={preparing}>
                {preparing ? "Hazırlanıyor…" : "Önizlemeyi hazırla"}
              </Button>
              <span className="text-xs text-muted-foreground">Bu adımda Meta’ya hiçbir şey gönderilmez.</span>
            </div>

            {/* Önizleme (HANDOFF §9 Stage 1) */}
            {preview ? (
              <div className="rounded-xl border border-border bg-background p-4">
                <p className="text-sm font-medium">Meta’ya gidecek nesneler (özet)</p>
                <dl className="mt-2 grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">Kampanya</dt>
                    <dd>
                      {String(preview.campaign.name)} · {String(preview.campaign.objective)} · durum: <span className="font-medium">PAUSED</span>
                      {Array.isArray(preview.campaign.special_ad_categories) && preview.campaign.special_ad_categories.length > 0
                        ? ` · özel kategori: ${(preview.campaign.special_ad_categories as string[]).join(", ")}`
                        : " · özel kategori: yok"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Reklam seti</dt>
                    <dd>
                      {String(preview.adSet.name)} · {String(preview.adSet.optimization_goal)} · bütçe: <span className="font-medium">{preview.budgetDisplay}</span> · durum: <span className="font-medium">PAUSED</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Creative</dt>
                    <dd>
                      Başlık: {String((preview.creative.object_story_spec as { link_data?: { name?: string } })?.link_data?.name ?? "—")} · Sayfa: {String((preview.creative.object_story_spec as { page_id?: string })?.page_id ?? "—")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Reklam</dt>
                    <dd>{String(preview.ad.name)} · durum: <span className="font-medium">PAUSED</span></dd>
                  </div>
                </dl>

                {/* B5 — resmî önizleme (açık beyanla görsel yüklenir) */}
                <div className="mt-3 border-t border-border pt-3">
                  <Button type="button" variant="secondary" size="sm" onClick={fetchOfficial} disabled={previewing}>
                    {previewing ? "Önizleme alınıyor…" : "Görseli yükle + resmî önizleme al"}
                  </Button>
                  <span className="ml-2 text-[11px] text-muted-foreground">
                    Bu adım seçili görseli reklam hesabının medya kütüphanesine yükler (kampanya nesnesi oluşmaz, harcama yok).
                  </span>
                  {official && "previews" in official ? (
                    <div className="mt-3 space-y-3">
                      {official.previews.map((p) => (
                        <details key={p.format} open={p.format === "MOBILE_FEED_STANDARD"}>
                          <summary className="cursor-pointer text-xs font-medium">{p.label}</summary>
                          <div className="mt-2 overflow-x-auto rounded-lg border border-border bg-card p-2" dangerouslySetInnerHTML={{ __html: p.body }} />
                          <p className="mt-1 text-[11px] text-muted-foreground">Kaynak: Meta generatepreviews (24 saat geçerli render).</p>
                        </details>
                      ))}
                      {official.failed.map((f) => (
                        <p key={f.format} className="text-xs text-muted-foreground">
                          {f.label}: resmî önizleme alınamadı ({f.reason}) — Creative Studio’daki nötr önizleme çerçevesini kullanabilirsin.
                        </p>
                      ))}
                    </div>
                  ) : null}
                  {official && "error" in official && official.error ? (
                    <p className="mt-2 text-xs text-destructive">{official.error} — nötr önizleme için Creative Studio’ya bak.</p>
                  ) : null}
                  {official && "blocked" in official && official.blocked ? (
                    <p className="mt-2 text-xs text-destructive">BLOCKED — {official.blocked.userMessage}</p>
                  ) : null}
                </div>

                {/* Onay (HANDOFF §9 Stage 2) */}
                <div className="mt-3 border-t border-border pt-3">
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} />
                    <span>
                      Onaylıyorum: yukarıdaki kampanya, reklam seti, creative ve reklam Meta’da{" "}
                      <span className="font-medium">PAUSED (duraklatılmış)</span> olarak oluşturulsun. Harcama başlamaz;
                      aktifleştirme yalnız Ads Manager’dan, benim tarafımdan yapılır.
                    </span>
                  </label>
                  <div className="mt-3">
                    <Button type="button" onClick={confirmAndStart} disabled={!approved || confirming}>
                      {confirming ? "Başlatılıyor…" : "Meta'da taslak oluştur (PAUSED)"}
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        {msg ? <p className="mt-3 text-sm text-destructive">{msg}</p> : null}
      </section>
    </>
  );
}
