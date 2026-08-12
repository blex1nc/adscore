// AI PROVIDER ABSTRACTION (CLAUDE.md §36)
// Sağlayıcı hard-code edilmez; adapter değişimi bu paketin içinde kalır.
// Geliştirme fazı sağlayıcısı: Google AI Studio / Gemini (PHASE0 §2 kararı).

export type AiTextResult = {
  text: string;
  model: string;
  promptTokens: number | null;
  outputTokens: number | null;
};

export type GenerateJsonOptions = {
  prompt: string;
  /** Sistem talimatı (model davranış çerçevesi) */
  system?: string;
  maxOutputTokens?: number;
};

/** Sağlayıcı yapılandırılmamış (API key yok) — CLAUDE.md §33: fake fallback YOK */
export class AiBlockedError extends Error {
  readonly blocked = true;
  constructor(message: string) {
    super(message);
    this.name = "AiBlockedError";
  }
}

export class AiProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}

export interface AiProvider {
  readonly name: string;
  generateJson(options: GenerateJsonOptions): Promise<AiTextResult>;
}

// Alias: her zaman güncel flash modelini izler (sabit sürüm adları
// yeni kullanıcılara kapanabiliyor — 2026-08-12'de gemini-2.5-flash kapandı).
// Sabitlemek istersen .env'de GEMINI_MODEL ile override et.
const GEMINI_MODEL_CANDIDATES = [
  "gemini-flash-latest",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-flash-lite-latest",
];
const RETRYABLE_STATUS = new Set([429, 500, 503]);
const RETRY_DELAYS_MS = [2000, 8000];

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
  };
  error?: { message?: string };
};

class GeminiProvider implements AiProvider {
  readonly name = "gemini";
  // Çalıştığı bilinen model süreç ömrünce hatırlanır
  private static workingModel: string | null = null;

  constructor(
    private readonly apiKey: string,
    private readonly modelOverride: string | null,
  ) {}

  async generateJson(options: GenerateJsonOptions): Promise<AiTextResult> {
    const models = this.modelOverride
      ? [this.modelOverride]
      : GeminiProvider.workingModel
        ? [
            GeminiProvider.workingModel,
            ...GEMINI_MODEL_CANDIDATES.filter(
              (m) => m !== GeminiProvider.workingModel,
            ),
          ]
        : GEMINI_MODEL_CANDIDATES;

    let lastError: AiProviderError | null = null;
    for (const model of models) {
      // Geçici hatalarda (429/500/503) backoff ile tekrar dene;
      // 404 (model kapanmış) ise sıradaki adaya geç.
      for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
        try {
          const result = await this.callModel(model, options);
          GeminiProvider.workingModel = model;
          return result;
        } catch (error) {
          if (!(error instanceof AiProviderError)) throw error;
          lastError = error;
          if (error.status === 404) break;
          if (
            error.status !== undefined &&
            RETRYABLE_STATUS.has(error.status) &&
            attempt < RETRY_DELAYS_MS.length
          ) {
            await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
            continue;
          }
          if (
            error.status !== undefined &&
            RETRYABLE_STATUS.has(error.status)
          ) {
            break; // bu model için denemeler bitti, sıradakine geç
          }
          throw error;
        }
      }
    }
    throw lastError ??
      new AiProviderError("Hiçbir Gemini modeline erişilemedi.");
  }

  private async callModel(
    model: string,
    options: GenerateJsonOptions,
  ): Promise<AiTextResult> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // Key header'da taşınır; URL'e asla yazılmaz (log sızıntısı önlemi)
        "x-goog-api-key": this.apiKey,
      },
      body: JSON.stringify({
        ...(options.system
          ? { systemInstruction: { parts: [{ text: options.system }] } }
          : {}),
        contents: [{ role: "user", parts: [{ text: options.prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens: options.maxOutputTokens ?? 8192,
        },
      }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!response.ok) {
      let detail = "";
      try {
        const body = (await response.json()) as GeminiResponse;
        detail = body.error?.message ?? "";
      } catch {}
      throw new AiProviderError(
        `Gemini API hatası (HTTP ${response.status})${detail ? `: ${detail}` : ""}`,
        response.status,
      );
    }

    const body = (await response.json()) as GeminiResponse;
    const text =
      body.candidates?.[0]?.content?.parts
        ?.map((p) => p.text ?? "")
        .join("") ?? "";
    if (!text) {
      throw new AiProviderError(
        `Gemini boş yanıt döndürdü (finishReason: ${body.candidates?.[0]?.finishReason ?? "yok"})`,
      );
    }
    return {
      text,
      model,
      promptTokens: body.usageMetadata?.promptTokenCount ?? null,
      outputTokens: body.usageMetadata?.candidatesTokenCount ?? null,
    };
  }
}

export type AiImageResult = {
  imageBase64: string;
  mimeType: string;
  model: string;
};

// Görsel üretim modeli adayları (2026-08-12 model listesinden).
// Sabitlemek için GEMINI_IMAGE_MODEL env override.
const GEMINI_IMAGE_MODEL_CANDIDATES = [
  "gemini-3.1-flash-image",
  "gemini-2.5-flash-image",
  "gemini-3.1-flash-image-preview",
];

type GeminiImageResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        inlineData?: { mimeType?: string; data?: string };
      }>;
    };
    finishReason?: string;
  }>;
  error?: { message?: string };
};

