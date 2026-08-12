# DESIGN REFERENCES

**Durum:** Kullanıcı tarafından 2026-08-12 tarihinde gönderildi.
**Amaç:** Bu dosya, kullanıcının onayladığı üç tasarım referansının **tam metnini** saklar.

Bu dosya bir implementation emri değildir.
Referanslar, mimari onaylandıktan sonra uyarlanacaktır.

Uyarlama sırasında geçerli kurallar için bkz. `HANDOFF.md` Bölüm 22 — **DESIGN — CONFLICTS & RISKS**.

---

## GÜNCELLEME — 2026-08-12 (akşam)

**REFERENCE A (NovaAI scroll-scrub) landing hero olarak KALDIRILDI.** Kullanıcı yeni bir hero referansı gönderdi ve "buna çevir" dedi. Yeni yön:

- Tam ekran **autoplay loop** video (scroll-scrub yok — kullanıcı geri bildirimi: "video oynatılmıyor bile"), overlay'siz.
- Video: `d8j0ntlcm91z4.cloudfront.net/.../hf_20260210_031346_d87182fb....mp4` (üçüncü taraf yer tutucu, §22.2 hâlâ geçerli).
- Fontlar: Manrope (nav/UI), Cabin (buton/etiket), Instrument Serif (başlık, italik vurgu), Inter (gövde).
- Renkler: mor `#7b39fc`, koyu mor `#2b2344`, beyaz Sign In butonu (`#d4d4d4` border, `#171717` metin), glass pill `rgba(85,80,110,.4)` + `rgba(164,132,215,.5)` border → hepsi `.skin-landing` token'larına çevrildi.
- Yapı: transparan navbar (logo + linkler + Giriş yap/Panele gir), ortalanmış hero (pill rozet + 96px serif başlık + 662px alt metin + 2 CTA), mobilde tam ekran hamburger menü.
- Uyarlanan copy: "Datacore/otel" metinleri AdScore'a çevrildi; "Reviews" linki kaldırıldı (henüz gerçek review yok); logo SVG path'i kesik geldiği için hexagon+wordmark yer tutucu.

Aşağıdaki REFERENCE A metni tarihçe olarak korunuyor; **hero için artık geçerli değil.** B (panel) ve C (hesaplayıcı) kararları değişmedi.

---

## KULLANIM HARİTASI

Kullanıcının her referans için belirttiği kullanım yeri:

| # | Referans | Nerede kullanılacak | Kullanıcının ifadesi |
|---|----------|---------------------|----------------------|
| **A** | NovaAI — dark cinematic, scroll-scrubbed video landing | **Sitenin ana giriş ekranı** (public marketing / landing) | "bu şekil bir tasarımı ise sitenin ana giriş ekranında kullanabilirsin" |
| **B** | Nexora — light SaaS hero + kod ile yazılmış dashboard preview | **Uygulama arayüzü** (giriş sonrası panel) | "bu sana attığım şey arayüz olarak kullanılabilir" |
| **C** | Webfluin — dark project estimation calculator | **Analiz sonrası bütçe → tahmini etkileşim hesaplayıcısı** | "analiz yapıldıktan sonra kaç tl harcarsan ne kadar etkileşim alacağını ortalama gösteren biryer için kullan" |

**Tema kararı:** Site **hem karanlık hem aydınlık** tema destekleyecektir.

---

## REFERENCE A — Landing / Ana Giriş Ekranı (NovaAI)

> Kullanım: Public landing page. Giriş yapmamış ziyaretçinin gördüğü ilk ekran.

### Exact recreation prompt — NovaAI landing page

Recreate this page **pixel-faithfully**. Stack: React + TypeScript + Vite + Tailwind CSS + lucide-react. Do not invent alternate copy, layout, fonts, colors, or effects.

#### Page identity

- **Title:** `NOVA_AI — Today AI Aligns With Bold Dreams`
- **Brand:** lowercase `novaai` with a Lucide `Hexagon` icon (size 24, strokeWidth 1.5) to the left
- **Overall feel:** dark cinematic AI marketing site; full-viewport scroll-scrubbed video background; white typography with drop shadows; frosted glass UI chips; sparse editorial layout; no purple gradients, no cream paper look, no card grids of icons

