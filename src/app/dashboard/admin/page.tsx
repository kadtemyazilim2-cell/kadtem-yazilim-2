'use client';

import { useState, useEffect, Fragment } from 'react';
import { useAppStore } from '@/lib/store/use-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input'; // ... existing imports

// [NEW] Server Actions
import { createUser, updateUser as updateUserAction, deleteUser as deleteUserAction } from '@/actions/user';
import { debugPing } from '@/actions/debug-action';
import {
    getYiUfeRates,
    addYiUfeRate,
    syncYiUfeRates
} from '@/actions/yiufe';
import { createSite, deleteSite as deleteSiteAction, getSites, updateSite as updateSiteAction } from '@/actions/site';
import { createFuelTank, deleteFuelTank as deleteFuelTankAction } from '@/actions/fuel'; // [NEW]
import { createCompany, updateCompany as updateCompanyAction, deleteCompany as deleteCompanyAction, checkCompanyDependencies, getCompanyFull } from '@/actions/company'; // [NEW]
import { resetDatabase } from '@/actions/system';
import { createRoleTemplate, getRoleTemplates, deleteRoleTemplate, updateRoleTemplate } from '@/actions/role-template';
import { useRouter, useSearchParams } from 'next/navigation'; // Ensure router is imported
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Minus, Search, Trash2, SlidersHorizontal, ArrowUpDown, ChevronLeft, ChevronRight, CheckCircle2, XCircle, Building2, Users, ShieldCheck, ShieldAlert, TrendingUp, RefreshCw, MapPin, Mail, Pencil, FileDown, FileSpreadsheet, ArrowUp, ArrowDown, Eye, FileText } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch'; // [NEW]
import { MultiSelect } from '@/components/ui/multi-select'; // [NEW]
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/lib/store/use-auth';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const MODULE_HIERARCHY = [
    {
        id: 'dashboard',
        label: 'Ana Sayfa (Dashboard)',
        children: [
            { id: 'dashboard.indices', label: 'Bilgiler & Endeksler' },
            { id: 'dashboard.financial', label: 'Şantiye Kasaları' },
            { id: 'dashboard.upcoming-payments', label: 'Yaklaşan Ödemeler' },
            { id: 'dashboard.stocks', label: 'Aktif Şantiye Depo Stokları' },
            { id: 'dashboard.fuel-purchases', label: 'Son Yakıt Alımları' },
            { id: 'dashboard.fuel-chart', label: 'Günlük Yakıt Tüketim Grafiği' },
            { id: 'dashboard.missing-docs', label: 'Eksik Evrak Numaraları' },
            { id: 'dashboard.site-log', label: 'Şantiye Günlüğü Özeti' },
        ]
    },
    {
        id: 'correspondence',
        label: 'Yazışmalar',
        children: [
            { id: 'correspondence.incoming', label: 'Gelen Evrak' },
            { id: 'correspondence.outgoing', label: 'Giden Evrak' },
            { id: 'correspondence.bank', label: 'Banka' },
            { id: 'correspondence.contacts', label: 'Muhataplar' },
            { id: 'correspondence.deleted', label: 'Silinenler' },
        ]
    },
    {
        id: 'vehicles',
        label: 'Araçlar',
        children: [
            { id: 'vehicles.list', label: 'Araç Listesi' },
            { id: 'vehicles.owned-create', label: 'Yeni Araç Ekle (Öz Mal)' },
            { id: 'vehicles.rental-create', label: 'Yeni Kiralık Araç Ekle' },
            { id: 'vehicles.finance', label: 'Mali/Kiralama Bilgileri' },
            { id: 'vehicles.insurance', label: 'Sigorta/Kasko/Muayene' },
        ]
    },
    {
        id: 'fuel',
        label: 'Yakıt Takip',
        children: [
            { id: 'fuel.tanks', label: 'Depo Stok Durumu' },
            { id: 'fuel.consumption', label: 'Tüketim Raporu' },
        ]
    },
    {
        id: 'movement',
        label: 'Yakıt Hareketleri',
        children: [
            { id: 'movement.dispense', label: 'Yakıt Ver (Araç Dolum)' },
            { id: 'movement.transfer', label: 'Transfer (Virman)' },
            { id: 'movement.purchase', label: 'Yakıt Alımı (Stok)' },
            { id: 'movement.rental-create', label: 'Yeni Kiralık Araç Ekle' },
        ]
    },
    {
        id: 'cash-book',
        label: 'Kasa Defteri',
        children: [
            { id: 'cash-book.reports', label: 'Geçmiş Sorgu & Raporlama' },
            { id: 'cash-book.admin-view', label: 'Yönetici Görünümü (Tüm Kayıtlar)' },
        ]
    },
    {
        id: 'personnel',
        label: 'Personel',
        children: [
            { id: 'personnel.list', label: 'Personel Listesi' },
            {
                id: 'personnel-attendance',
                label: 'Personel Puantaj',
                children: [
                    { id: 'personnel-attendance.salary', label: 'Maaş Bilgileri' },
                    { id: 'personnel-attendance.personnel', label: 'Personel Yönetimi' },
                    { id: 'personnel-attendance.attendance', label: 'Puantaj Girişi' },
                    { id: 'personnel-attendance.transfer', label: 'Transfer İşlemi' },
                ]
            },
        ]
    },

    {
        id: 'vehicle-attendance',
        label: 'Araç Puantaj',
        children: [
            { id: 'vehicle-attendance.list', label: 'Puantaj Girişi' },
            { id: 'vehicle-attendance.assignment', label: 'Araç Atama' },
            { id: 'vehicle-attendance.report', label: 'Özet Rapor' },
        ]
    },
    { id: 'site-log', label: 'Şantiye Defteri' },
    { id: 'limit-value', label: 'Sınır Değer Hesaplama' },
];

import { User, Site } from '@/lib/types'; // [FIX] Import User and Site types

import { SIMILAR_WORK_GROUPS } from '@/lib/constants/work-groups'; // [NEW]

