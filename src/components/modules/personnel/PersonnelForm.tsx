'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store/use-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { toast } from "sonner";
import { Personnel } from '@/lib/types';
import { useAuth } from '@/lib/store/use-auth';
import { Checkbox } from '@/components/ui/checkbox';
import { createPersonnel, updatePersonnel as updatePersonnelServer, deletePersonnel as deletePersonnelServer } from '@/actions/personnel';

interface PersonnelFormProps {
    personnelToEdit?: Personnel;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    defaultSiteId?: string; // [NEW] Auto-fill site
    defaultReferenceDate?: Date; // [NEW] Context date for auto-start-date
}

export function PersonnelForm({ personnelToEdit, open: controlledOpen, onOpenChange, defaultSiteId, defaultReferenceDate }: PersonnelFormProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const isControlled = controlledOpen !== undefined;
    const finalOpen = isControlled ? controlledOpen : internalOpen;
    const setFinalOpen = isControlled ? onOpenChange : setInternalOpen;

    const { addPersonnel, updatePersonnel, sites, personnel } = useAppStore();
    const { hasPermission } = useAuth();
    const canCreate = hasPermission('personnel', 'CREATE');
    const canEdit = hasPermission('personnel', 'EDIT'); // Check edit permission too if editing

    // Form State
    const [name, setName] = useState('');
    const [tcNumber, setTcNumber] = useState('');
    const [profession, setProfession] = useState('');
    const [role, setRole] = useState('');
    const [salary, setSalary] = useState('');
    const [siteId, setSiteId] = useState(defaultSiteId || '');
    const [category, setCategory] = useState<'TECHNICAL' | 'FIELD'>('FIELD');
    const [monthlyLeaveAllowance, setMonthlyLeaveAllowance] = useState('');
    const [isOvertimeAllowed, setIsOvertimeAllowed] = useState(false);

    // Salary Update State
    const [showSalaryUpdate, setShowSalaryUpdate] = useState(false);
    const [newSalary, setNewSalary] = useState('');
    const [salaryEffectiveDate, setSalaryEffectiveDate] = useState('');
    const [startDate, setStartDate] = useState(''); // [NEW]

    const { deletePersonnel, personnelAttendance } = useAppStore(); // [NEW] Get delete & attendance for validation

    const [note, setNote] = useState('');
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    // Sync form with personnelToEdit
    useEffect(() => {
        if (personnelToEdit && finalOpen) {
            setName(personnelToEdit.fullName);
            setTcNumber(personnelToEdit.tcNumber || '');
            setProfession(personnelToEdit.profession || '');
            setRole(personnelToEdit.role || '');
            setSalary(personnelToEdit.salary?.toString() || '');
            setSiteId(personnelToEdit.siteId || '');
            setCategory(personnelToEdit.category || 'FIELD');
            setMonthlyLeaveAllowance(personnelToEdit.monthlyLeaveAllowance?.toString() || '');
            setIsOvertimeAllowed(!!personnelToEdit.isOvertimeAllowed);
            setNote(personnelToEdit.note || '');

            // Reset Salary Update State
            setShowSalaryUpdate(false);
            setNewSalary('');
            setSalaryEffectiveDate(new Date().toISOString().split('T')[0]); // Default to today
            setStartDate(personnelToEdit.startDate || '');
        } else if (!personnelToEdit && !finalOpen) {
            // Reset on close if not editing (or just always reset on open/close appropriately)
            // Ideally, reset when opening "Create" mode.
        }
    }, [personnelToEdit, finalOpen]);

    // TC Number Lookup for Re-hiring
    useEffect(() => {
        if (!isControlled && !personnelToEdit && tcNumber.length === 11) {
            // Check if this person exists as 'LEFT'
            const exEmployee = personnel.find(p => p.tcNumber === tcNumber && p.status === 'LEFT');

            if (exEmployee) {
                if (confirm(`Bu TC kimlik numarası ile daha önce çalışan "${exEmployee.fullName}" tespit edildi. Personel tekrar işe alınsın mı?\n\n(Bilgiler otomatik doldurulacak, maaş bilgisi boş bırakılacaktır.)`)) {
                    // Auto-fill
                    setName(exEmployee.fullName);
                    setProfession(exEmployee.profession || '');
                    setRole(exEmployee.role || '');
                    setCategory(exEmployee.category || 'FIELD');
                    setMonthlyLeaveAllowance(exEmployee.monthlyLeaveAllowance?.toString() || '');
                    setIsOvertimeAllowed(!!exEmployee.isOvertimeAllowed);
                    setNote(''); // Clear old notes? Or keep? User said "bilgileri otomatik getir". Keep clean note for re-hire.
                    setSalary(''); // Blank as requested

                    // Allow user to select site (siteId state already bound to select)
                    // If modal opened from a specific site context (via prop or implicit logic), it might be set. 
                    // But usually PersonnelForm is global or site-specific.
                    // If we are in site-specific view, `siteId` might be pre-set? 
                    // The hook doesn't show pre-setting siteId from props, but let's check. 

                    toast.info("Eski personel bilgileri yüklendi. Lütfen maaş ve şantiye bilgilerini kontrol edip kaydediniz.");
                }
            }
        }
    }, [tcNumber, personnel, isControlled, personnelToEdit]); // Added dependencies

    // Reset when opening in Create Mode
    useEffect(() => {
        if (finalOpen && !personnelToEdit) {
            setName('');
            setTcNumber('');
            setProfession('');
            setRole('');
            setSalary('');
            // Don't clear siteId if it was passed or set via other means (not visible here, but safer to respect if logic exists elsewhere)
            // But standard reset usually clears it. The earlier code cleared it.
            setSiteId(defaultSiteId || '');
            setCategory('FIELD');
            setMonthlyLeaveAllowance('');
            setIsOvertimeAllowed(false);
            setNote('');
            setFormErrors({});
            // Reset Salary Update State
            setShowSalaryUpdate(false);
            setNewSalary('');
            setSalaryEffectiveDate('');

            // Use provided reference date or today. Reference date comes from View (e.g. May 1st).
            // This ensures if user adds personnel while viewing "May", they start in "May" (hidden in past months).
            const initialDate = defaultReferenceDate ? new Date(defaultReferenceDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
            setStartDate(initialDate);
        }
    }, [finalOpen, personnelToEdit, defaultReferenceDate]);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Strict Validation
        const errors: Record<string, string> = {};
        let isValid = true;

        if (!name) { errors.name = "Ad Soyad zorunludur"; isValid = false; }

        if (!tcNumber) {
            errors.tcNumber = "TC Kimlik No zorunludur";
            isValid = false;
        } else if (tcNumber.length !== 11) {
            errors.tcNumber = "TC Kimlik No 11 haneli olmalıdır";
            isValid = false;
        }

        if (!category) { errors.category = "Personel grubu seçimi zorunludur"; isValid = false; }
        if (!profession) { errors.profession = "Meslek bilgisi zorunludur"; isValid = false; }
        if (!role) { errors.role = "Görev bilgisi zorunludur"; isValid = false; }
        if (!salary || Number(salary) <= 0) { errors.salary = "Maaş bilgisi zorunludur"; isValid = false; }
        if (!siteId) { errors.siteId = "Şantiye seçimi zorunludur"; isValid = false; }

        if (!isValid) {
            setFormErrors(errors);
            toast.error("Lütfen tüm zorunlu alanları doldurunuz.");
            return;
        }

        // Check for duplicate TC (Exclude self if editing)
        // [NEW] Logic:
        // 1. If exists in SAME site and ACTIVE -> Block.
        // 2. If exists in SAME site and LEFT -> Offer to Re-activate (Merge).
        // 3. If exists in OTHER site and ACTIVE -> Block (Global Uniqueness for Active).

        // Unified TC Check Logic
        // Find ANY record with same TC (excluding self)
        const existingRecord = personnel.find(p => p.tcNumber === tcNumber && p.id !== personnelToEdit?.id);

        if (existingRecord) {
            // Case 1: Already Active (Anywhere)
            if (existingRecord.status === 'ACTIVE') {
                const siteName = sites.find(s => s.id === existingRecord.siteId)?.name || 'Bilinmeyen Şantiye';
                if (existingRecord.siteId === siteId) {
                    setFormErrors({ ...errors, tcNumber: "Bu personel bu şantiyede zaten aktif." });
                    toast.error("Bu personel zaten bu şantiyede çalışıyor.");
                } else {
                    setFormErrors({ ...errors, tcNumber: `Bu personel "${siteName}" şantiyesinde zaten aktif.` });
                    toast.error(`Personel "${siteName}" şantiyesinde aktif görünüyor.`);
                }
                return;
            }

            // Case 2: Inactive (Left/Passive/etc) - Offer Resume
            // Determine prompt message
            let promptMsg = '';
            const oldSiteName = sites.find(s => s.id === existingRecord.siteId)?.name || 'Diğer Şantiye';

            if (existingRecord.siteId === siteId) {
                promptMsg = `"${existingRecord.fullName}" isimli personelin bu şantiyede eski bir kaydı bulundu.\n\nYeni kayıt açmak yerine mevcut kaydı tekrar aktif etmek (geçmişi korumak) ister misiniz?`;
            } else {
                promptMsg = `"${existingRecord.fullName}" isimli personel "${oldSiteName}" şantiyesinde eski çalışan olarak bulundu.\n\nYeni kayıt açmak yerine, personeli bu şantiyeye taşıyıp tekrar işe almak (geçmişi korumak) ister misiniz?`;
            }

            if (confirm(promptMsg)) {
                // Resume Logic
                const newHistory = [...(existingRecord.employmentHistory || [])];

                // Migrate legacy dates if history is empty
                if (newHistory.length === 0) {
                    if (existingRecord.startDate) {
                        newHistory.push({ type: 'HIRE', date: existingRecord.startDate });
                    }
                    if (existingRecord.leftDate && existingRecord.status === 'LEFT') {
                        newHistory.push({ type: 'EXIT', date: existingRecord.leftDate });
                    }
                }

                // Append HIRE
                const hireDate = startDate || new Date().toISOString().split('T')[0];
                newHistory.push({ type: 'HIRE', date: hireDate });

                // Transfer History if moving site
                const transferHistory = [...(existingRecord.transferHistory || [])];
                if (existingRecord.siteId !== siteId) {
                    transferHistory.push({
                        fromSiteId: existingRecord.siteId,
                        toSiteId: siteId,
                        date: hireDate
                    });
                }

                const updatePayload = {
                    fullName: name,
                    tcNumber,
                    profession,
                    role,
                    salary: Number(salary),
                    siteId: siteId,
                    category,
                    monthlyLeaveAllowance: monthlyLeaveAllowance ? Number(monthlyLeaveAllowance) : undefined,
                    isOvertimeAllowed,
                    startDate: hireDate,
                    status: 'ACTIVE' as const,
                    leftDate: undefined,
                    note,
                    employmentHistory: newHistory,
                    transferHistory: transferHistory,
                    salaryHistory: showSalaryUpdate ? [
                        ...(existingRecord.salaryHistory || []),
                        { amount: Number(newSalary), validFrom: salaryEffectiveDate }
                    ] : (existingRecord.salaryHistory || [])
                };

                updatePersonnel(existingRecord.id, updatePayload);
                toast.success("Personel kaydı tekrar aktif edildi ve geçmişi korundu.");
                if (setFinalOpen) setFinalOpen(false);
                return;
            }
            // If user cancels confirm, do we Allow Block or Allow Duplicate?
            // "Olmadı hala siliniyor" implies they likely pressed OK/Yes but logic failed?
            // Or they pressed Cancel and created duplicate.
            // Let's Warn them if they Cancel.
            // Actually, if they Cancel, we assume they WANT a duplicate (maybe Recruited again as different specific role?)
            // But for safety, standard behavior is allowing fallthrough.
        }

        // [NEW] Global Inactive Check (Re-hire from ANY site)
        // If we reached here, it's not active globally. Check if it exists as LEFT anywhere.
        const existingInactiveGlobal = personnel.find(p => p.tcNumber === tcNumber && p.status === 'LEFT' && p.id !== personnelToEdit?.id);

        if (existingInactiveGlobal) {
            const oldSiteName = sites.find(s => s.id === existingInactiveGlobal.siteId)?.name || 'Diğer Şantiye';

            if (confirm(`"${name}" isimli personel "${oldSiteName}" şantiyesinde "İşten Ayrıldı" olarak kayıtlı.\n\nYeni bir kayıt oluşturmak yerine, bu personeli şu anki şantiyeye taşıyıp tekrar işe almak (geçmiş verilerini korumak) ister misiniz?`)) {

                // Resume & Transfer Logic
                const newHistory = [...(existingInactiveGlobal.employmentHistory || [])];

                // Ensure migration if needed
                if (newHistory.length === 0 && existingInactiveGlobal.leftDate) {
                    newHistory.push({ type: 'EXIT', date: existingInactiveGlobal.leftDate });
                }

                // Add HIRE
                const hireDate = startDate || new Date().toISOString().split('T')[0];
                newHistory.push({ type: 'HIRE', date: hireDate });

                // Add Transfer History (Implicitly tracked? Or explicit?)
                // If sites are different, we can add a transfer record too, but 'HIRE' implies start at new site.
                // Let's just update `siteId`.
                const transferHistory = [...(existingInactiveGlobal.transferHistory || [])];
                if (existingInactiveGlobal.siteId !== siteId) {
                    transferHistory.push({
                        fromSiteId: existingInactiveGlobal.siteId,
                        toSiteId: siteId,
                        date: hireDate
                    });
                }

                const updatePayload = {
                    fullName: name,
                    tcNumber,
                    profession,
                    role,
                    salary: Number(salary),
                    siteId: siteId, // Move to new site
                    category,
                    monthlyLeaveAllowance: monthlyLeaveAllowance ? Number(monthlyLeaveAllowance) : undefined,
                    isOvertimeAllowed,
                    startDate: hireDate,
                    status: 'ACTIVE' as const,
                    leftDate: undefined,
                    note,
                    employmentHistory: newHistory,
                    transferHistory: transferHistory,
                    salaryHistory: showSalaryUpdate ? [
                        ...(existingInactiveGlobal.salaryHistory || []),
                        { amount: Number(newSalary), validFrom: salaryEffectiveDate }
                    ] : (existingInactiveGlobal.salaryHistory || [])
                };

                updatePersonnel(existingInactiveGlobal.id, updatePayload);
                toast.success("Personel eski kaydıyla tekrar işe alındı (Geçmiş korundu).");
                if (setFinalOpen) setFinalOpen(false);
                return;
            }
            // If No, fall through to Create New? 
            // Usually user wants to preserve. If they say No, maybe they really want a duplicate?
            // Let's allow fallthrough if they explicitly say NO to "Preserve".
        }

        // Clear errors
        setFormErrors({});

        const personnelData = {
            fullName: name,
            tcNumber,
            profession,
            role,
            salary: Number(salary),
            siteId,
            category,
            monthlyLeaveAllowance: monthlyLeaveAllowance ? Number(monthlyLeaveAllowance) : undefined,
            isOvertimeAllowed,
            startDate: startDate || undefined,
            note,
            // Handle Salary History
            salaryHistory: showSalaryUpdate ? [
                ...(personnelToEdit?.salaryHistory || []),
                { amount: Number(newSalary), validFrom: salaryEffectiveDate }
            ] : (personnelToEdit?.salaryHistory || [])
        };

        // If updating salary, use new salary. Else use existing/entered salary.
        if (showSalaryUpdate) {
            personnelData.salary = Number(newSalary);
        }

        if (personnelToEdit) {
            // Server Action for Update
            const result = await updatePersonnelServer(personnelToEdit.id, personnelData);

            if (result.success && result.data) {
                updatePersonnel(personnelToEdit.id, result.data);
                toast.success("Personel bilgileri güncellendi.");
            } else {
                toast.error(result.error || "Güncelleme başarısız.");
                return; // Don't close modal on error
            }
        } else {
            // Server Action for Create
            // Ensure ID is handled by server or generated here. Prisma usually handles ID if not provided, 
            // but we might want to generate it for optimistic or consistency.
            // Our server action createPersonnel takes Partial<Personnel>.
            // It creates with random UUID if not provided? Prisma schema usually has @default(cuid()) or uuid().
            // Let's rely on server return.

            const result = await createPersonnel(personnelData);

            if (result.success && result.data) {
                addPersonnel(result.data);
                toast.success("Personel eklendi.");
            } else {
                toast.error(result.error || "Ekleme başarısız.");
                return; // Don't close modal on error
            }
        }

        if (setFinalOpen) setFinalOpen(false);
    };

    if (!canCreate && !canEdit) return null; // If neither, hide
    // Refine: If editing, need EDIT perm. If creating, need CREATE perm.
    if (personnelToEdit && !canEdit) return null;
    if (!personnelToEdit && !canCreate) return null;

    return (
        <Dialog open={finalOpen} onOpenChange={setFinalOpen}>
            {!isControlled && (
                <DialogTrigger asChild>
                    <Button className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="w-4 h-4 mr-2" /> Personel Ekle
                    </Button>
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{personnelToEdit ? 'Personel Düzenle' : 'Yeni Personel'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-2">
                    {/* 2. TC Kimlik No */}
                    <div className="space-y-1">
                        <Label>TC Kimlik No</Label>
                        <Input
                            value={tcNumber}
                            onChange={e => {
                                const val = e.target.value.replace(/\D/g, '').slice(0, 11);
                                setTcNumber(val);
                            }}
                            placeholder="11 haneli TC No"
                            required
                            minLength={11}
                            maxLength={11}
                            className={formErrors.tcNumber ? "border-red-500" : ""}
                        />
                        {formErrors.tcNumber && <span className="text-xs text-red-500">{formErrors.tcNumber}</span>}
                    </div>

                    {/* 1. Ad Soyad */}
                    <div className="space-y-1">
                        <Label>Ad Soyad</Label>
                        <Input
                            value={name}
                            onChange={e => { setName(e.target.value); if (formErrors.name) setFormErrors({ ...formErrors, name: '' }); }}
                            placeholder="Ad Soyad"
                            className={formErrors.name ? "border-red-500" : ""}
                        />
                        {formErrors.name && <span className="text-xs text-red-500">{formErrors.name}</span>}
                    </div>



                    {/* Personel Grubu */}
                    <div className="space-y-1">
                        <Label>Personel Grubu</Label>
                        <Select value={category} onValueChange={(v: any) => setCategory(v)}>
                            <SelectTrigger className={formErrors.category ? "border-red-500" : ""}>
                                <SelectValue placeholder="Seçiniz" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="TECHNICAL">Teknik Personel</SelectItem>
                                <SelectItem value="FIELD">Saha Personeli</SelectItem>
                            </SelectContent>
                        </Select>
                        {formErrors.category && <span className="text-xs text-red-500">{formErrors.category}</span>}
                    </div>

                    {/* 3. Mesleği */}
                    <div className="space-y-1">
                        <Label>Mesleği</Label>
                        <Input
                            value={profession}
                            onChange={e => setProfession(e.target.value)}
                            placeholder="Örn: İnşaat Mühendisi"
                            className={formErrors.profession ? "border-red-500" : ""}
                        />
                        {formErrors.profession && <span className="text-xs text-red-500">{formErrors.profession}</span>}
                    </div>

                    {/* 4. Görevi */}
                    <div className="space-y-1">
                        <Label>Görevi</Label>
                        <Input
                            value={role}
                            onChange={e => setRole(e.target.value)}
                            placeholder="Örn: Şantiye Şefi"
                            className={formErrors.role ? "border-red-500" : ""}
                        />
                        {formErrors.role && <span className="text-xs text-red-500">{formErrors.role}</span>}
                    </div>

                    {/* 5. Maaş ve Geçmişi */}
                    <div className="space-y-1">
                        <div className="flex justify-between items-center">
                            <Label>Net Maaş (TL)</Label>
                            {personnelToEdit && !showSalaryUpdate && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-xs text-blue-600 hover:text-blue-700 p-0"
                                    onClick={() => setShowSalaryUpdate(true)}
                                >
                                    + Yeni Maaş Ekle
                                </Button>
                            )}
                            {showSalaryUpdate && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-xs text-red-600 hover:text-red-700 p-0"
                                    onClick={() => setShowSalaryUpdate(false)}
                                >
                                    İptal
                                </Button>
                            )}
                        </div>

                        {!showSalaryUpdate ? (
                            <div className="relative">
                                <Input
                                    type="number"
                                    value={salary}
                                    onChange={e => {
                                        setSalary(e.target.value);
                                        if (formErrors.salary) setFormErrors({ ...formErrors, salary: '' });
                                    }}
                                    placeholder="0.00"
                                    className={formErrors.salary ? "border-red-500 pr-8" : "pr-8"}
                                    disabled={!!personnelToEdit}
                                />
                                <span className="absolute right-3 top-2.5 text-slate-400">₺</span>
                            </div>
                        ) : (
                            <div className="p-3 bg-slate-50 border rounded-md space-y-3">
                                <div className="space-y-1">
                                    <Label className="text-xs">Yeni Maaş Tutarı</Label>
                                    <Input
                                        type="number"
                                        value={newSalary}
                                        onChange={e => setNewSalary(e.target.value)}
                                        placeholder="0.00"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Geçerlilik Tarihi</Label>
                                    <Input
                                        type="date"
                                        value={salaryEffectiveDate}
                                        onChange={e => setSalaryEffectiveDate(e.target.value)}
                                    />
                                </div>
                            </div>
                        )}
                        {personnelToEdit && !showSalaryUpdate && (
                            <p className="text-[10px] text-muted-foreground text-right">
                                Güncel maaşı değiştirmek için "Yeni Maaş Ekle" butonunu kullanınız.
                            </p>
                        )}
                        {formErrors.salary && <span className="text-xs text-red-500">{formErrors.salary}</span>}
                    </div>

                    {/* [NEW] İşe Başlama Tarihi (Hidden / Auto-detected) */}
                    {/* Input removed as per request. Auto-set to Today. */}

                    {/* 6. Şantiye */}
                    <div className="space-y-1">
                        <Label>Şantiye</Label>
                        <Select value={siteId} onValueChange={setSiteId}>
                            <SelectTrigger className={formErrors.siteId ? "border-red-500" : ""}>
                                <SelectValue placeholder="Şantiye Seçiniz" />
                            </SelectTrigger>
                            <SelectContent>
                                {sites.filter(s => s.status === 'ACTIVE').map(s => (
                                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {formErrors.siteId && <span className="text-xs text-red-500">{formErrors.siteId}</span>}
                    </div>

                    {/* [NEW] Aylık İzin Hakkı & Mesai Hakkı */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <Label>Aylık İzin Hakkı (Gün)</Label>
                            <Input
                                type="number"
                                value={monthlyLeaveAllowance}
                                onChange={e => setMonthlyLeaveAllowance(e.target.value)}
                                placeholder="Örn: 2"
                            />
                        </div>
                        <div className="space-y-1 flex flex-col justify-end pb-2">
                            <div className="flex items-center space-x-2 border p-2 rounded-md bg-slate-50">
                                <Checkbox
                                    id="overtime"
                                    checked={isOvertimeAllowed}
                                    onCheckedChange={(checked) => setIsOvertimeAllowed(checked as boolean)}
                                />
                                <label
                                    htmlFor="overtime"
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                >
                                    Mesai Hakkı Var
                                </label>
                            </div>
                        </div>
                    </div>



                    {/* 7. Notlar */}
                    <div className="space-y-1">
                        <Label>Notlar</Label>
                        <Input
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            placeholder="Ek bilgiler..."
                        />
                    </div>

                    <DialogFooter className="pt-4 flex justify-between gap-2">
                        {/* [NEW] Delete Button (Only for Edit) */}
                        {personnelToEdit && (
                            <Button
                                type="button"
                                variant="destructive"
                                className="w-1/3"
                                onClick={async () => {
                                    // Validation Logic replicated from PersonnelList
                                    const globalAttendanceCount = personnelAttendance.filter(a => a.personnelId === personnelToEdit.id).length;
                                    const hasTransferHistory = personnelToEdit.transferHistory && personnelToEdit.transferHistory.length > 0;

                                    if (globalAttendanceCount > 0 || hasTransferHistory) {
                                        toast.error("Bu personel silinemez! İşlem geçmişi mevcut.");
                                        alert(
                                            `Bu personel silinemez!\n\n` +
                                            `Silme Engeli:\n` +
                                            (globalAttendanceCount > 0 ? `- ${globalAttendanceCount} adet Puantaj kaydı bulunmaktadır.\n` : '') +
                                            (hasTransferHistory ? `- Geçmiş şantiye transfer kayıtları bulunmaktadır.\n` : '') +
                                            `\nVeri bütünlüğünü korumak için personeli "İşten Ayrıldı" olarak işaretleyiniz.`
                                        );
                                        return;
                                    }

                                    if (confirm(`${personnelToEdit.fullName} isimli personeli silmek istediğinize emin misiniz?\n\nBU İŞLEM GERİ ALINAMAZ!`)) {
                                        const result = await deletePersonnelServer(personnelToEdit.id);
                                        if (result.success) {
                                            deletePersonnel(personnelToEdit.id);
                                            toast.success("Personel silindi.");
                                            if (setFinalOpen) setFinalOpen(false);
                                        } else {
                                            toast.error(result.error || "Silme işlemi başarısız.");
                                        }
                                    }
                                }}
                            >
                                Sil
                            </Button>
                        )}
                        <Button type="submit" className={personnelToEdit ? "w-2/3" : "w-full"}>
                            {personnelToEdit ? 'Güncelle' : 'Kaydet'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