#### Assets (use these exact URLs)

**Hero scroll video (CloudFront — required):**

```
https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260729_102822_0e6c87e8-c141-4744-bf32-ad30db296371.mp4
```

Video content: abstract 3D forms (hanging white cables with glowing gold tips → organic white spherical / brain-like folds with warm orange core), soft blue-grey mist / grain background, floating bokeh particles. 1920×1080.

**Optional local mirrors for reliability:** `/hero.mp4` (same file) and `/hero-poster.jpg` (first-frame still). Prefer CloudFront URL in production code; local copy is fine for offline/dev.

**Portrait ("Talk with Mitha") — exact URL:**

```
https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260728_050334_5b076e26-0ce7-4898-b432-d764190e448f.png&w=1280&q=85
```

Display as `h-24 w-20` (`96×80px`), `rounded-lg`, `object-cover`. Alt: `Mitha, co-founder of NovaAI`.

#### Fonts

- Load Google Fonts Inter weights **400, 500, 600, 700**
- Body: `font-family: 'Inter', system-ui, sans-serif`
- Tailwind: both `font-sans` and `font-mono` map to Inter (mono labels still use `font-mono` class but render Inter)
- Antialiased text; selection color `rgba(255,255,255,0.2)`
- Page bg: `#0a0a0a`; default text white

#### Global structure

```
relative root
  ScrollVideo (fixed inset-0 z-0, pointer-events-none)
  relative z-10 wrapper
    Navbar (fixed top)
    main
      SectionOne (min-h-screen / 100svh)
      spacer div h-[80vh] (aria-hidden)  ← critical for scroll video length
      SectionTwo (min-h-screen / 100svh)
```

Horizontal padding rhythm everywhere: `px-5 sm:px-8 md:px-12`.
Section top padding under fixed nav: `pt-24 sm:pt-28`.
Bottom padding: `pb-12 md:pb-16`.

#### Scroll-scrubbed video background (exact behavior)

Fixed full-bleed layer `z-0`, bg `#0a0a0a`, `overflow-hidden`, `pointer-events-none`.

**Layers (bottom → top):**

1. Poster `<img>` — full cover; fades out (`opacity-0`, 500ms) once video has a decoded frame or frame cache is ready
2. `<video>` — muted, playsInline, preload=auto, object-cover; visible only while video has a frame and canvas frame-cache is not ready; then fade out
3. `<canvas>` — full cover; draws scrubbed frames; fades in when ready

**Scroll mapping:**

- `progress = scrollY / (scrollHeight - innerHeight)`, clamped 0–1
- Smooth with lerp: `smoothed += (target - smoothed) * 0.12` each `requestAnimationFrame`
- Draw with **object-cover** math (scale max, center crop)

**Frame cache (preferred smooth path):**

- Offscreen video loads same URL
- Extract up to **90** frames (or `duration * 12`, min 24), max width **960px**
- Wait until visible video has `loadeddata` + 300ms yield before extraction starts
- On ready, canvas draws cached `ImageBitmap`s by smoothed progress index

**Fallback:** seek the visible `<video>` to `smoothed * (duration - 0.05)` when frames aren't ready (seek if delta > 0.04s)

**Canvas DPR:** `min(devicePixelRatio, 2)`

Do **not** autoplay as a normal looping background — motion is **scroll-driven only**.

#### Reveal animation (every text/UI block)

IntersectionObserver, threshold `0.15`.
Hidden: `translate-y-8 opacity-0`
Visible: `translate-y-0 opacity-100`
Transition: `all 700ms ease-out`, `will-change-transform`
Per-element `transition-delay` in ms as specified below.

#### Glass / material system (exact tokens)

| Token | Classes |
|--------|---------|
| Glass panel | `bg-white/15 backdrop-blur-md` (or `bg-white/10` for larger panels) |
| Glass border | `border border-white/15` or `border-white/20` or `border-white/25` |
| Left-accent badge | `border-l-2 border-white bg-white/15 px-3 py-1.5 backdrop-blur-md` + mono uppercase label |
| Primary CTA | solid white pill/rounded, black text, hover `bg-white/85` |
| Secondary CTA | glass border + `bg-white/10` or `bg-white/15`, white text |
| Text over video | white + `drop-shadow-md` / `drop-shadow-lg` |
| Mono labels | `font-mono text-[10px]` or `text-[11px]` or `text-xs`, `uppercase`, `tracking-[0.15em]` |

