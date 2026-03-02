'use client';

import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, eachDayOfInterval, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Trash2, Plus, CheckCircle2, Clock, XCircle, Umbrella, FileText, Car, AlertCircle, Download, FileSpreadsheet, ArrowRightLeft, Plane, Lock, Settings, LogOut, LogIn, ArrowUp, ArrowDown, Filter, Search, X, Pencil, Users, ReceiptTurkishLira, ChevronLeft, ChevronRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/store/use-auth';
import { useAppStore } from '@/lib/store/use-store';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fontBase64 } from '@/lib/pdf-font';
import { differenceInDays, differenceInCalendarDays, differenceInCalendarMonths } from 'date-fns';
import { getPersonnelWithAttendance, createPersonnel, updatePersonnel, deletePersonnel, upsertSalaryAdjustment } from '@/actions/personnel';




type AttendanceRecord = {
    status: string; // FULL, HALF, ABSENT, LEAVE, REPORT, OUT, TRANSFER
    overtime?: string;
    note?: string;
    createdById?: string;
    createdAt?: number; // timestamp
    siteId?: string; // [NEW] Which site this attendance was recorded at
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
    status?: string; // ACTIVE, LEFT etc.
    inputDate?: string; // yyyy-MM-dd
    transferOutDate?: string; // yyyy-MM-dd (Locked after this date)
    transferInDate?: string; // [NEW] yyyy-MM-dd (Date when person arrived at this site via transfer)
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


const SalaryEditableCell = ({
    value,
    type,
    onSave,
    colorClass,
    disabled
}: {
    value: number,
    type: 'Prim' | 'Kesinti',
    onSave: (val: string) => void,
    colorClass: string,
    disabled?: boolean
}) => {
    const [open, setOpen] = useState(false);
    const [tempVal, setTempVal] = useState('');

    useEffect(() => {
        if (open) {
            // Convert dot to comma for display editing if needed, but simple string is fine.
            // If value is 0, start empty or 0? user logic had empty string if 0 in some places.
            // But here let's show value if > 0.
            setTempVal(value > 0 ? value.toString().replace('.', ',') : '');
        }
    }, [open, value]);

    const handleSave = () => {
        // Convert comma to dot for saving
        const toSave = tempVal.replace(',', '.');
        onSave(toSave);
        setOpen(false);
    };

    return (
        disabled ? (
            <div className={cn("w-full h-full text-right font-mono px-2 flex items-center justify-end h-10", colorClass)}>
                {value > 0 ? value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
            </div>
        ) : (
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button variant="ghost" className={cn("w-full h-full text-right font-mono px-2 justify-end hover:bg-slate-50 rounded-none h-10", colorClass)}>
                        {value > 0 ? value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-3">
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold">{type} (₺)</Label>
                        <Input
                            className="h-8"
                            placeholder="0,00"
                            value={tempVal}
                            onChange={(e) => {
                                // Allow only digits and comma/dot
                                const v = e.target.value.replace(/[^0-9,.]/g, '');
                                setTempVal(v);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSave();
                            }}
                        />
                        <Button size="sm" className="w-full h-7 text-xs bg-blue-600 hover:bg-blue-700" onClick={handleSave}>
                            Kaydet
                        </Button>
                    </div>
                </PopoverContent>
            </Popover>
        )
    );
};

export default function NewPage() {
    const { user, getAccessibleSites } = useAuth();
    const { sites, personnel } = useAppStore();
    const availableSites = getAccessibleSites(sites);

    // [NEW] Granular Permissions
    const perms = (user?.permissions || {}) as Record<string, string[]>;
    // Fallback: If user has ADMIN role, all true.
    const isAdmin = user?.role === 'ADMIN';

    const canViewSalary = isAdmin || (perms['personnel-attendance.salary'] || []).includes('VIEW');
    const canEditSalary = isAdmin || (perms['personnel-attendance.salary'] || []).includes('EDIT');
    const canCreatePersonnel = isAdmin || (perms['personnel-attendance.personnel'] || []).includes('CREATE');
    const canEditPersonnel = isAdmin || (perms['personnel-attendance.personnel'] || []).includes('EDIT'); // For Edit/Delete
    const canEditAttendance = isAdmin || (perms['personnel-attendance.attendance'] || []).includes('EDIT');
    const canExport = isAdmin || (perms['personnel-attendance.attendance'] || []).includes('EXPORT');
    const canTransfer = isAdmin || (perms['personnel-attendance.transfer'] || []).includes('CREATE');
    const canViewAllPersonnel = isAdmin; // Only Admin can see 'All Personnel' and 'Site List' summary for now


    const [names, setNames] = useState<IndependentPerson[]>([]);

    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('grid');

    // Site Filter State
    const [selectedSiteId, setSelectedSiteId] = useState<string>('');

    // [REMOVED] Persist Selection (User requested auto-reset)
    /*
    useEffect(() => {
        const saved = localStorage.getItem('personnel_selectedSiteId');
        if (saved && !selectedSiteId) {
            setSelectedSiteId(saved);
        }
    }, []);

    useEffect(() => {
        if (selectedSiteId) {
            localStorage.setItem('personnel_selectedSiteId', selectedSiteId);
        }
    }, [selectedSiteId]);
    */

    // Auto-select site only if user has exactly 1 site (restricted users)
    useEffect(() => {
        if (availableSites.length === 1 && !selectedSiteId) {
            setSelectedSiteId(availableSites[0].id);
        }
    }, [availableSites.length, availableSites]);





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
    const siteOptions = useMemo(() => sites.filter((s: any) => s.status === 'ACTIVE').map((s: any) => ({ label: s.name, value: s.id })), [sites]);
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
        let targetSiteId = selectedSiteId;

        // [FIX] Handle page refresh where availableSites might be loaded but selectedSiteId is not yet set
        if (!targetSiteId && availableSites.length === 1) {
            targetSiteId = availableSites[0].id;
            setSelectedSiteId(targetSiteId);
        }

        if (!targetSiteId || targetSiteId === 'all') {
            // No site selected or 'Şantiye Seçiniz' - don't fetch, just clear
            setNames([]);
            setLoading(false);
            return;
        }

        // 'all' means fetch all company personnel (no site filter)
        const fetchSiteId = targetSiteId === 'all' ? undefined : targetSiteId;

        console.log(`refreshData: Fetching for site ${targetSiteId} date ${date.toISOString()}`);
        setLoading(true);
        try {
            // [FIX] Use API route instead of server action to avoid Next.js server action hang
            const params = new URLSearchParams({ month: date.toISOString() });
            if (fetchSiteId) params.set('siteId', fetchSiteId);
            const response = await fetch(`/api/personnel/attendance/list?${params.toString()}`);
            const res = await response.json();

            console.log(`[refreshData] API response:`, { success: res.success, dataCount: res.data?.length, error: res.error });

            if (res.success && res.data) {
                // Map DB Personnel to IndependentPerson format
                const mapped: IndependentPerson[] = res.data.map((p: any) => {
                    try {
                        const attendanceMap: Record<string, AttendanceRecord> = {};
                        p.attendance.forEach((a: any) => {
                            // [FIX] Use string split to get YYYY-MM-DD from ISO string safely
                            // e.g. "2026-02-09T00:00:00.000Z" -> "2026-02-09"
                            const dateVal = a.date instanceof Date ? a.date.toISOString() : a.date.toString();
                            const dateKey = dateVal.split('T')[0];
                            attendanceMap[dateKey] = {
                                status: a.status,
                                overtime: a.overtime ? a.overtime.toString() : undefined,
                                note: a.note || undefined,
                                createdById: a.createdById || undefined,
                                createdAt: new Date(a.createdAt || Date.now()).getTime(),
                                siteId: a.siteId || undefined // [NEW] Track which site this record belongs to
                            };
                        });

                        // [NEW] Map Salary Adjustments
                        const adjMap: Record<string, any> = {};
                        if (p.salaryAdjustments) {
                            p.salaryAdjustments.forEach((adj: any) => {
                                const k = `${adj.year}-${adj.month.toString().padStart(2, '0')}`;
                                adjMap[k] = {
                                    bonus: adj.bonus,
                                    deduction: adj.deduction,
                                    workedDays: adj.workedDays,
                                    overtimeHours: adj.overtimeHours,
                                    note: adj.note
                                };
                            });
                        }

                        // [NEW] Compute transferInDate: if person's current siteId matches selected site,
                        // find the last date with attendance at a DIFFERENT site to determine when they arrived
                        let transferInDate: string | undefined = undefined;
                        if (p.siteId === targetSiteId) {
                            const otherSiteDates = Object.entries(attendanceMap)
                                .filter(([_, r]) => r.siteId && r.siteId !== targetSiteId)
                                .map(([k]) => k)
                                .sort();
                            if (otherSiteDates.length > 0) {
                                // The day AFTER the last other-site attendance = transfer-in date
                                const lastOtherDate = new Date(otherSiteDates[otherSiteDates.length - 1]);
                                lastOtherDate.setDate(lastOtherDate.getDate() + 1);
                                transferInDate = format(lastOtherDate, 'yyyy-MM-dd');
                            }
                        }

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
                            status: p.status || 'ACTIVE',
                            inputDate: p.startDate ? format(new Date(p.startDate), 'yyyy-MM-dd') : undefined,
                            transferOutDate: p.leftDate ? format(new Date(p.leftDate), 'yyyy-MM-dd') : undefined,
                            transferInDate,
                            attendance: attendanceMap,
                            salaryHistory: p.salaryHistory || [],
                            salaryAdjustments: adjMap
                        };
                    } catch (mapErr) {
                        console.error(`[refreshData] Error mapping personnel ${p.fullName} (${p.id}):`, mapErr);
                        // Return a safe fallback so one bad record doesn't break the whole list
                        return {
                            id: p.id,
                            siteId: p.siteId || '',
                            tc: p.tcNumber || '',
                            name: p.fullName || 'HATA',
                            profession: p.profession || '',
                            role: p.role || '',
                            salary: p.salary ? p.salary.toString() : '',
                            leaveAllowance: p.leaveAllowance || '',
                            hasOvertime: p.hasOvertime || false,
                            note: p.note || '',
                            attendance: {},
                            salaryHistory: [],
                            salaryAdjustments: {}
                        };
                    }
                });
                console.log(`[refreshData] Mapped ${mapped.length} personnel successfully`);
                setNames(mapped);
            }
        } catch (e: any) {
            console.error('[refreshData] Error:', e);
            if (e?.message?.includes('timeout')) {
                toast.error("Sunucu yanıt vermedi. Sayfayı yenileyip tekrar deneyin.");
            } else {
                toast.error("Veri yüklenirken hata oluştu: " + (e?.message || ''));
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshData();
    }, [date, selectedSiteId, availableSites.length]);

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

            // [FIX] İşten ayrılan personeli sonraki aylarda gizle
            if (n.status === 'LEFT') {
                if (n.transferOutDate) {
                    const leftMonth = n.transferOutDate.substring(0, 7); // yyyy-MM
                    const viewMonth = format(startOfCurrentMonth, 'yyyy-MM');
                    if (leftMonth < viewMonth) return false;
                } else {
                    // leftDate yoksa, status LEFT ise sonraki aylarda görünmesin
                    return false;
                }
            }

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
        // [FIX] Relaxed Filter: reliance on Server-Side Fetching
        // The server already returns personnel associated with the selectedSiteId (Primary OR Assigned).
        // Strict client-side filtering (n.siteId === selectedSiteId) hides Assigned personnel.
        const gridFiltered = processedGlobalList;

        // 4. Apply Filtering (Multi-Select)
        let filteredList = [...gridFiltered];
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

    const handleTransferSubmit = async () => {
        if (!transferData.personId || !transferData.targetSiteId) return;

        const originalPerson = names.find(p => p.id === transferData.personId);
        if (!originalPerson) return;

        setLoading(true);
        try {
            // Fetch current DB user to get existing transfer history if needed, 
            // or just append to what we know. 
            // Since IndependentPerson doesn't fully track transferHistory field in this specific UI, 
            // we'll rely on updatePersonnel to merge or we should have fetched it.
            // But for now, let's just update the siteId. The backend 'transferHistory' update 
            // from GlobalPersonnelList logic was clean.
            // Let's replicate that minimal logic: Update siteId. 
            // If we want history, we need to pass it.

            // To do it properly:
            // 1. We should ideally have transferHistory in IndependentPerson to append to it. 
            // For now, let's just do the site change which is the core request.

            const res = await updatePersonnel(originalPerson.id, {
                siteId: transferData.targetSiteId,
                // Optional: We can add a note about the transfer
                note: `${originalPerson.note || ''} (Şantiye Değişikliği: ${format(new Date(), 'dd.MM.yyyy')})`
            });

            if (res.success) {
                // Refresh data to reflect changes
                await refreshData();
                setIsTransferOpen(false);
                // toast.success is not imported, using alert or just closing. 
                // NewPage uses 'alert' in other places.
            } else {
                alert("Transfer başarısız: " + res.error);
            }
        } catch (error) {
            console.error(error);
            alert("Transfer sırasında bir hata oluştu.");
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async () => {
        // [FIX] Detailed Validation with Toasts
        if (!formData.tc) { toast.error("TC Kimlik Numarası zorunludur."); return; }
        if (formData.tc.length !== 11) { toast.error("TC Kimlik Numarası 11 haneli olmalıdır."); return; }
        if (!formData.name) { toast.error("Ad Soyad zorunludur."); return; }
        if (!formData.profession) { toast.error("Meslek bilgisi zorunludur."); return; }
        if (!formData.role) { toast.error("Görev bilgisi zorunludur."); return; }
        if (!formData.siteId) { toast.error("Şantiye seçimi zorunludur."); return; }
        if (formData.leaveAllowance === '' || formData.leaveAllowance === undefined) { toast.error("İzin hakkı girilmelidir."); return; }

        // Salary Validation: Allow empty 'salary' IF 'newSalary' is provided during edit
        // Or if salary is explicitly "0" or "0,00"
        const hasSalary = formData.salary && formData.salary !== '';
        const hasNewSalary = formData.newSalary && formData.newSalary !== '';

        if (!hasSalary && !hasNewSalary) {
            toast.error("Maaş bilgisi zorunludur.");
            return;
        }

        if (editingId) {
            // Update
            const newSalary = parseFloat(parseMoney(formData.salary));
            const existingPerson = names.find(p => p.id === editingId);
            const oldSalary = existingPerson ? parseFloat(existingPerson.salary || '0') : 0;

            // Build salary history entry if salary changed
            let salaryHistoryUpdate: any = undefined;
            if (existingPerson && Math.abs(newSalary - oldSalary) > 0.01) {
                const existingHistory = (existingPerson as any).salaryHistory || [];
                salaryHistoryUpdate = [
                    ...existingHistory,
                    {
                        oldSalary,
                        newSalary,
                        date: new Date().toISOString(),
                    }
                ];
            }

            const res = await updatePersonnel(editingId, {
                siteId: formData.siteId,
                tcNumber: formData.tc,
                fullName: formData.name,
                profession: formData.profession,
                role: formData.role,
                salary: newSalary,
                category: 'FIELD',
                leaveAllowance: formData.leaveAllowance,
                hasOvertime: formData.hasOvertime,
                startDate: formData.inputDate ? new Date(formData.inputDate) : undefined,
                note: formData.note,
                ...(salaryHistoryUpdate ? { salaryHistory: salaryHistoryUpdate } : {})
            } as any);


            if (res.success) {
                setEditingId(null);
                setIsDialogOpen(false); // Close dialog
                toast.success("Personel başarıyla güncellendi.");

                // Optimistic Update
                setNames(prev => prev.map(p => {
                    if (p.id === editingId) {
                        return {
                            ...p,
                            siteId: formData.siteId,
                            tc: formData.tc,
                            name: formData.name,
                            profession: formData.profession,
                            role: formData.role,
                            salary: parseMoney(formData.salary),
                            leaveAllowance: formData.leaveAllowance,
                            hasOvertime: formData.hasOvertime,
                            note: formData.note,
                            // Ensure attendance isn't lost during optimistic update
                            attendance: p.attendance,
                            salaryAdjustments: p.salaryAdjustments
                        };
                    }
                    return p;
                }));
                // refreshData(); // Skip refresh for speed
            } else {
                toast.error("Güncelleme başarısız: " + res.error);
            }
        } else {
            // Create
            const res = await createPersonnel({
                siteId: formData.siteId,
                tcNumber: formData.tc,
                fullName: formData.name,
                profession: formData.profession,
                role: formData.role,
                salary: parseFloat(parseMoney(formData.salary)),
                category: 'FIELD',
                leaveAllowance: formData.leaveAllowance,
                hasOvertime: formData.hasOvertime,
                startDate: formData.inputDate ? new Date(formData.inputDate) : new Date(),
                note: formData.note
            } as any);

            if (res.success && res.data) {
                toast.success("Personel başarıyla eklendi.");
                setIsDialogOpen(false); // Close dialog

                // Optimistic Update / Instant Add
                const newPersonData = res.data as any; // Cast to any to avoid stale type errors
                const newIndependentPerson: IndependentPerson = {
                    id: newPersonData.id,
                    siteId: newPersonData.siteId || '',
                    tc: newPersonData.tcNumber || '',
                    name: newPersonData.fullName,
                    profession: newPersonData.profession || '',
                    role: newPersonData.role,
                    salary: newPersonData.salary ? newPersonData.salary.toString() : '',
                    leaveAllowance: newPersonData.leaveAllowance || '',
                    hasOvertime: newPersonData.hasOvertime || false,
                    note: newPersonData.note || '',
                    inputDate: newPersonData.startDate ? format(new Date(newPersonData.startDate), 'yyyy-MM-dd') : undefined,
                    transferOutDate: newPersonData.leftDate ? format(new Date(newPersonData.leftDate), 'yyyy-MM-dd') : undefined,
                    attendance: {}, // Initially empty, though createPersonnel adds one record. 
                    // To show that record instantly, we can manually add it:
                    salaryHistory: [],
                    salaryAdjustments: {}
                };

                // If inputDate exists, add the initial 'FULL' attendance we just created on server
                // [FIX] Use formData.inputDate directly if available to avoid timezone shifts when parsing server response
                const startDateStr = formData.inputDate || (newPersonData.startDate ? format(new Date(newPersonData.startDate), 'yyyy-MM-dd') : undefined);

                if (startDateStr) {
                    newIndependentPerson.attendance[startDateStr] = {
                        status: 'FULL',
                        note: 'İşe Giriş - İlk Gün',
                        createdAt: Date.now()
                    };
                }

                setNames(prev => [...prev, newIndependentPerson]);
                // refreshData(); // Still refresh to be safe, but state is already updated
            } else {
                toast.error("Ekleme başarısız: " + res.error);
            }
        }

        setFormData({
            siteId: availableSites.length === 1 ? availableSites[0].id : '',
            tc: '', name: '', profession: '', role: '', salary: '', newSalary: '', newSalaryDate: format(new Date(), 'yyyy-MM-dd'), leaveAllowance: '', hasOvertime: false, note: '',
            inputDate: format(new Date(), 'yyyy-MM-dd'),
            salaryHistory: []
        });
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
            // Optimistic Delete
            const previousNames = [...names];
            setNames(prev => prev.filter(p => p.id !== id));

            const res = await deletePersonnel(id);
            if (!res.success) {
                alert(res.error);
                setNames(previousNames); // Rollback
            }
        }
    };

    const canEditRecord = (person: IndependentPerson, record: AttendanceRecord | undefined, targetDate: Date) => {
        // [NEW] Permission Check
        if (!canEditAttendance) return false;

        const targetKey = format(targetDate, 'yyyy-MM-dd');

        // [NEW] Transfer-In Lock: Days BEFORE the person arrived at this site are not editable
        if (person.transferInDate && targetKey < person.transferInDate) {
            return false;
        }

        // [NEW] Transferred-Out Lock: If person's current site is NOT this site,
        // only allow editing days where they have attendance at THIS site
        if (person.siteId !== selectedSiteId && selectedSiteId) {
            const existingRecord = person.attendance[targetKey];
            // Only allow editing existing records at this site, not creating new ones after they left
            if (!existingRecord || existingRecord.siteId !== selectedSiteId) {
                return false;
            }
        }

        // Check Transfer Lock (leftDate-based)
        if (person.transferOutDate) {
            if (targetKey >= person.transferOutDate) {
                // Allow Admin to fix or User to revert EXIT
                const isExitRecord = record?.status === 'EXIT';
                const isAdmin = user?.role === 'ADMIN';

                if (!isExitRecord && !isAdmin) return false;
            }
        }

        // Admin -> checks nothing (except strict locks above)
        if (user?.role === 'ADMIN') return true;

        // Check Future Date (Strictly future days, today is allowed)
        if (differenceInCalendarDays(targetDate, new Date()) > 0) {
            return false;
        }

        // Check Past Date Lookback (for all cells, including empty ones)
        const lookbackLimit = user?.editLookbackDays ?? 3;
        const pastDaysDiff = differenceInCalendarDays(new Date(), targetDate);
        if (pastDaysDiff > lookbackLimit) {
            return false;
        }

        // New record -> can create (if within lookback window)
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

        // [SECURE] Client-Side Date Restriction Check
        console.log('[DEBUG_ATTENDANCE] User Role:', user?.role);
        console.log('[DEBUG_ATTENDANCE] Lookback Setting:', (user as any).editLookbackDays);
        console.log('[DEBUG_ATTENDANCE] User Object:', user);

        if (user?.role !== 'ADMIN') {
            const limit = (user as any).editLookbackDays ?? 0;

            // [FIX] Normalize to Noon to avoid midnight/timezone shifts
            const today = new Date();
            today.setHours(12, 0, 0, 0);

            const target = new Date(selectedCell.date);
            target.setHours(12, 0, 0, 0);

            // Use differenceInCalendarDays to ignore time/timezone
            const diffDays = differenceInCalendarDays(today, target);

            console.log(`[DEBUG_ATTENDANCE] Diff: ${diffDays}, Limit: ${limit}, Blocked: ${diffDays > limit}`);
            console.log(`[DEBUG_ATTENDANCE] Today: ${today.toISOString()}, Target: ${target.toISOString()}`);

            if (diffDays > limit) {
                const msg = limit === 0 ? 'Bugünden eski tarihli puantaj giremezsiniz.' : `Geriye dönük en fazla ${limit} gün işlem yapabilirsiniz.`;
                const debugInfo = `\n(Bugün: ${today.toLocaleDateString()}, Hedef: ${target.toLocaleDateString()}, Fark: ${diffDays} gün, Limit: ${limit})`;
                alert(msg + debugInfo);
                setSelectedCell(null);
                return;
            }
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

        // INSTANT CLOSE
        setSelectedCell(null);

        // Server Call
        try {
            // [FIX] Use API Route instead of Server Action
            const apiRes = await fetch('/api/personnel/attendance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    personnelId: person.id,
                    date: format(selectedCell.date, 'yyyy-MM-dd'),
                    data: {
                        status: finalStatus,
                        hours: finalStatus === 'FULL' ? 11 : (finalStatus === 'HALF' ? 5.5 : 0),
                        overtime: attendanceForm.overtime ? parseFloat(attendanceForm.overtime) : undefined,
                        note: attendanceForm.note,
                        siteId: person.siteId
                    }
                })
            });

            if (!apiRes.ok) {
                const errText = await apiRes.text();
                try {
                    const errJson = JSON.parse(errText);
                    throw new Error(errJson.error || errText);
                } catch (e: any) {
                    throw new Error(e.message || ("İşlem başarısız: " + apiRes.status));
                }
            }

            const res = await apiRes.json();

            if (!res.success) {
                alert("HATA: " + res.error);
                refreshData(); // Revert
            } else {
                // Success - Optimistic update already applied
                console.log('Attendance saved successfully.');
            }
        } catch (err: any) {
            alert("Bir hata oluştu: " + err.message);
            console.error(err);
            refreshData(); // Revert
        }
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
            // [NEW] Skip records from other sites (transfer-related)
            if (selectedSiteId && record.siteId && record.siteId !== selectedSiteId) return;

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

        const leaveAllowanceTotal = parseFloat(person.leaveAllowance || '0');

        // [NEW] Proportional leave allowance: if person transferred mid-month,
        // distribute leave days based on calendar days at each site
        let leaveAllowance = leaveAllowanceTotal;
        if (selectedSiteId && person.transferInDate && person.transferInDate.startsWith(monthPrefix)) {
            // Person transferred INTO this site mid-month
            // Days at this site = from transferInDate to end of month
            const transferDay = parseInt(person.transferInDate.split('-')[2], 10);
            const totalDaysInMonth = endOfMonth(referenceDate).getDate();
            const daysAtThisSite = totalDaysInMonth - transferDay + 1;
            leaveAllowance = Math.round(leaveAllowanceTotal * daysAtThisSite / totalDaysInMonth);
        } else if (selectedSiteId && person.siteId !== selectedSiteId) {
            // Person transferred OUT of this site mid-month
            // Find last attendance day at this site to determine days here
            const thisSiteDates = Object.entries(person.attendance || {})
                .filter(([k, r]) => k.startsWith(monthPrefix) && r.siteId === selectedSiteId)
                .map(([k]) => k)
                .sort();
            if (thisSiteDates.length > 0) {
                const lastDay = parseInt(thisSiteDates[thisSiteDates.length - 1].split('-')[2], 10);
                const totalDaysInMonth = endOfMonth(referenceDate).getDate();
                leaveAllowance = Math.round(leaveAllowanceTotal * lastDay / totalDaysInMonth);
            }
        }

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
        // Helper to parse "1.000,00" -> 1000.00
        const parseCurrencyLocal = (val: string) => {
            if (!val) return 0;
            const strVal = val.toString();
            if (strVal.includes(',')) {
                return parseFloat(strVal.replace(/\./g, '').replace(',', '.')) || 0;
            }
            if ((strVal.match(/\./g) || []).length > 1) {
                return parseFloat(strVal.replace(/\./g, '')) || 0;
            }
            return parseFloat(strVal) || 0;
        };

        const salaryAmount = parseCurrencyLocal(person.salary || '');

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

    const updateSalaryAdjustment = async (personId: string, field: 'bonus' | 'deduction', value: string) => {
        const dateKey = format(date, 'yyyy-MM');
        const numValue = value ? parseFloat(value) : null; // Use null for DB

        // Optimistic Update
        setNames(prev => prev.map(p => {
            if (p.id === personId) {
                const currentAdj = p.salaryAdjustments?.[dateKey] || {};
                return {
                    ...p,
                    salaryAdjustments: {
                        ...p.salaryAdjustments,
                        [dateKey]: {
                            ...currentAdj,
                            [field]: numValue || 0
                        }
                    }
                };
            }
            return p;
        }));

        // Server Update
        await upsertSalaryAdjustment(personId, date, field, numValue);
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

        // Turkish font setup
        doc.addFileToVFS('Roboto-Regular.ttf', fontBase64);
        doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
        doc.addFont('Roboto-Regular.ttf', 'Roboto', 'bold');
        doc.setFont('Roboto', 'normal');

        // Title
        const monthName = format(date, 'MMMM', { locale: tr }).toLocaleUpperCase('tr-TR');
        const year = format(date, 'yyyy');
        doc.setFontSize(16);
        doc.setFont('Roboto', 'bold');
        doc.text(`${monthName} ${year} MAAŞ TABLOSU`, 148, 15, { align: 'center' });

        let siteName = 'Tüm Şantiyeler';
        if (selectedSiteId && selectedSiteId !== 'all') {
            const site = sites.find((s: any) => s.id === selectedSiteId);
            if (site) siteName = site.name;
        }

        const now = format(new Date(), 'dd.MM.yyyy HH:mm');

        doc.setFontSize(10);
        doc.setFont('Roboto', 'normal');
        doc.text(siteName, 14, 22);

        doc.setFontSize(8);
        doc.text(`Oluşturulma: ${now}`, 283, 22, { align: 'right' });

        const tableBody = filteredNames
            .map(p => {
                const stats = calculateStats(p, date);
                return { p, stats };
            })
            .filter(item => item.stats.totalPay >= 1)
            .map(item => {
                const { p, stats } = item;
                const fmt = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                return [
                    p.tc,
                    p.name,
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

        // Calculate grand total
        let grandTotal = 0;
        filteredNames.forEach(p => {
            const stats = calculateStats(p, date);
            if (stats.totalPay >= 1) grandTotal += stats.totalPay;
        });
        const fmtTotal = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        tableBody.push(['', '', '', '', '', '', '', '', '', '', 'TOPLAM:', fmtTotal(grandTotal) + ' ₺']);

        autoTable(doc, {
            head: [['TC', 'Ad Soyad', 'Maaş', 'Gün', 'Mesai', 'Hakediş', 'Mesai Tut.', 'Kalan İzin', 'İzin Ücreti', 'Prim', 'Kesinti', 'TOPLAM']],
            body: tableBody,
            startY: 25,
            theme: 'grid',
            headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold', font: 'Roboto' },
            styles: { fontSize: 9, cellPadding: 2, font: 'Roboto' },
            columnStyles: {
                0: { cellWidth: 25 },
                1: { cellWidth: 40 },
                11: { fontStyle: 'bold', fillColor: [240, 248, 255] }
            },
            didParseCell: (data: any) => {
                if (data.row.index === tableBody.length - 1) {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fillColor = [240, 248, 255];
                }
            }
        });

        doc.save(`Maas_Listesi_${format(date, 'yyyy_MM')}.pdf`);
    };

    // --- SITE PERSONNEL EXPORTS ---
    const handleExportSitePersonnelExcel = () => {
        const wb = XLSX.utils.book_new();
        // Filter sites based on selection
        const sitesToExport = (selectedSiteId && selectedSiteId !== 'all')
            ? availableSites.filter(s => s.id === selectedSiteId)
            : availableSites;
        sitesToExport.forEach(site => {
            const sitePersonnel = personnel.filter((p: any) => p.siteId === site.id && p.status === 'ACTIVE');
            if (sitePersonnel.length === 0) return;
            const header = ['#', 'Ad Soyad', 'Meslek', 'Görev', 'Maaş'];
            const data = sitePersonnel.map((p: any, i: number) => [
                i + 1,
                p.fullName,
                p.profession || '-',
                p.role || '-',
                formatCurrency(p.salary)
            ]);
            const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
            const sheetName = (site.name || 'Santiye').substring(0, 31);
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
        });
        XLSX.writeFile(wb, `Santiye_Personel_${format(date, 'yyyy_MM')}.xlsx`);
    };

    const handleExportSitePersonnelPDF = () => {
        const doc = new jsPDF('p', 'mm', 'a4');

        // Turkish font setup
        doc.addFileToVFS('Roboto-Regular.ttf', fontBase64);
        doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
        doc.addFont('Roboto-Regular.ttf', 'Roboto', 'bold');
        doc.setFont('Roboto', 'normal');

        // Title
        doc.setFontSize(16);
        doc.setFont('Roboto', 'bold');
        doc.text('Şantiye Personel Özeti', 105, 15, { align: 'center' });

        // Date info
        doc.setFontSize(9);
        doc.setFont('Roboto', 'normal');
        const now = format(new Date(), 'dd.MM.yyyy HH:mm');
        doc.text(`Oluşturulma: ${now}`, 196, 15, { align: 'right' });

        let startY = 25;

        // Filter sites based on selection
        const sitesToExport = (selectedSiteId && selectedSiteId !== 'all')
            ? availableSites.filter(s => s.id === selectedSiteId)
            : availableSites;

        sitesToExport.forEach(site => {
            const sitePersonnel = personnel.filter((p: any) => p.siteId === site.id && p.status === 'ACTIVE');
            if (sitePersonnel.length === 0) return;

            // Calculate total salary
            let totalSalary = 0;
            sitePersonnel.forEach((p: any) => {
                const raw = typeof p.salary === 'string'
                    ? parseFloat(p.salary.replace(/\./g, '').replace(',', '.'))
                    : (typeof p.salary === 'number' ? p.salary : 0);
                if (!isNaN(raw)) totalSalary += raw;
            });

            if (startY > 245) {
                doc.addPage();
                startY = 15;
            }

            // Site header
            doc.setFontSize(11);
            doc.setFont('Roboto', 'bold');
            doc.text(`${site.name} (${sitePersonnel.length} kişi)`, 14, startY);
            startY += 2;

            // Table body + total row
            const bodyRows = sitePersonnel.map((p: any, i: number) => [
                i + 1,
                p.fullName || '-',
                p.profession || '-',
                p.role || '-',
                formatCurrency(p.salary)
            ]);

            // Add total row
            bodyRows.push([
                '', '', '', 'TOPLAM:',
                totalSalary.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺'
            ]);

            autoTable(doc, {
                head: [['#', 'Ad Soyad', 'Meslek', 'Görev', 'Maaş']],
                body: bodyRows,
                startY,
                theme: 'grid',
                headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold', font: 'Roboto' },
                styles: { fontSize: 9, cellPadding: 2.5, font: 'Roboto' },
                columnStyles: {
                    0: { cellWidth: 12 },
                    4: { halign: 'right' }
                },
                didParseCell: (data: any) => {
                    // Style the total row
                    if (data.row.index === bodyRows.length - 1) {
                        data.cell.styles.fontStyle = 'bold';
                        data.cell.styles.fillColor = [240, 248, 255];
                    }
                }
            });
            startY = (doc as any).lastAutoTable.finalY + 12;
        });

        doc.save(`Santiye_Personel_${format(date, 'yyyy_MM')}.pdf`);
    };

    // --- ALL PERSONNEL EXPORTS ---
    const handleExportAllPersonnelExcel = () => {
        const wb = XLSX.utils.book_new();
        const activePersonnel = personnel
            .filter((p: any) => p.status === 'ACTIVE')
            .filter((p: any) => {
                if (selectedSiteId && selectedSiteId !== 'all' && p.siteId !== selectedSiteId) return false;
                return true;
            })
            .sort((a: any, b: any) => (a.fullName || '').localeCompare(b.fullName || '', 'tr'));

        const header = ['#', 'TC Kimlik', 'Ad Soyad', 'Şantiye', 'Meslek', 'Görev', 'İzin Hakkı', 'Maaş'];
        const data = activePersonnel.map((p: any, i: number) => {
            const siteName = sites.find((s: any) => s.id === p.siteId)?.name || '-';
            return [
                i + 1,
                p.tcNumber || '-',
                p.fullName,
                siteName,
                p.profession || '-',
                p.role || '-',
                (p.leaveAllowance || '0') + ' gün',
                formatCurrency(p.salary)
            ];
        });

        const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
        XLSX.utils.book_append_sheet(wb, ws, 'Tüm Personel');
        XLSX.writeFile(wb, `Tum_Personel_${format(date, 'yyyy_MM')}.xlsx`);
    };

    const handleExportAllPersonnelPDF = () => {
        const doc = new jsPDF('l', 'mm', 'a4');

        // Turkish font setup
        doc.addFileToVFS('Roboto-Regular.ttf', fontBase64);
        doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
        doc.addFont('Roboto-Regular.ttf', 'Roboto', 'bold');
        doc.setFont('Roboto', 'normal');

        // Title
        doc.setFontSize(16);
        doc.setFont('Roboto', 'bold');
        doc.text('Tüm Personel Listesi', 148, 15, { align: 'center' });

        // Date info
        doc.setFontSize(9);
        doc.setFont('Roboto', 'normal');
        const now = format(new Date(), 'dd.MM.yyyy HH:mm');
        doc.text(`Oluşturulma: ${now}`, 283, 15, { align: 'right' });

        const activePersonnel = personnel
            .filter((p: any) => p.status === 'ACTIVE')
            .filter((p: any) => {
                if (selectedSiteId && selectedSiteId !== 'all' && p.siteId !== selectedSiteId) return false;
                return true;
            })
            .sort((a: any, b: any) => (a.fullName || '').localeCompare(b.fullName || '', 'tr'));

        // Calculate total salary
        let totalSalary = 0;
        activePersonnel.forEach((p: any) => {
            const raw = typeof p.salary === 'string'
                ? parseFloat(p.salary.replace(/\./g, '').replace(',', '.'))
                : (typeof p.salary === 'number' ? p.salary : 0);
            if (!isNaN(raw)) totalSalary += raw;
        });

        const bodyRows = activePersonnel.map((p: any, i: number) => {
            const siteName = sites.find((s: any) => s.id === p.siteId)?.name || '-';
            return [
                i + 1,
                p.tcNumber || '-',
                p.fullName,
                siteName,
                p.profession || '-',
                p.role || '-',
                (p.leaveAllowance || '0') + ' gün',
                formatCurrency(p.salary)
            ];
        });

        // Total row
        bodyRows.push([
            '', '', '', '', '', '', 'TOPLAM:',
            totalSalary.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺'
        ]);

        autoTable(doc, {
            head: [['#', 'TC Kimlik', 'Ad Soyad', 'Şantiye', 'Meslek', 'Görev', 'İzin Hakkı', 'Maaş']],
            body: bodyRows,
            startY: 22,
            theme: 'grid',
            headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold', font: 'Roboto' },
            styles: { fontSize: 9, cellPadding: 2.5, font: 'Roboto' },
            columnStyles: {
                0: { cellWidth: 12 },
                7: { halign: 'right' }
            },
            didParseCell: (data: any) => {
                if (data.row.index === bodyRows.length - 1) {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fillColor = [240, 248, 255];
                }
            }
        });

        doc.save(`Tum_Personel_${format(date, 'yyyy_MM')}.pdf`);
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

    const parseCurrency = (val: string | undefined | null) => {
        if (!val) return 0;
        const strVal = val.toString();
        // Check if it's already a clean number string (no commas, single dot or no dot)
        // vs TR format (1.234,56)
        if (strVal.includes(',')) {
            // TR Format: Remove dots, replace comma with dot
            return parseFloat(strVal.replace(/\./g, '').replace(',', '.')) || 0;
        }
        // If multiple dots, it's TR format without decimals or large number?
        // e.g. 1.000.000 -> 1000000
        if ((strVal.match(/\./g) || []).length > 1) {
            return parseFloat(strVal.replace(/\./g, '')) || 0;
        }

        // Standard Format
        return parseFloat(strVal) || 0;
    };

    const formatCurrency = (amount: string | undefined) => {
        const num = parseCurrency(amount);
        if (num === 0 && !amount) return '0,00 ₺'; // Distinguish 0 from empty? Usually 0 is 0,00.
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






        // --- Mesai ve İzin Ücreti Özeti ---
        const extraPaymentData = filteredNames.map(p => {
            const stats = calculateStats(p, date);
            const totalExtra = (stats.overtimePay || 0) + (stats.leavePay || 0);
            return {
                name: trToAscii(p.name),
                leavePay: stats.leavePay || 0,
                overtimePay: stats.overtimePay || 0,
                totalExtra: totalExtra
            };
        }).filter(s => s.totalExtra >= 0.01); // Filter > 0

        if (extraPaymentData.length > 0) {
            let tableStartY = ly + 15;

            // Check page break
            if (tableStartY > doc.internal.pageSize.height - 40) {
                doc.addPage();
                tableStartY = 15;
            }

            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            // Use ASCII to guarantee it renders even without custom font, and to distinguish from "Ghost" table
            doc.text("Mesai ve Izin Ucreti Ozeti", 14, tableStartY);

            autoTable(doc, {
                head: [["Sira", "Ad Soyad", "Izin Ucreti", "Mesai Ucreti", "Toplam Ucret"]],
                body: extraPaymentData.map((s, index) => [
                    (index + 1).toString(),
                    s.name,
                    s.leavePay.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL',
                    s.overtimePay.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL',
                    s.totalExtra.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL'
                ]),
                startY: tableStartY + 2,
                theme: 'grid',
                headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
                styles: { fontSize: 8, cellPadding: 1, halign: 'center' },
                columnStyles: {
                    0: { halign: 'center', cellWidth: 10 },
                    1: { halign: 'left' },
                    2: { halign: 'right' },
                    3: { halign: 'right' },
                    4: { halign: 'right', fontStyle: 'bold' }
                }
            });

            // Update legendY so the footer starts after this table
            legendY = (doc as any).lastAutoTable.finalY;
        }

        // --- FOOTER: Notes & Overtime Table ---
        let finalY = legendY + 10;

        // Collect all notes for the current view as table rows
        const noteRows: any[][] = [];
        filteredNames.forEach(p => {
            days.forEach(d => {
                const dateKey = format(d, 'yyyy-MM-dd');
                const record = p.attendance[dateKey];
                if (record && (record.note || record.overtime)) {
                    noteRows.push([
                        format(d, 'dd.MM.yyyy'),
                        trToAscii(p.name),
                        record.overtime ? `${record.overtime} Saat` : '-',
                        record.note ? trToAscii(record.note) : '-'
                    ]);
                }
            });
        });

        if (noteRows.length > 0) {
            // Check for page break
            if (finalY > doc.internal.pageSize.height - 30) {
                doc.addPage();
                finalY = 15;
            }

            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.text(trToAscii("Açıklamalar ve Mesai Detayları"), 14, finalY);

            autoTable(doc, {
                startY: finalY + 2,
                head: [['Tarih', trToAscii('Isim'), 'Mesai', 'Not']],
                body: noteRows,
                theme: 'grid',
                headStyles: { fillColor: [100, 100, 100], textColor: 255, fontStyle: 'bold' },
                styles: { fontSize: 7, cellPadding: 2, halign: 'center' },
                columnStyles: {
                    0: { cellWidth: 22, halign: 'center' },
                    1: { cellWidth: 45, halign: 'left' },
                    2: { cellWidth: 20, halign: 'center' },
                    3: { halign: 'left' }
                }
            });
        }

        doc.save(`Puantaj_${format(date, 'yyyy_MM')}.pdf`);
    };

    return (
        <div className="p-2 sm:p-6 space-y-4 sm:space-y-6">
            <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Personel Puantaj</h1>
                    </div>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
                <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:w-[700px]">
                    <TabsTrigger value="grid" className="gap-1 text-xs sm:text-sm">Puantaj Tablosu</TabsTrigger>
                    {canViewSalary && <TabsTrigger value="salary-list" className="gap-1 text-xs sm:text-sm">Maaş Tablosu</TabsTrigger>}
                    {canViewAllPersonnel && <TabsTrigger value="site-list" className="gap-1 text-xs sm:text-sm">Şantiye Personel</TabsTrigger>}
                    {canViewAllPersonnel && <TabsTrigger value="all-list" className="gap-1 text-xs sm:text-sm">Tüm Personel</TabsTrigger>}
                </TabsList>

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-3 sm:p-4 rounded-lg border shadow-sm">
                    <div className="flex flex-wrap gap-2">
                        {canExport && (
                            <>
                                <Button variant="outline" size="sm" onClick={() => {
                                    if (activeTab === 'salary-list') handleExportSalaryExcel();
                                    else if (activeTab === 'site-list') handleExportSitePersonnelExcel();
                                    else if (activeTab === 'all-list') handleExportAllPersonnelExcel();
                                    else handleExportExcel();
                                }}>
                                    <FileSpreadsheet className="w-4 h-4 mr-1 text-green-600" />
                                    <span className="hidden sm:inline">Excel</span>
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => {
                                    if (activeTab === 'salary-list') handleExportSalaryPDF();
                                    else if (activeTab === 'site-list') handleExportSitePersonnelPDF();
                                    else if (activeTab === 'all-list') handleExportAllPersonnelPDF();
                                    else handleExportPDF();
                                }}>
                                    <Download className="w-4 h-4 mr-1 text-red-600" />
                                    <span className="hidden sm:inline">PDF</span>
                                </Button>
                            </>
                        )}

                        {canCreatePersonnel && (
                            <Button size="sm" onClick={() => {
                                setEditingId(null);
                                setFormData({
                                    siteId: selectedSiteId || (availableSites.length === 1 ? availableSites[0].id : ''),
                                    tc: '', name: '', profession: '', role: '', salary: '', newSalary: '', newSalaryDate: format(new Date(), 'yyyy-MM-dd'), leaveAllowance: '', hasOvertime: false, note: '',
                                    inputDate: format(new Date(), 'yyyy-MM-dd'),
                                    salaryHistory: []
                                });
                                setShowSalaryInput(false);
                                setIsDialogOpen(true);
                            }}>
                                <Plus className="w-4 h-4 mr-1" />
                                <span className="hidden sm:inline">Personel Ekle</span>
                                <span className="sm:hidden">Ekle</span>
                            </Button>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        {isAdmin && (
                            <div className="flex items-center gap-1 border rounded-md p-1 bg-white">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDate(subMonths(date, 1))}>
                                    <ChevronLeft className="w-4 h-4" />
                                </Button>
                                <span className="font-semibold w-36 text-center select-none text-sm capitalize">
                                    {format(date, 'MMMM yyyy', { locale: tr })}
                                </span>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDate(addMonths(date, 1))}>
                                    <ChevronRight className="w-4 h-4" />
                                </Button>
                            </div>
                        )}
                        <div className="w-full sm:w-[250px]">
                            <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Şantiye Seçiniz" />
                                </SelectTrigger>
                                <SelectContent>
                                    {isAdmin && (
                                        <SelectItem value="all" className="font-semibold text-blue-700">Şantiye Seçiniz</SelectItem>
                                    )}
                                    {availableSites.filter(s => personnel.some((p: any) => p.siteId === s.id)).map(s => (
                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                <TabsContent value="grid" className="space-y-4">

                    <div className="border rounded-md overflow-x-auto bg-white">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[90px] sm:w-[200px] sticky left-0 z-20 bg-slate-100 font-bold border-r shadow-[1px_0_2px_rgba(0,0,0,0.05)] text-[10px] sm:text-sm">Ad Soyad</TableHead>
                                    {days.map(d => (
                                        <TableHead key={d.toString()} className="p-0 text-center w-8 min-w-[32px] text-[10px] font-medium border-l">
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
                                                <TableCell className="font-medium sticky left-0 z-30 bg-background border-r p-1 sm:p-2 shadow-[2px_0_4px_rgba(0,0,0,0.1)]">
                                                    <div className="flex flex-col w-full">
                                                        <span className="text-[11px] sm:text-sm font-bold truncate">{person.name}</span>
                                                        <span className="text-[9px] text-muted-foreground truncate">{person.role}</span>
                                                    </div>
                                                </TableCell>
                                                {days.map(d => {
                                                    const dateKey = format(d, 'yyyy-MM-dd');
                                                    const record = (person.attendance || {})[dateKey];
                                                    const isLocked = !canEditRecord(person, record, d);

                                                    // [NEW] Transfer-aware: check if this day's record belongs to another site
                                                    const isOtherSiteRecord = record?.siteId && selectedSiteId && record.siteId !== selectedSiteId;
                                                    // Days before transferInDate at this site = other site days (show airplane)
                                                    const isPreTransferDay = person.transferInDate && dateKey < person.transferInDate;
                                                    // Person has left this site (their current siteId differs)
                                                    const isPostTransferDay = person.siteId !== selectedSiteId && selectedSiteId && !record;

                                                    // Sequential Logic:
                                                    const showLine = !record && isExited && !isPreTransferDay && !isPostTransferDay;
                                                    const isStartDate = person.inputDate === dateKey;

                                                    // Update State for NEXT iteration (or subsequent empty cells)
                                                    if (record?.status === 'EXIT') {
                                                        isExited = true;
                                                    } else if (record?.status) {
                                                        isExited = false;
                                                    }

                                                    let cellClass = "";

                                                    // Non-editable days: gray background, no click
                                                    if (isLocked) {
                                                        cellClass = "bg-gray-100 cursor-default";
                                                    }

                                                    // Default empty state: Centered dot
                                                    let cellContent = <div className="w-full h-full flex items-center justify-center text-slate-300 font-bold text-lg select-none">·</div>;

                                                    // [NEW] Show airplane icon for days at another site (pre-transfer or other-site records)
                                                    if (isOtherSiteRecord || isPreTransferDay) {
                                                        cellContent = <div className="w-full h-full flex items-center justify-center bg-slate-50 text-slate-400"><Plane className="w-4 h-4" /></div>;
                                                        cellClass = "bg-slate-50 cursor-default";
                                                    } else if (isPostTransferDay) {
                                                        // Person has left this site, empty days after their last record = locked/dash
                                                        cellContent = <div className="w-full h-full flex items-center justify-center text-slate-300">—</div>;
                                                        cellClass = "bg-gray-100 cursor-default";
                                                    } else if (showLine) {
                                                        cellContent = <div className="w-full h-full flex items-center justify-center"><div className="w-full h-[2px] bg-red-400"></div></div>;
                                                    } else {
                                                        // Show FULL Status for Start Date (Auto Work) - Overrides dot if no explicit record
                                                        if (isStartDate && !record) {
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
                                                    }

                                                    // (Logic handled sequentially above via showLine)

                                                    return (
                                                        <TableCell
                                                            key={d.toString()}
                                                            className={`p-0 border-l text-center transition-colors ${isLocked ? '' : 'hover:opacity-80 cursor-pointer'} h-10 w-8 min-w-[32px] ${cellClass} relative`}
                                                            onClick={() => {
                                                                if (isLocked) return;
                                                                setSelectedCell({ personId: person.id, date: d });
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
                                                    {canTransfer && (
                                                        <Button variant="ghost" size="icon" onClick={() => openTransferModal(person)} className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-50 mr-1" title="Transfer Et">
                                                            <ArrowRightLeft className="w-4 h-4" />
                                                        </Button>
                                                    )}
                                                    {canEditPersonnel && (
                                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(person.id)} className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50" title="Sil">
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    )}
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
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
                            <div className="space-y-1">
                                <CardTitle className="text-base font-semibold text-slate-700">Şantiye Personel Özeti</CardTitle>
                                <CardDescription>Şantiyelere göre toplam personel ve maaş dağılımı.</CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                {/* Optional: Add Export for Summary */}
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow>
                                        <TableHead className="font-semibold text-slate-600 pl-6">Şantiye Adı</TableHead>
                                        <TableHead className="font-semibold text-slate-600 text-center w-[150px]">
                                            <div className="flex items-center justify-center gap-2">
                                                <Users className="h-4 w-4 text-slate-500" /> Çalışan Sayısı
                                            </div>
                                        </TableHead>
                                        <TableHead className="font-semibold text-slate-600 text-right pr-6 w-[200px]">
                                            <div className="flex items-center justify-end gap-2">
                                                <ReceiptTurkishLira className="h-4 w-4 text-slate-500" /> Toplam Maaş
                                            </div>
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(() => {
                                        // Calculate Summary on the fly
                                        const summary: Record<string, { name: string; count: number; totalSalary: number }> = {};

                                        // 1. Initialize with active sites (to show empty ones if "All" is selected)
                                        // Only if showing ALL sites, otherwise just show filtered
                                        const showAllSites = !selectedSiteId || selectedSiteId === 'all';

                                        if (showAllSites) {
                                            sites.filter((s: any) => s.status === 'ACTIVE').forEach((s: any) => {
                                                summary[s.id] = { name: s.name, count: 0, totalSalary: 0 };
                                            });
                                        }

                                        // 2. Aggregate from filtered list
                                        // [FIX] When showing all sites, 'names' is empty because refreshData() clears it
                                        // when no specific site is selected. Use store 'personnel' for cross-site summary.
                                        const sourceList = showAllSites
                                            ? personnel.filter((p: any) => p.status === 'ACTIVE').map((p: any) => ({
                                                siteId: p.siteId || 'unknown',
                                                salary: p.salary ? p.salary.toString() : '',
                                                inputDate: p.startDate ? format(new Date(p.startDate), 'yyyy-MM-dd') : undefined,
                                                attendance: {} // Not needed for count/salary summary
                                            }))
                                            : names;

                                        sourceList.forEach(p => {
                                            // 1. Basic Date Visibility Filter
                                            // Skip if start date is strictly in the future (next month or later)
                                            if (p.inputDate) {
                                                const startDate = new Date(p.inputDate);
                                                // If View Month is BEFORE Start Month
                                                if (differenceInCalendarMonths(startOfMonth(date), startDate) < 0) {
                                                    // Check if they have unexpected attendance this month (e.g. started early)
                                                    const hasAtt = Object.keys(p.attendance).some(k => k.startsWith(format(date, 'yyyy-MM')));
                                                    if (!hasAtt) return;
                                                }
                                            }

                                            const sId = p.siteId || 'unknown';

                                            // Initialize if missing (e.g. Passive site or Unknown)
                                            if (!summary[sId]) {
                                                const sName = sites.find((s: any) => s.id === sId)?.name || 'Bilinmeyen Şantiye';
                                                summary[sId] = { name: sName, count: 0, totalSalary: 0 };
                                            }

                                            summary[sId].count += 1;
                                            summary[sId].totalSalary += parseCurrency(p.salary);
                                        });

                                        // 3. Convert to Array & Sort
                                        // Filter out empty sites ONLY if we are filtering? No, usually summarized view shows 0 counts nicely.
                                        // But let's keep it clean.
                                        const summaryList = Object.values(summary).sort((a, b) => b.totalSalary - a.totalSalary);

                                        const grandTotalCount = summaryList.reduce((acc, curr) => acc + curr.count, 0);
                                        const grandTotalSalary = summaryList.reduce((acc, curr) => acc + curr.totalSalary, 0);

                                        if (summaryList.length === 0) {
                                            return (
                                                <TableRow>
                                                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">Veri bulunamadı.</TableCell>
                                                </TableRow>
                                            );
                                        }

                                        return (
                                            <>
                                                {summaryList.map((item) => (
                                                    <TableRow key={item.name} className="hover:bg-slate-50">
                                                        <TableCell className="font-medium text-slate-700 pl-6">
                                                            {item.name}
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <Badge variant="secondary" className="font-mono text-sm px-3">
                                                                {item.count}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right font-mono font-medium text-slate-700 pr-6">
                                                            {item.totalSalary.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                                <TableRow className="bg-slate-100 hover:bg-slate-100 border-t-2 border-slate-300">
                                                    <TableCell className="font-bold text-slate-800 pl-6">GENEL TOPLAM</TableCell>
                                                    <TableCell className="font-bold text-slate-800 text-center">
                                                        <Badge className="font-mono text-sm px-3 bg-slate-800 hover:bg-slate-700">
                                                            {grandTotalCount}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="font-bold text-emerald-700 text-right font-mono pr-6 text-lg">
                                                        {grandTotalSalary.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                                                    </TableCell>
                                                </TableRow>
                                            </>
                                        );
                                    })()}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>




                {/* SALARY TABLE */}
                <TabsContent value="salary-list" className="space-y-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle>Maaş Hesaplama Tablosu</CardTitle>
                        </CardHeader>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px]">#</TableHead>
                                    <TableHead>Ad Soyad</TableHead>
                                    <TableHead>Maaş</TableHead>
                                    <TableHead className="text-center">Gün</TableHead>
                                    <TableHead className="text-center">Mesai</TableHead>
                                    <TableHead className="text-right">Hakediş</TableHead>
                                    <TableHead className="text-right">Mesai Tutarı</TableHead>
                                    <TableHead className="text-right bg-green-50/50">Prim</TableHead>
                                    <TableHead className="text-right bg-red-50/50">Kesinti</TableHead>
                                    <TableHead className="text-right font-bold">TOPLAM</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredNames.map((person, index) => {
                                    const stats = calculateStats(person, date);
                                    const fmt = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

                                    return (
                                        <TableRow key={person.id}>
                                            <TableCell>{index + 1}</TableCell>
                                            <TableCell className="font-medium">{person.name}</TableCell>
                                            <TableCell>{formatCurrency(person.salary)}</TableCell>
                                            <TableCell className="text-center">{stats.workedDays}</TableCell>
                                            <TableCell className="text-center">{stats.overtimeTotal || '-'}</TableCell>
                                            <TableCell className="text-right">{fmt(stats.basePay)} ₺</TableCell>
                                            <TableCell className="text-right">{fmt(stats.overtimePay)} ₺</TableCell>
                                            <TableCell className="p-0 bg-green-50/30">
                                                <SalaryEditableCell
                                                    value={stats.bonus}
                                                    type="Prim"
                                                    colorClass="text-green-700"
                                                    onSave={(val) => updateSalaryAdjustment(person.id, 'bonus', val)}
                                                    disabled={!canEditSalary}
                                                />
                                            </TableCell>
                                            <TableCell className="p-0 bg-red-50/30">
                                                <SalaryEditableCell
                                                    value={stats.deduction}
                                                    type="Kesinti"
                                                    colorClass="text-red-700"
                                                    onSave={(val) => updateSalaryAdjustment(person.id, 'deduction', val)}
                                                    disabled={!canEditSalary}
                                                />
                                            </TableCell>
                                            <TableCell className="text-right font-bold text-blue-700">
                                                {fmt(stats.totalPay)} ₺
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </Card>
                </TabsContent>

                {/* SITE PERSONNEL LIST */}
                {canViewAllPersonnel && (
                    <TabsContent value="site-list" className="space-y-4">
                        {availableSites.map(site => {
                            const sitePersonnel = personnel.filter((p: any) => p.siteId === site.id && p.status === 'ACTIVE');
                            if (sitePersonnel.length === 0) return null;
                            return (
                                <Card key={site.id}>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-base flex items-center gap-2">
                                            {site.name}
                                            <Badge variant="secondary">{sitePersonnel.length} kişi</Badge>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-[50px]">#</TableHead>
                                                    <TableHead>Ad Soyad</TableHead>
                                                    <TableHead>Meslek</TableHead>
                                                    <TableHead>Görev</TableHead>
                                                    <TableHead className="text-right">Maaş</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {sitePersonnel.map((p: any, i: number) => (
                                                    <TableRow key={p.id}>
                                                        <TableCell>{i + 1}</TableCell>
                                                        <TableCell className="font-medium">{p.fullName}</TableCell>
                                                        <TableCell>{p.profession || '-'}</TableCell>
                                                        <TableCell>{p.role || '-'}</TableCell>
                                                        <TableCell className="text-right">{formatCurrency(p.salary)}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </TabsContent>
                )}

                {/* ALL PERSONNEL LIST */}
                {canViewAllPersonnel && (
                    <TabsContent value="all-list" className="space-y-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="flex items-center gap-2">
                                    Tüm Personel
                                    <Badge variant="secondary">{personnel.filter((p: any) => p.status === 'ACTIVE' && (!selectedSiteId || selectedSiteId === 'all' || p.siteId === selectedSiteId)).length} aktif</Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[50px]">#</TableHead>
                                            <TableHead>
                                                <div className="flex items-center gap-1">
                                                    TC Kimlik No
                                                    <ColumnFilter
                                                        title="TC"
                                                        options={generateOptions(personnel.filter((p: any) => p.status === 'ACTIVE').map((p: any) => ({ tc: p.tcNumber || '' })), 'tc')}
                                                        selectedValues={columnFilters['allList_tc'] || []}
                                                        onSelect={(val) => handleFilterChange('allList_tc', val)}
                                                        onClear={() => clearFilter('allList_tc')}
                                                    />
                                                </div>
                                            </TableHead>
                                            <TableHead>
                                                <div className="flex items-center gap-1">
                                                    Ad Soyad
                                                    <ColumnFilter
                                                        title="Ad Soyad"
                                                        options={generateOptions(personnel.filter((p: any) => p.status === 'ACTIVE').map((p: any) => ({ name: p.fullName || '' })), 'name')}
                                                        selectedValues={columnFilters['allList_name'] || []}
                                                        onSelect={(val) => handleFilterChange('allList_name', val)}
                                                        onClear={() => clearFilter('allList_name')}
                                                    />
                                                </div>
                                            </TableHead>
                                            <TableHead>
                                                <div className="flex items-center gap-1">
                                                    Şantiye
                                                    <ColumnFilter
                                                        title="Şantiye"
                                                        options={availableSites.map(s => ({ label: s.name, value: s.id }))}
                                                        selectedValues={columnFilters['allList_site'] || []}
                                                        onSelect={(val) => handleFilterChange('allList_site', val)}
                                                        onClear={() => clearFilter('allList_site')}
                                                    />
                                                </div>
                                            </TableHead>
                                            <TableHead>
                                                <div className="flex items-center gap-1">
                                                    Meslek
                                                    <ColumnFilter
                                                        title="Meslek"
                                                        options={generateOptions(personnel.filter((p: any) => p.status === 'ACTIVE').map((p: any) => ({ profession: p.profession || '' })), 'profession')}
                                                        selectedValues={columnFilters['allList_profession'] || []}
                                                        onSelect={(val) => handleFilterChange('allList_profession', val)}
                                                        onClear={() => clearFilter('allList_profession')}
                                                    />
                                                </div>
                                            </TableHead>
                                            <TableHead>
                                                <div className="flex items-center gap-1">
                                                    Görev
                                                    <ColumnFilter
                                                        title="Görev"
                                                        options={generateOptions(personnel.filter((p: any) => p.status === 'ACTIVE').map((p: any) => ({ role: p.role || '' })), 'role')}
                                                        selectedValues={columnFilters['allList_role'] || []}
                                                        onSelect={(val) => handleFilterChange('allList_role', val)}
                                                        onClear={() => clearFilter('allList_role')}
                                                    />
                                                </div>
                                            </TableHead>
                                            <TableHead className="text-center">İzin Hakkı</TableHead>
                                            <TableHead className="text-right">Maaş</TableHead>
                                            <TableHead className="text-center">İşlemler</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {personnel
                                            .filter((p: any) => p.status === 'ACTIVE')
                                            .filter((p: any) => {
                                                // Site filter from top dropdown
                                                if (selectedSiteId && selectedSiteId !== 'all') {
                                                    if (p.siteId !== selectedSiteId) return false;
                                                }
                                                return true;
                                            })
                                            .filter((p: any) => {
                                                const tcFilter = columnFilters['allList_tc'] || [];
                                                if (tcFilter.length > 0 && !tcFilter.includes(p.tcNumber || '')) return false;
                                                const nameFilter = columnFilters['allList_name'] || [];
                                                if (nameFilter.length > 0 && !nameFilter.includes(p.fullName || '')) return false;
                                                const siteFilter = columnFilters['allList_site'] || [];
                                                if (siteFilter.length > 0 && !siteFilter.includes(p.siteId || '')) return false;
                                                const profFilter = columnFilters['allList_profession'] || [];
                                                if (profFilter.length > 0 && !profFilter.includes(p.profession || '')) return false;
                                                const roleFilter = columnFilters['allList_role'] || [];
                                                if (roleFilter.length > 0 && !roleFilter.includes(p.role || '')) return false;
                                                return true;
                                            })
                                            .sort((a: any, b: any) => (a.fullName || '').localeCompare(b.fullName || '', 'tr'))
                                            .map((p: any, i: number) => {
                                                const site = sites.find((s: any) => s.id === p.siteId);
                                                return (
                                                    <TableRow key={p.id}>
                                                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                                                        <TableCell className="font-mono text-xs">{p.tcNumber || '-'}</TableCell>
                                                        <TableCell className="font-medium">{p.fullName}</TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline" className="text-xs">{site?.name || '-'}</Badge>
                                                        </TableCell>
                                                        <TableCell>{p.profession || '-'}</TableCell>
                                                        <TableCell>{p.role || '-'}</TableCell>
                                                        <TableCell className="text-center">{p.leaveAllowance || '0'} gün</TableCell>
                                                        <TableCell className="text-right">{formatCurrency(p.salary)}</TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center justify-center gap-1">
                                                                {canEditPersonnel && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                                        title="Düzenle"
                                                                        onClick={() => {
                                                                            const person = names.find(n => n.id === p.id);
                                                                            if (person) {
                                                                                handleEdit(person);
                                                                            } else {
                                                                                // Fallback: construct from store data
                                                                                handleEdit({
                                                                                    id: p.id,
                                                                                    siteId: p.siteId || '',
                                                                                    tc: p.tcNumber || '',
                                                                                    name: p.fullName,
                                                                                    profession: p.profession || '',
                                                                                    role: p.role || '',
                                                                                    salary: p.salary?.toString() || '',
                                                                                    leaveAllowance: p.leaveAllowance || '',
                                                                                    hasOvertime: p.hasOvertime || false,
                                                                                    note: p.note || '',
                                                                                    inputDate: p.startDate ? format(new Date(p.startDate), 'yyyy-MM-dd') : undefined,
                                                                                    attendance: {},
                                                                                    salaryHistory: [],
                                                                                    salaryAdjustments: {}
                                                                                });
                                                                            }
                                                                        }}
                                                                    >
                                                                        <Pencil className="w-3.5 h-3.5" />
                                                                    </Button>
                                                                )}
                                                                {canTransfer && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-7 w-7 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                                                        title="Şantiye Ata"
                                                                        onClick={() => {
                                                                            setTransferData({
                                                                                personId: p.id,
                                                                                targetSiteId: '',
                                                                                transferDate: new Date(),
                                                                                mode: 'move'
                                                                            });
                                                                            setIsTransferOpen(true);
                                                                        }}
                                                                    >
                                                                        <ArrowRightLeft className="w-3.5 h-3.5" />
                                                                    </Button>
                                                                )}
                                                                {canEditPersonnel && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                        title="Sil"
                                                                        onClick={() => handleDelete(p.id)}
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}

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
                                    <div className="grid grid-cols-2 gap-2">
                                        <Button
                                            variant={attendanceForm.status === 'FULL' ? 'default' : 'outline'}
                                            className={`h-14 flex flex-col items-center justify-center gap-1 ${attendanceForm.status === 'FULL' ? 'bg-green-600 hover:bg-green-700' : 'hover:bg-green-50 text-green-700 border-green-200'}`}
                                            onClick={() => saveAttendance('FULL')}
                                        >
                                            <CheckCircle2 className="w-5 h-5" />
                                            <span className="text-xs font-medium">Çalıştı</span>
                                        </Button>
                                        <Button
                                            variant={attendanceForm.status === 'HALF' ? 'default' : 'outline'}
                                            className={`h-14 flex flex-col items-center justify-center gap-1 ${attendanceForm.status === 'HALF' ? 'bg-orange-500 hover:bg-orange-600' : 'hover:bg-orange-50 text-orange-700 border-orange-200'}`}
                                            onClick={() => saveAttendance('HALF')}
                                        >
                                            <Clock className="w-5 h-5" />
                                            <span className="text-xs font-medium">Yarım Gün</span>
                                        </Button>
                                        <Button
                                            variant={attendanceForm.status === 'ABSENT' ? 'default' : 'outline'}
                                            className={`h-14 flex flex-col items-center justify-center gap-1 ${attendanceForm.status === 'ABSENT' ? 'bg-red-500 hover:bg-red-600' : 'hover:bg-red-50 text-red-700 border-red-200'}`}
                                            onClick={() => saveAttendance('ABSENT')}
                                        >
                                            <XCircle className="w-5 h-5" />
                                            <span className="text-xs font-medium">Gelmedi</span>
                                        </Button>
                                        <Button
                                            variant={attendanceForm.status === 'LEAVE' ? 'default' : 'outline'}
                                            className={`h-14 flex flex-col items-center justify-center gap-1 ${attendanceForm.status === 'LEAVE' ? 'bg-blue-500 hover:bg-blue-600' : 'hover:bg-blue-50 text-blue-700 border-blue-200'}`}
                                            onClick={() => saveAttendance('LEAVE')}
                                        >
                                            <Umbrella className="w-5 h-5" />
                                            <span className="text-xs font-medium">İzinli</span>
                                        </Button>
                                        <Button
                                            variant={attendanceForm.status === 'REPORT' ? 'default' : 'outline'}
                                            className={`h-14 flex flex-col items-center justify-center gap-1 ${attendanceForm.status === 'REPORT' ? 'bg-purple-500 hover:bg-purple-600' : 'hover:bg-purple-50 text-purple-700 border-purple-200'}`}
                                            onClick={() => saveAttendance('REPORT')}
                                        >
                                            <FileText className="w-5 h-5" />
                                            <span className="text-xs font-medium">Raporlu</span>
                                        </Button>
                                        <Button
                                            variant={attendanceForm.status === 'OUT' ? 'default' : 'outline'}
                                            className={`h-14 flex flex-col items-center justify-center gap-1 ${attendanceForm.status === 'OUT' ? 'bg-cyan-500 hover:bg-cyan-600' : 'hover:bg-cyan-50 text-cyan-700 border-cyan-200'}`}
                                            onClick={() => saveAttendance('OUT')}
                                        >
                                            <Car className="w-5 h-5" />
                                            <span className="text-xs font-medium">Dış Görev</span>
                                        </Button>
                                        <Button
                                            variant={attendanceForm.status === 'EXIT' ? 'default' : 'outline'}
                                            className={`h-14 flex flex-col items-center justify-center gap-1 ${attendanceForm.status === 'EXIT' ? 'bg-red-800 text-white' : 'bg-red-600 text-white hover:bg-red-700 hover:text-white border-0'} col-span-2 font-bold transition-colors shadow-sm`}
                                            onClick={async () => {
                                                if (window.confirm("Bu personeli işten çıkarmak istediğinize emin misiniz?")) {
                                                    // 1. Save EXIT attendance record
                                                    saveAttendance('EXIT');

                                                    // 2. Update personnel status to LEFT in database via API
                                                    const personId = selectedCell?.personId;
                                                    if (personId) {
                                                        try {
                                                            const exitDate = selectedCell?.date ? format(selectedCell.date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
                                                            const res = await fetch('/api/personnel/mark-left', {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ personnelId: personId, leftDate: exitDate })
                                                            });
                                                            const result = await res.json();
                                                            if (result.success) {
                                                                console.log('[İşten Ayrıldı] DB güncellendi:', result.data?.fullName);
                                                                // Update local state
                                                                setNames(prev => prev.map(n =>
                                                                    n.id === personId
                                                                        ? { ...n, status: 'LEFT', transferOutDate: exitDate }
                                                                        : n
                                                                ));
                                                            } else {
                                                                console.error('[İşten Ayrıldı] DB başarısız:', result.error);
                                                                alert('İşten ayrıldı durumu veritabanına kaydedilemedi! Lütfen tekrar deneyin.');
                                                            }
                                                        } catch (err) {
                                                            console.error('[İşten Ayrıldı] API hatası:', err);
                                                            alert('İşten ayrıldı durumu kaydedilirken hata oluştu!');
                                                        }
                                                    }
                                                }
                                            }}
                                        >
                                            <LogOut className="w-5 h-5" />
                                            <span className="text-xs font-medium">İşten Ayrıldı</span>
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
                                                value={attendanceForm.overtime || ''}
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
                                        value={attendanceForm.note || ''}
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
                                <Label>
                                    Maaşı (₺) <span className="text-red-500">*</span>
                                    {editingId && (() => {
                                        const person = names.find(p => p.id === editingId);
                                        const history = (person as any)?.salaryHistory;
                                        if (history && Array.isArray(history) && history.length > 0) {
                                            const lastEntry = history[history.length - 1];
                                            const dateStr = lastEntry.date ? new Date(lastEntry.date).toLocaleDateString('tr-TR') : '';
                                            return <span className="text-xs text-muted-foreground ml-2">(Son güncelleme: {dateStr})</span>;
                                        }
                                        return null;
                                    })()}
                                </Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="text"
                                        value={formData.salary}
                                        onChange={e => {
                                            const formatted = formatMoneyInput(e.target.value);
                                            setFormData({ ...formData, salary: formatted });
                                        }}
                                        placeholder="0,00"
                                    />


                                </div>
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
                                <Button onClick={handleAdd}>
                                    {editingId ? 'Güncelle' : 'Kaydet'}
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
            </Tabs>
        </div >
    );
}
