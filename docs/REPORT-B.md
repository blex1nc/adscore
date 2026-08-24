# AJAN B RAPORU — Ads Manager Kurulum Kiti v2

Tarih: 2026-08-23 · Branch: `sprint/agent-b` (worktree `../adscore-agent-b`) · PORT 3001

> Durum satırı güncellenir; en alttaki "HANDOFF'a girecek özet" birleştirme sonrası HANDOFF.md'ye taşınacak.

## 0. Çalışma düzeni notları

- Üç ajan aynı dizini paylaştığından (multicode paneleri `/Users/toprak/adscore.ai`), B bir **git worktree**'de çalıştı: `git worktree add -b sprint/agent-b ../adscore-agent-b main`. `.env.local` ve `packages/db/.env` worktree'ye kopyalandı; `pnpm install --prefer-offline`.
- Ajan A'nın migration commit'i (`4e4ff1a`, `20260823150335_arena_kit_brand_assets`) `sprint/agent-a`'dan **cherry-pick** edildi (worktree'de `fbfe60f`). Migration A tarafından ortak `adscore_dev`'e zaten uygulanmıştı; B yalnız `prisma generate` koştu (`migrate dev` bilinçli olarak KOŞULMADI — paylaşılan DB'de reset riski).
- `apps/web/package.json`'a yalnız `sharp@^0.35.3` eklendi (root lock dosyası buna bağlı olarak değişti: 8 satır).

## 1. Meta doküman doğrulaması (kod öncesi)

Bkz. `docs/META-ADS-MANAGER-FIELDS.md`. Yöntem: Business Help Center sayfaları JS ile render edildiği için düz WebFetch yalnız başlık döndürdü; sayfalar yerel headless Chromium (Playwright önbelleğindeki `chrome-headless-shell`) ile render edilip metne çevrildi (her dosyada `SOURCE_URL` + `RETRIEVED_AT`). Türkçe etiketler yalnız `?locale=tr_TR` sayfalarından alındı; çevrilmedi. Her alan için kaynak + alınma zamanı dokümanda.

(devamı aşağıda doldurulacak)
