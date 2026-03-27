'use client';

import { useAppStore } from '@/lib/store/use-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/multi-select';
import { useState, useMemo } from 'react';
import { format, parseISO, isWithinInterval, startOfMonth, endOfMonth } from 'date-fns';

// Helper: safely convert a date field (string | Date) to a Date object
const toDate = (d: any): Date => (d instanceof Date ? d : parseISO(d));
import { FileBarChart, Filter, CheckCircle2, Clock, PauseCircle, Wrench, UserX, CalendarOff, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addTurkishFont } from '@/lib/pdf-font';
import { RentalUpdateDialog } from '@/components/modules/vehicles/RentalUpdateDialog'; // [NEW]
import { Vehicle } from '@/lib/types';

export function VehicleAttendanceReport() {
    const { vehicles, vehicleAttendance, fuelLogs, sites, companies } = useAppStore();

    // Default to current month
    const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
    const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
    const [selectedSiteId, setSelectedSiteId] = useState<string>('');
    const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
    const [hideZeroRental, setHideZeroRental] = useState(true);

    // [NEW] Edit Rental Fee State
    const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
    const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);

    // [NEW] Sort Configuration
    type SortConfigItem = { key: string; direction: 'asc' | 'desc' };
    const [sortConfig, setSortConfig] = useState<SortConfigItem[]>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('vehicleAttendanceReport_sort');
            if (saved) {
                const parsed = JSON.parse(saved);
                return Array.isArray(parsed) ? parsed : [parsed];
            }
        }
        return [{ key: 'companyName', direction: 'asc' }]; // default
    });

    const handleSort = (key: string, event: React.MouseEvent) => {
        setSortConfig(current => {
            let newConfig: SortConfigItem[];

            if (event.shiftKey) {
                // Multi-sort mode
                const existingIndex = current.findIndex(item => item.key === key);
                if (existingIndex >= 0) {
                    // Toggle existing
                    newConfig = current.map((item, index) =>
                        index === existingIndex
                            ? { ...item, direction: item.direction === 'asc' ? 'desc' : 'asc' }
                            : item
                    );
                } else {
                    // Append new
                    newConfig = [...current, { key, direction: 'asc' }];
                }
            } else {
                // Single sort mode (replace everything)
                // If clicking the primary sort key again, toggle it. Otherwise start fresh.
                if (current.length > 0 && current[0].key === key) {
                    newConfig = [{ key, direction: current[0].direction === 'asc' ? 'desc' : 'asc' }];
                } else {
                    newConfig = [{ key, direction: 'asc' }];
                }
            }

            localStorage.setItem('vehicleAttendanceReport_sort', JSON.stringify(newConfig));
            return newConfig;
        });
    };

    const reportData = useMemo(() => {
        // Collect all unique (vehicleId, siteId) pairs involved in the date range
        const relevantSightings = new Set<string>(); // "vehicleId|siteId"

        vehicleAttendance.forEach((a: any) => {
            if (isWithinInterval(toDate(a.date), { start: parseISO(startDate), end: parseISO(endDate) })) {
                relevantSightings.add(`${a.vehicleId}|${a.siteId}`);
            }
        });

        fuelLogs.forEach((f: any) => {
            if (isWithinInterval(toDate(f.date), { start: parseISO(startDate), end: parseISO(endDate) })) {
                relevantSightings.add(`${f.vehicleId}|${f.siteId}`);
            }
        });

        const rows: any[] = [];

        Array.from(relevantSightings).forEach((key: any) => {
            const [vId, sId] = key.split('|');

            // Site Filter
            if (selectedSiteId && sId !== selectedSiteId) return;
            // Vehicle Filter
            if (selectedVehicleIds.length > 0 && !selectedVehicleIds.includes(vId)) return;

            const vehicle = vehicles.find((v: any) => v.id === vId);
            if (!vehicle || vehicle.status !== 'ACTIVE') return;

            // Company Filter
            if (selectedCompanyIds.length > 0) {
                if (vehicle.ownership === 'RENTAL') {
                    if (!vehicle.rentalCompanyName || !selectedCompanyIds.includes(`RENTAL_${vehicle.rentalCompanyName}`)) return;
                } else {
                    if (!vehicle.companyId || !selectedCompanyIds.includes(vehicle.companyId)) return;
                }
            }

            // Records for this specific Site + Vehicle
            const siteAttendance = vehicleAttendance.filter((a: any) =>
                a.vehicleId === vId &&
                a.siteId === sId &&
                isWithinInterval(toDate(a.date), { start: parseISO(startDate), end: parseISO(endDate) })
            );

            const siteFuel = fuelLogs.filter((f: any) =>
                f.vehicleId === vId &&
                f.siteId === sId &&
                isWithinInterval(toDate(f.date), { start: parseISO(startDate), end: parseISO(endDate) })
            );

            let workDays = 0;
            let halfDays = 0;
            let idleDays = 0;
            let repairDays = 0;
            let noOperatorDays = 0;
            let holidayDays = 0;

            siteAttendance.forEach((r: any) => {
                if (r.status === 'WORK') workDays++;
                if (r.status === 'HALF_DAY') halfDays++;
                if (r.status === 'IDLE') idleDays++;
                if (r.status === 'REPAIR') repairDays++;
                if (r.status === 'NO_OPERATOR') noOperatorDays++;
                if (r.status === 'HOLIDAY') holidayDays++;
            });

            const totalFuel = siteFuel.reduce((sum: any, log: any) => sum + Number(log.liters), 0);
            const totalWorkedDays = workDays + (halfDays * 0.5);

            // Rental Cost Calculation (Pro-rated for days worked AT THIS SOURCE)
            let totalRentalCost = 0;
            if (vehicle.monthlyRentalFee && vehicle.monthlyRentalFee > 0) {
                totalRentalCost = (vehicle.monthlyRentalFee / 30) * totalWorkedDays;
            }

            // Site Name
            const site = sites.find((s: any) => s.id === sId);
            if (!site || site.status === 'INACTIVE') return; // [MOD] Filter Passive Sites
            const siteName = site?.name || 'Bilinmeyen Şantiye';

            // Company Name
            let companyName = '-';
            if (vehicle.ownership === 'RENTAL') {
                companyName = vehicle.rentalCompanyName || '-';
            } else {
                const c = companies.find((comp: any) => comp.id === vehicle.companyId);
                companyName = c?.name || '-';
            }

            rows.push({
                id: `${vId}-${sId}`, // unique key for table
                vehicle,
                siteName,
                companyName,
                workDays,
                halfDays,
                idleDays,
                repairDays,
                noOperatorDays,
                holidayDays,
                totalWorkedDays,
                totalFuel,
                totalRentalCost,
                monthlyRentalFee: vehicle.monthlyRentalFee || 0
            });
        });

        // Filter out zero-day rows if toggle is active
        const filtered = hideZeroRental ? rows.filter(r => r.totalRentalCost > 0) : rows;

        // Sort based on configuration
        return filtered.sort((a: any, b: any) => {
            for (const sortItem of sortConfig) {
                let comparison = 0;
                if (sortItem.key === 'siteName') {
                    comparison = a.siteName.localeCompare(b.siteName);
                } else if (sortItem.key === 'companyName') {
                    comparison = a.companyName.localeCompare(b.companyName);
                }

                if (comparison !== 0) {
                    return sortItem.direction === 'asc' ? comparison : -comparison;
                }
            }

            // Secondary sort: Plate (always ASC for stability)
            return a.vehicle.plate.localeCompare(b.vehicle.plate);
        });
    }, [vehicles, vehicleAttendance, fuelLogs, startDate, endDate, selectedSiteId, selectedVehicleIds, selectedCompanyIds, companies, sites, sortConfig, hideZeroRental]);

    const totals = useMemo(() => {
        return reportData.reduce((acc: any, row: any) => ({
            totalFuel: acc.totalFuel + row.totalFuel,
            totalWorkedDays: acc.totalWorkedDays + row.totalWorkedDays,
            totalRentalCost: acc.totalRentalCost + row.totalRentalCost
        }), { totalFuel: 0, totalWorkedDays: 0, totalRentalCost: 0 });
    }, [reportData]);

    const companySelectOptions = useMemo(() => {
        const activeCompanyIds = new Set<string>();
        const rentalNames = new Set<string>();

        vehicles.forEach((v: any) => {
            if (v.status === 'ACTIVE') {
                if (v.ownership === 'RENTAL' && v.rentalCompanyName) {
                    rentalNames.add(v.rentalCompanyName);
                } else if (v.ownership === 'OWNED' && v.companyId) {
                    activeCompanyIds.add(v.companyId);
                }
            }
        });

        const base = companies
            .filter((c: any) => activeCompanyIds.has(c.id))
            .map((c: any) => ({ label: c.name, value: c.id }));

        const rentals = Array.from(rentalNames).map(name => ({ label: name, value: `RENTAL_${name}` }));
        
        // Remove duplicates by label (in case a company is both in companies table and typed as rental)
        const uniqueOptionsMap = new Map();
        [...base, ...rentals].forEach(opt => {
            if (!uniqueOptionsMap.has(opt.label)) {
                uniqueOptionsMap.set(opt.label, opt);
            }
        });

        return Array.from(uniqueOptionsMap.values()).sort((a, b) => a.label.localeCompare(b.label));
    }, [companies, vehicles]);

    const handleExport = () => {
        const data = reportData.map((d: any, index: any) => ({
            'Sıra No': index + 1,
            'Şantiye': d.siteName,
            'Araç Sahibi Firma': d.companyName,
            'Plaka': d.vehicle.plate,
            'Marka/Model': `${d.vehicle.brand} / ${d.vehicle.model}`,
            'Aylık Kira Bedeli': d.monthlyRentalFee > 0 ? d.monthlyRentalFee.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) : '-',
            'Toplam Aldığı Yakıt (Lt)': d.totalFuel,
            'Çalıştı': d.workDays,
            'Yarım Gün': d.halfDays,
            'Yattı': d.idleDays,
            'Arızalı': d.repairDays,
            'Operatör Yok': d.noOperatorDays,
            'Tatil': d.holidayDays,
            'Toplam Çalıştığı Gün': d.totalWorkedDays,
            'Toplam Kira Bedeli': d.totalRentalCost > 0 ? d.totalRentalCost.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'
        }));

        // Add Total Row
        data.push({
            'Sıra No': '',
            'Şantiye': 'GENEL TOPLAM',
            'Araç Sahibi Firma': '',
            'Plaka': '',
            'Marka/Model': '',
            'Aylık Kira Bedeli': '',
            'Toplam Aldığı Yakıt (Lt)': totals.totalFuel,
            'Çalıştı': 0, // Placeholder
            'Yarım Gün': 0, // Placeholder
            'Yattı': 0,
            'Arızalı': 0,
            'Operatör Yok': 0,
            'Tatil': 0,
            'Toplam Çalıştığı Gün': totals.totalWorkedDays,
            'Toplam Kira Bedeli': totals.totalRentalCost.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        } as any);

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Ozet Rapor");
        XLSX.writeFile(wb, `Ozet_Rapor_${startDate}_${endDate}.xlsx`);
    };

    const handleExportPDF = () => {
        const doc = new jsPDF('l', 'mm', 'a4'); // Landscape for more space

        // Add Turkish Font
        const fontName = addTurkishFont(doc);
        doc.setFont(fontName);

        doc.setFontSize(14);
        doc.text(`Puantaj ve Yakıt Özet Raporu (${startDate} - ${endDate})`, 14, 15);

        const tableColumn = [
            "#", "Şantiye", "Firma", "Plaka", "Marka/Model", "Aylık Bedel",
            "Top. Yakıt", "Ç", "Y", "Yat", "Arz", "OpY", "Tat",
            "Top. Gün", "Top. Kira"
        ];

        const tableRows = reportData.map((d: any, i: any) => [
            (i + 1).toString(),
            d.siteName,
            d.companyName,
            d.vehicle.plate,
            `${d.vehicle.brand} / ${d.vehicle.model}`,
            d.monthlyRentalFee > 0 ? d.monthlyRentalFee.toLocaleString('tr-TR', { maximumFractionDigits: 0 }) : '-',
            `${d.totalFuel.toLocaleString()} Lt`,
            d.workDays, d.halfDays, d.idleDays, d.repairDays, d.noOperatorDays, d.holidayDays,
            d.totalWorkedDays.toString(),
            d.totalRentalCost > 0 ? `${d.totalRentalCost.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺` : '-'
        ]);

        // Add Total Row
        tableRows.push([
            "",
            "GENEL TOPLAM",
            "", "", "", "",
            `${totals.totalFuel.toLocaleString()} Lt`,
            "", "", "", "", "", "",
            totals.totalWorkedDays.toString(),
            `${totals.totalRentalCost.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺`
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 20,
            styles: {
                fontSize: 8,
                cellPadding: 1,
                font: fontName,
                halign: 'center',
                valign: 'middle'
            },
            headStyles: { fillColor: [41, 128, 185], fontSize: 7 },
            columnStyles: {
                0: { cellWidth: 8 }, // #
                1: { cellWidth: 25 }, // Site
                2: { cellWidth: 25 }, // Company
                3: { cellWidth: 20 }, // Plate
                4: { cellWidth: 30 }, // Brand
                // ... others auto
            }
        });

        doc.save(`Ozet_Rapor_${startDate}_${endDate}.pdf`);
    };

    const typeMap: Record<string, string> = {
        TRUCK: 'Kamyon / Tır',
        CAR: 'Binek Araç',
        EXCAVATOR: 'İş Makinesi',
        OTHER: 'Diğer'
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <CardTitle className="flex items-center gap-2">
                        <FileBarChart className="w-6 h-6" />
                        Puantaj ve Yakıt Özet Raporu
                    </CardTitle>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleExport}>
                            Excel'e Aktar
                        </Button>
                        <Button variant="outline" onClick={handleExportPDF}>
                            PDF'e Aktar
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6 p-4 bg-muted/20 rounded-lg">
                    <div className="space-y-2">
                        <Label>Başlangıç Tarihi</Label>
                        <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>Bitiş Tarihi</Label>
                        <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>

                    <div className="space-y-2">
                        <Label>Araç Sahibi Firma</Label>
                        <MultiSelect
                            options={companySelectOptions}
                            selected={selectedCompanyIds}
                            onChange={setSelectedCompanyIds}
                            placeholder="Tüm Firmalar"
                            searchPlaceholder="Firma Ara..."
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Şantiye Filtresi</Label>
                        <Select value={selectedSiteId} onValueChange={(val) => setSelectedSiteId(val === 'all' ? '' : val)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Tüm Şantiyeler" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tüm Şantiyeler</SelectItem>
                                {sites.filter((s: any) => s.status === 'ACTIVE').map((s: any) => (
                                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Araç Filtresi</Label>
                        <MultiSelect
                            options={vehicles.filter((v: any) => v.status === 'ACTIVE').map((v: any) => ({ label: `${v.plate} (${typeMap[v.type] || v.type})`, value: v.id }))}
                            selected={selectedVehicleIds}
                            onChange={setSelectedVehicleIds}
                            placeholder="Tüm Araçlar"
                            searchPlaceholder="Araç Ara..."
                        />
                    </div>
                    <div className="flex items-end">
                        <Button
                            variant={hideZeroRental ? 'default' : 'outline'}
                            size="sm"
                            className="w-full"
                            onClick={() => setHideZeroRental(!hideZeroRental)}
                        >
                            {hideZeroRental ? 'Tümünü Göster' : 'Kira Bedeli 0 Olanları Gizle'}
                        </Button>
                    </div>
                </div>

                <div className="rounded-md border overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-8">#</TableHead>
                                <TableHead
                                    className="cursor-pointer hover:bg-slate-100"
                                    onClick={(e) => handleSort('siteName', e)}
                                >
                                    <div className="flex items-center gap-1">
                                        Şantiye
                                        {(() => {
                                            const sortItem = sortConfig.find((sc: any) => sc.key === 'siteName');
                                            if (sortItem) {
                                                return (
                                                    <div className="flex items-center">
                                                        {sortItem.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                                                        {sortConfig.length > 1 && <span className="text-[10px] ml-0.5 text-muted-foreground">{sortConfig.indexOf(sortItem) + 1}</span>}
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })()}
                                    </div>
                                </TableHead>
                                <TableHead
                                    className="cursor-pointer hover:bg-slate-100"
                                    onClick={(e) => handleSort('companyName', e)}
                                >
                                    <div className="flex items-center gap-1">
                                        Araç Sahibi Firma
                                        {(() => {
                                            const sortItem = sortConfig.find((sc: any) => sc.key === 'companyName');
                                            if (sortItem) {
                                                return (
                                                    <div className="flex items-center">
                                                        {sortItem.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                                                        {sortConfig.length > 1 && <span className="text-[10px] ml-0.5 text-muted-foreground">{sortConfig.indexOf(sortItem) + 1}</span>}
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })()}
                                    </div>
                                </TableHead>
                                <TableHead>Plaka</TableHead>
                                <TableHead>Marka / Model</TableHead>
                                <TableHead className="text-right">Aylık Kira Bedeli</TableHead>
                                <TableHead className="text-right font-bold border-r">Top. Yakıt</TableHead>

                                <TableHead className="text-center w-8 px-1" title="Çalıştı">
                                    <CheckCircle2 className="w-4 h-4 mx-auto text-green-600" />
                                </TableHead>
                                <TableHead className="text-center w-8 px-1" title="Yarım Gün">
                                    <Clock className="w-4 h-4 mx-auto text-blue-500" />
                                </TableHead>
                                <TableHead className="text-center w-8 px-1" title="Çalışmadı (Yattı)">
                                    <PauseCircle className="w-4 h-4 mx-auto text-yellow-500" />
                                </TableHead>
                                <TableHead className="text-center w-8 px-1" title="Arızalı">
                                    <Wrench className="w-4 h-4 mx-auto text-red-500" />
                                </TableHead>
                                <TableHead className="text-center w-8 px-1" title="Operatör Yok">
                                    <UserX className="w-4 h-4 mx-auto text-orange-500" />
                                </TableHead>
                                <TableHead className="text-center w-8 px-1 border-r" title="Tatil">
                                    <CalendarOff className="w-4 h-4 mx-auto text-purple-500" />
                                </TableHead>

                                <TableHead className="text-center font-bold">Top. Çalıştığı Gün</TableHead>
                                <TableHead className="text-right font-bold">Top. Kira Bedeli</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reportData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={15} className="text-center h-24 text-muted-foreground">
                                        Kriterlere uygun kayıt bulunamadı.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                <>
                                    {reportData.map((row: any, index: any) => (
                                        <TableRow key={row.id}>
                                            <TableCell className="font-medium text-slate-500 text-xs">
                                                {index + 1}
                                            </TableCell>
                                            <TableCell className="font-medium text-slate-700 text-xs max-w-[150px] truncate" title={row.siteName}>
                                                {row.siteName}
                                            </TableCell>
                                            <TableCell className="text-slate-600 text-xs max-w-[150px] truncate" title={row.companyName}>
                                                {row.companyName}
                                            </TableCell>
                                            <TableCell className="font-bold font-mono text-xs">
                                                {row.vehicle.plate}
                                            </TableCell>
                                            <TableCell className="text-xs">{row.vehicle.brand} / {row.vehicle.model}</TableCell>
                                            <TableCell className="text-right font-mono text-slate-600 text-xs">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 px-2 text-xs font-mono hover:bg-slate-200"
                                                    onClick={() => {
                                                        setEditingVehicle(row.vehicle);
                                                        setIsUpdateDialogOpen(true);
                                                    }}
                                                    title="Mevcut Kira Bedelini Güncelle"
                                                >
                                                    {row.monthlyRentalFee > 0 ? row.monthlyRentalFee.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) : '-'}
                                                </Button>
                                            </TableCell>
                                            <TableCell className="text-right font-bold font-mono text-xs border-r">
                                                {row.totalFuel > 0 ? `${row.totalFuel.toLocaleString()} Lt` : '-'}
                                            </TableCell>

                                            {/* Breakdown Columns */}
                                            <TableCell className="text-center text-xs p-1">{row.workDays > 0 ? row.workDays : '-'}</TableCell>
                                            <TableCell className="text-center text-xs p-1">{row.halfDays > 0 ? row.halfDays : '-'}</TableCell>
                                            <TableCell className="text-center text-xs p-1">{row.idleDays > 0 ? row.idleDays : '-'}</TableCell>
                                            <TableCell className="text-center text-xs p-1">{row.repairDays > 0 ? row.repairDays : '-'}</TableCell>
                                            <TableCell className="text-center text-xs p-1">{row.noOperatorDays > 0 ? row.noOperatorDays : '-'}</TableCell>
                                            <TableCell className="text-center text-xs p-1 border-r">{row.holidayDays > 0 ? row.holidayDays : '-'}</TableCell>

                                            <TableCell className="text-center font-bold text-blue-700 bg-blue-50/50 text-xs">
                                                {row.totalWorkedDays > 0 ? row.totalWorkedDays : '-'}
                                            </TableCell>
                                            <TableCell className="text-right font-mono font-medium text-slate-700 text-xs">
                                                {row.totalRentalCost > 0 ? `${row.totalRentalCost.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺` : '-'}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {/* GRAND TOTAL ROW */}
                                    <TableRow className="bg-slate-100 hover:bg-slate-100 font-bold border-t-2 border-slate-300">
                                        <TableCell colSpan={6} className="text-right text-sm">GENEL TOPLAM</TableCell>
                                        <TableCell className="text-right text-xs font-bold border-r border-slate-300">{totals.totalFuel.toLocaleString()} Lt</TableCell>
                                        <TableCell colSpan={6} className="border-r border-slate-300"></TableCell>
                                        <TableCell className="text-center text-xs font-bold text-blue-800">{totals.totalWorkedDays}</TableCell>
                                        <TableCell className="text-right text-xs font-bold text-slate-900">{totals.totalRentalCost.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</TableCell>
                                    </TableRow>
                                </>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>

            {/* [NEW] Rental Update Dialog */}
            {
                editingVehicle && (
                    <RentalUpdateDialog
                        vehicle={editingVehicle}
                        open={isUpdateDialogOpen}
                        onOpenChange={setIsUpdateDialogOpen}
                    />
                )
            }
        </Card >
    );
}
