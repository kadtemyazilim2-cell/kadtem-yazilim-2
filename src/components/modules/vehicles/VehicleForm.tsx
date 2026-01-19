'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store/use-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2 } from 'lucide-react';
import { Vehicle } from '@/lib/types';
import { toast } from "sonner";
import { Download, FileText, X } from "lucide-react"; // [NEW] Icons

interface VehicleFormProps {
    initialOwnership?: 'OWNED' | 'RENTAL';
    customTrigger?: React.ReactNode;
    onSuccess?: () => void;
    vehicleToEdit?: Vehicle;
    open?: boolean; // [NEW]
    onOpenChange?: (open: boolean) => void; // [NEW]
}

import { useAuth } from '@/lib/store/use-auth';

import { createVehicle, updateVehicle, deleteVehicle } from '@/actions/vehicle';

interface VehicleFormData {
    plate: string;
    brand: string;
    model: string;
    year?: number;
    type: 'CAR' | 'TRUCK' | 'LORRY' | 'EXCAVATOR' | 'TRACTOR' | 'OTHER';
    ownership: 'OWNED' | 'RENTAL';
    meterType: 'KM' | 'HOURS';
    currentKm: number;
    status: 'ACTIVE' | 'PASSIVE' | 'SOLD' | 'PERT';

    // Dates as strings for Input type="date"
    insuranceExpiry: string;
    kaskoExpiry: string;
    inspectionExpiry: string;
    lastInspectionDate: string;

    insuranceCost: number;
    kaskoCost: number;
    insuranceAgency: string;
    kaskoAgency: string;
    definition: string;

    companyId: string;
    rentalCompanyName: string;
    rentalContact: string;
    assignedSiteId: string;

    engineNumber: string;
    chassisNumber: string;
    fuelType: 'DIESEL' | 'GASOLINE' | 'LPG' | 'ELECTRIC' | 'HYBRID';
    licenseFile: string;
}

