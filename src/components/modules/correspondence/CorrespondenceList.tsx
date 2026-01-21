'use client';

import { useAppStore } from '@/lib/store/use-store';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
// AlertDialog imports removed
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useState, useEffect } from 'react';
import { AlertCircle, FileText, Search, Plus, Filter, Calendar as CalendarIcon, Wallet, Download, Trash2, Edit, Printer, FileDown, Eye, Maximize2, Minimize2, AlignLeft, AlignCenter, AlignRight, Building2, Landmark, AlertTriangle, RotateCcw, Copy, Pencil, FileSpreadsheet } from "lucide-react";
import { CorrespondenceForm } from './CorrespondenceForm';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { jsPDF } from 'jspdf';
import { addTurkishFont } from '@/lib/pdf-font';
import { useAuth } from '@/lib/store/use-auth';
import { IKIKAT_LOGO_BASE64, KADTEM_LOGO_BASE64 } from '@/lib/logos';
import { normalizeSearchText } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/multi-select';
import { useRef } from 'react';

const PDFPreview = ({ base64 }: { base64: string }) => {
    const [url, setUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!base64) return;
        try {
            // Handle both raw base64 and data URI
            const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;

            // Standard base64 decoding
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/pdf' });
            const blobUrl = URL.createObjectURL(blob);
            setUrl(blobUrl);

            return () => URL.revokeObjectURL(blobUrl);
        } catch (e) {
            console.error("PDF Preview Error:", e);
            setUrl(null);
        }
    }, [base64]);

    if (!url) return <div className="flex items-center justify-center h-full text-sm text-slate-500">Önizleme hazırlanıyor...</div>;

    return (
        <iframe
            src={url}
            className="w-full h-full"
            title="PDF Preview"
        />
    );
};

import * as XLSX from 'xlsx';
import autoTable from 'jspdf-autotable';
import { fontBase64 } from '@/lib/pdf-font'; // Assume this exists as used in other files

