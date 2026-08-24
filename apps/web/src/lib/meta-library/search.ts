// C2 — Ad Library araması (server). Ajan A'nın istemcisi üzerinden ads_archive
// sorgular; dönen kayıtları CompetitorAd olarak referans+metin biçiminde saklar
// ve MEVCUT analiz motorunu (executeAdAnalysis) tetikler — yeni motor yok.
// Uç doğrulaması: docs/meta/SOURCES-C.md §4.

import "server-only";

import { prisma } from "@adscore/db";
import { metaClientForWorkspace, MetaApiError, MetaBlockedError } from "@/lib/meta/client";
import {
  buildLibraryMeta,
  composeAdInputText,
  hasAnalyzableText,
  publicAdLibraryUrl,
  type ArchivedAdRow,
} from "@/lib/meta-library/archive";

// Maliyet kontrolü (CLAUDE.md §43): her aramada en fazla bu kadar YENİ reklam
// kaydedilir (her kayıt bir AI analizi tetikler). Tekrar arama kalanları getirir
// (adArchiveId ile tekilleştirme sayesinde kaydedilmişler atlanır).
export const MAX_SAVED_PER_SEARCH = 6;

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

export type LibrarySearchOutcome =
  | {
      kind: "ok";
      found: number;
      savedAdIds: string[];
      skippedExisting: number;
      skippedNoText: number;
    }
  | { kind: "blocked"; message: string }
  | { kind: "error"; message: string };

export async function runAdLibrarySearch(input: {
  workspaceId: string;
  brandId: string;
  competitorId: string;
  searchTerms: string;
  country: string; // ISO 3166-1 alpha-2
}): Promise<LibrarySearchOutcome> {
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

  let rows: ArchivedAdRow[];
  try {
    const response = await client.get<{ data?: unknown }>(
      "ads_archive",
      {
        search_terms: input.searchTerms.slice(0, 100), // resmi sınır: 100 karakter
        ad_reached_countries: JSON.stringify([input.country.toUpperCase()]),
        ad_type: "ALL",
        ad_active_status: "ALL",
        fields: ARCHIVE_FIELDS,
        limit: 25,
      },
      { brandId: input.brandId },
    );
    rows = Array.isArray(response?.data) ? (response.data as ArchivedAdRow[]) : [];
  } catch (e) {
    if (e instanceof MetaBlockedError) return { kind: "blocked", message: e.userMessage };
    if (e instanceof MetaApiError) return { kind: "error", message: e.userMessage };
    return {
      kind: "error",
      message: "Ad Library sorgusu beklenmedik şekilde başarısız oldu. Tekrar dene.",
    };
  }

  const retrievedAt = new Date().toISOString();
  const query = {
    searchTerms: input.searchTerms.slice(0, 100),
    country: input.country.toUpperCase(),
    adActiveStatus: "ALL",
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

  for (const row of rows) {
    if (savedAdIds.length >= MAX_SAVED_PER_SEARCH) break;
    const archiveId = typeof row.id === "string" && row.id.trim() !== "" ? row.id.trim() : null;
    if (!archiveId) continue;
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
          retrievedAt,
          totalReturned: rows.length,
        }) as object,
      },
    });
    savedAdIds.push(ad.id);
    existingIds.add(archiveId);
  }

  return {
    kind: "ok",
    found: rows.length,
    savedAdIds,
    skippedExisting,
    skippedNoText,
  };
}
