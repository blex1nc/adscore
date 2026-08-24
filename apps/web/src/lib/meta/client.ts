import "server-only";

// META İSTEMCİSİ — CONTRACTS.md §4 imzaları (t=0'da sabitlendi; imza DEĞİŞMEDİ).
// B ve C doğrudan fetch ile Meta'ya çağrı YAPMAZ; yalnız bu istemciyi kullanır.
// Kurallar (A4): tek sürüm sabiti, tek fetch noktası, timeout, sayfalama,
// hata haritası (TR mesaj + aksiyon), yalnız geçici hatalarda retry
// (yazmada idempotencyKey yoksa retry YOK), her çağrı MetaApiCall'a yazılır,
// URL query / token / app secret ASLA loglanmaz.
import { createHmac } from "node:crypto";
import { prisma } from "@adscore/db";
import {
  mapMetaError,
  parseUsagePct,
  type MetaErrorBody,
} from "./error-map";

// API sürümü TEK yerde sabittir; B ve C kendi dosyalarında sürüm yazmaz.
// Kaynak: SOURCES-A.md #1 (Graph API changelog, retrieved 2026-08-24).
export const META_API_VERSION = "v26.0";

const GRAPH_BASE = "https://graph.facebook.com";
const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_RETRIES = 2; // yalnız geçici hatalarda; toplam 3 deneme
const DEFAULT_MAX_PAGES = 10;

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

// ---------------------------------------------------------------------------
// İç kurulum
// ---------------------------------------------------------------------------

type ClientContext = {
  token: string;
  appSecret: string;
  workspaceId: string;
  connectionId: string;
};

