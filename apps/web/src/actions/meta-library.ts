"use server";

// C2 — "Ad Library'de ara" aksiyonu. Kullanıcı tetikler. Kaydedilen her reklam
// için MEVCUT analiz akışı (executeAdAnalysis) koşar — yeni motor yok.

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { prisma } from "@adscore/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { executeAdAnalysis } from "@/lib/competitors/run";
import {
  runAdLibrarySearch,
  browseAdArchive,
  importAdLibraryAds,
  MAX_SAVED_PER_SEARCH,
  type ArchiveQuery,
} from "@/lib/meta-library/search";
import {
  AD_LIBRARY_SCOPE_NOTE,
  isEuCovered,
  NON_EU_SCOPE_WARNING,
  type AdLibraryCard,
} from "@/lib/meta-library/archive";

export type LibrarySearchState = {
  error?: string;
  blocked?: string;
  summary?: string;
  scopeWarning?: string;
  emptyResult?: boolean;
};

const searchSchema = z.object({
  searchTerms: z
    .string()
    .trim()
    .min(2, "Arama terimi en az 2 karakter olmalı.")
    .max(100, "Arama terimi en çok 100 karakter (Ad Library sınırı)."),
  country: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/, "Pazar seç."),
});

export async function searchAdLibrary(
  competitorId: string,
  _prev: LibrarySearchState,
  formData: FormData,
): Promise<LibrarySearchState> {
  const user = await requireUser();
  const competitor = await prisma.competitor.findFirst({
    where: { id: competitorId, brand: { workspace: { ownerId: user.id } } },
    include: { brand: true },
  });
  if (!competitor) return { error: "Rakip bulunamadı." };

  const parsed = searchSchema.safeParse({
    searchTerms: formData.get("searchTerms"),
    country: formData.get("country"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form hatalı." };
  }
  const country = parsed.data.country.toUpperCase();

  const outcome = await runAdLibrarySearch({
    workspaceId: competitor.brand.workspaceId,
    brandId: competitor.brandId,
    competitorId,
    searchTerms: parsed.data.searchTerms,
    country,
  });

  if (outcome.kind === "blocked") return { blocked: outcome.message };
  if (outcome.kind === "error") return { error: outcome.message };

  await audit({
    workspaceId: competitor.brand.workspaceId,
    userId: user.id,
    action: "ad_library.search",
    entity: "competitor",
    entityId: competitorId,
    newState: {
      searchTerms: parsed.data.searchTerms,
      country,
      found: outcome.found,
      saved: outcome.savedAdIds.length,
    },
  });

  // Kaydedilen her reklam için mevcut analiz akışı (elle eklemeyle aynı desen).
  for (const adId of outcome.savedAdIds) {
    after(() => executeAdAnalysis(adId));
  }
  revalidatePath(`/app/brands/${competitor.brandId}/competitors`);

  // Boş sonuç "rakip reklam vermiyor" DEĞİLDİR — kapsam kısıtı açıkça söylenir.
  if (outcome.found === 0) {
    return {
      emptyResult: true,
      summary:
        "Bu sorgu için Ad Library kapsamında sonuç bulunamadı. Bu, rakibin reklam vermediği anlamına gelmez — EU'ya ulaşmayan (ör. yalnız TR'de yayınlanan) ticari reklamlar API'den dönmez. Manuel yolla reklam metni ekleyebilirsin.",
      scopeWarning: isEuCovered(country) ? undefined : NON_EU_SCOPE_WARNING,
    };
  }

  const parts = [
    `${outcome.found} kayıt döndü`,
    `${outcome.savedAdIds.length} yeni reklam kaydedildi ve analize gönderildi`,
  ];
  if (outcome.skippedExisting > 0) parts.push(`${outcome.skippedExisting} kayıt zaten ekliydi`);
  if (outcome.skippedNoText > 0)
    parts.push(`${outcome.skippedNoText} kayıt metin içermediği için atlandı`);
  if (outcome.found > outcome.savedAdIds.length + outcome.skippedExisting + outcome.skippedNoText)
    parts.push("kalanlar için aramayı tekrar çalıştır (her aramada sınırlı sayıda kayıt eklenir)");

  return {
    summary: parts.join(" · ") + ".",
    scopeWarning: isEuCovered(country) ? undefined : NON_EU_SCOPE_WARNING,
  };
}

// ---------------------------------------------------------------------------
// C3 — Ad Library modülü (gezinme + seçerek içe aktarma)
// Gezinme DB'ye yazmaz ve AI çağırmaz; maliyet yalnız içe aktarmada oluşur (§43).
// ---------------------------------------------------------------------------

const NEW_COMPETITOR = "__new__";

const browseSchema = z.object({
  searchTerms: z
    .string()
    .trim()
    .min(2, "Arama terimi en az 2 karakter olmalı.")
    .max(100, "Arama terimi en çok 100 karakter (Ad Library sınırı)."),
  country: z.string().trim().regex(/^[A-Za-z]{2}$/, "Pazar seç."),
  adActiveStatus: z.enum(["ALL", "ACTIVE", "INACTIVE"]).default("ALL"),
});

export type BrowseState = {
  error?: string;
  blocked?: string;
  /** Arama yapıldı mı — boş sonucu "hiç arama yapılmadı"dan ayırır. */
  searched?: boolean;
  query?: { searchTerms: string; country: string; adActiveStatus: "ALL" | "ACTIVE" | "INACTIVE" };
  cards?: AdLibraryCard[];
  alreadySavedIds?: string[];
  retrievedAt?: string;
  scopeWarning?: string;
  /** İçe aktarma sonucu özeti (aynı ekranda gösterilir). */
  importSummary?: string;
};

/** Ad Library'de gezin — hiçbir şey kaydedilmez. */
export async function browseAdLibrary(
  brandId: string,
  _prev: BrowseState,
  formData: FormData,
): Promise<BrowseState> {
  const user = await requireUser();
  const brand = await prisma.brand.findFirst({
    where: { id: brandId, workspace: { ownerId: user.id } },
    select: { id: true, workspaceId: true },
  });
  if (!brand) return { error: "Marka bulunamadı." };

  const parsed = browseSchema.safeParse({
    searchTerms: formData.get("searchTerms"),
    country: formData.get("country"),
    adActiveStatus: formData.get("adActiveStatus") ?? "ALL",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form hatalı." };
  }
  const query: ArchiveQuery = {
    searchTerms: parsed.data.searchTerms,
    country: parsed.data.country.toUpperCase(),
    adActiveStatus: parsed.data.adActiveStatus,
  };

  const outcome = await browseAdArchive({
    workspaceId: brand.workspaceId,
    brandId: brand.id,
    query,
  });
  const echo = {
    searched: true,
    query: {
      searchTerms: query.searchTerms,
      country: query.country,
      adActiveStatus: query.adActiveStatus ?? ("ALL" as const),
    },
    scopeWarning: isEuCovered(query.country) ? undefined : NON_EU_SCOPE_WARNING,
  };

  if (outcome.kind === "blocked") return { ...echo, blocked: outcome.message };
  if (outcome.kind === "error") return { ...echo, error: outcome.message };

  await audit({
    workspaceId: brand.workspaceId,
    userId: user.id,
    action: "ad_library.browse",
    entity: "brand",
    entityId: brand.id,
    newState: { ...query, returned: outcome.cards.length },
  });

  return {
    ...echo,
    cards: outcome.cards,
    alreadySavedIds: outcome.alreadySavedIds,
    retrievedAt: outcome.retrievedAt,
  };
}

const importSchema = z.object({
  searchTerms: z.string().trim().min(2).max(100),
  country: z.string().trim().regex(/^[A-Za-z]{2}$/),
  adActiveStatus: z.enum(["ALL", "ACTIVE", "INACTIVE"]).default("ALL"),
  target: z.string().trim().min(1, "Hedef rakip seç."),
  competitorType: z.enum(["DIRECT", "INDIRECT", "ASPIRATIONAL", "CREATIVE"]).default("DIRECT"),
});

export type ImportState = {
  error?: string;
  blocked?: string;
  summary?: string;
};

/** Seçilen Ad Library kayıtlarını rakip reklamı olarak içe aktarır.
 *  Her içe aktarılan reklam bir AI analizi tetikler (maliyet kullanıcıya yazılır). */
export async function importAdLibrarySelection(
  brandId: string,
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const user = await requireUser();
  const brand = await prisma.brand.findFirst({
    where: { id: brandId, workspace: { ownerId: user.id } },
    select: { id: true, workspaceId: true },
  });
  if (!brand) return { error: "Marka bulunamadı." };

  const parsed = importSchema.safeParse({
    searchTerms: formData.get("searchTerms"),
    country: formData.get("country"),
    adActiveStatus: formData.get("adActiveStatus") ?? "ALL",
    target: formData.get("target"),
    competitorType: formData.get("competitorType") ?? "DIRECT",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form hatalı." };
  }

  // Seçim: "archiveId::pageId::pageName" — sayfadan rakip oluşturmak için
  // sayfa bilgisi seçimle birlikte taşınır (kaydedilen metin API'den yeniden çekilir).
  const picks = formData
    .getAll("selection")
    .flatMap((v) => (typeof v === "string" ? [v] : []))
    .map((v) => {
      const [archiveId, pageId, ...rest] = v.split("::");
      return { archiveId, pageId: pageId || null, pageName: rest.join("::") || null };
    })
    .filter((p) => p.archiveId);

  if (picks.length === 0) return { error: "İçe aktarmak için en az bir reklam seç." };
  if (picks.length > MAX_SAVED_PER_SEARCH) {
    return {
      error: `Tek seferde en fazla ${MAX_SAVED_PER_SEARCH} reklam içe aktarılabilir (her biri bir AI analizi tetikler). Seçimi azalt.`,
    };
  }

  const query: ArchiveQuery = {
    searchTerms: parsed.data.searchTerms,
    country: parsed.data.country.toUpperCase(),
    adActiveStatus: parsed.data.adActiveStatus,
  };

  // Hedef rakip(ler): mevcut bir rakip ya da sayfa başına yeni rakip.
  const byCompetitor = new Map<string, string[]>();
  const createdNames: string[] = [];

  if (parsed.data.target === NEW_COMPETITOR) {
    // Sayfa başına tek rakip; aynı adlı rakip zaten varsa ona bağlanır.
    const groups = new Map<string, { name: string; ids: string[] }>();
    for (const pick of picks) {
      const name = pick.pageName?.trim() || "Ad Library sayfası";
      const key = pick.pageId ?? name;
      const g = groups.get(key) ?? { name, ids: [] };
      g.ids.push(pick.archiveId);
      groups.set(key, g);
    }
    for (const group of groups.values()) {
      const existing = await prisma.competitor.findFirst({
        where: { brandId: brand.id, name: group.name },
        select: { id: true },
      });
      let competitorId = existing?.id;
      if (!competitorId) {
        const created = await prisma.competitor.create({
          data: {
            brandId: brand.id,
            name: group.name,
            type: parsed.data.competitorType,
            addedFrom: "ad_library",
            note: `Meta Ad Library'den eklendi (sorgu: "${query.searchTerms}", pazar: ${query.country}).`,
          },
          select: { id: true },
        });
        competitorId = created.id;
        createdNames.push(group.name);
        await audit({
          workspaceId: brand.workspaceId,
          userId: user.id,
          action: "competitor.create",
          entity: "competitor",
          entityId: competitorId,
          newState: { name: group.name, source: "ad_library", pageName: group.name },
        });
      }
      byCompetitor.set(competitorId, group.ids);
    }
  } else {
    const competitor = await prisma.competitor.findFirst({
      where: { id: parsed.data.target, brandId: brand.id },
      select: { id: true },
    });
    if (!competitor) return { error: "Seçilen rakip bulunamadı." };
    byCompetitor.set(
      competitor.id,
      picks.map((p) => p.archiveId),
    );
  }

  // Meta'ya TEK çağrı: seçilen kayıtlar hedeflerine dağıtılır (§43).
  const outcome = await importAdLibraryAds({
    workspaceId: brand.workspaceId,
    brandId: brand.id,
    query,
    targets: [...byCompetitor].map(([competitorId, archiveIds]) => ({
      competitorId,
      archiveIds,
    })),
  });
  if (outcome.kind === "blocked") return { blocked: outcome.message };
  if (outcome.kind === "error") return { error: outcome.message };

  let saved = 0;
  let skippedExisting = 0;
  let skippedNoText = 0;
  // Ad Library sonuçları CANLIDIR: gezinme ile içe aktarma arasında bir kayıt
  // sonuç penceresinden düşebilir. Sessizce kaybolmasın — açıkça raporlanır (§31).
  let notReturned = 0;
  const savedAdIds: string[] = [];

  for (const result of outcome.perTarget) {
    const requested = byCompetitor.get(result.competitorId)?.length ?? 0;
    notReturned += Math.max(
      0,
      requested - (result.savedAdIds.length + result.skippedExisting + result.skippedNoText),
    );
    saved += result.savedAdIds.length;
    skippedExisting += result.skippedExisting;
    skippedNoText += result.skippedNoText;
    savedAdIds.push(...result.savedAdIds);

    await audit({
      workspaceId: brand.workspaceId,
      userId: user.id,
      action: "ad_library.import",
      entity: "competitor",
      entityId: result.competitorId,
      newState: {
        ...query,
        requested: byCompetitor.get(result.competitorId)?.length ?? 0,
        saved: result.savedAdIds.length,
      },
    });
  }

  for (const adId of savedAdIds) {
    after(() => executeAdAnalysis(adId));
  }
  revalidatePath(`/app/brands/${brand.id}/competitors`);
  revalidatePath(`/app/brands/${brand.id}/ad-library`);

  const parts: string[] = [];
  if (createdNames.length > 0) parts.push(`${createdNames.length} yeni rakip oluşturuldu (${createdNames.join(", ")})`);
  parts.push(`${saved} reklam içe aktarıldı ve ${saved} AI analizi başlatıldı`);
  if (skippedExisting > 0) parts.push(`${skippedExisting} kayıt zaten ekliydi`);
  if (skippedNoText > 0) parts.push(`${skippedNoText} kayıt analiz edilebilir metin içermediği için atlandı`);
  if (notReturned > 0)
    parts.push(
      `${notReturned} kayıt yeniden sorguda dönmedi (Ad Library sonuçları canlıdır — aramayı tekrarlayıp yeniden dene)`,
    );

  return { summary: parts.join(" · ") + `. ${AD_LIBRARY_SCOPE_NOTE}` };
}