#### Navbar (fixed, z-50)

- Full width, `border-b border-white/15`
- Row: logo left | center nav (md+) | CTA right
- Logo: Hexagon + `novaai` (`text-lg sm:text-xl font-medium tracking-tight`)
- Links (hidden below md): `Projects` with superscript `6` (`font-mono text-[10px] text-white/60`), `About`, `Blog`, `Contact` — `text-sm text-white/85`, hover `text-white`, gap `gap-8 lg:gap-10`
- CTA: `Get Free Consultation` — `rounded-md border border-white/20 bg-white/15 backdrop-blur-md px-4 py-2 text-xs sm:px-5 sm:text-sm`, hover `bg-white/25`
- Reveal delays: logo 0; links `100 + i*100` ms; CTA `500` ms

#### Section One — Hero

Full viewport flex column `justify-between`.

**Top row** (`flex-col gap-8` → `sm:flex-row justify-between`):

**Left — service list** (gap-2), each reveal delay `150 + i*120`:

```
/ AI AUTOMATION
/ AI INTEGRATION
/ AI AGENT DEVELOPMENT
```

Style: `font-mono text-xs uppercase tracking-[0.15em] text-white/90 drop-shadow-md`

**Right — intro** (`max-w-xs sm:text-right`, delay 300):

> We design automation that brings clarity, precision, and efficiency to the way your company operates.

`text-lg sm:text-xl leading-relaxed text-white drop-shadow-md`

**Bottom row** (`flex-col gap-8` → `md:flex-row items-end justify-between`):

**Left:**

1. Badge delay 150: `We Automate 100+ Businesses` — left-accent glass badge, `font-mono text-[11px] uppercase tracking-[0.15em]`, `mb-5`
2. H1 delay 280:

```
Clear. Precise.
Automated.
```

`text-5xl sm:text-6xl lg:text-7xl font-normal leading-[1.05] tracking-tight text-white drop-shadow-lg`

**Right — glass contact card** (delay 420):

- Container: `flex items-center gap-4 rounded-xl bg-white/15 p-3 backdrop-blur-md`
- Image: portrait URL above, `h-24 w-20 rounded-lg object-cover`
- Text column (`gap-1.5 pr-2`):
  - `Talk with Mitha` — `text-sm font-medium text-white`
  - `Co-founder of NovaAI` — mono `text-[10px] uppercase tracking-[0.15em] text-white/60`
  - Button: `Book 15-mins call` + Lucide `ChevronRight` size 14 — `rounded-full bg-white px-4 py-2 text-xs font-medium text-black`, hover `bg-white/85`, `mt-1.5`

#### Mid spacer

`div` with `h-[80vh]` between sections so scroll progress has room to scrub the video between hero and section two.

#### Section Two — Capability

Same full-viewport flex `justify-between` shell.

**Top row:**

**Left badge** delay 120: `Insight On Demand` — same left-accent glass badge as hero.

**Right copy** delay 220 (`max-w-sm sm:text-right`):

> Our AI doesn't just respond — it interprets, sharpens, and delivers the signal you need.

`text-lg sm:text-xl leading-relaxed text-white drop-shadow-md`

**Bottom area** (`flex-1 justify-end`, `flex-col gap-12` → `md:flex-row items-end justify-between gap-16`):

**Left column** (`max-w-xl`):

1. H2 delay 180:

```
Learn to see
brilliantly.
```

Same headline scale as H1 (`text-5xl sm:text-6xl lg:text-7xl … drop-shadow-lg`)

2. Body delay 320 (`mt-6 max-w-md text-sm sm:text-base text-white/80 drop-shadow-md`):

> From the first sketch to the final render, Nova turns raw intent into decisions your team can act on — quietly, precisely, at speed.