/**
 * Görsel üretimi: aday modelleri sırayla dener (404 → sıradaki,
 * 429/500/503 → backoff'lu retry). Görsel dönmezse dürüst hata.
 */
export async function generateImage(prompt: string): Promise<AiImageResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AiBlockedError(
      "GEMINI_API_KEY tanımlı değil. apps/web/.env.local dosyasına key'i ekleyip dev server'ı yeniden başlat.",
    );
  }
  const override = process.env.GEMINI_IMAGE_MODEL;
  const models = override ? [override] : GEMINI_IMAGE_MODEL_CANDIDATES;

  let lastError: AiProviderError | null = null;
  for (const model of models) {
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-goog-api-key": apiKey,
            },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
            }),
            signal: AbortSignal.timeout(120_000),
          },
        );
        if (!response.ok) {
          let detail = "";
          try {
            const body = (await response.json()) as GeminiImageResponse;
            detail = body.error?.message ?? "";
          } catch {}
          throw new AiProviderError(
            `Gemini image API hatası (HTTP ${response.status})${detail ? `: ${detail}` : ""}`,
            response.status,
          );
        }
        const body = (await response.json()) as GeminiImageResponse;
        const part = body.candidates?.[0]?.content?.parts?.find(
          (p) => p.inlineData?.data,
        );
        if (!part?.inlineData?.data) {
          throw new AiProviderError(
            `Model görsel döndürmedi (finishReason: ${body.candidates?.[0]?.finishReason ?? "yok"})`,
          );
        }
        return {
          imageBase64: part.inlineData.data,
          mimeType: part.inlineData.mimeType ?? "image/png",
          model,
        };
      } catch (error) {
        if (!(error instanceof AiProviderError)) throw error;
        lastError = error;
        if (error.status === 404 || error.status === 400) break;
        if (
          error.status !== undefined &&
          RETRYABLE_STATUS.has(error.status) &&
          attempt < RETRY_DELAYS_MS.length
        ) {
          await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
          continue;
        }
        if (error.status !== undefined && RETRYABLE_STATUS.has(error.status)) {
          break;
        }
        break;
      }
    }
  }
  throw lastError ?? new AiProviderError("Hiçbir görsel modeline erişilemedi.");
}

/**
 * Yapılandırılmış sağlayıcıyı döndürür.
 * Key yoksa AiBlockedError fırlatır — çağıran taraf bunu kullanıcıya
 * "BLOCKED" olarak dürüstçe gösterir, sahte veri üretmez.
 */
export function getAiProvider(): AiProvider {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    return new GeminiProvider(geminiKey, process.env.GEMINI_MODEL ?? null);
  }
  throw new AiBlockedError(
    "GEMINI_API_KEY tanımlı değil. apps/web/.env.local dosyasına key'i ekleyip dev server'ı yeniden başlat.",
  );
}
