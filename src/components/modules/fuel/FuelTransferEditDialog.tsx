'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { updateFuelTransfer } from '@/actions/fuel';
import { useAppStore } from '@/lib/store/use-store';
import { toast } from 'sonner';

interface FuelTransferEditDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    transfer: any;
    onSuccess?: () => void;
}

export function FuelTransferEditDialog({ open, onOpenChange, transfer, onSuccess }: FuelTransferEditDialogProps) {
    const { updateFuelTransfer: updateStoreTransfer } = useAppStore();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        amount: 0,
        unitPrice: 0,
        totalCost: 0,
        date: '',
        description: ''
    });

    useEffect(() => {
        if (transfer) {
            setFormData({
                amount: transfer.amount || 0,
                unitPrice: transfer.unitPrice || 0,
                totalCost: transfer.totalCost || 0,
                date: transfer.date ? new Date(transfer.date).toISOString().split('T')[0] : '',
                description: transfer.description || ''
            });

            // If start local datetime needed, adjust logic. 
            // For now, date input assumes YYYY-MM-DD.
            // If transfer has time, we might lose it if only using date picker.
            // Let's try to preserve time if we just split, but Input type='datetime-local' is better for preserving time.
            if (transfer.date) {
                const d = new Date(transfer.date);
                // Simple format for datetime-local: YYYY-MM-DDTHH:mm
                const iso = d.toISOString().slice(0, 16);
                setFormData(prev => ({ ...prev, date: iso }));
            }
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
            if (field === 'totalCost') {
                const cost = parseFloat(value);
                const amt = parseFloat(String(prev.amount));
                if (!isNaN(cost) && !isNaN(amt) && amt > 0) {
                    updates.unitPrice = parseFloat((cost / amt).toFixed(2));
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
                // Preserve original IDs to avoid breaking links if we don't allow changing them here
                fromType: transfer.fromType,
                fromId: transfer.fromId,
                toType: transfer.toType,
                toId: transfer.toId,
                createdByUserId: transfer.createdByUserId
            };

            const result = await updateFuelTransfer(transfer.id, payload as any);

            if (result.success && result.data) {
                toast.success('Kayıt güncellendi.');
                // Update Store
                // We need to implement updateFuelTransfer in store or just reload/fetch. 
                // Store likely has updateFuelTransfer? Check use-store.
                // Assuming useAppStore has it or we can just fetch.
                // Assuming users of this dialog will handle refresh if store method missing.
                if (updateStoreTransfer) {
                    updateStoreTransfer(transfer.id, result.data);
                } else {
                    // Fallback
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
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Kayıt Düzenle</DialogTitle>
                    <DialogDescription>
                        İşlem detaylarını güncelle.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
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
