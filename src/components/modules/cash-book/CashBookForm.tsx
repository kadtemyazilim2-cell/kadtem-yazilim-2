'use client';

import { useState, useEffect } from 'react';
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
import { createTransaction, updateTransaction } from '@/actions/transaction';

// [NEW] Props for Editing
// [MOD] Add hideTrigger
interface CashBookFormProps {
    initialData?: any;
    defaultValues?: any;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    onSuccess?: () => void;
    hideTrigger?: boolean; // [NEW]
}

export function CashBookForm({ initialData, defaultValues, open: externalOpen, onOpenChange: externalOnOpenChange, onSuccess, hideTrigger }: CashBookFormProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const isOpen = externalOpen !== undefined ? externalOpen : internalOpen;
    const setOpen = externalOnOpenChange || setInternalOpen;

    const [isSubmitting, setIsSubmitting] = useState(false);
    const { addCashTransaction, updateCashTransaction, sites, users } = useAppStore();
    const { user, hasPermission, getAccessibleSites } = useAuth();
    const canCreate = hasPermission('cash-book', 'CREATE');
    const canEdit = hasPermission('cash-book', 'EDIT');

    // [MOD] Simplified Site Availability Logic
    // Since 'sites' in the store are already filtered by the Server (DashboardLayout -> getSites) based on user role/id,
    // active sites in the store are basically the ones user has access to.
    // We skip the double-check against user.assignedSiteIds to avoid sync issues.
    const availableSites = (sites || []).filter((s: any) => s.status !== 'INACTIVE');

    const [formData, setFormData] = useState({
        siteId: '',
        date: new Date().toISOString().split('T')[0],
        type: 'EXPENSE',
        category: '',
        amount: 0,
        description: '',
        documentNo: '',
        responsibleUserId: '',
        paymentMethod: 'CASH',
        imageUrl: '',
    });

    const [file, setFile] = useState<File | null>(null);
    const [statusMessage, setStatusMessage] = useState(''); // [NEW] Progress UI




    const resizeImage = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    const MAX_WIDTH = 800; // [OPTIMIZATION] Reduced from 1024
                    const MAX_HEIGHT = 800; // [OPTIMIZATION] Reduced from 1024

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);
                    // Compress to JPEG at 0.5 quality [OPTIMIZATION] Reduced from 0.7
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
                    resolve(dataUrl);
                };
                img.onerror = (err) => reject(err);
            };
            reader.onerror = (err) => reject(err);
        });
    };

    const convertToBase64 = async (file: File): Promise<string> => {
        // If PDF, just return base64 (no resize)
        if (file.type === 'application/pdf') {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = error => reject(error);
            });
        }
        // If Image, Resize
        return await resizeImage(file);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const [displayAmount, setDisplayAmount] = useState('');

    // [NEW] Initialize from initialData or defaultValues
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
                paymentMethod: initialData.paymentMethod || 'CASH',
                imageUrl: initialData.imageUrl || '',
            });
            // If existing image, we show it (logic below) - file input remains null unless changed
            setDisplayAmount(initialData.amount ? initialData.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) : '0');
        } else if (isOpen) {
            // Reset if opening new
            if (!externalOpen) resetForm();
            // Apply defaults if provided
            if (defaultValues) {
                const isIncome = defaultValues.type === 'INCOME';
                const autoCategory = isIncome ? 'Şantiye Harcaması İçin Gönderilen' : '';

                setFormData(prev => ({
                    ...prev,
                    ...defaultValues,
                    category: defaultValues.category || (isIncome ? autoCategory : prev.category),
                    // Only auto-generate description if not provided in defaultValues
                    description: defaultValues.description || (isIncome ? generateDescription(prev.date, autoCategory) : prev.description)
                }));
            }
        }
    }, [initialData, isOpen, defaultValues]);

    // [NEW] Logic to handle auto-selection when opened via props (external control)
    useEffect(() => {
        if (isOpen && !initialData) {
            // Auto Select Site if only 1 available
            if (availableSites.length === 1) {
                setFormData(prev => ({ ...prev, siteId: availableSites[0].id }));
            }
            // Auto Select User if not set
            if (user && !formData.responsibleUserId) {
                setFormData(prev => ({ ...prev, responsibleUserId: user.id }));
            }
        }
    }, [isOpen, availableSites.length, user]); // Only run when open state changes (specifically to true)


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
            paymentMethod: 'CASH',
            imageUrl: '',
        });
        setFile(null);
        setDisplayAmount('');
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
        // Explicitly check for not undefined and not null to catch 0 correctly
        if (user.role !== 'ADMIN' && user.editLookbackDays !== undefined && user.editLookbackDays !== null) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const target = new Date(formData.date);
            target.setHours(0, 0, 0, 0);

            // Calculate difference in milliseconds
            const diffTime = today.getTime() - target.getTime();
            // Convert to days (floor to be safe, but since hours are 0, it should be exact)
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

            console.log('Client Date Check:', { role: user.role, lookback: user.editLookbackDays, diffDays });

            if (diffDays > user.editLookbackDays) {
                alert(`Geriye dönük en fazla ${user.editLookbackDays} gün işlem yapabilirsiniz.`);
                return;
            }
        }

        if (!formData.siteId) { alert('Lütfen şantiye seçiniz.'); return; }
        if (!formData.category.trim()) { alert('Lütfen kategori giriniz.'); return; }
        if (!formData.description.trim()) { alert('Lütfen açıklama giriniz.'); return; }
        if (Number(formData.amount) <= 0) { alert('Lütfen geçerli bir tutar giriniz (0\'dan büyük).'); return; }

        // Future date check
        const todayStr = new Date().toISOString().split('T')[0];
        if (formData.date > todayStr) { alert('İleri tarihli işlem giremezsiniz.'); return; }

        setIsSubmitting(true);
        try {
            // [FIX] Convert Date to string for safer serialization
            // Assuming server action handles string or Date. We will adjust server action if needed, 
            // but Prisma usually handles ISO strings for DateTime fields well.
            // Actually, best to pass Date object BUT ensure it is valid.
            // Let's pass ISO string to be safe and modify Server Action to parse it.
            // Wait, existing Server Action expects Partial<CashTransaction>. CashTransaction.date is Date.
            // So we MUST pass a Date object or change the type.
            // Let's rely on Date object but ensure it's fresh.

            // [FIX] Convert Date to string to avoid Server Action serialization issues
            const payload: any = {
                siteId: formData.siteId,
                date: new Date(formData.date).toISOString(), // Send as ISO String
                type: formData.type as 'INCOME' | 'EXPENSE',
                category: formData.category,
                amount: Number(formData.amount),
                createdByUserId: user.id,
                responsibleUserId: (formData.responsibleUserId || user.id) || undefined,
                paymentMethod: formData.paymentMethod || 'CASH',
                imageUrl: undefined,
                description: formData.description,
                documentNo: formData.documentNo
            };

            if (file) {
                try {
                    payload.imageUrl = await convertToBase64(file);
                } catch (imgErr) {
                    console.error(imgErr);
                    alert('Görsel işlenirken hata oluştu.');
                    setIsSubmitting(false);
                    return;
                }
            } else if (formData.imageUrl) {
                payload.imageUrl = formData.imageUrl;
            }

            console.log('Submitting Payload:', payload);
            setStatusMessage('Sunucuya gönderiliyor...');

            // Client-side timeout race to prevention stuck state
            const requestPromise = initialData
                ? updateTransaction(initialData.id, payload)
                : createTransaction(payload);

            // Client-side request without artificial race
            console.log('Sending request...');
            const res = await requestPromise;

            console.log('Server Response:', res);

            if (res && res.success && res.data) {
                if (!initialData) {
                    addCashTransaction({
                        ...res.data,
                        date: new Date(res.data.date).toISOString(),
                        createdAt: new Date(res.data.createdAt).toISOString(),
                    } as any);
                    resetForm();
                } else {
                    // Update local store instead of reload
                    updateCashTransaction(initialData.id, {
                        ...res.data,
                        date: new Date(res.data.date).toISOString(),
                    } as any);
                }

                setOpen(false);
                if (onSuccess) onSuccess();
            } else {
                alert(res?.error || 'İşlem kaydedilemedi.');
            }

        } catch (error: any) {
            console.error('Submit Error:', error);
            alert(`Bir hata oluştu: ${error.message || 'Bilinmeyen Hata'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleOpenChange = (open: boolean) => {
        setOpen(open);
        if (!open) {
            // If closed, reset unless initialData exists (which persists)
            if (!initialData) resetForm();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            {!hideTrigger && canCreate && !initialData && (
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
                        {initialData ? 'Mevcut kaydı güncelleyin.' : ''}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                    {(user?.role === 'ADMIN' || hasPermission('cash-book.admin-view', 'VIEW')) && (
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
                                    {(users || []).map((u: any) => (
                                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className={defaultValues?.type ? "space-y-2" : "grid grid-cols-2 gap-4"}>
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
                                    {availableSites.map((s: any) => (
                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {/* Only show Type Selector if not locked by defaultValues */}
                        {!defaultValues?.type && (
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
                        )}
                        {/* Layout fix if Type is hidden: make Site full width? Or keep grid?
                            If hidden, Site is col-span-1.
                            We should probably let Site expand or keep blank space.
                            Grid has 2 cols. If hidden, site takes 1 arg.
                            Let's keep it consistent or make Site full width if locked?
                            Re-rendering the container div to adjust grid cols.
                         */}
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label>Tarih</Label>
                            <Input
                                type="date"
                                required
                                className="text-sm"
                                value={formData.date}
                                max={new Date().toISOString().split('T')[0]}
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

                    {/* Only show Payment Method selector if NOT preset by parent action AND not in quick-action mode */}
                    {!defaultValues?.paymentMethod && (
                        <div className="space-y-2">
                            <Label>Ödeme Yöntemi</Label>
                            <Select
                                value={formData.paymentMethod}
                                onValueChange={(v) => setFormData({ ...formData, paymentMethod: v })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="CASH">Nakit</SelectItem>
                                    <SelectItem value="CREDIT_CARD">Kredi Kartı</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}

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
                                        <SelectItem value="Hırdavat">Hırdavat</SelectItem>
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
                                        <SelectItem value="Tahsilat">Tahsilat</SelectItem>
                                        {(user?.role === 'ADMIN' || hasPermission('cash-book.admin-view', 'VIEW')) && (
                                            <>
                                                <SelectItem value="Nakit İade">Nakit İade</SelectItem>
                                                <SelectItem value="Şantiye Harcaması İçin Gönderilen">Şantiye Harcaması İçin Gönderilen</SelectItem>
                                            </>
                                        )}
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



                    {/* File Upload for Slip */}
                    <div className="space-y-2 border-t pt-4">
                        <Label>Belge / Fiş Görseli {formData.paymentMethod === 'CREDIT_CARD' && <span className="text-sm text-muted-foreground">(Kredi Kartı Slibi)</span>}</Label>
                        {formData.imageUrl ? (
                            <div className="flex items-center gap-2 mt-2">
                                <div className="text-green-600 text-sm flex items-center gap-1">
                                    <span>✓ Görsel Yüklü</span>
                                    <Button type="button" variant="ghost" size="sm" onClick={() => setFormData({ ...formData, imageUrl: '' })} className="h-6 px-2 text-red-500">Sil</Button>
                                </div>
                            </div>
                        ) : null}
                        <Input
                            type="file"
                            accept="image/*,.pdf"
                            onChange={handleFileChange}
                        />
                    </div>

                    <DialogFooter>
                        <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                            {isSubmitting ? (
                                <span className="flex items-center gap-2">
                                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                    {statusMessage || 'İşleniyor...'}
                                </span>
                            ) : (
                                initialData ? 'Güncelle' : 'Kaydet'
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
