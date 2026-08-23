# AJAN B — Ads Manager Kurulum Kiti v2 (manuel yayın, alan alan)

Önce oku: `CLAUDE.md`, `HANDOFF.md` (§14, §21.5 "manuel yayın kiti", §23), `docs/CONTRACTS.md`. Sonra bu dosya.
Branch: `sprint/agent-b`. Sahip olduğun dosyalar: CONTRACTS §5. Deploy/push yok.
Şema: migration'ı Ajan A yazar; gelene kadar §2 ve §3'ü (şemasız işler) yap, sonra A'nın commit'ini cherry-pick et.

## 1. Amaç

Kullanıcı, sistemin ürettiği ve onayladığı reklamı **kendi Ads Manager panelinde** sıfır tereddütle kurabilsin. Bugünkü plan (`CampaignPlan.result`) serbest metin "manual_setup_steps" veriyor; bu yetmez. Hedef: Ads Manager'ın **gerçek ekran sırasına ve alan adlarına** birebir oturan, her alanı kopyalanabilir, ilerlemesi işaretlenebilir, dışa aktarılabilir bir kit + yerleşime uygun boyutlanmış görseller.

## 2. Önce Meta'yı incele (kod yazmadan) → `docs/META-ADS-MANAGER-FIELDS.md`

HANDOFF §23: Meta yapısı hafızadan yazılmaz. WebFetch ile **güncel resmi** kaynakları oku (developers.facebook.com Marketing API dokümanları; Meta Business Help Center "Ads Manager" makaleleri). Çıkar ve kaynak/retrieved_at ile yaz:

- Kampanya düzeyi: objective listesi (güncel isimleriyle), kampanya bütçesi seçenekleri (Advantage kampanya bütçesi vb. — resmi adıyla), özel reklam kategorisi, A/B test seçeneği.
- Reklam seti düzeyi: dönüşüm konumu / performans hedefi (optimization goal), pixel/dataset + event, bütçe & zamanlama, kitle (konum/yaş/cinsiyet/detaylı hedefleme/özel & benzer kitleler, Advantage+ kitle seçeneği), yerleşimler (Advantage+ yerleşim vs. manuel; yerleşim listesi).
- Reklam düzeyi: kimlik (Sayfa + Instagram), format (tek görsel/video, carousel, koleksiyon), medya, primary text / headline / description, CTA buton listesi, hedef URL, URL parametreleri, izleme.
- Görsel spesifikasyonları: önerilen oranlar ve piksel boyutları (feed/story/reels), metin limitleri.
- **Toplu içe aktarma**: Ads Manager'ın resmi bir "import/export (spreadsheet)" özelliği var mı, formatı dokümante mi? **Doğrulanırsa** §5'e ekle; doğrulanmazsa ekleme ve raporda "doğrulanamadı" yaz.

Doküman her alan için: `ads_manager_path` (ekranda nerede), `type`, `allowed_values` (varsa), `source_url`, `retrieved_at`. Bulunamayan bilgi "mevcut değil" olarak kalır; uydurulmaz.

## 3. Kit builder (`lib/publish-kit/build.ts`, deterministik, AI yok)

Girdi: `CampaignPlan` (COMPLETED, `result` JSON) + planın `creatives` içinden **yalnız APPROVED** olanlar (+ görselleri) + marka (`currency`, `targetMarket`, `website`, `copyLanguage`).
Çıktı (`PublishKit.kit`):

```ts
type KitField = {
  id: string;                 // "campaign.objective"
  label: string;              // Ads Manager'daki TR/EN etiket (dokümandan)
  adsManagerPath: string;     // "Kampanya > Kampanya ayrıntıları > Hedef"
  value: string;              // kopyalanacak değer
  why?: string;               // plandan
  confidence?: "low"|"medium"|"high";
  alternative?: string;
  source: "plan" | "creative" | "brand" | "user_input";  // değer nereden
};
type KitSection = { id: "campaign"|"adset"|"ad"; title: string; fields: KitField[]; steps: { id: string; text: string }[] };
type Kit = {
  version: 1;
  generatedAt: string;
  disclaimer: string;         // "Bu kit öneridir; son ayarları Ads Manager'da sen belirlersin. Bütçe ve harcama tamamen senin kontrolünde."
  sections: KitSection[];     // campaign → adset(ler) → ad(lar)
  adsets: Array<{ name: string; purpose: string; testVariable: string|null; ads: Array<{ creativeId: string; headline: string; primaryText: string; description: string|null; cta: string; imageIds: string[] }> }>;
  budget: { type: "DAILY"|"LIFETIME"; amount: string; currency: string; durationDays: number|null; scenarios: unknown }; // plandan, AI bütçe belirlemez
  assets: Array<{ creativeImageId: string; ratios: Array<"1x1"|"4x5"|"9x16"> }>;
  gaps: string[];             // planda olmayan / kullanıcının dolduracağı alanlar (ör. pixel event, hedef URL, Sayfa)
};
```

