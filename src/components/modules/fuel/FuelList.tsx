'use client';

import { useAppStore } from '@/lib/store/use-store';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FuelForm } from './FuelForm';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useAuth } from '@/lib/store/use-auth';
import { useUserSites } from '@/hooks/use-user-access';
import { useState, useMemo } from 'react';
import { MultiSelect } from '@/components/ui/multi-select';

export function FuelList() {
    const { fuelLogs, vehicles, users } = useAppStore();
    const availableSites = useUserSites(); // [NEW] Restricted sites
    const { user } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({
        site: [] as string[],
        vehicle: [] as string[]
    });

    const uniqueSites = useMemo(() => {
        // Only show sites that are available to user AND present in logs (or just available sites?)
        // Typically we want filter options to be relevant.
        // Let's intersect availableSites with log sites.
        const logSiteIds = new Set(fuelLogs.map((l: any) => l.siteId));
        return availableSites
            .filter((s: any) => logSiteIds.has(s.id))
            .map((s: any) => ({ label: s.name, value: s.id }))
            .sort((a: any, b: any) => a.label.localeCompare(b.label));
    }, [fuelLogs, availableSites]);

    const uniqueVehicles = useMemo(() => {
        const relevantVehicleIds = Array.from(new Set(fuelLogs.map((l: any) => l.vehicleId)));
        return relevantVehicleIds.map((id: any) => {
            const v = vehicles.find((veh: any) => veh.id === id);
            return { label: v?.plate || 'Bilinmeyen', value: id };
        }).sort((a: any, b: any) => a.label.localeCompare(b.label));
    }, [fuelLogs, vehicles]);

    const getVehiclePlate = (id: string) => vehicles.find(v => v.id === id)?.plate || '-';
    // const getSiteName = (id: string) => sites.find(s => s.id === id)?.name || '-'; // Replaced sites usage
    const getSiteName = (id: string) => availableSites.find(s => s.id === id)?.name || '-';

    const filteredLogs = fuelLogs
        .filter((log: any) => {
            // [NEW] Isolation Logic: Check if site is in availableSites
            const hasAccess = availableSites.some((s: any) => s.id === log.siteId);
            if (!hasAccess) return false;

            // [NEW] Filters
            if (filters.site.length > 0 && !filters.site.includes(log.siteId)) return false;
            if (filters.vehicle.length > 0 && !filters.vehicle.includes(log.vehicleId)) return false;

            if (!searchTerm) return true;
            const search = searchTerm.toLowerCase();
            const plate = getVehiclePlate(log.vehicleId).toLowerCase();
            const site = getSiteName(log.siteId).toLowerCase();

            return plate.includes(search) || site.includes(search);
        });

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Yakıt Tüketim Kayıtları</CardTitle>
                <FuelForm />
            </CardHeader>
            <CardContent>
                <div className="mb-4">
                    <input
                        type="text"
                        placeholder="Ara..."
                        className="p-2 border rounded w-full max-w-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Tarih</TableHead>
                            <TableHead>Plaka</TableHead>
                            <TableHead>Şantiye</TableHead>
                            <TableHead>Litre</TableHead>
                            <TableHead>Tutar</TableHead>
                            <TableHead>KM</TableHead>
                            <TableHead>Yakıt Veren</TableHead>
                        </TableRow>
                        <TableRow>
                            <TableHead className="p-1">-</TableHead>
                            <TableHead className="p-1">
                                <MultiSelect
                                    options={uniqueVehicles}
                                    selected={filters.vehicle}
                                    onChange={(val) => setFilters({ ...filters, vehicle: val })}
                                    placeholder="Tümü"
                                    searchPlaceholder="Plaka Ara..."
                                />
                            </TableHead>
                            <TableHead className="p-1">
                                <MultiSelect
                                    options={uniqueSites}
                                    selected={filters.site}
                                    onChange={(val) => setFilters({ ...filters, site: val })}
                                    placeholder="Tümü"
                                    searchPlaceholder="Şantiye Ara..."
                                />
                            </TableHead>
                            <TableHead className="p-1">-</TableHead>
                            <TableHead className="p-1">-</TableHead>
                            <TableHead className="p-1">-</TableHead>
                            <TableHead className="p-1">-</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredLogs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center text-slate-500 py-8">
                                    Kayıt bulunamadı.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredLogs.map((log: any) => (
                                <TableRow key={log.id}>
                                    <TableCell>{format(new Date(log.date), 'dd MMM yyyy', { locale: tr })}</TableCell>
                                    <TableCell className="font-bold">{getVehiclePlate(log.vehicleId)}</TableCell>
                                    <TableCell>{getSiteName(log.siteId)}</TableCell>
                                    <TableCell>{log.liters.toFixed(2)} Lt</TableCell>
                                    <TableCell>{log.cost.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</TableCell>
                                    <TableCell>{log.mileage.toLocaleString()} km</TableCell>
                                    <TableCell className="text-xs text-muted-foreground">{users.find((u: any) => u.id === log.filledByUserId)?.name || '-'}</TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card >
    );
}
