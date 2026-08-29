import Link from "next/link";
import {
  BarChart3,
  ChevronRight,
  FileText,
  Lock,
  ScrollText,
} from "lucide-react";
import { CountUp } from "@/components/landing/count-up";
import { HeroCards } from "@/components/landing/hero-cards";
import { LandingNav } from "@/components/landing/landing-nav";
import { Reveal } from "@/components/landing/reveal";
import { ScrollMotion } from "@/components/landing/scroll-motion";

/*
 * Landing copy kuralı (CLAUDE.md §6/§31): uydurma kullanıcı/performans
 * istatistiği YOK. Aşağıdaki sayılar ürünün gerçek mekanik kurallarıdır.
 */

const stats = [
  {
    title: "Strateji",
    value: 3,
    note: "Her copy üretiminde üç farklı strateji denenir.",
  },
  {
    title: "Rakip kategorisi",
    value: 4,
    note: "Doğrudan, dolaylı, aspirasyonel ve creative rakipler ayrı tutulur.",
  },
  {
    title: "Gösterim şartı",
    value: 1000,
    suffix: "+",
    note: "Analiz bu eşiğin altında hiç koşmaz; sayı uydurmasın diye.",
  },
  {
    title: "Uydurma metrik",
    value: 0,
    note: "Veri yoksa tahmin üretmeyiz, bunu açıkça söyleriz.",
  },
];

const marqueeItems = [
  "Marka araştırması",
  "Rakip keşfi",
  "Ad Library taraması",
  "Creative analizi",
  "Pattern tespiti",
  "Kampanya planı",
  "Bütçe kapısı",
  "Öğrenme döngüsü",
];

const safety = [
  {
    icon: Lock,
    title: "Otomatik yayın kapalı",
    body: "Meta'da oluşturulan her kampanya, ad set ve reklam PAUSED gelir. Aktifleştirme senin açık onayınla olur.",
    state: "Varsayılan: kapalı",
  },
  {
    icon: BarChart3,
    title: "Bütçe kapısı",
    body: "Ad account için günlük bütçe tavanı belirlersin. Tavanı aşan bir yayın denemesi sistem tarafından reddedilir.",
    state: "Tavanı sen belirlersin",
  },
  {
    icon: ScrollText,
    title: "Denetim kaydı",
    body: "Kim, ne zaman, hangi işlemi yaptı; önceki durum, yeni durum, AI önerisi ve kullanıcı onayı birlikte saklanır.",
    state: "Her işlem loglanır",
  },
];

const evidence = [
  {
    k: "Evidence",
    title: "Ne gözlemlendi",
    body: "Kaç rakip, kaç reklam, hangi tarih aralığı ve hangi kaynaktan. Örneklem küçükse bu da yazılır.",
    chip: "Kaynak + tarih",
  },
  {
    k: "Hypothesis",
    title: "Ne anlama gelebilir",
    body: "Gözlemden çıkan yorum, gözlemin kendisinden ayrı tutulur. Hipotez kesinlik gibi sunulmaz.",
    chip: "Ayrı etiketlenir",
  },
  {
    k: "Confidence",
    title: "Ne kadar eminiz",
    body: "Low, medium, high. Güven seviyesi başarı olasılığı gibi gösterilmez; sadece kanıtın gücünü anlatır.",
    chip: "Low · Medium · High",
  },
];

