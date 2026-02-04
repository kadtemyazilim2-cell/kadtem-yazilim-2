'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store/use-store';
import { updateVehicle as updateVehicleAction } from '@/actions/vehicle';
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

    const companies = institutions.filter((i: any) => i.category === 'INSURANCE_COMPANY');
    const agencies = institutions.filter((i: any) => i.category === 'INSURANCE_AGENCY');

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
                setCostInput(policy.cost ? policy.cost.toString().replace('.', ',') : '');
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

                setFormData({
                    type: initialType as any,
                    company: '',
                    agency: '',
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
            setFile(e.target.files[0]);
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

        if (!formData.type) {
            toast.error("Lütfen poliçe tipini seçiniz.");
            return;
        }
        if (!formData.company) {
            toast.error("Lütfen sigorta firmasını seçiniz.");
            return;
        }
        if (!formData.agency) {
            toast.error("Lütfen acenteyi seçiniz.");
            return;
        }
        if (!formData.startDate) {
            toast.error("Lütfen başlangıç tarihini giriniz.");
            return;
        }
        if (!formData.endDate) {
            toast.error("Lütfen bitiş tarihini giriniz.");
            return;
        }
        if (!formData.identificationNumber) {
            toast.error("Lütfen poliçe numarasını giriniz.");
            return;
        }
        if (!formData.cost && formData.cost !== 0) {
            toast.error("Lütfen tutarı giriniz.");
            return;
        }

        try {
            let attachments = formData.attachments || [];

            // If new file selected, convert and add
            if (file) {
                const base64 = await convertToBase64(file);
                attachments = [base64]; // Currently simple: replace or single file. Can extend to push for multiple.
            }

            const newRecord: InsuranceRecord = {
                id: mode === 'EDIT' ? policy.id : crypto.randomUUID(),
                type: formData.type as 'TRAFFIC' | 'KASKO',
                company: formData.company || '',
                agency: formData.agency || '',
                startDate: formData.startDate || '',
                endDate: formData.endDate || '',
                cost: Number(formData.cost),
                active: true, // New policies are active by default
                attachments: attachments,
                definition: formData.definition,
                identificationNumber: formData.identificationNumber,
                transactionDate: formData.transactionDate
            };

            const currentHistory = vehicle.insuranceHistory || [];
            let newHistory = [...currentHistory];
            const updates: any = {}; // Collect all updates

            if (mode === 'ADD') {
                newHistory.push(newRecord);
                updates.insuranceHistory = newHistory;

                // UPDATE CURRENT VEHICLE STATUS (Smart Sync)
                // If we added a Traffic Policy, update vehicle.insuranceExpiry etc.
                if (newRecord.type === 'TRAFFIC') {
                    // Check if this new policy is "newer" than current or we just overwrite
                    // Usually adding a policy means it's the valid one.
                    updates.insuranceCompany = newRecord.company;
                    updates.insuranceAgency = newRecord.agency;
                    updates.insuranceStartDate = newRecord.startDate;
                    updates.insuranceExpiry = newRecord.endDate;
                    updates.insuranceCost = newRecord.cost;
                } else if (newRecord.type === 'KASKO') {
                    updates.kaskoCompany = newRecord.company;
                    updates.kaskoAgency = newRecord.agency;
                    updates.kaskoStartDate = newRecord.startDate;
                    updates.kaskoExpiry = newRecord.endDate;
                    updates.kaskoCost = newRecord.cost;
                }

            } else {
                // EDIT MODE
                // 1. Update record in history
                newHistory = newHistory.map((r: any) => r.id === policy.id ? newRecord : r);
                updates.insuranceHistory = newHistory;

                // 2. If this was the "active" or displayed policy logic, we might need to sync vehicle props too
                // Simplified: If the dates match the vehicle's current props, update them too.

                // Check if this edited policy matches the current "Main" fields
                if (newRecord.type === 'TRAFFIC' && vehicle.insuranceExpiry === policy.endDate) {
                    updates.insuranceCompany = newRecord.company;
                    updates.insuranceAgency = newRecord.agency;
                    updates.insuranceStartDate = newRecord.startDate;
                    updates.insuranceExpiry = newRecord.endDate;
                    updates.insuranceCost = newRecord.cost;
                } else if (newRecord.type === 'KASKO' && vehicle.kaskoExpiry === policy.endDate) {
                    updates.kaskoCompany = newRecord.company;
                    updates.kaskoAgency = newRecord.agency;
                    updates.kaskoStartDate = newRecord.startDate;
                    updates.kaskoExpiry = newRecord.endDate;
                    updates.kaskoCost = newRecord.cost;
                }
            }

            // PERSISTENCE FIX: Call Server Action
            const res = await updateVehicleAction(vehicle.id, updates);

            if (res.success) {
                updateVehicle(vehicle.id, updates); // Update Store locally for consistency
                toast.success(mode === 'ADD' ? 'Poliçe başarıyla eklendi.' : 'Poliçe güncellendi.');
                onOpenChange(false);
            } else {
                toast.error(res.error || 'Kaydedilemedi.');
            }

        } catch (error) {
            console.error("File upload error:", error);
            toast.error("Dosya yüklenirken hata oluştu.");
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

                        <div className="space-y-4 rounded-md border p-4 bg-slate-50">
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
                                            const val = e.target.value.replace('.', ','); // Normalize dot to comma
                                            // Allow only digits and max one comma
                                            if (/^\d*,?\d*$/.test(val)) {
                                                setCostInput(val);
                                                const numericVal = val === '' ? 0 : Number(val.replace(',', '.'));
                                                setFormData(prev => ({ ...prev, cost: numericVal }));
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
                                <Label>Poliçe Dosyası (İsteğe Bağlı)</Label>
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
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
                            <Button type="submit">Kaydet</Button>
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
