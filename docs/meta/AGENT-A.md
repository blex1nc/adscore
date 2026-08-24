# AJAN A — META BAĞLANTI ÇEKİRDEĞİ (şema + istemci sahibi)

Önce oku: `CLAUDE.md`, `HANDOFF.md` (§14, §21.4, §23), `PHASE0-META-VERIFICATION.md`, `docs/meta/ANALIZ.md`, `docs/meta/CONTRACTS.md`. Sonra bu dosya.
Branch: `meta/agent-a`. Port 3000. Sahip olduğun dosyalar: CONTRACTS §5. **Deploy/push yok.**

## 1. Amaç

Kullanıcı panelden Meta Business hesabını bağlasın; token güvenli saklansın; markası hangi ad account / Page / IG / pixel ile çalışacaksa panelden seçsin; ve **diğer iki ajanın üzerine kod yazacağı tek Meta istemcisi** kurulmuş olsun.

Sen bu sprintte **altyapısın**. B ve C senin imzalarına bağımlı — bu yüzden Bölüm 2 ve 3 sırayla ve hızlı bitmeli.

## 2. t=0 — ŞEMA (B ve C seni bekliyor)

1. `docs/meta/CONTRACTS.md` §3'teki diff'in **tamamını** (B'nin `MetaPublish` + `CampaignPlan` alanları, C'nin `MetaInsightSync` + `CampaignResult` + `CompetitorAd` alanları dahil) `packages/db/prisma/schema.prisma`'ya uygula.
2. `pnpm db:migrate` → migration adı `meta_connection_publish_insights`; `pnpm db:generate`.
3. Commit: `Şema: Meta bağlantı + yayın + insights (sprint ortak migration)`. Kullanıcıya "B ve C cherry-pick edebilir" de.
4. Aynı commit'te `apps/web/src/lib/meta/client.ts` dosyasını **yalnız tip/imza seviyesinde** (CONTRACTS §4 birebir) oluştur; gövdeler `throw new Error("not implemented")` olabilir. B ve C buna karşı derler.

Bu 4 adım bitmeden motor işine geçme.

## 3. t=1 — TOKEN MODELİ DOĞRULAMASI (kod yazmadan)

**HANDOFF §23: hafızadan Meta yazmak yasak.** Şunları güncel resmi dokümandan doğrula ve `docs/meta/SOURCES-A.md`'ye kaynak + retrieved_at ile yaz:

- Hangi login akışı: klasik Facebook Login mi, **Facebook Login for Business** (+ `config_id`) mi? Hangisi ads izinleri için besleniyor, hangisi system user token üretiyor?
- Kısa ömürlü → uzun ömürlü token değişimi: uç, parametreler, gerçek ömür.
- `debug_token` ile verilen **gerçek** izin listesinin okunması (kullanıcı izin ekranında izin kaldırabilir → biz sahip olduğumuzu sandığımız izinle çalışamayız).
- `appsecret_proof` gerekli mi, nasıl üretiliyor?
- Kullanıcının varlıklarını listeleyen uçlar: business'lar, ad account'lar, Page'ler, IG business hesapları, pixel/dataset'ler.
- Deauthorize callback + veri silme (data deletion) callback'inin **zorunlu formatı**.
- Rate limit başlıkları: `X-App-Usage` / `X-Ad-Account-Usage` alan adları ve anlamları.

Bulguları kısa bir özet olarak kullanıcıya sun (2–3 paragraf, uydurma yok). Belirsiz kalan varsa **belirsiz** yaz.

## 4. İşler

### A1 — Uygulama kimlik bilgileri kapısı
`META_APP_ID` / `META_APP_SECRET` / `META_TOKEN_KEY` yoksa: **çalışmayan buton yok**; ayarlar ekranı dürüst `BLOCKED — Meta uygulama bilgileri eksik` gösterir ve ne yapılacağını yazar. Anahtar üretimi gerekiyorsa komutu kullanıcıya söyle, değeri sen `.env.local`e yazma, sohbete yazdırma. `.env.example` güncellensin.

### A2 — OAuth akışı
- `/api/meta/oauth/start`: state (CSRF, httpOnly cookie + DB/imzalı) + doğrulanmış scope listesi ile Meta'ya yönlendirir.
- `/api/meta/oauth/callback`: state doğrula → kod → uzun ömürlü token → `debug_token` ile **gerçek** izinleri oku → `MetaConnection` yaz (şifreli).
- Kullanıcı izin reddettiyse / eksik izin verdiyse: hangi izinlerin eksik olduğu **isim isim** yazılır; sessiz başarı yok.
- Audit: `meta.connect`, `meta.disconnect`, `meta.reauth`.