3. CTAs delay 420 (`mt-8 flex flex-wrap gap-3`):
   - Primary pill: `Run the demo` + ChevronRight 14 — `rounded-full bg-white px-5 py-2.5 text-xs sm:text-sm font-medium text-black`, hover `bg-white/85`
   - Secondary: `Free consultation` — `rounded-full border border-white/25 bg-white/10 backdrop-blur-md px-5 py-2.5 text-xs sm:text-sm`, hover `bg-white/20`

**Right — frosted capability panel**
`w-full max-w-md rounded-2xl border border-white/15 bg-white/10 backdrop-blur-md px-5 sm:px-6`

Three rows (dividers `border-b border-white/15` except last), each `flex gap-5 py-5`, reveal delay `300 + i*110`:

| # | Title | Body |
|---|--------|------|
| 01 | Real-time vision | Reads context as it happens and surfaces what matters before you ask. |
| 02 | Layered insight | Moves from rough outline to sharp output without losing the thread. |
| 03 | Adaptive speed | Learns your cadence and tightens every pass as you work. |

- Index: `font-mono text-[11px] tracking-[0.15em] text-white/55`
- Title: `text-base sm:text-lg font-medium text-white` + ChevronRight 16 (`text-white/40`, hover: translate-x-0.5 + `text-white`)
- Body: `mt-1.5 text-sm leading-relaxed text-white/70`

#### Interactions / motion checklist

1. Scroll scrub maps page scroll → video timeline (smoothed)
2. Staggered fade-up reveals on enter viewport (700ms, per-delay)
3. Button / link color transitions `duration-300`
4. Capability chevrons nudge right on hover
5. Poster → video → canvas opacity crossfades `duration-500`
6. No looping autoplay of hero video

#### Responsive rules

- Nav links hidden below `md`
- Hero/section stacks vertically on mobile; side-by-side from `sm`/`md` as specified
- Prefer `supports-[height:100svh]:min-h-[100svh]` plus `min-h-screen`
- Touch: video `playsInline` + muted

#### Do not

- Do not replace Inter with another display font
- Do not use a different video URL than the CloudFront URL above
- Do not use the old Pexels portrait
- Do not rebuild section two as icon card stacks
- Do not put opaque solid backgrounds over the video (only glass / transparent wrappers)
- Do not remove the `80vh` spacer

#### Acceptance

Top of page: fixed glass nav + service list + intro + "Clear. Precise. Automated." + Mitha glass card over scroll video.
Scrolling scrubbing advances the CloudFront video smoothly.
After spacer: "Insight On Demand" + "Learn to see brilliantly." + dual CTAs + three-item frosted capability panel.

---

### A — Uyarlama notları

**Alınacak:** scroll-scrubbed video tekniği, glass material sistemi, editorial/seyrek layout, mono uppercase etiketler, reveal animasyon sistemi, tipografi ölçeği.

**Değiştirilecek (zorunlu):**

- Marka adı, logo, tüm copy → NovaAI değil, bu projenin markası
- Video ve portre görselleri → bkz. `HANDOFF.md` Bölüm 22.2 (üçüncü taraf asset riski)
- "Talk with Mitha / Co-founder" kartı → gerçek olmayan kişi kullanılamaz
- "We Automate 100+ Businesses" → doğrulanmamış metrik, kullanılamaz
- Dark-only yapı → light tema varyantı gerekiyor (bkz. Bölüm 22.1)

---

## REFERENCE B — Uygulama Arayüzü (Nexora)

> Kullanım: Giriş sonrası panel arayüzü. Bu referansın **dashboard bölümü** asıl değerli kısımdır.

### SaaS landing page hero section — exact specifications

#### Page Layout

- The entire page is `h-screen flex flex-col bg-background overflow-hidden` — the Navbar + Hero fill exactly 100vh with no scroll.
- The page uses two Google Fonts imported via CSS: **Instrument Serif** (display/headings, including italic) and **Inter** (body text).

#### Fonts & Design Tokens (index.css)

Import fonts:

```css
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600&display=swap');
```

CSS variables (`:root`):

