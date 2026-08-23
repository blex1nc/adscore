import "server-only";
import {
  prisma,
  type EvolutionCandidate,
  type EvolutionRound,
  type EvolutionRun,
  type EvolutionStage,
  type EvolutionStatus,
  type Prisma,
} from "@adscore/db";
import {
  AiBlockedError,
  AiProviderError,
  getAiProvider,
  type AiTextResult,
} from "@adscore/ai";
import { audit } from "@/lib/audit";
import { EVOLUTION_LIMITS } from "@/lib/options";
import {
  lintCandidates,
  summarizeLintFeedback,
  type LintContext,
  type LintIssue,
} from "./lint";
import {
  checkConvergence,
  combineScores,
  judgeConfidence,
  JUDGE_DIMENSIONS,
  JUDGE_PERSONAS,
  lineageKey,
  type JudgeVerdict,
  type RoundOutcome,
} from "./select";
import {
  ARENA_GENERATE_SYSTEM_PROMPT,
  buildJudgePrompt,
  buildJudgeSystemPrompt,
  buildMutationPrompt,
  buildSeedPrompt,
  type ArenaBrandInput,
  type EliteForPrompt,
  type GeneratedCandidate,
} from "./prompts";
import { ARENA_DISCLAIMER, CROSSOVER_OPERATOR } from "./constants";

// ---------------------------------------------------------------------------
// ARENA — Creative Evolution Engine, aşama makinesi (AGENT-A §3).
// Bir koşu = maxRounds tur; her tur GENERATE → LINT → JUDGE → SELECT → DONE.
// advanceEvolution() her çağrıda TEK aşama ilerletir ve DB'ye yazar (Vercel 60 sn);
// idempotenttir (aşama çıktısı varsa atlar) ve claim ile yarış korumalıdır.
//
// KIRMIZI ÇİZGİ: skorlar göreli sıralamadır; performans tahmini üretilmez.
// ---------------------------------------------------------------------------

export type EvolutionConfig = {
  rounds: number;
  population: number;
  survivors: number;
  judges: number;
};

export type AdvanceResult = {
  status: EvolutionStatus;
  currentRound: number;
  stage: EvolutionStage | null;
};

/** 90 sn'den eski claim "çökmüş" sayılır ve devralınır */
export const CLAIM_STALE_MS = 90_000;
/** Lint'te tüm adaylar elenirse GENERATE en fazla bu kadar denenir */
export const MAX_GENERATE_ATTEMPTS = 2;
/** Kazanan + sonraki N aday Creative'e PENDING yazılır (CONTRACTS §7) */
export const PROMOTE_COUNT = 3;
/** Geçici sağlayıcı hatasında (zaman aşımı, 429/503) aşama en fazla bu kadar denenir */
export const MAX_STAGE_ATTEMPTS = 3;

class CancelledError extends Error {
  constructor() {
    super("Koşu iptal edildi.");
    this.name = "CancelledError";
  }
}

type RunWithBrand = Prisma.EvolutionRunGetPayload<{ include: { brand: true } }>;

export function parseConfig(raw: unknown): EvolutionConfig {
  const c = (raw ?? {}) as Partial<Record<keyof EvolutionConfig, unknown>>;
  const pick = (key: keyof EvolutionConfig) => {
    const lim = EVOLUTION_LIMITS[key];
    const n = Number(c[key]);
    if (!Number.isFinite(n)) return lim.default;
    return Math.max(lim.min, Math.min(lim.max, Math.round(n)));
  };
  return {
    rounds: pick("rounds"),
    population: pick("population"),
    survivors: pick("survivors"),
    judges: pick("judges"),
  };
}

function parseModelJson(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(cleaned);
}

// JSON parse hatasında aynı aşama bir kez retry (AGENT-A §6); sağlayıcının
// 429/503 retry'ı zaten var. İkinci başarısızlıkta hata fırlar → koşu FAILED.
async function callJson<T>(
  opts: { system: string; prompt: string },
  validate: (parsed: unknown) => T | null,
): Promise<{ value: T; completion: AiTextResult }> {
  const ai = getAiProvider();
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const completion = await ai.generateJson(opts);
    try {
      const value = validate(parseModelJson(completion.text));
      if (value !== null) return { value, completion };
      lastError = new Error("Model çıktısı beklenen şemaya uymadı.");
    } catch {
      lastError = new Error("Model çıktısı geçerli JSON değildi.");
    }
  }
  throw lastError ?? new Error("Model çıktısı okunamadı.");
}

async function addTokens(
  runId: string,
  roundId: string,
  completion: AiTextResult,
) {
  const p = completion.promptTokens ?? 0;
  const o = completion.outputTokens ?? 0;
  await prisma.$transaction([
    prisma.evolutionRound.update({
      where: { id: roundId },
      data: { promptTokens: { increment: p }, outputTokens: { increment: o } },
    }),
    prisma.evolutionRun.update({
      where: { id: runId },
      data: {
        promptTokens: { increment: p },
        outputTokens: { increment: o },
        model: completion.model,
      },
    }),
  ]);
}

async function assertNotCancelled(runId: string) {
  const r = await prisma.evolutionRun.findUnique({
    where: { id: runId },
    select: { status: true },
  });
  if (!r || r.status === "CANCELLED") throw new CancelledError();
}

