// A7 — assertSafePayload'un SAF çekirdeği (DB yok, env yok → birim test edilir).
// Kural kaynağı: AGENT-A.md §4/A7 + CONTRACTS §4.
// Bütçe birimleri: Meta bütçeleri ad account para biriminin MİNÖR birimindedir
// (TRY/USD için kuruş/cent, offset 100); offset-1 para birimlerinde tam birim.
// Kaynak: SOURCES-A.md #18 (retrieved 2026-08-24).

export type SafePayloadInput = {
  kind: "create" | "update";              // update = mevcut Meta nesne ID'sine giden her çağrı
  payload: Record<string, unknown>;
  plan?: { budgetAmount: string; currency: string };
  maxDailyBudget?: string | null;
};

export class MetaGuardError extends Error {
  userMessage: string;
  constructor(userMessage: string) {
    super(userMessage);
    this.name = "MetaGuardError";
    this.userMessage = userMessage;
  }
}

// Minör birimi olmayan para birimleri (offset 1) — SOURCES-A #18
const OFFSET_ONE = new Set([
  "CLP", "COP", "CRC", "HUF", "ISK", "IDR", "JPY", "KRW", "PYG", "TWD", "VND",
]);

const BUDGET_FIELDS = ["daily_budget", "lifetime_budget"] as const;
const UPDATE_FORBIDDEN = [
  "status",
  "daily_budget",
  "lifetime_budget",
  "bid_amount",
] as const;

/** "350.75" + "TRY" → 35075 (float kullanılmaz; kesin ondalık ayrıştırma). */
export function toMinorUnits(amount: string, currency: string): number {
  const trimmed = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new MetaGuardError(`Bütçe tutarı sayısal değil: "${amount}"`);
  }
  const offsetOne = OFFSET_ONE.has(currency.toUpperCase());
  const [whole, frac = ""] = trimmed.split(".");
  if (offsetOne) {
    if (/[1-9]/.test(frac)) {
      throw new MetaGuardError(
        `${currency} kuruş/cent içermez; bütçe tam birim olmalı (gelen: ${amount}).`,
      );
    }
    return Number(whole);
  }
  if (frac.length > 2 && /[1-9]/.test(frac.slice(2))) {
    throw new MetaGuardError(
      `Bütçe en fazla 2 ondalık basamak içerebilir (gelen: ${amount}).`,
    );
  }
  return Number(whole) * 100 + Number((frac + "00").slice(0, 2) || "0");
}

/** Payload'ın herhangi bir derinliğinde "status": "ACTIVE" var mı? */
function findActiveStatus(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(findActiveStatus);
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (k === "status" && typeof v === "string" && v.toUpperCase() === "ACTIVE") {
        return true;
      }
      if (findActiveStatus(v)) return true;
    }
  }
  return false;
}

export function assertSafePayloadCore(input: SafePayloadInput): void {
  const { kind, payload } = input;

  // Her iki durumda: ACTIVE mutlak yasak (iç içe alanlar dahil).
  if (findActiveStatus(payload)) {
    throw new MetaGuardError(
      "Güvenlik kilidi: payload'da status ACTIVE bulundu. Bu sprintte hiçbir Meta nesnesi ACTIVE edilemez; her şey PAUSED oluşturulur.",
    );
  }

  if (kind === "update") {
    // Mevcut Meta nesnesine giden çağrıda bu alanlar TÜMÜYLE yasak.
    const present = UPDATE_FORBIDDEN.filter((f) => f in payload);
    if (present.length > 0) {
      throw new MetaGuardError(
        `Güvenlik kilidi: mevcut Meta nesnesinde şu alanlar değiştirilemez: ${present.join(
          ", ",
        )}. Durum/bütçe/teklif değişikliği bu sprintte kapalıdır.`,
      );
    }
    return;
  }

  // kind === "create"
  const status = payload.status;
  if (status !== "PAUSED") {
    throw new MetaGuardError(
      `Güvenlik kilidi: yeni Meta nesnesi yalnız status "PAUSED" ile oluşturulabilir (gelen: ${
        typeof status === "string" ? `"${status}"` : "yok"
      }).`,
    );
  }

  const budgetFields = BUDGET_FIELDS.filter((f) => f in payload);
  for (const field of budgetFields) {
    const rawValue = payload[field];
    const value = Number(rawValue);
    if (!Number.isInteger(value) || value <= 0) {
      throw new MetaGuardError(
        `Güvenlik kilidi: ${field} minör birimde pozitif tamsayı olmalı (gelen: ${String(
          rawValue,
        )}).`,
      );
    }
    if (!input.plan) {
      throw new MetaGuardError(
        `Güvenlik kilidi: ${field} gönderiliyor ama onaylı plan bütçesi verilmedi. Bütçeli nesne yalnız kullanıcının onayladığı plana karşı doğrulanarak oluşturulabilir.`,
      );
    }
    const planMinor = toMinorUnits(input.plan.budgetAmount, input.plan.currency);
    if (value !== planMinor) {
      throw new MetaGuardError(
        `Güvenlik kilidi: ${field} (${value}) kullanıcının onayladığı plan bütçesine (${planMinor} minör birim = ${input.plan.budgetAmount} ${input.plan.currency}) eşit değil.`,
      );
    }
    if (input.maxDailyBudget == null) {
      throw new MetaGuardError(
        "Güvenlik kilidi: workspace günlük bütçe tavanı ayarlanmamış. Tavanı kullanıcı belirler (Ayarlar → Meta bağlantısı); tavan olmadan bütçeli nesne oluşturulamaz.",
      );
    }
    const capMinor = toMinorUnits(input.maxDailyBudget, input.plan.currency);
    if (value > capMinor) {
      throw new MetaGuardError(
        `Güvenlik kilidi: bütçe (${value} minör birim) workspace tavanını (${capMinor} minör birim) aşıyor. Tavanı kullanıcı yükseltmeden yayın yapılamaz.`,
      );
    }
  }
}
