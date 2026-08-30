// C2 — Ad Library (ads_archive) saf yardımcıları. Prisma'sız/fetch'siz; birim testli.
// Uç doğrulaması: docs/meta/SOURCES-C.md §4 (retrieved 2026-08-24).
//
// Telif kuralı (CLAUDE.md §13, HANDOFF §21.5): görsel/creative KOPYALANMAZ.
// Yalnız metin alanları referans + yapılandırılmış analiz girdisi olarak saklanır.
// ad_snapshot_url access_token içerir — ASLA saklanmaz; halka açık Ad Library
// linki (facebook.com/ads/library/?id=...) referans olarak kullanılır.

// ZORUNLU kapsam metni (AGENT-C.md Mutlak Kurallar) — UI'da her zaman görünür.
export const AD_LIBRARY_SCOPE_NOTE =
  "Ad Library yalnız kapsamdaki reklamları döndürür; sonuçlar rakibin tüm reklamları değildir.";

// Resmi kısıt (SOURCES-C §4): EU'ya ulaşmayan reklamlar yalnız politik/sosyal
// içerikliyse döner → TR-only ticari reklamlar API'den GELMEZ.
export const NON_EU_SCOPE_WARNING =
  "Bu pazar Ad Library API kapsamı dışında: EU'ya ulaşmayan ticari reklamlar API'den dönmez. Rakibin bu pazardaki reklamları için manuel yolu kullan (reklam metnini/tarifini yapıştır).";

// EU üyeleri (ISO 3166-1 alpha-2) — ads_archive ticari kapsamı EU-ulaşan reklamlar.
export const EU_COUNTRY_CODES = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
  "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL",
  "PL", "PT", "RO", "SK", "SI", "ES", "SE",
] as const;

export function isEuCovered(countryCode: string | null | undefined): boolean {
  return (
    countryCode != null &&
    (EU_COUNTRY_CODES as readonly string[]).includes(countryCode.toUpperCase())
  );
}

// ads_archive cevabındaki tek kayıt (ArchivedAd) — alanlar SOURCES-C §4'te doğrulandı.
export type ArchivedAdRow = {
  id?: unknown;
  page_id?: unknown;
  page_name?: unknown;
  ad_creation_time?: unknown;
  ad_delivery_start_time?: unknown;
  ad_delivery_stop_time?: unknown;
  ad_creative_bodies?: unknown;
  ad_creative_link_titles?: unknown;
  ad_creative_link_captions?: unknown;
  ad_creative_link_descriptions?: unknown;
  publisher_platforms?: unknown;
  languages?: unknown;
  eu_total_reach?: unknown;
  // ad_snapshot_url BİLEREK yok: access_token içerir, saklanmaz.
};

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function strList(v: unknown, max = 5): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    const s = str(item);
    if (s && !out.includes(s)) out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

/** Halka açık Ad Library linki — token İÇERMEZ, referans olarak saklanır. */
export function publicAdLibraryUrl(adArchiveId: string): string {
  return `https://www.facebook.com/ads/library/?id=${encodeURIComponent(adArchiveId)}`;
}

/** Arşiv kaydından mevcut analiz motoruna girdi olacak yapılandırılmış metin üretir.
 *  Yalnız METİN alanları — görsel/video içerik kopyalanmaz. */
export function composeAdInputText(ad: ArchivedAdRow): string {
  const lines: string[] = [];
  const pageName = str(ad.page_name);
  if (pageName) lines.push(`Sayfa: ${pageName}`);

  const start = str(ad.ad_delivery_start_time);
  const stop = str(ad.ad_delivery_stop_time);
  if (start || stop) {
    lines.push(`Yayın dönemi: ${start ?? "?"} → ${stop ?? "devam ediyor"}`);
  }
  const platforms = strList(ad.publisher_platforms, 10);
  if (platforms.length > 0) lines.push(`Platformlar: ${platforms.join(", ")}`);

  const bodies = strList(ad.ad_creative_bodies, 3);
  if (bodies.length > 0) {
    lines.push("", "Reklam metni:", ...bodies.map((b) => b));
  }
  const titles = strList(ad.ad_creative_link_titles, 3);
  if (titles.length > 0) lines.push("", `Başlık: ${titles.join(" | ")}`);
  const descriptions = strList(ad.ad_creative_link_descriptions, 3);
  if (descriptions.length > 0) lines.push(`Açıklama: ${descriptions.join(" | ")}`);
  const captions = strList(ad.ad_creative_link_captions, 3);
  if (captions.length > 0) lines.push(`Link görünümü: ${captions.join(" | ")}`);

  return lines.join("\n").slice(0, 8000);
}

/** Analiz motoruna girmeye değer metin var mı? (mevcut elle-ekleme kuralıyla
 *  aynı eşik: 40 karakter — lib’deki adSchema.min(40)) */
export function hasAnalyzableText(inputText: string): boolean {
  return inputText.trim().length >= 40;
}

