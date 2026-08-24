// Kampanya sonucu doğrulama şeması — TEK doğrulama yolu (CONTRACTS §1).
// Elle giriş, CSV içe aktarma ve Meta API senkronu (Ajan C) AYNI şemadan geçer;
// paralel model/doğrulama açılmaz. actions/results.ts "use server" olduğundan
// (yalnız async export edebilir) şema buraya çıkarıldı.

import { z } from "zod";

export const resultSchema = z
  .object({
    periodStart: z.coerce.date(),
    periodEnd: z.coerce.date(),
    spend: z.coerce.number().positive("Harcama sıfırdan büyük olmalı."),
    impressions: z.coerce.number().int().nonnegative(),
    clicks: z.coerce.number().int().nonnegative(),
    reach: z.coerce.number().int().nonnegative().optional(),
    purchases: z.coerce.number().int().nonnegative().optional(),
    revenue: z.coerce.number().nonnegative().optional(),
    notes: z.string().max(500).optional(),
  })
  .refine((d) => d.periodEnd >= d.periodStart, {
    message: "Bitiş tarihi başlangıçtan önce olamaz.",
  })
  .refine((d) => d.clicks <= d.impressions, {
    message: "Tıklama sayısı gösterimden fazla olamaz.",
  });

export type ResultSchemaData = z.infer<typeof resultSchema>;
