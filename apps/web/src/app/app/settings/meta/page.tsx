// A5 — Meta bağlantı + varlık seçimi ekranı (HANDOFF §21.4).
// Kural: kimlik bilgileri eksikse çalışmayan buton yok — dürüst BLOCKED (CLAUDE.md §33).
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@adscore/db";
import { getCurrentUser } from "@/lib/auth";
import { metaCredentialStatus, getWebhookVerifyToken } from "@/lib/meta/env";
import { missingScopes } from "@/lib/meta/oauth";
import {
  checkMetaConnection,
  disconnectMeta,
  refreshAdAccounts,
} from "@/actions/meta";
import { MetaActionButton } from "@/components/meta/action-button";
import { BudgetCapForm } from "@/components/meta/budget-cap-form";
import { BrandBindingForm } from "@/components/meta/brand-binding-form";

export const metadata = { title: "Meta bağlantısı | AdScore" };

// SOURCES-A #8 — account_status kodlarının panel yorumu (ham kod DB'de)
const ACCOUNT_STATUS_TR: Record<number, string> = {
  1: "Aktif",
  2: "Devre dışı",
  3: "Ödenmemiş bakiye",
  7: "Risk incelemesinde",
  8: "Ödeme bekleniyor",
  9: "Ek süre",
  100: "Kapanma sürecinde",
  101: "Kapalı",
};

const STATUS_TR: Record<string, { label: string; tone: "ok" | "warn" }> = {
  CONNECTED: { label: "Bağlı", tone: "ok" },
  EXPIRED: { label: "Süresi doldu — yeniden bağlan", tone: "warn" },
  REVOKED: { label: "Meta tarafında izin kaldırıldı — yeniden bağlan", tone: "warn" },
  DISCONNECTED: { label: "Bağlantı kesildi", tone: "warn" },
};

const HATA_TR: Record<string, string> = {
  reddedildi: "Meta girişi reddedildi. Bağlanmak için izinleri onaylaman gerekir.",
  state: "Güvenlik doğrulaması (state) tutmadı. Tekrar dene; sorun sürerse tarayıcı çerezlerini kontrol et.",
  kod: "Meta'dan yetkilendirme kodu gelmedi. Tekrar dene.",
  degisim: "Token değişimi başarısız oldu. Tekrar dene; sorun sürerse App Dashboard'daki Valid OAuth Redirect URIs ayarını kontrol et.",
  dogrulama: "Token doğrulanamadı. Tekrar bağlanmayı dene.",
  env: "Meta uygulama bilgileri eksik (aşağıdaki BLOCKED kutusuna bak).",
  workspace: "Workspace bulunamadı.",
  meta: "Meta bir hata döndürdü. Tekrar dene.",
};

