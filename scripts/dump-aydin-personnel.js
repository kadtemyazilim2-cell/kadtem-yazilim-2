const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const siteId = 'cmkmop5q5000fhgexroggue2m';
  const personnel = await prisma.personnel.findMany({
    where: {
      OR: [
        { siteId: siteId },
        { assignedSites: { some: { id: siteId } } }
      ]
    },
    include: {
      assignedSites: true
    }
  });

  console.log(JSON.stringify(personnel, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
