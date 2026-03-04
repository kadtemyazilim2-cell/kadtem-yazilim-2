'use client';

import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import { useAppStore } from '@/lib/store/use-store';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
// AlertDialog imports removed
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { deleteCorrespondence as deleteCorrespondenceAction, updateCorrespondence as updateCorrespondenceAction, restoreCorrespondence as restoreCorrespondenceAction } from '@/actions/correspondence';
import { useState, useEffect } from 'react';
import { AlertCircle, FileText, Search, Plus, Filter, Calendar as CalendarIcon, Wallet, Download, Trash2, Edit, Printer, FileDown, Eye, Maximize2, Minimize2, AlignLeft, AlignCenter, AlignRight, Building2, Landmark, AlertTriangle, RotateCcw, Copy, Pencil, FileSpreadsheet, Lock } from "lucide-react";
import { CorrespondenceForm } from './CorrespondenceForm';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { generateCorrespondencePDF } from '@/lib/pdf-generator';
import { useAuth } from '@/lib/store/use-auth';
import { normalizeSearchText } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/multi-select';
import { useRef } from 'react';

const PDFPreview = ({ base64 }: { base64: string }) => {
    const [url, setUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!base64) return;
        try {
            // Handle both raw base64 and data URI
            const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;

            // Standard base64 decoding
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/pdf' });
            const blobUrl = URL.createObjectURL(blob);
            setUrl(blobUrl);

            return () => URL.revokeObjectURL(blobUrl);
        } catch (e) {
            console.error("PDF Preview Error:", e);
            setUrl(null);
        }
    }, [base64]);

    if (!url) return <div className="flex items-center justify-center h-full text-sm text-slate-500">Önizleme hazırlanıyor...</div>;

    return (
        <iframe
            src={url}
            className="w-full h-full"
            title="PDF Preview"
        />
    );
};

import * as XLSX from 'xlsx';
import autoTable from 'jspdf-autotable';
import { fontBase64 } from '@/lib/pdf-font'; // Assume this exists as used in other files
import { createInstitution as createInstitutionAction, updateInstitution as updateInstitutionAction, deleteInstitution as deleteInstitutionAction, permanentDeleteInstitution as permanentDeleteInstitutionAction } from '@/actions/institution';

