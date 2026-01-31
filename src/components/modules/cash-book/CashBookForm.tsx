'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store/use-store';
import { useAuth } from '@/lib/store/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { createTransaction } from '@/actions/transaction';

// [NEW] Props for Editing
interface CashBookFormProps {
    initialData?: any;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    onSuccess?: () => void;
}

// [MOD] Export with Props
export function CashBookForm({ initialData, open: externalOpen, onOpenChange: externalOnOpenChange, onSuccess }: CashBookFormProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const isOpen = externalOpen !== undefined ? externalOpen : internalOpen;
    const setOpen = externalOnOpenChange || setInternalOpen;

    const [isSubmitting, setIsSubmitting] = useState(false);
    const { addCashTransaction, updateCashTransaction, sites, users } = useAppStore(); // [FIX] Added updateCashTransaction (assume it exists in store, if not need to add)
    const { user, hasPermission } = useAuth();
    const canCreate = hasPermission('cash-book', 'CREATE');
    const canEdit = hasPermission('cash-book', 'EDIT'); // [NEW]

    const activeSites = sites.filter((s: any) => s.status === 'ACTIVE');

    const [formData, setFormData] = useState({
        siteId: '',
        date: new Date().toISOString().split('T')[0],
        type: 'EXPENSE',
        category: '',
        amount: 0,
        description: '',
        documentNo: '',
        responsibleUserId: '',
    });

    const [displayAmount, setDisplayAmount] = useState('0');

    // [NEW] Initialize from initialData
    useEffect(() => {
        if (initialData) {
            setFormData({
                siteId: initialData.siteId,
                date: new Date(initialData.date).toISOString().split('T')[0],
                type: initialData.type,
                category: initialData.category,
                amount: initialData.amount,
                description: initialData.description || '',
                documentNo: initialData.documentNo || '',
                responsibleUserId: initialData.responsibleUserId || '',
            });
            setDisplayAmount(initialData.amount ? initialData.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) : '0');
        } else if (isOpen) {
            // Reset if opening new
            if (!externalOpen) resetForm();
        }
    }, [initialData, isOpen]);


    const resetForm = () => {
        setFormData({
            siteId: '',
            date: new Date().toISOString().split('T')[0],
            type: 'EXPENSE',
            category: '',
            amount: 0,
            description: '',
            documentNo: '',
            responsibleUserId: user?.id || '',
        });
        setDisplayAmount('0');
    };

    // ... (generateDescription, handleDateChange, handleCategoryChange, formatMoneyInput, handleAmountChange kept same)
    const generateDescription = (date: string, category: string) => {
        if (!date || !category) return '';
        try {
            const d = new Date(date);
            const monthName = format(d, 'MMMM', { locale: tr });
            const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
            return `${capitalizedMonth} Ayı Şantiye Harcaması İçin Verilen`;
        } catch (e) {
            return '';
        }
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newDate = e.target.value;
        let newDescription = formData.description;
        if (formData.type === 'INCOME' && formData.category) {
            newDescription = generateDescription(newDate, formData.category);
        }
        setFormData({ ...formData, date: newDate, description: newDescription });
    };

    const handleCategoryChange = (val: string) => {
        let newDescription = formData.description;
        if (formData.type === 'INCOME') {
            newDescription = generateDescription(formData.date, val);
        }
        setFormData({ ...formData, category: val, description: newDescription });
    };

    // [NEW] Auto-set category when Type changes to INCOME
    const handleTypeChange = (val: string) => {
        let newCategory = formData.category;
        let newDescription = formData.description;

        if (val === 'INCOME') {
            newCategory = 'Şantiye Harcaması İçin Gönderilen';
            newDescription = generateDescription(formData.date, newCategory);
        } else {
            // Reset if switching back to Expense? Maybe not, keep user input unless it was the auto one.
            if (newCategory === 'Şantiye Harcaması İçin Gönderilen') {
                newCategory = '';
                newDescription = '';
            }
        }

        setFormData({
            ...formData,
            type: val,
            category: newCategory,
            description: newDescription
        });
    };

    const formatMoneyInput = (value: string) => {
        if (!value) return '';
        let val = value.replace(/[^0-9,]/g, '');
        const parts = val.split(',');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return parts.length > 1 ? `${parts[0]},${parts[1].slice(0, 2)}` : parts[0];
    };

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        const formatted = formatMoneyInput(raw);
        setDisplayAmount(formatted);
        let numVal = 0;
        if (formatted) {
            numVal = parseFloat(formatted.replace(/\./g, '').replace(',', '.'));
        }
        if (!isNaN(numVal)) {
            setFormData(prev => ({ ...prev, amount: numVal }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || isSubmitting) return;

        // Date Restriction Check
        if (user.role !== 'ADMIN' && user.editLookbackDays !== undefined) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const target = new Date(formData.date);
            target.setHours(0, 0, 0, 0);
            const diff = (today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24);

            if (diff > user.editLookbackDays) {
                alert(`Geriye dönük en fazla ${user.editLookbackDays} gün işlem yapabilirsiniz.`);
                return;
            }
        }

        if (!formData.siteId) { alert('Lütfen şantiye seçiniz.'); return; }
        if (!formData.category.trim()) { alert('Lütfen kategori giriniz.'); return; }
        if (!formData.description.trim()) { alert('Lütfen açıklama giriniz.'); return; }

        const todayStr = new Date().toISOString().split('T')[0];
        if (formData.date > todayStr) { alert('İleri tarihli işlem giremezsiniz.'); return; }

        setIsSubmitting(true);
        try {
            const payload = {
                siteId: formData.siteId,
                date: new Date(formData.date),
                type: formData.type as 'INCOME' | 'EXPENSE',
                category: formData.category,
                amount: Number(formData.amount),
                description: formData.description,
                documentNo: formData.documentNo,
                createdByUserId: user.id,
                responsibleUserId: formData.responsibleUserId || user.id
            };

            if (initialData) {
                // UPDATE
                const updateAction = await import('@/actions/transaction').then(m => m.updateTransaction);
                const res = await updateAction(initialData.id, payload);
                if (res.success && res.data) {
                    // Update Store (Optimistic or Refresh)
                    // Assume updateCashTransaction exists in store
                    // updateCashTransaction(initialData.id, res.data);
                    window.location.reload(); // Temporary force refresh to ensure sync if store update not ready
                    setOpen(false);
                    if (onSuccess) onSuccess();
                } else {
                    alert(res.error || 'Güncelleme başarısız.');
                }
            } else {
                // CREATE
                const res = await createTransaction(payload as any);
                if (res.success && res.data) {
                    addCashTransaction({
                        ...res.data,
                        date: new Date(res.data.date).toISOString(),
                        createdAt: new Date(res.data.createdAt).toISOString(),
                    } as any);
                    setOpen(false);
                    resetForm();
                    if (onSuccess) onSuccess();
                } else {
                    alert(res.error || 'İşlem kaydedilemedi.');
                }
            }

        } catch (error) {
            console.error(error);
            alert('Bir hata oluştu.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleOpenChange = (open: boolean) => {
        setOpen(open);
        if (open && !initialData && !formData.responsibleUserId && user) {
            setFormData(prev => ({ ...prev, responsibleUserId: user.id }));
        }
        if (!open) {
            // If closed, reset unless initialData exists (which persists)
            if (!initialData) resetForm();
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            {canCreate && !initialData && (
                <DialogTrigger asChild>
                    <Button className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="w-4 h-4 mr-2" /> İşlem Ekle
                    </Button>
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{initialData ? 'İşlemi Düzenle' : 'Kasa İşlemi Ekle'}</DialogTitle>
                    <DialogDescription>
                        {initialData ? 'Mevcut kaydı güncelleyin.' : 'Gelir veya gider kaydı oluşturun.'}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label>İlgili Personel (İşlemi Yapan)</Label>
                        <Select
                            value={formData.responsibleUserId}
                            onValueChange={(v) => setFormData({ ...formData, responsibleUserId: v })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Personel Seçiniz" />
                            </SelectTrigger>
                            <SelectContent>
                                {users.map((u: any) => (
                                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Şantiye <span className="text-red-500">*</span></Label>
                            <Select
                                value={formData.siteId}
                                onValueChange={(v) => setFormData({ ...formData, siteId: v })}
                                required
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seçiniz" />
                                </SelectTrigger>
                                <SelectContent>
                                    {activeSites.map((s: any) => (
                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>İşlem Tipi</Label>
                            <Select
                                value={formData.type}
                                onValueChange={handleTypeChange}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="INCOME">Gelir / Tahsilat</SelectItem>
                                    <SelectItem value="EXPENSE">Gider / Harcama</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Tarih</Label>
                            <Input
                                type="date"
                                required
                                value={formData.date}
                                max={new Date().toISOString().split('T')[0]} // Future dates disabled
                                min={user?.role !== 'ADMIN' ? (() => {
                                    const d = new Date();
                                    d.setDate(d.getDate() - (user?.editLookbackDays || 0));
                                    return d.toISOString().split('T')[0];
                                })() : undefined}
                                onChange={handleDateChange}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Tutar (TL)</Label>
                            <Input
                                type="text"
                                inputMode="decimal"
                                placeholder="0,00"
                                required
                                value={displayAmount}
                                onChange={handleAmountChange}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Kategori <span className="text-red-500">*</span></Label>
                        <Select
                            value={formData.category}
                            onValueChange={handleCategoryChange}
                            required
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Kategori Seçiniz" />
                            </SelectTrigger>
                            <SelectContent>
                                {formData.type === 'EXPENSE' ? (
                                    <>
                                        <SelectItem value="Avans">Avans</SelectItem>
                                        <SelectItem value="Diğer">Diğer</SelectItem>
                                        <SelectItem value="Fatura">Fatura</SelectItem>
                                        <SelectItem value="Hırdavat / Sarf Malzeme">Hırdavat / Sarf Malzeme</SelectItem>
                                        <SelectItem value="İşçilik">İşçilik</SelectItem>
                                        <SelectItem value="Kira">Kira</SelectItem>
                                        <SelectItem value="Malzeme">Malzeme</SelectItem>
                                        <SelectItem value="Nakliye">Nakliye</SelectItem>
                                        <SelectItem value="Resmi Giderler">Resmi Giderler</SelectItem>
                                        <SelectItem value="Şantiye Giderleri">Şantiye Giderleri</SelectItem>
                                        <SelectItem value="Tamir / Bakım">Tamir / Bakım</SelectItem>
                                        <SelectItem value="Yakıt">Yakıt</SelectItem>
                                        <SelectItem value="Yemek / Gıda">Yemek / Gıda</SelectItem>
                                    </>
                                ) : (
                                    <>
                                        <SelectItem value="Şantiye Harcaması İçin Gönderilen">Şantiye Harcaması İçin Gönderilen</SelectItem>
                                    </>
                                )}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Açıklama <span className="text-red-500">*</span></Label>
                        <Input
                            placeholder="Detay açıklama..."
                            required
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Belge No</Label>
                        <Input
                            placeholder="Fatura No / Fiş No"
                            value={formData.documentNo}
                            onChange={(e) => setFormData({ ...formData, documentNo: e.target.value })}
                        />
                    </div>

                    <DialogFooter>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
