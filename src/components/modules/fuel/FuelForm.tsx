'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store/use-store';
import { useAuth } from '@/lib/store/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { FuelLog } from '@/lib/types';

export function FuelForm() {
    const [open, setOpen] = useState(false);
    const { addFuelLog, companies, vehicles, sites } = useAppStore();
    const { user } = useAuth();

    // Filter vehicles by company if needed, but for now show all active
    const activeVehicles = vehicles.filter((v: any) => v.status === 'ACTIVE');
    const activeSites = sites.filter((s: any) => s.status === 'ACTIVE');

    const [formData, setFormData] = useState({
        vehicleId: '',
        siteId: '',
        date: new Date().toISOString().split('T')[0],
        liters: 0,
        unitPrice: 0, // [NEW]
        cost: 0,
        mileage: 0,
    });

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
            unitPrice: Number(formData.unitPrice), // [NEW]
            cost: Number(formData.cost),
            mileage: Number(formData.mileage),
            filledByUserId: user.id
        });

        setOpen(false);
        setFormData({
            vehicleId: '',
            siteId: '',
            date: new Date().toISOString().split('T')[0],
            liters: 0,
            unitPrice: 0,
            cost: 0,
            mileage: 0,
        });
    };

    // Auto Calculation Logic
    const handleLitersChange = (val: number) => {
        const newLiters = val;
        const newCost = formData.unitPrice > 0 ? Number((newLiters * formData.unitPrice).toFixed(2)) : formData.cost;
        setFormData({ ...formData, liters: newLiters, cost: newCost });
    };

    const handleUnitPriceChange = (val: number) => {
        const newPrice = val;
        const newCost = formData.liters > 0 ? Number((formData.liters * newPrice).toFixed(2)) : formData.cost;
        setFormData({ ...formData, unitPrice: newPrice, cost: newCost });
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
                    <div className="space-y-2">
                        <Label>Araç</Label>
                        <Select
                            value={formData.vehicleId}
                            onValueChange={(v) => setFormData({ ...formData, vehicleId: v })}
                            required
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Araç Seçiniz" />
                            </SelectTrigger>
                            <SelectContent>
                                {activeVehicles.map((v: any) => (
                                    <SelectItem key={v.id} value={v.id}>{v.plate} - {v.brand} {v.model}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Şantiye / Konum</Label>
                        <Select
                            value={formData.siteId}
                            onValueChange={(v) => setFormData({ ...formData, siteId: v })}
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

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Tarih</Label>
                            <Input
                                type="date"
                                required
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>KM</Label>
                            <Input
                                type="number"
                                required
                                placeholder="Güncel KM"
                                value={formData.mileage}
                                onChange={(e) => setFormData({ ...formData, mileage: Number(e.target.value) })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>Litre</Label>
                            <Input
                                type="number"
                                step="0.01"
                                required
                                placeholder="Örn: 50.5"
                                value={formData.liters}
                                onChange={(e) => handleLitersChange(Number(e.target.value))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Birim Fiyat</Label>
                            <Input
                                type="number"
                                step="0.01"
                                placeholder="TL/Lt"
                                value={formData.unitPrice || ''}
                                onChange={(e) => handleUnitPriceChange(Number(e.target.value))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Tutar (TL)</Label>
                            <Input
                                type="number"
                                step="0.01"
                                required
                                placeholder="Toplam Tutar"
                                value={formData.cost}
                                onChange={(e) => setFormData({ ...formData, cost: Number(e.target.value) })}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="submit">Kaydet</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
