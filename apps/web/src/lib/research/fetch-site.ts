import "server-only";

const MAX_BYTES = 1_500_000;
const TIMEOUT_MS = 15_000;
const MAX_TEXT_CHARS = 14_000;

export type SiteFetchResult = {
  url: string;
  httpStatus: number;
  title: string | null;
  description: string | null;
  text: string;
};

// SSRF koruması: kullanıcı girdisi URL server'dan fetch ediliyor.
// Private/loopback/link-local hedefler ve standart dışı portlar reddedilir.
function assertSafeUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Geçersiz URL.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Yalnızca http/https URL desteklenir.");
  }
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new Error("Standart dışı portlara istek yapılmaz.");
  }
  const host = url.hostname.toLowerCase();
  const privatePatterns = [
    /^localhost$/,
    /^127\./,
    /^0\./,
    /^10\./,
    /^192\.168\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^169\.254\./,
    /^\[?::1\]?$/,
    /^\[?f[cd][0-9a-f]{2}:/,
    /^\[?fe80:/,
  ];
  if (privatePatterns.some((p) => p.test(host)) || !host.includes(".")) {
    throw new Error("Bu adrese erişime izin verilmiyor.");
  }
  return url;
}

function htmlToText(html: string): {
  title: string | null;
  description: string | null;
  text: string;
} {
  const title = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() ?? null;
  const description =
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i.exec(
      html,
    )?.[1]?.trim() ??
    /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i.exec(
      html,
    )?.[1]?.trim() ??
    null;

  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(br|p|div|li|h[1-6]|tr|section|article)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();

  return { title, description, text: text.slice(0, MAX_TEXT_CHARS) };
}

export async function fetchWebsiteText(raw: string): Promise<SiteFetchResult> {
  const url = assertSafeUrl(raw);
  const response = await fetch(url, {
    headers: {
      "user-agent": "AdScoreResearchBot/0.1 (+brand research; user-initiated)",
      accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok) {
    throw new Error(`Site yanıt vermedi (HTTP ${response.status}).`);
  }
  if (!contentType.includes("text/html") && !contentType.includes("xml")) {
    throw new Error(`Beklenmeyen içerik türü: ${contentType || "bilinmiyor"}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("Site içeriği okunamadı.");
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    chunks.push(value);
    if (received >= MAX_BYTES) {
      reader.cancel().catch(() => {});
      break;
    }
  }
  const html = new TextDecoder("utf-8", { fatal: false }).decode(
    concat(chunks),
  );
  const { title, description, text } = htmlToText(html);
  if (text.length < 200) {
    throw new Error(
      "Sitenin metin içeriği çok az (muhtemelen JavaScript ile render ediliyor). Bu sürüm yalnızca statik HTML okuyabiliyor.",
    );
  }
  return { url: url.toString(), httpStatus: response.status, title, description, text };
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}
