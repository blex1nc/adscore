# AJAN A — ARENA: Creative Evolution Engine (şema sahibi)

Önce oku: `CLAUDE.md`, `HANDOFF.md` (§14, §21), `docs/CONTRACTS.md`. Sonra bu dosya.
Branch: `sprint/agent-a`. Sahip olduğun dosyalar: CONTRACTS §5. Deploy/push yok.

## 1. Amaç

Reklam yayına çıkmadan önce **çok sayıda copy adayını birçok tur döndürüp** en güçlü adayı seçen bir seçilim motoru. Instagram'ın yaptığı gibi "adayları yarıştır, zayıfı ele, güçlüyü çoğalt" — ama **bizim elimizde gerçek izleyici yok**; yerine:

- **deterministik kurallar** (Meta copy pratikleri + proje yasakları) ve
- **AI jüri paneli** (farklı bakış açılı birden fazla eleştirmen)

var. Bu yüzden çıktı **göreli bir sıralamadır**, performans tahmini değildir. Bu cümle kodda, promptta ve UI'da açıkça yer alır. Tahmini CTR/CPC/ROAS/erişim üretmek YASAK.

## 2. İlk iş: şema (t=0, diğer ajanlar bekliyor)

1. CONTRACTS §3'teki diff'in **tamamını** (B'nin `PublishKit` + `CampaignPlan` alanları, C'nin `BrandAsset` + `Brand` alanları dahil) `schema.prisma`'ya uygula.
2. `pnpm db:migrate` → migration adı `arena_kit_brand_assets`. `pnpm db:generate`.
3. `lib/options.ts`'e `CAMPAIGN_GOALS` ve `EVOLUTION_LIMITS` ekle.
4. Commit: `Şema: Arena + PublishKit + BrandAsset (sprint ortak migration)`. Kullanıcıya "migration commit'i hazır, B ve C cherry-pick edebilir" de. Ancak ondan sonra motora başla.

## 3. Döngü tasarımı

Bir koşu (`EvolutionRun`) = `maxRounds` tur. Her tur 4 aşama (`EvolutionStage`), her aşama **ayrı bir çağrıda** ilerler ve DB'ye yazar (Vercel 60 sn). `advanceEvolutionRun(runId)` hangi aşamada kaldıysa oradan devam eder; idempotent (aşama çıktısı zaten varsa atlar).

**Yarış koruması (zorunlu):** `after()` ve 3 sn'lik poller aynı anda birden fazla `advance` tetikler; "çıktı varsa atla" yetmez (hepsi yazmadan önce kontrol eder → jüri paneli 6× koşar, 429). Aşamaya başlamadan önce koşullu yazımla **claim** al: `EvolutionRound`'a `claimedAt DateTime?` alanı ekle (şemaya dahil et), `updateMany({ where: { id, stage: X, OR: [{ claimedAt: null }, { claimedAt: { lt: now-90s } }] }, data: { claimedAt: now } })`; `count !== 1` ise hiçbir iş yapmadan mevcut durumu döndür. 90 sn'den eski claim "çökmüş" sayılır ve devralınır. Aşama bitince `claimedAt = null` + `stage` ileri.

