'use client';

import { SimpleRichTextEditor } from '@/components/ui/simple-rich-text-editor';
import { useRouter } from 'next/navigation';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store/use-store';
import { useAuth } from '@/lib/store/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Plus, FileText, AlignLeft, AlignCenter, AlignRight, Trash2, Printer, Pencil, Building2, Landmark, X as XIcon, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { Correspondence } from '@/lib/types';
import { generateCorrespondencePDF } from '@/lib/pdf-generator';
import { toTurkishLower } from '@/lib/utils';

// Server Actions
import { createCorrespondence, updateCorrespondence } from '@/actions/correspondence';
import { createInstitution } from '@/actions/institution';
import { getCompanyFull } from '@/actions/company'; // [NEW]
import { toast } from 'sonner';

const PDFPreview = ({ base64 }: { base64: string }) => {
    const [url, setUrl] = useState<string | null>(null);
    const [scale, setScale] = useState(1);

    useEffect(() => {
        if (!base64) return;
        try {
            const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/pdf' });
            const blobUrl = URL.createObjectURL(blob);
            setUrl(blobUrl);

            const updateScale = () => {
                const screenWidth = window.innerWidth;
                // Use 720px as a stable base for A4 width content to fill mobile screen better
                setScale(screenWidth / 720);
            };
            updateScale();
            window.addEventListener('resize', updateScale);
            return () => {
                URL.revokeObjectURL(blobUrl);
                window.removeEventListener('resize', updateScale);
            };
        } catch (e) {
            console.error("PDF Preview Error:", e);
            setUrl(null);
        }
    }, [base64]);

    if (!url) return <div className="flex items-center justify-center h-40 text-sm text-slate-500">Önizleme hazırlanıyor...</div>;

    return (
        <div className="w-full h-full bg-slate-900/10 overflow-y-auto overflow-x-hidden pt-0 pb-20">
            <div 
                style={{ 
                    width: '720px',
                    height: `${720 * 1.414}px`, // A4 Ratio
                    transform: `scale(${scale})`,
                    transformOrigin: 'top center',
                    backgroundColor: 'white',
                    margin: '0 auto'
                }}
                className="relative shadow-2xl"
            >
                <iframe 
                    src={`${url}#view=FitH&toolbar=0`} 
                    className="w-full h-full border-0 block" 
                    title="PDF Preview" 
                />
            </div>
        </div>
    );
};

interface CorrespondenceFormProps {
    customTrigger?: React.ReactNode;
    initialType?: 'OFFICIAL' | 'INTERNAL' | 'BANK' | 'OTHER';
    initialDirection?: 'INCOMING' | 'OUTGOING';
    initialData?: Correspondence;
    isCopy?: boolean;
    open?: boolean; // [NEW] External Control
    onOpenChange?: (open: boolean) => void; // [NEW] External Control
}