export default async function MetaSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.workspace) redirect("/app");
  const params = await searchParams;

  const creds = metaCredentialStatus();

  const connection = creds.ok
    ? await prisma.metaConnection.findUnique({
        where: { workspaceId: user.workspace.id },
        include: { adAccounts: { orderBy: { name: "asc" } } },
      })
    : null;
  const brands = creds.ok
    ? await prisma.brand.findMany({
        where: { workspaceId: user.workspace.id },
        select: { id: true, name: true, metaBinding: true },
        orderBy: { name: "asc" },
      })
    : [];
  const workspace = await prisma.workspace.findUnique({
    where: { id: user.workspace.id },
    select: { maxDailyBudget: true },
  });

  const hata = typeof params.meta_hata === "string" ? params.meta_hata : null;
  const eksikIzin =
    typeof params.meta_eksik_izin === "string"
      ? params.meta_eksik_izin.split(",").filter(Boolean)
      : [];
  const baglandi = params.meta_baglandi === "1";

  const missing =
    connection && connection.status === "CONNECTED"
      ? missingScopes(connection.scopes)
      : [];
  const statusInfo = connection ? STATUS_TR[connection.status] : null;

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/app/settings"
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        ← Ayarlar
      </Link>
      <h1 className="mt-2 font-display text-3xl">Meta bağlantısı</h1>

      {/* Yönlendirme sonrası mesajlar */}
      {baglandi ? (
        <div className="mt-4 rounded-xl border border-border bg-card p-4 text-sm">
          Meta hesabın bağlandı. Verilen izinler aşağıda listeleniyor.
        </div>
      ) : null}
      {eksikIzin.length > 0 ? (
        <div className="mt-4 rounded-xl border border-destructive/40 bg-card p-4 text-sm">
          Bağlantı kuruldu ama şu izinler <strong>verilmedi</strong>:{" "}
          <code className="text-xs">{eksikIzin.join(", ")}</code>. Bu izinler
          olmadan ilgili özellikler çalışmaz. Tüm izinleri vermek için yeniden
          bağlan.
        </div>
      ) : null}
      {hata ? (
        <div className="mt-4 rounded-xl border border-destructive/40 bg-card p-4 text-sm text-destructive">
          {HATA_TR[hata] ?? "Meta bağlantısında bir hata oluştu."}
        </div>
      ) : null}

      {/* A1 — kimlik bilgisi kapısı */}
      {!creds.ok ? (
        <div className="mt-6 rounded-2xl border border-destructive/40 bg-card p-6">
          <p className="text-sm font-medium text-destructive">
            BLOCKED — Meta uygulama bilgileri eksik
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Eksik: <code className="text-xs">{creds.missing.join(", ")}</code>
          </p>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>
              App Dashboard → Settings → Basic ekranından App ID ve App
              Secret değerlerini al (developers.facebook.com/apps).
            </li>
            <li>
              Değerleri <code className="text-xs">apps/web/.env.local</code>{" "}
              dosyasına kendin yaz (sohbete/koda asla):{" "}
              <code className="text-xs">META_APP_ID</code>,{" "}
              <code className="text-xs">META_APP_SECRET</code>.
            </li>
            <li>
              Token şifreleme anahtarı üret:{" "}
              <code className="text-xs">openssl rand -base64 32</code> →{" "}
              <code className="text-xs">META_TOKEN_KEY</code>.
            </li>
            <li>Dev server&apos;ı yeniden başlat.</li>
          </ol>
        </div>
      ) : (
        <>
          {/* Bağlantı durumu */}
          <div className="mt-6 rounded-2xl border border-border bg-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-medium">Bağlantı durumu</h2>
              {connection && statusInfo ? (
                <span
                  className={
                    statusInfo.tone === "ok"
                      ? "rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
                      : "rounded-full border border-destructive/40 px-3 py-1 text-xs text-destructive"
                  }
                >
                  {statusInfo.label}
                </span>
              ) : (
                <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                  Bağlı değil
                </span>
              )}
            </div>

            {connection ? (
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex gap-2">
                  <dt className="w-40 text-muted-foreground">Bağlanma tarihi</dt>
                  <dd>{connection.createdAt.toLocaleString("tr-TR")}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-40 text-muted-foreground">Son doğrulama</dt>
                  <dd>
                    {connection.lastCheckedAt
                      ? connection.lastCheckedAt.toLocaleString("tr-TR")
                      : "—"}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-40 text-muted-foreground">Token süresi</dt>
                  <dd>
                    {connection.tokenExpires
                      ? connection.tokenExpires.toLocaleString("tr-TR")
                      : "bilinmiyor"}
                  </dd>
                </div>
                {connection.errorNote ? (
                  <div className="flex gap-2">
                    <dt className="w-40 text-muted-foreground">Not</dt>
                    <dd className="text-destructive">{connection.errorNote}</dd>
                  </div>
                ) : null}
                <div className="flex gap-2">
                  <dt className="w-40 shrink-0 text-muted-foreground">
                    Verilen izinler
                  </dt>
                  <dd className="flex flex-wrap gap-1.5">
                    {connection.scopes.length > 0 ? (
                      connection.scopes.map((s) => (
                        <code
                          key={s}
                          className="rounded-full bg-muted px-2 py-0.5 text-xs"
                        >
                          {s}
                        </code>
                      ))
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </dd>
                </div>
                {missing.length > 0 ? (
                  <div className="flex gap-2">
                    <dt className="w-40 shrink-0 text-muted-foreground">
                      Eksik izinler
                    </dt>
                    <dd className="flex flex-wrap gap-1.5">
                      {missing.map((s) => (
                        <code
                          key={s}
                          className="rounded-full border border-destructive/40 px-2 py-0.5 text-xs text-destructive"
                        >
                          {s}
                        </code>
                      ))}
                    </dd>
                  </div>
                ) : null}
              </dl>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                Bu workspace&apos;e bağlı bir Meta Business hesabı yok. Bağlanınca ad
                account, Page, Instagram ve pixel seçimi burada yapılır.
              </p>
            )}

            <div className="mt-5 flex flex-wrap items-start gap-3">
              <a
                href="/api/meta/oauth/start"
                className="inline-flex items-center justify-center rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition-colors duration-300 hover:opacity-85"
              >
                {connection && connection.status === "CONNECTED"
                  ? "Yeniden bağlan"
                  : "Meta'ya bağlan"}
              </a>
              {connection && connection.status === "CONNECTED" ? (
                <>
                  <MetaActionButton
                    label="Bağlantıyı şimdi doğrula"
                    pendingLabel="Doğrulanıyor…"
                    action={checkMetaConnection}
                  />
                  <MetaActionButton
                    label="Bağlantıyı kes"
                    pendingLabel="Kesiliyor…"
                    variant="destructive"
                    action={disconnectMeta}
                    confirm="Meta bağlantısı kesilecek ve saklanan token silinecek. Devam?"
                  />
                </>
              ) : null}
            </div>
          </div>

          {/* Ad account listesi */}
          {connection && connection.status === "CONNECTED" ? (
            <div className="mt-6 rounded-2xl border border-border bg-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-medium">Ad account&apos;lar</h2>
                <MetaActionButton
                  label="Listeyi yenile"
                  pendingLabel="Meta'dan çekiliyor…"
                  action={refreshAdAccounts}
                />
              </div>
              {connection.adAccounts.length > 0 ? (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="py-2 pr-3 font-normal">Ad</th>
                        <th className="py-2 pr-3 font-normal">ID</th>
                        <th className="py-2 pr-3 font-normal">Para birimi</th>
                        <th className="py-2 font-normal">Durum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {connection.adAccounts.map((a) => (
                        <tr key={a.id} className="border-b border-border/50">
                          <td className="py-2 pr-3">{a.name}</td>
                          <td className="py-2 pr-3">
                            <code className="text-xs">{a.actId}</code>
                          </td>
                          <td className="py-2 pr-3">{a.currency}</td>
                          <td className="py-2">
                            {a.accountStatus != null
                              ? (ACCOUNT_STATUS_TR[a.accountStatus] ??
                                `kod ${a.accountStatus}`)
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Önbellek tarihi:{" "}
                    {connection.adAccounts[0].fetchedAt.toLocaleString("tr-TR")}
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  Henüz liste çekilmedi. &quot;Listeyi yenile&quot; ile Meta&apos;dan getir.
                </p>
              )}
            </div>
          ) : null}

          {/* Harcama tavanı */}
          <div className="mt-6 rounded-2xl border border-border bg-card p-6">
            <h2 className="text-sm font-medium">Harcama güvenliği</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Günlük bütçe tavanını sen belirlersin; sistem bu tavanı aşan
              hiçbir Meta nesnesi oluşturamaz. Tavan ayarlı değilse yayın hattı
              güvenlik kilidi nedeniyle kapalı kalır. Bu sprintte her kampanya
              yalnızca <strong>PAUSED</strong> (duraklatılmış) oluşturulur;
              hiçbir şey otomatik yayına girmez.
            </p>
            <BudgetCapForm
              current={workspace?.maxDailyBudget?.toString() ?? null}
            />
          </div>

          {/* Marka bağlama */}
          {connection && connection.status === "CONNECTED" ? (
            <div className="mt-6 rounded-2xl border border-border bg-card p-6">
              <h2 className="text-sm font-medium">Marka ↔ Meta varlıkları</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Her marka bir ad account + Facebook Page ile çalışır (Page
                zorunlu — reklam creative&apos;i Page olmadan oluşturulamaz).
                Instagram hesabı ve pixel opsiyoneldir.
              </p>
              {brands.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Henüz marka yok.{" "}
                  <Link href="/app/brands" className="underline">
                    Marka oluştur →
                  </Link>
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {brands.map((b) => (
                    <BrandBindingForm
                      key={b.id}
                      brandId={b.id}
                      brandName={b.name}
                      adAccounts={connection.adAccounts.map((a) => ({
                        actId: a.actId,
                        name: a.name,
                        currency: a.currency,
                      }))}
                      binding={
                        b.metaBinding
                          ? {
                              adAccountId: b.metaBinding.adAccountId,
                              pageId: b.metaBinding.pageId,
                              instagramActorId: b.metaBinding.instagramActorId,
                              pixelId: b.metaBinding.pixelId,
                            }
                          : null
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {/* Webhook bilgisi */}
          <div className="mt-6 rounded-2xl border border-border bg-card p-6">
            <h2 className="text-sm font-medium">Webhook / geri çağrılar</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Uygulamanın izni Meta tarafından kaldırılırsa bağlantı burada
              otomatik &quot;izin kaldırıldı&quot; durumuna düşer. Bunun için App
              Dashboard&apos;da Deauthorize / Data Deletion URL&apos;lerinin ayarlı olması
              gerekir{" "}
              {getWebhookVerifyToken()
                ? "(webhook doğrulama token&apos;ı ayarlı)."
                : "— ve META_WEBHOOK_VERIFY_TOKEN henüz ayarlı değil."}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
