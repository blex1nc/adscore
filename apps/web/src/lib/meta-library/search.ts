// C2/C3 — Ad Library (ads_archive) sunucu katmanı.
//
// İki ayrı yol, TEK fetch noktası (`fetchAdArchive`):
//   1. GEZİNME  → `browseAdArchive`: yalnız okur, DB'ye YAZMAZ, AI çağırmaz.
//   2. İÇE AKTARMA → `importAdLibraryAds` / `runAdLibrarySearch`: seçilen kayıtları
//      CompetitorAd olarak yazar ve MEVCUT analiz motorunu (executeAdAnalysis) tetikler.
//
// Ayrımın sebebi maliyet kapısıdır (CLAUDE.md §43): gezinmek bedava, içe aktarmak
// reklam başına bir AI analizi demektir — kullanıcı ne kadarını aktardığını görür.
// Uç doğrulaması: docs/meta/SOURCES-C.md §4.

import "server-only";

import { prisma } from "@adscore/db";
import { MAX_SAVED_PER_SEARCH, BROWSE_PAGE_SIZE } from "./constants";
import { metaClientForWorkspace, MetaApiError, MetaBlockedError } from "@/lib/meta/client";
import {
  buildLibraryMeta,
  composeAdInputText,
  hasAnalyzableText,
  publicAdLibraryUrl,
  toAdLibraryCards,
  type AdLibraryCard,
  type ArchivedAdRow,
} from "@/lib/meta-library/archive";

// Maliyet/sayfalama sabitleri istemcinin de okuyabilmesi için ayrı dosyada.
export { MAX_SAVED_PER_SEARCH, BROWSE_PAGE_SIZE } from "./constants";

// ad_snapshot_url İSTENMEZ: access_token içerir (saklanamaz). Görsel içerik
// zaten kopyalanmıyor; halka açık link adArchiveId'den üretiliyor.
const ARCHIVE_FIELDS = [
  "id",
  "page_id",
  "page_name",
  "ad_creation_time",
  "ad_delivery_start_time",
  "ad_delivery_stop_time",
  "ad_creative_bodies",
  "ad_creative_link_titles",
  "ad_creative_link_captions",
  "ad_creative_link_descriptions",
  "publisher_platforms",
  "languages",
  "eu_total_reach",
].join(",");

export type ArchiveQuery = {
  searchTerms: string;
  country: string; // ISO 3166-1 alpha-2
  /** ALL | ACTIVE | INACTIVE — Ad Library'nin kendi filtresi. */
  adActiveStatus?: "ALL" | "ACTIVE" | "INACTIVE";
  limit?: number;
};

type FetchOk = { kind: "ok"; rows: ArchivedAdRow[]; retrievedAt: string };
type FetchFail = { kind: "blocked" | "error"; message: string };

/** TEK Meta çağrı noktası. Hem gezinme hem içe aktarma bunu kullanır. */
async function fetchAdArchive(input: {
  workspaceId: string;
  brandId: string;
  query: ArchiveQuery;
}): Promise<FetchOk | FetchFail> {
  let client;
  try {
    client = await metaClientForWorkspace(input.workspaceId);
  } catch (e) {
    if (e instanceof MetaBlockedError) return { kind: "blocked", message: e.userMessage };
    return {
      kind: "blocked",
      message:
        "Meta bağlantısı hazır değil. Ayarlar'dan Meta hesabını bağla; bağlantı olmadan rakip reklamlarını manuel yolla ekleyebilirsin.",
    };
  }

  try {
    const response = await client.get<{ data?: unknown }>(
      "ads_archive",
      {
        search_terms: input.query.searchTerms.slice(0, 100), // resmi sınır: 100 karakter
        ad_reached_countries: JSON.stringify([input.query.country.toUpperCase()]),
        ad_type: "ALL",
        ad_active_status: input.query.adActiveStatus ?? "ALL",
        fields: ARCHIVE_FIELDS,
        limit: input.query.limit ?? 25,
      },
      { brandId: input.brandId },
    );
    return {
      kind: "ok",
      rows: Array.isArray(response?.data) ? (response.data as ArchivedAdRow[]) : [],
      retrievedAt: new Date().toISOString(),
    };
  } catch (e) {
    if (e instanceof MetaBlockedError) return { kind: "blocked", message: e.userMessage };
    if (e instanceof MetaApiError) return { kind: "error", message: e.userMessage };
    return {
      kind: "error",
      message: "Ad Library sorgusu beklenmedik şekilde başarısız oldu. Tekrar dene.",
    };
  }
}

