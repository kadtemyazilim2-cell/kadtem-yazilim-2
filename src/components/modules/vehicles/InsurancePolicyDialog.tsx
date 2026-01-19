'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store/use-store';
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
}

export function InsurancePolicyDialog({ vehicle, open, onOpenChange, mode = 'ADD', policy }: InsurancePolicyDialogProps) {
    const { updateVehicle, institutions } = useAppStore();

    const companies = institutions.filter(i => i.category === 'INSURANCE_COMPANY');
    const agencies = institutions.filter(i => i.category === 'INSURANCE_AGENCY');

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
    const [definitionDialog, setDefinitionDialog] = useState<{ open: boolean; type: 'INSURANCE_COMPANY' | 'INSURANCE_AGENCY' }>({ open: false, type: 'INSURANCE_COMPANY' });

    const getLastExpiry = (type: string) => {
        // 1. Try History first for most accurate latest date
        if (vehicle.insuranceHistory && vehicle.insuranceHistory.length > 0) {
            const relevantPolicies = vehicle.insuranceHistory.filter(p =>
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
                setFile(null); // Reset file input on edit open
            } else {
                // RESET for ADD
                const defaultType = '';
                // Try to guess default type if only one is missing? No, user requested empty.

                setFormData({
                    type: defaultType as any,
                    company: '',
                    agency: '',
                    startDate: new Date().toISOString().split('T')[0],
                    endDate: '',
                    cost: 0,
                    identificationNumber: '',
                    definition: '',
                    transactionDate: new Date().toISOString().split('T')[0],
                    attachments: []
                });
                setFile(null);
            }
        }
    }, [open, mode, policy, vehicle]);

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

            if (mode === 'ADD') {
                newHistory.push(newRecord);

                // UPDATE CURRENT VEHICLE STATUS (Smart Sync)
                // If we added a Traffic Policy, update vehicle.insuranceExpiry etc.
                const updates: any = { insuranceHistory: newHistory };

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

                updateVehicle(vehicle.id, updates);
                toast.success('Poliçe başarıyla eklendi.');

            } else {
                // EDIT MODE
                // 1. Update record in history
                newHistory = newHistory.map(r => r.id === policy.id ? newRecord : r);

                // 2. If this was the "active" or displayed policy logic, we might need to sync vehicle props too
                // Simplified: If the dates match the vehicle's current props, update them too.
                const updates: any = { insuranceHistory: newHistory };

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

                updateVehicle(vehicle.id, updates);
                toast.success('Poliçe güncellendi.');
            }

            onOpenChange(false);

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
                                        disabled={mode === 'EDIT'} // Usually avoid changing type on edit to prevent confusion
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
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={formData.cost}
                                        onChange={(e) => setFormData({ ...formData, cost: Number(e.target.value) })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Sigorta Firması <span className="text-red-500">*</span></Label>
                                    <div className="flex gap-2">
                                        <Select
                                            value={formData.company}
                                            onValueChange={(val) => setFormData({ ...formData, company: val })}
                                        >
                                            <SelectTrigger className="flex-1"><SelectValue placeholder="Seçiniz" /></SelectTrigger>
                                            <SelectContent>
                                                {companies.map(c => (
                                                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setDefinitionDialog({ open: true, type: 'INSURANCE_COMPANY' })}
                                            title="Yeni Firma Ekle"
                                        >
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Acente <span className="text-red-500">*</span></Label>
                                    <div className="flex gap-2">
                                        <Select
                                            value={formData.agency}
                                            onValueChange={(val) => setFormData({ ...formData, agency: val })}
                                        >
                                            <SelectTrigger className="flex-1"><SelectValue placeholder="Seçiniz" /></SelectTrigger>
                                            <SelectContent>
                                                {agencies.map(a => (
                                                    <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setDefinitionDialog({ open: true, type: 'INSURANCE_AGENCY' })}
                                            title="Yeni Acente Ekle"
                                        >
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Başlangıç Tarihi <span className="text-red-500">*</span></Label>
                                    <Input
                                        type="date"
                                        value={formData.startDate}
                                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Bitiş Tarihi <span className="text-red-500">*</span></Label>
                                    <Input
                                        type="date"
                                        value={formData.endDate}
                                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Poliçe No <span className="text-red-500">*</span></Label>
                                    <Input
                                        value={formData.identificationNumber}
                                        onChange={(e) => setFormData({ ...formData, identificationNumber: e.target.value })}
                                        placeholder="Poliçe Numarası"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Açıklama / Not</Label>
                                <Input
                                    value={formData.definition || ''}
                                    onChange={(e) => setFormData({ ...formData, definition: e.target.value })}
                                    placeholder="Örn: X Sigorta 2024 Yenileme"
                                />
                            </div>

                            <div className="space-y-2 border-t pt-4">
                                <Label>Poliçe Dosyası (PDF/Resim)</Label>

                                {formData.attachments && formData.attachments.length > 0 ? (
                                    <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700 justify-between">
                                        <div className="flex items-center gap-2">
                                            <FileText className="w-4 h-4" />
                                            <span>Dosya Yüklü</span>
                                        </div>
                                        <div className="flex gap-1">
                                            <a
                                                href={formData.attachments[0]}
                                                download={`police-${vehicle.plate}-${formData.type}.pdf`}
                                                className="p-1 hover:bg-green-100 rounded"
                                                title="İndir"
                                            >
                                                <Download className="w-4 h-4" />
                                            </a>
                                            <button
                                                type="button"
                                                onClick={removeAttachment}
                                                className="p-1 hover:bg-red-100 text-red-600 rounded"
                                                title="Sil"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <Input
                                        type="file"
                                        accept=".pdf,image/*"
                                        onChange={handleFileChange}
                                        className="cursor-pointer"
                                    />
                                )}
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
                            <Button type="submit">{mode === 'ADD' ? 'Kaydet' : 'Güncelle'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <InsuranceDefinitionsDialog
                open={definitionDialog.open}
                onOpenChange={(open) => setDefinitionDialog(prev => ({ ...prev, open }))}
                type={definitionDialog.type}
            />
        </>
    );
}

