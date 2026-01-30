'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FuelLog, Site, FuelTransfer, FuelTank } from '@/lib/types';
import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, subDays } from 'date-fns';
import { tr } from 'date-fns/locale';

export function DailyFuelChart({ fuelLogs, fuelTransfers, fuelTanks, sites, vehicles }: {
    fuelLogs: FuelLog[];
    fuelTransfers?: FuelTransfer[];
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

        const activeTanks = (fuelTanks || []).filter((t: any) => t.status !== 'PASSIVE');

        // Initialize data structure
        const data = days.map((day: any) => {
            const row: any = {
                name: day.label,
                fullDate: day.key,
                total: 0,
                details: {} as Record<string, { label: string; liters: number; type: 'IN' | 'OUT' }[]>
            };
            activeTanks.forEach((tank: any) => {
                row[tank.id] = 0;
                row.details[tank.id] = [];
            });
            return row;
        });

        // 1. Process Logs (OUT from Tank)
        fuelLogs.forEach((log: any) => {
            if (!log.tankId) return; // Skip if no tank (Direct Purchase)

            const logDate = format(new Date(log.date), 'yyyy-MM-dd');
            const dataRow = data.find((d: any) => d.fullDate === logDate);

            if (dataRow) {
                const tank = activeTanks.find((t: any) => t.id === log.tankId);
                const vehicle = vehicles.find((v: any) => v.id === log.vehicleId);

                if (tank) {
                    dataRow[tank.id] = (dataRow[tank.id] || 0) + log.liters;
                    dataRow.total += log.liters;

                    dataRow.details[tank.id].push({
                        label: vehicle ? vehicle.plate : 'Araç',
                        liters: log.liters,
                        type: 'OUT'
                    });
                }
            }
        });

        // 2. Process Transfers (IN & OUT)
        if (fuelTransfers) {
            fuelTransfers.forEach((t: any) => {
                const tDate = format(new Date(t.date), 'yyyy-MM-dd');
                const dataRow = data.find((d: any) => d.fullDate === tDate);

                if (dataRow) {
                    // A. INCOMING (Target is Tank)
                    if (t.toType === 'TANK') {
                        const tank = activeTanks.find((tk: any) => tk.id === t.toId);

                        if (tank) {
                            dataRow[tank.id] = (dataRow[tank.id] || 0) + t.amount;
                            dataRow.total += t.amount;

                            const provider = t.fromType === 'EXTERNAL' ? (t.fromId || 'Satın Alma') : 'Transfer Giriş';
                            dataRow.details[tank.id].push({
                                label: provider,
                                liters: t.amount,
                                type: 'IN'
                            });
                        }
                    }

                    // B. OUTGOING (Source is Tank)
                    if (t.fromType === 'TANK') {
                        const tank = activeTanks.find((tk: any) => tk.id === t.fromId);

                        if (tank) {
                            dataRow[tank.id] = (dataRow[tank.id] || 0) + t.amount;
                            dataRow.total += t.amount;

                            dataRow.details[tank.id].push({
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
    }, [fuelLogs, vehicles, fuelTransfers, fuelTanks]);

    // Generate colors
    const colors = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#db2777', '#0891b2', '#ea580c'];

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length > 0) {
            const sortedPayload = [...payload].sort((a: any, b: any) => b.value - a.value);
            const total = sortedPayload.reduce((sum: number, entry: any) => sum + entry.value, 0);

            return (
                <div className="bg-white p-3 border border-slate-200 shadow-lg rounded-lg text-xs max-w-[280px] z-50">
                    <div className="flex justify-between items-center border-b pb-1 mb-2">
                        <span className="font-bold text-slate-700">{label}</span>
                        <span className="font-mono font-bold text-slate-900">{total.toLocaleString('tr-TR')} Lt</span>
                    </div>

                    <div className="space-y-3 max-h-[300px] overflow-y-auto">
                        {sortedPayload.map((entry: any) => {
                            if (entry.value === 0) return null;
                            const tankId = entry.dataKey;
                            const tankName = entry.name;
                            const details = entry.payload.details?.[tankId] || [];

                            return (
                                <div key={tankId} className="flex flex-col gap-1">
                                    <div className="flex items-center justify-between font-semibold" style={{ color: entry.color }}>
                                        <span>{tankName}</span>
                                        <span>{entry.value.toLocaleString('tr-TR')} Lt</span>
                                    </div>

                                    <div className="pl-2 border-l-2 border-slate-100 space-y-0.5">
                                        {details.slice(0, 5).map((d: any, i: number) => (
                                            <div key={i} className="flex justify-between items-center text-[10px] text-slate-500">
                                                <span className="truncate max-w-[140px]" title={d.label}>{d.label}</span>
                                                <span className={d.type === 'IN' ? 'text-green-600' : ''}>
                                                    {d.type === 'IN' ? '+' : ''}{d.liters.toLocaleString('tr-TR')}
                                                </span>
                                            </div>
                                        ))}
                                        {details.length > 5 && (
                                            <div className="text-[9px] text-slate-400 italic">...ve {details.length - 5} işlem daha</div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        }
        return null;
    };

    const activeTanks = (fuelTanks || []).filter((t: any) => t.status !== 'PASSIVE');

    return (
        <Card className="col-span-4 lg:col-span-7">
            <CardHeader>
                <CardTitle>Günlük Yakıt Hareketi (Son 14 Gün)</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
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
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9' }} />
                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                            {activeTanks.map((tank: any, index: any) => (
                                <Bar
                                    key={tank.id}
                                    dataKey={tank.id}
                                    name={tank.name}
                                    stackId="a"
                                    fill={colors[index % colors.length]}
                                    radius={[0, 0, 0, 0]}
                                    maxBarSize={50}
                                />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
