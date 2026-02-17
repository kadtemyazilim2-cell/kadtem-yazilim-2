'use client';

import { useAppStore } from '@/lib/store/use-store';
import { useAuth } from '@/lib/store/use-auth';
import { useEffect, useState, Component, ErrorInfo, ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowRightLeft } from 'lucide-react';
import { FuelConsumptionReport } from '@/components/modules/fuel/FuelConsumptionReport';
import { FuelTankList } from '@/components/modules/fuel/FuelTankList';
import { FuelTransferList } from '@/components/modules/fuel/FuelTransferList';
import { FuelPurchaseList } from '@/components/modules/fuel/FuelPurchaseList';
import { FuelStatsCard } from '@/components/modules/fuel/FuelStatsCard';
import { VehicleConsumptionRatios } from '@/components/modules/fuel/VehicleConsumptionRatios';

// Error Boundary to catch client-side rendering crashes
class FuelErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
    constructor(props: { children: ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('FuelPage Error Boundary:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
                    <h3 className="text-lg font-semibold text-red-800 mb-2">Yakıt Sayfası Yüklenirken Hata Oluştu</h3>
                    <p className="text-sm text-red-600 mb-4">{this.state.error?.message || 'Bilinmeyen hata'}</p>
                    <pre className="text-xs bg-red-100 p-2 rounded overflow-auto max-h-32 mb-4">{this.state.error?.stack}</pre>
                    <button
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                        onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
                    >
                        Sayfayı Yenile
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

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
        <FuelErrorBoundary>
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Yakıt Takip ve Stoklar</h2>
                        <p className="text-muted-foreground">
                            Depo stok durumları ve detaylı tüketim raporları.
                        </p>
                    </div>

                </div>

                {/* Existing Components... Assuming they use store internally */}
                {/* If FuelTankList uses store, it should work fine after hydration above */}
                {canViewTanks && <FuelTankList />}
                {canViewConsumption && <FuelConsumptionReport initialSiteId={selectedSiteId} />}

                {/* TODO: Add other components if needed */}

                {/* Vehicle Consumption Ratios */}
                {canViewConsumption && <VehicleConsumptionRatios />}
            </div>
        </FuelErrorBoundary>
    );
}
