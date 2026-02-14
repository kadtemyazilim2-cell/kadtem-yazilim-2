'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FuelLog, Site, FuelTransfer, FuelTank } from '@/lib/types';
import { useMemo, useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, subDays } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Fuel } from 'lucide-react';

const TANK_COLORS = [
    '#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed',
    '#db2777', '#0891b2', '#ea580c', '#4f46e5', '#059669',
];

interface SiteSummaryTableProps {
    sites: any[];
    personnel?: any[];
    vehicles: any[];
    fuelLogs: any[];
    fuelTanks?: any[];
    fuelTransfers?: any[];
    cashTransactions?: any[];
}

export function SiteSummaryTable({ fuelLogs, fuelTanks, sites, vehicles }: SiteSummaryTableProps) {
    // Delay rendering to avoid ResponsiveContainer dimension bug
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        const timer = setTimeout(() => setMounted(true), 100);
        return () => clearTimeout(timer);
    }, []);

    // Active tanks with display names (SAME as old DailyFuelChart)
    const activeTanks = useMemo(() => {
        const tanks = (fuelTanks || []).filter((t: any) => t.status !== 'PASSIVE');
        return tanks.map((t: any) => {
            const site = sites.find((s: any) => s.id === t.siteId);
            const siteName = site?.name || '';
            const shortSite = siteName.length > 15 ? siteName.substring(0, 13) + '..' : siteName;
            return {
                ...t,
                displayName: `${t.name} (${shortSite})`,
            };
        });
    }, [fuelTanks, sites]);

    // Map: siteId -> tankId (fallback when log has no tankId)
    const siteTankMap = useMemo(() => {
        const map: Record<string, string> = {};
        activeTanks.forEach((t: any) => {
            if (!map[t.siteId]) map[t.siteId] = t.id;
        });
        return map;
    }, [activeTanks]);

    // Vehicle details lookup for tooltip (separate from chart data)
    const detailsMap = useMemo(() => {
        const map: Record<string, Record<string, { plate: string; brand: string; liters: number; isFull: boolean }[]>> = {};

        fuelLogs.forEach((log: any) => {
            try {
                const dateKey = format(new Date(log.date), 'yyyy-MM-dd');
                const resolvedTankId = log.tankId || siteTankMap[log.siteId];
                if (!resolvedTankId) return;
                const tank = activeTanks.find((t: any) => t.id === resolvedTankId);
                if (!tank) return;

                if (!map[dateKey]) map[dateKey] = {};
                if (!map[dateKey][resolvedTankId]) map[dateKey][resolvedTankId] = [];

                const vehicle = vehicles.find((v: any) => v.id === log.vehicleId);
                map[dateKey][resolvedTankId].push({
                    plate: vehicle?.plate || '-',
                    brand: vehicle ? `${vehicle.brand || ''} ${vehicle.model || ''}`.trim() : '',
                    liters: Number(log.liters || 0),
                    isFull: log.fullTank || false,
                });
            } catch { /* skip */ }
        });

        return map;
    }, [fuelLogs, activeTanks, siteTankMap, vehicles]);

    // Chart data (EXACT SAME logic as old working DailyFuelChart)
    const chartData = useMemo(() => {
        const days = Array.from({ length: 14 }, (_, i) => {
            const d = subDays(new Date(), 13 - i);
            return {
                label: format(d, 'dd MMM', { locale: tr }),
                key: format(d, 'yyyy-MM-dd')
            };
        });

        return days.map((day) => {
            const row: any = { name: day.label, fullDate: day.key };

            // Init all tanks to 0
            activeTanks.forEach((tank) => { row[tank.id] = 0; });

            // Filter logs for this day
            const dayLogs = fuelLogs.filter((log: any) => {
                try {
                    return format(new Date(log.date), 'yyyy-MM-dd') === day.key;
                } catch { return false; }
            });

            // Sum liters per tank
            dayLogs.forEach((log: any) => {
                let resolvedTankId = log.tankId || siteTankMap[log.siteId];
                if (!resolvedTankId) return;

                const tank = activeTanks.find((t: any) => t.id === resolvedTankId);
                if (!tank) return;

                row[resolvedTankId] = (row[resolvedTankId] || 0) + Number(log.liters || 0);
            });

            return row;
        });
    }, [fuelLogs, activeTanks, siteTankMap]);

    // Custom tooltip with vehicle breakdown
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length > 0) {
            const sorted = [...payload].filter((p: any) => p.value > 0).sort((a: any, b: any) => b.value - a.value);
            const total = sorted.reduce((sum: number, e: any) => sum + e.value, 0);
            if (total === 0) return null;

            const dateKey = payload[0]?.payload?.fullDate;

            return (
                <div className="bg-white p-3 border border-slate-200 shadow-xl rounded-lg text-xs max-w-[340px] z-50">
                    <div className="flex justify-between items-center border-b pb-1.5 mb-2">
                        <span className="font-bold text-slate-700">{label}</span>
                        <span className="font-mono font-bold text-slate-900">{Math.round(total).toLocaleString('tr-TR')} Lt</span>
                    </div>
                    <div className="space-y-2">
                        {sorted.map((entry: any) => {
                            const details = dateKey ? (detailsMap[dateKey]?.[entry.dataKey] || []) : [];
                            return (
                                <div key={entry.dataKey}>
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: entry.color }} />
                                        <span className="font-semibold text-slate-700">{entry.name}</span>
                                        <span className="ml-auto font-mono font-bold text-slate-900">
                                            {Math.round(entry.value).toLocaleString('tr-TR')} Lt
                                        </span>
                                    </div>
                                    {details.length > 0 && (
                                        <div className="ml-4 space-y-0.5 border-l-2 border-slate-100 pl-2">
                                            {details.sort((a, b) => b.liters - a.liters).map((d, i) => (
                                                <div key={i} className="flex items-center justify-between text-slate-500 gap-2">
                                                    <span className="min-w-0">
                                                        <span className="font-mono font-medium text-slate-600">{d.plate}</span>
                                                        {d.brand && <span className="ml-1 text-[10px] text-slate-400">{d.brand}</span>}
                                                        {d.isFull && <span className="ml-1 text-[9px] font-bold text-green-600 bg-green-50 px-1 rounded">FULL</span>}
                                                    </span>
                                                    <span className="font-mono text-slate-600 shrink-0">{Math.round(d.liters)} Lt</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        }
        return null;
    };

    if (activeTanks.length === 0) {
        return (
            <Card className="shadow-sm border-slate-200">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold text-slate-700 flex items-center gap-2">
                        <Fuel className="h-4 w-4" />
                        Günlük Depo Harcaması (Son 14 Gün)
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 text-slate-500 text-sm">Aktif depo bulunamadı.</div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-2 border-b border-slate-100 bg-slate-50/50">
                <CardTitle className="text-base font-semibold text-slate-700 flex items-center gap-2">
                    <Fuel className="h-4 w-4 text-slate-400" />
                    Günlük Depo Harcaması (Son 14 Gün)
                </CardTitle>
                <p className="text-xs text-muted-foreground">Şantiye depolarından araçlara verilen günlük yakıt — çubuğun üzerine gelince araç detaylarını görüntüleyin</p>
            </CardHeader>
            <CardContent className="px-2 sm:px-6">
                {!mounted ? (
                    <div className="flex items-center justify-center" style={{ height: 350 }}>
                        <span className="text-sm text-muted-foreground">Grafik yükleniyor...</span>
                    </div>
                ) : (
                    <div style={{ width: '100%', height: 350 }}>
                        <ResponsiveContainer width="100%" height={350} minWidth={0}>
                            <BarChart
                                data={chartData}
                                margin={{ top: 10, right: 10, left: -10, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis
                                    dataKey="name"
                                    fontSize={11}
                                    tickLine={false}
                                    axisLine={false}
                                    tick={{ fill: '#64748b' }}
                                />
                                <YAxis
                                    fontSize={11}
                                    tickLine={false}
                                    axisLine={false}
                                    tick={{ fill: '#64748b' }}
                                    allowDecimals={false}
                                    tickFormatter={(v) => `${v} Lt`}
                                />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9' }} />
                                <Legend
                                    wrapperStyle={{ paddingTop: '12px', fontSize: '11px' }}
                                    iconType="square"
                                    iconSize={10}
                                />
                                {activeTanks.map((tank, index) => (
                                    <Bar
                                        key={tank.id}
                                        dataKey={tank.id}
                                        name={tank.displayName}
                                        stackId="tanks"
                                        fill={TANK_COLORS[index % TANK_COLORS.length]}
                                        radius={index === activeTanks.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                                        maxBarSize={45}
                                    />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
