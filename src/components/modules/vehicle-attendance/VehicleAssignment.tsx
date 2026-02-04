'use client';

import { useState, useMemo } from 'react';
import { useAppStore } from '@/lib/store/use-store';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { toTurkishLower } from '@/lib/utils';
import { useAuth } from '@/lib/store/use-auth';
import { bulkAssignVehicles, bulkUnassignVehicles, addVehiclesToSite as addVehiclesToSiteAction } from '@/actions/vehicle';
import { toast } from 'sonner';
import { Loader2, Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

export function VehicleAssignment() {
    const { vehicles, sites, assignVehiclesToSite, addVehiclesToSite, removeVehiclesFromSite } = useAppStore();
    const { hasPermission } = useAuth();

    // Permission Check
    const canAssign = hasPermission('vehicle-attendance.assignment', 'CREATE') || hasPermission('vehicle-attendance.assignment', 'EDIT');

    const [selectedSiteId, setSelectedSiteId] = useState<string>('');
    const [loadingIds, setLoadingIds] = useState<Record<string, boolean>>({});

    // Search States
    const [assignedSearch, setAssignedSearch] = useState('');
    const [availableSearch, setAvailableSearch] = useState('');

    // Sorting & Filtering State
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'plate', direction: 'asc' });
    const [ownershipFilter, setOwnershipFilter] = useState<'ALL' | 'OWNED' | 'RENTAL'>('ALL');

    // Helper for Sorting
    const sortVehicles = (list: any[]) => {
        return [...list].sort((a: any, b: any) => {
            let valA = a[sortConfig.key];
            let valB = b[sortConfig.key];

            // Specific field handling
            if (sortConfig.key === 'ownership') {
                valA = a.ownership === 'RENTAL' ? 'Kiralık' : 'Kendi';
                valB = b.ownership === 'RENTAL' ? 'Kiralık' : 'Kendi';
            }

            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    };

    // 1. Vehicles in Selected Site
    const assignedVehicles = useMemo(() => {
        if (!selectedSiteId) return [];
        let list = vehicles.filter((v: any) => v.status !== 'PASSIVE' && v.assignedSiteIds?.includes(selectedSiteId));

        // Filter
        if (ownershipFilter !== 'ALL') {
            list = list.filter((v: any) => v.ownership === ownershipFilter);
        }

        // Search
        if (assignedSearch) {
            const search = toTurkishLower(assignedSearch);
            list = list.filter((v: any) => toTurkishLower(v.plate).includes(search) || toTurkishLower(v.model).includes(search));
        }

        return sortVehicles(list);
    }, [vehicles, selectedSiteId, assignedSearch, sortConfig, ownershipFilter]);

    // 2. Available Vehicles (Not in THIS site)
    const availableVehicles = useMemo(() => {
        if (!selectedSiteId) return [];
        let list = vehicles.filter((v: any) => {
            if (v.status === 'PASSIVE') return false;
            return !v.assignedSiteIds?.includes(selectedSiteId);
        });

        // Filter
        if (ownershipFilter !== 'ALL') {
            list = list.filter((v: any) => v.ownership === ownershipFilter);
        }

        // Search
        if (availableSearch) {
            const search = toTurkishLower(availableSearch);
            list = list.filter((v: any) => toTurkishLower(v.plate).includes(search) || toTurkishLower(v.model).includes(search));
        }

        return sortVehicles(list);
    }, [vehicles, availableSearch, selectedSiteId, sortConfig, ownershipFilter]);


    const handleAdd = async (vehicleId: string) => {
        if (!selectedSiteId) return;
        setLoadingIds(prev => ({ ...prev, [vehicleId]: true }));
        try {
            const res = await addVehiclesToSiteAction([vehicleId], selectedSiteId);
            if (res.success) {
                addVehiclesToSite([vehicleId], selectedSiteId); // Update local store (Additive)
                toast.success('Araç şantiyeye eklendi.');
            } else {
                toast.error(res.error || 'Ekleme başarısız.');
            }
        } catch (error) {
            console.error(error);
            toast.error('Hata oluştu.');
        } finally {
            setLoadingIds(prev => ({ ...prev, [vehicleId]: false }));
        }
    };

    const handleRemove = async (vehicleId: string) => {
        if (!selectedSiteId) return;
        if (!confirm('Aracı şantiyeden çıkarmak istediğinize emin misiniz?')) return;

        setLoadingIds(prev => ({ ...prev, [vehicleId]: true }));
        try {
            const res = await bulkUnassignVehicles([vehicleId], [selectedSiteId]);
            if (res.success) {
                removeVehiclesFromSite([vehicleId], selectedSiteId); // Local update
                toast.success('Araç şantiyeden çıkarıldı.');
            } else {
                toast.error(res.error || 'Çıkarma başarısız.');
            }
        } catch (error) {
            console.error(error);
            toast.error('Hata oluştu.');
        } finally {
            setLoadingIds(prev => ({ ...prev, [vehicleId]: false }));
        }
    };

    const handleSort = (key: string) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    return (
        <div className="space-y-6">
            <Card className="border-none shadow-none bg-transparent">
                <div className="bg-slate-900 text-white p-4 rounded-t-md flex items-center justify-between">
                    <div className="font-semibold px-2">Yönetim Paneli / Araç Atama</div>
                </div>

                {/* Site Selector Bar */}
                <div className="bg-white p-6 border rounded-b-md shadow-sm mb-6">
                    <div className="flex gap-4 items-end">
                        <div className="flex-1">
                            <Label className="text-lg font-semibold mb-2 block">Şantiye Seçin:</Label>
                            <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                                <SelectTrigger className="w-full h-12 text-lg">
                                    <SelectValue placeholder="Şantiye Seçiniz..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {sites.filter((s: any) => s.status === 'ACTIVE').map((s: any) => (
                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {selectedSiteId && (
                            <div className="w-[200px]">
                                <Label className="text-sm font-semibold mb-2 block">Mülkiyet Filtresi:</Label>
                                <Select value={ownershipFilter} onValueChange={(val: any) => setOwnershipFilter(val)}>
                                    <SelectTrigger className="h-12">
                                        <SelectValue placeholder="Tümü" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL">Tümü</SelectItem>
                                        <SelectItem value="OWNED">Kendi (Öz Mal)</SelectItem>
                                        <SelectItem value="RENTAL">Kiralık</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                </div>

                {selectedSiteId && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* LEFT: Assigned */}
                        <Card>
                            <CardHeader className="pb-3 border-b">
                                <CardTitle className="text-lg font-bold text-slate-800">Şantiyedeki Araçlar</CardTitle>
                                <CardDescription>{assignedVehicles.length} araç listeleniyor</CardDescription>
                                <Input
                                    placeholder="Araç ara (Plaka, Model)..."
                                    value={assignedSearch}
                                    onChange={(e) => setAssignedSearch(e.target.value)}
                                    className="mt-2"
                                />
                            </CardHeader>
                            <CardContent className="p-0">
                                <AssignTable
                                    vehicles={assignedVehicles}
                                    actionLabel="Çıkar"
                                    actionVariant="destructive"
                                    onAction={handleRemove}
                                    loadingIds={loadingIds}
                                    disabled={!canAssign}
                                    onSort={handleSort}
                                    sortConfig={sortConfig}
                                />
                            </CardContent>
                        </Card>

                        {/* RIGHT: Available */}
                        <Card>
                            <CardHeader className="pb-3 border-b">
                                <CardTitle className="text-lg font-bold text-slate-800">Boştaki ve Diğer Araçlar</CardTitle>
                                <CardDescription>{availableVehicles.length} araç listeleniyor</CardDescription>
                                <Input
                                    placeholder="Araç ara (Plaka, Model)..."
                                    value={availableSearch}
                                    onChange={(e) => setAvailableSearch(e.target.value)}
                                    className="mt-2"
                                />
                            </CardHeader>
                            <CardContent className="p-0">
                                <AssignTable
                                    vehicles={availableVehicles}
                                    sites={sites}
                                    actionLabel="Ekle"
                                    actionVariant="default"
                                    onAction={handleAdd}
                                    loadingIds={loadingIds}
                                    disabled={!canAssign}
                                    isAdd
                                    onSort={handleSort}
                                    sortConfig={sortConfig}
                                />
                            </CardContent>
                        </Card>
                    </div>
                )}
            </Card>
        </div>
    );
}

function AssignTable({
    vehicles,
    sites,
    actionLabel,
    actionVariant,
    onAction,
    loadingIds,
    disabled,
    isAdd,
    onSort,
    sortConfig
}: {
    vehicles: any[],
    sites?: any[],
    actionLabel: string,
    actionVariant: "default" | "destructive",
    onAction: (id: string) => void,
    loadingIds: Record<string, boolean>,
    disabled: boolean,
    isAdd?: boolean,
    onSort: (key: string) => void,
    sortConfig: { key: string, direction: 'asc' | 'desc' }
}) {
    if (vehicles.length === 0) {
        return <div className="p-8 text-center text-muted-foreground">Liste boş.</div>;
    }



    return (
        <div className="max-h-[600px] overflow-auto">
            <Table>
                <TableHeader className="bg-slate-50 sticky top-0 z-10">
                    <TableRow>
                        <TableHead className="cursor-pointer hover:bg-slate-100" onClick={() => onSort('plate')}>
                            Plaka {sortConfig.key === 'plate' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </TableHead>
                        <TableHead className="cursor-pointer hover:bg-slate-100" onClick={() => onSort('ownership')}>
                            Mülkiyet {sortConfig.key === 'ownership' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </TableHead>
                        <TableHead className="text-right">İşlem</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {vehicles.map(v => {


                        return (
                            <TableRow key={v.id}>
                                <TableCell className="font-medium">
                                    <div className="flex flex-col">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <span className="whitespace-nowrap">{v.plate}</span>
                                            {isAdd && v.assignedSiteIds && v.assignedSiteIds.length > 0 && sites && (
                                                <div className="flex flex-wrap gap-1">
                                                    {v.assignedSiteIds.map((sid: string) => {
                                                        const site = sites.find(s => s.id === sid);
                                                        if (!site) return null;

                                                        // Determine Short Name
                                                        // Priority: Explicit shortName > First 3 chars of name
                                                        const shortName = site.shortName || (site.name.length > 3 ? site.name.substring(0, 3).toUpperCase() : site.name);

                                                        return (
                                                            <Badge
                                                                key={sid}
                                                                variant="outline"
                                                                className="text-[10px] px-1.5 py-0 h-4 bg-orange-50 text-orange-700 border-orange-200 cursor-help"
                                                                title={site.name} // Native Tooltip
                                                            >
                                                                {shortName}
                                                            </Badge>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-xs text-muted-foreground">{v.brand} {v.model}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className={v.ownership === 'RENTAL' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-blue-50 text-blue-700 border-blue-200'}>
                                        {v.ownership === 'RENTAL' ? 'Kiralık' : 'Kendi'}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button
                                        size="sm"
                                        variant={actionVariant}
                                        onClick={() => onAction(v.id)}
                                        disabled={loadingIds[v.id] || disabled}
                                        className={isAdd ? "bg-green-600 hover:bg-green-700 w-20" : "w-16"}
                                    >
                                        {loadingIds[v.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : actionLabel}
                                    </Button>
                                </TableCell>
                            </TableRow>
                        )
                    })}
                </TableBody>
            </Table>
        </div>
    );
}
