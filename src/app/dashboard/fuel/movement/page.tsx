'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store/use-store';
import { useAuth } from '@/lib/store/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowRightLeft, Droplets, Fuel } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useRouter } from 'next/navigation';
import { toast } from "sonner";
import { useUserSites } from '@/hooks/use-user-access';

export default function FuelMovementPage() {
    const { fuelTanks, vehicles, addFuelTransfer, addFuelLog } = useAppStore();
    const { hasPermission, user } = useAuth();
    const availableSites = useUserSites(); // [NEW]

    // Filter Tanks based on available sites
    const accessibleTanks = fuelTanks.filter((t: any) => availableSites.some((s: any) => s.id === t.siteId));

    const [selectedDispenseSiteId, setSelectedDispenseSiteId] = useState('');

    // Auto-select site if only one available
    useEffect(() => {
        if (availableSites.length === 1 && !selectedDispenseSiteId) {
            setSelectedDispenseSiteId(availableSites[0].id);
        }
    }, [availableSites, selectedDispenseSiteId]);

    // Filter Tanks based on selected site for Dispense (Yakıt Verme)
    const dispenseTanks = fuelTanks.filter(t => t.siteId === selectedDispenseSiteId);

    // Auto-select tank if only one in selected site
    useEffect(() => {
        if (dispenseTanks.length === 1 && selectedDispenseSiteId) {
            setDispenseData(prev => ({ ...prev, tankId: dispenseTanks[0].id }));
            setTransferData(prev => ({ ...prev, fromId: dispenseTanks[0].id }));
        }
    }, [dispenseTanks, selectedDispenseSiteId]);

    const canViewPage = hasPermission('movement', 'VIEW');
    const canDispense = hasPermission('movement.dispense', 'VIEW') || hasPermission('movement', 'VIEW');
    const canTransfer = hasPermission('movement.transfer', 'VIEW') || hasPermission('movement', 'VIEW');
    const canPurchase = hasPermission('movement.purchase', 'VIEW') || hasPermission('movement', 'VIEW');

    const canDispenseCreate = hasPermission('movement.dispense', 'CREATE') || hasPermission('movement', 'CREATE');
    const canTransferCreate = hasPermission('movement.transfer', 'CREATE') || hasPermission('movement', 'CREATE');
    const canPurchaseCreate = hasPermission('movement.purchase', 'CREATE') || hasPermission('movement', 'CREATE');

    if (!canViewPage) {
        return <div className="p-6 text-center text-muted-foreground">Bu sayfaya erişim yetkiniz yok.</div>;
    }

    // Determine default tab based on permissions
    const defaultTab = canDispense ? 'dispense' : (canTransfer ? 'transfer' : (canPurchase ? 'purchase' : ''));

    if (!defaultTab) {
        return <div className="p-6 text-center text-muted-foreground">Görüntülenecek modül bulunamadı.</div>;
    }

    // ... (rest of code) ...

    // [INSIDE RENDER]
    // <Tabs defaultValue={defaultTab} ...>
    //   <TabsList ...>
    //      {canDispense && <TabsTrigger value="dispense" ...>}
    //      {canTransfer && <TabsTrigger value="transfer" ...>}
    //      {canPurchase && <TabsTrigger value="purchase" ...>}
    //   </TabsList>
    //   ...
    //   {canDispense && <TabsContent value="dispense">...</TabsContent>}
    //   ...

    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    // 1. TRANSFER (Virman) State
    const [transferData, setTransferData] = useState({
        fromType: 'TANK', fromId: '', toType: 'TANK', toId: '', amount: ''
    });

    // 2. PURCHASE (Yakıt Alımı) State
    const [purchaseData, setPurchaseData] = useState({
        firmName: '', toType: 'TANK', toId: '', amount: '', unitPrice: ''
    });

    // 3. DISPENSE (Yakıt Verme) State
    const [dispenseData, setDispenseData] = useState({
        tankId: '', vehicleId: '', amount: '', mileage: '', fullTank: true, description: ''
    });

    const handleTransfer = (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        const amount = Number(transferData.amount);
        if (amount <= 0) {
            toast.error('Lütfen geçerli bir miktar giriniz.');
            return;
        }

        const sourceTank = fuelTanks.find(t => t.id === transferData.fromId);
        if (!sourceTank) {
            toast.error('Kaynak depo bulunamadı.');
            return;
        }

        if (transferData.fromId === transferData.toId && transferData.toType === 'TANK') {
            toast.error('Kaynak ve hedef depo aynı olamaz.');
            return;
        }

        addFuelTransfer({
            id: crypto.randomUUID(),
            fromType: transferData.fromType as any,
            fromId: transferData.fromId,
            toType: transferData.toType as any,
            toId: transferData.toId,
            date,
            amount: amount,
            createdByUserId: user.id
        });
        toast.success('Transfer (Virman) işlemi başarıyla kaydedildi.');
        setTransferData({ ...transferData, amount: '' });
    };

    const handlePurchase = (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        const amount = Number(purchaseData.amount);
        const price = Number(purchaseData.unitPrice);

        if (amount <= 0) {
            toast.error('Lütfen geçerli bir miktar giriniz.');
            return;
        }

        // Treat purchase as External -> [Target] transfer
        addFuelTransfer({
            id: crypto.randomUUID(),
            fromType: 'EXTERNAL',
            fromId: purchaseData.firmName,
            toType: purchaseData.toType as any, // 'TANK' or 'VEHICLE'
            toId: purchaseData.toId,
            date,
            amount: amount,
            unitPrice: price,
            totalCost: amount * price,
            createdByUserId: user.id,
            description: `Birim Fiyat: ${price} TL`
        });
        toast.success('Yakıt Alımı başarıyla kaydedildi.');
        setPurchaseData({ ...purchaseData, amount: '', unitPrice: '' });
    };

    const handleDispense = (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        const amount = Number(dispenseData.amount);
        if (amount <= 0) {
            toast.error('Lütfen geçerli bir miktar giriniz.');
            return;
        }

        const sourceTank = fuelTanks.find(t => t.id === dispenseData.tankId);
        if (!sourceTank) {
            toast.error('Kaynak depo bulunamadı.');
            return;
        }

        addFuelLog({
            id: crypto.randomUUID(),
            vehicleId: dispenseData.vehicleId,
            siteId: sourceTank.siteId || '',
            tankId: dispenseData.tankId,
            date: date, // User selected date
            liters: amount,
            cost: 0,
            mileage: Number(dispenseData.mileage),
            fullTank: dispenseData.fullTank,
            filledByUserId: user.id,
            description: dispenseData.description
        });
        toast.success('Yakıt Verme (Tüketim) işlemi başarıyla kaydedildi.');
        setDispenseData({ ...dispenseData, amount: '', mileage: '', description: '' });
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Yakıt Hareketleri</h2>
                <p className="text-muted-foreground">
                    Yakıt alım, virman ve araç dolum işlemlerini buradan yönetebilirsiniz.
                </p>
            </div>

            <Tabs defaultValue="dispense" className="w-full">
                <TabsList className="grid w-full grid-cols-3 h-auto min-h-[3.5rem]">
                    {canDispense && (
                        <TabsTrigger value="dispense" className="gap-2 text-sm md:text-lg whitespace-normal leading-tight py-2 h-full">
                            <Fuel className="w-4 h-4 md:w-5 md:h-5 shrink-0" /> <span className="text-center">Yakıt Ver (Tüketim)</span>
                        </TabsTrigger>
                    )}
                    {canTransfer && (
                        <TabsTrigger value="transfer" className="gap-2 text-sm md:text-lg whitespace-normal leading-tight py-2 h-full">
                            <ArrowRightLeft className="w-4 h-4 md:w-5 md:h-5 shrink-0" /> <span className="text-center">Transfer (Virman)</span>
                        </TabsTrigger>
                    )}
                    {canPurchase && (
                        <TabsTrigger value="purchase" className="gap-2 text-sm md:text-lg whitespace-normal leading-tight py-2 h-full">
                            <Droplets className="w-4 h-4 md:w-5 md:h-5 shrink-0" /> <span className="text-center">Yakıt Alımı (Depo)</span>
                        </TabsTrigger>
                    )}
                </TabsList>

                {/* YAKIT VERME (DISPENSE) */}
                <TabsContent value="dispense">
                    <Card>
                        <CardHeader>
                            <CardTitle>Araca / Makineye Yakıt Ver</CardTitle>
                            <CardDescription>Depodan araca yakıt dolumu yap.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleDispense} className="space-y-4">
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-2">
                                        <Label>Şantiye</Label>
                                        <Select
                                            value={selectedDispenseSiteId}
                                            onValueChange={v => {
                                                setSelectedDispenseSiteId(v);
                                                setDispenseData(prev => ({ ...prev, tankId: '' })); // Reset tank on site change
                                            }}
                                            disabled={availableSites.length === 1}
                                        >
                                            <SelectTrigger><SelectValue placeholder="Şantiye Seçiniz" /></SelectTrigger>
                                            <SelectContent>
                                                {availableSites.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Hangi Depodan?</Label>
                                        <Select
                                            value={dispenseData.tankId}
                                            onValueChange={v => setDispenseData({ ...dispenseData, tankId: v || '' })}
                                            required
                                            disabled={!selectedDispenseSiteId}
                                        >
                                            <SelectTrigger><SelectValue placeholder={!selectedDispenseSiteId ? "Önce Şantiye Seçiniz" : "Depo Seçiniz"} /></SelectTrigger>
                                            <SelectContent>
                                                {dispenseTanks.map(t => <SelectItem key={t.id} value={t.id}>{t.name} ({t.currentLevel} Lt)</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Hangi Araca?</Label>
                                        <Select value={dispenseData.vehicleId} onValueChange={v => setDispenseData({ ...dispenseData, vehicleId: v || '' })} required>
                                            <SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger>
                                            <SelectContent>
                                                {vehicles
                                                    .filter(v =>
                                                        v.status === 'ACTIVE' &&
                                                        // Optional: Filter vehicle by site too? 
                                                        // User request was specific about "Depo" (Tank). But usually vehicles are also site specific.
                                                        // Let's filter vehicles by selectedSiteId too for better UX if desired.
                                                        // "personele verilen şantiyenin deposu".
                                                        // Let's keep logic simple: filter by available sites check we added globally, 
                                                        // but maybe refine to selectedDispenseSiteId?
                                                        // Usually vehicles move between sites so strict filtering might be annoying.
                                                        // But "assignedSiteId" exists on vehicle.
                                                        // Let's stick to showing active vehicles for now, maybe filtered by availableSites logic (global check).
                                                        true
                                                    )
                                                    .map(v => <SelectItem key={v.id} value={v.id}>{v.plate} - {v.brand}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-2">
                                        <Label>Tarih</Label>
                                        <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Güncel KM/Saat</Label>
                                        <Input type="number" value={dispenseData.mileage} onChange={e => setDispenseData({ ...dispenseData, mileage: e.target.value })} required />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Verilen Miktar (Lt)</Label>
                                    <div className="flex items-center gap-2">
                                        <Input type="number" value={dispenseData.amount} onChange={e => setDispenseData({ ...dispenseData, amount: e.target.value })} required className="flex-1" />
                                        <div className="flex items-center gap-2 whitespace-nowrap bg-muted/30 px-3 py-2 rounded-md border text-sm h-10">
                                            <input
                                                type="checkbox" className="w-4 h-4"
                                                id="fullTankParams"
                                                checked={dispenseData.fullTank}
                                                onChange={e => setDispenseData({ ...dispenseData, fullTank: e.target.checked })}
                                            />
                                            <Label htmlFor="fullTankParams" className="cursor-pointer font-normal m-0">Full</Label>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Notlar</Label>
                                    <Textarea
                                        placeholder="İşlem ile ilgili notlar..."
                                        className="resize-none h-20"
                                        value={dispenseData.description}
                                        onChange={e => setDispenseData({ ...dispenseData, description: e.target.value })}
                                    />
                                </div>

                                {canDispenseCreate ? (
                                    <Button className="w-full" size="lg">KAYDET</Button>
                                ) : (
                                    <div className="p-3 bg-yellow-50 text-yellow-800 text-center rounded border border-yellow-200">
                                        Yetkiniz yok.
                                    </div>
                                )}
                            </form>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* YAKIT TRANSFER (VIRMAN) */}
                <TabsContent value="transfer">
                    <Card>
                        <CardHeader>
                            <CardTitle>Yakıt Virman (Transfer)</CardTitle>
                            <CardDescription>Depolar arası veya depodan araca transfer.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleTransfer} className="space-y-4">
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-2">
                                        <Label>Şantiye (Çıkış)</Label>
                                        <Select
                                            value={selectedDispenseSiteId}
                                            onValueChange={v => {
                                                setSelectedDispenseSiteId(v);
                                                setTransferData(prev => ({ ...prev, fromId: '' }));
                                            }}
                                            disabled={availableSites.length === 1}
                                        >
                                            <SelectTrigger><SelectValue placeholder="Şantiye Seçiniz" /></SelectTrigger>
                                            <SelectContent>
                                                {availableSites.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Çıkış Yeri (Depo)</Label>
                                        <Select
                                            value={transferData.fromId}
                                            onValueChange={v => setTransferData({ ...transferData, fromId: v || '' })}
                                            required
                                            disabled={!selectedDispenseSiteId}
                                        >
                                            <SelectTrigger><SelectValue placeholder={!selectedDispenseSiteId ? "Önce Şantiye Seçiniz" : "Seçiniz"} /></SelectTrigger>
                                            <SelectContent>
                                                {dispenseTanks.map(t => <SelectItem key={t.id} value={t.id}>{t.name} ({t.currentLevel} Lt)</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-2">
                                        <Label>Giriş Yeri Tipi</Label>
                                        <Select value={transferData.toType} onValueChange={(v: any) => setTransferData({ ...transferData, toType: v, toId: '' })} required>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="TANK">Başka Depoya</SelectItem>
                                                <SelectItem value="VEHICLE">Araca (Özel)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>{transferData.toType === 'TANK' ? 'Hedef Depo' : 'Hedef Araç'}</Label>
                                        {transferData.toType === 'TANK' ? (
                                            <Select value={transferData.toId} onValueChange={v => setTransferData({ ...transferData, toId: v || '' })} required>
                                                <SelectTrigger><SelectValue placeholder="Depo Seçiniz" /></SelectTrigger>
                                                <SelectContent>
                                                    {accessibleTanks.filter(t => t.id !== transferData.fromId).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <Select value={transferData.toId} onValueChange={v => setTransferData({ ...transferData, toId: v || '' })} required>
                                                <SelectTrigger><SelectValue placeholder="Araç Seçiniz" /></SelectTrigger>
                                                <SelectContent>
                                                    {vehicles.filter(v => v.status === 'ACTIVE').map(v => <SelectItem key={v.id} value={v.id}>{v.plate}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-2">
                                        <Label>Tarih</Label>
                                        <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Miktar (Lt)</Label>
                                        <Input type="number" value={transferData.amount} onChange={e => setTransferData({ ...transferData, amount: e.target.value })} required />
                                    </div>
                                </div>

                                {canTransferCreate ? (
                                    <Button className="w-full" size="lg" variant="secondary">TRANSFER YAP</Button>
                                ) : (
                                    <div className="p-3 bg-yellow-50 text-yellow-800 text-center rounded border border-yellow-200">
                                        Yetkiniz yok.
                                    </div>
                                )}
                            </form>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* YAKIT ALIMI (PURCHASE) */}
                <TabsContent value="purchase">
                    <Card>
                        <CardHeader>
                            <CardTitle>Yakıt Satın Alma</CardTitle>
                            <CardDescription>Dışarıdan depoya veya araca yakıt girişi.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handlePurchase} className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Tedarikçi Firma</Label>
                                    <Input placeholder="Firma Adı" value={purchaseData.firmName} onChange={e => setPurchaseData({ ...purchaseData, firmName: e.target.value })} required />
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-2">
                                        <Label>Giriş Yeri</Label>
                                        <Select value={purchaseData.toType} onValueChange={(v: any) => setPurchaseData({ ...purchaseData, toType: v, toId: '' })} required>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="TANK">Sabit Depoya</SelectItem>
                                                <SelectItem value="VEHICLE">Doğrudan Araca</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>{purchaseData.toType === 'TANK' ? 'Depo Seçimi' : 'Araç Seçimi'}</Label>
                                        {purchaseData.toType === 'TANK' ? (
                                            <Select value={purchaseData.toId} onValueChange={v => setPurchaseData({ ...purchaseData, toId: v || '' })} required>
                                                <SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger>
                                                <SelectContent>
                                                    {accessibleTanks.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <Select value={purchaseData.toId} onValueChange={v => setPurchaseData({ ...purchaseData, toId: v || '' })} required>
                                                <SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger>
                                                <SelectContent>
                                                    {vehicles.filter(v => v.status === 'ACTIVE').map(v => <SelectItem key={v.id} value={v.id}>{v.plate}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-2">
                                        <Label>Miktar (Lt)</Label>
                                        <Input type="number" value={purchaseData.amount} onChange={e => setPurchaseData({ ...purchaseData, amount: e.target.value })} required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Birim Fiyat (TL)</Label>
                                        <Input type="number" value={purchaseData.unitPrice} onChange={e => setPurchaseData({ ...purchaseData, unitPrice: e.target.value })} placeholder="TL" />
                                    </div>
                                </div>

                                {canPurchaseCreate ? (
                                    <Button className="w-full mt-4" size="lg" variant="outline">STOK GİRİŞİ YAP</Button>
                                ) : (
                                    <div className="mt-4 p-3 bg-yellow-50 text-yellow-800 text-center rounded border border-yellow-200">
                                        Yetkiniz yok.
                                    </div>
                                )}
                            </form>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
