import { prisma } from "@adscore/db";
import { revokeInvite } from "@/actions/admin";
import { Button } from "@/components/ui";
import { CopyInviteLink } from "./copy-invite-link";
import { InviteForm } from "./invite-form";

export const metadata = { title: "Admin | AdScore" };

export default async function AdminPage() {
  const [invitations, users] = await Promise.all([
    prisma.invitation.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { workspace: { include: { _count: { select: { brands: true } } } } },
    }),
  ]);
  const now = new Date();

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-3xl">Admin</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Onboarding davetle çalışıyor; self-serve signup kapalı.
      </p>

      <div className="mt-6 rounded-2xl border border-border bg-card p-6">
        <h2 className="text-sm font-medium">Davet oluştur</h2>
        <InviteForm />
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3 text-sm font-medium">
          Davetler
        </div>
        {invitations.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            Henüz davet yok.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">E-posta</th>
                <th className="px-4 py-3 font-medium">Durum</th>
                <th className="px-4 py-3 font-medium">Son geçerlilik</th>
                <th className="px-4 py-3 font-medium">Link</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {invitations.map((inv) => {
                const status = inv.usedAt
                  ? "Kullanıldı"
                  : inv.expiresAt < now
                    ? "Süresi doldu"
                    : "Bekliyor";
                return (
                  <tr
                    key={inv.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-3">{inv.email ?? "Serbest"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {status}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {inv.expiresAt.toLocaleDateString("tr-TR")}
                    </td>
                    <td className="px-4 py-3">
                      {status === "Bekliyor" ? (
                        <CopyInviteLink token={inv.token} />
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {status === "Bekliyor" ? (
                        <form action={revokeInvite}>
                          <input
                            type="hidden"
                            name="invitationId"
                            value={inv.id}
                          />
                          <Button type="submit" variant="ghost" size="sm">
                            İptal et
                          </Button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3 text-sm font-medium">
          Kullanıcılar
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">İsim</th>
              <th className="px-4 py-3 font-medium">E-posta</th>
              <th className="px-4 py-3 font-medium">Rol</th>
              <th className="px-4 py-3 font-medium">Marka sayısı</th>
              <th className="px-4 py-3 font-medium">Kayıt</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">{u.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {u.platformRole}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {u.workspace?._count.brands ?? 0}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {u.createdAt.toLocaleDateString("tr-TR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
