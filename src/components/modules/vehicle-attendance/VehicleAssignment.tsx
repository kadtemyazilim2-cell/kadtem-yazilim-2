'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store/use-store';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MultiSelect } from '@/components/ui/multi-select';
import { Label } from '@/components/ui/label';
import { toTurkishLower } from '@/lib/utils';
import { useAuth } from '@/lib/store/use-auth';
import { updateVehicle, bulkAssignVehicles, bulkUnassignVehicles } from '@/actions/vehicle';
import { toast } from 'sonner';

export function VehicleAssignment() {
    const { vehicles, sites, assignVehiclesToSite } = useAppStore();
    const { hasPermission } = useAuth();

    // Permission Check
    // Assignment is considered a CREATE or EDIT action for vehicle-attendance.assignment submodule
    const canAssign = hasPermission('vehicle-attendance.assignment', 'CREATE') || hasPermission('vehicle-attendance.assignment', 'EDIT');

    const [ownershipFilter, setOwnershipFilter] = useState<'ALL' | 'OWNED' | 'RENTAL'>('ALL');
    const [selectedVehicles, setSelectedVehicles] = useState<string[]>([]);
    const [targetSiteIds, setTargetSiteIds] = useState<string[]>([]); // [MODIFIED]
    const [searchTerm, setSearchTerm] = useState('');

    const filteredVehicles = vehicles.filter((v: any) => {
        // [FIX] Exclude passive vehicles from assignment
        if (v.status === 'PASSIVE') return false;

        const matchesOwnership = ownershipFilter === 'ALL' || v.ownership === ownershipFilter;
        // Use helper with safe string access (in case plate/model are somehow undefined, though they shouldn't be)
        const plate = v.plate || '';
        const model = v.model || '';
        const lowerSearch = toTurkishLower(searchTerm);

        const matchesSearch = toTurkishLower(plate).includes(lowerSearch) ||
            toTurkishLower(model).includes(lowerSearch);
        return matchesOwnership && matchesSearch;
    });

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedVehicles(filteredVehicles.map((v: any) => v.id));
        } else {
            setSelectedVehicles([]);
        }
    };

    const handleSelectVehicle = (id: string, checked: boolean) => {
        if (checked) {
            setSelectedVehicles([...selectedVehicles, id]);
        } else {
            setSelectedVehicles(selectedVehicles.filter((vId: any) => vId !== id));
        }
    };

    const [isAssigning, setIsAssigning] = useState(false);

    const handleAssign = async () => {
        if (targetSiteIds.length === 0) {
            toast.error('Lütfen en az bir şantiye seçiniz.');
            return;
        }
        if (selectedVehicles.length === 0) {
            toast.error('Lütfen en az bir araç seçiniz.');
            return;
        }

        setIsAssigning(true);
        try {
            // [FIX] Use Bulk Server Action
            const res = await bulkAssignVehicles(selectedVehicles, targetSiteIds);

            if (res.success) {
                // Update Local Store
                assignVehiclesToSite(selectedVehicles, targetSiteIds);

                toast.success(`${selectedVehicles.length} araç başarıyla ${targetSiteIds.length} şantiyeye atandı.`);
                setSelectedVehicles([]);
                setTargetSiteIds([]);
            } else {
                toast.error(res.error || 'Atama işlemi başarısız.');
            }
        } catch (error) {
            console.error(error);
            toast.error('Atama işlemi sırasında bir hata oluştu.');
        } finally {
            setIsAssigning(false);
        }
    };

    const handleUnassign = async () => {
        if (targetSiteIds.length === 0) {
            toast.error('Lütfen çıkarmak istediğiniz şantiyeyi seçiniz.');
            return;
        }
        if (selectedVehicles.length === 0) {
            toast.error('Lütfen en az bir araç seçiniz.');
            return;
        }

        if (!confirm('Seçili araçları seçili şantiyelerden çıkarmak istediğinize emin misiniz?')) {
            return;
        }

        setIsAssigning(true);
        try {
            const res = await bulkUnassignVehicles(selectedVehicles, targetSiteIds);

            if (res.success) {
                toast.success(`${selectedVehicles.length} araç ${targetSiteIds.length} şantiyeden çıkarıldı.`);
                setSelectedVehicles([]);
                setTargetSiteIds([]);
                window.location.reload();
            } else {
                toast.error(res.error || 'İşlem başarısız.');
            }
        } catch (error) {
            console.error(error);
            toast.error('İşlem sırasında bir hata oluştu.');
        } finally {
            setIsAssigning(false);
        }
    };

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Araç Şantiye Atama</CardTitle>
                    <CardDescription>
                        Araçları mülkiyet durumuna göre filtreleyip şantiyelere atayabilirsiniz.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Filters */}
                    <div className="flex flex-col md:flex-row gap-4 justify-between items-end">
                        <div className="flex gap-4 items-end w-full md:w-auto">
                            <div className="space-y-2 w-48">
                                <Label>Mülkiyet Durumu</Label>
                                <Select
                                    value={ownershipFilter}
                                    onValueChange={(val: any) => setOwnershipFilter(val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Tümü" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL">Tümü</SelectItem>
                                        <SelectItem value="OWNED">Özmal (Şirket Aracı)</SelectItem>
                                        <SelectItem value="RENTAL">Kiralık</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2 w-64">
                                <Label>Araç Ara</Label>
                                <Input
                                    placeholder="Plaka veya Model..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex gap-2 items-end w-full md:w-auto">
                            <div className="space-y-2 w-64">
                                <Label>Atanacak Şantiyeler</Label>
                                <MultiSelect
                                    options={sites.filter((s: any) => s.status === 'ACTIVE' && s.isWarehouse).map((s: any) => ({ label: s.name, value: s.id }))}
                                    selected={targetSiteIds}
                                    onChange={setTargetSiteIds}
                                    placeholder="Şantiye Seçiniz"
                                />
                            </div>
                            <Button
                                onClick={handleAssign}
                                disabled={isAssigning || !canAssign || targetSiteIds.length === 0 || selectedVehicles.length === 0}
                            >
                                {isAssigning ? 'İşleniyor...' : `Atama Yap (${selectedVehicles.length})`}
                            </Button>

                            <Button
                                variant="destructive"
                                onClick={handleUnassign}
                                disabled={isAssigning || !canAssign || targetSiteIds.length === 0 || selectedVehicles.length === 0}
                            >
                                {isAssigning ? 'İşleniyor...' : `Atamayı Kaldır (${selectedVehicles.length})`}
                            </Button>

                            <Button
                                variant="destructive"
                                onClick={handleUnassign}
                                disabled={isAssigning || !canAssign || targetSiteIds.length === 0 || selectedVehicles.length === 0}
                            >
                                {isAssigning ? 'İşleniyor...' : `Atamayı Kaldır (${selectedVehicles.length})`}
                            </Button>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12">
                                        <Checkbox
                                            checked={selectedVehicles.length === filteredVehicles.length && filteredVehicles.length > 0}
                                            onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                                        />
                                    </TableHead>
                                    <TableHead>Plaka</TableHead>
                                    <TableHead>Marka/Model</TableHead>
                                    <TableHead>Mülkiyet</TableHead>
                                    <TableHead>Mevcut Şantiye(ler)</TableHead>
                                    <TableHead>Durum</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredVehicles.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center text-muted-foreground h-24">
                                            Kriterlere uygun araç bulunamadı.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredVehicles.map((v: any) => {
                                        // Display assigned sites
                                        let displaySites = '-';
                                        if (v.assignedSiteIds && v.assignedSiteIds.length > 0) {
                                            displaySites = v.assignedSiteIds
                                                .map((sid: any) => sites.find((s: any) => s.id === sid)?.name)
                                                .filter(Boolean)
                                                .join(', ');
                                        } else if (v.assignedSiteId) {
                                            displaySites = sites.find((s: any) => s.id === v.assignedSiteId)?.name || '-';
                                        }

                                        return (
                                            <TableRow key={v.id}>
                                                <TableCell>
                                                    <Checkbox
                                                        checked={selectedVehicles.includes(v.id)}
                                                        onCheckedChange={(checked) => handleSelectVehicle(v.id, checked as boolean)}
                                                    />
                                                </TableCell>
                                                <TableCell className="font-medium">{v.plate}</TableCell>
                                                <TableCell>{v.brand} {v.model}</TableCell>
                                                <TableCell>
                                                    {v.ownership === 'OWNED' ? (
                                                        <Badge variant="secondary">Özmal</Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="border-orange-500 text-orange-600">Kiralık</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="max-w-[200px] truncate" title={displaySites}>
                                                    {displaySites}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={v.status === 'ACTIVE' ? 'default' : 'destructive'}>
                                                        {v.status === 'ACTIVE' ? 'Aktif' : v.status}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
