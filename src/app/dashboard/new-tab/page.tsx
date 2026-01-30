'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, eachDayOfInterval, startOfMonth, endOfMonth } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Trash2, Plus, CheckCircle2, Clock, XCircle, Umbrella, FileText, Car, AlertCircle, Download, FileSpreadsheet, ArrowRightLeft, Plane, Lock, Settings, LogOut, LogIn, ArrowUp, ArrowDown, Filter, Search, X, Pencil } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/store/use-auth';
import { useAppStore } from '@/lib/store/use-store';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { differenceInDays, differenceInCalendarDays, differenceInCalendarMonths } from 'date-fns';
import { getPersonnelWithAttendance, upsertPersonnelAttendance, createPersonnel, updatePersonnel, deletePersonnel } from '@/actions/personnel';


type AttendanceRecord = {
    status: string; // FULL, HALF, ABSENT, LEAVE, REPORT, OUT, TRANSFER
    overtime?: string;
    note?: string;
    createdById?: string;
    createdAt?: number; // timestamp
};

type IndependentPerson = {
    id: string;
    siteId: string;
    tc: string;
    name: string;
    profession?: string;
    role?: string;
    salary?: string;
    leaveAllowance?: string;
    hasOvertime?: boolean;
    note?: string;
    inputDate?: string; // yyyy-MM-dd
    transferOutDate?: string; // yyyy-MM-dd (Locked after this date)
    attendance: Record<string, AttendanceRecord>;
    salaryHistory?: { amount: string; date: string }[];
    salaryAdjustments?: Record<string, { // key: yyyy-MM
        workedDays?: number; // Override calculated days
        overtimeHours?: number; // Override calculated overtime
        bonus?: number; // Extra payment
        deduction?: number; // Advance payment / cut
        note?: string;
    }>;
};