// ---------------------------------------------------------------------------
// Marka girdisi (bir advance çağrısı için tek sefer yüklenir)
// ---------------------------------------------------------------------------
type BrandBundle = {
  input: ArenaBrandInput;
  competitorNames: string[];
  hasResearch: boolean;
  hasPattern: boolean;
  learningCount: number;
  /** Jüriye verilen kısa marka bağlamı (araştırmadan) */
  brandContext: Record<string, unknown>;
  audienceHypotheses: string | null;
  /** Lint: sayısal iddiaların doğrulanabileceği kaynaklar */
  sourceTexts: string[];
};

async function loadBrandBundle(run: RunWithBrand): Promise<BrandBundle> {
  const brandId = run.brandId;
  const [research, pattern, learnings, competitors] = await Promise.all([
    prisma.researchRun.findFirst({
      where: { brandId, status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.patternAnalysis.findFirst({
      where: { brandId, status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
    }),
    // CLAUDE.md §26 — öğrenmeler hipotez muamelesiyle girer
    prisma.learning.findMany({
      where: { brandId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.competitor.findMany({ where: { brandId }, select: { name: true } }),
  ]);
  const b = run.brand;
  const r = (research?.result ?? null) as Record<string, unknown> | null;
  const ah = r?.audience_hypotheses;
  const audience = Array.isArray(ah)
    ? (ah as Array<{ hypothesis?: string; confidence?: string }>)
        .map((h) => (h.hypothesis ? `${h.hypothesis} (${h.confidence ?? "?"})` : null))
        .filter(Boolean)
        .join(" | ")
    : null;
  const brandContext: Record<string, unknown> = {
    brand_identity: r?.brand_identity ?? null,
    positioning: r?.positioning ?? null,
    tone_of_voice: r?.tone_of_voice ?? null,
    value_propositions: r?.value_propositions ?? null,
    audience_hypotheses: r?.audience_hypotheses ?? null,
    market: r?.market ?? null,
    brand_voice_user: b.brandVoice ?? null,
    usp_user: b.usp ?? null,
  };
  return {
    input: {
      brandName: b.name,
      description: b.description,
      website: b.website,
      targetMarket: b.targetMarket,
      copyLanguage: b.copyLanguage,
      brandVoice: b.brandVoice,
      usp: b.usp,
      products: b.products ?? null,
      researchResult: research?.result ?? null,
      patternResult: pattern?.result ?? null,
      learnings: learnings.map((l) => ({
        text: l.text,
        confidence: l.confidence,
        sampleNote: l.sampleNote,
      })),
      goal: run.goal,
      offer: run.offer,
      instruction: run.instruction,
    },
    competitorNames: competitors.map((c) => c.name),
    hasResearch: !!research,
    hasPattern: !!pattern,
    learningCount: learnings.length,
    brandContext,
    audienceHypotheses: audience || null,
    // Pattern analizi bilinçli olarak DIŞARIDA: rakip reklamlarındaki sayılar
    // markanın iddiası olamaz (AGENT-A §4: araştırma JSON'u veya products).
    sourceTexts: [
      research?.result ? JSON.stringify(research.result) : "",
      b.products ? JSON.stringify(b.products) : "",
      b.description ?? "",
      b.brandVoice ?? "",
      b.usp ?? "",
      b.name,
      b.website ?? "",
      run.offer ?? "",
      run.instruction ?? "",
    ],
  };
}

// ---------------------------------------------------------------------------
// Ana giriş
// ---------------------------------------------------------------------------
function snapshot(run: { status: EvolutionStatus; currentRound: number }, stage: EvolutionStage | null): AdvanceResult {
  return { status: run.status, currentRound: run.currentRound, stage };
}

async function ensureRound(runId: string, index: number): Promise<EvolutionRound> {
  const existing = await prisma.evolutionRound.findUnique({
    where: { runId_index: { runId, index } },
  });
  if (existing) return existing;
  try {
    // Token sayaçları 0'dan başlar: NULL üzerine increment SQL'de NULL kalır
    return await prisma.evolutionRound.create({
      data: { runId, index, promptTokens: 0, outputTokens: 0 },
    });
  } catch (error) {
    // Eşzamanlı iki advance aynı turu yaratmaya çalıştı → @@unique([runId, index])
    if ((error as { code?: string }).code === "P2002") {
      const again = await prisma.evolutionRound.findUnique({
        where: { runId_index: { runId, index } },
      });
      if (again) return again;
    }
    throw error;
  }
}

/**
 * Koşuyu tek aşama ilerletir. Idempotent; yarış korumalı (claim).
 * Auth YOK — action katmanı sahiplik doğrular; after()/poller bunu çağırır.
 */
export async function advanceEvolution(runId: string): Promise<AdvanceResult> {
  const run = await prisma.evolutionRun.findUnique({
    where: { id: runId },
    include: { brand: true },
  });
  if (!run) throw new Error("Koşu bulunamadı.");
  if (run.status !== "QUEUED" && run.status !== "RUNNING") {
    return snapshot(run, run.status === "COMPLETED" ? "DONE" : null);
  }
  if (run.status === "QUEUED") {
    await prisma.evolutionRun.updateMany({
      where: { id: runId, status: "QUEUED" },
      data: {
        status: "RUNNING",
        // Token sayaçları 0'dan başlar (NULL üzerine increment NULL kalır)
        promptTokens: run.promptTokens ?? 0,
        outputTokens: run.outputTokens ?? 0,
      },
    });
    run.status = "RUNNING";
  }

  const round = await ensureRound(runId, run.currentRound);
  if (round.stage === "DONE") return snapshot(run, "DONE");

  // Claim: koşullu yazım — yalnız bir çağrı bu aşamayı işler (AGENT-A §3)
  const now = new Date();
  const claimed = await prisma.evolutionRound.updateMany({
    where: {
      id: round.id,
      stage: round.stage,
      OR: [
        { claimedAt: null },
        { claimedAt: { lt: new Date(now.getTime() - CLAIM_STALE_MS) } },
      ],
    },
    data: { claimedAt: now, stageAttempts: { increment: 1 } },
  });
  if (claimed.count !== 1) return snapshot(run, round.stage);
  round.stageAttempts += 1;

  const config = parseConfig(run.config);
  try {
    switch (round.stage) {
      case "GENERATE":
        await stageGenerate(run, round, config);
        break;
      case "LINT":
        await stageLint(run, round);
        break;
      case "JUDGE":
        await stageJudge(run, round, config);
        break;
      case "SELECT":
        await stageSelect(run, round, config);
        break;
    }
  } catch (error) {
    await handleStageError(run, round, error);
  }

  const after = await prisma.evolutionRun.findUnique({
    where: { id: runId },
    select: { status: true, currentRound: true },
  });
  if (!after) return snapshot(run, null);
  const afterRound = await prisma.evolutionRound.findUnique({
    where: { runId_index: { runId, index: after.currentRound } },
    select: { stage: true },
  });
  return snapshot(after, afterRound?.stage ?? null);
}

/**
 * Geçici hata mı? Sağlayıcı zaman aşımı / ağ hatası / 429-500-503 (provider'ın kendi
 * retry'ı tükendikten sonra) → aşama FAILED olmadan yeniden denenebilir.
 * AiBlockedError, JSON/şema hatası, kural hataları → kalıcı.
 */
function isTransientError(error: unknown): boolean {
  if (error instanceof AiBlockedError || error instanceof CancelledError) return false;
  if (error instanceof AiProviderError) {
    return error.status === undefined || [429, 500, 502, 503, 504].includes(error.status);
  }
  const name = (error as { name?: string })?.name ?? "";
  const message = (error as { message?: string })?.message ?? "";
  return (
    name === "TimeoutError" ||
    name === "AbortError" ||
    /timeout|aborted|fetch failed|ECONNRESET|ETIMEDOUT|EAI_AGAIN/i.test(message)
  );
}

async function handleStageError(
  run: RunWithBrand,
  round: EvolutionRound,
  error: unknown,
) {
  if (error instanceof CancelledError) {
    await prisma.evolutionRound.update({
      where: { id: round.id },
      data: { claimedAt: null },
    });
    return;
  }
  if (isTransientError(error) && round.stageAttempts < MAX_STAGE_ATTEMPTS) {
    // Claim bırakılır, aşama korunur; poller bir sonraki tikte yeniden dener.
    // JUDGE'da biten jüriler judgeOutput'ta kalır → yalnız eksikler tekrar koşar.
    await prisma.evolutionRound.update({
      where: { id: round.id },
      data: { claimedAt: null },
    });
    await audit({
      workspaceId: run.brand.workspaceId,
      action: "evolution.retried",
      entity: "evolution_run",
      entityId: run.id,
      newState: {
        round: round.index,
        stage: round.stage,
        attempt: round.stageAttempts,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    return;
  }
  const message =
    error instanceof AiBlockedError
      ? `BLOCKED: ${error.message}`
      : error instanceof Error
        ? error.message
        : "Bilinmeyen hata.";
  const suffix =
    isTransientError(error) && round.stageAttempts >= MAX_STAGE_ATTEMPTS
      ? ` (${round.stageAttempts} denemede de geçici hata — tur ${round.index + 1}, aşama ${round.stage})`
      : ` (tur ${round.index + 1}, aşama ${round.stage})`;
  await prisma.$transaction([
    prisma.evolutionRun.updateMany({
      where: { id: run.id, status: { in: ["QUEUED", "RUNNING"] } },
      data: { status: "FAILED", error: message + suffix, finishedAt: new Date() },
    }),
    prisma.evolutionRound.update({
      where: { id: round.id },
      data: { claimedAt: null },
    }),
  ]);
  await audit({
    workspaceId: run.brand.workspaceId,
    action: "evolution.failed",
    entity: "evolution_run",
    entityId: run.id,
    newState: { round: round.index, stage: round.stage, error: message },
  });
}

/** Aşama geçişi: claim bırakılır; yalnız beklenen aşamadaysa ilerler */
async function transition(
  roundId: string,
  from: EvolutionStage,
  to: EvolutionStage,
  extra: Prisma.EvolutionRoundUpdateManyMutationInput = {},
) {
  await prisma.evolutionRound.updateMany({
    where: { id: roundId, stage: from },
    data: { stage: to, claimedAt: null, stageAttempts: 0, ...extra },
  });
}

// ---------------------------------------------------------------------------
// GENERATE
// ---------------------------------------------------------------------------
function validCandidates(parsed: unknown): GeneratedCandidate[] | null {
  const list = (parsed as { candidates?: unknown })?.candidates;
  if (!Array.isArray(list)) return null;
  const valid = (list as GeneratedCandidate[]).filter(
    (v) =>
      typeof v?.primary_text === "string" &&
      v.primary_text.trim() &&
      typeof v.headline === "string" &&
      v.headline.trim() &&
      typeof v.cta === "string" &&
      v.cta.trim() &&
      typeof v.strategy === "string" &&
      typeof v.hook === "string",
  );
  return valid.length > 0 ? valid : null;
}

function toCandidateRow(
  run: EvolutionRun,
  roundId: string,
  v: GeneratedCandidate,
  origin: "SEED" | "MUTATION" | "CROSSOVER",
  parentId: string | null,
  whySuffix: string,
): Prisma.EvolutionCandidateCreateManyInput {
  return {
    runId: run.id,
    roundId,
    origin,
    parentId,
    strategy: v.strategy!.trim(),
    hook: v.hook!.trim(),
    primaryText: v.primary_text!.trim(),
    headline: v.headline!.trim(),
    description: v.description?.trim() || null,
    cta: v.cta!.trim(),
    targetNote: v.target_note?.trim() || null,
    why: `${v.why?.trim() || ""}${whySuffix}`.trim(),
    lintScore: 100,
    lintIssues: [],
  };
}

async function stageGenerate(
  run: RunWithBrand,
  round: EvolutionRound,
  config: EvolutionConfig,
) {
  // Idempotency: bu turda lint'ten elenmemiş aday zaten varsa üretim yapılmış
  const alive = await prisma.evolutionCandidate.count({
    where: { roundId: round.id, eliminatedReason: null },
  });
  if (alive > 0) {
    await transition(round.id, "GENERATE", "LINT");
    return;
  }

  const bundle = await loadBrandBundle(run);
  // Yeniden üretimde (lint her şeyi eledi) önceki ihlaller modele söylenir
  const previous = await prisma.evolutionCandidate.findMany({
    where: { roundId: round.id },
    select: { lintIssues: true },
  });
  const lintFeedback = summarizeLintFeedback(
    previous.map((p) => ({ issues: (p.lintIssues as LintIssue[]) ?? [] })),
  );

  const elites =
    round.index === 0
      ? []
      : await prisma.evolutionCandidate.findMany({
          where: {
            runId: run.id,
            round: { index: round.index - 1 },
            survived: true,
          },
          orderBy: { rank: "asc" },
        });

  let rows: Prisma.EvolutionCandidateCreateManyInput[];
  let completion: AiTextResult;

  if (elites.length === 0) {
    // Tohum turu (veya elit yoksa tohumla yeniden başla)
    const { value, completion: c } = await callJson(
      {
        system: ARENA_GENERATE_SYSTEM_PROMPT,
        prompt: buildSeedPrompt({
          brand: bundle.input,
          population: config.population,
          lintFeedback,
        }),
      },
      validCandidates,
    );
    completion = c;
    rows = value
      .slice(0, config.population)
      .map((v) =>
        toCandidateRow(run, round.id, v, "SEED", null, v.axis ? ` [eksen: ${v.axis}]` : ""),
      );
  } else {
    // Elitler aynen taşınır + eleştirilere dayalı mutasyon çocukları (+1 crossover)
    const eliteLabels = elites.map((e, i) => ({ label: `E${i + 1}`, elite: e }));
    const elitesForPrompt: EliteForPrompt[] = eliteLabels.map(({ label, elite }) => ({
      label,
      strategy: elite.strategy,
      hook: elite.hook,
      primaryText: elite.primaryText,
      headline: elite.headline,
      description: elite.description,
      cta: elite.cta,
      targetNote: elite.targetNote,
      critiques: extractCritiques(elite),
    }));
    const childCount = Math.max(1, config.population - elites.length);
    const includeCrossover = elites.length >= 2 && childCount >= 2;
    const { value, completion: c } = await callJson(
      {
        system: ARENA_GENERATE_SYSTEM_PROMPT,
        prompt: buildMutationPrompt({
          brand: bundle.input,
          elites: elitesForPrompt,
          childCount,
          includeCrossover,
          lintFeedback,
        }),
      },
      validCandidates,
    );
    completion = c;
    const byLabel = new Map(eliteLabels.map((e) => [e.label, e.elite.id]));
    const eliteRows: Prisma.EvolutionCandidateCreateManyInput[] = elites.map((e) => ({
      runId: run.id,
      roundId: round.id,
      origin: "ELITE",
      parentId: e.id,
      strategy: e.strategy,
      hook: e.hook,
      primaryText: e.primaryText,
      headline: e.headline,
      description: e.description,
      cta: e.cta,
      targetNote: e.targetNote,
      why: e.why,
      lintScore: 100,
      lintIssues: [],
    }));
    const childRows = value.slice(0, childCount).map((v) => {
      const op = (v.operator ?? "").trim().toLowerCase();
      const isCross = op === CROSSOVER_OPERATOR;
      const parentId =
        byLabel.get((v.parent_id ?? "").trim().toUpperCase()) ?? elites[0].id;
      const second = isCross
        ? byLabel.get((v.second_parent_id ?? "").trim().toUpperCase())
        : null;
      const suffix = ` [operatör: ${op || "belirtilmedi"}${second ? `; ikinci ebeveyn: ${second}` : ""}]`;
      return toCandidateRow(run, round.id, v, isCross ? "CROSSOVER" : "MUTATION", parentId, suffix);
    });
    rows = [...eliteRows, ...childRows];
  }

  // Maliyet iptalde de kaydedilir (CLAUDE.md §43): çağrı yapıldı, token harcandı
  await addTokens(run.id, round.id, completion);
  await assertNotCancelled(run.id);
  await prisma.$transaction([
    prisma.evolutionCandidate.createMany({ data: rows }),
    prisma.evolutionRound.updateMany({
      where: { id: round.id, stage: "GENERATE" },
      data: {
        stage: "LINT",
        claimedAt: null,
        stageAttempts: 0,
        generateAttempts: { increment: 1 },
      },
    }),
  ]);
  await audit({
    workspaceId: run.brand.workspaceId,
    action: "evolution.advanced",
    entity: "evolution_run",
    entityId: run.id,
    newState: { round: round.index, stage: "GENERATE", candidates: rows.length },
  });
}

/** Elitin kendi turundaki jüri eleştirilerini judgeBreakdown'dan çıkarır */
function extractCritiques(
  elite: EvolutionCandidate,
): EliteForPrompt["critiques"] {
  const breakdown = elite.judgeBreakdown as JudgeBreakdown | null;
  if (!breakdown?.judges) return [];
  return Object.entries(breakdown.judges).map(([key, j]) => ({
    judge: JUDGE_PERSONAS.find((p) => p.key === key)?.label ?? key,
    critique: j.critique ?? "-",
    suggestedMutation: j.suggestedMutation ?? "-",
  }));
}

// ---------------------------------------------------------------------------
// LINT
// ---------------------------------------------------------------------------
async function stageLint(run: RunWithBrand, round: EvolutionRound) {
  const bundle = await loadBrandBundle(run);
  const cands = await prisma.evolutionCandidate.findMany({
    where: { roundId: round.id, eliminatedReason: null },
    orderBy: { createdAt: "asc" },
  });
  const ctx: LintContext = {
    offer: run.offer,
    competitorNames: bundle.competitorNames,
    copyLanguage: run.brand.copyLanguage,
    sourceTexts: bundle.sourceTexts,
  };
  const results = lintCandidates(
    cands.map((c) => ({
      id: c.id,
      hook: c.hook,
      primaryText: c.primaryText,
      headline: c.headline,
      description: c.description,
      cta: c.cta,
    })),
    ctx,
  );
  await prisma.$transaction(
    cands.map((c) => {
      const r = results.get(c.id)!;
      return prisma.evolutionCandidate.update({
        where: { id: c.id },
        data: {
          lintScore: r.score,
          lintIssues: r.issues as Prisma.InputJsonValue,
          eliminatedReason: r.eliminatedReason,
        },
      });
    }),
  );
  const passing = [...results.values()].filter((r) => !r.eliminated).length;
  if (passing === 0) {
    if (round.generateAttempts < MAX_GENERATE_ATTEMPTS) {
      // Lint geri bildirimiyle bir kez daha üret
      await transition(round.id, "LINT", "GENERATE");
    } else {
      throw new Error(
        `Tüm adaylar ${MAX_GENERATE_ATTEMPTS} denemede de kural kontrolünde elendi: ${summarizeLintFeedback(results.values()).slice(0, 3).join(" · ")}`,
      );
    }
  } else {
    await transition(round.id, "LINT", "JUDGE");
  }
  await audit({
    workspaceId: run.brand.workspaceId,
    action: "evolution.advanced",
    entity: "evolution_run",
    entityId: run.id,
    newState: {
      round: round.index,
      stage: "LINT",
      passing,
      eliminated: cands.length - passing,
    },
  });
}

// ---------------------------------------------------------------------------
// JUDGE — her jüri TEK çağrıda turun tüm adaylarını görür
// ---------------------------------------------------------------------------
type JudgeInputSnapshot = {
  labels: Record<string, string>; // label → candidateId
  judges: string[];
  brandContext: Record<string, unknown>;
  candidates: Array<{ label: string; id: string; hook: string; headline: string }>;
};
type JudgeOutputSnapshot = Record<
  string,
  { verdict: JudgeVerdict; model: string; promptTokens: number | null; outputTokens: number | null }
>;
export type JudgeBreakdown = {
  judges: Record<
    string,
    {
      scores: Record<string, number | null>;
      weighted: number | null;
      rank: number | null;
      critique: string | null;
      suggestedMutation: string | null;
    }
  >;
  borda: number | null;
  judgeStd: number | null;
  firstPlaceVotes: number;
  judgeCount: number;
};

function validVerdict(parsed: unknown): JudgeVerdict | null {
  const p = parsed as JudgeVerdict;
  if (!p || typeof p !== "object" || !p.scores || typeof p.scores !== "object") return null;
  if (Object.keys(p.scores).length === 0) return null;
  return { scores: p.scores, ranking: Array.isArray(p.ranking) ? p.ranking.map(String) : undefined };
}

async function stageJudge(
  run: RunWithBrand,
  round: EvolutionRound,
  config: EvolutionConfig,
) {
  const bundle = await loadBrandBundle(run);
  const cands = await prisma.evolutionCandidate.findMany({
    where: { roundId: round.id, eliminatedReason: null },
    orderBy: { createdAt: "asc" },
  });
  if (cands.length === 0) throw new Error("Jüriye gidecek aday yok.");
  const labeled = cands.map((c, i) => ({ label: `A${i + 1}`, c }));
  const personas = JUDGE_PERSONAS.slice(0, config.judges);

  const judgeInput: JudgeInputSnapshot = (round.judgeInput as JudgeInputSnapshot | null) ?? {
    labels: Object.fromEntries(labeled.map((l) => [l.label, l.c.id])),
    judges: personas.map((p) => p.key),
    brandContext: bundle.brandContext,
    candidates: labeled.map((l) => ({
      label: l.label,
      id: l.c.id,
      hook: l.c.hook,
      headline: l.c.headline,
    })),
  };
  if (!round.judgeInput) {
    await prisma.evolutionRound.update({
      where: { id: round.id },
      data: { judgeInput: judgeInput as unknown as Prisma.InputJsonValue },
    });
  }

  // Kısmi kalıcılık: biten jüri hemen yazılır; zaman aşımı sonrası yalnız eksikler koşar
  const output: JudgeOutputSnapshot = { ...((round.judgeOutput as JudgeOutputSnapshot | null) ?? {}) };
  const missing = personas.filter((p) => !output[p.key]);
  const prompt = buildJudgePrompt({
    brandName: run.brand.name,
    goal: run.goal,
    offer: run.offer,
    copyLanguage: run.brand.copyLanguage,
    brandContext: judgeInput.brandContext,
    candidates: labeled.map((l) => ({
      label: l.label,
      strategy: l.c.strategy,
      hook: l.c.hook,
      primaryText: l.c.primaryText,
      headline: l.c.headline,
      description: l.c.description,
      cta: l.c.cta,
      targetNote: l.c.targetNote,
    })),
  });

  // Yazımlar tek zincirde sıralanır ve DB'deki değerle BİRLEŞTİRİLİR (replace değil):
  // paralel biten jüriler ya da önceki (zaman aşımına uğramış) denemenin geç gelen
  // sonucu birbirini ezmez; yalnız aynı anahtar yeniden yazılır.
  let chain: Promise<unknown> = Promise.resolve();
  const persistJudge = async (
    key: string,
    result: JudgeOutputSnapshot[string],
    completion: AiTextResult,
  ) => {
    const fresh = await prisma.evolutionRound.findUnique({
      where: { id: round.id },
      select: { judgeOutput: true },
    });
    const merged: JudgeOutputSnapshot = {
      ...((fresh?.judgeOutput as JudgeOutputSnapshot | null) ?? {}),
      [key]: result,
    };
    await prisma.evolutionRound.update({
      where: { id: round.id },
      data: { judgeOutput: merged as unknown as Prisma.InputJsonValue },
    });
    await addTokens(run.id, round.id, completion);
  };
  await Promise.all(
    missing.map(async (persona) => {
      const { value, completion } = await callJson(
        {
          system: buildJudgeSystemPrompt(persona, bundle.audienceHypotheses),
          prompt,
        },
        validVerdict,
      );
      const result: JudgeOutputSnapshot[string] = {
        verdict: value,
        model: completion.model,
        promptTokens: completion.promptTokens,
        outputTokens: completion.outputTokens,
      };
      output[persona.key] = result;
      chain = chain.then(() => persistJudge(persona.key, result, completion));
      await chain;
    }),
  );
  await chain;

  await assertNotCancelled(run.id);
  // Geçiş kararı DB'deki güncel değerle verilir
  const latest = await prisma.evolutionRound.findUnique({
    where: { id: round.id },
    select: { judgeOutput: true },
  });
  const stored = (latest?.judgeOutput as JudgeOutputSnapshot | null) ?? {};
  if (personas.every((p) => stored[p.key])) {
    await transition(round.id, "JUDGE", "SELECT");
  }
  await audit({
    workspaceId: run.brand.workspaceId,
    action: "evolution.advanced",
    entity: "evolution_run",
    entityId: run.id,
    newState: { round: round.index, stage: "JUDGE", judges: Object.keys(stored) },
  });
}

// ---------------------------------------------------------------------------
// SELECT — saf hesap: skor birleştirme, sıralama, elit seçimi, yakınsama
// ---------------------------------------------------------------------------
async function stageSelect(
  run: RunWithBrand,
  round: EvolutionRound,
  config: EvolutionConfig,
) {
  const fresh = await prisma.evolutionRound.findUnique({ where: { id: round.id } });
  const judgeInput = fresh?.judgeInput as JudgeInputSnapshot | null;
  const judgeOutput = fresh?.judgeOutput as JudgeOutputSnapshot | null;
  if (!judgeInput || !judgeOutput) throw new Error("Jüri çıktısı eksik.");
  const labelToId = judgeInput.labels;

  const cands = await prisma.evolutionCandidate.findMany({
    where: { roundId: round.id },
    orderBy: { createdAt: "asc" },
  });

  // Jüri çıktıları etiketle döner → id'ye çevir
  const judges = JUDGE_PERSONAS.filter((p) => judgeOutput[p.key]).map((p) => {
    const v = judgeOutput[p.key].verdict;
    const scores: JudgeVerdict["scores"] = {};
    for (const [label, s] of Object.entries(v.scores ?? {})) {
      const id = labelToId[label.trim().toUpperCase()] ?? labelToId[label];
      if (id) scores[id] = s;
    }
    const ranking = v.ranking
      ?.map((l) => labelToId[String(l).trim().toUpperCase()] ?? labelToId[String(l)])
      .filter((x): x is string => !!x);
    return { key: p.key, weights: p.weights, verdict: { scores, ranking } };
  });

  const scores = combineScores({
    candidates: cands.map((c) => ({
      id: c.id,
      lintScore: c.lintScore,
      eliminated: !!c.eliminatedReason,
    })),
    judges,
    survivors: config.survivors,
  });

  await prisma.$transaction(
    cands.map((c) => {
      const s = scores.get(c.id)!;
      const breakdown: JudgeBreakdown = {
        judges: Object.fromEntries(
          judges.map((j) => {
            const v = j.verdict.scores[c.id];
            return [
              j.key,
              {
                scores: Object.fromEntries(
                  JUDGE_DIMENSIONS.map((d) => [d, typeof v?.[d] === "number" ? v[d]! : null]),
                ),
                weighted: s.perJudge[j.key]?.weighted ?? null,
                rank: s.perJudge[j.key]?.rank ?? null,
                critique: v?.critique ?? null,
                suggestedMutation: v?.suggested_mutation ?? null,
              },
            ];
          }),
        ),
        borda: s.borda,
        judgeStd: s.judgeStd,
        firstPlaceVotes: s.firstPlaceVotes,
        judgeCount: judges.length,
      };
      return prisma.evolutionCandidate.update({
        where: { id: c.id },
        data: {
          judgeScore: s.judgeScore,
          totalScore: s.totalScore,
          rank: s.rank,
          survived: s.survived,
          judgeBreakdown: c.eliminatedReason
            ? undefined
            : (breakdown as unknown as Prisma.InputJsonValue),
        },
      });
    }),
  );

  // Yakınsama: tüm turların 1. adayları
  const all = await prisma.evolutionCandidate.findMany({
    where: { runId: run.id },
    select: { id: true, origin: true, parentId: true, rank: true, totalScore: true, round: { select: { index: true } } },
  });
  const byId = new Map(all.map((c) => [c.id, { origin: c.origin, parentId: c.parentId }]));
  const history: RoundOutcome[] = [];
  for (let i = 0; i <= round.index; i++) {
    const best = all.find((c) => c.round.index === i && c.rank === 1);
    if (!best || best.totalScore === null) continue;
    history.push({ bestTotal: Number(best.totalScore), bestLineage: lineageKey(best.id, byId) });
  }
  const convergence = checkConvergence(history);
  const isLast = round.index + 1 >= run.maxRounds;

  const winner = cands.find((c) => scores.get(c.id)?.rank === 1);
  if (!winner) throw new Error("Turda sıralanabilir aday kalmadı.");

  await assertNotCancelled(run.id);
  if (isLast || convergence.converged) {
    await finishRun(run, round, cands, scores, {
      convergence: convergence.converged ? "early" : "max_rounds",
      reason: convergence.reason,
      history,
    });
    return;
  }

  // Sonraki tur
  await prisma.$transaction([
    prisma.evolutionRound.updateMany({
      where: { id: round.id, stage: "SELECT" },
      data: { stage: "DONE", claimedAt: null, stageAttempts: 0, finishedAt: new Date() },
    }),
    prisma.evolutionRun.update({
      where: { id: run.id },
      data: { currentRound: round.index + 1 },
    }),
  ]);
  await ensureRound(run.id, round.index + 1);
  await audit({
    workspaceId: run.brand.workspaceId,
    action: "evolution.advanced",
    entity: "evolution_run",
    entityId: run.id,
    newState: {
      round: round.index,
      stage: "SELECT",
      winner: winner.id,
      bestTotal: history[history.length - 1]?.bestTotal ?? null,
    },
  });
}

// ---------------------------------------------------------------------------
// Bitiş: kazanan + sonraki adaylar Creative'e PENDING yazılır; özet yazılır
// ---------------------------------------------------------------------------
export type EvolutionSummary = {
  convergence: "early" | "max_rounds";
  convergenceReason: "low_gain" | "same_winner" | null;
  rounds_run: number;
  winnerCandidateId: string;
  winnerRationale: string;
  confidence: "low" | "medium" | "high";
  dataBasis: { research: boolean; pattern: boolean; learnings: number };
  promotedCandidateIds: string[];
  promotedCreativeIds: string[];
  bestTotalByRound: number[];
  disclaimer: string;
};

async function finishRun(
  run: RunWithBrand,
  round: EvolutionRound,
  cands: EvolutionCandidate[],
  scores: ReturnType<typeof combineScores>,
  conv: { convergence: "early" | "max_rounds"; reason: "low_gain" | "same_winner" | null; history: RoundOutcome[] },
) {
  const ranked = cands
    .filter((c) => (scores.get(c.id)?.rank ?? null) !== null)
    .sort((a, b) => scores.get(a.id)!.rank! - scores.get(b.id)!.rank!);
  const promoted = ranked.slice(0, PROMOTE_COUNT);
  const winner = ranked[0];
  const winnerScore = scores.get(winner.id)!;
  const judgeCount = Object.keys(winnerScore.perJudge).length;
  const confidence = judgeConfidence(winnerScore, judgeCount);

  const bundle = await loadBrandBundle(run);
  const { creativeIds } = await promoteCandidatesInternal(run, promoted.map((c) => c.id), {
    confidenceFor: (id) => judgeConfidence(scores.get(id)!, judgeCount),
    note: null,
  });

  const freshWinner = await prisma.evolutionCandidate.findUnique({ where: { id: winner.id } });
  const breakdown = freshWinner?.judgeBreakdown as JudgeBreakdown | null;
  const critiqueLines = breakdown
    ? Object.entries(breakdown.judges).map(([key, j]) => {
        const label = JUDGE_PERSONAS.find((p) => p.key === key)?.label ?? key;
        return `${label} (${j.rank ?? "?"}. sıra): ${j.critique ?? "-"}`;
      })
    : [];
  const winnerRationale = [
    `Son turda ${ranked.length} aday arasında 1. (toplam ${winnerScore.totalScore}; jüri ${winnerScore.judgeScore}, Borda ${winnerScore.borda}, lint ${winner.lintScore}). ${judgeCount} jüriden ${winnerScore.firstPlaceVotes}'i 1. sıraya koydu.`,
    ...critiqueLines,
  ].join("\n");

  const summary: EvolutionSummary = {
    convergence: conv.convergence,
    convergenceReason: conv.reason,
    rounds_run: round.index + 1,
    winnerCandidateId: winner.id,
    winnerRationale,
    confidence,
    dataBasis: {
      research: bundle.hasResearch,
      pattern: bundle.hasPattern,
      learnings: bundle.learningCount,
    },
    promotedCandidateIds: promoted.map((c) => c.id),
    promotedCreativeIds: creativeIds,
    bestTotalByRound: conv.history.map((h) => h.bestTotal),
    disclaimer: ARENA_DISCLAIMER,
  };

  await prisma.$transaction([
    prisma.evolutionRound.updateMany({
      where: { id: round.id, stage: "SELECT" },
      data: { stage: "DONE", claimedAt: null, stageAttempts: 0, finishedAt: new Date() },
    }),
    prisma.evolutionRun.updateMany({
      where: { id: run.id, status: "RUNNING" },
      data: {
        status: "COMPLETED",
        finishedAt: new Date(),
        winnerCreativeId: creativeIds[0] ?? null,
        summary: summary as unknown as Prisma.InputJsonValue,
      },
    }),
  ]);
  await audit({
    workspaceId: run.brand.workspaceId,
    action: "evolution.completed",
    entity: "evolution_run",
    entityId: run.id,
    newState: {
      rounds_run: summary.rounds_run,
      convergence: summary.convergence,
      winnerCandidateId: winner.id,
      winnerCreativeId: creativeIds[0] ?? null,
      confidence,
    },
  });
}

/**
 * Adayları Creative'e PENDING kopyalar — yeni bir CreativeGeneration altında,
 * status COMPLETED + finishedAt dolu (aksi halde manuel üretim "süren üretim var"
 * diye kilitlenir — AGENT-A §3). Auth YOK; action katmanı sahiplik doğrular.
 */
export async function promoteCandidatesInternal(
  run: RunWithBrand,
  candidateIds: string[],
  opts: {
    confidenceFor: (candidateId: string) => "low" | "medium" | "high";
    note: string | null;
    userId?: string;
  },
): Promise<{ creativeIds: string[]; generationId: string }> {
  const cands = await prisma.evolutionCandidate.findMany({
    where: { id: { in: candidateIds }, runId: run.id },
  });
  const ordered = candidateIds
    .map((id) => cands.find((c) => c.id === id))
    .filter((c): c is EvolutionCandidate => !!c);
  if (ordered.length === 0) throw new Error("Aktarılacak aday bulunamadı.");

  const generation = await prisma.creativeGeneration.create({
    data: {
      brandId: run.brandId,
      status: "COMPLETED",
      finishedAt: new Date(),
      instruction: `Arena koşusu ${run.id}${opts.note ? ` — ${opts.note}` : ""}`,
      offer: run.offer,
      model: run.model,
      promptTokens: run.promptTokens,
      outputTokens: run.outputTokens,
    },
  });
  const creativeIds: string[] = [];
  for (const c of ordered) {
    const creative = await prisma.creative.create({
      data: {
        brandId: run.brandId,
        generationId: generation.id,
        strategy: c.strategy,
        hook: c.hook,
        primaryText: c.primaryText,
        headline: c.headline,
        description: c.description,
        cta: c.cta,
        targetNote: c.targetNote,
        why: `${c.why}\n[Arena: tur ${await roundIndexOf(c.roundId)}, sıra ${c.rank ?? "?"}, toplam skor ${c.totalScore ?? "?"} — ${ARENA_DISCLAIMER}]`,
        confidence: opts.confidenceFor(c.id),
      },
    });
    creativeIds.push(creative.id);
  }
  // Koşu tamamlandıysa özetteki aktarım listesi güncellenir (UI "gönderildi" gösterir)
  const fresh = await prisma.evolutionRun.findUnique({
    where: { id: run.id },
    select: { summary: true },
  });
  const summary = fresh?.summary as EvolutionSummary | null;
  if (summary && typeof summary === "object") {
    const next: EvolutionSummary = {
      ...summary,
      promotedCandidateIds: [
        ...new Set([...(summary.promotedCandidateIds ?? []), ...ordered.map((c) => c.id)]),
      ],
      promotedCreativeIds: [...(summary.promotedCreativeIds ?? []), ...creativeIds],
    };
    await prisma.evolutionRun.update({
      where: { id: run.id },
      data: { summary: next as unknown as Prisma.InputJsonValue },
    });
  }
  await audit({
    workspaceId: run.brand.workspaceId,
    userId: opts.userId,
    action: "evolution.promoted",
    entity: "evolution_run",
    entityId: run.id,
    newState: { generationId: generation.id, candidateIds: ordered.map((c) => c.id), creativeIds },
  });
  return { creativeIds, generationId: generation.id };
}

async function roundIndexOf(roundId: string): Promise<number> {
  const r = await prisma.evolutionRound.findUnique({
    where: { id: roundId },
    select: { index: true },
  });
  return r?.index ?? 0;
}
