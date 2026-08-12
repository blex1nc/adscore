import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Lokal geliştirme seed'i. Şifre env'den gelir; verilmezse dev default.
// Production'da seed KULLANILMAZ.
async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "418off@gmail.com";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "dev-degistir-beni";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin zaten var: ${email}`);
    return;
  }

  const user = await prisma.user.create({
    data: {
      email,
      name: "Admin",
      passwordHash: await bcrypt.hash(password, 12),
      platformRole: "ADMIN",
      workspace: { create: { name: "Admin Workspace" } },
    },
  });
  console.log(`Admin oluşturuldu: ${user.email}`);
  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.log(`Dev şifresi: "${password}" — panelden ilk girişte değiştir.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
