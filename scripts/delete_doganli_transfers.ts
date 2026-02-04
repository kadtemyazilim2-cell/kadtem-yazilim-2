
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
            }
        }
    });

    if (!site) {
        console.error("Site not found!");
        return;
    }

    console.log(`Site: ${site.name}`);

    const targets = [1801, 1530];
    const toDelete: string[] = [];

    const outgoing = site.fuelTanks.flatMap(t => t.transfersOut);

    for (const t of outgoing) {
        const targetName = t.toTank?.site?.name || t.toTank?.name || "Unknown";
        if (targetName.includes("Doğanlı") && targets.includes(t.amount)) {
            console.log(`Found Transfer to Delete: ${t.date.toISOString()} | Amount: ${t.amount} | ID: ${t.id}`);
            toDelete.push(t.id);
        }
    }

    if (toDelete.length === 0) {
        console.log("No matching transfers found to delete.");
        return;
    }

    console.log(`\nDeleting ${toDelete.length} transfers...`);

    const result = await prisma.fuelTransfer.deleteMany({
        where: {
            id: { in: toDelete }
        }
    });

    console.log(`Deleted ${result.count} records.`);
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
