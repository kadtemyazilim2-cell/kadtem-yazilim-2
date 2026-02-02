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
import { bulkAssignVehicles, bulkUnassignVehicles } from '@/actions/vehicle';
import { toast } from 'sonner';
import { Loader2, Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input'; // Added Input import

export function VehicleAssignment() {
    const { vehicles, sites, assignVehiclesToSite } = useAppStore();
    const { hasPermission } = useAuth();

    // Permission Check
    const canAssign = hasPermission('vehicle-attendance.assignment', 'CREATE') || hasPermission('vehicle-attendance.assignment', 'EDIT');

    const [selectedSiteId, setSelectedSiteId] = useState<string>('');
    const [loadingIds, setLoadingIds] = useState<Record<string, boolean>>({});

    // [New] Search States
    const [assignedSearch, setAssignedSearch] = useState('');
    const [availableSearch, setAvailableSearch] = useState('');

    // 1. Vehicles in Selected Site
    const assignedVehicles = useMemo(() => {
        if (!selectedSiteId) return [];
        return vehicles.filter((v: any) => v.status !== 'PASSIVE' && v.assignedSiteIds?.includes(selectedSiteId))
            .filter((v: any) => {
                if (!assignedSearch) return true;
                const search = toTurkishLower(assignedSearch);
                return toTurkishLower(v.plate).includes(search) || toTurkishLower(v.model).includes(search);
            });
    }, [vehicles, selectedSiteId, assignedSearch]);

    // 2. Available Vehicles (Idle - Not assigned to ANY site)
    const availableVehicles = useMemo(() => {
        return vehicles.filter((v: any) => {
            if (v.status === 'PASSIVE') return false;
            // Strict check: Must not be assigned to ANY site
            return !v.assignedSiteIds || v.assignedSiteIds.length === 0;
        }).filter((v: any) => {
            if (!availableSearch) return true;
            const search = toTurkishLower(availableSearch);
            return toTurkishLower(v.plate).includes(search) || toTurkishLower(v.model).includes(search);
        });
    }, [vehicles, availableSearch]);


    const handleAdd = async (vehicleId: string) => {
        if (!selectedSiteId) return;
        setLoadingIds(prev => ({ ...prev, [vehicleId]: true }));
        try {
            const res = await bulkAssignVehicles([vehicleId], [selectedSiteId]);
            if (res.success) {
                assignVehiclesToSite([vehicleId], [selectedSiteId]); // Update local store
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
                // Since store doesn't have explicit unassign helper, we reload entirely OR update local logic if we had one.
                // Assuming assignVehiclesToSite merges. We need a way to unmerge or just re-fetch.
                // For now, let's force a reload or implement remove in store.
                // Quick fix: Page reload is safe but slow. Better:
                window.location.reload();
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

    return (
        <div className="space-y-6">
            <Card className="border-none shadow-none bg-transparent">
                <div className="bg-slate-900 text-white p-4 rounded-t-md flex items-center justify-between">
                    <div className="font-semibold px-2">Yönetim Paneli / Araç Atama</div>
                </div>

                {/* Site Selector Bar */}
                <div className="bg-white p-6 border rounded-b-md shadow-sm mb-6">
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* LEFT: Assigned */}
                        <Card>
                            <CardHeader className="pb-3 border-b">
                                <CardTitle className="text-lg font-bold text-slate-800">Şantiyedeki Araçlar</CardTitle>
                                <CardDescription>{assignedVehicles.length} araç listeleniyor</CardDescription>
                                <Input
                                    placeholder="Araç ara..."
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
                                />
                            </CardContent>
                        </Card>

                        {/* RIGHT: Available */}
                        <Card>
                            <CardHeader className="pb-3 border-b">
                                <CardTitle className="text-lg font-bold text-slate-800">Boştaki Araçlar</CardTitle>
                                <CardDescription>{availableVehicles.length} araç listeleniyor</CardDescription>
                                <Input
                                    placeholder="Araç ara..."
                                    value={availableSearch}
                                    onChange={(e) => setAvailableSearch(e.target.value)}
                                    className="mt-2"
                                />
                            </CardHeader>
                            <CardContent className="p-0">
                                <AssignTable
                                    vehicles={availableVehicles}
                                    actionLabel="Ekle"
                                    actionVariant="default"
                                    onAction={handleAdd}
                                    loadingIds={loadingIds}
                                    disabled={!canAssign}
                                    isAdd
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
    actionLabel,
    actionVariant,
    onAction,
    loadingIds,
    disabled,
    isAdd
}: {
    vehicles: any[],
    actionLabel: string,
    actionVariant: "default" | "destructive",
    onAction: (id: string) => void,
    loadingIds: Record<string, boolean>,
    disabled: boolean,
    isAdd?: boolean
}) {
    if (vehicles.length === 0) {
        return <div className="p-8 text-center text-muted-foreground">Liste boş.</div>;
    }

    return (
        <div className="max-h-[600px] overflow-y-auto">
            <Table>
                <TableHeader className="bg-slate-50 sticky top-0">
                    <TableRow>
                        <TableHead>Plaka</TableHead>
                        <TableHead>Tür</TableHead>
                        <TableHead className="text-right">İşlem</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {vehicles.map(v => (
                        <TableRow key={v.id}>
                            <TableCell className="font-medium">
                                <div className="flex flex-col">
                                    <span>{v.plate}</span>
                                    <span className="text-xs text-muted-foreground">{v.brand} {v.model}</span>
                                </div>
                            </TableCell>
                            <TableCell>
                                {v.ownership === 'OWNED' ? 'Kendi' : 'Kiralık'}
                            </TableCell>
                            <TableCell className="text-right">
                                <Button
                                    size="sm"
                                    variant={actionVariant}
                                    onClick={() => onAction(v.id)}
                                    disabled={loadingIds[v.id] || disabled}
                                    className={isAdd ? "bg-green-600 hover:bg-green-700 w-20" : "w-20"}
                                >
                                    {loadingIds[v.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : actionLabel}
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
