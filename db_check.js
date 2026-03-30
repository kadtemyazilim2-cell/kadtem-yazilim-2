const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const fuelLogsCount = await prisma.fuelLog.count();
    const fuelTanksCount = await prisma.fuelTank.count();
    const fuelTransfersCount = await prisma.fuelTransfer.count();
    
    console.log('--- DATABASE STATUS ---');
    console.log('Fuel Logs:', fuelLogsCount);
    console.log('Fuel Tanks:', fuelTanksCount);
    console.log('Fuel Transfers:', fuelTransfersCount);
    
    if (fuelLogsCount > 0) {
      const sample = await prisma.fuelLog.findFirst({
        orderBy: { date: 'desc' },
        include: { vehicle: true, site: true }
      });
      console.log('\nLatest Log sample:', {
        id: sample.id,
        date: sample.date,
        liters: sample.liters,
        vehicle: sample.vehicle?.plate,
        site: sample.site?.name
      });
    } else {
      console.log('\nWARNING: NO FUEL LOGS FOUND!');
    }
  } catch (err) {
    console.error('ERROR:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