- `--background: 0 0% 100%` (white)
- `--foreground: 210 14% 17%` (dark charcoal)
- `--primary: 210 14% 17%` / `--primary-foreground: 0 0% 100%`
- `--secondary: 0 0% 96%` / `--secondary-foreground: 0 0% 9%`
- `--muted: 0 0% 96%` / `--muted-foreground: 184 5% 55%`
- `--accent: 239 84% 67%` (indigo/blue) / `--accent-foreground: 0 0% 100%`
- `--border: 0 0% 90%`
- `--ring: 239 84% 67%`
- `--radius: 0.5rem`
- `--font-display: 'Instrument Serif', serif`
- `--font-body: 'Inter', sans-serif`
- `--shadow-dashboard: 0 25px 80px -12px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.06)`

Tailwind config extends `fontFamily` with `display` and `body` mapped to the CSS vars. All colors use `hsl(var(--token))` pattern.

#### Navbar

- `flex items-center justify-between px-6 md:px-12 lg:px-20 py-5 font-body`
- Left: Logo text `✦ Nexora` — `text-xl font-semibold tracking-tight text-foreground`
- Right (hidden on mobile): Nav links "Home", "Pricing", "About", "Contact" — `text-sm text-muted-foreground hover:text-foreground` with `gap-8`
- CTA button: `rounded-full px-5 text-sm font-medium` using primary styling

#### Hero Section

**Background Video:** Fullscreen muted autoplay loop video, `absolute inset-0 w-full h-full object-cover z-0`

Video URL:

```
https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260319_015952_e1deeb12-8fb7-4071-a42a-60779fc64ab6.mp4
```

All content wrapped in `relative z-10 flex flex-col items-center w-full`

**1. Badge (top)**

- Framer Motion: fade up from `y:10`, duration 0.5s
- `inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-1.5 text-sm text-muted-foreground font-body`
- Text: "Now with GPT-5 support ✨"
- `mb-6`

**2. Headline**

- Framer Motion: fade up from `y:16`, duration 0.6s, delay 0.1s
- `text-center font-display text-5xl md:text-6xl lg:text-[5rem] leading-[0.95] tracking-tight text-foreground max-w-xl`
- Content: *The Future of Smarter Automation* — the word "Smarter" renders in Instrument Serif **italic**

**3. Subheadline**

- Framer Motion: fade up from `y:16`, duration 0.6s, delay 0.2s
- `mt-4 text-center text-base md:text-lg text-muted-foreground max-w-[650px] leading-relaxed font-body`
- Text: "Automate your busywork with intelligent agents that learn, adapt, and execute—so your team can focus on what matters most."

**4. CTA Buttons**

- Framer Motion: fade up from `y:16`, duration 0.6s, delay 0.3s
- `mt-5 flex items-center gap-3`
- Primary button: `rounded-full px-6 py-5 text-sm font-medium font-body` — text "Book a demo"
- Play button: ghost variant, `h-11 w-11 rounded-full border-0 bg-background shadow-[0_2px_12px_rgba(0,0,0,0.08)] hover:bg-background/80` with a Play icon (lucide) `h-4 w-4 fill-foreground`

**5. Dashboard Preview (custom coded, NOT an image)**

- Framer Motion: fade up from `y:30`, duration 0.8s, delay 0.5s
- Container: `mt-8 w-full max-w-5xl`
- Frosted glass wrapper: `rounded-2xl overflow-hidden p-3 md:p-4` with inline styles:
  - `background: rgba(255, 255, 255, 0.4)`
  - `border: 1px solid rgba(255, 255, 255, 0.5)`
  - `boxShadow: var(--shadow-dashboard)`

Dashboard internals (all coded in React, `text-[11px]`, `select-none pointer-events-none`):

