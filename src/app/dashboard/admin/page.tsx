'use client';

import { useState, useEffect, Fragment } from 'react';
import { useAppStore } from '@/lib/store/use-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input'; // ... existing imports

// [NEW] Server Actions
import { createUser, updateUser as updateUserAction, deleteUser as deleteUserAction } from '@/actions/user';
import { createCompany, updateCompany as updateCompanyAction, deleteCompany as deleteCompanyAction } from '@/actions/company';
import { createSite, updateSite as updateSiteAction, deleteSite as deleteSiteAction } from '@/actions/site';
import { useRouter } from 'next/navigation'; // Ensure router is imported
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch'; // [NEW]
import { MultiSelect } from '@/components/ui/multi-select'; // [NEW]
import { Plus, Building2, Users, ShieldCheck, ShieldAlert, TrendingUp, RefreshCw, MapPin, Mail, Pencil, FileDown, FileSpreadsheet, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
// import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/store/use-auth';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const MODULE_HIERARCHY = [
    { id: 'dashboard', label: 'Ana Sayfa (Dashboard)' },
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
        ]
    },
    {
        id: 'cash-book',
        label: 'Kasa Defteri',
        children: [
            { id: 'cash-book.reports', label: 'Geçmiş Sorgu & Raporlama' },
        ]
    },
    {
        id: 'personnel',
        label: 'Personel',
        children: [
            { id: 'personnel.list', label: 'Personel Listesi' },
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
];

import { User, Site } from '@/lib/types'; // [FIX] Import User and Site types

export default function AdminPage() {
    const {
        users, addUser, updateUser, deleteUser,
        companies, addCompany, updateCompany, deleteCompany,
        sites, addSite, updateSite, deleteSite,
        assignVehiclesToSite, vehicles,
        yiUfeRates, setYiUfeRates, addYiUfeRates,
        personnel, personnelAttendance, vehicleAttendance, fuelTanks // [FIX] Added missing deps for delete logic
    } = useAppStore();
    const { user } = useAuth();

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

    // Yi-Ufe State
    const [updatingYiUfe, setUpdatingYiUfe] = useState(false);
    // const { yiUfeRates, setYiUfeRates } = useAppStore(); // Removed duplicate
    const [yiUfeModalOpen, setYiUfeModalOpen] = useState(false);
    const [manualYear, setManualYear] = useState(new Date().getFullYear());
    const [manualMonth, setManualMonth] = useState(new Date().getMonth()); // 0-11, will fix display to 1-12
    const [manualRate, setManualRate] = useState('');

    // Company Form State
    const [companyModalOpen, setCompanyModalOpen] = useState(false);
    const [isEditingCompany, setIsEditingCompany] = useState(false); // [NEW]
    const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

    // Site Filters
    const [siteFilters, setSiteFilters] = useState<Record<string, string[]>>({}); // Changed to string[]

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
        const values = sites.map(s => {
            let val = s[key];
            if (!val && val !== 0) return 'Boş'; // Map empty/null/undefined to 'Boş'
            if (isDate && val) return format(new Date(val as string), 'dd.MM.yyyy');
            if (isCurrency && val) return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(val)) + ' ₺';
            return val ? String(val) : 'Boş';
        });
        // Filter out duplicates and sort
        return Array.from(new Set(values)).sort((a, b) => {
            if (a === 'Boş') return -1; // Put 'Boş' at the top
            if (b === 'Boş') return 1;
            return a.localeCompare(b);
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



    const handleDeleteCompany = (id: string, name: string) => {
        // Check for dependencies (Sites)
        const linkedSites = sites.filter(s => s.companyId === id);
        if (linkedSites.length > 0) {
            alert(`Bu firma silinemez!\n\nBağlı ${linkedSites.length} adet şantiye bulunmaktadır.\nLütfen önce bu şantiyelerin firma bağlantısını değiştirin veya silin.`);
            return;
        }

        if (confirm(`"${name}" firmasını silmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz.`)) {
            deleteCompany(id);
        }
    }; // [NEW]
    const [companyName, setCompanyName] = useState('');
    const [companyTaxNumber, setCompanyTaxNumber] = useState('');
    const [companyAddress, setCompanyAddress] = useState('');
    const [companyPhone, setCompanyPhone] = useState('');
    const [companyStamp, setCompanyStamp] = useState<string | null>(null);


    const handleExportExcel = () => {
        const flatSites: any[] = [];

        companies.forEach(company => {
            const companySites = sites.filter(s => s.companyId === company.id);
            // Apply sorting if needed, or just dump
            companySites.forEach((site, index) => {
                flatSites.push({
                    'Yüklenici Firma': company.name,
                    'İş Grubu': site.workGroup,
                    'S.No': index + 1,
                    'EKAP Belge No': site.projectNo,
                    'İşin Adı': site.name,
                    'İhale Kayıt No': site.registrationNo,
                    'İlan Tarihi': site.announcementDate ? format(new Date(site.announcementDate), 'dd.MM.yyyy') : '',
                    'İhale Tarihi': site.tenderDate ? format(new Date(site.tenderDate), 'dd.MM.yyyy') : '',
                    'Sözleşme Tarihi': site.contractDate ? format(new Date(site.contractDate), 'dd.MM.yyyy') : '',
                    'İşyeri Teslim Tarihi': site.siteDeliveryDate ? format(new Date(site.siteDeliveryDate), 'dd.MM.yyyy') : '',
                    'İş Bitim Tarihi': site.completionDate ? format(new Date(site.completionDate), 'dd.MM.yyyy') : '',
                    'Süre Uzatımlı Tarih': site.extendedDate ? format(new Date(site.extendedDate), 'dd.MM.yyyy') : '',
                    'Sözleşme Bedeli': site.contractPrice,
                    'Durum': site.status === 'INACTIVE' ? 'Pasif' : 'Aktif'
                });
            });
        });

        const ws = XLSX.utils.json_to_sheet(flatSites);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Şantiyeler");
        XLSX.writeFile(wb, "Santiye_Listesi.xlsx");
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

        companies.forEach(company => {
            const companySites = sites.filter(s => s.companyId === company.id);
            companySites.forEach(site => {
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

    const [companyLetterhead, setCompanyLetterhead] = useState<string | null>(null);
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
        setIsEditing(true);
        setSelectedUserId(user.id);
        setUserName(user.name);
        setUserUsername(user.username || '');
        // Password usually left blank on edit unless changing
        setUserPassword('');
        // setUserEmail(user.email);
        setUserRole(user.role);
        setUserPermissions(user.permissions || {});
        setAssignedSiteIds(user.assignedSiteIds || []);
        setEditLookbackDays(user.editLookbackDays !== undefined ? user.editLookbackDays : '');
        setUserModalOpen(true);
    };

    const handleSaveUser = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            if (isEditing && selectedUserId) {
                await updateUserAction(selectedUserId, {
                    username: userUsername,
                    password: userPassword || undefined,
                    role: userRole,
                    permissions: userPermissions,
                    assignedSiteIds: assignedSiteIds,
                    editLookbackDays: editLookbackDays === '' ? undefined : Number(editLookbackDays)
                });
            } else {
                await createUser({
                    name: userName,
                    username: userUsername,
                    password: userPassword,
                    role: userRole,
                    permissions: userPermissions,
                    assignedSiteIds: assignedSiteIds,
                    editLookbackDays: editLookbackDays === '' ? undefined : Number(editLookbackDays)
                });
            }
            // Force refresh to update list
            location.reload();
        } catch (error) {
            console.error(error);
            alert('İşlem başarısız.');
        }

        setUserModalOpen(false);
        setUserName('');
        setUserUsername('');
        setUserPassword('');
        setUserRole('USER');
        setUserPermissions({});
        setEditLookbackDays('');
    };

    const handleDeleteUser = (userToDelete: User) => {
        if (user?.role !== 'ADMIN') { // [Check] Only Admin can delete
            alert('Bu işlem için yetkiniz yok.');
            return;
        }

        if (userToDelete.id === user?.id) {
            alert('Kendinizi silemezsiniz.');
            return;
        }

        if (confirm(`${userToDelete.name} kullanıcısını silmek istediğinize emin misiniz?`)) {
            // Also consider checking if user has related data (like cash transactions) but store handles that or simple deletion.
            // For now, allow deletion.
            deleteUser(userToDelete.id);
        }
    };

    const handleAddCompany = async (e: React.FormEvent) => {
        e.preventDefault();

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
            smtpSecure: companySmtpSecure
        };

        try {
            if (isEditingCompany && selectedCompanyId) {
                await updateCompanyAction(selectedCompanyId, companyData);
            } else {
                await createCompany(companyData);
            }
            location.reload();
        } catch (err) {
            console.error(err);
            alert('İşlem başarısız.');
        }

        setCompanyModalOpen(false);
        resetCompanyForm();
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
        setCompanySmtpSecure(false);
    };

    const openAddCompanyModal = () => {
        resetCompanyForm();
        setCompanyModalOpen(true);
    };

    const openEditCompanyModal = (company: any) => {
        setIsEditingCompany(true);
        setSelectedCompanyId(company.id);
        setCompanyName(company.name);
        setCompanyTaxNumber(company.taxNumber || '');
        setCompanyAddress(company.address || '');
        setCompanyPhone(company.phone || '');
        setCompanyStamp(company.stamp || null);
        setCompanyLetterhead(company.letterhead || null);
        if (company.smtpConfig) {
            setCompanySmtpHost(company.smtpConfig.host);
            setCompanySmtpPort(company.smtpConfig.port.toString());
            setCompanySmtpUser(company.smtpConfig.auth.user);
            setCompanySmtpPass(company.smtpConfig.auth.pass);
            setCompanySmtpFromEmail(company.smtpConfig.fromEmail);
            setCompanySmtpFromName(company.smtpConfig.fromName);
            setCompanySmtpSecure(company.smtpConfig.secure);
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
    const [newSiteData, setNewSiteData] = useState<Partial<Site>>({
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
        note: ''
    });

    const handleDeleteSite = () => {
        if (!selectedSiteId) return;

        // Validation Checks
        const assignedVehicles = vehicles.filter(v => v.assignedSiteId === selectedSiteId).length;
        // Personnel don't have direct 'assignedSiteId' on the object usually, they have assigned sites in list?
        // Checking definitions: Personnel interface has 'assignedSiteIds' (plural)? 
        // Let's check 'users'. Users have 'assignedSiteIds'.
        // Personnel assignments are usually tracked via attendance or if we added a specific field. 
        // Use-store says: personnel: Personnel[]. Let's assume logic validation is mostly about attendance for personnel. 
        // But let's check Users assignment too.
        const assignedUsers = users.filter(u => u.assignedSiteIds?.includes(selectedSiteId)).length;

        // Attendance
        const pAttendanceCount = personnelAttendance.filter(a => a.siteId === selectedSiteId).length;
        const vAttendanceCount = vehicleAttendance.filter(a => a.siteId === selectedSiteId).length;

        // Tanks
        const tankCount = fuelTanks.filter(t => t.siteId === selectedSiteId).length;

        const totalDependencies = assignedVehicles + assignedUsers + pAttendanceCount + vAttendanceCount + tankCount;

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
                if (!confirm(message + `\n\n[ADMIN YETKİSİ]\nBu kayıtlara rağmen şantiyeyi silmek istediğinize emin misiniz?`)) {
                    return;
                }
            }
        } else {
            if (!confirm('Bu şantiyeyi silmek istediğinize emin misiniz?')) {
                return;
            }
        }

        // Proceed to delete
        deleteSite(selectedSiteId);
        setSiteModalOpen(false);
        resetSiteForm();
    };

    const handleAddSite = async (e: React.FormEvent) => {
        e.preventDefault();

        const sitePayload: any = {
            name: newSiteData.name!,
            companyId: newSiteData.companyId!,
            location: '', // Removed from UI, default empty
            status: 'ACTIVE',
            ...newSiteData
        };

        try {
            if (isEditingSite && selectedSiteId) {
                await updateSiteAction(selectedSiteId, sitePayload);
            } else {
                if (newSiteData.provisionalAcceptanceDate) {
                    sitePayload.status = 'INACTIVE';
                }
                await createSite(sitePayload);
            }
            location.reload();
        } catch (err) {
            console.error(err);
            alert('İşlem başarısız.');
        }

        setSiteModalOpen(false);
        resetSiteForm();
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
            personnelCount: 0, note: ''
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
            ...site
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
                // Ensure VIEW is present, preserve others if needed? 
                // Logic: "Access Switch" On -> Ensure VIEW. Off -> Clear All.
                // Here we assume SET_VIEW is turning it ON (adding VIEW).
                if (!updated.includes('VIEW')) updated.push('VIEW');
            } else if (action === 'ADD') {
                if (!updated.includes(value)) updated.push(value);
                // Ensure VIEW is present if adding sub-permissions
                if (!updated.includes('VIEW')) updated.push('VIEW');
            } else if (action === 'REMOVE') {
                updated = updated.filter(p => p !== value);
            }

            return {
                ...prev,
                [moduleId]: updated
            };
        });
    };

    const setAllPermissions = (level: 'VIEW' | 'CREATE' | 'EDIT' | 'NONE') => {
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

    const toggleColumn = (colType: 'VIEW' | 'CREATE' | 'EDIT') => {
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
            const res = await fetch('/api/yi-ufe');
            const data = await res.json();
            if (data.rates) {
                const ratesWithId = data.rates.map((r: any) => ({
                    id: `${r.year}-${r.month}`,
                    year: r.year,
                    month: r.month,
                    index: r.index
                }));
                // Merge with existing rates (prefer API)
                // Actually, just set rates.
                // But we want to keep manual entries if API doesn't have them?
                // For now, easy way: API overwrites match keys.
                // But setYiUfeRates replaces ALL. 
                // We should probably merge.
                // Let's implement merge logic in store? 
                // Current store implementation of setYiUfeRates replaces all.
                // Let's keep it simple: API replaces all.

                // Merge with existing rates
                addYiUfeRates(ratesWithId);
                // setYiUfeModalOpen(false); // No longer needed as button is separate
            }
        } catch (e) {
            console.error(e);
            alert('Otomatik güncelleme başarısız oldu. Lütfen manuel giriş yapınız.');
        } finally {
            setUpdatingYiUfe(false);
        }
    };

    const handleSaveManualYiUfe = (e: React.FormEvent) => {
        e.preventDefault();
        const rate = parseFloat(manualRate);
        if (isNaN(rate)) {
            alert('Geçerli bir oran giriniz.');
            return;
        }

        // Create new rate object
        const newRate = {
            id: `${manualYear}-${manualMonth + 1}`,
            year: manualYear,
            month: manualMonth + 1, // Store as 1-12
            index: rate
        };

        // Merge with existing
        // We filter out any existing rate for this year/month
        const existing = yiUfeRates.filter(r => !(r.year === manualYear && r.month === manualMonth + 1));
        setYiUfeRates([...existing, newRate]);

        setYiUfeModalOpen(false);
        setManualRate('');
    };

    // Auto-update logic is now handled globally in useYiUfeAutoUpdate hook.

    // If Admin is selected, select all permissions automatically? 
    // Or keep them separate. User request says "restricted and full access".
    // Let's implement logic: Admin usually has access to everything by default logic elsewhere, 
    // but here we can just auto-check everything for visual feedback or keep it manual.
    // User request: "kısıtlı yetki ve tam yetkiyi hangi sekmelere vermek istediğimi seçenek olarak sun"

    // [NEW] Helper to render permission rows recursively
    const handleApplyTemplate = (value: string) => {
        if (value === 'VIEW_ALL') {
            setAllPermissions('VIEW');
        } else {
            // Check if it's a user ID
            const sourceUser = users.find(u => u.id === value);
            if (sourceUser) {
                // Copy permissions strictly
                setUserPermissions({ ...(sourceUser.permissions || {}) });
            }
        }
    };

    const renderPermissionRow = (module: any, depth = 0) => {
        const perms = userPermissions[module.id] || [];
        const hasView = perms.includes('VIEW');
        const hasCreate = perms.includes('CREATE');
        const hasEdit = perms.includes('EDIT');

        const paddingLeft = depth * 24;

        return (
            <Fragment key={module.id}>
                <TableRow className={depth > 0 ? "bg-slate-50/50" : ""}>
                    <TableCell className="font-medium" style={{ paddingLeft: `${paddingLeft + 16}px` }}>
                        <div className="flex items-center gap-2">
                            {depth > 0 && <div className="w-1 h-1 rounded-full bg-slate-400" />}
                            {module.label}
                        </div>
                    </TableCell>
                    {/* View Button */}
                    <TableCell className="text-center">
                        <div className="flex justify-center">
                            <Button
                                type="button"
                                variant={hasView ? "default" : "outline"}
                                size="sm"
                                className={cn("h-8 w-24 text-xs font-semibold", hasView ? "bg-blue-600 hover:bg-blue-700" : "text-slate-500")}
                                onClick={() => setPermission(module.id, 'VIEW', hasView ? 'CLEAR' : 'SET_VIEW')}
                            >
                                {hasView ? 'Görünür' : 'Görünmez'}
                            </Button>
                        </div>
                    </TableCell>
                    {/* View Only Indicator (Removed, redundant with Button) */}
                    <TableCell className="text-center text-xs text-muted-foreground">
                        {hasView ? (
                            <span className="text-blue-600 font-medium">Aktif</span>
                        ) : (
                            <span className="text-slate-400">Pasif</span>
                        )}
                    </TableCell>
                    {/* Create Button */}
                    <TableCell className="text-center">
                        <div className="flex justify-center">
                            <Button
                                type="button"
                                variant={hasCreate ? "default" : "outline"}
                                size="sm"
                                className={cn(
                                    "h-8 w-24 text-xs font-semibold",
                                    hasCreate ? "bg-green-600 hover:bg-green-700" : "text-slate-500",
                                    !hasView && "opacity-50 cursor-not-allowed"
                                )}
                                onClick={() => hasView && setPermission(module.id, 'CREATE', hasCreate ? 'REMOVE' : 'ADD')}
                                disabled={!hasView}
                            >
                                <Plus className="w-3 h-3 mr-1" />
                                Ekle
                            </Button>
                        </div>
                    </TableCell>
                    {/* Edit Button */}
                    <TableCell className="text-center">
                        <div className="flex justify-center">
                            <Button
                                type="button"
                                variant={hasEdit ? "default" : "outline"}
                                size="sm"
                                className={cn(
                                    "h-8 w-24 text-xs font-semibold",
                                    hasEdit ? "bg-orange-600 hover:bg-orange-700" : "text-slate-500",
                                    !hasView && "opacity-50 cursor-not-allowed"
                                )}
                                onClick={() => hasView && setPermission(module.id, 'EDIT', hasEdit ? 'REMOVE' : 'ADD')}
                                disabled={!hasView}
                            >
                                <Pencil className="w-3 h-3 mr-1" />
                                Düzenle
                            </Button>
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

            <Tabs defaultValue="users" className="space-y-4">
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
                                    <form onSubmit={handleSaveUser} className="flex-1 overflow-hidden flex flex-col">

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
                                                        <div className="font-medium">{userName}</div>
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
                                                        {sites.map(site => (
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
                                                                    <Button type="button" variant="outline" size="sm" onClick={() => setAllPermissions('NONE')} className="h-7 text-xs">
                                                                        Temizle
                                                                    </Button>
                                                                    <Button type="button" variant="outline" size="sm" onClick={() => setAllPermissions('VIEW')} className="h-7 text-xs">
                                                                        Tümünü Gör
                                                                    </Button>
                                                                    <Button type="button" variant="outline" size="sm" onClick={() => setAllPermissions('EDIT')} className="h-7 text-xs">
                                                                        Tümünü Düzenle
                                                                    </Button>
                                                                </div>
                                                            </div>

                                                            {/* [NEW] Template Selector */}
                                                            <Select onValueChange={handleApplyTemplate}>
                                                                <SelectTrigger className="w-full bg-white h-8 text-xs">
                                                                    <SelectValue placeholder="Yetki Kopyala / Şablon Seç..." />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectGroup>
                                                                        <SelectLabel>Hazır Şablonlar</SelectLabel>
                                                                        <SelectItem value="VIEW_ALL">Sadece İzleme (Tüm Modüller)</SelectItem>
                                                                    </SelectGroup>
                                                                    <SelectGroup>
                                                                        <SelectLabel>Kullanıcıdan Kopyala</SelectLabel>
                                                                        {users.filter(u => u.id !== (selectedUserId || '') && u.role !== 'ADMIN').map(u => (
                                                                            <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                                                        ))}
                                                                    </SelectGroup>
                                                                </SelectContent>
                                                            </Select>
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
                                                                                Modül Durumu
                                                                            </Button>
                                                                        </TableHead>
                                                                        <TableHead className="text-center">
                                                                            <span className="text-muted-foreground text-xs">Erişim</span>
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
                                            <Button type="submit" size="lg" className="w-full sm:w-auto">Kaydet</Button>
                                        </DialogFooter>
                                    </form>
                                </DialogContent>
                            </Dialog>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Ad Soyad</TableHead>
                                        {/* <TableHead>E-posta</TableHead> Removed per user request */}
                                        <TableHead>Yetki Türü</TableHead>
                                        <TableHead>Erişimler</TableHead>
                                        <TableHead className="text-right">İşlem</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {users.map(u => (
                                        <TableRow key={u.id}>
                                            <TableCell className="font-medium">
                                                <div>{u.name}</div>
                                                <div className="text-xs text-slate-500">{u.email}</div>
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
                                                                {Object.values(u.permissions || {}).filter(permArray => permArray.includes('EDIT')).length > 0 && (
                                                                    <Badge variant="default" className="text-[10px] bg-green-600 hover:bg-green-700">
                                                                        {Object.values(u.permissions || {}).filter(permArray => permArray.includes('EDIT')).length} Düzenleme
                                                                    </Badge>
                                                                )}
                                                                {Object.values(u.permissions || {}).filter(permArray => permArray.includes('VIEW')).length > 0 && (
                                                                    <Badge variant="secondary" className="text-[10px]">
                                                                        {Object.values(u.permissions || {}).filter(permArray => permArray.includes('VIEW')).length} İzleme
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
                                        {Array.from(new Set(yiUfeRates.map(r => r.year)))
                                            .sort((a, b) => b - a)
                                            .map(year => (
                                                <TableRow key={year}>
                                                    <TableCell className="font-bold">{year}</TableCell>
                                                    {Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
                                                        const rate = yiUfeRates.find(r => r.year === year && r.month === month);
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
                                        <div className="space-y-2">
                                            <Label>Firma Adı <span className="text-red-500">*</span></Label>
                                            <Input value={companyName} onChange={e => setCompanyName(e.target.value)} required />
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
                                        <div className="space-y-4 pt-4 border-t">
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
                                    {companies.map(c => (
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
                                            reader.onload = (event) => {
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

                                                // Helper to parse dates strictly as ISO strings
                                                const parseDate = (val: any): string | undefined => {
                                                    if (!val) return undefined;
                                                    // Excel serial date? 
                                                    if (typeof val === 'number') {
                                                        // XLSX handles basic serials often if passed correctly, but raw JSON might be serial
                                                        // (val - 25569) * 86400 * 1000
                                                        const date = new Date(Math.round((val - 25569) * 86400 * 1000));
                                                        return date.toISOString();
                                                    }
                                                    // String DD.MM.YYYY
                                                    if (typeof val === 'string' && val.includes('.')) {
                                                        const parts = val.split('.');
                                                        if (parts.length === 3) {
                                                            return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).toISOString();
                                                        }
                                                    }
                                                    // Standard date string
                                                    const d = new Date(val);
                                                    return !isNaN(d.getTime()) ? d.toISOString() : undefined;
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

                                                jsonData.forEach((row, index) => {
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
                                                            return;
                                                        }

                                                        // Find Company
                                                        const company = companies.find(c =>
                                                            c.name.trim().toLowerCase() === companyName.toString().trim().toLowerCase()
                                                        );

                                                        if (!company) {
                                                            failCount++;
                                                            errors.push(`Satır ${index + 2}: Firma sistemde bulunamadı: "${companyName}".`);
                                                            return;
                                                        }

                                                        addSite({
                                                            id: crypto.randomUUID(),
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
                                                            currentUfeDate: parseDate(getVal(row, ['Güncel Ufe Tarihi'])),

                                                            // Financial
                                                            contractYiUfe: getVal(row, ['Sözleşme Ayı Yi-Üfe Katsayısı']) ? Number(getVal(row, ['Sözleşme Ayı Yi-Üfe Katsayısı'])) : undefined,
                                                            priceDifferenceCoefficient: getVal(row, ['Güncel Fiyat Farkı Katsayısı']) ? Number(getVal(row, ['Güncel Fiyat Farkı Katsayısı'])) : undefined,
                                                            contractPrice: getVal(row, ['Sözleşme Bedeli Kdv ve F.F. Hariç']) ? Number(getVal(row, ['Sözleşme Bedeli Kdv ve F.F. Hariç'])) : undefined,
                                                            kdv: getVal(row, ['KDV Oranı']) ? Number(getVal(row, ['KDV Oranı'])) : 20,
                                                            remainingAmount: getVal(row, ['F.F. Dahil Kalan Tutar (Kdv Hariç)']) ? Number(getVal(row, ['F.F. Dahil Kalan Tutar (Kdv Hariç)'])) : undefined,
                                                            realizedAmount: getVal(row, ['Sözleşme Fiyatıyla Gerçekleşen tutar Kdv ve F.F. Hariç']) ? Number(getVal(row, ['Sözleşme Fiyatıyla Gerçekleşen tutar Kdv ve F.F. Hariç'])) : undefined,
                                                            contractToCurrentUfeRatio: getVal(row, ['Sözleşme Ufe / Güncel Ufe']) ? Number(getVal(row, ['Sözleşme Ufe / Güncel Ufe'])) : undefined,
                                                            currentWorkExperienceAmount: getVal(row, ['Güncel İş Deneyim tutarı']) ? Number(getVal(row, ['Güncel İş Deneyim tutarı'])) : undefined,
                                                            priceDifference: getVal(row, ['Fiyat Farkı']) ? Number(getVal(row, ['Fiyat Farkı'])) : undefined,

                                                            // Details
                                                            workExperienceCertificate: getVal(row, ['İş Deneyim Belgesi']) ? getVal(row, ['İş Deneyim Belgesi']).toString() : '',
                                                            statusDetail: getVal(row, ['Durum']) ? getVal(row, ['Durum']).toString() : '',
                                                            partnershipPercentage: getVal(row, ['Ortaklık Oranı']) ? Number(getVal(row, ['Ortaklık Oranı'])) : 100,
                                                            completionPercentage: getVal(row, ['Fiziki Gerçekleşme (%)']) ? Number(getVal(row, ['Fiziki Gerçekleşme (%)'])) : 0,
                                                            personnelCount: getVal(row, ['Ort. Çalıştırılan Personel']) ? Number(getVal(row, ['Ort. Çalıştırılan Personel'])) : 0,
                                                            note: getVal(row, ['Notlar']) ? getVal(row, ['Notlar']).toString() : ''
                                                        });
                                                        successCount++;
                                                    } catch (err) {
                                                        failCount++;
                                                        errors.push(`Satır ${index + 2}: İşlem hatası.`);
                                                    }
                                                });

                                                if (successCount === 0 && failCount === 0) {
                                                    alert('İşlem yapılamadı.');
                                                } else {
                                                    alert(`İşlem Tamamlandı.\nBaşarılı: ${successCount}\nHatalı: ${failCount}\n\n${errors.slice(0, 15).join('\n')}${errors.length > 15 ? '\n...' : ''}`);
                                                }
                                                e.target.value = ''; // Reset input
                                            };
                                            reader.readAsArrayBuffer(file);
                                        }}
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

                                            sites.forEach(s => {
                                                const contractPrice = s.contractPrice || 0;
                                                const realizedAmount = s.realizedAmount || 0;
                                                const base = contractPrice - realizedAmount;

                                                let contractUfe = s.contractYiUfe;
                                                if (s.tenderDate) {
                                                    const tDate = new Date(s.tenderDate);
                                                    tDate.setMonth(tDate.getMonth() - 1);
                                                    const foundRate = yiUfeRates.find(r => r.year === tDate.getFullYear() && r.month === tDate.getMonth() + 1);
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
                                                    <TabsList className="w-full grid grid-cols-3">
                                                        <TabsTrigger value="general">Genel Bilgiler</TabsTrigger>
                                                        <TabsTrigger value="financial">Sözleşme & Mali</TabsTrigger>
                                                        <TabsTrigger value="dates">Tarihler & Durum</TabsTrigger>
                                                    </TabsList>

                                                    {/* General Info Tab */}
                                                    <TabsContent value="general" className="space-y-4 pt-4">
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div className="space-y-2 col-span-2">
                                                                <Label>İşin Adı <span className="text-red-500">*</span></Label>
                                                                <Input
                                                                    value={newSiteData.name || ''}
                                                                    onChange={e => setNewSiteData({ ...newSiteData, name: e.target.value })}
                                                                    required
                                                                />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label>Yüklenici Firma <span className="text-red-500">*</span></Label>
                                                                <select
                                                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                                                                    value={newSiteData.companyId || ''}
                                                                    onChange={e => setNewSiteData({ ...newSiteData, companyId: e.target.value })}
                                                                    required
                                                                >
                                                                    <option value="" disabled>Seçiniz</option>
                                                                    {companies.map(c => (
                                                                        <option key={c.id} value={c.id}>{c.name}</option>
                                                                    ))}
                                                                </select>
                                                            </div>

                                                            <div className="space-y-2">
                                                                <Label>İş Grubu <span className="text-red-500">*</span></Label>
                                                                <Select
                                                                    value={newSiteData.workGroup || ''}
                                                                    onValueChange={value => setNewSiteData({ ...newSiteData, workGroup: value })}
                                                                    required
                                                                >
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder="Seçiniz" />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="Altyapı">Altyapı</SelectItem>
                                                                        <SelectItem value="Drenaj">Drenaj</SelectItem>
                                                                        <SelectItem value="Gölet">Gölet</SelectItem>
                                                                        <SelectItem value="Harita">Harita</SelectItem>
                                                                        <SelectItem value="Restorasyon">Restorasyon</SelectItem>
                                                                        <SelectItem value="Sera">Sera</SelectItem>
                                                                        <SelectItem value="Sulama">Sulama</SelectItem>
                                                                        <SelectItem value="Taşkın Koruma">Taşkın Koruma</SelectItem>
                                                                        <SelectItem value="Toplulaştırma">Toplulaştırma</SelectItem>
                                                                        <SelectItem value="Üstyapı">Üstyapı</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label>EKAP Belge No</Label>
                                                                <Input
                                                                    value={newSiteData.projectNo || ''}
                                                                    onChange={e => setNewSiteData({ ...newSiteData, projectNo: e.target.value })}
                                                                />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label>İhale Kayıt No <span className="text-red-500">*</span></Label>
                                                                <Input
                                                                    value={newSiteData.registrationNo || ''}
                                                                    onChange={e => setNewSiteData({ ...newSiteData, registrationNo: e.target.value })}
                                                                    required
                                                                />
                                                            </div>
                                                        </div>
                                                    </TabsContent>

                                                    <TabsContent value="financial" className="space-y-4 pt-4">
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div className="space-y-2 col-span-2">
                                                                <Label>Sözleşme Bedeli (KDV ve F.F. Hariç)</Label>
                                                                <Input
                                                                    type="number"
                                                                    value={newSiteData.contractPrice || ''}
                                                                    onChange={e => setNewSiteData({ ...newSiteData, contractPrice: e.target.value ? Number(e.target.value) : undefined })}
                                                                />
                                                            </div>



                                                            <div className="space-y-2">
                                                                <Label>Ortaklık Oranı (%)</Label>
                                                                <Input
                                                                    type="number"
                                                                    value={newSiteData.partnershipPercentage || ''}
                                                                    onChange={e => setNewSiteData({ ...newSiteData, partnershipPercentage: e.target.value ? Number(e.target.value) : 0 })}
                                                                />
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

                                                    {/* Dates Tab */}
                                                    <TabsContent value="dates" className="space-y-4 pt-4">
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div className="space-y-2">
                                                                <Label>İlan Tarihi <span className="text-red-500">*</span></Label>
                                                                <Input type="date" value={newSiteData.announcementDate || ''} onChange={e => setNewSiteData({ ...newSiteData, announcementDate: e.target.value })} required />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label>İhale Tarihi <span className="text-red-500">*</span></Label>
                                                                <Input type="date" value={newSiteData.tenderDate || ''} onChange={e => setNewSiteData({ ...newSiteData, tenderDate: e.target.value })} required />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label>Sözleşme Tarihi <span className="text-red-500">*</span></Label>
                                                                <Input type="date" value={newSiteData.contractDate || ''} onChange={e => setNewSiteData({ ...newSiteData, contractDate: e.target.value })} required />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label>İşyeri Teslim Tarihi</Label>
                                                                <Input type="date" value={newSiteData.siteDeliveryDate || ''} onChange={e => setNewSiteData({ ...newSiteData, siteDeliveryDate: e.target.value })} />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label>Geçici Kabul Tarihi</Label>
                                                                <Input type="date" value={newSiteData.provisionalAcceptanceDate || ''} onChange={e => setNewSiteData({ ...newSiteData, provisionalAcceptanceDate: e.target.value })} />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label>Kesin Kabul Tarihi</Label>
                                                                <Input type="date" value={newSiteData.finalAcceptanceDate || ''} onChange={e => setNewSiteData({ ...newSiteData, finalAcceptanceDate: e.target.value })} />
                                                            </div>
                                                            <div className="space-y-2 col-span-2">
                                                                <Label>İş Deneyim Belgesi</Label>
                                                                <Input
                                                                    value={newSiteData.workExperienceCertificate || ''}
                                                                    onChange={e => setNewSiteData({ ...newSiteData, workExperienceCertificate: e.target.value })}
                                                                    placeholder="Belge No / Tutar vs."
                                                                />
                                                            </div>

                                                            <div className="space-y-2 col-span-2">
                                                                <Label>Durum Detayı</Label>
                                                                <Input
                                                                    value={newSiteData.statusDetail || ''}
                                                                    onChange={e => setNewSiteData({ ...newSiteData, statusDetail: e.target.value })}
                                                                    placeholder="Örn: Devam Ediyor / Kesin Kabul Yapıldı"
                                                                />
                                                            </div>
                                                        </div>
                                                    </TabsContent>
                                                </Tabs>

                                                <DialogFooter className="flex justify-between items-center sm:justify-between w-full">
                                                    {isEditingSite && (
                                                        <Button type="button" variant="destructive" onClick={handleDeleteSite}>
                                                            Sil
                                                        </Button>
                                                    )}
                                                    <div className="flex gap-2 ml-auto">
                                                        <Button type="submit">Kaydet</Button>
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
                        <CardContent className="px-0">
                            <div className="border rounded-md overflow-auto max-h-[calc(100vh-240px)]">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-slate-100">
                                            {siteColumns.map((col, idx) => (
                                                <TableHead
                                                    key={idx}
                                                    className={`font-bold text-black border-r cursor-pointer hover:bg-slate-200 transition-colors select-none ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'}`}
                                                    style={{ width: col.width }}
                                                    onClick={(e) => col.key && handleSiteSort(col.key, e)}
                                                >
                                                    <div className="flex flex-col gap-1 py-2">
                                                        {col.key && (
                                                            <div onClick={e => e.stopPropagation()}>
                                                                <MultiSelect
                                                                    options={getUniqueValues(col.key, col.isDate, col.isCurrency).map(v => ({ label: v, value: v }))}
                                                                    selected={siteFilters[col.key] || []}
                                                                    onChange={(val: string[]) => setSiteFilters(prev => ({ ...prev, [col.key!]: val }))}
                                                                    placeholder="Tümü"
                                                                    searchPlaceholder="Ara..."
                                                                    className="h-7 text-[10px]"
                                                                />
                                                            </div>
                                                        )}
                                                        <div className="flex items-center justify-between gap-1 mt-1">
                                                            <span className="text-[11px] leading-tight whitespace-normal">{col.label}</span>
                                                            {col.key && getSiteSortIcon(col.key)}
                                                        </div>
                                                    </div>
                                                </TableHead>
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {companies.map(company => {
                                            // 1. Filter Sites
                                            const filteredCompanySites = sites.filter(s => {
                                                if (s.companyId !== company.id) return false;
                                                return Object.entries(siteFilters).every(([key, values]) => {
                                                    if (!values || values.length === 0) return true; // No filter selected

                                                    const col = siteColumns.find(c => c.key === key);
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
                                                    const col = siteColumns.find(c => c.key === sort.key);
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
                                                    {sortedCompanySites.map((site, index) => (
                                                        <TableRow key={site.id} className={cn("hover:bg-slate-50 border-b", site.status === 'INACTIVE' ? 'bg-gray-50 opacity-75' : '')}>
                                                            <TableCell className="border-r py-2 text-xs text-center">
                                                                <div className="flex flex-col items-center gap-1">
                                                                    <Switch
                                                                        checked={site.status !== 'INACTIVE'}
                                                                        onCheckedChange={async (checked) => {
                                                                            try {
                                                                                const newStatus = checked ? 'ACTIVE' : 'INACTIVE';
                                                                                await updateSiteAction(site.id, { status: newStatus });
                                                                                // Refresh local state if needed or rely on server action revalidation
                                                                                window.location.reload(); // Temporary for immediate feedback
                                                                            } catch (error) {
                                                                                console.error('Status update failed', error);
                                                                                alert('Durum güncellenemedi');
                                                                            }
                                                                        }}
                                                                        className="scale-75"
                                                                    />
                                                                    <span className="text-[10px] text-muted-foreground">{site.status === 'INACTIVE' ? 'Pasif' : 'Aktif'}</span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="border-r py-2 text-xs font-semibold">{site.workGroup}</TableCell>
                                                            <TableCell className="border-r py-2 text-xs text-center">{index + 1}</TableCell>
                                                            <TableCell className="border-r py-2 text-xs">{site.projectNo}</TableCell>
                                                            <TableCell className="border-r py-2 text-xs font-medium max-w-[250px] truncate" title={site.name}>{site.name}</TableCell>
                                                            <TableCell className="border-r py-2 text-xs">{site.registrationNo}</TableCell>
                                                            <TableCell className="border-r py-2 text-xs whitespace-nowrap">{site.announcementDate ? format(new Date(site.announcementDate), 'dd.MM.yyyy') : ''}</TableCell>
                                                            <TableCell className="border-r py-2 text-xs whitespace-nowrap">{site.tenderDate ? format(new Date(site.tenderDate), 'dd.MM.yyyy') : ''}</TableCell>
                                                            <TableCell className="border-r py-2 text-xs whitespace-nowrap">{site.contractDate ? format(new Date(site.contractDate), 'dd.MM.yyyy') : ''}</TableCell>
                                                            <TableCell className="border-r py-2 text-xs whitespace-nowrap">{site.siteDeliveryDate ? format(new Date(site.siteDeliveryDate), 'dd.MM.yyyy') : ''}</TableCell>
                                                            <TableCell className="border-r py-2 text-xs whitespace-nowrap">{site.completionDate ? format(new Date(site.completionDate), 'dd.MM.yyyy') : ''}</TableCell>
                                                            <TableCell className="border-r py-2 text-xs whitespace-nowrap">{site.extendedDate ? format(new Date(site.extendedDate), 'dd.MM.yyyy') : ''}</TableCell>

                                                            <TableCell className="border-r py-2 text-xs text-center">
                                                                {(() => {
                                                                    if (!site.tenderDate) return '-';
                                                                    const date = new Date(site.tenderDate);
                                                                    date.setMonth(date.getMonth() - 1); // User requested previous month
                                                                    const year = date.getFullYear();
                                                                    const month = date.getMonth() + 1;
                                                                    const rate = yiUfeRates.find(r => r.year === year && r.month === month);
                                                                    return rate ? rate.index : (site.contractYiUfe || '-');
                                                                })()}
                                                            </TableCell>
                                                            <TableCell className="border-r py-2 text-xs text-center">{site.priceDifferenceCoefficient || '-'}</TableCell>

                                                            <TableCell className="border-r py-2 text-xs text-right font-mono">
                                                                {site.contractPrice ? new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(site.contractPrice) + ' ₺' : '-'}
                                                            </TableCell>
                                                            <TableCell className="border-r py-2 text-xs text-right font-mono">
                                                                {(() => {
                                                                    // Formula: IF(PD<>0; (Base * PD) + Base; ContractPrice)
                                                                    // Base = ContractPrice - RealizedAmount
                                                                    // PD = (Latest / Contract) - 1
                                                                    // Which simplifies to: IF(Ratio != 1; Base * Ratio; ContractPrice)

                                                                    const contractPrice = site.contractPrice || 0;

                                                                    // If Provisional Acceptance is done, return Contract Price
                                                                    if (site.provisionalAcceptanceDate) {
                                                                        return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(contractPrice) + ' ₺';
                                                                    }

                                                                    const realizedAmount = site.realizedAmount || 0;
                                                                    const base = contractPrice - realizedAmount;

                                                                    // 1. Get Base Index (Coeff OR Contract UFE)
                                                                    let baseIndex = site.priceDifferenceCoefficient;

                                                                    // Fallback to Contract UFE if Coeff is missing
                                                                    if (!baseIndex || baseIndex === 0) {
                                                                        baseIndex = site.contractYiUfe;
                                                                        if (site.tenderDate) {
                                                                            const tDate = new Date(site.tenderDate);
                                                                            tDate.setMonth(tDate.getMonth() - 1);
                                                                            const tYear = tDate.getFullYear();
                                                                            const tMonth = tDate.getMonth() + 1;
                                                                            const foundRate = yiUfeRates.find(r => r.year === tYear && r.month === tMonth);
                                                                            if (foundRate) baseIndex = foundRate.index;
                                                                        }
                                                                    }

                                                                    // 2. Get Latest UFE
                                                                    const sortedRates = [...yiUfeRates].sort((a, b) => {
                                                                        if (a.year !== b.year) return b.year - a.year;
                                                                        return b.month - a.month;
                                                                    });
                                                                    const latestUfe = sortedRates[0]?.index;

                                                                    if (baseIndex && baseIndex > 0 && latestUfe) {
                                                                        // Formula: ((Latest / BaseIndex) - 1) * 1 * (Remaining Base) + Remaining Base
                                                                        // simplified: Remaining Base * (Latest / BaseIndex)
                                                                        // But user explicit formula was: ((Contract - Realized) * PriceDiff) + (Contract - Realized)
                                                                        // where PriceDiff = (Latest / BaseIndex) - 1

                                                                        const ratio = latestUfe / baseIndex;
                                                                        const priceDifference = ratio - 1;

                                                                        const term1 = base * priceDifference;
                                                                        const term2 = base;
                                                                        let result = term1 + term2;

                                                                        // User Rule: If result is negative, return Contract Price
                                                                        if (result < 0) {
                                                                            result = contractPrice || 0;
                                                                        }

                                                                        return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(result) + ' ₺';
                                                                    }

                                                                    // Fallback if UFE data missing: Return Base (Contract - Realized)
                                                                    const fallback = base > 0 ? base : 0;
                                                                    return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(fallback) + ' ₺';
                                                                })()}
                                                            </TableCell>
                                                            <TableCell className="border-r py-2 text-xs text-right font-mono">
                                                                {site.realizedAmount ? new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(site.realizedAmount) + ' ₺' : '-'}
                                                            </TableCell>

                                                            <TableCell className="border-r py-2 text-xs text-center whitespace-nowrap">{site.provisionalAcceptanceDate ? format(new Date(site.provisionalAcceptanceDate), 'dd.MM.yyyy') : '-'}</TableCell>
                                                            <TableCell className="border-r py-2 text-xs text-center whitespace-nowrap">{site.finalAcceptanceDate ? format(new Date(site.finalAcceptanceDate), 'dd.MM.yyyy') : '-'}</TableCell>
                                                            <TableCell className="border-r py-2 text-xs text-center">{site.workExperienceCertificate || '-'}</TableCell>
                                                            <TableCell className="border-r py-2 text-xs text-center bg-green-50 text-green-700 font-medium">
                                                                {site.statusDetail || (site.status === 'ACTIVE' ? 'Devam Ediyor' : 'Tamamlandı')}
                                                            </TableCell>
                                                            <TableCell className="border-r py-2 text-xs text-center font-bold">
                                                                {site.partnershipPercentage !== undefined && site.partnershipPercentage !== null ? `%${site.partnershipPercentage}` : '%100'}
                                                            </TableCell>
                                                            <TableCell className="border-r py-2 text-xs text-center">
                                                                {(() => {
                                                                    // 1. Get Contract UFE (Tender Date - 1 Month)
                                                                    let contractUfe = site.contractYiUfe;
                                                                    if (site.tenderDate) {
                                                                        const tDate = new Date(site.tenderDate);
                                                                        tDate.setMonth(tDate.getMonth() - 1);
                                                                        const tYear = tDate.getFullYear();
                                                                        const tMonth = tDate.getMonth() + 1;
                                                                        const foundRate = yiUfeRates.find(r => r.year === tYear && r.month === tMonth);
                                                                        if (foundRate) contractUfe = foundRate.index;
                                                                    }

                                                                    // 2. Get Latest UFE
                                                                    const sortedRates = [...yiUfeRates].sort((a, b) => {
                                                                        if (a.year !== b.year) return b.year - a.year;
                                                                        return b.month - a.month;
                                                                    });
                                                                    const latestUfe = sortedRates[0]?.index;

                                                                    // 3. Calculate Ratio
                                                                    if (contractUfe && latestUfe) {
                                                                        const ratio = latestUfe / contractUfe;
                                                                        return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 6, maximumFractionDigits: 6 }).format(ratio);
                                                                    }
                                                                    return site.contractToCurrentUfeRatio || '-';
                                                                })()}
                                                            </TableCell>
                                                            <TableCell className="border-r py-2 text-xs text-right font-mono">
                                                                {(() => {
                                                                    // 1. Get Contract UFE (Tender Date - 1 Month)
                                                                    let contractUfe = site.contractYiUfe;
                                                                    if (site.tenderDate) {
                                                                        const tDate = new Date(site.tenderDate);
                                                                        tDate.setMonth(tDate.getMonth() - 1);
                                                                        const tYear = tDate.getFullYear();
                                                                        const tMonth = tDate.getMonth() + 1;
                                                                        const foundRate = yiUfeRates.find(r => r.year === tYear && r.month === tMonth);
                                                                        if (foundRate) contractUfe = foundRate.index;
                                                                    }

                                                                    // 2. Get Latest UFE
                                                                    const sortedRates = [...yiUfeRates].sort((a, b) => {
                                                                        if (a.year !== b.year) return b.year - a.year;
                                                                        return b.month - a.month;
                                                                    });
                                                                    const latestUfe = sortedRates[0]?.index;

                                                                    // 3. Calculate Amount
                                                                    // Formula: (Latest / Contract) * RealizedAmount * (Partnership / 100)
                                                                    if (contractUfe && latestUfe && site.realizedAmount) {
                                                                        const ratio = latestUfe / contractUfe;
                                                                        const partnership = site.partnershipPercentage ? (site.partnershipPercentage / 100) : 1;
                                                                        const amount = ratio * site.realizedAmount * partnership;
                                                                        return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount) + ' ₺';
                                                                    }

                                                                    return site.currentWorkExperienceAmount ? new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(site.currentWorkExperienceAmount) + ' ₺' : '-';
                                                                })()}
                                                            </TableCell>
                                                            <TableCell className="border-r py-2 text-xs text-right font-mono">
                                                                {(() => {
                                                                    // Formula: ((( en son ayın yi-üfe rakamı / güncel fiyat farkı katsayısı)-1)*1) 

                                                                    // If Provisional Acceptance is done, Price Diff is 0
                                                                    if (site.provisionalAcceptanceDate) {
                                                                        return '0%';
                                                                    }

                                                                    // 1. Get Latest UFE
                                                                    const sortedRates = [...yiUfeRates].sort((a, b) => {
                                                                        if (a.year !== b.year) return b.year - a.year;
                                                                        return b.month - a.month;
                                                                    });
                                                                    const latestUfe = sortedRates[0]?.index;

                                                                    // 2. Get Price Difference Coefficient from Site (Base Index)
                                                                    const priceDiffCoef = site.priceDifferenceCoefficient;

                                                                    if (latestUfe && priceDiffCoef && priceDiffCoef > 0) {
                                                                        const result = ((latestUfe / priceDiffCoef) - 1) * 100;
                                                                        // Display as Percentage
                                                                        return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(result) + '%';
                                                                    }

                                                                    return site.priceDifference ? new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(site.priceDifference) + ' ₺' : '-';
                                                                })()}
                                                            </TableCell>
                                                            <TableCell className="py-2 text-center">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-6 w-6"
                                                                    onClick={() => openEditSiteModal(site)}
                                                                >
                                                                    <Pencil className="w-3 h-3 text-slate-500 hover:text-blue-600" />
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
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
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