/** path temizliği: sürüm öneki ve query asla kayda girmez. */
function cleanPath(path: string): string {
  const noQuery = path.split("?")[0];
  return noQuery.startsWith("/") ? noQuery : `/${noQuery}`;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function recordCall(entry: {
  workspaceId: string;
  brandId?: string;
  method: string;
  path: string;
  httpStatus: number | null;
  errorCode: number | null;
  errorSub: number | null;
  fbtraceId: string | null;
  durationMs: number;
  appUsagePct: number | null;
}) {
  try {
    await prisma.metaApiCall.create({
      data: {
        workspaceId: entry.workspaceId,
        brandId: entry.brandId ?? null,
        method: entry.method,
        path: entry.path,
        httpStatus: entry.httpStatus,
        errorCode: entry.errorCode,
        errorSub: entry.errorSub,
        fbtraceId: entry.fbtraceId,
        durationMs: entry.durationMs,
        appUsagePct: entry.appUsagePct,
      },
    });
  } catch {
    // sayaç yazılamazsa çağrının kendisi bozulmaz (teşhis verisi)
  }
}

/** TEK fetch noktası. Token her zaman appsecret_proof ile gider (SOURCES-A #7). */
async function rawCall<T>(
  ctx: ClientContext,
  method: "GET" | "POST",
  path: string,
  params: Record<string, string | number>,
  body: Record<string, unknown> | null,
  opts: MetaCallOptions,
): Promise<T & { paging?: { cursors?: { after?: string }; next?: string } }> {
  const proof = createHmac("sha256", ctx.appSecret)
    .update(ctx.token)
    .digest("hex");
  const rel = path.startsWith("/") ? path.slice(1) : path;
  // Sürüm öneki path'te yazılmaz; tek yerden eklenir. debug_token gibi
  // sürümsüz uçlar için path "debug_token" olarak verilebilir — yine sürümlü çalışır.
  const url = new URL(`${GRAPH_BASE}/${META_API_VERSION}/${rel}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }

  const init: RequestInit = {
    method,
    signal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  };
  if (method === "GET") {
    url.searchParams.set("access_token", ctx.token);
    url.searchParams.set("appsecret_proof", proof);
  } else {
    // Yazmada token URL'e girmez; form gövdesinde taşınır.
    // Graph API form alanları bekler; nesne/dizi değerler JSON string olarak gider.
    const form = new URLSearchParams();
    for (const [k, v] of Object.entries(body ?? {})) {
      if (v === undefined || v === null) continue;
      form.set(k, typeof v === "string" ? v : JSON.stringify(v));
    }
    form.set("access_token", ctx.token);
    form.set("appsecret_proof", proof);
    init.body = form;
    init.headers = { "content-type": "application/x-www-form-urlencoded" };
  }

  const started = Date.now();
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    await recordCall({
      workspaceId: ctx.workspaceId,
      brandId: opts.brandId,
      method,
      path: cleanPath(path),
      httpStatus: null,
      errorCode: null,
      errorSub: null,
      fbtraceId: null,
      durationMs: Date.now() - started,
      appUsagePct: null,
    });
    const timedOut = e instanceof Error && e.name === "TimeoutError";
    throw new MetaApiError({
      message: timedOut ? "Meta çağrısı zaman aşımına uğradı" : "Meta'ya ulaşılamadı",
      code: -1,
      httpStatus: 0,
      isTransient: true,
      userMessage: timedOut
        ? "Meta çağrısı zaman aşımına uğradı. Tekrar dene."
        : "Meta'ya ulaşılamadı (ağ hatası). Bağlantını kontrol edip tekrar dene.",
    });
  }

  const usagePct = parseUsagePct({
    appUsage: res.headers.get("x-app-usage"),
    adAccountUsage: res.headers.get("x-ad-account-usage"),
    bucUsage: res.headers.get("x-business-use-case-usage"),
  });
  const json = (await res.json().catch(() => null)) as
    | (T & { error?: MetaErrorBody })
    | null;
  const errBody = json && "error" in (json as object) ? json.error : undefined;

  await recordCall({
    workspaceId: ctx.workspaceId,
    brandId: opts.brandId,
    method,
    path: cleanPath(path),
    httpStatus: res.status,
    errorCode: errBody?.code ?? null,
    errorSub: errBody?.error_subcode ?? null,
    fbtraceId: errBody?.fbtrace_id ?? null,
    durationMs: Date.now() - started,
    appUsagePct: usagePct,
  });

  if (!res.ok || errBody) {
    const mapped = mapMetaError(res.status, errBody);
    if (mapped.isAuth) {
      // Token geçersiz → bağlantı dürüstçe EXPIRED işaretlenir (sessiz kırık yok).
      // Dinamik import: token-store ↔ client döngüsel bağımlılığını kırar.
      import("./token-store")
        .then((m) => m.markExpired(ctx.connectionId, mapped.userMessage))
        .catch(() => {});
    }
    throw new MetaApiError({
      // Teknik mesaj: Meta'nın kendi mesajı (token/URL içermez)
      message: errBody?.message ?? `Meta HTTP ${res.status}`,
      code: mapped.code,
      subcode: mapped.subcode,
      type: mapped.type,
      fbtraceId: mapped.fbtraceId,
      httpStatus: mapped.httpStatus,
      isRateLimit: mapped.isRateLimit,
      isPermission: mapped.isPermission,
      isTransient: mapped.isTransient,
      userMessage: mapped.userMessage,
    });
  }
  if (json === null) {
    throw new MetaApiError({
      message: "Meta boş/geçersiz JSON döndürdü",
      code: -1,
      httpStatus: res.status,
      isTransient: true,
      userMessage: "Meta geçersiz bir cevap döndürdü. Tekrar dene.",
    });
  }
  return json;
}

/** Retry sarmalayıcı: yalnız geçici hatalar; yazmada idempotencyKey şart (A4).
 *  Not: Meta Graph API'de doğrulanmış bir idempotency başlığı yok — anahtar
 *  Meta'ya GÖNDERİLMEZ, yalnız "tekrar güvenli" beyanı olarak retry'ı açar. */
async function withRetry<T>(
  fn: () => Promise<T>,
  canRetry: boolean,
): Promise<T> {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn();
    } catch (e) {
      const transient = e instanceof MetaApiError && e.isTransient;
      if (!canRetry || !transient || attempt >= MAX_RETRIES) throw e;
      // Üstel backoff + jitter: 500ms, 1500ms (+0–250ms)
      await sleep(500 * 3 ** attempt + Math.random() * 250);
      attempt += 1;
    }
  }
}

function buildClient(ctx: ClientContext): MetaClient {
  return {
    get<T>(
      path: string,
      params: Record<string, string | number> = {},
      opts: MetaCallOptions = {},
    ): Promise<T> {
      return withRetry(() => rawCall<T>(ctx, "GET", path, params, null, opts), true);
    },
    post<T>(
      path: string,
      body: Record<string, unknown>,
      opts: MetaCallOptions = {},
    ): Promise<T> {
      return withRetry(
        () => rawCall<T>(ctx, "POST", path, {}, body, opts),
        Boolean(opts.idempotencyKey),
      );
    },
    async paginate<T>(
      path: string,
      params: Record<string, string | number> = {},
      opts: MetaCallOptions & { maxPages?: number } = {},
    ): Promise<T[]> {
      const maxPages = opts.maxPages ?? DEFAULT_MAX_PAGES;
      const out: T[] = [];
      let after: string | undefined;
      for (let page = 0; page < maxPages; page += 1) {
        const pageParams = { ...params, ...(after ? { after } : {}) };
        const res = await withRetry(
          () =>
            rawCall<{ data?: T[] }>(ctx, "GET", path, pageParams, null, opts),
          true,
        );
        if (Array.isArray(res.data)) out.push(...res.data);
        // paging.next tam URL'dir (token içerir) — takip için yalnız cursor kullanılır,
        // URL loglanmaz ve dışarı sızmaz.
        after = res.paging?.cursors?.after;
        if (!res.paging?.next || !after) break;
      }
      return out;
    },
  };
}

// ---------------------------------------------------------------------------
// Dışa açık kurucular (CONTRACTS §4)
// ---------------------------------------------------------------------------

/** Workspace'in bağlantısını çözer, token'ı deşifre eder, istemciyi kurar.
 *  Bağlantı yok / EXPIRED / REVOKED ise MetaBlockedError fırlatır. */
export async function metaClientForWorkspace(
  workspaceId: string
): Promise<MetaClient> {
  const { getMetaAppCredentials } = await import("./env");
  const creds = getMetaAppCredentials();
  if (!creds) {
    throw new MetaBlockedError({
      reason: "NO_APP_CREDENTIALS",
      missing: ["META_APP_ID", "META_APP_SECRET"].filter(
        (k) => !process.env[k],
      ),
      userMessage:
        "Meta uygulama bilgileri eksik (.env.local). Ayarlar → Meta bağlantısı ekranındaki adımları izle.",
    });
  }
  const { requireConnection, getAccessToken } = await import("./token-store");
  const conn = await requireConnection(workspaceId);
  const token = await getAccessToken(workspaceId);
  return buildClient({
    token,
    appSecret: creds.appSecret,
    workspaceId,
    connectionId: conn.id,
  });
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
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: { workspaceId: true, metaBinding: true },
  });
  if (!brand) {
    throw new MetaBlockedError({
      reason: "NO_BINDING",
      missing: ["brand"],
      userMessage: "Marka bulunamadı.",
    });
  }
  const b = brand.metaBinding;
  const missing: string[] = [];
  if (!b) {
    missing.push("ad account", "Facebook Page");
  } else {
    if (!b.adAccountId) missing.push("ad account");
    if (!b.pageId) missing.push("Facebook Page");
  }
  if (!b || missing.length > 0) {
    throw new MetaBlockedError({
      reason: "NO_BINDING",
      missing,
      userMessage: `Bu marka için Meta varlıkları seçilmemiş (eksik: ${missing.join(
        ", ",
      )}). Ayarlar → Meta bağlantısı ekranından markayı bir ad account ve Page'e bağla.`,
    });
  }
  const client = await metaClientForWorkspace(brand.workspaceId);
  return {
    client,
    adAccountId: b.adAccountId,
    pageId: b.pageId,
    instagramActorId: b.instagramActorId,
    pixelId: b.pixelId,
    currency: b.adAccountCurrency,
  };
}
