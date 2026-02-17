'use client';

import React, { useState, useRef, useEffect } from 'react';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Upload, Calendar, XCircle, CheckCircle2, Plus, Trash2, FileSpreadsheet, FileText, Save, Eye, History, Share2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { saveCalculation, getCalculations, deleteCalculation, getBusinessGroups, addBusinessGroup, deleteBusinessGroup } from '@/actions/limit-value';
import { getCompanies } from '@/actions/company';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { addTurkishFont } from '@/lib/pdf-font';

// Types for our calculation
interface Bidder {
    name: string;
    amount: number;
    submitTime?: string; // Teklif veriliş zamanı
    isValid: boolean; // Geçerli/Geçersiz
    isAboveLimit?: boolean; // Sınır değerin üzerinde mi?
    discountRatio?: number; // Tenzilat Oranı
    exclusionReason?: string; // Elenme Sebebi (Varsa)
    hasTaxDebt?: boolean;
    hasSgkDebt?: boolean;
}

interface TenderMetadata {
    administrationName?: string;
    tenderRegisterNo?: string;
    tenderName?: string;
    tenderDate?: string;
    openingDate?: string; // Tekliflerin açıldığı tarih
    minutesDate?: string; // Tutanağın düzenlendiği tarih
}

interface CalculationResult {
    limitValue: number;
    mean: number;
    mean1: number; // Kullanırız veya tort1 kullanırız
    stdDev: number;
    mean2: number;
    cValue: number;
    kValue: number;
    nCoefficient: number;
    cost: number;
    // User specific display fields
    validityLow: number;  // Ortalama-1
    validityHigh: number; // Ortalama-2
    tort1: number;        // Alt Sınır
    tort2: number;        // Üst Sınır
    sigmaLower: number;   // Standart Sapma (Alt)
    sigmaUpper: number;   // Standart Sapma (Üst)
    likelyWinner: string; // Muhtemel Kazanan
    businessGroup?: string;
    hasManualEdits?: boolean;
}