export default function AdminPage() {
    const {
        users, addUser, updateUser, deleteUser,
        companies, addCompany, updateCompany, deleteCompany,
        sites, addSite, updateSite, deleteSite,
        assignVehiclesToSite, vehicles,
        yiUfeRates, setYiUfeRates, addYiUfeRates,
        personnel, personnelAttendance, vehicleAttendance, fuelTanks, addFuelTank, deleteFuelTank, // [NEW]
        // correspondences removed
    } = useAppStore();
    const { user } = useAuth();

    if (user && user.role !== 'ADMIN') {
        return <div className="p-6 text-center text-red-600 font-bold">Bu alana erişim yetkiniz bulunmamaktadır.</div>;
    }
    const router = useRouter(); // [NEW] Router for soft refresh
    const searchParams = useSearchParams();
    const currentTab = searchParams.get('tab') || 'users';

    // [NEW] Fetch Yi-UFE Rates on Mount
    useEffect(() => {
        const fetchRates = async () => {
            const res = await getYiUfeRates();
            if (res.success && res.data) {
                setYiUfeRates(res.data);
            }
        };
        fetchRates();
    }, [setYiUfeRates]);

    const handleTabChange = (value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', value);
        router.push(`?${params.toString()}`, { scroll: false });
    };

    // User Form State
    const [userModalOpen, setUserModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

    const [userName, setUserName] = useState('');
    const [userUsername, setUserUsername] = useState(''); // [NEW]
    const [userPassword, setUserPassword] = useState(''); // [NEW]
    // const [userEmail, setUserEmail] = useState(''); // [REMOVED]
    const [userRole, setUserRole] = useState<'ADMIN' | 'USER'>('USER');
    const [userPermissions, setUserPermissions] = useState<Record<string, string[]>>({});
    const [assignedSiteIds, setAssignedSiteIds] = useState<string[]>([]);
    const [editLookbackDays, setEditLookbackDays] = useState<number | ''>(''); // [NEW]

    // [NEW] Role Templates State
    const [templates, setTemplates] = useState<any[]>([]);
    const [isSaveTemplateOpen, setIsSaveTemplateOpen] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState('');

    useEffect(() => {
        loadTemplates();
    }, []);

    const loadTemplates = async () => {
        try {
            const res = await getRoleTemplates();
            if (res.success) {
                setTemplates(res.data || []);
            }
        } catch (e) {
            console.error('Failed to load templates', e);
        }
    };

    const handleSaveTemplate = async () => {
        if (!newTemplateName.trim()) {
            toast.error('Şablon adı giriniz.');
            return;
        }

        try {
            // Collect current permissions
            const currentPerms: Record<string, string[]> = {};
            // We need to access the CURRENT state of permissions being edited in the dialog.
            // The dialog uses `userPermissions` state.

            const res = await createRoleTemplate(newTemplateName, userPermissions); // [FIX] Use userPermissions
            if (res.success) {
                toast.success('Şablon kaydedildi.');
                setIsSaveTemplateOpen(false);
                setNewTemplateName('');
                loadTemplates();
            } else {
                toast.error(res.error || 'Kaydedilemedi.');
            }
        } catch (e) {
            console.error(e);
            toast.error('Bir hata oluştu.');
        }
    };

    const handleDeleteTemplate = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation(); // Prevent select trigger
        if (!confirm('Bu şablonu silmek istediğinize emin misiniz?')) return;

        try {
            const res = await deleteRoleTemplate(id);
            if (res.success) {
                toast.success('Şablon silindi.');
                loadTemplates();
            } else {
                toast.error(res.error || 'Silinemedi.');
            }
        } catch (e) {
            toast.error('Hata oluştu.');
        }
    };

    const handleUpdateTemplate = async (id: string, name: string) => {
        if (!confirm(`"${name}" şablonunun izinleri mevcut tablodaki izinlerle güncellenecek. Onaylıyor musunuz?`)) return;
        try {
            const res = await updateRoleTemplate(id, userPermissions);
            if (res.success) {
                toast.success(`"${name}" şablonu güncellendi.`);
                loadTemplates();
            } else {
                toast.error(res.error || 'Şablon güncellenemedi.');
            }
        } catch (e) {
            toast.error('Şablon güncellenemedi.');
        }
    };

    // Yi-Ufe State
    const [updatingYiUfe, setUpdatingYiUfe] = useState(false);
    const [previewDoc, setPreviewDoc] = useState<string | null>(null); // [NEW] Preview State

    // const { yiUfeRates, setYiUfeRates } = useAppStore(); // Removed duplicate
    const [yiUfeModalOpen, setYiUfeModalOpen] = useState(false);
    const [manualYear, setManualYear] = useState(new Date().getFullYear());
    const [manualMonth, setManualMonth] = useState(new Date().getMonth()); // 0-11, will fix display to 1-12
    const [manualRate, setManualRate] = useState('');

    // Company Form State
    const [companyModalOpen, setCompanyModalOpen] = useState(false);
    const [isEditingCompany, setIsEditingCompany] = useState(false); // [NEW]
    const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

    // System Reset State
    const [resetDialogOpen, setResetDialogOpen] = useState(false);
    const [resetting, setResetting] = useState(false);

    const handleResetSystem = async () => {
        setResetting(true);
        try {
            const res = await resetDatabase();
            if (res.success) {
                alert('Sistem başarıyla sıfırlandı. Çıkış yapılıyor...');
                window.location.href = '/login'; // Force full reload to login to clear client states
            } else {
                alert('Hata: ' + res.error);
            }
        } catch (error) {
            console.error(error);
            alert('Bir hata oluştu.');
        } finally {
            setResetting(false);
            setResetDialogOpen(false);
        }
    };

    // Site Filters
    const [siteFilters, setSiteFilters] = useState<Record<string, string[]>>({});

    // --- SITE SORTING STATE ---
    type SiteSortConfigItem = { key: string; direction: 'asc' | 'desc' };
    const [siteSortConfig, setSiteSortConfig] = useState<SiteSortConfigItem[]>([
        { key: 'workGroup', direction: 'asc' }, // Default Sort 1
        { key: 'name', direction: 'asc' }       // Default Sort 2
    ]);

    const handleSiteSort = (key: string, event: React.MouseEvent) => {
        if (!key) return;
        setSiteSortConfig(current => {
            let newConfig: SiteSortConfigItem[];

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
                if (current.length > 0 && current[0].key === key) {
                    newConfig = [{ key, direction: current[0].direction === 'asc' ? 'desc' : 'asc' }];
                } else {
                    newConfig = [{ key, direction: 'asc' }];
                }
            }
            return newConfig;
        });
    };

    const getSiteSortIcon = (key: string) => {
        const index = siteSortConfig.findIndex(item => item.key === key);
        if (index === -1) return null;

        const item = siteSortConfig[index];
        const Icon = item.direction === 'asc' ? ArrowUp : ArrowDown;

        return (
            <span className="ml-1 inline-flex items-center text-blue-600">
                <Icon className="w-3 h-3" />
                {siteSortConfig.length > 1 && <span className="text-[10px] ml-0.5">{index + 1}</span>}
            </span>
        );
    };
    // --- END SITE SORTING STATE ---

    const getUniqueValues = (key: keyof Site | undefined, isDate?: boolean, isCurrency?: boolean) => {
        if (!key) return [];
        const values = sites.map((s: any) => {
            let val = s[key];
            if (!val && val !== 0) return 'Boş'; // Map empty/null/undefined to 'Boş'
            if (isDate && val) return format(new Date(val as string), 'dd.MM.yyyy');
            if (isCurrency && val) return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(val)) + ' ₺';
            return val ? String(val) : 'Boş';
        });
        // Filter out duplicates and sort
        return Array.from(new Set(values)).sort((a: any, b: any) => {
            if (a === 'Boş') return -1; // Put 'Boş' at the top
            if (b === 'Boş') return 1;
            return String(a).localeCompare(String(b));
        });
    };

    const siteColumns: { label: string; key?: keyof Site; width?: string; align?: string; isDate?: boolean; isCurrency?: boolean }[] = [
        { label: 'İş Grubu', key: 'workGroup', width: '120px' },
        { label: 'S.No', width: '50px', align: 'center' },
        { label: 'EKAP Belge No', key: 'projectNo', width: '100px' },
        { label: 'İşin Adı', key: 'name', width: '200px' },
        { label: 'İhale Kayıt Numarası', key: 'registrationNo', width: '100px' },
        { label: 'İlan Tarihi', key: 'announcementDate', width: '90px', isDate: true },
        { label: 'İhale Tarihi', key: 'tenderDate', width: '90px', isDate: true },
        { label: 'Sözleşme Tarihi', key: 'contractDate', width: '90px', isDate: true },
        { label: 'İşyeri Teslim Tarihi', key: 'siteDeliveryDate', width: '90px', isDate: true },
        { label: 'İş Bitim Tarihi', key: 'completionDate', width: '90px', isDate: true },
        { label: 'Süre Uzatımlı Tarih', key: 'extendedDate', width: '90px', isDate: true },
        { label: 'Sözleşme Ayı Yi-Üfe Oranı', key: 'contractYiUfe', width: '80px', align: 'center' },
        { label: 'Güncel Fiyat Farkı Katsayısı', key: 'priceDifferenceCoefficient', width: '80px', align: 'center' },
        { label: 'Sözleşme Bedeli (KDV ve F.F. Hariç)', key: 'contractPrice', width: '120px', align: 'right', isCurrency: true },
        { label: 'F.F. Dahil Kalan Tutar (KDV Hariç)', key: 'remainingAmount', width: '120px', align: 'right', isCurrency: true },
        { label: 'Sözleşme Fiyatlarıyla Gerçekleşen Tutar', key: 'realizedAmount', width: '120px', align: 'right', isCurrency: true },
        { label: 'Geçici Kabul', key: 'provisionalAcceptanceDate', width: '90px', align: 'center', isDate: true },
        { label: 'Kesin Kabul', key: 'finalAcceptanceDate', width: '90px', align: 'center', isDate: true },
        { label: 'İş Deneyim Belgesi', key: 'workExperienceCertificate', width: '100px', align: 'center' },
        { label: 'Durum', key: 'statusDetail', width: '120px', align: 'center' },
        { label: 'Ortaklık Oranı', key: 'partnershipPercentage', width: '60px', align: 'center' },
        { label: 'Sözleşme Ufe / Güncel Ufe', key: 'contractToCurrentUfeRatio', width: '80px', align: 'center' },
        { label: 'Güncel İş Deneyim Tutarı', key: 'currentWorkExperienceAmount', width: '120px', align: 'right', isCurrency: true },
        { label: 'Fiyat Farkı', key: 'priceDifference', width: '100px', align: 'right', isCurrency: true },
        { label: 'İşlem', width: '60px', align: 'center' }
    ];



    const handleDeleteCompany = async (id: string, name: string) => {
        // [FIX] Server-Side Dependency Check
        const toastId = toast.loading('Bağımlılıklar kontrol ediliyor...');

        try {
            const checkRes = await checkCompanyDependencies(id);
            toast.dismiss(toastId);

            if (!checkRes.success) {
                toast.error(checkRes.error || 'Kontrol başarısız.');
                return;
            }

            const { sites, vehicles, correspondences } = checkRes.counts || {};
            const errors: string[] = [];

            if ((sites || 0) > 0) errors.push(`- ${sites} adet Şantiye`);
            if ((vehicles || 0) > 0) errors.push(`- ${vehicles} adet Araç`);
            if ((correspondences || 0) > 0) errors.push(`- ${correspondences} adet Yazışma`);

            if (errors.length > 0) {
                alert(`Bu firma silinemez!\n\nBağlı kayıtlar bulunmaktadır:\n${errors.join('\n')}\n\nLütfen önce bu kayıtları silin veya başka bir firmaya aktarın.`);
                return;
            }

            if (confirm(`"${name}" firmasını silmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz.`)) {
                try {
                    const res = await deleteCompanyAction(id);
                    if (res.success) {
                        deleteCompany(id); // Update Local Store
                        toast.success('Firma başarıyla silindi.');
                    } else {
                        toast.error(res.error || 'Silme işlemi başarısız.');
                    }
                } catch (error) {
                    console.error(error);
                    toast.error('Bir hata oluştu.');
                }
            }
        } catch (error) {
            toast.dismiss(toastId);
            console.error(error);
            toast.error('Bir hata oluştu.');
        }
    }; // [NEW]
    const [companyName, setCompanyName] = useState('');
    const [companyTaxNumber, setCompanyTaxNumber] = useState('');
    const [companyAddress, setCompanyAddress] = useState('');
    const [companyPhone, setCompanyPhone] = useState('');
    const [companyStamp, setCompanyStamp] = useState<string | null>(null);
    const [companyLetterhead, setCompanyLetterhead] = useState<string | null>(null);
    const [companyShortName, setCompanyShortName] = useState(''); // [NEW] Replaces Document Number tab content usage (logic wise doc number moved to background or other tab if needed, but per request we reuse space)
    const [companyDocumentNumber, setCompanyDocumentNumber] = useState('1'); // Keep state if needed for API but hide UI


    const handleExportExcel = () => {
        const companiesToExport = (!selectedCompanyId || selectedCompanyId === 'all')
            ? companies
            : companies.filter(c => c.id === selectedCompanyId);

        const wb = XLSX.utils.book_new();

        companiesToExport.forEach(company => {
            const companySites = sites.filter((s: any) => s.companyId === company.id);
            if (companySites.length === 0) return;

            const sheetData: any[] = [];
            // No merges needed for rows anymore as we are doing 1 row per site
            let currentRow = 1;

            // Header based on User's Request
            const headers = [
                'İş Grubu',
                'S.No',
                'EKAP Belge No',
                'İşin Adı',
                'İhale Kayıt No',
                'Sözleşme Tarihi',
                'F.F. Dahil Kalan Tutar (KDV Hariç)',
                'Sözleşme Fiyatlarıyla Gerçekleşen Tutar',
                'Geçici Kabul Tarihi',
                'Kesin Kabul Tarihi',
                'İş Deneyim Belgesi Numarası', // Multi-line
                'Durum',
                'Ortaklık Oranı',
                'Güncel İş Deneyim Tutarı (TL)', // Multi-line
                'Fiyat Farkı (Reference Only)',
            ];
            sheetData.push(headers);

            companySites.forEach((site: any, index: number) => {
                const workGroups = site.similarWorks && site.similarWorks.length > 0
                    ? site.similarWorks
                    : [{ group: '', code: '-', amount: site.currentWorkExperienceAmount || 0 }];

                // Join with newline for single cell
                const workGroupNames = workGroups.map((w: any) => w.group || '').join('\n');
                const workGroupAmounts = workGroups.map((w: any) =>
                    // Format number nicely 
                    new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(w.amount || 0)
                ).join('\n');

                const row = [
                    site.workGroup || '',                                   // A: İş Grubu
                    index + 1,                                              // B: S.No
                    site.projectNo || '',                                   // C: EKAP No
                    site.name || '',                                        // D: İşin Adı
                    site.registrationNo || '',                              // E: İhale Kayıt No
                    site.contractDate ? format(new Date(site.contractDate), 'dd.MM.yyyy') : '', // F
                    site.remainingAmount || 0,                              // G
                    site.realizedAmount || 0,                               // H
                    site.provisionalAcceptanceDate ? format(new Date(site.provisionalAcceptanceDate), 'dd.MM.yyyy') : '', // I
                    site.finalAcceptanceDate ? format(new Date(site.finalAcceptanceDate), 'dd.MM.yyyy') : '',             // J
                    workGroupNames,                                         // K: Multi-line
                    site.status === 'INACTIVE' ? 'Pasif' : 'Aktif',         // L
                    site.partnershipPercentage ? `%${site.partnershipPercentage}` : '', // M
                    workGroupAmounts,                                       // N: Multi-line
                    site.priceDifference || ''                              // O
                ];
                sheetData.push(row);
                currentRow++;
            });

            const ws = XLSX.utils.aoa_to_sheet(sheetData);

            // Widths
            const wscols = headers.map(() => ({ wch: 15 }));
            wscols[3] = { wch: 50 }; // İşin Adı
            wscols[10] = { wch: 30 }; // İş Deneyim No width
            wscols[13] = { wch: 25 }; // Amount width
            ws['!cols'] = wscols;

            XLSX.utils.book_append_sheet(wb, ws, company.name.substring(0, 31));
        });

        XLSX.writeFile(wb, 'is_deneyim_cetvel_listesi.xlsx');
    };

    const handleExportPDF = () => {
        const doc = new jsPDF('l', 'mm', 'a4');
        doc.setFont('Helvetica', 'normal'); // Turkish chars might need a custom font, but standard 'Helvetica' usually handles basic latin well. For Turkish specific chars, might fail without custom font.
        // For simplicity using standard font, usually CP1254 text might look weird, but let's try.
        // Actually jsPDF default font doesn't support UTF-8 Turkish chars well (İ, ı, Ş, ş, Ğ, ğ). 
        // We will assume standard ASCII for file names or minimal issue. 
        // WORKAROUND: Use a font that supports Turkish or accept that chars might be off.
        // Better: Use autoTable's font support or just proceed. 

        doc.text("Şantiye Listesi", 14, 15);

        const tableColumn = ["Firma", "İş Grubu", "İşin Adı", "İhale K. No", "Sözleşme Tarihi", "Bedel", "Durum"];
        const tableRows: any[] = [];

        companies.forEach((company: any) => {
            const companySites = sites.filter((s: any) => s.companyId === company.id);
            companySites.forEach((site: any) => {
                const rowData = [
                    company.name,
                    site.workGroup || '',
                    site.name,
                    site.registrationNo || '',
                    site.contractDate ? format(new Date(site.contractDate), 'dd.MM.yyyy') : '',
                    site.contractPrice ? new Intl.NumberFormat('tr-TR').format(site.contractPrice) : '',
                    site.status === 'INACTIVE' ? 'Pasif' : 'Aktif'
                ];
                tableRows.push(rowData);
            });
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 20,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [41, 128, 185] }
        });

        doc.save("Santiye_Listesi.pdf");
    };


    // SMTP State
    const [companySmtpHost, setCompanySmtpHost] = useState('');
    const [companySmtpPort, setCompanySmtpPort] = useState('');
    const [companySmtpUser, setCompanySmtpUser] = useState('');
    const [companySmtpPass, setCompanySmtpPass] = useState('');
    const [companySmtpFromEmail, setCompanySmtpFromEmail] = useState('');
    const [companySmtpFromName, setCompanySmtpFromName] = useState('');
    const [companySmtpSecure, setCompanySmtpSecure] = useState(false);

    const handleCompanyFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'stamp' | 'letterhead') => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (field === 'stamp') setCompanyStamp(reader.result as string);
                else setCompanyLetterhead(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const openAddUserModal = () => {
        setIsEditing(false);
        setUserName('');
        setUserUsername('');
        setUserPassword('');
        // setUserEmail('');
        setUserRole('USER');
        setUserPermissions({});
        setAssignedSiteIds([]);
        setEditLookbackDays(''); // Default to unlimited/system default if empty
        setUserModalOpen(true);
    };

    const openEditUserModal = (user: any) => {
        try {
            setIsEditing(true);
            setSelectedUserId(user.id);
            setUserName(user.name);
            setUserUsername(user.username || '');
            setUserPassword('');
            setUserRole(user.role);
            setUserPermissions(user.permissions || {});

            // Safe Array Extraction
            let siteIds: string[] = [];
            if (Array.isArray(user.assignedSiteIds)) {
                siteIds = user.assignedSiteIds;
            } else if (Array.isArray(user.assignedSites)) {
                siteIds = user.assignedSites.map((s: any) => s.id).filter(Boolean);
            }

            setAssignedSiteIds(siteIds);
            setEditLookbackDays(user.editLookbackDays !== undefined ? user.editLookbackDays : '');
            setUserModalOpen(true);
        } catch (error) {
            console.error('Error opening user modal:', error);
            alert('Kullanıcı düzenleme penceresi açılırken hata oluştu: ' + error);
        }
    };

    const handleSaveUser = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log('handleSaveUser triggered');

        try {
            // Validate required fields explicitly to catch browser issues or edge cases
            if (!userName || !userUsername) {
                alert('Lütfen ad ve kullanıcı adı alanlarını doldurunuz.');
                return;
            }
            if (!isEditing && !userPassword) {
                alert('Lütfen şifre belirleyiniz.');
                return;
            }

            let result;
            // ... existing logic ...
            if (isEditing && selectedUserId) {
                result = await updateUserAction(selectedUserId, {
                    username: userUsername,
                    password: userPassword || undefined,
                    role: userRole,
                    permissions: userPermissions,
                    assignedSiteIds: assignedSiteIds,
                    editLookbackDays: editLookbackDays === '' ? undefined : Number(editLookbackDays)
                });
            } else {
                result = await createUser({
                    name: userName,
                    username: userUsername,
                    password: userPassword,
                    role: userRole,
                    permissions: userPermissions,
                    assignedSiteIds: assignedSiteIds,
                    editLookbackDays: editLookbackDays === '' ? undefined : Number(editLookbackDays)
                });
            }

            console.log('Result:', result);

            if (result && result.success) {
                toast.success(isEditing ? 'Kullanıcı güncellendi.' : 'Kullanıcı oluşturuldu.');
                setUserModalOpen(false);
                // Force refresh to update list
                location.reload();
            } else {
                alert('İşlem başarısız: ' + (result?.error || 'Bilinmeyen hata'));
                // Keep modal open
                return;
            }

        } catch (error: any) {
            console.error('Save User Error:', error);
            alert('Bir hata oluştu: ' + (error.message || error));
            return;
        }

        // Only reached if successful (but reload happens above)
        setUserName('');
        setUserUsername('');
        setUserPassword('');
        setUserRole('USER');
        setUserPermissions({});
        setEditLookbackDays('');
    };

    const handleSaveUserSecure = async (e: any) => {
        if (e && e.preventDefault) e.preventDefault();

        console.log('handleSaveUserSecure triggered via API Route');
        const loadingToastId = toast.loading('İşlem yapılıyor, lütfen bekleyiniz...');

        try {
            if (!userName || !userUsername) {
                toast.error('Lütfen ad ve kullanıcı adı alanlarını doldurunuz.');
                toast.dismiss(loadingToastId);
                return;
            }
            if (!isEditing && !userPassword) {
                toast.error('Lütfen şifre belirleyiniz.');
                toast.dismiss(loadingToastId);
                return;
            }

            // Construct payload
            const payload = {
                id: isEditing ? selectedUserId : undefined,
                name: userName,
                username: userUsername,
                password: userPassword || undefined, // Only send if changed/new
                role: userRole,
                permissions: userPermissions,
                assignedSiteIds: assignedSiteIds,
                editLookbackDays: editLookbackDays === '' ? undefined : Number(editLookbackDays),
                status: 'ACTIVE'
            };

            // Use FETCH API instead of Server Action
            const response = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (response.ok && result.success) {
                toast.dismiss(loadingToastId); // Dismiss loading first
                toast.success(isEditing ? 'Kullanıcı güncellendi.' : 'Kullanıcı oluşturuldu.');
                setUserModalOpen(false);
                setTimeout(() => location.reload(), 1000);
            } else {
                throw new Error(result.error || 'Sunucu işlem hatası');
            }

        } catch (error: any) {
            console.error('Save User Error:', error);
            toast.dismiss(loadingToastId);
            toast.error('HATA: ' + (error.message || 'Beklenmeyen hata'));
        }
    };


    const handleDeleteUser = async (userToDelete: User) => {
        if (user?.role !== 'ADMIN') { // [Check] Only Admin can delete
            toast.error('Bu işlem için yetkiniz yok.');
            return;
        }

        if (userToDelete.id === user?.id) {
            toast.error('Kendinizi silemezsiniz.');
            return;
        }

        if (confirm(`${userToDelete.name} kullanıcısını silmek istediğinize emin misiniz?`)) {
            try {
                // Use FETCH instead of Action to avoid "Unrecognized Action" error
                const response = await fetch('/api/users', {
                    method: 'POST', // standard API route only handles POST/GET generally, or we could use DELETE method if route supports it. 
                    // My previous route code handled 'isDelete' in POST.
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: userToDelete.id, isDelete: true })
                });

                const res = await response.json();

                if (res.success) {
                    deleteUser(userToDelete.id); // Update Store locally
                    toast.success('Kullanıcı silindi.');
                } else {
                    toast.error(res.error || 'Silinemedi.');
                }
            } catch (error: any) {
                console.error(error);
                toast.error('Silme hatası: ' + (error.message || 'Sunucu hatası'));
            }
        }
    };

    const handleAddCompany = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log('handleAddCompany tetiklendi. Veriler:', { companyName, companyTaxNumber, isEditingCompany, selectedCompanyId });

        if (!companyName.trim()) {
            toast.error('Firma adı zorunludur.');
            return;
        }

        if (!companyShortName.trim()) {
            toast.error('Firma kısa adı zorunludur.');
            return;
        }

        const companyData = {
            name: companyName,
            taxNumber: companyTaxNumber,
            address: companyAddress,
            phone: companyPhone,
            stamp: companyStamp || undefined,
            letterhead: companyLetterhead || undefined,
            smtpHost: companySmtpHost,
            smtpPort: companySmtpPort ? Number(companySmtpPort) : undefined,
            smtpUser: companySmtpUser,
            smtpPass: companySmtpPass,
            smtpFromEmail: companySmtpFromEmail,
            smtpFromName: companySmtpFromName,
            smtpSecure: companySmtpSecure,
            currentDocumentNumber: parseInt(companyDocumentNumber) || 1, // [NEW] Document Tracking
            shortName: companyShortName // [NEW]
        };

        try {
            if (isEditingCompany && selectedCompanyId) {
                console.log('Güncelleme işlemi başlatılıyor...', companyData);
                const result = await updateCompanyAction(selectedCompanyId, companyData);
                console.log('Güncelleme sonucu:', result);

                if (result.success && result.data) {
                    updateCompany(selectedCompanyId, result.data as any); // Update Local Store
                    toast.success('Firma başarıyla güncellendi.');
                    setCompanyModalOpen(false);
                    resetCompanyForm();
                } else {
                    console.error('Güncelleme hatası:', result.error);
                    toast.error(result.error || 'Güncelleme başarısız.');
                }
            } else {
                console.log('Ekleme işlemi başlatılıyor...', companyData);
                const result = await createCompany(companyData);
                console.log('Ekleme sonucu:', result);

                if (result.success && result.data) {
                    addCompany(result.data as any); // Update Local Store
                    toast.success('Firma başarıyla eklendi.');
                    setCompanyModalOpen(false);
                    resetCompanyForm();
                } else {
                    console.error('Ekleme hatası:', result.error);
                    toast.error('Ekleme başarısız.');
                }
            }
            // router.refresh(); // [FIX] Removed to prevent race condition with Store state.
        } catch (err) {
            console.error('Beklenmeyen hata:', err);
            toast.error('İşlem sırasında bir hata oluştu.');
        }
    };

    const resetCompanyForm = () => {
        setIsEditingCompany(false);
        setSelectedCompanyId(null);
        setCompanyName('');
        setCompanyTaxNumber('');
        setCompanyAddress('');
        setCompanyPhone('');
        setCompanyStamp(null);
        setCompanyLetterhead(null);
        setCompanySmtpHost('');
        setCompanySmtpPort('');
        setCompanySmtpUser('');
        setCompanySmtpPass('');
        setCompanySmtpFromEmail('');
        setCompanySmtpFromName('');
        setCompanySmtpFromName('');
        setCompanySmtpSecure(false);
        setCompanySmtpSecure(false);
        setCompanyDocumentNumber('1');
        setCompanyShortName(''); // [NEW]
    };

    const openAddCompanyModal = () => {
        resetCompanyForm();
        setCompanyModalOpen(true);
    };

    const openEditCompanyModal = async (company: any) => {
        setIsEditingCompany(true);
        setSelectedCompanyId(company.id);
        setCompanyName(company.name);
        setCompanyTaxNumber(company.taxNumber || '');
        setCompanyAddress(company.address || '');
        setCompanyPhone(company.phone || '');
        // [PERF] stamp ve letterhead artık global store'da yok, ihtiyaç halinde çekiyoruz
        const fullResult = await getCompanyFull(company.id);
        if (fullResult.success && fullResult.data) {
            setCompanyStamp(fullResult.data.stamp || null);
            setCompanyLetterhead(fullResult.data.letterhead || null);
        } else {
            setCompanyStamp(null);
            setCompanyLetterhead(null);
        }
        setCompanyDocumentNumber(company.currentDocumentNumber?.toString() || '1');
        setCompanyShortName(company.shortName || ''); // [NEW]

        // [FIX] Check for flat fields first (Prisma default), then fallback to nested config
        if (company.smtpHost || company.smtpConfig) {
            setCompanySmtpHost(company.smtpHost || company.smtpConfig?.host || '');
            setCompanySmtpPort(company.smtpPort?.toString() || company.smtpConfig?.port?.toString() || '');
            setCompanySmtpUser(company.smtpUser || company.smtpConfig?.auth?.user || '');
            setCompanySmtpPass(company.smtpPass || company.smtpConfig?.auth?.pass || '');
            setCompanySmtpFromEmail(company.smtpFromEmail || company.smtpConfig?.fromEmail || '');
            setCompanySmtpFromName(company.smtpFromName || company.smtpConfig?.fromName || '');
            setCompanySmtpSecure(company.smtpSecure !== undefined ? company.smtpSecure : (company.smtpConfig?.secure || false));
        } else {
            setCompanySmtpHost('');
            setCompanySmtpPort('');
            setCompanySmtpUser('');
            setCompanySmtpPass('');
            setCompanySmtpFromEmail('');
            setCompanySmtpFromName('');
            setCompanySmtpSecure(false);
        }
        setCompanyModalOpen(true);
    };

    // Site Form State
    // const { addSite } = useAppStore(); // Removed duplicate
    const [siteModalOpen, setSiteModalOpen] = useState(false);
    const [isEditingSite, setIsEditingSite] = useState(false); // [NEW]
    const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null); // [NEW]
    const [isSubmitting, setIsSubmitting] = useState(false); // [NEW] Loading state


    const [newSiteData, setNewSiteData] = useState<any>({
        name: '',
        companyId: '',
        location: '',
        workGroup: '',
        orderNo: '',
        projectNo: '',
        registrationNo: '',
        announcementDate: '',
        tenderDate: '',
        contractDate: '',
        siteDeliveryDate: '',
        contractYiUfe: undefined,
        priceDifferenceCoefficient: undefined,
        contractPrice: undefined,
        remainingAmount: undefined,
        realizedAmount: undefined,
        kdv: 3.50, // Default to typical or 0
        provisionalAcceptanceDate: '',
        finalAcceptanceDate: '',
        workExperienceCertificate: '',
        completionDate: '',
        extendedDate: '',
        statusDetail: '',
        completionPercentage: 0,
        partnershipPercentage: 0,
        contractToCurrentUfeRatio: 0,
        currentUfeDate: '',
        currentWorkExperienceAmount: 0,
        priceDifference: 0,
        personnelCount: 0,

        note: '',
        isWarehouse: false, // [NEW]
        provisionalAcceptanceDoc: '',
        finalAcceptanceDoc: '',
        workExperienceDoc: '',

        similarWorks: [] // [NEW] Multiple Similar Work Groups
    });

    // Tank Form State [NEW]
    const [newTankName, setNewTankName] = useState('');
    const [newTankCapacity, setNewTankCapacity] = useState('');
    const [newTankLevel, setNewTankLevel] = useState('0');

    const handleAddTank = async () => {
        if (!selectedSiteId) {
            toast.error('Lütfen önce şantiyeyi kaydedin.');
            return;
        }
        if (!newTankName || !newTankCapacity) {
            toast.error('Depo adı ve kapasitesi zorunludur.');
            return;
        }

        try {
            const res = await createFuelTank({
                siteId: selectedSiteId,
                name: newTankName,
                capacity: Number(newTankCapacity),
                currentLevel: Number(newTankLevel)
            });

            if (res.success && res.data) {
                addFuelTank(res.data);
                toast.success('Depo eklendi.');
                setNewTankName('');
                setNewTankCapacity('');
                setNewTankLevel('0');
            } else {
                toast.error(res.error || 'Depo eklenemedi.');
            }
        } catch (error) {
            console.error(error);
            toast.error('Bir hata oluştu.');
        }
    };

    const handleDeleteTank = async (id: string) => {
        if (!confirm('Bu depoyu silmek istediğinize emin misiniz?')) return;
        try {
            // Basic dependency check handled by server usually, but here we just try delete
            const res = await deleteFuelTankAction(id);
            if (res.success) {
                deleteFuelTank(id);
                toast.success('Depo silindi.');
            } else {
                toast.error(res.error || 'Silinemedi.');
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleDeleteSite = async () => {
        if (!selectedSiteId) return;

        // 1. Calculate Dependencies
        const assignedVehicles = vehicles.filter((v: any) => v.assignedSiteId === selectedSiteId).length;
        const assignedUsers = users.filter((u: any) => u.assignedSiteIds?.includes(selectedSiteId)).length;
        // Check both vehicle and personnel attendance
        const pAttendanceCount = personnelAttendance.filter((a: any) => a.siteId === selectedSiteId).length;
        const vAttendanceCount = vehicleAttendance.filter((a: any) => a.siteId === selectedSiteId).length;
        const tankCount = fuelTanks.filter((t: any) => t.siteId === selectedSiteId).length;

        const totalDependencies = assignedVehicles + assignedUsers + pAttendanceCount + vAttendanceCount + tankCount;

        // 2. Confirmation Logic
        if (totalDependencies > 0) {
            const message = `Bu şantiye silinemez!\n\n` +
                `Bağlı Kayıtlar:\n` +
                (assignedVehicles > 0 ? `- ${assignedVehicles} adet Araç\n` : '') +
                (assignedUsers > 0 ? `- ${assignedUsers} adet Kullanıcı\n` : '') +
                (pAttendanceCount > 0 ? `- ${pAttendanceCount} adet Personel Puantajı\n` : '') +
                (vAttendanceCount > 0 ? `- ${vAttendanceCount} adet Araç Puantajı\n` : '') +
                (tankCount > 0 ? `- ${tankCount} adet Yakıt Deposu\n` : '');

            if (user?.role !== 'ADMIN') {
                alert(message + `\nLütfen önce bu kayıtları kaldırınız.`);
                return;
            } else {
                // Admin Double Confirmation
                if (!confirm(message + `\n\n[ADMIN YETKİSİ]\nBu kayıtlara rağmen şantiyeyi silmek istediğinize emin misiniz?`)) {
                    return;
                }
            }
        } else {
            // No dependencies, simple confirm
            if (!confirm('Bu şantiyeyi silmek istediğinize emin misiniz?')) {
                return;
            }
        }

        // 3. Execution
        try {
            const result = await deleteSiteAction(selectedSiteId);
            if (result.success) {
                deleteSite(selectedSiteId); // Update Client Store
                setSiteModalOpen(false);
                resetSiteForm();
                toast.success('Şantiye başarıyla silindi.');
                router.refresh();
            } else {
                toast.error(result.error || 'Şantiye silinemedi.');
            }
        } catch (error) {
            console.error("Delete Site Error", error);
            toast.error("Bir hata oluştu.");
        }
    };

    const handleSiteFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'provisional' | 'final' | 'experience') => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                if (field === 'provisional') setNewSiteData(prev => ({ ...prev, provisionalAcceptanceDoc: result }));
                if (field === 'final') setNewSiteData(prev => ({ ...prev, finalAcceptanceDoc: result }));
                if (field === 'experience') setNewSiteData(prev => ({ ...prev, workExperienceDoc: result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleAddSite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;

        setIsSubmitting(true);

        const sitePayload: any = {
            name: newSiteData.name!,
            companyId: newSiteData.companyId!,
            location: '', // Removed from UI, default empty
            status: 'ACTIVE',
            ...newSiteData
        };

        try {
            let result;
            if (isEditingSite && selectedSiteId) {
                result = await updateSiteAction(selectedSiteId, sitePayload);
            } else {
                if (newSiteData.provisionalAcceptanceDate) {
                    sitePayload.status = 'INACTIVE';
                }
                result = await createSite(sitePayload);
            }

            if (result && result.success) {
                toast.success('İşlem başarıyla tamamlandı.');
                router.refresh();
                setSiteModalOpen(false);
                resetSiteForm();
            } else {
                throw new Error(result?.error || 'Bilinmeyen bir hata oluştu');
            }
        } catch (err: any) {
            console.error(err);
            toast.error(`İşlem başarısız: ${err.message || err}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetSiteForm = () => {
        setIsEditingSite(false);
        setSelectedSiteId(null);
        setNewSiteData({
            name: '', companyId: '', location: '',
            workGroup: '', orderNo: '', projectNo: '', registrationNo: '',
            announcementDate: '', tenderDate: '', contractDate: '', siteDeliveryDate: '',
            contractYiUfe: undefined, priceDifferenceCoefficient: undefined,
            contractPrice: undefined, remainingAmount: undefined, realizedAmount: undefined,
            kdv: undefined, provisionalAcceptanceDate: '', finalAcceptanceDate: '', workExperienceCertificate: '',
            completionDate: '', extendedDate: '', statusDetail: '', completionPercentage: 0, partnershipPercentage: 0,
            contractToCurrentUfeRatio: undefined, currentUfeDate: '', currentWorkExperienceAmount: undefined, priceDifference: undefined,
            personnelCount: 0, note: '',
            provisionalAcceptanceDoc: '', finalAcceptanceDoc: '', workExperienceDoc: '',
            similarWorks: [],
            isWarehouse: false // [NEW]
        });
    };

    const openAddSiteModal = () => {
        resetSiteForm();
        setSiteModalOpen(true);
    };

    const openEditSiteModal = (site: Site) => {
        setIsEditingSite(true);
        setSelectedSiteId(site.id);
        setNewSiteData({
            ...site,
            isWarehouse: site.isWarehouse || false, // [NEW] Handle null/undefined checks
        });
        setSiteModalOpen(true);
    };

    const setPermission = (moduleId: string, value: string, action: 'ADD' | 'REMOVE' | 'SET_VIEW' | 'CLEAR') => {
        setUserPermissions(prev => {
            const current = prev[moduleId] || [];
            let updated = [...current];

            if (action === 'CLEAR') {
                updated = [];
            } else if (action === 'SET_VIEW') {
                if (!updated.includes('VIEW')) updated.push('VIEW');
            } else if (action === 'ADD') {
                if (!updated.includes(value)) updated.push(value);
                // Ensure VIEW is present if adding sub-permissions
                if (!updated.includes('VIEW')) updated.push('VIEW');
            } else if (action === 'REMOVE') {
                updated = updated.filter(p => p !== value);
            }

            const result = {
                ...prev,
                [moduleId]: updated
            };

            // [SYNC] movement.rental-create <-> vehicles.rental-create
            // If enabling rental-create in movement, also enable in vehicles (and vice versa)
            const RENTAL_SYNC_PAIRS: Record<string, string> = {
                'movement.rental-create': 'vehicles.rental-create',
                'vehicles.rental-create': 'movement.rental-create',
            };

            const syncTarget = RENTAL_SYNC_PAIRS[moduleId];
            if (syncTarget && (value === 'VIEW' || value === 'CREATE' || action === 'SET_VIEW')) {
                if (action === 'ADD' || action === 'SET_VIEW') {
                    const targetPerms = result[syncTarget] || [];
                    if (!targetPerms.includes(value)) {
                        result[syncTarget] = [...targetPerms, value];
                    }
                    if (!result[syncTarget].includes('VIEW')) {
                        result[syncTarget] = [...result[syncTarget], 'VIEW'];
                    }
                }
            }

            return result;
        });
    };

    const setAllPermissions = (level: 'VIEW' | 'CREATE' | 'EDIT' | 'FULL' | 'NONE') => {
        // Legacy support helper or Bulk Action
        // If NONE -> Clear all
        // If VIEW -> Set all to ['VIEW']
        // If EDIT -> Set all to ['VIEW', 'CREATE', 'EDIT'] (Full Access)
        const newPerms: Record<string, string[]> = {};

        // Helper to determine array based on "Level" concept
        let targetArray: string[] = [];
        if (level === 'VIEW') targetArray = ['VIEW'];
        if (level === 'CREATE') targetArray = ['VIEW', 'CREATE'];
        if (level === 'EDIT') targetArray = ['VIEW', 'CREATE', 'EDIT'];
        if (level === 'FULL') targetArray = ['VIEW', 'CREATE', 'EDIT', 'EXPORT'];
        if (level === 'NONE') targetArray = [];

        const collectModuleIds = (modules: any[]) => {
            modules.forEach(m => {
                newPerms[m.id] = [...targetArray];
                if (m.children) {
                    collectModuleIds(m.children);
                }
            });
        };
        collectModuleIds(MODULE_HIERARCHY);
        setUserPermissions(newPerms);
    };

    const toggleColumn = (colType: 'VIEW' | 'CREATE' | 'EDIT' | 'EXPORT') => {
        // 1. Flatten modules to get all IDs
        const allModuleIds: string[] = [];
        const collectModuleIds = (modules: any[]) => {
            modules.forEach(m => {
                allModuleIds.push(m.id);
                if (m.children) collectModuleIds(m.children);
            });
        };
        collectModuleIds(MODULE_HIERARCHY);

        // 2. Check current state
        // If ALL modules have this permission -> Remove it
        // If ANY module is missing it -> Add it to ALL
        const allHaveIt = allModuleIds.every(id => (userPermissions[id] || []).includes(colType));

        setUserPermissions(prev => {
            const next = { ...prev };
            allModuleIds.forEach(id => {
                const currentPerms = next[id] || [];
                let newPerms = [...currentPerms];

                if (allHaveIt) {
                    // Remove
                    newPerms = newPerms.filter(p => p !== colType);
                    // If removing VIEW, we might want to clear everything? 
                    // Let's stick to strict column removal. 
                    // Changes to View will disable others in UI anyway.
                } else {
                    // Add
                    if (!newPerms.includes(colType)) newPerms.push(colType);
                    // If Adding CREATE/EDIT, ensure VIEW is there?
                    if (colType !== 'VIEW' && !newPerms.includes('VIEW')) newPerms.push('VIEW');
                }
                next[id] = newPerms;
            });
            return next;
        });
    };

    const fetchYiUfeFromApi = async () => {
        setUpdatingYiUfe(true);
        try {
            // Using server action instead of API route
            const res = await syncYiUfeRates();
            if (res.success) {
                // Refresh data
                const ratesRes = await getYiUfeRates();
                if (ratesRes.success && ratesRes.data) {
                    setYiUfeRates(ratesRes.data);
                    toast.success(res.message || 'Veriler güncellendi.');
                }
            } else {
                toast.error(res.error || 'Güncelleme başarısız.');
            }
        } catch (e) {
            console.error(e);
            toast.error('Otomatik güncelleme işleminde hata.');
        } finally {
            setUpdatingYiUfe(false);
        }
    };

    const handleSaveManualYiUfe = async (e: React.FormEvent) => {
        e.preventDefault();
        const rate = parseFloat(manualRate);
        if (isNaN(rate)) {
            toast.error('Geçerli bir oran giriniz.');
            return;
        }

        try {
            const res = await addYiUfeRate(manualYear, manualMonth + 1, rate);
            if (res.success && res.data) {
                // Helper to merge manually or just re-fetch
                const ratesRes = await getYiUfeRates();
                if (ratesRes.success && ratesRes.data) {
                    setYiUfeRates(ratesRes.data);
                    toast.success('Kayıt başarılı.');
                    setYiUfeModalOpen(false);
                    setManualRate('');
                }
            } else {
                toast.error(res.error || 'Kayıt başarısız.');
            }
        } catch (error) {
            console.error(error);
            toast.error('İşlem hatası.');
        }
    };

    // Auto-update logic is now handled globally in useYiUfeAutoUpdate hook.

    // If Admin is selected, select all permissions automatically? 
    // Or keep them separate. User request says "restricted and full access".
    // Let's implement logic: Admin usually has access to everything by default logic elsewhere, 
    // User request: "kısıtlı yetki ve tam yetkiyi hangi sekmelere vermek istediğimi seçenek olarak sun"

    // [NEW] Role Templates State (Using state from top of component, removing duplicates here if any)
    // The state `templates` is already defined at top level.

    // [NEW] Helper to render permission rows recursively
    const handleApplyTemplate = (val: string) => {
        // Check if it is a SPECIAL value
        if (val === 'VIEW_ALL') {
            const newPerms: Record<string, string[]> = {};
            MODULE_HIERARCHY.forEach(m => {
                // Main module view
                newPerms[m.id] = ['VIEW'];
                // Sub modules view
                m.children?.forEach(sub => {
                    newPerms[sub.id] = ['VIEW'];
                });
            });
            setUserPermissions(newPerms); // [FIX] Use setUserPermissions
            toast.success('İzleme şablonu uygulandı.');
            return;
        }

        // Check if it is a TEMPLATE
        const template = templates.find(t => t.id === val);
        if (template) {
            setUserPermissions(template.permissions as Record<string, string[]>);
            toast.success(`"${template.name}" şablonu uygulandı.`);
            return;
        }
    };
    const renderPermissionRow = (module: any, depth = 0) => {
        const perms = userPermissions[module.id] || [];
        const hasView = perms.includes('VIEW');
        const hasCreate = perms.includes('CREATE');
        const hasEdit = perms.includes('EDIT');
        const hasExport = perms.includes('EXPORT');

        const paddingLeft = depth * 24;

        // Auto-select VIEW if any other permission is selected
        const handleCheck = (type: 'VIEW' | 'CREATE' | 'EDIT' | 'EXPORT', checked: boolean) => {
            if (type === 'VIEW') {
                setPermission(module.id, 'VIEW', checked ? 'SET_VIEW' : 'CLEAR');
            } else {
                setPermission(module.id, type, checked ? 'ADD' : 'REMOVE');
            }
        };

        return (
            <Fragment key={module.id}>
                <TableRow className={cn(
                    "hover:bg-slate-50/80 transition-colors",
                    depth === 0 ? "bg-white" : "bg-slate-50/30"
                )}>
                    <TableCell className="py-3" style={{ paddingLeft: `${paddingLeft + 16}px` }}>
                        <div className="flex items-center gap-3">
                            {depth > 0 && <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />}
                            <span className={cn(
                                "text-sm",
                                depth === 0 ? "font-semibold text-slate-900" : "text-slate-700"
                            )}>
                                {module.label}
                            </span>
                        </div>
                    </TableCell>

                    {/* VIEW */}
                    <TableCell className="text-center py-2">
                        <div className="flex justify-center">
                            <Checkbox
                                checked={hasView}
                                onCheckedChange={(c) => handleCheck('VIEW', c as boolean)}
                                className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                            />
                        </div>
                    </TableCell>

                    {/* CREATE */}
                    <TableCell className="text-center py-2">
                        <div className="flex justify-center">
                            <Checkbox
                                checked={hasCreate}
                                onCheckedChange={(c) => handleCheck('CREATE', c as boolean)}
                                disabled={!hasView}
                                className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600 disabled:opacity-30"
                            />
                        </div>
                    </TableCell>

                    {/* EDIT */}
                    <TableCell className="text-center py-2">
                        <div className="flex justify-center">
                            <Checkbox
                                checked={hasEdit}
                                onCheckedChange={(c) => handleCheck('EDIT', c as boolean)}
                                disabled={!hasView}
                                className="data-[state=checked]:bg-orange-600 data-[state=checked]:border-orange-600 disabled:opacity-30"
                            />
                        </div>
                    </TableCell>

                    {/* EXPORT */}
                    <TableCell className="text-center py-2">
                        <div className="flex justify-center">
                            <Checkbox
                                checked={hasExport}
                                onCheckedChange={(c) => handleCheck('EXPORT', c as boolean)}
                                disabled={!hasView}
                                className="data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600 disabled:opacity-30"
                            />
                        </div>
                    </TableCell>
                </TableRow>
                {module.children?.map((child: any) => renderPermissionRow(child, depth + 1))}
            </Fragment>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">Yönetim Paneli</h1>
            </div>

            <Tabs value={currentTab} onValueChange={handleTabChange} className="space-y-4">
                <TabsList>
                    <TabsTrigger value="users">
                        <Users className="w-4 h-4 mr-2" />
                        Kullanıcı Yönetimi
                    </TabsTrigger>
                    <TabsTrigger value="companies">
                        <Building2 className="w-4 h-4 mr-2" />
                        Firma Yönetimi
                    </TabsTrigger>
                    <TabsTrigger value="sites">
                        <MapPin className="w-4 h-4 mr-2" />
                        Şantiyeler
                    </TabsTrigger>
                    <TabsTrigger value="yiufe">
                        <TrendingUp className="w-4 h-4 mr-2" />
                        Yi-Üfe
                    </TabsTrigger>
                    <TabsTrigger value="system" className="flex items-center gap-2 text-red-600 data-[state=active]:text-red-700 data-[state=active]:bg-red-50">
                        <ShieldAlert className="w-4 h-4 mr-2" />
                        Sistem Yönetimi
                    </TabsTrigger>
                </TabsList>

                {/* USER MANAGEMENT TAB */}
                <TabsContent value="users" className="space-y-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Kullanıcı Listesi & Yetkiler</CardTitle>
                                <CardDescription>Kullanıcıların erişebileceği modülleri buradan yönetebilirsiniz.</CardDescription>
                            </div>
                            <Dialog open={userModalOpen} onOpenChange={setUserModalOpen}>
                                <DialogTrigger asChild>
                                    <Button onClick={openAddUserModal}>
                                        <Plus className="w-4 h-4 mr-2" /> Kullanıcı Ekle
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-none sm:max-w-[98vw] w-[98vw] max-h-[95vh] h-[95vh] flex flex-col overflow-hidden">
                                    <DialogHeader>
                                        <DialogTitle>{isEditing ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı Ekle'}</DialogTitle>
                                    </DialogHeader>
                                    <div className="flex-1 overflow-hidden flex flex-col">

                                        <div className="grid grid-cols-12 gap-6 flex-1 overflow-hidden p-1">
                                            {/* LEFT COLUMN: Basic Info & Sites */}
                                            <div className="col-span-4 space-y-4 overflow-y-auto pr-2 h-full">
                                                {!isEditing && (
                                                    <>
                                                        <div className="space-y-2">
                                                            <Label>Ad Soyad</Label>
                                                            <Input value={userName} onChange={e => setUserName(e.target.value)} required />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label>Kullanıcı Adı</Label>
                                                            <Input value={userUsername} onChange={e => setUserUsername(e.target.value)} required />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label>Şifre</Label>
                                                            <Input type="text" value={userPassword} onChange={e => setUserPassword(e.target.value)} required />
                                                        </div>
                                                    </>
                                                )}

                                                {isEditing && (
                                                    <div className="p-4 bg-slate-100 rounded-md mb-4 space-y-2">
                                                        <div className="space-y-2">
                                                            <Label>Ad Soyad</Label>
                                                            <Input value={userName} onChange={e => setUserName(e.target.value)} required />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label>Kullanıcı Adı</Label>
                                                            <Input value={userUsername} onChange={e => setUserUsername(e.target.value)} />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label>Yeni Şifre (Boş bırakılabilir)</Label>
                                                            <Input type="text" value={userPassword} onChange={e => setUserPassword(e.target.value)} placeholder="Değiştirmek için giriniz" />
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="space-y-2">
                                                    <Label>Ana Yetki Seviyesi</Label>
                                                    <div className="flex flex-col gap-2">
                                                        <Button
                                                            type="button"
                                                            variant={userRole === 'ADMIN' ? 'default' : 'outline'}
                                                            onClick={() => setUserRole('ADMIN')}
                                                            className="w-full"
                                                        >
                                                            Tam Yetki (Admin)
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant={userRole === 'USER' ? 'default' : 'outline'}
                                                            onClick={() => setUserRole('USER')}
                                                            className="w-full"
                                                        >
                                                            Kısıtlı Yetki
                                                        </Button>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground my-1">
                                                        * Admin yetkisi tüm modüllere erişim sağlar.
                                                    </p>
                                                </div>

                                                <div className="border rounded-md p-4 space-y-3">
                                                    <Label>Atanan Şantiyeler</Label>
                                                    <div className="grid grid-cols-1 gap-2">
                                                        {sites.filter((s: any) => s.status !== 'INACTIVE').map((site: any) => (
                                                            <div key={site.id} className="flex items-center space-x-2">
                                                                <Checkbox
                                                                    id={`site-${site.id}`}
                                                                    checked={assignedSiteIds.includes(site.id)}
                                                                    onCheckedChange={(checked) => {
                                                                        if (checked) {
                                                                            setAssignedSiteIds([...assignedSiteIds, site.id]);
                                                                        } else {
                                                                            setAssignedSiteIds(assignedSiteIds.filter(id => id !== site.id));
                                                                        }
                                                                    }}
                                                                />
                                                                <label
                                                                    htmlFor={`site-${site.id}`}
                                                                    className="text-sm font-medium leading-none cursor-pointer"
                                                                >
                                                                    {site.name}
                                                                </label>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {userRole !== 'ADMIN' && (
                                                    <div className="border rounded-md p-4 space-y-3">
                                                        <Label>Geriye Dönük İşlem (Gün)</Label>
                                                        <div className="flex items-center gap-2">
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                placeholder="Örn: 3"
                                                                value={editLookbackDays}
                                                                onChange={e => setEditLookbackDays(e.target.value === '' ? '' : parseInt(e.target.value))}
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* RIGHT COLUMN: Permissions */}
                                            <div className="col-span-8 flex flex-col h-full overflow-hidden border rounded-md">
                                                {userRole === 'ADMIN' ? (
                                                    <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-slate-50 text-slate-500">
                                                        <ShieldCheck className="w-16 h-16 mb-4 text-green-500" />
                                                        <h3 className="text-lg font-semibold text-slate-900">Tam Yetkili Yönetici</h3>
                                                        <p className="max-w-md">
                                                            Bu kullanıcı <span className="font-bold text-slate-900">ADMIN</span> rolüne sahiptir ve sistemdeki tüm modüllere, ayarlara ve verilere tam erişimi vardır. Modül bazlı kısıtlama yapılamaz.
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col h-full">
                                                        <div className="p-3 border-b bg-slate-50 flex flex-col gap-3 shrink-0">
                                                            <div className="flex justify-between items-center">
                                                                <Label>Modül Erişim İzinleri</Label>
                                                                <div className="flex gap-2">
                                                                    <Button type="button" variant="outline" size="sm" onClick={() => setAllPermissions('NONE')} className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50">
                                                                        <Trash2 className="w-3 h-3 mr-1" /> Temizle
                                                                    </Button>
                                                                    <Button type="button" variant="outline" size="sm" onClick={() => setAllPermissions('FULL')} className="h-7 text-xs font-bold text-blue-700 hover:text-blue-800 hover:bg-blue-50">
                                                                        <ShieldCheck className="w-3 h-3 mr-1" /> Tam Yetki
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                            {/* Template Management Section */}
                                                            <div className="border rounded-md bg-white">
                                                                <div className="px-3 py-2 border-b bg-slate-50 flex items-center justify-between">
                                                                    <span className="text-xs font-semibold text-slate-700">📋 Şablon Yönetimi</span>
                                                                </div>
                                                                <div className="divide-y">
                                                                    {/* Built-in: View All */}
                                                                    <div className="flex items-center justify-between px-3 py-2 hover:bg-slate-50 transition-colors">
                                                                        <span className="text-sm text-slate-700">Sadece İzleme (Tüm Modüller)</span>
                                                                        <Button type="button" variant="outline" size="sm" onClick={() => handleApplyTemplate('VIEW_ALL')} className="h-7 text-xs">
                                                                            Uygula
                                                                        </Button>
                                                                    </div>
                                                                    {/* Saved Templates */}
                                                                    {templates.map((t: any) => (
                                                                        <div key={t.id} className="flex items-center justify-between px-3 py-2 hover:bg-slate-50 transition-colors">
                                                                            <span className="text-sm font-medium text-slate-800">{t.name}</span>
                                                                            <div className="flex items-center gap-1">
                                                                                <Button type="button" variant="outline" size="sm" onClick={() => handleApplyTemplate(t.id)} className="h-7 text-xs">
                                                                                    Uygula
                                                                                </Button>
                                                                                <Button type="button" variant="outline" size="sm" onClick={() => handleUpdateTemplate(t.id, t.name)} className="h-7 text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50">
                                                                                    <Pencil className="w-3 h-3" />
                                                                                </Button>
                                                                                <Button type="button" variant="ghost" size="sm" onClick={(e) => handleDeleteTemplate(e, t.id)} className="h-7 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 w-7 p-0">
                                                                                    <Trash2 className="w-3 h-3" />
                                                                                </Button>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                    {templates.length === 0 && (
                                                                        <div className="px-3 py-3 text-xs text-muted-foreground text-center">
                                                                            Henüz şablon kaydedilmemiş
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                {/* Save Template Section */}
                                                                <div className="px-3 py-2 border-t bg-slate-50">
                                                                    {isSaveTemplateOpen ? (
                                                                        <div className="flex items-center gap-2">
                                                                            <Input
                                                                                placeholder="Şablon Adı (Örn: Saha Ekibi)"
                                                                                value={newTemplateName}
                                                                                onChange={(e) => setNewTemplateName(e.target.value)}
                                                                                className="h-8 text-xs"
                                                                                autoFocus
                                                                            />
                                                                            <Button size="sm" onClick={handleSaveTemplate} className="h-8 text-xs whitespace-nowrap bg-emerald-600 hover:bg-emerald-700">Kaydet</Button>
                                                                            <Button size="sm" variant="ghost" onClick={() => setIsSaveTemplateOpen(false)} className="h-8 text-xs w-8 p-0"><XCircle className="w-4 h-4" /></Button>
                                                                        </div>
                                                                    ) : (
                                                                        <Button type="button" variant="outline" size="sm" onClick={() => setIsSaveTemplateOpen(true)} className="w-full h-8 text-xs text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-dashed">
                                                                            <Plus className="w-3 h-3 mr-1" /> Mevcut Yetkileri Şablon Olarak Kaydet
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex-1 overflow-y-auto">
                                                            <Table>
                                                                <TableHeader className="sticky top-0 bg-white shadow-sm z-10">
                                                                    <TableRow>
                                                                        <TableHead className="w-[45%]">Modül</TableHead>
                                                                        <TableHead className="text-center">
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={() => toggleColumn('VIEW')}
                                                                                className="font-bold flex items-center gap-1 mx-auto"
                                                                            >
                                                                                İzleme
                                                                            </Button>
                                                                        </TableHead>
                                                                        <TableHead className="text-center">
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={() => toggleColumn('CREATE')}
                                                                                className="font-bold flex items-center gap-1 mx-auto text-green-700 hover:text-green-800 hover:bg-green-50"
                                                                            >
                                                                                <Plus className="w-3 h-3" /> Veri Girişi
                                                                            </Button>
                                                                        </TableHead>
                                                                        <TableHead className="text-center">
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={() => toggleColumn('EDIT')}
                                                                                className="font-bold flex items-center gap-1 mx-auto text-orange-700 hover:text-orange-800 hover:bg-orange-50"
                                                                            >
                                                                                <Pencil className="w-3 h-3" /> Düzenle
                                                                            </Button>
                                                                        </TableHead>
                                                                        <TableHead className="text-center">
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={() => toggleColumn('EXPORT')}
                                                                                className="font-bold flex items-center gap-1 mx-auto text-purple-700 hover:text-purple-800 hover:bg-purple-50"
                                                                            >
                                                                                <FileDown className="w-3 h-3" /> İndirme
                                                                            </Button>
                                                                        </TableHead>
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    {MODULE_HIERARCHY.map(module => renderPermissionRow(module))}
                                                                </TableBody>
                                                            </Table>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <DialogFooter className="pt-4 mt-auto">
                                            <Button type="button" onClick={(e) => handleSaveUserSecure(e)} size="lg" className="w-full sm:w-auto">Kaydet</Button>
                                        </DialogFooter>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Ad Soyad</TableHead>
                                        <TableHead>Kullanıcı Adı</TableHead>
                                        <TableHead>Şifre</TableHead>
                                        {/* <TableHead>E-posta</TableHead> Removed per user request */}
                                        <TableHead>Yetki Türü</TableHead>
                                        <TableHead>Erişimler</TableHead>
                                        <TableHead className="text-right">İşlem</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {[...users].sort((a: any, b: any) => {
                                        if (a.status === 'INACTIVE' && b.status !== 'INACTIVE') return 1;
                                        if (a.status !== 'INACTIVE' && b.status === 'INACTIVE') return -1;
                                        return 0;
                                    }).map((u: any) => (
                                        <TableRow key={u.id} className={u.status === 'INACTIVE' ? 'opacity-50' : ''}>
                                            <TableCell className="font-medium">
                                                <div>{u.name}</div>
                                                <div className="text-xs text-slate-500">{u.email}</div>
                                            </TableCell>
                                            <TableCell>
                                                <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{u.username}</code>
                                            </TableCell>
                                            <TableCell>
                                                <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{u.password}</code>
                                            </TableCell>
                                            <TableCell>
                                                {u.role === 'ADMIN' ? (
                                                    <Badge className="bg-red-600">Admin</Badge>
                                                ) : (
                                                    <Badge variant="secondary">Kısıtlı</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1">
                                                    {u.role === 'ADMIN' ? (
                                                        <span className="text-xs text-slate-500">Tam Erişim</span>
                                                    ) : (
                                                        Object.keys(u.permissions || {}).length > 0 ? (
                                                            <div className="flex gap-2">
                                                                {Object.values(u.permissions || {}).filter((permArray: any) => permArray.includes('EDIT')).length > 0 && (
                                                                    <Badge variant="default" className="text-[10px] bg-green-600 hover:bg-green-700">
                                                                        {Object.values(u.permissions || {}).filter((permArray: any) => permArray.includes('EDIT')).length} Düzenleme
                                                                    </Badge>
                                                                )}
                                                                {Object.values(u.permissions || {}).filter((permArray: any) => permArray.includes('VIEW')).length > 0 && (
                                                                    <Badge variant="secondary" className="text-[10px]">
                                                                        {Object.values(u.permissions || {}).filter((permArray: any) => permArray.includes('VIEW')).length} İzleme
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        ) : <span className="text-xs text-slate-400">Yetki Yok</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Label htmlFor={`user-status-${u.id}`} className="text-xs font-normal text-muted-foreground">
                                                        {u.status === 'INACTIVE' ? 'Pasif' : 'Aktif'}
                                                    </Label>
                                                    <Switch
                                                        id={`user-status-${u.id}`}
                                                        checked={u.status !== 'INACTIVE'}
                                                        onCheckedChange={(checked: boolean) => {
                                                            updateUser(u.id, { status: checked ? 'ACTIVE' : 'INACTIVE' })
                                                        }}
                                                    />
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => openEditUserModal(u)}
                                                    >
                                                        Düzenle
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                        onClick={() => handleDeleteUser(u)}
                                                        title="Kullanıcıyı Sil"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* YI-UFE TAB */}
                <TabsContent value="yiufe" className="space-y-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Yi-ÜFE Endeksleri</CardTitle>
                                <CardDescription>Otomatik olarak çekilen Yurt İçi Üretici Fiyat Endeksleri.</CardDescription>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={fetchYiUfeFromApi}
                                    disabled={updatingYiUfe}
                                >
                                    <RefreshCw className={cn("w-4 h-4 mr-2", updatingYiUfe && "animate-spin")} />
                                    {updatingYiUfe ? 'Güncelleniyor...' : 'Şimdi Güncelle'}
                                </Button>

                                <Dialog open={yiUfeModalOpen} onOpenChange={setYiUfeModalOpen}>
                                    <DialogTrigger asChild>
                                        <Button size="sm" variant="secondary">
                                            Manuel Ekle
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Yi-ÜFE Manuel Giriş</DialogTitle>
                                            <DialogDescription>
                                                Verileri el ile girmek için bu alanı kullanınız.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="py-4">
                                            <div className="space-y-4 py-4">
                                                <div className="border p-4 rounded-md bg-slate-50">
                                                    <h4 className="font-semibold mb-2 text-sm">Seçenek 1: Otomatik Çek (Hakediş.org)</h4>
                                                    <Button onClick={fetchYiUfeFromApi} disabled={updatingYiUfe} variant="secondary" className="w-full">
                                                        {updatingYiUfe ? 'Çekiliyor...' : 'Otomatik Veri Çek'}
                                                    </Button>
                                                    <p className="text-[10px] text-muted-foreground mt-2">
                                                        * TÜİK erişim kısıtlamaları nedeniyle veri kaynağı olarak Hakediş.org kullanılmaktadır.
                                                    </p>
                                                </div>

                                                <div className="relative">
                                                    <div className="absolute inset-0 flex items-center">
                                                        <span className="w-full border-t" />
                                                    </div>
                                                    <div className="relative flex justify-center text-xs uppercase">
                                                        <span className="bg-background px-2 text-muted-foreground">Veya Manuel Gir</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <form onSubmit={handleSaveManualYiUfe} className="space-y-3">
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="space-y-1">
                                                        <Label>Yıl</Label>
                                                        <Input
                                                            type="number"
                                                            value={manualYear}
                                                            onChange={e => setManualYear(parseInt(e.target.value))}
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label>Ay</Label>
                                                        <select
                                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                            value={manualMonth}
                                                            onChange={e => setManualMonth(parseInt(e.target.value))}
                                                        >
                                                            {Array.from({ length: 12 }, (_, i) => (
                                                                <option key={i} value={i}>{new Date(0, i).toLocaleString('tr-TR', { month: 'long' })}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <Label>Endeks Değeri (Örn: 3560.12)</Label>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        value={manualRate}
                                                        onChange={e => setManualRate(e.target.value)}
                                                        required
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                                <Button type="submit" className="w-full">Kaydet</Button>
                                            </form>
                                        </div>
                                    </DialogContent>
                                </Dialog>
                                <div className="mt-1 text-[10px] text-muted-foreground text-right w-full">
                                    {(() => {
                                        const sorted = [...yiUfeRates].sort((a, b) => {
                                            if (a.year !== b.year) return b.year - a.year;
                                            return b.month - a.month;
                                        });
                                        const latest = sorted[0];
                                        if (latest) {
                                            return `Son Açıklanan Yi-ÜFE: ${latest.index} (${latest.month}/${latest.year})`;
                                        }
                                        return null;
                                    })()}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="border rounded-md overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[100px]">Yıl</TableHead>
                                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                                <TableHead key={m} className="text-center">{m}. Ay</TableHead>
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {yiUfeRates.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={13} className="text-center h-24 text-muted-foreground">
                                                    Henüz veri yok. "Verileri Güncelle" butonuna basınız.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                        {Array.from(new Set(yiUfeRates.map((r: any) => r.year)))
                                            .sort((a: any, b: any) => b - a)
                                            .map((year: any) => (
                                                <TableRow key={year}>
                                                    <TableCell className="font-bold">{year}</TableCell>
                                                    {Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
                                                        const rate = yiUfeRates.find((r: any) => r.year === year && r.month === month);
                                                        return (
                                                            <TableCell key={month} className="text-center text-xs">
                                                                {rate ? rate.index.toFixed(2) : '-'}
                                                            </TableCell>
                                                        );
                                                    })}
                                                </TableRow>
                                            ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* COMPANY MANAGEMENT TAB */}
                <TabsContent value="companies" className="space-y-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Firma Listesi</CardTitle>
                                <CardDescription>Sistemde tanımlı firmalar.</CardDescription>
                            </div>
                            <Dialog open={companyModalOpen} onOpenChange={setCompanyModalOpen}>
                                <DialogTrigger asChild>
                                    <Button onClick={openAddCompanyModal}>
                                        <Plus className="w-4 h-4 mr-2" /> Firma Ekle
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>{isEditingCompany ? 'Firma Düzenle' : 'Yeni Firma Ekle'}</DialogTitle>
                                    </DialogHeader>
                                    <form onSubmit={handleAddCompany} className="space-y-4">
                                        <Tabs defaultValue="general" className="w-full">
                                            <TabsList className="w-full grid grid-cols-2">
                                                <TabsTrigger value="general">Genel Bilgiler</TabsTrigger>
                                                <TabsTrigger value="smtp">SMTP Ayarları</TabsTrigger>
                                            </TabsList>
                                            <TabsContent value="general" className="space-y-4 pt-4">
                                                <div className="space-y-2">
                                                    <Label>Firma Adı <span className="text-red-500">*</span></Label>
                                                    <Input value={companyName} onChange={e => setCompanyName(e.target.value)} required />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Firma Kısa Adı <span className="text-red-500">*</span></Label>
                                                    <Input
                                                        value={companyShortName}
                                                        onChange={e => setCompanyShortName(e.target.value)}
                                                        placeholder="Örn: KAD-TEM"
                                                        required
                                                    />
                                                    <p className="text-[10px] text-muted-foreground">
                                                        Rapor ve formlarda kullanılır.
                                                    </p>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Vergi Numarası</Label>
                                                    <Input value={companyTaxNumber} onChange={e => setCompanyTaxNumber(e.target.value)} placeholder="0123456789" />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Telefon</Label>
                                                    <Input value={companyPhone} onChange={e => setCompanyPhone(e.target.value)} placeholder="0555 555 55 55" />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Adres</Label>
                                                    <Input value={companyAddress} onChange={e => setCompanyAddress(e.target.value)} placeholder="Adres satırı..." />
                                                </div>

                                                <div className="space-y-2">
                                                    <Label>Kayıt No Sayacı (Sıradaki Numara)</Label>
                                                    <Input 
                                                        type="number" 
                                                        value={companyDocumentNumber} 
                                                        onChange={e => setCompanyDocumentNumber(e.target.value)} 
                                                        placeholder="1" 
                                                    />
                                                    <p className="text-[10px] text-muted-foreground">
                                                        Giden evrak referans numarasının sonuna eklenecek sıradaki numara.
                                                    </p>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label>Firma Kaşesi</Label>
                                                        <div className="flex flex-col gap-2">
                                                            <Input
                                                                type="file"
                                                                accept="image/*"
                                                                onChange={(e) => handleCompanyFileUpload(e, 'stamp')}
                                                                className="cursor-pointer"
                                                            />
                                                            {companyStamp && (
                                                                <div className="relative border p-1 rounded bg-slate-50 w-full h-20 flex items-center justify-center">
                                                                    <img src={companyStamp} alt="Kaşe" className="max-h-full max-w-full object-contain" />
                                                                    <Button
                                                                        type="button"
                                                                        variant="destructive"
                                                                        size="icon"
                                                                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full"
                                                                        onClick={() => setCompanyStamp(null)}
                                                                    >
                                                                        <Trash2 className="w-3 h-3" />
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Firma Anteti</Label>
                                                        <div className="flex flex-col gap-2">
                                                            <Input
                                                                type="file"
                                                                accept="image/*"
                                                                onChange={(e) => handleCompanyFileUpload(e, 'letterhead')}
                                                                className="cursor-pointer"
                                                            />
                                                            {companyLetterhead && (
                                                                <div className="relative border p-1 rounded bg-slate-50 w-full h-20 flex items-center justify-center">
                                                                    <img src={companyLetterhead} alt="Antet" className="max-h-full max-w-full object-contain" />
                                                                    <Button
                                                                        type="button"
                                                                        variant="destructive"
                                                                        size="icon"
                                                                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full"
                                                                        onClick={() => setCompanyLetterhead(null)}
                                                                    >
                                                                        <Trash2 className="w-3 h-3" />
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </TabsContent>

                                            <TabsContent value="smtp" className="space-y-4 pt-4">
                                                <div className="space-y-4">
                                                    <h4 className="font-medium flex items-center gap-2 text-sm text-slate-700">
                                                        <Mail className="w-4 h-4" /> SMTP Mail Ayarları
                                                    </h4>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div className="space-y-1">
                                                            <Label className="text-xs">SMTP Host</Label>
                                                            <Input className="h-8" value={companySmtpHost} onChange={e => setCompanySmtpHost(e.target.value)} placeholder="mail.ornek.com" />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-xs">SMTP Port</Label>
                                                            <Input className="h-8" value={companySmtpPort} onChange={e => setCompanySmtpPort(e.target.value)} placeholder="587" />
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div className="space-y-1">
                                                            <Label className="text-xs">Kullanıcı (User)</Label>
                                                            <Input className="h-8" value={companySmtpUser} onChange={e => setCompanySmtpUser(e.target.value)} placeholder="info@ornek.com" />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-xs">Şifre</Label>
                                                            <Input className="h-8" type="password" value={companySmtpPass} onChange={e => setCompanySmtpPass(e.target.value)} placeholder="****" />
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div className="space-y-1">
                                                            <Label className="text-xs">Gönderen Adı</Label>
                                                            <Input className="h-8" value={companySmtpFromName} onChange={e => setCompanySmtpFromName(e.target.value)} placeholder="Firma Adı" />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-xs">Gönderen Email</Label>
                                                            <Input className="h-8" value={companySmtpFromEmail} onChange={e => setCompanySmtpFromEmail(e.target.value)} placeholder="info@ornek.com" />
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                        <Checkbox
                                                            id="smtp-secure"
                                                            checked={companySmtpSecure}
                                                            onCheckedChange={(c) => setCompanySmtpSecure(!!c)}
                                                        />
                                                        <Label htmlFor="smtp-secure" className="text-xs font-normal">Güvenli Bağlantı (SSL/TLS)</Label>
                                                    </div>
                                                </div>
                                            </TabsContent>


                                        </Tabs>
                                        <DialogFooter>
                                            <Button type="submit">Kaydet</Button>
                                        </DialogFooter>
                                    </form>
                                </DialogContent>
                            </Dialog>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Firma Adı</TableHead>
                                        <TableHead>Vergi No</TableHead>
                                        <TableHead>Telefon</TableHead>
                                        <TableHead>Adres</TableHead>
                                        <TableHead className="text-right">Durum</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {companies.map((c: any) => (
                                        <TableRow key={c.id}>
                                            <TableCell className="font-medium">{c.name}</TableCell>
                                            <TableCell className="text-muted-foreground">{c.taxNumber || '-'}</TableCell>
                                            <TableCell className="text-muted-foreground">{c.phone || '-'}</TableCell>
                                            <TableCell className="text-muted-foreground truncate max-w-[200px]" title={c.address}>{c.address || '-'}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Label htmlFor={`company-status-${c.id}`} className="text-xs font-normal text-muted-foreground">
                                                        {c.status === 'INACTIVE' ? 'Pasif' : 'Aktif'}
                                                    </Label>
                                                    <Switch
                                                        id={`company-status-${c.id}`}
                                                        checked={c.status !== 'INACTIVE'}
                                                        onCheckedChange={(checked: boolean) => {
                                                            updateCompany(c.id, { status: checked ? 'ACTIVE' : 'INACTIVE' });
                                                        }}
                                                    />
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => openEditCompanyModal(c)}
                                                    >
                                                        Düzenle
                                                    </Button>
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={() => handleDeleteCompany(c.id, c.name)}
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* SITE MANAGEMENT TAB (Construction Works List) */}
                <TabsContent value="sites" className="space-y-4">
                    <Card className="border-0 shadow-none">
                        <CardHeader className="flex flex-row items-center justify-between px-0 pt-0">
                            <div>
                                <CardTitle>İş Deneyim Belgeleri / Devam Eden İşler</CardTitle>
                                <CardDescription>Şantiyelerin detaylı listesi ve durum takibi.</CardDescription>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => {
                                    // Template Download Logic
                                    // Template Download Logic
                                    // Template Download Logic
                                    const headers = [
                                        'Yüklenici Firma *', // System requirement
                                        'İş Grubu',
                                        'S.No',
                                        'Ekap Belge No',
                                        'İşin Adı',
                                        'İhale Kayıt Numarası',
                                        'İlan tarihi',
                                        'İhale tarihi',
                                        'Sözleşme tarihi',
                                        'İşyeri Teslim tarihi',
                                        'Sözleşme Ayı Yi-Üfe Katsayısı',
                                        'Güncel Fiyat Farkı Katsayısı',
                                        'Sözleşme Bedeli Kdv ve F.F. Hariç',
                                        'F.F. Dahil Kalan Tutar (Kdv Hariç)',
                                        'Sözleşme Fiyatıyla Gerçekleşen tutar Kdv ve F.F. Hariç',
                                        'Geçici Kabul',
                                        'Kesin Kabul',
                                        'İş Deneyim Belgesi',
                                        'Durum',
                                        'Ortaklık Oranı',
                                        'Sözleşme Ufe / Güncel Ufe',
                                        'Güncel İş Deneyim tutarı',
                                        'Fiyat Farkı'
                                    ];
                                    const ws = XLSX.utils.aoa_to_sheet([headers]);

                                    // Add Data Validation / Information as comment or second sheet? 
                                    // Simpler: Just basic headers.

                                    const wb = XLSX.utils.book_new();
                                    XLSX.utils.book_append_sheet(wb, ws, "Şablon");
                                    XLSX.writeFile(wb, "Santiye_Yukleme_Sablonu.xlsx");
                                }}>
                                    <FileDown className="w-4 h-4 mr-2" /> Şablon İndir
                                </Button>
                                <Button variant="outline" onClick={handleExportExcel} className="hidden sm:flex">
                                    <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" /> Excel Listesi
                                </Button>
                                <Button variant="outline" onClick={handleExportPDF} className="hidden sm:flex">
                                    <FileDown className="w-4 h-4 mr-2 text-red-600" /> PDF Listesi
                                </Button>
                                <div className="relative">
                                    <input
                                        type="file"
                                        accept=".xlsx, .xls"
                                        className="hidden"
                                        id="site-excel-upload"
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;

                                            const reader = new FileReader();
                                            reader.onload = async (event) => {
                                                const data = new Uint8Array(event.target?.result as ArrayBuffer);
                                                const workbook = XLSX.read(data, { type: 'array' });
                                                const sheetName = workbook.SheetNames[0];
                                                const worksheet = workbook.Sheets[sheetName];
                                                const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

                                                if (jsonData.length === 0) {
                                                    alert('Excel dosyasında veri bulunamadı.');
                                                    e.target.value = '';
                                                    return;
                                                }

                                                if (companies.length === 0) {
                                                    alert('Sistemde kayıtlı firma bulunamadı. Lütfen önce "Firma Yönetimi" sekmesinden firma ekleyiniz.');
                                                    e.target.value = '';
                                                    return;
                                                }

                                                let successCount = 0;
                                                let failCount = 0;
                                                let errors: string[] = [];

                                                // Helper to parse dates strictly as Date objects
                                                const parseDate = (val: any): Date | undefined => {
                                                    if (!val) return undefined;
                                                    // Excel serial date? 
                                                    if (typeof val === 'number') {
                                                        // XLSX handles basic serials often if passed correctly, but raw JSON might be serial
                                                        // (val - 25569) * 86400 * 1000
                                                        return new Date(Math.round((val - 25569) * 86400 * 1000));
                                                    }
                                                    // String DD.MM.YYYY
                                                    if (typeof val === 'string' && val.includes('.')) {
                                                        const parts = val.split('.');
                                                        if (parts.length === 3) {
                                                            return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                                                        }
                                                    }
                                                    // Standard date string
                                                    const d = new Date(val);
                                                    return !isNaN(d.getTime()) ? d : undefined;
                                                };

                                                // Helper to get value case-insensitive/trimmed from row
                                                const getVal = (row: any, keys: string[]) => {
                                                    for (const k of keys) {
                                                        if (row[k] !== undefined) return row[k];
                                                        const trimmedKey = Object.keys(row).find(rk => rk.trim() === k);
                                                        if (trimmedKey) return row[trimmedKey];
                                                    }
                                                    return undefined;
                                                };

                                                // Helper to parse numbers robustly
                                                const parseNumber = (val: any) => {
                                                    if (val === undefined || val === null || val === '') return undefined;
                                                    if (typeof val === 'number') return isNaN(val) ? undefined : val;

                                                    // Handle string numbers (e.g., "1.234,56" or "1000")
                                                    let s = val.toString().trim();
                                                    // Remove thousands separators if present (e.g. 1.000 for 1000 in TR, but wait, Excel raw usually doesn't have formatting)
                                                    // If we assume standard JS float "1000.50" it's fine.
                                                    // If we encounter Turkish comma "1000,50", replace comma with dot
                                                    if (s.includes(',') && !s.includes('.')) {
                                                        s = s.replace(',', '.');
                                                    }

                                                    const num = Number(s);
                                                    return isNaN(num) ? undefined : num;
                                                };

                                                for (const [index, row] of jsonData.entries()) {
                                                    try {
                                                        // Flexible key matching
                                                        const name = getVal(row, ['İşin Adı', 'İşin Adı *']);
                                                        const companyName = getVal(row, ['Yüklenici Firma *', 'Yüklenici Firma', 'Firma']);

                                                        const location = 'Belirtilmedi';
                                                        const workGroup = getVal(row, ['İş Grubu', 'İş Grubu *']) || '';
                                                        const projectNo = getVal(row, ['Ekap Belge No', 'Ekap Belge No *', 'EKAP Belge No']) || '';
                                                        const registrationNo = getVal(row, ['İhale Kayıt Numarası', 'İhale Kayıt No', 'İhale Kayıt No *']) || '';

                                                        if (!name || !companyName) {
                                                            failCount++;
                                                            errors.push(`Satır ${index + 2}: İş adı veya Firma eksik.`);
                                                            continue;
                                                        }

                                                        // Find Company
                                                        const company = companies.find((c: any) =>
                                                            c.name.trim().toLowerCase() === companyName.toString().trim().toLowerCase()
                                                        );

                                                        if (!company) {
                                                            failCount++;
                                                            errors.push(`Satır ${index + 2}: Firma sistemde bulunamadı: "${companyName}".`);
                                                            continue;
                                                        }

                                                        const result = await createSite({
                                                            status: 'ACTIVE',
                                                            name: name.toString(),
                                                            companyId: company.id,
                                                            location: location.toString(),
                                                            workGroup: workGroup.toString(),
                                                            projectNo: projectNo.toString(),
                                                            registrationNo: registrationNo.toString(),

                                                            // Dates
                                                            announcementDate: parseDate(getVal(row, ['İlan tarihi', 'İlan Tarihi'])),
                                                            tenderDate: parseDate(getVal(row, ['İhale tarihi', 'İhale Tarihi'])),
                                                            contractDate: parseDate(getVal(row, ['Sözleşme tarihi', 'Sözleşme Tarihi'])),
                                                            siteDeliveryDate: parseDate(getVal(row, ['İşyeri Teslim tarihi', 'İşyeri Teslim Tarihi'])),
                                                            completionDate: parseDate(getVal(row, ['İş Bitiş Tarihi'])),
                                                            extendedDate: parseDate(getVal(row, ['Süre Uzatımlı Tarih'])),
                                                            provisionalAcceptanceDate: parseDate(getVal(row, ['Geçici Kabul', 'Geçici Kabul Tarihi'])),
                                                            finalAcceptanceDate: parseDate(getVal(row, ['Kesin Kabul', 'Kesin Kabul Tarihi'])),
                                                            // currentUfeDate: parseDate(getVal(row, ['Güncel Ufe Tarihi'])),

                                                            // Financial
                                                            contractYiUfe: parseNumber(getVal(row, ['Sözleşme Ayı Yi-Üfe Katsayısı'])),
                                                            priceDifferenceCoefficient: parseNumber(getVal(row, ['Güncel Fiyat Farkı Katsayısı'])),
                                                            contractPrice: parseNumber(getVal(row, ['Sözleşme Bedeli Kdv ve F.F. Hariç'])),
                                                            kdv: parseNumber(getVal(row, ['KDV Oranı'])) || 20,
                                                            // remainingAmount: parseNumber(getVal(row, ['F.F. Dahil Kalan Tutar (Kdv Hariç)'])),
                                                            realizedAmount: parseNumber(getVal(row, ['Sözleşme Fiyatıyla Gerçekleşen tutar Kdv ve F.F. Hariç'])),
                                                            // currentWorkExperienceAmount: parseNumber(getVal(row, ['Güncel İş Deneyim tutarı'])),
                                                            priceDifference: parseNumber(getVal(row, ['Fiyat Farkı'])),

                                                            // Details
                                                            workExperienceCertificate: getVal(row, ['İş Deneyim Belgesi']) ? getVal(row, ['İş Deneyim Belgesi']).toString() : '',
                                                            statusDetail: getVal(row, ['Durum']) ? getVal(row, ['Durum']).toString() : '',
                                                            partnershipPercentage: parseNumber(getVal(row, ['Ortaklık Oranı'])) || 100,
                                                            // completionPercentage: parseNumber(getVal(row, ['Fiziki Gerçekleşme (%)'])) || 0,
                                                            personnelCount: parseNumber(getVal(row, ['Ort. Çalıştırılan Personel'])) || 0,
                                                            note: getVal(row, ['Notlar']) ? getVal(row, ['Notlar']).toString() : ''
                                                        });

                                                        if (!result.success) {
                                                            throw new Error(result.error);
                                                        }
                                                        successCount++;
                                                    } catch (err: any) {
                                                        failCount++;
                                                        errors.push(`Satır ${index + 2}: ${err.message || 'İşlem hatası'}`);
                                                    }
                                                }

                                                if (successCount === 0 && failCount === 0) {
                                                    alert('İşlem yapılamadı.');
                                                } else {
                                                    alert(`İşlem Tamamlandı.\nBaşarılı: ${successCount}\nHatalı: ${failCount}\n\n${errors.slice(0, 15).join('\n')}${errors.length > 15 ? '\n...' : ''}`);
                                                }
                                                e.target.value = ''; // Reset input
                                                if (successCount > 0) window.location.reload();
                                            };
                                            reader.readAsArrayBuffer(file);
                                        }
                                        }
                                    />
                                    <Button variant="outline" onClick={() => document.getElementById('site-excel-upload')?.click()} className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200">
                                        <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel Yükle
                                    </Button>
                                    <Button variant="outline" onClick={() => {
                                        if (confirm('Tüm işlerin "F.F. Dahil Kalan Tutar" verilerini formüle göre hesaplayıp güncellemek istiyor musunuz?')) {
                                            const sortedRates = [...yiUfeRates].sort((a, b) => {
                                                if (a.year !== b.year) return b.year - a.year;
                                                return b.month - a.month;
                                            });
                                            const latestUfe = sortedRates[0]?.index;

                                            sites.forEach((s: any) => {
                                                const contractPrice = s.contractPrice || 0;
                                                const realizedAmount = s.realizedAmount || 0;
                                                const base = contractPrice - realizedAmount;

                                                let contractUfe = s.contractYiUfe;
                                                if (s.tenderDate) {
                                                    const tDate = new Date(s.tenderDate);
                                                    tDate.setMonth(tDate.getMonth() - 1);
                                                    const foundRate = yiUfeRates.find((r: any) => r.year === tDate.getFullYear() && r.month === tDate.getMonth() + 1);
                                                    if (foundRate) contractUfe = foundRate.index;
                                                }

                                                let result = base > 0 ? base : 0; // Default fallback

                                                if (contractUfe && contractUfe > 0 && latestUfe) {
                                                    const ratio = latestUfe / contractUfe;
                                                    const priceDifference = ratio - 1;
                                                    // Formula: ((Contract - Realized) * PriceDiff) + (Contract - Realized)
                                                    // = (Base * PD) + Base
                                                    result = (base * priceDifference) + base;
                                                }

                                                // User Rule: If result is negative (Realized > Contract), show ContractPrice
                                                if (result < 0) {
                                                    result = contractPrice;
                                                }

                                                updateSite(s.id, { remainingAmount: result });
                                            });
                                            alert('Mali veriler güncellendi.');
                                        }
                                    }} className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200">
                                        <RefreshCw className="w-4 h-4 mr-2" /> Mali Verileri Güncelle
                                    </Button>
                                </div>
                                <div className="flex flex-col items-end">
                                    <Dialog open={siteModalOpen} onOpenChange={setSiteModalOpen}>
                                        <DialogTrigger asChild>
                                            <Button onClick={openAddSiteModal}>
                                                <Plus className="w-4 h-4 mr-2" /> Yeni İş Ekle
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-full">
                                            <DialogHeader>
                                                <DialogTitle>{isEditingSite ? 'İş Bilgilerini Düzenle' : 'Yeni İş Ekle'}</DialogTitle>
                                            </DialogHeader>
                                            <form onSubmit={handleAddSite} className="space-y-6">
                                                <Tabs defaultValue="general" className="w-full">
                                                    <TabsList className="w-full grid grid-cols-4">
                                                        <TabsTrigger value="general">Genel Bilgiler</TabsTrigger>
                                                        <TabsTrigger value="financial">Sözleşme ve Mali</TabsTrigger>
                                                        <TabsTrigger value="acceptance">Kabul</TabsTrigger>
                                                        <TabsTrigger value="tanks">Depo / Tank</TabsTrigger>
                                                    </TabsList>

                                                    {/* General Info Tab */}
                                                    <TabsContent value="general" className="space-y-4 pt-4">
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div className="space-y-2 col-span-2">
                                                                <div className="flex items-center justify-between">
                                                                    <Label>İşin Adı <span className="text-red-500">*</span></Label>
                                                                    <div className="flex items-center space-x-2">
                                                                        <Checkbox
                                                                            id="isWarehouse"
                                                                            checked={newSiteData.isWarehouse || false}
                                                                            onCheckedChange={(checked: boolean) => setNewSiteData({ ...newSiteData, isWarehouse: checked })}
                                                                        />
                                                                        <label htmlFor="isWarehouse" className="text-sm font-medium leading-none cursor-pointer text-slate-600">
                                                                            Şantiye Depo / Merkez Statüsünde
                                                                        </label>
                                                                    </div>
                                                                </div>
                                                                <Input
                                                                    value={newSiteData.name || ''}
                                                                    onChange={e => setNewSiteData({ ...newSiteData, name: e.target.value })}
                                                                    required
                                                                />
                                                            </div>
                                                            <div className="space-y-4 col-span-2 border p-4 rounded-md">
                                                                <div className="flex gap-4 items-end">
                                                                    <div className="space-y-2 flex-1">
                                                                        <Label>Yüklenici Firma (Pilot) <span className="text-red-500">*</span></Label>
                                                                        <select
                                                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                                                                            value={newSiteData.companyId || ''}
                                                                            onChange={e => setNewSiteData({ ...newSiteData, companyId: e.target.value })}
                                                                            required
                                                                        >
                                                                            <option value="" disabled>Seçiniz</option>
                                                                            {companies.map((c: any) => (
                                                                                <option key={c.id} value={c.id}>{c.name}</option>
                                                                            ))}
                                                                        </select>
                                                                    </div>
                                                                    <div className="space-y-2 w-32">
                                                                        <Label>Pilot Oran %</Label>
                                                                        <Input
                                                                            type="number"
                                                                            value={newSiteData.partnershipPercentage || ''}
                                                                            onChange={e => setNewSiteData({ ...newSiteData, partnershipPercentage: e.target.value ? Number(e.target.value) : undefined })}
                                                                            placeholder="100"
                                                                        />
                                                                    </div>
                                                                    <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        className="mb-0.5"
                                                                        onClick={() => {
                                                                            const currentPartners = newSiteData.partners || [];
                                                                            setNewSiteData({ ...newSiteData, partners: [...currentPartners, { id: crypto.randomUUID(), siteId: '', companyId: '', percentage: 0 }] });
                                                                        }}
                                                                        title="Ortak Ekle"
                                                                    >
                                                                        <Plus className="w-4 h-4 mr-1" /> Ortak Ekle
                                                                    </Button>
                                                                </div>

                                                                {/* Partners List */}
                                                                {newSiteData.partners?.map((partner, index) => (
                                                                    <div key={partner.id || index} className="flex gap-4 items-end bg-muted/20 p-2 rounded-md border border-dashed mt-2">
                                                                        <div className="w-6 flex items-center justify-center font-bold text-muted-foreground text-sm">{index + 1}.</div>
                                                                        <div className="space-y-2 flex-1">
                                                                            <Label>Özel Ortak</Label>
                                                                            <select
                                                                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                                                                                value={partner.companyId}
                                                                                onChange={e => {
                                                                                    const newPartners = [...(newSiteData.partners || [])];
                                                                                    newPartners[index] = { ...newPartners[index], companyId: e.target.value };
                                                                                    setNewSiteData({ ...newSiteData, partners: newPartners });
                                                                                }}
                                                                            >
                                                                                <option value="" disabled>Seçiniz</option>
                                                                                {companies.map((c: any) => (
                                                                                    <option key={c.id} value={c.id}>{c.name}</option>
                                                                                ))}
                                                                            </select>
                                                                        </div>
                                                                        <div className="space-y-2 w-32">
                                                                            <Label>Oran %</Label>
                                                                            <Input
                                                                                type="number"
                                                                                value={partner.percentage || ''}
                                                                                onChange={e => {
                                                                                    const newPartners = [...(newSiteData.partners || [])];
                                                                                    newPartners[index] = { ...newPartners[index], percentage: Number(e.target.value) };
                                                                                    setNewSiteData({ ...newSiteData, partners: newPartners });
                                                                                }}
                                                                            />
                                                                        </div>
                                                                        <Button
                                                                            type="button"
                                                                            variant="destructive"
                                                                            size="icon"
                                                                            onClick={() => {
                                                                                const newPartners = newSiteData.partners?.filter((_, i) => i !== index);
                                                                                setNewSiteData({ ...newSiteData, partners: newPartners });
                                                                            }}
                                                                        >
                                                                            <Trash2 className="w-4 h-4" />
                                                                        </Button>
                                                                    </div>
                                                                ))}
                                                            </div>

                                                            <div className="space-y-2">
                                                                <Label>İş Grubu <span className="text-red-500">*</span></Label>
                                                                <Select
                                                                    value={newSiteData.workGroup || ''}
                                                                    onValueChange={value => setNewSiteData({ ...newSiteData, workGroup: value.toUpperCase() })}
                                                                    required
                                                                >
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder="Seçiniz" />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="ALTYAPI">ALTYAPI</SelectItem>
                                                                        <SelectItem value="DRENAJ">DRENAJ</SelectItem>
                                                                        <SelectItem value="GÖLET">GÖLET</SelectItem>
                                                                        <SelectItem value="HARİTA">HARİTA</SelectItem>
                                                                        <SelectItem value="RESTORASYON">RESTORASYON</SelectItem>
                                                                        <SelectItem value="SERA">SERA</SelectItem>
                                                                        <SelectItem value="SULAMA">SULAMA</SelectItem>
                                                                        <SelectItem value="TAŞKIN KORUMA">TAŞKIN KORUMA</SelectItem>
                                                                        <SelectItem value="TOPLULAŞTIRMA">TOPLULAŞTIRMA</SelectItem>
                                                                        <SelectItem value="ÜSTYAPI">ÜSTYAPI</SelectItem>
                                                                        <SelectItem value="DİĞER">DİĞER</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>

                                                            <div className="space-y-2">
                                                                <Label>İlan Tarihi</Label>
                                                                <Input type="date" value={newSiteData.announcementDate || ''} onChange={e => setNewSiteData({ ...newSiteData, announcementDate: e.target.value })} />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label>İhale Tarihi</Label>
                                                                <Input type="date" value={newSiteData.tenderDate || ''} onChange={e => setNewSiteData({ ...newSiteData, tenderDate: e.target.value })} />
                                                            </div>

                                                            <div className="space-y-2">
                                                                <Label>İhale Kayıt No</Label>
                                                                <Input
                                                                    value={newSiteData.registrationNo || ''}
                                                                    onChange={e => setNewSiteData({ ...newSiteData, registrationNo: e.target.value })}
                                                                />
                                                            </div>
                                                        </div>
                                                    </TabsContent>

                                                    <TabsContent value="financial" className="space-y-4 pt-4">
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div className="space-y-2">
                                                                <Label>Sözleşme Bedeli (KDV ve F.F. Hariç)</Label>
                                                                <Input
                                                                    type="text"
                                                                    inputMode="decimal"
                                                                    placeholder="0,00"
                                                                    value={newSiteData.contractPrice?.toString().replace('.', ',') || ''}
                                                                    onChange={e => {
                                                                        const val = e.target.value;
                                                                        if (/^[0-9]*[.,]?[0-9]*$/.test(val)) {
                                                                            const normalized = val.replace(',', '.');
                                                                            if (normalized === '' || normalized === '.') {
                                                                                setNewSiteData({ ...newSiteData, contractPrice: 0 });
                                                                            } else {
                                                                                const num = parseFloat(normalized);
                                                                                if (!isNaN(num)) {
                                                                                    setNewSiteData({ ...newSiteData, contractPrice: num });
                                                                                }
                                                                            }
                                                                        }
                                                                    }}
                                                                />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label>Sözleşme Tarihi</Label>
                                                                <Input type="date" value={newSiteData.contractDate || ''} onChange={e => setNewSiteData({ ...newSiteData, contractDate: e.target.value })} />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label>İşyeri Teslim Tarihi</Label>
                                                                <Input type="date" value={newSiteData.siteDeliveryDate || ''} onChange={e => setNewSiteData({ ...newSiteData, siteDeliveryDate: e.target.value })} />
                                                            </div>

                                                            <div className="space-y-2 col-span-2">
                                                                <Label>Notlar / Açıklama</Label>
                                                                <Input
                                                                    value={newSiteData.note || ''}
                                                                    onChange={e => setNewSiteData({ ...newSiteData, note: e.target.value })}
                                                                />
                                                            </div>
                                                        </div>
                                                    </TabsContent>

                                                    {/* Acceptance Tab */}
                                                    <TabsContent value="acceptance" className="space-y-4 pt-4">



                                                        {/* Row 1: Provisional Acceptance */}
                                                        <div className="grid grid-cols-2 gap-4 items-end">
                                                            <div className="space-y-2">
                                                                <Label>Geçici Kabul Tarihi</Label>
                                                                <Input type="date" value={newSiteData.provisionalAcceptanceDate || ''} onChange={e => setNewSiteData({ ...newSiteData, provisionalAcceptanceDate: e.target.value })} />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label>Geçici Kabul Tutanağı (PDF)</Label>
                                                                <div className="flex items-center gap-2">
                                                                    <Input
                                                                        type="file"
                                                                        accept=".pdf,image/*"
                                                                        className={newSiteData.provisionalAcceptanceDoc ? "text-transparent w-24" : ""}
                                                                        onChange={(e) => handleSiteFileUpload(e, 'provisional')}
                                                                    />
                                                                    {newSiteData.provisionalAcceptanceDoc && (
                                                                        <div className="flex items-center gap-2 flex-1">
                                                                            <span className="text-xs truncate max-w-[150px] font-medium text-green-700">Dosya Yüklü</span>
                                                                            <Button
                                                                                type="button"
                                                                                variant="outline"
                                                                                size="sm"
                                                                                className="h-8 w-8 p-0"
                                                                                onClick={() => {
                                                                                    const link = document.createElement('a');
                                                                                    link.href = newSiteData.provisionalAcceptanceDoc!;
                                                                                    link.download = 'gecici_kabul_belgesi';
                                                                                    link.click();
                                                                                }}
                                                                                title="İndir"
                                                                            >
                                                                                <FileDown className="h-4 w-4" />
                                                                            </Button>
                                                                            <Button
                                                                                type="button"
                                                                                variant="outline"
                                                                                size="sm"
                                                                                className="h-8 w-8 p-0"
                                                                                onClick={() => setPreviewDoc(newSiteData.provisionalAcceptanceDoc)}
                                                                                title="Görüntüle"
                                                                            >
                                                                                <Search className="h-4 w-4" />
                                                                            </Button>
                                                                            <Button
                                                                                type="button"
                                                                                variant="destructive"
                                                                                size="sm"
                                                                                className="h-8 w-8 p-0"
                                                                                onClick={() => setNewSiteData({ ...newSiteData, provisionalAcceptanceDoc: '' })}
                                                                                title="Kaldır"
                                                                            >
                                                                                <Trash2 className="h-4 w-4" />
                                                                            </Button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Row 2: Final Acceptance */}
                                                        <div className="grid grid-cols-2 gap-4 items-end">
                                                            <div className="space-y-2">
                                                                <Label>Kesin Kabul Tarihi</Label>
                                                                <Input type="date" value={newSiteData.finalAcceptanceDate || ''} onChange={e => setNewSiteData({ ...newSiteData, finalAcceptanceDate: e.target.value })} />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label>Kesin Kabul Tutanağı (PDF)</Label>
                                                                <div className="flex items-center gap-2">
                                                                    <Input
                                                                        type="file"
                                                                        accept=".pdf,image/*"
                                                                        className={newSiteData.finalAcceptanceDoc ? "text-transparent w-24" : ""}
                                                                        onChange={(e) => handleSiteFileUpload(e, 'final')}
                                                                    />
                                                                    {newSiteData.finalAcceptanceDoc && (
                                                                        <div className="flex items-center gap-2 flex-1">
                                                                            <span className="text-xs truncate max-w-[150px] font-medium text-green-700">Dosya Yüklü</span>
                                                                            <Button
                                                                                type="button"
                                                                                variant="outline"
                                                                                size="sm"
                                                                                className="h-8 w-8 p-0"
                                                                                onClick={() => {
                                                                                    const link = document.createElement('a');
                                                                                    link.href = newSiteData.finalAcceptanceDoc!;
                                                                                    link.download = 'kesin_kabul_belgesi';
                                                                                    link.click();
                                                                                }}
                                                                                title="İndir"
                                                                            >
                                                                                <FileDown className="h-4 w-4" />
                                                                            </Button>
                                                                            <Button
                                                                                type="button"
                                                                                variant="outline"
                                                                                size="sm"
                                                                                className="h-8 w-8 p-0"
                                                                                onClick={() => setPreviewDoc(newSiteData.finalAcceptanceDoc)}
                                                                                title="Görüntüle"
                                                                            >
                                                                                <Search className="h-4 w-4" />
                                                                            </Button>
                                                                            <Button
                                                                                type="button"
                                                                                variant="destructive"
                                                                                size="sm"
                                                                                className="h-8 w-8 p-0"
                                                                                onClick={() => setNewSiteData({ ...newSiteData, finalAcceptanceDoc: '' })}
                                                                                title="Kaldır"
                                                                            >
                                                                                <Trash2 className="h-4 w-4" />
                                                                            </Button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Row 3: Work Experience */}
                                                        <div className="grid grid-cols-2 gap-4 items-end">
                                                            <div className="space-y-2">
                                                                <Label>EKAP Belge No</Label>
                                                                <Input
                                                                    value={newSiteData.workExperienceCertificate || ''}
                                                                    onChange={e => setNewSiteData({ ...newSiteData, workExperienceCertificate: e.target.value })}
                                                                    placeholder="Belge No"
                                                                />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label>İş Deneyim Belgesi (PDF)</Label>
                                                                <div className="flex items-center gap-2">
                                                                    <Input
                                                                        type="file"
                                                                        accept=".pdf,image/*"
                                                                        className={newSiteData.workExperienceDoc ? "text-transparent w-24" : ""}
                                                                        onChange={(e) => handleSiteFileUpload(e, 'experience')}
                                                                    />
                                                                    {newSiteData.workExperienceDoc && (
                                                                        <div className="flex items-center gap-2 flex-1">
                                                                            <span className="text-xs truncate max-w-[150px] font-medium text-green-700">Dosya Yüklü</span>
                                                                            <Button
                                                                                type="button"
                                                                                variant="outline"
                                                                                size="sm"
                                                                                className="h-8 w-8 p-0"
                                                                                onClick={() => {
                                                                                    const link = document.createElement('a');
                                                                                    link.href = newSiteData.workExperienceDoc!;
                                                                                    link.download = 'is_deneyim_belgesi';
                                                                                    link.click();
                                                                                }}
                                                                                title="İndir"
                                                                            >
                                                                                <FileDown className="h-4 w-4" />
                                                                            </Button>
                                                                            <Button
                                                                                type="button"
                                                                                variant="outline"
                                                                                size="sm"
                                                                                className="h-8 w-8 p-0"
                                                                                onClick={() => setPreviewDoc(newSiteData.workExperienceDoc)}
                                                                                title="Görüntüle"
                                                                            >
                                                                                <Search className="h-4 w-4" />
                                                                            </Button>
                                                                            <Button
                                                                                type="button"
                                                                                variant="destructive"
                                                                                size="sm"
                                                                                className="h-8 w-8 p-0"
                                                                                onClick={() => setNewSiteData({ ...newSiteData, workExperienceDoc: '' })}
                                                                                title="Kaldır"
                                                                            >
                                                                                <Trash2 className="h-4 w-4" />
                                                                            </Button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Benzer İş Grupları (Tebliğ) */}
                                                        <div className="space-y-4 border p-4 rounded-md bg-slate-50 mt-4">
                                                            <div className="flex items-center justify-between">
                                                                <h4 className="font-medium text-sm text-slate-700">Benzer İş Grupları (Tebliğ)</h4>
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => {
                                                                        const current = newSiteData.similarWorks || [];
                                                                        setNewSiteData({ ...newSiteData, similarWorks: [...current, { group: '', code: '', amount: 0 }] });
                                                                    }}
                                                                    className="h-7 text-xs"
                                                                >
                                                                    <Plus className="w-3 h-3 mr-1" /> Ekle
                                                                </Button>
                                                            </div>

                                                            {(newSiteData.similarWorks || []).length === 0 && (
                                                                <div className="text-xs text-slate-500 italic text-center py-2">Henüz grup eklenmedi.</div>
                                                            )}

                                                            {(newSiteData.similarWorks || []).map((work: any, idx: number) => (
                                                                <div key={idx} className="grid grid-cols-12 gap-2 items-end border-b pb-3 mb-2 last:border-0 last:mb-0 last:pb-0">
                                                                    <div className="col-span-5 space-y-1">
                                                                        <Label className="text-xs">Grup</Label>
                                                                        <Select
                                                                            value={work.group}
                                                                            onValueChange={val => {
                                                                                const updated = [...(newSiteData.similarWorks || [])];
                                                                                updated[idx].group = val;
                                                                                // Optional: We could store friendly name in another field if needed, but val contains the code now.
                                                                                setNewSiteData({ ...newSiteData, similarWorks: updated });
                                                                            }}
                                                                        >
                                                                            <SelectTrigger className="h-8 text-xs w-full">
                                                                                <SelectValue placeholder="Seçiniz" />
                                                                            </SelectTrigger>
                                                                            <SelectContent className="max-h-60">
                                                                                {SIMILAR_WORK_GROUPS.map((group) => (
                                                                                    <SelectGroup key={group.value}>
                                                                                        <SelectLabel className="sticky top-0 bg-white z-10 border-b">{group.label}</SelectLabel>
                                                                                        {group.options.map((opt) => {
                                                                                            const uniqueVal = `${group.value} - ${opt.value}`; // e.g. "A - II"
                                                                                            return (
                                                                                                <SelectItem key={`${group.value}-${opt.value}`} value={uniqueVal}>
                                                                                                    <span className="font-semibold text-primary">{group.value} - {opt.value}</span>
                                                                                                    <span className="text-muted-foreground mx-2">|</span>
                                                                                                    <span className="truncate">{opt.label.replace(opt.value + '. GRUP: ', '').replace(opt.value + ': ', '')}</span>
                                                                                                </SelectItem>
                                                                                            );
                                                                                        })}
                                                                                    </SelectGroup>
                                                                                ))}
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>

                                                                    <div className="col-span-3 space-y-1">
                                                                        <Label className="text-xs">Tutar</Label>
                                                                        <Input
                                                                            type="number"
                                                                            step="0.01"
                                                                            className="h-8 text-xs"
                                                                            value={work.amount || ''}
                                                                            placeholder="0.00"
                                                                            onChange={e => {
                                                                                const updated = [...(newSiteData.similarWorks || [])];
                                                                                updated[idx].amount = e.target.value ? Number(e.target.value) : undefined;
                                                                                setNewSiteData({ ...newSiteData, similarWorks: updated });
                                                                            }}
                                                                        />
                                                                    </div>
                                                                    <div className="col-span-1">
                                                                        <Button
                                                                            type="button"
                                                                            variant="destructive"
                                                                            size="icon"
                                                                            className="h-8 w-8"
                                                                            onClick={() => {
                                                                                const updated = [...(newSiteData.similarWorks || [])];
                                                                                updated.splice(idx, 1);
                                                                                setNewSiteData({ ...newSiteData, similarWorks: updated });
                                                                            }}
                                                                        >
                                                                            <Trash2 className="w-4 h-4" />
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>

                                                    </TabsContent>
                                                    <TabsContent value="tanks" className="space-y-4 pt-4">
                                                        {!isEditingSite || !selectedSiteId ? (
                                                            <div className="text-center py-8 text-slate-500 bg-slate-50 rounded border border-dashed">
                                                                Depo eklemek için önce şantiyeyi kaydediniz.
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-6">
                                                                {/* Add New Tank */}
                                                                <div className="grid grid-cols-4 gap-4 items-end bg-slate-50 p-4 rounded border">
                                                                    <div className="space-y-2 col-span-2">
                                                                        <Label>Depo Adı</Label>
                                                                        <Input
                                                                            value={newTankName}
                                                                            onChange={e => setNewTankName(e.target.value)}
                                                                            placeholder="Örn: Ana Depo"
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <Label>Kapasite (Lt)</Label>
                                                                        <Input
                                                                            type="number"
                                                                            value={newTankCapacity}
                                                                            onChange={e => setNewTankCapacity(e.target.value)}
                                                                            placeholder="0"
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <Button type="button" onClick={handleAddTank} className="w-full">
                                                                            <Plus className="w-4 h-4 mr-2" /> Ekle
                                                                        </Button>
                                                                    </div>
                                                                </div>

                                                                {/* Tank List */}
                                                                <div className="border rounded-md overflow-hidden">
                                                                    <Table>
                                                                        <TableHeader>
                                                                            <TableRow className="bg-slate-100">
                                                                                <TableHead>Depo Adı</TableHead>
                                                                                <TableHead>Kapasite</TableHead>
                                                                                <TableHead>Mevcut Stok</TableHead>
                                                                                <TableHead className="w-20"></TableHead>
                                                                            </TableRow>
                                                                        </TableHeader>
                                                                        <TableBody>
                                                                            {fuelTanks.filter(t => t.siteId === selectedSiteId).map(tank => (
                                                                                <TableRow key={tank.id}>
                                                                                    <TableCell className="font-medium">{tank.name}</TableCell>
                                                                                    <TableCell>{tank.capacity} Lt</TableCell>
                                                                                    <TableCell>{tank.currentLevel} Lt</TableCell>
                                                                                    <TableCell>
                                                                                        <Button
                                                                                            type="button"
                                                                                            variant="ghost"
                                                                                            size="sm"
                                                                                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                                            onClick={() => handleDeleteTank(tank.id)}
                                                                                        >
                                                                                            <Trash2 className="w-4 h-4" />
                                                                                        </Button>
                                                                                    </TableCell>
                                                                                </TableRow>
                                                                            ))}
                                                                            {fuelTanks.filter(t => t.siteId === selectedSiteId).length === 0 && (
                                                                                <TableRow>
                                                                                    <TableCell colSpan={4} className="text-center text-slate-500 py-4">
                                                                                        Henüz depo eklenmemiş.
                                                                                    </TableCell>
                                                                                </TableRow>
                                                                            )}
                                                                        </TableBody>
                                                                    </Table>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </TabsContent>
                                                </Tabs>

                                                <DialogFooter className="flex justify-between items-center sm:justify-between w-full">
                                                    {isEditingSite && (
                                                        <Button type="button" variant="destructive" onClick={handleDeleteSite}>
                                                            Sil
                                                        </Button>
                                                    )}
                                                    <div className="flex gap-2 ml-auto">
                                                        <Button type="submit" disabled={isSubmitting}>
                                                            {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
                                                        </Button>
                                                    </div>
                                                </DialogFooter>
                                            </form>
                                        </DialogContent>
                                    </Dialog>
                                    <div className="mt-1 text-[10px] text-muted-foreground text-right w-full">
                                        {(() => {
                                            const sorted = [...yiUfeRates].sort((a, b) => {
                                                if (a.year !== b.year) return b.year - a.year;
                                                return b.month - a.month;
                                            });
                                            const latest = sorted[0];
                                            if (latest) {
                                                return `Son Açıklanan Yi-ÜFE: ${latest.index} (${latest.month}/${latest.year})`;
                                            }
                                            return null;
                                        })()}
                                    </div>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="px-0 py-0">
                            <div className="border rounded-md overflow-auto max-h-[calc(100vh-370px)] w-full relative">
                                <table className="w-full caption-bottom text-sm relative">
                                    <TableHeader>
                                        <TableRow className="bg-slate-100">
                                            {siteColumns.map((col, idx) => (
                                                <TableHead
                                                    key={idx}
                                                    className={`sticky top-0 z-20 bg-slate-100 font-bold text-black border-r cursor-pointer hover:bg-slate-200 transition-colors select-none ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'}`}
                                                    style={{ width: col.width }}
                                                    onClick={(e) => col.key && handleSiteSort(col.key, e)}
                                                >
                                                    <div className="flex flex-col gap-1 py-2">
                                                        {col.key && (
                                                            <div onClick={e => e.stopPropagation()}>
                                                                <MultiSelect
                                                                    options={getUniqueValues(col.key, col.isDate, col.isCurrency).map((v: any) => ({ label: String(v), value: v }))}
                                                                    selected={siteFilters[col.key] || []}
                                                                    onChange={(val: string[]) => setSiteFilters(prev => ({ ...prev, [col.key!]: val }))}
                                                                    placeholder="Tümü"
                                                                    searchPlaceholder="Ara..."
                                                                    className="h-7 text-[10px]"
                                                                />
                                                            </div>
                                                        )}
                                                        <div className={`flex items-center gap-1 mt-1 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start'}`}>
                                                            <span className="text-[11px] leading-tight whitespace-normal">{col.label}</span>
                                                            {col.key && getSiteSortIcon(col.key)}
                                                        </div>
                                                    </div>
                                                </TableHead>
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {companies.map((company: any) => {
                                            // 1. Filter Sites
                                            const filteredCompanySites = sites.filter((s: any) => {
                                                const isPilot = s.companyId === company.id;
                                                const isPartner = s.partners?.some((p: any) => p.companyId === company.id);

                                                if (!isPilot && !isPartner) return false;
                                                return Object.entries(siteFilters).every(([key, values]) => {
                                                    if (!values || values.length === 0) return true; // No filter selected

                                                    const col = siteColumns.find((c: any) => c.key === key);
                                                    let itemVal = s[key as keyof Site];

                                                    let formattedVal = 'Boş';
                                                    if (itemVal || itemVal === 0) {
                                                        if (col?.isDate) formattedVal = format(new Date(itemVal as string), 'dd.MM.yyyy');
                                                        else if (col?.isCurrency) formattedVal = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(itemVal)) + ' ₺';
                                                        else formattedVal = String(itemVal);
                                                    }

                                                    return values.includes(formattedVal);
                                                });
                                            });

                                            if (filteredCompanySites.length === 0) return null;

                                            // 2. Sort Sites
                                            const sortedCompanySites = [...filteredCompanySites].sort((a, b) => {
                                                for (const sort of siteSortConfig) {
                                                    const col = siteColumns.find((c: any) => c.key === sort.key);
                                                    if (!col || !sort.key) continue;

                                                    const key = sort.key as keyof Site;
                                                    let valA = a[key];
                                                    let valB = b[key];

                                                    let comparison = 0;

                                                    // Handle Nulls/Undefined (Always put at bottom usually, or top? let's standard compare)
                                                    if (valA === valB) continue;
                                                    if (valA === undefined || valA === null) comparison = 1; // Nulls last
                                                    else if (valB === undefined || valB === null) comparison = -1;
                                                    else if (col.isDate) {
                                                        const dateA = new Date(valA as string).getTime();
                                                        const dateB = new Date(valB as string).getTime();
                                                        comparison = dateA - dateB;
                                                    } else if (typeof valA === 'number' && typeof valB === 'number') {
                                                        comparison = valA - valB;
                                                    } else {
                                                        comparison = String(valA).localeCompare(String(valB), 'tr');
                                                    }

                                                    if (comparison !== 0) {
                                                        return sort.direction === 'asc' ? comparison : -comparison;
                                                    }
                                                }
                                                return 0;
                                            });

                                            return (
                                                <Fragment key={company.id}>
                                                    {/* Company Header Row */}
                                                    <TableRow className="bg-amber-400 hover:bg-amber-400">
                                                        <TableCell colSpan={23} className="font-bold text-black py-2 px-4 uppercase text-center border-y-2 border-amber-500">
                                                            {company.name} {company.taxNumber ? `/ V.No: ${company.taxNumber}` : ''}
                                                        </TableCell>
                                                    </TableRow>
                                                    {sortedCompanySites.map((site, index) => {
                                                        const similarWorks = site.similarWorks && site.similarWorks.length > 0 ? site.similarWorks : [];
                                                        const rowCount = Math.max(similarWorks.length, 1);

                                                        return (
                                                            <Fragment key={site.id}>
                                                                {Array.from({ length: rowCount }).map((_, subIndex) => {
                                                                    const work = similarWorks[subIndex];
                                                                    const isFirstRow = subIndex === 0;

                                                                    return (
                                                                        <TableRow
                                                                            key={`${site.id}-${subIndex}`}
                                                                            className={cn(
                                                                                "hover:bg-slate-50 border-b",
                                                                                site.status === 'INACTIVE' ? 'bg-gray-50 opacity-75' : ''
                                                                            )}
                                                                        >
                                                                            {siteColumns.map((col, colIdx) => {
                                                                                // Determine if this column is "Detail" (Variable) or "Master" (Merged)
                                                                                // We repurpose 'workExperienceCertificate' and 'currentWorkExperienceAmount' for Similar Works if they exist
                                                                                let isDetailColumn = false;
                                                                                if (similarWorks.length > 0) {
                                                                                    if (col.key === 'workExperienceCertificate') isDetailColumn = true;
                                                                                    if (col.key === 'currentWorkExperienceAmount') isDetailColumn = true;
                                                                                }

                                                                                // If it's a Master column, only render on first row with rowSpan
                                                                                if (!isDetailColumn && !isFirstRow) return null;

                                                                                const partnerParams = site.partners?.find((p: any) => p.companyId === company.id);
                                                                                const effectivePartnership = partnerParams ? partnerParams.percentage : (site.partnershipPercentage || 100);

                                                                                // --- RENDER CONTENT ---
                                                                                let content: React.ReactNode = '-';

                                                                                // Special Action Column (Master)
                                                                                if (col.label === 'İşlem') {
                                                                                    content = (
                                                                                        <div className="flex flex-col items-center gap-1">
                                                                                            <Switch
                                                                                                checked={site.status !== 'INACTIVE'}
                                                                                                onCheckedChange={async (checked) => {
                                                                                                    try {
                                                                                                        const newStatus = checked ? 'ACTIVE' : 'INACTIVE';
                                                                                                        updateSite(site.id, { status: newStatus });
                                                                                                        await updateSiteAction(site.id, { status: newStatus });
                                                                                                        router.refresh();
                                                                                                    } catch (error) {
                                                                                                        console.error('Status update failed', error);
                                                                                                        alert('Durum güncellenemedi');
                                                                                                        window.location.reload();
                                                                                                    }
                                                                                                }}
                                                                                                className="scale-75"
                                                                                            />
                                                                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditSiteModal(site)}>
                                                                                                <Pencil className="w-3 h-3 text-slate-500 hover:text-blue-600" />
                                                                                            </Button>
                                                                                        </div>
                                                                                    );
                                                                                }
                                                                                // Variable Columns (Similar Works)
                                                                                else if (isDetailColumn && work) {
                                                                                    if (col.key === 'workExperienceCertificate') {
                                                                                        // Show Group Name / Code with detailed label if possible
                                                                                        let displayLabel = '';
                                                                                        if (work.group) {
                                                                                            if (work.group.includes(' - ')) {
                                                                                                const [gVal, oVal] = work.group.split(' - ');
                                                                                                const foundGroup = SIMILAR_WORK_GROUPS.find((g: any) => g.value === gVal);
                                                                                                const foundOpt = foundGroup?.options.find((o: any) => o.value === oVal);
                                                                                                if (foundOpt) {
                                                                                                    displayLabel = foundOpt.label.replace(`${oVal}. GRUP: `, '').replace(`${oVal}: `, '');
                                                                                                }
                                                                                            }
                                                                                        }
                                                                                        content = (
                                                                                            <div className="flex flex-col text-xs">
                                                                                                <span className="font-semibold">{work.group}</span>
                                                                                                {displayLabel && (
                                                                                                    <span className="text-[10px] text-muted-foreground truncate max-w-[200px]" title={displayLabel}>
                                                                                                        {displayLabel}
                                                                                                    </span>
                                                                                                )}
                                                                                            </div>
                                                                                        );
                                                                                    } else if (col.key === 'currentWorkExperienceAmount') {
                                                                                        // Show Amount
                                                                                        content = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(work.amount || 0) + ' ₺';
                                                                                    }
                                                                                }
                                                                                // Master Columns (Site Data)
                                                                                else {
                                                                                    if (col.label === 'S.No') {
                                                                                        content = index + 1;
                                                                                    }
                                                                                    else if (col.key === 'contractYiUfe') {
                                                                                        if (site.tenderDate) {
                                                                                            const date = new Date(site.tenderDate);
                                                                                            date.setMonth(date.getMonth() - 1);
                                                                                            const year = date.getFullYear();
                                                                                            const month = date.getMonth() + 1;
                                                                                            const rate = yiUfeRates.find((r: any) => r.year === year && r.month === month);
                                                                                            content = rate ? rate.index : (site.contractYiUfe || '-');
                                                                                        } else {
                                                                                            content = site.contractYiUfe || '-';
                                                                                        }
                                                                                    }
                                                                                    else if (col.key === 'realizedAmount') {
                                                                                        const contractPrice = site.contractPrice || 0;
                                                                                        if (site.provisionalAcceptanceDate) {
                                                                                            content = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(contractPrice) + ' ₺';
                                                                                        } else {
                                                                                            const realizedAmount = site.realizedAmount || 0;
                                                                                            const base = contractPrice - realizedAmount;
                                                                                            let baseIndex = site.priceDifferenceCoefficient;
                                                                                            if (!baseIndex || baseIndex === 0) {
                                                                                                baseIndex = site.contractYiUfe;
                                                                                                if (site.tenderDate) {
                                                                                                    const tDate = new Date(site.tenderDate);
                                                                                                    tDate.setMonth(tDate.getMonth() - 1);
                                                                                                    const foundRate = yiUfeRates.find((r: any) => r.year === tDate.getFullYear() && r.month === tDate.getMonth() + 1);
                                                                                                    if (foundRate) baseIndex = foundRate.index;
                                                                                                }
                                                                                            }
                                                                                            const sortedRates = [...yiUfeRates].sort((a, b) => (a.year !== b.year ? b.year - a.year : b.month - a.month));
                                                                                            const latestUfe = sortedRates[0]?.index;

                                                                                            if (baseIndex && baseIndex > 0 && latestUfe) {
                                                                                                const ratio = latestUfe / baseIndex;
                                                                                                const priceDifference = ratio - 1;
                                                                                                let result = (base * priceDifference) + base;
                                                                                                if (result < 0) result = contractPrice || 0;
                                                                                                content = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(result) + ' ₺';
                                                                                            } else {
                                                                                                content = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(base > 0 ? base : 0) + ' ₺';
                                                                                            }
                                                                                        }
                                                                                    }
                                                                                    else if (col.key === 'priceDifference') {
                                                                                        if (site.provisionalAcceptanceDate) {
                                                                                            content = '0%';
                                                                                        } else {
                                                                                            const sortedRates = [...yiUfeRates].sort((a, b) => (a.year !== b.year ? b.year - a.year : b.month - a.month));
                                                                                            const latestUfe = sortedRates[0]?.index;
                                                                                            const priceDiffCoef = site.priceDifferenceCoefficient;
                                                                                            if (latestUfe && priceDiffCoef && priceDiffCoef > 0) {
                                                                                                const result = ((latestUfe / priceDiffCoef) - 1) * 100;
                                                                                                content = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(result) + '%';
                                                                                            } else {
                                                                                                content = site.priceDifference ? new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(site.priceDifference) + ' ₺' : '-';
                                                                                            }
                                                                                        }
                                                                                    }
                                                                                    else if (col.key === 'currentWorkExperienceAmount') {
                                                                                        // Default Logic if no similar works or fallback
                                                                                        const stored = site.currentWorkExperienceAmount;
                                                                                        if (stored) {
                                                                                            content = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(stored) + ' ₺';
                                                                                        } else {
                                                                                            // ... existing calc logic ...
                                                                                            let contractUfe = site.contractYiUfe;
                                                                                            if (site.tenderDate) {
                                                                                                const tDate = new Date(site.tenderDate);
                                                                                                tDate.setMonth(tDate.getMonth() - 1);
                                                                                                const found = yiUfeRates.find((r: any) => r.year === tDate.getFullYear() && r.month === tDate.getMonth() + 1);
                                                                                                if (found) contractUfe = found.index;
                                                                                            }
                                                                                            const sortedRates = [...yiUfeRates].sort((a, b) => (a.year !== b.year ? b.year - a.year : b.month - a.month));
                                                                                            const latestUfe = sortedRates[0]?.index;
                                                                                            if (contractUfe && latestUfe && site.realizedAmount) {
                                                                                                const ratio = latestUfe / contractUfe;
                                                                                                const partnership = effectivePartnership / 100;
                                                                                                const amount = ratio * site.realizedAmount * partnership;
                                                                                                content = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount) + ' ₺';
                                                                                            } else {
                                                                                                content = '-';
                                                                                            }
                                                                                        }
                                                                                    }
                                                                                    else if (col.key === 'contractToCurrentUfeRatio') {
                                                                                        let contractUfe = site.contractYiUfe;
                                                                                        if (site.tenderDate) {
                                                                                            const tDate = new Date(site.tenderDate);
                                                                                            tDate.setMonth(tDate.getMonth() - 1);
                                                                                            const found = yiUfeRates.find((r: any) => r.year === tDate.getFullYear() && r.month === tDate.getMonth() + 1);
                                                                                            if (found) contractUfe = found.index;
                                                                                        }
                                                                                        const sortedRates = [...yiUfeRates].sort((a, b) => (a.year !== b.year ? b.year - a.year : b.month - a.month));
                                                                                        const latestUfe = sortedRates[0]?.index;

                                                                                        if (contractUfe && latestUfe) {
                                                                                            const ratio = latestUfe / contractUfe;
                                                                                            content = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 6, maximumFractionDigits: 6 }).format(ratio);
                                                                                        } else {
                                                                                            content = site.contractToCurrentUfeRatio || '-';
                                                                                        }
                                                                                    }
                                                                                    else if (col.key === 'partnershipPercentage') {
                                                                                        content = `%${effectivePartnership}`;
                                                                                    }
                                                                                    else if (col.key === 'statusDetail') {
                                                                                        content = (
                                                                                            <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                                                                                                site.status === 'ACTIVE' ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                                                                                            )}>
                                                                                                {site.statusDetail || (site.status === 'ACTIVE' ? 'Devam Ediyor' : 'Tamamlandı')}
                                                                                            </span>
                                                                                        );
                                                                                    }
                                                                                    else if (col.key) {
                                                                                        const val = site[col.key];
                                                                                        if (val !== undefined && val !== null && val !== '') {
                                                                                            if (col.isDate) content = format(new Date(val as string), 'dd.MM.yyyy');
                                                                                            else if (col.isCurrency) content = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(val)) + ' ₺';
                                                                                            else content = String(val);
                                                                                        }
                                                                                    }

                                                                                    // Green Indicators
                                                                                    let docUrl = "";
                                                                                    let hasDoc = false;
                                                                                    if (col.key === 'provisionalAcceptanceDate' && site.provisionalAcceptanceDoc) {
                                                                                        hasDoc = true; docUrl = site.provisionalAcceptanceDoc;
                                                                                    }
                                                                                    if (col.key === 'finalAcceptanceDate' && site.finalAcceptanceDoc) {
                                                                                        hasDoc = true; docUrl = site.finalAcceptanceDoc;
                                                                                    }
                                                                                    if (col.key === 'workExperienceCertificate' && site.workExperienceDoc) {
                                                                                        // Only show Master Doc if we are not showing Similar Works, OR show it if it's the first row but slightly differentiated?
                                                                                        // The requirement is to show Similar Works INSTEAD or WITH.
                                                                                        // If similarWorks exist, we used this column for them. 
                                                                                        // But wait, the doc itself (PDF) is site level. 
                                                                                        // Let's attach the Doc View capability to the FIRST row's value if possible, or just ignore for similar works mode?
                                                                                        // Current logic: If similarWorks exists, isDetailColumn=true, so we entered the other block. Use ELSE here.
                                                                                        hasDoc = true; docUrl = site.workExperienceDoc;
                                                                                        content = content === '-' || content === '' ? 'Belge Var' : content;
                                                                                    }

                                                                                    if (hasDoc && (!isDetailColumn || (col.key === 'workExperienceCertificate' && index === 0))) {
                                                                                        const docBtn = (
                                                                                            <div
                                                                                                className="inline-flex items-center px-2 py-0.5 rounded bg-green-100 text-green-800 font-semibold cursor-pointer hover:bg-green-200"
                                                                                                onClick={(e) => {
                                                                                                    e.stopPropagation();
                                                                                                    setPreviewDoc(docUrl);
                                                                                                }}
                                                                                                title="Belgeyi İncele"
                                                                                            >
                                                                                                {(!isDetailColumn && content !== '-' && content !== '') ? content : 'Belge Var'}
                                                                                            </div>
                                                                                        );

                                                                                        if (isDetailColumn && col.key === 'workExperienceCertificate') {
                                                                                            content = (
                                                                                                <div className="flex flex-col gap-1 items-start">
                                                                                                    {content}
                                                                                                    {docBtn}
                                                                                                </div>
                                                                                            );
                                                                                        } else {
                                                                                            content = docBtn;
                                                                                        }
                                                                                    }
                                                                                } // End Master Columns

                                                                                return (
                                                                                    <TableCell
                                                                                        key={colIdx}
                                                                                        rowSpan={!isDetailColumn && isFirstRow ? rowCount : undefined}
                                                                                        className={cn(
                                                                                            `border-r py-2 text-xs ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'} truncate`,
                                                                                            !isDetailColumn ? 'align-top bg-white' : '' // align top for merged cells
                                                                                        )}
                                                                                        style={{ width: col.width, maxWidth: col.width }}
                                                                                        title={typeof content === 'string' ? content : undefined}
                                                                                    >
                                                                                        {content}
                                                                                    </TableCell>
                                                                                );
                                                                            })}
                                                                        </TableRow>
                                                                    );
                                                                })}
                                                            </Fragment>
                                                        );
                                                    })}
                                                </Fragment>
                                            );
                                        })}
                                        {/* Display message if no sites at all */}
                                        {sites.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={23} className="text-center py-8 text-muted-foreground">
                                                    Henüz veri girişi yapılmamış. "Yeni İş Ekle" butonunu kullanınız.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* SYSTEM TAB */}
                <TabsContent value="system" className="space-y-4 mt-6">
                    <Card className="border-red-200">
                        <CardHeader className="bg-red-50/50">
                            <CardTitle className="text-red-700 flex items-center gap-2">
                                <ShieldAlert className="h-5 w-5" />
                                Tehlikeli Bölge
                            </CardTitle>
                            <CardDescription className="text-red-600/80">
                                Bu alandaki işlemler geri alınamaz ve veri kaybına neden olabilir.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between p-4 border border-red-100 rounded-lg bg-white shadow-sm">
                                <div className="space-y-1">
                                    <div className="font-semibold text-slate-900">Sistemi Sıfırla (Fabrika Ayarları)</div>
                                    <div className="text-sm text-slate-500 max-w-xl">
                                        Bu işlem, <strong>Admin kullanıcısı dışındaki</strong> tüm verileri (şantiyeler, firmalar, araçlar, personeller, loglar vb.) kalıcı olarak siler.
                                        <br />
                                        <span className="text-red-600 font-medium">Bu işlem sadece örnek verileri temizlemek ve temiz bir başlangıç yapmak için kullanılmalıdır.</span>
                                    </div>
                                </div>
                                <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button variant="destructive" className="gap-2">
                                            <Trash2 className="w-4 h-4" />
                                            Sistemi Sıfırla
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="border-red-200 sm:max-w-[425px]">
                                        <DialogHeader>
                                            <DialogTitle className="text-red-700 flex items-center gap-2">
                                                <ShieldAlert className="w-5 h-5" />
                                                Tüm Veriler Silinecek!
                                            </DialogTitle>
                                            <DialogDescription className="pt-2 space-y-2">
                                                <p>Bu işlem geri alınamaz. Onaylıyor musunuz?</p>
                                                <ul className="list-disc list-inside text-xs text-slate-500 space-y-1 bg-slate-50 p-2 rounded">
                                                    <li>Tüm Şantiyeler ve Firmalar silinecek.</li>
                                                    <li>Tüm Araçlar ve Personeller silinecek.</li>
                                                    <li>Tüm mali kayıtlar ve loglar silinecek.</li>
                                                    <li><strong>Mevcut Admin hesabınız korunacaktır.</strong></li>
                                                </ul>
                                            </DialogDescription>
                                        </DialogHeader>
                                        <DialogFooter className="gap-2 sm:justify-between">
                                            <Button variant="outline" onClick={() => setResetDialogOpen(false)} disabled={resetting}>
                                                Vazgeç
                                            </Button>
                                            <Button variant="destructive" onClick={handleResetSystem} disabled={resetting}>
                                                {resetting ? 'Siliniyor...' : 'Evet, Tüm Verileri Sil'}
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* PREVIEW MODAL */}
                <Dialog open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)}>
                    <DialogContent className="max-w-[95vw] w-[95vw] sm:max-w-[95vw] h-[90vh] p-0">
                        <DialogHeader>
                            <DialogTitle>Belge Önizleme</DialogTitle>
                        </DialogHeader>
                        {previewDoc && (
                            <div className="flex-1 w-full h-full min-h-[500px] border rounded bg-slate-50">
                                <iframe
                                    src={previewDoc || undefined}
                                    className="w-full h-full"
                                    title="Preview"
                                />
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            </Tabs >
        </div >
    );
}

