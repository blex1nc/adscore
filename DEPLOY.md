# DEPLOY — Vercel + Neon (davetli beta)

**Durum:** Kod deploy'a hazır (2026-08-12). Aşağıdaki hesap adımlarını sen yapacaksın;
credential'ları ben hiçbir yerde göremem/giremem.

## 1. Neon (ücretsiz Postgres)

1. neon.tech → GitHub/Google ile hesap aç → yeni proje: `adscore` (bölge: EU önerilir).
2. Dashboard'dan iki connection string al:
   - **Pooled** (pgbouncer'lı) → `DATABASE_URL`
   - **Direct** → `DIRECT_URL`

## 2. GitHub

1. github.com'da **private** repo aç: `adscore`.
2. Lokal repo'yu bağla ve push'la (bana "GitHub repo'yu açtım, push'la" demen yeterli;
   remote ekleme + push'u ben yaparım — sen sadece repo'yu oluştur):

```bash
git remote add origin git@github.com:KULLANICI/adscore.git
```

```bash
git push -u origin main
```

## 3. Vercel

1. vercel.com → GitHub ile giriş → **Add New Project** → `adscore` repo'sunu seç.
2. **Root Directory:** `apps/web` (Framework: Next.js otomatik algılanır;
   build komutu `apps/web/vercel.json`'dan gelir: migrate + build).
3. **Environment Variables** (Production):

```text
DATABASE_URL   = Neon pooled string
DIRECT_URL     = Neon direct string
SESSION_SECRET = openssl rand -base64 32 çıktısı (YENİ üret, lokaldekiyle aynı olmasın)
GEMINI_API_KEY = AI Studio key'in
```

4. Deploy'a bas. Build sırasında migration'lar otomatik koşar.

## 4. İlk admin (deploy sonrası, lokalden bir kez)

```bash
DATABASE_URL="NEON_DIRECT_URL" DIRECT_URL="NEON_DIRECT_URL" SEED_ADMIN_EMAIL="418off@gmail.com" SEED_ADMIN_PASSWORD="guclu-bir-sifre-sec" pnpm db:seed
```

Sonra `https://<proje>.vercel.app/admin` → davet oluştur.

## Bilinen sınırlar (bilinçli, kayıtlı)

- **Landing video'su üçüncü taraf CDN yer tutucusu** (HANDOFF §22.2) ve `robots: noindex`
  açık. Gerçek lansmandan önce kendi asset + noindex kaldırma.
- **AI işleri `after()` ile koşar; Vercel'de fonksiyon süresi 60 sn** (`maxDuration`).
  Retry zinciri uzarsa iş yarıda kesilip RUNNING'de takılı kalabilir; kalıcı çözüm
  worker/queue (ör. Inngest/QStash) — sonraki altyapı fazı.
- **Görseller DB'de (bytea)** — beta için yeterli; ölçekte S3/Blob'a taşınacak.
- Free tier AI kotaları production trafiği için yeterli değildir (PHASE0 §2 notu).
