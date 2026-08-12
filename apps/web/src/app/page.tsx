import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CountUp } from "@/components/landing/count-up";
import { LandingNav } from "@/components/landing/landing-nav";
import { Reveal } from "@/components/landing/reveal";
import { VideoBackground } from "@/components/landing/video-background";

/*
 * Landing copy kuralı (CLAUDE.md §6/§31): uydurma kullanıcı/performans
 * istatistiği YOK. Aşağıdaki sayılar ürünün gerçek mekanik kurallarıdır.
 */

const stats = [
  { value: 3, label: "farklı strateji, her copy üretiminde" },
  { value: 4, label: "rakip kategorisi: doğrudan, dolaylı, aspirasyonel, creative" },
  { value: 1000, label: "gösterim şartı, analiz sayı uydurmasın diye", suffix: "+" },
  { value: 0, label: "uydurma metrik. Veri yoksa bunu açıkça söyleriz" },
];

const steps = [
  {
    index: "01",
    title: "Markanı tanıt",
    body: "İsim, website, hedef pazar ve reklam dili. Gerisini araştırma devralır.",
  },
  {
    index: "02",
    title: "Araştırma",
    body: "Sitenden kaynak takipli marka profili: konumlanma, ürünler, kitle hipotezleri.",
  },
  {
    index: "03",
    title: "Rakip analizi",
    body: "Rakip reklamları yapılandırılmış olarak çözümlenir: hook, teklif, format, funnel.",
  },
  {
    index: "04",
    title: "Pattern",
    body: "En az 3 reklamdan kanıt sayılı pattern'ler; tek reklamdan strateji çıkarılmaz.",
  },
  {
    index: "05",
    title: "Creative + kit",
    body: "Onayına sunulan copy varyantları ve Ads Manager için eksiksiz kurulum kiti.",
  },
  {
    index: "06",
    title: "Sonuç ve öğrenme",
    body: "Sonuçları girersin; teşhis, öneri ve markana özel öğrenmeler birikir.",
  },
];

const capabilities = [
  {
    index: "01",
    title: "Marka araştırması",
    body: "Markanı, niche'ini ve pazarını kaynak takipli olarak araştırır; her bulgunun nereden geldiği bellidir.",
  },
  {
    index: "02",
    title: "Reklam istihbaratı",
    body: "Rakip reklamlarını yapılandırılmış olarak analiz eder, tekrar eden pattern'leri çıkarır. Kopya değil, öğrenme.",
  },
  {
    index: "03",
    title: "Onaylı kurulum kiti",
    body: "Copy'den bütçe senaryosuna kampanyanın tüm ayarlarını hazırlar. Sen onaylamadan hiçbir şey kullanılmaz.",
  },
];

const principles = [
  {
    title: "Veri yoksa sayı yok",
    body: "Performans tahmini uydurmayız. Yetersiz veride ekran açıkça \"Insufficient Data\" der; analiz eşiğin altında hiç koşmaz.",
  },
  {
    title: "Onay her zaman sende",
    body: "Hiçbir copy onaysız kampanyaya girmez, hiçbir bütçe senin yerine harcanmaz. Sistem önerir, karar senindir.",
  },
  {
    title: "Kopya değil, öğrenme",
    body: "Rakip reklamları referans ve analiz olarak saklanır; çıkan pattern'ler markanın kimliğine uyarlanır, asla kopyalanmaz.",
  },
];

