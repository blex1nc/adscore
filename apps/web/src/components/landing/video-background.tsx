// TODO(launch): Üçüncü taraf CDN yer tutucusu (HANDOFF §22.2).
// Public deploy ÖNCESİ kendi video asset'imizle değiştirilecek.
const VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260210_031346_d87182fb-b0af-4273-84d1-c6fd17d6bf0f.mp4";

// Yeni hero referansı (2026-08-12): overlay'siz, opak, autoplay loop video.
// Scroll-scrub kaldırıldı (kullanıcı geri bildirimi: video hemen oynasın).
export function VideoBackground() {
  return (
    <video
      src={VIDEO_URL}
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover"
    />
  );
}
