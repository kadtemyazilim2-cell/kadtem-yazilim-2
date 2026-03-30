const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const v = await prisma.vehicle.findMany({ where: { rentalCompanyName: { contains: 'ATILIM' } } });
  console.log('RENTAL:', v.map(vi => ({plate: vi.plate, ownership: vi.ownership, rentalCompanyName: vi.rentalCompanyName, status: vi.status})));
  const c = await prisma.company.findMany({ where: { name: { contains: 'ATILIM' } } });
  console.log('COMPANIES:', c.map(ci => ({id: ci.id, name: ci.name})));
}
main().finally(() => prisma.$disconnect());
