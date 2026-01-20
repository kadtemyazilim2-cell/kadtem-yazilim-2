'use client';

import { SimpleRichTextEditor } from '@/components/ui/simple-rich-text-editor';
import { useRouter } from 'next/navigation';

import { useState } from 'react';
import { useAppStore } from '@/lib/store/use-store';
import { useAuth } from '@/lib/store/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, FileText, AlignLeft, AlignCenter, AlignRight, Trash2, Printer, Pencil, Building2, Landmark } from 'lucide-react';
import { format } from 'date-fns';
import { Correspondence } from '@/lib/types';
import { generateCorrespondencePDF } from '@/lib/pdf-generator';
import { toTurkishLower } from '@/lib/utils';

// Server Actions
import { createCorrespondence, updateCorrespondence } from '@/actions/correspondence';
import { createInstitution } from '@/actions/institution';
import { toast } from 'sonner';

interface CorrespondenceFormProps {
    customTrigger?: React.ReactNode;
    initialType?: 'OFFICIAL' | 'INTERNAL' | 'BANK' | 'OTHER';
    initialDirection?: 'INCOMING' | 'OUTGOING';
    initialData?: Correspondence;
}

export function CorrespondenceForm({ customTrigger, initialType, initialDirection, initialData }: CorrespondenceFormProps) {
    const [open, setOpen] = useState(false);
    // Use store ONLY for reading lists
    const { companies, institutions, users, sites, addInstitution, addCorrespondence, updateCorrespondence: updateLocalCorrespondence } = useAppStore();
    const router = useRouter(); // [NEW]
    const { user } = useAuth();


    const [formData, setFormData] = useState({
        companyId: initialData?.companyId || '',
        siteId: initialData?.siteId || '',
        date: initialData?.date?.split('T')[0] || format(new Date(), "yyyy-MM-dd"), // Date only for input
        direction: initialData?.direction || initialDirection || 'OUTGOING',
        type: initialData?.type || initialType || 'OFFICIAL',
        subject: initialData?.subject || '',
        description: initialData?.description || '',
        referenceNumber: initialData?.referenceNumber || '',
        senderReceiver: initialData?.senderReceiver || '',
        senderReceiverAlignment: initialData?.senderReceiverAlignment || 'center',
        interest: initialData?.interest || [] as string[],
        appendices: initialData?.appendices || [] as string[],
        registrationNumber: initialData?.registrationNumber || '',
        attachmentUrls: initialData?.attachmentUrls || [] as string[],
    });

    const [filteredInstitutions, setFilteredInstitutions] = useState<typeof institutions>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const [newInstName, setNewInstName] = useState('');

    const [newInstAlign, setNewInstAlign] = useState<'left' | 'center' | 'right'>('center');
    const [newInstCategory, setNewInstCategory] = useState<'BANK' | 'INSTITUTION'>('INSTITUTION');
    const [isAddInstOpen, setIsAddInstOpen] = useState(false);

    const handleMuhatapChange = (val: string) => {
        setFormData(prev => ({ ...prev, senderReceiver: val }));
        if (val.trim().length > 0) {
            const relevantInstitutions = institutions.filter(i => {
                if (initialType === 'BANK') return i.category === 'BANK' || !i.category;
                return i.category !== 'BANK';
            });
            const matches = relevantInstitutions.filter(i => toTurkishLower(i.name).includes(toTurkishLower(val)));
            setFilteredInstitutions(matches);
            setShowSuggestions(true);
        } else {
            setShowSuggestions(false);
        }
    };

    const selectInstitution = (inst: typeof institutions[0]) => {
        setFormData(prev => ({
            ...prev,
            senderReceiver: inst.name,
            senderReceiverAlignment: (inst.alignment as any) || 'center'
        }));
        setShowSuggestions(false);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            toast.error('Sadece PDF dosyaları yüklenebilir.');
            return;
        }

        if (file.size > 10 * 1024 * 1024) { // 10MB limit
            toast.error('Dosya boyutu 10MB\'dan küçük olmalıdır.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64Info = event.target?.result as string;
            setFormData(prev => ({ ...prev, attachmentUrls: [base64Info] }));
            toast.success("Dosya eklendi.");
        };
        reader.readAsDataURL(file);
    };

    const handleAddInstitution = async () => {
        if (!newInstName.trim()) return;

        const result = await createInstitution({
            name: newInstName.trim(),
            category: newInstCategory,
            alignment: 'center'
        });

        if (result.success && result.data) {
            toast.success("Muhatap eklendi.");

            // [FIX] Update local store immediately for UI to reflect changes
            addInstitution(result.data as any);
            router.refresh(); // Refresh server data

            // Auto-select
            setFormData(prev => ({
                ...prev,
                senderReceiver: result.data!.name,
                senderReceiverAlignment: 'center'
            }));
            setNewInstName('');
            setNewInstAlign('center');
            setIsAddInstOpen(false);
        } else {
            toast.error("Muhatap eklenemedi.");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        // Date Restriction Check
        if (user.role !== 'ADMIN' && user.editLookbackDays !== undefined) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const target = new Date(formData.date);
            target.setHours(0, 0, 0, 0);
            const diff = (today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24);

            if (diff > user.editLookbackDays) {
                toast.error(`Geriye dönük en fazla ${user.editLookbackDays} gün işlem yapabilirsiniz.`);
                return;
            }
        }

        const payload = {
            ...formData,
            siteId: formData.siteId === 'none' ? undefined : formData.siteId, // Handle "No Selection"
            direction: formData.direction as 'INCOMING' | 'OUTGOING',
            type: formData.type as 'OFFICIAL' | 'INTERNAL' | 'OTHER' | 'BANK',
            senderReceiverAlignment: formData.senderReceiverAlignment as 'left' | 'center' | 'right',
            date: `${formData.date}T${format(new Date(), 'HH:mm')}`,
            // Ensure description is not empty if hidden (Incoming)
            description: formData.description || '-'
        };

        try {
            if (initialData) {
                const result = await updateCorrespondence(initialData.id, payload);
                if (result.success) {
                    toast.success("Yazışma güncellendi.");
                    setOpen(false);
                } else {
                    toast.error(result.error);
                }
            } else {
                const result = await createCorrespondence({
                    ...payload,
                    createdByUserId: user.id
                } as any); // Cast because createCorrespondence expect exact types but payload might have loose types

                if (result.success) {
                    toast.success("Yazışma eklendi.");
                    setOpen(false);
                    // Reset
                    setFormData({
                        companyId: '',
                        siteId: '',
                        date: format(new Date(), "yyyy-MM-dd"),
                        direction: initialDirection || 'OUTGOING',
                        type: initialType || 'OFFICIAL',
                        subject: '',
                        description: '',
                        referenceNumber: '',
                        registrationNumber: '',
                        senderReceiver: '',
                        senderReceiverAlignment: 'center',
                        interest: [],
                        appendices: [],
                        attachmentUrls: []
                    });
                } else {
                    toast.error(result.error);
                }
            }
        } catch (error) {
            console.error(error);
            toast.error("Bir hata oluştu.");
        }
    };

    const handlePreview = () => {
        generateCorrespondencePDF(formData, companies, users, true);
    };

    // execCmd moved to SimpleRichTextEditor

    const dropdownOptions = institutions.filter(inst => {
        if (initialType === 'BANK') return inst.category === 'BANK' || !inst.category;
        // If 'OFFICIAL' or others, show non-banks
        return inst.category !== 'BANK';
    });

    return (
        <>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                    {customTrigger ? customTrigger : (
                        <Button className="bg-blue-600 hover:bg-blue-700">
                            <Plus className="w-4 h-4 mr-2" /> Yeni Yazışma
                        </Button>
                    )}
                </DialogTrigger>
                <DialogContent className="sm:max-w-[800px] w-full max-w-[95vw] max-h-[90vh] flex flex-col p-0">
                    <DialogHeader className="px-6 py-4 border-b">
                        <DialogTitle>
                            {initialData ? 'Yazışma Düzenle' : (initialType === 'BANK' ? 'Yeni Banka Yazışması' : 'Yeni Yazışma Ekle')}
                        </DialogTitle>
                        <DialogDescription>
                            {initialData ? 'Mevcut yazışma bilgilerini güncelleyin.' : 'Giden veya gelen evrak kaydı oluşturun.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto px-6 py-4">
                        <form id="correspondence-form" onSubmit={handleSubmit} className="grid gap-4">
                            {/* Fields removed */}
                            {/* ... Content ... */}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Tarih</Label>
                                    <Input
                                        type="date"
                                        required
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>İlgili Firma</Label>
                                    <Select
                                        value={formData.companyId}
                                        onValueChange={(v) => setFormData({ ...formData, companyId: v })}
                                        required
                                    >
                                        <SelectTrigger className="w-full">
                                            <span className="truncate">
                                                <SelectValue placeholder="Seçiniz" />
                                            </span>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {companies.map(c => (
                                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                            </div>

                            {initialType !== 'BANK' && (
                                <div className="space-y-2">
                                    <Label>Şantiye (Opsiyonel)</Label>
                                    <Select
                                        value={formData.siteId}
                                        onValueChange={(v) => setFormData({ ...formData, siteId: v })}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Şantiye Seçiniz (Opsiyonel)" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Seçim Yok</SelectItem>
                                            {sites.filter(s => s.status === 'ACTIVE').map(s => (
                                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {initialType !== 'BANK' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Evrak Sayı Numarası</Label>
                                        <Input
                                            placeholder="Ref-123"
                                            value={formData.referenceNumber}
                                            onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
                                        />
                                    </div>
                                    {/* Registration Number hidden for Outgoing as per request - will receive warning after save */}
                                </div>
                            )}

                            {initialType !== 'BANK' && (
                                <div className="space-y-2">
                                    <Label>Konu</Label>
                                    <Input
                                        placeholder="Yazışma konusu"
                                        required
                                        value={formData.subject}
                                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                    />
                                </div>
                            )}

                            <div className="space-y-2 relative">
                                <div className="flex items-center justify-between">
                                    <Label>Muhatap (Kurum/Şahıs)</Label>

                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            type="button"
                                            className="h-6 text-xs px-2"
                                            onClick={() => {
                                                setIsAddInstOpen(true);
                                                // Initialize category based on context when opening
                                                setNewInstCategory(initialType === 'BANK' ? 'BANK' : 'INSTITUTION');
                                            }}
                                        >
                                            <Plus className="w-3 h-3 mr-1" /> Yeni
                                        </Button>
                                    </div>
                                </div>
                                <Select
                                    value={formData.senderReceiver}
                                    onValueChange={(v) => {
                                        if (v === 'NEW') {
                                            setIsAddInstOpen(true);
                                        } else {
                                            const inst = institutions.find(i => i.name === v);
                                            setFormData({
                                                ...formData,
                                                senderReceiver: v,
                                                senderReceiverAlignment: inst?.alignment || formData.senderReceiverAlignment || 'center'
                                            });
                                        }
                                    }}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Muhatap Seçiniz..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {dropdownOptions.map(inst => (
                                            <SelectItem key={inst.id} value={inst.name}>{inst.name}</SelectItem>
                                        ))}
                                        {/* Fallback: If value is set but not in the FILTERED list, show it anyway */}
                                        {formData.senderReceiver && !dropdownOptions.find(i => i.name === formData.senderReceiver) && (
                                            <SelectItem value={formData.senderReceiver}>{formData.senderReceiver}</SelectItem>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                {/* Hiding Interest (İlgi) for Incoming as per request */}
                                {initialDirection !== 'INCOMING' && formData.direction !== 'INCOMING' && (
                                    <>
                                        <div className="flex justify-between items-center">
                                            <Label>İlgi (Opsiyonel)</Label>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setFormData(prev => ({ ...prev, interest: [...(prev.interest || []), ''] }))}
                                                className="h-6 text-xs"
                                            >
                                                <Plus className="w-3 h-3 mr-1" /> İlgi Ekle
                                            </Button>
                                        </div>
                                        {(formData.interest || []).map((int, idx) => (
                                            <div key={idx} className="flex gap-2">
                                                <div className="flex items-center justify-center w-8 h-10 bg-slate-100 rounded text-sm font-medium text-slate-500 shrink-0">
                                                    {String.fromCharCode(65 + idx)}
                                                </div>
                                                <Input
                                                    value={int}
                                                    onChange={(e) => {
                                                        const newInterests = [...(formData.interest || [])];
                                                        newInterests[idx] = e.target.value;
                                                        setFormData({ ...formData, interest: newInterests });
                                                    }}
                                                    placeholder={`İlgi ${String.fromCharCode(65 + idx)}...`}
                                                />
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => {
                                                        const newInterests = [...(formData.interest || [])];
                                                        newInterests.splice(idx, 1);
                                                        setFormData({ ...formData, interest: newInterests });
                                                    }}
                                                    className="shrink-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>



                            <div className="space-y-2">
                                {/* Hiding Description (Metin) for Incoming as per request */}
                                {initialDirection !== 'INCOMING' && formData.direction !== 'INCOMING' && (
                                    <>
                                        <Label>Metin</Label>
                                        <SimpleRichTextEditor
                                            value={formData.description}
                                            onChange={(val) => setFormData({ ...formData, description: val })}
                                        />
                                    </>
                                )}
                            </div>

                            {/* PDF Preview REMOVED as per request */}

                            <div className="space-y-2">
                                <Label>Dosya Yükle (PDF)</Label>
                                <Input
                                    type="file"
                                    accept="application/pdf"
                                    onChange={handleFileChange}
                                />
                                {formData.attachmentUrls.length > 0 && (
                                    <p className="text-xs text-green-600 mt-1">
                                        {formData.attachmentUrls.length} dosya eklendi.
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <Label>Ekler (Opsiyonel)</Label>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setFormData(prev => ({ ...prev, appendices: [...(prev.appendices || []), ''] }))}
                                        className="h-6 text-xs"
                                    >
                                        <Plus className="w-3 h-3 mr-1" /> Ek Ekle
                                    </Button>
                                </div>
                                {(formData.appendices || []).map((app, idx) => (
                                    <div key={idx} className="flex gap-2">
                                        <div className="flex items-center justify-center w-8 h-10 bg-slate-100 rounded text-sm font-medium text-slate-500 shrink-0">
                                            {idx + 1}
                                        </div>
                                        <Input
                                            value={app}
                                            onChange={(e) => {
                                                const newAppendices = [...(formData.appendices || [])];
                                                newAppendices[idx] = e.target.value;
                                                setFormData({ ...formData, appendices: newAppendices });
                                            }}
                                            placeholder={`Ek ${idx + 1}...`}
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => {
                                                const newAppendices = [...(formData.appendices || [])];
                                                newAppendices.splice(idx, 1);
                                                setFormData({ ...formData, appendices: newAppendices });
                                            }}
                                            className="shrink-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>



                        </form>
                    </div >

                    <DialogFooter className="px-6 py-4 border-t">
                        <Button type="button" variant="outline" onClick={handlePreview} className="gap-2">
                            <Printer className="w-4 h-4" /> Ön İzleme
                        </Button>
                        <Button type="submit" form="correspondence-form">Kaydet</Button>
                    </DialogFooter>
                </DialogContent >
            </Dialog >

            <Dialog open={isAddInstOpen} onOpenChange={setIsAddInstOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Yeni Muhatap Ekle</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Kategori</Label>
                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    type="button"
                                    variant={newInstCategory === 'INSTITUTION' ? 'default' : 'outline'}
                                    onClick={() => setNewInstCategory('INSTITUTION')}
                                    className="gap-2"
                                >
                                    <Building2 className="w-4 h-4" /> Kurum / Şahıs
                                </Button>
                                <Button
                                    type="button"
                                    variant={newInstCategory === 'BANK' ? 'default' : 'outline'}
                                    onClick={() => setNewInstCategory('BANK')}
                                    className="gap-2"
                                >
                                    <Landmark className="w-4 h-4" /> Banka
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Muhatap Adı</Label>
                            <Textarea
                                value={newInstName}
                                onChange={(e) => setNewInstName(e.target.value)}
                                placeholder="Örn: Ankara Büyükşehir Belediyesi&#10;Fen İşleri Daire Başkanlığı"
                                rows={5}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddInstOpen(false)}>İptal</Button>
                        <Button onClick={handleAddInstitution}>Kaydet</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog >
        </>
    );
}
