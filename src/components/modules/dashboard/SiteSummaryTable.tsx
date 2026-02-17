'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FuelLog, Site, FuelTransfer, FuelTank } from '@/lib/types';
import { useMemo, useState, useEffect, useRef } from 'react';
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
    const [hoveredData, setHoveredData] = useState<{ day: any; x: number; y: number } | null>(null);

    // Active tanks with display names
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

    // Vehicle details lookup for tooltip
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
                    liters: (() => {
                        const val = log.liters;
                        if (typeof val === 'number') return val;
                        if (typeof val === 'string') return parseFloat(val.replace(',', '.')) || 0;
                        return Number(val || 0);
                    })(),
                    isFull: log.fullTank || false,
                });
            } catch { /* skip */ }
        });

        return map;
    }, [fuelLogs, activeTanks, siteTankMap, vehicles]);

    // Chart data (Calculated for 7 days)
    const chartData = useMemo(() => {
        const days = Array.from({ length: 7 }, (_, i) => {
            const d = subDays(new Date(), 6 - i);
            return {
                label: format(d, 'dd MMM', { locale: tr }),
                key: format(d, 'yyyy-MM-dd')
            };
        });

        return days.map((day) => {
            const row: any = {
                name: day.label,
                fullDate: day.key,
                key: day.key,
                total: 0
            };

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

                const val = log.liters;
                let liters = 0;
                if (typeof val === 'number') liters = val;
                else if (typeof val === 'string') liters = parseFloat(val.replace(',', '.')) || 0;
                else liters = Number(val || 0);

                row[resolvedTankId] = (row[resolvedTankId] || 0) + liters;
                row.total += liters;
            });

            return row;
        });
    }, [fuelLogs, activeTanks, siteTankMap]);

    // Calculate max value for scaling
    const maxTotal = useMemo(() => {
        const max = Math.max(...chartData.map(d => d.total));
        return max > 0 ? max * 1.1 : 100; // 10% buffering
    }, [chartData]);

    if (activeTanks.length === 0) {
        return (
            <Card className="shadow-sm border-slate-200">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold text-slate-700 flex items-center gap-2">
                        <Fuel className="h-4 w-4" />
                        Günlük Depo Harcaması (Son 7 Gün)
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 text-slate-500 text-sm">Aktif depo bulunamadı.</div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="shadow-sm border-slate-200 h-full relative">
            <CardHeader className="pb-2 border-b border-slate-100 bg-slate-50/50">
                <CardTitle className="text-base font-semibold text-slate-700 flex items-center gap-2">
                    <Fuel className="h-4 w-4 text-slate-400" />
                    Günlük Depo Harcaması (Son 7 Gün)
                </CardTitle>
                <p className="text-xs text-muted-foreground">Şantiye depolarından araçlara verilen günlük yakıt (CSS Grafik)</p>
            </CardHeader>
            <CardContent className="px-2 sm:px-6 py-6">
                <div className="w-full overflow-x-auto pb-4 custom-scrollbar">
                    <div className="min-w-[600px] h-[300px] flex items-end justify-between gap-4 px-4 relative">
                        {/* Y-Axis visual guide lines */}
                        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-10">
                            {[0, 0.25, 0.5, 0.75, 1].reverse().map((tick) => (
                                <div key={`tick-${tick}`} className="w-full border-t border-slate-900 relative">
                                    <span className="absolute -left-0 -top-2 text-[10px] text-slate-900 bg-white pr-1">
                                        {Math.round(maxTotal * tick).toLocaleString('tr-TR')}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {chartData.map((day) => {
                            return (
                                <div
                                    key={`day-${day.key}`}
                                    className="relative flex flex-col items-center flex-1 h-full justify-end group z-10 cursor-default"
                                    onMouseEnter={(e) => {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        setHoveredData({
                                            day,
                                            x: rect.left + rect.width / 2,
                                            y: rect.top
                                        });
                                    }}
                                    onMouseLeave={() => setHoveredData(null)}
                                >
                                    {/* Stacked Bar */}
                                    <div className="w-full max-w-[40px] bg-slate-100 rounded-t-sm relative flex flex-col-reverse overflow-hidden transition-all duration-300 hover:shadow-md hover:bg-slate-200"
                                        style={{ height: `${(day.total / maxTotal) * 100}%` }}>
                                        {activeTanks.map((tank, idx) => {
                                            const val = day[tank.id];
                                            if (!val || val <= 0) return null;
                                            const heightPerc = (val / day.total) * 100;
                                            return (
                                                <div
                                                    key={`bar-${tank.id}-${idx}`}
                                                    style={{ height: `${heightPerc}%`, backgroundColor: TANK_COLORS[idx % TANK_COLORS.length] }}
                                                    className="w-full transition-all duration-300 opacity-90 hover:opacity-100"
                                                />
                                            );
                                        })}
                                    </div>

                                    {/* Date Label */}
                                    <div className="mt-2 text-[10px] font-medium text-slate-500 whitespace-nowrap">
                                        {day.name}
                                    </div>
                                    <div className="text-[10px] font-bold text-slate-700">
                                        {day.total > 0 ? `${Math.round(day.total).toLocaleString('tr-TR')}` : ''}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Legend */}
                <div className="mt-4 flex flex-wrap gap-3 justify-center border-t border-slate-100 pt-4">
                    {activeTanks.map((tank, idx) => (
                        <div key={`legend-${tank.id}-${idx}`} className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: TANK_COLORS[idx % TANK_COLORS.length] }} />
                            <span className="text-xs text-slate-600">{tank.displayName}</span>
                        </div>
                    ))}
                </div>
            </CardContent>

            {/* Floating Tooltip Portal-like */}
            {hoveredData && (
                <div
                    className="fixed z-[9999] pointer-events-none drop-shadow-xl"
                    style={{
                        left: Math.min(hoveredData.x, window.innerWidth - 160),
                        top: hoveredData.y,
                        transform: 'translate(-50%, -100%)',
                        marginTop: '-12px'
                    }}
                >
                    <div className="bg-white p-3 border border-slate-200 shadow-xl rounded-lg text-xs min-w-[220px]">
                        <div className="flex justify-between items-center border-b pb-1.5 mb-2">
                            <span className="font-bold text-slate-700">{hoveredData.day.label}</span>
                            <span className="font-mono font-bold text-slate-900">{Math.round(hoveredData.day.total).toLocaleString('tr-TR')} Lt</span>
                        </div>
                        <div className="space-y-1">
                            {activeTanks.map((tank, idx) => {
                                const val = hoveredData.day[tank.id];
                                if (!val || val <= 0) return null;

                                const details = detailsMap[hoveredData.day.key]?.[tank.id] || [];
                                return (
                                    <div key={`tooltip-${tank.id}-${idx}`}>
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: TANK_COLORS[idx % TANK_COLORS.length] }} />
                                            <span className="text-slate-600 truncate max-w-[120px]">{tank.name}</span>
                                            <span className="ml-auto font-mono font-semibold text-slate-900">
                                                {Math.round(val).toLocaleString('tr-TR')}
                                            </span>
                                        </div>
                                        {/* Vehicle Details */}
                                        {details.length > 0 && (
                                            <div className="ml-3 pl-2 border-l border-slate-100 mt-1 space-y-0.5">
                                                {[...details].sort((a, b) => b.liters - a.liters).map((d, i) => (
                                                    <div key={`detail-${i}`} className="text-[10px] text-slate-500 flex justify-between">
                                                        <span>{d.plate}</span>
                                                        <span>{Math.round(d.liters)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </Card>
    );
}
