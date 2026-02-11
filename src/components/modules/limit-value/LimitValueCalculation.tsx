'use client';

import React, { useState } from 'react';
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
import { saveCalculation, getCalculations, deleteCalculation } from '@/actions/limit-value';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { fontBase64 } from '@/lib/pdf-font';

// Types for our calculation
interface Bidder {
    name: string;
    amount: number;
    submitTime?: string; // Teklif veriliş zamanı
    isValid: boolean; // Geçerli/Geçersiz
    isAboveLimit?: boolean; // Sınır değerin üzerinde mi?
    discountRatio?: number; // Tenzilat Oranı
    exclusionReason?: string; // Elenme Sebebi (Varsa)
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
}

export function LimitValueCalculation() {
    const [file, setFile] = useState<File | null>(null);
    const [isParsing, setIsParsing] = useState(false);
    const [bidders, setBidders] = useState<Bidder[]>([]);
    const [approxCost, setApproxCost] = useState<number>(0);
    const [nCoefficient, setNCoefficient] = useState<string>('1.00');
    const [result, setResult] = useState<CalculationResult | null>(null);
    const [metadata, setMetadata] = useState<TenderMetadata>({});
    const [rawText, setRawText] = useState<string>('');

    // New Bidder Modal State
    const [isAddBidderOpen, setIsAddBidderOpen] = useState(false);
    const [newBidderName, setNewBidderName] = useState('');
    const [newBidderAmount, setNewBidderAmount] = useState('');
    const [newBidderTime, setNewBidderTime] = useState('');

    // History & Tabs
    const [activeTab, setActiveTab] = useState('calculation');
    const [history, setHistory] = useState<any[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    // Initial Load of History
    React.useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        setIsLoadingHistory(true);
        const res = await getCalculations();
        if (res.success && res.data) {
            setHistory(res.data);
        }
        setIsLoadingHistory(false);
    };

    const handleSaveCalculation = async () => {
        if (!result || bidders.length === 0) {
            toast.error('Kaydedilecek veri bulunamadı. Lütfen önce hesaplama yapın.');
            return;
        }

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
                approxCost
            }
        };

        const res = await saveCalculation(saveData);

        if (res.success) {
            toast.success('Hesaplama başarıyla kaydedildi.', { id: toastId });
            loadHistory(); // Refresh list
        } else {
            toast.error('Kayıt başarısız: ' + res.error, { id: toastId });
        }
    };

    const handleLoadHistory = (record: any) => {
        const data = record.fullResultData;
        if (!data) return;

        setBidders(data.bidders || []);
        setResult(data.result || null);
        setMetadata(data.metadata || {});
        setApproxCost(data.approxCost || 0);
        // nCoefficient is string in state, but number in history. Convert if needed
        // Actually nCoefficient state is string in this component
        if (data.result?.nCoefficient) {
            setNCoefficient(data.result.nCoefficient.toString());
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

    // --- File Handling ---
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const parseWordDocument = async () => {
        if (!file) {
            toast.error('Lütfen önce bir Word dosyası seçiniz.');
            return;
        }

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
            moneyStart: /^([\d\.]+,\d{2})\s*(?:TRY|TL)/i, // Line starts with money
            moneyAny: /([\d\.]+,\d{2})\s*(?:TRY|TL)/i, // Line contains money anywhere
            date: /\d{2}\.\d{2}\.\d{4}/, // Simple date check
            dateTimeExtract: /(.+?)\s*-\s*(\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2})/, // Name - Date Time
            statusKeywords: /yasaklı|uygun|kontrol|geçersiz|elendi|teminat|borcu/i
        };

        const parseTurkishMoney = (str: string): number => {
            const clean = str.replace(/\./g, '').replace(',', '.').replace(/[^0-9.]/g, '');
            return parseFloat(clean);
        };

        // --- Iterative Parsing ---
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

                let name = prevLine.trim();
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

                    const lookAhead = [line, nextLine, lines[i + 2] || '', lines[i + 3] || ''].join(' ').toLowerCase();

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

                    const exists = foundBidders.some(b => b.name === name && b.amount === amount);

                    if (!exists && amount > 100) {
                        foundBidders.push({
                            name,
                            amount,
                            submitTime,
                            isValid: !isInvalid,
                            exclusionReason: isInvalid ? exclusionReason : undefined
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
            likelyWinner
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

    const exportToExcel = () => {
        if (bidders.length === 0 || !result) return;

        // 1. Prepare Summary Data
        const summaryRows = [
            ["İHALE BİLGİLERİ VE HESAPLAMA SONUÇLARI"],
            ["İdare Adı", metadata.administrationName || "-"],
            ["İşin Adı", metadata.tenderName || "-"],
            ["İhale Kayıt No (İKN)", metadata.tenderRegisterNo || "-"],
            ["İhale Tarihi", metadata.tenderDate || "-"],
            ["Teklif Açma Tarihi", metadata.openingDate || "-"],
            [],
            ["HESAPLAMA PARAMETRELERİ"],
            ["Yaklaşık Maliyet", approxCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + " TL"],
            ["N Katsayısı", result?.nCoefficient.toFixed(2) || "-"],
            [],
            ["ARA DEĞERLER"],
            ["Ortalama-1 (Aritmetik)", result?.mean1.toLocaleString('tr-TR', { minimumFractionDigits: 2 })],
            ["Ortalama-2 (Makul)", result?.mean2.toLocaleString('tr-TR', { minimumFractionDigits: 2 })],
            ["Alt Sınır (T1)", result?.tort1.toLocaleString('tr-TR', { minimumFractionDigits: 2 })],
            ["Üst Sınır (T2)", result?.tort2.toLocaleString('tr-TR', { minimumFractionDigits: 2 })],
            ["Standart Sapma (σ)", result?.stdDev.toLocaleString('tr-TR', { minimumFractionDigits: 2 })],
            ["Standart Sapma Alt", result?.sigmaLower.toLocaleString('tr-TR', { minimumFractionDigits: 2 })],
            ["Standart Sapma Üst", result?.sigmaUpper.toLocaleString('tr-TR', { minimumFractionDigits: 2 })],
            ["C Değeri", result?.cValue.toFixed(3)],
            ["K Değeri", result?.kValue.toFixed(3)],
            [],
            ["SONUÇ"],
            ["Sınır Değer", result?.limitValue.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + " TL"],
            ["Muhtemel Kazanan", result?.likelyWinner || "-"],
            [],
            ["KATILIMCI LİSTESİ"]
        ];

        // 2. Prepare Bidders Data
        const headers = ['Sıra No', 'Firma Adı', 'Teklif Tutarı', 'Tarih ve Saat', 'Tenzilat (%)', 'Durum'];
        const bidderRows = bidders.map((b, i) => [
            i + 1,
            b.name,
            b.amount, // Keep as number for Excel formatting if possible, but simplest is string or raw
            b.submitTime || '-',
            b.discountRatio?.toFixed(2),
            b.isValid ? (b.isAboveLimit ? 'Makul' : 'Sınır Altı') : (b.exclusionReason || 'Geçersiz')
        ]);

        // 3. Combine
        const wsData = [...summaryRows, headers, ...bidderRows];
        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // Adjust column widths visually
        ws['!cols'] = [{ wch: 25 }, { wch: 50 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 15 }];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Sınır Değer Analizi");
        XLSX.writeFile(wb, "sinir_deger_analizi.xlsx");
        toast.success("Excel dosyası indirildi.");
    };

    const generatePDFDoc = () => {
        if (bidders.length === 0) return null;

        const doc = new jsPDF();

        // Add Custom Font (Roboto-Regular)
        doc.addFileToVFS('Roboto-Regular.ttf', fontBase64);
        doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
        doc.setFont('Roboto');

        doc.setFontSize(14);
        doc.text("Sınır Değer Analiz Raporu", 14, 15);

        let currentY = 25;

        if (result) {
            // Summary Table
            const summaryBody = [
                ['İdare Adı', metadata.administrationName || '-'],
                ['İşin Adı / İKN', `${metadata.tenderName || ''} / ${metadata.tenderRegisterNo || ''}`],
                ['İhale Tarihi', metadata.tenderDate || '-'],
                ['Yaklaşık Maliyet', `${approxCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL`],
                ['Sınır Değer', `${result.limitValue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL`],
                ['N Katsayısı', result.nCoefficient.toFixed(2)],
                ['Ortalama-1 / Ortalama-2', `${result.mean1.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} / ${result.mean2.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`],
                ['Alt Sınır (T1) / Üst Sınır (T2)', `${result.tort1.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} / ${result.tort2.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`],
                ['Standart Sapma (σ)', result.stdDev.toLocaleString('tr-TR', { minimumFractionDigits: 2 })],
                ['Standart Sapma (Alt/Üst)', `${result.sigmaLower.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} / ${result.sigmaUpper.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`],
                ['C Değeri / K Değeri', `${result.cValue.toFixed(3)} / ${result.kValue.toFixed(3)}`],
                ['Muhtemel Kazanan', result.likelyWinner]
            ];

            autoTable(doc, {
                head: [['Parametre', 'Değer']],
                body: summaryBody,
                startY: currentY,
                styles: { font: 'Roboto', fontSize: 9 },
                headStyles: { fillColor: [41, 128, 185] },
                columnStyles: { 0: { fontStyle: 'bold', cellWidth: 80 } },
                theme: 'grid'
            });

            // @ts-ignore
            currentY = doc.lastAutoTable.finalY + 10;
        }

        const tableData = bidders.map((b, i) => [
            i + 1,
            b.name,
            b.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + " TL",
            b.submitTime || '-',
            b.discountRatio?.toFixed(2) + '%',
            b.isValid ? (b.isAboveLimit ? 'Makul' : 'Sınır Altı') : (b.exclusionReason || 'Geçersiz')
        ]);

        doc.text("Teklif Listesi", 14, currentY - 2);

        autoTable(doc, {
            head: [['Sıra', 'Firma Adı', 'Teklif Tutarı', 'Tarih/Saat', 'Tenzilat', 'Durum']],
            body: tableData,
            startY: currentY,
            styles: { font: 'Roboto', fontSize: 8 },
            headStyles: { fillColor: [52, 73, 94] },
        });

        return doc;
    };

    const exportToPDF = () => {
        const doc = generatePDFDoc();
        if (!doc) return;
        doc.save("sinir_deger_raporu.pdf");
        toast.success("PDF dosyası indirildi.");
    };

    const handleShare = async () => {
        const doc = generatePDFDoc();
        if (!doc) return;

        const blob = doc.output('blob');
        const filename = `Sinir_Deger_Hesabi_${metadata.tenderRegisterNo || 'Rapor'}.pdf`;
        const file = new File([blob], filename, { type: 'application/pdf' });

        // 1. Try Native Share (Mobile / Modern Desktop)
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({
                    files: [file],
                    title: 'Sınır Değer Hesabı',
                    text: `${metadata.tenderRegisterNo || 'İhale'} için sınır değer hesabı ektedir.`
                });
                toast.success("Paylaşım başlatıldı.");
                return;
            } catch (error) {
                if ((error as any).name !== 'AbortError') {
                    console.error('Share failed:', error);
                    // Continue to fallback
                } else {
                    return; // User cancelled
                }
            }
        }

        // 2. Fallback: Download + Open WhatsApp Desktop App
        doc.save(filename);
        toast.info("PDF indirildi. WhatsApp uygulaması açılıyor, lütfen dosyayı sohbete sürükleyiniz.");

        // Wait for download to start, then try to open WhatsApp
        setTimeout(() => {
            const text = encodeURIComponent(`"${metadata.tenderRegisterNo || 'İhale'}" Sınır Değer Raporu ektedir.`);
            window.open(`whatsapp://send?text=${text}`, '_blank');
        }, 1000);
    };

    const shortenCompanyName = (name: string) => {
        const shortened = name
            .replace(/İnşaat/gi, 'İnş.')
            .replace(/Sanayi/gi, 'San.')
            .replace(/Ticaret/gi, 'Tic.')
            .replace(/Limited/gi, 'Ltd.')
            .replace(/Şirketi/gi, 'Şti.')
            .replace(/Anonim/gi, 'A.Ş.')
            .replace(/Ortaklığı/gi, 'Ort.')
            .replace(/Taahhüt/gi, 'Taah.')
            .replace(/Mühendislik/gi, 'Müh.')
            .replace(/Mimarlık/gi, 'Mim.')
            .replace(/Turizm/gi, 'Tur.')
            .replace(/Nakliyat/gi, 'Nak.')
            .replace(/Gıda/gi, 'Gıd.')
            .replace(/Tekstil/gi, 'Teks.')
            .replace(/Otomotiv/gi, 'Oto.')
            .replace(/Elektrik/gi, 'Elek.')
            .replace(/Elektronik/gi, 'Elektro.')
            .replace(/Madencilik/gi, 'Mad.')
            .replace(/Enerji/gi, 'Enj.')
            .replace(/Üretim/gi, 'Ürt.')
            .replace(/Pazarlama/gi, 'Paz.')
            .replace(/Gayrimenkul/gi, 'Gayr.')
            .replace(/Yatırım/gi, 'Yat.')
            .replace(/İthalat/gi, 'İth.')
            .replace(/İhracat/gi, 'İhr.')
            .replace(/Hafriyat/gi, 'Hafr.')
            .replace(/Peyzaj/gi, 'Peyz.')
            .replace(/Medikal/gi, 'Med.')
            .replace(/Sağlık/gi, 'Sağ.')
            .replace(/Hizmetleri/gi, 'Hiz.')
            .replace(/Yapı/gi, 'Yap.')
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
                                <Label>İhale Tutanağı (.docx)</Label>
                                <Input type="file" accept=".docx" onChange={handleFileChange} />
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    onClick={parseWordDocument}
                                    disabled={!file || isParsing}
                                >
                                    {isParsing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                                    Dosyayı Analiz Et
                                </Button>
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
                                        <Button variant="default" size="sm" onClick={handleSaveCalculation} disabled={!result} className="h-8 gap-2 ml-2">
                                            <Save className="w-4 h-4" />
                                            Kaydet
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
                                    bidders.map((bidder, idx) => (
                                        <TableRow key={idx} className={!bidder.isValid ? 'bg-red-50/50 opacity-70' : ''}>
                                            <TableCell className="font-mono text-xs text-muted-foreground">{idx + 1}</TableCell>
                                            <TableCell>
                                                <div className="font-medium" title={bidder.name}>{shortenCompanyName(bidder.name)}</div>
                                                {!bidder.isValid && (
                                                    <div className="text-xs text-red-500 mt-0.5 flex items-center gap-1">
                                                        <XCircle className="w-3 h-3" />
                                                        {bidder.exclusionReason || 'Geçersiz Teklif'}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right font-mono">
                                                {bidder.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
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
                                                        <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">
                                                            <CheckCircle2 className="w-3 h-3 mr-1" />
                                                            Makul
                                                        </Badge>
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
                                    ))
                                )}
                            </TableBody>
                        </Table>

                        {/* Add Bidder Button Area */}
                        <div className="mt-4 flex justify-end">
                            <Dialog open={isAddBidderOpen} onOpenChange={setIsAddBidderOpen}>
                                <DialogTrigger asChild>
                                    <Button className="gap-2">
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
                                    <TableHead>Tarih</TableHead>
                                    <TableHead>İKN</TableHead>
                                    <TableHead>İşin Adı</TableHead>
                                    <TableHead className="text-right">Yaklaşık Maliyet</TableHead>
                                    <TableHead className="text-right">Sınır Değer</TableHead>
                                    <TableHead className="text-right">Kazanan Teklif</TableHead>
                                    <TableHead className="text-center">Kazanan Tenzilat</TableHead>
                                    <TableHead className="text-right">İşlem</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {history.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                            Henüz kaydedilmiş bir hesaplama bulunmuyor.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    history.map((record) => (
                                        <TableRow key={record.id}>
                                            <TableCell>
                                                {new Date(record.createdAt).toLocaleDateString('tr-TR')}
                                                <br />
                                                <span className="text-xs text-muted-foreground">
                                                    {new Date(record.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </TableCell>
                                            <TableCell className="font-mono text-sm">{record.tenderRegisterNo}</TableCell>
                                            <TableCell className="max-w-[300px] truncate" title={record.tenderName}>
                                                {record.tenderName || '-'}
                                            </TableCell>
                                            <TableCell className="text-right font-medium">
                                                {record.approxCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
                                            </TableCell>
                                            <TableCell className="text-right font-medium text-yellow-700">
                                                {record.limitValue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
                                            </TableCell>
                                            <TableCell className="text-right font-medium">
                                                {record.fullResultData?.bidders?.find((b: any) => b.name === record.likelyWinner)?.amount
                                                    ? `${record.fullResultData.bidders.find((b: any) => b.name === record.likelyWinner)?.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL`
                                                    : '-'}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {record.likelyWinnerDiscount ? `%${record.likelyWinnerDiscount.toFixed(2)}` : '-'}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleLoadHistory(record)}
                                                        className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                        title="Görüntüle / Yükle"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={(e) => handleDeleteHistory(record.id, e)}
                                                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                        title="Sil"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    );
}