const faqs = [
  {
    q: "Meta hesabımı bağlamam gerekiyor mu?",
    a: "Yayın için evet. Panelden Meta bağlantısını kurar, ad account ve sayfanı seçersin; istediğin an bağlantıyı kesebilirsin. Bağlamadan da araştırma, rakip analizi ve creative üretimini kullanabilir, kampanyayı kurulum kitiyle Ads Manager'da elle açabilirsin.",
  },
  {
    q: "AdScore reklamımı otomatik yayınlıyor mu?",
    a: "Hayır ve bu bilinçli bir tasarım kararı. Meta'da oluşturulan her nesne PAUSED durumda gelir; aktifleştirme, bütçe değişikliği ve yayın her zaman senin açık onayınla olur.",
  },
  {
    q: "Bütçemi koruyan bir şey var mı?",
    a: "Ad account için günlük bütçe tavanı tanımlarsın. Tavanı aşan bir yayın denemesi sistem tarafından reddedilir; yayın sonrası bütçe ve durum alanlarına otomatik dokunulmaz.",
  },
  {
    q: "Rakip reklamlarını kopyalıyor mu?",
    a: "Hayır. Reklamlar referans ve yapılandırılmış analiz olarak saklanır; birden fazla reklamdan çıkan pattern'ler markana uyarlanır. Rakip metni veya görseli asla yeniden kullanılmaz.",
  },
  {
    q: "Ne kadar etkileşim alacağımı söylüyor mu?",
    a: "Veri yokken hayır. Uydurma tahmin göstermek yerine 'Insufficient Data' deriz. Kampanyan çalışıp sonuç girdikçe analiz ve öğrenmeler gerçek verinle oluşur.",
  },
  {
    q: "Nasıl katılabilirim?",
    a: "AdScore şu an davetli erken erişimde. Davet linkin varsa hesabını oluşturabilirsin; giriş sayfasından ilerle.",
  },
];

const chipClass =
  "inline-block rounded-full bg-accent/15 px-2.5 py-1 font-cabin text-[10.5px] font-semibold uppercase tracking-[0.08em] text-accent";
const mutedChipClass =
  "inline-block rounded-full bg-foreground/[0.07] px-2.5 py-1 font-cabin text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground";
const rowClass =
  "flex items-center gap-3 rounded-[14px] border border-border bg-foreground/[0.045] px-4 py-3";
const eyebrowClass =
  "font-cabin text-xs font-semibold uppercase tracking-[0.16em] text-accent";

