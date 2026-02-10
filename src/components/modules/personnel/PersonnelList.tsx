'use client';

import { cn } from '@/lib/utils';

import { useAppStore } from '@/lib/store/use-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PersonnelForm } from './PersonnelForm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, differenceInDays } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'; // [NEW]
import { getPersonnelAttendanceList } from '@/actions/personnel'; // [NEW]
import { useAuth } from '@/lib/store/use-auth';
import { useUserSites } from '@/hooks/use-user-access';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addTurkishFont } from '@/lib/pdf-font';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Sun, CloudRain, CloudSnow, Cloud, MoreHorizontal, FileText, ChevronLeft, ChevronRight,
    CheckCircle2, XCircle, Clock, Umbrella, Stethoscope, Thermometer, Briefcase, Download, Trash2, Pencil
} from 'lucide-react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// [NEW] StatusCell Component using Popover for Tooltip behavior
function StatusCell({ record }: { record: { status: string, overtime?: number, note?: string } }) {
    const [open, setOpen] = useState(false);
    const { status, overtime, note } = record;

    const OvertimeBadge = () => overtime && overtime > 0 ? (
        <span className="absolute bottom-0 right-0 text-[9px] leading-3 font-bold bg-red-100 text-red-700 px-0.5 rounded-tl-sm z-10 border border-red-200">
            +{overtime}
        </span>
    ) : null;

    // [NEW] Note Indicator
    const NoteBadge = () => note ? (
        <span className="absolute top-0 right-0 flex h-2.5 w-2.5 items-center justify-center rounded-bl-md bg-blue-500 text-[6px] text-white z-10 shadow-sm" title="Not Mevcut">
        </span>
    ) : null;

    let Icon: any = null;
    let color = "";
    let title = "";

    switch (status) {
        case 'WORK': Icon = CheckCircle2; color = "text-green-600"; title = "Çalıştı"; break;
        case 'ABSENT': Icon = XCircle; color = "text-red-500"; title = "Gelmedi"; break;
        case 'LEAVE': Icon = Umbrella; color = "text-blue-500"; title = "İzinli"; break;
        case 'SICK': Icon = Thermometer; color = "text-orange-500"; title = "Hasta"; break;
        case 'REPORT': Icon = Stethoscope; color = "text-purple-500"; title = "Raporlu"; break;
        case 'HALF_DAY': Icon = Clock; color = "text-amber-500"; title = "Yarım Gün"; break;
        case 'OUT_DUTY': Icon = Briefcase; color = "text-cyan-600"; title = "Dış Görev"; break;
        default: return null;
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <div
                    className="relative group flex items-center justify-center w-full h-full"
                    onMouseEnter={() => setOpen(true)}
                    onMouseLeave={() => setOpen(false)}
                >
                    <NoteBadge />
                    <OvertimeBadge />
                    {Icon && <Icon className={cn("w-4 h-4", color)} />}
                </div>
            </PopoverTrigger>
            <PopoverContent
                className="w-auto p-3 text-sm bg-slate-900 text-white border-slate-700 shadow-xl z-50 pointer-events-none"
                side="top"
                align="center"
                sideOffset={5}
            >
                <div className="font-semibold mb-1 text-center">{title}</div>
                {overtime ? <div className="text-red-300 font-bold text-center">+{overtime} Saat Mesai</div> : null}
                {note ? (
                    <div className="text-slate-300 italic mt-2 border-t border-slate-700 pt-2 min-w-[200px] max-w-[300px] whitespace-normal">
                        {note}
                    </div>
                ) : null}
            </PopoverContent>
        </Popover>
    );
}

