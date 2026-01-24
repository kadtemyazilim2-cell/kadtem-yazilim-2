'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '@/lib/store/use-store';
import { useAuth } from '@/lib/store/use-auth';
import { useLocalStorage } from '@/hooks/use-local-storage'; // [NEW]
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

    const rawAvailableSites = useUserSites();
    const availableSites = useMemo(() => (rawAvailableSites || []).filter((s: any) => s.status !== 'INACTIVE'), [rawAvailableSites]); // [MOD] Filter Passive Sites

    // Filter Tanks based on available sites
    const accessibleTanks = useMemo(() => (fuelTanks || []).filter((t: any) => (availableSites || []).some((s: any) => s.id === t.siteId)), [fuelTanks, availableSites]);;

    const [selectedDispenseSiteId, setSelectedDispenseSiteId] = useState('');

    // Auto-select site if only one available
    useEffect(() => {
        if (availableSites?.length === 1 && !selectedDispenseSiteId) {
            setSelectedDispenseSiteId(availableSites[0].id);
        }
    }, [availableSites, selectedDispenseSiteId]);

    // Filter Tanks based on selected site for Dispense (Yakıt Verme)
    const dispenseTanks = useMemo(() => (fuelTanks || []).filter((t: any) => t.siteId === selectedDispenseSiteId), [fuelTanks, selectedDispenseSiteId]);

    // Auto-select tank if only one in selected site
    useEffect(() => {
        if (dispenseTanks.length === 1 && selectedDispenseSiteId) {
            // Avoid setting if already set to prevent loop (even with memo, good practice)
            setDispenseData(prev => prev.tankId === dispenseTanks[0].id ? prev : ({ ...prev, tankId: dispenseTanks[0].id }));
            setTransferData(prev => prev.fromId === dispenseTanks[0].id ? prev : ({ ...prev, fromId: dispenseTanks[0].id }));
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

    // [MOD] Persist Date and Time
    const [date, setDate] = useLocalStorage('fuel_form_date', new Date().toISOString().split('T')[0]);
    const [time, setTime] = useLocalStorage('fuel_form_time', new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }));

    // 1. TRANSFER (Virman) State
    const [transferData, setTransferData] = useLocalStorage('fuel_transfer_form', {
        fromType: 'TANK', fromId: '', toType: 'TANK', toId: '', amount: ''
    });

    // 2. PURCHASE (Yakıt Alımı) State
    const [purchaseData, setPurchaseData] = useLocalStorage('fuel_purchase_form', {
        firmName: '', toType: 'TANK', toId: '', amount: '', unitPrice: ''
    });

    // 3. DISPENSE (Yakıt Verme) State
    const [dispenseData, setDispenseData] = useLocalStorage('fuel_dispense_form', {
        tankId: '', vehicleId: '', amount: '', mileage: '', fullTank: true, description: ''
    });

    // Manual Clear Functions
    const clearTransfer = () => setTransferData({ fromType: 'TANK', fromId: '', toType: 'TANK', toId: '', amount: '' });
    const clearPurchase = () => setPurchaseData({ firmName: '', toType: 'TANK', toId: '', amount: '', unitPrice: '' });
    const clearDispense = () => setDispenseData({ tankId: '', vehicleId: '', amount: '', mileage: '', fullTank: true, description: '' });

    // Helper to combine Date + Time
    const getDateTime = () => {
        // Create date object from inputs
        const combined = new Date(`${date}T${time}`);
        // If invalid, fallback to date only (which implies 00:00 UTC)
        // But better is to just send the ISO string of the combined
        return isNaN(combined.getTime()) ? date : combined.toISOString();
    };

    // [NEW] Helper to format number string (10000 -> 10.000)
    const formatNumberString = (val: string) => {
        if (!val) return '';
        // Remove existing format
        let raw = val.replace(/\./g, '').replace(',', '.');
        // Allow digits and one dot (for standard JS float)
        raw = raw.replace(/[^0-9.]/g, '');

        // Split integer and decimal
        const parts = raw.split('.');
        let integerPart = parts[0];
        const decimalPart = parts.length > 1 ? ',' + parts[1].slice(0, 2) : ''; // Limit decimal to 2 chars

        // Add thousands separator
        integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

        return integerPart + decimalPart;
    };

    // [NEW] Helper to parse formatted string to number (10.000,50 -> 10000.50)
    const parseFormattedNumber = (val: string) => {
        if (!val) return 0;
        const normalized = val.replace(/\./g, '').replace(',', '.');
        const num = parseFloat(normalized);
        return isNaN(num) ? 0 : num;
    };

    // Wrapper for setting amount/price with formatting
    const handleAmountChange = (val: string, setter: any, field: string) => {
        // Allow user to type comma or dot
        // If user types dot, treated as thousands separator OR decimal if they mean it? 
        // TR standard: Dot = Thousands, Comma = Decimal.
        // If user types '10.5', assuming they might mean 10,5. 
        // But let's enforce comma for decimal to be consistent.
        // Actually, simple regex input masking is better:

        // 1. Clean input: only digits and ONE comma
        let clean = val.replace(/[^0-9,]/g, '');

        // Prevent multiple commas
        const parts = clean.split(',');
        if (parts.length > 2) {
            clean = parts[0] + ',' + parts.slice(1).join('');
        }

        // 2. Format Integer part
        let integerPart = parts[0].replace(/^0+(?!$)/, ''); // Remove leading zeros
        if (integerPart === '') integerPart = '0'; // But keep single zero if empty? No, better empty if empty.

        // If strictly empty
        if (clean === '') {
            setter(prev => ({ ...prev, [field]: '' }));
            return;
        }

        const formattedInt = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        let final = formattedInt;

        if (val.includes(',')) {
            final += ',' + (parts[1] || '');
        }

        setter(prev => ({ ...prev, [field]: final }));
    };

    const handleTransfer = (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        const amount = parseFormattedNumber(transferData.amount);
        if (amount <= 0) {
            toast.error('Lütfen geçerli bir miktar giriniz.');
            return;
        }

        // Note: fromId/toId validation check...

        const sourceTank = fuelTanks.find((t: any) => t.id === transferData.fromId);
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
            date: getDateTime(),
            amount: amount,
            createdByUserId: user.id
        });
        toast.success('Transfer (Virman) işlemi başarıyla kaydedildi.');
        // setTransferData({ ...transferData, amount: '' });
    };

    const handlePurchase = (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        const amount = parseFormattedNumber(purchaseData.amount);
        const price = parseFormattedNumber(purchaseData.unitPrice);

        if (amount <= 0) {
            toast.error('Lütfen geçerli bir miktar giriniz.');
            return;
        }

        // Auto-detect time logic (User request: "saati otomatik algıla")
        // Use the selected DATE from the form, but force CURRENT TIME.
        const now = new Date();
        const combinedDate = new Date(date); // 'date' is YYYY-MM-DD string, so this creates a date at 00:00 UTC or Local? 
        // new Date('2023-01-01') fits local timezone usually in browser.
        combinedDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());

        // Treat purchase as External -> [TANK] transfer (Fixed to TANK)
        addFuelTransfer({
            id: crypto.randomUUID(),
            fromType: 'EXTERNAL',
            fromId: purchaseData.firmName,
            toType: 'TANK', // [FIX] Always TANK
            toId: purchaseData.toId,
            date: combinedDate.toISOString(),
            amount: amount,
            unitPrice: price,
            totalCost: amount * price,
            createdByUserId: user.id,
            description: `Birim Fiyat: ${price} TL`
        });
        toast.success('Yakıt Alımı başarıyla kaydedildi.');
        // setPurchaseData({ ...purchaseData, amount: '', unitPrice: '' });
    };

    const handleDispense = (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        const amount = parseFormattedNumber(dispenseData.amount);
        // Middleware logic handled by store usually, but let's parse raw mileage too if formatted
        // but mileage usually doesn't have decimals. Let's support it anyway.
        const mileage = parseFormattedNumber(dispenseData.mileage);

        if (amount <= 0) {
            toast.error('Lütfen geçerli bir miktar giriniz.');
            return;
        }

        const sourceTank = fuelTanks.find((t: any) => t.id === dispenseData.tankId);
        if (!sourceTank) {
            toast.error('Kaynak depo bulunamadı.');
            return;
        }

        addFuelLog({
            id: crypto.randomUUID(),
            vehicleId: dispenseData.vehicleId,
            siteId: sourceTank.siteId || '',
            tankId: dispenseData.tankId,
            date: getDateTime(), // [FIX] Use combined DateTime
            liters: amount,
            cost: 0,
            mileage: mileage,
            fullTank: dispenseData.fullTank,
            filledByUserId: user.id,
            description: dispenseData.description
        });
        toast.success('Yakıt Verme (Tüketim) işlemi başarıyla kaydedildi.');
        // Do NOT clear form automatically as per user request
        // setDispenseData({ ...dispenseData, amount: '', mileage: '', description: '' }); 
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
                                                {availableSites.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
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
                                                {dispenseTanks.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name} ({t.currentLevel} Lt)</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Hangi Araca?</Label>
                                        <Select value={dispenseData.vehicleId} onValueChange={v => setDispenseData({ ...dispenseData, vehicleId: v || '' })} required>
                                            <SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger>
                                            <SelectContent>
                                                {(vehicles || [])
                                                    .filter((v: any) =>
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
                                                    .map((v: any) => <SelectItem key={v.id} value={v.id}>{v.plate} - {v.brand}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-2">
                                        <Label>Tarih</Label>
                                        <div className="flex gap-2">
                                            <Input type="date" value={date} onChange={e => setDate(e.target.value)} required className="flex-1" />
                                            <Input type="time" value={time} onChange={e => setTime(e.target.value)} required className="w-24" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Güncel KM/Saat</Label>
                                        <Input
                                            type="text"
                                            inputMode="decimal"
                                            value={dispenseData.mileage}
                                            onChange={e => handleAmountChange(e.target.value, setDispenseData, 'mileage')}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Verilen Miktar (Lt)</Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="text"
                                            inputMode="decimal"
                                            value={dispenseData.amount}
                                            onChange={e => handleAmountChange(e.target.value, setDispenseData, 'amount')}
                                            required
                                            className="flex-1"
                                        />
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
                                    <div className="flex gap-2">
                                        <Button className="flex-1" size="lg" type="submit">KAYDET</Button>
                                        <Button className="flex-none" size="lg" variant="secondary" type="button" onClick={clearDispense}>Temizle</Button>
                                    </div>
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
                                                {availableSites.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
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
                                                {dispenseTanks.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name} ({t.currentLevel} Lt)</SelectItem>)}
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
                                                    {(accessibleTanks || []).filter((t: any) => t.id !== transferData.fromId).map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <Select value={transferData.toId} onValueChange={v => setTransferData({ ...transferData, toId: v || '' })} required>
                                                <SelectTrigger><SelectValue placeholder="Araç Seçiniz" /></SelectTrigger>
                                                <SelectContent>
                                                    {(vehicles || []).filter((v: any) => v.status === 'ACTIVE').map((v: any) => <SelectItem key={v.id} value={v.id}>{v.plate}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-2">
                                        <Label>Tarih</Label>
                                        <div className="flex gap-2">
                                            <Input type="date" value={date} onChange={e => setDate(e.target.value)} required className="flex-1" />
                                            <Input type="time" value={time} onChange={e => setTime(e.target.value)} required className="w-24" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Miktar (Lt)</Label>
                                        <Input
                                            type="text"
                                            inputMode="decimal"
                                            value={transferData.amount}
                                            onChange={e => handleAmountChange(e.target.value, setTransferData, 'amount')}
                                            required
                                        />
                                    </div>
                                </div>

                                {canTransferCreate ? (
                                    <div className="flex gap-2">
                                        <Button className="flex-1" size="lg" variant="secondary" type="submit">TRANSFER YAP</Button>
                                        <Button className="flex-none" size="lg" variant="outline" type="button" onClick={clearTransfer}>Temizle</Button>
                                    </div>
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

                                <div className="space-y-2">
                                    <Label>Depo Seçimi</Label>
                                    <Select value={purchaseData.toId} onValueChange={v => setPurchaseData({ ...purchaseData, toId: v || '', toType: 'TANK' })} required>
                                        <SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger>
                                        <SelectContent>
                                            {accessibleTanks.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* [NEW] Date/Time for Purchase - Time Automagically Detected */}
                                <div className="space-y-2">
                                    <Label>İşlem Tarihi</Label>
                                    <div className="flex gap-2">
                                        <Input type="date" value={date} onChange={e => setDate(e.target.value)} required className="flex-1" />
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">Saat otomatik olarak kaydedilecektir.</p>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-2">
                                        <Label>Miktar (Lt)</Label>
                                        <Input
                                            type="text"
                                            inputMode="decimal"
                                            value={purchaseData.amount}
                                            onChange={e => handleAmountChange(e.target.value, setPurchaseData, 'amount')}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Birim Fiyat (TL)</Label>
                                        <Input
                                            type="text"
                                            inputMode="decimal"
                                            value={purchaseData.unitPrice}
                                            onChange={e => handleAmountChange(e.target.value, setPurchaseData, 'unitPrice')}
                                            placeholder="TL"
                                        />
                                    </div>
                                </div>

                                {canPurchaseCreate ? (
                                    <div className="flex gap-2 mt-4">
                                        <Button className="flex-1" size="lg" variant="outline" type="submit">STOK GİRİŞİ YAP</Button>
                                        <Button className="flex-none" size="lg" variant="ghost" type="button" onClick={clearPurchase}>Temizle</Button>
                                    </div>
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
