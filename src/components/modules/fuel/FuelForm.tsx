'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store/use-store';
import { useAuth } from '@/lib/store/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea'; // [NEW]
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';

// [NEW] Props for Editing
interface FuelFormProps {
    initialData?: any;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    onSuccess?: () => void;
}

export function FuelForm({ initialData, open: externalOpen, onOpenChange: externalOnOpenChange, onSuccess }: FuelFormProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const isOpen = externalOpen !== undefined ? externalOpen : internalOpen;
    const setOpen = externalOnOpenChange || setInternalOpen;

    const [isSubmitting, setIsSubmitting] = useState(false);
    const { addFuelLog, updateFuelLog, vehicles, sites, fuelTanks } = useAppStore(); // [FIX] Added updateFuelLog
    const { user } = useAuth();

    // [NEW] Permissions
    // As per previous pattern, we might need to check if user can edit
    // const canEdit = hasPermission('fuel', 'EDIT');

    // Filter vehicles by company if needed, but for now show all active
    const activeVehicles = vehicles.filter((v: any) => v.status === 'ACTIVE');
    const activeSites = sites.filter((s: any) => s.status === 'ACTIVE');

    const [formData, setFormData] = useState({
        vehicleId: '',
        siteId: '',
        tankId: '', // Auto-set
        date: new Date().toISOString(), // Default to NOW
        liters: 0,
        unitPrice: 0,
        cost: 0,
        mileage: 0,
        description: '', // [NEW] Notes
    });

    // [NEW] Initialize from initialData
    useEffect(() => {
        if (initialData) {
            setFormData({
                vehicleId: initialData.vehicleId,
                siteId: initialData.siteId,
                tankId: initialData.tankId || '',
                date: initialData.date, // ISO string
                liters: initialData.liters,
                unitPrice: initialData.unitPrice || 0,
                cost: initialData.cost || 0,
                mileage: initialData.mileage,
                description: initialData.description || '',
            });
        } else if (isOpen) {
            // Reset if opening new
            if (!externalOpen) resetForm();
        }
    }, [initialData, isOpen]);

    const resetForm = () => {
        setFormData({
            vehicleId: '',
            siteId: '',
            tankId: '',
            date: new Date().toISOString(),
            liters: 0,
            unitPrice: 0,
            cost: 0,
            mileage: 0,
            description: '',
        });
    };

    // [NEW] Filter vehicles based on selected site
    const filteredVehicles = vehicles.filter((v: any) => {
        if (v.status !== 'ACTIVE') return false;
        if (!formData.siteId) return false;
        if (v.assignedSiteId === formData.siteId) return true;
        if (Array.isArray(v.assignedSiteIds) && v.assignedSiteIds.includes(formData.siteId)) return true;
        return false;
    });

    // [NEW] Auto-detect tank when site changes
    const handleSiteChange = (siteId: string) => {
        const siteTank = fuelTanks.find((t: any) => t.siteId === siteId);
        setFormData(prev => ({
            ...prev,
            siteId,
            vehicleId: '', // Reset vehicle when site changes
            tankId: siteTank ? siteTank.id : ''
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || isSubmitting) return;

        // [NEW] Date Restriction Check
        if (user.role !== 'ADMIN' && user.editLookbackDays !== undefined) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const target = new Date(formData.date);
            target.setHours(0, 0, 0, 0);
            const diff = (today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24);

            if (diff > user.editLookbackDays) {
                alert(`Geriye dönük en fazla ${user.editLookbackDays} gün işlem yapabilirsiniz.`);
                return;
            }
        }

        setIsSubmitting(true);
        try {
            const payload = {
                ...formData,
                liters: Number(formData.liters),
                unitPrice: 0,
                cost: 0,
                mileage: Number(formData.mileage),
                fullTank: true,
                filledByUserId: user.id
            };

            if (initialData) {
                // UPDATE
                const updateAction = await import('@/actions/fuel').then(mod => mod.updateFuelLog);

                // [FIX] Fix Date Type Mismatch (Action expects Date object or string that matches Prisma input)
                // Prisma Client update expects Date object for DateTime fields.
                // Our payload has .date as ISO string.
                const updatePayload = {
                    ...payload,
                    date: new Date(payload.date as string) // ensure Date object
                };

                const result = await updateAction(initialData.id, updatePayload as any); // Cast as any to bypass strict Partial<FuelLog> mismatch if necessary

                if (result.success && result.data) {
                    // Update Store
                    if (updateFuelLog) updateFuelLog(initialData.id, result.data as any);
                    // [FIX] Use window.location.reload() but cast to ignore TS if needed, or just standard
                    // window.location.reload(); 
                    // Actually, let's just close. Store update usually enough for UI.

                    setOpen(false);
                    if (onSuccess) onSuccess();
                } else {
                    alert(result.error || 'Güncelleme başarısız.');
                }
            } else {
                // CREATE
                const createPayload = {
                    ...payload,
                    date: new Date(payload.date as string)
                };
                const result = await import('@/actions/fuel').then(mod => mod.createFuelLog(createPayload as any));

                if (result.success && result.data) {
                    addFuelLog(result.data as any);
                    setOpen(false);
                    resetForm();
                    if (onSuccess) onSuccess();
                } else {
                    alert(result.error || 'Kayıt başarısız.');
                }
            }
        } catch (e) {
            console.error(e);
            alert('Bir hata oluştu.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {!initialData && (
                <DialogTrigger asChild>
                    <Button className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="w-4 h-4 mr-2" /> Yakıt Girişi
                    </Button>
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{initialData ? 'Yakıt Kaydını Düzenle' : 'Yakıt Girişi'}</DialogTitle>
                    <DialogDescription>
                        {initialData ? 'Mevcut yakıt kaydını güncelleyin.' : 'Araç için yakıt alımını kaydedin.'}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                    {/* 1. Site Selection (First) */}
                    <div className="space-y-2">
                        <Label>Şantiye / Konum</Label>
                        <Select
                            value={formData.siteId}
                            onValueChange={handleSiteChange}
                            required
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Şantiye Seçiniz" />
                            </SelectTrigger>
                            <SelectContent>
                                {activeSites.map((s: any) => (
                                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* 2. Vehicle Selection (Filtered) */}
                    <div className="space-y-2">
                        <Label>Araç (Seçilen Şantiyedeki)</Label>
                        <Select
                            value={formData.vehicleId}
                            onValueChange={(v) => setFormData({ ...formData, vehicleId: v })}
                            required
                            disabled={!formData.siteId}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder={formData.siteId ? "Araç Seçiniz" : "Önce Şantiye Seçiniz"} />
                            </SelectTrigger>
                            <SelectContent>
                                {filteredVehicles.map((v: any) => (
                                    <SelectItem key={v.id} value={v.id}>{v.plate} - {v.brand} {v.model}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {formData.siteId && filteredVehicles.length === 0 && (
                            <p className="text-[10px] text-red-500">Bu şantiyede atanmış araç bulunamadı.</p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Güncel KM</Label>
                            <Input
                                type="number"
                                required
                                placeholder="Güncel KM"
                                value={formData.mileage}
                                onChange={(e) => setFormData({ ...formData, mileage: Number(e.target.value) })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Verilen Litre</Label>
                            <Input
                                type="number"
                                step="0.01"
                                required
                                placeholder="Örn: 50.5"
                                value={formData.liters}
                                onChange={(e) => setFormData({ ...formData, liters: Number(e.target.value) })}
                            />
                        </div>
                    </div>

                    {/* [NEW] Notes Field */}
                    <div className="space-y-2">
                        <Label>Notlar</Label>
                        <Textarea
                            placeholder="Varsa notlarınız..."
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>

                    <DialogFooter>
                        <Button type="submit" disabled={!formData.tankId || isSubmitting}>
                            {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
