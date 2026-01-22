'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store/use-store';
import { useAuth } from '@/lib/store/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Fuel, Trash2 } from 'lucide-react';
import { createFuelTank, deleteFuelTank as deleteFuelTankAction } from '@/actions/fuel';

export function FuelTankList() {
    const { fuelTanks, addFuelTank, deleteFuelTank, sites } = useAppStore();
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [capacity, setCapacity] = useState(0);
    const [currentLevel, setCurrentLevel] = useState(0);
    const [siteId, setSiteId] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Check if site already has a tank
        const existingTank = fuelTanks.find((t: any) => t.siteId === siteId);
        if (existingTank) {
            alert('Seçilen şantiyeye ait zaten bir depo bulunmaktadır. Her şantiye için sadece 1 depo tanımlanabilir.');
            return;
        }

        if (!siteId) {
            alert('Lütfen bir şantiye seçiniz.');
            return;
        }

        if (!name.trim()) {
            alert('Lütfen depo adı giriniz.');
            return;
        }

        if (capacity <= 0) {
            alert('Kapasite 0\'dan büyük olmalıdır.');
            return;
        }

        const tankData = {
            siteId,
            name,
            capacity,
            currentLevel
        };

        const result = await createFuelTank(tankData);

        if (result.success && result.data) {
            addFuelTank({
                ...result.data,
                currentLevel: result.data.currentLevel || 0
            });
            setOpen(false);
            setName('');
            setCapacity(0);
            setCurrentLevel(0);
            setSiteId(''); // Reset site selection too
        } else {
            alert('Depo oluşturulamadı: ' + (result.error || 'Bilinmeyen hata'));
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('Bu depoyu silmek istediğinize emin misiniz?')) {
            const result = await deleteFuelTankAction(id);
            if (result.success) {
                deleteFuelTank(id);
            } else {
                alert('Depo silinemedi.');
            }
        }
    };

    const getSiteName = (id: string) => sites.find((s: any) => s.id === id)?.name || '-';

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Şantiye Depo Stokları</CardTitle>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                            <Plus className="w-4 h-4 mr-2" /> Yeni Depo Ekle
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Yeni Depo Tanımla</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label>Şantiye</Label>
                                <Select value={siteId} onValueChange={setSiteId} required>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seçiniz" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {sites.filter((s: any) => s.status === 'ACTIVE').map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Depo Adı</Label>
                                <Input value={name} onChange={e => setName(e.target.value)} required placeholder="Örn: Ana Tank 1" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Kapasite (Lt)</Label>
                                    <Input type="number" value={capacity} onChange={e => setCapacity(Number(e.target.value))} required />
                                </div>
                                <div className="space-y-2">
                                    <Label>Mevcut Seviye (Lt)</Label>
                                    <Input type="number" value={currentLevel} onChange={e => setCurrentLevel(Number(e.target.value))} required />
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
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {fuelTanks
                        .filter((tank: any) => {
                            const site = sites.find((s: any) => s.id === tank.siteId);
                            return site && site.status === 'ACTIVE';
                        })
                        .map((tank: any) => {
                            const percent = Math.round((tank.currentLevel / tank.capacity) * 100);
                            return (
                                <div key={tank.id} className="border rounded-lg p-4 bg-white shadow-sm relative group">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h4 className="font-semibold text-slate-800">{tank.name}</h4>
                                            <p className="text-xs text-slate-500">{getSiteName(tank.siteId)}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Fuel className="w-5 h-5 text-blue-500" />
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-red-400 hover:text-red-600 hover:bg-red-50"
                                                onClick={() => handleDelete(tank.id)}
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-500">Doluluk</span>
                                            <span className="font-bold">{percent}%</span>
                                        </div>
                                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${percent < 20 ? 'bg-red-500' : 'bg-green-500'}`}
                                                style={{ width: `${percent}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between text-xs text-slate-400 pt-1">
                                            <span>{tank.currentLevel.toLocaleString()} Lt</span>
                                            <span>{tank.capacity.toLocaleString()} Lt</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                </div>
            </CardContent>
        </Card>
    );
}