export function VehicleForm({ initialOwnership = 'OWNED', customTrigger, onSuccess, vehicleToEdit, open: controlledOpen, onOpenChange: controlledOnOpenChange }: VehicleFormProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const { hasPermission } = useAuth();

    // Permission Check
    const canCreateOwned = hasPermission('vehicles.owned-create', 'CREATE');
    const canCreateRental = hasPermission('vehicles.rental-create', 'CREATE');
    const canEdit = hasPermission('vehicles.list', 'EDIT');

    const hasAccess = vehicleToEdit
        ? canEdit
        : (initialOwnership === 'RENTAL' ? canCreateRental : canCreateOwned);

    // Derived state
    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : internalOpen;
    const setOpen = (value: boolean) => {
        if (isControlled && controlledOnOpenChange) {
            controlledOnOpenChange(value);
        } else {
            setInternalOpen(value);
        }
    };

    // Store is now ONLY used for reading lists (companies, sites)
    const { companies, sites } = useAppStore();

    // Helper to format Date to YYYY-MM-DD
    const formatDate = (date?: Date | string | null) => {
        if (!date) return '';
        const d = new Date(date);
        return d.toISOString().split('T')[0];
    };

    const [formData, setFormData] = useState<VehicleFormData>({
        plate: vehicleToEdit?.plate || '',
        brand: vehicleToEdit?.brand || '',
        model: vehicleToEdit?.model || '',
        year: vehicleToEdit?.year,
        type: (vehicleToEdit?.type as any) || 'CAR',
        meterType: (vehicleToEdit?.meterType as any) || 'KM',
        currentKm: vehicleToEdit?.currentKm || 0,
        status: (vehicleToEdit?.status as any) || 'ACTIVE',
        ownership: (vehicleToEdit?.ownership as any) || initialOwnership,

        insuranceExpiry: formatDate(vehicleToEdit?.insuranceExpiry),
        kaskoExpiry: formatDate(vehicleToEdit?.kaskoExpiry),
        inspectionExpiry: formatDate(vehicleToEdit?.inspectionExpiry),
        lastInspectionDate: formatDate(vehicleToEdit?.lastInspectionDate),

        insuranceCost: vehicleToEdit?.insuranceCost || 0,
        kaskoCost: vehicleToEdit?.kaskoCost || 0,
        insuranceAgency: vehicleToEdit?.insuranceAgency || '',
        kaskoAgency: vehicleToEdit?.kaskoAgency || '',
        definition: vehicleToEdit?.definition || '',

        companyId: vehicleToEdit?.companyId || '',
        rentalCompanyName: vehicleToEdit?.rentalCompanyName || '',
        rentalContact: vehicleToEdit?.rentalContact || '',
        assignedSiteId: vehicleToEdit?.assignedSiteId || '',

        engineNumber: vehicleToEdit?.engineNumber || '',
        chassisNumber: vehicleToEdit?.chassisNumber || '',
        fuelType: (vehicleToEdit?.fuelType as any) || 'DIESEL',
        licenseFile: vehicleToEdit?.licenseFile || '',
    });

    // Reset form when modal opens
    useEffect(() => {
        if (open) {
            setFormData({
                plate: vehicleToEdit?.plate || '',
                brand: vehicleToEdit?.brand || '',
                model: vehicleToEdit?.model || '',
                year: vehicleToEdit?.year,
                type: (vehicleToEdit?.type as any) || 'CAR',
                meterType: (vehicleToEdit?.meterType as any) || 'KM',
                currentKm: vehicleToEdit?.currentKm || 0,
                status: (vehicleToEdit?.status as any) || 'ACTIVE',
                ownership: (vehicleToEdit?.ownership as any) || initialOwnership,

                insuranceExpiry: formatDate(vehicleToEdit?.insuranceExpiry),
                kaskoExpiry: formatDate(vehicleToEdit?.kaskoExpiry),
                inspectionExpiry: formatDate(vehicleToEdit?.inspectionExpiry),
                lastInspectionDate: formatDate(vehicleToEdit?.lastInspectionDate),

                insuranceCost: vehicleToEdit?.insuranceCost || 0,
                kaskoCost: vehicleToEdit?.kaskoCost || 0,
                insuranceAgency: vehicleToEdit?.insuranceAgency || '',
                kaskoAgency: vehicleToEdit?.kaskoAgency || '',
                definition: vehicleToEdit?.definition || '',

                companyId: vehicleToEdit?.companyId || '',
                rentalCompanyName: vehicleToEdit?.rentalCompanyName || '',
                rentalContact: vehicleToEdit?.rentalContact || '',
                assignedSiteId: vehicleToEdit?.assignedSiteId || '',

                engineNumber: vehicleToEdit?.engineNumber || '',
                chassisNumber: vehicleToEdit?.chassisNumber || '',
                fuelType: (vehicleToEdit?.fuelType as any) || 'DIESEL',
                licenseFile: vehicleToEdit?.licenseFile || '',
            });
        }
    }, [open, vehicleToEdit, initialOwnership]);

    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation based on ownership
        const errors: Record<string, string> = {};
        let isValid = true;

        if (formData.ownership === 'OWNED') {
            if (!formData.plate) errors.plate = "Plaka zorunludur";
            if (!formData.companyId) errors.companyId = "Firma seçimi zorunludur";
            if (!formData.brand) errors.brand = "Marka zorunludur";
            if (!formData.model) errors.model = "Model zorunludur";
            if (!formData.year) errors.year = "Yıl zorunludur";
            if (!formData.type) errors.type = "Cinsi zorunludur";
            if (!formData.meterType) errors.meterType = "Sayaç tipi zorunludur";
            if (formData.currentKm === undefined) errors.currentKm = "Güncel gösterge zorunludur";

            if (Object.keys(errors).length > 0) isValid = false;
        }

        if (formData.ownership === 'RENTAL') {
            if (!formData.plate) errors.plate = "Plaka zorunludur";
            if (!formData.rentalCompanyName) errors.rentalCompanyName = "Kiralama firması zorunludur";
            if (!formData.brand) errors.brand = "Marka zorunludur";
            if (!formData.model) errors.model = "Model zorunludur";
            if (!formData.year) errors.year = "Yıl zorunludur";
            if (!formData.type) errors.type = "Cinsi zorunludur";
            if (!formData.meterType) errors.meterType = "Sayaç tipi zorunludur";
            if (formData.currentKm === undefined) errors.currentKm = "Güncel gösterge zorunludur";
            if (!formData.assignedSiteId) errors.assignedSiteId = "Şantiye seçimi zorunludur";

            if (Object.keys(errors).length > 0) isValid = false;
        }

        if (!isValid) {
            setFormErrors(errors);
            toast.error("Lütfen işaretli alanları doldurunuz.");
            return;
        }

        setFormErrors({});

        // Prepare payload for server action
        const payload: any = { ...formData };

        // Convert strings to Dates or null
        payload.insuranceExpiry = payload.insuranceExpiry ? new Date(payload.insuranceExpiry) : null;
        payload.kaskoExpiry = payload.kaskoExpiry ? new Date(payload.kaskoExpiry) : null;
        payload.inspectionExpiry = payload.inspectionExpiry ? new Date(payload.inspectionExpiry) : null;
        payload.lastInspectionDate = payload.lastInspectionDate ? new Date(payload.lastInspectionDate) : null;

        // Number Conversions
        if (payload.year) payload.year = parseInt(payload.year as any);
        if (payload.currentKm) payload.currentKm = parseInt(payload.currentKm as any);
        if (payload.insuranceCost) payload.insuranceCost = parseFloat(payload.insuranceCost as any);
        if (payload.kaskoCost) payload.kaskoCost = parseFloat(payload.kaskoCost as any);


        try {
            if (vehicleToEdit) {
                const result = await updateVehicle(vehicleToEdit.id, payload);
                if (result.success) {
                    toast.success("Araç bilgileri güncellendi.");
                    setOpen(false);
                    if (onSuccess) onSuccess();
                } else {
                    toast.error(result.error || "Güncelleme başarısız.");
                }
            } else {
                const result = await createVehicle({
                    ...payload,
                    id: crypto.randomUUID(), // Provide ID for new records if schema allows/needs it
                });
                if (result.success) {
                    toast.success("Yeni araç eklendi.");
                    setOpen(false);
                    if (onSuccess) onSuccess();
                } else {
                    toast.error(result.error || "Ekleme başarısız.");
                }
            }
        } catch (error) {
            console.error(error);
            toast.error("Bir hata oluştu.");
        }
    };

    // [restored] Handler functions
    const handleDelete = async () => {
        if (!vehicleToEdit) return;
        if (confirm('Bu aracı silmek istediğinize emin misiniz?')) {
            const result = await deleteVehicle(vehicleToEdit.id);
            if (result.success) {
                toast.success("Araç silindi.");
                setOpen(false);
                if (onSuccess) onSuccess();
            } else {
                toast.error(result.error || "Silme başarısız.");
            }
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            toast.error('Sadece PDF dosyaları yüklenebilir.');
            return;
        }

        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            toast.error('Dosya boyutu 5MB\'dan küçük olmalıdır.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target?.result as string;
            setFormData({ ...formData, licenseFile: base64 });
            toast.success("Ruhsat dosyası eklendi.");
        };
        reader.readAsDataURL(file);
    };

    const removeFile = () => {
        setFormData({ ...formData, licenseFile: '' });
        toast.info("Ruhsat dosyası kaldırıldı.");
    };

    if (!hasAccess) return null;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {customTrigger ? customTrigger : (
                    <Button className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="w-4 h-4 mr-2" /> Yeni Araç Ekle
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{vehicleToEdit ? 'Araç Düzenle' : (initialOwnership === 'RENTAL' ? 'Kiralık Araç Ekle' : 'Yeni Araç Ekle')}</DialogTitle>
                    <DialogDescription>
                        {vehicleToEdit ? 'Araç bilgilerini güncelleyin.' : 'Filoya yeni bir araç tanımlayın.'}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Plaka <span className="text-red-500">*</span></Label>
                            <Input
                                required
                                value={formData.plate}
                                onChange={(e) => setFormData({ ...formData, plate: e.target.value.toUpperCase() })}
                                placeholder="34 ABC 123"
                                className={formErrors.plate ? "border-red-500" : ""}
                            />
                            {formErrors.plate && <span className="text-xs text-red-500">{formErrors.plate}</span>}
                        </div>
                        {formData.ownership === 'OWNED' ? (
                            <div className="space-y-2">
                                <Label>Firma <span className="text-red-500">*</span></Label>
                                <Select
                                    value={formData.companyId}
                                    onValueChange={(v) => setFormData({ ...formData, companyId: v })}
                                    required
                                >
                                    <SelectTrigger className={formErrors.companyId ? "border-red-500" : ""}>
                                        <SelectValue placeholder="Seçiniz" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {companies.map(c => (
                                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {formErrors.companyId && <span className="text-xs text-red-500">{formErrors.companyId}</span>}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <Label>Kiralama Firması <span className="text-red-500">*</span></Label>
                                <Input
                                    required
                                    value={formData.rentalCompanyName || ''}
                                    onChange={(e) => setFormData({ ...formData, rentalCompanyName: e.target.value })}
                                    placeholder="Örn: Avis, Enterprise..."
                                    className={formErrors.rentalCompanyName ? "border-red-500" : ""}
                                />
                                {formErrors.rentalCompanyName && <span className="text-xs text-red-500">{formErrors.rentalCompanyName}</span>}
                            </div>
                        )}
                    </div>

                    {/* Rental Contact - Only for Rentals */}
                    {formData.ownership === 'RENTAL' && (
                        <div className="grid grid-cols-1 gap-4">
                            <div className="space-y-2">
                                <Label>Kiralık Araç İletişim Bilgileri</Label>
                                <Input
                                    placeholder="İletişim Kişisi / Telefon"
                                    value={formData.rentalContact || ''}
                                    onChange={(e) => setFormData({ ...formData, rentalContact: e.target.value })}
                                />
                            </div>
                        </div>
                    )}

                    {/* Row 1: Brand, Model, Cinsi (Type) */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>Marka <span className="text-red-500">*</span></Label>
                            <Input
                                required
                                value={formData.brand}
                                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                                className={formErrors.brand ? "border-red-500" : ""}
                            />
                            {formErrors.brand && <span className="text-xs text-red-500">{formErrors.brand}</span>}
                        </div>
                        <div className="space-y-2">
                            <Label>Tipi (Model) <span className="text-red-500">*</span></Label>
                            <Input
                                required
                                value={formData.model}
                                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                                className={formErrors.model ? "border-red-500" : ""}
                            />
                            {formErrors.model && <span className="text-xs text-red-500">{formErrors.model}</span>}
                        </div>
                        <div className="space-y-2">
                            <Label>Cinsi <span className="text-red-500">*</span></Label>
                            <Select
                                value={formData.type}
                                onValueChange={(v: any) => {
                                    const newType = v;
                                    let newMeterType = formData.meterType;
                                    // Auto Meter Type Logic
                                    if (newType === 'TRACTOR' || newType === 'EXCAVATOR') {
                                        newMeterType = 'HOURS';
                                    } else {
                                        newMeterType = 'KM';
                                    }
                                    setFormData({ ...formData, type: newType, meterType: newMeterType });
                                }}
                            >
                                <SelectTrigger className={formErrors.type ? "border-red-500" : ""}>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="CAR">Binek Araç</SelectItem>
                                    <SelectItem value="TRUCK">Kamyon</SelectItem>
                                    <SelectItem value="LORRY">Tır</SelectItem>
                                    <SelectItem value="EXCAVATOR">İş Makinesi</SelectItem>
                                    <SelectItem value="TRACTOR">Traktör</SelectItem>
                                    <SelectItem value="OTHER">Diğer</SelectItem>
                                </SelectContent>
                            </Select>
                            {formErrors.type && <span className="text-xs text-red-500">{formErrors.type}</span>}
                        </div>
                    </div>

                    {/* Row 2: Year, Meter Type */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Yıl <span className="text-red-500">*</span></Label>
                            <Select
                                value={formData.year ? formData.year.toString() : ""}
                                onValueChange={(v) => setFormData({ ...formData, year: parseInt(v) })}
                            >
                                <SelectTrigger className={formErrors.year ? "border-red-500" : ""}>
                                    <SelectValue placeholder="Seçiniz" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[200px]">
                                    {Array.from({ length: 50 }, (_, i) => new Date().getFullYear() + 1 - i).map(y => (
                                        <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {formErrors.year && <span className="text-xs text-red-500">{formErrors.year}</span>}
                        </div>

                        <div className="space-y-2">
                            <Label>Sayaç Tipi <span className="text-red-500">*</span></Label>
                            <Select
                                value={formData.meterType}
                                onValueChange={(v) => setFormData({ ...formData, meterType: v as any })}
                            >
                                <SelectTrigger className={formErrors.meterType ? "border-red-500" : ""}><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="KM">Kilometre (KM)</SelectItem>
                                    <SelectItem value="HOURS">Çalışma Saati</SelectItem>
                                </SelectContent>
                            </Select>
                            {formErrors.meterType && <span className="text-xs text-red-500">{formErrors.meterType}</span>}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Güncel Gösterge ({formData.meterType === 'HOURS' ? 'Saat' : 'KM'}) <span className="text-red-500">*</span></Label>
                            <Input
                                type="number"
                                required
                                value={formData.currentKm}
                                onChange={(e) => setFormData({ ...formData, currentKm: parseInt(e.target.value) })}
                                className={formErrors.currentKm ? "border-red-500" : ""}
                            />
                            {formErrors.currentKm && <span className="text-xs text-red-500">{formErrors.currentKm}</span>}
                        </div>
                    </div>

                    {/* Insurance and Kasko fields removed as per request */}

                    {/* Site Selection - Only for Rental as per request */}
                    {formData.ownership === 'RENTAL' && (
                        <div className="grid grid-cols-1 gap-4">
                            <div className="space-y-2">
                                <Label>Çalıştığı Şantiye <span className="text-red-500">*</span></Label>
                                <Select
                                    value={formData.assignedSiteId || ''}
                                    onValueChange={(v) => setFormData({ ...formData, assignedSiteId: v })}
                                >
                                    <SelectTrigger className={formErrors.assignedSiteId ? "border-red-500" : ""}>
                                        <SelectValue placeholder="Şantiye Seçiniz (Opsiyonel)" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {sites.filter(s => s.status === 'ACTIVE').map(s => (
                                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {formErrors.assignedSiteId && <span className="text-xs text-red-500">{formErrors.assignedSiteId}</span>}
                            </div>
                        </div>
                    )}

                    {/* NEW FIELDS: Engine, Chassis, Fuel, Inspection Date - NUR FOR OWNED VEHICLES */}
                    {formData.ownership === 'OWNED' && (
                        <div className="grid grid-cols-2 gap-4 border-t pt-4">
                            <div className="space-y-2">
                                <Label>Motor No</Label>
                                <Input
                                    value={formData.engineNumber || ''}
                                    onChange={(e) => setFormData({ ...formData, engineNumber: e.target.value })}
                                    placeholder="Motor No"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Şase No</Label>
                                <Input
                                    value={formData.chassisNumber || ''}
                                    onChange={(e) => setFormData({ ...formData, chassisNumber: e.target.value })}
                                    placeholder="Şase No"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Yakıt Tipi</Label>
                                <Select
                                    value={formData.fuelType}
                                    onValueChange={(v: any) => setFormData({ ...formData, fuelType: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seçiniz" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="DIESEL">Dizel</SelectItem>
                                        <SelectItem value="GASOLINE">Benzin</SelectItem>
                                        <SelectItem value="LPG">LPG</SelectItem>
                                        <SelectItem value="ELECTRIC">Elektrik</SelectItem>
                                        <SelectItem value="HYBRID">Hibrit</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Son Muayene Tarihi</Label>
                                <Input
                                    type="date"
                                    value={formData.lastInspectionDate || ''}
                                    onChange={(e) => setFormData({ ...formData, lastInspectionDate: e.target.value })}
                                />
                            </div>
                        </div>
                    )}

                    {/* [NEW] License Upload Section - ONLY FOR OWNED VEHICLES */}
                    {formData.ownership === 'OWNED' && (
                        <div className="space-y-2 border-t pt-4">
                            <Label>Ruhsat (PDF)</Label>
                            <div className="flex items-center gap-4">
                                {formData.licenseFile ? (
                                    <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700 w-full justify-between">
                                        <div className="flex items-center gap-2">
                                            <FileText className="w-4 h-4" />
                                            <span>Ruhsat Yüklü</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <a
                                                href={formData.licenseFile}
                                                download={`ruhsat-${formData.plate || 'arac'}.pdf`}
                                                className="p-1 hover:bg-green-100 rounded"
                                                title="İndir"
                                            >
                                                <Download className="w-4 h-4" />
                                            </a>
                                            <button
                                                type="button"
                                                onClick={removeFile}
                                                className="p-1 hover:bg-red-100 text-red-600 rounded"
                                                title="Kaldır"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <Input
                                        type="file"
                                        accept="application/pdf"
                                        onChange={handleFileUpload}
                                        className="cursor-pointer"
                                    />
                                )}
                            </div>
                        </div>
                    )}

                    <DialogFooter className="gap-2 sm:gap-0">
                        {vehicleToEdit && (
                            <Button
                                type="button"
                                variant="destructive"
                                onClick={handleDelete}
                                className="mr-auto"
                            >
                                <Trash2 className="w-4 h-4 mr-2" /> Sil
                            </Button>
                        )}
                        <Button type="submit">Kaydet</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog >
    );
}
