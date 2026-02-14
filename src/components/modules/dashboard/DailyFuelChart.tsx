'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FuelLog, Site, FuelTransfer, FuelTank } from '@/lib/types';
import { useMemo, useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, subDays } from 'date-fns';
import { tr } from 'date-fns/locale';

const TANK_COLORS = [
    '#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed',
    '#db2777', '#0891b2', '#ea580c', '#4f46e5', '#059669',
];

export function DailyFuelChart({ fuelLogs, fuelTanks, sites }: {
    fuelLogs: FuelLog[];
    fuelTransfers?: FuelTransfer[];
    fuelTanks?: FuelTank[];
    sites: Site[];
    vehicles: any[];
}) {
    // Delay rendering to avoid ResponsiveContainer dimension bug
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        const timer = setTimeout(() => setMounted(true), 100);
        return () => clearTimeout(timer);
    }, []);

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

    // Custom tooltip
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length > 0) {
            const sorted = [...payload].filter((p: any) => p.value > 0).sort((a: any, b: any) => b.value - a.value);
            const total = sorted.reduce((sum: number, e: any) => sum + e.value, 0);
            if (total === 0) return null;

            return (
                <div className="bg-white p-3 border border-slate-200 shadow-lg rounded-lg text-xs max-w-[280px] z-50">
                    <div className="flex justify-between items-center border-b pb-1.5 mb-2">
                        <span className="font-bold text-slate-700">{label}</span>
                        <span className="font-mono font-bold text-slate-900">{Math.round(total).toLocaleString('tr-TR')} Lt</span>
                    </div>
                    <div className="space-y-1.5">
                        {sorted.map((entry: any) => (
                            <div key={entry.dataKey} className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: entry.color }} />
                                    <span className="text-slate-600 truncate">{entry.name}</span>
                                </div>
                                <span className="font-mono font-semibold text-slate-900 shrink-0">
                                    {Math.round(entry.value).toLocaleString('tr-TR')} Lt
                                </span>
                            </div>
                        ))}
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
                        ⛽ Günlük Depo Harcaması (Son 14 Gün)
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
            <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-slate-700 flex items-center gap-2">
                    ⛽ Günlük Depo Harcaması (Son 14 Gün)
                </CardTitle>
                <p className="text-xs text-muted-foreground">Şantiye depolarından günlük harcanan yakıt (Litre)</p>
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