export function CorrespondenceList() {
    const { correspondences, companies, updateCorrespondence, users, deleteCorrespondence, restoreCorrespondence, institutions, deleteInstitution, updateInstitution, addInstitution, addCorrespondence, sites } = useAppStore();
    const { user, hasPermission } = useAuth();

    // Permission Checks
    const canViewIncoming = hasPermission('correspondence.incoming', 'VIEW');
    const canCreateIncoming = hasPermission('correspondence.incoming', 'CREATE');
    const canEditIncoming = hasPermission('correspondence.incoming', 'EDIT');

    const canViewOutgoing = hasPermission('correspondence.outgoing', 'VIEW');
    const canCreateOutgoing = hasPermission('correspondence.outgoing', 'CREATE');
    const canEditOutgoing = hasPermission('correspondence.outgoing', 'EDIT');

    const canViewBank = hasPermission('correspondence.bank', 'VIEW');
    const canCreateBank = hasPermission('correspondence.bank', 'CREATE');
    const canEditBank = hasPermission('correspondence.bank', 'EDIT');

    const canViewContacts = hasPermission('correspondence.contacts', 'VIEW');
    const canCreateContacts = hasPermission('correspondence.contacts', 'CREATE');
    const canEditContacts = hasPermission('correspondence.contacts', 'EDIT');

    const canViewDeleted = hasPermission('correspondence.deleted', 'VIEW');
    const canExport = hasPermission('correspondence', 'EXPORT');

    // Default Tab Logic
    const getDefaultTab = () => {
        if (canViewIncoming) return 'incoming';
        if (canViewOutgoing) return 'outgoing';
        if (canViewBank) return 'bank';
        if (canViewContacts) return 'muhataplar';
        if (canViewDeleted) return 'deleted';
        return 'incoming'; // Fallback
    };

    const [missingRefs, setMissingRefs] = useState<any[]>([]);
    const [missingRegs, setMissingRegs] = useState<any[]>([]); // New State for Missing Reg Nos
    const [isReminderOpen, setIsReminderOpen] = useState(false);
    const [isRegReminderOpen, setIsRegReminderOpen] = useState(false); // New Dialog State
    const [editRefs, setEditRefs] = useState<{ [key: string]: string }>({});
    const [editRegs, setEditRegs] = useState<{ [key: string]: string }>({}); // New Edit State
    const [searchTerm, setSearchTerm] = useState('');

    // Filter Dialog States
    const [isAddressOpen, setIsAddressOpen] = useState(false); // Legacy?
    const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
    const [editInstId, setEditInstId] = useState<string | null>(null);
    const [editInstName, setEditInstName] = useState('');
    const [editInstCategory, setEditInstCategory] = useState<'INSTITUTION' | 'BANK'>('INSTITUTION');
    const [editInstAlign, setEditInstAlign] = useState<'left' | 'center' | 'right'>('center');

    // [NEW] Track specific item for single-entry
    const [selectedRegId, setSelectedRegId] = useState<string | null>(null);


    // New helper to open specific reg number edit
    const openRegReminder = (itemId?: string) => {
        if (itemId) {
            setSelectedRegId(itemId);
            // Pre-fill if editing existing
            const item = activeCorrespondences.find((c: any) => c.id === itemId);
            if (item && item.registrationNumber) {
                setEditRegs(prev => ({ ...prev, [itemId]: item.registrationNumber || '' }));
            }
        } else {
            setSelectedRegId(null);
        }
        setIsRegReminderOpen(true);
    };


    // Button to open Missing Registration Numbers
    const MissingRegButton = () => {
        if (missingRegs.length === 0) return null;
        return (
            <Button
                variant="destructive"
                size="sm"
                onClick={() => openRegReminder()}
                className="animate-pulse"
            >
                <AlertCircle className="w-4 h-4 mr-2" />
                {missingRegs.length} Eksik Kayıt No
            </Button>
        );
    };

    // [NEW] Filters
    const [filterCompany, setFilterCompany] = useState<string[]>([]);
    const [filterCreator, setFilterCreator] = useState<string[]>([]);
    const [filterSenderReceiver, setFilterSenderReceiver] = useState<string[]>([]);
    const [dateRange, setDateRange] = useState<{ start: string, end: string }>({ start: '', end: '' });

    // Address Book Edit Logic
    // const [editInstId, setEditInstId] = useState<string | null>(null); // Already declared above
    // const [editInstName, setEditInstName] = useState(''); // Already declared above
    // const [editInstAlign, setEditInstAlign] = useState<'left' | 'center' | 'right'>('center'); // Already declared above
    // const [editInstCategory, setEditInstCategory] = useState<'BANK' | 'INSTITUTION'>('INSTITUTION'); // Already declared above
    // const [isAddressModalOpen, setIsAddressModalOpen] = useState(false); // Already declared above

    const getCompanyName = (id: string) => companies.find((c: any) => c.id === id)?.name || '-';

    const openAddressModal = (item?: any) => {
        if (item) {
            setEditInstId(item.id);
            setEditInstName(item.name);
            setEditInstAlign(item.alignment || 'left');
            setEditInstCategory(item.category || 'INSTITUTION');
        } else {
            setEditInstId(null);
            setEditInstName('');
            setEditInstAlign('center'); // Center by default
            setEditInstCategory('INSTITUTION'); // Default
        }
        setIsAddressModalOpen(true);
    };
    const getUserName = (id: string) => users.find((u: any) => u.id === id)?.name || 'Bilinmeyen';

    const handleSaveAddress = () => {
        if (!editInstName.trim()) return;

        if (editInstId) {
            updateInstitution(editInstId, { name: editInstName, alignment: 'center', category: editInstCategory });
        } else {
            addInstitution({ id: crypto.randomUUID(), name: editInstName, alignment: 'center', category: editInstCategory });
        }
        setIsAddressModalOpen(false);
    };

    // Delete Logic
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleteReason, setDeleteReason] = useState('');
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);

    // Extract Unique Values for Dropdowns
    // We only care about active correspondences to avoid cluttering filters with deleted items' data
    const baseList = correspondences.filter((c: any) => c.status !== 'DELETED');

    const uniqueCompanyIds = Array.from(new Set(baseList.map((c: any) => c.companyId)));
    const uniqueCreatorIds = Array.from(new Set(baseList.map((c: any) => c.createdByUserId)));
    const uniqueSenderReceivers = Array.from(new Set(baseList.map((c: any) => c.senderReceiver).filter(Boolean))).sort();

    const activeCorrespondences = baseList
        .filter((c: any) => {
            // 1. Search Term (Fuzzy)
            if (searchTerm) {
                const lowerSearch = normalizeSearchText(searchTerm);
                const subject = normalizeSearchText(c.subject);
                const refNo = normalizeSearchText(c.referenceNumber);
                const senderReceiver = normalizeSearchText(c.senderReceiver);
                const date = normalizeSearchText(c.date);
                const regNo = normalizeSearchText(c.registrationNumber);
                const company = normalizeSearchText(getCompanyName(c.companyId));
                const creator = normalizeSearchText(getUserName(c.createdByUserId));
                const formattedDate = normalizeSearchText(format(new Date(c.date), 'dd.MM.yyyy'));

                const matches = (
                    subject.includes(lowerSearch) ||
                    refNo.includes(lowerSearch) ||
                    senderReceiver.includes(lowerSearch) ||
                    date.includes(lowerSearch) ||
                    formattedDate.includes(lowerSearch) ||
                    regNo.includes(lowerSearch) ||
                    company.includes(lowerSearch) ||
                    creator.includes(lowerSearch)
                );
                if (!matches) return false;
            }

            // 2. Dropdown Filters
            if (filterCompany.length > 0 && !filterCompany.includes(c.companyId)) return false;
            if (filterCreator.length > 0 && !filterCreator.includes(c.createdByUserId)) return false;
            if (filterSenderReceiver.length > 0 && !filterSenderReceiver.includes(c.senderReceiver)) return false;

            // 3. Date Range
            if (dateRange.start) {
                if (new Date(c.date) < new Date(dateRange.start)) return false;
            }
            if (dateRange.end) {
                // Set end date to end of day? Or just simple comparison?
                // Simple string comparison works for ISO if dates are YYYY-MM-DD.
                // But c.date is full ISO datetime usually.
                // safer:
                const d = new Date(c.date);
                const e = new Date(dateRange.end);
                e.setHours(23, 59, 59, 999);
                if (d > e) return false;
            }

            // [NEW] Isolation Logic: Filter by user if not admin
            if (user && user.role !== 'ADMIN') {
                return c.createdByUserId === user.id;
            }
            return true;
        })
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const deletedCorrespondences = correspondences.filter((c: any) => c.status === 'DELETED');

    useEffect(() => {
        // Check for items with missing reference numbers (Active only)
        const missing = activeCorrespondences.filter((c: any) => c.type !== 'BANK' && (!c.referenceNumber || c.referenceNumber.trim() === ''))
            .map((c: any) => ({ id: c.id, subject: c.subject, date: c.date }));

        if (missing.length > 0) {
            const today = new Date().toISOString().split('T')[0];
            const lastShown = localStorage.getItem('missingRefWarningDate');

            if (lastShown !== today) {
                setMissingRefs(missing);
                setIsReminderOpen(true);
                localStorage.setItem('missingRefWarningDate', today);
            }
        }

        // Check for items with missing REGISTRATION numbers (Outgoing only usually, or user requested generic)
        // User said: "Evrak Kayıt Nosu olmayan evraklara kayıt numarası gir diye uyarıcı bir buton koy"
        // Let's filter for Outgoing non-bank items that don't have a registration number
        const missingReg = activeCorrespondences.filter((c: any) => c.type !== 'BANK' && c.direction === 'OUTGOING' && (!c.registrationNumber || c.registrationNumber.trim() === ''))
            .map((c: any) => ({ id: c.id, subject: c.subject, date: c.date, referenceNumber: c.referenceNumber }));

        // We don't auto-open this usually, or maybe we do? User said "put a button".
        // So we just update the state so the button can appear if there's any.
        setMissingRegs(missingReg);

    }, [correspondences]);

    const handleSaveRefs = () => {
        Object.entries(editRefs).forEach(([id, refNo]) => {
            if (refNo && refNo.trim() !== '') {
                updateCorrespondence(id, { referenceNumber: refNo });
            }
        });
        setIsReminderOpen(false);
        setEditRefs({});
    };

    const handleSaveRegs = () => {
        Object.entries(editRegs).forEach(([id, regNo]) => {
            if (regNo && regNo.trim() !== '') {
                updateCorrespondence(id, { registrationNumber: regNo });
            }
        });
        setIsRegReminderOpen(false);
        setEditRegs({});
    };

    const handleDeleteClick = (item: any) => {
        // [NEW] Date Restriction Check
        if (user && user.role !== 'ADMIN' && user.editLookbackDays !== undefined) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const target = new Date(item.date); // Correspondence item has date
            target.setHours(0, 0, 0, 0);
            const diff = (today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24);

            if (diff > user.editLookbackDays) {
                alert(`Bu kayıt ${user.editLookbackDays} günden daha eski olduğu için silinemez.`);
                return;
            }
        }

        // [NEW] Prevent deletion if outgoing correspondence has a registration number (Unless ADMIN)
        if (item.direction === 'OUTGOING' && item.registrationNumber && user?.role !== 'ADMIN') {
            alert('Evrak kayıt numarası girilmiş giden evrakları silemezsiniz! (Sadece Y yönetici silebilir)');
            return;
        }

        setItemToDelete(item.id);
        setDeleteReason('');
        setDeleteDialogOpen(true);
    };

    const handleDuplicate = (item: any) => {
        if (!confirm('Bu evrakın bir kopyasını oluşturmak istiyor musunuz?')) return;

        const newItem = {
            ...item,
            id: crypto.randomUUID(),
            date: new Date().toISOString(),
            // Clear unique tracking numbers for the copy, as it's a new document
            referenceNumber: '',
            registrationNumber: '',
            createdAt: new Date().toISOString(),
            createdByUserId: user?.id
        };

        addCorrespondence(newItem);
    };

    const confirmDelete = () => {
        if (!itemToDelete || !deleteReason.trim() || !user) return;
        deleteCorrespondence(itemToDelete, deleteReason, user.id);
        setDeleteDialogOpen(false);
        setItemToDelete(null);
        setDeleteReason('');
    };

    const handleRestore = (id: string) => {
        if (confirm('Bu kaydı geri almak istediğinize emin misiniz?')) {
            restoreCorrespondence(id);
        }
    };

    const handleExport = () => {
        const headers = ["Tarih", "Yön", "Tip", "Firma", "Konu", "Muhatap", "Oluşturan"];
        const escapeCsv = (val: string | number | undefined | null) => {
            if (val === undefined || val === null) return '';
            const str = String(val);
            // Escape quotes and wrap in quotes if contains delimiter or newline
            if (str.includes(';') || str.includes('\n') || str.includes('"')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        const rows = activeCorrespondences.map((c: any) => [
            escapeCsv(c.date),
            escapeCsv(c.direction === 'INCOMING' ? 'Gelen' : 'Giden'),
            escapeCsv(c.type),
            escapeCsv(getCompanyName(c.companyId)),
            escapeCsv(c.subject),
            escapeCsv(c.senderReceiver),
            escapeCsv(getUserName(c.createdByUserId))
        ]);

        const csvContent = "\uFEFF" + headers.join(";") + "\n"
            + rows.map((e: any) => e.join(";")).join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "yazismalar.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrint = (item: any) => {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        addTurkishFont(doc);
        const fontName = 'Roboto';
        doc.setFont(fontName, 'normal');

        const marginLeft = 25; // Standard 2.5cm
        const marginRight = 25;
        const marginTop = 20; // Standard 2cm top
        const marginBottom = 20;
        const contentWidth = 210 - marginLeft - marginRight;

        let yPos = marginTop;

        // 1. Header (Logo)
        const companyName = getCompanyName(item.companyId);
        const normalizedName = companyName.toLocaleLowerCase('tr');

        let logoToUse = null;
        if (normalizedName.includes('ikikat') || normalizedName.includes('ıkıkat')) {
            logoToUse = IKIKAT_LOGO_BASE64;
        } else if (normalizedName.includes('kad-tem') || normalizedName.includes('kadtem')) {
            logoToUse = KADTEM_LOGO_BASE64;
        }

        if (logoToUse) {
            try {
                const imgProps = doc.getImageProperties(logoToUse);
                const pdfWidth = 160; // Slightly smaller to fit margins
                const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

                // Center Logo? Or Left? Usually Top Left or Center.
                // Image example shows Top Left.
                doc.addImage(logoToUse, 'PNG', marginLeft, 10, pdfWidth, pdfHeight);
                yPos = 10 + pdfHeight + 10;
            } catch (e) {
                console.error("Error adding logo", e);
                yPos = 45;
            }
        } else {
            yPos += 15;
        }

        // 2. Date (Right Aligned)
        const dateStr = format(new Date(item.date), 'dd.MM.yyyy');
        doc.setFontSize(10);
        doc.setFont(fontName, 'normal');
        // Move Date up even more? User said "sayı ve konuyu 1 satır yukarı alalım"
        // Let's tighten the gap between Date and Number
        doc.text(dateStr, 210 - marginRight, yPos - 5, { align: 'right' });
        yPos += 5; // Reduced gap from 10 to 5

        // 3. Number (Sayı)
        doc.setFont(fontName, 'bold');
        doc.setFontSize(10);
        doc.text('Sayı:', marginLeft, yPos);
        doc.setFont(fontName, 'normal');
        doc.text(item.referenceNumber || '-', marginLeft + 12, yPos);
        yPos += 8; // Reduced gap from 15 to 8

        // Removed Registration Number (Kayıt No) from PDF as per request
        // if (item.registrationNumber) {
        //     yPos += 5;
        //     doc.setFont(fontName, 'bold');
        //     doc.text('Kayıt No:', marginLeft, yPos);
        //     doc.setFont(fontName, 'normal');
        //     doc.text(item.registrationNumber, marginLeft + 20, yPos);
        // }
        // yPos += 6;

        // 4. Subject (Konu)
        doc.setFont(fontName, 'bold');
        doc.text('Konu:', marginLeft, yPos);
        doc.setFont(fontName, 'normal');
        const subjectText = item.subject;
        const subjectLines = doc.splitTextToSize(subjectText, contentWidth - 25);
        doc.text(subjectLines, marginLeft + 12, yPos);
        const subjectH = doc.getTextDimensions(subjectLines).h;
        yPos += Math.max(subjectH, 5) + 10; // Reduced gap from 15 to 10

        // 5. Recipient (Muhatap) - Centered & Bold 12pt
        // Move up 1 line
        doc.setFont(fontName, 'bold');
        doc.setFontSize(12);
        const recipientText = (item.senderReceiver || '').toUpperCase();
        const recipientLines = doc.splitTextToSize(recipientText, contentWidth);
        doc.text(recipientLines, 105, yPos, { align: 'center' });
        const recipH = doc.getTextDimensions(recipientLines).h;
        yPos += recipH + 15;


        // 6. Interest (İlgi) - Moved below Recipient, NO Indent
        // "İlgideki paragraf boşluğunu geri silelim" -> No indent
        const interestIndent = 0;

        if (item.interest && item.interest.length > 0) {
            doc.setFontSize(10);
            item.interest.forEach((int: string, idx: number) => {
                const label = item.interest.length > 1 ? `İlgi ${String.fromCharCode(65 + idx)}:` : 'İlgi:';

                doc.setFont(fontName, 'bold');
                doc.text(label, marginLeft, yPos); // No indent

                doc.setFont(fontName, 'normal');
                // Adjust text indent relative to label
                const intLines = doc.splitTextToSize(int, contentWidth - 20);
                doc.text(intLines, marginLeft + 12, yPos);
                yPos += doc.getTextDimensions(intLines).h + 3;
            });
            yPos += 10;
        } else {
            yPos += 5;
        }

        // 7. Content (Dilekçe Metni) - Justified & Rich Text Support
        doc.setFontSize(10);
        doc.setFont(fontName, 'normal');

        const contentX = marginLeft; // Start from margin
        const lineWidth = contentWidth; // Full width
        const firstLineIndent = 12.5; // ~1.25cm

        // Helper to measure word width with current font
        const getWordWidth = (word: string, bold: boolean, italic: boolean, underline: boolean) => {
            // Always use normal to prevent encoding issues with missing font variants
            doc.setFont(fontName, 'normal');
            return doc.getTextWidth(word);
        };

        // Parse HTML content from contentEditable
        // Simplification: Replace block tags with \n, and common entities
        let cleanDesc = item.description
            .replace(/<div>/g, '\n')
            .replace(/<\/div>/g, '')
            .replace(/<p>/g, '\n')
            .replace(/<\/p>/g, '')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/&nbsp;/g, ' ');

        // Split into paragraphs
        const paragraphs = cleanDesc.split('\n');

        paragraphs.forEach((para: string) => {
            if (!para.trim()) return;

            // Robust Tokenizer: Split by ANY tag
            // Capturing group ensures delimiters are included in result array
            const parts = para.split(/(<[^>]+>)/g).filter(p => p !== '');

            let tokens: { text: string, bold: boolean, italic: boolean, underline: boolean, width: number, isSpace: boolean }[] = [];
            let inBold = false;
            let inItalic = false;
            let inUnderline = false;

            parts.forEach(part => {
                // Check if it's a tag
                if (part.startsWith('<') && part.endsWith('>')) {
                    const tag = part.toLowerCase();
                    if (tag.includes('<b>') || tag.includes('<strong>')) { inBold = true; }
                    else if (tag.includes('</b>') || tag.includes('</strong>')) { inBold = false; }
                    else if (tag.includes('<i>') || tag.includes('<em>')) { inItalic = true; }
                    else if (tag.includes('</i>') || tag.includes('<em>')) { inItalic = false; }
                    else if (tag.includes('<u>')) { inUnderline = true; }
                    else if (tag.includes('</u>')) { inUnderline = false; }
                    // Ignore other tags (spans, etc) but DO NOT print them
                    return;
                }

                // It's text content
                // Split by whitespace but keep delimiters
                const words = part.split(/(\s+)/g).filter(w => w !== '');
                words.forEach(w => {
                    const wWidth = getWordWidth(w, inBold, inItalic, inUnderline);
                    tokens.push({
                        text: w,
                        bold: inBold,
                        italic: inItalic,
                        underline: inUnderline,
                        width: wWidth,
                        isSpace: /^\s+$/.test(w)
                    });
                });
            });

            // Line breaking and Justification
            let currentLine: typeof tokens = [];
            let currentLineWidth = 0;
            let isFirstLine = true;

            const printLine = (lineTokens: typeof tokens, justify: boolean) => {
                const indent = isFirstLine ? firstLineIndent : 0;
                const availableWidth = lineWidth - indent;

                const textWidth = lineTokens.reduce((acc, t) => acc + t.width, 0);
                const spaceTokens = lineTokens.filter(t => t.isSpace);

                let extraSpace = 0;
                let spacePerToken = 0;

                if (justify && spaceTokens.length > 0) {
                    const naturalWidth = textWidth;
                    if (availableWidth > naturalWidth) {
                        extraSpace = availableWidth - naturalWidth;
                        spacePerToken = extraSpace / spaceTokens.length;
                    }
                }

                let curX = marginLeft + indent;

                lineTokens.forEach(tok => {
                    // Always Normal Font
                    doc.setFont(fontName, 'normal');

                    if (tok.isSpace) {
                        if (tok.underline) {
                            doc.setLineWidth(0.3);
                            doc.line(curX, yPos + 1.5, curX + tok.width + (justify ? spacePerToken : 0), yPos + 1.5);
                        }
                        curX += tok.width + (justify ? spacePerToken : 0);
                    } else {
                        // Simulate Styles (Unified Logic below)
                        // Old Bold Block removed to prevent double draw
                        // See Unified Rendering Logic below

                        // Underline
                        if (tok.underline) {
                            doc.setLineWidth(0.3);
                            doc.line(curX, yPos + 1.5, curX + tok.width, yPos + 1.5); // Lowered slightly
                        }

                        // Unified Rendering Logic
                        const skewFactor = 0.3;

                        // 1. Italic (Complex handling with Matrix)
                        if (tok.italic) {
                            // Compensation: we want visual x = curX. x' = x - skewFactor * y.
                            const adjustedX = curX + (skewFactor * yPos);
                            try {
                                // @ts-ignore
                                const MatrixConstructor = (doc as any).Matrix || (jsPDF as any).Matrix || (doc.internal as any).Matrix;
                                if (MatrixConstructor) {
                                    const mtx = new MatrixConstructor(1, 0, -skewFactor, 1, 0, 0);
                                    if (tok.bold) {
                                        doc.text(tok.text, adjustedX + 0.15, yPos, { transform: mtx } as any);
                                        doc.text(tok.text, adjustedX, yPos, { transform: mtx } as any);
                                    } else {
                                        doc.text(tok.text, adjustedX, yPos, { transform: mtx } as any);
                                    }
                                } else {
                                    // Fallback
                                    if (tok.bold) {
                                        doc.text(tok.text, curX + 0.15, yPos);
                                        doc.text(tok.text, curX, yPos);
                                    } else {
                                        doc.text(tok.text, curX, yPos);
                                    }
                                }
                            } catch (e) {
                                // Fallback
                                if (tok.bold) {
                                    doc.text(tok.text, curX + 0.15, yPos);
                                    doc.text(tok.text, curX, yPos);
                                } else {
                                    doc.text(tok.text, curX, yPos);
                                }
                            }
                        }
                        // 2. Bold (Upright)
                        else if (tok.bold) {
                            doc.setLineWidth(0.2);
                            doc.text(tok.text, curX, yPos);
                            doc.text(tok.text, curX + 0.1, yPos);
                        }
                        // 3. Normal
                        else {
                            doc.text(tok.text, curX, yPos);
                        }




                        curX += tok.width;
                    }
                });

                yPos += 5;
                isFirstLine = false;
            };

            tokens.forEach(tok => {
                const indent = isFirstLine ? firstLineIndent : 0;
                const maxW = lineWidth - indent;

                if (currentLineWidth + tok.width > maxW) {
                    printLine(currentLine, true); // Justify
                    currentLine = [tok];
                    currentLineWidth = tok.width;
                } else {
                    currentLine.push(tok);
                    currentLineWidth += tok.width;
                }
            });

            if (currentLine.length > 0) {
                printLine(currentLine, false); // Left align last line
            }

            yPos += 3;
        });

        yPos += 15;

        // 7. Attachments (Ekler) - No indent, just List
        if ((item.appendices && item.appendices.length > 0) || (item.attachmentUrls && item.attachmentUrls.length > 0)) {
            doc.setFont(fontName, 'bold');
            doc.text('EKLER:', marginLeft, yPos);
            yPos += 5;
            doc.setFont(fontName, 'normal');

            // Text Appendices
            if (item.appendices && item.appendices.length > 0) {
                item.appendices.forEach((app: string, i: number) => {
                    if (!app) return;
                    const label = `${i + 1}) ${app}`;
                    // No extra indent, align with EKLER
                    const lines = doc.splitTextToSize(label, contentWidth);
                    doc.text(lines, marginLeft, yPos);
                    yPos += doc.getTextDimensions(lines).h + 2;
                });
            }

            // Start numbering for files based on text appendices count
            const startIdx = (item.appendices?.filter((a: string) => !!a).length || 0);

            // File Appendices
            if (item.attachmentUrls && item.attachmentUrls.length > 0) {
                item.attachmentUrls.forEach((_url: string, i: number) => {
                    doc.text(`${startIdx + i + 1}) Ek Dosya (PDF)`, marginLeft, yPos);
                    yPos += 5;
                });
            }
        }

        // Footer Signature (Bottom Right or Center?)
        // Standard usually:
        // (Signature)
        // Name Surname
        // Title
        // Footer / Signature
        // const signatureY = 240; // Fixed footer area
        // doc.text('İmza', 160, signatureY, { align: 'center' });
        // doc.text(getUserName(item.createdByUserId), 160, signatureY + 10, { align: 'center' });

        doc.save(`${item.subject.substring(0, 20)}.pdf`);
    };

    const bankItems = activeCorrespondences.filter((c: any) => c.type === 'BANK');
    const incomingItems = activeCorrespondences.filter((c: any) => c.type !== 'BANK' && c.direction === 'INCOMING');
    const outgoingItems = activeCorrespondences.filter((c: any) => c.type !== 'BANK' && c.direction === 'OUTGOING');

    const exportExcel = () => {
        const data = activeCorrespondences.map(c => ({
            'Tarih': format(new Date(c.date), 'dd.MM.yyyy', { locale: tr }),
            'Yön': c.direction === 'INCOMING' ? 'Gelen' : 'Giden',
            'Tip': c.type,
            'Firma': getCompanyName(c.companyId),
            'Konu': c.subject,
            'Sayı': c.referenceNumber || '-',
            'Muhatap': c.senderReceiver,
            'Oluşturan': getUserName(c.createdByUserId)
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Yazışmalar");
        XLSX.writeFile(wb, `yazismalar-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    };

    const exportListPDF = () => {
        const doc = new jsPDF('l', 'mm', 'a4'); // Landscape
        doc.addFileToVFS('Roboto-Regular.ttf', fontBase64);
        doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
        doc.setFont('Roboto');

        const tableColumn = ["Tarih", "Yön", "Tip", "Firma", "Konu", "Sayı", "Muhatap"];
        const tableRows = activeCorrespondences.map(c => [
            format(new Date(c.date), 'dd.MM.yyyy', { locale: tr }),
            c.direction === 'INCOMING' ? 'Gelen' : 'Giden',
            c.type,
            getCompanyName(c.companyId),
            c.subject,
            c.referenceNumber || '-',
            c.senderReceiver
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            styles: { font: 'Roboto', fontSize: 8 },
            headStyles: { fillColor: [41, 128, 185] },
            startY: 20,
        });

        doc.text("Yazışma Listesi", 14, 15);
        doc.save(`yazisma-listesi-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    };

    const renderFilters = () => (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-4 p-4 bg-slate-50/50 rounded-lg border">
            {/* Date Range */}
            <div>
                <Label className="text-xs">Başlangıç Tarihi</Label>
                <Input type="date" className="h-8 text-xs bg-white" value={dateRange.start} onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))} />
            </div>
            <div>
                <Label className="text-xs">Bitiş Tarihi</Label>
                <Input type="date" className="h-8 text-xs bg-white" value={dateRange.end} onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))} />
            </div>

            {/* Company Filter */}
            <div>
                <Label className="text-xs">Firma</Label>
                <MultiSelect
                    options={uniqueCompanyIds.map((id: any) => ({ label: getCompanyName(id), value: id }))}
                    selected={filterCompany}
                    onChange={setFilterCompany}
                    placeholder="Tümü"
                    searchPlaceholder="Firma Ara..."
                />
            </div>



            {/* Creator Filter */}
            <div>
                <Label className="text-xs">Oluşturan</Label>
                <MultiSelect
                    options={uniqueCreatorIds.map((id: any) => ({ label: getUserName(id), value: id }))}
                    selected={filterCreator}
                    onChange={setFilterCreator}
                    placeholder="Tümü"
                    searchPlaceholder="Kullanıcı Ara..."
                />
            </div>

            <div className="md:col-span-5 flex justify-end gap-2 mt-2">
                {canExport && (
                    <>
                        <Button variant="outline" size="sm" onClick={exportListPDF} title="Listeyi PDF İndir">
                            <FileText className="h-4 w-4 text-red-600 mr-2" />
                            Listeyi Yazdır (PDF)
                        </Button>
                        <Button variant="outline" size="sm" onClick={exportExcel} title="Listeyi Excel İndir">
                            <FileSpreadsheet className="h-4 w-4 text-green-600 mr-2" />
                            Excel İndir
                        </Button>
                    </>
                )}
            </div>


            {/* Sender/Receiver (Muhatap) Filter */}
            <div>
                <Label className="text-xs">Muhatap</Label>
                <MultiSelect
                    options={uniqueSenderReceivers.map((sr: any) => ({ label: sr as string, value: sr as string }))}
                    selected={filterSenderReceiver}
                    onChange={setFilterSenderReceiver}
                    placeholder="Tümü"
                    searchPlaceholder="Muhatap Ara..."
                />
            </div>

            {/* Search Input - Full Width below */}
            <div className="md:col-span-5 relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    type="search"
                    placeholder="Metin ile ara (Konu, Sayı, vb.)..."
                    className="pl-8 bg-white"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            {/* Missing Registration Number Dialog */}
            <Dialog open={isRegReminderOpen} onOpenChange={setIsRegReminderOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Eksik Evrak Kayıt Numaraları</DialogTitle>
                        <DialogDescription>
                            Aşağıdaki evrakların kayıt numarası eksik. Lütfen ilgili alanları doldurun.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        {missingRegs.map((item) => (
                            <div key={item.id} className="grid grid-cols-[1fr,200px] gap-4 items-center border-b pb-4 last:border-0 last:pb-0">
                                <div>
                                    <div className="font-medium text-sm">{item.subject}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {format(new Date(item.date), 'dd.MM.yyyy')} - Sayı: {item.referenceNumber || '-'}
                                    </div>
                                </div>
                                <Input
                                    placeholder="Kayıt No Giriniz"
                                    value={editRegs[item.id] || ''}
                                    onChange={(e) => setEditRegs({ ...editRegs, [item.id]: e.target.value })}
                                />
                            </div>
                        ))}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsRegReminderOpen(false)}>Kapat</Button>
                        <Button onClick={handleSaveRegs}>Kaydet</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    );

    const renderAddressBook = () => {
        return (
            <div className="space-y-4">
                <div className="flex justify-end">
                    {(user?.role === 'ADMIN' || canCreateContacts) && (
                        <Button onClick={() => openAddressModal()} className="bg-purple-600 hover:bg-purple-700">
                            <Plus className="w-4 h-4 mr-2" /> Yeni Muhatap Ekle
                        </Button>
                    )}
                </div>
                {institutions.length === 0 ? (
                    <div className="text-center py-10 text-slate-500">
                        Henüz kayıtlı muhatap bulunmuyor.
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Muhatap Adı</TableHead>
                                <TableHead>Kategori</TableHead>
                                <TableHead className="w-[100px]">İşlemler</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {institutions.map((inst: any) => (
                                <TableRow key={inst.id}>
                                    <TableCell className="max-w-[400px] truncate" title={inst.name}>{inst.name}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{inst.category === 'BANK' ? 'Banka' : 'Kurum/Şahıs'}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        {(user?.role === 'ADMIN' || canEditContacts) && (
                                            <div className="flex items-center gap-1">
                                                <Button variant="ghost" size="sm" onClick={() => openAddressModal(inst)}>
                                                    <Edit className="w-4 h-4 text-blue-600" />
                                                </Button>
                                                <Button variant="ghost" size="sm" className="text-red-600" onClick={() => {
                                                    if (confirm('Silmek istediğinize emin misiniz?')) deleteInstitution(inst.id);
                                                }}>
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </div>
        );
    };

    const renderTable = (items: typeof correspondences, isBank = false, isIncoming = false) => {
        if (items.length === 0) {
            return (
                <div className="text-center py-10 text-slate-500">
                    Henüz kayıtlı {isBank ? 'banka yazışması' : 'yazışma'} bulunmuyor.
                </div>
            );
        }

        return (
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Belge Tarihi</TableHead>
                        {!isBank && <TableHead>Evrak Sayı No</TableHead>}
                        {!isBank && !isIncoming && <TableHead>Evrak Kayıt No</TableHead>}


                        <TableHead>Firma</TableHead>
                        <TableHead>Konu</TableHead>
                        <TableHead>Muhatap</TableHead>
                        <TableHead>Oluşturan</TableHead>
                        <TableHead className="w-[150px]">İşlemler</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {items.map((item: any) => {
                        // Determine type-specific edit permission
                        let hasEditPermission = false;
                        if (item.type === 'BANK') hasEditPermission = canEditBank;
                        else if (item.direction === 'INCOMING') hasEditPermission = canEditIncoming;
                        else if (item.direction === 'OUTGOING') hasEditPermission = canEditOutgoing;

                        const canEdit = user?.role === 'ADMIN' || hasEditPermission;
                        return (
                            <TableRow key={item.id}>
                                <TableCell>{format(new Date(item.date), 'dd.MM.yyyy HH:mm', { locale: tr })}</TableCell>
                                {!isBank && (
                                    <TableCell className="max-w-[150px]">
                                        {item.referenceNumber ? (
                                            <div className="font-mono text-xs truncate" title={item.referenceNumber}>
                                                {item.referenceNumber}
                                            </div>
                                        ) : (
                                            <span className="text-xs text-slate-400 font-medium">-</span>
                                        )}
                                    </TableCell>
                                )}
                                {!isBank && !isIncoming && (
                                    <TableCell className="max-w-[150px]">
                                        {item.registrationNumber ? (
                                            <div
                                                className="font-mono text-xs text-slate-700 truncate cursor-pointer hover:bg-slate-100 p-1 rounded border border-transparent hover:border-slate-200 transition-all flex items-center justify-between group"
                                                title={`${item.registrationNumber} (Düzenlemek için tıklayın)`}
                                                onClick={() => openRegReminder(item.id)}
                                            >
                                                <span className="truncate">{item.registrationNumber}</span>
                                                <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 text-blue-500 flex-shrink-0 ml-1" />
                                            </div>
                                        ) : (
                                            item.createdByUserId === user?.id ? (
                                                <div
                                                    onClick={() => openRegReminder(item.id)}
                                                    className="text-[10px] text-red-600 font-bold cursor-pointer hover:underline flex items-center gap-1"
                                                >
                                                    <span>Kayıt No Eksik</span>
                                                    <span className="relative flex h-2 w-2">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400 font-medium">-</span>
                                            )
                                        )}
                                    </TableCell>
                                )}


                                <TableCell className="max-w-[150px] truncate" title={getCompanyName(item.companyId)}>
                                    {getCompanyName(item.companyId)}
                                </TableCell>
                                <TableCell className="max-w-[200px]">
                                    <div className="font-medium truncate" title={item.subject}>{item.subject}</div>
                                    {item.attachmentUrls && item.attachmentUrls.length > 0 && (
                                        <div className="flex items-center gap-3 mt-1">
                                            <a
                                                href={item.attachmentUrls[0]}
                                                download={`${item.referenceNumber || 'Evrak'}.pdf`}
                                                className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:underline"
                                                onClick={(e: any) => e.stopPropagation()}
                                                title="Dosyayı İndir"
                                            >
                                                <Download className="w-3 h-3" />
                                                İndir
                                            </a>

                                            <div onClick={(e) => e.stopPropagation()}>
                                                <Dialog>
                                                    <DialogTrigger asChild>
                                                        <button
                                                            className="inline-flex items-center gap-1 text-[10px] text-amber-600 hover:underline cursor-zoom-in"
                                                        >
                                                            <Eye className="w-3 h-3" />
                                                            Ön İzleme
                                                        </button>
                                                    </DialogTrigger>
                                                    <DialogContent className="max-w-[100vw] w-screen h-[95vh] p-0 border-none bg-transparent shadow-none">
                                                        <DialogTitle className="sr-only">PDF Ön İzleme</DialogTitle>
                                                        <div className="h-full w-full bg-white rounded-lg overflow-hidden shadow-2xl">
                                                            <PDFPreview base64={item.attachmentUrls[0]} />
                                                        </div>
                                                    </DialogContent>
                                                </Dialog>
                                            </div>
                                        </div>
                                    )}
                                </TableCell>
                                <TableCell className="max-w-[200px]">
                                    <div className="truncate" title={item.senderReceiver}>
                                        {item.senderReceiver}
                                    </div>
                                </TableCell>
                                <TableCell className="text-sm text-slate-600">
                                    <div className="flex flex-col">
                                        <span>{getUserName(item.createdByUserId)}</span>
                                        <span className="text-[10px] text-muted-foreground">{format(new Date(item.createdAt || item.date), 'dd.MM.yyyy HH:mm')}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1">
                                        <Button variant="ghost" size="sm" onClick={() => handlePrint(item)} title="Yazdır">
                                            <Printer className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => handleDuplicate(item)} title="Çoğalt">
                                            <Copy className="w-4 h-4 text-purple-600" />
                                        </Button>
                                        {canEdit && (
                                            <>
                                                <CorrespondenceForm
                                                    initialData={item}
                                                    customTrigger={
                                                        <Button variant="ghost" size="sm" title="Düzenle">
                                                            <Pencil className="w-4 h-4 text-blue-600" />
                                                        </Button>
                                                    }
                                                />
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => handleDeleteClick(item)}
                                                    title="Sil"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        );
    };

    const renderDeletedTable = () => {
        if (deletedCorrespondences.length === 0) {
            return (
                <div className="text-center py-10 text-slate-500">
                    Silinmiş kayıt bulunmuyor.
                </div>
            );
        }

        return (
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Silinme Tarihi</TableHead>
                        <TableHead>Konu</TableHead>
                        <TableHead>Muhatap</TableHead>
                        <TableHead>Silen Kişi</TableHead>
                        <TableHead>Silme Nedeni</TableHead>
                        <TableHead className="w-[100px]">İşlemler</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {deletedCorrespondences.map((item: any) => (
                        <TableRow key={item.id} className="bg-red-50">
                            <TableCell className="text-red-700 font-medium">
                                {item.deletionDate ? format(new Date(item.deletionDate), 'dd MMM yyyy HH:mm', { locale: tr }) : '-'}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate" title={item.subject}>{item.subject}</TableCell>
                            <TableCell className="max-w-[150px] truncate" title={item.senderReceiver}>{item.senderReceiver}</TableCell>
                            <TableCell>{getUserName(item.deletedByUserId || '')}</TableCell>
                            <TableCell className="italic text-slate-600 max-w-[200px] truncate" title={item.deletionReason}>{item.deletionReason}</TableCell>
                            <TableCell>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200"
                                    onClick={() => handleRestore(item.id)}
                                    title="Geri Al / Kurtar"
                                >
                                    <RotateCcw className="w-4 h-4 mr-2" /> Geri Al
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        );
    };

    return (
        <Card>
            <Tabs defaultValue={getDefaultTab()} className="w-full">
                <CardHeader className="flex flex-col space-y-4">
                    <div className="flex flex-row items-center justify-between">
                        <CardTitle>Yazışma Listesi</CardTitle>
                        {canExport && (
                            <Button variant="outline" size="sm" onClick={handleExport}>
                                <Download className="w-4 h-4 mr-2" /> Excel İndir
                            </Button>
                        )}
                    </div>
                    <TabsList className="grid w-full grid-cols-5">
                        {canViewIncoming && <TabsTrigger value="incoming">Gelen Evraklar</TabsTrigger>}
                        {canViewOutgoing && <TabsTrigger value="outgoing">Giden Evraklar</TabsTrigger>}
                        {canViewBank && <TabsTrigger value="bank">Banka Yazışmaları</TabsTrigger>}
                        {canViewContacts && <TabsTrigger value="muhataplar" className="text-purple-600 data-[state=active]:text-purple-700">Muhataplar</TabsTrigger>}
                        {canViewDeleted && <TabsTrigger value="deleted" className="text-red-500 data-[state=active]:text-red-600">Silinenler</TabsTrigger>}
                    </TabsList>
                </CardHeader>
                <CardContent>
                    <TabsContent value="incoming" className="space-y-4">
                        <div className="flex justify-end">
                            {canCreateIncoming && (
                                <CorrespondenceForm
                                    initialDirection="INCOMING"
                                    customTrigger={
                                        <Button className="bg-green-600 hover:bg-green-700">
                                            <Plus className="w-4 h-4 mr-2" /> Yeni Gelen Evrak
                                        </Button>
                                    }
                                />
                            )}
                        </div>
                        {renderFilters()}
                        {renderTable(incomingItems, false, true)}
                    </TabsContent>

                    <TabsContent value="outgoing" className="space-y-4">
                        <div className="flex justify-end">
                            {canCreateOutgoing && (
                                <CorrespondenceForm
                                    initialDirection="OUTGOING"
                                    customTrigger={
                                        <Button className="bg-blue-600 hover:bg-blue-700">
                                            <Plus className="w-4 h-4 mr-2" /> Yeni Giden Evrak
                                        </Button>
                                    }
                                />
                            )}
                        </div>
                        {renderFilters()}
                        {renderTable(outgoingItems)}
                    </TabsContent>

                    <TabsContent value="bank" className="space-y-4">
                        <div className="flex justify-end">
                            {canCreateBank && (
                                <CorrespondenceForm
                                    initialType="BANK"
                                    customTrigger={
                                        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                                            <Plus className="w-4 h-4 mr-2" /> Yeni Banka Yazışması
                                        </Button>
                                    }
                                />
                            )}
                        </div>
                        {renderFilters()}
                        {renderTable(bankItems, true)}
                    </TabsContent>

                    <TabsContent value="muhataplar" className="space-y-4">
                        {renderAddressBook()}
                    </TabsContent>

                    <TabsContent value="deleted" className="space-y-4">
                        {renderDeletedTable()}
                    </TabsContent>
                </CardContent>
            </Tabs>

            <Dialog open={isReminderOpen} onOpenChange={setIsReminderOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Eksik Evrak Numaraları</DialogTitle>
                        <DialogDescription>
                            Aşağıdaki listede evrak kayıt numarası eksik olan yazışmalar bulunmaktadır. Lütfen numaraları giriniz.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {missingRefs.map((item) => (
                            <div key={item.id} className="grid grid-cols-12 gap-4 items-center border-b pb-2">
                                <div className="col-span-3 text-sm text-muted-foreground">{format(new Date(item.date), 'dd.MM.yyyy')}</div>
                                <div className="col-span-5 text-sm font-medium">{item.subject}</div>
                                <div className="col-span-4">
                                    <Input
                                        placeholder="Evrak No Giriniz"
                                        className="h-8"
                                        value={editRefs[item.id] || ''}
                                        onChange={(e) => setEditRefs(prev => ({ ...prev, [item.id]: e.target.value }))}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsReminderOpen(false)}>Daha Sonra</Button>
                        <Button onClick={handleSaveRefs}>Kaydet</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isAddressModalOpen} onOpenChange={setIsAddressModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editInstId ? 'Muhatap Düzenle' : 'Yeni Muhatap Ekle'}</DialogTitle>
                        <DialogDescription>
                            Bu muhatabın ismini ve PDF çıktısındaki hizalama tercihini düzenleyin.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label>Kategori</Label>
                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    type="button"
                                    variant={editInstCategory === 'INSTITUTION' ? 'default' : 'outline'}
                                    onClick={() => setEditInstCategory('INSTITUTION')}
                                    className="gap-2"
                                >
                                    <Building2 className="w-4 h-4" /> Kurum / Şahıs
                                </Button>
                                <Button
                                    type="button"
                                    variant={editInstCategory === 'BANK' ? 'default' : 'outline'}
                                    onClick={() => setEditInstCategory('BANK')}
                                    className="gap-2"
                                >
                                    <Landmark className="w-4 h-4" /> Banka
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Muhatap Adı (Kurum/Şahıs)</Label>
                            <Textarea
                                value={editInstName}
                                onChange={(e) => setEditInstName(e.target.value)}
                                placeholder="Örn: T.C. Enerji Bakanlığı..."
                                rows={5}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddressModalOpen(false)}>İptal</Button>
                        <Button onClick={handleSaveAddress}>Kaydet</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <AlertTriangle className="w-5 h-5" />
                            Yazışmayı Sil
                        </DialogTitle>
                        <DialogDescription>
                            Bu yazışmayı silmek üzeresiniz. Lütfen silme sebebinizi belirtiniz. Bu işlem geri alınamaz (kayıt arşivlenir).
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-2">
                        <Label>Silme Gerekçesi <span className="text-red-500">*</span></Label>
                        <Input
                            value={deleteReason}
                            onChange={(e) => setDeleteReason(e.target.value)}
                            placeholder="Örn: Hatalı giriş yapıldı..."
                            autoFocus
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>İptal</Button>
                        <Button
                            onClick={confirmDelete}
                            variant="destructive"
                            disabled={!deleteReason.trim()}
                        >
                            Sil
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Missing Registration Number Dialog - Restored */}
            <Dialog open={isRegReminderOpen} onOpenChange={setIsRegReminderOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Eksik Evrak Kayıt Numaraları</DialogTitle>
                        <DialogDescription>
                            Aşağıdaki evrakların kayıt numarası eksik. Lütfen ilgili alanları doldurun.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        {(selectedRegId
                            ? [activeCorrespondences.find((c: any) => c.id === selectedRegId)].filter(Boolean).map((c: any) => ({ id: c!.id, subject: c!.subject, date: c!.date, referenceNumber: c!.referenceNumber }))
                            : missingRegs
                        ).map((item: any) => (
                            <div key={item.id} className="grid grid-cols-[1fr,200px] gap-4 items-center border-b pb-4 last:border-0 last:pb-0">
                                <div>
                                    <div className="font-medium text-sm">{item.subject}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {format(new Date(item.date), 'dd.MM.yyyy')} - Sayı: {item.referenceNumber || '-'}
                                    </div>
                                </div>
                                <Input
                                    placeholder="Kayıt No Giriniz"
                                    value={editRegs[item.id] || ''}
                                    onChange={(e) => setEditRegs({ ...editRegs, [item.id]: e.target.value })}
                                />
                            </div>
                        ))}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsRegReminderOpen(false)}>Kapat</Button>
                        <Button onClick={handleSaveRegs}>Kaydet</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card >
    );
}
