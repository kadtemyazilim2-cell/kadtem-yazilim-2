'use client';

import { useAppStore } from '@/lib/store/use-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { useMemo } from 'react';
import { FuelLog } from '@/lib/types';
import { Pencil, Trash2, Calendar, Search, ArrowRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/store/use-auth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/multi-select';
import { useState } from 'react';
import { normalizeSearchText, cn } from '@/lib/utils';

export function FuelConsumptionReport() {
    // [UPDATED] Include fuelTransfers and tanks
    // [UPDATED] Include fuelTransfers and tanks
    const {
        fuelLogs, vehicles, deleteFuelLog, updateFuelLog,
        sites, users, fuelTransfers, fuelTanks,
        deleteFuelTransfer, updateFuelTransfer
    } = useAppStore();
    const { user, hasPermission } = useAuth();

    // Permission Check
    const canEditFuel = hasPermission('fuel.consumption', 'EDIT');
    const [editingLog, setEditingLog] = useState<FuelLog | null>(null);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isReadOnly, setIsReadOnly] = useState(false);
    const [editForm, setEditForm] = useState<Partial<FuelLog>>({});

    // Filters
    const [plateFilter, setPlateFilter] = useState<string[]>([]);
    const [siteFilter, setSiteFilter] = useState<string[]>([]);
    const [dateRange, setDateRange] = useState<{ start: string, end: string }>({ start: '', end: '' });
    const [searchTerm, setSearchTerm] = useState('');

    const handleDelete = (id: string) => {
        if (confirm('Bu kaydı silmek istediğinize emin misiniz?')) {
            if (id.includes('_OUT') || id.includes('_IN')) {
                const realId = id.split('_')[0];
                deleteFuelTransfer(realId);
            } else if (fuelTransfers.some((t: any) => t.id === id || 'PUR_' + t.id === id)) {
                // Check if it matches a Transfer directly or via prefix (Purchase might keep ID or Prefix)
                // In mapping: Purchase ID = t.id.
                // So if it exists in transfers, delete it.
                deleteFuelTransfer(id);
            } else {
                deleteFuelLog(id);
            }
        }
    };

    const openEdit = (row: any) => {
        // Check Ownership
        let readOnly = false;
        if (row.filledByUserId && row.filledByUserId !== user?.id && user?.role !== 'ADMIN') {
            readOnly = true;
        }
        setIsReadOnly(readOnly);

        // Determine Real ID and Type
        let realId = row.id;
        let isTransfer = false;

        if (row.recordType === 'VIRMAN_OUT' || row.recordType === 'VIRMAN_IN') {
            realId = row.id.split('_')[0];
            isTransfer = true;
        } else if (row.recordType === 'PURCHASE') {
            isTransfer = true;
        }

        if (isTransfer) {
            const transfer = fuelTransfers.find((t: any) => t.id === realId);
            if (!transfer) return alert('Kayıt bulunamadı.');
            setEditingLog({ ...transfer, recordType: 'TRANSFER' } as any);
            setEditForm({
                date: transfer.date,
                liters: transfer.amount,
                mileage: 0, // Not used
                siteId: transfer.toType === 'TANK' ? (fuelTanks.find((t: any) => t.id === transfer.toId)?.siteId) : undefined
            });
        } else {
            // Fuel Log
            setEditingLog({ ...row, recordType: 'LOG' });
            setEditForm({
                date: row.date,
                mileage: row.mileage,
                liters: row.liters,
                cost: row.cost,
                siteId: row.siteId
            });
        }
        setIsEditOpen(true);
    };

    const handleUpdate = () => {
        if (!editingLog) return;

        if ((editingLog as any).recordType === 'TRANSFER') {
            // Update Transfer
            // Mapping editForm back to Transfer properties
            // Note: We only support Date and Amount (Liters) update here to keep it safe.
            // Site update is risky for Transfers (changes From/To tanks logic).
            updateFuelTransfer(editingLog.id, {
                date: editForm.date,
                amount: editForm.liters
            });
        } else {
            // Update Log
            updateFuelLog(editingLog.id, editForm);
        }
        setIsEditOpen(false);
        setEditingLog(null);
    };

    // Group logs by vehicle
    const vehicleLogs = useMemo(() => {
        const grouped: Record<string, typeof fuelLogs> = {};
        fuelLogs.forEach((log: any) => {
            if (!grouped[log.vehicleId]) grouped[log.vehicleId] = [];
            grouped[log.vehicleId].push(log);
        });

        // Sort each group by mileage/date desc
        Object.keys(grouped).forEach((k: any) => {
            grouped[k].sort((a: any, b: any) => b.mileage - a.mileage);
        });

        return grouped;
    }, [fuelLogs]);

    const reportData = useMemo(() => {
        const data: any[] = [];
        const processedVehicles = new Set<string>();

        // 1. Process Fuel Logs
        Object.keys(vehicleLogs).forEach((vehicleId: any) => {
            processedVehicles.add(vehicleId);
            const logs = vehicleLogs[vehicleId];
            const vehicle = vehicles.find((v: any) => v.id === vehicleId);
            if (!vehicle) return;

            // [NEW] Advanced Consumption Calculation (Full-to-Full Method)
            let totalValidLiters = 0;
            let totalValidDist = 0;
            const consumptionMap: Record<string, number> = {};

            // Iterate to find closed Full-to-Full loops
            for (let i = 0; i < logs.length; i++) {
                // If current is Full, look for previous Full
                if (logs[i].fullTank) {
                    let j = i + 1;
                    // Skip partials backwards to find next anchor
                    while (j < logs.length && !logs[j].fullTank) {
                        j++;
                    }

                    if (j < logs.length) {
                        // Found previous full tank at index j
                        const prevFull = logs[j];
                        const dist = logs[i].mileage - prevFull.mileage;

                        // Sum liters of current + intermediate partials
                        // Range: [i, j)
                        let liters = 0;
                        for (let k = i; k < j; k++) {
                            liters += logs[k].liters;
                        }

                        if (dist > 0) {
                            const cons = (liters / dist) * (vehicle.meterType === 'HOURS' ? 1 : 100);
                            consumptionMap[logs[i].id] = cons;

                            // Add to lifetime totals
                            totalValidLiters += liters;
                            totalValidDist += dist;
                        }
                    }
                }
            }

            const lifetimeAvg = totalValidDist > 0 ? (totalValidLiters / totalValidDist) * (vehicle.meterType === 'HOURS' ? 1 : 100) : 0;

            logs.forEach((log: any, index: any) => {
                let diffKm = 0;
                let consumption = 0;

                // Use pre-calculated consumption if valid
                if (consumptionMap[log.id]) {
                    consumption = consumptionMap[log.id];
                }

                // Simple diffKm for display (Current - Previous Log regardless of Full/Partial)
                const originalIndex = logs.findIndex((l: any) => l.id === log.id);
                if (originalIndex < logs.length - 1) {
                    const nextLog = logs[originalIndex + 1];
                    diffKm = log.mileage - nextLog.mileage;
                }

                data.push({
                    id: log.id,
                    recordType: 'LOG',
                    date: log.date,
                    vehicle,
                    mileage: log.mileage,
                    diffKm,
                    liters: log.liters,
                    consumption, // Now only populated for Full Tank records closing a loop
                    lifetimeAvg: lifetimeAvg,
                    fullTank: log.fullTank,
                    siteId: log.siteId,
                    filledByUserId: log.filledByUserId,
                    sourceName: undefined // Fallback to filledByUserId name in render
                });
            });
        });

        // 2 & 3. Process Transfers (Uniform Logic for VIRMAN & PURCHASE)
        const allTransfers = fuelTransfers || [];
        allTransfers.forEach((t: any) => {
            // Helpers to resolve Names and SiteIDs
            const resolveEntity = (type: string, id: string) => {
                if (type === 'TANK') {
                    const tank = fuelTanks.find((x: any) => x.id === id);
                    const site = sites.find((s: any) => s.id === tank?.siteId);
                    return { name: site?.name || tank?.name || 'Depo', siteId: tank?.siteId, isTank: true };
                }
                if (type === 'VEHICLE') {
                    const v = vehicles.find((x: any) => x.id === id);
                    const site = sites.find((s: any) => s.id === v?.assignedSiteId);
                    return { name: v?.plate || 'Araç', siteId: v?.assignedSiteId, isTank: false };
                }
                if (type === 'EXTERNAL') {
                    return { name: id, siteId: undefined, isTank: false };
                }
                return { name: '-', siteId: undefined, isTank: false };
            };

            const fromEnt = resolveEntity(t.fromType, t.fromId);
            const toEnt = resolveEntity(t.toType, t.toId);

            // A. PURCHASE (External -> X)
            if (t.fromType === 'EXTERNAL') {
                data.push({
                    id: t.id,
                    recordType: 'PURCHASE', // distinct from TANK_REFILL for clarity
                    subType: 'PURCHASE',
                    date: t.date,
                    vehicle: {
                        id: 'PUR_' + t.id,
                        plate: fromEnt.name, // Tedarikçi
                        brand: `Giriş: ${toEnt.name}`,
                        meterType: 'Lt',
                        type: 'OTHER'
                    } as any,
                    mileage: 0,
                    diffKm: 0,
                    liters: t.amount, // Positive effect
                    unitPrice: t.unitPrice || 0,
                    totalCost: t.totalCost || (t.amount * (t.unitPrice || 0)),
                    consumption: 0,
                    lifetimeAvg: 0,
                    fullTank: true,
                    siteId: toEnt.siteId || '',
                    filledByUserId: t.createdByUserId,
                    sourceName: undefined // Shows User Name
                });
            }
            // B. VIRMAN (Internal -> Internal)
            else {
                // 1. OUT Record (Source)
                data.push({
                    id: t.id + '_OUT',
                    recordType: 'VIRMAN_OUT',
                    subType: 'OUT',
                    date: t.date,
                    vehicle: {
                        id: 'VIR_OUT_' + t.id,
                        plate: fromEnt.name, // "Çıkış yerinin yani şantiyenin ismi"
                        brand: 'Çıkış Yeri',
                        meterType: 'Lt',
                        type: 'OTHER'
                    } as any,
                    mileage: 0,
                    diffKm: 0,
                    liters: -1 * t.amount, // Negative effect
                    consumption: 0,
                    lifetimeAvg: 0,
                    fullTank: false,
                    siteId: fromEnt.siteId || '',
                    filledByUserId: t.createdByUserId,
                    sourceName: undefined,
                    targetName: toEnt.name // [FIX] Added target name for display
                });

                // 2. IN Record (Target)
                data.push({
                    id: t.id + '_IN',
                    recordType: 'VIRMAN_IN',
                    subType: 'IN',
                    date: t.date,
                    vehicle: {
                        id: 'VIR_IN_' + t.id,
                        plate: toEnt.name, // [FIX] "Giriş" record belongs to Target
                        brand: 'Giriş',
                        meterType: 'Lt',
                        type: 'OTHER'
                    } as any,
                    mileage: 0,
                    diffKm: 0,
                    liters: t.amount, // Positive effect
                    consumption: 0,
                    lifetimeAvg: 0,
                    fullTank: false,
                    siteId: toEnt.siteId || '',
                    filledByUserId: t.createdByUserId,
                    sourceName: fromEnt.name // [FIX] Added source name for display
                });
            }
        });

        // 4. Filtering & Balancing Logic
        let processedData = [...data];

        // A. Entity Filters
        if (plateFilter.length > 0) {
            processedData = processedData.filter((item: any) => plateFilter.includes(item.vehicle.plate));
        }
        if (siteFilter.length > 0) {
            processedData = processedData.filter((item: any) => item.siteId && siteFilter.includes(item.siteId));
        }

        // B. Calculate Previous Balance (Devreden)
        let previousTotal = 0;
        let startDateObj: Date | null = null;

        const calculateStockVal = (item: any) => {
            // Simplified logic as liters are already signed for VIRMAN
            if (item.recordType === 'LOG') return -1 * item.liters;
            if (item.recordType === 'PURCHASE') return item.liters; // Positive
            if (item.recordType === 'VIRMAN_OUT') return item.liters; // Already Negative
            if (item.recordType === 'VIRMAN_IN') return item.liters; // Already Positive
            // Fallback for old types if any leaking
            return 0;
        };

        if (dateRange.start) {
            startDateObj = startOfDay(parseISO(dateRange.start));
            const preItems = processedData.filter((item: any) => parseISO(item.date) < startDateObj!);
            preItems.forEach((item: any) => {
                previousTotal += calculateStockVal(item);
            });
            processedData = processedData.filter((item: any) => parseISO(item.date) >= startDateObj!);
        }

        // C. Apply End Date Filter
        if (dateRange.end) {
            const endDateObj = endOfDay(parseISO(dateRange.end));
            processedData = processedData.filter((item: any) => parseISO(item.date) <= endDateObj);
        }

        // D. Apply Search Filter
        if (searchTerm) {
            const lowerSearch = normalizeSearchText(searchTerm);
            processedData = processedData.filter((item: any) => {
                const plate = normalizeSearchText(item.vehicle.plate);
                const type = normalizeSearchText(item.vehicle.type);
                const brand = normalizeSearchText(item.vehicle.brand || '');
                return plate.includes(lowerSearch) || type.includes(lowerSearch) || brand.includes(lowerSearch);
            });
        }

        // E. Calculate Schedule (Running Total)
        processedData.sort((a: any, b: any) => {
            const d = new Date(a.date).getTime() - new Date(b.date).getTime();
            return d !== 0 ? d : a.id.localeCompare(b.id);
        });

        let runningTotal = previousTotal;
        processedData.forEach((item: any) => {
            runningTotal += calculateStockVal(item);
            item.cumulativeTotal = runningTotal;
        });

        // F. Add 'Devir' Row
        if (startDateObj || previousTotal !== 0) {
            processedData.unshift({
                id: 'balance-start',
                recordType: 'BALANCE_START',
                date: dateRange.start ? dateRange.start : (processedData.length > 0 ? processedData[0].date : new Date().toISOString()),
                vehicle: { plate: '-', brand: 'DEVREDEN STOK', meterType: '' } as any,
                mileage: 0,
                diffKm: 0,
                liters: Math.abs(previousTotal),
                subType: previousTotal >= 0 ? '+' : '-',
                cumulativeTotal: previousTotal,
                sourceName: 'Önceki Dönem',
                consumption: 0,
                lifetimeAvg: 0
            });
        }

        return processedData.reverse();

    }, [vehicleLogs, vehicles, plateFilter, siteFilter, dateRange, searchTerm, sites, fuelTransfers, fuelTanks]);

    const uniquePlates = Array.from(new Set(vehicles.map((v: any) => v.plate))).sort();
    const uniqueSites = Array.from(new Set(sites.map((s: any) => s.name))).sort();

    const renderFilters = () => (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-4 p-4 bg-slate-50/50 rounded-lg border">
            {/* Date Range */}
            <div className="flex flex-col gap-1">
                <Label className="text-xs">Başlangıç Tarihi</Label>
                <Input type="date" className="h-8 text-xs bg-white" value={dateRange.start} onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1">
                <Label className="text-xs">Bitiş Tarihi</Label>
                <Input type="date" className="h-8 text-xs bg-white" value={dateRange.end} onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))} />
            </div>

            {/* Plate Filter */}
            <div className="flex flex-col gap-1">
                <Label className="text-xs">Plaka</Label>
                <MultiSelect
                    options={uniquePlates.map((p: any) => ({ label: p, value: p }))}
                    selected={plateFilter}
                    onChange={setPlateFilter}
                    placeholder="Tümü"
                    searchPlaceholder="Plaka ara..."
                    className="h-8 text-xs bg-white"
                />
            </div>

            {/* Site Filter */}
            <div className="flex flex-col gap-1">
                <Label className="text-xs">Şantiye</Label>
                <MultiSelect
                    options={sites.filter((s: any) => s.status === 'ACTIVE').map((s: any) => ({ label: s.name, value: s.id }))}
                    selected={siteFilter}
                    onChange={setSiteFilter}
                    placeholder="Tümü"
                    searchPlaceholder="Şantiye ara..."
                    className="h-8 text-xs bg-white"
                />
            </div>

            {/* Search Input - Full Width */}
            <div className="md:col-span-4 relative mt-2">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    type="search"
                    placeholder="Genel arama (Plaka, Şantiye vb.)..."
                    className="pl-8 bg-white"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
        </div>
    );

    return (
        <Card>
            <CardHeader>
                <CardTitle>Detaylı Yakıt Tüketim Raporu</CardTitle>
                <div className="space-y-4">
                    {renderFilters()}
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Tarih</TableHead>
                            <TableHead>Plaka / Araç</TableHead>
                            <TableHead>Sayaç</TableHead>
                            <TableHead>Fark</TableHead>
                            <TableHead>Alınan</TableHead>
                            <TableHead>Ort Tüketim</TableHead>
                            <TableHead>Genel Ort</TableHead>
                            <TableHead>Kümülatif Toplam</TableHead>
                            <TableHead>Yakıt Veren</TableHead>
                            <TableHead className="w-[80px]">İşlemler</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {reportData.map((row) => (
                            <TableRow key={row.id} className={row.recordType === 'BALANCE_START' ? "bg-blue-50 hover:bg-blue-100 border-t-2 border-blue-200" : ""}>
                                <TableCell className="whitespace-nowrap">{row.recordType === 'BALANCE_START' ? format(new Date(row.date), 'dd.MM.yyyy') : format(new Date(row.date), 'dd.MM.yyyy HH:mm')}</TableCell>
                                <TableCell>
                                    <div className="font-medium">{row.vehicle.plate}</div>
                                    <div className="text-xs text-muted-foreground">{row.vehicle.brand}</div>
                                </TableCell>

                                {/* CONDITIONAL RENDERING FOR VIRMAN */}
                                {(row.recordType === 'VIRMAN_OUT' || row.recordType === 'VIRMAN_IN') ? (
                                    <TableCell colSpan={5} className="text-center font-bold text-slate-600 bg-slate-50/50">
                                        <div className="flex items-center justify-center gap-2">
                                            <span>{row.recordType === 'VIRMAN_OUT' ? '-' : '+'}{Math.abs(row.liters).toLocaleString()} Lt</span>
                                            {row.recordType === 'VIRMAN_OUT' ? (
                                                <ArrowLeft className="h-4 w-4 text-muted-foreground" /> // User requested reversed arrow for exit
                                            ) : (
                                                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                            )}
                                            <span>Virman</span>
                                        </div>
                                    </TableCell>
                                ) : (
                                    <>
                                        <TableCell>
                                            {(row.recordType === 'PURCHASE' || row.recordType === 'BALANCE_START') ? '-' : (
                                                <>
                                                    {row.mileage.toLocaleString()}
                                                    <span className="text-xs text-muted-foreground ml-1">{row.vehicle.meterType}</span>
                                                </>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {(row.recordType === 'PURCHASE' || row.recordType === 'BALANCE_START') ? '-' : (
                                                row.diffKm > 0 ? `+${row.diffKm}` : '-'
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className={cn("font-bold",
                                                    row.recordType === 'BALANCE_START' ? 'text-blue-700' :
                                                        (row.recordType === 'PURCHASE' ? 'text-green-600' : 'text-red-600')
                                                )}>
                                                    {row.recordType === 'BALANCE_START' ? (
                                                        `Devir: ${row.liters.toLocaleString()} Lt`
                                                    ) : (
                                                        <>
                                                            {row.recordType === 'PURCHASE' ? '+' : '-'}{Math.abs(row.liters).toLocaleString()} Lt
                                                        </>
                                                    )}
                                                </span>
                                                {!row.fullTank && row.recordType === 'LOG' && <Badge variant="outline" className="text-[10px] w-fit">Full Değil</Badge>}
                                                {row.recordType === 'PURCHASE' && <Badge variant="default" className="text-[10px] w-fit bg-green-600 hover:bg-green-700">Satın Alma</Badge>}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {(row.recordType === 'PURCHASE' || row.recordType === 'BALANCE_START') ? '-' : (
                                                row.consumption > 0 ? (
                                                    <Badge variant={row.consumption > row.lifetimeAvg * 1.2 ? 'destructive' : 'secondary'}>
                                                        {row.consumption.toFixed(2)} {row.vehicle.meterType === 'HOURS' ? 'Lt/Saat' : 'Lt/100km'}
                                                    </Badge>
                                                ) : '-'
                                            )}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {(row.recordType === 'PURCHASE' || row.recordType === 'BALANCE_START') ? '-' : (
                                                row.lifetimeAvg > 0 ? (
                                                    <span>{row.lifetimeAvg.toFixed(2)} {row.vehicle.meterType === 'HOURS' ? 'Lt/Saat' : 'Lt/100km'}</span>
                                                ) : '-'
                                            )}
                                        </TableCell>
                                    </>
                                )}

                                <TableCell className={cn("font-semibold",
                                    row.cumulativeTotal < 0 ? "text-red-600 font-bold" :
                                        (row.cumulativeTotal > 0 ? "text-green-600 font-bold" : "text-slate-700")
                                )}>
                                    {row.cumulativeTotal?.toLocaleString()} Lt
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                    {row.sourceName || (users.find((u: any) => u.id === row.filledByUserId)?.name || '-')}
                                </TableCell>
                                <TableCell>
                                    {canEditFuel && row.recordType !== 'BALANCE_START' && (
                                        <div className="flex items-center gap-1">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-50" onClick={() => openEdit(row)}>
                                                <Pencil className="w-4 h-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(row.id)}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>

            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Yakıt Kaydını Düzenle</DialogTitle>
                    </DialogHeader>
                    {editingLog && (
                        <div className="grid gap-4 py-4">
                            {isReadOnly && (
                                <div className="bg-red-50 text-red-800 p-3 rounded-md text-xs font-medium border border-red-200">
                                    Bu kayıt başka bir kullanıcı tarafından oluşturulmuştur. Düzenleyemezsiniz.
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Tarih</Label>
                                    <Input
                                        type="date"
                                        value={editForm.date}
                                        onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                                        disabled={isReadOnly}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Şantiye</Label>
                                    <Select
                                        value={editForm.siteId}
                                        onValueChange={(v) => setEditForm({ ...editForm, siteId: v })}
                                        disabled={isReadOnly}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seçiniz" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {sites.filter((s: any) => s.status === 'ACTIVE').map((s: any) => (
                                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            {(editingLog as any)?.recordType !== 'TRANSFER' && (
                                <div className="space-y-2">
                                    <Label>KM / Saat</Label>
                                    <Input
                                        type="number"
                                        value={editForm.mileage}
                                        onChange={(e) => setEditForm({ ...editForm, mileage: Number(e.target.value) })}
                                        disabled={isReadOnly}
                                    />
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Litre</Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={editForm.liters}
                                        onChange={(e) => setEditForm({ ...editForm, liters: Number(e.target.value) })}
                                    />
                                </div>
                                {/* Cost Field Removed as per request */}
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditOpen(false)}>İptal</Button>
                        <Button onClick={handleUpdate}>Güncelle</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card >
    );
}
