'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store/use-store';
import { useAuth } from '@/lib/store/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea'; // [NEW]
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';

export function FuelForm() {
    const [open, setOpen] = useState(false);
    const { addFuelLog, vehicles, sites, fuelTanks } = useAppStore();
    const { user } = useAuth();

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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

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

        addFuelLog({
            id: crypto.randomUUID(),
            ...formData,
            liters: Number(formData.liters),
            unitPrice: 0, // [MODIFIED] Hidden, set to 0
            cost: 0, // [MODIFIED] Hidden, set to 0
            mileage: Number(formData.mileage),
            fullTank: true, // Default
            filledByUserId: user.id
        });

        setOpen(false);
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

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-2" /> Yakıt Girişi
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Yakıt Girişi</DialogTitle>
                    <DialogDescription>
                        Araç için yakıt alımını kaydedin.
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
                        <Button type="submit" disabled={!formData.tankId}>Kaydet</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
