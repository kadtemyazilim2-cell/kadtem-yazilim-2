'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store/use-store';
import { useAuth } from '@/lib/store/use-auth';
import { useUserSites } from '@/hooks/use-user-access'; // [NEW]
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRightLeft } from 'lucide-react';

export function FuelTransferForm() {
    const { fuelTanks, addFuelTransfer } = useAppStore();
    const { user } = useAuth();
    const accessibleSites = useUserSites(); // [NEW]
    const accessibleTanks = fuelTanks.filter((t: any) => accessibleSites.some((s: any) => s.id === t.siteId)); // [NEW] Filtered tanks

    const [open, setOpen] = useState(false);

    // Form State
    const [fromId, setFromId] = useState('');
    const [toId, setToId] = useState('');
    const [amount, setAmount] = useState(0);
    const [date] = useState(new Date().toISOString().split('T')[0]); // Date is auto-set

    // Reset form when dialog opens/closes
    const handleOpenChange = (isOpen: boolean) => {
        setOpen(isOpen);
        if (isOpen) {
            // Reset form on open to prevent stale data
            setFromId('');
            setToId('');
            setAmount(0);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        try {
            const result = await import('@/actions/fuel').then(mod => mod.createFuelTransfer({
                fromType: 'TANK',
                fromId,
                toType: 'TANK',
                toId,
                date: new Date(date),
                amount,
                createdByUserId: user.id
            }));

            if (result.success && result.data) {
                // Update Local State for immediate feedback
                addFuelTransfer(result.data as any);
                setOpen(false);
                setAmount(0);
                setFromId('');
                setToId('');
            } else {
                alert(result.error || 'Transfer başarısız.');
            }
        } catch (error) {
            console.error(error);
            alert('Bir hata oluştu.');
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
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
                            <Label>Çıkış Depo</Label>
                            <Select value={fromId} onValueChange={setFromId} required>
                                <SelectTrigger><SelectValue placeholder="Depo Seçiniz" /></SelectTrigger>
                                <SelectContent>
                                    {accessibleTanks.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name} ({t.currentLevel} Lt)</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Giriş Depo</Label>
                            <Select value={toId} onValueChange={setToId} required>
                                <SelectTrigger><SelectValue placeholder="Depo Seçiniz" /></SelectTrigger>
                                <SelectContent>
                                    {accessibleTanks.filter((t: any) => t.id !== fromId).map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Miktar (Litre)</Label>
                        <Input type="number" step="0.01" value={amount} onChange={e => setAmount(Number(e.target.value))} required />
                    </div>

                    <DialogFooter>
                        <Button type="submit">Transfer Yap</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
