"use client";

import { useActionState, useState } from "react";
import { Check, Copy } from "lucide-react";
import {
  startCampaignPlan,
  type CampaignFormState,
} from "@/actions/campaigns";
import { Button, FieldError, Input, Label, Select } from "@/components/ui";
import { CURRENCIES } from "@/lib/options";

const GOALS = [
  { value: "SALES", label: "Satış" },
  { value: "TRAFFIC", label: "Trafik" },
  { value: "LEADS", label: "Potansiyel müşteri (Lead)" },
  { value: "AWARENESS", label: "Bilinirlik" },
];

export function PlanForm({
  brandId,
  hasActive,
  approvedCreatives,
  defaultCurrency,
}: {
  brandId: string;
  hasActive: boolean;
  approvedCreatives: Array<{ id: string; headline: string }>;
  defaultCurrency: string | null;
}) {
  const action = startCampaignPlan.bind(null, brandId);
  const [state, formAction, pending] = useActionState<
    CampaignFormState,
    FormData
  >(action, {});

  return (
    <form action={formAction} className="mt-4 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="goal">Kampanya hedefi</Label>
          <Select id="goal" name="goal" defaultValue="SALES">
            {GOALS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="budgetType">Bütçe tipi</Label>
          <Select id="budgetType" name="budgetType" defaultValue="DAILY">
            <option value="DAILY">Günlük</option>
            <option value="LIFETIME">Toplam</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="budgetAmount">Bütçe</Label>
          <Input
            id="budgetAmount"
            name="budgetAmount"
            type="number"
            min="1"
            step="0.01"
            required
          />
        </div>
        <div>
          <Label htmlFor="currency">Para birimi</Label>
          <Select
            id="currency"
            name="currency"
            defaultValue={defaultCurrency ?? "TRY"}
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="durationDays">Süre (gün, opsiyonel)</Label>
          <Input
            id="durationDays"
            name="durationDays"
            type="number"
            min="1"
            max="365"
          />
        </div>
        <div>
          <Label htmlFor="notes">Not (opsiyonel)</Label>
          <Input id="notes" name="notes" />
        </div>
      </div>

      <div>
        <Label>Kampanyaya girecek onaylı creative'ler</Label>
        {approvedCreatives.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Onaylı creative yok. Önce Creative Studio'da en az bir varyantı
            onayla; plan yalnızca onaylı creative'lerle hazırlanır.
          </p>
        ) : (
          <div className="mt-1 space-y-2">
            {approvedCreatives.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="creativeIds"
                  value={c.id}
                  defaultChecked
                  className="size-4 accent-(--accent)"
                />
                {c.headline}
              </label>
            ))}
          </div>
        )}
      </div>

      <FieldError message={state.error} />
      <Button
        type="submit"
        size="sm"
        disabled={pending || hasActive || approvedCreatives.length === 0}
      >
        {hasActive
          ? "Plan hazırlanıyor..."
          : pending
            ? "Başlatılıyor..."
            : "Kurulum kitini hazırla"}
      </Button>
    </form>
  );
}

export function CopyBlock({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {}
      }}
      className="inline-flex items-center gap-1.5 text-xs text-accent transition-opacity duration-300 hover:opacity-80"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "Kopyalandı" : label}
    </button>
  );
}
