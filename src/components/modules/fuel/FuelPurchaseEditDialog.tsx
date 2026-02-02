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

export function FuelPurchaseEditDialog({ open, onOpenChange, transfer, onSuccess }: FuelPurchaseEditDialogProps) {
    const { updateFuelTransfer: updateStoreTransfer, fuelTanks } = useAppStore();
    const [isSubmitting, setIsSubmitting] = useState(false);
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
    }, [transfer]);

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

            return updates;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const payload = {
                amount: Number(formData.amount),
                unitPrice: Number(formData.unitPrice),
                totalCost: Number(formData.totalCost),
                date: new Date(formData.date).toISOString(),
                description: formData.description,
                fromType: 'EXTERNAL',
                fromId: formData.supplierName, // Supplier Name
                toType: 'TANK',
                toId: formData.tankId, // Target Tank
                createdByUserId: transfer.createdByUserId
            };

            const result = await updateFuelTransfer(transfer.id, payload as any);

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
                toast.error(result.error || 'Güncelleme yapılamadı.');
            }
        } catch (error) {
            console.error(error);
            toast.error('Bir hata oluştu.');
        } finally {
            setIsSubmitting(false);
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
                                readOnly
                                className="bg-slate-100"
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

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
                        <Button type="submit" disabled={isSubmitting}>Kaydet</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