// ---------------------------------------------------------------------------
// 1) GEZİNME — DB'ye yazmaz, AI çağırmaz
// ---------------------------------------------------------------------------

export type BrowseOutcome =
  | {
      kind: "ok";
      cards: AdLibraryCard[];
      retrievedAt: string;
      /** Bu markada zaten kayıtlı olan arşiv id'leri (kart üzerinde işaretlenir). */
      alreadySavedIds: string[];
    }
  | { kind: "blocked"; message: string }
  | { kind: "error"; message: string };

export async function browseAdArchive(input: {
  workspaceId: string;
  brandId: string;
  query: ArchiveQuery;
}): Promise<BrowseOutcome> {
  const fetched = await fetchAdArchive({
    workspaceId: input.workspaceId,
    brandId: input.brandId,
    query: { ...input.query, limit: input.query.limit ?? BROWSE_PAGE_SIZE },
  });
  if (fetched.kind !== "ok") return fetched;

  const cards = toAdLibraryCards(fetched.rows);
  const alreadySavedIds = await savedArchiveIdsForBrand(
    input.brandId,
    cards.map((c) => c.archiveId),
  );

  return {
    kind: "ok",
    cards,
    retrievedAt: fetched.retrievedAt,
    alreadySavedIds,
  };
}

/** Markanın herhangi bir rakibinde zaten kayıtlı olan arşiv id'leri. */
export async function savedArchiveIdsForBrand(
  brandId: string,
  archiveIds: string[],
): Promise<string[]> {
  if (archiveIds.length === 0) return [];
  const rows = await prisma.competitorAd.findMany({
    where: { competitor: { brandId }, adArchiveId: { in: archiveIds } },
    select: { adArchiveId: true },
  });
  return rows.flatMap((r) => (r.adArchiveId ? [r.adArchiveId] : []));
}

// ---------------------------------------------------------------------------
// 2) İÇE AKTARMA — seçilen kayıtları yazar (her biri bir AI analizi tetikler)
// ---------------------------------------------------------------------------

export type SaveOutcome = {
  found: number;
  savedAdIds: string[];
  skippedExisting: number;
  skippedNoText: number;
};

export type LibrarySearchOutcome =
  | ({ kind: "ok" } & SaveOutcome)
  | { kind: "blocked"; message: string }
  | { kind: "error"; message: string };

/** Getirilmiş satırlardan seçilenleri CompetitorAd olarak yazar.
 *  `selectedIds` null ise sıradaki tüm uygun kayıtlar (eski davranış) alınır. */
