import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) } as any);

// 👇 sua clínica
const clinicId = "cmjc0mh0n00007aons85qjoym";

async function main() {
  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
  if (!clinic) throw new Error("Clinic not found: " + clinicId);

  // 1) Unit (cria se não existir)
  let unit = await prisma.unit.findFirst({ where: { clinicId } });
  if (!unit) {
    unit = await prisma.unit.create({
      data: {
        clinicId,
        name: "Unidade Principal",
        address: "Endereço não informado",
      },
    });
    console.log("✅ Unit criada:", unit.id);
  } else {
    console.log("ℹ️ Unit já existia:", unit.id);
  }

  // 2) Services (se não tiver nenhum, cria um básico)
  let services = await prisma.service.findMany({ where: { clinicId } });
  if (services.length === 0) {
    const created = await prisma.service.create({
      data: {
        clinicId,
        name: "Consulta",
        durationMin: 40,
        bufferBeforeMin: 0,
        bufferAfterMin: 5,
      },
    });
    services = [created];
    console.log("✅ Service criado:", created.id);
  } else {
    console.log("ℹ️ Services existentes:", services.length);
  }

  // 3) Staff (cria 1 se não existir)
  let staff = await prisma.staff.findFirst({ where: { clinicId } });
  if (!staff) {
    staff = await prisma.staff.create({
      data: {
        clinicId,
        unitId: unit.id,
        name: "Dra. Teste",
        specialty: "Clínico Geral",
      },
    });
    console.log("✅ Staff criado:", staff.id);
  } else {
    console.log("ℹ️ Staff já existia:", staff.id);
  }

  // 4) Vincular StaffService em todos os serviços
  await prisma.staffService.createMany({
    data: services.map((s) => ({ staffId: staff!.id, serviceId: s.id })),
    skipDuplicates: true,
  });
  console.log("✅ StaffService vinculado em", services.length, "services");
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
