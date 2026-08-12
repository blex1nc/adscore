"use client";

import { useEffect, useRef } from "react";

// TODO(launch): Üçüncü taraf CDN yer tutucusu (HANDOFF §22.2).
// Public deploy ÖNCESİ kendi video asset'imizle değiştirilecek.
const VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260729_102822_0e6c87e8-c141-4744-bf32-ad30db296371.mp4";

const MAX_FRAMES = 60;
const FRAME_WIDTH = 960;
const LERP = 0.12;
const EXTRACTION_DELAY_MS = 1500;

/**
 * Referans A'nın scroll-scrubbed video davranışı:
 * scroll ilerlemesi video zaman çizelgesine lerp ile eşlenir.
 * Tercih edilen yol: frame cache (ImageBitmap) + canvas.
 * CORS frame okumaya izin vermezse fallback: video seek.
 */
export function ScrollVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    let raf = 0;
    let target = 0;
    let smoothed = 0;
    let frames: ImageBitmap[] = [];
    let framesReady = false;
    let disposed = false;

    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      target = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    };

    const drawCover = (
      ctx: CanvasRenderingContext2D,
      source: ImageBitmap,
      w: number,
      h: number,
    ) => {
      const scale = Math.max(w / source.width, h / source.height);
      const dw = source.width * scale;
      const dh = source.height * scale;
      ctx.drawImage(source, (w - dw) / 2, (h - dh) / 2, dw, dh);
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      lastDrawnIdx = -1;
    };

    let lastDrawnIdx = -1;
    const loop = () => {
      if (disposed) return;
      smoothed += (target - smoothed) * LERP;
      if (framesReady && frames.length > 0) {
        const idx = Math.min(
          frames.length - 1,
          Math.round(smoothed * (frames.length - 1)),
        );
        // Yalnızca kare değiştiğinde çiz; boşta sürekli repaint yapma
        if (idx !== lastDrawnIdx) {
          const ctx = canvas.getContext("2d");
          if (ctx) {
            drawCover(ctx, frames[idx], canvas.width, canvas.height);
            lastDrawnIdx = idx;
          }
        }
      } else if (video.duration) {
        const t = smoothed * Math.max(0, video.duration - 0.05);
        if (Math.abs(video.currentTime - t) > 0.04) {
          video.currentTime = t;
        }
      }
      raf = requestAnimationFrame(loop);
    };

    // Frame cache: offscreen video ile en fazla MAX_FRAMES kare çıkar
    const extractFrames = async () => {
      try {
        const off = document.createElement("video");
        off.crossOrigin = "anonymous";
        off.muted = true;
        off.playsInline = true;
        off.preload = "auto";
        off.src = VIDEO_URL;
        await new Promise<void>((resolve, reject) => {
          off.addEventListener("loadeddata", () => resolve(), { once: true });
          off.addEventListener("error", () => reject(new Error("load")), {
            once: true,
          });
        });
        await new Promise((r) => setTimeout(r, EXTRACTION_DELAY_MS));
        const count = Math.max(
          24,
          Math.min(MAX_FRAMES, Math.floor(off.duration * 12)),
        );
        const extracted: ImageBitmap[] = [];
        for (let i = 0; i < count; i++) {
          if (disposed) return;
          const t = (i / (count - 1)) * Math.max(0, off.duration - 0.05);
          await new Promise<void>((resolve) => {
            off.addEventListener("seeked", () => resolve(), { once: true });
            off.currentTime = t;
          });
          const scale = FRAME_WIDTH / off.videoWidth;
          extracted.push(
            await createImageBitmap(off, {
              resizeWidth: FRAME_WIDTH,
              resizeHeight: Math.round(off.videoHeight * scale),
            }),
          );
          // Her kare arasında render adımına nefes ver:
          // reveal animasyonları ve IntersectionObserver bloklanmasın
          await new Promise((r) => requestAnimationFrame(r));
        }
        frames = extracted;
        framesReady = true;
        canvas.style.opacity = "1";
        video.style.opacity = "0";
      } catch {
        // CORS veya yükleme hatası: seek fallback devrede kalır
      }
    };

    resize();
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(loop);
    const startExtraction = () => extractFrames();
    if (video.readyState >= 2) startExtraction();
    else video.addEventListener("loadeddata", startExtraction, { once: true });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", resize);
      frames.forEach((f) => f.close());
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-background"
    >
      <video
        ref={videoRef}
        src={VIDEO_URL}
        muted
        playsInline
        preload="auto"
        className="h-full w-full object-cover transition-opacity duration-500"
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full opacity-0 transition-opacity duration-500"
      />
    </div>
  );
}
