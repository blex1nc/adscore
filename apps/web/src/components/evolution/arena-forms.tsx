"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  cancelEvolutionRun,
  promoteCandidateForm,
  startEvolutionRun,
  type EvolutionFormState,
} from "@/actions/evolution";
import { CAMPAIGN_GOALS, EVOLUTION_LIMITS } from "@/lib/options";
import { ARENA_DISCLAIMER, GOAL_LABELS } from "@/lib/evolution/constants";
import {
  Button,
  FieldError,
  Input,
  Label,
  Select,
} from "@/components/ui";

function NumberField({
  id,
  name,
  label,
  value,
  onChange,
  limits,
}: {
  id: string;
  name: string;
  label: string;
  value: number;
  onChange: (n: number) => void;
  limits: { min: number; max: number; default: number };
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type="number"
        min={limits.min}
        max={limits.max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <p className="mt-1 text-xs text-muted-foreground">
        {limits.min}–{limits.max}
      </p>
    </div>
  );
}

export function StartArenaForm({
  brandId,
  hasActive,
  hasResearch,
}: {
  brandId: string;
  hasActive: boolean;
  hasResearch: boolean;
}) {
  const router = useRouter();
  const action = startEvolutionRun.bind(null, brandId);
  const [state, formAction, pending] = useActionState<
    EvolutionFormState,
    FormData
  >(action, {});
  const [rounds, setRounds] = useState<number>(EVOLUTION_LIMITS.rounds.default);
  const [population, setPopulation] = useState<number>(
    EVOLUTION_LIMITS.population.default,
  );
  const [survivors, setSurvivors] = useState<number>(
    EVOLUTION_LIMITS.survivors.default,
  );
  const [judges, setJudges] = useState<number>(EVOLUTION_LIMITS.judges.default);
  // Maliyet sınırı: tur başına 1 üretim + `judges` jüri çağrısı (AGENT-A §3)
  const estimatedCalls = rounds * (1 + judges);

  useEffect(() => {
    if (state.success && state.runId) {
      router.push(`/app/brands/${brandId}/arena/${state.runId}`);
    }
  }, [state.success, state.runId, brandId, router]);

  const disabled = pending || hasActive || !hasResearch;

  return (
    <form action={formAction} className="mt-4 space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="goal">Kampanya hedefi</Label>
          <Select id="goal" name="goal" defaultValue="sales" required>
            {CAMPAIGN_GOALS.map((g) => (
              <option key={g} value={g}>
                {GOAL_LABELS[g] ?? g}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="offer">Gerçek teklif (opsiyonel)</Label>
          <Input
            id="offer"
            name="offer"
            placeholder='Ör. "İlk siparişe kargo bedava"'
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Boş bırakılırsa hiçbir adayda indirim/kampanya vaadi kullanılmaz;
            kullanan aday kural kontrolünde elenir.
          </p>
        </div>
        <div>
          <Label htmlFor="instruction">Yönlendirme (opsiyonel)</Label>
          <Input
            id="instruction"
            name="instruction"
            placeholder='Ör. "Abonelik modelini öne çıkar"'
          />
        </div>
      </div>

      <details className="rounded-md border border-border-soft p-3">
        <summary className="cursor-pointer text-xs text-muted-foreground transition-colors duration-300 hover:text-foreground">
          Gelişmiş: tur / aday / elit / jüri sayısı
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <NumberField
            id="rounds"
            name="rounds"
            label="Tur"
            value={rounds}
            onChange={setRounds}
            limits={EVOLUTION_LIMITS.rounds}
          />
          <NumberField
            id="population"
            name="population"
            label="Aday / tur"
            value={population}
            onChange={setPopulation}
            limits={EVOLUTION_LIMITS.population}
          />
          <NumberField
            id="survivors"
            name="survivors"
            label="Elit (hayatta kalan)"
            value={survivors}
            onChange={setSurvivors}
            limits={EVOLUTION_LIMITS.survivors}
          />
          <NumberField
            id="judges"
            name="judges"
            label="Jüri"
            value={judges}
            onChange={setJudges}
            limits={EVOLUTION_LIMITS.judges}
          />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Tahmini AI çağrısı: <span className="font-medium text-foreground">{estimatedCalls}</span>{" "}
          (tur × (1 üretim + jüri)). Yakınsama erken sağlanırsa daha az.
        </p>
      </details>

      <p className="text-xs text-muted-foreground">{ARENA_DISCLAIMER}</p>
      <FieldError message={state.error} />
      {!hasResearch ? (
        <p className="text-xs text-destructive">
          Önce marka araştırması tamamlanmalı; Arena araştırma verisi olmadan
          aday üretmez.
        </p>
      ) : null}
      <Button type="submit" size="sm" disabled={disabled}>
        {hasActive
          ? "Koşu sürüyor..."
          : pending
            ? "Başlatılıyor..."
            : "Arena koşusunu başlat"}
      </Button>
    </form>
  );
}

export function CancelRunButton({ runId }: { runId: string }) {
  return (
    <form action={cancelEvolutionRun}>
      <input type="hidden" name="runId" value={runId} />
      <button
        type="submit"
        className="rounded-full border border-border-soft px-3.5 py-1.5 text-xs text-muted-foreground transition-colors duration-300 hover:text-destructive"
      >
        Koşuyu iptal et
      </button>
    </form>
  );
}

export function PromoteCandidateButton({
  runId,
  candidateId,
}: {
  runId: string;
  candidateId: string;
}) {
  return (
    <form action={promoteCandidateForm}>
      <input type="hidden" name="runId" value={runId} />
      <input type="hidden" name="candidateId" value={candidateId} />
      <button
        type="submit"
        className="rounded-full border border-border-soft px-3 py-1 text-xs text-muted-foreground transition-colors duration-300 hover:text-foreground"
      >
        Onay akışına gönder
      </button>
    </form>
  );
}
