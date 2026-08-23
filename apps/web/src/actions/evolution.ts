"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import {
  prisma,
  type EvolutionStage,
  type EvolutionStatus,
} from "@adscore/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { CAMPAIGN_GOALS, EVOLUTION_LIMITS } from "@/lib/options";
import {
  advanceEvolution,
  promoteCandidatesInternal,
  type JudgeBreakdown,
} from "@/lib/evolution/run";
import { judgeConfidence } from "@/lib/evolution/select";

// CONTRACTS §4 — imzalar sabittir (Ajan C'nin wizard'ı bunları çağırır).
export type EvolutionFormState = {
  error?: string;
  success?: boolean;
  runId?: string;
};

async function requireOwnedBrand(brandId: string) {
  const user = await requireUser();
  const brand = await prisma.brand.findFirst({
    where: { id: brandId, workspace: { ownerId: user.id } },
  });
  if (!brand) return null;
  return { user, brand };
}

async function requireOwnedRun(runId: string) {
  const user = await requireUser();
  const run = await prisma.evolutionRun.findFirst({
    where: { id: runId, brand: { workspace: { ownerId: user.id } } },
    include: { brand: true },
  });
  if (!run) return null;
  return { user, run };
}

const limit = (key: keyof typeof EVOLUTION_LIMITS) =>
  z.coerce
    .number()
    .int()
    .min(EVOLUTION_LIMITS[key].min, `${key}: en az ${EVOLUTION_LIMITS[key].min}`)
    .max(EVOLUTION_LIMITS[key].max, `${key}: en fazla ${EVOLUTION_LIMITS[key].max}`)
    .default(EVOLUTION_LIMITS[key].default);

const startSchema = z
  .object({
    goal: z.enum(CAMPAIGN_GOALS, { message: "Kampanya hedefi seçilmeli." }),
    offer: z.string().max(200, "Teklif en fazla 200 karakter.").optional(),
    instruction: z.string().max(500, "Yönlendirme en fazla 500 karakter.").optional(),
    rounds: limit("rounds"),
    population: limit("population"),
    survivors: limit("survivors"),
    judges: limit("judges"),
  })
  .refine((v) => v.survivors < v.population, {
    message: "Elit sayısı aday sayısından küçük olmalı.",
  });

function clean(formData: FormData) {
  // Boş string'ler "verilmedi" sayılır (zod default/optional için)
  const obj: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (typeof v === "string" && v.trim() !== "") obj[k] = v.trim();
  }
  return obj;
}

