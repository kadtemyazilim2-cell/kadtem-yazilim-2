'use client';

import { useAppStore } from '@/lib/store/use-store';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FuelForm } from './FuelForm';
import { format, startOfMonth, parseISO, isValid } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useAuth } from '@/lib/store/use-auth';
import { useUserSites } from '@/hooks/use-user-access';
import { useState, useMemo } from 'react';
import { MultiSelect } from '@/components/ui/multi-select';
import { Edit, Trash2 } from 'lucide-react'; // [NEW]
import { Button } from '@/components/ui/button'; // [NEW]
import { deleteFuelLog } from '@/actions/fuel'; // [NEW]

export function FuelList() {
    const { fuelLogs, vehicles, users, deleteFuelLog: deleteLocal, fuelTanks } = useAppStore(); // [FIX] Added deleteLocal, fuelTanks
    const availableSites = useUserSites();
    const { user, hasPermission } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');

    // Date Filters - Default to current month
    const currentDate = new Date();
    const [startDate, setStartDate] = useState<string>(format(startOfMonth(currentDate), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState<string>(format(currentDate, 'yyyy-MM-dd'));

    // [NEW] Permissions
    const canCreate = hasPermission('fuel', 'CREATE');
    const canEdit = hasPermission('fuel', 'EDIT');
    const canDelete = hasPermission('fuel', 'DELETE');
    const [filters, setFilters] = useState({
        site: [] as string[],
        vehicle: [] as string[]
    });

    // [NEW] Edit State
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingLog, setEditingLog] = useState<any>(null);

    // [NEW] Delete Handler
    const handleDelete = async (id: string) => {
        if (!confirm('Bu yakıt kaydını silmek istediğinize emin misiniz?')) return;

        try {
            const res = await deleteFuelLog(id);
            if (res.success) {
                if (deleteLocal) deleteLocal(id); // Update store if method exists
            } else {
                alert(res.error || 'Silinemedi.');
            }
        } catch (e) {
            console.error(e);
            alert('Hata oluştu.');
        }
    };

    const uniqueSites = useMemo(() => {
        // Only show sites that are available to user AND present in logs (or just available sites?)
        // Typically we want filter options to be relevant.
        // Let's intersect availableSites with log sites.
        const logSiteIds = new Set(fuelLogs.map((l: any) => l.siteId));
        return availableSites
            .filter((s: any) => {
                // [NEW] Show site if it has logs OR has a tank
                const hasLogs = logSiteIds.has(s.id);
                const hasTank = fuelTanks.some((t: any) => t.siteId === s.id);
                return hasLogs || hasTank;
            })
            .map((s: any) => ({ label: s.name, value: s.id }))
            .sort((a: any, b: any) => a.label.localeCompare(b.label));
    }, [fuelLogs, availableSites, fuelTanks]);

    const uniqueVehicles = useMemo(() => {
        const relevantVehicleIds = Array.from(new Set(fuelLogs.map((l: any) => l.vehicleId)));
        return relevantVehicleIds.map((id: any) => {
            const v = vehicles.find((veh: any) => veh.id === id);
            return { label: v?.plate || 'Bilinmeyen', value: id };
        }).sort((a: any, b: any) => a.label.localeCompare(b.label));
    }, [fuelLogs, vehicles]);

    const getVehiclePlate = (id: string) => vehicles.find((v: any) => v.id === id)?.plate || '-';
    // const getSiteName = (id: string) => sites.find(s => s.id === id)?.name || '-'; // Replaced sites usage
    const getSiteName = (id: string) => availableSites.find((s: any) => s.id === id)?.name || '-';

    const filteredLogs = fuelLogs
        .filter((log: any) => {
            // [NEW] Isolation Logic: Check if site is in availableSites
            const hasAccess = availableSites.some((s: any) => s.id === log.siteId);
            if (!hasAccess) return false;

            // Date filter
            if (startDate && endDate) {
                const start = parseISO(startDate);
                const end = new Date(parseISO(endDate));
                end.setHours(23, 59, 59, 999);
                if (isValid(start) && isValid(end)) {
                    const logDate = new Date(log.date);
                    if (!isValid(logDate) || logDate < start || logDate > end) return false;
                }
            }

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
                {canCreate && (
                    <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => { setEditingLog(null); setIsFormOpen(true); }}>
                        + Yakıt Girişi
                    </Button>
                )}
            </CardHeader>
            <CardContent>
                <div className="mb-4 flex flex-wrap gap-3 items-center">
                    <input
                        type="text"
                        placeholder="Ara..."
                        className="p-2 border rounded w-full max-w-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <div className="flex gap-2 items-center">
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="p-2 border rounded text-sm"
                        />
                        <span className="text-muted-foreground font-bold">-</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="p-2 border rounded text-sm"
                        />
                    </div>
                </div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[100px]">Tarih</TableHead>
                            <TableHead className="w-[120px]">Plaka</TableHead>
                            <TableHead className="w-[150px]">Şantiye</TableHead>
                            <TableHead className="text-right">Litre</TableHead>
                            <TableHead className="text-left w-[30px]"></TableHead>
                            <TableHead>Tutar</TableHead>
                            <TableHead className="text-right">Km/Saat</TableHead>
                            <TableHead className="text-left w-[50px]"></TableHead>
                            <TableHead>Yakıt Veren</TableHead>
                            <TableHead className="w-[100px]">İşlemler</TableHead>
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
                            <TableHead className="p-1"></TableHead>
                            <TableHead className="p-1">-</TableHead>
                            <TableHead className="p-1">-</TableHead>
                            <TableHead className="p-1"></TableHead>
                            <TableHead className="p-1">-</TableHead>
                            <TableHead className="p-1">-</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredLogs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={10} className="text-center text-slate-500 py-8">
                                    Kayıt bulunamadı.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredLogs.map((log: any) => (
                                <TableRow key={log.id}>
                                    <TableCell className="whitespace-nowrap">{format(new Date(log.date), 'dd MMM yyyy', { locale: tr })}</TableCell>
                                    <TableCell className="font-bold whitespace-nowrap">{getVehiclePlate(log.vehicleId)}</TableCell>
                                    <TableCell className="text-sm">{getSiteName(log.siteId)}</TableCell>
                                    <TableCell className="text-right tabular-nums font-medium">{log.liters.toFixed(2)}</TableCell>
                                    <TableCell className="text-left text-muted-foreground">Lt</TableCell>
                                    <TableCell>{log.cost.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</TableCell>
                                    <TableCell className="text-right tabular-nums">{log.mileage.toLocaleString('tr-TR')}</TableCell>
                                    <TableCell className="text-left text-muted-foreground">Km/Saat</TableCell>
                                    <TableCell className="text-xs text-muted-foreground">{users.find((u: any) => u.id === log.filledByUserId)?.name || '-'}</TableCell>
                                    <TableCell className="p-1">
                                        <div className="flex items-center gap-1">
                                            {canEdit && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                                                    onClick={() => {
                                                        setEditingLog(log);
                                                        setIsFormOpen(true);
                                                    }}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                            )}
                                            {canDelete && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => handleDelete(log.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>

            {/* [NEW] Global FuelForm for Edit/Create */}
            <FuelForm
                open={isFormOpen}
                onOpenChange={(open) => {
                    setIsFormOpen(open);
                    if (!open) setEditingLog(null);
                }}
                initialData={editingLog}
            />
        </Card >
    );
}
