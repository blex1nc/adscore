import { test } from "node:test";
import assert from "node:assert/strict";
import {
  lintCandidate,
  lintCandidates,
  summarizeLintFeedback,
  type LintCandidateInput,
  type LintContext,
} from "../lint";

const RESEARCH = JSON.stringify({
  value_propositions: ["890 TL üzeri siparişlerde ücretsiz kargo"],
  products_services: [{ name: "Hario V60 Dripper seti" }],
});

const baseCtx: LintContext = {
  offer: null,
  competitorNames: ["Rakip Kahve Co"],
  copyLanguage: "tr",
  sourceTexts: [RESEARCH, "Örnek Kahve"],
};

function cand(over: Partial<LintCandidateInput> = {}): LintCandidateInput {
  return {
    id: "c1",
    hook: "Sabahın ilk yudumu başka",
    primaryText:
      "Sabahın ilk yudumu başka. Taze kavrulmuş çekirdekler, evde demlediğin her fincanı nitelikli bir deneyime çevirir.",
    headline: "Taze kavrulmuş, nitelikli",
    description: null,
    cta: "Hemen Keşfet",
    ...over,
  };
}

test("temiz aday: ihlal yok, skor 100", () => {
  const r = lintCandidate(cand(), baseCtx);
  assert.equal(r.issues.length, 0);
  assert.equal(r.score, 100);
  assert.equal(r.eliminated, false);
});

test("offer_without_permission: teklif yokken 'indirim' hard ihlal", () => {
  const r = lintCandidate(
    cand({ primaryText: "Sabahın ilk yudumu başka. Bu hafta indirimli fiyatlarla." }),
    baseCtx,
  );
  assert.ok(r.issues.some((i) => i.rule === "offer_without_permission" && i.severity === "hard"));
  assert.equal(r.eliminated, true);
  assert.ok(r.eliminatedReason);
});

test("offer_without_permission: teklif yokken yüzde/fiyat kalıbı hard ihlal", () => {
  for (const text of ["Sabahın ilk yudumu başka. %20 bugün.", "Sabahın ilk yudumu başka. 199 TL'ye.", "Sabahın ilk yudumu başka. 2 al 1 öde."]) {
    const r = lintCandidate(cand({ primaryText: text }), { ...baseCtx, sourceTexts: [RESEARCH, "199", "20"] });
    assert.ok(
      r.issues.some((i) => i.rule === "offer_without_permission"),
      `beklenen ihlal yok: ${text}`,
    );
  }
});

test("offer verildiyse teklif kelimesi serbest", () => {
  const r = lintCandidate(
    cand({ primaryText: "Sabahın ilk yudumu başka. İlk siparişe kargo bedava." }),
    { ...baseCtx, offer: "İlk siparişe kargo bedava" },
  );
  assert.ok(!r.issues.some((i) => i.rule === "offer_without_permission"));
});

test("'free' kelime içinde geçince (freedom) yanlış pozitif vermez", () => {
  const r = lintCandidate(
    cand({ primaryText: "Sabahın ilk yudumu başka. Freedom in every cup, çünkü özgürlük." }),
    baseCtx,
  );
  assert.ok(!r.issues.some((i) => i.rule === "offer_without_permission"));
});

test("competitor_name: rakip adı hard ihlal (TR küçük/büyük harf duyarsız)", () => {
  const r = lintCandidate(
    cand({ primaryText: "Sabahın ilk yudumu başka. RAKİP KAHVE CO'dan farklı olarak biz taze kavururuz." }),
    baseCtx,
  );
  assert.ok(r.issues.some((i) => i.rule === "competitor_name" && i.severity === "hard"));
  assert.equal(r.eliminated, true);
});

test("unsupported_number: araştırmada olmayan sayı hard ihlal", () => {
  const r = lintCandidate(
    cand({ primaryText: "Sabahın ilk yudumu başka. 12.000 müşteri bizi seçti." }),
    baseCtx,
  );
  assert.ok(r.issues.some((i) => i.rule === "unsupported_number" && i.severity === "hard"));
});

test("unsupported_number: araştırmada GEÇEN sayı serbest (890 TL kargo eşiği, V60)", () => {
  const r = lintCandidate(
    cand({
      primaryText: "Sabahın ilk yudumu başka. V60 ile demle; 890 üzeri siparişte kargo bizden.",
    }),
    { ...baseCtx, offer: "890 TL üzeri ücretsiz kargo" },
  );
  assert.ok(!r.issues.some((i) => i.rule === "unsupported_number"), JSON.stringify(r.issues));
});

