'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useAppStore } from '@/lib/store/use-store';
import { useAuth } from '@/lib/store/use-auth';
import { useLocalStorage } from '@/hooks/use-local-storage';
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
import { FuelGivenList } from '@/components/modules/fuel/FuelGivenList'; // [NEW]
import { FuelTransferList } from '@/components/modules/fuel/FuelTransferList'; // [NEW]
import { FuelPurchaseList } from '@/components/modules/fuel/FuelPurchaseList'; // [NEW]

export default function FuelMovementPage() {
    const { fuelTanks, vehicles, addFuelTransfer, addFuelLog } = useAppStore();
    const { hasPermission, user, refreshSession } = useAuth(); // [NEW] refreshSession

    // [NEW] Refresh Session on Mount
    useEffect(() => {
        refreshSession();
    }, []);

    const rawAvailableSites = useUserSites();
    const availableSites = useMemo(() => (rawAvailableSites || []).filter((s: any) => s.status !== 'INACTIVE'), [rawAvailableSites]);

    // Filter Tanks based on available sites
    const accessibleTanks = useMemo(() => (fuelTanks || []).filter((t: any) => (availableSites || []).some((s: any) => s.id === t.siteId)), [fuelTanks, availableSites]);;

    const [selectedDispenseSiteId, setSelectedDispenseSiteId] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const submitLock = useRef(false); // [NEW] Synclock for double-click prevention

    // Auto-select site if only one available
    useEffect(() => {
        if (availableSites?.length === 1 && !selectedDispenseSiteId) {
            setSelectedDispenseSiteId(availableSites[0].id);
        }
    }, [availableSites, selectedDispenseSiteId]);

    // Filter Tanks based on selected site for Dispense (Yakıt Verme)
    const dispenseTanks = useMemo(() => (fuelTanks || []).filter((t: any) => t.siteId === selectedDispenseSiteId), [fuelTanks, selectedDispenseSiteId]);

    // Auto-select tank
    useEffect(() => {
        if (dispenseTanks.length > 0) {
            setDispenseData(prev => ({ ...prev, tankId: dispenseTanks[0].id }));
        }
    }, [dispenseTanks]);

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

    const defaultTab = canDispense ? 'dispense' : (canTransfer ? 'transfer' : (canPurchase ? 'purchase' : ''));

    if (!defaultTab) {
        return <div className="p-6 text-center text-muted-foreground">Görüntülenecek modül bulunamadı.</div>;
    }

    // [MOD] Persist Date and Time
    const [date, setDate] = useLocalStorage('fuel_form_date', new Date().toISOString().split('T')[0]);
    const [time, setTime] = useLocalStorage('fuel_form_time', new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }));

    // 1. TRANSFER (Virman) State [SIMPLIFIED]
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

    // Helper to format number string (10000 -> 10.000)
    const formatNumberString = (val: string) => {
        if (!val) return '';
        let raw = val.replace(/\./g, '').replace(',', '.');
        raw = raw.replace(/[^0-9.]/g, '');
        const parts = raw.split('.');
        let integerPart = parts[0];
        const decimalPart = parts.length > 1 ? ',' + parts[1].slice(0, 2) : '';
        integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return integerPart + decimalPart;
    };

    // Helper to parse formatted string to number (10.000,50 -> 10000.50)
    const parseFormattedNumber = (val: string) => {
        if (!val) return 0;
        const normalized = val.replace(/\./g, '').replace(',', '.');
        const num = parseFloat(normalized);
        return isNaN(num) ? 0 : num;
    };

    const handleAmountChange = (val: string, setter: any, field: string) => {
        let clean = val.replace(/[^0-9,]/g, '');
        const parts = clean.split(',');
        if (parts.length > 2) {
            clean = parts[0] + ',' + parts.slice(1).join('');
        }
        let integerPart = parts[0].replace(/^0+(?!$)/, '');
        if (integerPart === '') integerPart = '0';
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

    const handleTransfer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || submitLock.current) return;
        submitLock.current = true;
        setIsSubmitting(true);

        const amount = parseFormattedNumber(transferData.amount);
        if (amount <= 0) {
            toast.error('Lütfen geçerli bir miktar giriniz.');
            return;
        }

        const sourceTank = fuelTanks.find((t: any) => t.id === transferData.fromId);
        if (!sourceTank) {
            toast.error('Kaynak depo bulunamadı.');
            return;
        }

        if (transferData.fromId === transferData.toId) {
            toast.error('Kaynak ve hedef depo aynı olamaz.');
            return;
        }

        // Auto-set Date to NOW
        const now = new Date();

        try {
            const result = await import('@/actions/fuel').then(mod => mod.createFuelTransfer({
                fromType: 'TANK',
                fromId: transferData.fromId,
                toType: 'TANK',
                toId: transferData.toId,
                date: now, // [FIX] Pass Date object
                amount: amount,
                createdByUserId: user.id
            }));

            if (result.success && result.data) {
                addFuelTransfer(result.data as any);
                toast.success('Transfer (Virman) işlemi başarıyla kaydedildi.');
                clearTransfer();
            } else {
                toast.error(result.error || 'Transfer başarısız.');
            }
        } catch (error) {
            console.error(error);
            toast.error('Bir hata oluştu.');
        }
    };

    const handlePurchase = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || submitLock.current) return;
        submitLock.current = true;
        setIsSubmitting(true);

        const amount = parseFormattedNumber(purchaseData.amount);
        const price = parseFormattedNumber(purchaseData.unitPrice);

        if (amount <= 0) {
            toast.error('Lütfen geçerli bir miktar giriniz.');
            return;
        }

        const now = new Date();
        const combinedDate = new Date(date);
        combinedDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());

        try {
            const result = await import('@/actions/fuel').then(mod => mod.createFuelTransfer({
                fromType: 'EXTERNAL',
                fromId: purchaseData.firmName,
                toType: 'TANK',
                toId: purchaseData.toId,
                date: combinedDate, // [FIX] Pass Date object
                amount: amount,
                unitPrice: price,
                totalCost: amount * price,
                createdByUserId: user.id,
                description: `Birim Fiyat: ${price} TL`
            }));

            if (result.success && result.data) {
                addFuelTransfer(result.data as any);
                toast.success('Yakıt Alımı başarıyla kaydedildi.');
                clearPurchase();
            } else {
                toast.error(result.error || 'İşlem başarısız.');
            }
        } catch (error) {
            console.error(error);
            toast.error('Bir hata oluştu.');
        }
    };

    const handleDispense = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || submitLock.current) return;
        submitLock.current = true;
        setIsSubmitting(true);

        const amount = parseFormattedNumber(dispenseData.amount);
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

        const now = new Date();

        try {
            const result = await import('@/actions/fuel').then(mod => mod.createFuelLog({
                vehicleId: dispenseData.vehicleId,
                siteId: sourceTank.siteId || '',
                tankId: dispenseData.tankId,
                date: now, // [FIX] Pass Date object
                liters: amount,
                cost: 0,
                mileage: mileage,
                fullTank: dispenseData.fullTank,
                filledByUserId: user.id,
                description: dispenseData.description
            }));

            if (result.success && result.data) {
                addFuelLog(result.data as any);
                toast.success('Yakıt Verme (Tüketim) işlemi başarıyla kaydedildi.');
                clearDispense();
            } else {
                toast.error(result.error || 'İşlem başarısız.');
            }
        } catch (error) {
            console.error(error);
            toast.error('Bir hata oluştu.');
        } finally {
            setIsSubmitting(false);
            submitLock.current = false;
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Yakıt Hareketleri</h2>
                <p className="text-muted-foreground">
                    Yakıt alım, virman ve araç dolum işlemlerini buradan yönetebilirsiniz.
                </p>
                <div className="mt-2 p-2 bg-red-50 text-xs font-mono rounded border border-red-200">
                    DEBUG:
                    Sites={availableSites.length},
                    AllTanks={fuelTanks.length},
                    AccTanks={accessibleTanks.length}
                    <br />
                    UserRole: {user?.role}
                    <br />
                    SelectedSite: {selectedDispenseSiteId || 'None'}
                    <br />
                    TanksForSelected: {(fuelTanks || []).filter((t: any) => t.siteId === selectedDispenseSiteId).length}
                </div>
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
                                                setDispenseData(prev => ({ ...prev, tankId: '' }));
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
                                            disabled={!selectedDispenseSiteId}
                                        >
                                            <SelectTrigger><SelectValue placeholder="Depo Seçiniz" /></SelectTrigger>
                                            <SelectContent>
                                                {accessibleTanks
                                                    .filter((t: any) => t.siteId === selectedDispenseSiteId)
                                                    .map((t: any) => (
                                                        <SelectItem key={t.id} value={t.id}>{t.name} ({t.currentLevel} Lt)</SelectItem>
                                                    ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Hangi Araca?</Label>
                                        <Select value={dispenseData.vehicleId} onValueChange={v => setDispenseData({ ...dispenseData, vehicleId: v || '' })} required>
                                            <SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger>
                                            <SelectContent>
                                                {(vehicles || [])
                                                    .filter((v: any) => {
                                                        if (v.status !== 'ACTIVE') return false;

                                                        // [FIX] Strict Site Filter: MUST have a site selected
                                                        if (!selectedDispenseSiteId) return false;

                                                        // Check if vehicle belongs to selected site (Primary or Assigned)
                                                        const isPrimary = v.assignedSiteId === selectedDispenseSiteId;
                                                        const isAssigned = v.assignedSiteIds && Array.isArray(v.assignedSiteIds) && v.assignedSiteIds.includes(selectedDispenseSiteId);

                                                        return isPrimary || isAssigned;
                                                    })
                                                    .map((v: any) => <SelectItem key={v.id} value={v.id}>{v.plate} - {v.brand}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
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
                                        </div>
                                        <div className="flex items-center space-x-2 mt-2">
                                            <input
                                                type="checkbox"
                                                id="fullTank"
                                                checked={dispenseData.fullTank}
                                                onChange={e => setDispenseData({ ...dispenseData, fullTank: e.target.checked })}
                                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600"
                                            />
                                            <Label htmlFor="fullTank" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                                Depo Fullendi
                                            </Label>
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
                                        <Button className="flex-1" size="lg" type="submit" disabled={isSubmitting}>
                                            {isSubmitting ? 'Kaydediliyor...' : 'KAYDET'}
                                        </Button>
                                        <Button className="flex-none" size="lg" variant="secondary" type="button" onClick={clearDispense} disabled={isSubmitting}>Temizle</Button>
                                    </div>
                                ) : (
                                    <div className="p-3 bg-yellow-50 text-yellow-800 text-center rounded border border-yellow-200">
                                        Yetkiniz yok.
                                    </div>
                                )}
                            </form>
                        </CardContent>
                    </Card>
                    {/* [NEW] User's Dispense History */}
                    <FuelGivenList />
                </TabsContent>

                {/* YAKIT TRANSFER (VIRMAN) */}
                <TabsContent value="transfer">
                    <Card>
                        <CardHeader>
                            <CardTitle>Yakıt Virman (Transfer)</CardTitle>
                            <CardDescription>Depolar arası transfer.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleTransfer} className="space-y-4">
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-2">
                                        <Label>Çıkış Yeri (Depo)</Label>
                                        <Select
                                            value={transferData.fromId}
                                            onValueChange={v => setTransferData({ ...transferData, fromId: v || '' })}
                                            required
                                        >
                                            <SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger>
                                            <SelectContent>
                                                {/* Show all accessible tanks */}
                                                {accessibleTanks.map((t: any) => (
                                                    <SelectItem key={t.id} value={t.id}>{t.name} ({t.currentLevel} Lt)</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Hedef Depo</Label>
                                        <Select value={transferData.toId} onValueChange={v => setTransferData({ ...transferData, toId: v || '' })} required>
                                            <SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger>
                                            <SelectContent>
                                                {accessibleTanks.filter((t: any) => t.id !== transferData.fromId).map((t: any) => (
                                                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
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

                                {canTransferCreate ? (
                                    <div className="flex gap-2">
                                        <Button className="flex-1" size="lg" variant="secondary" type="submit" disabled={isSubmitting}>
                                            {isSubmitting ? 'İşleniyor...' : 'TRANSFER YAP'}
                                        </Button>
                                        <Button className="flex-none" size="lg" variant="outline" type="button" onClick={clearTransfer} disabled={isSubmitting}>Temizle</Button>
                                    </div>
                                ) : (
                                    <div className="p-3 bg-yellow-50 text-yellow-800 text-center rounded border border-yellow-200">
                                        Yetkiniz yok.
                                    </div>
                                )}
                            </form>
                        </CardContent>
                    </Card>
                    <div className="mt-6">
                        <FuelTransferList />
                    </div>
                </TabsContent>

                {/* YAKIT ALIMI (PURCHASE) */}
                <TabsContent value="purchase">
                    <Card>
                        <CardHeader>
                            <CardTitle>Yakıt Satın Alma</CardTitle>
                            <CardDescription>Dışarıdan depoya yakıt girişi.</CardDescription>
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
                                        <Button className="flex-1" size="lg" variant="outline" type="submit" disabled={isSubmitting}>
                                            {isSubmitting ? 'Kaydediliyor...' : 'STOK GİRİŞİ YAP'}
                                        </Button>
                                        <Button className="flex-none" size="lg" variant="ghost" type="button" onClick={clearPurchase} disabled={isSubmitting}>Temizle</Button>
                                    </div>
                                ) : (
                                    <div className="mt-4 p-3 bg-yellow-50 text-yellow-800 text-center rounded border border-yellow-200">
                                        Yetkiniz yok.
                                    </div>
                                )}
                            </form>
                        </CardContent>
                    </Card>
                    <div className="mt-6">
                        <FuelPurchaseList isWidget={true} />
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
