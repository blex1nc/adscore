"use client";

import { useLayoutEffect } from "react";

/*
 * Tek paylaşımlı scroll döngüsü: sayfadaki tüm [data-scrub] elemanlarını sürer.
 * Her sarmalayıcının kendi listener'ını açması yerine tek rAF ile ilerlenir.
 *
 * data-scrub="rise"  → kaydırdıkça alttan yükselir
 * data-scrub="slide" → kaydırdıkça sağdan sola gelir, mesafeye bağlı hafif blur
 * data-scrub-index   → sıra gecikmesi (slide'da mesafe de artar)
 */

const RISE = 150;
const SLIDE = 300;
const SLIDE_LAG = 110;
const BLUR = 7;

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export function ScrollMotion() {
  useLayoutEffect(() => {
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>("[data-scrub]"),
    );
    if (nodes.length === 0) return;

    const settle = () => {
      for (const el of nodes) {
        el.style.transform = "";
        el.style.opacity = "";
        el.style.filter = "";
      }
    };

    // Erişilebilirlik: hareket azaltma tercihinde animasyon yok.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      settle();
      return;
    }
    // Sayfa kaydırılamıyorsa (kısa viewport, test ortamı) her şey yerinde dursun.
    if (
      document.documentElement.scrollHeight <=
      (window.innerHeight || 0) + 4
    ) {
      settle();
      return;
    }

    let pending = false;

    const tick = () => {
      const vh = window.innerHeight || 900;
      for (const el of nodes) {
        const mode = el.dataset.scrub;
        const i = Number(el.dataset.scrubIndex ?? 0);
        const box = el.getBoundingClientRect();

        if (mode === "rise") {
          const e = easeOut(clamp((vh - box.top) / (vh * 0.42)));
          el.style.transform = `translate3d(0,${((1 - e) * RISE).toFixed(1)}px,0)`;
          el.style.opacity = (0.12 + 0.88 * e).toFixed(3);
          continue;
        }

        // slide
        const e = easeOut(clamp((vh - box.top) / (vh * 0.46) - i * 0.16));
        const x = (1 - e) * (SLIDE + i * SLIDE_LAG);
        el.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`;
        el.style.opacity = (0.1 + 0.9 * e).toFixed(3);
        const blur = (1 - e) * BLUR;
        el.style.filter = blur > 0.15 ? `blur(${blur.toFixed(2)}px)` : "";
      }
    };

    const onScroll = () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        tick();
      });
    };

    tick();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return null;
}
