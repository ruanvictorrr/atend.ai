import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) } as any);

async function main() {
  const clinicA = await prisma.clinic.create({
    data: {
      name: "Clínica Alpha",
      timezone: "America/Sao_Paulo",
      units: { create: [{ name: "Alpha Centro", address: "Rua A, 100 - Centro" }] },
      services: { create: [{ name: "Consulta Inicial", durationMin: 40, bufferAfterMin: 5 }] },
      faqs: { create: [{ question: "Qual o endereço?", answer: "Rua A, 100 - Centro", tags: "endereco" }] },
    },
    include: { units: true, services: true },
  });

  const clinicB = await prisma.clinic.create({
    data: {
      name: "Clínica Beta",
      timezone: "America/Sao_Paulo",
      units: { create: [{ name: "Beta Sul", address: "Av B, 200 - Sul" }] },
      services: { create: [{ name: "Retorno", durationMin: 20, bufferAfterMin: 5 }] },
    },
    include: { units: true, services: true },
  });

  console.log("✅ Seed OK", { clinicA: clinicA.id, clinicB: clinicB.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
