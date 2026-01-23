'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store/use-store';
import { useAuth } from '@/lib/store/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRightLeft } from 'lucide-react';

export function FuelTransferForm() {
    const { fuelTanks, vehicles, addFuelTransfer } = useAppStore();
    const { user } = useAuth();
    const [open, setOpen] = useState(false);

    // Form State
    const [fromType, setFromType] = useState<'TANK' | 'EXTERNAL'>('TANK');
    const [fromId, setFromId] = useState('');
    const [toType, setToType] = useState<'TANK'>('TANK');
    const [toId, setToId] = useState('');
    const [amount, setAmount] = useState(0);
    const [unitPrice, setUnitPrice] = useState(0); // [NEW]
    const [totalCost, setTotalCost] = useState(0); // [NEW]
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        addFuelTransfer({
            id: crypto.randomUUID(),
            fromType,
            fromId,
            toType,
            toId,
            date,
            amount,
            unitPrice: fromType === 'EXTERNAL' ? unitPrice : undefined,
            totalCost: fromType === 'EXTERNAL' ? totalCost : undefined,
            createdByUserId: user.id
        });
        setOpen(false);
        setAmount(0);
        setUnitPrice(0);
        setTotalCost(0);
    };

    // Auto calculate total cost
    const handleAmountChange = (val: number) => {
        setAmount(val);
        if (unitPrice > 0) setTotalCost(Number((val * unitPrice).toFixed(2)));
    };

    const handleUnitPriceChange = (val: number) => {
        setUnitPrice(val);
        if (amount > 0) setTotalCost(Number((amount * val).toFixed(2)));
    };

    // [NEW] Back-calculate unit price if total cost is entered
    const handleTotalCostChange = (val: number) => {
        setTotalCost(val);
        if (amount > 0) setUnitPrice(Number((val / amount).toFixed(2)));
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="secondary" className="bg-orange-100 text-orange-800 hover:bg-orange-200">
                    <ArrowRightLeft className="w-4 h-4 mr-2" /> Yakıt Virman / Transfer
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Yakıt Transferi (Virman)</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Çıkış Yeri (Kaynak)</Label>
                            <Select value={fromType} onValueChange={(v: any) => setFromType(v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="TANK">Depo (Tank)</SelectItem>
                                    <SelectItem value="EXTERNAL">Dış Kaynak (Satın Alma)</SelectItem>
                                </SelectContent>
                            </Select>
                            {fromType === 'TANK' && (
                                <Select value={fromId} onValueChange={setFromId} required>
                                    <SelectTrigger><SelectValue placeholder="Depo Seçiniz" /></SelectTrigger>
                                    <SelectContent>
                                        {fuelTanks.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name} ({t.currentLevel} Lt)</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            )}
                            {fromType === 'EXTERNAL' && (
                                <Input placeholder="Firma Adı" value={fromId} onChange={e => setFromId(e.target.value)} required />
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label>Giriş Yeri (Hedef)</Label>
                            <Select value={toType} onValueChange={(v: any) => setToType(v)} disabled>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="TANK">Depo (Tank)</SelectItem>
                                </SelectContent>
                            </Select>
                            {toType === 'TANK' && (
                                <Select value={toId} onValueChange={setToId} required>
                                    <SelectTrigger><SelectValue placeholder="Depo Seçiniz" /></SelectTrigger>
                                    <SelectContent>
                                        {fuelTanks.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Tarih</Label>
                            <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
                        </div>
                        <div className="space-y-2">
                            <Label>Miktar (Litre)</Label>
                            <Input type="number" step="0.01" value={amount} onChange={e => handleAmountChange(Number(e.target.value))} required />
                        </div>
                    </div>

                    {fromType === 'EXTERNAL' && (
                        <div className="grid grid-cols-2 gap-4 bg-slate-50 p-2 rounded border">
                            <div className="space-y-2">
                                <Label>Birim Fiyat (TL)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={unitPrice || ''}
                                    onChange={e => handleUnitPriceChange(Number(e.target.value))}
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Toplam Tutar (TL)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={totalCost || ''}
                                    onChange={e => handleTotalCostChange(Number(e.target.value))}
                                    placeholder="0.00"
                                    required // Enforce at least Total Cost
                                />
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button type="submit">Transfer Yap</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
