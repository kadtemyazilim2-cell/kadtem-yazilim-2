'use client';

import React, { useState } from 'react';
import mammoth from 'mammoth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Upload, Calculator, FileText, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

// Types for our calculation
interface Bidder {
    name: string;
    amount: number;
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
    mean: number; // Aritmetik Ortalama
    stdDev: number; // Standart Sapma
    nCoefficient: number; // N Katsayısı
}

export function LimitValueCalculation() {
    const [file, setFile] = useState<File | null>(null);
    const [isParsing, setIsParsing] = useState(false);
    const [bidders, setBidders] = useState<Bidder[]>([]);
    const [approxCost, setApproxCost] = useState<number>(0);
    const [nCoefficient, setNCoefficient] = useState<string>('1.20');
    const [result, setResult] = useState<CalculationResult | null>(null);
    const [metadata, setMetadata] = useState<TenderMetadata>({});

    // --- File Handling ---
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            // Auto parse on select if desired, but button is safer for now
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
        const lines = cleanText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

        console.log("Parsing extract sample:", lines.slice(0, 10));

        let foundCost = 0;
        const foundBidders: Bidder[] = [];
        const meta: TenderMetadata = {};

        // Regex Patterns
        const patterns = {
            cost: /(?:yaklaşık\s*maliyet)(?:[:\s]*)([\d\.]+,[\d]{2})/i,
            adminName: /(?:İdare\s*Adı|Kurum\s*Adı)(?:[:\s]*)(.+)/i,
            ikn: /(?:İhale\s*Kayıt\s*Numarası|İKN|Kayıt\s*No)(?:[:\s]*)(.+)/i,
            tenderName: /(?:İhale\s*Adı|İşin\s*Adı)(?:[:\s]*)(.+)/i,
            tenderDate: /(?:İhale\s*Tarih(?:i| ve Saati)?)(?:[:\s]*)(.+)/i,
            openingDate: /(?:Tekliflerin\s*Açıldığı\s*Tarih(?:i| ve Saati)?)(?:[:\s]*)(.+)/i,
            minutesDate: /(?:Tutanağın\s*Düzenlendiği\s*Tarih(?:i| ve Saati)?)(?:[:\s]*)(.+)/i,

            // Bidder Line: "1. Firma Adı ... 123.456,78 TL"
            // Also looking for extraction of status if "Geçersiz" is in the line
            bidder: /^(?:\d+\.?\s*)?([^\d].+?)\s+([\d\.]+,[\d]{2})\s*(?:TL|TRY)?/i
        };

        // Scan for Metadata
        lines.forEach(line => {
            if (!foundCost) {
                const match = line.match(patterns.cost);
                if (match) foundCost = parseTurkishMoney(match[1]);
            }
            if (!meta.administrationName) {
                const match = line.match(patterns.adminName);
                if (match) meta.administrationName = match[1].trim();
            }
            if (!meta.tenderRegisterNo) {
                const match = line.match(patterns.ikn);
                if (match) meta.tenderRegisterNo = match[1].trim();
            }
            if (!meta.tenderName) {
                const match = line.match(patterns.tenderName);
                if (match) meta.tenderName = match[1].trim();
            }
            if (!meta.tenderDate) {
                const match = line.match(patterns.tenderDate);
                if (match) meta.tenderDate = match[1].trim();
            }
            if (!meta.openingDate) {
                const match = line.match(patterns.openingDate);
                if (match) meta.openingDate = match[1].trim();
            }
            if (!meta.minutesDate) {
                const match = line.match(patterns.minutesDate);
                if (match) meta.minutesDate = match[1].trim();
            }
        });

        // Scan for Bidders
        // We look for lines that contain a money amount at the end
        lines.forEach(line => {
            // Ignore metadata lines
            if (line.match(/Yaklaşık Maliyet/i)) return;
            if (line.match(/Sınır Değer/i)) return;

            const match = line.match(patterns.bidder);
            if (match) {
                const rawName = match[1].trim();
                const amount = parseTurkishMoney(match[2]);

                // Filter out noise (like page numbers, dates looking like money)
                // Assuming bids are > 1000 TL to be safe
                if (amount > 1000) {
                    // Check if "Geçersiz" or "Elenmiş" appears in the line
                    const isInvalid = /geçersiz|elendi|dışı|teminat/i.test(line);

                    // Clean up name (getting rid of trailing separators)
                    const name = rawName.replace(/[\._\-]+$/, '').trim();

                    // Ensure we haven't added this exact bid already (dedupe)
                    // Some docs repeat the list
                    const exists = foundBidders.some(b => b.name === name && b.amount === amount);
                    if (!exists) {
                        foundBidders.push({
                            name,
                            amount,
                            isValid: !isInvalid,
                            exclusionReason: isInvalid ? 'Tutanakta belirtilen gerekçe' : undefined
                        });
                    }
                }
            }
        });

        // Set State
        setMetadata(meta);
        if (foundCost > 0) setApproxCost(foundCost);

        // SORT: Lowest to Highest
        foundBidders.sort((a, b) => a.amount - b.amount);
        setBidders(foundBidders);

        // Auto Calculate if possible
        if (foundCost > 0 && foundBidders.length > 0) {
            calculateResults(foundCost, foundBidders, nCoefficient);
        }
    };

    const parseTurkishMoney = (str: string): number => {
        const clean = str.replace(/\./g, '').replace(',', '.').replace(/[^0-9.]/g, '');
        return parseFloat(clean);
    };

    const calculateResults = (cost: number, currentBidders: Bidder[], nVal: string) => {
        const N = parseFloat(nVal);

        const validBids = currentBidders.filter(b => b.isValid);
        if (validBids.length === 0) return;

        const total = validBids.reduce((sum, b) => sum + b.amount, 0);
        const mean = total / validBids.length;

        // Placeholder Limit Value Logic until exact formula is confirmed
        // Using 90% of Mean as visual placeholder
        const calculatedLimitValue = mean * 0.9;

        const updatedBidders = currentBidders.map(b => ({
            ...b,
            discountRatio: ((cost - b.amount) / cost) * 100,
            isAboveLimit: b.isValid ? b.amount >= calculatedLimitValue : false
        }));

        setBidders(updatedBidders);
        setResult({
            limitValue: calculatedLimitValue,
            mean: mean,
            stdDev: 0,
            nCoefficient: N
        });
    };

    // Wrapper for button click
    const handleCalculate = () => {
        calculateResults(approxCost, bidders, nCoefficient);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left: Controls & Metadata */}
            <div className="lg:col-span-1 space-y-6">
                <Card>
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

                {/* Metadata Card - Only show if data exists */}
                {(metadata.tenderRegisterNo || metadata.tenderName) && (
                    <Card className="bg-slate-50">
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
                )}
            </div>

            {/* Right: Results Table */}
            <Card className="lg:col-span-3">
                <CardHeader>
                    <CardTitle className="flex justify-between items-center">
                        <span>Teklif Listesi ve Sınır Değer Analizi</span>
                        {result && (
                            <div className="text-sm font-normal bg-yellow-50 px-3 py-1 rounded border border-yellow-200 text-yellow-800">
                                Hesaplanan Sınır Değer: <span className="font-bold">{result.limitValue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</span>
                            </div>
                        )}
                    </CardTitle>
                    <CardDescription>
                        Teklifler düşük fiyattan yükseğe doğru sıralanmıştır.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-10">#</TableHead>
                                <TableHead>Firma / İstekli Adı</TableHead>
                                <TableHead className="text-right">Teklif Tutarı</TableHead>
                                <TableHead className="text-right">Tenzilat</TableHead>
                                <TableHead className="text-center">Durum</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {bidders.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                                        Analiz sonuçları burada görüntülenecektir.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                bidders.map((bidder, idx) => (
                                    <TableRow key={idx} className={!bidder.isValid ? 'bg-red-50/50 opacity-70' : ''}>
                                        <TableCell className="font-mono text-xs text-muted-foreground">{idx + 1}</TableCell>
                                        <TableCell>
                                            <div className="font-medium">{bidder.name}</div>
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
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
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
                            * Eğer veriler gelmiyorsa, lütfen yukarıdaki metni kopyalayıp geliştiriciye iletiniz.
                        </p>
                    </div>
                </details>
            </div>
        </div>
    );
}
