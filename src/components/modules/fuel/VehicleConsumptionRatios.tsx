'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Fuel } from 'lucide-react';
import { getVehicleTypeConsumptions, upsertVehicleTypeConsumption } from '@/actions/vehicle-type-consumption';

const VEHICLE_TYPES = [
    { key: 'TRUCK', label: 'Kamyon', unit: 'Lt/100km' },
    { key: 'LORRY', label: 'Tır', unit: 'Lt/100km' },
    { key: 'CAR', label: 'Binek', unit: 'Lt/100km' },
    { key: 'EXCAVATOR', label: 'Ekskavatör', unit: 'Lt/saat' },
    { key: 'TRACTOR', label: 'Traktör', unit: 'Lt/saat' },
    { key: 'MOTORCYCLE', label: 'Motosiklet', unit: 'Lt/100km' },
    { key: 'PICKUP', label: 'Pikap', unit: 'Lt/100km' },
    { key: 'OTHER', label: 'Diğer', unit: 'Lt/100km' },
];

interface TypeConsumption {
    vehicleType: string;
    consumptionMin: number | null;
    consumptionMax: number | null;
}

export function VehicleConsumptionRatios() {
    const [data, setData] = useState<TypeConsumption[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingCell, setEditingCell] = useState<{ type: string; field: 'min' | 'max' } | null>(null);
    const [savingType, setSavingType] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const res = await getVehicleTypeConsumptions();
            if (res.success) {
                setData(res.data as TypeConsumption[]);
            }
        } catch (e) {
            console.error('Failed to load consumption ratios:', e);
        } finally {
            setLoading(false);
        }
    };

    const getValueForType = (type: string, field: 'consumptionMin' | 'consumptionMax'): number | null => {
        const record = data.find(d => d.vehicleType === type);
        return record ? record[field] : null;
    };

    const formatValue = (val: number | null | undefined): string => {
        if (val == null) return '';
        return val.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
    };

    const handleSave = useCallback(async (vehicleType: string, field: 'min' | 'max', rawValue: string) => {
        setEditingCell(null);

        const parsed = parseFloat(rawValue.replace(',', '.'));
        const value = isNaN(parsed) ? null : parsed;

        const dbField = field === 'min' ? 'consumptionMin' : 'consumptionMax';
        const currentValue = getValueForType(vehicleType, dbField);

        // Skip if unchanged
        if (value === currentValue || (value === null && currentValue === null)) return;

        setSavingType(vehicleType);

        try {
            const result = await upsertVehicleTypeConsumption(vehicleType, dbField, value);
            if (result?.success) {
                // Update local state
                setData(prev => {
                    const existing = prev.find(d => d.vehicleType === vehicleType);
                    if (existing) {
                        return prev.map(d =>
                            d.vehicleType === vehicleType
                                ? { ...d, [dbField]: value }
                                : d
                        );
                    }
                    return [...prev, { vehicleType, consumptionMin: field === 'min' ? value : null, consumptionMax: field === 'max' ? value : null }];
                });

                const typeLabel = VEHICLE_TYPES.find(t => t.key === vehicleType)?.label || vehicleType;
                toast.success(`${typeLabel} - ${field === 'min' ? 'Alt' : 'Üst'} oran güncellendi.`);
            } else {
                toast.error('Güncelleme başarısız oldu.');
            }
        } catch (error) {
            console.error('Consumption ratio update error:', error);
            toast.error('Güncelleme sırasında hata oluştu.');
        } finally {
            setSavingType(null);
        }
    }, [data]);

    if (loading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Fuel className="w-5 h-5 text-orange-500" />
                    Araç Türü Tüketim Oranları
                </CardTitle>
                <CardDescription>
                    Her araç türü için alt ve üst tüketim oranlarını belirleyiniz. Hücreye tıklayarak düzenleyebilirsiniz.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-10">No</TableHead>
                            <TableHead>Araç Türü</TableHead>
                            <TableHead className="text-center">Birim</TableHead>
                            <TableHead className="text-right w-[160px]">Alt Oran (Min)</TableHead>
                            <TableHead className="text-right w-[160px]">Üst Oran (Max)</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {VEHICLE_TYPES.map((vt, idx) => {
                            const minVal = getValueForType(vt.key, 'consumptionMin');
                            const maxVal = getValueForType(vt.key, 'consumptionMax');
                            const isSaving = savingType === vt.key;

                            return (
                                <TableRow key={vt.key} className={isSaving ? 'opacity-60' : ''}>
                                    <TableCell className="font-mono text-xs text-muted-foreground">{idx + 1}</TableCell>
                                    <TableCell className="font-medium">{vt.label}</TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="secondary" className="text-[10px]">
                                            {vt.unit}
                                        </Badge>
                                    </TableCell>

                                    {/* Alt Oran (Min) */}
                                    <TableCell
                                        className="text-right font-mono cursor-pointer hover:bg-slate-50 relative"
                                        onClick={() => setEditingCell({ type: vt.key, field: 'min' })}
                                    >
                                        {editingCell?.type === vt.key && editingCell?.field === 'min' ? (
                                            <Input
                                                autoFocus
                                                className="h-8 text-right font-mono w-full border-2 border-blue-500"
                                                defaultValue={formatValue(minVal)}
                                                onClick={(e) => e.stopPropagation()}
                                                onBlur={(e) => handleSave(vt.key, 'min', e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleSave(vt.key, 'min', e.currentTarget.value);
                                                    if (e.key === 'Escape') setEditingCell(null);
                                                }}
                                            />
                                        ) : (
                                            <span className={minVal != null ? 'text-slate-800' : 'text-slate-300'}>
                                                {minVal != null ? formatValue(minVal) : '—'}
                                            </span>
                                        )}
                                        {isSaving && (
                                            <Loader2 className="w-3 h-3 animate-spin absolute right-2 top-1/2 -translate-y-1/2 text-blue-500" />
                                        )}
                                    </TableCell>

                                    {/* Üst Oran (Max) */}
                                    <TableCell
                                        className="text-right font-mono cursor-pointer hover:bg-slate-50 relative"
                                        onClick={() => setEditingCell({ type: vt.key, field: 'max' })}
                                    >
                                        {editingCell?.type === vt.key && editingCell?.field === 'max' ? (
                                            <Input
                                                autoFocus
                                                className="h-8 text-right font-mono w-full border-2 border-blue-500"
                                                defaultValue={formatValue(maxVal)}
                                                onClick={(e) => e.stopPropagation()}
                                                onBlur={(e) => handleSave(vt.key, 'max', e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleSave(vt.key, 'max', e.currentTarget.value);
                                                    if (e.key === 'Escape') setEditingCell(null);
                                                }}
                                            />
                                        ) : (
                                            <span className={maxVal != null ? 'text-slate-800' : 'text-slate-300'}>
                                                {maxVal != null ? formatValue(maxVal) : '—'}
                                            </span>
                                        )}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
