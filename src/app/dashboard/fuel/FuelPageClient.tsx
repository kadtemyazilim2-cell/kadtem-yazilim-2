'use client';

import { useAppStore } from '@/lib/store/use-store';
import { useAuth } from '@/lib/store/use-auth';
import { useEffect, useState } from 'react'; // [FIX] Added imported hooks
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowRightLeft } from 'lucide-react';
import { FuelConsumptionReport } from '@/components/modules/fuel/FuelConsumptionReport';
import { FuelTankList } from '@/components/modules/fuel/FuelTankList';
import { FuelTransferList } from '@/components/modules/fuel/FuelTransferList';
import { FuelPurchaseList } from '@/components/modules/fuel/FuelPurchaseList';
import { FuelStatsCard } from '@/components/modules/fuel/FuelStatsCard';

interface FuelPageClientProps {
    fuelLogs: any[];
    fuelTanks: any[];
    fuelTransfers: any[];
}

export function FuelPageClient({ fuelLogs, fuelTanks, fuelTransfers }: FuelPageClientProps) {
    const { user, hasPermission } = useAuth(); // Destructure

    // Hydrate store on mount/update
    useEffect(() => {
        useAppStore.setState({
            fuelLogs: fuelLogs || [],
            fuelTanks: fuelTanks || [],
            fuelTransfers: fuelTransfers || [],
        });
    }, [fuelLogs, fuelTanks, fuelTransfers]);

    const isAdmin = user?.role === 'ADMIN';
    const canViewTanks = isAdmin || hasPermission('fuel.tanks', 'VIEW') || hasPermission('fuel.tanks', 'EDIT');
    const canViewConsumption = isAdmin || hasPermission('fuel.consumption', 'VIEW') || hasPermission('fuel.consumption', 'EDIT');

    const searchParams = useSearchParams();
    const urlSiteId = searchParams.get('siteId');
    const [selectedSiteId, setSelectedSiteId] = useState(urlSiteId || '');

    useEffect(() => {
        if (urlSiteId) setSelectedSiteId(urlSiteId);
    }, [urlSiteId]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Yakıt Takip ve Stoklar</h2>
                    <p className="text-muted-foreground">
                        Depo stok durumları ve detaylı tüketim raporları.
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                    <ArrowRightLeft className="w-4 h-4 mr-2" />
                    Verileri Yenile
                </Button>
            </div>

            {/* Existing Components... Assuming they use store internally */}
            {/* If FuelTankList uses store, it should work fine after hydration above */}
            {canViewTanks && <FuelTankList />}
            {canViewConsumption && <FuelConsumptionReport initialSiteId={selectedSiteId} />}

            {/* TODO: Add other components if needed */}
        </div>
    );
}
