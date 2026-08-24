// A6 — Veri silme durum sayfası (Meta'nın cevaptaki url alanı buraya işaret eder).
// İnsan okunur, auth istemeyen basit durum çıktısı.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@adscore/db";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code") ?? "";
  const entry = code
    ? await prisma.auditLog.findFirst({
        where: { action: "meta.data_deletion", entityId: code },
      })
    : null;

  const html = entry
    ? `<!doctype html><html lang="tr"><meta charset="utf-8"><title>Veri silme durumu</title><body style="font-family:system-ui;max-width:36rem;margin:4rem auto;padding:0 1rem"><h1>Veri silme talebi tamamlandı</h1><p>Onay kodu: <code>${code}</code></p><p>Bu koda bağlı Meta bağlantısı ve önbelleğe alınmış Meta varlık verileri ${entry.createdAt.toLocaleDateString("tr-TR")} tarihinde silindi.</p></body></html>`
    : `<!doctype html><html lang="tr"><meta charset="utf-8"><title>Veri silme durumu</title><body style="font-family:system-ui;max-width:36rem;margin:4rem auto;padding:0 1rem"><h1>Kayıt bulunamadı</h1><p>Bu onay koduna ait bir veri silme kaydı yok.</p></body></html>`;
  return new NextResponse(html, {
    status: entry ? 200 : 404,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
