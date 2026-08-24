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
import { runAdLibrarySearch } from "@/lib/meta-library/search";
import { isEuCovered, NON_EU_SCOPE_WARNING } from "@/lib/meta-library/archive";

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
