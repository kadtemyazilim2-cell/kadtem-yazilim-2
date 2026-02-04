
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SITE_NAME_PART = "Tokat Zile Ovası 1 Kısım";

async function main() {
    const site = await prisma.site.findFirst({
        where: { name: { contains: SITE_NAME_PART } },
        include: {
            fuelTanks: {
                include: {
                    transfersOut: {
                        include: {
                            toTank: { include: { site: true } }
                        }
                    }
                }
            },
            fuelLogs: true
        }
    });

    if (!site) {
        console.error("Site not found!");
        return;
    }

    console.log(`Checking precise values for Doğanlı transfers...`);
    let doganliSum = 0;

    const outgoing = site.fuelTanks.flatMap(t => t.transfersOut);

    for (const t of outgoing) {
        const targetName = t.toTank?.site?.name || t.toTank?.name || "Unknown";
        if (targetName.includes("Doğanlı")) {
            console.log(`Doğanlı Log: ${t.date.toISOString()} | Amount: ${t.amount} (Type: ${typeof t.amount})`);
            doganliSum += t.amount;
        }
    }

    console.log(`Total Doğanlı Transfers: ${doganliSum}`);

    console.log(`\nChecking for any .6 log...`);
    for (const log of site.fuelLogs) {
        const decimal = log.liters % 1;
        if (decimal > 0.5 && decimal < 0.7) {
            console.log(`Log Date: ${log.date.toISOString()} | Liters: ${log.liters}`);
        }
    }

}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
