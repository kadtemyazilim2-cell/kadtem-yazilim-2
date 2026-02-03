'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { updateFuelTransfer } from '@/actions/fuel';
import { useAppStore } from '@/lib/store/use-store';
import { toast } from 'sonner';

interface FuelPurchaseEditDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    transfer: any;
    onSuccess?: () => void;
}

}
import { Loader2 } from 'lucide-react';

export function FuelPurchaseEditDialog({ open, onOpenChange, transfer, onSuccess }: FuelPurchaseEditDialogProps) {
    const { updateFuelTransfer: updateStoreTransfer, fuelTanks } = useAppStore();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        amount: 0,
        unitPrice: 0,
        totalCost: 0,
        date: '',
        supplierName: '', // fromId for purchases
        tankId: '',      // toId for purchases
        description: ''
    });

    useEffect(() => {
        setError(null); // Reset error on open/change
        if (transfer) {
            let dateVal = '';
            if (transfer.date) {
                const d = new Date(transfer.date);
                const offsetMs = d.getTimezoneOffset() * 60 * 1000;
                const localISOTime = (new Date(d.getTime() - offsetMs)).toISOString().slice(0, 16);
                dateVal = localISOTime;
            }

            setFormData({
                amount: transfer.amount || 0,
                unitPrice: transfer.unitPrice || 0,
                totalCost: transfer.totalCost || 0,
                date: dateVal,
                supplierName: transfer.fromId || '',
                tankId: transfer.toId || '',
                description: transfer.description || ''
            });
        }
    }, [transfer, open]);

    const handleChange = (field: string, value: any) => {
        setFormData(prev => {
            const updates = { ...prev, [field]: value };

            // Auto-calc cost/price logic
            if (field === 'amount' || field === 'unitPrice') {
                const amt = field === 'amount' ? parseFloat(value) : parseFloat(String(prev.amount));
                const price = field === 'unitPrice' ? parseFloat(value) : parseFloat(String(prev.unitPrice));
                if (!isNaN(amt) && !isNaN(price)) {
                    updates.totalCost = parseFloat((amt * price).toFixed(2));
                }
            }

            // [NEW] Reverse Calc: If Total Cost changes, update Unit Price
            if (field === 'totalCost') {
                const total = parseFloat(value);
                const amt = parseFloat(String(prev.amount));
                if (!isNaN(total) && !isNaN(amt) && amt > 0) {
                    updates.unitPrice = parseFloat((total / amt).toFixed(2));
                }
            }

            return updates;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Validation
        if (!formData.supplierName.trim()) {
            const msg = 'Lütfen tedarikçi firma giriniz.';
            toast.warning(msg);
            setError(msg);
            return;
        }
        if (!formData.tankId) {
            const msg = 'Lütfen bir depo seçiniz.';
            toast.warning(msg);
            setError(msg);
            return;
        }
        if (!formData.date) {
            const msg = 'Lütfen tarih seçiniz.';
            toast.warning(msg);
            setError(msg);
            return;
        }
        if (Number(formData.amount) <= 0) {
            const msg = 'Miktar 0\'dan büyük olmalıdır.';
            toast.warning(msg);
            setError(msg);
            return;
        }

        setIsSubmitting(true);
        let result;

        try {
            const payload = {
                amount: Number(formData.amount),
                unitPrice: Number(formData.unitPrice),
                totalCost: Number(formData.totalCost),
                date: new Date(formData.date).toISOString(),
                description: formData.description,
                fromType: 'EXTERNAL', // Fixed type
                fromId: formData.supplierName,
                toType: 'TANK', // Fixed type
                toId: formData.tankId,
                createdByUserId: transfer.createdByUserId
            };

            result = await updateFuelTransfer(transfer.id, payload as any);

            if (result.success && result.data) {
                toast.success('Satın alma kaydı güncellendi.');
                if (updateStoreTransfer) {
                    updateStoreTransfer(transfer.id, result.data);
                } else {
                    window.location.reload();
                }

                onOpenChange(false);
                if (onSuccess) onSuccess();
            } else {
                const msg = result.error || 'Güncelleme yapılamadı.';
                toast.error(msg);
                setError(msg);
            }
        } catch (error: any) {
            console.error(error);
            const msg = 'Bir hata oluştu: ' + (error.message || 'Bilinmeyen hata');
            toast.error(msg);
            setError(msg);
        } finally {
            setIsSubmitting(false);
            // Force close if it was a reload scenario to prevent stuck state
            if (!updateStoreTransfer && result?.success) {
                onOpenChange(false);
            }
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Yakıt Alım Düzenle</DialogTitle>
                    <DialogDescription>
                        Satın alma detaylarını güncelle.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                    {/* Supplier & Tank */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Tedarikçi Firma</Label>
                            <Input
                                value={formData.supplierName}
                                onChange={e => handleChange('supplierName', e.target.value)}
                                placeholder="Firma Adı"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Giriş Yapılan Depo</Label>
                            <Select
                                value={formData.tankId}
                                onValueChange={(val) => handleChange('tankId', val)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Depo Seçiniz" />
                                </SelectTrigger>
                                <SelectContent>
                                    {fuelTanks.filter((t: any) => t.status === 'ACTIVE' || t.id === formData.tankId).map((t: any) => (
                                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Date & Amount */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Tarih & Saat</Label>
                            <Input
                                type="datetime-local"
                                value={formData.date}
                                onChange={e => handleChange('date', e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Miktar (Lt)</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={formData.amount}
                                onChange={e => handleChange('amount', e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    {/* Price & Cost */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Birim Fiyat (TL)</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={formData.unitPrice}
                                onChange={e => handleChange('unitPrice', e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Toplam Tutar (TL)</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={formData.totalCost}
                                onChange={e => handleChange('totalCost', e.target.value)}
                                className="bg-white"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Açıklama</Label>
                        <Textarea
                            value={formData.description}
                            onChange={e => handleChange('description', e.target.value)}
                            placeholder="Açıklama..."
                        />
                    </div>

                    {error && (
                        <div className="text-sm font-medium text-destructive bg-destructive/10 p-2 rounded">
                            {error}
                        </div>
                    )}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>İptal</Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
