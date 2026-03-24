const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting category normalization...');

  // Normalize "Teknik Ekip" to "TECHNICAL"
  const technicalUpdate = await prisma.personnel.updateMany({
    where: {
      category: 'Teknik Ekip'
    },
    data: {
      category: 'TECHNICAL'
    }
  });
  console.log(`Updated ${technicalUpdate.count} personnel from "Teknik Ekip" to "TECHNICAL".`);

  // Normalize "Saha Ekibi" to "FIELD"
  const fieldUpdate = await prisma.personnel.updateMany({
    where: {
      category: 'Saha Ekibi'
    },
    data: {
      category: 'FIELD'
    }
  });
  console.log(`Updated ${fieldUpdate.count} personnel from "Saha Ekibi" to "FIELD".`);

  // General fallback for any other unexpected categories (optional, but safer)
  // For now, let's keep it specific to avoid accidental data loss if other categories exist for a reason.

  console.log('Normalization complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
