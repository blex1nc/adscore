// A4 — Meta hata haritası (saf fonksiyon, birim test edilir).
// Kod sınıflandırması resmi dokümandan: SOURCES-A #16, #17 (retrieved 2026-08-24).
//   Geçici: 1, 2, 341, 368 + HTTP 5xx
//   Rate limit (aynı zamanda geçici): 4, 17, 32, 613, 80000–80006, HTTP 429
//   İzin: 10, 200–299
//   Token/oturum: 102, 190

export type MetaErrorBody = {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  error_user_title?: string;
  error_user_msg?: string;
  fbtrace_id?: string;
};

export type MappedMetaError = {
  code: number;
  subcode: number | null;
  type: string | null;
  fbtraceId: string | null;
  httpStatus: number;
  isRateLimit: boolean;
  isPermission: boolean;
  isTransient: boolean;
  isAuth: boolean; // 102/190 — yeniden bağlanma gerekir
  userMessage: string; // TR + aksiyon (CLAUDE.md §42)
};

const RATE_LIMIT_CODES = new Set([4, 17, 32, 613]);
const TRANSIENT_CODES = new Set([1, 2, 341, 368]);
const AUTH_CODES = new Set([102, 190]);

export function mapMetaError(
  httpStatus: number,
  body: MetaErrorBody | null | undefined,
): MappedMetaError {
  const code = body?.code ?? -1;
  const isBuc = code >= 80000 && code <= 80006;
  const isRateLimit =
    httpStatus === 429 || RATE_LIMIT_CODES.has(code) || isBuc;
  const isPermission = code === 10 || (code >= 200 && code <= 299);
  const isAuth = AUTH_CODES.has(code);
  const isTransient =
    isRateLimit || TRANSIENT_CODES.has(code) || httpStatus >= 500;

  let userMessage: string;
  if (isAuth) {
    userMessage =
      "Meta oturumu geçersiz veya süresi dolmuş. Ayarlar → Meta bağlantısı ekranından yeniden bağlan.";
  } else if (isRateLimit) {
    userMessage =
      "Meta çağrı limiti aşıldı (geliştirme erişiminde limitler sıkı). Bir süre bekleyip tekrar dene; sorun sürerse Ayarlar → Meta bağlantısı ekranındaki kullanım göstergesine bak.";
  } else if (isPermission) {
    userMessage =
      "Meta bu işlem için izin vermedi. Ayarlar → Meta bağlantısı ekranından verilen izinleri kontrol et; eksik izin varsa yeniden bağlanırken onayla.";
  } else if (isTransient) {
    userMessage =
      "Meta tarafında geçici bir sorun oluştu. Birkaç dakika sonra tekrar dene.";
  } else {
    const detail = body?.error_user_msg || body?.message;
    userMessage = detail
      ? `Meta hatası: ${detail}`
      : `Meta beklenmeyen bir hata döndürdü (HTTP ${httpStatus}).`;
  }

  return {
    code,
    subcode: body?.error_subcode ?? null,
    type: body?.type ?? null,
    fbtraceId: body?.fbtrace_id ?? null,
    httpStatus,
    isRateLimit,
    isPermission,
    isTransient,
    isAuth,
    userMessage,
  };
}

/** Rate limit başlıklarından en yüksek kullanım yüzdesi (SOURCES-A #16).
 *  X-App-Usage: {call_count,total_time,total_cputime}
 *  X-Ad-Account-Usage: {acc_id_util_pct,...}
 *  X-Business-Use-Case-Usage: {"<business_id>":[{call_count,...}]} */
export function parseUsagePct(headers: {
  appUsage?: string | null;
  adAccountUsage?: string | null;
  bucUsage?: string | null;
}): number | null {
  const values: number[] = [];
  const collect = (obj: unknown) => {
    if (obj == null) return;
    if (typeof obj === "number" && Number.isFinite(obj)) {
      values.push(obj);
    } else if (Array.isArray(obj)) {
      obj.forEach(collect);
    } else if (typeof obj === "object") {
      for (const [k, v] of Object.entries(obj)) {
        if (
          [
            "call_count",
            "total_time",
            "total_cputime",
            "acc_id_util_pct",
          ].includes(k)
        ) {
          collect(v);
        } else if (typeof v === "object") {
          collect(v);
        }
      }
    }
  };
  for (const raw of [
    headers.appUsage,
    headers.adAccountUsage,
    headers.bucUsage,
  ]) {
    if (!raw) continue;
    try {
      collect(JSON.parse(raw));
    } catch {
      // başlık parse edilemezse yok sayılır — teşhis verisi, kritik yol değil
    }
  }
  if (values.length === 0) return null;
  return Math.round(Math.max(...values));
}
