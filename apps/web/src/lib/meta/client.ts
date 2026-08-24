import "server-only";

// META İSTEMCİSİ — CONTRACTS.md §4 (t=0'da sabitlenen imza).
// B ve C doğrudan fetch ile Meta'ya çağrı YAPMAZ; yalnız bu istemciyi kullanır.
// Gerçek implementasyon Ajan A tarafından bu sprintte doldurulur (A4).
// İmza değişikliği yalnız docs/meta/REPORT-A.md'de duyurularak yapılır.

// API sürümü TEK yerde sabittir; B ve C kendi dosyalarında sürüm yazmaz.
// Kaynak: SOURCES-A.md #1 (Graph API changelog, retrieved 2026-08-24).
export const META_API_VERSION = "v26.0";

export type MetaCallOptions = {
  brandId?: string;          // maliyet kaydı + ad account bağlamı
  timeoutMs?: number;        // varsayılan 20_000
  idempotencyKey?: string;   // yazma çağrılarında tekrarı engellemek için
};

export interface MetaClient {
  get<T>(
    path: string,
    params?: Record<string, string | number>,
    opts?: MetaCallOptions
  ): Promise<T>;
  post<T>(
    path: string,
    body: Record<string, unknown>,
    opts?: MetaCallOptions
  ): Promise<T>;
  /** Sayfalama: Meta'nın paging.next zinciri; hard limit çağıranda. */
  paginate<T>(
    path: string,
    params?: Record<string, string | number>,
    opts?: MetaCallOptions & { maxPages?: number }
  ): Promise<T[]>;
}

export class MetaApiError extends Error {
  code: number;
  subcode: number | null;
  type: string | null;
  fbtraceId: string | null;
  httpStatus: number;
  isRateLimit: boolean;
  isPermission: boolean;
  isTransient: boolean;
  /** Kullanıcıya gösterilecek TR mesaj + önerilen aksiyon (CLAUDE.md §42). */
  userMessage: string;

  constructor(input: {
    message: string;
    code: number;
    subcode?: number | null;
    type?: string | null;
    fbtraceId?: string | null;
    httpStatus: number;
    isRateLimit?: boolean;
    isPermission?: boolean;
    isTransient?: boolean;
    userMessage: string;
  }) {
    super(input.message);
    this.name = "MetaApiError";
    this.code = input.code;
    this.subcode = input.subcode ?? null;
    this.type = input.type ?? null;
    this.fbtraceId = input.fbtraceId ?? null;
    this.httpStatus = input.httpStatus;
    this.isRateLimit = input.isRateLimit ?? false;
    this.isPermission = input.isPermission ?? false;
    this.isTransient = input.isTransient ?? false;
    this.userMessage = input.userMessage;
  }
}

export type MetaBlockedReason =
  | "NO_CONNECTION"
  | "TOKEN_EXPIRED"
  | "REVOKED"
  | "NO_BINDING"
  | "MISSING_PERMISSION"
  | "NO_APP_CREDENTIALS";

/** Bağlantı/izin/varlık eksikliği — hata değil, dürüst kapı. UI "BLOCKED" gösterir. */
export class MetaBlockedError extends Error {
  reason: MetaBlockedReason;
  missing?: string[];      // eksik izin/varlık adları
  userMessage: string;     // TR

  constructor(input: {
    reason: MetaBlockedReason;
    missing?: string[];
    userMessage: string;
  }) {
    super(input.userMessage);
    this.name = "MetaBlockedError";
    this.reason = input.reason;
    this.missing = input.missing;
    this.userMessage = input.userMessage;
  }
}

/** Workspace'in bağlantısını çözer, token'ı deşifre eder, istemciyi kurar.
 *  Bağlantı yok / EXPIRED / REVOKED ise MetaBlockedError fırlatır. */
export async function metaClientForWorkspace(
  workspaceId: string
): Promise<MetaClient> {
  void workspaceId;
  throw new Error("not implemented");
}

/** Markanın bağlı varlıkları; eksikse MetaBlockedError (hangi varlık eksik yazar). */
export async function requireBrandBinding(brandId: string): Promise<{
  client: MetaClient;
  adAccountId: string;   // "act_..."
  pageId: string;
  instagramActorId: string | null;
  pixelId: string | null;
  currency: string;
}> {
  void brandId;
  throw new Error("not implemented");
}
