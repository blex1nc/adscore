import "server-only";

// HARCAMA GÜVENLİĞİ KİLİDİ — CONTRACTS.md §4 (Ajan A yazar, Ajan B zorunlu çağırır).
// Para harcatmayı kod seviyesinde imkânsız kılar (CLAUDE.md §20/§23/§44).
// Gerçek implementasyon Ajan A tarafından bu sprintte doldurulur (A7).

export type SafePayloadInput = {
  kind: "create" | "update"; // update = mevcut Meta nesne ID'sine giden her çağrı
  payload: Record<string, unknown>;
  plan?: { budgetAmount: string; currency: string };
  maxDailyBudget?: string | null;
};

/**
 * create: status === "PAUSED" ZORUNLU; bütçe alanı varsa = plan.budgetAmount
 *         ve <= maxDailyBudget.
 * update: status / daily_budget / lifetime_budget / bid_amount alanları
 *         TÜMÜYLE YASAK.
 * Her iki durumda status "ACTIVE" mutlak yasak.
 */
export function assertSafePayload(input: SafePayloadInput): void {
  void input;
  throw new Error("not implemented");
}

/** Bağlantı + binding + izin var mı, workspace günlük bütçe tavanı aşılıyor mu,
 *  kullanıcı onayı verilmiş mi — hepsi tek kapıda. */
export async function assertPublishAllowed(input: {
  brandId: string;
  userId: string;
}): Promise<void> {
  void input;
  throw new Error("not implemented");
}
