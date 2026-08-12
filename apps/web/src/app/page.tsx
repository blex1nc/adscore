import Link from "next/link";
import { ChevronRight, Hexagon } from "lucide-react";
import { Reveal } from "@/components/landing/reveal";
import { ScrollVideo } from "@/components/landing/scroll-video";

const services = [
  "/ MARKA ARAŞTIRMASI",
  "/ RAKİP REKLAM ANALİZİ",
  "/ ONAYLI META YAYINI",
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
    title: "Onaylı yayın",
    body: "Kampanya planını ve bütçeyi önizler. Sen onaylamadan hiçbir şey yayınlanmaz, tek kuruş harcanmaz.",
  },
];

const glassBadge =
  "border-l-2 border-accent bg-glass px-3 py-1.5 backdrop-blur-md font-mono text-[11px] uppercase tracking-[0.15em]";

export default function LandingPage() {
  return (
    <div className="skin-landing bg-background text-foreground">
      <ScrollVideo />
      <div className="relative z-10">
        <header className="fixed top-0 z-50 w-full border-b border-glass-border">
          <div className="flex items-center justify-between px-5 py-4 sm:px-8 md:px-12">
            <Reveal>
              <Link
                href="/"
                className="flex items-center gap-2 text-lg font-medium tracking-tight drop-shadow-md sm:text-xl"
              >
                <Hexagon size={24} strokeWidth={1.5} />
                adscore
              </Link>
            </Reveal>
            <nav className="hidden items-center gap-8 md:flex">
              <Reveal delay={100}>
                <a
                  href="#nasil-calisir"
                  className="text-sm text-muted-foreground transition-colors duration-300 hover:text-foreground"
                >
                  Nasıl çalışır
                </a>
              </Reveal>
            </nav>
            <Reveal delay={300}>
              <Link
                href="/login"
                className="rounded-md border border-glass-border bg-glass px-4 py-2 text-xs backdrop-blur-md transition-colors duration-300 hover:bg-glass-soft sm:px-5 sm:text-sm"
              >
                Giriş yap
              </Link>
            </Reveal>
          </div>
        </header>

        <main>
          {/* HERO */}
          <section className="flex min-h-screen flex-col justify-between px-5 pt-24 pb-12 sm:px-8 sm:pt-28 md:px-12 md:pb-16 supports-[height:100svh]:min-h-[100svh]">
            <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
              <div className="flex flex-col gap-2">
                {services.map((s, i) => (
                  <Reveal key={s} delay={150 + i * 120}>
                    <span className="font-mono text-xs uppercase tracking-[0.15em] text-foreground/90 drop-shadow-md">
                      {s}
                    </span>
                  </Reveal>
                ))}
              </div>
              <Reveal delay={300} className="max-w-xs sm:text-right">
                <p className="text-lg leading-relaxed drop-shadow-md sm:text-xl">
                  Markanı araştıran, rakiplerinden öğrenen ve reklamlarını senin
                  onayınla yayınlayan yapay zeka.
                </p>
              </Reveal>
            </div>

            <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
              <div>
                <Reveal delay={150}>
                  <span className={`${glassBadge} mb-5 inline-block`}>
                    Davetle erken erişim
                  </span>
                </Reveal>
                <Reveal delay={280}>
                  <h1 className="text-5xl font-normal leading-[1.05] tracking-tight drop-shadow-lg sm:text-6xl lg:text-7xl">
                    Araştır. Üret.
                    <br />
                    Yayınla.
                  </h1>
                </Reveal>
              </div>
              <Reveal delay={420}>
                <div className="flex items-center gap-4 rounded-xl bg-glass p-3 backdrop-blur-md">
                  <span className="flex h-24 w-20 items-center justify-center rounded-lg bg-glass-soft">
                    <Hexagon size={32} strokeWidth={1} />
                  </span>
                  <div className="flex flex-col gap-1.5 pr-2">
                    <span className="text-sm font-medium">Erken erişim</span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                      Davetli beta
                    </span>
                    <Link
                      href="/login"
                      className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-accent px-4 py-2 text-xs font-medium text-accent-foreground transition-colors duration-300 hover:opacity-85"
                    >
                      Panele gir
                      <ChevronRight size={14} />
                    </Link>
                  </div>
                </div>
              </Reveal>
            </div>
          </section>

          {/* Scroll scrub alanı (Referans A: 80vh spacer) */}
          <div aria-hidden className="h-[80vh]" />

          {/* SECTION TWO */}
          <section
            id="nasil-calisir"
            className="flex min-h-screen flex-col justify-between px-5 pt-24 pb-12 sm:px-8 sm:pt-28 md:px-12 md:pb-16 supports-[height:100svh]:min-h-[100svh]"
          >
            <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
              <Reveal delay={120}>
                <span className={glassBadge}>Onay sende</span>
              </Reveal>
              <Reveal delay={220} className="max-w-sm sm:text-right">
                <p className="text-lg leading-relaxed drop-shadow-md sm:text-xl">
                  AdScore önerir ve üretir. Bütçe, yayın ve her kritik karar
                  sende kalır.
                </p>
              </Reveal>
            </div>

            <div className="flex flex-1 flex-col justify-end gap-12 md:flex-row md:items-end md:justify-between md:gap-16">
              <div className="max-w-xl">
                <Reveal delay={180}>
                  <h2 className="text-5xl font-normal leading-[1.05] tracking-tight drop-shadow-lg sm:text-6xl lg:text-7xl">
                    Rakiplerinden
                    <br />
                    öğren.
                  </h2>
                </Reveal>
                <Reveal delay={320}>
                  <p className="mt-6 max-w-md text-sm text-muted-foreground drop-shadow-md sm:text-base">
                    Aynı pazardaki reklamları analiz eder, işe yarayan
                    yapıları çıkarır ve bunları markanın kimliğine uyarlar.
                    Sonuç taklit değil, markana özel strateji olur.
                  </p>
                </Reveal>
                <Reveal delay={420}>
                  <div className="mt-8 flex flex-wrap gap-3">
                    <Link
                      href="/login"
                      className="inline-flex items-center gap-1 rounded-full bg-accent px-5 py-2.5 text-xs font-medium text-accent-foreground transition-colors duration-300 hover:opacity-85 sm:text-sm"
                    >
                      Panele gir
                      <ChevronRight size={14} />
                    </Link>
                    <a
                      href="#nasil-calisir"
                      className="rounded-full border border-glass-border bg-glass-soft px-5 py-2.5 text-xs backdrop-blur-md transition-colors duration-300 hover:bg-glass sm:text-sm"
                    >
                      Davetle katıl
                    </a>
                  </div>
                </Reveal>
              </div>

              <div className="w-full max-w-md rounded-2xl border border-glass-border bg-glass-soft px-5 backdrop-blur-md sm:px-6">
                {capabilities.map((cap, i) => (
                  <Reveal key={cap.index} delay={300 + i * 110}>
                    <div
                      className={`flex gap-5 py-5 ${
                        i < capabilities.length - 1
                          ? "border-b border-glass-border"
                          : ""
                      }`}
                    >
                      <span className="font-mono text-[11px] tracking-[0.15em] text-muted-foreground">
                        {cap.index}
                      </span>
                      <div>
                        <div className="group flex items-center gap-1 text-base font-medium sm:text-lg">
                          {cap.title}
                          <ChevronRight
                            size={16}
                            className="text-foreground/40 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-foreground"
                          />
                        </div>
                        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                          {cap.body}
                        </p>
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
