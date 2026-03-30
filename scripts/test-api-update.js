const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const log = await prisma.fuelLog.findFirst({ orderBy: { date: 'desc' } });
  console.log('--- BEFORE ---');
  console.log({ id: log.id, liters: log.liters });

  console.log('--- CALLING API ---');
  const res = await fetch('http://localhost:3000/api/debug/fuel-update', {
    method: 'POST',
    body: JSON.stringify({
      id: log.id,
      liters: log.liters + 1.5,
      recordType: 'LOG'
    }),
    headers: { 'Content-Type': 'application/json' }
  });
  
  const text = await res.text();
  console.log('API RESPONSE:', res.status, text);

  // Small delay for next/server revalidate (not really needed since we query DB direct next)
  await new Promise(r => setTimeout(r, 100));

  const logAfter = await prisma.fuelLog.findUnique({ where: { id: log.id } });
  console.log('--- AFTER IN DB ---');
  console.log({ id: logAfter.id, liters: logAfter.liters });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