/** CompetitorAd.libraryMeta içeriği — sorgu + tarih + kapsam notu (§37 kaynak takibi). */
export function buildLibraryMeta(input: {
  ad: ArchivedAdRow;
  query: { searchTerms: string; country: string; adActiveStatus: string };
  retrievedAt: string; // ISO
  totalReturned: number;
}): Record<string, unknown> {
  return {
    source: "ads_archive",
    query: input.query,
    retrievedAt: input.retrievedAt,
    totalReturned: input.totalReturned,
    scopeNote: AD_LIBRARY_SCOPE_NOTE,
    pageId: str(input.ad.page_id),
    pageName: str(input.ad.page_name),
    adCreationTime: str(input.ad.ad_creation_time),
    deliveryStart: str(input.ad.ad_delivery_start_time),
    deliveryStop: str(input.ad.ad_delivery_stop_time),
    platforms: strList(input.ad.publisher_platforms, 10),
    languages: strList(input.ad.languages, 10),
    euTotalReach: typeof input.ad.eu_total_reach === "number" ? input.ad.eu_total_reach : str(input.ad.eu_total_reach),
  };
}

// ---------------------------------------------------------------------------
// GEZİNME (browse) katmanı — C3
// Ad Library modülü önce GÖSTERİR, sonra kullanıcı seçtiklerini içe aktarır.
// Bu ayrım maliyet kapısıdır (CLAUDE.md §43): gezinmek AI çağrısı üretmez,
// yalnız içe aktarma analiz tetikler.
// Görsel/creative HÂLÂ kopyalanmaz: kart yalnız metin alanları + halka açık link.
// ---------------------------------------------------------------------------

export type AdLibraryCard = {
  archiveId: string;
  pageId: string | null;
  pageName: string | null;
  creationTime: string | null;
  deliveryStart: string | null;
  deliveryStop: string | null;
  /** Reklamın hâlâ yayında görünüp görünmediği (stop tarihi yoksa açık kabul edilir). */
  active: boolean;
  bodies: string[];
  titles: string[];
  descriptions: string[];
  captions: string[];
  platforms: string[];
  languages: string[];
  euTotalReach: number | null;
  /** facebook.com/ads/library/?id=... — token içermez. */
  publicUrl: string;
  /** Analiz motoruna girecek metin (içe aktarmada aynen kullanılır). */
  inputText: string;
  /** 40 karakter eşiğini geçiyor mu — geçmiyorsa içe aktarılamaz. */
  importable: boolean;
};

/** ads_archive satırını gezinme kartına çevirir. Saf: fetch/Prisma yok. */
export function toAdLibraryCard(ad: ArchivedAdRow): AdLibraryCard | null {
  const archiveId = str(ad.id);
  if (!archiveId) return null;
  const inputText = composeAdInputText(ad);
  const stop = str(ad.ad_delivery_stop_time);
  const reach = ad.eu_total_reach;
  return {
    archiveId,
    pageId: str(ad.page_id),
    pageName: str(ad.page_name),
    creationTime: str(ad.ad_creation_time),
    deliveryStart: str(ad.ad_delivery_start_time),
    deliveryStop: stop,
    active: stop === null,
    bodies: strList(ad.ad_creative_bodies, 3),
    titles: strList(ad.ad_creative_link_titles, 3),
    descriptions: strList(ad.ad_creative_link_descriptions, 3),
    captions: strList(ad.ad_creative_link_captions, 3),
    platforms: strList(ad.publisher_platforms, 10),
    languages: strList(ad.languages, 10),
    euTotalReach:
      typeof reach === "number"
        ? reach
        : typeof reach === "string" && reach.trim() !== "" && Number.isFinite(Number(reach))
          ? Number(reach)
          : null,
    publicUrl: publicAdLibraryUrl(archiveId),
    inputText,
    importable: hasAnalyzableText(inputText),
  };
}

export function toAdLibraryCards(rows: ArchivedAdRow[]): AdLibraryCard[] {
  const out: AdLibraryCard[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const card = toAdLibraryCard(row);
    if (!card || seen.has(card.archiveId)) continue;
    seen.add(card.archiveId);
    out.push(card);
  }
  return out;
}

/** Aynı sayfaya (reklamveren) ait kartları gruplar — Ad Library'nin sayfa görünümü. */
export function groupCardsByPage(
  cards: AdLibraryCard[],
): Array<{ pageId: string | null; pageName: string; cards: AdLibraryCard[] }> {
  const groups = new Map<string, { pageId: string | null; pageName: string; cards: AdLibraryCard[] }>();
  for (const card of cards) {
    const key = card.pageId ?? card.pageName ?? "bilinmeyen";
    let group = groups.get(key);
    if (!group) {
      group = {
        pageId: card.pageId,
        pageName: card.pageName ?? "Sayfa adı yok",
        cards: [],
      };
      groups.set(key, group);
    }
    group.cards.push(card);
  }
  return [...groups.values()].sort((a, b) => b.cards.length - a.cards.length);
}
