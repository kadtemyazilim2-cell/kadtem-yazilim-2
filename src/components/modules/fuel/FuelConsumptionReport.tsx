'use client';

import { useAppStore } from '@/lib/store/use-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { useMemo, useEffect } from 'react';
import { FuelLog } from '@/lib/types';
import { Pencil, Trash2, Calendar, Search, ArrowRight, ArrowLeft, FileSpreadsheet, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/store/use-auth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/multi-select';
import { useState } from 'react';
import { normalizeSearchText, cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { deleteFuelLog as deleteFuelLogAction, deleteFuelTransfer as deleteFuelTransferAction, updateFuelLog as updateFuelLogAction, updateFuelTransfer as updateFuelTransferAction, getFuelLogs, getFuelTransfers, getFuelTanks } from '@/actions/fuel';

// ...

// Rogue handleUpdate removed

import { FuelStatsCard } from './FuelStatsCard'; // [NEW]

interface FuelConsumptionReportProps {
    initialSiteId?: string;
}

export function FuelConsumptionReport({ initialSiteId }: FuelConsumptionReportProps = {}) {
    const router = useRouter();
    // [UPDATED] Include fuelTransfers and tanks
    const {
        fuelLogs, vehicles, deleteFuelLog, updateFuelLog,
        sites, users, fuelTransfers, fuelTanks,
        deleteFuelTransfer, updateFuelTransfer
    } = useAppStore();
    const { user, hasPermission } = useAuth();

    // [NEW] Client-side fresh fetch to bypass server cache issues
    const [refreshKey, setRefreshKey] = useState(0); // [FIX] Manual Refresh Trigger

    useEffect(() => {
        const fetchData = async () => {
            console.log('Fetching fresh fuel data on client (Key:', refreshKey, ')...');
            const [logsRes, transfersRes, tanksRes] = await Promise.all([
                getFuelLogs(),
                getFuelTransfers(),
                getFuelTanks()
            ]);

            if (logsRes.success && logsRes.data) {
                useAppStore.getState().setFuelLogs(logsRes.data as any);
            }
            if (transfersRes.success && transfersRes.data) {
                useAppStore.getState().setFuelTransfers(transfersRes.data as any);
            }
            if (tanksRes.success && tanksRes.data) {
                useAppStore.getState().setFuelTanks(tanksRes.data as any);
            }
        };
        fetchData();
    }, [refreshKey]); // [FIX] Add refreshKey dependency

    // Permission Check
    const canEditFuel = hasPermission('fuel.consumption', 'EDIT');
    const [editingLog, setEditingLog] = useState<FuelLog | null>(null);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isReadOnly, setIsReadOnly] = useState(false);
    const [editForm, setEditForm] = useState<Partial<FuelLog>>({});

    // Filters
    const [plateFilter, setPlateFilter] = useState<string[]>([]);
    const [siteFilter, setSiteFilter] = useState<string>(initialSiteId || ''); // [UPDATED] Single Site
    const [dateRange, setDateRange] = useState<{ start: string, end: string }>({ start: '', end: '' });
    const [searchTerm, setSearchTerm] = useState('');

    const handleDelete = async (id: string) => {
        if (!confirm('Bu kaydı silmek istediğinize emin misiniz?')) return;

        let success = false;
        let errorMsg = '';

        try {
            if (id.includes('_OUT') || id.includes('_IN')) {
                const realId = id.split('_')[0];
                const res = await deleteFuelTransferAction(realId);
                if (res.success) {
                    deleteFuelTransfer(realId);
                    success = true;
                } else errorMsg = res.error || 'Silinemedi';
            } else if (fuelTransfers.some((t: any) => t.id === id || 'PUR_' + t.id === id)) {
                // Handle PURCHASE or direct Transfer ID
                const realId = id.startsWith('PUR_') ? id.replace('PUR_', '') : id;
                const res = await deleteFuelTransferAction(realId);
                if (res.success) {
                    deleteFuelTransfer(realId);
                    success = true;
                } else errorMsg = res.error || 'Silinemedi';
            } else {
                const res = await deleteFuelLogAction(id);
                if (res.success) {
                    deleteFuelLog(id);
                    success = true;
                } else errorMsg = res.error || 'Silinemedi';
            }

            if (!success) {
                alert(errorMsg);
            }
        } catch (error) {
            console.error(error);
            alert('İşlem sırasında bir hata oluştu.');
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
                date: row.date ? format(new Date(row.date), 'yyyy-MM-dd') : '', // [FIX] Format for Input
                mileage: row.mileage,
                liters: row.liters,
                cost: row.cost,
                siteId: row.siteId,
                tankId: row.tankId,
                vehicleId: row.vehicleId
            });
        }
        setIsEditOpen(true);
    };

    const [isUpdating, setIsUpdating] = useState(false); // [NEW] Loading State

    const handleUpdate = async () => {
        if (!editingLog) return;
        console.log('Updating Fuel Record:', editingLog.id, editForm);
        setIsUpdating(true); // [NEW] Start Loading

        try {
            if ((editingLog as any).recordType === 'TRANSFER') {
                // Update Transfer
                // Call Server Action
                const res = await updateFuelTransferAction(editingLog.id, {
                    ...editForm,
                    date: editForm.date ? new Date(editForm.date) : undefined,
                    amount: editForm.liters
                } as any);

                if (res.success) {
                    updateFuelTransfer(editingLog.id, {
                        ...editForm,
                        date: editForm.date ? new Date(editForm.date) : undefined,
                        amount: editForm.liters
                    } as any);
                    setIsEditOpen(false);
                    setEditingLog(null);
                    router.refresh();
                    setRefreshKey(prev => prev + 1);
                } else {
                    alert(res.error || 'Güncelleme başarısız.');
                }
            } else {
                // Update Log
                // Call Server Action
                const res = await updateFuelLogAction(editingLog.id, {
                    ...editForm,
                    date: editForm.date ? new Date(editForm.date) : undefined
                } as any);

                if (res.success && res.data) {
                    updateFuelLog(editingLog.id, res.data as any);
                    setIsEditOpen(false);
                    setEditingLog(null);
                    router.refresh();
                    setRefreshKey(prev => prev + 1);
                } else {
                    alert(res.error || 'Güncelleme başarısız.');
                }
            }
        } catch (error) {
            console.error(error);
            alert('Bir hata oluştu.');
        } finally {
            setIsUpdating(false); // [NEW] Stop Loading
        }
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

                            // Add to lifetime totals (Respect dynamic Site Filter)
                            // If Site Selected: Only include logs filled at that site in the Average.
                            // If No Site: Include all.
                            if (!siteFilter || logs[i].siteId === siteFilter) {
                                totalValidLiters += liters;
                                totalValidDist += dist;
                            }
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
                    tankId: log.tankId, // [FIX] Include tankId for edits
                    vehicleId: log.vehicleId, // [FIX] Include vehicleId for edits
                    filledByUserId: log.filledByUserId,
                    sourceName: undefined, // Fallback to filledByUserId name in render,
                    description: log.description // [NEW] Note
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
                    sourceName: undefined, // Shows User Name
                    description: t.description // [NEW] Note
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
                    targetName: toEnt.name,
                    counterpartSiteName: toEnt.name, // [NEW] Destination Name for Report
                    description: t.description
                });

                // 2. IN Record (Target)
                data.push({
                    id: t.id + '_IN',
                    recordType: 'VIRMAN_IN',
                    subType: 'IN',
                    date: t.date,
                    vehicle: {
                        id: 'VIR_IN_' + t.id,
                        plate: toEnt.name,
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
                    sourceName: undefined,
                    counterpartSiteName: fromEnt.name, // [NEW] Source Name for Report
                    description: t.description
                });
            }
        });

        // 4. Filtering & Balancing Logic
        let processedData = [...data];

        // A. Sort Ascending (Oldest First) for Forward Calculation
        processedData.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // B. Initialize Balances to 0 (Tracking History purely from transactions)
        // If we anchored to Current Stock, any drift/missing data would skew the past.
        // By anchoring to 0 (or relying on BALANCE_START if we had one), we show "Calculated Stock".
        const runningBalances: Record<string, number> = {};

        // C. Walk Forward
        processedData.forEach((item: any) => {
            const sId = item.siteId || 'unknown';

            if (runningBalances[sId] === undefined) {
                runningBalances[sId] = 0;
            }

            let effect = 0;
            if (item.recordType === 'LOG') effect = -1 * item.liters;
            else if (item.recordType === 'PURCHASE') effect = item.liters;
            else if (item.recordType === 'VIRMAN_OUT') effect = -1 * Math.abs(item.liters);
            else if (item.recordType === 'VIRMAN_IN') effect = Math.abs(item.liters);

            runningBalances[sId] += effect;
            item.cumulativeTotal = runningBalances[sId];
        });

        // D. Sort Descending for Display (Newest First)
        processedData.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

        // Step 2: NOW Apply Filters for Display

        // Site Filter
        if (siteFilter.length > 0) {
            processedData = processedData.filter((item: any) => item.siteId && siteFilter.includes(item.siteId));
        }

        // Plate Filter
        if (plateFilter.length > 0) {
            processedData = processedData.filter((item: any) => plateFilter.includes(item.vehicle.plate));
        }

        // Search Filter
        if (searchTerm) {
            const lowerSearch = normalizeSearchText(searchTerm);
            processedData = processedData.filter((item: any) => {
                const plate = normalizeSearchText(item.vehicle.plate || '');
                const type = normalizeSearchText(item.vehicle.type || '');
                const brand = normalizeSearchText(item.vehicle.brand || '');
                return plate.includes(lowerSearch) || type.includes(lowerSearch) || brand.includes(lowerSearch);
            });
        }

        // Date Range Filter
        // Note: Start Date Filter cuts off the rows.
        // We need to capture the "Devir" (Opening Balance) for the filtered view.
        // Ideally, we find the Balance of the site AT the start date.
        // Since we walked backwards effectively to the beginning of time (or data), 
        // `runningBalances` map now holds the "Initial Stock" (at very start).
        // BUT we want "Stock at StartDate".

        // This is complex for multi-site in a single list. 
        // If the view is filtered to one Site (common), we can show one Devir row.
        // If mixed, showing "Devir" is messy (which site?).
        // Let's standardise: Only show "Devir" row if `siteFilter` has exactly 1 site.

        const showDevir = siteFilter.length === 1 && !!dateRange.start;
        let devirBalance = 0;

        if (showDevir) {
            // We need the balance right before the first visible item?
            // Or balance at Start Date.
            // Since we have `processedData` with `cumulativeTotal` assigned (Stock After Transaction),
            // The "Balance at Start Date" is roughly the `cumulativeTotal` of the *Last Item* inside the date range?
            // No, "Start" is the cutoff.
            // We want the balance of the item just *before* the cutoff (older).
            // Since we sort Newest -> Oldest.
            // Items: [New (Today), ..., Cutoff Item (Start Date), Old (Yesterday)].
            // If we filter out Old, the "Opening" is the Stock *After* Old (which is Stock *Before* Cutoff Item).
            // Actually, `cumulativeTotal` on `Old` is Stock After Old.
            // So yes, we want `cumulativeTotal` of the newest "Hidden/Old" item.

            // Let's filter dates.
        }

        if (dateRange.start) {
            const startObj = startOfDay(parseISO(dateRange.start));

            // Find Opening Balance for the single site
            if (showDevir) {
                const sId = siteFilter[0];
                // Find the newest transaction OLDER than startObj
                // Data is sorted Newest First.
                // So we scan from end? Or find first item < startObj.
                const olderItem = processedData.find((item: any) => parseISO(item.date) < startObj);
                if (olderItem) {
                    // The stock AFTER that older item is our Opening Balance
                    devirBalance = olderItem.cumulativeTotal;
                } else {
                    // No older item found. Start Date is before recorded history.
                    // Opening Balance is 0.
                    devirBalance = 0;
                }
            }

            processedData = processedData.filter((item: any) => parseISO(item.date) >= startObj);
        }

        if (dateRange.end) {
            const endObj = endOfDay(parseISO(dateRange.end));
            processedData = processedData.filter((item: any) => parseISO(item.date) <= endObj);
        }

        // Add Devir Row if applicable
        if (showDevir) {
            processedData.push({
                id: 'balance-start',
                recordType: 'BALANCE_START',
                date: dateRange.start,
                vehicle: { plate: '-', brand: 'DEVREDEN STOK', meterType: '' } as any,
                mileage: 0,
                diffKm: 0,
                liters: 0,
                subType: '',
                cumulativeTotal: devirBalance,
                sourceName: 'Önceki Dönem',
                consumption: 0,
                lifetimeAvg: 0
            });
        }

        return processedData;

    }, [vehicleLogs, vehicles, plateFilter, siteFilter, dateRange, searchTerm, sites, fuelTransfers, fuelTanks]);

    const uniquePlates = Array.from(new Set(vehicles.map((v: any) => v.plate))).sort();
    const uniqueSites = Array.from(new Set(sites.map((s: any) => s.name))).sort();

    // [NEW] Export Handlers
    const handleExportPDF = async () => {
        try {
            const mod = await import('@/lib/pdf-generator');
            // Resolve Site Name
            let siteName = 'Tümü';
            if (siteFilter.length === 1) {
                const s = sites.find((x: any) => x.id === siteFilter[0]);
                if (s) siteName = s.name;
            } else if (siteFilter.length > 1) {
                siteName = 'Çoklu Seçim';
            }

            mod.generateFuelConsumptionPDF(reportData, dateRange, siteName);
        } catch (error) {
            console.error(error);
            alert('PDF oluşturulurken hata oluştu.');
        }
    };

    const handleExportExcel = async () => {
        try {
            const XLSX = await import('xlsx');
            const wsData = reportData.map((row: any) => ({
                'Tarih': row.recordType === 'BALANCE_START' ? format(new Date(row.date), 'dd.MM.yyyy') : format(new Date(row.date), 'dd.MM.yyyy HH:mm'),
                'Plaka/Araç': row.vehicle.plate,
                'Tip': row.recordType,
                'Sayaç': row.mileage || 0,
                'Alınan (Lt)': row.liters,
                'Kümülatif': row.cumulativeTotal,
                'Ort. Tüketim': row.consumption || 0,
                'Not': row.description || '',
                'Yakıt Veren': row.sourceName || (users.find((u: any) => u.id === row.filledByUserId)?.name || '-')
            }));

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(wsData);
            XLSX.utils.book_append_sheet(wb, ws, "Yakıt Raporu");
            XLSX.writeFile(wb, `yakit_raporu_${format(new Date(), 'yyyyMMdd')}.xlsx`);
        } catch (e) {
            console.error(e);
            alert('Excel oluşturulurken hata oluştu.');
        }
    };

    const renderFilters = () => (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 p-4 bg-slate-50/50 rounded-lg border">
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
                {/* Site Filter */}
                <div className="flex flex-col gap-1">
                    <Label className="text-xs">Şantiye</Label>
                    <Select value={siteFilter || 'ALL'} onValueChange={(val) => setSiteFilter(val === 'ALL' ? '' : val)}>
                        <SelectTrigger className="h-8 text-xs bg-white">
                            <SelectValue placeholder="Şantiye Seçiniz" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Tüm Şantiyeler</SelectItem>
                            {sites
                                .filter((s: any) => s.status === 'ACTIVE' && fuelTanks.some((t: any) => t.siteId === s.id))
                                .map((s: any) => (
                                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                ))
                            }
                        </SelectContent>
                    </Select>
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

            {/* [NEW] Export Buttons */}
            {hasPermission('fuel.consumption', 'EXPORT') && (
                <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-green-600" /> Excel İndir
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-2">
                        <FileDown className="w-4 h-4 text-red-600" /> PDF İndir
                    </Button>
                </div>
            )}
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Summary Card Integrated */}
            {siteFilter && (
                <FuelStatsCard
                    siteId={siteFilter}
                    startDate={dateRange.start}
                    endDate={dateRange.end}
                    fuelTransfers={fuelTransfers}
                    fuelLogs={fuelLogs}
                    fuelTanks={fuelTanks}
                    sites={sites}
                />
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Detaylı Yakıt Tüketim Raporu</CardTitle>
                    <div className="space-y-4">
                        {renderFilters()}
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Tarih</TableHead>
                                    <TableHead>Plaka / Araç</TableHead>
                                    <TableHead className="text-right">Sayaç</TableHead>
                                    <TableHead className="text-right">Fark</TableHead>
                                    <TableHead className="text-right">Alınan</TableHead>
                                    <TableHead>Ort Tüketim</TableHead>
                                    <TableHead>Genel Ort</TableHead>
                                    <TableHead className="text-right">Kümülatif Toplam</TableHead>
                                    <TableHead>Not</TableHead>
                                    <TableHead>Yakıt Veren</TableHead>
                                    <TableHead className="w-[80px]">İşlemler</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {reportData.map((row) => (
                                    <TableRow key={row.id} className={cn(
                                        row.recordType === 'BALANCE_START' && "bg-blue-50 hover:bg-blue-100 border-t-2 border-blue-200",
                                        (row.recordType === 'LOG' && !row.fullTank) && "bg-amber-50 hover:bg-amber-100"
                                    )}>
                                        <TableCell className="whitespace-nowrap">{row.recordType === 'BALANCE_START' ? format(new Date(row.date), 'dd.MM.yyyy') : format(new Date(row.date), 'dd.MM.yyyy HH:mm')}</TableCell>
                                        <TableCell className="max-w-[120px]">
                                            <div className="font-medium truncate" title={row.vehicle.plate}>{row.vehicle.plate}</div>
                                            <div className="text-xs text-muted-foreground truncate" title={row.vehicle.brand}>{row.vehicle.brand}</div>
                                        </TableCell>

                                        <TableCell className="text-right">
                                            {(row.recordType === 'PURCHASE' || row.recordType === 'BALANCE_START' || row.recordType.startsWith('VIRMAN')) ? '-' : (
                                                <>
                                                    {row.mileage.toLocaleString()}
                                                    <span className="text-xs text-muted-foreground ml-1">
                                                        {row.vehicle.meterType === 'HOURS' ? 'Sa' : (row.vehicle.meterType === 'KM' ? 'Km' : row.vehicle.meterType)}
                                                    </span>
                                                </>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {(row.recordType === 'PURCHASE' || row.recordType === 'BALANCE_START' || row.recordType.startsWith('VIRMAN')) ? '-' : (
                                                row.diffKm > 0 ? `+${row.diffKm}` : '-'
                                            )}
                                        </TableCell>
                                        <TableCell className="min-w-[110px] text-right">
                                            <div className="flex flex-col items-end">
                                                <span className={cn("font-bold whitespace-nowrap",
                                                    row.recordType === 'BALANCE_START' ? 'text-blue-700' :
                                                        (row.recordType === 'PURCHASE' || (row.recordType === 'VIRMAN_IN') ? 'text-green-600' : 'text-red-600')
                                                )}>
                                                    {row.recordType === 'BALANCE_START' ? (
                                                        `Devir: ${row.liters.toLocaleString()} Lt`
                                                    ) : (
                                                        <>
                                                            {(row.recordType === 'PURCHASE' || row.recordType === 'VIRMAN_IN') ? '+' : ''}{row.liters.toLocaleString()} Lt
                                                        </>
                                                    )}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {(row.recordType === 'PURCHASE' || row.recordType === 'BALANCE_START' || row.recordType.startsWith('VIRMAN')) ? '-' : (
                                                <div className="flex flex-col items-center">
                                                    {row.consumption > 0 ? (
                                                        <Badge variant={row.consumption > row.lifetimeAvg * 1.2 ? 'destructive' : 'secondary'}>
                                                            {row.consumption.toFixed(2)} {row.vehicle.meterType === 'HOURS' ? 'Lt/Saat' : 'Lt/100km'}
                                                        </Badge>
                                                    ) : '-'}
                                                    {!row.fullTank && row.recordType === 'LOG' && <Badge variant="outline" className="text-[9px] mt-1 w-fit border-amber-500 text-amber-600 bg-amber-50">Full Değil</Badge>}
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {(row.recordType === 'PURCHASE' || row.recordType === 'BALANCE_START' || row.recordType.startsWith('VIRMAN')) ? '-' : (
                                                row.lifetimeAvg > 0 ? (
                                                    <span>{row.lifetimeAvg.toFixed(2)} {row.vehicle.meterType === 'HOURS' ? 'Lt/Saat' : 'Lt/100km'}</span>
                                                ) : '-'
                                            )}
                                        </TableCell>

                                        <TableCell className={cn("font-semibold text-right",
                                            row.cumulativeTotal < 0 ? "text-red-600 font-bold" :
                                                (row.cumulativeTotal > 0 ? "text-green-600 font-bold" : "text-slate-700")
                                        )}>
                                            {row.cumulativeTotal?.toLocaleString()} Lt
                                        </TableCell>
                                        <TableCell className="max-w-[200px]" title={row.description}>
                                            {row.recordType.startsWith('VIRMAN') ? (
                                                <div className="flex flex-col overflow-hidden">
                                                    <span className="font-medium text-slate-800 truncate" title={row.counterpartSiteName}>{row.counterpartSiteName}</span>
                                                    <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                                                        <span className="shrink-0">Virman</span>
                                                        {row.description && <span className="truncate">- {row.description}</span>}
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="truncate block">{row.description || '-'}</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="max-w-[100px] truncate text-sm text-muted-foreground" title={row.sourceName || (users.find((u: any) => u.id === row.filledByUserId)?.name || '-')}>
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
                    </div>

                    {/* Dynamic Summary Footer */}
                    {reportData.length > 0 && (
                        <div className="mt-4 p-4 bg-cyan-50/50 rounded-lg border border-cyan-100 dark:bg-cyan-950/20 dark:border-cyan-900">
                            <div className="flex flex-col gap-2 text-sm">
                                <div className="font-semibold text-slate-700 dark:text-slate-300">
                                    Toplam Alınan Yakıt: <span className="text-slate-900 dark:text-slate-100 font-bold">
                                        {reportData
                                            .filter(r => r.recordType === 'PURCHASE' || r.recordType === 'VIRMAN_IN')
                                            .reduce((acc, curr) => acc + curr.liters, 0)
                                            .toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} LT
                                    </span>
                                </div>
                                <div className="font-semibold text-slate-700 dark:text-slate-300">
                                    Toplam Verilen Yakıt: <span className="text-slate-900 dark:text-slate-100 font-bold">
                                        {reportData
                                            .filter(r => r.recordType === 'LOG' || r.recordType === 'VIRMAN_OUT')
                                            .reduce((acc, curr) => acc + curr.liters, 0)
                                            .toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} LT
                                    </span>
                                </div>
                                <div className="font-semibold text-slate-700 dark:text-slate-300">
                                    Net Kümülatif: <span className={cn("font-bold", reportData[0].cumulativeTotal < 0 ? "text-red-600" : "text-slate-900 dark:text-slate-100")}>
                                        {reportData[0].cumulativeTotal?.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} LT
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                </CardContent >

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
                            <Button variant="outline" onClick={() => setIsEditOpen(false)} disabled={isUpdating}>İptal</Button>
                            <Button onClick={handleUpdate} disabled={isUpdating}>
                                {isUpdating ? 'Güncelleniyor...' : 'Güncelle'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </Card >
        </div >
    );
}
