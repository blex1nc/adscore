# META DEVELOPER HESABI — AÇILAN SİSTEMLER ANALİZİ

**Tarih:** 2026-08-24
**Tetikleyici:** Kullanıcı Meta developer hesabını açtı; ayrıca bir MCP bağlantısı sağlayabiliyor.
**Durum:** ANALİZ — kod yazılmadı. Bölüm 8'deki sorular cevaplanmadan sprint başlamaz.
**Kaynak temeli:** `PHASE0-META-VERIFICATION.md` (Retrieved 2026-08-12) + `HANDOFF.md` §21.4 / §21.5 / §23 + `CLAUDE.md` §20/§21/§33/§37/§44.

> ⚠️ PHASE0 doğrulaması **izinleri** kapsıyordu, **endpoint payload'larını değil** ve 12 gün önce alındı.
> Bu sprintte her ajan kendi uçlarını güncel resmi dokümandan yeniden doğrular (§37: source + retrieved_at).

---

## 1. ÖNCE KRİTİK AYRIM: MCP ≠ ÜRÜN ENTEGRASYONU

Bunlar iki ayrı şeydir ve karıştırılırsa ürün yanlış kurulur:

| | MCP bağlantısı | Ürün entegrasyonu |
|---|---|---|
| Kimin aracı | **Benim / ajanların** (geliştirme zamanı) | **AdScore'un** (çalışma zamanı, her müşteri için) |
| Ne işe yarar | Gerçek API'ye bakıp alan adlarını, hata gövdelerini, gerçek cevapları **doğrulamak**; test hesabında deneme yapmak | Kullanıcının kendi Meta Business'ını panelden bağlaması, yayın, insights |
| Token | Senin kişisel/dev token'ın, MCP config dosyasında | Kullanıcının OAuth token'ı, şifreli olarak DB'de |
| Ürüne girer mi | **Hayır.** Panel MCP'ye bağlanmaz | Evet — `HANDOFF §21.4` OAuth akışı |

**Sonuç:** MCP bağlantısını al — çok değerli, çünkü "hafızadan Meta yazma" yasağını (HANDOFF §23) gerçek cevaplarla değiştirir. Ama MCP ürünün entegrasyonu **değildir**; sunucu tarafı OAuth + Marketing API istemcisi yine yazılacak.

**MCP için iki soru (Bölüm 8, S1):** hangi MCP sunucusu ve token nerede duracak. Lokal (stdio) sunucu token'ı makinede tutar; uzak/hosted sunucu token'ı **üçüncü tarafa** gönderir. Senin credential disiplinin (değer dosyaya, sohbete asla) ikincisiyle çelişir. Token config dosyasına yazılır; bu dokümanlara veya sohbete asla.

---

## 2. ERİŞİM GERÇEĞİ — DEV HESABI NEYİ AÇAR, NEYİ AÇMAZ

PHASE0 §1.1 doğrulaması geçerli:

