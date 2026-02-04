'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store/use-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Vehicle } from '@/lib/types';
import { CalendarIcon } from 'lucide-react';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface InsuranceRenewalDialogProps {
    vehicle: Vehicle;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode?: 'RENEW' | 'EDIT';
    targetPolicy?: any;
}

export function InsuranceRenewalDialog({ vehicle, open, onOpenChange, mode = 'RENEW', targetPolicy }: InsuranceRenewalDialogProps) {
    const { updateVehicle, institutions } = useAppStore(); // [MODIFIED] Fetch institutions



    const companies = institutions.filter((i: any) => i.category === 'INSURANCE_COMPANY');
    const agencies = institutions.filter((i: any) => i.category === 'INSURANCE_AGENCY');

    const [formData, setFormData] = useState({
        insuranceExpiry: '',
        insuranceStartDate: '',
        insuranceCost: 0,
        kaskoExpiry: '',
        kaskoStartDate: '',
        kaskoCost: 0,
        insuranceAgency: '',
        insuranceCompany: '', // [NEW]
        kaskoAgency: '',
        kaskoCompany: '', // [NEW]
        inspectionExpiry: '',
    });

    useEffect(() => {
        if (open && vehicle) {
            if (mode === 'EDIT' && targetPolicy) {
                // [EDIT MODE] Load EXACT data from the target policy
                const isTraffic = targetPolicy.type === 'Trafik Sigortası' || targetPolicy.type === 'TRAFFIC';
                const isKasko = targetPolicy.type === 'Kasko' || targetPolicy.type === 'KASKO';

                setFormData({
                    insuranceStartDate: isTraffic ? targetPolicy.startDate : (vehicle.insuranceStartDate || ''),
                    insuranceExpiry: isTraffic ? targetPolicy.endDate : (vehicle.insuranceExpiry || ''),
                    insuranceCost: isTraffic ? targetPolicy.cost : (vehicle.insuranceCost || 0),
                    insuranceCompany: isTraffic ? targetPolicy.provider : (vehicle.insuranceCompany || ''),
                    insuranceAgency: isTraffic ? targetPolicy.agency : (vehicle.insuranceAgency || ''),

                    kaskoStartDate: isKasko ? targetPolicy.startDate : (vehicle.kaskoStartDate || ''),
                    kaskoExpiry: isKasko ? targetPolicy.endDate : (vehicle.kaskoExpiry || ''),
                    kaskoCost: isKasko ? targetPolicy.cost : (vehicle.kaskoCost || 0),
                    kaskoCompany: isKasko ? targetPolicy.provider : (vehicle.kaskoCompany || ''),
                    kaskoAgency: isKasko ? targetPolicy.agency : (vehicle.kaskoAgency || ''),

                    inspectionExpiry: vehicle.inspectionExpiry || '',
                });

            } else {
                // [RENEW MODE] Smart Renewal Logic
                setFormData({
                    insuranceStartDate: vehicle.insuranceExpiry || vehicle.insuranceStartDate || '',
                    insuranceExpiry: '', // User must enter new expiry
                    insuranceCost: 0, // [RESET]

                    kaskoStartDate: vehicle.kaskoExpiry || vehicle.kaskoStartDate || '',
                    kaskoExpiry: '', // User must enter new expiry
                    kaskoCost: 0, // [RESET]

                    insuranceAgency: '', // [RESET]
                    insuranceCompany: '', // [RESET]
                    kaskoAgency: '', // [RESET]
                    kaskoCompany: '', // [RESET]
                    inspectionExpiry: vehicle.inspectionExpiry || '',
                });
            }
        }
    }, [open, vehicle, mode, targetPolicy]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // 1. Archive Old Records (if they existed and were valid)
        const newHistory = [...(vehicle.insuranceHistory || [])];

        // Archive Traffic Insurance if it was previously set
        if (vehicle.insuranceExpiry && vehicle.insuranceCost) {
            newHistory.push({
                id: crypto.randomUUID(),
                type: 'TRAFFIC',
                company: vehicle.insuranceCompany || '',
                agency: vehicle.insuranceAgency || '',
                startDate: vehicle.insuranceStartDate || '',
                endDate: vehicle.insuranceExpiry,
                cost: vehicle.insuranceCost,
                active: false // Archived
            });
        }

        // Archive Kasko if it was previously set
        if (vehicle.kaskoExpiry && vehicle.kaskoCost) {
            newHistory.push({
                id: crypto.randomUUID(),
                type: 'KASKO',
                company: vehicle.kaskoCompany || '',
                agency: vehicle.kaskoAgency || '',
                startDate: vehicle.kaskoStartDate || '',
                endDate: vehicle.kaskoExpiry,
                cost: vehicle.kaskoCost,
                active: false // Archived
            });
        }

        // 2. Update Vehicle with NEW values and updated History
        // [FIX] Chronological Check: Ensure we don't overwrite a future date with a past date
        const updates: any = { ...formData, insuranceHistory: newHistory };

        // Traffic Insurance Check
        if (vehicle.insuranceExpiry && formData.insuranceExpiry && new Date(formData.insuranceExpiry) < new Date(vehicle.insuranceExpiry)) {
            // If new date is older, keep the old one (assuming user entered past data but wants to keep current active)
            // OR: If purpose is to Correct Mistake, we should allow. BUT user asked for "Latest Date Logic".
            // Implementing "Latest Wins" logic:
            updates.insuranceStartDate = vehicle.insuranceStartDate;
            updates.insuranceExpiry = vehicle.insuranceExpiry;
            updates.insuranceCost = vehicle.insuranceCost;
            updates.insuranceCompany = vehicle.insuranceCompany;
            updates.insuranceAgency = vehicle.insuranceAgency;
        }

        // Kasko Check
        if (vehicle.kaskoExpiry && formData.kaskoExpiry && new Date(formData.kaskoExpiry) < new Date(vehicle.kaskoExpiry)) {
            updates.kaskoStartDate = vehicle.kaskoStartDate;
            updates.kaskoExpiry = vehicle.kaskoExpiry;
            updates.kaskoCost = vehicle.kaskoCost;
            updates.kaskoCompany = vehicle.kaskoCompany;
            updates.kaskoAgency = vehicle.kaskoAgency;
        }

        // Inspection Check
        if (vehicle.inspectionExpiry && formData.inspectionExpiry && new Date(formData.inspectionExpiry) < new Date(vehicle.inspectionExpiry)) {
            updates.inspectionExpiry = vehicle.inspectionExpiry;
        }

        updateVehicle(vehicle.id, updates);

        onOpenChange(false);
    };

    if (!vehicle) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Sigorta / Kasko Yenileme - {vehicle.plate}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6 py-4">

                    <div className="space-y-4 rounded-md border p-4 bg-slate-50">
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                            <CalendarIcon className="w-4 h-4" /> Trafik Sigortası
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Başlangıç Tarihi</Label>
                                <Input
                                    type="date"
                                    value={formData.insuranceStartDate || ''}
                                    onChange={(e) => setFormData({ ...formData, insuranceStartDate: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Bitiş Tarihi</Label>
                                <Input
                                    type="date"
                                    value={formData.insuranceExpiry}
                                    onChange={(e) => setFormData({ ...formData, insuranceExpiry: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Tutar (TL)</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={formData.insuranceCost || ''}
                                    onChange={(e) => setFormData({ ...formData, insuranceCost: parseFloat(e.target.value) })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Firma (Sağlayıcı)</Label>
                                <Select
                                    value={formData.insuranceCompany}
                                    onValueChange={(val) => setFormData({ ...formData, insuranceCompany: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seçiniz" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {companies.map((c: any) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Acente (Aracı)</Label>
                                <Select
                                    value={formData.insuranceAgency}
                                    onValueChange={(val) => setFormData({ ...formData, insuranceAgency: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seçiniz" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {agencies.map((a: any) => <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 rounded-md border p-4 bg-slate-50">
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                            <CalendarIcon className="w-4 h-4" /> Kasko
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Başlangıç Tarihi</Label>
                                <Input
                                    type="date"
                                    value={formData.kaskoStartDate || ''}
                                    onChange={(e) => setFormData({ ...formData, kaskoStartDate: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Bitiş Tarihi</Label>
                                <Input
                                    type="date"
                                    value={formData.kaskoExpiry}
                                    onChange={(e) => setFormData({ ...formData, kaskoExpiry: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Tutar (TL)</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={formData.kaskoCost || ''}
                                    onChange={(e) => setFormData({ ...formData, kaskoCost: parseFloat(e.target.value) })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Firma (Sağlayıcı)</Label>
                                <Select
                                    value={formData.kaskoCompany}
                                    onValueChange={(val) => setFormData({ ...formData, kaskoCompany: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seçiniz" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {companies.map((c: any) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Acente (Aracı)</Label>
                                <Select
                                    value={formData.kaskoAgency}
                                    onValueChange={(val) => setFormData({ ...formData, kaskoAgency: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seçiniz" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {agencies.map((a: any) => <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 rounded-md border p-4 bg-slate-50">
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                            <CalendarIcon className="w-4 h-4" /> Muayene
                        </h4>
                        <div className="space-y-2">
                            <Label>Muayene Bitiş Tarihi</Label>
                            <Input
                                type="date"
                                value={formData.inspectionExpiry}
                                onChange={(e) => setFormData({ ...formData, inspectionExpiry: e.target.value })}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
                        <Button type="submit">Güncelle</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
