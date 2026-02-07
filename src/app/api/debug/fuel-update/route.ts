import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { id, recordType, ...data } = body;

        console.log('[API STABLE] Updating Fuel Record via API:', id, 'Type:', recordType);

        if (!id) {
            return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
        }

        let updatedRecord;

        if (recordType === 'TRANSFER') {
            // Update Transfer
            updatedRecord = await prisma.fuelTransfer.update({
                where: { id },
                data: {
                    siteId: data.siteId,
                    toId: data.toId, // Tank vs.
                    toType: data.toType,
                    amount: data.liters ? Number(data.liters) : undefined, // Frontend liters gonderiyor
                    date: data.date ? new Date(data.date) : undefined,
                    description: data.description,
                    processed: data.processed,
                }
            });
        } else {
            // Update Log
            // Prevent payload issues by picking only necessary fields
            updatedRecord = await prisma.fuelLog.update({
                where: { id },
                data: {
                    vehicleId: data.vehicleId,
                    siteId: data.siteId,
                    tankId: data.tankId || null,
                    filledByUserId: data.filledByUserId,
                    date: data.date ? new Date(data.date) : undefined,
                    liters: data.liters ? Number(data.liters) : undefined,
                    cost: data.cost ? Number(data.cost) : undefined,
                    unitPrice: data.unitPrice ? Number(data.unitPrice) : undefined,
                    mileage: data.mileage ? Number(data.mileage) : undefined,
                    fullTank: data.fullTank,
                    description: data.description,
                }
            });
        }

        console.log('[API STABLE] Update Success:', updatedRecord.id);

        return NextResponse.json({
            success: true,
            message: 'Update Successful (API Mode)',
            data: updatedRecord
        });

    } catch (error: any) {
        console.error('[API STABLE] Error:', error);
        return NextResponse.json({ success: false, error: error.message || 'API Error' }, { status: 500 });
    }
}
