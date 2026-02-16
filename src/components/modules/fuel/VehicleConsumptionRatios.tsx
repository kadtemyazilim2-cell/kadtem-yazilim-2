'use client';

import { useState, useCallback } from 'react';
import { useAppStore } from '@/lib/store/use-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { updateVehicle } from '@/actions/vehicle';
import { Loader2, Fuel, Search } from 'lucide-react';

const VEHICLE_TYPE_LABELS: Record<string, string> = {
    TRUCK: 'Kamyon',
    LORRY: 'Tır',
    CAR: 'Binek',
    EXCAVATOR: 'Ekskavatör',
    TRACTOR: 'Traktör',
    MOTORCYCLE: 'Motosiklet',
    PICKUP: 'Pikap',
    OTHER: 'Diğer'
};

export function VehicleConsumptionRatios() {
    const vehicles = useAppStore((s) => s.vehicles);
    const updateVehicleStore = useAppStore((s) => s.updateVehicle);
    const [editingCell, setEditingCell] = useState<{ vehicleId: string; field: 'min' | 'max' } | null>(null);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [filterText, setFilterText] = useState('');

    // Only show ACTIVE vehicles
    const activeVehicles = vehicles
        .filter(v => v.status === 'ACTIVE')
        .filter(v => {
            if (!filterText) return true;
            const lower = filterText.toLocaleLowerCase('tr');
            return (
                v.plate.toLocaleLowerCase('tr').includes(lower) ||
                v.brand.toLocaleLowerCase('tr').includes(lower) ||
                v.model.toLocaleLowerCase('tr').includes(lower) ||
                (VEHICLE_TYPE_LABELS[v.type] || '').toLocaleLowerCase('tr').includes(lower)
            );
        });

    const handleSave = useCallback(async (vehicleId: string, field: 'min' | 'max', rawValue: string) => {
        setEditingCell(null);

        // Parse Turkish comma format
        const parsed = parseFloat(rawValue.replace(',', '.'));
        const value = isNaN(parsed) ? null : parsed;

        // Find current vehicle
        const vehicle = vehicles.find(v => v.id === vehicleId);
        if (!vehicle) return;

        const currentValue = field === 'min' ? vehicle.consumptionMin : vehicle.consumptionMax;

        // Skip if unchanged
        if (value === currentValue || (value === null && currentValue === undefined)) return;

        setSavingId(vehicleId);

        try {
            const updateData = field === 'min'
                ? { consumptionMin: value }
                : { consumptionMax: value };

            const result = await updateVehicle(vehicleId, updateData as any);
            if (result?.success) {
                // Update store
                updateVehicleStore(vehicleId, updateData as any);
                toast.success(`${vehicle.plate} - ${field === 'min' ? 'Alt' : 'Üst'} oran güncellendi.`);
            } else {
                toast.error('Güncelleme başarısız oldu.');
            }
        } catch (error) {
            console.error('Consumption ratio update error:', error);
            toast.error('Güncelleme sırasında hata oluştu.');
        } finally {
            setSavingId(null);
        }
    }, [vehicles, updateVehicleStore]);

    const formatValue = (val: number | null | undefined): string => {
        if (val == null) return '';
        return val.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Fuel className="w-5 h-5 text-orange-500" />
                            Araç Tüketim Oranları
                        </CardTitle>
                        <CardDescription>
                            Her araç için alt ve üst tüketim oranlarını giriniz. (Birim: Lt/100km veya Lt/saat)
                        </CardDescription>
                    </div>
                    <div className="relative w-full md:w-64">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Plaka, marka, tür ara..."
                            value={filterText}
                            onChange={(e) => setFilterText(e.target.value)}
                            className="pl-9 h-9"
                        />
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-10">No</TableHead>
                            <TableHead>Plaka</TableHead>
                            <TableHead>Marka / Model</TableHead>
                            <TableHead>Tür</TableHead>
                            <TableHead className="text-center">Birim</TableHead>
                            <TableHead className="text-right w-[140px]">Alt Oran</TableHead>
                            <TableHead className="text-right w-[140px]">Üst Oran</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {activeVehicles.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                                    {filterText ? 'Filtreye uygun araç bulunamadı.' : 'Aktif araç bulunamadı.'}
                                </TableCell>
                            </TableRow>
                        ) : (
                            activeVehicles.map((vehicle, idx) => (
                                <TableRow key={vehicle.id} className={savingId === vehicle.id ? 'opacity-60' : ''}>
                                    <TableCell className="font-mono text-xs text-muted-foreground">{idx + 1}</TableCell>
                                    <TableCell className="font-medium font-mono">{vehicle.plate}</TableCell>
                                    <TableCell className="text-sm">{vehicle.brand} {vehicle.model}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="text-xs">
                                            {VEHICLE_TYPE_LABELS[vehicle.type] || vehicle.type}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="secondary" className="text-[10px]">
                                            {vehicle.meterType === 'HOURS' ? 'Lt/saat' : 'Lt/100km'}
                                        </Badge>
                                    </TableCell>

                                    {/* Alt Oran (Min) */}
                                    <TableCell
                                        className="text-right font-mono cursor-pointer hover:bg-slate-50 relative group"
                                        onClick={() => setEditingCell({ vehicleId: vehicle.id, field: 'min' })}
                                    >
                                        {editingCell?.vehicleId === vehicle.id && editingCell?.field === 'min' ? (
                                            <Input
                                                autoFocus
                                                className="h-8 text-right font-mono w-full border-2 border-blue-500"
                                                defaultValue={formatValue(vehicle.consumptionMin)}
                                                onClick={(e) => e.stopPropagation()}
                                                onBlur={(e) => handleSave(vehicle.id, 'min', e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleSave(vehicle.id, 'min', e.currentTarget.value);
                                                    if (e.key === 'Escape') setEditingCell(null);
                                                }}
                                            />
                                        ) : (
                                            <span className={vehicle.consumptionMin != null ? 'text-slate-800' : 'text-slate-300'}>
                                                {vehicle.consumptionMin != null ? formatValue(vehicle.consumptionMin) : '—'}
                                            </span>
                                        )}
                                        {savingId === vehicle.id && (
                                            <Loader2 className="w-3 h-3 animate-spin absolute right-2 top-1/2 -translate-y-1/2 text-blue-500" />
                                        )}
                                    </TableCell>

                                    {/* Üst Oran (Max) */}
                                    <TableCell
                                        className="text-right font-mono cursor-pointer hover:bg-slate-50 relative group"
                                        onClick={() => setEditingCell({ vehicleId: vehicle.id, field: 'max' })}
                                    >
                                        {editingCell?.vehicleId === vehicle.id && editingCell?.field === 'max' ? (
                                            <Input
                                                autoFocus
                                                className="h-8 text-right font-mono w-full border-2 border-blue-500"
                                                defaultValue={formatValue(vehicle.consumptionMax)}
                                                onClick={(e) => e.stopPropagation()}
                                                onBlur={(e) => handleSave(vehicle.id, 'max', e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleSave(vehicle.id, 'max', e.currentTarget.value);
                                                    if (e.key === 'Escape') setEditingCell(null);
                                                }}
                                            />
                                        ) : (
                                            <span className={vehicle.consumptionMax != null ? 'text-slate-800' : 'text-slate-300'}>
                                                {vehicle.consumptionMax != null ? formatValue(vehicle.consumptionMax) : '—'}
                                            </span>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
