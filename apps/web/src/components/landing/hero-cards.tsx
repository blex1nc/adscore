"use client";

import { useEffect, useRef } from "react";
import { FileText, LineChart, Search, ShieldCheck } from "lucide-react";

/*
 * Hero'da süzülen kartlar: her kart kendi periyodunda salınır (CSS keyframe),
 * masaüstünde imleç uzaklığına göre derinlik katsayısıyla kayar.
 * Mobilde kartlar akış içinde alt alta dizilir, paralaks çalışmaz.
 */

const DEPTH = [1, 0.55, 0.8, 0.4];
const REST = [
  { x: -4, y: 5 },
  { x: 5, y: -4 },
  { x: -6, y: -5 },
  { x: 4, y: 6 },
];
const MAX = 60;

const cards = [
  {
    icon: Search,
    title: "Rakip bulundu",
    sub: "Ad Library taraması",
    tag: "Doğrudan",
    place: "lg:left-[30px] lg:top-[214px]",
    float: "float-a",
  },
  {
    icon: LineChart,
    title: "Hook analizi",
    sub: "En az 3 reklamdan pattern",
    tag: "Gözlem",
    place: "lg:left-[104px] lg:top-[512px]",
    float: "float-b",
  },
  {
    icon: FileText,
    title: "Creative taslağı",
    sub: "Onay bekliyor",
    tag: "Taslak",
    place: "lg:left-[1172px] lg:top-[196px]",
    float: "float-c",
  },
  {
    icon: ShieldCheck,
    title: "Bütçe kapısı",
    sub: "Onayın olmadan harcama yok",
    tag: "Kilitli",
    place: "lg:left-[1092px] lg:top-[498px]",
    float: "float-d",
  },
];

export function HeroCards() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(min-width: 1024px)").matches) return;

    const tilts = Array.from(
      root.querySelectorAll<HTMLElement>("[data-tilt]"),
    );
    const set = (el: HTMLElement, i: number, dx: number, dy: number) => {
      const r = REST[i % REST.length];
      el.style.transform =
        `translate3d(${dx.toFixed(1)}px,${dy.toFixed(1)}px,0) ` +
        `rotateX(${(r.x - dy * 0.05).toFixed(2)}deg) ` +
        `rotateY(${(r.y + dx * 0.05).toFixed(2)}deg)`;
    };
    tilts.forEach((el, i) => set(el, i, 0, 0));

    const parent = root.parentElement ?? root;
    const onMove = (e: PointerEvent) => {
      const b = parent.getBoundingClientRect();
      const nx = (e.clientX - b.left - b.width / 2) / (b.width / 2);
      const ny = (e.clientY - b.top - b.height / 2) / (b.height / 2);
      tilts.forEach((el, i) => {
        const d = DEPTH[i % DEPTH.length];
        set(el, i, nx * MAX * d, ny * MAX * d);
      });
    };
    const onLeave = () => tilts.forEach((el, i) => set(el, i, 0, 0));

    parent.addEventListener("pointermove", onMove);
    parent.addEventListener("pointerleave", onLeave);
    return () => {
      parent.removeEventListener("pointermove", onMove);
      parent.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="mt-12 flex flex-col gap-3 px-6 lg:pointer-events-none lg:absolute lg:inset-0 lg:mt-0 lg:block lg:px-0"
    >
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.title} className={`lg:absolute lg:w-[238px] ${card.place}`}>
            <div data-tilt className="transition-transform duration-[600ms] ease-out">
              <div className={card.float}>
                <div className="rounded-[18px] border border-border bg-card/85 p-4 shadow-[0_30px_60px_-26px_rgba(0,0,0,0.95)] backdrop-blur-md">
                  <div className="flex items-center gap-3">
                    <span className="grid size-[30px] shrink-0 place-items-center rounded-[9px] bg-accent/20 text-accent">
                      <Icon size={15} strokeWidth={1.6} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold tracking-[-0.01em]">
                        {card.title}
                      </span>
                      <span className="mt-0.5 block text-[11.5px] text-muted-foreground">
                        {card.sub}
                      </span>
                    </span>
                  </div>
                  <div className="mt-3 flex flex-col gap-[7px]">
                    <span className="block h-[9px] w-[88%] rounded-[5px] bg-foreground/10" />
                    <span className="block h-[9px] w-[62%] rounded-[5px] bg-foreground/10" />
                  </div>
                  <span className="mt-3 inline-block rounded-full bg-accent/15 px-2 py-1 font-cabin text-[10px] font-semibold uppercase tracking-[0.09em] text-accent">
                    {card.tag}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
