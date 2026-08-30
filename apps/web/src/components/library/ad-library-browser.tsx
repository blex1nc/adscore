"use client";

// C3 — Ad Library modülü: ara → gez → seç → içe aktar.
//
// Dürüstlük kuralları (AGENT-C.md Mutlak Kurallar, CLAUDE.md §6/§13/§37/§43):
//  - Kapsam notu sayfanın kalıcı parçasıdır, arama sonrası çıkan bir bildirim değil.
//  - Boş sonuç ASLA "bu marka reklam vermiyor" diye sunulmaz.
//  - Görsel/creative kopyalanmaz: kart yalnız Meta'nın döndürdüğü METİN alanları
//    + halka açık Ad Library linkidir.
//  - Gezinmek bedava; içe aktarma reklam başına bir AI analizi demektir ve
//    sayısı onaydan önce ekranda yazar.

import { useActionState, useMemo, useState } from "react";
import { ExternalLink, Search } from "lucide-react";
import {
  browseAdLibrary,
  importAdLibrarySelection,
  type BrowseState,
  type ImportState,
} from "@/actions/meta-library";
import {
  AD_LIBRARY_SCOPE_NOTE,
  groupCardsByPage,
  isEuCovered,
  NON_EU_SCOPE_WARNING,
  type AdLibraryCard,
} from "@/lib/meta-library/archive";
import { MAX_SAVED_PER_SEARCH } from "@/lib/meta-library/constants";
import { COUNTRY_OPTIONS } from "@/components/library/country-options";
import { Button, Input, Label, Select, cn } from "@/components/ui";

const NEW_COMPETITOR = "__new__";

const STATUS_OPTIONS: Array<[string, string]> = [
  ["ALL", "Tümü"],
  ["ACTIVE", "Yayında"],
  ["INACTIVE", "Durmuş"],
];

