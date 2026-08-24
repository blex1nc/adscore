# RAPOR — AJAN A (Meta Bağlantı Çekirdeği)

Tarih: 2026-08-24 · Branch: `meta/agent-a` · Durum: kod tarafı tamam; **gerçek OAuth girişi kullanıcı aksiyonu bekliyor** (Bölüm 5).

## 1. Yapılanlar

| İş | Durum | Not |
|---|---|---|
| t=0 şema (CONTRACTS §3 tamamı, tek migration) | ✔ | Commit `51e7632`, migration `20260824132814_meta_connection_publish_insights` — **DB'ye uygulandı ve `pnpm db:generate` koşuldu. B ve C bu commit'i cherry-pick edebilir; migration'ı tekrar UYGULAMAYIN.** |
| t=0 istemci imza stub'ları (CONTRACTS §4) | ✔ | Aynı commit; sonra gerçek implementasyonla dolduruldu — **imza değişmedi**. |
| t=1 token modeli doğrulaması | ✔ | `docs/meta/SOURCES-A.md` (19 kayıt, hepsi resmi doküman, retrieved 2026-08-24). Meta MCP sunucusu bu oturumun araç listesinde GÖRÜNMEDİ; doğrulama WebFetch/WebSearch ile yapıldı. |
| A1 kimlik bilgisi kapısı | ✔ | `lib/meta/env.ts`; ekran dürüst `BLOCKED — Meta uygulama bilgileri eksik` + adımlar; env yokken bağlan butonu render edilmez (kanıt §4.3). `.env.example` güncellendi (`META_TOKEN_KEY`, `META_LOGIN_CONFIG_ID`, `META_WEBHOOK_VERIFY_TOKEN`). |
| A2 OAuth akışı | ✔ (kod) | `/api/meta/oauth/start` + `/callback`: HMAC imzalı + httpOnly cookie'li state, kod→uzun ömürlü token→`debug_token` ile GERÇEK izinler, eksik izinler isim isim panele düşer, audit `meta.connect`/`meta.disconnect`. Gerçek giriş kullanıcıda (§5). |
| A3 token deposu | ✔ | AES-256-GCM (`lib/meta/crypto.ts` saf + `token-store.ts`); düz token DB/log/hata mesajına girmez (kanıt §4.2); 12 saatte bir `debug_token` doğrulaması; geçersizse `EXPIRED` + panel "yeniden bağlan". |
| A4 Meta istemcisi | ✔ (kod) | `META_API_VERSION = "v26.0"` (tek yer); tek fetch noktası; `appsecret_proof` her çağrıda; hata haritası TR+aksiyon (`error-map.ts`); retry yalnız geçici hatalarda, **yazmada `idempotencyKey` yoksa retry yok**; her çağrı `MetaApiCall`'a yazılır (path'te query/token yok); sayfalama cursor tabanlı (paging.next URL'i asla dışarı sızmaz). Gerçek Meta çağrısı kanıtı bağlantı sonrası (§5). |
| A5 varlık seçimi ekranı | ✔ | `/app/settings/meta`: durum çipi, bağlanma/doğrulama tarihleri, verilen + **eksik** izinler, disconnect; ad account önbelleği + yenile; marka bağlama (Page **zorunlu**, IG/pixel ops.); Page yoksa "yayın hattı Page olmadan çalışmaz" uyarısı; marka sayfası + ayarlar sayfasına tek satır link. |
| A6 webhook + deauthorize + veri silme | ✔ | `/api/meta/webhooks` (hub.challenge + `X-Hub-Signature-256` **ham gövde** üzerinden, timing-safe); `/api/meta/deauthorize` (signed_request → `REVOKED`, panelde görünür); `/api/meta/data-deletion` (bağlantı+önbellek silinir, zorunlu `{url, confirmation_code}` cevabı + durum sayfası). |
| A7 harcama güvenliği kilidi | ✔ | `lib/meta/guards.ts` + saf çekirdek `guards-core.ts`. create: `status==="PAUSED"` zorunlu, bütçe = plan bütçesi (minör birim) ve ≤ workspace tavanı; update: `status/daily_budget/lifetime_budget/bid_amount` tümüyle yasak; ACTIVE her derinlikte mutlak yasak. `assertPublishAllowed`: sahiplik + bağlantı + izinler + binding + tavan. |

## 2. Doğrulanan uçlar

Tamamı `docs/meta/SOURCES-A.md`'de kaynak+retrieved_at ile. Özet: güncel sürüm **v26.0** (29 Tem 2026); Login for Business `config_id` (business app zorunlu; User token / SUAT ayrımı — bu sprint **User token** yolu); uzun ömürlü değişim `fb_exchange_token` (~60 gün, yalnız server-side); `debug_token` (gerçek `scopes[]`, app token `id|secret` biçimi); `appsecret_proof` = HMAC-SHA256(token, secret); `me/adaccounts` + `account_status` kodları; `me/accounts`; Page→`instagram_business_account`; `act_X/adspixels`; webhook `hub.*` + `sha256=` imza; deauthorize + veri silme `signed_request` ve zorunlu cevap formatı; rate limit başlıkları (`X-App-Usage` / `X-Ad-Account-Usage` / `X-Business-Use-Case-Usage`); hata kodu sınıfları (geçici 1/2/4/17/341/368+BUC, izin 10/200–299, token 102/190); bütçelerin **minör birim** olduğu + offset-1 para birimleri (TRY=100).

## 3. İmza durumu (B ve C için)

**İMZA DEĞİŞİKLİĞİ YOK.** `MetaClient` / `metaClientForWorkspace` / `requireBrandBinding` / `MetaApiError` / `MetaBlockedError` / `assertSafePayload` / `assertPublishAllowed` CONTRACTS §4 ile birebir. Ek (yeni, kırıcı değil):

- `guards-core.ts`: `assertSafePayloadCore`, `toMinorUnits`, `MetaGuardError` (guard ihlalleri **MetaGuardError** fırlatır; `userMessage` alanı var).
- `client.ts` ek export: `META_API_VERSION`, `MetaBlockedReason` (tip).
- `lib/meta/` iç modülleri (`env`, `crypto`, `oauth`, `oauth-state`, `signed-request`, `token-store`, `error-map`) — B/C'nin import etmesi gerekmez; istemci + guard yüzeyi yeterli.
- `apps/web/package.json` `test` script'i meta testlerini de kapsayacak şekilde genişletildi (ortak dosya, tek satır): `tsx --test src/lib/evolution/__tests__/*.test.ts src/lib/meta/__tests__/*.test.ts`.

### B'ye notlar
1. `assertSafePayload` bütçeyi **minör birimde** bekler (Meta'nın istediği gibi: TRY 350.75 → `daily_budget: 35075`). Dönüşüm için `toMinorUnits(plan.budgetAmount, currency)` kullan — kendin çarpma (offset-1 para birimleri var).
2. Bütçeli create için workspace **tavanı ayarlı olmalı**; tavan yoksa guard reddeder (dürüst TR mesajla). Kullanıcı tavanı `/app/settings/meta`'dan girer.
3. `assertPublishAllowed` plan seviyesindeki onayı (COMPLETED plan + APPROVED creative) **kontrol etmez** — o senin akışında kalır; bu kapı workspace önkoşullarını (bağlantı/izin/binding/tavan/sahiplik) zorlar.
4. `client.post` yalnız `idempotencyKey` verilirse geçici hatada retry eder; anahtar Meta'ya gönderilmez (Meta'da doğrulanmış idempotency başlığı yok), "tekrar güvenli" beyanıdır. Publish aşamalarında `MetaPublish.id + stage` gibi bir anahtar öneririm.
5. Kampanya sayfasına "Meta'ya yayınla" girişini sen ekleyeceksin (sayfa senin); ayar ekranı linki hazır: `/app/settings/meta`.
6. `requireBrandBinding` dönüşündeki `currency`, bağlama anında önbellekten alınan **ad account para birimidir** — plan para birimiyle karşılaştırmayı yayında yap (uyuşmazsa dürüst hata).

### C'ye notlar
1. Okumalar için `metaClientForWorkspace(workspaceId)` + `client.paginate(path, params, { maxPages })` (varsayılan 10 sayfa) kullan.
2. Her çağrı `MetaApiCall`'a otomatik yazılır (`appUsagePct` dahil) — maliyet/kullanım paneli için ayrıca sayaç yazmana gerek yok.
3. Rate limit'te `MetaApiError.isRateLimit=true` + TR mesaj gelir; Ad Library taramalarında `maxPages`'i küçük tut.

## 4. Test kanıtları (2026-08-24)

**4.1 Birim testleri — 77/77 geçti** (`pnpm test`; 23 mevcut evolution + 54 yeni meta):
- `crypto.test.ts`: şifrele→çöz round-trip; cipher/tag oynanınca GCM reddi; yanlış anahtar reddi; çıktıda düz token yok.
- `guards.test.ts` (**assertNeverActivate** dahil): create/update/iç içe/küçük harf ACTIVE reddi; PAUSED zorunluluğu; bütçe=plan, tavan aşımı, plansız/tavansız bütçe reddi; update'te 4 yasak alan; `toMinorUnits` (TRY/JPY/ondalık sınırları).
- `error-map.test.ts`: 190 auth (retry yok), 4/17/80004 rate, 10/200–299 izin, 1/2/5xx geçici; kullanım başlığı ayrıştırma (3 başlık + bozuk JSON).
- `oauth-state.test.ts`: imza+süre+oynama reddi. `signed-request.test.ts`: imza doğrulama + sahte payload reddi.

**4.2 Çalışma zamanı kanıtları (login gerektirmeyen, gerçek kod yolu + dev DB):**
- Env yokken kimlik kapısı: `{"ok":false,"missing":["META_APP_ID","META_APP_SECRET","META_TOKEN_KEY"]}`.
- Bağlantı yokken `metaClientForWorkspace` → `MetaBlockedError NO_CONNECTION` + TR mesaj.
- **Token DB'de şifreli:** `saveConnection` ile yazılan satırın ham `tokenCipher` baytlarında düz token hex'i YOK; `getAccessToken` deşifresi birebir eşleşti; test satırı silindi (dump kontrolü `encode(tokenCipher,'hex')` ile).

**4.3 Ekran/uç kanıtları (dev server, forged session ile SSR çıktısı):**
- `.env`'de META_* varken `/app/settings/meta`: HTTP 200 — "Bağlantı durumu: Bağlı değil", "Meta'ya bağlan", "Harcama güvenliği/Günlük tavan" bölümleri render.
- META_* satırları çıkarılmış env ile: **"BLOCKED — Meta uygulama bilgileri eksik"** + eksik değişken adları + `openssl rand -base64 32` talimatı; **bağlan butonu render edilmiyor** (çalışmayan buton yok); `/api/meta/oauth/start` → 307 `?meta_hata=env`.
- OAuth start (env tam): 307 → `www.facebook.com/v26.0/dialog/oauth`, query anahtarları `client_id, redirect_uri, response_type=code, scope(6 izin), state`; state cookie `HttpOnly; SameSite=lax; Max-Age=600; Path=/api/meta/oauth`.
- Callback sahte state: 307 → `?meta_hata=state` (token değişimi denenmiyor).
- Webhook GET (verify token env'de yok): 403. Webhook POST imzasız: 401. Deauthorize `signed_request`'siz: 400. Veri silme durum sayfası bilinmeyen kod: 404.
- `pnpm build` temiz; `tsc --noEmit` temiz; eslint (meta dosyaları) temiz.

**4.4 Bekleyen kanıtlar (gerçek Facebook girişi gerekir — §5 sonrası):** gerçek OAuth ile bağlanıp izinlerin panelde görünmesi; `me/adaccounts` + Page listesinin gerçek API'den gelmesi; expired token'ın canlı `EXPIRED` akışı; `MetaApiCall` gerçek kayıtları. Bunlar **test edilmedi** — "çalışıyor" DENMİYOR.

## 5. KULLANICI AKSİYONU (sırayla)

1. **App Dashboard → ürünler:** App'e "Facebook Login for Business" ürününün ekli olduğundan emin ol (business tipi app'te bu görünür).
2. **Valid OAuth Redirect URIs** (Facebook Login for Business → Settings): `http://localhost:3000/api/meta/oauth/callback` (localhost dev modda genelde otomatik izinlidir; sorun olursa açıkça ekle). Production için ileride: `https://adscore-dwyy.vercel.app/api/meta/oauth/callback`.
3. **(Önerilen) Login config:** Facebook Login for Business → Configurations → yeni config; token tipi **User access token**; izinler: `ads_management, ads_read, business_management, pages_show_list, pages_read_engagement, instagram_basic`. Çıkan Configuration ID'yi `.env.local`'e `META_LOGIN_CONFIG_ID=` olarak kendin yaz. (Boş bırakılırsa akış klasik scope listesiyle açılır — dev'de ikisi de çalışır.)
4. **Deauthorize + veri silme URL'leri** (App Dashboard → Facebook Login → Settings): Deauthorize Callback URL `https://<public-host>/api/meta/deauthorize`, Data Deletion Request URL `https://<public-host>/api/meta/data-deletion`. Bunlar **public HTTPS ister — localhost kabul edilmez**; dev fazında boş kalabilir, App Review öncesi zorunlu.
5. **(Webhook kullanılacaksa)** rastgele bir `META_WEBHOOK_VERIFY_TOKEN` üret (`openssl rand -hex 16`), `.env.local`'e yaz ve App Dashboard webhook ayarına aynısını gir; webhook URL: `https://<public-host>/api/meta/webhooks` (yine public HTTPS ister).
6. **Dev server'ı başlat** (`pnpm dev`, port 3000) → `/app/settings/meta` → **"Meta'ya bağlan"** → Facebook girişi → izinlerin tamamını onayla. Dönüşte verilen/eksik izinler panelde.
7. Bağlantı sonrası: **"Listeyi yenile"** (ad account'lar) → **günlük bütçe tavanını gir** → markayı **ad account + Page**'e bağla (IG/pixel opsiyonel). Sonuç ekranlarını bana bildir; §4.4 kanıtlarını rapora ekleyeceğim.

## 6. Açık kalanlar / bilinçli sınırlar

- Gerçek OAuth + gerçek liste kanıtları kullanıcı girişini bekliyor (§4.4). Bu yapılmadan CONTRACTS §6 madde 3 **kapanmadı**.
- Uzun ömürlü token cevabında `expires_in` her durumda dolu gelmeyebilir — callback `debug_token.expires_at`'i esas alır; ikisi de yoksa süre "bilinmiyor" gösterilir (SOURCES-A "Belirsiz kalanlar").
- `me/businesses` doğrulanmadı/kullanılmadı (MVP ekranı business listesine ihtiyaç duymuyor).
- Webhook topic aboneliği (hangi object/field'lara abone olunacağı) ürün kararı olarak açık; uç imza-doğrulamalı ve audit'li hazır.
- SUAT / system user / çoklu müşteri token mimarisi bilinçli kapsam dışı (ANALIZ §4, App Review sonrası).
- Dev DB'de admin (418off@gmail.com) şifresi hâlâ seed varsayılanı — dev kolaylığı, production öncesi değişmeli (mevcut HANDOFF güvenlik notunun devamı).
- MetaConnection workspace başına TEK (MVP, şema gereği) — çoklu Meta hesabı sonraki faz.