async function persistRows(input: {
  competitorId: string;
  rows: ArchivedAdRow[];
  retrievedAt: string;
  query: ArchiveQuery;
  selectedIds: Set<string> | null;
}): Promise<SaveOutcome> {
  const query = {
    searchTerms: input.query.searchTerms.slice(0, 100),
    country: input.query.country.toUpperCase(),
    adActiveStatus: input.query.adActiveStatus ?? "ALL",
  };

  // Tekilleştirme: aynı arşiv kaydı aynı rakibe ikinci kez yazılmaz.
  const existing = await prisma.competitorAd.findMany({
    where: { competitorId: input.competitorId, adArchiveId: { not: null } },
    select: { adArchiveId: true },
  });
  const existingIds = new Set(existing.map((a) => a.adArchiveId));

  const savedAdIds: string[] = [];
  let skippedExisting = 0;
  let skippedNoText = 0;
  let considered = 0;

  for (const row of input.rows) {
    const archiveId = typeof row.id === "string" && row.id.trim() !== "" ? row.id.trim() : null;
    if (!archiveId) continue;
    if (input.selectedIds && !input.selectedIds.has(archiveId)) continue;
    considered++;
    if (savedAdIds.length >= MAX_SAVED_PER_SEARCH) break;
    if (existingIds.has(archiveId)) {
      skippedExisting++;
      continue;
    }
    const inputText = composeAdInputText(row);
    if (!hasAnalyzableText(inputText)) {
      // Metinsiz kayıt analiz motoruna girdi olamaz; sayı uydurmak yerine atlanır
      // ve kullanıcıya açıkça raporlanır.
      skippedNoText++;
      continue;
    }
    const ad = await prisma.competitorAd.create({
      data: {
        competitorId: input.competitorId,
        inputText,
        inputUrl: publicAdLibraryUrl(archiveId), // token İÇERMEYEN halka açık link
        fromAdLibrary: true,
        adArchiveId: archiveId,
        libraryMeta: buildLibraryMeta({
          ad: row,
          query,
          retrievedAt: input.retrievedAt,
          totalReturned: input.rows.length,
        }) as object,
      },
    });
    savedAdIds.push(ad.id);
    existingIds.add(archiveId);
  }

  return {
    found: input.selectedIds ? considered : input.rows.length,
    savedAdIds,
    skippedExisting,
    skippedNoText,
  };
}

/** Rakip kartındaki "Ad Library'de ara" — arar VE bulduklarını kaydeder (eski davranış). */
export async function runAdLibrarySearch(input: {
  workspaceId: string;
  brandId: string;
  competitorId: string;
  searchTerms: string;
  country: string;
}): Promise<LibrarySearchOutcome> {
  const query: ArchiveQuery = {
    searchTerms: input.searchTerms,
    country: input.country,
    adActiveStatus: "ALL",
    limit: 25,
  };
  const fetched = await fetchAdArchive({
    workspaceId: input.workspaceId,
    brandId: input.brandId,
    query,
  });
  if (fetched.kind !== "ok") return fetched;

  const saved = await persistRows({
    competitorId: input.competitorId,
    rows: fetched.rows,
    retrievedAt: fetched.retrievedAt,
    query,
    selectedIds: null,
  });
  return { kind: "ok", ...saved };
}

/** Ad Library modülünden seçilen kayıtları içe aktarır.
 *  Satırlar istemciden GELMEZ — aynı sorgu tekrar çalıştırılıp seçilen id'ler
 *  Meta'nın kendi cevabından alınır (kaynak dürüstlüğü, CLAUDE.md §37).
 *
 *  Birden çok hedef rakip olsa bile Meta'ya TEK çağrı yapılır (§43). */
export async function importAdLibraryAds(input: {
  workspaceId: string;
  brandId: string;
  query: ArchiveQuery;
  /** competitorId → içe aktarılacak arşiv id'leri */
  targets: Array<{ competitorId: string; archiveIds: string[] }>;
}): Promise<
  | { kind: "ok"; perTarget: Array<{ competitorId: string } & SaveOutcome> }
  | { kind: "blocked"; message: string }
  | { kind: "error"; message: string }
> {
  const fetched = await fetchAdArchive({
    workspaceId: input.workspaceId,
    brandId: input.brandId,
    query: { ...input.query, limit: input.query.limit ?? BROWSE_PAGE_SIZE },
  });
  if (fetched.kind !== "ok") return fetched;

  const perTarget: Array<{ competitorId: string } & SaveOutcome> = [];
  for (const target of input.targets) {
    const saved = await persistRows({
      competitorId: target.competitorId,
      rows: fetched.rows,
      retrievedAt: fetched.retrievedAt,
      query: input.query,
      selectedIds: new Set(target.archiveIds),
    });
    perTarget.push({ competitorId: target.competitorId, ...saved });
  }
  return { kind: "ok", perTarget };
}
