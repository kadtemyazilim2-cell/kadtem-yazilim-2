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

export function CashBookForm() {
    const [open, setOpen] = useState(false);
    const { addCashTransaction, sites, users } = useAppStore();
    const { user, hasPermission } = useAuth();
    const canCreate = hasPermission('cash-book', 'CREATE');

    // [NEW] Separate permission for Edit/Delete actions within the list, but this form is for Create.
    // However, if we are in "Edit Mode" (not implemented here yet, but good practice), we'd check EDIT.

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

    // Default responsible user to current user when opening/resetting
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
    };

    const generateDescription = (date: string, category: string) => {
        if (!date || !category) return '';
        try {
            const d = new Date(date);
            const monthName = format(d, 'MMMM', { locale: tr });
            // Capitalize first letter
            const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
            return `${capitalizedMonth} Ayı Şantiye Harcaması İçin Verilen`;
        } catch (e) {
            return '';
        }
    };

    // Handling Date Change
    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newDate = e.target.value;
        let newDescription = formData.description;

        if (formData.type === 'INCOME' && formData.category) {
            newDescription = generateDescription(newDate, formData.category);
        }

        setFormData({
            ...formData,
            date: newDate,
            description: newDescription
        });
    };

    // Handling Category Change
    const handleCategoryChange = (val: string) => {
        let newDescription = formData.description;

        if (formData.type === 'INCOME') {
            newDescription = generateDescription(formData.date, val);
        }

        setFormData({
            ...formData,
            category: val,
            description: newDescription
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        // [NEW] Date Restriction Check
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

        // Validation
        if (!formData.siteId) {
            alert('Lütfen şantiye seçiniz.');
            return;
        }
        if (!formData.category.trim()) {
            alert('Lütfen kategori giriniz.');
            return;
        }
        if (!formData.description.trim()) {
            alert('Lütfen açıklama giriniz.');
            return;
        }

        // Date Validation
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const selectedDate = new Date(formData.date);
        selectedDate.setHours(0, 0, 0, 0);

        const todayStr = new Date().toISOString().split('T')[0];

        if (formData.date > todayStr) {
            alert('İleri tarihli işlem giremezsiniz.');
            return;
        }

        if (user.role !== 'ADMIN') {
            const allowedDays = user.editLookbackDays || 0;
            const minDate = new Date(today);
            minDate.setDate(today.getDate() - allowedDays);

            // Compare timestamps or strings. Since time is zeroed, timestamps work well.
            if (selectedDate < minDate) {
                alert(`Geçmişe yönelik işlem girme yetkiniz kısıtlanmıştır. En fazla ${allowedDays} gün geriye işlem yapabilirsiniz.`);
                return;
            }
        }

        addCashTransaction({
            id: crypto.randomUUID(),
            ...formData,
            type: formData.type as 'INCOME' | 'EXPENSE',
            amount: Number(formData.amount),
            createdByUserId: user.id,
            responsibleUserId: formData.responsibleUserId || user.id, // Fallback
            createdAt: new Date().toISOString(),
        });

        setOpen(false);
        resetForm();
    };

    // Set default on open if empty
    const handleOpenChange = (open: boolean) => {
        setOpen(open);
        if (open && !formData.responsibleUserId && user) {
            setFormData(prev => ({ ...prev, responsibleUserId: user.id }));
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            {canCreate && (
                <DialogTrigger asChild>
                    <Button className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="w-4 h-4 mr-2" /> İşlem Ekle
                    </Button>
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Kasa İşlemi Ekle</DialogTitle>
                    <DialogDescription>
                        Gelir veya gider kaydı oluşturun.
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
                                onValueChange={(v) => setFormData({ ...formData, type: v })}
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
                                type="number"
                                step="0.01"
                                required
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
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
                        <Button type="submit">Kaydet</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
