'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Droplet, ArrowRightLeft, Fuel, Truck, TrendingDown, Factory } from 'lucide-react';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';

interface FuelStatsCardProps {
    siteId: string;
    startDate: string;
    endDate: string;
    fuelTransfers: any[];
    fuelLogs: any[];
    fuelTanks: any[];
    sites: any[];
}

export function FuelStatsCard({
    siteId,
    startDate,
    endDate,
    fuelTransfers,
    fuelLogs,
    fuelTanks,
    sites
}: FuelStatsCardProps) {

    const stats = useMemo(() => {
        // 1. Initial State
        let capacity = 0;
        let purchased = 0;
        let transferredIn = 0;
        let transferredOut = 0;
        let consumed = 0;
        let remaining = 0;

        // If no site selected, we might show total or zeros. 
        // User request implies selecting a site. 
        // If siteId is empty, we return zeros or aggregates. Let's return aggregates if "All" but usually specific site logic is requested.

        // 2. Identify Tanks for this Site
        const siteTanks = fuelTanks.filter(t => {
            const siteMatches = !siteId || t.siteId === siteId;
            // Also check if site is active if we are in "All Sites" mode? 
            // But usually this card is shown ONLY when a site is selected per code in Page.tsx
            // If selectedSiteId is set, user specifically selected it.
            // If user selects a "Passive" site from dropdown (if we allow listing passive sites there?), then stats should probably show?
            // But user said "ekranda gözükmesin".
            // The Site Select in page.tsx ALREADY filters `s.status === 'ACTIVE'`.
            // So `FuelStatsCard` will only receive an Active Site ID.
            // However, for robustness, if we ever allow "All", we should filter.
            // Since currently `siteId` is required for the card to render (in page.tsx), this logic is safe.
            return siteMatches;
        });
        const siteTankIds = siteTanks.map(t => t.id);

        // Capacity & Remaining (Snapshot - not affected by Date Range usually, but User wants "History"? 
        // "Depoda kalan" is usually current. But if date range is past, it's tricky.
        // Let's assume Capacity and Remaining are CURRENT SNAPSHOTS as per standard request unless historical calculation is needed.
        // However, "Harcanan", "Alınan" etc are strictly DATE RANGE based.
        // "Depoda Kalan" could be calculated historically: (Start Balance + In - Out - Consumed). 
        // Let's try to calculate Historical Ending Balance if date is provided, otherwise Current.

        // Current Capacity & Level
        capacity = siteTanks.reduce((acc, t) => acc + t.capacity, 0);
        remaining = siteTanks.reduce((acc, t) => acc + t.currentLevel, 0); // Default to current

        // 3. Date Filtering
        const start = startDate ? startOfDay(parseISO(startDate)) : null;
        const end = endDate ? endOfDay(parseISO(endDate)) : null;

        const dateFilter = (dateStr: string) => {
            if (!startDate && !endDate) return true;
            const d = parseISO(dateStr);
            if (start && d < start) return false;
            if (end && d > end) return false;
            return true;
        };

        // 4. Calculate Flows (Date Range Dependent)

        // A. Purchased (External -> Tank in Site)
        const relevantPurchases = fuelTransfers.filter(t =>
            t.fromType === 'EXTERNAL' &&
            t.toType === 'TANK' &&
            siteTankIds.includes(t.toId) &&
            dateFilter(t.date)
        );
        purchased = relevantPurchases.reduce((acc, t) => acc + t.amount, 0);

        // B. Transferred In (Other Tank -> Tank in Site)
        const relevantTransfersIn = fuelTransfers.filter(t =>
            t.fromType === 'TANK' &&
            t.toType === 'TANK' &&
            siteTankIds.includes(t.toId) &&
            !siteTankIds.includes(t.fromId) && // Must come from OUTSIDE this site
            dateFilter(t.date)
        );
        transferredIn = relevantTransfersIn.reduce((acc, t) => acc + t.amount, 0);

        // C. Transferred Out (Tank in Site -> Other Tank)
        const relevantTransfersOut = fuelTransfers.filter(t =>
            t.fromType === 'TANK' &&
            // Destination can be Tank (other site) or Vehicle? usually Tank to Tank is "Virman". Tank to Vehicle is "Dispense" (Log?) No, Transfer model covers Tank->Vehicle too?
            // "Başka şantiyeye gönderilen" implies Tank->Tank virman.
            t.toType === 'TANK' &&
            siteTankIds.includes(t.fromId) &&
            !siteTankIds.includes(t.toId) && // Must go to OUTSIDE this site
            dateFilter(t.date)
        );
        transferredOut = relevantTransfersOut.reduce((acc, t) => acc + t.amount, 0);

        // D. Consumed (Tank in Site -> Vehicle (Log) OR Tank -> Vehicle (Transfer?))
        // Usually Consumption is logged in FuelLog.
        const relevantLogs = fuelLogs.filter(l =>
            l.siteId === siteId && // Log is associated with site
            l.tankId && siteTankIds.includes(l.tankId) && // And specifically from these tanks
            dateFilter(l.date)
        );
        consumed = relevantLogs.reduce((acc, l) => acc + l.liters, 0);

        // If User wants "Historical Remaining" based on Date Range:
        // That requires calculating "Start Balance" recursively. 
        // For now, let's stick to FLOWS for the metrics. 
        // "Depoda Kalan" request is vague: usually implies "At the end of period" or "Current".
        // Given existing UI usually shows Current, let's keep "Remaining" as Current unless heavily requested.
        // Wait, "Depoda Kalan: 15.383" in user text.
        // If I strictly follow: Capacity (Fixed), Purchased (Flow), In (Flow), Out (Flow), Consumed (Flow), Remaining (Result?).
        // If Start Balance is unknown, we can't calculate Remaining Result correctly from Flow.
        // So allow Remaining to be Current Level for now. 

        return {
            capacity,
            purchased,
            transferredIn,
            transferredOut,
            consumed,
            remaining
        };

    }, [siteId, startDate, endDate, fuelTransfers, fuelLogs, fuelTanks]);

    // Formatters
    const fmt = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' lt';

    if (!siteId) return null; // Don't show if no site selected? Or show Empty?

    return (
        <Card className="bg-slate-50 border-slate-200 shadow-sm mb-6">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                    <Factory className="w-5 h-5 text-slate-500" />
                    {sites.find(s => s.id === siteId)?.name || 'Şantiye'} - Yakıt Özeti
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                    {/* Capacity */}
                    <div className="flex flex-col p-3 bg-white rounded-lg border shadow-sm">
                        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Depo Kapasite</span>
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-blue-100 rounded-md">
                                <Droplet className="w-4 h-4 text-blue-600" />
                            </div>
                            <span className="text-lg font-bold text-slate-700">{fmt(stats.capacity)}</span>
                        </div>
                    </div>

                    {/* External Purchase */}
                    <div className="flex flex-col p-3 bg-white rounded-lg border shadow-sm">
                        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Akaryakıt İst. Alınan</span>
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-green-100 rounded-md">
                                <Fuel className="w-4 h-4 text-green-600" />
                            </div>
                            <span className="text-lg font-bold text-green-600">+{fmt(stats.purchased)}</span>
                        </div>
                    </div>

                    {/* Transfer In */}
                    <div className="flex flex-col p-3 bg-white rounded-lg border shadow-sm">
                        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Virmanla Gelen</span>
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-emerald-100 rounded-md">
                                <ArrowRightLeft className="w-4 h-4 text-emerald-600" />
                            </div>
                            <span className="text-lg font-bold text-emerald-600">+{fmt(stats.transferredIn)}</span>
                        </div>
                    </div>

                    {/* Transfer Out */}
                    <div className="flex flex-col p-3 bg-white rounded-lg border shadow-sm">
                        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Şantiyeye Gönderilen</span>
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-orange-100 rounded-md">
                                <ArrowRightLeft className="w-4 h-4 text-orange-600" />
                            </div>
                            <span className="text-lg font-bold text-orange-600">-{fmt(stats.transferredOut)}</span>
                        </div>
                    </div>

                    {/* Consumed */}
                    <div className="flex flex-col p-3 bg-white rounded-lg border shadow-sm">
                        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Harcanan</span>
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-red-100 rounded-md">
                                <Truck className="w-4 h-4 text-red-600" />
                            </div>
                            <span className="text-lg font-bold text-red-600">-{fmt(stats.consumed)}</span>
                        </div>
                    </div>

                    {/* Remaining */}
                    <div className="flex flex-col p-3 bg-white rounded-lg border shadow-sm border-l-4 border-l-blue-500">
                        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Depoda Kalan</span>
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-slate-100 rounded-md">
                                <TrendingDown className="w-4 h-4 text-slate-600" />
                            </div>
                            <span className="text-lg font-bold text-slate-800">{fmt(stats.remaining)}</span>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
