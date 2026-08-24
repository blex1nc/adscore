// ARENA — UI ve prompt'ların paylaştığı sabitler (server-only DEĞİL; sayfalar da okur).

export const ARENA_DISCLAIMER =
  "Arena skoru adayların birbirine göre sıralamasıdır; gerçek performans tahmini değildir.";

export const GOAL_LABELS: Record<string, string> = {
  sales: "Satış (dönüşüm)",
  traffic: "Trafik",
  leads: "Potansiyel müşteri (lead)",
  awareness: "Bilinirlik",
};

export const STAGE_LABELS: Record<string, string> = {
  GENERATE: "Üretim",
  LINT: "Kural kontrolü",
  JUDGE: "Jüri",
  SELECT: "Seçilim",
  DONE: "Bitti",
};

export const RUN_STATUS_LABELS: Record<string, string> = {
  QUEUED: "Sırada",
  RUNNING: "Koşuyor",
  COMPLETED: "Tamamlandı",
  FAILED: "Başarısız",
  CANCELLED: "İptal edildi",
};

export const ORIGIN_LABELS: Record<string, string> = {
  SEED: "Tohum",
  MUTATION: "Mutasyon",
  CROSSOVER: "Çaprazlama",
  ELITE: "Elit",
};

/** Tohum turunda her aday FARKLI bir eksende üretilir (AGENT-A §3). */
export const STRATEGY_AXES = [
  { key: "problem_hook", label: "Problem kancası", note: "kitlenin yaşadığı somut bir sorunla aç" },
  { key: "social_context", label: "Sosyal bağlam", note: "ürünün yaşandığı an/ortam/ilişki" },
  { key: "product_focus", label: "Ürün odak", note: "ürünün somut özelliği ve faydası" },
  { key: "curiosity", label: "Merak", note: "cevabı metinde verilen bir soru/gerilim" },
  { key: "proof_from_research", label: "Kanıt (araştırmadan)", note: "YALNIZ araştırmada gerçekten olan bir bilgi/özellik" },
  { key: "usage_scenario", label: "Kullanım senaryosu", note: "günlük hayatta nasıl kullanıldığı" },
  { key: "identity_lifestyle", label: "Kimlik / yaşam tarzı", note: "kitlenin kendini nasıl gördüğü" },
  { key: "education", label: "Eğitim / nasıl yapılır", note: "kısa öğretici açı" },
  { key: "contrast", label: "Karşıtlık", note: "eski alışkanlık vs. yeni deneyim (rakip adı geçmeden)" },
  { key: "sensory", label: "Duyusal", note: "koku, tat, doku, ses gibi somut duyusal ayrıntı" },
] as const;

/** Mutasyon operatörleri (AGENT-A §3). Çocuğun `why` alanında operatör adı geçer. */
export const MUTATION_OPERATORS = [
  { key: "hook_swap", note: "aynı gövde, farklı eksenden yeni kanca" },
  { key: "shorten_to_125", note: "primary text'i ilk 125 karakterde tamamlanacak kadar kısalt" },
  { key: "angle_shift", note: "aynı ürün, farklı strateji ekseni" },
  { key: "cta_change", note: "hedefe daha uygun, kısa bir CTA" },
  { key: "social_context", note: "ürünü bir sosyal an/ilişki içine yerleştir" },
  { key: "proof_from_research", note: "YALNIZ araştırmada gerçekten olan bir bilgiyle kanıt ekle" },
  { key: "learning_informed", note: "bir marka öğrenmesine dayan; confidence'ı why'da belirt" },
] as const;

export const CROSSOVER_OPERATOR = "crossover";
