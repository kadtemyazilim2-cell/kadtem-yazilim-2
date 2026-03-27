const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const sites = await prisma.site.findMany({
    where: {
      name: {
        contains: 'Aydın',
        mode: 'insensitive',
      },
    },
    select: {
      id: true,
      name: true,
    },
  });

  console.log('Sites found:', JSON.stringify(sites, null, 2));

  for (const site of sites) {
    const personnel = await prisma.personnel.findMany({
      where: {
        OR: [
          { siteId: site.id },
          { assignedSites: { some: { id: site.id } } }
        ]
      },
      select: {
        id: true,
        fullName: true,
        status: true,
        siteId: true,
      }
    });
    console.log(`Personnel for site ${site.name} (${site.id}):`, JSON.stringify(personnel, null, 2));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
