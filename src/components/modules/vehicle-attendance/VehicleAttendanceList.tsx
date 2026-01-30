'use client';

import { useAppStore } from '@/lib/store/use-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, differenceInDays } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
    ChevronLeft, ChevronRight, Truck, CheckCircle2, Clock, PauseCircle, Wrench, UserX, CalendarOff, Fuel, Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addTurkishFont } from '@/lib/pdf-font';
import { useUserSites } from '@/hooks/use-user-access';
import { useAuth } from '@/lib/store/use-auth';
import { useEffect } from 'react';
import { addVehicleAttendance, deleteVehicleAttendance } from '@/actions/vehicle-attendance';


export function VehicleAttendanceList() {
    const { vehicles, vehicleAttendance, addVehicleAttendance: addLocal, deleteVehicleAttendance: deleteLocal, deleteVehicleAttendanceById, fuelLogs } = useAppStore();
    const rawSites = useUserSites();
    const sites = rawSites.filter((s: any) => s.status !== 'INACTIVE');
    const { hasPermission, user } = useAuth(); // [NEW]
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [selectedSiteId, setSelectedSiteId] = useState('');

    // Auto-select if only one site is available
    useEffect(() => {
        if (sites.length === 1 && !selectedSiteId) {
            setSelectedSiteId(sites[0].id);
        }
    }, [sites, selectedSiteId]);
    const [showFuel, setShowFuel] = useState(true);

    // Dialog State
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingCell, setEditingCell] = useState<{ vehicleId: string, date: Date } | null>(null);
    const [status, setStatus] = useState<'WORK' | 'HALF_DAY' | 'IDLE' | 'REPAIR' | 'NO_OPERATOR' | 'HOLIDAY'>('WORK');
    const [note, setNote] = useState('');
    const [isReadOnly, setIsReadOnly] = useState(false); // [NEW] Read-only mode

    const daysInMonth = eachDayOfInterval({
        start: startOfMonth(selectedDate),
        end: endOfMonth(selectedDate),
    });

    const handleCellClick = (vehicleId: string, date: Date) => {
        if (!selectedSiteId) {
            alert('Lütfen önce şantiye seçiniz.');
            return;
        }

        const record = vehicleAttendance.find((a: any) =>
            a.vehicleId === vehicleId &&
            format(new Date(a.date), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
        );

        // Date Restriction Check
        if (user && user.role !== 'ADMIN') {
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Normalize
            const targetDate = new Date(date); // Clone to avoid mutation if any
            targetDate.setHours(0, 0, 0, 0);

            // 1. Future Block
            if (targetDate > today) {
                alert('İleri tarihli puantaj girişi yapamazsınız.');
                return;
            }

            // 2. Backdate / Lookback Check
            if (user.editLookbackDays !== undefined) {
                const diff = differenceInDays(today, targetDate);
                if (diff > user.editLookbackDays) {
                    if (!record) {
                        // Creating New -> BLOCK
                        alert(`Geriye dönük en fazla ${user.editLookbackDays} gün işlem yapabilirsiniz.`);
                        return;
                    }
                    // Editing Existing -> FORCE READ ONLY (Handled below)
                }
            }
        }

        // Check Permissions
        const canCreate = hasPermission('vehicle-attendance.list', 'CREATE');
        const canEdit = hasPermission('vehicle-attendance.list', 'EDIT');

        // Determine readOnly status
        let readOnly = false;
        if (user?.role === 'ADMIN') {
            readOnly = false; // Admin can always edit
        } else if (record) {
            // Existing record
            if (!canEdit) readOnly = true;
            // Check date restriction for editing existing records
            if (user && user.editLookbackDays !== undefined) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const targetDate = new Date(date);
                targetDate.setHours(0, 0, 0, 0);
                const diff = differenceInDays(today, targetDate);
                if (diff > user.editLookbackDays) {
                    readOnly = true; // Force Read Only for old records
                }
            }
        }

        // Open Dialog
        setEditingCell({ vehicleId, date });
        setStatus(record?.status as any || 'WORK');
        setNote(record?.note || '');
        setIsReadOnly(readOnly);
        setIsDialogOpen(true);
    };

    const handleQuickSave = async (newStatus: 'WORK' | 'HALF_DAY' | 'IDLE' | 'REPAIR' | 'NO_OPERATOR' | 'HOLIDAY') => {
        if (!editingCell || !selectedSiteId || isReadOnly) return; // Block save if ReadOnly

        // Check for cross-site conflict
        const targetDateStr = format(editingCell.date, 'yyyy-MM-dd');
        const existingRecord = vehicleAttendance.find((a: any) =>
            a.vehicleId === editingCell.vehicleId &&
            format(new Date(a.date), 'yyyy-MM-dd') === targetDateStr
        );

        if (existingRecord && existingRecord.siteId !== selectedSiteId) {
            const otherSite = sites.find((s: any) => s.id === existingRecord.siteId)?.name || 'Bilinmeyen Şantiye';
            alert(`Bu araç için ${targetDateStr} tarihinde "${otherSite}" şantiyesinde zaten puantaj girilmiş. Farklı şantiyelerde aynı gün işlem yapılamaz.`);
            return;
        }

        const tempId = `temp-${Date.now()}`;
        const optimisticPayload = {
            id: tempId,
            vehicleId: editingCell.vehicleId,
            siteId: selectedSiteId,
            date: new Date(targetDateStr), // Use Date object locally to match component expectations
            status: newStatus,
            hours: 8,
            createdByUserId: user?.id
        };

        // 1. Optimistic Update (Prepend to mask existing)
        addLocal(optimisticPayload as any);
        setIsDialogOpen(false); // Close immediately

        const payload = {
            vehicleId: editingCell.vehicleId,
            siteId: selectedSiteId,
            date: new Date(targetDateStr), // [FIX] Pass Date object
            status: newStatus,
            hours: 8, // default
            createdByUserId: user?.id
        };

        try {
            const res = await addVehicleAttendance(payload);

            // 2. Cleanup Temp
            deleteVehicleAttendanceById(tempId);

            if (res.success && res.data) {
                // 3. Replace with Real
                addLocal(res.data as any);
            } else {
                // Error: Temp already removed, so we reverted to old state (if any)
                alert(res.error || 'Kaydedilemedi');
                // Optional: Re-open dialog?
            }
        } catch (error) {
            deleteVehicleAttendanceById(tempId);
            console.error(error);
            alert('Bir hatayla karşılaşıldı.');
        }
    };

    const handleDelete = async () => {
        if (!editingCell || isReadOnly) return;
        if (confirm('Bu puantaj kaydını silmek istediğinize emin misiniz?')) {
            const dateStr = format(editingCell.date, 'yyyy-MM-dd');
            const res = await deleteVehicleAttendance(editingCell.vehicleId, dateStr);
            if (res.success) {
                deleteLocal(editingCell.vehicleId, dateStr);
            } else {
                alert(res.error || 'Silinemedi');
            }
            setIsDialogOpen(false);
        }
    };

    const getStatusForDate = (vid: string, date: Date) => {
        const targetDate = format(date, 'yyyy-MM-dd');
        return vehicleAttendance.find((a: any) =>
            a.vehicleId === vid &&
            format(new Date(a.date), 'yyyy-MM-dd') === targetDate
        );
    };

    const getStatusBadge = (status: string) => {
        const IconWrapper = ({ icon: Icon, color, title }: { icon: any, color: string, title?: string }) => (
            <div className="flex items-center justify-center w-full h-full" title={title}>
                <Icon className={cn("w-5 h-5", color)} />
            </div>
        );

        switch (status) {
            case 'WORK': return <IconWrapper icon={CheckCircle2} color="text-green-600" title="Çalıştı" />;
            case 'HALF_DAY': return <IconWrapper icon={Clock} color="text-blue-500" title="Yarım Gün" />;
            case 'IDLE': return <IconWrapper icon={PauseCircle} color="text-yellow-500" title="Çalışmadı (Yattı)" />;
            case 'REPAIR': return <IconWrapper icon={Wrench} color="text-red-500" title="Arızalı" />;
            case 'NO_OPERATOR': return <IconWrapper icon={UserX} color="text-orange-500" title="Operatör Yok" />;
            case 'HOLIDAY': return <IconWrapper icon={CalendarOff} color="text-purple-500" title="Tatil" />;
            default: return null;
        }
    };

    // Filter vehicles by status (Active only) AND Assigned Site
    const activeVehicles = vehicles.filter((v: any) =>
        v.status === 'ACTIVE' &&
        (
            (v.assignedSiteIds && v.assignedSiteIds.includes(selectedSiteId)) ||
            v.assignedSiteId === selectedSiteId
        )
    );

    // Export Logic
    const handleExportExcel = () => {
        if (!selectedSiteId) return;
        const siteName = sites.find((s: any) => s.id === selectedSiteId)?.name || 'Santiye';
        const monthStr = format(selectedDate, 'MMMM yyyy', { locale: tr });

        const data = activeVehicles.map((v: any) => {
            const row: any = {
                'Plaka': v.plate,
                'Cinsi': v.definition || v.type
            };

            let totalWorked = 0;

            daysInMonth.forEach((day: any) => {
                const dateStr = format(day, 'dd'); // Column header as day number
                const record = getStatusForDate(v.id, day);

                let cellValue = '';
                if (record && record.siteId === selectedSiteId) {
                    switch (record.status) {
                        case 'WORK': cellValue = '✅'; totalWorked += 1; break;
                        case 'HALF_DAY': cellValue = '🕒'; totalWorked += 0.5; break;
                        case 'IDLE': cellValue = '⛔'; break;
                        case 'REPAIR': cellValue = '🔧'; break;
                        case 'NO_OPERATOR': cellValue = '👤'; break;
                        case 'HOLIDAY': cellValue = '🏖️'; break;
                    }
                }
                row[dateStr] = cellValue;
            });

            row['Toplam'] = totalWorked;
            return row;
        });

        // Define explicit header order
        const header = ['Plaka', 'Cinsi', ...daysInMonth.map((d: any) => format(d, 'dd')), 'Toplam'];

        const ws = XLSX.utils.json_to_sheet(data, { header });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Araç Puantaj");
        XLSX.writeFile(wb, `${siteName} - ${monthStr} - Araç Puantaj.xlsx`);
    };

    const handleExportPDF = () => {
        if (!selectedSiteId) return;
        const siteName = sites.find((s: any) => s.id === selectedSiteId)?.name || 'Santiye';
        const monthStr = format(selectedDate, 'MMMM yyyy', { locale: tr });

        const doc = new jsPDF('l', 'mm', 'a4');

        // Add Turkish Font
        const fontName = addTurkishFont(doc);
        doc.setFont(fontName);

        doc.setFontSize(14);
        doc.text(`${siteName} - ${monthStr} - Araç Puantajı`, 14, 15);

        const tableColumn = ["Plaka", "Cinsi", ...daysInMonth.map((d: any) => format(d, 'dd')), "Toplam"];
        const tableRows: any[] = [];

        activeVehicles.forEach((v: any) => {
            let totalWorked = 0;
            const rowData = [
                v.plate,
                v.definition || v.type,
                ...daysInMonth.map((day: any) => {
                    const record = getStatusForDate(v.id, day);
                    if (record && record.siteId === selectedSiteId) {
                        if (record.status === 'WORK') totalWorked += 1;
                        if (record.status === 'HALF_DAY') totalWorked += 0.5;
                        return record.status; // Return raw status for processing
                    }
                    return '';
                }),
                totalWorked.toString()
            ];
            tableRows.push(rowData);
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 20,
            styles: {
                fontSize: 6,
                cellPadding: 1,
                font: fontName,
                valign: 'middle',
                halign: 'center',
                lineWidth: 0.1,
                lineColor: [200, 200, 200]
            },
            headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
            didParseCell: (data) => {
                // If it is a day column (index 2 to length)
                if (data.section === 'body' && data.column.index >= 2 && data.column.index < daysInMonth.length + 2) {
                    const status = data.cell.raw as string;
                    // Store status in custom property and clear text
                    (data.cell as any)._status = status;
                    data.cell.text = []; // Hide text
                }
            },
            didDrawCell: (data) => {
                if (data.section === 'body' && (data.cell as any)._status) {
                    const status = (data.cell as any)._status;
                    const { x, y, width, height } = data.cell;
                    const cx = x + width / 2;
                    const cy = y + height / 2;
                    const r = Math.min(width, height) / 3;

                    doc.setDrawColor(0);
                    doc.setLineWidth(0.1);

                    switch (status) {
                        case 'WORK': // CheckCircle2 (Green)
                            doc.setFillColor(22, 163, 74); // green-600
                            doc.circle(cx, cy, r, 'F');
                            doc.setDrawColor(255);
                            doc.setLineWidth(0.5);
                            // Checkmark
                            doc.lines([[r * 0.3, r * 0.3], [r * 0.5, -r * 0.6]], cx - r * 0.4, cy, [1, 1], 'S', true);
                            break;

                        case 'HALF_DAY': // Clock (Blue)
                            doc.setFillColor(59, 130, 246); // blue-500
                            doc.circle(cx, cy, r, 'F');
                            doc.setDrawColor(255);
                            doc.setLineWidth(0.5);
                            // Hands
                            doc.line(cx, cy, cx, cy - r * 0.6);
                            doc.line(cx, cy, cx + r * 0.4, cy);
                            break;

                        case 'IDLE': // PauseCircle (Yellow/Amber)
                            doc.setFillColor(234, 179, 8); // yellow-500
                            doc.circle(cx, cy, r, 'F');
                            doc.setDrawColor(255);
                            doc.setLineWidth(0.8);
                            // Pause bars
                            doc.line(cx - r * 0.2, cy - r * 0.4, cx - r * 0.2, cy + r * 0.4);
                            doc.line(cx + r * 0.2, cy - r * 0.4, cx + r * 0.2, cy + r * 0.4);
                            break;

                        case 'REPAIR': // Wrench (Red)
                            doc.setFillColor(239, 68, 68); // red-500
                            doc.circle(cx, cy, r, 'F');
                            doc.setDrawColor(255);
                            doc.setLineWidth(0.5);
                            // Wrench approximation (Diagonal line + U head)
                            doc.line(cx - r * 0.3, cy + r * 0.3, cx + r * 0.1, cy - r * 0.1); // Handle
                            // Head
                            doc.lines([[r * 0.2, -r * 0.2], [r * 0.1, r * 0.1], [-r * 0.2, r * 0.2]], cx + r * 0.1, cy - r * 0.1, [1, 1], 'S', false);
                            break;

                        case 'NO_OPERATOR': // UserX (Orange)
                            doc.setFillColor(249, 115, 22); // orange-500
                            doc.circle(cx, cy, r, 'F');
                            doc.setDrawColor(255);
                            doc.setLineWidth(0.5);
                            // Simple person head + body arc
                            doc.circle(cx, cy - r * 0.2, r * 0.25, 'S'); // Head
                            doc.setDrawColor(255);
                            // Body Arc (simplified as triangle bottom)
                            doc.line(cx - r * 0.4, cy + r * 0.5, cx, cy + r * 0.1);
                            doc.line(cx + r * 0.4, cy + r * 0.5, cx, cy + r * 0.1);
                            // X overlay seems too busy small, just keep the Person
                            break;

                        case 'HOLIDAY': // CalendarOff (Purple)
                            doc.setFillColor(168, 85, 247); // purple-500
                            doc.circle(cx, cy, r, 'F');
                            doc.setDrawColor(255);
                            doc.setLineWidth(0.5);
                            // Box
                            doc.rect(cx - r * 0.4, cy - r * 0.4, r * 0.8, r * 0.8, 'S');
                            // Slash
                            doc.line(cx - r * 0.4, cy - r * 0.4, cx + r * 0.4, cy + r * 0.4);
                            break;
                    }
                }
            }
        });

        doc.save(`${siteName} - ${monthStr} - Araç Puantaj.pdf`);
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <CardTitle className="flex items-center gap-2">
                            <Truck className="w-6 h-6" />
                            Araç Puantaj Takibi
                        </CardTitle>

                        <div className="flex items-center gap-4">
                            <div className="flex gap-2">
                                <Button
                                    variant={showFuel ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setShowFuel(!showFuel)}
                                    className="gap-2"
                                >
                                    <Fuel className="w-4 h-4" />
                                    {showFuel ? 'Yakıtı Gizle' : 'Yakıtı Göster'}
                                </Button>
                                <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={!selectedSiteId}>
                                    Excel İndir
                                </Button>
                                <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={!selectedSiteId}>
                                    PDF İndir
                                </Button>
                            </div>

                            <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                                <SelectTrigger className="w-[200px]">
                                    <SelectValue placeholder="Şantiye Seçiniz" />
                                </SelectTrigger>
                                <SelectContent>
                                    {sites.filter((s: any) => s.status === 'ACTIVE' && !s.finalAcceptanceDate).map((s: any) => (
                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <div className="flex items-center gap-2 border rounded-md p-1 bg-white">
                                <Button variant="ghost" size="icon" onClick={() => setSelectedDate(subMonths(selectedDate, 1))}>
                                    <ChevronLeft className="w-4 h-4" />
                                </Button>
                                <span className="font-semibold w-32 text-center select-none">
                                    {format(selectedDate, 'MMMM yyyy', { locale: tr })}
                                </span>
                                <Button variant="ghost" size="icon" onClick={() => setSelectedDate(addMonths(selectedDate, 1))}>
                                    <ChevronRight className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {!selectedSiteId ? (
                        <div className="text-center py-10 text-muted-foreground border-2 border-dashed rounded-lg">
                            Puantaj görüntülemek için lütfen bir şantiye seçiniz.
                        </div>
                    ) : (
                        <div className="rounded-md border overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead className="w-[140px] sticky left-0 z-20 bg-slate-100 font-bold border-r shadow-[1px_0_2px_rgba(0,0,0,0.05)]">Araç / Plaka</TableHead>
                                        {/* Cinsi column merged into Plaka */}
                                        {daysInMonth.map((day: any) => (
                                            <TableHead key={day.toISOString()} className="p-0 text-center w-8 min-w-[32px] text-[10px] font-medium border-l">
                                                <div className="flex flex-col items-center justify-center py-1">
                                                    <span>{format(day, 'dd')}</span>
                                                    <span className="text-[9px] opacity-70">{format(day, 'EE', { locale: tr })}</span>
                                                </div>
                                            </TableHead>
                                        ))}
                                        <TableHead className="w-[60px] font-bold border-l bg-slate-100 sticky right-0 z-20 shadow-[-1px_0_2px_rgba(0,0,0,0.05)]">Toplam</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {activeVehicles.map((v: any) => {
                                        let totalWorked = 0;
                                        const typeMap: Record<string, string> = {
                                            CAR: 'Binek Araç',
                                            TRUCK: 'Kamyon',
                                            LORRY: 'Tır',
                                            EXCAVATOR: 'İş Makinesi',
                                            TRACTOR: 'Traktör',
                                            OTHER: 'Diğer'
                                        };
                                        return (
                                            <TableRow key={v.id} className="hover:bg-muted/5">
                                                <TableCell className="sticky left-0 z-10 bg-background border-r p-2 shadow-[1px_0_2px_rgba(0,0,0,0.05)]">
                                                    <div className="flex flex-col w-full">
                                                        <span className="font-bold font-mono text-sm truncate" title={v.plate}>{v.plate}</span>
                                                        <span className="text-[10px] text-muted-foreground line-clamp-1">
                                                            {v.definition || typeMap[v.type] || v.type}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                {/* Cinsi cell removed */}

                                                {daysInMonth.map((day: any) => {
                                                    const record = getStatusForDate(v.id, day);
                                                    // Only show record if it belongs to selected site or if we decide to show all history? 
                                                    // User requested filtering by site for personnel, assuming same for vehicles.
                                                    // But vehicles move. If a vehicle worked at Site A on Day 1, and Site B on Day 2.
                                                    // When looking at Site A, should we see Day 1? Yes.
                                                    // Should we see Day 2? Probably no, or empty.

                                                    // Current logic: getStatusForDate finds ANY record for that vehicle/date.
                                                    // We should filter check if record.siteId === selectedSiteId.

                                                    const isRelevant = record?.siteId === selectedSiteId;
                                                    const displayRecord = isRelevant ? record : null;

                                                    if (displayRecord) {
                                                        if (displayRecord.status === 'WORK') totalWorked += 1;
                                                        if (displayRecord.status === 'HALF_DAY') totalWorked += 0.5;
                                                    }

                                                    // Calculate Fuel for this day
                                                    const dailyFuel = showFuel ? fuelLogs
                                                        .filter((l: any) => l.vehicleId === v.id && l.date === format(day, 'yyyy-MM-dd'))
                                                        .reduce((sum: any, l: any) => sum + Number(l.liters), 0) : 0;

                                                    return (
                                                        <TableCell
                                                            key={day.toISOString()}
                                                            className="p-0 border-l h-10 cursor-pointer hover:bg-slate-100 transition-colors relative"
                                                            onClick={() => handleCellClick(v.id, day)}
                                                        >
                                                            <div className="relative w-full h-full flex items-center justify-center">
                                                                {displayRecord ? getStatusBadge(displayRecord.status) : null}
                                                                {dailyFuel > 0 && (
                                                                    <span className="absolute bottom-0 right-0 text-[8px] leading-3 font-bold bg-yellow-100 text-yellow-800 px-0.5 rounded-tl-sm z-10 border border-yellow-200">
                                                                        {dailyFuel}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                    );
                                                })}
                                                <TableCell className="font-bold text-center border-l bg-muted/10">{totalWorked}</TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
                <div className="px-6 pb-6 mt-[-10px]">
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground border-t pt-4">
                        <div className="flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-green-600" /> Çalıştı</div>
                        <div className="flex items-center gap-1"><Clock className="w-4 h-4 text-blue-500" /> Yarım Gün</div>
                        <div className="flex items-center gap-1"><PauseCircle className="w-4 h-4 text-yellow-500" /> Yattı (Çalışmadı)</div>
                        <div className="flex items-center gap-1"><Wrench className="w-4 h-4 text-red-500" /> Arızalı / Tamirde</div>
                        <div className="flex items-center gap-1"><UserX className="w-4 h-4 text-orange-500" /> Operatör/Şoför Yok</div>
                        <div className="flex items-center gap-1"><CalendarOff className="w-4 h-4 text-purple-500" /> Tatil</div>
                    </div>
                </div>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Durum Güncelle</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        {isReadOnly && (
                            <div className="bg-red-50 text-red-800 p-3 rounded-md text-xs font-medium border border-red-200">
                                Bu kayıt başka bir kullanıcı tarafından oluşturulmuştur. Sadece kaydı oluşturan kişi veya yöneticiler düzenleyebilir.
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label>Durum Seçiniz</Label>
                            <div className="grid grid-cols-2 gap-3 opacity-100 disabled:opacity-50">
                                <Button
                                    variant="outline"
                                    className="h-16 flex flex-col items-center justify-center gap-1 hover:bg-green-50 border-green-200 hover:border-green-500"
                                    onClick={() => handleQuickSave('WORK')}
                                    disabled={isReadOnly}
                                >
                                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                                    <span className="font-medium">Çalıştı</span>
                                </Button>
                                <Button
                                    variant="outline"
                                    className="h-16 flex flex-col items-center justify-center gap-1 hover:bg-blue-50 border-blue-200 hover:border-blue-500"
                                    onClick={() => handleQuickSave('HALF_DAY')}
                                    disabled={isReadOnly}
                                >
                                    <Clock className="w-6 h-6 text-blue-500" />
                                    <span className="font-medium">Yarım Gün</span>
                                </Button>
                                <Button
                                    variant="outline"
                                    className="h-16 flex flex-col items-center justify-center gap-1 hover:bg-yellow-50 border-yellow-200 hover:border-yellow-500"
                                    onClick={() => handleQuickSave('IDLE')}
                                    disabled={isReadOnly}
                                >
                                    <PauseCircle className="w-6 h-6 text-yellow-500" />
                                    <span className="font-medium">Çalışmadı</span>
                                </Button>
                                <Button
                                    variant="outline"
                                    className="h-16 flex flex-col items-center justify-center gap-1 hover:bg-red-50 border-red-200 hover:border-red-500"
                                    onClick={() => handleQuickSave('REPAIR')}
                                    disabled={isReadOnly}
                                >
                                    <Wrench className="w-6 h-6 text-red-500" />
                                    <span className="font-medium">Arızalı</span>
                                </Button>
                                <Button
                                    variant="outline"
                                    className="h-16 flex flex-col items-center justify-center gap-1 hover:bg-orange-50 border-orange-200 hover:border-orange-500"
                                    onClick={() => handleQuickSave('NO_OPERATOR')}
                                    disabled={isReadOnly}
                                >
                                    <UserX className="w-6 h-6 text-orange-500" />
                                    <span className="font-medium text-xs">Operatör Yok</span>
                                </Button>
                                <Button
                                    variant="outline"
                                    className="h-16 flex flex-col items-center justify-center gap-1 hover:bg-purple-50 border-purple-200 hover:border-purple-500"
                                    onClick={() => handleQuickSave('HOLIDAY')}
                                    disabled={isReadOnly}
                                >
                                    <CalendarOff className="w-6 h-6 text-purple-500" />
                                    <span className="font-medium">Tatil</span>
                                </Button>
                            </div>
                        </div>

                        {/* Creator Info */}
                        {(() => {
                            if (!editingCell) return null;
                            const record = getStatusForDate(editingCell.vehicleId, editingCell.date);
                            const creator = record?.createdByUserId ? useAppStore.getState().users.find((u: any) => u.id === record.createdByUserId) : undefined;
                            if (creator) {
                                return (
                                    <div className="text-xs text-muted-foreground">
                                        Kaydı Yapan: <span className="font-medium">{creator.name}</span>
                                    </div>
                                );
                            }
                            return null;
                        })()}
                    </div>
                    <DialogFooter className="sm:justify-between">
                        {!isReadOnly && editingCell && getStatusForDate(editingCell.vehicleId, editingCell.date) ? (
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={handleDelete}
                            >
                                <Trash2 className="w-4 h-4 mr-2" /> Kaydı Sil
                            </Button>
                        ) : <div></div>}
                        <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>
                            {isReadOnly ? 'Kapat' : 'İptal'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
