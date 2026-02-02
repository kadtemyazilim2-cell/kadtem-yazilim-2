'use client';

import { FuelTankList } from '@/components/modules/fuel/FuelTankList';
import { FuelConsumptionReport } from '@/components/modules/fuel/FuelConsumptionReport';
import { FuelTransferList } from '@/components/modules/fuel/FuelTransferList'; // [NEW]
import { FuelPurchaseList } from '@/components/modules/fuel/FuelPurchaseList'; // [NEW]
import { FuelStatsCard } from '@/components/modules/fuel/FuelStatsCard'; // [NEW]
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input'; // [NEW]
import { Label } from '@/components/ui/label'; // [NEW]
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'; // [NEW]
import { useAppStore } from '@/lib/store/use-store'; // [NEW]
import { useState } from 'react'; // [NEW]
import { ArrowRightLeft } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/store/use-auth';

export default function FuelPage() {
    const { user, hasPermission } = useAuth(); // [FIX] Destructure
    const perms = user?.permissions || {};
    const isAdmin = user?.role === 'ADMIN';

    const canViewTanks = isAdmin || hasPermission('fuel.tanks', 'VIEW') || hasPermission('fuel.tanks', 'EDIT');
    const canViewConsumption = isAdmin || hasPermission('fuel.consumption', 'VIEW') || hasPermission('fuel.consumption', 'EDIT');

    const {
        fuelTransfers, fuelLogs, fuelTanks, sites
    } = useAppStore();

    // [NEW] Filter States
    const [selectedSiteId, setSelectedSiteId] = useState('');
    const [dateRange, setDateRange] = useState<{ start: string, end: string }>({ start: '', end: '' });

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Yakıt Takip ve Stoklar</h2>
                    <p className="text-muted-foreground">
                        Depo stok durumları ve detaylı tüketim raporları.
                    </p>
                </div>
                {/* Manual Sync Button (Optional, for debugging or force refresh) */}
                <Button variant="outline" size="sm" onClick={() => window.location.reload()} >
                    <ArrowRightLeft className="w-4 h-4 mr-2" />
                    Verileri Yenile
                </Button>
            </div>

            {canViewConsumption && <FuelConsumptionReport />}
        </div>
    );
}
