"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { prisma } from "@adscore/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import {
  MIN_CLICKS_FOR_ANALYSIS,
  MIN_IMPRESSIONS_FOR_ANALYSIS,
} from "@/lib/results/metrics";
import { executeResultAnalysis } from "@/lib/results/run";
import {
  CSV_MAX_BYTES,
  parseAdsManagerCsv,
  type CsvImportPreview,
} from "@/lib/results/import-csv";

export type ResultFormState = { error?: string };

const resultSchema = z
  .object({
    periodStart: z.coerce.date(),
    periodEnd: z.coerce.date(),
    spend: z.coerce.number().positive("Harcama sıfırdan büyük olmalı."),
    impressions: z.coerce.number().int().nonnegative(),
    clicks: z.coerce.number().int().nonnegative(),
    reach: z.coerce.number().int().nonnegative().optional(),
    purchases: z.coerce.number().int().nonnegative().optional(),
    revenue: z.coerce.number().nonnegative().optional(),
    notes: z.string().max(500).optional(),
  })
  .refine((d) => d.periodEnd >= d.periodStart, {
    message: "Bitiş tarihi başlangıçtan önce olamaz.",
  })
  .refine((d) => d.clicks <= d.impressions, {
    message: "Tıklama sayısı gösterimden fazla olamaz.",
  });

export async function addCampaignResult(
  planId: string,
  _prev: ResultFormState,
  formData: FormData,
): Promise<ResultFormState> {
  const user = await requireUser();
  const plan = await prisma.campaignPlan.findFirst({
    where: { id: planId, brand: { workspace: { ownerId: user.id } } },
    include: { brand: true },
  });
  if (!plan) return { error: "Plan bulunamadı." };

  const raw = Object.fromEntries(formData);
  const parsed = resultSchema.safeParse({
    ...raw,
    reach: raw.reach || undefined,
    purchases: raw.purchases || undefined,
    revenue: raw.revenue || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form hatalı." };
  }

  const result = await prisma.campaignResult.create({
    data: {
      planId,
      periodStart: parsed.data.periodStart,
      periodEnd: parsed.data.periodEnd,
      spend: parsed.data.spend,
      impressions: parsed.data.impressions,
      clicks: parsed.data.clicks,
      reach: parsed.data.reach ?? null,
      purchases: parsed.data.purchases ?? null,
      revenue: parsed.data.revenue ?? null,
      notes: parsed.data.notes || null,
    },
  });
  await audit({
    workspaceId: plan.brand.workspaceId,
    userId: user.id,
    action: "campaign_result.add",
    entity: "campaign_result",
    entityId: result.id,
    newState: {
      spend: parsed.data.spend,
      impressions: parsed.data.impressions,
      clicks: parsed.data.clicks,
    },
  });
  revalidatePath(`/app/brands/${plan.brandId}/campaigns`);
  return {};
}

export type CsvParseState = { error?: string; preview?: CsvImportPreview };

// Ads Manager CSV export'unu parse eder — DB'ye YAZMAZ. Kayıt, kullanıcı
// önizlemeyi onaylayıp saveCsvResult'ı çalıştırınca yapılır.
export async function parseResultCsv(
  planId: string,
  _prev: CsvParseState,
  formData: FormData,
): Promise<CsvParseState> {
  const user = await requireUser();
  const plan = await prisma.campaignPlan.findFirst({
    where: { id: planId, brand: { workspace: { ownerId: user.id } } },
  });
  if (!plan) return { error: "Plan bulunamadı." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Bir CSV dosyası seç." };
  }
  if (file.size > CSV_MAX_BYTES) {
    return { error: "Dosya 1 MB'den büyük. Raporu daha dar bir dönem için export et." };
  }
  const parsed = parseAdsManagerCsv(await file.text());
  if (!parsed.ok) return { error: parsed.error };
  return { preview: parsed.preview };
}

export type CsvSaveState = ResultFormState & { saved?: boolean };

export async function saveCsvResult(
  planId: string,
  _prev: CsvSaveState,
  formData: FormData,
): Promise<CsvSaveState> {
  const res = await addCampaignResult(planId, {}, formData);
  return res.error ? res : { saved: true };
}

export async function startResultAnalysis(
  resultId: string,
  _prev: ResultFormState,
  _formData: FormData,
): Promise<ResultFormState> {
  const user = await requireUser();
  const result = await prisma.campaignResult.findFirst({
    where: {
      id: resultId,
      plan: { brand: { workspace: { ownerId: user.id } } },
    },
    include: { plan: true },
  });
  if (!result) return { error: "Sonuç bulunamadı." };
  if (
    result.analysisStatus === "QUEUED" ||
    result.analysisStatus === "RUNNING"
  ) {
    return { error: "Analiz zaten sürüyor." };
  }

  // CLAUDE.md §28 — Insufficient Data: eşik altında analiz koşulmaz
  if (
    result.impressions < MIN_IMPRESSIONS_FOR_ANALYSIS ||
    result.clicks < MIN_CLICKS_FOR_ANALYSIS
  ) {
    return {
      error: `Insufficient Data: güvenilir analiz için en az ${MIN_IMPRESSIONS_FOR_ANALYSIS} gösterim ve ${MIN_CLICKS_FOR_ANALYSIS} tıklama gerekir (şu an ${result.impressions} gösterim / ${result.clicks} tıklama).`,
    };
  }

  await prisma.campaignResult.update({
    where: { id: resultId },
    data: { analysisStatus: "QUEUED", analysisError: null },
  });
  await audit({
    userId: user.id,
    action: "result_analysis.start",
    entity: "campaign_result",
    entityId: resultId,
  });
  after(() => executeResultAnalysis(resultId));
  revalidatePath(`/app/brands/${result.plan.brandId}/campaigns`);
  return {};
}
