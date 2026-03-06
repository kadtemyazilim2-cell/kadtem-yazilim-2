import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// ONE-TIME FIX: Update Aydın Nazilli tank currentLevel for correct devir calculation
// GET /api/debug/fix-devir?confirm=yes
export async function GET(req: NextRequest) {
    const confirm = req.nextUrl.searchParams.get('confirm');

    const TANK_NAME_KEYWORD = 'Nazilli';
    const CORRECT_DEVIR = 11905;

    try {
        // Find the tank
        const tank = await prisma.fuelTank.findFirst({
            where: { name: { contains: TANK_NAME_KEYWORD } },
            include: { site: { select: { name: true } } }
        });

        if (!tank) {
            return NextResponse.json({ error: 'Tank bulunamadı' }, { status: 404 });
        }

        // Calculate current devir
        const siteId = tank.siteId;

        // Get all fuel logs for this site
        const fuelLogs = await prisma.fuelLog.findMany({
            where: { siteId },
            select: { liters: true }
        });
        const totalConsumed = fuelLogs.reduce((sum, l) => sum + l.liters, 0);

        // Get purchases for this tank
        const purchases = await prisma.fuelTransfer.findMany({
            where: { fromType: 'EXTERNAL', toType: 'TANK', toId: tank.id },
            select: { amount: true }
        });
        const totalPurchased = purchases.reduce((sum, p) => sum + p.amount, 0);

        // Get transfers
        const transfersOut = await prisma.fuelTransfer.findMany({
            where: { fromType: 'TANK', fromId: tank.id },
            select: { amount: true }
        });
        const totalTransferOut = transfersOut.reduce((sum, t) => sum + t.amount, 0);

        const transfersIn = await prisma.fuelTransfer.findMany({
            where: { toType: 'TANK', toId: tank.id, fromType: { not: 'EXTERNAL' } },
            select: { amount: true }
        });
        const totalTransferIn = transfersIn.reduce((sum, t) => sum + t.amount, 0);

        // Current devir = currentLevel + consumed - purchased + transferOut - transferIn
        const currentDevir = tank.currentLevel + totalConsumed - totalPurchased + totalTransferOut - totalTransferIn;

        // Difference to fix
        const diff = currentDevir - CORRECT_DEVIR;
        const newCurrentLevel = tank.currentLevel - diff;

        const info = {
            tank: tank.name,
            site: tank.site?.name,
            currentLevel: tank.currentLevel,
            totalConsumed,
            totalPurchased,
            totalTransferOut,
            totalTransferIn,
            currentDevir,
            correctDevir: CORRECT_DEVIR,
            diff,
            newCurrentLevel,
            fuelLogCount: fuelLogs.length,
        };

        if (confirm !== 'yes') {
            return NextResponse.json({
                message: 'Düzeltme için ?confirm=yes ekleyin',
                dryRun: true,
                ...info
            });
        }

        // Apply fix
        const updated = await prisma.fuelTank.update({
            where: { id: tank.id },
            data: { currentLevel: newCurrentLevel }
        });

        return NextResponse.json({
            message: 'Düzeltme uygulandı!',
            applied: true,
            oldCurrentLevel: tank.currentLevel,
            newCurrentLevel: updated.currentLevel,
            oldDevir: currentDevir,
            newDevir: CORRECT_DEVIR,
            ...info
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
