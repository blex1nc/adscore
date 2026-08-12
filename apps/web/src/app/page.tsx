import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { LandingNav } from "@/components/landing/landing-nav";
import { Reveal } from "@/components/landing/reveal";
import { VideoBackground } from "@/components/landing/video-background";

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

      {/* NASIL ÇALIŞIR */}
      <section
        id="nasil-calisir"
        className="mx-auto max-w-5xl px-6 py-24 lg:px-[120px]"
      >
        <Reveal>
          <h2 className="font-display text-4xl md:text-5xl">
            Araştır, üret <em className="italic">ve</em> yayına hazırla
          </h2>
        </Reveal>
        <Reveal delay={150}>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            AdScore önerir ve üretir; bütçe, yayın ve her kritik karar sende
            kalır. Kampanya kiti, Ads Manager'da elle kurulum için gereken tüm
            ayarları verir.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {capabilities.map((cap, i) => (
            <Reveal key={cap.index} delay={200 + i * 120}>
              <div className="h-full rounded-2xl border border-border bg-card p-6">
                <span className="font-manrope text-xs font-medium tracking-[0.15em] text-muted-foreground">
                  {cap.index}
                </span>
                <h3 className="mt-3 flex items-center gap-1 text-lg font-medium">
                  {cap.title}
                  <ChevronRight size={16} className="text-foreground/40" />
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {cap.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>
    </div>
  );
}
