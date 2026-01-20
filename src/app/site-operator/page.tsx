'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store/use-store';
import { useAuth } from '@/lib/store/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Droplets, ArrowRightLeft, Fuel, Truck, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FuelTransferForm } from '@/components/modules/fuel/FuelTransferForm';

export default function SiteOperatorPage() {
    const { sites, vehicles, fuelTanks, addFuelLog, addFuelTank, updateFuelTankLevel } = useAppStore();
    const { user, logout } = useAuth();
    const router = useRouter();

    const [selectedSiteId, setSelectedSiteId] = useState(user?.assignedSiteIds?.[0] || sites?.[0]?.id || '');
    const [view, setView] = useState<'MENU' | 'DISPENSE' | 'FILL_TANK'>('MENU');

    // Dispense Form State
    const [dispenseData, setDispenseData] = useState({
        vehicleId: '',
        tankId: '',
        liters: '',
        mileage: '',
        fullTank: true
    });

    const handleDispense = () => {
        if (!dispenseData.vehicleId || !dispenseData.liters || !dispenseData.tankId) return;

        const vehicle = vehicles.find((v: any) => v.id === dispenseData.vehicleId);
        if (!vehicle) return;

        addFuelLog({
            id: crypto.randomUUID(),
            vehicleId: dispenseData.vehicleId,
            siteId: selectedSiteId,
            tankId: dispenseData.tankId,
            date: new Date().toISOString(),
            liters: Number(dispenseData.liters),
            cost: 0, // Cost is calculated from tank avg cost usually, simplify for now
            mileage: Number(dispenseData.mileage),
            fullTank: dispenseData.fullTank,
            filledByUserId: user?.id || 'operator'
        });

        // Update Vehicle Stats
        // In a real app we would recalculate stats here contextually

        alert('Yakıt verme işlemi başarıyla kaydedildi.');
        setView('MENU');
        setDispenseData({ vehicleId: '', tankId: '', liters: '', mileage: '', fullTank: true });
    };

    if (view === 'DISPENSE') {
        return (
            <div className="p-4 space-y-4">
                <Button variant="ghost" onClick={() => setView('MENU')} className="mb-4">← Geri Dön</Button>
                <Card>
                    <CardHeader><CardTitle>Araca Yakıt Ver</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Depo Seçimi</Label>
                            <Select onValueChange={v => setDispenseData({ ...dispenseData, tankId: v })}>
                                <SelectTrigger><SelectValue placeholder="Hangi depodan?" /></SelectTrigger>
                                <SelectContent>
                                    {fuelTanks.filter((t: any) => t.siteId === selectedSiteId).map((t: any) => (
                                        <SelectItem key={t.id} value={t.id}>{t.name} ({t.currentLevel} Lt)</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Araç Seçimi</Label>
                            <Select onValueChange={v => setDispenseData({ ...dispenseData, vehicleId: v })}>
                                <SelectTrigger><SelectValue placeholder="Plaka seçiniz" /></SelectTrigger>
                                <SelectContent>
                                    {vehicles.filter((v: any) => v.status === 'ACTIVE').map((v: any) => (
                                        <SelectItem key={v.id} value={v.id}>{v.plate} - {v.brand}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Verilen Miktar (Litre)</Label>
                            <Input type="number" value={dispenseData.liters} onChange={e => setDispenseData({ ...dispenseData, liters: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Güncel Sayaç (KM / Saat)</Label>
                            <Input type="number" value={dispenseData.mileage} onChange={e => setDispenseData({ ...dispenseData, mileage: e.target.value })} />
                        </div>
                        <div className="flex items-center gap-2 pt-2">
                            <input
                                type="checkbox"
                                id="fullTank"
                                checked={dispenseData.fullTank}
                                onChange={e => setDispenseData({ ...dispenseData, fullTank: e.target.checked })}
                                className="w-5 h-5"
                            />
                            <Label htmlFor="fullTank">Depo Fullendi</Label>
                        </div>
                        <Button className="w-full mt-4" size="lg" onClick={handleDispense}>KAYDET</Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="p-4 flex flex-col min-h-screen">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-xl font-bold">Saha Operasyon</h1>
                    <p className="text-sm text-slate-500">{sites.find((s: any) => s.id === selectedSiteId)?.name}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => { logout(); router.push('/login'); }}>
                    <LogOut className="w-5 h-5" />
                </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 flex-1 content-start">
                <Button
                    variant="outline"
                    className="h-32 flex flex-col gap-2 text-lg border-2 border-blue-100 bg-blue-50 text-blue-800 hover:bg-blue-100 hover:border-blue-300"
                    onClick={() => setView('DISPENSE')}
                >
                    <Truck className="w-10 h-10" />
                    Araca Yakıt Ver
                </Button>

                <div className="grid grid-cols-2 gap-4">
                    <Button
                        variant="outline"
                        className="h-24 flex flex-col gap-2 border-2"
                        // Implement Stock Entry Modal Later if needed, or re-use existing
                        onClick={() => alert('Bu özellik şu an Dashboard üzerinden kullanılmalı.')}
                    >
                        <Droplets className="w-6 h-6 text-green-600" />
                        Depoya Yakıt Al
                    </Button>
                    <Button
                        variant="outline"
                        className="h-24 flex flex-col gap-2 border-2"
                        onClick={() => alert('Lütfen Dashboard üzerinden Virman yapınız.')}
                    >
                        <ArrowRightLeft className="w-6 h-6 text-orange-600" />
                        Transfer / Virman
                    </Button>
                </div>

                <Card className="mt-8 bg-slate-50">
                    <CardHeader><CardTitle className="text-sm uppercase text-slate-500">Depo Durumları</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        {fuelTanks.filter((t: any) => t.siteId === selectedSiteId).map((t: any) => (
                            <div key={t.id}>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="font-medium">{t.name}</span>
                                    <span>{t.currentLevel} / {t.capacity} Lt</span>
                                </div>
                                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-600"
                                        style={{ width: `${(t.currentLevel / t.capacity) * 100}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                        {fuelTanks.filter((t: any) => t.siteId === selectedSiteId).length === 0 && (
                            <p className="text-sm text-slate-400">Bu şantiyede tanımlı depo yok.</p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
