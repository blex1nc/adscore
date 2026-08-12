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

const GEMINI_DEFAULT_MODEL = "gemini-2.5-flash";

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

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async generateJson(options: GenerateJsonOptions): Promise<AiTextResult> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;
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
      model: this.model,
      promptTokens: body.usageMetadata?.promptTokenCount ?? null,
      outputTokens: body.usageMetadata?.candidatesTokenCount ?? null,
    };
  }
}

/**
 * Yapılandırılmış sağlayıcıyı döndürür.
 * Key yoksa AiBlockedError fırlatır — çağıran taraf bunu kullanıcıya
 * "BLOCKED" olarak dürüstçe gösterir, sahte veri üretmez.
 */
export function getAiProvider(): AiProvider {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    return new GeminiProvider(
      geminiKey,
      process.env.GEMINI_MODEL ?? GEMINI_DEFAULT_MODEL,
    );
  }
  throw new AiBlockedError(
    "GEMINI_API_KEY tanımlı değil. apps/web/.env.local dosyasına key'i ekleyip dev server'ı yeniden başlat.",
  );
}