```
Tur 0  GENERATE  tohum adaylar (population adet) — mevcut creative prompt'unun
                 çeşitlendirilmiş hali: her aday FARKLI strateji ekseninde
                 (problem-hook / sosyal bağlam / ürün-odak / merak / kanıt /
                 kullanım senaryosu ...). Girdi: marka profili (+brandVoice/usp/
                 products varsa) + son COMPLETED research + son COMPLETED pattern
                 + Learning'ler (hipotez muamelesi) + goal + offer + instruction.
       LINT      deterministik kurallar (§4). "hard" ihlal → aday elenir,
                 jüriye gitmez. Tüm adaylar elendiyse tur GENERATE'e bir kez
                 daha döner (lint geri bildirimiyle); ikinci kez de boşsa FAILED.
       JUDGE     `judges` adet AI jüri; HER JÜRİ TEK ÇAĞRIDA turun tüm lint'ten
                 geçmiş adaylarını görür ve hepsini puanlar (aday başına çağrı
                 YOK — maliyet sınırı). Jüri çıktısı: aday başına boyut
                 puanları (1-10), kısa eleştiri, önerilen tek mutasyon.
       SELECT    totalScore hesabı, sıralama, `survivors` kadar elit seçimi,
                 `survived=true`. Yakınsama kontrolü (§5). Bitti → tur+1.
Tur 1+ GENERATE  elitler aynen taşınır (origin=ELITE) + jüri eleştirilerine
                 dayalı MUTASYON çocukları (origin=MUTATION, parentId) +
                 isteğe bağlı 1 CROSSOVER (iki elitin hook/body birleşimi).
                 Tek AI çağrısı: "şu elitler, şu eleştiriler, şu mutasyon
                 operatörleri → population-survivors adet çocuk üret".
       ...       aynı aşamalar.
Son    DONE      kazanan = son turun rank 1 adayı. Kazanan + sonraki 2 aday
                 `promoteCandidates` ile Creative'e PENDING yazılır
                 (yeni bir CreativeGeneration altında, instruction:
                 "Arena koşusu <runId>", **status: COMPLETED + finishedAt dolu** —
                 aksi halde QUEUED kalır ve manuel creative üretimi "süren üretim
                 var" diye sonsuza dek kilitlenir). summary yazılır.
```

Mutasyon operatörleri (promptta isimle geçer, çocuk hangi operatörle üretildiyse `why`'da yazar): `hook_swap`, `shorten_to_125`, `angle_shift`, `cta_change`, `social_context`, `proof_from_research` (yalnız araştırmada GERÇEKTEN olan bir bilgiyle), `learning_informed` (bir Learning'e dayanır, confidence ile).

Maliyet sınırı: tur başına `1 + judges` çağrı; varsayılan 4×(1+3)=16 çağrı. `EVOLUTION_LIMITS` dışı değer form doğrulamasında reddedilir. Markada aynı anda tek aktif koşu.

## 4. Deterministik lint (`lib/evolution/lint.ts`, saf fonksiyon, AI yok)

Kurallar (her biri `{ rule, severity, message }` üretir; `lintScore = 100 − Σ ceza`):

| Kural | Şiddet | Kontrol |
|---|---|---|
| `offer_without_permission` | hard | `offer` null iken copy'de indirim/yüzde/"ücretsiz"/"bedava"/"kampanya"/"fırsat"/"%N"/fiyat kalıbı (TR+EN liste) |
| `competitor_name` | hard | markanın `Competitor` kayıtlarındaki isimler copy'de geçiyor |
| `unsupported_number` | hard | copy'deki sayısal iddia (%, adet, yıl, "X müşteri") araştırma JSON'unda veya products'ta geçmiyor |
| `hook_late` | soft −15 | hook metni `primaryText`'in ilk 125 karakterinde yer almıyor |
| `headline_long` | soft −10 | headline > 40 karakter |
| `primary_too_long` | soft −10 | primaryText > 600 karakter |
| `cta_unknown` | soft −5 | cta boş veya 4 kelimeden uzun |
| `duplicate_sibling` | soft −20 | aynı turdaki başka adayla token Jaccard benzerliği > 0.6 (çeşitlilik cezası) |
| `language_mismatch` | soft −10 | basit heuristik: copy dili `tr` iken metinde TR karakter/ek yok (kaba kontrol, yanlış pozitif düşük tut) |

Kelime listeleri ve eşikler dosya başında sabit; testleri `lib/evolution/__tests__/lint.test.ts` (Node `node --test` + `tsx`; repo'da test altyapısı yoksa `tsx` dev-dep ekleyip `pnpm --filter @adscore/web test` script'i aç — yalnız bu kadar).

## 5. Skor birleştirme ve yakınsama (`lib/evolution/select.ts`, saf)