- **Top bar:** Logo "N" in rounded box + "Nexora" + chevron | Search bar with ⌘K shortcut | "Move Money" + bell + avatar "JB"
- **Sidebar (`w-40`):** Items — Home (active), Tasks (badge "10"), Transactions, Payments (chevron), Cards, Capital, Accounts (chevron). Section "Workflows": Trake rutes, Payments, Notifications, Settings
- **Main content (`bg-secondary/30`):**
  - Greeting: "Welcome, Jane" — `text-sm font-semibold`
  - Action buttons row: Send (primary/accent), Request, Transfer, Deposit, Pay Bill, Create Invoice — rounded-full pill buttons `text-[10px]`, + "Customize" text
  - Two equal-width cards (`flex-1 basis-0`) side by side:
    - **Balance card:** "Mercury Balance" with checkmark, amount $8,450,190.32 (cents in `text-xs text-muted-foreground`), stats (Last 30 Days, +$1.8M green, -$900K red), SVG area chart (`h-20`) with smooth cubic Bézier curve, linear gradient fill from accent at 15% opacity to transparent, stroke in accent color `strokeWidth="1.5"`
    - **Accounts card:** Header "Accounts" with + and ⋮ icons. Three rows (`py-3`, no dividers, `text-xs`, `justify-between`): Credit $98,125.50, Treasury $6,750,200.00, Operations $1,592,864.82
  - **Transactions table:** "Recent Transactions" heading, table with columns Date/Description/Amount/Status. 4 rows: AWS -$5,200 Pending (amber), Client Payment +$125,000 Completed (green), Payroll -$85,450 Completed, Office Supplies -$1,200 Completed

#### Dependencies

- `framer-motion` for all animations
- `lucide-react` for all icons
- shadcn/ui Button component
- Tailwind CSS with `tailwindcss-animate` plugin

#### Key Design Decisions

- The dashboard overflows toward the bottom of the viewport and is clipped by `overflow-hidden` on the parent
- No dark mode — light only
- All colors use semantic Tailwind tokens, never raw color values in components
- The SVG chart uses a hand-crafted cubic Bézier path, not a charting library

---

### B — Uyarlama notları

**Alınacak:** design token sistemi (`hsl(var(--token))`), Instrument Serif + Inter tipografi eşleşmesi, frosted glass dashboard çerçevesi, sidebar + topbar + kart + tablo layout iskeleti, el yazımı SVG area chart yaklaşımı.

**Değiştirilecek (zorunlu):**

- Fintech içeriği (Mercury Balance, Move Money, Transactions, Treasury) → reklam metriklerine map edilecek: Spend, Reach, CTR, CPA, ROAS, kampanya listesi, creative listesi (bkz. `HANDOFF.md` Bölüm 3 — Analytics)
- "Now with GPT-5 support ✨" → doğrulanmamış ürün iddiası
- Landing hero kısmı **kullanılmayacak** — landing için Referans A seçildi. Bu referanstan alınan **dashboard iskeletidir**.
- `overflow-hidden` ile kırpma davranışı → gerçek panelde scroll gerekir, bu bir görsel efektti
- "No dark mode — light only" → bu proje için **geçersiz**, dark tema zorunlu (bkz. Bölüm 22.1)

---

## REFERENCE C — Bütçe / Tahmini Etkileşim Hesaplayıcısı (Webfluin)

> Kullanım: Analiz tamamlandıktan sonra gösterilecek "bu bütçeyle ortalama ne kadar etkileşim" ekranı.
> **Bu referansın hesaplama mantığı doğrudan kullanılamaz** — bkz. `HANDOFF.md` Bölüm 22.3.

### Recreate Project Estimation Calculator Section

Create a full-width dark calculator section with id `calculator-section`. Background: `bg-background`, padding `py-16 md:py-28 px-4 md:px-16`, max-width `max-w-7xl` centered.

**Header:** Centered. Small mono uppercase tracking-widest label "Try project estimation calculator" in `text-muted-foreground`. Below it, an `h2`: "Get premium website within your budget" — `text-3xl md:text-4xl lg:text-5xl font-normal`.

**Layout:** 2-column grid (`grid-cols-1 lg:grid-cols-2`), `rounded-2xl overflow-hidden`, no gap.

#### LEFT COLUMN (Calculator Form)

Background `#0D0D0D`, padding `p-8 lg:p-12`, sections divided by `divide-y divide-[#1E1E1E]`.

4 sections separated by horizontal dividers:

1. **Service Type (radio buttons):** h3 "What kind of service do you need?" — 3 options: "Only Design" (design), "Only Development" (development), "Design + Development" (both, default). Custom radio circles: `w-5 h-5 rounded-full border-2`, active = `border-[#FF5656]` with inner `w-2 h-2 rounded-full bg-[#FF5656]`.