test("unsupported_number: küçük çıplak sayı iddia değil, iddia kelimesiyle iddia", () => {
  const ok = lintCandidate(cand({ primaryText: "Sabahın ilk yudumu başka. 3 adımda demle." }), baseCtx);
  assert.ok(!ok.issues.some((i) => i.rule === "unsupported_number"));
  const bad = lintCandidate(cand({ primaryText: "Sabahın ilk yudumu başka. 5 yıldız aldık." }), baseCtx);
  assert.ok(bad.issues.some((i) => i.rule === "unsupported_number"));
  const words = lintCandidate(cand({ primaryText: "Sabahın ilk yudumu başka. Binlerce müşteri." }), baseCtx);
  assert.ok(words.issues.some((i) => i.rule === "unsupported_number"));
});

test("hook_late: hook ilk 125 karakterde değilse soft −15", () => {
  const filler = "Bu bir giriş cümlesidir ve uzundur. ".repeat(5);
  const r = lintCandidate(
    cand({ primaryText: `${filler}Sabahın ilk yudumu başka.` }),
    baseCtx,
  );
  const issue = r.issues.find((i) => i.rule === "hook_late");
  assert.ok(issue && issue.severity === "soft");
  assert.equal(r.score, 85);
  assert.equal(r.eliminated, false);
});

test("hook_late: hook primary text'te hiç yoksa", () => {
  const r = lintCandidate(cand({ hook: "Bambaşka bir kanca" }), baseCtx);
  assert.ok(r.issues.some((i) => i.rule === "hook_late"));
});

test("headline_long / primary_too_long / cta_unknown soft cezalar birikir", () => {
  const r = lintCandidate(
    cand({
      headline: "Bu başlık kırk karakterden çok daha uzun bir başlıktır",
      primaryText: `Sabahın ilk yudumu başka. ${"x".repeat(600)}`,
      cta: "Şimdi hemen buraya tıkla ve al",
    }),
    baseCtx,
  );
  const rules = r.issues.map((i) => i.rule);
  assert.ok(rules.includes("headline_long"));
  assert.ok(rules.includes("primary_too_long"));
  assert.ok(rules.includes("cta_unknown"));
  assert.equal(r.score, 100 - 10 - 10 - 5);
});

test("duplicate_sibling: aynı turdaki çok benzer aday −20", () => {
  const a = cand({ id: "a" });
  const b = cand({ id: "b", primaryText: a.primaryText + " Evet." });
  const c = cand({
    id: "c",
    hook: "Öğleden sonra molası",
    primaryText: "Öğleden sonra molası için farklı bir demleme: aeropress ile yoğun, temiz bir fincan.",
    headline: "Öğleden sonra molası",
  });
  const res = lintCandidates([a, b, c], baseCtx);
  assert.ok(res.get("a")!.issues.some((i) => i.rule === "duplicate_sibling"));
  assert.ok(res.get("b")!.issues.some((i) => i.rule === "duplicate_sibling"));
  assert.ok(!res.get("c")!.issues.some((i) => i.rule === "duplicate_sibling"));
});

test("language_mismatch: tr dili ama Türkçe karakter yok", () => {
  const r = lintCandidate(
    cand({
      hook: "Morning coffee done right",
      primaryText: "Morning coffee done right. Fresh roasted beans for your home brewing ritual every day.",
      headline: "Fresh roasted beans",
    }),
    baseCtx,
  );
  assert.ok(r.issues.some((i) => i.rule === "language_mismatch"));
});

test("hard ihlal skoru da düşürür, en az 0", () => {
  const r = lintCandidate(
    cand({ primaryText: "Sabahın ilk yudumu başka. %50 indirim, Rakip Kahve Co'dan iyi, 10.000 müşteri." }),
    baseCtx,
  );
  assert.equal(r.score, 0);
  assert.equal(r.eliminated, true);
});

test("summarizeLintFeedback yalnız hard ihlalleri tekilleştirir", () => {
  const r1 = lintCandidate(cand({ primaryText: "Sabahın ilk yudumu başka. Bedava." }), baseCtx);
  const r2 = lintCandidate(cand({ primaryText: "Sabahın ilk yudumu başka. Bedava." }), baseCtx);
  const fb = summarizeLintFeedback([r1, r2]);
  assert.equal(fb.length, 1);
  assert.ok(fb[0].startsWith("offer_without_permission"));
});