- Jüri boyutları (her jüri aynı 4 boyutu puanlar, ama her jürinin **personası ve ağırlığı farklı**): `attention` (ilk saniye durdurucu mu), `clarity` (ne sunuyor, kime, neden şimdi), `brand_fit` (ses/konumlanma/araştırma ile tutarlı), `audience_fit` (hedef nota göre). Jüri personaları: *Scroll-stopper* (attention ×2), *Marka stratejisti* (brand_fit ×2), *Performans medya alıcısı* (clarity ×2), *Hedef kitle temsilcisi* (audience_fit ×2; persona araştırmadaki kitle hipotezinden türetilir). `judges=3` ise ilk üçü.
- `judgeScore` = jüriler arası ortalama (0-100'e ölçekli). Sıralama sağlamlığı için ek olarak **Borda**: her jürinin kendi sıralamasından puan; `totalScore = 0.55·judgeScore + 0.25·borda(0-100) + 0.20·lintScore`.
- Yakınsama (erken durdurma): son 2 turda en iyi `totalScore` artışı < 2 puan **veya** aynı aday (parentId zinciri) 2 tur üst üste 1. → koşu biter, `summary.convergence = "early"`.
- `summary`: `{ convergence, rounds_run, winnerRationale (jüri eleştirilerinden derlenmiş, AI'a tek kısa çağrıyla özetletilebilir), confidence: "low"|"medium"|"high" (jüriler arası uyuma göre: std sapma eşiği), dataBasis: { research: bool, pattern: bool, learnings: n }, disclaimer: "Göreli sıralama; performans tahmini değildir." }`.

## 6. Promptlar (`lib/evolution/prompts.ts`)

- Üretim promptu `lib/creatives/prompts.ts`'teki kuralları **aynen miras alır** (kopyala, değiştirme; ortak kuralları oradan import etmek yerine string tekrarı kabul — o dosya senin değil). Ek: strateji ekseni listesi, mutasyon operatörleri, elit/eleştiri girdileri.
- Jüri promptu: persona + "sayı tahmin etme, yalnızca kıyasla" + çıktı şeması `{ scores: { [candidateId]: { attention, clarity, brand_fit, audience_fit, critique, suggested_mutation } }, ranking: [candidateId] }`.
- JSON parse hatası → aynı aşama bir kez retry (provider retry'ı zaten var), yine olmazsa FAILED + `error`.

## 7. Action'lar ve UI

- `actions/evolution.ts`: CONTRACTS §4 imzaları. `startEvolutionRun` kapıları: sahiplik, COMPLETED research şart, aktif koşu yok, `EVOLUTION_LIMITS` doğrulaması, `goal ∈ CAMPAIGN_GOALS`. Koşuyu oluşturur, `after()` ile ilk `advanceEvolutionRun` tetikler. Audit: `evolution.started/advanced/completed/cancelled/promoted`.
- `components/evolution/arena-poller.tsx`: koşu RUNNING iken 3 sn'de bir `advanceEvolutionRun(runId)` çağırır **ve** `router.refresh()`. (after() tek aşama ilerletir; devamı poller'dan gelir — sekme kapanırsa koşu kaldığı yerde bekler, tekrar açılınca sürer. Bu sınır UI'da yazar.)
- `/app/brands/[id]/arena`: koşu başlatma formu (goal, offer, instruction, gelişmiş: tur/aday/elit/jüri sayısı + "tahmini AI çağrısı: N") + geçmiş koşular.
- `/app/brands/[id]/arena/[runId]`: tur zaman çizelgesi (aşama çipleri), tur başına aday kartları (skor dökümü: lint/jüri/Borda/total; eleştiriler; elenme nedeni; ebeveyn bağlantısı), kazanan kartı + "Onay akışına gönderildi → Creative Studio" linki, özet + disclaimer. Mevcut `components/ui.tsx` bileşenlerini kullan; yeni görsel dil icat etme.

## 8. Doğrulama

- Lint testleri (en az: offer yasağı, rakip adı, desteklenmeyen sayı, hook_late, duplicate).
- Gerçek Gemini ile "Örnek Kahve" (dev DB'de var) üzerinde tam koşu: 3 tur × 4 aday × 2 jüri. Kanıt: tur başına aşama geçişleri, elenen aday + nedeni, kazananın Creative Studio'da PENDING görünmesi, token sayıları, summary.
- Yarıda sekme kapatma → tekrar açma → devam ettiğini doğrula.
- İptal akışı + audit.
- `pnpm lint`, `pnpm build`.
- `docs/REPORT-A.md` yaz (CONTRACTS §6/5).
