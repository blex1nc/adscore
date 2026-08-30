// C3 — Meta API kullanım ve maliyet paneli (AGENT-C.md §3).
// Yalnız SAYILAN gerçekler: MetaApiCall kayıtları (Ajan A'nın istemcisi yazar).
// Uydurma maliyet tahmini yok; kayıt yoksa dürüst boş durum.
// Full Access bağlamı: son 15 günde ≥500 başarılı çağrı + hata oranı <%15
// (PHASE0 §1.1) — panel bu iki ölçümü gösterir.

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@adscore/db";
import { getCurrentUser } from "@/lib/auth";
import { cn } from "@/components/ui";

export const metadata = { title: "Meta API kullanımı | AdScore" };

function isSuccess(call: { httpStatus: number | null; errorCode: number | null }) {
  return (
    call.errorCode == null &&
    call.httpStatus != null &&
    call.httpStatus >= 200 &&
    call.httpStatus < 400
  );
}

function pct(n: number, d: number): string {
  if (d === 0) return "-";
  return `%${((n / d) * 100).toFixed(1)}`;
}

export default async function MetaUsagePage() {
  const user = await getCurrentUser();
  if (!user?.workspace) redirect("/login");

  const now = new Date().getTime();
  const day = 86_400_000;
  const since15d = new Date(now - 15 * day);
  const since24h = new Date(now - day);

  const calls = await prisma.metaApiCall.findMany({
    where: { workspaceId: user.workspace.id, createdAt: { gte: since15d } },
    orderBy: { createdAt: "desc" },
  });

  const last24h = calls.filter((c) => c.createdAt >= since24h);
  const ok24h = last24h.filter(isSuccess).length;
  const err24h = last24h.length - ok24h;
  const ok15d = calls.filter(isSuccess).length;
  const err15d = calls.length - ok15d;
  const latestUsage = last24h.find((c) => c.appUsagePct != null)?.appUsagePct ?? null;
  const recent = calls.slice(0, 20);

  return (
    <div className="mx-auto w-full max-w-4xl">
      <Link
        href="/app/settings"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Ayarlar
      </Link>
      <h1 className="mt-2 text-xl font-semibold tracking-tight">Meta API kullanımı</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Yalnız kaydedilen gerçek çağrılar sayılır; tahmin üretilmez. Rate limit
        doluluğu Meta&apos;nın kendi kullanım başlıklarından okunur.
      </p>

      {calls.length === 0 ? (
        <div className="mt-6 rounded-lg border border-border-soft bg-panel shadow-card p-6 text-sm text-muted-foreground">
          Son 15 günde kayıtlı Meta API çağrısı yok. Çağrılar Meta bağlantısı
          kurulup senkron/yayın işlemleri çalıştıkça burada birikir.
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-border-soft bg-panel shadow-card p-5">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Son 24 saat
              </div>
              <div className="mt-1 text-2xl font-medium">{last24h.length}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                çağrı · {err24h} hata ({pct(err24h, last24h.length)})
              </div>
            </div>
            <div className="rounded-lg border border-border-soft bg-panel shadow-card p-5">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Rate limit doluluğu
              </div>
              <div className="mt-1 text-2xl font-medium">
                {latestUsage != null ? `%${latestUsage}` : "-"}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {latestUsage != null
                  ? "Son çağrının X-App-Usage / X-Ad-Account-Usage değeri"
                  : "Son 24 saatte kullanım başlığı içeren çağrı yok"}
              </div>
            </div>
            <div className="rounded-lg border border-border-soft bg-panel shadow-card p-5">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Son 15 gün
              </div>
              <div className="mt-1 text-2xl font-medium">{ok15d}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                başarılı çağrı · hata oranı {pct(err15d, calls.length)}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-border-soft bg-panel shadow-card p-5 text-sm">
            <h2 className="text-sm font-medium">Full Access hazırlığı</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Meta&apos;nın Full Access şartı: son 15 günde ≥500 başarılı çağrı ve
              hata oranı &lt;%15 (+ App Review). Bu panel yalnız ölçer; başvuru
              ayrı süreçtir.
            </p>
            <ul className="mt-3 space-y-1 text-xs">
              <li>
                Başarılı çağrı: <span className="font-medium">{ok15d} / 500</span>{" "}
                {ok15d >= 500 ? "· eşik karşılanıyor" : "· eşiğin altında"}
              </li>
              <li>
                Hata oranı:{" "}
                <span className="font-medium">{pct(err15d, calls.length)}</span>{" "}
                {calls.length > 0 && err15d / calls.length < 0.15
                  ? "· %15 sınırının altında"
                  : "· %15 sınırının üzerinde"}
              </li>
            </ul>
          </div>

          <div className="mt-4 rounded-lg border border-border-soft bg-panel shadow-card p-5">
            <h2 className="text-sm font-medium">Son çağrılar</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-3">Zaman</th>
                    <th className="py-1 pr-3">Yöntem</th>
                    <th className="py-1 pr-3">Uç</th>
                    <th className="py-1 pr-3">Durum</th>
                    <th className="py-1 pr-3">Süre</th>
                    <th className="py-1">Kullanım</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((c) => (
                    <tr key={c.id} className="border-t border-border-soft">
                      <td className="py-1.5 pr-3 whitespace-nowrap">
                        {c.createdAt.toLocaleString("tr-TR")}
                      </td>
                      <td className="py-1.5 pr-3">{c.method}</td>
                      <td className="max-w-56 truncate py-1.5 pr-3" title={c.path}>
                        {c.path}
                      </td>
                      <td
                        className={cn(
                          "py-1.5 pr-3",
                          !isSuccess(c) && "text-destructive",
                        )}
                      >
                        {c.httpStatus ?? "-"}
                        {c.errorCode != null ? ` (kod ${c.errorCode})` : ""}
                      </td>
                      <td className="py-1.5 pr-3">{c.durationMs} ms</td>
                      <td className="py-1.5">
                        {c.appUsagePct != null ? `%${c.appUsagePct}` : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