export function CorrespondenceList() {
    const { correspondences, companies, updateCorrespondence, users, deleteCorrespondence, restoreCorrespondence, institutions, deleteInstitution, removeInstitution, updateInstitution, addInstitution, addCorrespondence, sites } = useAppStore();
    const { user, hasPermission } = useAuth();

    // Permission Checks
    const canViewIncoming = hasPermission('correspondence.incoming', 'VIEW');
    const canCreateIncoming = hasPermission('correspondence.incoming', 'CREATE');
    const canEditIncoming = hasPermission('correspondence.incoming', 'EDIT');

    const canViewOutgoing = hasPermission('correspondence.outgoing', 'VIEW');
    const canCreateOutgoing = hasPermission('correspondence.outgoing', 'CREATE');
    const canEditOutgoing = hasPermission('correspondence.outgoing', 'EDIT');

    const canViewBank = hasPermission('correspondence.bank', 'VIEW');
    const canCreateBank = hasPermission('correspondence.bank', 'CREATE');
    const canEditBank = hasPermission('correspondence.bank', 'EDIT');

    const canViewContacts = hasPermission('correspondence.contacts', 'VIEW');
    const canCreateContacts = hasPermission('correspondence.contacts', 'CREATE');
    const canEditContacts = hasPermission('correspondence.contacts', 'EDIT');

    const canViewDeleted = hasPermission('correspondence.deleted', 'VIEW');
    const canExport = hasPermission('correspondence', 'EXPORT');

    // Default Tab Logic
    const getDefaultTab = () => {
        if (canViewIncoming) return 'incoming';
        if (canViewOutgoing) return 'outgoing';
        if (canViewBank) return 'bank';
        if (canViewContacts) return 'muhataplar';
        if (canViewDeleted) return 'deleted';
        return 'incoming'; // Fallback
    };

    const [missingRefs, setMissingRefs] = useState<any[]>([]);
    const [missingRegs, setMissingRegs] = useState<any[]>([]); // New State for Missing Reg Nos
    const [isReminderOpen, setIsReminderOpen] = useState(false);
    const [isRegReminderOpen, setIsRegReminderOpen] = useState(false); // New Dialog State
    const [editRefs, setEditRefs] = useState<{ [key: string]: string }>({});
    const [editRegs, setEditRegs] = useState<{ [key: string]: string }>({}); // New Edit State
    const [searchTerm, setSearchTerm] = useState('');

    // Filter Dialog States
    const [isAddressOpen, setIsAddressOpen] = useState(false); // Legacy?
    const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
    const [editInstId, setEditInstId] = useState<string | null>(null);
    const [editInstName, setEditInstName] = useState('');
    const [editInstShortName, setEditInstShortName] = useState(''); // [NEW]
    const [editInstCategory, setEditInstCategory] = useState<'INSTITUTION' | 'BANK'>('INSTITUTION');
    const [editInstAlign, setEditInstAlign] = useState<'left' | 'center' | 'right'>('center');

    // [NEW] Track specific item for single-entry
    const [selectedRegId, setSelectedRegId] = useState<string | null>(null);
    const [copyItem, setCopyItem] = useState<null | any>(null);

    // New helper to open specific reg number edit
    const openRegReminder = (itemId?: string) => {
        if (itemId) {
            setSelectedRegId(itemId);
            // Pre-fill if editing existing
            const item = activeCorrespondences.find((c: any) => c.id === itemId);
            if (item && item.registrationNumber) {
                setEditRegs(prev => ({ ...prev, [itemId]: item.registrationNumber || '' }));
            }
        } else {
            setSelectedRegId(null);
        }
        setIsRegReminderOpen(true);
    };


    // Button to open Missing Registration Numbers
    const MissingRegButton = () => {
        if (missingRegs.length === 0) return null;
        return (
            <Button
                variant="destructive"
                size="sm"
                onClick={() => openRegReminder()}
                className="animate-pulse"
            >
                <AlertCircle className="w-4 h-4 mr-2" />
                {missingRegs.length} Eksik Kayıt No
            </Button>
        );
    };

    // [NEW] Filters
    const [filterCompany, setFilterCompany] = useState<string[]>([]);
    const [filterCreator, setFilterCreator] = useState<string[]>([]);
    const [filterSenderReceiver, setFilterSenderReceiver] = useState<string[]>([]);
    const [dateRange, setDateRange] = useState<{ start: string, end: string }>({ start: '', end: '' });

    // Address Book Edit Logic
    // const [editInstId, setEditInstId] = useState<string | null>(null); // Already declared above
    // const [editInstName, setEditInstName] = useState(''); // Already declared above
    // const [editInstAlign, setEditInstAlign] = useState<'left' | 'center' | 'right'>('center'); // Already declared above
    // const [editInstCategory, setEditInstCategory] = useState<'BANK' | 'INSTITUTION'>('INSTITUTION'); // Already declared above
    // const [isAddressModalOpen, setIsAddressModalOpen] = useState(false); // Already declared above

    const getCompanyName = (id: string) => companies.find((c: any) => c.id === id)?.name || '-';

    const openAddressModal = (item?: any) => {
        if (item) {
            setEditInstId(item.id);
            setEditInstName(item.name);
            setEditInstShortName(item.shortName || ''); // [NEW]
            setEditInstAlign(item.alignment || 'left');
            setEditInstCategory(item.category || 'INSTITUTION');
        } else {
            setEditInstId(null);
            setEditInstName('');
            setEditInstShortName(''); // [NEW]
            setEditInstAlign('center'); // Center by default
            setEditInstCategory('INSTITUTION'); // Default
        }
        setIsAddressModalOpen(true);
    };
    const getUserName = (id: string) => users.find((u: any) => u.id === id)?.name || 'Bilinmeyen';

    const handleSaveAddress = async () => {
        if (!editInstName.trim()) return;

        try {
            if (editInstId) {
                // Update Existing
                const result = await updateInstitutionAction(editInstId, {
                    name: editInstName,
                    shortName: editInstShortName, // [NEW] - Ensure this is passed
                    alignment: editInstAlign, // Keep existing alignment logic if needed, or force center. Using state.
                    category: editInstCategory
                });

                if (result.success) {
                    updateInstitution(editInstId, {
                        name: editInstName,
                        shortName: editInstShortName,
                        alignment: editInstAlign,
                        category: editInstCategory
                    });
                    toast.success('Muhatap güncellendi.');
                    setIsAddressModalOpen(false);
                } else {
                    toast.error(result.error || 'Güncelleme başarısız.');
                }
            } else {
                // Create New
                const result = await createInstitutionAction({
                    name: editInstName,
                    shortName: editInstShortName,
                    alignment: editInstAlign,
                    category: editInstCategory,
                    // id will be generated by server usually, or we pass one. The action likely handles it.
                    // If action expects ID, we generate. If not, we wait for response.
                    // Assuming action returns the created object.
                });

                if (result.success && result.data) {
                    addInstitution(result.data as any);
                    toast.success('Muhatap eklendi.');
                    setIsAddressModalOpen(false);
                } else {
                    toast.error(result.error || 'Ekleme başarısız.');
                }
            }
        } catch (error) {
            console.error(error);
            toast.error('Bir hata oluştu.');
        }
    };

    // Delete Logic
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleteReason, setDeleteReason] = useState('');
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);

    // Extract Unique Values for Dropdowns
    // We only care about active correspondences to avoid cluttering filters with deleted items' data
    const baseList = correspondences.filter((c: any) => c.status !== 'DELETED');

    const uniqueCompanyIds = Array.from(new Set(baseList.map((c: any) => c.companyId)));
    const uniqueCreatorIds = Array.from(new Set(baseList.map((c: any) => c.createdByUserId)));
    const uniqueSenderReceivers = Array.from(new Set(baseList.map((c: any) => c.senderReceiver).filter(Boolean))).sort();

    const activeCorrespondences = baseList
        .filter((c: any) => {
            // 1. Search Term (Fuzzy)
            if (searchTerm) {
                const lowerSearch = normalizeSearchText(searchTerm);
                const subject = normalizeSearchText(c.subject);
                const refNo = normalizeSearchText(c.referenceNumber);
                const senderReceiver = normalizeSearchText(c.senderReceiver);
                const date = normalizeSearchText(c.date);
                const regNo = normalizeSearchText(c.registrationNumber);
                const company = normalizeSearchText(getCompanyName(c.companyId));
                const creator = normalizeSearchText(getUserName(c.createdByUserId));
                const formattedDate = normalizeSearchText(format(new Date(c.date), 'dd.MM.yyyy'));

                const matches = (
                    subject.includes(lowerSearch) ||
                    refNo.includes(lowerSearch) ||
                    senderReceiver.includes(lowerSearch) ||
                    date.includes(lowerSearch) ||
                    formattedDate.includes(lowerSearch) ||
                    regNo.includes(lowerSearch) ||
                    company.includes(lowerSearch) ||
                    creator.includes(lowerSearch)
                );
                if (!matches) return false;
            }

            // 2. Dropdown Filters
            if (filterCompany.length > 0 && !filterCompany.includes(c.companyId)) return false;
            if (filterCreator.length > 0 && !filterCreator.includes(c.createdByUserId)) return false;
            if (filterSenderReceiver.length > 0 && !filterSenderReceiver.includes(c.senderReceiver)) return false;

            // 3. Date Range
            if (dateRange.start) {
                if (new Date(c.date) < new Date(dateRange.start)) return false;
            }
            if (dateRange.end) {
                // Set end date to end of day? Or just simple comparison?
                // Simple string comparison works for ISO if dates are YYYY-MM-DD.
                // But c.date is full ISO datetime usually.
                // safer:
                const d = new Date(c.date);
                const e = new Date(dateRange.end);
                e.setHours(23, 59, 59, 999);
                if (d > e) return false;
            }

            // [NEW] Isolation Logic: Filter by user if not admin
            if (user && user.role !== 'ADMIN') {
                return c.createdByUserId === user.id;
            }
            return true;
        })
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const deletedCorrespondences = correspondences.filter((c: any) => c.status === 'DELETED');


    useEffect(() => {
        // Check for items with missing reference numbers (Active only)
        const missing = activeCorrespondences.filter((c: any) => c.type !== 'BANK' && (!c.referenceNumber || c.referenceNumber.trim() === ''))
            .map((c: any) => ({ id: c.id, subject: c.subject, date: c.date }));

        if (missing.length > 0) {
            const today = new Date().toISOString().split('T')[0];
            const lastShown = localStorage.getItem('missingRefWarningDate');

            if (lastShown !== today) {
                setMissingRefs(missing);
                setIsReminderOpen(true);
                localStorage.setItem('missingRefWarningDate', today);
            }
        }

        // Check for items with missing REGISTRATION numbers (Outgoing only usually, or user requested generic)
        // User said: "Evrak Kayıt Nosu olmayan evraklara kayıt numarası gir diye uyarıcı bir buton koy"
        // Let's filter for Outgoing non-bank items that don't have a registration number
        const missingReg = activeCorrespondences.filter((c: any) => c.type !== 'BANK' && c.direction === 'OUTGOING' && (!c.registrationNumber || c.registrationNumber.trim() === ''))
            .map((c: any) => ({ id: c.id, subject: c.subject, date: c.date, referenceNumber: c.referenceNumber }));

        // We don't auto-open this usually, or maybe we do? User said "put a button".
        // So we just update the state so the button can appear if there's any.
        setMissingRegs(missingReg);

    }, [correspondences]);

    const handleSaveRefs = async () => {
        const updates = Object.entries(editRefs).filter(([_, refNo]) => refNo && refNo.trim() !== '');

        // Optimistic Update
        updates.forEach(([id, refNo]) => {
            updateCorrespondence(id, { referenceNumber: refNo });
        });

        setIsReminderOpen(false);
        setEditRefs({});

        // Server Update
        for (const [id, refNo] of updates) {
            await updateCorrespondenceAction(id, { referenceNumber: refNo });
        }
        toast.success('Evrak sayı numaraları güncellendi.');
    };

    const handleSaveRegs = async () => {
        const updates = Object.entries(editRegs).filter(([_, regNo]) => regNo && regNo.trim() !== '');

        // Optimistic Update
        updates.forEach(([id, regNo]) => {
            updateCorrespondence(id, { registrationNumber: regNo });
        });

        setIsRegReminderOpen(false);
        setEditRegs({});

        // Server Update
        for (const [id, regNo] of updates) {
            await updateCorrespondenceAction(id, { registrationNumber: regNo });
        }
        toast.success('Evrak kayıt numaraları güncellendi.');
    };

    const handleDeleteClick = (item: any) => {
        // [NEW] Date Restriction Check
        if (user && user.role !== 'ADMIN' && user.editLookbackDays !== undefined) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const target = new Date(item.date); // Correspondence item has date
            target.setHours(0, 0, 0, 0);
            const diff = (today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24);

            if (diff > user.editLookbackDays) {
                alert(`Bu kayıt ${user.editLookbackDays} günden daha eski olduğu için silinemez.`);
                return;
            }
        }

        // [NEW] Prevent deletion if outgoing correspondence has a registration number (Unless ADMIN)
        if (item.direction === 'OUTGOING' && item.registrationNumber && user?.role !== 'ADMIN') {
            alert('Evrak kayıt numarası girilmiş giden evrakları silemezsiniz! (Sadece Y yönetici silebilir)');
            return;
        }

        setItemToDelete(item.id);
        setDeleteReason('');
        setDeleteDialogOpen(true);
    };

    const handleDuplicate = (item: any) => {
        setCopyItem(item);
    };

    const confirmDelete = async () => {
        if (!itemToDelete || !deleteReason.trim() || !user) return;

        try {
            // [FIX] Call Server Action first with Reason and User ID
            const result = await deleteCorrespondenceAction(itemToDelete, deleteReason, user.id);

            if (result.success) {
                // Update Local Store (UI)
                deleteCorrespondence(itemToDelete, deleteReason, user.id);
                setDeleteDialogOpen(false);
                setItemToDelete(null);
                setDeleteReason('');
            } else {
                alert(result.error || 'Silme işlemi başarısız oldu.');
            }
        } catch (error) {
            console.error('Delete error:', error);
            alert('Bir hata oluştu.');
        }
    };

    const handleRestore = async (id: string) => {
        if (confirm('Bu kaydı geri almak istediğinize emin misiniz?')) {
            try {
                const result = await restoreCorrespondenceAction(id);
                if (result.success) {
                    restoreCorrespondence(id);
                    toast.success('Yazışma başarıyla geri alındı.');
                } else {
                    toast.error(result.error || 'Geri alma işlemi başarısız oldu.');
                }
            } catch (error) {
                console.error('Restore error:', error);
                toast.error('Bir hata oluştu.');
            }
        }
    };

    const handleExport = () => {
        const headers = ["Tarih", "Yön", "Tip", "Firma", "Konu", "Muhatap", "Oluşturan"];
        const escapeCsv = (val: string | number | undefined | null) => {
            if (val === undefined || val === null) return '';
            const str = String(val);
            // Escape quotes and wrap in quotes if contains delimiter or newline
            if (str.includes(';') || str.includes('\n') || str.includes('"')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        const rows = activeCorrespondences.map((c: any) => [
            escapeCsv(c.date),
            escapeCsv(c.direction === 'INCOMING' ? 'Gelen' : 'Giden'),
            escapeCsv(c.type),
            escapeCsv(getCompanyName(c.companyId)),
            escapeCsv(c.subject),
            escapeCsv(c.senderReceiver),
            escapeCsv(getUserName(c.createdByUserId))
        ]);

        const csvContent = "\uFEFF" + headers.join(";") + "\n"
            + rows.map((e: any) => e.join(";")).join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "yazismalar.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrint = async (item: any) => {
        await generateCorrespondencePDF(item, companies, users, false);
    };

    const bankItems = activeCorrespondences.filter((c: any) => c.type === 'BANK');
    const incomingItems = activeCorrespondences.filter((c: any) => c.type !== 'BANK' && c.direction === 'INCOMING');
    const outgoingItems = activeCorrespondences.filter((c: any) => c.type !== 'BANK' && c.direction === 'OUTGOING');

    const exportExcel = () => {
        let prefix = 'yazismalar';
        let title = 'Yazışmalar';
        let itemsToExport: any[] = [];

        if (activeTab === 'outgoing') {
            prefix = 'giden-evraklar';
            title = 'Giden Evrak Listesi';
            itemsToExport = outgoingItems;
        } else if (activeTab === 'incoming') {
            prefix = 'gelen-evraklar';
            title = 'Gelen Evrak Listesi';
            itemsToExport = incomingItems;
        } else if (activeTab === 'bank') {
            prefix = 'banka-yazismalari';
            title = 'Banka Yazışmaları Listesi';
            itemsToExport = bankItems;
        }

        const data = itemsToExport.map(c => ({
            'Tarih': format(new Date(c.date), 'dd.MM.yyyy', { locale: tr }),
            'Yön': c.direction === 'INCOMING' ? 'Gelen' : 'Giden',
            'Tip': c.type,
            'Firma': getCompanyName(c.companyId),
            'Konu': c.subject,
            'Sayı': c.referenceNumber || '-',
            'Muhatap': c.senderReceiver,
            'Oluşturan': getUserName(c.createdByUserId)
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, title.substring(0, 31)); // Sheet name max 31 chars
        XLSX.writeFile(wb, `${prefix}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    };

    const exportListPDF = () => {
        const doc = new jsPDF('l', 'mm', 'a4'); // Landscape
        doc.addFileToVFS('Roboto-Regular.ttf', fontBase64);
        doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
        doc.setFont('Roboto');

        let prefix = 'yazisma-listesi';
        let title = 'Yazışma Listesi';
        let itemsToExport: any[] = [];

        if (activeTab === 'outgoing') {
            prefix = 'giden-evraklar';
            title = 'Giden Evrak Listesi';
            itemsToExport = outgoingItems;
        } else if (activeTab === 'incoming') {
            prefix = 'gelen-evraklar';
            title = 'Gelen Evrak Listesi';
            itemsToExport = incomingItems;
        } else if (activeTab === 'bank') {
            prefix = 'banka-yazismalari';
            title = 'Banka Yazışmaları Listesi';
            itemsToExport = bankItems;
        }

        const tableColumn = ["Tarih", "Yön", "Tip", "Firma", "Konu", "Sayı", "Muhatap"];
        const tableRows = itemsToExport.map(c => [
            format(new Date(c.date), 'dd.MM.yyyy', { locale: tr }),
            c.direction === 'INCOMING' ? 'Gelen' : 'Giden',
            c.type,
            getCompanyName(c.companyId),
            c.subject,
            c.referenceNumber || '-',
            c.senderReceiver
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            styles: { font: 'Roboto', fontSize: 8 },
            headStyles: { fillColor: [41, 128, 185] },
            startY: 20,
        });

        doc.text(title, 14, 15);
        doc.save(`${prefix}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    };

    const renderFilters = () => (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-4 p-4 bg-slate-50/50 rounded-lg border">
            {/* Date Range */}
            <div>
                <Label className="text-xs">Başlangıç Tarihi</Label>
                <Input type="date" className="h-8 text-xs bg-white" value={dateRange.start} onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))} />
            </div>
            <div>
                <Label className="text-xs">Bitiş Tarihi</Label>
                <Input type="date" className="h-8 text-xs bg-white" value={dateRange.end} onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))} />
            </div>

            {/* Company Filter */}
            <div>
                <Label className="text-xs">Firma</Label>
                <MultiSelect
                    options={uniqueCompanyIds.map((id: any) => ({ label: getCompanyName(id), value: id }))}
                    selected={filterCompany}
                    onChange={setFilterCompany}
                    placeholder="Tümü"
                    searchPlaceholder="Firma Ara..."
                />
            </div>



            {/* Creator Filter */}
            <div>
                <Label className="text-xs">Oluşturan</Label>
                <MultiSelect
                    options={uniqueCreatorIds.map((id: any) => ({ label: getUserName(id), value: id }))}
                    selected={filterCreator}
                    onChange={setFilterCreator}
                    placeholder="Tümü"
                    searchPlaceholder="Kullanıcı Ara..."
                />
            </div>

            {/* Sender/Receiver (Muhatap) Filter */}
            <div>
                <Label className="text-xs">Muhatap</Label>
                <MultiSelect
                    options={uniqueSenderReceivers.map((sr: any) => ({ label: sr as string, value: sr as string }))}
                    selected={filterSenderReceiver}
                    onChange={setFilterSenderReceiver}
                    placeholder="Tümü"
                    searchPlaceholder="Muhatap Ara..."
                />
            </div>

            <div className="md:col-span-5 flex justify-end gap-2 mt-2">
                {canExport && (
                    <>
                        <Button variant="outline" size="sm" onClick={exportListPDF} title="Listeyi PDF İndir">
                            <FileText className="h-4 w-4 text-red-600 mr-2" />
                            Listeyi Yazdır (PDF)
                        </Button>
                        <Button variant="outline" size="sm" onClick={exportExcel} title="Listeyi Excel İndir">
                            <FileSpreadsheet className="h-4 w-4 text-green-600 mr-2" />
                            Excel İndir
                        </Button>
                    </>
                )}
            </div>

            {/* Search Input - Full Width below */}
            <div className="md:col-span-5 relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    type="search"
                    placeholder="Metin ile ara (Konu, Sayı, vb.)..."
                    className="pl-8 bg-white"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            {/* Missing Registration Number Dialog */}
            <Dialog open={isRegReminderOpen} onOpenChange={setIsRegReminderOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Eksik Evrak Kayıt Numaraları</DialogTitle>
                        <DialogDescription>
                            Aşağıdaki evrakların kayıt numarası eksik. Lütfen ilgili alanları doldurun.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        {missingRegs.map((item) => (
                            <div key={item.id} className="grid grid-cols-[1fr,200px] gap-4 items-center border-b pb-4 last:border-0 last:pb-0">
                                <div>
                                    <div className="font-medium text-sm">{item.subject}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {format(new Date(item.date), 'dd.MM.yyyy')} - Sayı: {item.referenceNumber || '-'}
                                    </div>
                                </div>
                                <Input
                                    placeholder="Kayıt No Giriniz"
                                    value={editRegs[item.id] || ''}
                                    onChange={(e) => setEditRegs({ ...editRegs, [item.id]: e.target.value })}
                                />
                            </div>
                        ))}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsRegReminderOpen(false)}>Kapat</Button>
                        <Button onClick={handleSaveRegs}>Kaydet</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    );

    // Address Book States
    const [showPassive, setShowPassive] = useState(false);

    const handleRestoreInstitution = async (inst: any) => {
        if (!confirm(`${inst.name} adlı muhatabı tekrar aktif yapmak istiyor musunuz?`)) return;

        try {
            const result = await updateInstitutionAction(inst.id, { status: 'ACTIVE' });
            if (result.success) {
                updateInstitution(inst.id, { status: 'ACTIVE' });
                toast.success('Muhatap tekrar aktif edildi.');
            } else {
                toast.error(result.error || 'İşlem başarısız.');
            }
        } catch (e) {
            console.error(e);
            toast.error('Hata oluştu.');
        }
    };

    const handlePermanentDeleteInstitution = async (inst: any) => {
        if (!confirm(`"${inst.name}" adlı muhatabı kalıcı olarak silmek istiyor musunuz?\n\n⚠️ DİKKAT: Bu işlem geri alınamaz! Muhatap veritabanından tamamen silinecektir.`)) return;

        try {
            const result = await permanentDeleteInstitutionAction(inst.id);
            if (result.success) {
                removeInstitution(inst.id);
                toast.success('Muhatap kalıcı olarak silindi.');
            } else {
                toast.error(result.error || 'Kalıcı silme işlemi başarısız.');
            }
        } catch (e) {
            console.error(e);
            toast.error('Hata oluştu.');
        }
    };

    const renderAddressBook = () => {
        return (
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowPassive(!showPassive)}
                            className={showPassive ? "bg-amber-50 text-amber-700 border-amber-200" : "text-slate-500"}
                        >
                            {showPassive ? <Eye className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                            {showPassive ? "Aktifleri Göster" : "Pasifleri (Silinenleri) Göster"}
                        </Button>
                    </div>
                    {(user?.role === 'ADMIN' || canCreateContacts) && !showPassive && (
                        <Button onClick={() => openAddressModal()} className="bg-purple-600 hover:bg-purple-700">
                            <Plus className="w-4 h-4 mr-2" /> Yeni Muhatap Ekle
                        </Button>
                    )}
                </div>
                {institutions.filter(i => showPassive ? i.status === 'PASSIVE' : i.status !== 'PASSIVE').length === 0 ? (
                    <div className="text-center py-10 text-slate-500">
                        {showPassive ? 'Pasif (silinmiş) muhatap bulunmuyor.' : 'Henüz kayıtlı muhatap bulunmuyor.'}
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Muhatap Adı</TableHead>
                                <TableHead>Kategori</TableHead>
                                <TableHead className="w-[100px]">İşlemler</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {institutions
                                .filter((inst: any) => {
                                    // [FIX] Strict Type Filter
                                    if (inst.category === 'INSURANCE_AGENCY' || inst.category === 'INSURANCE_COMPANY') return false;

                                    // Filter Logic (Show Passive vs Active)
                                    // Default status is usually undefined for old records -> treat as ACTIVE
                                    const isPassive = inst.status === 'PASSIVE';
                                    if (showPassive && !isPassive) return false;
                                    if (!showPassive && isPassive) return false;

                                    const lowerName = normalizeSearchText(inst.name || '');
                                    // Filter out Insurance companies as they are for Mailing only
                                    if (lowerName.includes('sigorta') || lowerName.includes('kasko') || lowerName.includes('acente')) return false;
                                    return true;
                                })
                                .map((inst: any) => (
                                    <TableRow key={inst.id} className={inst.status === 'PASSIVE' ? 'bg-slate-50 opacity-70' : ''}>
                                        <TableCell className="max-w-[400px] truncate" title={inst.name}>
                                            {inst.name}
                                            {inst.status === 'PASSIVE' && <Badge variant="secondary" className="ml-2 text-[10px]">PASİF</Badge>}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{inst.category === 'BANK' ? 'Banka' : 'Kurum/Şahıs'}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            {(user?.role === 'ADMIN' || canEditContacts) && (
                                                <div className="flex items-center gap-1">
                                                    {inst.status === 'PASSIVE' ? (
                                                        <>
                                                            <Button variant="ghost" size="sm" onClick={() => handleRestoreInstitution(inst)} title="Geri Yükle (Aktif Et)">
                                                                <RotateCcw className="w-4 h-4 text-green-600" />
                                                            </Button>
                                                            <Button variant="ghost" size="sm" onClick={() => handlePermanentDeleteInstitution(inst)} title="Kalıcı Olarak Sil" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Button variant="ghost" size="sm" onClick={() => openAddressModal(inst)}>
                                                                <Edit className="w-4 h-4 text-blue-600" />
                                                            </Button>
                                                            <Button variant="ghost" size="sm" className="text-red-600" onClick={async () => {
                                                                if (confirm('Silmek (Pasife almak) istediğinize emin misiniz?')) {
                                                                    const result = await deleteInstitutionAction(inst.id);
                                                                    if (result.success) {
                                                                        deleteInstitution(inst.id);
                                                                        toast.success('Muhatap pasife alındı.');
                                                                    } else {
                                                                        toast.error('Silme başarısız.');
                                                                    }
                                                                }
                                                            }}>
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                        </TableBody>
                    </Table>
                )}
            </div>
        );
    };

    const renderTable = (items: typeof correspondences, isBank = false, isIncoming = false) => {
        if (items.length === 0) {
            return (
                <div className="text-center py-10 text-slate-500">
                    Henüz kayıtlı {isBank ? 'banka yazışması' : 'yazışma'} bulunmuyor.
                </div>
            );
        }

        return (
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Belge Tarihi</TableHead>
                        {!isBank && <TableHead>Evrak Sayı No</TableHead>}
                        {!isBank && !isIncoming && <TableHead>Evrak Kayıt No</TableHead>}


                        <TableHead>Firma</TableHead>
                        <TableHead>Konu</TableHead>
                        <TableHead>Muhatap</TableHead>
                        <TableHead>Oluşturan</TableHead>
                        <TableHead className="w-[150px]">İşlemler</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {items.map((item: any) => {
                        // Determine type-specific edit permission
                        let hasEditPermission = false;
                        if (item.type === 'BANK') hasEditPermission = canEditBank;
                        else if (item.direction === 'INCOMING') hasEditPermission = canEditIncoming;
                        else if (item.direction === 'OUTGOING') hasEditPermission = canEditOutgoing;

                        const canEdit = user?.role === 'ADMIN' || hasEditPermission;
                        return (
                            <TableRow key={item.id}>
                                <TableCell>{format(new Date(item.date), 'dd.MM.yyyy HH:mm', { locale: tr })}</TableCell>
                                {!isBank && (
                                    <TableCell className="max-w-[150px]">
                                        {item.referenceNumber ? (
                                            <div className="font-mono text-xs truncate" title={item.referenceNumber}>
                                                {item.referenceNumber}
                                            </div>
                                        ) : (
                                            <span className="text-xs text-slate-400 font-medium">-</span>
                                        )}
                                    </TableCell>
                                )}
                                {!isBank && !isIncoming && (
                                    <TableCell className="max-w-[150px]">
                                        {item.registrationNumber ? (
                                            <div
                                                className="font-mono text-xs text-slate-700 truncate cursor-pointer hover:bg-slate-100 p-1 rounded border border-transparent hover:border-slate-200 transition-all flex items-center justify-between group"
                                                title={`${item.registrationNumber} (Düzenlemek için tıklayın)`}
                                                onClick={() => openRegReminder(item.id)}
                                            >
                                                <span className="truncate">{item.registrationNumber}</span>
                                                <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 text-blue-500 flex-shrink-0 ml-1" />
                                            </div>
                                        ) : (
                                            item.createdByUserId === user?.id ? (
                                                <div
                                                    onClick={() => openRegReminder(item.id)}
                                                    className="text-[10px] text-red-600 font-bold cursor-pointer hover:underline flex items-center gap-1"
                                                >
                                                    <span>Kayıt No Eksik</span>
                                                    <span className="relative flex h-2 w-2">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400 font-medium">-</span>
                                            )
                                        )}
                                    </TableCell>
                                )}


                                <TableCell className="max-w-[150px] truncate" title={getCompanyName(item.companyId)}>
                                    {getCompanyName(item.companyId)}
                                </TableCell>
                                <TableCell className="max-w-[200px]">
                                    <div className="font-medium truncate" title={item.subject}>{item.subject}</div>
                                    {item.attachmentUrls && item.attachmentUrls.length > 0 && (
                                        <div className="flex items-center gap-3 mt-1">
                                            <a
                                                href={item.attachmentUrls[0]}
                                                download={`${item.referenceNumber || 'Evrak'}.pdf`}
                                                className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:underline"
                                                onClick={(e: any) => e.stopPropagation()}
                                                title="Dosyayı İndir"
                                            >
                                                <Download className="w-3 h-3" />
                                                İndir
                                            </a>

                                            <div onClick={(e) => e.stopPropagation()}>
                                                <Dialog>
                                                    <DialogTrigger asChild>
                                                        <button
                                                            className="inline-flex items-center gap-1 text-[10px] text-amber-600 hover:underline cursor-zoom-in"
                                                        >
                                                            <Eye className="w-3 h-3" />
                                                            Ön İzleme
                                                        </button>
                                                    </DialogTrigger>
                                                    <DialogContent className="max-w-[100vw] w-screen h-[95vh] p-0 border-none bg-transparent shadow-none">
                                                        <DialogTitle className="sr-only">PDF Ön İzleme</DialogTitle>
                                                        <div className="h-full w-full bg-white rounded-lg overflow-hidden shadow-2xl">
                                                            <PDFPreview base64={item.attachmentUrls[0]} />
                                                        </div>
                                                    </DialogContent>
                                                </Dialog>
                                            </div>
                                        </div>
                                    )}
                                </TableCell>
                                <TableCell className="max-w-[200px]">
                                    <div className="truncate" title={item.senderReceiver}>
                                        {item.senderReceiver}
                                    </div>
                                </TableCell>
                                <TableCell className="text-sm text-slate-600">
                                    <div className="flex flex-col">
                                        <span>{getUserName(item.createdByUserId)}</span>
                                        <span className="text-[10px] text-muted-foreground">{format(new Date(item.createdAt || item.date), 'dd.MM.yyyy HH:mm')}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1">
                                        <Button variant="ghost" size="sm" onClick={() => handlePrint(item)} title="Yazdır">
                                            <Printer className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => handleDuplicate(item)} title="Çoğalt">
                                            <Copy className="w-4 h-4 text-purple-600" />
                                        </Button>
                                        {canEdit && (
                                            <>
                                                {item.registrationNumber ? (
                                                    <Button variant="ghost" size="sm" title="Kayıt numarası girildiği için düzenlenemez" className="opacity-50 cursor-not-allowed" onClick={() => toast.warning('Evrak kayıt numarası girildiği için düzenlenemez.')}>
                                                        <Lock className="w-4 h-4 text-slate-400" />
                                                    </Button>
                                                ) : (
                                                    <CorrespondenceForm
                                                        initialData={item}
                                                        customTrigger={
                                                            <Button variant="ghost" size="sm" title="Düzenle">
                                                                <Pencil className="w-4 h-4 text-blue-600" />
                                                            </Button>
                                                        }
                                                    />
                                                )}
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => handleDeleteClick(item)}
                                                    title="Sil"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        );
    };

    const renderDeletedTable = () => {
        if (deletedCorrespondences.length === 0) {
            return (
                <div className="text-center py-10 text-slate-500">
                    Silinmiş kayıt bulunmuyor.
                </div>
            );
        }

        return (
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Silinme Tarihi</TableHead>
                        <TableHead>Konu</TableHead>
                        <TableHead>Muhatap</TableHead>
                        <TableHead>Silen Kişi</TableHead>
                        <TableHead>Silme Nedeni</TableHead>
                        <TableHead className="w-[100px]">İşlemler</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {deletedCorrespondences.map((item: any) => (
                        <TableRow key={item.id} className="bg-red-50">
                            <TableCell className="text-red-700 font-medium">
                                {item.deletionDate ? format(new Date(item.deletionDate), 'dd MMM yyyy HH:mm', { locale: tr }) : '-'}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate" title={item.subject}>{item.subject}</TableCell>
                            <TableCell className="max-w-[150px] truncate" title={item.senderReceiver}>{item.senderReceiver}</TableCell>
                            <TableCell>{getUserName(item.deletedByUserId || '')}</TableCell>
                            <TableCell className="italic text-slate-600 max-w-[200px] truncate" title={item.deletionReason}>{item.deletionReason}</TableCell>
                            <TableCell>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200"
                                    onClick={() => handleRestore(item.id)}
                                    title="Geri Al / Kurtar"
                                >
                                    <RotateCcw className="w-4 h-4 mr-2" /> Geri Al
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        );
    };

    const [activeTab, setActiveTab] = useState(getDefaultTab());

    return (
        <Card>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <CardHeader className="flex flex-col space-y-4">
                    <div className="flex flex-row items-center justify-between">
                        <CardTitle>Yazışma Listesi</CardTitle>
                    </div>
                    <TabsList className="flex w-full overflow-x-auto">
                        {canViewIncoming && <TabsTrigger value="incoming">Gelen Evraklar</TabsTrigger>}
                        {canViewOutgoing && <TabsTrigger value="outgoing">Giden Evraklar</TabsTrigger>}
                        {canViewBank && <TabsTrigger value="bank">Banka Yazışmaları</TabsTrigger>}
                        {canViewContacts && <TabsTrigger value="muhataplar" className="text-purple-600 data-[state=active]:text-purple-700">Muhataplar</TabsTrigger>}
                        {canViewDeleted && <TabsTrigger value="deleted" className="text-red-500 data-[state=active]:text-red-600">Silinenler</TabsTrigger>}
                    </TabsList>
                </CardHeader>
                <CardContent>
                    <TabsContent value="incoming" className="space-y-4">
                        <div className="flex justify-end">
                            {canCreateIncoming && (
                                <CorrespondenceForm
                                    initialDirection="INCOMING"
                                    customTrigger={
                                        <Button className="bg-green-600 hover:bg-green-700 w-full sm:w-auto">
                                            <Plus className="w-4 h-4 mr-2" /> Yeni Gelen Evrak
                                        </Button>
                                    }
                                />
                            )}
                        </div>
                        {renderFilters()}
                        {renderTable(incomingItems, false, true)}
                    </TabsContent>

                    <TabsContent value="outgoing" className="space-y-4">
                        <div className="flex justify-end">
                            {canCreateOutgoing && (
                                <CorrespondenceForm
                                    initialDirection="OUTGOING"
                                    customTrigger={
                                        <Button className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">
                                            <Plus className="w-4 h-4 mr-2" /> Yeni Giden Evrak
                                        </Button>
                                    }
                                />
                            )}
                        </div>
                        {renderFilters()}
                        {renderTable(outgoingItems)}
                    </TabsContent>

                    <TabsContent value="bank" className="space-y-4">
                        <div className="flex justify-end">
                            {canCreateBank && (
                                <CorrespondenceForm
                                    initialType="BANK"
                                    customTrigger={
                                        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto">
                                            <Plus className="w-4 h-4 mr-2" /> Yeni Banka Yazışması
                                        </Button>
                                    }
                                />
                            )}
                        </div>
                        {renderFilters()}
                        {renderTable(bankItems, true)}
                    </TabsContent>

                    <TabsContent value="muhataplar" className="space-y-4">
                        {renderAddressBook()}
                    </TabsContent>

                    <TabsContent value="deleted" className="space-y-4">
                        {renderDeletedTable()}
                    </TabsContent>
                </CardContent>
            </Tabs>

            <Dialog open={isReminderOpen} onOpenChange={setIsReminderOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Eksik Evrak Numaraları</DialogTitle>
                        <DialogDescription>
                            Aşağıdaki listede evrak kayıt numarası eksik olan yazışmalar bulunmaktadır. Lütfen numaraları giriniz.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {missingRefs.map((item) => (
                            <div key={item.id} className="grid grid-cols-12 gap-4 items-center border-b pb-2">
                                <div className="col-span-3 text-sm text-muted-foreground">{format(new Date(item.date), 'dd.MM.yyyy')}</div>
                                <div className="col-span-5 text-sm font-medium">{item.subject}</div>
                                <div className="col-span-4">
                                    <Input
                                        placeholder="Evrak No Giriniz"
                                        className="h-8"
                                        value={editRefs[item.id] || ''}
                                        onChange={(e) => setEditRefs(prev => ({ ...prev, [item.id]: e.target.value }))}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsReminderOpen(false)}>Daha Sonra</Button>
                        <Button onClick={handleSaveRefs}>Kaydet</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isAddressModalOpen} onOpenChange={setIsAddressModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editInstId ? 'Muhatap Düzenle' : 'Yeni Muhatap Ekle'}</DialogTitle>
                        <DialogDescription>
                            Bu muhatabın ismini ve PDF çıktısındaki hizalama tercihini düzenleyin.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label>Kategori</Label>
                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    type="button"
                                    variant={editInstCategory === 'INSTITUTION' ? 'default' : 'outline'}
                                    onClick={() => setEditInstCategory('INSTITUTION')}
                                    className="gap-2"
                                >
                                    <Building2 className="w-4 h-4" /> Kurum / Şahıs
                                </Button>
                                <Button
                                    type="button"
                                    variant={editInstCategory === 'BANK' ? 'default' : 'outline'}
                                    onClick={() => setEditInstCategory('BANK')}
                                    className="gap-2"
                                >
                                    <Landmark className="w-4 h-4" /> Banka
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Muhatap Adı (Kurum/Şahıs)</Label>
                            <Textarea
                                value={editInstName}
                                onChange={(e) => setEditInstName(e.target.value)}
                                placeholder="Örn: T.C. Enerji Bakanlığı..."
                                rows={4}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Kısa Ad (Opsiyonel)</Label>
                            <Input
                                value={editInstShortName}
                                onChange={(e) => setEditInstShortName(e.target.value)}
                                placeholder="Örn: EKB"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddressModalOpen(false)}>İptal</Button>
                        <Button onClick={handleSaveAddress}>Kaydet</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <AlertTriangle className="w-5 h-5" />
                            Yazışmayı Sil
                        </DialogTitle>
                        <DialogDescription>
                            Bu yazışmayı silmek üzeresiniz. Lütfen silme sebebinizi belirtiniz. Bu işlem geri alınamaz (kayıt arşivlenir).
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-2">
                        <Label>Silme Gerekçesi <span className="text-red-500">*</span></Label>
                        <Input
                            value={deleteReason}
                            onChange={(e) => setDeleteReason(e.target.value)}
                            placeholder="Örn: Hatalı giriş yapıldı..."
                            autoFocus
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>İptal</Button>
                        <Button
                            onClick={confirmDelete}
                            variant="destructive"
                            disabled={!deleteReason.trim()}
                        >
                            Sil
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Missing Registration Number Dialog - Restored */}
            <Dialog open={isRegReminderOpen} onOpenChange={setIsRegReminderOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Eksik Evrak Kayıt Numaraları</DialogTitle>
                        <DialogDescription>
                            Aşağıdaki evrakların kayıt numarası eksik. Lütfen ilgili alanları doldurun.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        {(selectedRegId
                            ? [activeCorrespondences.find((c: any) => c.id === selectedRegId)].filter(Boolean).map((c: any) => ({ id: c!.id, subject: c!.subject, date: c!.date, referenceNumber: c!.referenceNumber }))
                            : missingRegs
                        ).map((item: any) => (
                            <div key={item.id} className="grid grid-cols-[1fr,200px] gap-4 items-center border-b pb-4 last:border-0 last:pb-0">
                                <div>
                                    <div className="font-medium text-sm">{item.subject}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {format(new Date(item.date), 'dd.MM.yyyy')} - Sayı: {item.referenceNumber || '-'}
                                    </div>
                                </div>
                                <Input
                                    placeholder="Kayıt No Giriniz"
                                    value={editRegs[item.id] || ''}
                                    onChange={(e) => setEditRegs({ ...editRegs, [item.id]: e.target.value })}
                                />
                            </div>
                        ))}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsRegReminderOpen(false)}>Kapat</Button>
                        <Button onClick={handleSaveRegs}>Kaydet</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* [NEW] Copy Form */}
            {copyItem && (
                <CorrespondenceForm
                    initialData={copyItem}
                    isCopy={true}
                    open={!!copyItem}
                    onOpenChange={(open) => {
                        if (!open) setCopyItem(null);
                    }}
                />
            )}
        </Card >
    );
}
