import { useState } from "react"
import { useAppStore } from "@/lib/store/use-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Trash2, Plus, Building2, Users, Pencil, X, Download, FileSpreadsheet, FileText } from "lucide-react"
import { Institution } from "@/lib/types"
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fontBase64 } from '@/lib/pdf-font';
import { format } from 'date-fns';

interface InsuranceDefinitionsDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    type: 'INSURANCE_COMPANY' | 'INSURANCE_AGENCY' // [NEW] Forced type
}

export function InsuranceDefinitionsDialog({
    open,
    onOpenChange,
    type,
}: InsuranceDefinitionsDialogProps) {
    const { institutions, addInstitution, updateInstitution, deleteInstitution } = useAppStore()
    const [newName, setNewName] = useState("")
    const [email, setEmail] = useState("")
    const [phone, setPhone] = useState("")
    const [mobile, setMobile] = useState("")
    const [contactPerson, setContactPerson] = useState("")
    const [editingId, setEditingId] = useState<string | null>(null)

    // Filter based on the passed type and sort alphabetically
    const items = institutions
        .filter((i: Institution) => i.category === type)
        .sort((a, b) => a.name.localeCompare(b.name, 'tr'))

    const title = type === 'INSURANCE_COMPANY' ? 'Sigorta Firmaları' : 'Sigorta Acenteleri'
    const description = type === 'INSURANCE_COMPANY'
        ? 'Çalışılan sigorta firmalarını buradan yönetebilirsiniz.'
        : 'Çalışılan sigorta acentelerini buradan yönetebilirsiniz.'
    const label = type === 'INSURANCE_COMPANY' ? 'Firma Adı' : 'Acente Adı'
    const placeholder = type === 'INSURANCE_COMPANY' ? 'Örn: Allianz, Axa' : 'Örn: Çınar Sigorta'
    const Icon = type === 'INSURANCE_COMPANY' ? Building2 : Users

    const formatPhoneNumber = (value: string) => {
        // Remove all non-digits
        const digits = value.replace(/\D/g, '').substring(0, 11);

        // Build the formatted string
        let formatted = '';
        if (digits.length > 0) {
            formatted = digits.substring(0, 1); // 0 or first digit
            // Force it to start with 0 if it doesn't? Let's just trust input for now but format chunks
            // User wants 0 212... format. If they type '212', we might want to auto-prepend 0, but simplicity first.
            // Standard format: 0 (1) + 3 + 3 + 2 + 2

            if (digits.length > 1) formatted += ' ' + digits.substring(1, 4);
            if (digits.length > 4) formatted += ' ' + digits.substring(4, 7);
            if (digits.length > 7) formatted += ' ' + digits.substring(7, 9);
            if (digits.length > 9) formatted += ' ' + digits.substring(9, 11);
        }
        return formatted;
    }

    const resetForm = () => {
        setNewName("")
        setEmail("")
        setPhone("")
        setMobile("")
        setContactPerson("")
        setEditingId(null)
    }

    const handleSave = () => {
        if (!newName.trim()) return
        if (type === 'INSURANCE_AGENCY' && !email.trim()) {
            alert('Acente için e-posta adresi zorunludur.')
            return
        }

        if (editingId) {
            // Update existing
            updateInstitution(editingId, {
                name: newName.trim(),
                email,
                phone,
                mobile,
                contactPerson
            })
        } else {
            // Add new
            addInstitution({
                id: crypto.randomUUID(),
                name: newName.trim(),
                category: type,
                email,
                phone,
                mobile,
                contactPerson
            })
        }
        resetForm()
    }

    const handleEdit = (item: Institution) => {
        setEditingId(item.id)
        setNewName(item.name)
        setEmail(item.email || "")
        setPhone(item.phone || "")
        setMobile(item.mobile || "")
        setContactPerson(item.contactPerson || "")
    }

    const handleDelete = (id: string) => {
        if (confirm("Bu kaydı silmek istediğinizden emin misiniz?")) {
            deleteInstitution(id)
            if (editingId === id) resetForm()
        }
    }

    const exportExcel = () => {
        const data = items.map((i: any) => ({
            'Adı': i.name,
            'Kategori': type === 'INSURANCE_COMPANY' ? 'Sigorta Firması' : 'Acente',
            'İlgili Kişi': i.contactPerson || '-',
            'Telefon': i.phone || '-',
            'Cep': i.mobile || '-',
            'E-posta': i.email || '-'
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, title);
        XLSX.writeFile(wb, `${type === 'INSURANCE_COMPANY' ? 'sigorta-firmalari' : 'sigorta-acenteleri'}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    };

    const exportPDF = () => {
        const doc = new jsPDF();

        doc.addFileToVFS('Roboto-Regular.ttf', fontBase64);
        doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
        doc.setFont('Roboto');

        const tableColumn = ["Adı", "İlgili Kişi", "Telefon", "Cep", "E-posta"];
        const tableRows = items.map((i: any) => [
            i.name,
            i.contactPerson || '-',
            i.phone || '-',
            i.mobile || '-',
            i.email || '-'
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            styles: { font: 'Roboto', fontSize: 9 },
            headStyles: { fillColor: [41, 128, 185] },
            startY: 20,
        });

        doc.text(title, 14, 15);
        doc.save(`${type === 'INSURANCE_COMPANY' ? 'sigorta-firmalari' : 'sigorta-acenteleri'}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    };

    return (
        <Dialog open={open} onOpenChange={(val) => {
            if (!val) resetForm()
            onOpenChange(val)
        }}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>
                        {description}
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    <div className="grid gap-4 p-4 border rounded-md bg-slate-50 relative">
                        {editingId && (
                            <div className="absolute top-2 right-2">
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-slate-900" onClick={resetForm} title="İptal">
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                        {!editingId && (
                            <div className="absolute top-2 right-2 flex gap-1">
                                <Button variant="outline" size="icon" className="h-6 w-6" onClick={exportPDF} title="PDF İndir">
                                    <FileText className="h-3 w-3 text-red-600" />
                                </Button>
                                <Button variant="outline" size="icon" className="h-6 w-6" onClick={exportExcel} title="Excel İndir">
                                    <FileSpreadsheet className="h-3 w-3 text-green-600" />
                                </Button>
                            </div>
                        )}
                        <div className="grid gap-1.5">
                            <Label htmlFor="name">{label} <span className="text-red-500">*</span></Label>
                            <Input
                                id="name"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder={placeholder}
                            />
                        </div>

                        {/* Contact Fields - Only for Agencies */}
                        {type === 'INSURANCE_AGENCY' && (
                            <>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="email">E-posta <span className="text-red-500">*</span></Label>
                                        <Input
                                            id="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="ornek@email.com"
                                        />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="phone">Sabit Telefon</Label>
                                        <Input
                                            id="phone"
                                            value={phone}
                                            onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
                                            placeholder="0 212 555 55 55"
                                            maxLength={15}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="mobile">Cep Telefonu</Label>
                                        <Input
                                            id="mobile"
                                            value={mobile}
                                            onChange={(e) => setMobile(formatPhoneNumber(e.target.value))}
                                            placeholder="0 555 555 55 55"
                                            maxLength={15}
                                        />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="contact">İlgili Kişi</Label>
                                        <Input
                                            id="contact"
                                            value={contactPerson}
                                            onChange={(e) => setContactPerson(e.target.value)}
                                            placeholder="Ad Soyad"
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        <div className="flex gap-2 mt-2">
                            {editingId && (
                                <Button variant="outline" onClick={resetForm} className="flex-1">
                                    İptal
                                </Button>
                            )}
                            <Button onClick={handleSave} disabled={!newName.trim() || (type === 'INSURANCE_AGENCY' && !email.trim())} className="flex-1">
                                {editingId ? (
                                    <>
                                        <Pencil className="h-4 w-4 mr-2" />
                                        Güncelle
                                    </>
                                ) : (
                                    <>
                                        <Plus className="h-4 w-4 mr-2" />
                                        Ekle
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>

                    <div className="border rounded-md divide-y max-h-[300px] overflow-y-auto">
                        {items.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
                                <Icon className="w-8 h-8 opacity-50" />
                                <span className="text-muted-foreground">Henüz eklenmiş kayıt yok.</span>
                            </div>
                        ) : (
                            items.map((item: Institution) => (
                                <div
                                    key={item.id}
                                    className={`flex items-center justify-between p-3 hover:bg-muted/50 group ${editingId === item.id ? 'bg-blue-50' : ''}`}
                                >
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            <Icon className="w-4 h-4 text-slate-500" />
                                            <span className="font-medium text-slate-900">{item.name}</span>
                                        </div>
                                        {(item.phone || item.mobile || item.contactPerson) && (
                                            <div className="text-xs text-muted-foreground pl-6 flex flex-col">
                                                {item.contactPerson && <span>Yetkili: {item.contactPerson}</span>}
                                                <div className="flex gap-2">
                                                    {item.phone && <span>Tel: {item.phone}</span>}
                                                    {item.mobile && <span>Cep: {item.mobile}</span>}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity hover:text-blue-700 hover:bg-blue-50"
                                            onClick={() => handleEdit(item)}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-700 hover:bg-red-50"
                                            onClick={() => handleDelete(item.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
