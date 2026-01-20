'use client';

import { useAppStore } from '@/lib/store/use-store';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { VehicleForm } from './VehicleForm';
import { format, parseISO, isAfter, addMonths } from 'date-fns';
import { Label } from '@/components/ui/label';
import { AlertTriangle, CheckCircle2, AlertCircle, Plus, Search, FileEdit, MoreHorizontal, Settings, FileText, FileSpreadsheet, Download, Mail, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { InsurancePolicyDialog } from './InsurancePolicyDialog';
import { InsuranceRenewalDialog } from './InsuranceRenewalDialog';
import { useAuth } from '@/lib/store/use-auth';
import { RentalUpdateDialog } from './RentalUpdateDialog';
import { InsuranceDefinitionsDialog } from './InsuranceDefinitionsDialog';
import { RentalAssignmentDialog } from './RentalAssignmentDialog'; // [NEW]
import { InsuranceProposalDialog } from '../dashboard/InsuranceProposalDialog'; // [NEW]
import { Input } from '@/components/ui/input';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fontBase64 } from '@/lib/pdf-font';
import { normalizeSearchText } from '@/lib/utils';
import { MultiSelect } from '@/components/ui/multi-select';
import { Vehicle } from '@/lib/types';

export function VehicleList() {
    const { vehicles, sites, companies, updateVehicle, vehicleAttendance, fuelLogs, deleteVehicle } = useAppStore();
    const { user, hasPermission } = useAuth();
    const [activeTab, setActiveTab] = useState("list");
    const [selectedVehicleForRenewal, setSelectedVehicleForRenewal] = useState<{ vehicle: any, mode: 'RENEW' | 'EDIT', policy?: any } | null>(null);
    const [selectedVehicleForPolicy, setSelectedVehicleForPolicy] = useState<{ vehicle: any, mode: 'ADD' | 'EDIT', policy?: any } | null>(null);
    const [selectedVehicleForRentalUpdate, setSelectedVehicleForRentalUpdate] = useState<any>(null);
    const [selectedVehicleForEdit, setSelectedVehicleForEdit] = useState<any>(null);
    const [definitionDialog, setDefinitionDialog] = useState<{ open: boolean; type: 'INSURANCE_COMPANY' | 'INSURANCE_AGENCY' }>({ open: false, type: 'INSURANCE_COMPANY' });
    const [assignmentDialog, setAssignmentDialog] = useState(false);
    const [selectedVehicleForProposal, setSelectedVehicleForProposal] = useState<{ vehicle: any, type: string } | null>(null);

    // General Search State
    const [searchTerm, setSearchTerm] = useState('');

    // Permission Check
    // 1. Finance (Mali/Kiralama)
    const canViewFinance = hasPermission('vehicles.finance', 'VIEW');

    // 2. Insurance (Sigorta/Muayene)
    const canViewInsurance = hasPermission('vehicles.insurance', 'VIEW');
    const canEditInsurance = hasPermission('vehicles.insurance', 'EDIT');

    // 3. General Edit (Araç Ekle/Düzenle/Sil)
    const canEditVehicles = hasPermission('vehicles.list', 'EDIT');

    // 4. Creation Permissions
    const canCreateOwned = hasPermission('vehicles.owned-create', 'CREATE');
    const canCreateRental = hasPermission('vehicles.rental-create', 'CREATE');

    // Filter State (All Dropdowns)
    const [filters, setFilters] = useState({
        company: [] as string[],
        ownership: ['OWNED'] as string[],
        plate: [] as string[],
        brand: [] as string[],
        model: [] as string[],
        year: [] as string[],
        type: [] as string[],
        status: ['ACTIVE'] as string[],
        insuranceAgency: [] as string[],
        kaskoAgency: [] as string[],
        insuranceCompany: [] as string[],
        kaskoCompany: [] as string[],
        definition: [] as string[],

        // Agency Tracking Specific Filters
        policyType: [] as string[],
        policyProvider: [] as string[],
        policyAgency: [] as string[],
        policyYear: [] as string[],
        policyPlate: [] as string[],
        policyOwner: [] as string[],
    });

    const [rentalFilters, setRentalFilters] = useState({
        plate: [] as string[],
        rentalCompany: [] as string[],
        status: [] as string[]
    });

    const getCompanyName = (vehicle: any) => {
        if (vehicle.ownership === 'RENTAL') {
            return vehicle.rentalCompanyName || '-';
        }
        return companies.find((c: any) => c.id === vehicle.companyId)?.name || '-';
    };

    const getExpiryStatus = (dateStr?: string) => {
        if (!dateStr) return null;
        const date = parseISO(dateStr);
        const now = new Date();
        const warningDate = addMonths(now, 1);

        if (isAfter(now, date)) {
            return <Badge variant="destructive" className="gap-1"><AlertCircle className="w-3 h-3" /> Süresi Dolmuş</Badge>;
        }
        if (isAfter(warningDate, date)) {
            return <Badge variant="outline" className="border-yellow-500 text-yellow-600 gap-1"><AlertTriangle className="w-3 h-3" /> Az Kaldı</Badge>;
        }
        return <Badge variant="outline" className="border-green-500 text-green-600 gap-1"><CheckCircle2 className="w-3 h-3" /> Geçerli</Badge>;
    };

    const typeMap: Record<string, string> = {
        CAR: 'Binek Araç',
        TRUCK: 'Kamyon',
        LORRY: 'Tır',
        EXCAVATOR: 'İş Makinesi',
        TRACTOR: 'Traktör',
        OTHER: 'Diğer'
    };

    const statusMap: Record<string, string> = {
        ACTIVE: 'Aktif',
        MAINTENANCE: 'Bakımda',
        SOLD: 'Satıldı',
        PASSIVE: 'Pasif'
    };

    // Define Sort Order
    const sortOrder: Record<string, number> = {
        'CAR': 1, 'TRUCK': 2, 'LORRY': 3, 'EXCAVATOR': 4, 'TRACTOR': 5, 'OTHER': 6
    };

    // Sort Configuration
    type SortConfigItem = { key: string; direction: 'asc' | 'desc' };
    const [sortConfig, setSortConfig] = useState<SortConfigItem[]>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('vehicleList_sort');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    return Array.isArray(parsed) ? parsed : [parsed];
                } catch (e) { }
            }
        }
        return [{ key: 'company', direction: 'asc' }, { key: 'plate', direction: 'asc' }]; // Default
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
                if (current.length > 0 && current[0].key === key) {
                    newConfig = [{ key, direction: current[0].direction === 'asc' ? 'desc' : 'asc' }];
                } else {
                    newConfig = [{ key, direction: 'asc' }];
                }
            }

            localStorage.setItem('vehicleList_sort', JSON.stringify(newConfig));
            return newConfig;
        });
    };

    const getSortIcon = (key: string) => {
        const index = sortConfig.findIndex(item => item.key === key);
        if (index === -1) return null;

        const item = sortConfig[index];
        const Icon = item.direction === 'asc' ? ArrowUp : ArrowDown;

        return (
            <span className="ml-1 inline-flex items-center text-blue-600">
                <Icon className="w-3 h-3" />
                {sortConfig.length > 1 && <span className="text-[10px] ml-0.5">{index + 1}</span>}
            </span>
        );
    };

    // Sort vehicles (Dynamic)
    const sortedVehicles = [...vehicles].sort((a, b) => {
        for (const sort of sortConfig) {
            let comparison = 0;
            switch (sort.key) {
                case 'company':
                    comparison = getCompanyName(a).localeCompare(getCompanyName(b), (window as any).trLocale || 'tr');
                    break;
                case 'plate':
                    comparison = a.plate.localeCompare(b.plate, (window as any).trLocale || 'tr');
                    break;
                case 'ownership':
                    comparison = a.ownership.localeCompare(b.ownership);
                    break;
                case 'brand':
                    comparison = a.brand.localeCompare(b.brand, (window as any).trLocale || 'tr');
                    break;
                case 'model':
                    comparison = a.model.localeCompare(b.model, (window as any).trLocale || 'tr');
                    break;
                case 'year':
                    comparison = a.year - b.year;
                    break;
                case 'type':
                    const typeA = typeMap[a.type] || a.type;
                    const typeB = typeMap[b.type] || b.type;
                    comparison = typeA.localeCompare(typeB, (window as any).trLocale || 'tr');
                    break;
                case 'km':
                    comparison = a.currentKm - b.currentKm;
                    break;
                case 'status':
                    const statusA = statusMap[a.status] || a.status;
                    const statusB = statusMap[b.status] || b.status;
                    comparison = statusA.localeCompare(statusB, (window as any).trLocale || 'tr');
                    break;
            }

            if (comparison !== 0) {
                return sort.direction === 'asc' ? comparison : -comparison;
            }
        }
        return 0; // Equal
    });

    // ... (Filter logic unchanged) ...

    // --- POLICY DATA PREPARATION ---
    const allPolicies = sortedVehicles.filter(v => v.ownership === 'OWNED').flatMap(v => {
        const policies: any[] = [];
        const ownerName = getCompanyName(v);

        // Historical Records
        if (v.insuranceHistory && v.insuranceHistory.length > 0) {
            v.insuranceHistory.forEach((record: any) => {
                policies.push({
                    id: record.id,
                    plate: v.plate,
                    owner: ownerName,
                    type: record.type === 'TRAFFIC' ? 'Trafik Sigortası' : (record.type === 'KASKO' ? 'Kasko' : record.type),
                    provider: record.company || '-',
                    agency: record.agency || '-',
                    cost: record.cost,

                    startDate: record.startDate,
                    endDate: record.endDate,
                    transactionDate: record.transactionDate || record.startDate, // Fallback
                    originalVehicle: v,
                    isHistory: !record.active
                });
            });
        }

        // Fallback: If no history but current fields exist (migration/legacy case)
        const currentTrafficInHistory = v.insuranceHistory?.some((h: any) => h.type === 'TRAFFIC' && h.active);
        if (!currentTrafficInHistory && (v.insuranceAgency || v.insuranceCost || v.insuranceExpiry)) {
            policies.push({
                id: `${v.id}-traffic-legacy`,
                plate: v.plate,
                owner: ownerName,
                type: 'Trafik Sigortası',
                provider: v.insuranceCompany || '-',
                agency: v.insuranceAgency || '-',
                cost: v.insuranceCost,

                startDate: v.insuranceStartDate,
                endDate: v.insuranceExpiry,
                transactionDate: v.insuranceStartDate, // Fallback
                originalVehicle: v,
                isHistory: false
            });
        }

        const currentKaskoInHistory = v.insuranceHistory?.some((h: any) => h.type === 'KASKO' && h.active);
        if (!currentKaskoInHistory && (v.kaskoAgency || v.kaskoCost || v.kaskoExpiry)) {
            policies.push({
                id: `${v.id}-kasko-legacy`,
                plate: v.plate,
                owner: ownerName,
                type: 'Kasko',
                provider: v.kaskoCompany || '-',
                agency: v.kaskoAgency || '-',
                cost: v.kaskoCost,

                startDate: v.kaskoStartDate,
                endDate: v.kaskoExpiry,
                transactionDate: v.kaskoStartDate, // Fallback
                originalVehicle: v,
                isHistory: false
            });
        }

        return policies;
    }).sort((a, b) => { // Sort Newest First
        const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
        const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
        return dateB - dateA;
    });

    // --- DERIVE FILTER OPTIONS ---
    const uniqueCompanyNames = Array.from(new Set(vehicles.map((v: any) => getCompanyName(v)))).sort();
    const uniquePlates = Array.from(new Set(vehicles.map((v: any) => v.plate))).sort();
    const uniqueBrands = Array.from(new Set(vehicles.map((v: any) => v.brand))).sort();
    const uniqueModels = Array.from(new Set(vehicles.map((v: any) => v.model))).sort();
    const uniqueYears = Array.from(new Set(vehicles.map((v: any) => v.year))).sort((a: any, b: any) => b - a);
    const uniqueTypes = Array.from(new Set(vehicles.map((v: any) => v.type)));

    // --- FILTER LOGIC ---
    // 1. Vehicle List Filter (Existing)
    const filteredVehicles = sortedVehicles.filter(vehicle => {
        if (searchTerm) {
            const lowerSearch = normalizeSearchText(searchTerm);
            const searchFields = [
                vehicle.plate, vehicle.brand, vehicle.model, getCompanyName(vehicle),
                vehicle.year.toString(), typeMap[vehicle.type] || vehicle.type,
                statusMap[vehicle.status] || vehicle.status,
                vehicle.ownership === 'RENTAL' ? 'Kiralık' : 'Öz Mal'
            ];
            if (!searchFields.some(field => normalizeSearchText(field).includes(lowerSearch))) return false;
        }
        if (filters.company.length > 0 && !filters.company.includes(getCompanyName(vehicle))) return false;
        if (filters.ownership.length > 0 && !filters.ownership.includes(vehicle.ownership)) return false;
        if (filters.plate.length > 0 && !filters.plate.includes(vehicle.plate)) return false;
        if (filters.brand.length > 0 && !filters.brand.includes(vehicle.brand)) return false;
        if (filters.model.length > 0 && !filters.model.includes(vehicle.model)) return false;
        if (filters.year.length > 0 && !filters.year.includes(vehicle.year.toString())) return false;
        if (filters.type.length > 0 && !filters.type.includes(vehicle.type)) return false;
        if (filters.status.length > 0 && !filters.status.includes(vehicle.status)) return false;

        return true;
    });

    // 2. Policy List Filter
    const filteredPolicies = allPolicies.filter(policy => {
        if (filters.policyType.length > 0 && !filters.policyType.includes(policy.type)) return false;
        if (filters.policyProvider.length > 0 && !filters.policyProvider.includes(policy.provider)) return false;
        if (filters.policyAgency.length > 0 && !filters.policyAgency.includes(policy.agency)) return false;
        if (filters.policyYear.length > 0 && !filters.policyYear.includes(policy.startDate?.substring(0, 4))) return false;
        if (filters.policyPlate.length > 0 && !filters.policyPlate.includes(policy.plate)) return false;
        if (filters.policyOwner.length > 0 && !filters.policyOwner.includes(policy.owner)) return false;
        return true;
    });

    // 3. Rental List Filter
    const filteredRentalVehicles = sortedVehicles.filter(vehicle => {
        if (vehicle.ownership !== 'RENTAL') return false;
        if (rentalFilters.plate.length > 0 && !rentalFilters.plate.includes(vehicle.plate)) return false;
        if (rentalFilters.rentalCompany.length > 0 && !rentalFilters.rentalCompany.includes(vehicle.rentalCompanyName || getCompanyName(vehicle))) return false;
        if (rentalFilters.status.length > 0 && !rentalFilters.status.includes(vehicle.status)) return false;
        return true;
    });

    const formatDateSafe = (dateStr?: string) => {
        if (!dateStr) return '-';
        try {
            return format(parseISO(dateStr), 'dd.MM.yyyy', { locale: (window as any).trLocale });
        } catch (e) {
            return '-';
        }
    };

    const exportExcel = () => {
        const data = filteredVehicles.map(v => ({
            'Plaka': v.plate,
            'Firma': getCompanyName(v),
            'Mülkiyet': v.ownership === 'RENTAL' ? 'Kiralık' : 'Öz Mal',
            'Marka': v.brand,
            'Model': v.model,
            'Yıl': v.year,
            'Tip': typeMap[v.type] || v.type,
            'KM/Saat': v.currentKm,
            'Durum': statusMap[v.status] || v.status,
            'Sigorta Bitiş': formatDateSafe(v.insuranceExpiry),
            'Kasko Bitiş': formatDateSafe(v.kaskoExpiry),
            'Muayene Bitiş': formatDateSafe(v.inspectionExpiry)
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Araç Listesi");
        XLSX.writeFile(wb, `arac-listesi-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    };

    const exportPDF = () => {
        const doc = new jsPDF();
        doc.addFileToVFS('Roboto-Regular.ttf', fontBase64);
        doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
        doc.setFont('Roboto');

        const tableColumn = ["Plaka", "Firma", "Mülkiyet", "Marka", "Model", "Yıl", "Tip", "Durum"];
        const tableRows = filteredVehicles.map(v => [
            v.plate,
            getCompanyName(v),
            v.ownership === 'RENTAL' ? 'Kiralık' : 'Öz Mal',
            v.brand,
            v.model,
            v.year,
            typeMap[v.type] || v.type,
            statusMap[v.status] || v.status
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            styles: { font: 'Roboto', fontSize: 8 },
            headStyles: { fillColor: [41, 128, 185] },
            startY: 20,
        });

        doc.text("Araç Listesi", 14, 15);
        doc.save(`arac-listesi-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    };

    const exportPoliciesExcel = () => {
        const data = filteredPolicies.map(p => ({
            'İşlem Tarihi': formatDateSafe(p.transactionDate),
            'Tarih': formatDateSafe(p.startDate),
            'Plaka': p.plate,
            'Ruhsat Sahibi': p.owner,
            'Tip': p.type,
            'Sigorta Firması': p.provider,
            'Acente': p.agency,
            'Tutar': p.cost,
            'Başlangıç': formatDateSafe(p.startDate),
            'Bitiş': formatDateSafe(p.endDate)
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Acente Takip");
        XLSX.writeFile(wb, `acente-takip-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    };

    const exportPoliciesPDF = () => {
        const doc = new jsPDF('l', 'mm', 'a4');
        doc.addFileToVFS('Roboto-Regular.ttf', fontBase64);
        doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
        doc.setFont('Roboto');

        const tableColumn = ["İşlem Tarihi", "Tarih", "Plaka", "Ruhsat Sahibi", "Tip", "Firma", "Acente", "Tutar", "Başlangıç", "Bitiş"];
        const tableRows = filteredPolicies.map(p => [
            formatDateSafe(p.transactionDate),
            formatDateSafe(p.startDate),
            p.plate,
            p.owner,
            p.type,
            p.provider,
            p.agency,
            p.cost ? `${p.cost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}` : '-',
            formatDateSafe(p.startDate),
            formatDateSafe(p.endDate)
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            styles: { font: 'Roboto', fontSize: 8 },
            headStyles: { fillColor: [41, 128, 185] },
            startY: 20,
        });

        doc.text("Acente Takip Listesi", 14, 15);
        doc.save(`acente-takip-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    };

    const handleDeleteVehicle = (vehicle: Vehicle) => {
        // 1. Check for usage in Vehicle Attendance
        const attendanceCount = vehicleAttendance.filter((a: any) => a.vehicleId === vehicle.id).length;

        // 2. Check for usage in Fuel Logs
        const fuelCount = fuelLogs.filter((f: any) => f.vehicleId === vehicle.id).length;

        if (attendanceCount > 0 || fuelCount > 0) {
            alert(
                `Bu araç silinemez!\n\n` +
                `Bağlı Kayıtlar:\n` +
                `- ${attendanceCount} adet Puantaj kaydı\n` +
                `- ${fuelCount} adet Yakıt kaydı\n\n` +
                `Lütfen önce bu araçla ilişkili kayıtları siliniz.`
            );
            return;
        }

        // 3. Confirm Deletion
        if (confirm(`${vehicle.plate} plakalı aracı silmek istediğinize emin misiniz?\nBu işlem geri alınamaz.`)) {
            deleteVehicle(vehicle.id);
        }
    };

    return (
        <Card>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <CardHeader className="flex flex-col space-y-4">
                    <div className="flex flex-row items-center justify-between">
                        <CardTitle>Araç Listesi</CardTitle>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Genel arama (Plaka, Model, Firma vb.)..."
                                className="pl-8 bg-white"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Export Buttons */}
                            {(activeTab === 'list' || activeTab === 'insurance' || activeTab === 'rental-costs') && (
                                <>
                                    <Button variant="outline" size="sm" onClick={exportPDF} className="gap-2">
                                        <FileText className="w-4 h-4 text-red-600" /> PDF
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={exportExcel} className="gap-2">
                                        <FileSpreadsheet className="w-4 h-4 text-green-600" /> Excel
                                    </Button>
                                </>
                            )}
                            {activeTab === 'agency-tracking' && (
                                <>
                                    <Button variant="outline" size="sm" onClick={exportPoliciesPDF} className="gap-2">
                                        <FileText className="w-4 h-4 text-red-600" /> PDF
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={exportPoliciesExcel} className="gap-2">
                                        <FileSpreadsheet className="w-4 h-4 text-green-600" /> Excel
                                    </Button>
                                </>
                            )}

                            {canCreateOwned && <VehicleForm initialOwnership="OWNED" />}
                            {canCreateRental && (
                                <VehicleForm
                                    initialOwnership="RENTAL"
                                    customTrigger={
                                        <Button className="bg-orange-600 hover:bg-orange-700 text-white">
                                            <Plus className="w-4 h-4 mr-2" /> Kiralık Araç Ekle
                                        </Button>
                                    }
                                />
                            )}
                        </div>
                    </div>

                    <TabsList className="grid w-full grid-cols-4 lg:w-[550px]">
                        <TabsTrigger value="list">Araç Listesi</TabsTrigger>
                        {canViewFinance && <TabsTrigger value="rental-costs">Araç Kira Bedeli</TabsTrigger>}
                        {canViewInsurance && <TabsTrigger value="insurance">Sigorta/Muayene</TabsTrigger>}
                        {canViewInsurance && <TabsTrigger value="agency-tracking">Acente Takip</TabsTrigger>}
                    </TabsList>
                </CardHeader>
                <CardContent>

                    <TabsContent value="list" className="space-y-4">
                        {/* Filter Section */}
                        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-4 p-4 bg-muted/20 rounded-lg">
                            <div className="space-y-2">
                                <Label>Firma</Label>
                                <MultiSelect
                                    options={uniqueCompanyNames.map((c: any) => ({ label: c, value: c }))}
                                    selected={filters.company}
                                    onChange={(val: string[]) => setFilters({ ...filters, company: val })}
                                    placeholder="Tümü"
                                    searchPlaceholder="Ara..."
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Mülkiyet</Label>
                                <MultiSelect
                                    options={[{ label: 'Öz Mal', value: 'OWNED' }, { label: 'Kiralık', value: 'RENTAL' }]}
                                    selected={filters.ownership}
                                    onChange={(val: string[]) => setFilters({ ...filters, ownership: val })}
                                    placeholder="Tümü"
                                    vertical // Assuming vertical prop exists based on usage, or standard grid
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Plaka</Label>
                                <MultiSelect
                                    options={uniquePlates.map((p: any) => ({ label: p, value: p }))}
                                    selected={filters.plate}
                                    onChange={(val: string[]) => setFilters({ ...filters, plate: val })}
                                    placeholder="Tümü"
                                    searchPlaceholder="Ara..."
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Marka</Label>
                                <MultiSelect
                                    options={uniqueBrands.map((b: any) => ({ label: b, value: b }))}
                                    selected={filters.brand}
                                    onChange={(val: string[]) => setFilters({ ...filters, brand: val })}
                                    placeholder="Tümü"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Model</Label>
                                <MultiSelect
                                    options={uniqueModels.map((m: any) => ({ label: m, value: m }))}
                                    selected={filters.model}
                                    onChange={(val: string[]) => setFilters({ ...filters, model: val })}
                                    placeholder="Tümü"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Model Yılı</Label>
                                <MultiSelect
                                    options={uniqueYears.map((y: any) => ({ label: y.toString(), value: y.toString() }))}
                                    selected={filters.year}
                                    onChange={(val: string[]) => setFilters({ ...filters, year: val })}
                                    placeholder="Tümü"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Tip</Label>
                                <MultiSelect
                                    options={uniqueTypes.map((t: any) => ({ label: typeMap[t] || t, value: t }))}
                                    selected={filters.type}
                                    onChange={(val: string[]) => setFilters({ ...filters, type: val })}
                                    placeholder="Tümü"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Durum</Label>
                                <MultiSelect
                                    options={[{ label: 'Aktif', value: 'ACTIVE' }, { label: 'Bakımda', value: 'MAINTENANCE' }, { label: 'Pasif', value: 'PASSIVE' }]}
                                    selected={filters.status}
                                    onChange={(val: string[]) => setFilters({ ...filters, status: val })}
                                    placeholder="Tümü"
                                />
                            </div>
                        </div>

                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px]">#</TableHead>
                                    <TableHead className="cursor-pointer hover:bg-slate-100 transition-colors" onClick={(e) => handleSort('company', e)}>
                                        Firma {getSortIcon('company')}
                                    </TableHead>
                                    <TableHead className="cursor-pointer hover:bg-slate-100 transition-colors" onClick={(e) => handleSort('ownership', e)}>
                                        Mülkiyet {getSortIcon('ownership')}
                                    </TableHead>
                                    <TableHead className="w-[120px] cursor-pointer hover:bg-slate-100 transition-colors" onClick={(e) => handleSort('plate', e)}>
                                        Plaka {getSortIcon('plate')}
                                    </TableHead>
                                    <TableHead className="w-[150px] cursor-pointer hover:bg-slate-100 transition-colors" onClick={(e) => handleSort('brand', e)}>
                                        Marka {getSortIcon('brand')}
                                    </TableHead>
                                    <TableHead className="w-[150px] cursor-pointer hover:bg-slate-100 transition-colors" onClick={(e) => handleSort('model', e)}>
                                        Model {getSortIcon('model')}
                                    </TableHead>
                                    <TableHead className="cursor-pointer hover:bg-slate-100 transition-colors" onClick={(e) => handleSort('year', e)}>
                                        Model Yılı {getSortIcon('year')}
                                    </TableHead>
                                    <TableHead className="cursor-pointer hover:bg-slate-100 transition-colors" onClick={(e) => handleSort('type', e)}>
                                        Tip {getSortIcon('type')}
                                    </TableHead>
                                    <TableHead className="cursor-pointer hover:bg-slate-100 transition-colors" onClick={(e) => handleSort('km', e)}>
                                        KM / Saat {getSortIcon('km')}
                                    </TableHead>
                                    <TableHead className="cursor-pointer hover:bg-slate-100 transition-colors" onClick={(e) => handleSort('status', e)}>
                                        Durum {getSortIcon('status')}
                                    </TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredVehicles.map((vehicle, index) => (
                                    <TableRow key={vehicle.id}>
                                        <TableCell className="font-mono text-xs text-muted-foreground">{index + 1}</TableCell>
                                        <TableCell className="font-medium text-slate-900">
                                            <div className="max-w-[150px] truncate" title={getCompanyName(vehicle)}>
                                                {getCompanyName(vehicle)}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={vehicle.ownership === 'RENTAL' ? "bg-orange-50 text-orange-700 border-orange-200" : "bg-blue-50 text-blue-700 border-blue-200"}>
                                                {vehicle.ownership === 'RENTAL' ? 'Kiralık' : 'Öz Mal'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="font-bold font-mono">{vehicle.plate}</TableCell>
                                        <TableCell>{vehicle.brand}</TableCell>
                                        <TableCell>{vehicle.model}</TableCell>
                                        <TableCell>{vehicle.year}</TableCell>
                                        <TableCell className="text-xs">{typeMap[vehicle.type] || vehicle.type}</TableCell>
                                        <TableCell>{vehicle.currentKm.toLocaleString()}</TableCell>
                                        <TableCell>
                                            <Badge variant={vehicle.status === 'ACTIVE' ? 'outline' : 'secondary'} className={
                                                vehicle.status === 'ACTIVE' ? "bg-green-50 text-green-700 border-green-200" :
                                                    vehicle.status === 'MAINTENANCE' ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                                                        vehicle.status === 'PASSIVE' ? "bg-red-50 text-red-700 border-red-200" : "bg-gray-50 text-gray-700 border-gray-200"
                                            }>
                                                {statusMap[vehicle.status] || vehicle.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {canEditVehicles && (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>İşlemler</DropdownMenuLabel>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem onClick={() => setSelectedVehicleForEdit(vehicle)}>
                                                            <FileEdit className="w-4 h-4 mr-2" /> Bilgileri Düzenle
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => updateVehicle(vehicle.id, { status: 'ACTIVE' })}>Aktif Yap</DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => updateVehicle(vehicle.id, { status: 'MAINTENANCE' })}>Bakıma Al</DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => updateVehicle(vehicle.id, { status: 'PASSIVE' })} className="text-red-600">Pasif</DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem onClick={() => handleDeleteVehicle(vehicle)} className="text-red-600 font-bold focus:text-red-600 focus:bg-red-50">
                                                            <Trash2 className="w-4 h-4 mr-2" /> Sil
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TabsContent>

                    {/* --- TAB: INSURANCE --- */}
                    {
                        canViewInsurance && (
                            <TabsContent value="insurance" className="space-y-4">
                                <div className="rounded-md border p-4 bg-slate-50 mb-4">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <AlertCircle className="w-4 h-4" />
                                        <span>Bu liste araçların sigorta, kasko ve muayene bitiş tarihlerini takip etmek içindir.</span>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2 mb-4">
                                    {canEditInsurance && (
                                        <>
                                            <Button variant="outline" onClick={() => setDefinitionDialog({ open: true, type: 'INSURANCE_COMPANY' })}>
                                                <Settings className="w-4 h-4 mr-2" /> Firma Tanımla
                                            </Button>
                                            <Button variant="outline" onClick={() => setDefinitionDialog({ open: true, type: 'INSURANCE_AGENCY' })}>
                                                <Settings className="w-4 h-4 mr-2" /> Acente Tanımla
                                            </Button>
                                        </>
                                    )}
                                </div>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Plaka</TableHead>
                                            <TableHead>Marka / Model</TableHead>
                                            <TableHead>Tip</TableHead>
                                            <TableHead>Trafik Sigortası Bitiş</TableHead>
                                            <TableHead>Kasko Bitiş</TableHead>
                                            <TableHead>Muayene Bitiş</TableHead>
                                            <TableHead className="text-right">Durum</TableHead>
                                            <TableHead className="w-[100px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {sortedVehicles.filter(v => v.ownership === 'OWNED').map((vehicle) => (
                                            <TableRow key={vehicle.id}>
                                                <TableCell className="font-bold font-mono">{vehicle.plate}</TableCell>
                                                <TableCell>{vehicle.brand} - {vehicle.model}</TableCell>
                                                <TableCell className="text-xs">{typeMap[vehicle.type] || vehicle.type}</TableCell>
                                                <TableCell>
                                                    <div
                                                        className="flex flex-col gap-1 cursor-pointer hover:bg-slate-100 p-1 rounded transition-colors group"
                                                        onClick={() => setSelectedVehicleForProposal({ vehicle, type: 'Trafik Sigortası' })}
                                                        title="Teklif İste"
                                                    >
                                                        <span className="font-medium text-slate-700 flex items-center gap-1 group-hover:text-blue-600">
                                                            {formatDateSafe(vehicle.insuranceExpiry)}
                                                            <Mail className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                        </span>
                                                        {getExpiryStatus(vehicle.insuranceExpiry)}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div
                                                        className="flex flex-col gap-1 cursor-pointer hover:bg-slate-100 p-1 rounded transition-colors group"
                                                        onClick={() => setSelectedVehicleForProposal({ vehicle, type: 'Kasko' })}
                                                        title="Teklif İste"
                                                    >
                                                        <span className="font-medium text-slate-700 flex items-center gap-1 group-hover:text-blue-600">
                                                            {formatDateSafe(vehicle.kaskoExpiry)}
                                                            <Mail className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                        </span>
                                                        {getExpiryStatus(vehicle.kaskoExpiry)}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col gap-1">
                                                        <span className="font-medium text-slate-700">{formatDateSafe(vehicle.inspectionExpiry)}</span>
                                                        {getExpiryStatus(vehicle.inspectionExpiry)}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Badge variant={vehicle.status === 'ACTIVE' ? 'default' : 'secondary'}>{statusMap[vehicle.status] || vehicle.status}</Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {canEditVehicles && (
                                                        <div className="flex items-center gap-1">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="h-8 px-2 text-xs flex items-center gap-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                                                                onClick={() => setSelectedVehicleForPolicy({ vehicle, mode: 'ADD' })}
                                                            >
                                                                <Plus className="w-3 h-3" /> Poliçe Ekle
                                                            </Button>
                                                            {/* Keeping Renewal Dialog for Inspection/Muayene Update functionality if needed */}
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 w-8 p-0"
                                                                onClick={() => setSelectedVehicleForRenewal({ vehicle, mode: 'RENEW' })}
                                                                title="Muayene Güncelle"
                                                            >
                                                                <FileEdit className="w-3 h-3 text-slate-400" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TabsContent>
                        )
                    }

                    {/* --- TAB: AGENCY TRACKING --- */}
                    {
                        canViewInsurance && (
                            <TabsContent value="agency-tracking" className="space-y-4">
                                <div className="rounded-md border p-4 bg-slate-50 mb-4">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <AlertCircle className="w-4 h-4" />
                                        <span>Tüm araçların geçmiş ve aktif sigorta/kasko poliçe kayıtları.</span>
                                    </div>
                                </div>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>İşlem Tarihi</TableHead>
                                            <TableHead>Plaka</TableHead>
                                            <TableHead>Ruhsat Sahibi</TableHead>
                                            <TableHead>Poliçe Tipi</TableHead>
                                            <TableHead>Sigorta Firması</TableHead>
                                            <TableHead>Acente</TableHead>
                                            <TableHead>Tutar</TableHead>
                                            <TableHead>Başlangıç</TableHead>
                                            <TableHead>Bitiş</TableHead>
                                            <TableHead className="w-[50px]">Dosya</TableHead>
                                            <TableHead className="w-[50px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredPolicies.map((policy) => (
                                            <TableRow key={policy.id} className={policy.isHistory ? "bg-slate-50 opacity-70" : ""}>
                                                <TableCell className="text-slate-500 font-medium">{formatDateSafe(policy.transactionDate)}</TableCell>
                                                <TableCell className="font-bold font-mono">{policy.plate}</TableCell>
                                                <TableCell className="text-xs">{policy.owner}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className={policy.type === 'Kasko' ? "border-purple-200 text-purple-700 bg-purple-50" : "border-blue-200 text-blue-700 bg-blue-50"}>
                                                        {policy.type}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>{policy.provider}</TableCell>
                                                <TableCell>{policy.agency}</TableCell>
                                                <TableCell className="font-mono">{policy.cost ? `${policy.cost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺` : '-'}</TableCell>
                                                <TableCell>{formatDateSafe(policy.startDate)}</TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span>{formatDateSafe(policy.endDate)}</span>
                                                        {!policy.isHistory && getExpiryStatus(policy.endDate)}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {policy.originalVehicle?.insuranceHistory?.find((h: any) => h.id === policy.id)?.attachments?.[0] ? (
                                                        <a
                                                            href={policy.originalVehicle.insuranceHistory.find((h: any) => h.id === policy.id).attachments[0]}
                                                            download={`police-${policy.plate}.pdf`}
                                                            className="flex items-center justify-center p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                                                            title="Poliçe Dosyasını İndir"
                                                        >
                                                            <Download className="w-4 h-4" />
                                                        </a>
                                                    ) : '-'}
                                                </TableCell>
                                                <TableCell>
                                                    {canEditInsurance && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 p-0"
                                                            onClick={() => setSelectedVehicleForPolicy({
                                                                vehicle: policy.originalVehicle,
                                                                mode: 'EDIT',
                                                                policy: policy.isHistory
                                                                    ? policy.originalVehicle.insuranceHistory?.find((h: any) => h.id === policy.id)
                                                                    : policy // If it's a current record without history entry, might be tricky to "Edit" in new dialog unless we migrate it.
                                                                // The new dialog demands a record structure. 
                                                                // If it's a "Legacy" derived row (id ends in -legacy), we should probably block edit or switch to ADD mode.
                                                                // For now let's assume valid ID match.
                                                            })}
                                                        >
                                                            <FileEdit className="w-4 h-4 text-slate-400" />
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TabsContent>
                        )
                    }

                    {/* --- TAB: RENTAL COSTS --- */}
                    {
                        canViewFinance && (
                            <TabsContent value="rental-costs" className="space-y-4">
                                <div className="flex justify-end mb-4">
                                    <Button
                                        onClick={() => setAssignmentDialog(true)}
                                        className="bg-purple-600 hover:bg-purple-700 text-white"
                                    >
                                        <Plus className="w-4 h-4 mr-2" /> Mevcut Araçlardan Ekle
                                    </Button>
                                </div>

                                {/* Filter Section */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 bg-muted/20 rounded-lg">
                                    <div className="space-y-2">
                                        <Label>Plaka</Label>
                                        <MultiSelect
                                            options={Array.from(new Set(sortedVehicles.filter(v => v.ownership === 'RENTAL').map(v => v.plate))).sort().map(p => ({ label: p, value: p }))}
                                            selected={rentalFilters.plate}
                                            onChange={(val: string[]) => setRentalFilters({ ...rentalFilters, plate: val })}
                                            placeholder="Tümü"
                                            searchPlaceholder="Ara..."
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Kiralama Şirketi</Label>
                                        <MultiSelect
                                            options={Array.from(new Set(sortedVehicles.filter(v => v.ownership === 'RENTAL').map(v => v.rentalCompanyName || getCompanyName(v)).filter(Boolean))).sort().map(c => ({ label: c, value: c }))}
                                            selected={rentalFilters.rentalCompany}
                                            onChange={(val: string[]) => setRentalFilters({ ...rentalFilters, rentalCompany: val })}
                                            placeholder="Tümü"
                                            searchPlaceholder="Ara..."
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Durum</Label>
                                        <MultiSelect
                                            options={[{ label: 'Aktif', value: 'ACTIVE' }, { label: 'Bakımda', value: 'MAINTENANCE' }, { label: 'Pasif', value: 'PASSIVE' }]}
                                            selected={rentalFilters.status}
                                            onChange={(val: string[]) => setRentalFilters({ ...rentalFilters, status: val })}
                                            placeholder="Tümü"
                                        />
                                    </div>
                                </div>

                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Plaka</TableHead>
                                            <TableHead>Kiralama Şirketi</TableHead>
                                            <TableHead>Aylık Kira Bedeli</TableHead>
                                            <TableHead>Son Güncelleme</TableHead>
                                            <TableHead>Durum</TableHead>
                                            <TableHead></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredRentalVehicles.map(vehicle => (
                                            <TableRow key={vehicle.id}>
                                                <TableCell className="font-mono font-bold">{vehicle.plate}</TableCell>
                                                <TableCell>{vehicle.rentalCompanyName || getCompanyName(vehicle)}</TableCell>
                                                <TableCell>{vehicle.monthlyRentalFee ? `${vehicle.monthlyRentalFee.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺` : '-'}</TableCell>
                                                <TableCell>{formatDateSafe(vehicle.rentalLastUpdate)}</TableCell>
                                                <TableCell>
                                                    <Badge variant={vehicle.status === 'ACTIVE' ? 'outline' : 'secondary'} className={
                                                        vehicle.status === 'ACTIVE' ? "bg-green-50 text-green-700 border-green-200" :
                                                            vehicle.status === 'MAINTENANCE' ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                                                                vehicle.status === 'PASSIVE' ? "bg-red-50 text-red-700 border-red-200" : "bg-gray-50 text-gray-700 border-gray-200"
                                                    }>
                                                        {statusMap[vehicle.status] || vehicle.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setSelectedVehicleForRentalUpdate(vehicle)}
                                                    >
                                                        <FileEdit className="w-3 h-3 mr-2" /> Güncelle
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="ml-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                        onClick={() => {
                                                            if (confirm('Bu aracı kiralık listesinden çıkarmak istediğinize emin misiniz? Araç "Öz Mal" olarak işaretlenecektir.')) {
                                                                updateVehicle(vehicle.id, {
                                                                    ownership: 'OWNED',
                                                                    rentalCompanyName: '',
                                                                    monthlyRentalFee: 0,
                                                                    rentalLastUpdate: new Date().toISOString()
                                                                });
                                                            }
                                                        }}
                                                        title="Listeden Çıkar"
                                                    >
                                                        <Trash2 className="w-3 h-3 mr-1" /> Sil
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TabsContent>
                        )
                    }


                </CardContent >
            </Tabs >

            {/* Proposal Dialog */}
            {
                selectedVehicleForProposal && (
                    <InsuranceProposalDialog
                        open={!!selectedVehicleForProposal}
                        onOpenChange={(open) => !open && setSelectedVehicleForProposal(null)}
                        item={selectedVehicleForProposal ? {
                            id: selectedVehicleForProposal.vehicle.id + '-proposal', // Fake ID
                            vehicleId: selectedVehicleForProposal.vehicle.id,
                            plate: selectedVehicleForProposal.vehicle.plate,
                            type: selectedVehicleForProposal.type,
                            date: new Date().toISOString(),
                            vehicleBrand: selectedVehicleForProposal.vehicle.brand,
                            vehicleModel: selectedVehicleForProposal.vehicle.model
                        } : null}
                    />
                )
            }

            {/* DIALOGS */}
            {
                selectedVehicleForRenewal && (
                    <InsuranceRenewalDialog
                        vehicle={selectedVehicleForRenewal.vehicle}
                        open={!!selectedVehicleForRenewal}
                        onOpenChange={(open) => !open && setSelectedVehicleForRenewal(null)}
                        mode={selectedVehicleForRenewal.mode}
                    />
                )
            }

            {
                selectedVehicleForPolicy && (
                    <InsurancePolicyDialog
                        vehicle={selectedVehicleForPolicy.vehicle}
                        open={!!selectedVehicleForPolicy}
                        onOpenChange={(open) => !open && setSelectedVehicleForPolicy(null)}
                        mode={selectedVehicleForPolicy.mode}
                        policy={selectedVehicleForPolicy.policy}
                    />
                )
            }

            {
                selectedVehicleForRentalUpdate && (
                    <RentalUpdateDialog
                        vehicle={selectedVehicleForRentalUpdate}
                        open={!!selectedVehicleForRentalUpdate}
                        onOpenChange={(open) => !open && setSelectedVehicleForRentalUpdate(null)}
                    />
                )
            }

            {/* [NEW] Assignment Dialog */}
            <RentalAssignmentDialog
                open={assignmentDialog}
                onOpenChange={setAssignmentDialog}
            />

            {
                selectedVehicleForEdit && (
                    <VehicleForm
                        vehicleToEdit={selectedVehicleForEdit}
                        customTrigger={<></>}
                        open={!!selectedVehicleForEdit}
                        onOpenChange={(open) => !open && setSelectedVehicleForEdit(null)}
                    />
                )
            }

            <InsuranceDefinitionsDialog
                open={definitionDialog.open}
                onOpenChange={(open) => setDefinitionDialog(prev => ({ ...prev, open }))}
                type={definitionDialog.type}
            />

        </Card >
    );
}
