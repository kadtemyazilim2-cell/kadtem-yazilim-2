
import { prisma } from '../src/lib/db';

async function main() {
    const TANK_ID = 'cml5n44fe000113hkmv7m9plf'; // Zile 1

    console.log(`--- ANALYZING TRANSFERS OUT FROM ZILE 1 ---`);

    const transfersOut = await prisma.fuelTransfer.findMany({
        where: { fromTankId: TANK_ID },
        orderBy: { amount: 'desc' },
        include: {
            toTank: { include: { site: true } },
            toVehicle: true
        }
    });

    console.log(`Found ${transfersOut.length} transfers out.`);

    transfersOut.forEach(t => {
        const to = t.toType === 'TANK' ? `Tank (${t.toTank?.site?.name})` : `Vehicle ${t.toVehicle?.plate}`;
        console.log(`- [${t.date.toISOString().split('T')[0]}] ${t.amount} lt -> ${to}`);
    });

}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