2. **Number of Pages (slider):** h3 with current value in `#FF5656`. Shadcn `<Slider>` min=1, max=30, step=1, default=5. Labels "1" and "30" below.

3. **Add-ons (checkboxes):** Two checkboxes with price labels on the right in `#FF5656`:
   - "I will need help with content" → +$50/pages
   - "I want to optimize my website for SEO" → +$50/pages

   Custom checkboxes: `w-5 h-5 border-2 rounded`, checked = `border-[#FF5656] bg-[#FF5656]` with white SVG checkmark.

4. **Timeline (radio buttons):** h3 "How fast do you need this?" — 3 options with prices:
   - "Within 7 Days" → +$100/pages
   - "Within 14 Days" → +$25/pages
   - "Regular Speed (Based on discussion)" → no extra cost (default)

#### RIGHT COLUMN (Cost Estimation)

Padding `p-8 lg:p-12`, `border border-white/10 rounded-r-2xl`, min-height `717.98px`.

h3 "Estimated Cost" + description paragraph.

3 stacked cards (`rounded-2xl p-6 space-y-3`):

- **Agency card:** `bg-muted/50`. Title "Typical Agency charges minimum". Large price `text-4xl font-bold`. Subtitle: "+ Too much extra time & additional cost".
- **Freelancer card:** `bg-muted/50`. Title "Regular Freelancer charges minimum". Large price `text-4xl font-bold`. Subtitle: "+ Too much headache & back-and-forth".
- **Your price card:** `bg-gradient-to-r from-pink-500 to-orange-500 text-white`. Title "With Webfluin Studio". Price `text-5xl font-bold`. Subtitle: "Save your money, time & headache".

#### PRICING LOGIC

```text
calculatePrice():
  Base prices by service:
    design: base=399, perPage=100
    development: base=199, perPage=100
    both: base=499, perPage=200

  total = max(base, base + (pages - 1) * perPage)
  if needContent: total += pages * 50
  if needSEO: total += pages * 50
  if rush: total += pages * 100
  if fast: total += pages * 25

calculateAgencyCost():
  perPage = (both ? 1000 : 400)
  return 8000 + (pages - 1) * perPage

calculateFreelancerCost():
  perPage = (both ? 500 : 200)
  return 3000 + (pages - 1) * perPage
```

All prices displayed with `.toLocaleString()` and `$` prefix.

**State:** `serviceType` (design|development|both, default both), `pages` (number, default 5), `needContent` (bool), `needSEO` (bool), `timeline` (regular|fast|rush, default regular).

**Dependencies:** Shadcn Slider component, `useToast` hook.

---

### C — Uyarlama notları

**Alınacak:** iki kolonlu "sol=girdi / sağ=sonuç" layout, canlı güncellenen sonuç, slider + radio + checkbox etkileşim modeli, üç yığılmış sonuç kartı deseni.

**Değiştirilecek (zorunlu):**

- Web sitesi fiyatlandırma girdileri → reklam girdileri: bütçe, süre, hedef ülke, hedef kitle, kampanya amacı, format
- Sabit `calculatePrice` / `calculateAgencyCost` / `calculateFreelancerCost` formülleri → **tamamen atılacak.** Bu formüller uydurma sayılardır; bu projede tahmini performans göstermek için kullanılamaz (bkz. `CLAUDE.md` Bölüm 6 ve `HANDOFF.md` Bölüm 22.3)
- "Agency / Freelancer / With Webfluin Studio" karşılaştırma kartları → rakip küçültme deseni. Bunun yerine `HANDOFF.md` Bölüm 10'daki **conservative / recommended / aggressive** bütçe senaryolarına map edilmesi öneriliyor (kullanıcı onayı gerekir)
- Hard-coded renkler (`#0D0D0D`, `#FF5656`, `#1E1E1E`, pink→orange gradient) → design token'a çevrilecek
- `$` → para birimi dinamik olmalı (kullanıcı TL'den bahsetti; Meta ad account'un kendi para birimi de var)
- Sabit `min-height: 717.98px` → responsive değil, kaldırılacak