export function LimitValueCalculation() {
    const [file, setFile] = useState<File | null>(null);
    const [isParsing, setIsParsing] = useState(false);
    const [isSaving, setIsSaving] = useState(false); // Moved here
    const [bidders, setBidders] = useState<Bidder[]>([]);
    const [approxCost, setApproxCost] = useState<number>(0);
    const [nCoefficient, setNCoefficient] = useState<string>('1.00');
    const [result, setResult] = useState<CalculationResult | null>(null);
    const [metadata, setMetadata] = useState<TenderMetadata>({});
    const [businessGroup, setBusinessGroup] = useState<string>('');
    const [rawText, setRawText] = useState<string>('');

    // Dynamic Business Groups
    const [groups, setGroups] = useState<{ id: string, name: string }[]>([]);
    const [myCompanies, setMyCompanies] = useState<{ name: string, shortName?: string | null }[]>([]);
    const [isLoadingGroups, setIsLoadingGroups] = useState(false);
    const [hasManualEdits, setHasManualEdits] = useState(false);
    const pendingAutoSaveRef = useRef(false); // Flag to trigger auto-save after file analysis
    const [isAutoSaved, setIsAutoSaved] = useState(false); // Prevent duplicate auto-saves

    // Editable State
    const [editingCell, setEditingCell] = useState<{ index: number, field: string } | null>(null);

    // New Bidder Modal State
    const [isAddBidderOpen, setIsAddBidderOpen] = useState(false);
    const [newBidderName, setNewBidderName] = useState('');
    const [newBidderAmount, setNewBidderAmount] = useState('');
    const [newBidderTime, setNewBidderTime] = useState('');

    // History & Tabs
    const [activeTab, setActiveTab] = useState('calculation');
    const [history, setHistory] = useState<any[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    // Filters State
    const [historyFilters, setHistoryFilters] = useState({
        registerNo: '',
        date: '',
        group: '',
        name: '',
        cost: '',
        limit: '',
        winner: '',
        amount: '',
        discount: ''
    });

    // Missing state from previous edit (Removed)

    // Initial Load
    React.useEffect(() => {
        loadHistory();
        loadGroups();
        loadMyCompanies();
    }, []);

    const loadMyCompanies = async () => {
        const res = await getCompanies();
        if (res.success && res.data) {
            setMyCompanies(res.data);
        }
    };

    const loadGroups = async () => {
        setIsLoadingGroups(true);
        const res = await getBusinessGroups();
        if (res.success && res.data) {
            setGroups(res.data);
        }
        setIsLoadingGroups(false);
    };

    const handleAddGroup = async (name: string) => {
        const res = await addBusinessGroup(name);
        if (res.success) {
            toast.success('İş grubu eklendi.');
            loadGroups();
            return true;
        } else {
            toast.error(res.error);
            return false;
        }
    };

    const handleRemoveGroup = async (id: string) => {
        if (!confirm('Bu grubu silmek istediğinize emin misiniz?')) return;
        const res = await deleteBusinessGroup(id);
        if (res.success) {
            toast.success('İş grubu silindi.');
            loadGroups();
        } else {
            toast.error(res.error);
        }
    };

    const loadHistory = async () => {
        setIsLoadingHistory(true);
        const res = await getCalculations();
        if (res.success && res.data) {
            setHistory(res.data);
        }
        setIsLoadingHistory(false);
    };

    // "Farklı Kaydet" - Manual save with hasManualEdits = true
    const handleSaveCalculation = async () => {
        if (!result || bidders.length === 0) {
            toast.error('Kaydedilecek veri bulunamadı. Lütfen önce hesaplama yapın.');
            return;
        }

        if (!businessGroup) {
            toast.error('Lütfen bir İş Grubu seçiniz. (Zorunlu)');
            return;
        }

        // "Farklı Kaydet" always means manual edit
        setHasManualEdits(true);

        const toastId = toast.loading('Hesaplama kaydediliyor...');

        // Parse date from DD.MM.YYYY to Date object
        let parsedDate: Date | undefined = undefined;
        if (metadata.tenderDate) {
            const parts = metadata.tenderDate.split('.');
            if (parts.length === 3) {
                // new Date(year, monthIndex, day)
                const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                if (!isNaN(d.getTime())) {
                    parsedDate = d;
                }
            }
        }

        const saveData = {
            tenderName: metadata.tenderName,
            tenderRegisterNo: metadata.tenderRegisterNo,
            administration: metadata.administrationName,
            tenderDate: parsedDate,
            approxCost: approxCost,
            nCoefficient: parseFloat(nCoefficient),
            limitValue: result.limitValue,
            likelyWinner: result.likelyWinner,
            likelyWinnerDiscount: result.likelyWinner ? bidders.find(b => b.name === result.likelyWinner)?.discountRatio : undefined,
            fullResultData: {
                bidders,
                result,
                metadata,
                approxCost,
                businessGroup, // Save for reload
                hasManualEdits: true // Always true for "Farklı Kaydet"
            },
            hasManualEdits: true // Always true for "Farklı Kaydet"
        };

        const res = await saveCalculation({
            ...saveData,
            businessGroup // Add to root level for DB
        });

        if (res.success) {
            toast.success('Hesaplama başarıyla kaydedildi. (Farklı Kaydet)', { id: toastId });
            loadHistory(); // Refresh list
        } else {
            toast.error('Kayıt başarısız: ' + res.error, { id: toastId });
        }
    };

    // Auto-save after file analysis (no businessGroup required)
    const autoSaveCalculation = async (currentResult: CalculationResult, currentBidders: Bidder[], currentMetadata: TenderMetadata, currentApproxCost: number) => {
        // Parse date from DD.MM.YYYY to Date object
        let parsedDate: Date | undefined = undefined;
        if (currentMetadata.tenderDate) {
            const parts = currentMetadata.tenderDate.split('.');
            if (parts.length === 3) {
                const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                if (!isNaN(d.getTime())) {
                    parsedDate = d;
                }
            }
        }

        const saveData = {
            tenderName: currentMetadata.tenderName,
            tenderRegisterNo: currentMetadata.tenderRegisterNo,
            administration: currentMetadata.administrationName,
            tenderDate: parsedDate,
            approxCost: currentApproxCost,
            nCoefficient: parseFloat(nCoefficient),
            limitValue: currentResult.limitValue,
            likelyWinner: currentResult.likelyWinner,
            likelyWinnerDiscount: currentResult.likelyWinner ? currentBidders.find(b => b.name === currentResult.likelyWinner)?.discountRatio : undefined,
            fullResultData: {
                bidders: currentBidders,
                result: currentResult,
                metadata: currentMetadata,
                approxCost: currentApproxCost,
                businessGroup: businessGroup || '', // May be empty for auto-save
                hasManualEdits: false
            },
            hasManualEdits: false,
            businessGroup: businessGroup || '' // May be empty for auto-save
        };

        try {
            const res = await saveCalculation(saveData);
            if (res.success) {
                toast.success('Analiz otomatik olarak geçmiş ihalelere kaydedildi.', { duration: 3000 });
                setIsAutoSaved(true);
                loadHistory(); // Refresh list
            } else {
                console.error('Otomatik kayıt başarısız:', res.error);
            }
        } catch (error) {
            console.error('Otomatik kayıt hatası:', error);
        }
    };

    // Auto-save effect: triggers when result changes from file parsing
    useEffect(() => {
        if (pendingAutoSaveRef.current && result && bidders.length > 0) {
            pendingAutoSaveRef.current = false;
            autoSaveCalculation(result, bidders, metadata, approxCost);
        }
    }, [result]);

    const handleLoadHistory = (record: any) => {
        const data = record.fullResultData;
        if (!data) return;

        setBidders(data.bidders || []);
        setResult(data.result || null);
        setMetadata(data.metadata || {});
        setApproxCost(data.approxCost || 0);
        setHasManualEdits(data.hasManualEdits || false);

        // nCoefficient is string in state, but number in history
        if (data.result?.nCoefficient) {
            setNCoefficient(data.result.nCoefficient.toString());
        }
        if (data.businessGroup) {
            setBusinessGroup(data.businessGroup);
        } else {
            setBusinessGroup('');
        }

        setActiveTab('calculation');
        toast.success('Geçmiş hesaplama yüklendi.');
    };

    const handleDeleteHistory = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Bu kaydı silmek istediğinize emin misiniz?')) return;

        const res = await deleteCalculation(id);
        if (res.success) {
            toast.success('Kayıt silindi.');
            loadHistory();
        } else {
            toast.error('Silme başarısız.');
        }
    };

    // --- Editing Logic ---
    const handleBidderEdit = (index: number, field: string, value: string) => {
        if (field === 'amount') {
            // Remove TL, spaces, etc.
            let raw = value.replace(/[^0-9,.]/g, '');

            // Unified Logic with parseTurkishMoney strategy
            if (raw.includes(',')) {
                raw = raw.replace(/\./g, '').replace(',', '.');
            } else if (raw.includes('.')) {
                const parts = raw.split('.');
                const lastPart = parts[parts.length - 1];
                // If last part is 1 or 2 digits, assume decimal
                if (lastPart.length === 1 || lastPart.length === 2) {
                    const integerPart = parts.slice(0, -1).join('');
                    raw = `${integerPart}.${lastPart}`;
                } else {
                    raw = raw.replace(/\./g, '');
                }
            }

            const numVal = parseFloat(raw);

            if (isNaN(numVal)) {
                // setEditingCell(null); // Optional: keep editing if invalid?
                return;
            }

            const newBidders = [...bidders];
            newBidders[index] = {
                ...newBidders[index],
                amount: numVal,
                // Mark as manually edited if it wasn't before
                // We don't have a per-row manual edit flag in Bidder, but we set global hasManualEdits
            };

            // Re-sort? Maybe not while editing to prevent jumping
            // But user might want to see effect immediately. 
            // Better to re-sort on save or blur. Function runs on blur/enter.
            newBidders.sort((a, b) => a.amount - b.amount);

            setBidders(newBidders);
            setHasManualEdits(true); // Flag global change

            // Recalculate immediately
            if (newBidders.length > 0) {
                // Cost might need update? No, approx cost is separate.
                calculateResults(approxCost, newBidders, nCoefficient);
            }

            setEditingCell(null);
        } else {
            // ... name edit etc ...
        }
    };

    // --- File Handling ---
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setFile(file); // Set file state for potential re-parsing

            const reader = new FileReader();

            if (file.name.endsWith('.docx')) {
                toast.info("Word dosyası işleniyor...");
                reader.onload = async (event) => {
                    const arrayBuffer = event.target?.result as ArrayBuffer;
                    if (!arrayBuffer) return;

                    try {
                        const result = await mammoth.extractRawText({ arrayBuffer });
                        const text = result.value;
                        console.log("Raw Word Text:", text); // Debug
                        parseTextContent(text);
                        pendingAutoSaveRef.current = true; // Trigger auto-save after state update
                        setIsAutoSaved(false);
                        toast.success('Dosya başarıyla analiz edildi.');
                    } catch (err) {
                        console.error(err);
                        toast.error("Word dosyası okunamadı.");
                    } finally {
                        setIsParsing(false);
                    }
                };
                reader.readAsArrayBuffer(file);
            } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                toast.info("Excel dosyası işleniyor...");
                reader.onload = (event) => {
                    const data = new Uint8Array(event.target?.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
                    console.log("Excel Data:", jsonData); // Debug

                    // Simple text conversion for now
                    const text = jsonData.map((row: any) => row.join(' ')).join('\n');
                    parseTextContent(text);
                    pendingAutoSaveRef.current = true; // Trigger auto-save after state update
                    setIsAutoSaved(false);
                    toast.success('Dosya başarıyla analiz edildi.');
                };
                reader.readAsArrayBuffer(file);
            } else {
                toast.error("Desteklenmeyen dosya formatı. (.docx veya .xlsx kullanın)");
                setFile(null); // Clear file if unsupported
            }
        }
    };

    const parseWordDocument = async () => {
        // This function is now largely redundant as handleFileChange handles parsing directly.
        // It might be called if `file` state is set manually and then this is triggered.
        // For now, keep it as a fallback or if there's a separate "Parse" button.
        if (!file) {
            toast.error('Lütfen önce bir dosya seçiniz.');
            return;
        }

        // If file is already set, and it's a docx, re-parse it.
        if (file.name.endsWith('.docx')) {
            setIsParsing(true);
            setBidders([]);
            setMetadata({});
            setResult(null);

            try {
                const arrayBuffer = await file.arrayBuffer();
                const result = await mammoth.extractRawText({ arrayBuffer });
                const text = result.value;

                parseTextContent(text);

                toast.success('Dosya başarıyla analiz edildi.');
            } catch (error) {
                console.error(error);
                toast.error('Dosya okunurken bir hata oluştu.');
            } finally {
                setIsParsing(false);
            }
        } else {
            toast.error('Bu fonksiyon sadece Word dosyalarını işler. Lütfen "Dosya Seç" butonunu kullanın.');
        }
    };

    // --- Parsing Logic ---
    const parseTextContent = (text: string) => {
        const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        setRawText(cleanText); // Save for debugging

        const lines = cleanText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

        console.log("Parsing extract sample:", lines.slice(0, 10));

        let foundCost = 0;
        const foundBidders: Bidder[] = [];
        const meta: TenderMetadata = {};

        // Helper Regex Patterns
        const patterns = {
            moneyStart: /^([\d\.,]+)\s*(?:TRY|TL)/i, // Capture generalized number format at start
            moneyAny: /([\d\.,]+)\s*(?:TRY|TL)/i, // Capture generalized number format anywhere
            date: /\d{2}\.\d{2}\.\d{4}/,
            dateTimeExtract: /(.+?)\s*-\s*(\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2})/,
            statusKeywords: /yasaklı|uygun|kontrol|geçersiz|elendi|teminat|borcu/i
        };

        const parseTurkishMoney = (str: string): number => {
            // Remove everything except digits, dots, commas
            let clean = str.replace(/[^0-9.,]/g, '');

            if (clean.includes(',')) {
                clean = clean.replace(/\./g, '').replace(',', '.');
            } else if (clean.includes('.')) {
                const parts = clean.split('.');
                const lastPart = parts[parts.length - 1];

                if (lastPart.length === 2) {
                    const integerPart = parts.slice(0, -1).join('');
                    clean = `${integerPart}.${lastPart}`;
                } else {
                    clean = clean.replace(/\./g, '');
                }
            }

            return parseFloat(clean);
        };

        // --- Phase 1: Pre-scan for table column structure ---
        // KIK documents have tables where column headers (e.g. "Vergi Borcu", "SGK Borcu")
        // are in the header row, and data cells contain "Vardır"/"Yoktur".
        // Mammoth linearizes tables: each cell becomes a line.
        // We find "Teklif Bedeli" header line, then count offset to "Vergi Borcu" and "SGK Borcu" headers.
        let taxDebtColOffset = -1;
        let sgkDebtColOffset = -1;

        for (let i = 0; i < lines.length; i++) {
            const lineLower = lines[i].toLowerCase();
            if (lineLower.includes('teklif bedeli') || lineLower.includes('teklif tutarı') || lineLower.includes('teklif fiyatı')) {
                // Found the amount column header, scan forward for debt headers (within 20 lines)
                for (let j = i + 1; j < Math.min(i + 20, lines.length); j++) {
                    const headerLine = lines[j].toLowerCase();
                    if (taxDebtColOffset < 0 && (headerLine.includes('vergi borcu') || headerLine.includes('vergi borç'))) {
                        taxDebtColOffset = j - i;
                    }
                    if (sgkDebtColOffset < 0 && (headerLine.includes('sgk borcu') || headerLine.includes('sosyal güvenlik') || headerLine.includes('sigorta prim'))) {
                        sgkDebtColOffset = j - i;
                    }
                    // Stop if we hit a money pattern (data row started) or a known non-header
                    if (headerLine.match(/^[\d\.,]+\s*(?:try|tl)/i)) break;
                }
                if (taxDebtColOffset > 0 || sgkDebtColOffset > 0) break;
            }
        }

        console.log("Debt column offsets - Tax:", taxDebtColOffset, "SGK:", sgkDebtColOffset);

        // Helper to check if a cell value indicates debt exists
        const cellIndicatesDebt = (cellValue: string): boolean => {
            const v = cellValue.toLowerCase().trim();
            return v === 'vardır' || v === 'var' || v.includes('borcu var') || v.includes('borcu mevcut');
        };

        // --- Phase 2: Iterative Parsing ---
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const nextLine = lines[i + 1] || '';
            const prevLine = lines[i - 1] || '';

            // --- 1. Metadata Extraction ---
            const getValue = (currentLine: string, nextLine: string): string => {
                let val = '';
                if (currentLine.includes(':')) {
                    val = currentLine.split(':')[1].trim();
                } else if (nextLine.trim().startsWith(':')) {
                    val = nextLine.replace(/^:\s*/, '').trim();
                } else {
                    val = nextLine.trim();
                }
                return val;
            };

            if (!meta.tenderRegisterNo && (line.includes('İhale Kayıt Numarası') || line.includes('İKN'))) {
                meta.tenderRegisterNo = getValue(line, nextLine);
            }
            if (!meta.administrationName && (line.includes('İdarenin Adı') || line.includes('Kurum Adı'))) {
                const val = getValue(line, nextLine);
                if (val && val !== ':') meta.administrationName = val;
            }
            if (!meta.tenderName && (line.includes('İhalenin Adı') || line.includes('İşin Adı'))) {
                const val = getValue(line, nextLine);
                if (val && val !== ':') meta.tenderName = val;
            }
            if (!meta.tenderDate && (line.includes('İhale Tarih') && !line.includes('Açıldığı'))) {
                const val = getValue(line, nextLine);
                if (val && val !== ':') meta.tenderDate = val;
            }
            if (!meta.openingDate && line.includes('Tekliflerin Açıldığı Tarih')) {
                const val = getValue(line, nextLine);
                if (val && val !== ':') meta.openingDate = val;
            }

            // --- 2. Approximate Cost ---
            if (line.toLowerCase().includes('yaklaşık maliyet')) {
                let match = line.match(patterns.moneyAny);
                if (match) {
                    foundCost = parseTurkishMoney(match[1]);
                } else {
                    match = nextLine.match(patterns.moneyAny);
                    if (match) {
                        foundCost = parseTurkishMoney(match[1]);
                    }
                }
            }

            // --- 3. Bidder Extraction ---
            const moneyMatch = line.match(patterns.moneyStart);
            if (moneyMatch) {
                const amount = parseTurkishMoney(moneyMatch[1]);

                if (foundCost > 0 && Math.abs(amount - foundCost) < 1) continue;
                if (prevLine.toLowerCase().includes('yaklaşık maliyet')) continue;

                let name = prevLine.trim().toLocaleUpperCase('tr-TR'); // Tender docs always use uppercase names
                let submitTime: string | undefined = undefined;

                // Try to extract Name and Time
                const nameTimeMatch = name.match(patterns.dateTimeExtract);
                if (nameTimeMatch) {
                    name = nameTimeMatch[1].trim();
                    submitTime = nameTimeMatch[2].trim();
                }

                if (name && name.length > 2 && !name.match(/^(?:Tarih|Saat|Maliyet)/i)) {
                    let isInvalid = false;
                    let exclusionReason = '';
                    let hasTaxDebt = false;
                    let hasSgkDebt = false;

                    const lookAhead = [line, nextLine, lines[i + 2] || '', lines[i + 3] || '', lines[i + 4] || '', lines[i + 5] || ''].join(' ').toLowerCase();

                    if (lookAhead.includes('yasaklı') && !lookAhead.includes('yasaklı değil')) {
                        isInvalid = true;
                        exclusionReason = 'Yasaklı';
                    } else if (lookAhead.includes('geçersiz')) {
                        isInvalid = true;
                        exclusionReason = 'Geçersiz Teklif';
                    } else if (lookAhead.includes('elendi')) {
                        isInvalid = true;
                        exclusionReason = 'Elendi';
                    } else if (lookAhead.includes('uygun değil')) {
                        isInvalid = true;
                        exclusionReason = 'Uygun Değil';
                    }

                    // --- Debt detection via column offsets ---
                    // Method 1: Use pre-scanned column offsets from table headers
                    if (taxDebtColOffset > 0 && (i + taxDebtColOffset) < lines.length) {
                        const cellValue = lines[i + taxDebtColOffset];
                        console.log(`[Debt Check] ${name} | Tax col offset: ${taxDebtColOffset} | Cell value: "${cellValue}"`);
                        if (cellIndicatesDebt(cellValue)) {
                            hasTaxDebt = true;
                        }
                    }
                    if (sgkDebtColOffset > 0 && (i + sgkDebtColOffset) < lines.length) {
                        const cellValue = lines[i + sgkDebtColOffset];
                        console.log(`[Debt Check] ${name} | SGK col offset: ${sgkDebtColOffset} | Cell value: "${cellValue}"`);
                        if (cellIndicatesDebt(cellValue)) {
                            hasSgkDebt = true;
                        }
                    }

                    // Method 2: Fallback - look for explicit inline text mentions
                    if (!hasTaxDebt && lookAhead.includes('vergi borcu') && !lookAhead.includes('vergi borcu yok') && !lookAhead.includes('vergi borcu bulunmam')) {
                        hasTaxDebt = true;
                    }
                    if (!hasSgkDebt && (lookAhead.includes('sgk borcu') || lookAhead.includes('sosyal güvenlik borcu') || lookAhead.includes('sigorta borcu')) && !lookAhead.includes('sgk borcu yok') && !lookAhead.includes('sgk borcu bulunmam') && !lookAhead.includes('sosyal güvenlik borcu yok') && !lookAhead.includes('sigorta borcu yok')) {
                        hasSgkDebt = true;
                    }

                    const exists = foundBidders.some(b => b.name === name && b.amount === amount);

                    if (!exists && amount > 100) {
                        foundBidders.push({
                            name,
                            amount,
                            submitTime,
                            isValid: !isInvalid,
                            exclusionReason: isInvalid ? exclusionReason : undefined,
                            hasTaxDebt,
                            hasSgkDebt
                        });
                    }
                }
            }
        }

        setMetadata(meta);
        if (foundCost > 0) setApproxCost(foundCost);

        foundBidders.sort((a, b) => a.amount - b.amount);
        setBidders(foundBidders);

        if (foundCost > 0 && foundBidders.length > 0) {
            calculateResults(foundCost, foundBidders, nCoefficient);
        }
    };

    // KİK Yuvarlama Fonksiyonu (Genelde parasal değerler 2 hane)
    const kikRound = (num: number, decimals: number = 2): number => {
        const factor = Math.pow(10, decimals);
        return Math.round((num + Number.EPSILON) * factor) / factor;
    };

    const calculateResults = (cost: number, currentBidders: Bidder[], nVal: string) => {
        const N = parseFloat(nVal);

        const limitLow = cost * 0.40;
        const limitHigh = cost * 1.20;

        // Validity Checks for display
        const validityLow = kikRound(limitLow);
        const validityHigh = kikRound(limitHigh);

        const gecerliBidders = currentBidders.filter(b => b.isValid && b.amount > limitLow && b.amount < limitHigh);

        if (gecerliBidders.length === 0) {
            const SD = kikRound(cost * 0.40);
            updateBiddersWithLimit(currentBidders, SD, cost);
            setResult({
                limitValue: SD,
                mean: 0,
                mean1: 0,
                stdDev: 0,
                mean2: 0,
                cValue: 0,
                kValue: 0,
                nCoefficient: N,
                cost,
                validityLow,
                validityHigh,
                tort1: 0,
                tort2: 0,
                sigmaLower: 0,
                sigmaUpper: 0,
                likelyWinner: '-'
            });
            return;
        }

        const gecerliAmounts = gecerliBidders.map(b => b.amount);
        const n = gecerliAmounts.length;

        let Tort1 = 0;
        if (n === 1) {
            const SD = kikRound(gecerliAmounts[0] * N);
            updateBiddersWithLimit(currentBidders, SD, cost);

            // Find winner
            const winner = currentBidders.find(b => b.isValid && b.amount >= SD);

            setResult({
                limitValue: SD,
                mean: gecerliAmounts[0],
                mean1: gecerliAmounts[0],
                stdDev: 0,
                mean2: gecerliAmounts[0],
                cValue: gecerliAmounts[0] / cost,
                kValue: 0,
                nCoefficient: N,
                cost,
                validityLow,
                validityHigh,
                tort1: gecerliAmounts[0],
                tort2: gecerliAmounts[0],
                sigmaLower: 0,
                sigmaUpper: 0,
                likelyWinner: winner ? winner.name : '-'
            });
            return;
        }

        // ADIM 1: Tort1 (Aritmetik Ortalama) - 2 Hane Yuvarla
        Tort1 = kikRound(gecerliAmounts.reduce((a, b) => a + b, 0) / n);

        // ADIM 2: Standart Sapma - 2 Hane Yuvarla
        const toplamKareFark = gecerliAmounts.reduce((sum, t) => sum + Math.pow(t - Tort1, 2), 0);
        const Sigma = kikRound(Math.sqrt(toplamKareFark / (n - 1)));

        // ADIM 3: Tort2
        const sigmaLower = kikRound(Tort1 - Sigma); // Limitleri de yuvarlayalım
        const sigmaUpper = kikRound(Tort1 + Sigma);

        const ikinciGrup = gecerliAmounts.filter(t => t >= sigmaLower && t <= sigmaUpper);
        const Tort2 = ikinciGrup.length > 0
            ? kikRound(ikinciGrup.reduce((a, b) => a + b, 0) / ikinciGrup.length)
            : Tort1;

        // ADIM 4: C ve K
        // C değerini 3 haneye yuvarla
        const C = kikRound(Tort2 / cost, 3);

        let K = 0;
        if (C < 0.60) {
            K = C + 0.60;
        } else if (C >= 0.60 && C <= 1.00) {
            K = (3.2 * C - Math.pow(C, 2) - 0.60) / (C + 1);
        } else {
            // C > 1.00
            // Continuity check: At C=1, Previous formula gives (3.2-1-0.6)/2 = 0.8
            // User's Py: (C^2 - 0.8C + 1.4) / (C+1). At C=1: (1-0.8+1.4)/2 = 0.8. Matches.
            K = (Math.pow(C, 2) - 0.8 * C + 1.4) / (C + 1);
        }

        // K değerini de 3 haneye yuvarla
        K = kikRound(K, 3);

        // SONUÇ: Kullanıcının özel isteği üzerine formül: (Tort2 * K) / (C * N)
        // C ve K değerleri yuvarlanmış haliyle kullanılacak.
        const SD_Simplified = kikRound((Tort2 * K) / (C * N)); // Sonucu yuvarla

        updateBiddersWithLimit(currentBidders, SD_Simplified, cost);

        // Muhtemel Kazanan: Sınır değerin üzerinde veya eşit olan en düşük teklif (Makul)
        const validAndReasonable = currentBidders
            .filter(b => b.isValid && b.amount >= SD_Simplified)
            .sort((a, b) => a.amount - b.amount);

        const likelyWinner = validAndReasonable.length > 0 ? validAndReasonable[0].name : 'Bulunamadı';

        setResult({
            limitValue: SD_Simplified,
            mean: Tort1,
            mean1: Tort1,
            stdDev: Sigma,
            mean2: Tort2,
            cValue: C, // Ekranda fixed göstereceğiz
            kValue: K,
            nCoefficient: N,
            cost,
            validityLow,
            validityHigh,
            tort1: Tort1,
            tort2: Tort2,
            sigmaLower,
            sigmaUpper,
            likelyWinner,
            businessGroup
        });
    };

    const updateBiddersWithLimit = (allBidders: Bidder[], limitVal: number, cost: number) => {
        const updated = allBidders.map(b => ({
            ...b,
            discountRatio: ((cost - b.amount) / cost) * 100,
            isAboveLimit: b.isValid ? b.amount >= limitVal : false
        }));

        // Sort again just in case
        updated.sort((a, b) => a.amount - b.amount);
        setBidders(updated);
    };

    // --- Action Handlers ---
    const handleAddNewBidder = () => {
        if (!newBidderName || !newBidderAmount) {
            toast.error('Lütfen firma adı ve tutar giriniz.');
            return;
        }

        const amount = parseFloat(newBidderAmount);
        if (isNaN(amount) || amount <= 0) {
            toast.error('Geçersiz tutar.');
            return;
        }

        const newBidder: Bidder = {
            name: newBidderName,
            amount: amount,
            submitTime: newBidderTime || undefined,
            isValid: true, // Varsayılan geçerli
        };

        const updatedList = [...bidders, newBidder];
        calculateResults(approxCost, updatedList, nCoefficient);

        setIsAddBidderOpen(false);
        setNewBidderName('');
        setNewBidderAmount('');
        setNewBidderTime('');
        toast.success('Yeni katılımcı eklendi ve hesaplama güncellendi.');
    };

    const handleRemoveBidder = (index: number) => {
        const updatedBidders = bidders.filter((_, i) => i !== index);
        setBidders(updatedBidders);

        if (updatedBidders.length > 0) {
            calculateResults(approxCost, updatedBidders, nCoefficient);
        } else {
            setResult(null);
        }
        toast.success('Katılımcı silindi ve hesaplama güncellendi.');
    };

    const exportToExcel = (data: any = null) => {
        // Use provided data or fallback to state
        const targetBidders = data?.bidders || bidders;
        const targetResult = data?.result || result;
        const targetMetadata = data?.metadata || metadata;
        const targetApproxCost = data?.approxCost || approxCost;

        if (targetBidders.length === 0 || !targetResult) return;

        // 1. Prepare Summary Data
        const summaryRows = [
            ["İHALE BİLGİLERİ VE HESAPLAMA SONUÇLARI"],
            ["İdare Adı", targetMetadata.administrationName || "-"],
            ["İşin Adı", targetMetadata.tenderName || "-"],
            ["İhale Kayıt No (İKN)", targetMetadata.tenderRegisterNo || "-"],
            ["İhale Tarihi", targetMetadata.tenderDate ? new Date(targetMetadata.tenderDate).toLocaleDateString("tr-TR") : "-"],
            ["Teklif Açma Tarihi", targetMetadata.openingDate || "-"],
            [],
            ["HESAPLAMA PARAMETRELERİ"],
            ["Yaklaşık Maliyet", targetApproxCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + " TL"],
            ["N Katsayısı", targetResult?.nCoefficient?.toFixed(2) || "-"],
            [],
            ["ARA DEĞERLER"],
            ["Ortalama-1 (Aritmetik)", targetResult?.mean1.toLocaleString('tr-TR', { minimumFractionDigits: 2 })],
            ["Ortalama-2 (Makul)", targetResult?.mean2.toLocaleString('tr-TR', { minimumFractionDigits: 2 })],
            ["Alt Sınır (T1)", targetResult?.tort1.toLocaleString('tr-TR', { minimumFractionDigits: 2 })],
            ["Üst Sınır (T2)", targetResult?.tort2.toLocaleString('tr-TR', { minimumFractionDigits: 2 })],
            ["Standart Sapma (σ)", targetResult?.stdDev.toLocaleString('tr-TR', { minimumFractionDigits: 2 })],
            ["Standart Sapma Alt", targetResult?.sigmaLower.toLocaleString('tr-TR', { minimumFractionDigits: 2 })],
            ["Standart Sapma Üst", targetResult?.sigmaUpper.toLocaleString('tr-TR', { minimumFractionDigits: 2 })],
            ["C Değeri", targetResult?.cValue.toFixed(3)],
            ["K Değeri", targetResult?.kValue.toFixed(3)],
            [],
            ["SONUÇ"],
            ["Sınır Değer", targetResult?.limitValue.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + " TL"],
            ["Muhtemel Kazanan", targetResult?.likelyWinner || "-"],
            [],
            ["KATILIMCI LİSTESİ"]
        ];

        // 2. Prepare Bidders Data
        const headers = ['Sıra No', 'Firma Adı', 'Teklif Tutarı', 'Tarih ve Saat', 'Tenzilat (%)', 'Durum'];
        const bidderRows = targetBidders.map((b: any, i: number) => [
            i + 1,
            b.name,
            b.amount, // Keep as number for Excel formatting if possible
            b.submitTime || '-',
            b.discountRatio?.toFixed(2),
            b.isValid ? (b.isAboveLimit ? (i === targetBidders.findIndex((x: any) => x.isValid && x.isAboveLimit) ? 'İlk Makul Teklif' : '') : 'Sınır Altı') : (b.exclusionReason || 'Geçersiz')
        ]);

        // 3. Combine
        const wsData = [...summaryRows, headers, ...bidderRows];
        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // Adjust column widths visually
        ws['!cols'] = [{ wch: 25 }, { wch: 50 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 15 }];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Sınır Değer Analizi");
        const fileName = `Sinir_Deger__${targetMetadata.tenderRegisterNo || 'Analiz'}.xlsx`;
        XLSX.writeFile(wb, fileName);
        toast.success("Excel dosyası indirildi.");
    };

    const generatePDFDoc = (data: any = null) => {
        const targetBidders = data?.bidders || bidders;
        const targetResult = data?.result || result;
        const targetMetadata = data?.metadata || metadata;
        const targetApproxCost = data?.approxCost || approxCost;
        const targetGroup = data?.businessGroup || businessGroup;

        if (targetBidders.length === 0) return null;

        const doc = new jsPDF();

        // Add Custom Font with Identity-H encoding for Turkish characters
        const fontName = addTurkishFont(doc);
        doc.setFont(fontName);

        doc.setFontSize(14);
        doc.text("Sınır Değer Analiz Raporu", 14, 15);

        let currentY = 25;

        if (targetResult) {
            // Summary Table
            const summaryBody = [
                ['İdare Adı', targetMetadata.administrationName || '-'],
                ['İşin Adı / İKN', `${targetMetadata.tenderName || ''} / ${targetMetadata.tenderRegisterNo || ''}`],
                ['İhale Tarihi', targetMetadata.tenderDate ? new Date(targetMetadata.tenderDate).toLocaleDateString("tr-TR") : '-'],
                ['İş Grubu', targetGroup || '-'],
                ['Yaklaşık Maliyet', `${targetApproxCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL`],
                ['Sınır Değer', `${targetResult.limitValue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL`],
                ['N Katsayısı', typeof targetResult.nCoefficient === 'number' ? targetResult.nCoefficient.toFixed(2) : targetResult.nCoefficient],
                ['Muhtemel Kazanan', targetResult.likelyWinner]
            ];

            autoTable(doc, {
                head: [['Parametre', 'Değer']],
                body: summaryBody,
                startY: currentY,
                styles: { font: fontName, fontSize: 9 },
                headStyles: { fillColor: [41, 128, 185] },
                columnStyles: { 0: { fontStyle: 'bold', cellWidth: 80 } },
                theme: 'grid'
            });

            // @ts-ignore
            currentY = doc.lastAutoTable.finalY + 10;
        }

        // Helper: Shorten company name for PDF
        const shortenCompanyName = (fullName: string): string => {
            // Split joint ventures by comma
            const parts = fullName.split(',').map(p => p.trim()).filter(Boolean);

            const shortenOnePart = (name: string): string => {
                let s = name.trim();
                const sUpper = s.toUpperCase();
                // Remove common legal entity suffixes
                const suffixes = [
                    'ANONİM ŞİRKETİ', 'ANONIM SIRKETI', 'ANONIM ŞİRKETİ',
                    'LİMİTED ŞİRKETİ', 'LIMITED SIRKETI', 'LİMİTED SİRKETİ',
                    'A.Ş.', 'A.Ş', 'LTD.ŞTİ.', 'LTD. ŞTİ.', 'LTD.ŞTİ', 'LTD ŞTİ',
                ];
                for (const suf of suffixes) {
                    if (sUpper.endsWith(suf.toUpperCase())) {
                        s = s.slice(0, -suf.length).trim();
                    }
                }
                // Remove filler words (case-insensitive match, preserve original)
                const fillers = ['SANAYİ', 'SANAYI', 'TİCARET', 'TICARET', 'TAAHHÜT', 'TAAHÜT', 'TAAHHUT', 'NAKLIYE', 'NAKLİYE', 'VE'];
                const words = s.split(/\s+/).filter(w => !fillers.includes(w.toUpperCase()));
                // Take first 3 meaningful words max, keep original casing
                const kept = words.slice(0, 3);
                return kept.join(' ');
            };

            return parts.map(shortenOnePart).join(' + ');
        };

        const tableData = targetBidders.map((b: any, i: number) => {
            // Highlight row logic similar to table
            const isOwner = isOwnerCompany(b.name);
            // Note: autotable styles are per cell or row hook, hard to pass class here directly.
            // We can use didParseCell hook later if needed. For now just data.
            return [
                i + 1,
                shortenCompanyName(b.name),
                b.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + " TL",
                b.submitTime || '-',
                b.discountRatio?.toFixed(2) + '%',
                b.isValid ? (b.isAboveLimit ? (i === targetBidders.findIndex((x: any) => x.isValid && x.isAboveLimit) ? 'Makul Teklif' : '') : 'Sınır Altı') : (b.exclusionReason || 'Geçersiz')
            ]
        });

        doc.text("Teklif Listesi", 14, currentY - 2);

        autoTable(doc, {
            head: [['Sıra', 'Firma Adı', 'Teklif Tutarı', 'Tarih/Saat', 'Tenzilat', 'Durum']],
            body: tableData,
            startY: currentY,
            styles: { font: fontName, fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [52, 73, 94] },
            columnStyles: {
                0: { cellWidth: 10, halign: 'center' },  // Sıra
                1: { cellWidth: 'auto' },                  // Firma Adı
                2: { cellWidth: 38, halign: 'right' },     // Teklif Tutarı - wide enough for TL
                3: { cellWidth: 30, halign: 'center' },    // Tarih/Saat - no wrap
                4: { cellWidth: 18, halign: 'center' },   // Tenzilat
                5: { cellWidth: 22, halign: 'center' },   // Durum
            },
            didParseCell: (data) => {
                // Prevent line wrapping in Teklif Tutarı and Tarih/Saat columns
                if (data.section === 'body' && (data.column.index === 2 || data.column.index === 3)) {
                    data.cell.styles.overflow = 'visible';
                }
                // Highlight Owner Company Rows and First Makul Row
                if (data.section === 'body') {
                    const originalName = targetBidders[data.row.index]?.name || '';
                    const firstMakulIdx = targetBidders.findIndex((b: any) => b.isValid && b.isAboveLimit);
                    if (isOwnerCompany(originalName)) {
                        data.cell.styles.fillColor = [180, 230, 190]; // Green for owner companies
                        data.cell.styles.textColor = [20, 80, 30];
                    } else if (data.row.index === firstMakulIdx) {
                        data.cell.styles.fillColor = [255, 225, 170]; // Orange-amber for first reasonable bid
                        data.cell.styles.textColor = [120, 60, 0];
                    }
                }
            }
        });

        return doc;
    };

    const exportToPDF = (data: any = null) => {
        const doc = generatePDFDoc(data);
        if (!doc) return;
        const targetMetadata = data?.metadata || metadata;
        const fileName = `Sinir_Deger_Raporu_${targetMetadata.tenderRegisterNo || ''}.pdf`;
        doc.save(fileName);
        toast.success("PDF dosyası indirildi.");
    };

    // Helper to generate PDF blob for sharing
    const generatePDFBlob = async (): Promise<Blob | null> => {
        const doc = generatePDFDoc();
        if (!doc) return null;
        try {
            const arrayBuffer = doc.output('arraybuffer');
            return new Blob([arrayBuffer], { type: 'application/pdf' });
        } catch (e) {
            console.error("PDF Blob generation failed", e);
            return null;
        }
    };

    // --- Share Logic & State ---
    const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
    const [shareText, setShareText] = useState('');

    const handleShare = async () => {
        if (!bidders.length || !result) return;

        // 1. Generate PDF Blob
        const blob = await generatePDFBlob();
        if (!blob) return;

        const filename = `Sinir_Deger_${metadata.tenderRegisterNo || new Date().toISOString().split('T')[0]}.pdf`;

        // Build summary text for WhatsApp
        const winnerBidder = bidders.find(b => b.name === result.likelyWinner);
        const winnerDiscount = winnerBidder?.discountRatio?.toFixed(2);

        const text = [
            `📊 *SINIR DEĞER ANALİZİ*`,
            ``,
            `*İhale:* ${metadata.tenderName || '-'}`,
            `*İKN:* ${metadata.tenderRegisterNo || '-'}`,
            `*İhale Tarihi:* ${metadata.tenderDate || '-'}`,
            ``,
            `*Yaklaşık Maliyet:* ${result.cost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL`,
            `*Sınır Değer:* ${result.limitValue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL`,
            `*Muhtemel Kazanan:* ${result.likelyWinner}`,
            winnerDiscount ? `*Tenzilat:* %${winnerDiscount}` : '',
            ``,
            `_Detaylı PDF rapor ektedir._`
        ].filter(Boolean).join('\n');

        // 2. Download PDF first
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // 3. Open WhatsApp desktop app directly with contact picker
        // whatsapp://send opens WhatsApp and shows the contact/group picker
        window.open(`whatsapp://send?text=${encodeURIComponent(text)}`, '_self');

        toast.success('PDF indirildi! WhatsApp açılıyor... İndirilen PDF dosyasını sohbete ekleyebilirsiniz.', { duration: 5000 });
    };

    // Helper to check if bidder format matches our companies
    const isOwnerCompany = (bidderName: string) => {
        if (!bidderName) return false;
        const normalizedBidder = bidderName.toLocaleLowerCase('tr');
        return myCompanies.some(c => {
            const cName = c.name.toLocaleLowerCase('tr');
            const cShort = c.shortName?.toLocaleLowerCase('tr');

            // 1. Check full name containment (Always safe for full titles)
            if (normalizedBidder.includes(cName)) return true;

            // 2. Check short name with WORD BOUNDARY
            if (cShort) {
                try {
                    const escapedShort = cShort.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const pattern = `(?<!\\p{L})${escapedShort}(?!\\p{L})`;
                    const regex = new RegExp(pattern, 'u');
                    if (regex.test(normalizedBidder)) return true;
                } catch (e) {
                    const words = normalizedBidder.split(/[^a-zçğıöşü0-9]/i);
                    if (words.includes(cShort)) return true;
                }
            }

            // 3. Check FIRST WORD of Company Name with WORD BOUNDARY
            const firstWord = cName.split(' ')[0];
            if (firstWord && firstWord.length >= 2) {
                try {
                    const escaped = firstWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const pattern = `(?<!\\p{L})${escaped}(?!\\p{L})`;
                    const regex = new RegExp(pattern, 'u');
                    if (regex.test(normalizedBidder)) return true;
                } catch (e) {
                    const words = normalizedBidder.split(/[^a-zçğıöşü0-9]/i);
                    if (words.includes(firstWord)) return true;
                }
            }

            return false;
        });
    };

    const shortenCompanyName = (name: string) => {
        const shortened = name
            .replace(/İNŞAAT/gi, 'İNŞ.')
            .replace(/SANAYİ/gi, 'SAN.')
            .replace(/TİCARET/gi, 'TİC.')
            .replace(/LİMİTED/gi, 'LTD.')
            .replace(/ŞİRKETİ/gi, 'ŞTİ.')
            .replace(/ANONİM/gi, 'A.Ş.')
            .replace(/ORTAKLIĞI/gi, 'ORT.')
            .replace(/TAAHHÜT/gi, 'TAAH.')
            .replace(/MÜHENDİSLİK/gi, 'MÜH.')
            .replace(/MİMARLIK/gi, 'MİM.')
            .replace(/TURİZM/gi, 'TUR.')
            .replace(/NAKLİYAT/gi, 'NAK.')
            .replace(/GIDA/gi, 'GID.')
            .replace(/TEKSTİL/gi, 'TEKS.')
            .replace(/OTOMOTİV/gi, 'OTO.')
            .replace(/ELEKTRONİK/gi, 'ELEKTRO.')
            .replace(/ELEKTRİK/gi, 'ELEK.')
            .replace(/MADENCİLİK/gi, 'MAD.')
            .replace(/ENERJİ/gi, 'ENJ.')
            .replace(/ÜRETİM/gi, 'ÜRT.')
            .replace(/PAZARLAMA/gi, 'PAZ.')
            .replace(/GAYRİMENKUL/gi, 'GAYR.')
            .replace(/YATIRIM/gi, 'YAT.')
            .replace(/İTHALAT/gi, 'İTH.')
            .replace(/İHRACAT/gi, 'İHR.')
            .replace(/HAFRİYAT/gi, 'HAFR.')
            .replace(/PEYZAJ/gi, 'PEYZ.')
            .replace(/MEDİKAL/gi, 'MED.')
            .replace(/SAĞLIK/gi, 'SAĞ.')
            .replace(/HİZMETLERİ/gi, 'HİZ.')
            .replace(/YAPI/gi, 'YAP.')
            .trim();

        return shortened.length > 110 ? shortened.slice(0, 110) + '...' : shortened;
    };

    return (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <div className="flex justify-between items-center mb-4">
                <TabsList>
                    <TabsTrigger value="calculation" className="gap-2">
                        <Upload className="w-4 h-4" />
                        Sınır Değer Hesaplama
                    </TabsTrigger>
                    <TabsTrigger value="history" className="gap-2">
                        <History className="w-4 h-4" />
                        Geçmiş İhaleler
                    </TabsTrigger>
                    <TabsTrigger value="business-groups" className="gap-2">
                        <FileText className="w-4 h-4" />
                        İş Grupları
                    </TabsTrigger>

                </TabsList>
            </div>

            <TabsContent value="calculation" className="space-y-6">
                {/* Top Row: Controls & Metadata Side-by-Side */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                    <Card className="h-full">
                        <CardHeader>
                            <CardTitle className="text-lg">Dosya Yükleme</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>İş Grubu</Label>
                                <Select value={businessGroup} onValueChange={setBusinessGroup}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Grup Seçiniz" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {groups.map(g => (
                                            <SelectItem key={g.id} value={g.name}>{g.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="pt-4 border-t space-y-2">
                                <Label>N Katsayısı</Label>
                                <Select value={nCoefficient} onValueChange={(v) => {
                                    setNCoefficient(v);
                                    if (bidders.length > 0) calculateResults(approxCost, bidders, v);
                                }}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="1.00">N = 1.00 (Yapım)</SelectItem>
                                        <SelectItem value="1.20">N = 1.20 (Genel)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className={cn("pt-4 border-t space-y-2", !businessGroup && "opacity-50 pointer-events-none")}>
                                <Label>İhale Tutanağı (.docx)</Label>
                                <Input
                                    type="file"
                                    accept=".docx"
                                    onChange={handleFileChange}
                                    disabled={!businessGroup}
                                />
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    onClick={parseWordDocument}
                                    disabled={!file || isParsing || !businessGroup}
                                >
                                    {isParsing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                                    Dosyayı Analiz Et
                                </Button>
                                {!businessGroup && (
                                    <p className="text-xs text-red-500 font-medium text-center">
                                        Dosya yüklemek için önce İş Grubu seçiniz.
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Metadata Card - Only show if data exists OR create a specific placeholder/instruction area */}
                    {(metadata.tenderRegisterNo || metadata.tenderName) ? (
                        <Card className="bg-slate-50 h-full">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-semibold text-slate-600">İhale Bilgileri</CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm space-y-2">
                                {metadata.administrationName && <div className="font-semibold text-slate-900">{metadata.administrationName}</div>}
                                {metadata.tenderName && <div className="text-slate-700">{metadata.tenderName}</div>}
                                {metadata.tenderRegisterNo && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">İKN:</span>
                                        <span className="font-mono">{metadata.tenderRegisterNo}</span>
                                    </div>
                                )}
                                {metadata.tenderDate && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">İhale Tarihi:</span>
                                        <span>{metadata.tenderDate}</span>
                                    </div>
                                )}
                                {metadata.openingDate && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Teklif Açma:</span>
                                        <span>{metadata.openingDate}</span>
                                    </div>
                                )}
                                <div className="pt-2 border-t mt-2">
                                    <span className="text-muted-foreground block text-xs mb-1">Yaklaşık Maliyet</span>
                                    <span className="text-lg font-bold text-blue-600">
                                        {approxCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="hidden md:block h-full bg-slate-50/50 rounded-lg border border-dashed border-slate-200 flex items-center justify-center p-6 text-center text-slate-400 text-sm">
                            Dosya yüklendiğinde ihale bilgileri burada görüntülenecektir.
                        </div>
                    )}
                </div>

                {/* Bottom Row: Results Table (Full Width) */}
                <Card className="w-full">
                    <CardHeader>
                        <CardTitle className="flex flex-col gap-2">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <span>Teklif Listesi ve Sınır Değer Analizi</span>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" onClick={exportToExcel} disabled={bidders.length === 0} className="h-8 gap-2">
                                            <FileSpreadsheet className="w-4 h-4 text-green-600" />
                                            Excel
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={exportToPDF} disabled={bidders.length === 0} className="h-8 gap-2">
                                            <FileText className="w-4 h-4 text-red-600" />
                                            PDF
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={handleShare} disabled={bidders.length === 0} className="h-8 gap-2 bg-green-50 hover:bg-green-100 text-green-700 border-green-200">
                                            <Share2 className="w-4 h-4" />
                                            Paylaş / WhatsApp
                                        </Button>
                                        <Button
                                            variant="default"
                                            size="sm"
                                            onClick={handleSaveCalculation}
                                            disabled={!result || isSaving}
                                            className="h-8 gap-2 ml-2 transition-all bg-red-600 hover:bg-red-700 text-white border-red-700"
                                        >
                                            {isSaving ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    Kaydediliyor...
                                                </>
                                            ) : (
                                                <>
                                                    <Save className="w-4 h-4" />
                                                    Farklı Kaydet
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                                {result && (
                                    <div className="text-sm font-normal bg-yellow-50 px-3 py-1 rounded border border-yellow-200 text-yellow-800">
                                        Sınır Değer: <span className="font-bold">{result.limitValue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</span>
                                    </div>
                                )}
                            </div>
                            {result && (
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 text-xs font-normal text-slate-500 bg-slate-50 p-2 rounded border">
                                    <div><span className="font-semibold block text-slate-700">Yaklaşık Maliyet:</span> {result.cost.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                    <div><span className="font-semibold block text-slate-700">Ortalama-1:</span> {result.validityLow.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                    <div><span className="font-semibold block text-slate-700">Ortalama-2:</span> {result.validityHigh.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                    <div><span className="font-semibold block text-slate-700">Alt Sınır (T1):</span> {result.tort1.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                    <div><span className="font-semibold block text-slate-700">Üst Sınır (T2):</span> {result.tort2.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                    <div><span className="font-semibold block text-slate-700">Sapma (σ):</span> {result.stdDev.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                    <div><span className="font-semibold block text-slate-700">Std. Sapma Alt:</span> {result.sigmaLower.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                    <div><span className="font-semibold block text-slate-700">Std. Sapma Üst:</span> {result.sigmaUpper.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                    <div><span className="font-semibold block text-slate-700">C Değeri:</span> {result.cValue.toFixed(3)}</div>
                                    <div><span className="font-semibold block text-slate-700">K Değeri:</span> {result.kValue.toFixed(3)}</div>
                                    <div><span className="font-semibold block text-slate-700">N Kats.:</span> {result.nCoefficient.toFixed(2)}</div>
                                    <div className="col-span-2 md:col-span-4 lg:col-span-7 border-t pt-1 mt-1 font-bold text-slate-800">
                                        Muhtemel Kazanan: <span className="text-blue-600">{result.likelyWinner}</span>
                                    </div>
                                </div>
                            )}
                        </CardTitle>
                        <CardDescription className="flex justify-between items-center">
                            <span>Teklifler düşük fiyattan yükseğe doğru sıralanmıştır.</span>
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-10">No</TableHead>
                                    <TableHead>Firma / İstekli Adı</TableHead>
                                    <TableHead className="text-right">Teklif Tutarı</TableHead>
                                    <TableHead className="text-center">Tarih/Saat</TableHead>
                                    <TableHead className="text-right">Tenzilat</TableHead>
                                    <TableHead className="text-center">Durum</TableHead>
                                    <TableHead className="w-10">Sil</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {bidders.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                                            Analiz sonuçları burada görüntülenecektir.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    bidders.map((bidder, idx) => {
                                        // Determine if this is the FIRST makul (reasonable) bidder
                                        const firstMakulIndex = bidders.findIndex(b => b.isValid && b.isAboveLimit);
                                        const isFirstMakul = idx === firstMakulIndex;
                                        return (
                                            <TableRow
                                                key={idx}
                                                className={cn(
                                                    !bidder.isValid ? 'bg-red-50/50 opacity-70'
                                                        : isOwnerCompany(bidder.name) ? 'bg-emerald-100/80 hover:bg-emerald-100 border-l-4 border-l-emerald-500'
                                                            : isFirstMakul ? 'bg-orange-50/80 hover:bg-orange-100 border-l-4 border-l-orange-400'
                                                                : ''
                                                )}
                                            >
                                                <TableCell className="font-mono text-xs text-muted-foreground">{idx + 1}</TableCell>
                                                <TableCell>
                                                    <div className="font-medium" title={bidder.name}>{shortenCompanyName(bidder.name)}</div>
                                                    {!bidder.isValid && (
                                                        <div className="text-xs text-red-500 mt-0.5 flex items-center gap-1">
                                                            <XCircle className="w-3 h-3" />
                                                            {bidder.exclusionReason || 'Geçersiz Teklif'}
                                                        </div>
                                                    )}
                                                    {(bidder.hasSgkDebt || bidder.hasTaxDebt) && (
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {bidder.hasSgkDebt && (
                                                                <span className="text-[10px] font-semibold bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded border border-orange-300">⚠ SGK Borcu Var</span>
                                                            )}
                                                            {bidder.hasTaxDebt && (
                                                                <span className="text-[10px] font-semibold bg-red-100 text-red-800 px-1.5 py-0.5 rounded border border-red-300">⚠ Vergi Borcu Var</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell
                                                    className="text-right font-mono cursor-pointer hover:bg-slate-100 relative group"
                                                    onClick={() => setEditingCell({ index: idx, field: 'amount' })}
                                                >
                                                    {editingCell?.index === idx && editingCell?.field === 'amount' ? (
                                                        <Input
                                                            autoFocus
                                                            className="h-8 text-right font-mono absolute inset-0 w-full h-full border-2 border-blue-500 rounded-none z-10"
                                                            defaultValue={bidder.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, useGrouping: false })}
                                                            onClick={(e) => e.stopPropagation()}
                                                            onBlur={(e) => handleBidderEdit(idx, 'amount', e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') handleBidderEdit(idx, 'amount', e.currentTarget.value);
                                                            }}
                                                        />
                                                    ) : (
                                                        <>
                                                            {bidder.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
                                                            <span className="hidden group-hover:inline absolute right-full mr-1 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 whitespace-nowrap">Düzenle</span>
                                                        </>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center text-xs text-muted-foreground font-mono">
                                                    {bidder.submitTime || '-'}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {bidder.discountRatio != null && (
                                                        <span className={cn(
                                                            "font-bold",
                                                            bidder.discountRatio > 0 ? "text-green-600" : "text-red-500"
                                                        )}>
                                                            %{bidder.discountRatio.toFixed(2)}
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {bidder.isValid ? (
                                                        bidder.isAboveLimit ? (
                                                            isFirstMakul ? (
                                                                <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300 hover:bg-orange-100">
                                                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                                                    İlk Makul Teklif
                                                                </Badge>
                                                            ) : null
                                                        ) : (
                                                            <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100">
                                                                Sınır Altı
                                                            </Badge>
                                                        )
                                                    ) : (
                                                        <Badge variant="secondary">Kapsam Dışı</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                        onClick={() => handleRemoveBidder(idx)}
                                                        title="Listeden Çıkar"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })
                                )}
                            </TableBody>
                        </Table>

                        {/* Add Bidder Button Area */}
                        <div className="mt-4 flex justify-end">
                            <Dialog open={isAddBidderOpen} onOpenChange={setIsAddBidderOpen}>
                                <DialogTrigger asChild>
                                    <Button className="gap-2" disabled={!result}>
                                        <Plus className="w-4 h-4" /> Yeni Katılımcı Ekle
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>El ile Katılımcı Analizi Ekle</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label>Firma Adı</Label>
                                            <Input
                                                placeholder="Örn: X İnşaat Ltd. Şti."
                                                value={newBidderName}
                                                onChange={(e) => setNewBidderName(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Teklif Tutarı (TL)</Label>
                                            <Input
                                                type="number"
                                                placeholder="Örn: 355000000"
                                                value={newBidderAmount}
                                                onChange={(e) => setNewBidderAmount(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Tarih/Saat (Opsiyonel)</Label>
                                            <Input
                                                placeholder="Örn: 05.02.2026 14:30"
                                                value={newBidderTime}
                                                onChange={(e) => setNewBidderTime(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setIsAddBidderOpen(false)}>İptal</Button>
                                        <Button onClick={handleAddNewBidder}>Ekle ve Hesapla</Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>

                    </CardContent>
                </Card>

                {/* Debug Area */}
                <div className="lg:col-span-4 mt-8 bg-slate-100 p-4 rounded-lg border border-slate-200">
                    <details>
                        <summary className="cursor-pointer font-bold text-slate-700">Hata Ayıklama / Ham Veri (Tıklayınız)</summary>
                        <div className="mt-4">
                            <Label>Word Dosyasından Okunan Ham Metin:</Label>
                            <textarea
                                className="w-full h-64 p-2 text-xs font-mono border rounded mt-2"
                                value={rawText}
                                readOnly
                            />
                            <p className="text-xs text-muted-foreground mt-2">
                                Düzgün görüntülenebilmesi için metnin formatlanması gerekebilir.
                            </p>
                        </div>
                    </details>
                </div>
            </TabsContent>

            <TabsContent value="history">
                <Card>
                    <CardHeader>
                        <CardTitle>Geçmiş İhale Hesaplamaları</CardTitle>
                        <CardDescription>Daha önce kaydedilmiş sınır değer analizleri.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-8 text-center bg-slate-100">No</TableHead>
                                    <TableHead className="bg-slate-100 min-w-[100px]">İKN</TableHead>
                                    <TableHead className="bg-slate-100 min-w-[100px]">Tarih</TableHead>
                                    <TableHead className="bg-slate-100 min-w-[120px]">İş Grubu</TableHead>
                                    <TableHead className="bg-slate-100">İşin Adı</TableHead>
                                    <TableHead className="text-right bg-slate-100 min-w-[100px]">Yaklaşık Maliyet</TableHead>
                                    <TableHead className="text-right bg-slate-100 min-w-[100px] text-blue-700 font-bold">Sınır Değer</TableHead>
                                    <TableHead className="bg-slate-100 min-w-[150px]">Kazanan Firma</TableHead>
                                    <TableHead className="text-right bg-slate-100 min-w-[100px]">Kazanan Teklif</TableHead>
                                    <TableHead className="text-center bg-slate-100 w-24">Tenzilat</TableHead>
                                    <TableHead className="text-right bg-slate-100 w-24">İşlem</TableHead>
                                </TableRow>
                                <TableRow className="bg-slate-50 border-b-2 border-slate-200">
                                    <TableHead className="p-1"></TableHead>
                                    <TableHead className="p-1"><Input className="h-7 text-xs bg-white" placeholder="Ara..." value={historyFilters.registerNo} onChange={e => setHistoryFilters({ ...historyFilters, registerNo: e.target.value })} /></TableHead>
                                    <TableHead className="p-1"><Input className="h-7 text-xs bg-white" placeholder="Ara..." value={historyFilters.date} onChange={e => setHistoryFilters({ ...historyFilters, date: e.target.value })} /></TableHead>
                                    <TableHead className="p-1"><Input className="h-7 text-xs bg-white" placeholder="Ara..." value={historyFilters.group} onChange={e => setHistoryFilters({ ...historyFilters, group: e.target.value })} /></TableHead>
                                    <TableHead className="p-1"><Input className="h-7 text-xs bg-white" placeholder="Ara..." value={historyFilters.name} onChange={e => setHistoryFilters({ ...historyFilters, name: e.target.value })} /></TableHead>
                                    <TableHead className="p-1"><Input className="h-7 text-xs bg-white" placeholder="Ara..." value={historyFilters.cost} onChange={e => setHistoryFilters({ ...historyFilters, cost: e.target.value })} /></TableHead>
                                    <TableHead className="p-1"><Input className="h-7 text-xs bg-white" placeholder="Ara..." value={historyFilters.limit} onChange={e => setHistoryFilters({ ...historyFilters, limit: e.target.value })} /></TableHead>
                                    <TableHead className="p-1"><Input className="h-7 text-xs bg-white" placeholder="Ara..." value={historyFilters.winner} onChange={e => setHistoryFilters({ ...historyFilters, winner: e.target.value })} /></TableHead>
                                    <TableHead className="p-1"><Input className="h-7 text-xs bg-white" placeholder="Ara..." value={historyFilters.amount} onChange={e => setHistoryFilters({ ...historyFilters, amount: e.target.value })} /></TableHead>
                                    <TableHead className="p-1"><Input className="h-7 text-xs bg-white" placeholder="%" value={historyFilters.discount} onChange={e => setHistoryFilters({ ...historyFilters, discount: e.target.value })} /></TableHead>
                                    <TableHead className="p-1"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {history.filter(record => {
                                    const f = historyFilters;
                                    const matchReg = (record.tenderRegisterNo || '').toLocaleLowerCase('tr').includes(f.registerNo.toLocaleLowerCase('tr'));
                                    const matchDate = (record.tenderDate ? new Date(record.tenderDate).toLocaleDateString('tr-TR') : '').includes(f.date);
                                    const matchName = (record.tenderName || '').toLocaleLowerCase('tr').includes(f.name.toLocaleLowerCase('tr'));
                                    const matchGroup = (record.businessGroup || '').toLocaleLowerCase('tr').includes(f.group.toLocaleLowerCase('tr'));
                                    const matchWinner = (record.likelyWinner || '').toLocaleLowerCase('tr').includes(f.winner.toLocaleLowerCase('tr'));
                                    const matchCost = (record.approxCost || '').toString().includes(f.cost);
                                    const matchLimit = (record.limitValue || '').toString().includes(f.limit);
                                    return matchReg && matchDate && matchName && matchGroup && matchWinner && matchCost && matchLimit;
                                }).length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                                            Kayıt bulunamadı.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    history.filter(record => {
                                        const f = historyFilters;
                                        const matchReg = (record.tenderRegisterNo || '').toLocaleLowerCase('tr').includes(f.registerNo.toLocaleLowerCase('tr'));
                                        const matchDate = (record.tenderDate ? new Date(record.tenderDate).toLocaleDateString('tr-TR') : '').includes(f.date);
                                        const matchName = (record.tenderName || '').toLocaleLowerCase('tr').includes(f.name.toLocaleLowerCase('tr'));
                                        const matchGroup = (record.businessGroup || '').toLocaleLowerCase('tr').includes(f.group.toLocaleLowerCase('tr'));
                                        const matchWinner = (record.likelyWinner || '').toLocaleLowerCase('tr').includes(f.winner.toLocaleLowerCase('tr'));
                                        const matchCost = (record.approxCost || '').toString().includes(f.cost);
                                        const matchLimit = (record.limitValue || '').toString().includes(f.limit);
                                        return matchReg && matchDate && matchName && matchGroup && matchWinner && matchCost && matchLimit;
                                    }).map((record, index) => {
                                        // Calculate Winner Amount if missing
                                        const winnerAmount = record.fullResultData?.bidders?.find((b: any) => b.name === record.likelyWinner)?.amount;

                                        return (
                                            <TableRow key={record.id} className="hover:bg-slate-50">
                                                <TableCell className="font-mono text-xs text-center text-muted-foreground">{index + 1}</TableCell>
                                                <TableCell className="font-mono text-xs font-medium">{record.tenderRegisterNo || '-'}</TableCell>
                                                <TableCell className="text-xs">
                                                    {record.tenderDate ? new Date(record.tenderDate).toLocaleDateString('tr-TR') : '-'}
                                                </TableCell>
                                                <TableCell>
                                                    {record.businessGroup ? <Badge variant="outline" className="text-[10px] px-1 py-0">{record.businessGroup}</Badge> : '-'}
                                                </TableCell>
                                                <TableCell
                                                    className={cn(
                                                        "max-w-[180px] truncate text-xs relative group",
                                                        (record.hasManualEdits || record.fullResultData?.hasManualEdits) && "bg-red-50 text-red-700 font-medium ring-1 ring-inset ring-red-200"
                                                    )}
                                                    title={record.tenderName || ''}
                                                >
                                                    {record.tenderName || '-'}
                                                    {(record.hasManualEdits || record.fullResultData?.hasManualEdits) && (
                                                        <span className="hidden group-hover:inline absolute right-2 top-1/2 -translate-y-1/2 text-[10px] bg-red-600 text-white px-1.5 py-0.5 rounded">
                                                            DÜZENLENDİ
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right text-xs font-mono">
                                                    {record.approxCost?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
                                                </TableCell>
                                                <TableCell className="text-right text-xs font-mono font-bold text-blue-700 bg-blue-50/50">
                                                    {record.limitValue?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
                                                </TableCell>
                                                <TableCell className="max-w-[150px] truncate text-xs font-medium" title={record.likelyWinner || ''}>
                                                    {shortenCompanyName(record.likelyWinner || '-')}
                                                </TableCell>
                                                <TableCell className="text-right text-xs font-mono">
                                                    {winnerAmount ? winnerAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' TL' : '-'}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {record.likelyWinnerDiscount ? (
                                                        <Badge variant="outline" className={cn("text-[10px] px-1 py-0", record.likelyWinnerDiscount > 0 ? "text-green-700 border-green-200 bg-green-50" : "text-red-700 border-red-200 bg-red-50")}>
                                                            %{record.likelyWinnerDiscount.toFixed(2)}
                                                        </Badge>
                                                    ) : '-'}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => exportToExcel(record.fullResultData)} title="Excel İndir">
                                                            <FileSpreadsheet className="w-3.5 h-3.5 text-green-600" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => exportToPDF(record.fullResultData)} title="PDF İndir">
                                                            <FileText className="w-3.5 h-3.5 text-red-500" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleLoadHistory(record)} title="Görüntüle">
                                                            <Eye className="w-3.5 h-3.5 text-blue-600" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => handleDeleteHistory(record.id, e)} title="Sil">
                                                            <Trash2 className="w-3.5 h-3.5 text-red-600" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })
                                )}
                            </TableBody>

                        </Table>
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="business-groups">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>İş Grupları</CardTitle>
                            <CardDescription>Sisteme tanımlı iş grupları listesi.</CardDescription>
                        </div>
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button className="gap-2">
                                    <Plus className="w-4 h-4" /> Yeni Grup Ekle
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Yeni İş Grubu Ekle</DialogTitle>
                                </DialogHeader>
                                <form onSubmit={(e) => {
                                    e.preventDefault();
                                    const formData = new FormData(e.currentTarget);
                                    handleAddGroup(formData.get('name') as string);
                                }}>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label>Grup Adı</Label>
                                            <Input name="name" placeholder="Örn: Altyapı İşleri" required />
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button type="submit">Ekle</Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Grup Adı</TableHead>
                                    <TableHead className="w-[100px] text-right">İşlem</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoadingGroups ? (
                                    <TableRow>
                                        <TableCell colSpan={2} className="text-center py-8">
                                            <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
                                        </TableCell>
                                    </TableRow>
                                ) : groups.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={2} className="text-center py-8 text-muted-foreground">
                                            Henüz iş grubu tanımlanmamış.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    groups.map((group) => (
                                        <TableRow key={group.id}>
                                            <TableCell className="font-medium">{group.name}</TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => handleRemoveGroup(group.id)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </TabsContent>

            {/* WhatsApp Share Dialog */}
            <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Share2 className="w-5 h-5 text-green-600" />
                            WhatsApp ile Paylaş
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="p-4 bg-green-50 text-green-800 rounded-md text-sm border border-green-200">
                            <strong>✅ PDF Raporu İndirildi!</strong>
                            <p className="mt-2 text-xs">
                                Aşağıdaki adımları takip edin:
                            </p>
                            <ol className="mt-2 text-xs space-y-1 list-decimal list-inside">
                                <li><strong>"WhatsApp'ı Aç"</strong> butonuna tıklayın</li>
                                <li>Göndermek istediğiniz kişi/grubu seçin</li>
                                <li>Mesaj kutusuna indirilen PDF dosyasını <strong>sürükleyip bırakın</strong> veya <strong>📎 ataş</strong> simgesinden ekleyin</li>
                                <li>Gönderin!</li>
                            </ol>
                        </div>
                        <div className="p-3 bg-slate-50 rounded border text-xs font-mono whitespace-pre-wrap max-h-40 overflow-auto">
                            {shareText}
                        </div>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" size="sm" onClick={() => setIsShareDialogOpen(false)}>Kapat</Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                                navigator.clipboard.writeText(shareText);
                                toast.success('Metin panoya kopyalandı!');
                            }}
                        >
                            📋 Metni Kopyala
                        </Button>
                        <Button
                            className="bg-[#25D366] hover:bg-[#128C7E] text-white"
                            size="sm"
                            onClick={() => {
                                window.open(`https://web.whatsapp.com/`, '_blank');
                                setIsShareDialogOpen(false);
                            }}
                        >
                            💬 WhatsApp'ı Aç
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Tabs >
    );
}