Kurallar:
- Plan JSON'unda olmayan alan `value: ""` + `gaps`'e düşer; **uydurma yok.** Kullanıcının gireceği alanlar (`user_input`: Sayfa, Instagram hesabı, hedef URL, pixel/event adı) kit sayfasında input olarak istenir ve `kit` içine kaydedilir (`buildPublishKit` sonrası `updateKitInputs` gibi küçük bir action ekleyebilirsin — kendi dosyan).
- CTA değeri Meta'nın CTA buton listesine **eşlenir** (dokümandan); eşleşmezse en yakın + "eşleştirilemedi, elle seç" notu.
- Copy alanlarında karakter sayacı ve limit uyarısı (limitler dokümandan, kaynaklı).
- `lib/campaigns/prompts.ts`'i yalnız şu kadar değiştir: plan JSON'una kit için gereken eksik alanlar (ör. `optimization_event.event_name`, `placements.list[]`, `audience.suggestion.locations[]`, `cta_button`) ekle; mevcut alanları bozma. Eski planlar bu alanlar olmadan da kit üretebilmeli (builder toleranslı).

Saf fonksiyon testleri: `lib/publish-kit/__tests__/build.test.ts` (eski plan şekli, yeni plan şekli, onaysız creative'in dışarıda kalması, gaps üretimi).

## 4. Görsel asset servisi

- `apps/web` bağımlılığına `sharp` ekle (root `onlyBuiltDependencies`'te zaten var).
- `GET /api/publish-kits/[kitId]/assets/[creativeImageId]?ratio=1x1|4x5|9x16`: auth + tenant kontrolü (kit → plan → brand → workspace.ownerId), `CreativeImage.data`'yı istenen orana **cover-crop + resize** ile döner (boyutlar §2 dokümanından; dokümanda yoksa 1080 tabanlı standart kullan ve "ESTIMATE" notu düş). İndirilebilir dosya adı: `<marka>-<headline-slug>-<ratio>.jpg`. Cache header kısa.
- Kit sayfasında her reklam için 3 oranlı önizleme + indir düğmeleri; görseli olmayan creative için "görsel üret" linki (Creative Studio'ya).

## 5. Dışa aktarma

- `GET /api/publish-kits/[kitId]/export?format=json` → kit JSON.
- `format=html` → yazdırılabilir tek sayfa (print CSS, tema bağımsız, logo yok), tüm alanlar + adımlar + checklist durumu. Kullanıcı "PDF olarak kaydet" ile alır.
- Toplu içe aktarma şablonu: **yalnız §2'de doğrulandıysa** `format=sheet` (CSV/XLSX; formatı doğruladığın şablona birebir). Doğrulanmadıysa bu madde yok.

## 6. Action'lar, sayfa, akış

- `actions/publish-kit.ts`: CONTRACTS §4 imzaları. `buildPublishKit` kapıları: sahiplik, plan COMPLETED, ≥1 APPROVED creative (yoksa net hata: "Kit için onaylı creative gerekli"). Her çağrı yeni `version` (eski kitler listede kalır). Audit: `publish_kit.built/step_toggled/published`.
- `/app/brands/[id]/campaigns/[planId]/kit`: sol — Ads Manager sırasında bölümler (Kampanya → Reklam seti → Reklam), her alan: etiket, Ads Manager yolu, değer + **kopyala** düğmesi, neden/confidence/alternatif; sağ — ilerleme checklist'i (toggle → `toggleKitStep`), `gaps` uyarı kutusu, kullanıcı girdileri formu, asset'ler, dışa aktarma düğmeleri, en altta **"Ads Manager'da yayınladım"** (`markPlanPublished`, opsiyonel not) → plan kartında `publishedAt` rozetiyle birlikte "Sonuç gir →" CTA'sı (mevcut `result-forms` / CSV içe aktarma).
- Mevcut kampanya sayfasında (`campaigns/page.tsx`) plan kartlarına "Kurulum kiti →" linki ve `publishedAt` rozeti.
- Kit sayfası copy-paste odaklı: tek tık kopyalama, kopyalandı geri bildirimi, klavye ile gezilebilir. `components/ui.tsx`'teki bileşenleri kullan; yeni dil icat etme.

## 7. Doğrulama

- `docs/META-ADS-MANAGER-FIELDS.md` tamam, her alan kaynaklı.
- Builder testleri geçiyor.
- Canlı: Örnek Kahve'de COMPLETED bir plan + APPROVED creative ile kit üret → alanlar/gaps doğru → checklist işaretle → JSON + HTML export → 3 oranda görsel indir (boyutları doğrula) → "yayınladım" → sonuç giriş CTA'sı.
- Tenant testi: başka kullanıcının kit/asset/export URL'si 404.
- `pnpm lint`, `pnpm build`.
- `docs/REPORT-B.md` (CONTRACTS §6) — C'ye not: kit route'u ve planın `publishedAt` alanı wizard'ın son adımında kullanılacak.
