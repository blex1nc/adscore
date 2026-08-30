"use client";
// B1 — Hedefleme seçici: kullanıcı GERÇEK Meta hedefleme nesnelerini arayıp seçer.
// AI id uydurmaz; yalnız aramadan dönen nesneler kaydedilir (CLAUDE.md §6).

import { useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import { Button, Input } from "@/components/ui";
import {
  saveMetaTargeting,
  searchMetaTargeting,
  type GeoSearchItem,
  type SaveTargetingInput,
  type TargetingSearchItem,
} from "@/actions/meta-publish";

type StoredItemUI = TargetingSearchItem & { retrievedAt: string };

type Props = {
  planId: string;
  brandId: string;
  /** Plandaki serbest metin kitle önerisi — yalnız İLHAM, yayına gitmez */
  aiSuggestion: string | null;
  initial: {
    countries: string[];
    ageMin: number | null;
    ageMax: number | null;
    gender: "all" | "men" | "women";
    interests: StoredItemUI[];
    behaviors: StoredItemUI[];
    advantageAudience: boolean;
  } | null;
  initialSpecial: string[];
  /** Marka pazarından ülke önerisi (yalnız öneri; kullanıcı seçer) */
  suggestedCountry: string | null;
};

const SPECIAL_OPTIONS = [
  { value: "CREDIT", label: "Kredi / finansal ürünler (kredi)" },
  { value: "FINANCIAL_PRODUCTS_SERVICES", label: "Finansal ürün ve hizmetler" },
  { value: "EMPLOYMENT", label: "İstihdam" },
  { value: "HOUSING", label: "Konut" },
  { value: "ISSUES_ELECTIONS_POLITICS", label: "Sosyal konular / seçim / siyaset" },
  { value: "ONLINE_GAMBLING_AND_GAMING", label: "Çevrimiçi kumar ve oyun" },
] as const;

function fmtSize(lo: number | null, hi: number | null): string | null {
  if (lo == null && hi == null) return null;
  const f = (n: number) => n.toLocaleString("tr-TR");
  if (lo != null && hi != null) return `${f(lo)}–${f(hi)} kişi`;
  return `${f((lo ?? hi)!)} kişi`;
}

export function TargetingForm({ planId, brandId, aiSuggestion, initial, initialSpecial, suggestedCountry }: Props) {
  const [countries, setCountries] = useState<string[]>(initial?.countries ?? []);
  const [ageMin, setAgeMin] = useState<string>(initial?.ageMin?.toString() ?? "18");
  const [ageMax, setAgeMax] = useState<string>(initial?.ageMax?.toString() ?? "65");
  const [gender, setGender] = useState<"all" | "men" | "women">(initial?.gender ?? "all");
  const [interests, setInterests] = useState<StoredItemUI[]>(initial?.interests ?? []);
  const [behaviors, setBehaviors] = useState<StoredItemUI[]>(initial?.behaviors ?? []);
  const [advantage, setAdvantage] = useState<boolean>(initial?.advantageAudience ?? false);
  const [special, setSpecial] = useState<string[]>(initialSpecial);
  const [specialNone, setSpecialNone] = useState<boolean>(initialSpecial.includes("NONE"));

  const [kind, setKind] = useState<"interest" | "behavior" | "geo">("interest");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<TargetingSearchItem[]>([]);
  const [geoResults, setGeoResults] = useState<GeoSearchItem[]>([]);
  const [searchedAt, setSearchedAt] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [searching, startSearch] = useTransition();
  const [saving, startSave] = useTransition();

  const runSearch = () => {
    setMsg(null);
    startSearch(async () => {
      const r = await searchMetaTargeting(brandId, kind, q);
      if ("error" in r && r.error) return setMsg(r.error);
      if ("blocked" in r && r.blocked) return setMsg(`BLOCKED — ${r.blocked.userMessage}`);
      setSearchedAt(("retrievedAt" in r && r.retrievedAt) || null);
      if ("geo" in r && r.geo) {
        setGeoResults(r.geo);
        setResults([]);
      } else if ("items" in r && r.items) {
        setResults(r.items);
        setGeoResults([]);
      }
    });
  };

  const addItem = (item: TargetingSearchItem) => {
    const stored: StoredItemUI = { ...item, retrievedAt: searchedAt ?? new Date().toISOString() };
    if (item.type === "behaviors" || kind === "behavior") {
      if (!behaviors.some((b) => b.id === item.id)) setBehaviors([...behaviors, stored]);
    } else if (!interests.some((i) => i.id === item.id)) {
      setInterests([...interests, stored]);
    }
  };

  const save = () => {
    setMsg(null);
    setSaved(false);
    startSave(async () => {
      const specialFinal = specialNone ? ["NONE"] : special;
      if (specialFinal.length === 0) {
        return setMsg("Özel reklam kategorisi sorusu cevaplanmalı — 'Hiçbiri' de bir cevaptır, varsayılan seçilmez.");
      }
      const payload: SaveTargetingInput = {
        countries,
        ageMin: ageMin ? Number(ageMin) : null,
        ageMax: ageMax ? Number(ageMax) : null,
        gender,
        interests,
        behaviors,
        advantageAudience: advantage,
        specialAdCategories: specialFinal as SaveTargetingInput["specialAdCategories"],
      };
      const r = await saveMetaTargeting(planId, payload);
      if ("error" in r && r.error) return setMsg(r.error);
      if ("blocked" in r && r.blocked) return setMsg(`BLOCKED — ${r.blocked.userMessage}`);
      setSaved(true);
    });
  };

  const chip = (item: StoredItemUI, onRemove: () => void) => (
    <span
      key={item.id}
      className="inline-flex items-center gap-1 rounded-full border border-border-soft bg-muted px-2.5 py-1 text-xs"
    >
      {item.name}
      {fmtSize(item.audienceSizeLowerBound, item.audienceSizeUpperBound) ? (
        <span className="text-muted-foreground">· {fmtSize(item.audienceSizeLowerBound, item.audienceSizeUpperBound)}</span>
      ) : null}
      <button type="button" onClick={onRemove} aria-label={`${item.name} kaldır`} className="text-muted-foreground hover:text-foreground">
        <X size={12} />
      </button>
    </span>
  );

  return (
    <section className="rounded-lg border border-border-soft bg-panel shadow-card p-6">
      <h2 className="text-base font-medium">1 · Hedefleme (Meta’dan doğrulanmış)</h2>
      {aiSuggestion ? (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Plandaki AI önerisi (ilham; yayına gitmez): <span className="italic">{aiSuggestion}</span>
        </p>
      ) : null}

      {/* Ülkeler */}
      <div className="mt-4">
        <p className="text-sm font-medium">Ülkeler</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {countries.map((c) => (
            <span key={c} className="inline-flex items-center gap-1 rounded-full border border-border-soft bg-muted px-2.5 py-1 text-xs">
              {c}
              <button type="button" onClick={() => setCountries(countries.filter((x) => x !== c))} aria-label={`${c} kaldır`} className="text-muted-foreground hover:text-foreground">
                <X size={12} />
              </button>
            </span>
          ))}
          {countries.length === 0 ? (
            <span className="text-xs text-muted-foreground">
              Henüz ülke yok{suggestedCountry ? ` — marka pazarı önerisi: ${suggestedCountry} (aşağıdan arayıp ekleyin)` : ""}.
            </span>
          ) : null}
        </div>
      </div>

      {/* Arama */}
      <div className="mt-4 rounded-xl border border-border-soft bg-background p-4">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ["interest", "İlgi alanı"],
              ["behavior", "Davranış"],
              ["geo", "Ülke"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setKind(k);
                setResults([]);
                setGeoResults([]);
              }}
              className={
                "rounded-full px-3 py-1 text-xs " +
                (kind === k ? "bg-accent text-accent-foreground" : "border border-border-soft text-muted-foreground hover:text-foreground")
              }
            >
              {label}
            </button>
          ))}
          <div className="flex min-w-52 flex-1 items-center gap-2">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              placeholder={kind === "geo" ? "Ülke ara (ör. Türkiye)" : "Meta'da ara (ör. kahve)"}
            />
            <Button type="button" size="sm" variant="secondary" onClick={runSearch} disabled={searching}>
              <Search size={13} /> {searching ? "Aranıyor…" : "Ara"}
            </Button>
          </div>
        </div>
        {searchedAt ? (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Kaynak: Meta targeting search · {new Date(searchedAt).toLocaleString("tr-TR")}
          </p>
        ) : null}
        {geoResults.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {geoResults.map((g) => (
              <li key={g.code}>
                <button
                  type="button"
                  onClick={() => !countries.includes(g.code) && setCountries([...countries, g.code])}
                  className="rounded-full border border-border-soft px-2.5 py-1 text-xs hover:bg-muted"
                >
                  + {g.name} ({g.code})
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {results.length > 0 ? (
          <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
            {results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => addItem(r)}
                  className="flex w-full items-baseline justify-between gap-2 rounded-md px-2 py-1 text-left text-xs hover:bg-muted"
                >
                  <span>
                    + {r.name}
                    {r.path && r.path.length > 1 ? (
                      <span className="text-muted-foreground"> · {r.path.join(" › ")}</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-muted-foreground">{fmtSize(r.audienceSizeLowerBound, r.audienceSizeUpperBound) ?? ""}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* Seçilenler */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-sm font-medium">Seçilen ilgi alanları</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {interests.length === 0 ? <span className="text-xs text-muted-foreground">Yok (opsiyonel)</span> : null}
            {interests.map((i) => chip(i, () => setInterests(interests.filter((x) => x.id !== i.id))))}
          </div>
        </div>
        <div>
          <p className="text-sm font-medium">Seçilen davranışlar</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {behaviors.length === 0 ? <span className="text-xs text-muted-foreground">Yok (opsiyonel)</span> : null}
            {behaviors.map((b) => chip(b, () => setBehaviors(behaviors.filter((x) => x.id !== b.id))))}
          </div>
        </div>
      </div>

      {/* Yaş / cinsiyet / Advantage+ */}
      <div className="mt-4 flex flex-wrap items-end gap-4">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">Yaş min (≥13)</span>
          <Input className="w-20" inputMode="numeric" value={ageMin} onChange={(e) => setAgeMin(e.target.value.replace(/\D/g, ""))} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">Yaş maks (65 = 65+)</span>
          <Input className="w-20" inputMode="numeric" value={ageMax} onChange={(e) => setAgeMax(e.target.value.replace(/\D/g, ""))} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">Cinsiyet</span>
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value as typeof gender)}
            className="rounded-md border border-border-soft bg-panel px-3 py-2 text-sm"
          >
            <option value="all">Tümü</option>
            <option value="women">Kadınlar</option>
            <option value="men">Erkekler</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={advantage} onChange={(e) => setAdvantage(e.target.checked)} />
          <span>
            Advantage+ hedef kitlesi
            <span className="block text-[11px] text-muted-foreground">
              Açık: Meta seçimlerin ötesine genişletebilir · Kapalı: yalnız seçtiklerin
            </span>
          </span>
        </label>
      </div>

      {/* Özel reklam kategorisi — varsayılan yok, kullanıcı cevaplar */}
      <div className="mt-5 rounded-xl border border-border-soft bg-background p-4">
        <p className="text-sm font-medium">Özel reklam kategorisi (zorunlu soru)</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Reklamın kredi, istihdam, konut, sosyal/siyasi konular veya kumar/oyun kapsamına giriyorsa işaretle.
          Yanlış beyan Meta reddi demektir; bu yüzden varsayılan seçmiyoruz.
        </p>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={specialNone}
            onChange={(e) => {
              setSpecialNone(e.target.checked);
              if (e.target.checked) setSpecial([]);
            }}
          />
          Hiçbiri — reklamım bu kategorilere girmiyor
        </label>
        {!specialNone ? (
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {SPECIAL_OPTIONS.map((o) => (
              <label key={o.value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={special.includes(o.value)}
                  onChange={(e) =>
                    setSpecial(e.target.checked ? [...special, o.value] : special.filter((s) => s !== o.value))
                  }
                />
                {o.label}
              </label>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button type="button" onClick={save} disabled={saving || countries.length === 0}>
          {saving ? "Kaydediliyor…" : "Hedeflemeyi kaydet"}
        </Button>
        {countries.length === 0 ? (
          <span className="text-xs text-muted-foreground">En az bir ülke seçilmeli.</span>
        ) : null}
        {saved ? <span className="text-xs text-accent">Kaydedildi.</span> : null}
        {msg ? <span className="text-xs text-destructive">{msg}</span> : null}
      </div>
    </section>
  );
}
