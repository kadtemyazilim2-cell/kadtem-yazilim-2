const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const sites = await prisma.site.findMany({
    where: {
      name: { contains: 'Aydın', mode: 'insensitive' }
    },
    select: {
      id: true,
      name: true,
      status: true,
      provisionalAcceptanceDate: true,
      finalAcceptanceDate: true,
      personnel: {
        select: { id: true, fullName: true, status: true }
      },
      assignedPersonnel: {
        select: { id: true, fullName: true, status: true }
      }
    }
  });

  console.log(JSON.stringify(sites, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
