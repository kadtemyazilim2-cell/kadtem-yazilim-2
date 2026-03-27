import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkData() {
  try {
    const userCount = await prisma.user.count();
    const companyCount = await prisma.company.count();
    const siteCount = await prisma.site.count();
    const vehicleCount = await prisma.vehicle.count();
    const personnelCount = await prisma.personnel.count();
    const fuelLogCount = await prisma.fuelLog.count();
    const attendanceCount = await prisma.personnelAttendance.count();

    console.log('--- Database Record Counts ---');
    console.log(`Users: ${userCount}`);
    console.log(`Companies: ${companyCount}`);
    console.log(`Sites: ${siteCount}`);
    console.log(`Vehicles: ${vehicleCount}`);
    console.log(`Personnel: ${personnelCount}`);
    console.log(`Fuel Logs: ${fuelLogCount}`);
    console.log(`Attendance Records: ${attendanceCount}`);
    console.log('------------------------------');

    // Also list some site names to be sure
    const sites = await prisma.site.findMany({ select: { name: true }, take: 5 });
    console.log('Sample Sites:', sites.map(s => s.name).join(', '));

  } catch (error) {
    console.error('Error checking data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();