**Açar (bugün, App Review'sız):**
- App'te **rolü olan kullanıcılar** (sen) için tüm izinler onaysız çalışır → **akışın tamamı uçtan uca geliştirilebilir ve gerçek veriyle test edilebilir.**
- Kendi test ad account + Page + IG hesabınla gerçek kampanya nesneleri oluşturmak (PAUSED), gerçek insights çekmek.

**Açmaz:**
- **Dış müşteriler.** Başka birinin ad account'unu bağlaman App Review + muhtemelen Business Verification ister (PHASE0 §1.2, açık soru **F1**).
- Ağır rate limit'ler kalkmaz (Limited Access: hesap başına sıkı limit; Full Access için son 15 günde ≥500 başarılı çağrı + hata <%15 + review).

**Bunun sprint'e etkisi:** Bu sprint **"tek kullanıcı (sen) için gerçek, dış müşteri için hazır"** hedefler. App Review paketi (screencast, privacy policy, data deletion callback) bu sprintin çıktısıyla **çekilebilir hale gelir** ama başvuru bu sprintin işi değil.

---

## 3. AÇILAN SİSTEM ENVANTERİ

Her sistem: ne yapar → mevcut hangi manuel yolun yerine geçer → bağımlılık → risk.

### S1 — OAuth bağlantısı + token deposu
Kullanıcı panelden "Meta'ya bağlan" der, Meta'nın resmi login akışı döner, uzun ömürlü token şifreli saklanır; durum/izinler/eksik izinler panelde görünür; disconnect var (HANDOFF §21.4 birebir).
- **Yerine geçtiği:** hiçbir şey — bugün bu yol yok, tüm Meta işleri manuel.
- **Bağımlılık:** `META_APP_ID` + `META_APP_SECRET` (.env.local) + token şifreleme anahtarı (yeni: `META_TOKEN_KEY`).
- **Risk:** Token modeli (klasik uzun ömürlü user token vs Facebook Login for Business + `config_id` vs system user token) **hafızadan seçilmez** — sprintin t=0 doğrulama işi.
- **Sonuçları:** Bu olmadan S2–S11'in hiçbiri çalışmaz. Kritik yol.

### S2 — Varlık seçimi (Business / Ad Account / Page / IG / Pixel / Katalog)
Bağlantıdan sonra kullanıcının erişebildiği varlıklar listelenir; marka bazında bağlanır (`Brand → ad account + page + ig + pixel`).
- **Yerine geçtiği:** PublishKit'te kullanıcının elle yazdığı hesap bilgileri.
- **Kritik not:** Reklam creative'i **Page ID olmadan oluşturulamaz** (`object_story_spec`). Yani Page seçimi opsiyonel bir konfor değil, **yayın hattının zorunlu ön koşuludur**.
- **Risk:** Kullanıcının hangi varlıklara hangi rolle eriştiği değişkendir → eksik yetki dürüst BLOCKED ile gösterilir, tahmin edilmez.

### S3 — Meta API istemcisi (ortak altyapı)
Sürüm sabitlenmiş tek istemci: rate limit başlıklarının okunması, backoff, sayfalama, hata kodu → **Türkçe, eyleme dönük** mesaj haritası (CLAUDE.md §42), her çağrının audit + maliyet kaydı.
- **Yerine geçtiği:** yok (yeni altyapı).
- **Risk:** Bu katman zayıf olursa Limited Access rate limit'leri rastgele hatalara dönüşür ve Full Access şartı olan "hata oranı <%15" bozulur.

### S4 — Hedefleme arama ve doğrulama
İlgi alanı / davranış / lokasyon / demografi araması resmi uçtan; kullanıcı serbest metin yerine **gerçek Meta hedefleme nesneleri** seçer.
- **Yerine geçtiği:** Kampanya planındaki serbest metin "kitle önerisi" (kullanıcı Ads Manager'da elle arıyordu).
- **Kazanç:** AI'ın önerdiği kitle artık **var olduğu doğrulanmış** hedefleme; uydurma audience yok (§6).

### S5 — Erişim / teslimat tahmini (delivery estimate)
PHASE0 §1.5 doğrulandı: `delivery_estimate` var, `daily_outcomes_curve` **yalnız Meta güven verebildiğinde** dolu gelir.
- **Yerine geçtiği:** HANDOFF §22.3'te çözülen "tahmin ekranı" — artık kaynağı var.
- **Kural:** Meta sayı vermezse **biz de vermeyiz** → "Insufficient Data". Kendi tahmin modelimizi kurmak yasak (§6, §31).

### S6 — Medya yükleme (görsel/video)
Arena kazananının üretilmiş görseli ve marka asset'leri ad account'a yüklenir, hash/ID alınır.
- **Yerine geçtiği:** PublishKit'in "asset'leri indir, Ads Manager'a elle yükle" adımı.
- **Bağımlılık:** Görseller bugün DB'de (bytea) — yükleme oradan besleniyor, S3 taşıması ayrı iş.

### S7 — Yayın hattı (campaign → ad set → ad → creative)
Onaylı creative + kampanya planı + seçilmiş varlıklar → gerçek Meta nesneleri.
- **Yerine geçtiği:** PublishKit'in kopyala-yapıştır kurulumu (kit **silinmez** — API'siz/izinsiz durumda ve "kendi elimle kurayım" diyen kullanıcı için kalır).
- **ZORUNLU KURAL:** Bu sprintte **her şey `PAUSED` oluşturulur.** Kampanyayı ACTIVE etmek bu sprintin kapsamı dışındadır (CLAUDE.md §20/§44). Para harcatan tek düğme yoktur.

### S8 — Resmi önizleme (ad preview)
Meta'nın kendi render'ı ile yerleşim bazlı gerçek önizleme.
- **Yerine geçtiği:** `components/preview/*` nötr çerçeveler (yasal olarak güvenli yer tutucular).
- **Kazanç:** §22.2'deki "üçüncü taraf asset riski" tamamen kapanır — önizleme Meta'nın kendi çıktısı.

### S9 — Insights senkronu (gerçek performans verisi)
Yayınlanmış kampanyaların spend/impressions/clicks/reach/frequency/actions verisi API'den çekilir.
- **Yerine geçtiği:** CSV içe aktarma + elle sonuç girişi (**ikisi de kalır** — API'siz plan hâlâ mümkün).
- **ZORUNLU KURAL:** Veri, **mevcut `addCampaignResult` doğrulama yolundan** geçerek `CampaignResult`'a yazılır. Paralel bir model açılmaz. Böylece zincir aynen sürer: sonuç → metrikler (koddan) → AdScore → sinyaller → optimizasyon → Learning. Zeka katmanına dokunulmaz.
- **Kazanç:** Öğrenme döngüsü (§26) ilk kez **otomatik** beslenir.

### S10 — Ad Library API (rakip reklamları)
PHASE0 §1.4 teyidi: `ad_type=ALL` ile ticari reklam sorgulanabilir **ama EU'ya ulaşmayan reklamlar dönmez** → TR-only reklamlara programatik erişim yok.
- **Yerine geçtiği:** Pazar-bazlı hibritin otomatik yarısı (HANDOFF §21.5): EU kapsamındaki pazarlarda rakip reklamları otomatik gelir; TR'de mevcut manuel yol aynen kalır.
- **Dürüstlük kuralı:** Kullanıcıya "rakibin tüm reklamları" denmez; "Ad Library kapsamında görünenler" denir ve kapsam dışı olasılığı yazılır.

### S11 — Webhook + deauthorize / veri silme geri çağrıları
Kullanıcı uygulamayı Meta tarafından kaldırdığında bağlantının ölmesi; veri silme talebi ucu.
- **Neden şimdi:** App Review'ın ön koşulu ve **bugün kullanıcı hesabında sessizce kırık bağlantı** oluşmasını engelliyor.
- **Kapsam:** Bu sprintte deauthorize + data deletion callback; iş sinyalleri (ad account uyarıları) sonraki faz.

### S12 — Harcama güvenliği ve maliyet takibi
Sunucu tarafında zorlanan kapılar: ACTIVE etme yok, bütçe değişimi yok, workspace bazlı maksimum günlük bütçe tavanı, her yayın işleminde explicit onay + audit (CLAUDE.md §20/§23/§41/§44). Ayrıca Meta API çağrı sayacı (§43).
- **Not:** Bu bir "özellik" değil, **diğer 11 sistemin üstündeki kilit.** Ajan A'da merkezî olarak durur; B ve C ondan geçer.

---

## 4. BU SPRİNTTE AÇIKÇA YAPILMAYACAKLAR

| Konu | Neden |
|---|---|
| Kampanyayı ACTIVE etmek / bütçe değiştirmek | Para harcatır; ayrı onay fazı (CLAUDE.md §20, §44) |
| App Review başvurusu, Business Verification | F1 açık; şirket bilgisi yok; dev fazı bunlarsız yürür |
| Conversions API / dataset event gönderimi | Ayrı ürün yüzeyi; PHASE0'da MVP dışı |
| Katalog / DPA reklamları | PHASE0 §1.3'te bilinçli ertelendi (`catalog_management`) |
| Otomatik optimizasyon uygulaması | §30 human override — öneri kalır, uygulamaz |
| Video üretimi | Ücretsiz üretim kalitesinde API yok (PHASE0 §2) |
| Çoklu müşteri token mimarisi finali (system user / partner) | Erişim modeli App Review sonrası netleşir |

---

## 5. BAĞIMLILIK SIRASI (KRİTİK YOL)

```text
S1 OAuth + token          ← her şeyin önkoşulu
   └─ S3 API istemcisi + S12 kilitler
        ├─ S2 varlık seçimi  ── Page ID ──┐
        │                                 ▼
        ├─ S4 hedefleme → S5 tahmin → S6 medya → S7 YAYIN (PAUSED) → S8 önizleme
        └─ S9 insights → mevcut AdScore/optimizasyon zinciri
   S10 Ad Library  (token'a bağlı, yayın hattına bağlı DEĞİL → paralel gidebilir)
   S11 webhooks    (bağlantı sağlığı)
```

---

## 6. 3 AJANA BÖLÜM MANTIĞI

| Ajan | Kapsam | Neden bu grup |
|---|---|---|
| **A — Bağlantı Çekirdeği** | S1, S2, S3, S11, S12 + **şema sahibi** | Herkesin bağımlı olduğu tek katman; tek elden yazılmalı |
| **B — Yayın Hattı** | S4, S5, S6, S7, S8 | Hepsi ad account yazma yüzeyi; aynı Meta nesne modelini paylaşır |
| **C — Veri & İstihbarat** | S9, S10 + Meta maliyet/kullanım paneli | Hepsi **okuma**; mevcut zeka zincirine bağlanır, yayın hattına dokunmaz |

**Geçen sprintin dersi + bu sprintin ek riski:** B ve C, A'nın istemcisine bağımlı. Geçen sefer bunu "migration t=0" çözdü; bu sefer yetmez. Bu yüzden `docs/meta/CONTRACTS.md` **hem şema diff'ini hem `MetaClient` imzalarını t=0'da sabitler**; B ve C A'nın gerçek implementasyonu gelmeden bu imzaya karşı stub ile çalışır.

---

## 7. TESPİT EDİLEN AÇIK/EKSİK

- `apps/web/src/lib/publish-kit/meta-fields.ts` dosyası `docs/META-ADS-MANAGER-FIELDS.md`'ye referans veriyor ama **bu dosya repoda yok** (hiç commit'lenmemiş). Kaynak izlenebilirliği (§37) için Ajan B bu dosyayı yeniden üretir veya referansı düzeltir.
- `.env.local` içinde `META_APP_ID` / `META_APP_SECRET` satırları **yorum satırı altında, değer durumu bilinmiyor** — Ajan A ilk iş olarak varlığını kontrol eder, yoksa dürüst BLOCKED.
- Token şifreleme anahtarı (`META_TOKEN_KEY`) henüz yok — üretilip `.env.local`e ve Vercel'e eklenecek (değeri kullanıcı koyar).

---

## 8. CEVAP BEKLEYEN SORULAR

**S1 — MCP: ✔ CEVAPLANDI (2026-08-24).** Kullanıcı **Meta'nın resmi MCP sunucusunu** bağladı: `https://mcp.facebook.com/devtools` (claude.ai connector, "claude.ai Meta Developer Tools"). Meta'nın kendi sunucusu olduğundan üçüncü taraf token riski yok; kimlik claude.ai OAuth'unda, config dosyasına anahtar girmek gerekmiyor. Ajanlar doğrulama işlerinde (AGENT-A §3, AGENT-B §2, AGENT-C §2) bu MCP araçlarını resmi doküman okumaya EK kanıt olarak kullanabilir — üründeki OAuth/istemci mimarisini DEĞİŞTİRMEZ (Bölüm 1 ayrımı geçerli).

**S2 — Yayın güvenliği: ✔ ONAYLANDI (2026-08-24).** Bu sprintte her yayın PAUSED; ACTIVE etme ayrı faz.

**S3 — Test varlıkları: ✔ CEVAPLANDI (2026-08-24).** IG Business hesabı VAR (kullanıcı beyanı). IG Business bir Facebook Page'e bağlı olmak zorunda → Page var varsayımı; test ad account durumu Ajan A'nın A5 ekranında fiilen doğrulanır, yoksa dürüst uyarı.

**S4 — Anahtarlar: KISMEN.** `META_TOKEN_KEY` üretildi ve `.env.local`e yazıldı (2026-08-24, değer sohbete girmedi). `META_APP_ID` + `META_APP_SECRET` kullanıcı tarafından doldurulacak (App Dashboard → Settings → Basic). Ajan A ilk iş varlığını kontrol eder (A1).