const faqs = [
  {
    q: "Meta hesabımı bağlamam gerekiyor mu?",
    a: "Hayır. AdScore sana kampanyanın tüm ayarlarını içeren bir kurulum kiti verir; reklamı Ads Manager'da kendin açarsın. Panel üzerinden OAuth bağlantısı ileride eklenecek.",
  },
  {
    q: "AdScore reklamımı otomatik yayınlıyor mu?",
    a: "Hayır ve bu bilinçli bir tasarım kararı. Onaysız hiçbir creative kullanılmaz, bütçe kararları ve yayın her zaman sende kalır.",
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

export default function LandingPage() {
  return (
    <div className="skin-landing bg-background text-foreground">
      {/* HERO — yeni referans (2026-08-12): tam ekran video + ortalanmış içerik */}
      <section className="relative flex min-h-screen flex-col overflow-hidden">
        <VideoBackground />
        <LandingNav />

        <div className="relative z-10 mt-32 flex flex-col items-center px-6 text-center">
          <div className="flex h-[38px] items-center gap-2 rounded-[10px] border border-glass-border bg-glass px-2.5 backdrop-blur">
            <span className="rounded-[6px] bg-accent px-2 py-0.5 font-cabin text-xs font-medium text-accent-foreground">
              Yeni
            </span>
            <span className="font-cabin text-sm font-medium">
              AdScore davetli beta yayında
            </span>
          </div>

          <h1 className="mt-6 max-w-4xl font-display text-5xl leading-[1.1] md:text-[96px]">
            Reklamlarını anında{" "}
            <em className="italic tracking-tight">ve</em> zahmetsizce oluştur
          </h1>

          <p className="mt-6 max-w-[662px] text-lg leading-relaxed text-foreground/70">
            Markanı araştıran, rakip reklamlarından öğrenen ve kampanya
            kurulumunu hazır teslim eden yapay zeka. Onay ve bütçe her zaman
            senin kontrolünde.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/login"
              className="rounded-[10px] bg-accent px-6 py-3 font-cabin text-base font-medium text-accent-foreground transition-opacity duration-300 hover:opacity-90"
            >
              Panele gir
            </Link>
            <a
              href="#nasil-calisir"
              className="rounded-[10px] bg-cta-dark px-6 py-3 font-cabin text-base font-medium text-cta-dark-foreground transition-[filter] duration-300 hover:brightness-125"
            >
              Nasıl çalışır
            </a>
          </div>
        </div>
      </section>

      {/* İSTATİSTİK BANDI — ürünün gerçek mekanik sayıları */}
      <section className="border-b border-border">
        <div className="mx-auto grid max-w-5xl gap-10 px-6 py-16 sm:grid-cols-2 lg:grid-cols-4 lg:px-[120px]">
          {stats.map((s, i) => (
            <Reveal key={s.label} delay={i * 120}>
              <div>
                <div className="font-display text-5xl md:text-6xl">
                  <CountUp value={s.value} suffix={s.suffix ?? ""} />
                </div>
                <p className="mt-2 max-w-[220px] text-sm leading-relaxed text-muted-foreground">
                  {s.label}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* SÜREÇ — 6 adım */}
      <section className="mx-auto max-w-5xl px-6 py-24 lg:px-[120px]">
        <Reveal>
          <h2 className="font-display text-4xl md:text-5xl">
            Markadan yayına <em className="italic">altı</em> adım
          </h2>
        </Reveal>
        <Reveal delay={120}>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Her adımın çıktısı bir sonrakini besler; her çıktı kaynağıyla
            birlikte saklanır.
          </p>
        </Reveal>
        <ol className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map((step, i) => (
            <Reveal key={step.index} delay={150 + i * 100}>
              <li className="group relative border-l-2 border-border pl-5 transition-colors duration-300 hover:border-accent">
                <span className="font-manrope text-xs font-semibold tracking-[0.2em] text-accent">
                  {step.index}
                </span>
                <h3 className="mt-1.5 text-lg font-medium">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {step.body}
                </p>
              </li>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* NASIL ÇALIŞIR — yetenek kartları */}
      <section
        id="nasil-calisir"
        className="border-y border-border"
      >
        <div className="mx-auto max-w-5xl px-6 py-24 lg:px-[120px]">
          <Reveal>
            <h2 className="font-display text-4xl md:text-5xl">
              Araştır, üret <em className="italic">ve</em> yayına hazırla
            </h2>
          </Reveal>
          <Reveal delay={150}>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
              AdScore önerir ve üretir; bütçe, yayın ve her kritik karar sende
              kalır. Kampanya kiti, Ads Manager'da elle kurulum için gereken
              tüm ayarları verir.
            </p>
          </Reveal>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {capabilities.map((cap, i) => (
              <Reveal key={cap.index} delay={200 + i * 120}>
                <div className="group h-full rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-accent/40">
                  <span className="font-manrope text-xs font-medium tracking-[0.15em] text-muted-foreground">
                    {cap.index}
                  </span>
                  <h3 className="mt-3 flex items-center gap-1 text-lg font-medium">
                    {cap.title}
                    <ChevronRight
                      size={16}
                      className="text-foreground/40 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-accent"
                    />
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {cap.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* İLKELER */}
      <section className="mx-auto max-w-5xl px-6 py-24 lg:px-[120px]">
        <Reveal>
          <h2 className="font-display text-4xl md:text-5xl">
            Söz verdiğimiz <em className="italic">üç</em> şey
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {principles.map((p, i) => (
            <Reveal key={p.title} delay={150 + i * 120}>
              <div className="h-full rounded-2xl bg-cta-dark p-6 transition-transform duration-300 hover:-translate-y-1">
                <h3 className="text-lg font-medium text-cta-dark-foreground">
                  {p.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-cta-dark-foreground/70">
                  {p.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* SSS */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-3xl px-6 py-24 lg:px-0">
          <Reveal>
            <h2 className="text-center font-display text-4xl md:text-5xl">
              Sorular <em className="italic">ve</em> dürüst cevaplar
            </h2>
          </Reveal>
          <div className="mt-10 space-y-3">
            {faqs.map((f, i) => (
              <Reveal key={f.q} delay={100 + i * 80}>
                <details className="group rounded-xl border border-border bg-card px-5 py-4 transition-colors duration-300 hover:border-accent/40">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium">
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
        </div>
      </section>

      {/* FİNAL CTA */}
      <section className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-col items-center px-6 py-28 text-center lg:px-[120px]">
          <Reveal>
            <h2 className="max-w-3xl font-display text-5xl leading-[1.1] md:text-7xl">
              Reklamın hazır, karar <em className="italic">senin</em>
            </h2>
          </Reveal>
          <Reveal delay={150}>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
              Davetli beta sürüyor. Davetin varsa panele gir; araştırmadan
              kurulum kitine tüm akış seni bekliyor.
            </p>
          </Reveal>
          <Reveal delay={280}>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/login"
                className="rounded-[10px] bg-accent px-6 py-3 font-cabin text-base font-medium text-accent-foreground transition-opacity duration-300 hover:opacity-90"
              >
                Panele gir
              </Link>
              <a
                href="#nasil-calisir"
                className="rounded-[10px] bg-cta-dark px-6 py-3 font-cabin text-base font-medium text-cta-dark-foreground transition-[filter] duration-300 hover:brightness-125"
              >
                Tekrar incele
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row lg:px-[120px]">
          <span className="font-manrope font-semibold text-foreground">
            adscore
          </span>
          <nav className="flex items-center gap-6">
            <a
              href="#nasil-calisir"
              className="transition-colors duration-300 hover:text-foreground"
            >
              Nasıl çalışır
            </a>
            <Link
              href="/login"
              className="transition-colors duration-300 hover:text-foreground"
            >
              Giriş yap
            </Link>
          </nav>
          <span>© 2026 AdScore</span>
        </div>
      </footer>
    </div>
  );
}
