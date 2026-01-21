'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FuelTank, Site } from '@/lib/types';
import { Fuel } from 'lucide-react';

interface SiteStockOverviewProps {
    tanks: FuelTank[];
    sites: Site[];
}

export function SiteStockOverview({ tanks, sites }: SiteStockOverviewProps) {
    // Group tanks by site
    const tanksBySite = tanks.reduce((acc, tank) => {
        if (!acc[tank.siteId]) {
            acc[tank.siteId] = [];
        }
        acc[tank.siteId].push(tank);
        return acc;
    }, {} as Record<string, FuelTank[]>);

    return (
        <Card className="col-span-full border-slate-200">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-slate-700">
                    <Fuel className="h-5 w-5" />
                    Şantiye Yakıt Stokları
                </CardTitle>
            </CardHeader>
            <CardContent>
                {Object.keys(tanksBySite).length === 0 ? (
                    <div className="text-center py-4 text-slate-500 text-sm">
                        Tanımlı yakıt tankı bulunmuyor.
                    </div>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {Object.entries(tanksBySite).map(([siteId, siteTanks]) => {
                            const site = sites.find(s => s.id === siteId);
                            if (!site || site.status !== 'ACTIVE') return null;

                            return (
                                <div key={siteId} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                                    <div className="font-medium text-slate-700 mb-2 border-b border-slate-200 pb-1">
                                        {site.name}
                                    </div>
                                    <div className="space-y-3">
                                        {siteTanks.map(tank => {
                                            const percentage = (tank.currentLevel / tank.capacity) * 100;
                                            let colorClass = 'bg-emerald-500';
                                            if (percentage <= 20) colorClass = 'bg-red-500';
                                            else if (percentage <= 50) colorClass = 'bg-amber-500';

                                            return (
                                                <div key={tank.id} className="space-y-1">
                                                    <div className="flex justify-between text-xs">
                                                        <span className="text-slate-600 font-medium">{tank.name}</span>
                                                        <span className="text-slate-500 font-mono">
                                                            {tank.currentLevel.toLocaleString()} / {tank.capacity.toLocaleString()} Lt
                                                        </span>
                                                    </div>
                                                    <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full ${colorClass} transition-all duration-500`}
                                                            style={{ width: `${Math.min(percentage, 100)}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