### A3 — Token deposu
- AES-256-GCM (`node:crypto`), anahtar `META_TOKEN_KEY` (base64, 32 bayt). Düz token DB'ye/loga/hata mesajına **hiç** girmez.
- `getAccessToken(workspaceId)` yalnız `lib/meta/` içinden çağrılabilir (server-only).
- Süre kontrolü: `lastCheckedAt` eskiyse `debug_token` ile doğrula; geçersizse `status = EXPIRED` + panelde "yeniden bağlan".

### A4 — Meta istemcisi (CONTRACTS §4 gövdeleri)
- Tek sürüm sabiti, tek fetch noktası, timeout, `paginate`.
- Hata haritası: Meta hata `code`/`error_subcode` → `MetaApiError` (isRateLimit / isPermission / isTransient) + **TR kullanıcı mesajı + aksiyon** (CLAUDE.md §42).
- Retry: yalnız geçici hatalarda (429 / 5xx / 1 / 2 kodları — doğrula), üstel backoff, yazma çağrılarında **idempotencyKey yoksa retry yok**.
- Her çağrı `MetaApiCall`'a yazılır (path'te token/param yok).
- Log kuralı: URL query, token, app secret **asla** loglanmaz.

### A5 — Varlık seçimi ekranı (`/app/settings/meta`)
- Bağlantı durumu, bağlanma tarihi, verilen izinler, **eksik izinler**, disconnect.
- Ad account listesi (ad, para birimi, durum) → `MetaAdAccount` önbelleği + "yenile".
- Marka bazında bağlama (`BrandMetaBinding`): ad account + **Page (zorunlu)** + IG (ops.) + pixel (ops.).
- Page yoksa/erişim yoksa: "Bu marka için yayın hattı Page olmadan çalışmaz" uyarısı — B'nin ekranı da bunu kontrol eder.
- Marka sayfasına tek satır "Meta bağlantısı →" linki (CONTRACTS §5 uyarınca yalnız link ekleme).

### A6 — Webhook + deauthorize + veri silme
- `/api/meta/webhooks`: doğrulama (hub.challenge) + imza kontrolü (`X-Hub-Signature-256`).
- Deauthorize sinyali → `status = REVOKED`, kullanıcı panelde görür (sessizce kırık bağlantı kalmaz).
- Veri silme talebi ucu: bağlantıyı ve önbelleği siler, Meta'nın beklediği cevabı döner (formatı doğrula).

### A7 — Harcama güvenliği kilidi (merkezî)
`lib/meta/guards.ts`:
- `assertPublishAllowed({ brandId, userId })`: bağlantı + binding + izin var mı, workspace günlük bütçe tavanı aşılıyor mu, kullanıcı onayı verilmiş mi.
- **`assertSafePayload({ kind, payload, plan })`** — para harcatmayı kod seviyesinde imkânsız kılar. Kesin kural (B'nin ad set'i bütçesiz oluşturamayacağı için "bütçe alanı varsa reddet" demek YANLIŞ olurdu):
  - **kind = "create"** (yeni nesne): `status` **`"PAUSED"` olmak zorunda**; bütçe alanı varsa değeri kullanıcının onayladığı `CampaignPlan.budgetAmount`'a eşit **ve** workspace `maxDailyBudget` tavanının altında olmalı.
  - **kind = "update"** (mevcut Meta nesne ID'sine giden her çağrı): `status`, `daily_budget`, `lifetime_budget`, `bid_amount` alanları **tümüyle yasak** — varsa hata.
  - Her iki durumda `status: "ACTIVE"` mutlak yasak.
- Workspace ayarı: `maxDailyBudget` (kullanıcı belirler, CLAUDE.md §23) — şema diff'inde hazır (CONTRACTS §3).

## 5. Test kanıtı (zorunlu)

1. Gerçek OAuth ile bağlan → izinler panelde göründü (ekran özeti + tarih).
2. Ad account + Page listesi gerçek API'den geldi.
3. Token DB'de şifreli (dump'ta düz metin yok — göster).
4. Yanlış/expired token → `EXPIRED` + dürüst mesaj.
5. `assertNeverActivate` birim testi: ACTIVE payload reddedildi.
6. `.env` boşken ayarlar ekranı BLOCKED.

## 6. Yasak

- ACTIVE etme, bütçe değiştirme, kampanya oluşturma (bunlar B'nin işi ve o da sadece PAUSED).
- B ve C'nin dosyalarına dokunmak.
- İmzayı haber vermeden değiştirmek.
- Mock Meta cevabı üretmek.

## 7. Rapor

`docs/meta/REPORT-A.md`: yapılanlar tablosu, doğrulanan uçlar (SOURCES-A referanslı), test kanıtları, B ve C'ye notlar (özellikle imza değişiklikleri), açık kalanlar.
