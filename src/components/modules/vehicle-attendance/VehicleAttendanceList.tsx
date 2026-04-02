'use client';

import { useAppStore } from '@/lib/store/use-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, differenceInDays, subDays, addDays } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    ChevronLeft, ChevronRight, Truck, CheckCircle2, Clock, PauseCircle, Wrench, UserX, CalendarOff, Fuel, Trash2, FileSpreadsheet, Download
} from 'lucide-react';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addTurkishFont } from '@/lib/pdf-font';
import { useUserSites } from '@/hooks/use-user-access';
import { useAuth } from '@/lib/store/use-auth';
import { useEffect } from 'react';
import { deleteVehicleAttendance, getVehicleAttendanceList, getSitesWithVehicleActivity } from '@/actions/vehicle-attendance';
import { getVehicleAssignmentHistory } from '@/actions/vehicle';
import { VehicleForm } from '@/components/modules/vehicles/VehicleForm';


export function VehicleAttendanceList() {
    const { vehicles, vehicleAttendance, addVehicleAttendance: addLocal, setVehicleAttendance, deleteVehicleAttendance: deleteLocal, deleteVehicleAttendanceById, fuelLogs } = useAppStore();
    const rawSites = useUserSites();
    const sites = rawSites.filter((s: any) => s.status !== 'INACTIVE');
    const { hasPermission, user } = useAuth(); // [NEW]
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [selectedSiteId, setSelectedSiteId] = useState('');
    const [sitesWithActivity, setSitesWithActivity] = useState<string[]>([]);

    useEffect(() => {
        const fetchSitesWithActivity = async () => {
            const start = startOfMonth(selectedDate);
            const end = endOfMonth(selectedDate);
            const res = await getSitesWithVehicleActivity(start, end);
            if (res.success && Array.isArray(res.data)) {
                setSitesWithActivity(res.data);
            }
        };
        fetchSitesWithActivity();
    }, [selectedDate]);

    // Auto-select if only one site is available
    useEffect(() => {
        if (sites.length === 1 && !selectedSiteId) {
            setSelectedSiteId(sites[0].id);
        }
    }, [sites, selectedSiteId]);
    const [showFuel, setShowFuel] = useState(true);
    const [assignmentHistory, setAssignmentHistory] = useState<any[]>([]);

    useEffect(() => {
        if (!selectedSiteId) return;

        const fetchAttendance = async () => {
            // Pad the range to ensure we cover timezone shifts (e.g. UTC midnight vs Local midnight)
            const start = subDays(startOfMonth(selectedDate), 1);
            const end = addDays(endOfMonth(selectedDate), 1);

            console.log('Client: Fetching Attendance for range:', {
                start: start.toISOString(),
                end: end.toISOString(),
                siteId: selectedSiteId
            });

            // New return signature: { success, data, logs }
            const result = await getVehicleAttendanceList(selectedSiteId, start, end);

            if (result.success && Array.isArray(result.data)) {
                setVehicleAttendance(result.data as any);
            } else {
                console.error('Client: Failed to load attendance', result.error);
            }

            // Also fetch history for validation
            const historyRes = await getVehicleAssignmentHistory(selectedSiteId, start, end);
            if (historyRes.success) {
                setAssignmentHistory(historyRes.data || []);
            }
        };

        fetchAttendance();
    }, [selectedSiteId, selectedDate, setVehicleAttendance]);

    // Dialog State
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingCell, setEditingCell] = useState<{ vehicleId: string, date: Date } | null>(null);
    const [status, setStatus] = useState<'WORK' | 'HALF_DAY' | 'IDLE' | 'REPAIR' | 'NO_OPERATOR' | 'HOLIDAY'>('WORK');
    const [note, setNote] = useState('');
    const [isReadOnly, setIsReadOnly] = useState(false); // [NEW] Read-only mode
    const [hoveredData, setHoveredData] = useState<{ x: number, y: number, record: any } | null>(null);

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

            // [DEBUG] Log Date Check
            console.log('Client: Date Check', {
                today: format(today, 'yyyy-MM-dd HH:mm'),
                target: format(targetDate, 'yyyy-MM-dd HH:mm'),
                isFuture: targetDate > today,
                lookbackDays: user.editLookbackDays,
                diff: user.editLookbackDays !== undefined ? differenceInDays(today, targetDate) : 'N/A'
            });

            // 1. Future Block
            if (targetDate > today) {
                alert('İleri tarihli puantaj girişi yapamazsınız.');
                return;
            }

            // 2. Backdate / Lookback Check
            if (user.editLookbackDays !== undefined) {
                const diff = differenceInDays(today, targetDate);
                // Allow today (diff=0) if editLookbackDays is 0. 
                // diff is positive if target is in past.
                if (diff > user.editLookbackDays) {
                    if (!record) {
                        // Creating New -> BLOCK
                        const msg = user.editLookbackDays === 0
                            ? `Sadece bugüne işlem yapabilirsiniz. (Debug: GünFarkı=${diff}, Limit=${user.editLookbackDays})`
                            : `Geriye dönük en fazla ${user.editLookbackDays} gün işlem yapabilirsiniz. (Debug: GünFarkı=${diff}, Limit=${user.editLookbackDays})`;
                        alert(msg);
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
        if (!editingCell || !selectedSiteId || isReadOnly) return;

        // [NEW] Mandatory note for specific statuses
        const requiresNote = ['IDLE', 'REPAIR', 'NO_OPERATOR'].includes(newStatus);
        if (requiresNote && !note.trim()) {
            alert('Bu durum için açıklama/not girilmesi zorunludur.');
            return;
        }

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
            date: new Date(targetDateStr),
            status: newStatus,
            hours: 8,
            note: note.trim() || null,
            createdByUserId: user?.id
        };

        // 1. Optimistic Update
        addLocal(optimisticPayload as any);
        setIsDialogOpen(false);
        setNote('');

        const [y, m, d] = targetDateStr.split('-').map(Number);
        const utcDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

        const payload = {
            vehicleId: editingCell.vehicleId,
            siteId: selectedSiteId,
            date: utcDate.toISOString(),
            status: newStatus,
            hours: 8,
            note: note.trim() || null,
            createdByUserId: user?.id,
            forceUpdate: true // Always allow update from UI — user explicitly clicked and chose a status
        };

        try {
            const response = await fetch('/api/vehicle-attendance/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const res = await response.json();

            // 2. Cleanup Temp
            deleteVehicleAttendanceById(tempId);

            if (res?.success && res?.data) {
                // 3. Replace with Real
                addLocal(res.data as any);
            } else {
                console.error('Vehicle attendance save failed:', res?.error);
                alert('Kayıt başarısız: ' + (res?.error || 'Sunucudan yanıt alınamadı'));
            }
        } catch (error) {
            deleteVehicleAttendanceById(tempId);
            const errMsg = error instanceof Error ? error.message : String(error);
            console.error('Vehicle attendance save error:', error);
            alert('Sunucu hatası: ' + errMsg);
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

    // [DEBUG] Log the attendance data we have for the current view
    useEffect(() => {
        if (vehicleAttendance.length > 0) {
            console.log('Client: Current Attendance Data (Sample):', vehicleAttendance.slice(0, 3));
            console.log('Client: Total Records:', vehicleAttendance.length);

            // Allow debugging specific dates
            const todayStr = format(new Date(), 'yyyy-MM-dd');
            const todayRecords = vehicleAttendance.filter((r: any) => {
                const rDate = new Date(r.date).toISOString().split('T')[0];
                return rDate === todayStr;
            });
            console.log(`Client: Records matching Today (${todayStr}):`, todayRecords);
        }
    }, [vehicleAttendance]);

    const getStatusForDate = (vid: string, date: Date, preferredSiteId?: string, strict: boolean = false) => {
        const targetDateStr = format(date, 'yyyy-MM-dd');

        // Priority: Exact match for this site
        if (preferredSiteId) {
            const siteRecord = vehicleAttendance.find((a: any) =>
                a.vehicleId === vid &&
                format(new Date(a.date), 'yyyy-MM-dd') === targetDateStr &&
                a.siteId === preferredSiteId
            );
            if (siteRecord) return siteRecord;

            // If in strict mode and we didn't find a record for THIS site, don't fallback
            if (strict) return undefined;
        }

        return vehicleAttendance.find((a: any) => {
            if (!a.vehicleId || !a.date) return false;
            try {
                const recordDate = new Date(a.date);
                if (isNaN(recordDate.getTime())) return false;
                const recordDateStr = format(recordDate, 'yyyy-MM-dd');
                return a.vehicleId === vid && recordDateStr === targetDateStr;
            } catch (e) { return false; }
        });
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

    // [NEW] Helper to check if a vehicle was assigned to the selected site on a specific date
    const isAssignedOnDate = (vehicleId: string, date: Date) => {
        // Find histories for this specific vehicle
        const histories = assignmentHistory.filter(h => h.vehicleId === vehicleId);

        // Current assignment check (Relational and Legacy)
        const vehicle = vehicles.find(v => v.id === vehicleId) as any;
        const currentAssignment = (vehicle?.assignedSiteIds && vehicle.assignedSiteIds.includes(selectedSiteId)) ||
            vehicle?.assignedSiteId === selectedSiteId;

        // [FIX] Relaxed Strategy: 
        // If the vehicle is CURRENTLY assigned to this site, allow attendance entry for ANY date.
        // This is safe because the UI already filters the list to only show vehicles 
        // that are assigned or have data in the current month.
        if (currentAssignment) return true;

        // If not currently assigned, check historical records
        const targetStr = format(date, 'yyyy-MM-dd');

        const assignedInHistory = histories.some(h => {
            if (!h.startDate) return true;
            const startStr = format(new Date(h.startDate), 'yyyy-MM-dd');

            // Valid start date
            if (targetStr < startStr) return false;

            // Check end date
            if (h.endDate) {
                const endStr = format(new Date(h.endDate), 'yyyy-MM-dd');
                if (targetStr > endStr) return false;
            }

            return true;
        });

        return assignedInHistory;
    };

    // Filter vehicles by status (Active only) AND Assigned Site
    const activeVehicles = vehicles.filter((v: any) => {
        if (v.status === 'PASSIVE') return false;

        // Strategy: Only show if CURRENTLY assigned to this site OR has DATA in this month for this site

        // 1. Current assignment check (Relational and Legacy)
        const isAssigned = (v.assignedSiteIds && v.assignedSiteIds.includes(selectedSiteId)) ||
            v.assignedSiteId === selectedSiteId;

        // 2. Check for actual data (attendance) in selected month/site
        const hasAttendanceInMonth = vehicleAttendance.some((a: any) => {
            if (a.vehicleId !== v.id || a.siteId !== selectedSiteId) return false;
            try {
                const d = new Date(a.date);
                return d.getMonth() === selectedDate.getMonth() && d.getFullYear() === selectedDate.getFullYear();
            } catch (e) { return false; }
        });

        // Show ONLY if assigned OR has data. 
        // (Removed assignmentHistory check as it might bring up old/wrong vehicles if data is slightly inconsistent)
        return isAssigned || hasAttendanceInMonth;
    });

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
                // Use strict mode for Excel export
                const record = getStatusForDate(v.id, day, selectedSiteId, true);

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

            // Check if they have ANY activity at this site this month
            const hasActivity = Object.values(row).some((val, idx) => idx > 1 && val !== '');
            if (!hasActivity) return;

            row['Toplam'] = totalWorked;
            data.push(row);
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

        const tableColumn = ["Plaka", ...daysInMonth.map((d: any) => format(d, 'dd')), "Toplam"];
        const tableRows: any[] = [];

        activeVehicles.forEach((v: any) => {
            let totalWorked = 0;
            let hasAnyActivity = false;

            const daysData = daysInMonth.map((day: any) => {
                // Use strict mode for PDF export
                const record = getStatusForDate(v.id, day, selectedSiteId, true);
                if (record && record.siteId === selectedSiteId) {
                    if (record.status === 'WORK') totalWorked += 1;
                    if (record.status === 'HALF_DAY') totalWorked += 0.5;
                    hasAnyActivity = true;
                    return record.status;
                }
                return '';
            });

            if (!hasAnyActivity) return; // Skip vehicles that have no records at this site

            const rowData = [
                v.plate,
                v.plate + (v.model ? `\n${v.model}` : ''),
                ...daysData,
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

        // [NEW] Notes Table after main attendance table
        const notesData: any[] = [];
        const statusLabels: Record<string, string> = {
            WORK: 'Çalıştı', HALF_DAY: 'Yarım Gün', IDLE: 'Çalışmadı',
            REPAIR: 'Arızalı', NO_OPERATOR: 'Operatör Yok', HOLIDAY: 'Tatil'
        };

        activeVehicles.forEach((v: any) => {
            daysInMonth.forEach((day: any) => {
                // [MODIFIED] Use strict mode for notes in PDF
                const record = getStatusForDate(v.id, day, selectedSiteId, true);
                if (record && record.siteId === selectedSiteId && record.note) {
                    notesData.push([
                        format(day, 'dd.MM.yyyy'),
                        v.plate,
                        statusLabels[record.status] || record.status,
                        record.note
                    ]);
                }
            });
        });

        if (notesData.length > 0) {
            // @ts-ignore
            let notesY = doc.lastAutoTable.finalY + 10;
            if (notesY > 170) { doc.addPage(); notesY = 15; }

            doc.setFontSize(11);
            doc.setFont(fontName, 'bold');
            doc.text('Notlar', 14, notesY);
            notesY += 2;

            autoTable(doc, {
                startY: notesY,
                head: [['Tarih', 'Plaka', 'Durum', 'Not']],
                body: notesData,
                styles: { fontSize: 7, cellPadding: 2, font: fontName },
                headStyles: { fillColor: [100, 100, 100], textColor: 255, fontStyle: 'bold' },
                columnStyles: {
                    0: { cellWidth: 25 },
                    1: { cellWidth: 30 },
                    2: { cellWidth: 25 },
                    3: { cellWidth: 'auto' }
                },
                theme: 'grid'
            });
        }

        doc.save(`${siteName} - ${monthStr} - Araç Puantaj.pdf`);
    };

    // [DEBUG] Check active vehicles
    useEffect(() => {
        if (activeVehicles.length > 0) {
            console.log('Active Vehicles in Grid:', activeVehicles.map((v: any) => v.plate).join(', '));
            if (vehicleAttendance.length > 0) {
                const firstRecord = vehicleAttendance[0] as any;
                console.log('First Attendance Record Vehicle:', firstRecord.vehicle?.plate || firstRecord.vehicleId);
                const foundInactive = activeVehicles.find((v: any) => v.id === firstRecord.vehicleId);
                console.log('Is First Record Vehicle in Active List?', !!foundInactive);
            }
        }
    }, [activeVehicles, vehicleAttendance]);

    const canExport = hasPermission('vehicle-attendance.list', 'EXPORT') || hasPermission('vehicle-attendance.report', 'EXPORT');

    return (
        <div className="space-y-4 h-full flex flex-col">
            <Card>
                <CardHeader className="px-3 sm:px-6">
                    <div className="flex flex-col gap-3">
                        {/* Row 1: Title + Month Nav + Site Selector */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                                <Truck className="w-5 h-5 sm:w-6 sm:h-6" />
                                Araç Puantaj Takibi
                            </CardTitle>
                            <div className="flex items-center gap-3">
                                {user?.role === 'ADMIN' && (
                                    <div className="flex items-center gap-1 border rounded-md p-1 bg-white">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedDate(subMonths(selectedDate, 1))}>
                                            <ChevronLeft className="w-4 h-4" />
                                        </Button>
                                        <span className="font-semibold w-32 text-center select-none text-sm capitalize">
                                            {format(selectedDate, 'MMMM yyyy', { locale: tr })}
                                        </span>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedDate(addMonths(selectedDate, 1))}>
                                            <ChevronRight className="w-4 h-4" />
                                        </Button>
                                    </div>
                                )}
                                <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                                    <SelectTrigger className="w-full sm:w-[200px]">
                                        <SelectValue placeholder="Şantiye Seçiniz" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {sites.filter((s: any) => {
                                            if (s.status !== 'ACTIVE') return false;
                                            // Check if any vehicle is assigned to this site
                                            const hasVehicles = vehicles.some((v: any) => 
                                                v.assignedSiteId === s.id || 
                                                (v.assignedSiteIds && v.assignedSiteIds.includes(s.id))
                                            );
                                            // Check if there is activity in the selected month
                                            const hasActivity = sitesWithActivity.includes(s.id);
                                            return hasVehicles || hasActivity;
                                        }).map((s: any) => (
                                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Row 3: Action buttons (wrap on mobile) */}
                        <div className="flex flex-wrap items-center gap-2">
                            {canExport && (
                                <>
                                    <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={!selectedSiteId}>
                                        <FileSpreadsheet className="w-4 h-4 mr-1 text-green-600" />
                                        <span className="hidden sm:inline">Excel</span>
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={!selectedSiteId}>
                                        <Download className="w-4 h-4 mr-1 text-red-600" />
                                        <span className="hidden sm:inline">PDF</span>
                                    </Button>
                                </>
                            )}
                            <VehicleForm
                                initialOwnership="RENTAL"
                                defaultSiteId={selectedSiteId}
                                onSuccess={() => { }}
                                customTrigger={
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={!selectedSiteId}
                                        className="gap-1.5 text-xs sm:text-sm"
                                    >
                                        <Truck className="w-4 h-4" />
                                        <span className="hidden sm:inline">Kiralık Araç Ekle</span>
                                        <span className="sm:hidden">Araç Ekle</span>
                                    </Button>
                                }
                            />
                            <Button
                                variant={showFuel ? "default" : "outline"}
                                size="sm"
                                onClick={() => setShowFuel(!showFuel)}
                                className="gap-1.5 text-xs sm:text-sm"
                            >
                                <Fuel className="w-4 h-4" />
                                <span className="hidden sm:inline">{showFuel ? 'Yakıtı Gizle' : 'Yakıtı Göster'}</span>
                                <span className="sm:hidden">Yakıt</span>
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="px-2 sm:px-6">
                    {!selectedSiteId ? (
                        <div className="text-center py-10 text-muted-foreground border-2 border-dashed rounded-lg">
                            Puantaj görüntülemek için lütfen bir şantiye seçiniz.
                        </div>
                    ) : (
                        <div className="rounded-md border overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead className="w-[100px] sm:w-[140px] sticky left-0 z-20 bg-slate-100 font-bold border-r shadow-[1px_0_2px_rgba(0,0,0,0.05)] text-xs sm:text-sm">Araç / Plaka</TableHead>
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
                                                <TableCell className="sticky left-0 z-20 bg-background border-r p-2 shadow-[1px_0_2px_rgba(0,0,0,0.05)]">
                                                    <div className="flex flex-col w-full">
                                                        <span className="font-bold font-mono text-xs sm:text-sm truncate" title={v.plate}>{v.plate}</span>
                                                        {v.model && (
                                                            <span className="text-[10px] font-semibold text-slate-600 line-clamp-1">
                                                                {v.model}
                                                            </span>
                                                        )}
                                                        <span className="text-[9px] text-muted-foreground line-clamp-1 opacity-80">
                                                            {/* {v.definition || typeMap[v.type] || v.type} */}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                {/* Cinsi cell removed */}

                                                {daysInMonth.map((day: any) => {
                                                    const record = getStatusForDate(v.id, day, selectedSiteId);
                                                    const isRelevant = record?.siteId === selectedSiteId;

                                                    // [DEBUG] Check why record is hidden
                                                    if (record && !isRelevant) {
                                                        const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                                                        if (isToday) {
                                                            console.warn('RENDER MISMATCH:', {
                                                                vehicle: v.plate,
                                                                date: day.toISOString(),
                                                                recordSiteId: record.siteId,
                                                                selectedSiteId: selectedSiteId,
                                                                match: record.siteId === selectedSiteId
                                                            });
                                                        }
                                                    }

                                                    const displayRecord = isRelevant ? record : null;

                                                    if (displayRecord) {
                                                        if (displayRecord.status === 'WORK') totalWorked += 1;
                                                        if (displayRecord.status === 'HALF_DAY') totalWorked += 0.5;
                                                    }

                                                    // Calculate Fuel for this day
                                                    const dailyFuel = showFuel ? fuelLogs
                                                        .filter((l: any) => {
                                                            if (l.vehicleId !== v.id) return false;
                                                            if (l.siteId !== selectedSiteId) return false;
                                                            try {
                                                                return format(new Date(l.date), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd');
                                                            } catch (e) { return false; }
                                                        })
                                                        .reduce((sum: any, l: any) => sum + Number(l.liters), 0) : 0;

                                                    // All cells are valid for vehicles in activeVehicles
                                                    // Determine if cell is locked (same logic as personnel attendance)
                                                    let isLocked = false;
                                                    let lockReason = '';

                                                    const isAdmin = user?.role === 'ADMIN';

                                                    if (!isAssignedOnDate(v.id, day) && !displayRecord && !isAdmin) {
                                                        isLocked = true;
                                                        lockReason = 'Araç bu ayda bu tarihte şantiyeye atanmamıştı.';
                                                    } else if (!isAdmin) {
                                                        const today = new Date();
                                                        today.setHours(0, 0, 0, 0);
                                                        const targetDate = new Date(day);
                                                        targetDate.setHours(0, 0, 0, 0);
                                                        // Future block
                                                        if (targetDate > today) {
                                                            isLocked = true;
                                                            lockReason = 'İleri tarihli işlem yapılamaz.';
                                                        }
                                                        // Past lookback block
                                                        if (user?.editLookbackDays !== undefined && !isLocked) {
                                                            const diff = differenceInDays(today, targetDate);
                                                            if (diff > user.editLookbackDays) {
                                                                isLocked = true;
                                                                lockReason = `Geriye dönük izin süresini aştı (${user.editLookbackDays} gün).`;
                                                            }
                                                        }
                                                    }

                                                    return (
                                                        <TableCell
                                                            key={day.toISOString()}
                                                            className={cn(
                                                                "p-0 border-l h-10 transition-colors relative",
                                                                isLocked
                                                                    ? "bg-gray-100 cursor-not-allowed"
                                                                    : "cursor-pointer hover:bg-slate-100",
                                                                (!isAssignedOnDate(v.id, day) && !displayRecord && !isAdmin) ? "opacity-30" : "" // Visual cue that they weren't assigned
                                                            )}
                                                            onClick={() => {
                                                                if (isLocked) {
                                                                    if (lockReason) alert(lockReason);
                                                                    return;
                                                                }
                                                                handleCellClick(v.id, day);
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                if (displayRecord?.note) {
                                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                                    setHoveredData({
                                                                        x: rect.left + rect.width / 2,
                                                                        y: rect.top,
                                                                        record: displayRecord
                                                                    });
                                                                }
                                                            }}
                                                            onMouseLeave={() => setHoveredData(null)}
                                                        >
                                                            <div className="relative w-full h-full flex items-center justify-center">
                                                                {displayRecord?.note && (
                                                                    <div className="absolute top-0 right-0 w-0 h-0 border-l-[6px] border-l-transparent border-t-[6px] border-t-blue-600 z-20" />
                                                                )}
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
                {/* Rich Tooltip Overlay (same style as Personnel Puantaj) */}
                {hoveredData && hoveredData.record?.note && (
                    <div
                        className="fixed z-[100] p-3 rounded-lg shadow-2xl bg-slate-900 text-white text-xs pointer-events-none transform -translate-x-1/2 -translate-y-full mb-2 border border-slate-700 w-max max-w-[250px]"
                        style={{ left: hoveredData.x, top: hoveredData.y - 4 }}
                    >
                        <div className="font-bold text-center mb-1 text-slate-100 text-sm">
                            {hoveredData.record.status === 'WORK' && 'Çalıştı'}
                            {hoveredData.record.status === 'HALF_DAY' && 'Yarım Gün'}
                            {hoveredData.record.status === 'IDLE' && 'Çalışmadı (Yattı)'}
                            {hoveredData.record.status === 'REPAIR' && 'Arızalı'}
                            {hoveredData.record.status === 'NO_OPERATOR' && 'Operatör Yok'}
                            {hoveredData.record.status === 'HOLIDAY' && 'Tatil'}
                        </div>

                        <div className="italic text-white break-words leading-relaxed text-sm font-medium border-t border-slate-700/50 pt-1 mt-1">
                            {hoveredData.record.note}
                        </div>

                        {/* Tooltip Arrow */}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900" />
                    </div>
                )}
                <div className="px-3 sm:px-6 pb-4 sm:pb-6 mt-[-10px]">
                    <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-2 sm:gap-4 text-[10px] sm:text-xs text-muted-foreground border-t pt-3 sm:pt-4">
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
                <DialogContent aria-describedby="dialog-description">
                    <DialogHeader>
                        <DialogTitle>Durum Güncelle</DialogTitle>
                    </DialogHeader>
                    <div id="dialog-description" className="sr-only">
                        Araç puantaj durumu güncelleme formu
                    </div>
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

                        {/* [NEW] Note Input */}
                        <div className="space-y-2">
                            <Label>Not / Açıklama</Label>
                            <Textarea
                                placeholder="Açıklama giriniz... (Arızalı, Çalışmadı, Operatör Yok durumlarında zorunlu)"
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                disabled={isReadOnly}
                                rows={2}
                                className="text-sm"
                            />
                        </div>

                        {/* Creator Info */}
                        <div className="flex flex-col gap-4">
                            {(() => {
                                if (!editingCell) return null;
                                const record = getStatusForDate(editingCell.vehicleId, editingCell.date, selectedSiteId);
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
                    </div>
                    <DialogFooter className="flex flex-row justify-between gap-2 p-4 pt-2 border-t bg-slate-50/50">
                        {!isReadOnly && editingCell && getStatusForDate(editingCell.vehicleId, editingCell.date, selectedSiteId) ? (
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
