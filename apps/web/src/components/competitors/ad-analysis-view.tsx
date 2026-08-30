import { cn } from "@/components/ui";

type Confidence = { hypothesis?: string; confidence?: string };

export type AdAnalysis = {
  hook?: string | null;
  problem?: string | null;
  solution?: string | null;
  product_presentation?: string | null;
  offer?: string | null;
  cta?: string | null;
  headline?: string | null;
  copy_structure?: string | null;
  visual_style?: string | null;
  format?: string;
  social_proof?: string | null;
  emotion?: string | null;
  funnel_stage?: string;
  audience_hypothesis?: Confidence | null;
  hypotheses?: Confidence[];
  data_gaps?: string[];
};

export function ConfidenceBadge({ level }: { level?: string }) {
  const label =
    level === "high" ? "yüksek" : level === "medium" ? "orta" : "düşük";
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide",
        level === "high"
          ? "border-accent/40 text-accent"
          : "border-border-soft text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

const FIELD_LABELS: Array<[keyof AdAnalysis, string]> = [
  ["hook", "Hook"],
  ["problem", "Problem"],
  ["solution", "Çözüm"],
  ["product_presentation", "Ürün sunumu"],
  ["offer", "Teklif"],
  ["cta", "CTA"],
  ["headline", "Başlık"],
  ["copy_structure", "Copy yapısı"],
  ["visual_style", "Görsel stil"],
  ["social_proof", "Sosyal kanıt"],
  ["emotion", "Duygu"],
];

export function AdAnalysisView({ analysis }: { analysis: AdAnalysis }) {
  const rows = FIELD_LABELS.filter(([key]) => {
    const value = analysis[key];
    return typeof value === "string" && value.length > 0;
  });

  return (
    <div className="mt-3 space-y-3 rounded-md border border-border-soft bg-muted/40 p-3">
      <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
        {analysis.format ? (
          <span className="rounded-full bg-muted px-2 py-0.5">
            format: {analysis.format}
          </span>
        ) : null}
        {analysis.funnel_stage ? (
          <span className="rounded-full bg-muted px-2 py-0.5">
            funnel: {analysis.funnel_stage}
          </span>
        ) : null}
      </div>
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {rows.map(([key, label]) => (
          <div key={key}>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              {label}
            </dt>
            <dd className="mt-0.5">{analysis[key] as string}</dd>
          </div>
        ))}
      </dl>
      {analysis.audience_hypothesis?.hypothesis ? (
        <div className="flex items-start justify-between gap-3 border-t border-border-soft pt-2">
          <span className="text-sm">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Kitle hipotezi:{" "}
            </span>
            {analysis.audience_hypothesis.hypothesis}
          </span>
          <ConfidenceBadge level={analysis.audience_hypothesis.confidence} />
        </div>
      ) : null}
      {analysis.hypotheses?.length ? (
        <ul className="space-y-1.5 border-t border-border-soft pt-2">
          {analysis.hypotheses.map((h, i) => (
            <li key={i} className="flex items-start justify-between gap-3">
              <span className="text-sm">{h.hypothesis}</span>
              <ConfidenceBadge level={h.confidence} />
            </li>
          ))}
        </ul>
      ) : null}
      {analysis.data_gaps?.length ? (
        <p className="border-t border-border-soft pt-2 text-xs text-muted-foreground">
          Eksik veri: {analysis.data_gaps.join(" · ")}
        </p>
      ) : null}
    </div>
  );
}