export async function startEvolutionRun(
  brandId: string,
  _prev: EvolutionFormState,
  formData: FormData,
): Promise<EvolutionFormState> {
  const owned = await requireOwnedBrand(brandId);
  if (!owned) return { error: "Marka bulunamadı." };

  // Kapı: copy üretimi araştırma verisine dayanır (mevcut Creative Studio kuralı)
  const research = await prisma.researchRun.findFirst({
    where: { brandId, status: "COMPLETED" },
  });
  if (!research) {
    return {
      error:
        "Önce marka araştırması gerekli: Arena adayları araştırma verisine dayanır, veri olmadan üretim yapılmaz.",
    };
  }
  const active = await prisma.evolutionRun.findFirst({
    where: { brandId, status: { in: ["QUEUED", "RUNNING"] } },
  });
  if (active) {
    return { error: "Bu markada zaten süren bir Arena koşusu var.", runId: active.id };
  }

  const parsed = startSchema.safeParse(clean(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form hatalı." };
  }
  const { goal, offer, instruction, rounds, population, survivors, judges } =
    parsed.data;

  const run = await prisma.evolutionRun.create({
    data: {
      brandId,
      goal,
      offer: offer || null,
      instruction: instruction || null,
      config: { rounds, population, survivors, judges },
      maxRounds: rounds,
      promptTokens: 0,
      outputTokens: 0,
    },
  });
  await audit({
    workspaceId: owned.brand.workspaceId,
    userId: owned.user.id,
    action: "evolution.started",
    entity: "evolution_run",
    entityId: run.id,
    newState: { goal, offer: offer || null, rounds, population, survivors, judges },
  });
  // İlk aşama yanıttan sonra koşar; devamı poller'dan gelir (arena-poller.tsx)
  after(() => advanceEvolution(run.id));
  revalidatePath(`/app/brands/${brandId}/arena`);
  return { success: true, runId: run.id };
}

/**
 * Bir turun bir aşamasını ilerletir; idempotent. Poller bunu 3 sn'de bir çağırır;
 * claim sayesinde eşzamanlı çağrılar iş yapmaz.
 *
 * Aşama `after()` ile yanıttan SONRA koşar ve action hemen döner: React aynı
 * istemcinin server action'larını sıraya koyar; aşama action içinde koşsaydı
 * "iptal" butonu 30-60 sn boyunca bekler (canlı testte görüldü). Vercel'de
 * after() da 60 sn limitine tabidir (sayfa segment maxDuration).
 */
export async function advanceEvolutionRun(runId: string): Promise<{
  status: EvolutionStatus;
  currentRound: number;
  stage: EvolutionStage | null;
}> {
  const owned = await requireOwnedRun(runId);
  if (!owned) throw new Error("Koşu bulunamadı.");
  const { run } = owned;
  const round = await prisma.evolutionRound.findUnique({
    where: { runId_index: { runId, index: run.currentRound } },
    select: { stage: true },
  });
  if (run.status === "QUEUED" || run.status === "RUNNING") {
    after(() => advanceEvolution(runId));
  }
  return {
    status: run.status,
    currentRound: run.currentRound,
    stage: round?.stage ?? (run.status === "COMPLETED" ? "DONE" : null),
  };
}

export async function cancelEvolutionRun(formData: FormData): Promise<void> {
  const runId = String(formData.get("runId") ?? "");
  const owned = await requireOwnedRun(runId);
  if (!owned) return;
  const updated = await prisma.evolutionRun.updateMany({
    where: { id: runId, status: { in: ["QUEUED", "RUNNING"] } },
    data: {
      status: "CANCELLED",
      finishedAt: new Date(),
      error: "Kullanıcı tarafından iptal edildi.",
    },
  });
  if (updated.count === 1) {
    await audit({
      workspaceId: owned.run.brand.workspaceId,
      userId: owned.user.id,
      action: "evolution.cancelled",
      entity: "evolution_run",
      entityId: runId,
      previousState: { status: owned.run.status, currentRound: owned.run.currentRound },
      newState: { status: "CANCELLED" },
    });
  }
  revalidatePath(`/app/brands/${owned.run.brandId}/arena`);
  revalidatePath(`/app/brands/${owned.run.brandId}/arena/${runId}`);
}

/**
 * Seçilen adayları Creative'e PENDING kopyalar (onay akışına girer).
 * Koşu tamamlanınca motor kazanan + 2 adayı otomatik aktarır; bu action
 * kullanıcının ek/manuel seçimi içindir.
 */
export async function promoteCandidates(
  runId: string,
  candidateIds: string[],
): Promise<{ creativeIds: string[] }> {
  const owned = await requireOwnedRun(runId);
  if (!owned) throw new Error("Koşu bulunamadı.");
  const ids = [...new Set(candidateIds.map(String).filter(Boolean))].slice(0, 10);
  if (ids.length === 0) throw new Error("Aday seçilmedi.");
  const cands = await prisma.evolutionCandidate.findMany({
    where: { id: { in: ids }, runId, eliminatedReason: null },
  });
  if (cands.length === 0) throw new Error("Aktarılabilir aday bulunamadı.");
  const { creativeIds } = await promoteCandidatesInternal(owned.run, cands.map((c) => c.id), {
    confidenceFor: (id) => {
      const c = cands.find((x) => x.id === id);
      const b = c?.judgeBreakdown as JudgeBreakdown | null;
      return b
        ? judgeConfidence(
            { judgeStd: b.judgeStd, firstPlaceVotes: b.firstPlaceVotes },
            b.judgeCount,
          )
        : "low";
    },
    note: "manuel seçim",
    userId: owned.user.id,
  });
  revalidatePath(`/app/brands/${owned.run.brandId}/creatives`);
  revalidatePath(`/app/brands/${owned.run.brandId}/arena/${runId}`);
  return { creativeIds };
}

/** Form sarmalayıcı: tek adayı onay akışına gönder (sayfadaki buton) */
export async function promoteCandidateForm(formData: FormData): Promise<void> {
  const runId = String(formData.get("runId") ?? "");
  const candidateId = String(formData.get("candidateId") ?? "");
  await promoteCandidates(runId, [candidateId]);
}