export function AdLibraryBrowser({
  brandId,
  brandName,
  targetMarket,
  competitors,
}: {
  brandId: string;
  brandName: string;
  targetMarket: string | null;
  competitors: Array<{ id: string; name: string }>;
}) {
  const [browseState, browseAction, browsing] = useActionState<BrowseState, FormData>(
    browseAdLibrary.bind(null, brandId),
    {},
  );
  const [importState, importAction, importing] = useActionState<ImportState, FormData>(
    importAdLibrarySelection.bind(null, brandId),
    {},
  );
  const [selected, setSelected] = useState<string[]>([]);

  const defaultCountry =
    targetMarket && COUNTRY_OPTIONS.some(([c]) => c === targetMarket.toUpperCase())
      ? targetMarket.toUpperCase()
      : "TR";
  const activeCountry = browseState.query?.country ?? defaultCountry;

  const cards = useMemo(() => browseState.cards ?? [], [browseState.cards]);
  const savedSet = useMemo(
    () => new Set(browseState.alreadySavedIds ?? []),
    [browseState.alreadySavedIds],
  );
  const groups = useMemo(() => groupCardsByPage(cards), [cards]);

  const toggle = (value: string) =>
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );

  // İçe aktarma bittiğinde seçim temizlenir: aksi halde aktarılmış kartlar hâlâ
  // seçili görünür ve "zaten ekliydi" mesajı gerçek bir sorunla karışır.
  // (React'in "prop değişince state sıfırla" deseni — effect değil.)
  const [lastImportSummary, setLastImportSummary] = useState<string | undefined>(undefined);
  if (importState.summary !== lastImportSummary) {
    setLastImportSummary(importState.summary);
    if (importState.summary) setSelected([]);
  }

  const overLimit = selected.length > MAX_SAVED_PER_SEARCH;

  return (
    <div className="space-y-6">
      {/* Kapsam notu — kalıcı, aramadan bağımsız */}
      <div className="rounded-xl border border-border-soft bg-muted/30 p-4 text-xs text-muted-foreground">
        <p>{AD_LIBRARY_SCOPE_NOTE}</p>
        {!isEuCovered(activeCountry) ? <p className="mt-1">{NON_EU_SCOPE_WARNING}</p> : null}
        <p className="mt-1">
          Kartlarda yalnız Meta&apos;nın döndürdüğü metin alanları görünür; görsel ve video
          içerik kopyalanmaz — orijinali halka açık Ad Library linkinden açabilirsin.
        </p>
      </div>

      {/* Arama */}
      <form action={browseAction} className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <Label htmlFor="al-q">Arama terimi</Label>
          <Input
            id="al-q"
            name="searchTerms"
            defaultValue={browseState.query?.searchTerms ?? brandName}
            maxLength={100}
            placeholder="Marka, ürün veya konu"
            required
          />
        </div>
        <div>
          <Label htmlFor="al-country">Pazar</Label>
          <Select id="al-country" name="country" defaultValue={activeCountry}>
            {COUNTRY_OPTIONS.map(([code, label]) => (
              <option key={code} value={code}>
                {code} — {label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="al-status">Durum</Label>
          <Select
            id="al-status"
            name="adActiveStatus"
            defaultValue={browseState.query?.adActiveStatus ?? "ALL"}
          >
            {STATUS_OPTIONS.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" disabled={browsing}>
          <Search size={14} className="mr-1.5 inline" />
          {browsing ? "Aranıyor..." : "Ara"}
        </Button>
      </form>

      {browseState.blocked ? (
        <div className="rounded-md border border-border-soft bg-muted/40 p-3 text-xs">
          <span className="mr-2 rounded-full border border-border-soft px-2 py-0.5 text-[10px] uppercase tracking-wide">
            BLOCKED
          </span>
          {browseState.blocked}
        </div>
      ) : null}
      {browseState.error ? (
        <div className="rounded-md border border-destructive/40 p-3 text-xs">
          {browseState.error}
        </div>
      ) : null}

      {browseState.searched && !browseState.blocked && !browseState.error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>
            {cards.length} kayıt · {groups.length} sayfa · sorgu:{" "}
            <span className="text-foreground">{browseState.query?.searchTerms}</span> (
            {browseState.query?.country})
          </span>
          {browseState.retrievedAt ? (
            <span>Alındı: {new Date(browseState.retrievedAt).toLocaleString("tr-TR")}</span>
          ) : null}
        </div>
      ) : null}

      {browseState.searched && cards.length === 0 && !browseState.blocked && !browseState.error ? (
        <div className="rounded-xl border border-border-soft p-5 text-sm text-muted-foreground">
          Bu sorgu için Ad Library kapsamında sonuç dönmedi.{" "}
          <strong className="font-medium text-foreground">
            Bu, aranan markanın reklam vermediği anlamına gelmez.
          </strong>{" "}
          EU&apos;ya ulaşmayan ticari reklamlar API&apos;den dönmez. Farklı bir pazar
          dene ya da rakip sayfasından reklam metnini manuel ekle.
        </div>
      ) : null}

      {/* Sonuçlar + içe aktarma */}
      {cards.length > 0 ? (
        <form action={importAction} className="space-y-5">
          <input type="hidden" name="searchTerms" value={browseState.query?.searchTerms ?? ""} />
          <input type="hidden" name="country" value={browseState.query?.country ?? ""} />
          <input
            type="hidden"
            name="adActiveStatus"
            value={browseState.query?.adActiveStatus ?? "ALL"}
          />

          {groups.map((group) => (
            <section key={group.pageId ?? group.pageName}>
              <div className="flex items-center justify-between gap-3 border-b border-border-soft pb-2">
                <h3 className="text-sm font-medium">{group.pageName}</h3>
                <span className="text-xs text-muted-foreground">
                  {group.cards.length} reklam
                </span>
              </div>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {group.cards.map((card) => (
                  <AdCard
                    key={card.archiveId}
                    card={card}
                    alreadySaved={savedSet.has(card.archiveId)}
                    checked={selected.includes(selectionValue(card))}
                    onToggle={() => toggle(selectionValue(card))}
                  />
                ))}
              </div>
            </section>
          ))}

          {/* Seçim → içe aktarma kutusu */}
          <div className="sticky bottom-4 rounded-xl border border-border-soft bg-panel p-4 shadow-lg">
            {selected.map((value) => (
              <input key={value} type="hidden" name="selection" value={value} />
            ))}
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-48 flex-1">
                <Label htmlFor="al-target">İçe aktarılacak rakip</Label>
                <Select id="al-target" name="target" defaultValue={NEW_COMPETITOR}>
                  <option value={NEW_COMPETITOR}>
                    Sayfadan yeni rakip oluştur (seçilen her sayfa için)
                  </option>
                  {competitors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="al-type">Yeni rakip tipi</Label>
                <Select id="al-type" name="competitorType" defaultValue="DIRECT">
                  <option value="DIRECT">Doğrudan</option>
                  <option value="INDIRECT">Dolaylı</option>
                  <option value="ASPIRATIONAL">Aspirasyonel</option>
                  <option value="CREATIVE">Creative</option>
                </Select>
              </div>
              <Button type="submit" disabled={importing || selected.length === 0 || overLimit}>
                {importing ? "Aktarılıyor..." : `Seçilenleri içe aktar (${selected.length})`}
              </Button>
            </div>
            <p className={cn("mt-2 text-xs", overLimit ? "text-destructive" : "text-muted-foreground")}>
              {selected.length === 0
                ? `Kart seçtiğinde burada görünür. İçe aktarılan her reklam bir AI analizi tetikler (tek seferde en fazla ${MAX_SAVED_PER_SEARCH}).`
                : overLimit
                  ? `Tek seferde en fazla ${MAX_SAVED_PER_SEARCH} reklam aktarılabilir. Seçimi azalt.`
                  : `${selected.length} reklam içe aktarılacak → ${selected.length} AI analizi çalışacak.`}
            </p>
            {importState.blocked ? (
              <p className="mt-2 rounded-md border border-border-soft bg-muted/40 p-2 text-xs">
                BLOCKED — {importState.blocked}
              </p>
            ) : null}
            {importState.error ? (
              <p className="mt-2 rounded-md border border-destructive/40 p-2 text-xs">
                {importState.error}
              </p>
            ) : null}
            {importState.summary ? (
              <p className="mt-2 rounded-md border border-accent/40 p-2 text-xs">
                {importState.summary}
              </p>
            ) : null}
          </div>
        </form>
      ) : null}
    </div>
  );
}

function selectionValue(card: AdLibraryCard) {
  return `${card.archiveId}::${card.pageId ?? ""}::${card.pageName ?? ""}`;
}

function AdCard({
  card,
  alreadySaved,
  checked,
  onToggle,
}: {
  card: AdLibraryCard;
  alreadySaved: boolean;
  checked: boolean;
  onToggle: () => void;
}) {
  const disabled = alreadySaved || !card.importable;
  return (
    <article
      className={cn(
        "flex flex-col rounded-xl border p-4 transition-colors duration-300",
        checked ? "border-accent bg-accent/5" : "border-border-soft bg-panel",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide">
          <span
            className={cn(
              "rounded-full border px-2 py-0.5",
              card.active ? "border-accent/40 text-accent" : "border-border-soft text-muted-foreground",
            )}
            title={
              card.active
                ? "Kayıtta bitiş tarihi yok — reklamın hâlâ yayında olduğu çıkarımdır, Meta'nın doğrudan verdiği bir durum değildir."
                : `Yayın ${card.deliveryStop} tarihinde durmuş.`
            }
          >
            {card.active ? "Bitiş tarihi yok" : "Durmuş"}
          </span>
          {card.platforms.slice(0, 3).map((p) => (
            <span key={p} className="rounded-full border border-border-soft px-2 py-0.5 text-muted-foreground">
              {p.toLowerCase()}
            </span>
          ))}
        </div>
        <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={checked}
            onChange={onToggle}
            disabled={disabled}
            className="size-3.5 accent-[var(--accent)]"
          />
          {alreadySaved ? "Ekli" : card.importable ? "Seç" : "Metin yok"}
        </label>
      </div>

      <div className="mt-3 space-y-1.5 text-sm">
        {card.titles.length > 0 ? (
          <p className="font-medium">{card.titles[0]}</p>
        ) : null}
        {card.bodies.length > 0 ? (
          <p className="line-clamp-5 whitespace-pre-line text-muted-foreground">
            {card.bodies[0]}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Bu kayıtta metin alanı dönmedi (yalnız görsel/video reklam olabilir) —
            analiz motoruna girdi olamaz.
          </p>
        )}
        {card.descriptions.length > 0 ? (
          <p className="text-xs text-muted-foreground">{card.descriptions[0]}</p>
        ) : null}
      </div>

      <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <div>
          <dt className="inline">Yayın: </dt>
          <dd className="inline">
            {card.deliveryStart ?? "?"} → {card.deliveryStop ?? "devam ediyor"}
          </dd>
        </div>
        {card.euTotalReach != null ? (
          <div>
            <dt className="inline">EU erişim: </dt>
            <dd className="inline tabular-nums">{card.euTotalReach.toLocaleString("tr-TR")}</dd>
          </div>
        ) : null}
        {card.languages.length > 0 ? (
          <div>
            <dt className="inline">Dil: </dt>
            <dd className="inline">{card.languages.join(", ")}</dd>
          </div>
        ) : null}
      </dl>

      <a
        href={card.publicUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1 text-xs text-accent hover:opacity-80"
      >
        Ad Library&apos;de aç
        <ExternalLink size={12} />
      </a>
    </article>
  );
}
