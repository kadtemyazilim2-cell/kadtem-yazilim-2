'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FuelLog, Site, FuelTransfer, FuelTank } from '@/lib/types';
import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, subDays, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { tr } from 'date-fns/locale';

export function DailyFuelChart({ fuelLogs, fuelTransfers, fuelTanks, sites, vehicles }: {
    fuelLogs: FuelLog[];
    fuelTransfers?: FuelTransfer[]; // Optional to avoid break if not passed
    fuelTanks?: FuelTank[];
    sites: Site[];
    vehicles: any[];
}) {
    const chartData = useMemo(() => {
        // Get last 14 days
        const days = Array.from({ length: 14 }, (_, i) => {
            const d = subDays(new Date(), 13 - i);
            return {
                date: d,
                label: format(d, 'dd MMM', { locale: tr }),
                key: format(d, 'yyyy-MM-dd')
            };
        });

        const activeSites = sites.filter((s: any) => s.status === 'ACTIVE');

        // Initialize data structure
        const data = days.map((day: any) => {
            const row: any = {
                name: day.label,
                fullDate: day.key,
                details: {} as Record<string, { label: string; liters: number; type: 'IN' | 'OUT' }[]>
            };
            activeSites.forEach((site: any) => {
                row[site.name] = 0;
                row.details[site.name] = [];
            });
            return row;
        });

        // 1. Process Logs (OUT)
        fuelLogs.forEach((log: any) => {
            const logDate = format(new Date(log.date), 'yyyy-MM-dd');
            const dataRow = data.find((d: any) => d.fullDate === logDate);

            if (dataRow) {
                const site = sites.find((s: any) => s.id === log.siteId);
                const vehicle = vehicles.find((v: any) => v.id === log.vehicleId);

                if (site && site.status === 'ACTIVE') {
                    // For Chart Line: We use Total Activity (Sum of Liters) to ensure point exists
                    dataRow[site.name] = (dataRow[site.name] || 0) + log.liters;

                    dataRow.details[site.name].push({
                        label: vehicle ? vehicle.plate : 'Araç',
                        liters: log.liters,
                        type: 'OUT'
                    });
                }
            }
        });

        // 2. Process Transfers (IN & OUT)
        if (fuelTransfers && fuelTanks) {
            fuelTransfers.forEach((t: any) => {
                const tDate = format(new Date(t.date), 'yyyy-MM-dd');
                const dataRow = data.find((d: any) => d.fullDate === tDate);

                if (dataRow) {
                    // A. INCOMING (Target is Tank)
                    if (t.toType === 'TANK') {
                        const tank = fuelTanks.find((tk: any) => tk.id === t.toId);
                        const site = sites.find((s: any) => s.id === tank?.siteId);

                        if (site && site.status === 'ACTIVE') {
                            // Add to Activity Sum so it shows on chart
                            dataRow[site.name] = (dataRow[site.name] || 0) + t.amount;

                            const provider = t.fromType === 'EXTERNAL' ? (t.fromId || 'Satın Alma') : 'Transfer Giriş';
                            dataRow.details[site.name].push({
                                label: provider,
                                liters: t.amount,
                                type: 'IN'
                            });
                        }
                    }

                    // B. OUTGOING (Source is Tank)
                    if (t.fromType === 'TANK') {
                        const tank = fuelTanks.find((tk: any) => tk.id === t.fromId);
                        const site = sites.find((s: any) => s.id === tank?.siteId);

                        if (site && site.status === 'ACTIVE') {
                            dataRow[site.name] = (dataRow[site.name] || 0) + t.amount;

                            dataRow.details[site.name].push({
                                label: 'Transfer Çıkış',
                                liters: t.amount,
                                type: 'OUT'
                            });
                        }
                    }
                }
            });
        }

        return data;
    }, [fuelLogs, sites, vehicles, fuelTransfers, fuelTanks]);

    // Generate colors for sites safely
    const colors = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#db2777', '#0891b2', '#ea580c'];

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length > 0) {
            // Strictly take the first entry (nearest/hovered) to ensure only THAT site is shown
            const entry = payload[0];

            if (entry.value === 0) return null;

            const siteName = entry.name;
            const details = entry.payload.details?.[siteName] || [];

            return (
                <div className="bg-white p-3 border border-slate-200 shadow-lg rounded-lg text-xs max-w-[250px] max-h-[300px] overflow-y-auto z-50">
                    <p className="font-bold mb-2 text-slate-700 border-b pb-1">{label}</p>

                    <div className="mb-3 last:mb-0">
                        <div className="flex items-center justify-between font-semibold" style={{ color: entry.color }}>
                            <span>{siteName}</span>
                        </div>
                        {details.length > 0 && (
                            <div className="mt-1 pl-2 border-l-2 border-slate-100 space-y-1">
                                {details.map((d: any, i: number) => (
                                    <div key={i} className="flex justify-between items-center text-[10px]">
                                        <span className="text-slate-600 truncate max-w-[120px]" title={d.label}>{d.label}</span>
                                        <span className={`font-mono font-bold ${d.type === 'IN' ? 'text-green-600' : 'text-red-500'}`}>
                                            {d.type === 'IN' ? '+' : '-'}{d.liters.toLocaleString('tr-TR')} Lt
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <Card className="col-span-4 lg:col-span-7">
            <CardHeader>
                <CardTitle>Günlük Yakıt Hareketi (Son 14 Gün)</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                            data={chartData}
                            margin={{
                                top: 20,
                                right: 30,
                                left: 20,
                                bottom: 5,
                            }}
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => `${value} Lt`}
                            />
                            <Tooltip content={<CustomTooltip />} shared={false} cursor={{ strokeDasharray: '3 3' }} />
                            {/* Legend removed to prevent UI clutter with many sites */}
                            {sites.filter((s: any) => s.status === 'ACTIVE').map((site: any, index: any) => (
                                <Line
                                    key={site.id}
                                    type="monotone"
                                    dataKey={site.name}
                                    stroke={colors[index % colors.length]}
                                    strokeWidth={3}
                                    dot={{ r: 4, fill: colors[index % colors.length] }}
                                    activeDot={{ r: 6 }}
                                />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
