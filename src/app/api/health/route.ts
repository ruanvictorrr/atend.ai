import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const clinics = await prisma.clinic.count();
  const staff = await prisma.staff.count();
  const services = await prisma.service.count();
  return NextResponse.json({ ok: true, clinics, staff, services });
}