export function PersonnelList() {
    const { personnel, personnelAttendance, addPersonnelAttendance, deletePersonnelAttendance, updatePersonnel, users, deletePersonnel } = useAppStore();
    const { user, hasPermission } = useAuth();
    const availableSites = useUserSites().filter((s: any) => !s.finalAcceptanceDate && !s.provisionalAcceptanceDate);

    // Permission Checks
    const canCreate = hasPermission('personnel', 'CREATE');
    const canEdit = hasPermission('personnel', 'EDIT');

    // Instead of single date, manage Year and Month
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [selectedSiteId, setSelectedSiteId] = useState('');


    // Auto-select if only one site is available
    useEffect(() => {
        if (availableSites.length === 1 && !selectedSiteId) {
            setSelectedSiteId(availableSites[0].id);
        }
    }, [availableSites, selectedSiteId]);

    // [NEW] Client-Side Data Fetching for Attendance
    // This fixes the issue where data is missing after refresh
    // [NEW] Debug State & Fetch Logic
    const [fetchStatus, setFetchStatus] = useState<string>('IDLE');
    const [fetchError, setFetchError] = useState<string>('');

    const fetchAttendance = useCallback(async () => {
        setFetchStatus('LOADING');
        setFetchError('');
        console.log("Starting Client-Side Fetch Sequence...");

        try {
            // [FALLBACK] Fetch Personnel List
            if (personnel.length === 0) {
                console.log("Fetching personnel list client-side (Fallback)...");
                const { getPersonnel } = await import('@/actions/personnel');
                const res = await getPersonnel();
                if (res.success && res.data) {
                    const safePersonnel = res.data.map((p: any) => ({
                        ...p,
                        tcNumber: p.tcNumber || '',
                        profession: p.profession || '',
                        note: p.note || '',
                        phone: p.phone || '',
                        email: p.email || '',
                        address: p.address || '',
                        bankAccount: p.bankAccount || '',
                        iban: p.iban || ''
                    }));
                    useAppStore.setState((state) => ({ personnel: safePersonnel }));
                    console.log("Personnel list fetched:", safePersonnel.length);
                } else {
                    console.error("Personnel fallback fetch failed:", res.error);
                    setFetchError(prev => prev + "Personnel Fetch Failed. ");
                }
            }

            // Fetch Attendance
            if (personnelAttendance.length === 0) {
                console.log("Fetching personnel attendance client-side...");
                const res = await getPersonnelAttendanceList();
                if (res.success && res.data) {
                    const formattedData = res.data.map((item: any) => ({
                        ...item,
                        date: new Date(item.date).toISOString().split('T')[0]
                    }));

                    useAppStore.setState((state) => ({
                        personnelAttendance: formattedData
                    }));
                    console.log("Personnel attendance fetched:", formattedData.length);
                    setFetchStatus('SUCCESS');
                } else {
                    console.error("Attendance fetch failed:", res.error);
                    setFetchStatus('ERROR');
                    setFetchError(prev => prev + (res.error || "Attendance Fetch Failed"));
                }
            } else {
                setFetchStatus('SUCCESS (Cached)');
            }
        } catch (err: any) {
            console.error("Critical Fetch Error:", err);
            setFetchStatus('CRITICAL_ERROR');
            setFetchError(err.message || 'Unknown Error');
        }
    }, [personnel.length, personnelAttendance.length]);

    useEffect(() => {
        console.log("PersonnelList Component MOUNTED - Version 2");
        fetchAttendance();
    }, [fetchAttendance]);




    const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
    const [selectedPersonnelId, setSelectedPersonnelId] = useState('');
    const [modalDate, setModalDate] = useState(''); // Specific date clicked in grid
    const [status, setStatus] = useState<'WORK' | 'LEAVE' | 'SICK' | 'ABSENT' | 'REPORT' | 'HALF_DAY' | 'OUT_DUTY'>('WORK');
    const [weather, setWeather] = useState('SUNNY');
    const [note, setNote] = useState('');
    const [overtime, setOvertime] = useState(0); // [NEW] Overtime state
    const [isReadOnly, setIsReadOnly] = useState(false); // [NEW] Read-only mode

    // Transfer Modal State
    // [NEW] Exit Dialog State Removed (Reverted)
    const [transferModalOpen, setTransferModalOpen] = useState(false);
    const [transferTargetSiteId, setTransferTargetSiteId] = useState('');
    const [personnelToTransfer, setPersonnelToTransfer] = useState<string | null>(null);

    const [editingPersonnelId, setEditingPersonnelId] = useState<string | null>(null); // [NEW] Edit State

    const daysInMonth = useMemo(() => {
        const start = startOfMonth(selectedDate);
        const end = endOfMonth(selectedDate);
        return eachDayOfInterval({ start, end });
    }, [selectedDate]);

    // Filter Personnel by Site (Current Site OR Worked at Site in selected month)
    const filteredPersonnel = useMemo(() => {
        if (!selectedSiteId) return [];
        return personnel.filter((p: any) => {
            // [NEW] Check if left before this month
            if (p.status === 'LEFT' && p.leftDate) {
                const monthStart = format(selectedDate, 'yyyy-MM-01');
                if (p.leftDate < monthStart) return false;
            }

            // [NEW] Check if startDate is in future (relative to month end)
            // Visibility Check: Active in selected month?
            const monthStartStr = format(startOfMonth(selectedDate), 'yyyy-MM-dd');
            const monthEndStr = format(endOfMonth(selectedDate), 'yyyy-MM-dd');

            // 0. Check History for Overlap
            if (p.employmentHistory && p.employmentHistory.length > 0) {
                // Check if any interval [HIRE, EXIT/Now] overlaps with [MonthStart, MonthEnd]
                let hasOverlap = false;
                const sortedHistory = [...p.employmentHistory].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                for (let i = 0; i < sortedHistory.length; i++) {
                    const event = sortedHistory[i];
                    if (event.type === 'HIRE') {
                        const hireDate = event.date;
                        // Find corresponding exit or assume active until next event/now
                        // Actually simple check: HIRE date <= MonthEnd
                        // AND (NextEventDate >= MonthStart OR NoNextEvent)

                        const nextEvent = sortedHistory[i + 1];
                        const endOfPeriod = nextEvent ? nextEvent.date : '9999-12-31';

                        if (hireDate <= monthEndStr && endOfPeriod >= monthStartStr) {
                            hasOverlap = true;
                            break;
                        }
                    }
                }

                // If history exists but no overlap found, purely based on history they shouldn't show?
                // If history exists but no overlap found, they are strictly NOT working in this period.
                // However, we allow showing them ONLY if they have explicit attendance records (anomaly/legacy data).
                if (!hasOverlap) {
                    // Check for attendance existence (Rule 3 logic)
                    const monthPrefix = format(selectedDate, 'yyyy-MM');
                    const hasAttendance = personnelAttendance.some((a: any) =>
                        a.personnelId === p.id &&
                        a.siteId === selectedSiteId &&
                        a.date.startsWith(monthPrefix)
                    );

                    if (!hasAttendance) return false;
                    // If they have attendance, let them pass to the rest of the logic.
                }
            } else {
                // Fallback Legacy Check:
                if (p.startDate && p.startDate > monthEndStr) {
                    // Only hide if strictly started after.
                    // But verify strictness.
                    return false;
                }
            }

            // 1. Currently assigned to this site
            if (p.siteId === selectedSiteId) return true;

            // 2. Transferred FROM this site (History check)
            if (p.transferHistory?.some((h: any) => h.fromSiteId === selectedSiteId)) return true;

            // 3. Or has attendance record for this site in the selected month
            // We check if ANY record exists for this person, this site, and simple string matching YYYY-MM
            const monthPrefix = format(selectedDate, 'yyyy-MM');
            const hasAttendance = personnelAttendance.some((a: any) =>
                a.personnelId === p.id &&
                a.siteId === selectedSiteId &&
                a.date.startsWith(monthPrefix)
            );
            return hasAttendance;
        }).sort((a: any, b: any) => a.fullName.localeCompare(b.fullName));
    }, [personnel, selectedSiteId, personnelAttendance, selectedDate]);

    // [DEBUG] Info Block
    const debugInfo = (
        <div className={cn(
            "text-xs mb-2 p-2 border rounded flex items-center justify-between gap-4",
            fetchStatus.includes('ERROR') ? "bg-red-50 border-red-200 text-red-800" : "bg-gray-50 text-gray-600"
        )}>
            <div className="flex flex-col gap-1">
                <span className="font-bold">DEBUG PANEL</span>
                <span>STATUS: <strong>{fetchStatus}</strong></span>
                {fetchError && <span className="text-red-600 font-bold">ERROR: {fetchError}</span>}
                <span>
                    Store P: {personnel.length} |
                    Store Att: {personnelAttendance.length} |
                    Site: {selectedSiteId || 'NULL'} |
                    Filtered: {filteredPersonnel.length}
                </span>
            </div>
            <Button size="sm" variant={fetchStatus.includes('ERROR') ? "destructive" : "secondary"} onClick={fetchAttendance} disabled={fetchStatus === 'LOADING'}>
                {fetchStatus === 'LOADING' ? 'Loading...' : 'Retry Fetch'}
            </Button>
        </div>
    );


    const openAttendanceModal = (pid: string, dateStr: string) => {
        if (!selectedSiteId) return alert('Lütfen önce şantiye seçiniz.');

        // Date Restriction Check
        // Check for existing record to determine if this is Create or Edit
        const existing = personnelAttendance.find((a: any) => a.personnelId === pid && a.date === dateStr && a.siteId === selectedSiteId);

        // 1. Permission Check (View Only / Create / Edit)
        let isDateRestricted = false;
        if (user && user.role !== 'ADMIN') {
            if (!existing && !canCreate) return; // Cannot create new

            // Check Date Restrictions
            const targetDate = new Date(dateStr);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Future Block
            if (targetDate > today) {
                alert('İleri tarihli puantaj girişi yapamazsınız.');
                return;
            }

            // Backdate Block
            if (user.editLookbackDays !== undefined) {
                const diff = differenceInDays(today, targetDate);
                if (diff > user.editLookbackDays) {
                    isDateRestricted = true;
                }
            }
        }

        // 2. Read Only Logic for Modal
        let readOnly = false;
        if (user?.role !== 'ADMIN') {
            if (existing) {
                // If view only OR date restricted
                if ((!canEdit && !canCreate) || isDateRestricted) readOnly = true;
            } else {
                // Creating (already checked !canCreate above)
                if (isDateRestricted) {
                    alert(`Geriye dönük en fazla ${user?.editLookbackDays} gün işlem yapabilirsiniz.`);
                    return;
                }
            }
        }



        // Override for ownership if needed (legacy logic)
        if (existing && existing.createdByUserId && existing.createdByUserId !== user?.id && user?.role !== 'ADMIN') {
            // If we want to restrict editing other's records even with Edit perm?
            // Maybe keep it simple: If has EDIT perm, can edit all?
            // Existing logic enforced it. I will keep it but respect `canEdit`.
            // If `canEdit` is true, do we bypass ownership? User didn't specify.
            // Let's assume `canEdit` is powerful. But maybe strict user ownership restricted?
            // User request: "düzenleme yetkisi verirsem... gün kadar yapabilsin".
            // He didn't say "only their own". He said "edit permission".
            // So I will remove the "createdByUserId" restriction if they have explicit EDIT perm,
            // OR keep it? Let's keep "Edit Limit" as the main constraint.
            // I will comment out the old ownership check for now and rely on `editLookbackDays`.
        }

        // Final Read Only Check
        if (user?.role !== 'ADMIN' && readOnly) {
            // Open in read-only mode?
            setIsReadOnly(true);
        } else {
            setIsReadOnly(false);
        }

        setSelectedPersonnelId(pid);
        setModalDate(dateStr);
        setStatus(existing?.status || 'WORK');
        setWeather(existing?.weather || 'SUNNY');
        setNote(existing?.note || '');
        setOvertime(existing?.overtime || 0);
        setIsReadOnly(readOnly);
        setAttendanceModalOpen(true);
    };

    const handleSaveAttendance = (statusOverride?: string) => {
        const finalStatus = statusOverride || status;

        // Validation: Check if personnel already has attendance at another site for this date
        // Note: The store prepends new records, so finding the first match gives the latest record.
        const existingRecord = personnelAttendance.find((a: any) =>
            a.personnelId === selectedPersonnelId &&
            a.date === modalDate
        );

        if (existingRecord && existingRecord.siteId !== selectedSiteId) {
            if (existingRecord.status === 'OUT_DUTY') {
                // Auto-delete the OUT_DUTY record from the other site
                deletePersonnelAttendance(selectedPersonnelId, modalDate, existingRecord.siteId);
            } else {
                alert(`Bu personel ${modalDate} tarihinde başka bir şantiyede çalışıyor gözükmektedir. Aynı gün iki farklı şantiyede puantaj girilemez.`);
                return;
            }
        }

        if (overtime > 0 && !note.trim()) {
            alert('Mesai saati girildiğinde açıklama girmek zorunludur. Lütfen mesai gerekçesini belirtiniz.');
            return;
        }

        // [NEW] Auto-Rehire Logic if Inactive
        const p = personnel.find((per: any) => per.id === selectedPersonnelId);
        if (p) {
            const isActive = isPersonnelActive(p, new Date(modalDate));
            if (!isActive) {
                // Determine if we should clear legacy leftDate or just rely on history.
                // Best to clear legacy leftDate to avoid confusion, as we are now Active.
                const newHistory = [...(p.employmentHistory || [])];

                // Migrate legacy dates if history is empty
                if (newHistory.length === 0) {
                    if (p.startDate) {
                        newHistory.push({ type: 'HIRE', date: p.startDate });
                    }
                    if (p.leftDate && p.status === 'LEFT') {
                        newHistory.push({ type: 'EXIT', date: p.leftDate });
                    }
                }

                newHistory.push({ type: 'HIRE', date: modalDate });

                updatePersonnel(p.id, {
                    status: 'ACTIVE',
                    leftDate: undefined,
                    employmentHistory: newHistory
                });
            }
        }

        addPersonnelAttendance({
            id: crypto.randomUUID(),
            personnelId: selectedPersonnelId,
            siteId: selectedSiteId,
            date: modalDate,
            status: finalStatus as any,
            weather,
            note,
            overtime,
            hours: finalStatus === 'HALF_DAY' ? 4 : 8,
            createdByUserId: user?.id
        });
        setAttendanceModalOpen(false);
    };

    const handleDeleteAttendance = () => {
        if (!selectedPersonnelId || !modalDate) return;

        if (confirm('Bu puantaj kaydını silmek istediğinize emin misiniz?')) {
            deletePersonnelAttendance(selectedPersonnelId, modalDate);
            setAttendanceModalOpen(false);
        }
    };



    const openTransferModal = (pid: string) => {
        setPersonnelToTransfer(pid);
        setTransferTargetSiteId('');
        setTransferModalOpen(true);
    };

    const handleTransfer = () => {
        if (!personnelToTransfer || !transferTargetSiteId) return;

        const person = personnel.find((p: any) => p.id === personnelToTransfer);
        if (!person) return;

        const newHistory = [
            ...(person.transferHistory || []),
            {
                fromSiteId: person.siteId || '', // [FIX] Handle null case
                toSiteId: transferTargetSiteId,
                date: new Date().toISOString()
            }
        ];

        updatePersonnel(personnelToTransfer, {
            siteId: transferTargetSiteId,
            transferHistory: newHistory
        });
        setTransferModalOpen(false);
        setPersonnelToTransfer(null);
        setPersonnelToTransfer(null);
    };

    const handleDeletePersonnel = (p: typeof personnel[0]) => {
        // Validation: Check for attendance records in ANY site
        // personnelAttendance store contains records for all sites
        const globalAttendanceCount = personnelAttendance.filter((a: any) => a.personnelId === p.id).length;

        // Also check transfer history - if they have moved around, they have history.
        const hasTransferHistory = p.transferHistory && p.transferHistory.length > 0;

        if (globalAttendanceCount > 0 || hasTransferHistory) {
            alert(
                `Bu personel silinemez!\n\n` +
                `Silme Engeli:\n` +
                (globalAttendanceCount > 0 ? `- ${globalAttendanceCount} adet Puantaj kaydı bulunmaktadır (Tüm Şantiyeler).\n` : '') +
                (hasTransferHistory ? `- Geçmiş şantiye transfer kayıtları bulunmaktadır.\n` : '') +
                `\nVeri bütünlüğünü korumak için işlem görmüş personeller silinemez. Bunun yerine "İşten Ayrıldı" (Kırmızı Çizgi) işlemini kullanınız.`
            );
            return;
        }

        if (confirm(`${p.fullName} isimli personeli silmek istediğinize emin misiniz?\n\nBU İŞLEM GERİ ALINAMAZ!`)) {
            deletePersonnel(p.id);
        }
    };

    // [NEW] Helper to check if personnel is active on a specific date
    const isPersonnelActive = (p: typeof personnel[0], date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');

        // 1. Employment History (Priority)
        if (p.employmentHistory && p.employmentHistory.length > 0) {
            const history = [...p.employmentHistory].sort((h1: any, h2: any) => new Date(h1.date).getTime() - new Date(h2.date).getTime());

            // Find the latest record on or before date
            const lastRecord = history.filter((h: any) => h.date <= dateStr).pop();

            if (!lastRecord) {
                // If the first record is HIRE, they were inactive before.
                // If the first record is EXIT, they were active before.
                const first = history[0];
                return first.type === 'EXIT';
            }

            // Active if HIRE (Exit is Exclusive)
            return lastRecord.type === 'HIRE';
        }

        // 2. Legacy Fallback
        if (p.status === 'LEFT' && p.leftDate) {
            return dateStr <= p.leftDate;
        }

        return true;
    };

    // [NEW] Handle Re-Hiring
    const handleReHire = (p: typeof personnel[0], date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');

        if (!confirm(`${p.fullName} isimli personeli ${format(date, 'dd.MM.yyyy')} tarihi itibariyle tekrar işe almak istiyor musunuz?`)) {
            return;
        }

        const newHistory = [...(p.employmentHistory || [])];

        // If no history exists but we have a legacy leftDate, migrate it first
        if (newHistory.length === 0) {
            if (p.startDate) {
                newHistory.push({ type: 'HIRE', date: p.startDate });
            }
            if (p.leftDate && p.status === 'LEFT') {
                newHistory.push({ type: 'EXIT', date: p.leftDate });
            }
        }

        // Add new HIRE record
        newHistory.push({ type: 'HIRE', date: dateStr });

        updatePersonnel(p.id, {
            status: 'ACTIVE', // Mark as active generally
            employmentHistory: newHistory
        });
    };

    const getStatusForDate = (pid: string, date: Date, preferredSiteId?: string) => {
        if (!date || isNaN(date.getTime())) return undefined;
        const dateStr = format(date, 'yyyy-MM-dd');

        // Priority: Exact match for this site
        if (preferredSiteId) {
            const siteRecord = personnelAttendance.find((a: any) => a.personnelId === pid && a.date === dateStr && a.siteId === preferredSiteId);
            if (siteRecord) return siteRecord;
        }

        // Fallsback: Return any record (e.g. OUT_DUTY from another site)
        const record = personnelAttendance.find((a: any) => a.personnelId === pid && a.date === dateStr);
        if (record) return record;

        // [NEW] Start Date Auto-Attendance
        // If no record exists, check if this date is the personnel's Start Date
        const person = personnel.find((p: any) => p.id === pid);
        if (person && person.startDate) {
            // Normalize Date Comparison (Handle ISO string vs YYYY-MM-DD)
            const startDateStr = person.startDate.split('T')[0];
            if (startDateStr === dateStr) {
                return {
                    id: 'virtual-start-date',
                    personnelId: pid,
                    siteId: selectedSiteId,
                    date: dateStr,
                    status: 'WORK',
                    note: 'İşe Giriş Tarihi (Otomatik)',
                    virtual: true,
                    overtime: 0,
                    hours: 8,
                    createdByUserId: undefined
                };
            }
        }

        return undefined;
    };

    const changeMonth = (delta: number) => {
        const newDate = new Date(selectedDate);
        newDate.setMonth(newDate.getMonth() + delta);
        setSelectedDate(newDate);
    };

    const getWeatherIcon = (w?: string) => {
        switch (w) {
            case 'SUNNY': return <Sun className="w-4 h-4 text-orange-500" />;
            case 'RAINY': return <CloudRain className="w-4 h-4 text-blue-500" />;
            case 'SNOWY': return <CloudSnow className="w-4 h-4 text-cyan-500" />;
            case 'CLOUDY': return <Cloud className="w-4 h-4 text-gray-500" />;
            default: return null;
        }
    };

    const handleExportExcel = () => {
        if (!selectedSiteId) return;
        const siteName = availableSites.find((s: any) => s.id === selectedSiteId)?.name || 'Şantiye';
        const monthStr = format(selectedDate, 'MMMM yyyy', { locale: tr });
        const dayHeaders = daysInMonth.map((d: any) => format(d, 'dd'));

        // Helper to create rows
        const createRows = (list: typeof personnel) => {
            return list.map((p: any) => {
                const endOfMonthDate = daysInMonth[daysInMonth.length - 1]; // Use last day of viewing month
                const isActiveAtMonthEnd = isPersonnelActive(p, endOfMonthDate);
                const row: any = {
                    'Ad Soyad': p.fullName,
                    'Görevi': p.role,
                    'Durum': !isActiveAtMonthEnd ? 'İşten Ayrıldı' : 'Aktif'
                };

                let workedDays = 0;
                let overtimeTotal = 0;
                let leaveTotal = 0;

                // [NEW] Global Stats Calculation
                let globalWorkedDays = 0;
                let globalLeaveTaken = 0;

                daysInMonth.forEach((day: any) => {
                    const dateStr = format(day, 'dd');
                    const record = getStatusForDate(p.id, day, selectedSiteId);

                    // Global Stats (All Sites)
                    if (record) {
                        if (record.status === 'WORK') globalWorkedDays += 1;
                        if (record.status === 'HALF_DAY') globalWorkedDays += 0.5;
                        if (record.status === 'LEAVE') globalLeaveTaken += 1;
                    }

                    // Current Site specific logic
                    let cellValue = '';

                    const isActive = isPersonnelActive(p, day);

                    if (!isActive) {
                        cellValue = '—';
                    } else if (record && record.siteId === selectedSiteId) {
                        switch (record.status) {
                            case 'WORK': cellValue = '✅'; workedDays += 1; break;
                            case 'HALF_DAY': cellValue = '🕒'; workedDays += 0.5; break;
                            case 'ABSENT': cellValue = '❌'; break;
                            case 'LEAVE': cellValue = '☂️'; leaveTotal += 1; break;
                            case 'REPORT': cellValue = '⚕️'; break;
                        }
                        if (record.overtime && record.overtime > 0) {
                            overtimeTotal += record.overtime;
                        }
                    }
                    row[dateStr] = cellValue;
                });

                // [NEW] 30-Day Cap Logic for 31-Day Months
                if (daysInMonth.length === 31) {
                    const totalPaid = workedDays + leaveTotal;
                    if (totalPaid > 30) {
                        let excess = totalPaid - 30;
                        if (workedDays >= excess) {
                            workedDays -= excess;
                        } else {
                            excess -= workedDays;
                            workedDays = 0;
                            leaveTotal -= excess;
                        }
                    }
                }

                row['Çalışılan (Gün)'] = workedDays;
                row['Fazla Mesai (Saat)'] = overtimeTotal;

                // [NEW] Proportional Leave Distribution Logic
                let leaveValue = '';
                const allowance = Number(p.monthlyLeaveAllowance) || 0;

                if (allowance > 0) {
                    const globalUnused = Math.max(0, allowance - globalLeaveTaken);

                    if (globalUnused > 0 && globalWorkedDays > 0) {
                        // Calculate Ratio: (Site Worked / Global Worked) * Global Unused
                        const ratio = workedDays / globalWorkedDays;
                        const distributed = globalUnused * ratio;

                        // Formatting: Show 1 decimal if needed, but if integer show integer
                        // e.g. 1.0 -> 1, 1.5 -> 1.5
                        leaveValue = parseFloat(distributed.toFixed(2)).toString();
                    } else if (globalUnused > 0 && globalWorkedDays === 0) {
                        // Edge case: Unused leave exists but NO work anywhere?
                        // Maybe assign to current site if it's their main site?
                        // For now, if no work done, no distribution.
                        leaveValue = '0';
                    }
                }

                row['İzin (Gün)'] = leaveValue;

                // [NEW] Total Payment Calculation (Hakediş)
                let totalPayment = 0;
                const salary = Number(p.salary) || 0;
                if (salary > 0) {
                    const dailyWage = salary / 30;
                    const hourlyWage = salary / 225;
                    const overtimeWage = hourlyWage * 1.5;

                    totalPayment = (workedDays * dailyWage) + (overtimeTotal * overtimeWage);
                }

                // Format as Currency String
                row['Hakediş'] = totalPayment > 0
                    ? totalPayment.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL'
                    : '-';

                return row;
            });
        };

        const technicalRows = createRows(groupedPersonnel.technical);
        const fieldRows = createRows(groupedPersonnel.field);

        // Prepare Final Data with Headers
        const finalData: any[] = [];

        if (technicalRows.length > 0) {
            finalData.push({ 'Ad Soyad': 'TEKNİK PERSONEL', 'Görevi': '', 'Durum': '' }); // Marker Row
            finalData.push(...technicalRows);
        }

        if (fieldRows.length > 0) {
            if (finalData.length > 0) finalData.push({}); // Empty row
            finalData.push({ 'Ad Soyad': 'SAHA PERSONELİ', 'Görevi': '', 'Durum': '' }); // Marker Row
            finalData.push(...fieldRows);
        }

        const header = ['Ad Soyad', 'Görevi', 'Durum', ...dayHeaders, 'Çalışılan (Gün)', 'Fazla Mesai (Saat)', 'İzin (Gün)', 'Hakediş'];

        // Create Sheet with Title
        const ws = XLSX.utils.json_to_sheet([], { header: [] }); // Start empty
        XLSX.utils.sheet_add_aoa(ws, [[`${siteName} - ${monthStr} - Personel Puantajı`]], { origin: 'A1' });
        XLSX.utils.sheet_add_aoa(ws, [header], { origin: 'A3' }); // Headers at A3
        XLSX.utils.sheet_add_json(ws, finalData, { origin: 'A4', skipHeader: true, header }); // Data at A4

        // Merge Title
        if (!ws['!merges']) ws['!merges'] = [];
        ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: header.length - 1 } }); // Merge A1 across width
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Personel Puantaj");
        XLSX.writeFile(wb, `${siteName} - ${monthStr} - Personel Puantaj.xlsx`);
    };

    const handleExportPDF = () => {
        if (!selectedSiteId) return;
        const siteName = availableSites.find((s: any) => s.id === selectedSiteId)?.name || 'Şantiye';
        const monthStr = format(selectedDate, 'MMMM yyyy', { locale: tr });

        const doc = new jsPDF('l', 'mm', 'a4');
        const fontName = addTurkishFont(doc);
        doc.setFont(fontName);

        doc.setFontSize(14);
        doc.text(`${siteName} - ${monthStr} - Personel Puantajı`, 14, 15);

        const tableColumn = ["Ad Soyad", "Görevi", ...daysInMonth.map((d: any) => format(d, 'dd')), "Ç (Gün)", "FM (Sa)", "İzin", "Hakediş"];
        const tableRows: any[] = [];

        // Helper to generate rows
        const generateTableRows = (list: typeof personnel) => {
            return list.map((p: any) => {
                let workedDays = 0;
                let overtimeTotal = 0;
                let leaveTotal = 0;
                let actualLeaveCount = 0;

                const dayCells = daysInMonth.map((day: any) => {
                    const record = getStatusForDate(p.id, day, selectedSiteId);
                    const isActive = isPersonnelActive(p, day);

                    if (!isActive) return 'LEFT_MARKER';

                    if (record && record.siteId === selectedSiteId) {
                        if (record.status === 'WORK') workedDays += 1;
                        if (record.status === 'HALF_DAY') workedDays += 0.5;
                        if (record.status === 'LEAVE') { leaveTotal += 1; actualLeaveCount += 1; }
                        if (record.overtime && record.overtime > 0) overtimeTotal += record.overtime;

                        return record.status;
                    }
                    return '';
                });

                // 30-Day Cap Logic
                if (daysInMonth.length === 31) {
                    const totalPaid = workedDays + leaveTotal;
                    if (totalPaid > 30) {
                        const excess = totalPaid - 30;
                        if (workedDays >= excess) {
                            workedDays -= excess;
                        } else {
                            const remExcess = excess - workedDays;
                            workedDays = 0;
                            // leaveTotal -= remExcess;
                        }
                    }
                }

                // Remaining Leave Logic
                const allowance = Number(p.monthlyLeaveAllowance) || 0;
                let leaveDisplay = '';
                if (allowance > 0) {
                    const remaining = allowance - actualLeaveCount;
                    if (remaining > 0) leaveDisplay = remaining.toString();
                }

                // [NEW] Total Payment Calculation
                let paymentDisplay = '-';
                const salary = Number(p.salary) || 0;
                if (salary > 0) {
                    const dailyWage = salary / 30;
                    const hourlyWage = salary / 225;
                    const overtimeWage = hourlyWage * 1.5;

                    const totalPayment = (workedDays * dailyWage) + (overtimeTotal * overtimeWage);
                    if (totalPayment > 0) {
                        paymentDisplay = totalPayment.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    }
                }

                return [
                    p.fullName,
                    p.role,
                    ...dayCells,
                    workedDays.toString(),
                    overtimeTotal > 0 ? overtimeTotal.toString() : '-',
                    leaveDisplay,
                    paymentDisplay
                ];
            });
        };

        // Add Technical Group
        if (groupedPersonnel.technical.length > 0) {
            // Header Row
            const headerRow = ['TEKNİK PERSONEL', ...Array(tableColumn.length - 1).fill('')];
            tableRows.push(headerRow);
            tableRows.push(...generateTableRows(groupedPersonnel.technical));
        }

        // Add Field Group
        if (groupedPersonnel.field.length > 0) {
            const headerRow = ['SAHA PERSONELİ', ...Array(tableColumn.length - 1).fill('')];
            tableRows.push(headerRow);
            tableRows.push(...generateTableRows(groupedPersonnel.field));
        }

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
            headStyles: { fillColor: [41, 128, 185] },
            didParseCell: (data) => {
                // Style Group Headers
                if (data.section === 'body') {
                    const rowRaw = data.row.raw as unknown as string[];
                    if (rowRaw[0] === 'TEKNİK PERSONEL' || rowRaw[0] === 'SAHA PERSONELİ') {
                        data.cell.styles.fontStyle = 'bold';
                        data.cell.styles.fillColor = [240, 240, 240];
                        data.cell.styles.textColor = [0, 0, 0];
                        data.cell.styles.halign = 'left';
                        if (data.column.index === 0) {
                            data.cell.colSpan = tableColumn.length;
                        }
                    }
                }

                // Clean Status Text for Icons
                if (data.section === 'body' && data.column.index >= 2 && data.column.index < daysInMonth.length + 2) {
                    const status = data.cell.raw as string;
                    // Skip if it is a header row (which we check by first col content)
                    const rowFirstCol = (data.row.raw as string[])[0];
                    if (rowFirstCol !== 'TEKNİK PERSONEL' && rowFirstCol !== 'SAHA PERSONELİ') {
                        (data.cell as any)._status = status;
                        data.cell.text = []; // Clear text for icon drawing
                    }
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

                    // Handle LEFT_MARKER
                    if (status === 'LEFT_MARKER') {
                        doc.setFillColor(240, 240, 240); // Light gray bg
                        doc.rect(x, y, width, height, 'F');
                        doc.setDrawColor(252, 165, 165); // red-300
                        doc.setLineWidth(1);
                        doc.line(x + 1, cy, x + width - 1, cy);
                        return; // Done
                    }

                    switch (status) {
                        case 'WORK': // Check Circle (Green)
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

                        case 'ABSENT': // X Circle (Red)
                            doc.setFillColor(220, 38, 38); // red-600
                            doc.circle(cx, cy, r, 'F');
                            doc.setDrawColor(255);
                            doc.setLineWidth(0.5);
                            // Large X
                            doc.line(cx - r * 0.4, cy - r * 0.4, cx + r * 0.4, cy + r * 0.4);
                            doc.line(cx + r * 0.4, cy - r * 0.4, cx - r * 0.4, cy + r * 0.4);
                            break;

                        case 'LEAVE': // Umbrella (Purple)
                            doc.setFillColor(168, 85, 247); // purple-500
                            doc.circle(cx, cy, r, 'F');
                            doc.setDrawColor(255);
                            doc.setLineWidth(0.5);
                            // Umbrella Canopy (Triangle approx)
                            doc.triangle(cx - r * 0.5, cy, cx + r * 0.5, cy, cx, cy - r * 0.5, 'S');
                            // Handle (J shape)
                            doc.line(cx, cy, cx, cy + r * 0.4);
                            doc.lines([[r * 0.15, 0], [0, -r * 0.1]], cx, cy + r * 0.4, [1, 1], 'S', false);
                            break;

                        case 'REPORT': // Stethoscope (Gray)
                            doc.setFillColor(100, 116, 139); // slate-500
                            doc.circle(cx, cy, r, 'F');
                            doc.setDrawColor(255);
                            doc.setLineWidth(0.5);
                            // U shape (Earpiece/Tube)
                            doc.line(cx - r * 0.3, cy - r * 0.3, cx - r * 0.3, cy + r * 0.1); // Left down
                            doc.line(cx + r * 0.3, cy - r * 0.3, cx + r * 0.3, cy + r * 0.1); // Right down
                            doc.lines([[r * 0.3, r * 0.2], [r * 0.3, -r * 0.2]], cx - r * 0.3, cy + r * 0.1, [1, 1], 'S', false); // Curve approx
                            // Bell
                            doc.circle(cx, cy + r * 0.4, r * 0.15, 'S');
                            break;
                    }
                }
            }
        });

        const finalY = (doc as any).lastAutoTable.finalY + 10;
        let runningY = finalY;

        doc.setFontSize(10);
        doc.text("Açıklamalar ve Mesai Detayları:", 14, runningY);
        runningY += 5;
        doc.setFontSize(8);

        // Render details, using grouped list to maintain order
        const allOrdered = [...groupedPersonnel.technical, ...groupedPersonnel.field];

        allOrdered.forEach((p: any) => {
            daysInMonth.forEach((day: any) => {
                const record = getStatusForDate(p.id, day);
                if (record && (record.note || (record.overtime && record.overtime > 0))) {
                    const dateStr = format(day, 'dd.MM.yyyy');
                    let detail = `${p.fullName} - ${dateStr}: `;
                    if (record.note) detail += `${record.note} `;
                    if (record.overtime) detail += `(${record.overtime} sa. Mesai)`;

                    // Check page break
                    if (runningY > 190) { // A4 Landscape height
                        doc.addPage();
                        runningY = 20;
                    }

                    doc.text(detail, 14, runningY);
                    runningY += 4;
                }
            });
        });

        doc.save(`${siteName} - ${monthStr} - Puantaj.pdf`);
    };

    const groupedPersonnel = useMemo(() => {
        return {
            technical: filteredPersonnel.filter((p: any) => p.category === 'TECHNICAL'),
            field: filteredPersonnel.filter((p: any) => !p.category || p.category === 'FIELD') // Default to FIELD
        };
    }, [filteredPersonnel]);

    const renderPersonnelRows = (personnelList: typeof personnel) => {
        if (personnelList.length === 0) return null;

        return personnelList.map((p: any) => {
            return (
                <TableRow key={p.id} className="h-10 hover:bg-slate-50/50">
                    {/* Status Column Removed */}
                    {/* Name Column - Now first */}
                    <TableCell
                        className="sticky left-0 bg-background z-10 border-r px-1 text-left align-middle h-10 font-bold text-[10px] w-[145px] shadow-[1px_0_2px_rgba(0,0,0,0.05)] cursor-pointer hover:bg-slate-50 relative group"
                        title="Düzenlemek için tıklayın"
                        onClick={() => canEdit && setEditingPersonnelId(p.id)}
                    >
                        <div className="flex items-center w-full h-full whitespace-normal leading-3 px-2">
                            {/* Show small status dot based on Month End Status instead of Current Status */}
                            {!isPersonnelActive(p, daysInMonth[daysInMonth.length - 1]) && <XCircle className="w-3 h-3 text-red-500 mr-1 flex-shrink-0" />}
                            <span className="line-clamp-2 group-hover:underline decoration-blue-400 underline-offset-2">{p.fullName}</span>
                        </div>
                    </TableCell>

                    <TableCell className="border-r px-0.5 text-center align-middle h-10 text-[9px] w-[55px] whitespace-normal leading-[10px] hidden md:table-cell break-words" title={p.profession}>
                        <div className="flex items-center justify-center h-full w-full">
                            {p.profession}
                        </div>
                    </TableCell>
                    <TableCell className="border-r px-0.5 text-center align-middle h-10 text-[9px] text-muted-foreground w-[55px] whitespace-normal leading-[10px] hidden lg:table-cell break-words" title={p.role}>
                        <div className="flex items-center justify-center h-full w-full">
                            {p.role}
                        </div>
                    </TableCell>
                    {/* Actions Column (Merged Transfer + Edit + Delete) */}
                    <TableCell className="border-r p-0 text-center align-middle h-10 w-[25px]">
                        {canEdit && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-6 w-6">
                                        <MoreHorizontal className="w-3 h-3" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => openTransferModal(p.id)}>
                                        <MoreHorizontal className="w-4 h-4 mr-2 text-orange-600" />
                                        Şantiye Değiştir
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </TableCell>
                    {daysInMonth.map((day: any, index: any) => {
                        const todayStr = format(day, 'yyyy-MM-dd');



                        // 2. Employment Status Visualization
                        const isActive = isPersonnelActive(p, day);

                        if (!isActive) {
                            return (
                                <TableCell
                                    key={`left-${todayStr}`}
                                    className="p-0 text-center border-r bg-slate-50/50 cursor-pointer hover:bg-green-50 h-10 align-middle"
                                    onClick={() => canEdit && openAttendanceModal(p.id, todayStr)} // Open Modal directly
                                    title={canEdit ? "İşten Ayrıldı (Tekrar Başlatmak için Tıklayın)" : "İşten Ayrıldı"}
                                >
                                    <div className="flex items-center justify-center w-full h-full px-1">
                                        <div className="h-[2px] w-full bg-red-300" />
                                    </div>
                                </TableCell>
                            );
                        }

                        const record = getStatusForDate(p.id, day, selectedSiteId);
                        let isTransferredInDay = false;

                        if (p.transferHistory) {
                            const currentDay = new Date(day);
                            currentDay.setHours(0, 0, 0, 0);

                            const transferIn = p.transferHistory.find((h: any) => h.toSiteId === selectedSiteId);
                            if (transferIn) {
                                const transferDate = new Date(transferIn.date);
                                transferDate.setHours(0, 0, 0, 0);

                                if (currentDay < transferDate) {
                                    const oldRecord = personnelAttendance.find((a: any) =>
                                        a.personnelId === p.id &&
                                        a.siteId !== selectedSiteId && // [Check] Any other site
                                        a.date === todayStr
                                    );

                                    if (oldRecord && (oldRecord.status === 'WORK' || oldRecord.status === 'HALF_DAY')) {
                                        isTransferredInDay = true;
                                    }
                                }
                            }
                        }

                        return (
                            <TableCell
                                key={todayStr}
                                className="p-0 text-center border-r hover:bg-slate-100 cursor-pointer h-10 w-[26px] min-w-0 align-middle"
                                onClick={() => openAttendanceModal(p.id, todayStr)}
                            >
                                <div className="w-full h-full mx-auto flex items-center justify-center relative">
                                    {record && record.siteId === selectedSiteId ? (
                                        <StatusCell record={record} />
                                    ) : record && record.status === 'OUT_DUTY' ? (
                                        // [NEW] Show Out Duty from other sites
                                        <StatusCell record={record} />
                                    ) : isTransferredInDay ? (
                                        <span title="Önceki Şantiyede Çalıştı" className="text-[10px]">✈️</span>
                                    ) : (
                                        <div className="w-1 h-1 bg-slate-200 rounded-full" />
                                    )}
                                </div>
                            </TableCell>
                        );
                    })}
                </TableRow>
            );
        });
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex justify-between items-center">
                        <span>Aylık Puantaj</span>
                        <div className="flex items-center gap-4">
                            <Button variant="outline" size="icon" onClick={() => changeMonth(-1)}><ChevronLeft className="w-4 h-4" /></Button>
                            <span className="font-bold text-lg w-32 text-center">{format(selectedDate, 'MMMM yyyy', { locale: tr })}</span>
                            <Button variant="outline" size="icon" onClick={() => changeMonth(1)}><ChevronRight className="w-4 h-4" /></Button>
                        </div>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {debugInfo}
                    <div className="flex flex-col md:flex-row gap-4 items-end mb-4">
                        <div className="space-y-2 w-full md:w-64">
                            <label className="text-sm font-medium">Şantiye Seçimi</label>
                            <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Şantiye Seçiniz (Zorunlu)" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableSites.filter((s: any) => s.status === 'ACTIVE').map((s: any) => (
                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="ml-auto flex items-center gap-2">
                            {selectedSiteId && (
                                <>
                                    <Button variant="outline" size="sm" onClick={handleExportExcel}>
                                        <Download className="w-4 h-4 mr-2" /> Excel
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={handleExportPDF}>
                                        <Download className="w-4 h-4 mr-2" /> PDF
                                    </Button>
                                </>
                            )}
                            {canCreate && <PersonnelForm defaultSiteId={selectedSiteId} defaultReferenceDate={selectedDate} />}
                        </div>
                    </div>

                    {!selectedSiteId ? (
                        <div className="text-center py-10 border rounded-md text-slate-500 bg-slate-50">
                            Lütfen personel listesini görüntülemek için bir şantiye seçiniz.
                        </div>
                    ) : (
                        <div className="border rounded-md overflow-hidden">
                            <Table className="w-full table-fixed text-xs">
                                <TableHeader>
                                    <TableRow className="h-10">
                                        <TableHead className="sticky left-0 z-20 bg-background w-[145px] border-r px-2 text-left font-bold text-muted-foreground h-10 truncate text-[11px] shadow-[1px_0_2px_rgba(0,0,0,0.05)]">Ad Soyad</TableHead>
                                        <TableHead className="w-[55px] border-r px-0.5 text-center font-bold text-muted-foreground h-10 truncate hidden md:table-cell text-[10px]">Meslek</TableHead>
                                        <TableHead className="w-[55px] border-r px-0.5 text-center font-bold text-muted-foreground h-10 truncate hidden lg:table-cell text-[10px]">Görevi</TableHead>
                                        {/* Action Column */}
                                        <TableHead className="w-[25px] border-r p-0 h-10"></TableHead>
                                        {daysInMonth.map((day: any) => (
                                            <TableHead key={day.toString()} className="p-0 text-center border-r text-[9px] h-10 w-[26px] min-w-0">
                                                <div className="flex flex-col items-center justify-center h-full">
                                                    <span className="leading-none text-[10px] font-semibold">{format(day, 'd')}</span>
                                                    <span className="text-[7px] text-muted-foreground leading-none mt-0.5">{format(day, 'EEE', { locale: tr }).substring(0, 1)}</span>
                                                </div>
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredPersonnel.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5 + daysInMonth.length} className="text-center h-24 text-muted-foreground">
                                                Bu şantiyeye atanmış personel bulunamadı.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        renderPersonnelRows(filteredPersonnel)
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    <div className="flex flex-wrap gap-4 mt-4 text-xs text-muted-foreground border-t pt-4">
                        <div className="flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-green-600" /> Çalıştı</div>
                        <div className="flex items-center gap-1"><Clock className="w-4 h-4 text-amber-500" /> Yarım Gün</div>
                        <div className="flex items-center gap-1"><XCircle className="w-4 h-4 text-red-500" /> Gelmedi (Devamsız)</div>
                        <div className="flex items-center gap-1"><Umbrella className="w-4 h-4 text-blue-500" /> İzinli</div>
                        <div className="flex items-center gap-1"><Thermometer className="w-4 h-4 text-orange-500" /> Hasta</div>
                        <div className="flex items-center gap-1"><Stethoscope className="w-4 h-4 text-purple-500" /> Raporlu</div>
                        <div className="flex items-center gap-1"><Briefcase className="w-4 h-4 text-cyan-600" /> Dış Görev</div>
                    </div>
                </CardContent>
            </Card>

            {/* [NEW] Exit Dialog Removed */}

            <Dialog open={attendanceModalOpen} onOpenChange={setAttendanceModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Puantaj Detayı: {modalDate}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {isReadOnly && (
                            <div className="bg-red-50 text-red-800 p-3 rounded-md text-xs font-medium border border-red-200">
                                Bu kayıt başka bir kullanıcı tarafından oluşturulmuştur. Sadece kaydı oluşturan kişi veya yöneticiler düzenleyebilir.
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label>Durum Seçiniz</Label>
                            <div className="grid grid-cols-2 gap-3">
                                <Button
                                    variant="outline"
                                    className={cn(
                                        "h-16 flex flex-col items-center justify-center gap-1 border-2",
                                        status === 'WORK' ? "bg-green-50 border-green-500 text-green-700" : "hover:bg-green-50 border-transparent hover:border-green-200"
                                    )}
                                    onClick={() => handleSaveAttendance('WORK')}
                                    disabled={isReadOnly}
                                >
                                    <CheckCircle2 className={cn("w-6 h-6", status === 'WORK' ? "text-green-600" : "text-green-500")} />
                                    <span className="font-medium">Çalıştı</span>
                                </Button>
                                <Button
                                    variant="outline"
                                    className={cn(
                                        "h-16 flex flex-col items-center justify-center gap-1 border-2",
                                        status === 'HALF_DAY' ? "bg-blue-50 border-blue-500 text-blue-700" : "hover:bg-blue-50 border-transparent hover:border-blue-200"
                                    )}
                                    onClick={() => handleSaveAttendance('HALF_DAY')}
                                    disabled={isReadOnly}
                                >
                                    <Clock className={cn("w-6 h-6", status === 'HALF_DAY' ? "text-blue-600" : "text-blue-500")} />
                                    <span className="font-medium">Yarım Gün</span>
                                </Button>
                                <Button
                                    variant="outline"
                                    className={cn(
                                        "h-16 flex flex-col items-center justify-center gap-1 border-2",
                                        status === 'ABSENT' ? "bg-red-50 border-red-500 text-red-700" : "hover:bg-red-50 border-transparent hover:border-red-200"
                                    )}
                                    onClick={() => handleSaveAttendance('ABSENT')}
                                    disabled={isReadOnly}
                                >
                                    <XCircle className={cn("w-6 h-6", status === 'ABSENT' ? "text-red-600" : "text-red-500")} />
                                    <span className="font-medium">Gelmedi</span>
                                </Button>
                                <Button
                                    variant="outline"
                                    className={cn(
                                        "h-16 flex flex-col items-center justify-center gap-1 border-2",
                                        status === 'LEAVE' ? "bg-blue-50 border-blue-500 text-blue-700" : "hover:bg-blue-50 border-transparent hover:border-blue-200"
                                    )}
                                    onClick={() => handleSaveAttendance('LEAVE')}
                                    disabled={isReadOnly}
                                >
                                    <Umbrella className={cn("w-6 h-6", status === 'LEAVE' ? "text-blue-600" : "text-blue-500")} />
                                    <span className="font-medium">İzinli</span>
                                </Button>
                                <Button
                                    variant="outline"
                                    className={cn(
                                        "h-16 flex flex-col items-center justify-center gap-1 border-2",
                                        status === 'SICK' ? "bg-orange-50 border-orange-500 text-orange-700" : "hover:bg-orange-50 border-transparent hover:border-orange-200"
                                    )}
                                    onClick={() => handleSaveAttendance('SICK')}
                                    disabled={isReadOnly}
                                >
                                    <Thermometer className={cn("w-6 h-6", status === 'SICK' ? "text-orange-600" : "text-orange-500")} />
                                    <span className="font-medium">Hasta</span>
                                </Button>
                                <Button
                                    variant="outline"
                                    className={cn(
                                        "h-16 flex flex-col items-center justify-center gap-1 border-2",
                                        status === 'REPORT' ? "bg-purple-50 border-purple-500 text-purple-700" : "hover:bg-purple-50 border-transparent hover:border-purple-200"
                                    )}
                                    onClick={() => handleSaveAttendance('REPORT')}
                                    disabled={isReadOnly}
                                >
                                    <Stethoscope className={cn("w-6 h-6", status === 'REPORT' ? "text-purple-600" : "text-purple-500")} />
                                    <span className="font-medium">Raporlu</span>
                                </Button>
                                <Button
                                    variant="outline"
                                    className={cn(
                                        "h-16 flex flex-col items-center justify-center gap-1 border-2",
                                        status === 'OUT_DUTY' ? "bg-cyan-50 border-cyan-500 text-cyan-700" : "hover:bg-cyan-50 border-transparent hover:border-cyan-200"
                                    )}
                                    onClick={() => handleSaveAttendance('OUT_DUTY')}
                                    disabled={isReadOnly}
                                >
                                    <Briefcase className={cn("w-6 h-6", status === 'OUT_DUTY' ? "text-cyan-600" : "text-cyan-500")} />
                                    <span className="font-medium">Dış Görev</span>
                                </Button>

                                {/* [NEW] İşten Çıkarma Butonu (Grid İçinden) */}
                                <Button
                                    variant="outline"
                                    className="h-16 flex flex-col items-center justify-center gap-1 border-2 border-transparent hover:bg-red-50 hover:border-red-200 text-red-600"
                                    onClick={() => {
                                        if (!selectedPersonnelId || !modalDate) return;
                                        const p = personnel.find((per: any) => per.id === selectedPersonnelId);
                                        if (!p) return;

                                        // Convert modalDate (yyyy-MM-dd) to yyyy-MM-dd
                                        const exitDateIso = modalDate;

                                        // [NEW] Logic: "üçünde işten ayrıldıya bastığımızda üçü ve ay sonuna kadar kırmızı çizgi"
                                        // This implies: 
                                        // 1. EXIT event is on the selected date.
                                        // 2. We should CLEAR any existing attendance for this date AND future dates to ensure clean "Red Line".

                                        if (confirm(`${p.fullName} isimli personelin çıkışını ${format(new Date(modalDate), 'dd.MM.yyyy')} tarihi itibariyle yapmak istiyor musunuz?\n\n(Seçilen tarih ve sonrası için girilmiş puantajlar silinecektir.)`)) {
                                            const newHistory = [...(p.employmentHistory || [])];
                                            newHistory.push({ type: 'EXIT', date: exitDateIso });

                                            // [Step 1] Update Personnel Status
                                            updatePersonnel(p.id, {
                                                status: 'LEFT',
                                                leftDate: modalDate,
                                                employmentHistory: newHistory
                                            });

                                            // [Step 2] Clean up future attendance to ensure visual consistency
                                            // Find all attendance records for this person on or after the exit date
                                            const futureRecords = personnelAttendance.filter((a: any) =>
                                                a.personnelId === p.id &&
                                                a.date >= exitDateIso
                                            );

                                            // Delete them one by one (or batch if store supported it, loop is fine for local store)
                                            futureRecords.forEach((record: any) => {
                                                deletePersonnelAttendance(record.personnelId, record.date, record.siteId);
                                            });

                                            setAttendanceModalOpen(false);
                                            // force update or toast?
                                            toast.success("Personel çıkışı verildi ve sonraki kayıtlar temizlendi.");
                                        }
                                    }}
                                    disabled={isReadOnly}
                                >
                                    <XCircle className="w-6 h-6 text-red-600" />
                                    <span className="font-medium">İşten Ayrıldı</span>
                                </Button>
                            </div>


                        </div>

                        <div className="space-y-2">
                            <Label>Mesai Saati</Label>
                            <Input
                                type="number"
                                min={0}
                                max={24}
                                value={overtime}
                                onChange={e => setOvertime(Number(e.target.value))}
                                placeholder="0"
                                disabled={isReadOnly}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Açıklama / Gerekçe {overtime > 0 && <span className="text-red-500">* (Mesai için zorunlu)</span>}</Label>
                            <Input placeholder="Örn: Rapor no, İzin nedeni, Mesai nedeni..." value={note} onChange={e => setNote(e.target.value)} required={overtime > 0} disabled={isReadOnly} />
                        </div>

                        {/* Creator Info */}
                        {(() => {
                            const record = modalDate ? getStatusForDate(selectedPersonnelId, new Date(modalDate)) : undefined;
                            const creator = record?.createdByUserId ? users.find((u: any) => u.id === record.createdByUserId) : undefined;
                            if (creator) {
                                return (
                                    <div className="text-xs text-muted-foreground pt-2">
                                        Kaydı Yapan: <span className="font-medium">{creator.name}</span>
                                    </div>
                                );
                            }
                            return null;
                        })()}
                    </div>
                    <DialogFooter className="flex justify-between items-center sm:justify-between">
                        {!isReadOnly && modalDate && getStatusForDate(selectedPersonnelId, new Date(modalDate)) ? (
                            <Button variant="destructive" onClick={handleDeleteAttendance}>
                                Sil
                            </Button>
                        ) : <div></div>}
                        {isReadOnly && <Button variant="secondary" onClick={() => setAttendanceModalOpen(false)}>Kapat</Button>}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Transfer Modal */}
            <Dialog open={transferModalOpen} onOpenChange={setTransferModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Personel Transferi</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <p className="text-sm text-slate-500">
                            Seçili personeli başka bir şantiyeye transfer etmek üzeresiniz.
                        </p>
                        <div className="space-y-2">
                            <Label>Yeni Şantiye</Label>
                            <Select value={transferTargetSiteId} onValueChange={setTransferTargetSiteId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Şantiye Seçiniz" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableSites.filter((s: any) => s.status === 'ACTIVE' && s.id !== selectedSiteId).map((s: any) => (
                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setTransferModalOpen(false)}>İptal</Button>
                        <Button onClick={handleTransfer}>Transfer Et</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>



            {/* Edit Personnel Modal */}
            <PersonnelForm
                key={editingPersonnelId || 'new'}
                personnelToEdit={personnel.find((p: any) => p.id === editingPersonnelId)}
                open={!!editingPersonnelId}
                onOpenChange={(open) => !open && setEditingPersonnelId(null)}
            />
        </div>
    );
}