export default function LandingPage() {
  return (
    <div className="skin-landing overflow-x-hidden bg-background text-foreground">
      <ScrollMotion />

      {/* HERO — süzülen kartlar + imleç paralaksı */}
      <section className="relative flex min-h-screen flex-col overflow-hidden bg-[radial-gradient(900px_520px_at_50%_8%,rgba(123,57,252,0.28),transparent_70%),radial-gradient(700px_460px_at_88%_78%,rgba(43,35,68,0.75),transparent_72%)] [perspective:1200px]">
        <LandingNav />

        <div className="relative z-10 mt-16 flex flex-col items-center px-6 text-center lg:mt-24">
          <div className="flex items-center gap-2 rounded-full border border-glass-border bg-glass py-1.5 pl-1.5 pr-4 backdrop-blur">
            <span className="rounded-full bg-accent px-2.5 py-1 font-cabin text-[11px] font-semibold uppercase tracking-[0.1em] text-accent-foreground">
              Yeni
            </span>
            <span className="text-sm">Meta Ad Library rakip taraması yayında</span>
          </div>

          <h1 className="mt-6 max-w-[940px] font-manrope text-[40px] font-extrabold leading-[0.98] tracking-[-0.035em] text-balance md:text-[64px]">
            Reklamların tahmine değil,{" "}
            <em className="font-display not-italic italic text-accent/80">kanıta</em>{" "}
            dayansın
          </h1>

          <p className="mt-5 max-w-[560px] text-base leading-relaxed text-muted-foreground md:text-lg">
            Markanı gir; AdScore rakiplerin reklamlarını araştırır, pattern&apos;i
            çıkarır, sana özel creative ve kampanya planı hazırlar. Yayına çıkma
            kararı her zaman sende kalır.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/login"
              className="inline-flex min-h-[52px] items-center gap-2 rounded-full bg-accent px-6 font-cabin text-[15px] font-semibold text-accent-foreground transition-transform duration-300 hover:-translate-y-0.5 lg:min-h-[46px]"
            >
              Markanı analiz et
              <ChevronRight size={16} />
            </Link>
            <a
              href="#nasil-calisir"
              className="inline-flex min-h-[52px] items-center rounded-full border border-glass-border bg-glass px-6 font-cabin text-[15px] font-semibold text-foreground transition-transform duration-300 hover:-translate-y-0.5 lg:min-h-[46px]"
            >
              Nasıl çalışır
            </a>
          </div>
        </div>

        <HeroCards />

        <div className="relative z-10 mt-14 grid gap-3 px-6 pb-14 sm:grid-cols-2 lg:mt-auto lg:grid-cols-4 lg:px-10">
          {stats.map((s) => (
            <div
              key={s.title}
              className="rounded-[20px] border border-border bg-card/70 px-5 py-5 backdrop-blur transition-colors duration-300 hover:border-glass-border"
            >
              <div className="font-cabin text-[11.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {s.title}
              </div>
              <div className="mt-3 font-manrope text-[34px] font-extrabold leading-none tracking-[-0.03em]">
                <CountUp value={s.value} suffix={s.suffix ?? ""} />
              </div>
              <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">
                {s.note}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* MARQUEE */}
      <div className="overflow-hidden border-y border-border bg-[#0d0c10] py-5">
        <div className="marquee-track">
          {[0, 1].map((dup) => (
            <span
              key={dup}
              className="flex shrink-0 items-center gap-6 pr-6 font-cabin text-[13px] font-semibold uppercase tracking-[0.18em] whitespace-nowrap text-muted-foreground/70"
            >
              {marqueeItems.map((item) => (
                <span key={item} className="flex items-center gap-6">
                  {item}
                  <span className="text-accent/80">/</span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* ZİNCİR — kaydırdıkça alttan yükselen kartlar */}
      <section id="nasil-calisir" className="mx-auto max-w-[1360px] px-6 py-24 lg:px-10 lg:py-[120px]">
        <div className="mb-14 grid items-end gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-16">
          <Reveal>
            <div>
              <div className={eyebrowClass}>Zincirin tamamı</div>
              <h2 className="mt-4 font-manrope text-[36px] font-extrabold leading-[1.02] tracking-[-0.035em] text-balance md:text-[52px]">
                Marka girer, kanıtlı kampanya{" "}
                <em className="font-display not-italic italic text-accent/80">çıkar</em>
              </h2>
            </div>
          </Reveal>
          <Reveal delay={140}>
            <p className="text-base leading-relaxed text-muted-foreground md:text-lg">
              Üç durak. Her durakta ne bulduğunu, nereden bulduğunu ve ne kadar
              emin olduğunu söyler — bulunmayan veriyi uydurmaz.
            </p>
          </Reveal>
        </div>

        <div className="flex flex-col gap-5">
          {/* 01 — Araştırma */}
          <div
            data-scrub="rise"
            className="grid overflow-hidden rounded-[28px] border border-border bg-card transition-colors duration-300 hover:border-glass-border lg:grid-cols-2"
          >
            <div className="p-8 lg:p-[52px]">
              <div className={eyebrowClass}>01 — Araştırma</div>
              <h3 className="mt-4 font-manrope text-[26px] font-extrabold leading-[1.08] tracking-[-0.03em] md:text-[32px]">
                Markanı ve{" "}
                <em className="font-display not-italic italic text-accent/80">rakiplerini</em>{" "}
                tanır
              </h3>
              <p className="mt-4 max-w-[42ch] text-[15px] leading-relaxed text-muted-foreground md:text-base">
                Site, ürünler, fiyatlandırma, konumlandırma ve ses tonu
                çıkarılır; ardından niche üzerinden aday rakipler eklenir ve
                dört kategoriye ayrılır.
              </p>
              <div className="mt-7 grid gap-2.5 sm:grid-cols-2">
                <div className="rounded-2xl border border-border bg-foreground/[0.04] px-4 py-4">
                  <div className="font-cabin text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Rakip kategorisi
                  </div>
                  <div className="mt-2 font-manrope text-[21px] font-extrabold tracking-[-0.02em]">
                    4
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-foreground/[0.04] px-4 py-4">
                  <div className="font-cabin text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Kaynak kaydı
                  </div>
                  <div className="mt-2 font-manrope text-[21px] font-extrabold tracking-[-0.02em]">
                    Her satırda
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col justify-center gap-3 border-t border-border bg-[radial-gradient(520px_320px_at_70%_20%,rgba(123,57,252,0.22),transparent_70%)] p-6 lg:border-l lg:border-t-0 lg:p-10">
              {[
                ["Doğrudan rakipler", "Aynı ürün, aynı müşteri", true],
                ["Dolaylı rakipler", "Aynı problemi farklı çözen", false],
                ["Aspirasyonel rakipler", "Pazarda daha önde olanlar", false],
                ["Creative rakipler", "Benzer reklam stratejisi kullananlar", false],
              ].map(([title, sub, primary]) => (
                <div key={title as string} className={rowClass}>
                  <span className="size-8 shrink-0 rounded-[10px] bg-gradient-to-br from-accent to-cta-dark" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold tracking-[-0.01em]">
                      {title}
                    </span>
                    <span className="mt-0.5 block text-[11.5px] text-muted-foreground">
                      {sub}
                    </span>
                  </span>
                  <span className={primary ? chipClass : mutedChipClass}>
                    Kayıtlı
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 02 — Creative studio */}
          <div
            data-scrub="rise"
            className="grid overflow-hidden rounded-[28px] border border-border bg-card transition-colors duration-300 hover:border-glass-border lg:grid-cols-2"
          >
            <div className="flex flex-col justify-center gap-3 border-b border-border bg-[radial-gradient(520px_320px_at_30%_20%,rgba(123,57,252,0.22),transparent_70%)] p-6 lg:order-1 lg:border-b-0 lg:border-r lg:p-10">
              <div className="grid grid-cols-3 gap-3">
                {[
                  ["Hook A", "problem-çözüm", "from-cta-dark to-accent"],
                  ["Hook B", "sosyal kanıt", "from-accent to-[#a484d7]"],
                  ["Hook C", "ürün reveal", "from-[#16151c] to-[#3b3550]"],
                ].map(([label, sub, grad]) => (
                  <div
                    key={label as string}
                    className="overflow-hidden rounded-[14px] border border-border bg-foreground/[0.03]"
                  >
                    <div className={`h-24 bg-gradient-to-br ${grad}`} />
                    <div className="px-3 py-2.5 text-[11.5px] leading-snug text-muted-foreground">
                      {label} · {sub}
                    </div>
                  </div>
                ))}
              </div>
              <div className={rowClass}>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold">Gözlem</span>
                  <span className="mt-0.5 block text-[11.5px] text-muted-foreground">
                    Bir pattern en az üç reklamda tekrarlanmalı
                  </span>
                </span>
                <span className={mutedChipClass}>Observed</span>
              </div>
              <div className={rowClass}>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold">Hipotez</span>
                  <span className="mt-0.5 block text-[11.5px] text-muted-foreground">
                    Gözlemden çıkan yorum ayrı etiketlenir
                  </span>
                </span>
                <span className={chipClass}>Medium</span>
              </div>
            </div>
            <div className="p-8 lg:p-[52px]">
              <div className={eyebrowClass}>02 — Creative studio</div>
              <h3 className="mt-4 font-manrope text-[26px] font-extrabold leading-[1.08] tracking-[-0.03em] md:text-[32px]">
                Pattern&apos;i stratejiye, stratejiyi{" "}
                <em className="font-display not-italic italic text-accent/80">creative&apos;e</em>{" "}
                çevirir
              </h3>
              <p className="mt-4 max-w-[42ch] text-[15px] leading-relaxed text-muted-foreground md:text-base">
                Tek reklamdan sonuç çıkarılmaz. Tekrar eden hook, format ve
                teklif yapıları gözlem olarak ayrılır; hipotez ayrı etiketlenir.
                Çıktı rakip klonu değil, markana özel açıdır.
              </p>
              <div className="mt-7 grid gap-2.5 sm:grid-cols-2">
                <div className="rounded-2xl border border-border bg-foreground/[0.04] px-4 py-4">
                  <div className="font-cabin text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Strateji
                  </div>
                  <div className="mt-2 font-manrope text-[21px] font-extrabold tracking-[-0.02em]">
                    Copy başına 3
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-foreground/[0.04] px-4 py-4">
                  <div className="font-cabin text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Yayın
                  </div>
                  <div className="mt-2 font-manrope text-[21px] font-extrabold tracking-[-0.02em]">
                    Onaya bağlı
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 03 — Kampanya */}
          <div
            data-scrub="rise"
            className="grid overflow-hidden rounded-[28px] border border-border bg-card transition-colors duration-300 hover:border-glass-border lg:grid-cols-2"
          >
            <div className="p-8 lg:p-[52px]">
              <div className={eyebrowClass}>03 — Kampanya & optimizasyon</div>
              <h3 className="mt-4 font-manrope text-[26px] font-extrabold leading-[1.08] tracking-[-0.03em] md:text-[32px]">
                Bütçe kapısı senin{" "}
                <em className="font-display not-italic italic text-accent/80">elinde</em>
              </h3>
              <p className="mt-4 max-w-[42ch] text-[15px] leading-relaxed text-muted-foreground md:text-base">
                Plan önerilir, gerekçesi ve alternatifi yazılır. Yayın, bütçe
                artışı ve kampanya aktivasyonu açık onayını bekler; koyduğun
                tavanı sistem aşamaz.
              </p>
              <div className="mt-7 grid gap-2.5 sm:grid-cols-2">
                <div className="rounded-2xl border border-border bg-foreground/[0.04] px-4 py-4">
                  <div className="font-cabin text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Otomatik yayın
                  </div>
                  <div className="mt-2 font-manrope text-[21px] font-extrabold tracking-[-0.02em]">
                    Kapalı
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-foreground/[0.04] px-4 py-4">
                  <div className="font-cabin text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Denetim kaydı
                  </div>
                  <div className="mt-2 font-manrope text-[21px] font-extrabold tracking-[-0.02em]">
                    Her işlem
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col justify-center gap-3 border-t border-border bg-[radial-gradient(520px_320px_at_70%_20%,rgba(123,57,252,0.22),transparent_70%)] p-6 lg:border-l lg:border-t-0 lg:p-10">
              <div className={rowClass}>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold">Objective</span>
                  <span className="mt-0.5 block text-[11.5px] text-muted-foreground">
                    Öneri, gerekçesi ve alternatifiyle birlikte gelir
                  </span>
                </span>
                <span className={mutedChipClass}>Öneri</span>
              </div>
              <div className={rowClass}>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold">Bütçe tavanı</span>
                  <span className="mt-0.5 block text-[11.5px] text-muted-foreground">
                    Ad account için sen belirlersin, aşan istek reddedilir
                  </span>
                </span>
                <span className={chipClass}>Onay gerekli</span>
              </div>
              <div className={rowClass}>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold">Yayın durumu</span>
                  <span className="mt-0.5 block text-[11.5px] text-muted-foreground">
                    Oluşturulan her nesne PAUSED gelir
                  </span>
                </span>
                <span className={mutedChipClass}>Paused</span>
              </div>
              <div className={rowClass}>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold">Otomatik yayın</span>
                  <span className="mt-0.5 block text-[11.5px] text-muted-foreground">
                    Varsayılan olarak kapalı
                  </span>
                </span>
                <span className={mutedChipClass}>Off</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* GÜVENLİK — kaydırdıkça sağdan sola gelen kartlar */}
      <section className="overflow-hidden pb-24 lg:pb-[120px]">
        <div className="mx-auto max-w-[1360px] px-6 lg:px-10">
          <div className="mb-14 grid items-end gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-16">
            <Reveal>
              <div>
                <div className={eyebrowClass}>Harcama güvenliği</div>
                <h2 className="mt-4 font-manrope text-[36px] font-extrabold leading-[1.02] tracking-[-0.035em] text-balance md:text-[52px]">
                  Para harcayan her adım{" "}
                  <em className="font-display not-italic italic text-accent/80">kilitli</em>{" "}
                  gelir
                </h2>
              </div>
            </Reveal>
            <Reveal delay={140}>
              <p className="text-base leading-relaxed text-muted-foreground md:text-lg">
                Otomasyon varsayılan olarak kapalıdır. Açmak da, limit koymak da
                senin kararın.
              </p>
            </Reveal>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {safety.map((item, i) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  data-scrub="slide"
                  data-scrub-index={i}
                  className="h-full rounded-[24px] border border-border bg-card p-8 transition-colors duration-300 hover:border-glass-border"
                >
                  <span className="grid size-[42px] place-items-center rounded-[13px] bg-accent/15 text-accent">
                    <Icon size={20} strokeWidth={1.6} />
                  </span>
                  <h3 className="mt-6 font-manrope text-xl font-extrabold tracking-[-0.02em]">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-[14.5px] leading-relaxed text-muted-foreground">
                    {item.body}
                  </p>
                  <span className="mt-5 inline-flex items-center gap-2.5 font-cabin text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    <span className="relative h-[19px] w-[34px] shrink-0 rounded-full bg-foreground/15 after:absolute after:left-0.5 after:top-0.5 after:size-[15px] after:rounded-full after:bg-foreground/75 after:content-['']" />
                    {item.state}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* KARAR GÜNLÜĞÜ — aydınlık bant */}
      <section className="bg-surface py-24 text-surface-foreground lg:py-[120px]">
        <div className="mx-auto max-w-[1360px] px-6 lg:px-10">
          <div className="mb-14 grid items-end gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-16">
            <Reveal>
              <div>
                <div className="font-cabin text-xs font-semibold uppercase tracking-[0.16em] text-accent">
                  Karar günlüğü
                </div>
                <h2 className="mt-4 font-manrope text-[36px] font-extrabold leading-[1.02] tracking-[-0.035em] text-balance md:text-[52px]">
                  &ldquo;Bunu nereden{" "}
                  <em className="font-display not-italic italic text-accent">çıkardın?</em>
                  &rdquo; sorusunun cevabı hazır
                </h2>
              </div>
            </Reveal>
            <Reveal delay={140}>
              <p className="text-base leading-relaxed text-[#5a5866] md:text-lg">
                Her öneri kanıtı, hipotezi ve güven seviyesiyle birlikte
                kaydedilir. Yeterli veri yoksa sonuç değil, &ldquo;yetersiz
                veri&rdquo; yazar.
              </p>
            </Reveal>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {evidence.map((e, i) => (
              <Reveal key={e.k} delay={i * 90}>
                <div className="h-full rounded-[22px] border border-[#e6e4ee] bg-[#faf9fd] p-7">
                  <div className="font-cabin text-[11.5px] font-bold uppercase tracking-[0.14em] text-accent">
                    {e.k}
                  </div>
                  <h3 className="mt-3.5 font-manrope text-lg font-extrabold tracking-[-0.02em] text-[#1c1b24]">
                    {e.title}
                  </h3>
                  <p className="mt-2.5 text-[14.5px] leading-relaxed text-[#5a5866]">
                    {e.body}
                  </p>
                  <span className="mt-5 inline-block rounded-full bg-accent/10 px-3 py-1.5 font-cabin text-[10.5px] font-semibold uppercase tracking-[0.09em] text-accent">
                    {e.chip}
                  </span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* SSS */}
      <section className="mx-auto max-w-3xl px-6 py-24 lg:py-[120px]">
        <Reveal>
          <h2 className="text-center font-manrope text-[32px] font-extrabold leading-[1.02] tracking-[-0.035em] md:text-[44px]">
            Sorular{" "}
            <em className="font-display not-italic italic text-accent/80">ve</em>{" "}
            dürüst cevaplar
          </h2>
        </Reveal>
        <div className="mt-10 space-y-3">
          {faqs.map((f, i) => (
            <Reveal key={f.q} delay={80 + i * 70}>
              <details className="group rounded-2xl border border-border bg-card px-5 py-4 transition-colors duration-300 hover:border-glass-border">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold">
                  {f.q}
                  <ChevronRight
                    size={16}
                    className="shrink-0 text-muted-foreground transition-transform duration-300 group-open:rotate-90"
                  />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {f.a}
                </p>
              </details>
            </Reveal>
          ))}
        </div>
      </section>

      {/* FİNAL CTA */}
      <section className="mx-auto max-w-[1360px] px-6 pb-24 lg:px-10 lg:pb-[120px]">
        <Reveal>
          <div className="overflow-hidden rounded-[32px] border border-glass-border bg-[radial-gradient(680px_340px_at_50%_0%,rgba(123,57,252,0.34),transparent_72%),#100e16] px-8 py-20 text-center lg:px-14 lg:py-[88px]">
            <div className="font-cabin text-xs font-semibold uppercase tracking-[0.16em] text-accent">
              Başlamaya hazır mısın
            </div>
            <h2 className="mx-auto mt-4 max-w-[18ch] font-manrope text-[34px] font-extrabold leading-[1.02] tracking-[-0.035em] text-balance md:text-[52px]">
              Markanı gir, zincirin{" "}
              <em className="font-display not-italic italic text-accent/80">nereye</em>{" "}
              vardığını gör
            </h2>
            <p className="mx-auto mt-5 max-w-[48ch] text-base leading-relaxed text-muted-foreground md:text-lg">
              AdScore davetli erken erişimde. Hiçbir kampanya, sen
              &ldquo;yayınla&rdquo; demeden yayına çıkmaz.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/login"
                className="inline-flex min-h-[52px] items-center gap-2 rounded-full bg-accent px-6 font-cabin text-[15px] font-semibold text-accent-foreground transition-transform duration-300 hover:-translate-y-0.5 lg:min-h-[46px]"
              >
                Panele gir
                <ChevronRight size={16} />
              </Link>
              <a
                href="#nasil-calisir"
                className="inline-flex min-h-[52px] items-center rounded-full border border-glass-border bg-glass px-6 font-cabin text-[15px] font-semibold text-foreground transition-transform duration-300 hover:-translate-y-0.5 lg:min-h-[46px]"
              >
                Tekrar incele
              </a>
            </div>
          </div>
        </Reveal>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border">
        <div className="mx-auto max-w-[1360px] px-6 py-16 lg:px-10">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))]">
            <div>
              <span className="flex items-center gap-2 font-manrope text-lg font-extrabold tracking-[-0.02em]">
                <FileText size={20} strokeWidth={1.5} />
                adscore
              </span>
              <p className="mt-4 max-w-[34ch] text-sm leading-relaxed text-muted-foreground">
                Reklam zekâsı, creative üretimi ve kampanya yönetimi — kanıtla
                birlikte.
              </p>
            </div>
            <div>
              <h3 className="mb-4 font-cabin text-[11.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Ürün
              </h3>
              <ul className="flex flex-col gap-3 text-sm text-muted-foreground">
                <li>Marka araştırması</li>
                <li>Rakip istihbaratı</li>
                <li>Creative studio</li>
                <li>Kampanya planlayıcı</li>
              </ul>
            </div>
            <div>
              <h3 className="mb-4 font-cabin text-[11.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Platform
              </h3>
              <ul className="flex flex-col gap-3 text-sm text-muted-foreground">
                <li>Meta Ads</li>
                <li>Analitik</li>
                <li>Optimizasyon</li>
                <li>Denetim kaydı</li>
              </ul>
            </div>
            <div>
              <h3 className="mb-4 font-cabin text-[11.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Hesap
              </h3>
              <ul className="flex flex-col gap-3 text-sm text-muted-foreground">
                <li>
                  <a href="#nasil-calisir">Nasıl çalışır</a>
                </li>
                <li>
                  <Link href="/login">Giriş yap</Link>
                </li>
                <li>
                  <Link href="/login">Panele gir</Link>
                </li>
              </ul>
            </div>
          </div>

          <p className="mt-14 max-w-[96ch] border-t border-border pt-7 text-[12.5px] leading-relaxed text-muted-foreground/70">
            AdScore bir reklam yönetim arayüzüdür. Meta entegrasyonu yalnızca
            resmî ve izin verilen API&apos;ler üzerinden yapılır; erişim izinlerini
            sen verirsin ve istediğin an geri alabilirsin. Platform hiçbir
            performans, dönüşüm oranı veya getiri garantisi vermez; gösterilen
            tüm öneriler kanıt, hipotez ve güven seviyesiyle birlikte sunulur.
            Yeterli veri olmayan durumlarda sonuç üretmek yerine
            &ldquo;yetersiz veri&rdquo; gösterilir. Reklam harcaması başlatan
            hiçbir işlem, açık kullanıcı onayı olmadan gerçekleşmez.
          </p>
          <div className="mt-6 flex flex-wrap gap-6 text-[12.5px] text-muted-foreground/70">
            <span>© 2026 AdScore</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