export function CorrespondenceForm({ customTrigger, initialType, initialDirection, initialData, isCopy = false, open, onOpenChange }: CorrespondenceFormProps) {
    const [internalOpen, setInternalOpen] = useState(false);

    // Use external control if provided, otherwise internal
    const isOpen = open !== undefined ? open : internalOpen;
    const setIsOpen = onOpenChange || setInternalOpen;

    // Use store ONLY for reading lists
    const { companies, institutions, users, sites, addInstitution, addCorrespondence, updateCorrespondence: updateLocalCorrespondence } = useAppStore();
    const router = useRouter();
    const { user, hasPermission } = useAuth();

    // Permissions
    const canCreateIncoming = hasPermission('correspondence.incoming', 'CREATE');
    const canEditIncoming = hasPermission('correspondence.incoming', 'EDIT');
    const canCreateOutgoing = hasPermission('correspondence.outgoing', 'CREATE');
    const canEditOutgoing = hasPermission('correspondence.outgoing', 'EDIT');
    const canCreateBank = hasPermission('correspondence.bank', 'CREATE');
    const canEditBank = hasPermission('correspondence.bank', 'EDIT');

    // Determine current permission based on form state
    const getCurrentPermission = () => {
        const type = formData.type || initialType;
        const direction = formData.direction || initialDirection;
        const isEdit = !!initialData && !isCopy;

        if (type === 'BANK') return isEdit ? canEditBank : canCreateBank;
        if (direction === 'INCOMING') return isEdit ? canEditIncoming : canCreateIncoming;
        return isEdit ? canEditOutgoing : canCreateOutgoing; // Default OUTGOING
    };


    const [formData, setFormData] = useState({
        companyId: initialData?.companyId || '',
        siteId: initialData?.siteId || '',
        // If Copy, set Date to TODAY. Else Initial Date or Today.
        date: (initialData && !isCopy) ? (typeof initialData.date === 'string' ? initialData.date.split('T')[0] : format(new Date(initialData.date), "yyyy-MM-dd")) : format(new Date(), "yyyy-MM-dd"),
        direction: initialData?.direction || initialDirection || 'OUTGOING',
        type: initialData?.type || initialType || 'OFFICIAL',
        subject: initialData?.subject || '',
        description: initialData?.description || '',
        // If Copy, clear Numbers.
        referenceNumber: (initialData && !isCopy) ? initialData.referenceNumber : '',
        senderReceiver: initialData?.senderReceiver || '',
        senderReceiverAlignment: initialData?.senderReceiverAlignment || 'center',
        interest: initialData?.interest || [] as string[],
        appendices: initialData?.appendices || [] as string[],
        registrationNumber: (initialData && !isCopy) ? initialData.registrationNumber : '',
        attachmentUrls: initialData?.attachmentUrls || [] as string[],
        includeStamp: initialData?.includeStamp || false, // [NEW]
    });

    const [isRefManual, setIsRefManual] = useState(false);

    // [NEW] Auto-Generate Reference Number
    useEffect(() => {
        if (initialData && !isCopy) return;
        // Don't auto-generate if manual override is active
        if (isRefManual) return;
        if (!formData.companyId || !formData.senderReceiver) return;

        const company = companies.find(c => c.id === formData.companyId);
        if (!company) return;

        const inst = institutions.find(i => i.name === formData.senderReceiver);

        // Parts
        const compShort = (company.shortName || company.name).toUpperCase();
        const year = formData.date ? new Date(formData.date).getFullYear() : new Date().getFullYear();
        const yearShort = year.toString().slice(-2);

        let instShort = formData.senderReceiver.toUpperCase();
        if (inst && inst.shortName) {
            instShort = inst.shortName.toUpperCase();
        } else if (inst) {
            instShort = inst.name.toUpperCase();
        }

        let nextNum = 1;
        const c = company as any;
        if (formData.type === 'BANK') {
            nextNum = c.currentBankNumber || 1;
        } else if (formData.direction === 'INCOMING') {
            nextNum = c.currentIncomingNumber || 1;
        } else {
            nextNum = c.currentDocumentNumber || 1;
        }

        const seq = nextNum.toString().padStart(4, '0');

        // Format: [Short]-[YY]/[RecipientShort].[Seq] (No spaces)
        const newRef = `${compShort}-${yearShort}/${instShort}.${seq}`;

        if (formData.referenceNumber !== newRef) {
            setFormData(prev => ({ ...prev, referenceNumber: newRef }));
        }

    }, [formData.companyId, formData.senderReceiver, formData.date, formData.direction, companies, institutions, initialData, isCopy, isRefManual]);

    const [filteredInstitutions, setFilteredInstitutions] = useState<typeof institutions>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [muhatapOpen, setMuhatapOpen] = useState(false);
    const [muhatapSearch, setMuhatapSearch] = useState('');
    const [firmaOpen, setFirmaOpen] = useState(false);
    const [firmaSearch, setFirmaSearch] = useState('');
    const [siteOpen, setSiteOpen] = useState(false);
    const [siteSearch, setSiteSearch] = useState('');
    const [hasAutoSelectedSite, setHasAutoSelectedSite] = useState(false);

    // [UX] Auto-select site if user has only one assigned site
    useEffect(() => {
        if (sites.length === 1 && !formData.siteId && !initialData && !hasAutoSelectedSite) {
            setFormData(prev => ({ ...prev, siteId: sites[0].id }));
            setHasAutoSelectedSite(true);
        }
    }, [sites, formData.siteId, initialData, hasAutoSelectedSite]);

    const [newInstName, setNewInstName] = useState('');
    const [newInstShortName, setNewInstShortName] = useState(''); // [NEW]

    const [newInstAlign, setNewInstAlign] = useState<'left' | 'center' | 'right'>('center');
    const [newInstCategory, setNewInstCategory] = useState<'BANK' | 'INSTITUTION'>('INSTITUTION');
    const [isAddInstOpen, setIsAddInstOpen] = useState(false);

    const handleMuhatapChange = (val: string) => {
        setFormData(prev => ({ ...prev, senderReceiver: val }));
        if (val.trim().length > 0) {
            const relevantInstitutions = institutions.filter((i: any) => {
                if (initialType === 'BANK') return i.category === 'BANK' || !i.category;
                return i.category !== 'BANK';
            });
            const matches = relevantInstitutions.filter((i: any) => toTurkishLower(i.name).includes(toTurkishLower(val)));
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

    // [UX] Watch for newly added institution to ensure it gets selected
    const [pendingInstSelection, setPendingInstSelection] = useState<string | null>(null);

    useEffect(() => {
        if (pendingInstSelection) {
            const exists = institutions.find((i: any) => i.name === pendingInstSelection);
            if (exists) {
                setFormData(prev => ({
                    ...prev,
                    senderReceiver: exists.name,
                    senderReceiverAlignment: (exists.alignment as any) || 'center'
                }));
                setPendingInstSelection(null); // Clear pending
            }
        }
    }, [institutions, pendingInstSelection]);

    const handleAddInstitution = async () => {
        if (!newInstName.trim()) return;

        const result = await createInstitution({
            name: newInstName.trim(),
            category: newInstCategory,
            alignment: 'center',
            shortName: newInstShortName.trim() // [NEW]
        });

        if (result.success && result.data) {
            toast.success("Muhatap eklendi.");

            // Update local store
            addInstitution(result.data as any);

            // Trigger auto-select logic
            setPendingInstSelection(result.data.name);

            // Immediate attempt (in case store is instant or fallback works)
            setFormData(prev => ({
                ...prev,
                senderReceiver: result.data!.name,
                senderReceiverAlignment: 'center'
            }));

            setNewInstName('');
            setNewInstShortName('');
            setNewInstAlign('center');
            setIsAddInstOpen(false);
        } else {
            toast.error("Muhatap eklenemedi.");
        }
    };

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [companyFull, setCompanyFull] = useState<any>(null); // [NEW]

    // [NEW] Pre-fetch company details (logo, stamp) to avoid async calls during PDF preview (especially for mobile popups)
    useEffect(() => {
        if (!formData.companyId) {
            setCompanyFull(null);
            return;
        }

        const fetchFull = async () => {
            try {
                const res = await getCompanyFull(formData.companyId);
                if (res.success && res.data) {
                    setCompanyFull(res.data);
                }
            } catch (err) {
                console.error("Error pre-fetching company:", err);
            }
        };

        fetchFull();
    }, [formData.companyId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        if (user.role !== 'ADMIN' && !getCurrentPermission()) {
            toast.error('Bu işlem için yetkiniz bulunmamaktadır.');
            return;
        }

        setIsSubmitting(true);

        try {
            // Date Restriction Check
            if (user.role !== 'ADMIN' && user.editLookbackDays !== undefined) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const target = new Date(formData.date);
                target.setHours(0, 0, 0, 0);
                const diff = (today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24);

                if (diff > user.editLookbackDays) {
                    toast.error(`Geriye dönük en fazla ${user.editLookbackDays} gün işlem yapabilirsiniz.`);
                    setIsSubmitting(false);
                    return;
                }
            }

            // [FIX] Correct Date Time Construction
            const now = new Date();
            const [y, m, d] = formData.date.split('-').map(Number);
            const dateObj = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds());
            const dateStr = dateObj.toISOString();

            const payload = {
                companyId: formData.companyId,
                siteId: (formData.siteId && formData.siteId !== 'none') ? formData.siteId : undefined,
                direction: formData.direction as 'INCOMING' | 'OUTGOING',
                type: formData.type as 'OFFICIAL' | 'INTERNAL' | 'OTHER' | 'BANK',
                senderReceiverAlignment: formData.senderReceiverAlignment as 'left' | 'center' | 'right',
                date: dateStr,
                description: formData.description || '-',
                subject: formData.subject,
                referenceNumber: formData.referenceNumber,
                senderReceiver: formData.senderReceiver,
                interest: formData.interest,
                appendices: formData.appendices,
                registrationNumber: formData.registrationNumber,
                attachmentUrls: formData.attachmentUrls,
                includeStamp: formData.includeStamp
            };

            if (initialData && !isCopy) {
                const result = await updateCorrespondence(initialData.id, payload);
                if (result.success) {
                    // Optimistic: update local store
                    if (result.data) updateLocalCorrespondence(initialData.id, result.data as any);
                    toast.success("Yazışma güncellendi.");
                    setIsOpen(false);
                } else {
                    toast.error(result.error);
                }
            } else {
                const result = await createCorrespondence({
                    ...payload,
                    createdByUserId: user.id
                } as any);

                if (result.success) {
                    // Optimistic: add to local store
                    if (result.data) addCorrespondence(result.data as any);
                    toast.success(isCopy ? "Yazışma kopyalandı." : "Yazışma eklendi.");
                    setIsOpen(false);
                    if (!isCopy) {
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
                            attachmentUrls: [],
                            includeStamp: false,
                        });
                    }
                } else {
                    toast.error(result.error);
                }
            }
        } catch (error) {
            console.error(error);
            toast.error("Bir hata oluştu.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [previewBase64, setPreviewBase64] = useState<string | null>(null);

    const handlePreview = async () => {
        // [UX] For mobile, use in-app dialog preview
        if (window.innerWidth < 768) {
            try {
                const doc: any = await generateCorrespondencePDF(formData, companies, users, false, companyFull);
                const base64 = doc.output('datauristring');
                setPreviewBase64(base64);
                setIsPreviewOpen(true);
            } catch (e) {
                console.error(e);
                toast.error("Önizleme oluşturulamadı.");
            }
        } else {
            await generateCorrespondencePDF(formData, companies, users, true, companyFull);
        }
    };

    // Re-defining internal PDFPreview for Form if needed or import from List
    // Since it's small, let's define a light version or just fix the button

    // execCmd moved to SimpleRichTextEditor

    const dropdownOptions = institutions.filter((inst: any) => {
        // [FIX] Strict filtering for Insurance entities
        if (inst.category === 'INSURANCE_AGENCY' || inst.category === 'INSURANCE_COMPANY') return false;

        // [FIX] Filter out PASSIVE (Soft Deleted) records from selection
        if (inst.status === 'PASSIVE') return false;

        if (initialType === 'BANK') return inst.category === 'BANK' || !inst.category;

        // Exclude Insurance/Kasko agencies for standard correspondence (double check via name just in case)
        const lowerName = toTurkishLower(inst.name || '');
        if (lowerName.includes('sigorta') || lowerName.includes('kasko')) {
            // Optional: If category is strictly set, name check might be redundant but safe.
            // keeping name check as fallback if category is missing
            return false;
        }

        // If 'OFFICIAL' or others, show non-banks
        return inst.category !== 'BANK';
    });

    return (
        <>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
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

                    <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-4">
                        <form id="correspondence-form" onSubmit={handleSubmit} className="grid gap-4 min-w-0">
                            {/* Fields removed */}
                            {/* ... Content ... */}

                            <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-4">
                                <div className="space-y-2">
                                    <Label>Tarih</Label>
                                    <Input
                                        type="date"
                                        required
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2 min-w-0">
                                    <Label>İlgili Firma</Label>
                                    <div className="flex flex-col sm:flex-row gap-2 min-w-0">
                                        <div className="relative w-full min-w-0">
                                            <Button
                                                variant="outline"
                                                type="button"
                                                className="w-full justify-between font-normal h-10 text-left overflow-hidden min-w-0"
                                                onClick={() => setFirmaOpen(!firmaOpen)}
                                            >
                                                <span className="truncate">
                                                    {formData.companyId ? (companies.find((c: any) => c.id === formData.companyId)?.name || 'Seçiniz') : 'Seçiniz'}
                                                </span>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-2 shrink-0 opacity-50"><path d="m6 9 6 6 6-6" /></svg>
                                            </Button>
                                            {firmaOpen && (
                                                <>
                                                    <div className="fixed inset-0 z-40" onClick={() => { setFirmaOpen(false); setFirmaSearch(''); }} />
                                                    <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-md">
                                                        <div className="p-2 border-b">
                                                            <Input
                                                                placeholder="Firma ara..."
                                                                value={firmaSearch}
                                                                onChange={(e) => setFirmaSearch(e.target.value)}
                                                                className="h-8 text-sm"
                                                                autoFocus
                                                            />
                                                        </div>
                                                        <div className="max-h-[150px] overflow-y-auto">
                                                            {companies
                                                                .filter((c: any) => {
                                                                    if (!firmaSearch.trim()) return true;
                                                                    return toTurkishLower(c.name).includes(toTurkishLower(firmaSearch));
                                                                })
                                                                .map((c: any) => (
                                                                    <button
                                                                        key={c.id}
                                                                        type="button"
                                                                        className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-100 transition-colors ${formData.companyId === c.id ? 'bg-blue-50 text-blue-700 font-medium' : ''
                                                                            }`}
                                                                        onClick={() => {
                                                                            setFormData({ ...formData, companyId: c.id });
                                                                            setFirmaOpen(false);
                                                                            setFirmaSearch('');
                                                                        }}
                                                                    >
                                                                        {c.name}
                                                                    </button>
                                                                ))}
                                                            {companies.filter((c: any) => {
                                                                if (!firmaSearch.trim()) return true;
                                                                return toTurkishLower(c.name).includes(toTurkishLower(firmaSearch));
                                                            }).length === 0 && (
                                                                    <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                                                                        Sonuç bulunamadı
                                                                    </div>
                                                                )}
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                        {formData.direction === 'OUTGOING' && (
                                            <div className="flex items-center space-x-2 border p-2 rounded bg-slate-50 min-w-fit">
                                                <Checkbox
                                                    id="includeStamp"
                                                    checked={formData.includeStamp}
                                                    onCheckedChange={(c) => setFormData({ ...formData, includeStamp: !!c })}
                                                />
                                                <Label htmlFor="includeStamp" className="whitespace-nowrap cursor-pointer">Kaşe Ekle</Label>
                                            </div>
                                        )}
                                    </div>
                                </div>

                            </div>

                            {initialType !== 'BANK' && (
                                <div className="space-y-2 min-w-0">
                                    <Label>Şantiye (Opsiyonel)</Label>
                                    <div className="relative min-w-0">
                                        <Button
                                            variant="outline"
                                            type="button"
                                            className="w-full justify-between font-normal h-10 text-left overflow-hidden min-w-0"
                                            onClick={() => setSiteOpen(!siteOpen)}
                                        >
                                            <span className="truncate">
                                                {formData.siteId && formData.siteId !== 'none'
                                                    ? (sites.find((s: any) => s.id === formData.siteId)?.name || 'Şantiye Seçiniz (Opsiyonel)')
                                                    : 'Şantiye Seçiniz (Opsiyonel)'}
                                            </span>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-2 shrink-0 opacity-50"><path d="m6 9 6 6 6-6" /></svg>
                                        </Button>
                                        {siteOpen && (
                                            <>
                                                <div className="fixed inset-0 z-40" onClick={() => { setSiteOpen(false); setSiteSearch(''); }} />
                                                <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-md">
                                                    <div className="p-2 border-b">
                                                        <Input
                                                            placeholder="Şantiye ara..."
                                                            value={siteSearch}
                                                            onChange={(e) => setSiteSearch(e.target.value)}
                                                            className="h-8 text-sm"
                                                            autoFocus
                                                        />
                                                    </div>
                                                    <div className="max-h-[150px] overflow-y-auto">
                                                        <button
                                                            type="button"
                                                            className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-100 transition-colors ${!formData.siteId || formData.siteId === 'none' ? 'bg-blue-50 text-blue-700 font-medium' : ''
                                                                }`}
                                                            onClick={() => {
                                                                setFormData({ ...formData, siteId: 'none' });
                                                                setSiteOpen(false);
                                                                setSiteSearch('');
                                                            }}
                                                        >
                                                            Seçim Yok
                                                        </button>
                                                        {sites
                                                            .filter((s: any) => s.status === 'ACTIVE')
                                                            .filter((s: any) => {
                                                                if (!siteSearch.trim()) return true;
                                                                return toTurkishLower(s.name).includes(toTurkishLower(siteSearch));
                                                            })
                                                            .map((s: any) => (
                                                                <button
                                                                    key={s.id}
                                                                    type="button"
                                                                    className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-100 transition-colors ${formData.siteId === s.id ? 'bg-blue-50 text-blue-700 font-medium' : ''
                                                                        }`}
                                                                    onClick={() => {
                                                                        setFormData({ ...formData, siteId: s.id });
                                                                        setSiteOpen(false);
                                                                        setSiteSearch('');
                                                                    }}
                                                                >
                                                                    {s.name}
                                                                </button>
                                                            ))}
                                                        {sites.filter((s: any) => s.status === 'ACTIVE').filter((s: any) => {
                                                            if (!siteSearch.trim()) return true;
                                                            return toTurkishLower(s.name).includes(toTurkishLower(siteSearch));
                                                        }).length === 0 && (
                                                                <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                                                                    Sonuç bulunamadı
                                                                </div>
                                                            )}
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label>Evrak Sayı Numarası</Label>
                                <Input
                                    placeholder="Ref-123"
                                    value={formData.referenceNumber}
                                    onChange={(e) => {
                                        setFormData({ ...formData, referenceNumber: e.target.value });
                                        setIsRefManual(true);
                                    }}
                                    readOnly={formData.direction === 'OUTGOING'}
                                    className={formData.direction === 'OUTGOING' ? 'bg-slate-50 text-slate-500 font-mono' : ''}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>
                                    Konu
                                    {formData.direction === 'OUTGOING' && <span className="text-red-500 ml-1">*</span>}
                                </Label>
                                <Input
                                    placeholder="Yazışma konusu"
                                    required
                                    value={formData.subject}
                                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2 relative min-w-0">
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
                                                setNewInstCategory(initialType === 'BANK' ? 'BANK' : 'INSTITUTION');
                                            }}
                                        >
                                            <Plus className="w-3 h-3 mr-1" /> Yeni
                                        </Button>
                                    </div>
                                </div>
                                <div className="relative">
                                    <Button
                                        variant="outline"
                                        type="button"
                                        className="w-full justify-between font-normal h-10 text-left overflow-hidden min-w-0"
                                        onClick={() => setMuhatapOpen(!muhatapOpen)}
                                    >
                                        <span className="truncate">
                                            {formData.senderReceiver || 'Muhatap Seçiniz...'}
                                        </span>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-2 shrink-0 opacity-50"><path d="m6 9 6 6 6-6" /></svg>
                                    </Button>
                                    {muhatapOpen && (
                                        <>
                                            <div className="fixed inset-0 z-40" onClick={() => { setMuhatapOpen(false); setMuhatapSearch(''); }} />
                                            <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-md">
                                                <div className="p-2 border-b">
                                                    <Input
                                                        placeholder="Muhatap ara..."
                                                        value={muhatapSearch}
                                                        onChange={(e) => setMuhatapSearch(e.target.value)}
                                                        className="h-8 text-sm"
                                                        autoFocus
                                                    />
                                                </div>
                                                <div className="max-h-[150px] overflow-y-auto">
                                                    {dropdownOptions
                                                        .filter((inst: any) => {
                                                            if (!muhatapSearch.trim()) return true;
                                                            return toTurkishLower(inst.name).includes(toTurkishLower(muhatapSearch));
                                                        })
                                                        .map((inst: any) => (
                                                            <button
                                                                key={inst.id}
                                                                type="button"
                                                                className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-100 transition-colors ${formData.senderReceiver === inst.name ? 'bg-blue-50 text-blue-700 font-medium' : ''
                                                                    }`}
                                                                onClick={() => {
                                                                    setFormData({
                                                                        ...formData,
                                                                        senderReceiver: inst.name,
                                                                        senderReceiverAlignment: inst.alignment || formData.senderReceiverAlignment || 'center'
                                                                    });
                                                                    setMuhatapOpen(false);
                                                                    setMuhatapSearch('');
                                                                }}
                                                            >
                                                                {inst.name}
                                                            </button>
                                                        ))}
                                                    {dropdownOptions.filter((inst: any) => {
                                                        if (!muhatapSearch.trim()) return true;
                                                        return toTurkishLower(inst.name).includes(toTurkishLower(muhatapSearch));
                                                    }).length === 0 && (
                                                            <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                                                                Sonuç bulunamadı
                                                            </div>
                                                        )}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
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



                        </form>
                    </div >

                    <DialogFooter className="px-6 py-4 border-t">
                        <Button type="button" variant="outline" onClick={handlePreview} className="gap-2">
                            <Printer className="w-4 h-4" /> Ön İzleme
                        </Button>
                        <Button type="submit" form="correspondence-form" disabled={(user?.role !== 'ADMIN' && !getCurrentPermission()) || isSubmitting}>
                            {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
                        </Button>
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
                                rows={4}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Kısa Ad (Opsiyonel)</Label>
                            <Input
                                value={newInstShortName}
                                onChange={(e) => setNewInstShortName(e.target.value)}
                                placeholder="Örn: ABB"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddInstOpen(false)}>İptal</Button>
                        <Button onClick={handleAddInstitution}>Kaydet</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog >

            <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                <DialogContent className="max-w-none w-screen h-[100dvh] p-0 border-none bg-white shadow-none fixed inset-0 z-[200] translate-x-0 translate-y-0 overflow-hidden m-0">
                    <DialogTitle className="sr-only">PDF Ön İzleme</DialogTitle>
                    {/* Floating Close Button */}
                    <div className="fixed top-6 right-6 z-[210] sm:hidden">
                        <DialogClose asChild>
                            <Button variant="secondary" size="lg" className="bg-slate-900/90 hover:bg-slate-900 text-white font-bold shadow-2xl rounded-full px-6 h-12 border border-white/30 backdrop-blur-md">
                                <XIcon className="w-5 h-5 mr-2" /> Kapat
                            </Button>
                        </DialogClose>
                    </div>
                    <div className="w-full h-full p-0 m-0 overflow-hidden">
                        {previewBase64 && <PDFPreview base64={previewBase64} />}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
