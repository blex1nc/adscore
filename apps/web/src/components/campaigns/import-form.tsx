"use client";

import { useActionState } from "react";
import {
  parseResultCsv,
  saveCsvResult,
  type CsvParseState,
  type CsvSaveState,
} from "@/actions/results";
import { Button, FieldError, Label } from "@/components/ui";

// Ads Manager CSV export'undan sonuç aktarma: önce parse + önizleme (DB'ye
// yazılmaz), kullanıcı onaylarsa kayıt. Elle girişin alternatifi.
export function ImportResultForm({ planId }: { planId: string }) {
  const parseAction = parseResultCsv.bind(null, planId);
  const [parseState, parseFormAction, parsing] = useActionState<
    CsvParseState,
    FormData
  >(parseAction, {});
  const saveAction = saveCsvResult.bind(null, planId);
  const [saveState, saveFormAction, saving] = useActionState<
    CsvSaveState,
    FormData
  >(saveAction, {});

  const preview = parseState.preview;

  return (
    <div className="mt-4 rounded-xl border border-dashed border-border-soft p-4">
      <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        CSV'den içe aktar (Ads Manager raporu)
      </h4>
      <p className="mt-1 text-xs text-muted-foreground">
        Ads Manager → Raporlar → Export → CSV. Türkçe ve İngilizce kolon adları
        desteklenir; günlük satırlar tek döneme toplanır. Kayıttan önce
        önizleme gösterilir.
      </p>
      <form action={parseFormAction} className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor={`csv-${planId}`}>Rapor dosyası (.csv)</Label>
          <input
            id={`csv-${planId}`}
            name="file"
            type="file"
            accept=".csv,text/csv"
            required
            className="mt-1 block text-sm file:mr-3 file:rounded-full file:border file:border-border-soft file:bg-panel file:px-3 file:py-1.5 file:text-xs file:font-medium"
          />
        </div>
        <Button type="submit" size="sm" variant="secondary" disabled={parsing}>
          {parsing ? "Okunuyor..." : "Önizle"}
        </Button>
      </form>
      <FieldError message={parseState.error} />

      {saveState.saved ? (
        <p className="mt-3 text-sm text-accent">
          Sonuç kaydedildi ve aşağıdaki listeye eklendi.
        </p>
      ) : preview ? (
        <div className="mt-4 rounded-md border border-border-soft bg-muted/40 p-3">
          <div className="text-xs text-muted-foreground">
            Önizleme — {preview.rowCount} satırdan toplandı
            {preview.campaignName ? ` · Kampanya: ${preview.campaignName}` : ""}
            {" · "}Tıklama kaynağı: {preview.clicksSource}
          </div>
          <dl className="mt-2 grid grid-cols-3 gap-3 text-sm sm:grid-cols-4">
            {(
              [
                ["Dönem", `${preview.periodStart} → ${preview.periodEnd}`],
                ["Harcama", String(preview.spend)],
                ["Gösterim", String(preview.impressions)],
                ["Tıklama", String(preview.clicks)],
                ["Erişim", preview.reach == null ? "-" : String(preview.reach)],
                [
                  "Satın alma",
                  preview.purchases == null ? "-" : String(preview.purchases),
                ],
                [
                  "Ciro",
                  preview.revenue == null ? "-" : String(preview.revenue),
                ],
              ] as const
            ).map(([k, v]) => (
              <div key={k}>
                <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {k}
                </dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          {preview.warnings.length > 0 ? (
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {preview.warnings.map((w, i) => (
                <li key={i}>Uyarı: {w}</li>
              ))}
            </ul>
          ) : null}
          <form action={saveFormAction} className="mt-3">
            <input type="hidden" name="periodStart" value={preview.periodStart} />
            <input type="hidden" name="periodEnd" value={preview.periodEnd} />
            <input type="hidden" name="spend" value={preview.spend} />
            <input type="hidden" name="impressions" value={preview.impressions} />
            <input type="hidden" name="clicks" value={preview.clicks} />
            {preview.reach != null ? (
              <input type="hidden" name="reach" value={preview.reach} />
            ) : null}
            {preview.purchases != null ? (
              <input type="hidden" name="purchases" value={preview.purchases} />
            ) : null}
            {preview.revenue != null ? (
              <input type="hidden" name="revenue" value={preview.revenue} />
            ) : null}
            <input
              type="hidden"
              name="notes"
              value={`CSV içe aktarma (${preview.rowCount} satır)`}
            />
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Kaydediliyor..." : "Doğru, sonuç olarak kaydet"}
            </Button>
            <FieldError message={saveState.error} />
          </form>
        </div>
      ) : null}
    </div>
  );
}
