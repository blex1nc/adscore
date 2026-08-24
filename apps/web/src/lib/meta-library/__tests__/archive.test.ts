// Ad Library saf yardımcıları — birim testler (fixture'lar yalnız test girdisi).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  composeAdInputText,
  buildLibraryMeta,
  hasAnalyzableText,
  isEuCovered,
  publicAdLibraryUrl,
  type ArchivedAdRow,
} from "../archive";

const sampleAd: ArchivedAdRow = {
  id: "1234567890",
  page_id: "111222333",
  page_name: "Beispiel Kaffee",
  ad_creation_time: "2026-07-01T10:00:00+0000",
  ad_delivery_start_time: "2026-07-02",
  ad_delivery_stop_time: "2026-08-01",
  ad_creative_bodies: [
    "Frisch gerösteter Kaffee — jetzt 20% Rabatt auf die erste Bestellung!",
  ],
  ad_creative_link_titles: ["Jetzt bestellen"],
  ad_creative_link_descriptions: ["Kostenloser Versand ab 30€"],
  ad_creative_link_captions: ["beispielkaffee.de"],
  publisher_platforms: ["FACEBOOK", "INSTAGRAM"],
  languages: ["de"],
  eu_total_reach: 15000,
};

test("composeAdInputText: metin alanları yapılandırılır, analiz eşiğini geçer", () => {
  const text = composeAdInputText(sampleAd);
  assert.ok(text.includes("Beispiel Kaffee"));
  assert.ok(text.includes("Frisch gerösteter Kaffee"));
  assert.ok(text.includes("2026-07-02"));
  assert.ok(text.includes("FACEBOOK, INSTAGRAM"));
  assert.ok(hasAnalyzableText(text));
});

test("composeAdInputText: metinsiz kayıt analiz eşiğini geçemez", () => {
  const text = composeAdInputText({ id: "99" });
  assert.equal(hasAnalyzableText(text), false);
});

test("publicAdLibraryUrl: token içermeyen halka açık link", () => {
  const url = publicAdLibraryUrl("1234567890");
  assert.equal(url, "https://www.facebook.com/ads/library/?id=1234567890");
  assert.ok(!url.includes("access_token"));
});

test("buildLibraryMeta: sorgu + tarih + kapsam notu kaydedilir (§37)", () => {
  const meta = buildLibraryMeta({
    ad: sampleAd,
    query: { searchTerms: "Beispiel Kaffee", country: "DE", adActiveStatus: "ALL" },
    retrievedAt: "2026-08-24T12:00:00.000Z",
    totalReturned: 7,
  });
  assert.equal(meta.source, "ads_archive");
  assert.equal((meta.query as { country: string }).country, "DE");
  assert.equal(meta.retrievedAt, "2026-08-24T12:00:00.000Z");
  assert.equal(meta.totalReturned, 7);
  assert.ok(typeof meta.scopeNote === "string" && (meta.scopeNote as string).length > 0);
  assert.equal(meta.euTotalReach, 15000);
  // snapshot URL/token hiçbir alanda yer almaz
  assert.ok(!JSON.stringify(meta).includes("access_token"));
});

test("isEuCovered: EU üyeleri true, TR false", () => {
  assert.equal(isEuCovered("DE"), true);
  assert.equal(isEuCovered("de"), true);
  assert.equal(isEuCovered("TR"), false);
  assert.equal(isEuCovered(null), false);
});
