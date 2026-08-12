// Production migration koşucusu.
// Neon'da migration'lar pooled (pgbouncer) bağlantıdan gitmemeli; direct URL
// pooled URL'den türetilir: hostname'deki "-pooler" eki kaldırılır.
// DIRECT_URL env verilmişse o kullanılır. Lokal dev URL'i değişmeden geçer.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Lokal kullanım: packages/db/.env varsa eksik değişkenleri oradan doldur
// (Vercel'de env zaten süreçte gelir, dosya okunmaz).
const envPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".env",
);
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2];
    }
  }
}

const raw =
  process.env.DIRECT_URL || process.env.DATABASE_URL || process.env.neon;
if (!raw) {
  console.error(
    "migrate-deploy: DATABASE_URL (veya 'neon') tanımlı değil.",
  );
  process.exit(1);
}

let direct = raw.replace("-pooler", "");
// Prisma bazı sürücü parametrelerini tanımaz; migration bağlantısında ayıkla
try {
  const url = new URL(direct);
  url.searchParams.delete("channel_binding");
  direct = url.toString();
} catch {
  // URL parse edilemezse olduğu gibi dene
}

if (direct !== raw) {
  console.log("migrate-deploy: direct bağlantı türetildi (pooler eki kaldırıldı).");
}

const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: direct, DIRECT_URL: direct },
});
process.exit(result.status ?? 1);
