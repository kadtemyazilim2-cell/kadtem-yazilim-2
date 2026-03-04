'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store/use-store';
import { updateVehicle as updateVehicleAction, saveInsurancePolicy } from '@/actions/vehicle';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Vehicle, InsuranceRecord } from '@/lib/types';
import { CalendarIcon, Upload, X, FileText, Download, Plus } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { InsuranceDefinitionsDialog } from './InsuranceDefinitionsDialog';

interface InsurancePolicyDialogProps {
    vehicle: Vehicle;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode?: 'ADD' | 'EDIT';
    policy?: any; // InsuranceRecord but loosely typed due to UI aggregations
    defaultType?: 'TRAFFIC' | 'KASKO' | ''; // [NEW] Pre-select type
}

export function InsurancePolicyDialog({ vehicle, open, onOpenChange, mode = 'ADD', policy, defaultType = '' }: InsurancePolicyDialogProps) {
    const { updateVehicle, institutions } = useAppStore();

    const companies = institutions.filter((i: any) => i.category === 'INSURANCE_COMPANY' && i.status !== 'PASSIVE');
    const agencies = institutions.filter((i: any) => i.category === 'INSURANCE_AGENCY' && i.status !== 'PASSIVE');

    const [formData, setFormData] = useState<Partial<InsuranceRecord>>({
        type: '' as any,
        company: '',
        agency: '',
        startDate: '',
        endDate: '',
        cost: 0,
        identificationNumber: '', // Poliçe No
        definition: '',
        transactionDate: new Date().toISOString().split('T')[0], // Default to today
        attachments: []
    });

    const [file, setFile] = useState<File | null>(null);
    const [costInput, setCostInput] = useState('');
    const [definitionDialog, setDefinitionDialog] = useState<{ open: boolean; type: 'INSURANCE_COMPANY' | 'INSURANCE_AGENCY' }>({ open: false, type: 'INSURANCE_COMPANY' });
    const [isSubmitting, setIsSubmitting] = useState(false); // [NEW] Loading State

    const getLastExpiry = (type: string) => {
        // 1. Try History first for most accurate latest date
        if (vehicle.insuranceHistory && vehicle.insuranceHistory.length > 0) {
            const relevantPolicies = vehicle.insuranceHistory.filter((p: any) =>
                (type === 'TRAFFIC' && (p.type === 'TRAFFIC' || (p.type as any) === 'Trafik Sigortası')) ||
                (type === 'KASKO' && (p.type === 'KASKO' || (p.type as any) === 'Kasko')) ||
                (p.type === type) // Fallback for exact match
            );

            if (relevantPolicies.length > 0) {
                // Sort by endDate descending
                const lastPolicy = [...relevantPolicies].sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime())[0];
                if (lastPolicy.endDate) return lastPolicy.endDate;
            }
        }

        // 2. Fallback to Vehicle Props
        if (type === 'TRAFFIC') return vehicle.insuranceExpiry || '';
        if (type === 'KASKO') return vehicle.kaskoExpiry || '';
        return '';
    };

    useEffect(() => {
        if (open) {
            setIsSubmitting(false); // Reset loading state
            if (mode === 'EDIT' && policy) {
                setFormData({
                    type: policy.type === 'Trafik Sigortası' ? 'TRAFFIC' : (policy.type === 'Kasko' ? 'KASKO' : policy.type),
                    company: policy.provider || policy.company,
                    agency: policy.agency,
                    startDate: policy.startDate,
                    endDate: policy.endDate,
                    cost: policy.cost,
                    identificationNumber: policy.identificationNumber || '',
                    definition: policy.definition || '',
                    transactionDate: policy.transactionDate || policy.startDate, // Fallback
                    attachments: policy.attachments || [] // Keep existing attachments
                });
                setCostInput(policy.cost ? policy.cost.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');
                setFile(null); // Reset file input on edit open
            } else {
                // RESET for ADD
                // Use defaultType if provided
                const initialType = defaultType || '';

                // Calculate dates if type provided
                let initialStartDate = new Date().toISOString().split('T')[0];
                let initialEndDate = '';

                if (initialType) {
                    const lastExpiry = getLastExpiry(initialType);
                    if (lastExpiry) initialStartDate = lastExpiry;

                    try {
                        const start = new Date(initialStartDate);
                        const end = new Date(start);
                        end.setFullYear(end.getFullYear() + 1);
                        initialEndDate = end.toISOString().split('T')[0];
                    } catch (e) { }
                }

                let initialCompany = '';
                let initialAgency = '';

                if (initialType === 'TRAFFIC') {
                    initialCompany = vehicle?.insuranceCompany || '';
                    initialAgency = vehicle?.insuranceAgency || '';
                } else if (initialType === 'KASKO') {
                    initialCompany = vehicle?.kaskoCompany || '';
                    initialAgency = vehicle?.kaskoAgency || '';
                }

                setFormData({
                    type: initialType as any,
                    company: initialCompany,
                    agency: initialAgency,
                    startDate: initialStartDate,
                    endDate: initialEndDate,
                    cost: 0,
                    identificationNumber: '',
                    definition: '',
                    transactionDate: new Date().toISOString().split('T')[0],
                    attachments: []
                });
                setCostInput('');
                setFile(null);
            }
        }
    }, [open, mode, policy, vehicle]); // Removed defaultType from dep array to avoid re-run if it changes mid-flight (unlikely)

    // Auto-calculate End Date (1 Year) when Start Date changes
    useEffect(() => {
        if (mode === 'ADD' && formData.startDate && !formData.endDate) {
            try {
                const start = new Date(formData.startDate);
                const end = new Date(start);
                end.setFullYear(end.getFullYear() + 1);
                setFormData(prev => ({ ...prev, endDate: end.toISOString().split('T')[0] }));
            } catch (e) {
                // Ignore invalid date
            }
        }
    }, [formData.startDate, mode]); // removed formData.endDate from deps to avoid loop if we add logic

    const handleTypeChange = (val: string) => {
        const lastExpiry = getLastExpiry(val);
        const newStartDate = lastExpiry || new Date().toISOString().split('T')[0];

        setFormData(prev => {
            const updates: any = { ...prev, type: val as any };
            if (mode === 'ADD') {
                updates.startDate = newStartDate;
                // Auto calculate end date immediately
                try {
                    const start = new Date(newStartDate);
                    const end = new Date(start);
                    end.setFullYear(end.getFullYear() + 1);
                    updates.endDate = end.toISOString().split('T')[0];
                } catch (e) { }
            }
            return updates;
        });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            // [NEW] Validation: Size Check (2MB)
            if (selectedFile.size > 2 * 1024 * 1024) {
                toast.error("Dosya boyutu 2MB'dan büyük olamaz.");
                e.target.value = ''; // Reset input
                return;
            }
            setFile(selectedFile);
        }
    };

    const convertToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (isSubmitting) return; // Prevent double submit

        // 1. Validation
        if (!formData.type) return toast.error("Lütfen poliçe tipini seçiniz.");
        if (!formData.company) return toast.error("Lütfen sigorta firmasını seçiniz.");
        if (!formData.agency) return toast.error("Lütfen acenteyi seçiniz.");
        if (!formData.startDate) return toast.error("Lütfen başlangıç tarihini giriniz.");
        if (!formData.endDate) return toast.error("Lütfen bitiş tarihini giriniz.");
        if (!formData.identificationNumber) return toast.error("Lütfen poliçe numarasını giriniz.");

        // Robust Cost Validation
        const costVal = typeof formData.cost === 'string' ? parseFloat((formData.cost as string).replace(',', '.')) : formData.cost;
        if (isNaN(Number(costVal)) || (costVal !== 0 && !costVal)) {
            return toast.error("Lütfen geçerli bir tutar giriniz.");
        }

        setIsSubmitting(true);
        const toastId = toast.loading("Poliçe kaydediliyor, lütfen bekleyiniz...");

        try {
            let attachments = formData.attachments || [];

            // If new file selected, convert and add
            if (file) {
                const base64 = await convertToBase64(file);
                attachments = [base64];
            }

            // Create Only the NEW or EDITED Record
            const newRecord: InsuranceRecord = {
                id: mode === 'EDIT' ? policy.id : crypto.randomUUID(),
                type: formData.type as 'TRAFFIC' | 'KASKO',
                company: formData.company || '',
                agency: formData.agency || '',
                startDate: formData.startDate || '',
                endDate: formData.endDate || '',
                cost: Number(costVal),
                active: true,
                attachments: attachments,
                definition: formData.definition || '',
                identificationNumber: formData.identificationNumber,
                transactionDate: formData.transactionDate || new Date().toISOString().split('T')[0],
                createdAt: new Date().toISOString() // [NEW] Capture creation time for sorting
            };

            // [LOGIC FIX] Calculate ACTIVE Policy based on Max End Date from ALL history
            let potentialHistory = Array.isArray(vehicle.insuranceHistory) ? [...vehicle.insuranceHistory] : [];

            if (mode === 'ADD') {
                potentialHistory.push(newRecord);
            } else {
                potentialHistory = potentialHistory.map((r: any) => r.id === newRecord.id ? newRecord : r);
            }

            // Helper to find the "Best" policy for a type
            const findBestPolicy = (type: 'TRAFFIC' | 'KASKO') => {
                const relevant = potentialHistory.filter((p: any) =>
                    (type === 'TRAFFIC' && (p.type === 'TRAFFIC' || (p.type as any) === 'Trafik Sigortası')) ||
                    (type === 'KASKO' && (p.type === 'KASKO' || (p.type as any) === 'Kasko'))
                );
                if (relevant.length === 0) return null;
                // Sort descending by End Date
                return relevant.sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime())[0];
            };

            const bestTraffic = findBestPolicy('TRAFFIC');
            const bestKasko = findBestPolicy('KASKO');

            const flatUpdates: any = {};

            // If we have a Traffic policy (existing or new), perform update based on the BEST one.
            if (bestTraffic) {
                flatUpdates.insuranceCompany = bestTraffic.company;
                flatUpdates.insuranceAgency = bestTraffic.agency;
                flatUpdates.insuranceStartDate = bestTraffic.startDate;
                flatUpdates.insuranceExpiry = bestTraffic.endDate;
                flatUpdates.insuranceCost = bestTraffic.cost;
            }

            // If we have a Kasko policy (existing or new), perform update based on the BEST one.
            if (bestKasko) {
                flatUpdates.kaskoCompany = bestKasko.company;
                flatUpdates.kaskoAgency = bestKasko.agency;
                flatUpdates.kaskoStartDate = bestKasko.startDate;
                flatUpdates.kaskoExpiry = bestKasko.endDate;
                flatUpdates.kaskoCost = bestKasko.cost;
            }

            console.log("Saving policy via optimized action. Best Traffic:", bestTraffic?.endDate, "Best Kasko:", bestKasko?.endDate);

            // Dynamically import removed, using static import
            // const { saveInsurancePolicy } = await import('@/actions/vehicle');

            const res = await saveInsurancePolicy(vehicle.id, newRecord, mode, flatUpdates);


            if (res.success) {
                // Manual store update (Optimistic UI)
                updateVehicle(vehicle.id, { ...flatUpdates, insuranceHistory: potentialHistory });

                toast.dismiss(toastId);
                toast.success(mode === 'ADD' ? 'Poliçe başarıyla eklendi.' : 'Poliçe güncellendi.');
                onOpenChange(false);
            } else {
                console.error("Server Action Failed:", res.error);
                toast.dismiss(toastId);
                toast.error(res.error || 'Kaydetme işlemi başarısız oldu.');
            }

        } catch (error: any) {
            console.error("handleSubmit Exception:", error);
            toast.dismiss(toastId);
            toast.error("Bir hata oluştu: " + (error.message || "Bilinmeyen hata"));
        } finally {
            setIsSubmitting(false); // STOP LOADING
        }
    };

    const removeAttachment = () => {
        setFormData({ ...formData, attachments: [] });
    };

    if (!vehicle) return null;

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{mode === 'ADD' ? 'Yeni Poliçe Ekle' : 'Poliçe Düzenle'} - {vehicle.plate}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 py-4">

                        <div className="space-y-4 rounded-md border text-sm p-4 bg-slate-50">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Poliçe Tipi <span className="text-red-500">*</span></Label>
                                    <Select
                                        value={formData.type}
                                        onValueChange={handleTypeChange}
                                        disabled={mode === 'EDIT' || (!!defaultType && (defaultType === 'TRAFFIC' || defaultType === 'KASKO'))} // Disable only if valid type provided
                                    >
                                        <SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="TRAFFIC">Trafik Sigortası</SelectItem>
                                            <SelectItem value="KASKO">Kasko</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Tutar (TL) <span className="text-red-500">*</span></Label>
                                    <Input
                                        type="text"
                                        inputMode="decimal"
                                        value={costInput}
                                        onChange={(e) => {
                                            // Allow raw input but filter invalid chars
                                            let val = e.target.value;

                                            // Allow digits, dots, commas
                                            if (!/^[\d.,]*$/.test(val)) return;

                                            setCostInput(val);

                                            // Parse for internal numeric state
                                            // Remove thousands separators (dots) and replace decimal separator (comma) with dot
                                            const cleanVal = val.replace(/\./g, '').replace(',', '.');
                                            const numVal = parseFloat(cleanVal);

                                            if (!isNaN(numVal)) {
                                                setFormData(prev => ({ ...prev, cost: numVal }));
                                            } else if (val === '') {
                                                setFormData(prev => ({ ...prev, cost: 0 }));
                                            }
                                        }}
                                        onBlur={() => {
                                            // Format on blur to standardized TR format
                                            if (formData.cost !== undefined && formData.cost !== 0) {
                                                const formatted = formData.cost.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                                setCostInput(formatted);
                                            }
                                        }}
                                        placeholder="0,00"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label>Sigorta Firması <span className="text-red-500">*</span></Label>
                                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => { e.preventDefault(); setDefinitionDialog({ open: true, type: 'INSURANCE_COMPANY' }); }}>
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <Select
                                        value={formData.company}
                                        onValueChange={(val) => setFormData({ ...formData, company: val })}
                                    >
                                        <SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger>
                                        <SelectContent>
                                            {companies.map((c: any) => (
                                                <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label>Acente <span className="text-red-500">*</span></Label>
                                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => { e.preventDefault(); setDefinitionDialog({ open: true, type: 'INSURANCE_AGENCY' }); }}>
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <Select
                                        value={formData.agency}
                                        onValueChange={(val) => setFormData({ ...formData, agency: val })}
                                    >
                                        <SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger>
                                        <SelectContent>
                                            {agencies.map((a: any) => (
                                                <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>İşlem Tarihi <span className="text-red-500">*</span></Label>
                                    <Input
                                        type="date"
                                        value={formData.transactionDate ? formData.transactionDate.split('T')[0] : ''}
                                        onChange={(e) => setFormData({ ...formData, transactionDate: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Başlangıç Tarihi <span className="text-red-500">*</span></Label>
                                    <div className="relative">
                                        <Input
                                            type="date"
                                            value={formData.startDate ? formData.startDate.split('T')[0] : ''}
                                            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Bitiş Tarihi <span className="text-red-500">*</span></Label>
                                    <div className="relative">
                                        <Input
                                            type="date"
                                            value={formData.endDate ? formData.endDate.split('T')[0] : ''}
                                            onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Poliçe Numarası <span className="text-red-500">*</span></Label>
                                <Input
                                    value={formData.identificationNumber}
                                    onChange={(e) => setFormData({ ...formData, identificationNumber: e.target.value })}
                                    placeholder="Poliçe numarası giriniz"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Poliçe Dosyası (İsteğe Bağlı - Max 2MB)</Label>
                                <div className="flex items-center gap-4">
                                    <Input
                                        id="file-upload"
                                        type="file"
                                        accept="application/pdf,image/*"
                                        className="hidden"
                                        onChange={handleFileChange}
                                    />
                                    <Label
                                        htmlFor="file-upload"
                                        className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors w-full"
                                    >
                                        <Upload className="h-4 w-4" />
                                        {file ? file.name : (formData.attachments && formData.attachments.length > 0 ? 'Dosya Yüklü (Değiştirmek için tıkla)' : 'Dosya Seç')}
                                    </Label>
                                    {(file || (formData.attachments && formData.attachments.length > 0)) && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                            onClick={() => { setFile(null); removeAttachment(); }}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                                {formData.attachments && formData.attachments.length > 0 && !file && (
                                    <div className="flex items-center gap-2 text-xs text-green-600 mt-1">
                                        <FileText className="h-3 w-3" />
                                        <span>Mevcut dosya korunuyor</span>
                                        <a href={formData.attachments[0]} download="police.pdf" target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:underline ml-2">
                                            <Download className="h-3 w-3" /> İndir
                                        </a>
                                    </div>
                                )}
                            </div>

                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>İptal</Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <InsuranceDefinitionsDialog
                open={definitionDialog.open}
                onOpenChange={(val) => setDefinitionDialog({ ...definitionDialog, open: val })}
                type={definitionDialog.type}
            />
        </>
    );
}
