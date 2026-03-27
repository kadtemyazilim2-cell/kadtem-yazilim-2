import { NextResponse } from 'next/server';
import { updateFuelLog, updateFuelTransfer } from '@/actions/fuel';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { id, recordType, ...data } = body;

        console.log('[API STABLE] Updating Fuel Record via API:', id, 'Type:', recordType);

        if (!id) {
            return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
        }

        let result;

        if (recordType === 'TRANSFER') {
            result = await updateFuelTransfer(id, {
                amount: data.liters ? Number(data.liters) : undefined,
                date: data.date ? new Date(data.date) : undefined,
                description: data.description,
                fromType: data.fromType,
                fromId: data.fromId,
                toType: data.toType,
                toId: data.toId,
                unitPrice: data.unitPrice ? Number(data.unitPrice) : undefined,
                totalCost: data.totalCost ? Number(data.totalCost) : undefined,
            });
        } else {
            result = await updateFuelLog(id, {
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
            });
        }

        if (!result.success) {
            return NextResponse.json({ success: false, error: result.error }, { status: 500 });
        }

        console.log('[API STABLE] Update Success:', result.data?.id);

        return NextResponse.json({
            success: true,
            message: 'Update Successful (API Mode)',
            data: result.data
        });

    } catch (error: any) {
        console.error('[API STABLE] Error:', error);
        return NextResponse.json({ success: false, error: error.message || 'API Error' }, { status: 500 });
    }
}