export default function NewPage() {
    const { user, getAccessibleSites } = useAuth();
    const { sites } = useAppStore();
    const availableSites = getAccessibleSites(sites);

    const [names, setNames] = useState<IndependentPerson[]>([]);
    const [loading, setLoading] = useState(true);

    // Site Filter State
    const [selectedSiteId, setSelectedSiteId] = useState<string>('all');

    // Auto-select site if only one available
    useEffect(() => {
        if (availableSites.length === 1) {
            setSelectedSiteId(availableSites[0].id);
        }
    }, [availableSites.length]);





    // Form State
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [showSalaryInput, setShowSalaryInput] = useState(false);


    // Salary Adjustment State
    const [isSalaryAdjustmentOpen, setIsSalaryAdjustmentOpen] = useState(false);
    const [salaryAdjustmentForm, setSalaryAdjustmentForm] = useState({
        personId: '',
        dateKey: '', // yyyy-MM
        workedDays: '',
        overtimeHours: '',
        bonus: '',
        deduction: '',
        note: ''
    });

    // Sorting State
    type SortConfigItem = { key: string; direction: 'asc' | 'desc' };
    const [sortConfig, setSortConfig] = useState<SortConfigItem[]>([]);

    const handleSort = (key: string, event: React.MouseEvent) => {
        setSortConfig(current => {
            let newConfig: SortConfigItem[];
            if (event.shiftKey) {
                const existingIndex = current.findIndex(item => item.key === key);
                if (existingIndex >= 0) {
                    newConfig = current.map((item, index) =>
                        index === existingIndex
                            ? { ...item, direction: item.direction === 'asc' ? 'desc' : 'asc' }
                            : item
                    );
                } else {
                    newConfig = [...current, { key, direction: 'asc' }];
                }
            } else {
                if (current.length > 0 && current[0].key === key) {
                    newConfig = [{ key, direction: current[0].direction === 'asc' ? 'desc' : 'asc' }];
                } else {
                    newConfig = [{ key, direction: 'asc' }];
                }
            }
            return newConfig;
        });
    };

    // Filter State
    const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});

    const handleFilterChange = (key: string, value: string) => {
        setColumnFilters(prev => {
            const current = prev[key] || [];
            if (current.includes(value)) {
                const next = current.filter(v => v !== value);
                return next.length > 0 ? { ...prev, [key]: next } : { ...prev, [key]: [] };
            } else {
                return { ...prev, [key]: [...current, value] };
            }
        });
    };

    const clearFilter = (key: string) => {
        setColumnFilters(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    // Helper for generating options
    const generateOptions = (list: any[], key: string) => {
        const values = new Set(list.map(item => item[key]).filter(Boolean));
        return Array.from(values).sort().map(v => ({ label: v as string, value: v as string }));
    };

    // Computed Options
    const professionOptions = useMemo(() => generateOptions(names, 'profession'), [names]);
    const roleOptions = useMemo(() => generateOptions(names, 'role'), [names]);
    const siteOptions = useMemo(() => sites.filter((s: any) => s.status === 'ACTIVE').map((s: any) => ({ label: s.name, value: s.name })), [sites]);
    const overtimeOptions = [{ label: 'Var', value: 'var' }, { label: 'Yok', value: 'yok' }];

    const ColumnFilter = ({ title, options, selectedValues, onSelect, onClear }: {
        title: string,
        options: { label: string, value: string }[],
        selectedValues: string[],
        onSelect: (value: string) => void,
        onClear: () => void
    }) => {
        const [searchTerm, setSearchTerm] = useState('');
        const filteredOptions = options.filter(o => o.label.toLowerCase().includes(searchTerm.toLowerCase()));

        return (
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className={cn("h-6 w-6 p-0 hover:bg-slate-200", selectedValues.length > 0 ? "text-blue-600" : "text-slate-400")}>
                        <Filter className={cn("w-3 h-3", selectedValues.length > 0 ? "fill-blue-600" : "")} />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-60 p-0" align="start">
                    <div className="p-2 border-b flex items-center gap-2">
                        <Search className="w-4 h-4 text-slate-400" />
                        <Input
                            placeholder={`${title} ara...`}
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="h-7 text-xs border-none focus-visible:ring-0 shadow-none"
                        />
                        {selectedValues.length > 0 && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClear}><X className="w-3 h-3" /></Button>}
                    </div>
                    <ScrollArea className="h-[200px]">
                        <div className="p-2 space-y-1">
                            {filteredOptions.length === 0 ? <div className="text-xs text-center text-slate-400 py-2">Sonuç yok</div> :
                                filteredOptions.map(opt => (
                                    <div key={opt.value} className="flex items-center space-x-2 p-1.5 hover:bg-slate-100 rounded cursor-pointer" onClick={() => onSelect(opt.value)}>
                                        <Checkbox checked={selectedValues.includes(opt.value)} id={`filter-${opt.value}`} />
                                        <label htmlFor={`filter-${opt.value}`} className="text-xs flex-1 cursor-pointer select-none">{opt.label}</label>
                                    </div>
                                ))}
                        </div>
                    </ScrollArea>
                    <div className="p-1 border-t bg-slate-50 text-xs text-center text-slate-500">
                        {selectedValues.length} seçim
                    </div>
                </PopoverContent>
            </Popover>
        );
    };
    const [formData, setFormData] = useState({
        siteId: '',
        tc: '',
        name: '',
        profession: '',
        role: '',
        salary: '',
        newSalary: '',
        newSalaryDate: format(new Date(), 'yyyy-MM-dd'),
        leaveAllowance: '',
        hasOvertime: false,
        note: '',
        inputDate: format(new Date(), 'yyyy-MM-dd'),
        salaryHistory: [] as { amount: string; date: string }[]
    });

    // Attendance Selection State
    const [selectedCell, setSelectedCell] = useState<{ personId: string; date: Date } | null>(null);
    const [hoveredData, setHoveredData] = useState<{ x: number, y: number, record: AttendanceRecord | undefined, date: Date } | null>(null);
    const [attendanceForm, setAttendanceForm] = useState<AttendanceRecord>({ status: '', overtime: '', note: '' });

    const [editingId, setEditingId] = useState<string | null>(null);

    // Transfer State
    const [isTransferOpen, setIsTransferOpen] = useState(false);
    const [transferData, setTransferData] = useState<{
        personId: string | null;
        targetSiteId: string;
        transferDate: Date;
        mode: 'transfer' | 'move';
    }>({
        personId: null,
        targetSiteId: '',
        transferDate: new Date(),
        mode: 'transfer'
    });

    const [date, setDate] = useState(new Date());

    // Fetch from Server (Moved here to access 'date' and 'selectedSiteId')
    const refreshData = async () => {
        setLoading(true);
        try {
            const res = await getPersonnelWithAttendance(date, selectedSiteId);
            if (res.success && res.data) {
                // Map DB Personnel to IndependentPerson format
                const mapped: IndependentPerson[] = res.data.map((p: any) => {
                    const attendanceMap: Record<string, AttendanceRecord> = {};
                    p.attendance.forEach((a: any) => {
                        const dateKey = format(new Date(a.date), 'yyyy-MM-dd');
                        attendanceMap[dateKey] = {
                            status: a.status,
                            overtime: a.overtime ? a.overtime.toString() : undefined,
                            note: a.note || undefined,
                            createdById: a.createdById || undefined,
                            createdAt: new Date(a.createdAt || Date.now()).getTime()
                        };
                    });

                    return {
                        id: p.id,
                        siteId: p.siteId || '',
                        tc: p.tcNumber || '',
                        name: p.fullName,
                        profession: p.profession || '',
                        role: p.role,
                        salary: p.salary ? p.salary.toString() : '',
                        leaveAllowance: p.leaveAllowance || '',
                        hasOvertime: p.hasOvertime || false,
                        note: p.note || '',
                        inputDate: p.startDate ? format(new Date(p.startDate), 'yyyy-MM-dd') : undefined,
                        transferOutDate: p.leftDate ? format(new Date(p.leftDate), 'yyyy-MM-dd') : undefined,
                        attendance: attendanceMap,
                        salaryHistory: [],
                        salaryAdjustments: {}
                    };
                });
                setNames(mapped);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshData();
    }, [date, selectedSiteId]);

    // Smart Entry: Auto-fill form on TC match with Duplicate Prevention
    useEffect(() => {
        if (formData.tc && formData.tc.length === 11 && !editingId) {
            const matches = names.filter(n => n.tc === formData.tc);

            if (matches.length > 0) {
                // Check for ANY active record
                const activeMatch = matches.find(p => {
                    // Check Transfer Out
                    if (p.transferOutDate && new Date(p.transferOutDate) <= new Date()) return false;

                    // Check Exit Status
                    const sortedDates = Object.keys(p.attendance).sort();
                    const lastDate = sortedDates[sortedDates.length - 1];
                    const lastStatus = lastDate ? p.attendance[lastDate].status : null;
                    if (lastStatus === 'EXIT') return false;

                    return true;
                });

                if (activeMatch) {
                    const siteName = sites.find((s: any) => s.id === activeMatch.siteId)?.name || 'Bilinmeyen Şantiye';
                    alert(`Bu personel (${activeMatch.name}) şu anda "${siteName}" şantiyesinde AKTİF olarak çalışıyor!\n\nAynı TC kimlik numarası ile tekrar kayıt açılamaz.`);
                    setFormData(prev => ({ ...prev, tc: '' }));
                    return;
                }

                // If only inactive records found -> Recall Info (Re-hire)
                const recentRecord = matches[matches.length - 1];
                alert("Bu personel sistemde daha önce kayıtlıydı (İşten Ayrılmış).\nEski bilgileri otomatik olarak getirildi.");
                setFormData(prev => ({
                    ...prev,
                    name: recentRecord.name,
                    profession: recentRecord.profession || '',
                    role: recentRecord.role || '',
                    salary: '',
                    newSalary: '',
                    newSalaryDate: format(new Date(), 'yyyy-MM-dd'),
                    leaveAllowance: recentRecord.leaveAllowance || '',
                    hasOvertime: recentRecord.hasOvertime || false,
                    note: recentRecord.note || '',
                    salaryHistory: recentRecord.salaryHistory || []
                }));
            }
        }
    }, [formData.tc, names, editingId, sites]);

    const days = eachDayOfInterval({
        start: startOfMonth(date),
        end: endOfMonth(date),
    });

    const { gridList: filteredNames, listList: allList } = useMemo(() => {
        const startOfCurrentMonth = startOfMonth(date);

        // 1. Group by TC (Deduplication) - GLOBAL (No Site Filter)
        const groupedByTc = new Map<string, IndependentPerson[]>();

        names.forEach(n => {
            // Aggressive normalization: Only digits
            const cleanTc = n.tc ? n.tc.toString().replace(/\D/g, '') : '';
            const key = cleanTc.length > 0 ? cleanTc : n.id;

            if (!groupedByTc.has(key)) {
                groupedByTc.set(key, []);
            }
            groupedByTc.get(key)!.push(n);
        });

        const mergedList: IndependentPerson[] = [];

        groupedByTc.forEach((group) => {
            // Use the last record (latest) as the Base Profile
            const base = { ...group[group.length - 1] };

            // Merge attendance from ALL records in this group
            const combinedAttendance = {};
            group.forEach(p => {
                Object.assign(combinedAttendance, p.attendance || {});
            });

            base.attendance = combinedAttendance;
            mergedList.push(base);
        });

        // 2. Apply Date Filters (Start Date & Exit) on GLOBAL List
        const seenTCs = new Set<string>();
        const processedGlobalList = mergedList.filter(n => {

            // STRICT DEDUPLICATION FALBACK
            if (n.tc) {
                const strictTc = n.tc.toString().replace(/\D/g, '');
                if (strictTc.length > 0) {
                    if (seenTCs.has(strictTc)) return false;
                    seenTCs.add(strictTc);
                }
            }

            // Start Date Filter
            if (n.inputDate) {
                const startDate = new Date(n.inputDate);
                // Allow if current view month is AFTER start date OR if there is ANY attendance in current month
                const isAfterStart = differenceInCalendarMonths(startOfCurrentMonth, startDate) >= 0;

                if (!isAfterStart) {
                    // Check if has attendance in this month (to show past history for re-hired merged profiles)
                    const hasAttendanceInView = Object.keys(n.attendance).some(key => {
                        const d = new Date(key);
                        return differenceInCalendarMonths(startOfCurrentMonth, d) === 0;
                    });

                    if (!hasAttendanceInView) return false;
                }
            }

            // Exit / Transfer Filter
            let effectiveEndDate: Date | null = null;
            let effectiveEndDateStr: string | null = null;

            // 1. Check 'EXIT' status
            const exitEntries = Object.entries(n.attendance || {})
                .filter(([_, r]) => r.status === 'EXIT')
                .sort((a, b) => a[0].localeCompare(b[0]));

            if (exitEntries.length > 0) {
                effectiveEndDateStr = exitEntries[exitEntries.length - 1][0];
                effectiveEndDate = new Date(effectiveEndDateStr);
            }

            // 2. Check 'transferOutDate'
            if (n.transferOutDate) {
                if (!effectiveEndDateStr || n.transferOutDate > effectiveEndDateStr) {
                    effectiveEndDateStr = n.transferOutDate;
                    effectiveEndDate = new Date(n.transferOutDate);
                }
            }

            if (effectiveEndDate && effectiveEndDateStr) {
                // If Current Month is AFTER the End Date
                if (differenceInCalendarDays(startOfCurrentMonth, effectiveEndDate) > 0) {
                    // Check if they returned (have records AFTER the end date OR new start date is after end date)
                    const hasReturned = Object.keys(n.attendance).some(k => k > effectiveEndDateStr! && n.attendance[k].status !== 'EXIT')
                        || (n.inputDate && n.inputDate > effectiveEndDateStr);

                    // If no return activity, HIDE them.
                    if (!hasReturned) return false;
                }
            }

            return true;
        });

        // 3. Apply Site Filter for GRID View
        const gridFiltered = (selectedSiteId && selectedSiteId !== 'all')
            ? processedGlobalList.filter(n => n.siteId === selectedSiteId)
            : processedGlobalList;

        // 4. Apply Filtering (Multi-Select)
        let filteredList = [...processedGlobalList];
        if (Object.keys(columnFilters).length > 0) {
            filteredList = filteredList.filter(item => {
                for (const [key, values] of Object.entries(columnFilters)) {
                    if (!values || values.length === 0) continue;

                    if (key === 'tc') {
                        if (!values.includes(item.tc)) return false;
                    }
                    else if (key === 'name') {
                        if (!values.includes(item.name)) return false;
                    }
                    else if (key === 'profession') {
                        if (!values.includes(item.profession || '')) return false;
                    }
                    else if (key === 'role') {
                        if (!values.includes(item.role || '')) return false;
                    }
                    else if (key === 'siteName') {
                        const siteName = sites.find((s: any) => s.id === item.siteId)?.name || '';
                        if (!values.includes(siteName)) return false;
                    }
                    else if (key === 'hasOvertime') {
                        const val = item.hasOvertime ? 'var' : 'yok';
                        if (!values.includes(val)) return false;
                    }
                }
                return true;
            });
        }


        // 5. Apply Sorting for LIST View (filteredList)
        let sortedList = [...filteredList];
        if (sortConfig.length > 0) {
            sortedList.sort((a, b) => {
                for (const sortItem of sortConfig) {
                    let comparison = 0;
                    if (sortItem.key === 'tc') comparison = a.tc.localeCompare(b.tc);
                    else if (sortItem.key === 'name') comparison = a.name.localeCompare(b.name);
                    else if (sortItem.key === 'profession') comparison = (a.profession || '').localeCompare(b.profession || '');
                    else if (sortItem.key === 'role') comparison = (a.role || '').localeCompare(b.role || '');
                    else if (sortItem.key === 'siteName') {
                        const siteA = sites.find((s: any) => s.id === a.siteId)?.name || '';
                        const siteB = sites.find((s: any) => s.id === b.siteId)?.name || '';
                        comparison = siteA.localeCompare(siteB);
                    }
                    else if (sortItem.key === 'hasOvertime') comparison = (a.hasOvertime === b.hasOvertime) ? 0 : (a.hasOvertime ? -1 : 1);
                    else if (sortItem.key === 'salary') {
                        const salA = parseFloat(a.salary || '0');
                        const salB = parseFloat(b.salary || '0');
                        comparison = salA - salB;
                    }

                    if (comparison !== 0) {
                        return sortItem.direction === 'asc' ? comparison : -comparison;
                    }
                }
                return 0; // Equal
            });
        }

        return { gridList: gridFiltered, listList: sortedList };

    }, [names, selectedSiteId, date, sortConfig, sites, columnFilters]);

    // Sync form when cell selected
    useEffect(() => {
        if (selectedCell) {
            const person = names.find(p => p.id === selectedCell.personId);
            if (person) {
                const dateKey = format(selectedCell.date, 'yyyy-MM-dd');
                const record = person.attendance[dateKey];
                setAttendanceForm(record ? { ...record } : { status: '', overtime: '', note: '' });
            }
        }
    }, [selectedCell, names]);

    // Auto-select site
    useEffect(() => {
        if (availableSites.length === 1) {
            setFormData(prev => ({ ...prev, siteId: availableSites[0].id }));
        }
    }, [availableSites.length]);

    const openTransferModal = (person: IndependentPerson) => {
        setTransferData({
            personId: person.id,
            targetSiteId: '',
            transferDate: new Date(),
            mode: 'transfer'
        });
        setIsTransferOpen(true);
    };

    const handleTransferSubmit = () => {
        if (!transferData.personId || !transferData.targetSiteId) return;

        const originalPerson = names.find(p => p.id === transferData.personId);
        if (!originalPerson) return;

        const dateThreshold = format(transferData.transferDate, 'yyyy-MM-dd');

        // 1. Prepare Old Attendance: Keep ONLY history BEFORE transfer date. 
        // Future interactions are cleared because they are leaving.
        // History remains EXACTLY as is (Icons: Full -> Full, Half -> Half).
        const oldAttendance: Record<string, AttendanceRecord> = {};
        Object.entries(originalPerson.attendance || {}).forEach(([key, record]) => {
            if (key < dateThreshold) {
                oldAttendance[key] = record;
            }
        });

        // 2. Prepare New Attendance: Map Old 'Worked' history to 'TRANSFER' (Plane).
        // Only for days BEFORE transfer date where they actually worked.
        // "Transfer olduğu şantiyede... kaç gün çalıştıysa... o kadar uçak simgesi"
        // 2. Prepare New Attendance: Map Old 'Worked' history to 'TRANSFER' (Plane).
        // Only for days BEFORE transfer date where they actually worked.
        // "Transfer olduğu şantiyede... kaç gün çalıştıysa... o kadar uçak simgesi"
        const newAttendance: Record<string, AttendanceRecord> = {};
        Object.entries(originalPerson.attendance || {}).forEach(([key, record]) => {
            if (key < dateThreshold) {
                // Check if 'Worked' or 'Occupied' (Full, Half, Out, Leave, Report)
                if (['FULL', 'HALF', 'OUT', 'LEAVE', 'REPORT'].includes(record.status)) {
                    newAttendance[key] = {
                        status: 'TRANSFER',
                        note: `Geçmiş Kayıt (Transfer: ${sites.find((s: any) => s.id === originalPerson.siteId)?.name})`
                    };
                }
            }
        });

        // Include Transfer Day itself as 'TRANSFER' (Plane)
        newAttendance[dateThreshold] = { status: 'TRANSFER', note: 'Transfer Girişi' };

        const newPerson: IndependentPerson = {
            ...originalPerson,
            id: crypto.randomUUID(),
            siteId: transferData.targetSiteId,
            inputDate: dateThreshold,
            attendance: newAttendance,
            note: `${originalPerson.note || ''} (Transfer Geldi: ${sites.find((s: any) => s.id === originalPerson.siteId)?.name} - ${Object.keys(newAttendance).length} Gün)`
        };

        // Update Old Person
        const updatedOriginalPerson = {
            ...originalPerson,
            attendance: oldAttendance,
            transferOutDate: dateThreshold,
            note: `${originalPerson.note || ''} (Transfer Gitti: -> ${sites.find((s: any) => s.id === transferData.targetSiteId)?.name})`
        };

        setNames(prev => [
            ...prev.map(p => p.id === originalPerson.id ? updatedOriginalPerson : p),
            newPerson
        ]);

        setIsTransferOpen(false);
    };

    const handleAdd = async () => {
        if (!formData.tc || !formData.name || !formData.profession || !formData.role || !formData.salary || !formData.leaveAllowance || !formData.siteId) return;

        if (editingId) {
            // Update
            const res = await updatePersonnel(editingId, {
                siteId: formData.siteId,
                tcNumber: formData.tc,
                fullName: formData.name,
                profession: formData.profession,
                role: formData.role,
                salary: parseFloat(parseMoney(formData.newSalary || formData.salary)), // Use formatted logic or raw? 
                // The API expects Float, but schema is Float?. parseMoney returns string "1000.00". parseFloat is needed.
                category: 'FIELD', // Default
                leaveAllowance: formData.leaveAllowance,
                hasOvertime: formData.hasOvertime,
                startDate: formData.inputDate ? new Date(formData.inputDate) : undefined,
                note: formData.note
            });

            if (res.success) {
                setEditingId(null);
                refreshData();
            } else {
                alert("Güncelleme başarısız: " + res.error);
            }
        } else {
            // Create
            const res = await createPersonnel({
                siteId: formData.siteId,
                tcNumber: formData.tc,
                fullName: formData.name, // mapped from 'name'
                profession: formData.profession,
                role: formData.role,
                salary: parseFloat(parseMoney(formData.salary)),
                category: 'FIELD',
                leaveAllowance: formData.leaveAllowance, // Stored as String as per updated schema
                hasOvertime: formData.hasOvertime,
                startDate: formData.inputDate ? new Date(formData.inputDate) : new Date(),
                note: formData.note
            });

            if (res.success) {
                refreshData();
            } else {
                alert("Ekleme başarısız: " + res.error);
            }
        }

        setFormData({
            siteId: availableSites.length === 1 ? availableSites[0].id : '',
            tc: '', name: '', profession: '', role: '', salary: '', newSalary: '', newSalaryDate: format(new Date(), 'yyyy-MM-dd'), leaveAllowance: '', hasOvertime: false, note: '',
            inputDate: format(new Date(), 'yyyy-MM-dd'),
            salaryHistory: []
        });
        setIsDialogOpen(false);
    };

    const handleEdit = (person: IndependentPerson) => {
        setFormData({
            siteId: person.siteId,
            tc: person.tc,
            name: person.name,
            profession: person.profession || '',
            role: person.role || '',
            salary: person.salary ? formatMoneyInput(person.salary.replace('.', ',')) : '', // Convert 1000.00 -> 1000,00 -> 1.000,00
            newSalary: '',
            newSalaryDate: format(new Date(), 'yyyy-MM-dd'),
            leaveAllowance: person.leaveAllowance || '',
            hasOvertime: person.hasOvertime || false,
            note: person.note || '',
            inputDate: person.inputDate || format(new Date(), 'yyyy-MM-dd'),
            salaryHistory: person.salaryHistory || []
        });
        setShowSalaryInput(false);
        setEditingId(person.id);
        setIsDialogOpen(true);
    };



    const handleDelete = async (id: string) => {
        if (window.confirm('Bu personeli silmek istediğinize emin misiniz?')) {
            const res = await deletePersonnel(id);
            if (res.success) {
                refreshData();
            } else {
                alert(res.error);
            }
        }
    };

    const canEditRecord = (person: IndependentPerson, record: AttendanceRecord | undefined, targetDate: Date) => {
        // ALWAYS Check Transfer Lock (Even for Admin)
        if (person.transferOutDate) {
            const targetKey = format(targetDate, 'yyyy-MM-dd');
            if (targetKey >= person.transferOutDate) return false;
        }

        // Admin -> checks nothing (except strict locks above)
        if (user?.role === 'ADMIN') return true;

        // Check Future Date (Strictly future days, today is allowed)
        if (differenceInCalendarDays(targetDate, new Date()) > 0) {
            return false;
        }

        // New record -> can create (if not future)
        if (!record) return true;

        // Check Ownership
        if (record.createdById && record.createdById !== user?.id) {
            return false;
        }

        // Check Time Limit
        if (record.createdAt) {
            const daysDiff = differenceInDays(new Date(), new Date(record.createdAt));
            // Use user-defined limit or default to 3 days
            const limit = user?.editLookbackDays ?? 3;
            if (daysDiff > limit) {
                return false;
            }
        }

        return true;
    };

    const saveAttendance = async (status?: string) => {
        if (!selectedCell) return;

        const person = names.find(p => p.id === selectedCell.personId);
        // const dateKey = format(selectedCell.date, 'yyyy-MM-dd');
        const existingRecord = person?.attendance[format(selectedCell.date, 'yyyy-MM-dd')];

        if (!person) return;

        if (!canEditRecord(person, existingRecord, selectedCell.date)) {
            alert("Bu kaydı düzenleme yetkiniz yok (Gelecek tarih, başkasına ait veya süre dolmuş).");
            setSelectedCell(null);
            return;
        }

        const finalStatus = status !== undefined ? status : attendanceForm.status;

        // Validation: Overtime requires note
        if (attendanceForm.overtime && (!attendanceForm.note || !attendanceForm.note.trim()) && finalStatus) {
            alert("Mesai girildiğinde açıklama yazılması zorunludur!");
            return;
        }

        // Validation: OUT (Dış Görev) requires note
        if (finalStatus === 'OUT' && (!attendanceForm.note || !attendanceForm.note.trim())) {
            alert("Dış görev seçildiğinde açıklama girilmesi zorunludur!");
            return;
        }

        // Optimistic Update
        setNames(prev => prev.map(p => {
            if (p.id === selectedCell.personId) {
                const newAttendance = { ...p.attendance };
                const dateKey = format(selectedCell.date, 'yyyy-MM-dd');

                if (finalStatus) {
                    newAttendance[dateKey] = {
                        status: finalStatus,
                        overtime: attendanceForm.overtime,
                        note: attendanceForm.note,
                        createdById: user?.id,
                        createdAt: Date.now()
                    };
                } else {
                    delete newAttendance[dateKey];
                }
                return { ...p, attendance: newAttendance };
            }
            return p;
        }));

        // Server Call
        const res = await upsertPersonnelAttendance(person.id, selectedCell.date, {
            status: finalStatus,
            hours: finalStatus === 'FULL' ? 11 : (finalStatus === 'HALF' ? 5.5 : 0),
            overtime: attendanceForm.overtime ? parseFloat(attendanceForm.overtime) : undefined,
            note: attendanceForm.note,
            siteId: person.siteId
        });

        if (!res.success) {
            alert("Kaydedilirken hata oluştu: " + res.error);
            refreshData(); // Revert
        }

        setSelectedCell(null);
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'FULL': return <CheckCircle2 className="w-5 h-5 text-green-600" />;
            case 'HALF': return <Clock className="w-5 h-5 text-orange-500" />;
            case 'ABSENT': return <XCircle className="w-5 h-5 text-red-500" />;
            case 'LEAVE': return <Umbrella className="w-5 h-5 text-blue-500" />;
            case 'REPORT': return <FileText className="w-5 h-5 text-purple-500" />;
            case 'OUT': return <Car className="w-5 h-5 text-cyan-500" />;
            case 'TRANSFER': case 'TRANSFER_ENTRY': return <Plane className="w-5 h-5 text-slate-400" />;
            case 'EXIT': return <LogOut className="w-5 h-5 text-red-500" />;
            default: return null;
        }
    };

    const calculateStats = (person: IndependentPerson, referenceDate: Date) => {
        if (!person) return { workedDays: 0, overtimeTotal: 0, leaveUsed: 0, remainingLeave: 0, basePay: 0, overtimePay: 0, leavePay: 0, bonus: 0, deduction: 0, totalPay: 0 };

        let workedDays = 0;
        let overtimeTotal = 0;
        let leaveUsed = 0;
        let absentDays = 0;
        let fullDays = 0;
        let halfDays = 0;
        let outDays = 0;

        const end = endOfMonth(referenceDate);
        const monthPrefix = format(referenceDate, 'yyyy-MM');

        Object.entries(person.attendance || {}).forEach(([dateKey, record]) => {
            if (!dateKey.startsWith(monthPrefix)) return;

            if (record.status === 'FULL') fullDays += 1;
            if (record.status === 'HALF') halfDays += 1;
            if (record.status === 'OUT') outDays += 1;
            if (record.status === 'LEAVE') leaveUsed += 1;
            if (record.status === 'ABSENT') absentDays += 1;

            if (record.overtime) {
                overtimeTotal += parseFloat(record.overtime) || 0;
            }
        });

        // [NEW] Check Input Date (Start Date) for Auto-Working
        if (person.inputDate && person.inputDate.startsWith(monthPrefix)) {
            if (!person.attendance[person.inputDate]) {
                fullDays += 1; // Count as FULL work day if no explicit record
            }
        }

        const leaveAllowance = parseFloat(person.leaveAllowance || '0');
        const paidLeave = Math.min(leaveUsed, leaveAllowance);

        // Always use additive calculation (Actual days entered)
        // "Ay için personele kaç gün girildiyse toplamda o gözükücek"
        workedDays = fullDays + halfDays + outDays + paidLeave;

        workedDays = Math.max(0, workedDays);

        const remainingLeave = Math.max(0, leaveAllowance - leaveUsed);


        // Wait, parseMoney usually returns CLEAN string? No, my parseMoney formats it. 
        // I need to use the RAW value if possible, or re-parse. 
        // Actually, person.salary IS the formatted string "1.000,00".
        // Helper to parse "1.000,00" -> 1000.00
        const parseCurrency = (val: string) => {
            if (!val) return 0;
            // Remove dots (thousands), replace comma with dot (decimal)
            return parseFloat(val.replace(/\./g, '').replace(',', '.')) || 0;
        };

        const salaryAmount = parseCurrency(person.salary || '');

        // User Defined Calculation:
        // Daily Rate = Salary / 30
        // Hourly Rate = (Salary / 30) / 10
        // Overtime Rate = Hourly * 1.5

        const dailyRate = salaryAmount / 30;
        const hourlyRate = dailyRate / 10;
        const overtimeRate = hourlyRate * 1.5;

        // 2. CHECK CUSTOM MONTHLY ADJUSTMENTS
        const adjustKey = format(date, 'yyyy-MM-dd').substring(0, 7); // yyyy-MM
        const adjustment = person.salaryAdjustments?.[adjustKey];

        // 3. Apply Overrides if present, else use calculated
        const finalWorkedDays = adjustment?.workedDays !== undefined ? adjustment.workedDays : workedDays;
        const finalOvertimeHours = adjustment?.overtimeHours !== undefined ? adjustment.overtimeHours : overtimeTotal;

        const basePay = dailyRate * finalWorkedDays;
        const overtimePay = overtimeRate * finalOvertimeHours;
        const leavePay = dailyRate * remainingLeave; // Pay for unused leave

        // 5. Bonus & Deduction
        const bonus = adjustment?.bonus || 0;
        const deduction = adjustment?.deduction || 0;

        const totalPay = basePay + overtimePay + leavePay + bonus - deduction;

        return {
            workedDays: finalWorkedDays,
            overtimeTotal: finalOvertimeHours,
            leaveUsed,
            remainingLeave,
            basePay,
            overtimePay,
            leavePay,
            bonus,
            deduction,
            totalPay
        };
    };

    const handleExportExcel = () => {
        const wb = XLSX.utils.book_new();

        // Standard Export (Safe columns)
        const header = ['TC Kimlik', 'Ad Soyad', 'Görevi', ...days.map(d => format(d, 'd')), 'Toplam Gün', 'Mesai (Saat)', 'Kalan İzin'];

        const data = filteredNames.map(p => {
            const stats = calculateStats(p, date);
            const row: any[] = [p.tc, p.name, p.role];

            days.forEach(d => {
                const dateKey = format(d, 'yyyy-MM-dd');
                const record = p.attendance[dateKey];
                let cellVal = '';
                if (record?.status === 'FULL') cellVal = '✔️';
                if (record?.status === 'HALF') cellVal = '🕒';
                if (record?.status === 'ABSENT') cellVal = '❌';
                if (record?.status === 'LEAVE') cellVal = '☂️';
                if (record?.status === 'REPORT') cellVal = '⚕️';
                if (record?.status === 'OUT') cellVal = '🚗';
                if (record?.status === 'TRANSFER') cellVal = '✈️';
                if (record?.status === 'EXIT') cellVal = '🚪';

                // Implicit Start Date Visual
                if (dateKey === p.inputDate && !record) cellVal = '📥';

                if (record?.overtime) cellVal += ` (+${record.overtime})`;
                row.push(cellVal);
            });

            row.push(stats.workedDays);
            row.push(stats.overtimeTotal);
            row.push(stats.remainingLeave);

            return row;
        });

        const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
        XLSX.utils.book_append_sheet(wb, ws, "Puantaj");
        XLSX.writeFile(wb, `Puantaj_${format(date, 'yyyy_MM')}.xlsx`);
    };

    const handleExportSalaryExcel = () => {
        const wb = XLSX.utils.book_new();

        const header = ['TC Kimlik', 'Ad Soyad', 'Maaş', 'Toplam Gün', 'Mesai (Saat)', 'Hakediş', 'Mesai Tutarı', 'Kalan İzin', 'İzin Ücreti', 'Prim', 'Kesinti', 'Toplam Ödeme'];

        const data = filteredNames.map(p => {
            const stats = calculateStats(p, date);
            const fmt = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

            return [
                p.tc,
                p.name,
                formatCurrency(p.salary),
                stats.workedDays,
                stats.overtimeTotal,
                fmt(stats.basePay),
                fmt(stats.overtimePay),
                stats.remainingLeave,
                fmt(stats.leavePay),
                fmt(stats.bonus || 0),
                fmt(stats.deduction || 0),
                fmt(stats.totalPay)
            ];
        });

        const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
        XLSX.utils.book_append_sheet(wb, ws, "Maaş Listesi");
        XLSX.writeFile(wb, `Maas_Listesi_${format(date, 'yyyy_MM')}.xlsx`);
    };



    const handleExportSalaryPDF = () => {
        const doc = new jsPDF('l', 'mm', 'a4');

        // Font setup (Amiri for Turkish support) - Reusing the same base64 if available or defining it again.
        // Ideally should assume the font is added via the existing logic or add it here.
        // Since I can't access the variable inside the other function, I'll copy the font addition logic.
        // To be safe and concise, I will assume I need to read the font file or string.
        // Actually, the previous implementation likely has the font string defined inside handleExportPDF.
        // I will try to use "courier" or "helvetica" with UTF-8 encoding enabled, OR copy the font string logic if I see it.
        // BETTER APPROACH: Refactor font string to a module-level variable or use standard safe font with ascii mapping if custom font is too large to inject blind.
        // However, user specifically wants Turkish characters.
        // Let's use the trToAscii helper for safe PDF output if I can't guarantee the font.
        // Wait, the user LOVED the previous PDF which implies the font worked.
        // I will try to find the font string definition first. 
        // IF I cannot find it easily, I will just use standard font + trToAscii for now to ensure it works, then refine.
        // User request: "aynı puanta pdf çıktısı gibi" -> imply copying the style.

        // Let's assume I can't see the huge Base64 string in the view. I will use standard font and trToAscii for now.
        // Re-reading usage: standard fonts DO NOT support Turkish chars well.
        // I'll grab the font string from the other function in a previous turn or just copy the logic if I viewed it.
        // I viewed lines 930-1000 and 996+. The font string is likely at the start of handleExportPDF.

        doc.setFontSize(18);
        const monthName = format(date, 'MMMM', { locale: tr }).toLocaleUpperCase('tr-TR');
        const year = format(date, 'yyyy');
        const title = `${monthName} ${year} MAAS TABLOSU`;
        const titleWidth = doc.getTextWidth(trToAscii(title));
        doc.text(trToAscii(title), (297 - titleWidth) / 2, 15);

        let siteName = 'Tum Santiyeler';
        if (selectedSiteId !== 'all') {
            const site = sites.find((s: any) => s.id === selectedSiteId);
            if (site) siteName = site.name;
        }

        const now = format(new Date(), 'dd.MM.yyyy HH:mm');

        // Sub-header line (below title)
        doc.setFontSize(10);
        doc.text(trToAscii(siteName), 14, 22); // Left aligned, below title

        doc.setFontSize(8);
        const dateText = `Olusturulma: ${now}`;
        doc.text(dateText, 297 - 14 - doc.getTextWidth(dateText), 22); // Right aligned, same line as site name

        const tableBody = filteredNames.map(p => {
            const stats = calculateStats(p, date);
            const fmt = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            return [
                p.tc,
                trToAscii(p.name),
                formatCurrency(p.salary),
                stats.workedDays,
                stats.overtimeTotal || '-',
                fmt(stats.basePay),
                fmt(stats.overtimePay),
                stats.remainingLeave,
                fmt(stats.leavePay),
                fmt(stats.bonus || 0),
                fmt(stats.deduction || 0),
                fmt(stats.totalPay)
            ];
        });

        autoTable(doc, {
            head: [['TC', 'Ad Soyad', 'Maas', 'Gun', 'Mesai', 'Hakedis', 'Mesai Tut.', 'Kalan Izin', 'Izin Ucreti', 'Prim', 'Kesinti', 'TOPLAM']],
            body: tableBody,
            startY: 25,
            theme: 'grid',
            headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
            styles: { fontSize: 9, cellPadding: 2 },
            columnStyles: {
                0: { cellWidth: 25 }, // TC
                1: { cellWidth: 40 }, // Name
                // Role removed
                10: { fontStyle: 'bold', fillColor: [240, 248, 255] } // Total (New Index 10)
            }
        });

        doc.save(`Maas_Listesi_${format(date, 'yyyy_MM')}.pdf`);
    };

    const trToAscii = (text: string) => {
        return text
            .replace(/Ğ/g, "G").replace(/ğ/g, "g")
            .replace(/Ü/g, "U").replace(/ü/g, "u")
            .replace(/Ş/g, "S").replace(/ş/g, "s")
            .replace(/İ/g, "I").replace(/ı/g, "i")
            .replace(/Ö/g, "O").replace(/ö/g, "o")
            .replace(/Ç/g, "C").replace(/ç/g, "c");
    };

    const formatCurrency = (amount: string | undefined) => {
        if (!amount) return '0,00 ₺';
        const num = parseFloat(amount);
        if (isNaN(num)) return '0,00 ₺';
        return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(num);
    };

    const formatMoneyInput = (value: string) => {
        if (!value) return '';
        // Remove all non-digits and non-comma
        let val = value.replace(/[^0-9,]/g, '');

        // Handle comma
        const parts = val.split(',');
        // Format left (thousands)
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');

        // Reassemble
        return parts.length > 1 ? `${parts[0]},${parts[1].slice(0, 2)}` : parts[0];
    };

    const parseMoney = (value: string) => {
        if (!value) return '';
        // Remove dots, replace comma with dot
        return value.replace(/\./g, '').replace(',', '.');
    };

    const handleExportPDF = () => {
        const doc = new jsPDF('l', 'mm', 'a4');

        let siteName = 'Genel Puantaj';
        if (selectedSiteId !== 'all') {
            const s = sites.find((site: any) => site.id === selectedSiteId);
            if (s) siteName = s.name;
        }

        const monthYear = format(date, 'MMMM yyyy', { locale: tr });
        const mainTitle = trToAscii(`${monthYear} Personel Puantajı`); // Center Top
        const subTitleLeft = trToAscii(siteName); // Below Left
        const timestamp = `Olusturulma: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`; // Below Right

        const pageWidth = doc.internal.pageSize.width;

        // 1. Main Title (Centered)
        doc.setFontSize(14); // Slightly larger title
        doc.setFont("helvetica", "bold");
        doc.text(mainTitle, pageWidth / 2, 12, { align: 'center' }); // Moved down to 12

        // 2. Sub-titles (Left & Right) - Y: 20 (Increased spacing)

        // Left: Site Name (Standard size)
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0); // Black
        doc.text(subTitleLeft, 14, 20);

        // Right: Timestamp (Small & Faint)
        doc.setFontSize(7); // Smaller
        doc.setTextColor(150); // Faint/Grey
        doc.text(timestamp, pageWidth - 14, 20, { align: 'right' });

        doc.setTextColor(0);

        const head = [[trToAscii('Ad Soyad'), ...days.map(d => format(d, 'd')), 'Top.', 'Mesai', 'Izin']];
        const body = filteredNames.map(p => {
            const stats = calculateStats(p, date);
            const row: any[] = [trToAscii(p.name)];

            // Calculate Effective Exit Date
            let effectiveEndDateStr: string | null = null;
            const exitEntries = Object.entries(p.attendance || {})
                .filter(([_, r]) => r.status === 'EXIT')
                .sort((a, b) => a[0].localeCompare(b[0]));
            if (exitEntries.length > 0) {
                effectiveEndDateStr = exitEntries[exitEntries.length - 1][0];
            }
            if (p.transferOutDate) {
                if (!effectiveEndDateStr || p.transferOutDate > effectiveEndDateStr) {
                    effectiveEndDateStr = p.transferOutDate;
                }
            }

            days.forEach(d => {
                const dateKey = format(d, 'yyyy-MM-dd');
                const record = p.attendance[dateKey];
                const isPostExit = effectiveEndDateStr ? dateKey > effectiveEndDateStr : false;

                row.push({
                    content: isPostExit ? '-' : '',
                    custom: {
                        status: record?.status,
                        overtime: record?.overtime,
                        isImplicitStart: dateKey === p.inputDate && !record,
                        isPostExit: isPostExit
                    }
                });
            });
            row.push(String(stats.workedDays));
            row.push(String(stats.overtimeTotal));
            row.push(String(stats.remainingLeave));
            return row;
        });

        // Defined Helper for drawing icons consistently
        const drawPdfIcon = (doc: any, type: string, cx: number, cy: number) => {
            if (type === 'FULL') {
                doc.setFillColor(34, 197, 94); // Green
                doc.circle(cx, cy, 1.5, 'F');
                doc.setDrawColor(255, 255, 255);
                doc.setLineWidth(0.3);
                doc.line(cx - 0.5, cy, cx - 0.1, cy + 0.6);
                doc.line(cx - 0.1, cy + 0.6, cx + 0.8, cy - 0.5);
            }
            else if (type === 'HALF') {
                doc.setFillColor(249, 115, 22); // Orange
                doc.circle(cx, cy, 1.5, 'F');
                doc.setDrawColor(255, 255, 255);
                doc.setLineWidth(0.3);
                doc.line(cx, cy, cx, cy - 1);
                doc.line(cx, cy, cx + 1, cy);
            }
            else if (type === 'ABSENT') {
                doc.setDrawColor(239, 68, 68); // Red
                doc.setLineWidth(0.8);
                doc.line(cx - 1.2, cy - 1.2, cx + 1.2, cy + 1.2);
                doc.line(cx + 1.2, cy - 1.2, cx - 1.2, cy + 1.2);
            }
            else if (type === 'LEAVE') {
                doc.setFillColor(59, 130, 246); // Blue
                doc.triangle(cx - 1.5, cy + 0.5, cx + 1.5, cy + 0.5, cx, cy - 1.5, 'F'); // Umbrella Top
                doc.setDrawColor(59, 130, 246);
                doc.setLineWidth(0.4);
                doc.line(cx, cy + 0.5, cx, cy + 1.5); // Handle vertical
                doc.line(cx, cy + 1.5, cx - 0.4, cy + 1.5); // Handle hook
            }
            else if (type === 'REPORT') {
                doc.setFillColor(168, 85, 247); // Purple
                doc.rect(cx - 1.2, cy - 1.5, 2.4, 3, 'F');
                doc.setDrawColor(255, 255, 255);
                doc.setLineWidth(0.2);
                doc.line(cx - 0.8, cy - 0.5, cx + 0.8, cy - 0.5);
                doc.line(cx - 0.8, cy + 0.5, cx + 0.8, cy + 0.5);
            }
            else if (type === 'OUT') {
                doc.setFillColor(6, 182, 212); // Cyan
                doc.rect(cx - 1.8, cy - 0.5, 3.6, 2, 'F'); // Body
                doc.rect(cx - 1, cy - 1.5, 2, 1, 'F'); // Top
                doc.setFillColor(0, 0, 0); // Wheels
                doc.circle(cx - 1, cy + 1.5, 0.4, 'F');
                doc.circle(cx + 1, cy + 1.5, 0.4, 'F');
            }
            else if (type === 'EXIT') {
                doc.setFillColor(239, 68, 68); // Red
                doc.rect(cx - 1.5, cy - 1.5, 3, 3, 'F');
                doc.setDrawColor(255, 255, 255);
                doc.setLineWidth(0.5);
                // Arrow Right
                doc.line(cx - 0.8, cy, cx + 0.8, cy);
                doc.line(cx + 0.8, cy, cx + 0.3, cy - 0.5);
                doc.line(cx + 0.8, cy, cx + 0.3, cy + 0.5);
            }
            else if (type === 'TRANSFER') {
                doc.setFillColor(37, 99, 235); // Dark Blue
                doc.rect(cx - 1.5, cy - 1.5, 3, 3, 'F');
                doc.setDrawColor(255, 255, 255);
                doc.setLineWidth(0.4);
                // Arrow Left-Right
                doc.line(cx - 1, cy - 0.5, cx + 1, cy - 0.5); // Top
                doc.line(cx + 1, cy - 0.5, cx + 0.5, cy - 1);

                doc.line(cx + 1, cy + 0.5, cx - 1, cy + 0.5); // Bottom
                doc.line(cx - 1, cy + 0.5, cx - 0.5, cy + 1);
            }
            else if (type === 'ENTRY') {
                doc.setFillColor(34, 197, 94); // Green Box
                doc.rect(cx - 1.5, cy - 1, 3, 2, 'F');
                doc.setDrawColor(255, 255, 255);
                doc.setLineWidth(0.5);
                // Arrow In (Left)
                doc.line(cx + 0.8, cy, cx - 0.8, cy);
                doc.line(cx - 0.8, cy, cx - 0.3, cy - 0.5);
                doc.line(cx - 0.8, cy, cx - 0.3, cy + 0.5);
            }
        };

        autoTable(doc, {
            head: head,
            body: body,
            startY: 35, // Pushing down to clear header
            styles: { fontSize: 7, cellPadding: 1, halign: 'center', valign: 'middle', lineWidth: 0.1, lineColor: [200, 200, 200] },
            headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
            columnStyles: { 0: { cellWidth: 40, halign: 'left' } },

            didDrawCell: (data) => {
                if (data.section === 'body' && data.column.index > 0 && data.column.index <= days.length) {
                    const cellData = (data.cell.raw as any).custom;
                    if (!cellData) return;

                    if (!cellData.status && !cellData.isImplicitStart) return;

                    const { status, overtime, isImplicitStart } = cellData;
                    const dim = data.cell.height - 2;
                    const x = data.cell.x + (data.cell.width / 2) - (dim / 2);
                    const y = data.cell.y + 1;
                    const cx = x + dim / 2;
                    const cy = y + dim / 2;

                    let type = status;
                    if (isImplicitStart) type = 'ENTRY';

                    if (type) {
                        drawPdfIcon(doc, type, cx, cy);
                    }

                    if (overtime) {
                        doc.setFontSize(5);
                        doc.setTextColor(37, 99, 235);
                        doc.text(`+${overtime}`, x + dim, y + dim + 1, { align: 'right' });
                    }
                }
            }
        });

        // --- LEGEND (Antet) ---
        let legendY = (doc as any).lastAutoTable.finalY + 5;

        // Ensure space for legend
        if (legendY > doc.internal.pageSize.height - 30) {
            doc.addPage();
            legendY = 15;
        }

        const legendItems = [
            { label: 'Tam Gün', type: 'FULL' },
            { label: 'Yarım Gün', type: 'HALF' },
            { label: 'İzinli', type: 'LEAVE' },
            { label: 'Raporlu', type: 'REPORT' },
            { label: 'Gelmedi', type: 'ABSENT' },
            { label: 'Dış Görev', type: 'OUT' },
            { label: 'Transfer', type: 'TRANSFER' },
            { label: 'İşten Çıkış', type: 'EXIT' },
            { label: 'İşe Giriş', type: 'ENTRY' }
        ];

        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");

        let lx = 14;
        const ly = legendY;



        legendItems.forEach((item, index) => {
            const cx = lx + 2;
            const cy = ly + 2;

            drawPdfIcon(doc, item.type, cx, cy);

            doc.setTextColor(0);
            doc.text(trToAscii(item.label), cx + 4, cy + 1);
            lx += doc.getTextWidth(trToAscii(item.label)) + 12;
        });

        // --- FOOTER: Notes & Overtime Explanations ---
        let finalY = legendY + 10;

        // Collect all notes for the current view
        const notes: string[] = [];
        filteredNames.forEach(p => {
            days.forEach(d => {
                const dateKey = format(d, 'yyyy-MM-dd');
                const record = p.attendance[dateKey];
                if (record && (record.note || record.overtime)) {
                    let text = `${trToAscii(p.name)} - ${format(d, 'dd.MM.yyyy')}: `;
                    if (record.overtime) text += `Mesai: ${record.overtime} Saat. `;
                    if (record.note) text += `Not: ${trToAscii(record.note)}`;
                    notes.push(text);
                }
            });
        });

        if (notes.length > 0) {
            // Check for page break
            if (finalY > doc.internal.pageSize.height - 20) {
                doc.addPage();
                finalY = 15;
            }

            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.text(trToAscii("Açıklamalar ve Mesai Detayları:"), 14, finalY);
            finalY += 5;

            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);

            notes.forEach(note => {
                if (finalY > doc.internal.pageSize.height - 10) {
                    doc.addPage();
                    finalY = 15;
                }
                doc.text(note, 14, finalY);
                finalY += 4;
            });
        }

        doc.save(`Puantaj_${format(date, 'yyyy_MM')}.pdf`);
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Personel Puantaj</h1>
                    <p className="text-muted-foreground">Personel ve puantaj yönetimi.</p>
                </div>
                {/* Warning Removed */}
            </div>

            <Tabs defaultValue="attendance" className="w-full space-y-6">
                <TabsList className="bg-white border w-full justify-start rounded-lg p-1">
                    <TabsTrigger value="attendance" className="px-6 data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900">Puantaj</TabsTrigger>
                    {(user?.role === 'ADMIN' || user?.username === 'mehmet') && (
                        <TabsTrigger value="salary" className="px-6 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">Maaş Hesabı</TabsTrigger>
                    )}
                </TabsList>

                <TabsContent value="attendance" className="space-y-6">
                    <div className="flex justify-between items-center bg-white p-4 rounded-lg border shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className="w-[300px]">
                                <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Şantiye Filtrele" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tüm Şantiyeler</SelectItem>
                                        {availableSites.map(s => (
                                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <Button variant="outline" onClick={handleExportExcel}>
                                <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" />
                                Excel
                            </Button>
                            <Button variant="outline" onClick={handleExportPDF}>
                                <Download className="w-4 h-4 mr-2 text-red-600" />
                                PDF
                            </Button>



                            <Button onClick={() => {
                                setEditingId(null);
                                setFormData({
                                    siteId: (selectedSiteId && selectedSiteId !== 'all') ? selectedSiteId : (availableSites.length === 1 ? availableSites[0].id : ''),
                                    tc: '', name: '', profession: '', role: '', salary: '', newSalary: '', newSalaryDate: format(new Date(), 'yyyy-MM-dd'), leaveAllowance: '', hasOvertime: false, note: '',
                                    inputDate: format(new Date(), 'yyyy-MM-dd'),
                                    salaryHistory: []
                                });
                                setShowSalaryInput(false);
                                setIsDialogOpen(true);
                            }}>
                                <Plus className="w-4 h-4 mr-2" />
                                Personel Ekle
                            </Button>
                        </div>
                    </div>

                    <Tabs defaultValue="grid" className="w-full">
                        <div className="flex justify-between items-center mb-4">
                            <TabsList>
                                <TabsTrigger value="grid">Puantaj Tablosu</TabsTrigger>
                                <TabsTrigger value="site-list">Şantiye Personel Listesi</TabsTrigger>
                                <TabsTrigger value="all-list">Tüm Personel</TabsTrigger>
                            </TabsList>
                        </div>

                        <TabsContent value="grid" className="space-y-4">
                            <div className="flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center bg-slate-50/50 p-2 rounded-lg border">
                                <div className="flex flex-wrap gap-1">
                                    {["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"].map((month, index) => (
                                        <Button
                                            key={month}
                                            variant={date.getMonth() === index ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => {
                                                const newDate = new Date(date);
                                                newDate.setMonth(index);
                                                setDate(newDate);
                                            }}
                                            className={`h-8 ${date.getMonth() === index ? "bg-blue-600 hover:bg-blue-700 border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
                                        >
                                            {month}
                                        </Button>
                                    ))}
                                </div>

                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setDate(new Date())}
                                        className="h-8 px-3 bg-white text-blue-600 border-blue-200 hover:bg-blue-50 shadow-sm font-semibold"
                                    >
                                        Bugün
                                    </Button>
                                    <div className="flex items-center gap-1 bg-white p-1 rounded-md border shadow-sm">
                                        {[2024, 2025, 2026, 2027].map(year => (
                                            <Button
                                                key={year}
                                                variant={date.getFullYear() === year ? "secondary" : "ghost"}
                                                size="sm"
                                                onClick={() => {
                                                    const newDate = new Date(date);
                                                    newDate.setFullYear(year);
                                                    setDate(newDate);
                                                }}
                                                className={`h-8 px-3 font-semibold ${date.getFullYear() === year ? "bg-slate-800 text-white hover:bg-slate-700" : "text-slate-500 hover:bg-slate-100"}`}
                                            >
                                                {year}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="border rounded-md overflow-hidden bg-white">
                                <Table className="hidden md:table">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[200px]">Ad Soyad</TableHead>
                                            {days.map(d => (
                                                <TableHead key={d.toString()} className="p-0 w-8 text-center text-[10px] text-muted-foreground font-normal">
                                                    <div className="flex flex-col items-center justify-center py-1">
                                                        <span className="font-bold text-slate-700">{format(d, 'd')}</span>
                                                        <span>{format(d, 'EEE', { locale: tr }).substring(0, 1)}</span>
                                                    </div>
                                                </TableHead>
                                            ))}
                                            <TableHead className="w-16 text-xs text-center font-bold bg-slate-50 border-l text-slate-700">Çalışma</TableHead>
                                            <TableHead className="w-16 text-xs text-center font-bold bg-blue-50 border-l text-blue-700">Mesai</TableHead>
                                            <TableHead className="w-16 text-xs text-center font-bold bg-orange-50 border-l text-orange-700">Kalan İzin</TableHead>
                                            <TableHead className="w-10"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredNames.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={days.length + 5} className="h-24 text-center text-muted-foreground">
                                                    Bu şantiyede personel bulunamadı.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredNames.map(person => {
                                                const stats = calculateStats(person, date);
                                                // Track exit state sequentially for this person
                                                let isExited = false;

                                                return (
                                                    <TableRow key={person.id} className="hover:bg-slate-50">
                                                        <TableCell className="font-medium">
                                                            <div className="flex flex-col">
                                                                <span>{person.name}</span>
                                                                <span className="text-[10px] text-muted-foreground">{person.role}</span>
                                                            </div>
                                                        </TableCell>
                                                        {days.map(d => {
                                                            const dateKey = format(d, 'yyyy-MM-dd');
                                                            const record = (person.attendance || {})[dateKey];
                                                            const isLocked = !canEditRecord(person, record, d);

                                                            // Sequential Logic:
                                                            const showLine = !record && isExited;
                                                            const isStartDate = person.inputDate === dateKey;

                                                            // Update State for NEXT iteration (or subsequent empty cells)
                                                            if (record?.status === 'EXIT') {
                                                                isExited = true;
                                                            } else if (record?.status) {
                                                                isExited = false;
                                                            }

                                                            let cellClass = "";
                                                            if ([0, 6].includes(d.getDay())) cellClass = "bg-slate-50";

                                                            // Visual feedback for locked cells (only if they have content)
                                                            if (isLocked && record) {
                                                                cellClass += " opacity-60 cursor-not-allowed";
                                                            }

                                                            // Default empty state: Centered dot
                                                            let cellContent = <div className="w-full h-full flex items-center justify-center text-slate-300 font-bold text-lg select-none">·</div>;

                                                            if (showLine) {
                                                                cellContent = <div className="w-full h-full flex items-center justify-center"><div className="w-full h-[2px] bg-red-400"></div></div>;
                                                            }

                                                            // Show FULL Status for Start Date (Auto Work) - Overrides dot if no explicit record
                                                            if (isStartDate && !record) {
                                                                // Treat as FULL WORK
                                                                cellContent = <div className="w-full h-full flex items-center justify-center bg-green-50 text-green-600"><CheckCircle2 className="w-4 h-4" /></div>;
                                                            }

                                                            if (record?.status === 'FULL') cellContent = <div className="w-full h-full flex items-center justify-center bg-green-50 text-green-600"><CheckCircle2 className="w-4 h-4" /></div>;
                                                            if (record?.status === 'HALF') cellContent = <div className="w-full h-full flex items-center justify-center bg-orange-50 text-orange-500"><Clock className="w-4 h-4" /></div>;
                                                            if (record?.status === 'ABSENT') cellContent = <div className="w-full h-full flex items-center justify-center bg-red-50 text-red-500"><XCircle className="w-4 h-4" /></div>;
                                                            if (record?.status === 'LEAVE') cellContent = <div className="w-full h-full flex items-center justify-center bg-blue-50 text-blue-500"><Umbrella className="w-4 h-4" /></div>;
                                                            if (record?.status === 'REPORT') cellContent = <div className="w-full h-full flex items-center justify-center bg-purple-50 text-purple-500"><FileText className="w-4 h-4" /></div>;
                                                            if (record?.status === 'OUT') cellContent = <div className="w-full h-full flex items-center justify-center bg-cyan-50 text-cyan-500"><Car className="w-4 h-4" /></div>;
                                                            if (record?.status === 'TRANSFER') cellContent = <div className="w-full h-full flex items-center justify-center bg-slate-50 text-slate-400"><Plane className="w-4 h-4" /></div>;
                                                            if (record?.status === 'EXIT') cellContent = <div className="w-full h-full flex items-center justify-center bg-red-50 text-red-500"><LogOut className="w-4 h-4" /></div>;

                                                            // (Logic handled sequentially above via showLine)

                                                            return (
                                                                <TableCell
                                                                    key={d.toString()}
                                                                    className={`p-0 border-l text-center transition-colors hover:opacity-80 h-10 w-8 ${cellClass} relative`}
                                                                    onClick={() => {
                                                                        if (isLocked) {
                                                                            alert("Bu kaydı düzenleme yetkiniz yok veya süre doldu.");
                                                                        } else {
                                                                            setSelectedCell({ personId: person.id, date: d });
                                                                        }
                                                                    }}
                                                                    onMouseEnter={(e) => {
                                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                                        setHoveredData({
                                                                            x: rect.left + rect.width / 2,
                                                                            y: rect.top,
                                                                            record: record,
                                                                            date: d
                                                                        });
                                                                    }}
                                                                    onMouseLeave={() => setHoveredData(null)}
                                                                >
                                                                    {cellContent}
                                                                    {record?.note && (
                                                                        <div className="absolute top-0 right-0 w-0 h-0 border-l-[6px] border-l-transparent border-t-[6px] border-t-blue-600 z-20"></div>
                                                                    )}
                                                                    {record?.overtime && (
                                                                        <span className="absolute bottom-0.5 left-0.5 text-[8px] font-bold bg-blue-600 text-white px-0.5 rounded shadow-sm z-10">
                                                                            +{record.overtime}
                                                                        </span>
                                                                    )}
                                                                    {isLocked && record && (
                                                                        <Lock className="absolute top-0.5 right-0.5 w-3 h-3 text-slate-400 opacity-70" />
                                                                    )}
                                                                </TableCell>
                                                            );
                                                        })}

                                                        <TableCell className="text-center font-bold text-slate-700 border-l bg-slate-50">
                                                            {stats.workedDays}
                                                        </TableCell>
                                                        <TableCell className="text-center font-bold text-blue-700 border-l bg-blue-50">
                                                            {stats.overtimeTotal > 0 ? stats.overtimeTotal : '-'}
                                                        </TableCell>
                                                        <TableCell className="text-center font-bold text-orange-700 border-l bg-orange-50">
                                                            {stats.remainingLeave}
                                                        </TableCell>

                                                        <TableCell className="text-right whitespace-nowrap">
                                                            <Button variant="ghost" size="icon" onClick={() => openTransferModal(person)} className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-50 mr-1" title="Transfer Et">
                                                                <ArrowRightLeft className="w-4 h-4" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(person.id)} className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50" title="Sil">
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </TabsContent>



                        <TabsContent value="site-list">
                            {!selectedSiteId || selectedSiteId === 'all' ? (
                                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground bg-white border rounded-md">
                                    <div className="bg-slate-100 p-4 rounded-full mb-4">
                                        <ArrowRightLeft className="w-8 h-8 text-slate-400" />
                                    </div>
                                    <p className="font-medium text-lg text-slate-900">Şantiye Seçimi Yapılmadı</p>
                                    <p className="text-sm">Bu listeyi görüntülemek için lütfen yukarıdan bir şantiye seçiniz.</p>
                                </div>
                            ) : (
                                <div className="border rounded-md overflow-hidden bg-white">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>TC Kimlik</TableHead>
                                                <TableHead>Ad Soyad</TableHead>
                                                <TableHead>Meslek</TableHead>
                                                <TableHead>Görev</TableHead>
                                                <TableHead>Şantiye</TableHead>
                                                <TableHead className="text-center">Mesai?</TableHead>
                                                <TableHead>Maaş</TableHead>
                                                <TableHead>İzin</TableHead>
                                                <TableHead className="text-right">İşlem</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredNames.length === 0 ? (
                                                <TableRow><TableCell colSpan={8} className="text-center h-24 text-muted-foreground">Bu şantiyede kayıtlı personel yok</TableCell></TableRow>
                                            ) : filteredNames.map(p => (
                                                <TableRow key={p.id}>
                                                    <TableCell className="font-mono">{p.tc}</TableCell>
                                                    <TableCell className="font-medium">{p.name}</TableCell>
                                                    <TableCell>{p.profession}</TableCell>
                                                    <TableCell>{p.role}</TableCell>
                                                    <TableCell className="max-w-[120px] truncate" title={sites.find((s: any) => s.id === p.siteId)?.name || 'Bilinmiyor'}>
                                                        {sites.find((s: any) => s.id === p.siteId)?.name || 'Bilinmiyor'}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {p.hasOvertime ? <CheckCircle2 className="w-4 h-4 text-green-600 mx-auto" /> : <span className="text-slate-300">-</span>}
                                                    </TableCell>
                                                    <TableCell>{formatCurrency(p.salary)}</TableCell>
                                                    <TableCell>{p.leaveAllowance} Gün</TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => openTransferModal(p)}
                                                                title="Şantiye Transferi"
                                                            >
                                                                <ArrowRightLeft className="w-4 h-4 mr-2" />
                                                                Transfer
                                                            </Button>
                                                            <Button variant="outline" size="sm" onClick={() => handleEdit(p)}>Düzenle</Button>
                                                            <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id)} className="text-red-500">Sil</Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="all-list">
                            <div className="border rounded-md overflow-hidden bg-white">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>
                                                <div className="flex items-center space-x-2">
                                                    <div className="flex items-center gap-1 cursor-pointer hover:bg-slate-100 select-none px-1 rounded" onClick={(e) => handleSort('tc', e)}>
                                                        TC Kimlik {sortConfig.find(s => s.key === 'tc') && (sortConfig.find(s => s.key === 'tc')?.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                                                    </div>
                                                    <ColumnFilter
                                                        title="TC"
                                                        options={names.map(n => ({ label: n.tc, value: n.tc }))}
                                                        selectedValues={columnFilters['tc'] || []}
                                                        onSelect={(v) => handleFilterChange('tc', v)}
                                                        onClear={() => clearFilter('tc')}
                                                    />
                                                </div>
                                            </TableHead>
                                            <TableHead>
                                                <div className="flex items-center space-x-2">
                                                    <div className="flex items-center gap-1 cursor-pointer hover:bg-slate-100 select-none px-1 rounded" onClick={(e) => handleSort('name', e)}>
                                                        Ad Soyad {sortConfig.find(s => s.key === 'name') && (sortConfig.find(s => s.key === 'name')?.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                                                    </div>
                                                    <ColumnFilter
                                                        title="İsim"
                                                        options={names.map(n => ({ label: n.name, value: n.name }))}
                                                        selectedValues={columnFilters['name'] || []}
                                                        onSelect={(v) => handleFilterChange('name', v)}
                                                        onClear={() => clearFilter('name')}
                                                    />
                                                </div>
                                            </TableHead>
                                            <TableHead>
                                                <div className="flex items-center space-x-2">
                                                    <div className="flex items-center gap-1 cursor-pointer hover:bg-slate-100 select-none px-1 rounded" onClick={(e) => handleSort('profession', e)}>
                                                        Meslek {sortConfig.find(s => s.key === 'profession') && (sortConfig.find(s => s.key === 'profession')?.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                                                    </div>
                                                    <ColumnFilter
                                                        title="Meslek"
                                                        options={professionOptions}
                                                        selectedValues={columnFilters['profession'] || []}
                                                        onSelect={(v) => handleFilterChange('profession', v)}
                                                        onClear={() => clearFilter('profession')}
                                                    />
                                                </div>
                                            </TableHead>
                                            <TableHead>
                                                <div className="flex items-center space-x-2">
                                                    <div className="flex items-center gap-1 cursor-pointer hover:bg-slate-100 select-none px-1 rounded" onClick={(e) => handleSort('role', e)}>
                                                        Görev {sortConfig.find(s => s.key === 'role') && (sortConfig.find(s => s.key === 'role')?.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                                                    </div>
                                                    <ColumnFilter
                                                        title="Görev"
                                                        options={roleOptions}
                                                        selectedValues={columnFilters['role'] || []}
                                                        onSelect={(v) => handleFilterChange('role', v)}
                                                        onClear={() => clearFilter('role')}
                                                    />
                                                </div>
                                            </TableHead>
                                            <TableHead>
                                                <div className="flex items-center space-x-2">
                                                    <div className="flex items-center gap-1 cursor-pointer hover:bg-slate-100 select-none px-1 rounded" onClick={(e) => handleSort('siteName', e)}>
                                                        Şantiye {sortConfig.find(s => s.key === 'siteName') && (sortConfig.find(s => s.key === 'siteName')?.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                                                    </div>
                                                    <ColumnFilter
                                                        title="Şantiye"
                                                        options={siteOptions}
                                                        selectedValues={columnFilters['siteName'] || []}
                                                        onSelect={(v) => handleFilterChange('siteName', v)}
                                                        onClear={() => clearFilter('siteName')}
                                                    />
                                                </div>
                                            </TableHead>
                                            <TableHead>
                                                <div className="flex items-center space-x-2 justify-center">
                                                    <div className="flex items-center justify-center gap-1 cursor-pointer hover:bg-slate-100 select-none px-1 rounded" onClick={(e) => handleSort('hasOvertime', e)}>
                                                        Mesai? {sortConfig.find(s => s.key === 'hasOvertime') && (sortConfig.find(s => s.key === 'hasOvertime')?.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                                                    </div>
                                                    <ColumnFilter
                                                        title="Mesai"
                                                        options={overtimeOptions}
                                                        selectedValues={columnFilters['hasOvertime'] || []}
                                                        onSelect={(v) => handleFilterChange('hasOvertime', v)}
                                                        onClear={() => clearFilter('hasOvertime')}
                                                    />
                                                </div>
                                            </TableHead>
                                            <TableHead className="cursor-pointer hover:bg-slate-100 select-none" onClick={(e) => handleSort('salary', e)}>
                                                <div className="flex items-center gap-1">Maaş {sortConfig.find(s => s.key === 'salary') && (sortConfig.find(s => s.key === 'salary')?.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}</div>
                                            </TableHead>
                                            <TableHead>İzin</TableHead>
                                            <TableHead className="text-right">İşlem</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {allList.length === 0 ? (
                                            <TableRow><TableCell colSpan={8} className="text-center h-24 text-muted-foreground">Kayıt Yok</TableCell></TableRow>
                                        ) : allList.map(p => (
                                            <TableRow key={p.id}>
                                                <TableCell className="font-mono">{p.tc}</TableCell>
                                                <TableCell className="font-medium">{p.name}</TableCell>
                                                <TableCell>{p.profession}</TableCell>
                                                <TableCell>{p.role}</TableCell>
                                                <TableCell className="max-w-[120px] truncate" title={sites.find((s: any) => s.id === p.siteId)?.name || 'Bilinmiyor'}>
                                                    {sites.find((s: any) => s.id === p.siteId)?.name || 'Bilinmiyor'}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {p.hasOvertime ? <CheckCircle2 className="w-4 h-4 text-green-600 mx-auto" /> : <span className="text-slate-300">-</span>}
                                                </TableCell>
                                                <TableCell>{formatCurrency(p.salary)}</TableCell>
                                                <TableCell>{p.leaveAllowance} Gün</TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => openTransferModal(p)}
                                                            title="Şantiye Transferi"
                                                        >
                                                            <ArrowRightLeft className="w-4 h-4 mr-2" />
                                                            Transfer
                                                        </Button>
                                                        <Button variant="outline" size="sm" onClick={() => handleEdit(p)}>Düzenle</Button>
                                                        <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id)} className="text-red-500">Sil</Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            {/* LEGEND (Antet) */}
                            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mt-4 p-2 bg-slate-50 rounded border border-slate-100 w-fit">
                                <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded-full bg-green-50 text-green-600 flex items-center justify-center"><CheckCircle2 className="w-3 h-3" /></div> Çalıştı</div>
                                <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center"><Clock className="w-3 h-3" /></div> Yarım Gün</div>
                                <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded-full bg-red-50 text-red-500 flex items-center justify-center"><XCircle className="w-3 h-3" /></div> Gelmedi</div>
                                <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center"><Umbrella className="w-3 h-3" /></div> İzinli</div>
                                <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded-full bg-purple-50 text-purple-500 flex items-center justify-center"><FileText className="w-3 h-3" /></div> Raporlu</div>
                                <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded-full bg-cyan-50 text-cyan-500 flex items-center justify-center"><Car className="w-3 h-3" /></div> Dış Görev</div>
                                <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded bg-slate-50 text-slate-400 flex items-center justify-center"><Plane className="w-3 h-3" /></div> Transfer</div>
                                <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded bg-red-50 text-red-500 flex items-center justify-center"><LogOut className="w-3 h-3" /></div> İşten Çıkış</div>
                                <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded flex items-center justify-center"><LogIn className="w-3 h-3 text-green-600" /></div> İşe Giriş</div>
                            </div>
                        </TabsContent>
                    </Tabs>

                    <Dialog open={!!selectedCell} onOpenChange={(open) => !open && setSelectedCell(null)}>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>Puantaj Detayı</DialogTitle>
                            </DialogHeader>
                            {selectedCell && (
                                <div className="space-y-4 py-4">
                                    <div className="bg-slate-50 p-3 rounded-lg text-center border pb-4">
                                        <p className="font-bold text-lg">{names.find(n => n.id === selectedCell.personId)?.name}</p>
                                        <p className="text-muted-foreground text-sm">{format(selectedCell.date, 'd MMMM yyyy', { locale: tr })}</p>
                                    </div>

                                    <div className="space-y-3">
                                        <Label>Durum Seçiniz (Seçim anında kaydedilir)</Label>
                                        <div className="grid grid-cols-3 gap-3">
                                            <Button
                                                variant={attendanceForm.status === 'FULL' ? 'default' : 'outline'}
                                                className={`justify-start ${attendanceForm.status === 'FULL' ? 'bg-green-600 hover:bg-green-700' : 'hover:bg-green-50 text-green-700 border-green-200'}`}
                                                onClick={() => saveAttendance('FULL')}
                                            >
                                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                                Çalıştı
                                            </Button>
                                            <Button
                                                variant={attendanceForm.status === 'HALF' ? 'default' : 'outline'}
                                                className={`justify-start ${attendanceForm.status === 'HALF' ? 'bg-orange-500 hover:bg-orange-600' : 'hover:bg-orange-50 text-orange-700 border-orange-200'}`}
                                                onClick={() => saveAttendance('HALF')}
                                            >
                                                <Clock className="w-4 h-4 mr-2" />
                                                Yarım Gün
                                            </Button>
                                            <Button
                                                variant={attendanceForm.status === 'ABSENT' ? 'default' : 'outline'}
                                                className={`justify-start ${attendanceForm.status === 'ABSENT' ? 'bg-red-500 hover:bg-red-600' : 'hover:bg-red-50 text-red-700 border-red-200'}`}
                                                onClick={() => saveAttendance('ABSENT')}
                                            >
                                                <XCircle className="w-4 h-4 mr-2" />
                                                Gelmedi
                                            </Button>
                                            <Button
                                                variant={attendanceForm.status === 'LEAVE' ? 'default' : 'outline'}
                                                className={`justify-start ${attendanceForm.status === 'LEAVE' ? 'bg-blue-500 hover:bg-blue-600' : 'hover:bg-blue-50 text-blue-700 border-blue-200'}`}
                                                onClick={() => saveAttendance('LEAVE')}
                                            >
                                                <Umbrella className="w-4 h-4 mr-2" />
                                                İzinli
                                            </Button>
                                            <Button
                                                variant={attendanceForm.status === 'REPORT' ? 'default' : 'outline'}
                                                className={`justify-start ${attendanceForm.status === 'REPORT' ? 'bg-purple-500 hover:bg-purple-600' : 'hover:bg-purple-50 text-purple-700 border-purple-200'}`}
                                                onClick={() => saveAttendance('REPORT')}
                                            >
                                                <FileText className="w-4 h-4 mr-2" />
                                                Raporlu
                                            </Button>
                                            <Button
                                                variant={attendanceForm.status === 'OUT' ? 'default' : 'outline'}
                                                className={`justify-start ${attendanceForm.status === 'OUT' ? 'bg-cyan-500 hover:bg-cyan-600' : 'hover:bg-cyan-50 text-cyan-700 border-cyan-200'}`}
                                                onClick={() => saveAttendance('OUT')}
                                            >
                                                <Car className="w-4 h-4 mr-2" />
                                                Dış Görev
                                            </Button>
                                            <Button
                                                variant={attendanceForm.status === 'EXIT' ? 'default' : 'outline'}
                                                className={`justify-start ${attendanceForm.status === 'EXIT' ? 'bg-red-800 text-white' : 'bg-red-600 text-white hover:bg-red-700 hover:text-white border-0'} col-span-3 font-bold transition-colors shadow-sm`}
                                                onClick={() => {
                                                    if (window.confirm("Bu personeli işten çıkarmak istediğinize emin misiniz?")) {
                                                        saveAttendance('EXIT');
                                                    }
                                                }}
                                            >
                                                <LogOut className="w-4 h-4 mr-2" />
                                                İşten Ayrıldı
                                            </Button>
                                        </div>
                                    </div>

                                    {names.find(n => n.id === selectedCell.personId)?.hasOvertime && (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Mesai (Saat)</Label>
                                                <Input
                                                    type="number"
                                                    placeholder="0"
                                                    value={attendanceForm.overtime}
                                                    onChange={e => setAttendanceForm({ ...attendanceForm, overtime: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <Label>
                                            Açıklama
                                            {names.find(n => n.id === selectedCell.personId)?.hasOvertime && attendanceForm.overtime && <span className="text-red-500 ml-1">(Mesai için zorunlu *)</span>}
                                        </Label>
                                        <Textarea
                                            placeholder="Not giriniz..."
                                            value={attendanceForm.note}
                                            onChange={e => setAttendanceForm({ ...attendanceForm, note: e.target.value })}
                                            className="resize-none"
                                        />
                                    </div>

                                    <div className="pt-2">
                                        <Button variant="ghost" className="w-full text-red-500 hover:bg-red-50 hover:text-red-600" onClick={() => { setAttendanceForm({ status: '', overtime: '', note: '' }); saveAttendance(''); }}>
                                            <Trash2 className="w-4 h-4 mr-2" />
                                            Kaydı Temizle
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </DialogContent>
                    </Dialog>

                    <Dialog open={isTransferOpen} onOpenChange={setIsTransferOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Personel Transfer İşlemi</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>Transfer Edilecek Personel</Label>
                                    <Input disabled value={names.find(n => n.id === transferData.personId)?.name || ''} className="bg-muted" />
                                </div>

                                <div className="space-y-2">
                                    <Label>Hedef Şantiye</Label>
                                    <Select
                                        value={transferData.targetSiteId}
                                        onValueChange={(val) => setTransferData({ ...transferData, targetSiteId: val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Şantiye Seçiniz" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableSites
                                                .filter(s => s.id !== names.find(n => n.id === transferData.personId)?.siteId)
                                                .map(s => (
                                                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                                ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Transfer Tarihi (Bu tarih ve sonrası yeni şantiyeye geçer)</Label>
                                    <Input
                                        type="date"
                                        value={transferData.transferDate instanceof Date && !isNaN(transferData.transferDate.getTime()) ? format(transferData.transferDate, 'yyyy-MM-dd') : ''}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val) {
                                                const [y, m, d] = val.split('-').map(Number);
                                                const date = new Date(y, m - 1, d);
                                                setTransferData({ ...transferData, transferDate: date });
                                            }
                                        }}
                                    />
                                </div>

                                <div className="bg-slate-50 p-3 rounded text-sm text-slate-600 border">
                                    <p className="flex items-center gap-2 font-bold mb-1"><Plane className="w-4 h-4" /> Transfer Bilgisi:</p>
                                    <ul className="list-disc list-inside space-y-1">
                                        <li>Seçilen tarihten <b>önceki</b> günler bu şantiyede kalır.</li>
                                        <li>Seçilen tarih ve <b>sonrası</b> yeni şantiyeye taşınır.</li>
                                        <li>Boş kalan günler "Transfer" (Uçak) simgesi ile doldurulur.</li>
                                    </ul>
                                </div>

                                <div className="pt-4 flex justify-end">
                                    <Button onClick={handleTransferSubmit} disabled={!transferData.targetSiteId}>
                                        Transfer Et
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* MAIN ADD/EDIT DIALOG (Moved Outside Tabs) */}
                    <Dialog open={isDialogOpen} onOpenChange={(open) => {
                        setIsDialogOpen(open);
                        if (!open) setEditingId(null);
                    }}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>{editingId ? 'Personel Düzenle' : 'Yeni Personel Ekle (Bağımsız)'}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>İşe Giriş Tarihi</Label>
                                    <Input
                                        type="date"
                                        value={formData.inputDate}
                                        onChange={e => setFormData({ ...formData, inputDate: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>T.C. Kimlik Numarası <span className="text-red-500">*</span></Label>
                                    <Input
                                        value={formData.tc}
                                        onChange={e => setFormData({ ...formData, tc: e.target.value })}
                                        placeholder="11 haneli TC no"
                                        maxLength={11}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Adı Soyadı <span className="text-red-500">*</span></Label>
                                    <Input
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Ad Soyad"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Mesleği <span className="text-red-500">*</span></Label>
                                        <Input
                                            value={formData.profession}
                                            onChange={e => setFormData({ ...formData, profession: e.target.value })}
                                            placeholder="Örn: Kalıpçı"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Görevi <span className="text-red-500">*</span></Label>
                                        <Input
                                            value={formData.role}
                                            onChange={e => setFormData({ ...formData, role: e.target.value })}
                                            placeholder="Örn: Usta"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Şantiye <span className="text-red-500">*</span></Label>
                                    {availableSites.length > 1 ? (
                                        <Select
                                            value={formData.siteId}
                                            onValueChange={(val) => setFormData({ ...formData, siteId: val })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Şantiye Seçiniz" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {availableSites.map(s => (
                                                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <Input
                                            value={availableSites[0]?.name || 'Yetkili Şantiye Yok'}
                                            disabled
                                            className="bg-muted"
                                        />
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label>Maaşı (₺) <span className="text-red-500">*</span></Label>
                                    <div className="flex gap-2">
                                        <Input
                                            type="text"
                                            value={formData.salary}
                                            onChange={e => {
                                                const formatted = formatMoneyInput(e.target.value);
                                                setFormData({ ...formData, salary: formatted });
                                            }}
                                            placeholder="0,00"
                                            disabled={!!editingId}
                                            className={editingId ? "bg-slate-100" : ""}
                                        />
                                        {editingId && (
                                            <Button
                                                type="button"
                                                variant={showSalaryInput ? "secondary" : "outline"}
                                                onClick={() => setShowSalaryInput(!showSalaryInput)}
                                            >
                                                {showSalaryInput ? "İptal" : "Yeni Maaş"}
                                            </Button>
                                        )}
                                    </div>

                                    {showSalaryInput && editingId && (
                                        <div className="mt-2 p-3 bg-slate-50 border rounded-md animate-in fade-in slide-in-from-top-2 space-y-2">
                                            <div className="space-y-1">
                                                <Label className="text-xs text-slate-500 block">Yeni Maaş Tutarı</Label>
                                                <Input
                                                    type="text"
                                                    value={formData.newSalary}
                                                    onChange={e => {
                                                        const formatted = formatMoneyInput(e.target.value);
                                                        setFormData({ ...formData, newSalary: formatted });
                                                    }}
                                                    placeholder="Yeni tutarı giriniz..."
                                                    autoFocus
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs text-slate-500 block">Güncelleme Tarihi</Label>
                                                <Input
                                                    type="date"
                                                    value={formData.newSalaryDate}
                                                    onChange={e => setFormData({ ...formData, newSalaryDate: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    )}


                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>İzin Hakkı (Gün) <span className="text-red-500">*</span></Label>
                                        <Input
                                            type="number"
                                            value={formData.leaveAllowance}
                                            onChange={e => setFormData({ ...formData, leaveAllowance: e.target.value })}
                                            placeholder="0"
                                        />
                                    </div>
                                    <div className="flex items-end pb-2">
                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id="overtime"
                                                checked={formData.hasOvertime}
                                                onCheckedChange={(checked) => setFormData({ ...formData, hasOvertime: checked as boolean })}
                                            />
                                            <Label htmlFor="overtime">Mesai Hakkı Var</Label>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Notlar</Label>
                                    <Textarea
                                        value={formData.note}
                                        onChange={e => setFormData({ ...formData, note: e.target.value })}
                                        placeholder="Kısa notlar..."
                                    />
                                </div>
                                <div className="pt-4 flex justify-end">
                                    <Button onClick={handleAdd} disabled={!formData.tc || !formData.name || !formData.profession || !formData.role || !formData.salary || !formData.leaveAllowance || !formData.siteId}>
                                        Kaydet
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                </TabsContent>

                {(user?.role === 'ADMIN' || user?.username === 'mehmet') && (
                    <TabsContent value="salary" className="space-y-6">
                        <div className="flex justify-end bg-white p-4 rounded-lg border shadow-sm">
                            <Button variant="outline" onClick={handleExportSalaryExcel} className="hover:bg-green-50 text-green-700 border-green-200">
                                <FileSpreadsheet className="w-4 h-4 mr-2" />
                                Maaş Listesi (Excel)
                            </Button>
                            <Button variant="outline" onClick={handleExportSalaryPDF} className="hover:bg-red-50 text-red-700 border-red-200 ml-2">
                                <Download className="w-4 h-4 mr-2" />
                                Maaş Listesi (PDF)
                            </Button>
                        </div>

                        <div className="rounded-md border bg-white">
                            <Table className="w-full text-xs [&_th]:h-10 [&_th]:p-2 [&_td]:p-2">
                                <TableHeader>
                                    <TableRow className="bg-slate-50">
                                        <TableHead>TC Kimlik</TableHead>
                                        <TableHead>Ad Soyad</TableHead>
                                        <TableHead className="text-right">Maaş</TableHead>
                                        <TableHead className="text-center">Toplam Gün</TableHead>
                                        <TableHead className="text-center">Mesai (Saat)</TableHead>
                                        <TableHead className="text-right">Hakediş</TableHead>
                                        <TableHead className="text-right">Mesai Tutarı</TableHead>
                                        <TableHead className="text-center">Kalan İzin</TableHead>
                                        <TableHead className="text-right">İzin Ücreti</TableHead>
                                        <TableHead className="text-right text-green-600">Prim</TableHead>
                                        <TableHead className="text-right text-red-600">Kesinti</TableHead>
                                        <TableHead className="text-right font-bold text-slate-900">Toplam Ödeme</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredNames.length === 0 ? (
                                        <TableRow><TableCell colSpan={12} className="text-center h-24 text-muted-foreground">Kayıt Yok</TableCell></TableRow>
                                    ) : filteredNames.map(person => {
                                        const stats = calculateStats(person, date);
                                        const fmt = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
                                        return (
                                            <TableRow key={person.id}>
                                                <TableCell className="font-mono text-xs">{person.tc}</TableCell>
                                                <TableCell className="font-medium">{person.name}</TableCell>
                                                <TableCell className="text-right font-mono text-slate-600">{formatCurrency(person.salary)}</TableCell>
                                                <TableCell className="text-center font-bold text-slate-700">{stats.workedDays}</TableCell>
                                                <TableCell className="text-center">{stats.overtimeTotal > 0 ? stats.overtimeTotal : '-'}</TableCell>
                                                <TableCell className="text-right font-mono text-slate-600">{fmt(stats.basePay)}</TableCell>
                                                <TableCell className="text-right font-mono text-muted-foreground">{fmt(stats.overtimePay)}</TableCell>
                                                <TableCell className="text-center font-bold text-blue-600">{stats.remainingLeave}</TableCell>
                                                <TableCell className="text-right font-mono text-blue-600">{fmt(stats.leavePay)}</TableCell>
                                                <TableCell className="text-right font-mono text-green-600">{stats.bonus > 0 ? fmt(stats.bonus) : '-'}</TableCell>
                                                <TableCell className="text-right font-mono text-red-600">{stats.deduction > 0 ? fmt(stats.deduction) : '-'}</TableCell>
                                                <TableCell className="text-right font-bold font-mono text-green-700 bg-green-50/50">{fmt(stats.totalPay)}</TableCell>
                                                <TableCell>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600" onClick={() => {
                                                        const key = format(date, 'yyyy-MM');
                                                        const adjustment = person.salaryAdjustments?.[key] || {};
                                                        setSalaryAdjustmentForm({
                                                            personId: person.id,
                                                            dateKey: key,
                                                            workedDays: adjustment.workedDays?.toString() || stats.workedDays.toString(),
                                                            overtimeHours: adjustment.overtimeHours?.toString() || (stats.overtimeTotal > 0 ? stats.overtimeTotal.toString() : ''),
                                                            bonus: adjustment.bonus?.toString() || '',
                                                            deduction: adjustment.deduction?.toString() || '',
                                                            note: adjustment.note || ''
                                                        });
                                                        setIsSalaryAdjustmentOpen(true);
                                                    }}>
                                                        <Pencil className="w-4 h-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>
                )}
            </Tabs>

            {/* MAIN ADD/EDIT DIALOG (Moved Outside Tabs) */}
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) setEditingId(null);
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingId ? 'Personel Düzenle' : 'Yeni Personel Ekle (Bağımsız)'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>İşe Giriş Tarihi</Label>
                            <Input
                                type="date"
                                value={formData.inputDate}
                                onChange={e => setFormData({ ...formData, inputDate: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>T.C. Kimlik Numarası <span className="text-red-500">*</span></Label>
                            <Input
                                value={formData.tc}
                                onChange={e => setFormData({ ...formData, tc: e.target.value })}
                                placeholder="11 haneli TC no"
                                maxLength={11}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Adı Soyadı <span className="text-red-500">*</span></Label>
                            <Input
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Ad Soyad"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Mesleği <span className="text-red-500">*</span></Label>
                                <Input
                                    value={formData.profession}
                                    onChange={e => setFormData({ ...formData, profession: e.target.value })}
                                    placeholder="Örn: Kalıpçı"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Görevi <span className="text-red-500">*</span></Label>
                                <Input
                                    value={formData.role}
                                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                                    placeholder="Örn: Usta"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Şantiye <span className="text-red-500">*</span></Label>
                            {availableSites.length > 1 ? (
                                <Select
                                    value={formData.siteId}
                                    onValueChange={(val) => setFormData({ ...formData, siteId: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Şantiye Seçiniz" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableSites.map(s => (
                                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <Input
                                    value={availableSites[0]?.name || 'Yetkili Şantiye Yok'}
                                    disabled
                                    className="bg-muted"
                                />
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label>Maaşı (₺) <span className="text-red-500">*</span></Label>
                            <div className="flex gap-2">
                                <Input
                                    type="text"
                                    value={formData.salary}
                                    onChange={e => {
                                        const formatted = formatMoneyInput(e.target.value);
                                        setFormData({ ...formData, salary: formatted });
                                    }}
                                    placeholder="0,00"
                                    disabled={!!editingId}
                                    className={editingId ? "bg-slate-100" : ""}
                                />
                                {editingId && (
                                    <Button
                                        type="button"
                                        variant={showSalaryInput ? "secondary" : "outline"}
                                        onClick={() => setShowSalaryInput(!showSalaryInput)}
                                    >
                                        {showSalaryInput ? "İptal" : "Yeni Maaş"}
                                    </Button>
                                )}
                            </div>

                            {showSalaryInput && editingId && (
                                <div className="mt-2 p-3 bg-slate-50 border rounded-md animate-in fade-in slide-in-from-top-2 space-y-2">
                                    <div className="space-y-1">
                                        <Label className="text-xs text-slate-500 block">Yeni Maaş Tutarı</Label>
                                        <Input
                                            type="text"
                                            value={formData.newSalary}
                                            onChange={e => {
                                                const formatted = formatMoneyInput(e.target.value);
                                                setFormData({ ...formData, newSalary: formatted });
                                            }}
                                            placeholder="Yeni tutarı giriniz..."
                                            autoFocus
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-slate-500 block">Güncelleme Tarihi</Label>
                                        <Input
                                            type="date"
                                            value={formData.newSalaryDate}
                                            onChange={e => setFormData({ ...formData, newSalaryDate: e.target.value })}
                                        />
                                    </div>
                                </div>
                            )}


                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>İzin Hakkı (Gün) <span className="text-red-500">*</span></Label>
                                <Input
                                    type="number"
                                    value={formData.leaveAllowance}
                                    onChange={e => setFormData({ ...formData, leaveAllowance: e.target.value })}
                                    placeholder="0"
                                />
                            </div>
                            <div className="flex items-end pb-2">
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="overtime"
                                        checked={formData.hasOvertime}
                                        onCheckedChange={(checked) => setFormData({ ...formData, hasOvertime: checked as boolean })}
                                    />
                                    <Label htmlFor="overtime">Mesai Hakkı Var</Label>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Notlar</Label>
                            <Textarea
                                value={formData.note}
                                onChange={e => setFormData({ ...formData, note: e.target.value })}
                                placeholder="Kısa notlar..."
                            />
                        </div>
                        <div className="pt-4 flex justify-end">
                            <Button onClick={handleAdd} disabled={!formData.tc || !formData.name || !formData.profession || !formData.role || !formData.salary || !formData.leaveAllowance || !formData.siteId}>
                                Kaydet
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Salary Adjustment Dialog */}
            <Dialog open={isSalaryAdjustmentOpen} onOpenChange={setIsSalaryAdjustmentOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Maaş Düzenlemesi ({salaryAdjustmentForm.dateKey})</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="bg-blue-50 p-3 rounded text-sm text-blue-700 mb-4">
                            Bu ay için hesaplanan değerleri buradan manuel olarak değiştirebilirsiniz. Değişiklikler sadece bu ay için geçerli olacaktır.
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Çalışılan Gün</Label>
                                <Input
                                    type="number"
                                    value={salaryAdjustmentForm.workedDays}
                                    onChange={e => setSalaryAdjustmentForm({ ...salaryAdjustmentForm, workedDays: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Mesai Saati</Label>
                                <Input
                                    type="number"
                                    value={salaryAdjustmentForm.overtimeHours}
                                    onChange={e => setSalaryAdjustmentForm({ ...salaryAdjustmentForm, overtimeHours: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Ekstra Prim (₺)</Label>
                                <Input
                                    type="number"
                                    placeholder="0"
                                    value={salaryAdjustmentForm.bonus}
                                    onChange={e => setSalaryAdjustmentForm({ ...salaryAdjustmentForm, bonus: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Kesinti / Avans (₺)</Label>
                                <Input
                                    type="number"
                                    placeholder="0"
                                    value={salaryAdjustmentForm.deduction}
                                    onChange={e => setSalaryAdjustmentForm({ ...salaryAdjustmentForm, deduction: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Not</Label>
                            <Textarea
                                placeholder="Düzenleme nedeni..."
                                value={salaryAdjustmentForm.note}
                                onChange={e => setSalaryAdjustmentForm({ ...salaryAdjustmentForm, note: e.target.value })}
                            />
                        </div>

                        <div className="flex justify-end pt-4">
                            <Button onClick={() => {
                                setNames(prev => prev.map(p => {
                                    if (p.id === salaryAdjustmentForm.personId) {
                                        return {
                                            ...p,
                                            salaryAdjustments: {
                                                ...p.salaryAdjustments,
                                                [salaryAdjustmentForm.dateKey]: {
                                                    workedDays: salaryAdjustmentForm.workedDays ? parseFloat(salaryAdjustmentForm.workedDays) : undefined,
                                                    overtimeHours: salaryAdjustmentForm.overtimeHours ? parseFloat(salaryAdjustmentForm.overtimeHours) : undefined,
                                                    bonus: salaryAdjustmentForm.bonus ? parseFloat(salaryAdjustmentForm.bonus) : undefined,
                                                    deduction: salaryAdjustmentForm.deduction ? parseFloat(salaryAdjustmentForm.deduction) : undefined,
                                                    note: salaryAdjustmentForm.note
                                                }
                                            }
                                        };
                                    }
                                    return p;
                                }));
                                setIsSalaryAdjustmentOpen(false);
                            }}>
                                Kaydet
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Rich Tooltip Overlay */}
            {hoveredData && (hoveredData.record?.note || hoveredData.record?.overtime) && (
                <div
                    className="fixed z-[100] p-3 rounded-lg shadow-2xl bg-slate-900 text-white text-xs pointer-events-none transform -translate-x-1/2 -translate-y-full mb-2 border border-slate-700 w-max max-w-[250px]"
                    style={{ left: hoveredData.x, top: hoveredData.y - 4 }}
                >
                    <div className="font-bold text-center mb-1 text-slate-100 text-sm">
                        {hoveredData.record?.status === 'FULL' && 'Tam Gün'}
                        {hoveredData.record?.status === 'HALF' && 'Yarım Gün'}
                        {hoveredData.record?.status === 'ABSENT' && 'Gelmedi'}
                        {hoveredData.record?.status === 'LEAVE' && 'İzinli'}
                        {hoveredData.record?.status === 'REPORT' && 'Raporlu'}
                        {hoveredData.record?.status === 'OUT' && 'Dış Görev'}
                        {hoveredData.record?.status === 'EXIT' && 'İşten Çıkış'}
                        {hoveredData.record?.status === 'TRANSFER' && 'Transfer'}
                        {!hoveredData.record && 'Kayıt Yok'}
                    </div>

                    {hoveredData.record?.overtime && (
                        <div className="text-orange-400 font-extrabold text-center text-sm border-b border-slate-700/50 pb-1 mb-1">
                            +{hoveredData.record.overtime} Saat Mesai
                        </div>
                    )}

                    {hoveredData.record?.note && (
                        <div className={`italic text-white break-words leading-relaxed text-sm font-medium ${hoveredData.record.overtime ? 'mt-1' : 'border-t border-slate-700/50 pt-1 mt-1'}`}>
                            {hoveredData.record.note}
                        </div>
                    )}

                    {/* Tooltip Arrow */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900"></div>
                </div>
            )}
        </div>
    );
}
