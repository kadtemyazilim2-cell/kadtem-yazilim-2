import { useState, useMemo } from 'react';
import { useAppStore } from '@/lib/store/use-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns'; // [UPDATED]
import { ArrowRight, FileSpreadsheet, FileDown, Filter, ChevronDown, ChevronUp } from 'lucide-react'; // [UPDATED]
import { FuelPurchaseEditDialog } from './FuelPurchaseEditDialog';
import { Button } from '@/components/ui/button'; // [NEW]
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'; // [NEW]
import { Input } from '@/components/ui/input'; // [NEW]
import { Label } from '@/components/ui/label'; // [NEW]
import * as XLSX from 'xlsx'; // [NEW]
import jsPDF from 'jspdf'; // [NEW]
import autoTable from 'jspdf-autotable'; // [NEW]
import { tr } from 'date-fns/locale'; // [NEW]

import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'; // [NEW]

interface FuelPurchaseListProps {
    isWidget?: boolean;
}

export function FuelPurchaseList({ isWidget = false }: FuelPurchaseListProps) {
    const { fuelTransfers, fuelTanks, sites } = useAppStore();
    const [selectedTransfer, setSelectedTransfer] = useState<any>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isFullListOpen, setIsFullListOpen] = useState(false);

    // [NEW] States
    const [showAll, setShowAll] = useState(false);
    const [dateRange, setDateRange] = useState<{ start: string, end: string }>({ start: '', end: '' });
    const [selectedSiteId, setSelectedSiteId] = useState<string>('all');

    // Helper to resolve Entity Names
    const getEntityName = (type: string, id: string) => {
        if (type === 'TANK') {
            const tank = fuelTanks.find((t: any) => t.id === id);
            return tank?.name || '-';
        }
        if (type === 'VEHICLE') return 'Araç';
        if (type === 'EXTERNAL') return id || 'Dış Kaynak';
        return '-';
    };

    // Filter Logic
    const filteredPurchases = useMemo(() => {
        return fuelTransfers
            .filter((t: any) => {
                if (t.fromType !== 'EXTERNAL') return false;

                // Date Filter (Only in Full Mode)
                if (!isWidget && dateRange.start && dateRange.end) {
                    const tDate = new Date(t.date);
                    const start = startOfDay(parseISO(dateRange.start));
                    const end = endOfDay(parseISO(dateRange.end));
                    if (!isWithinInterval(tDate, { start, end })) return false;
                }

                // Site Filter (Only in Full Mode)
                if (!isWidget && selectedSiteId !== 'all') {
                    if (t.toType === 'TANK') {
                        const tank = fuelTanks.find((tk: any) => tk.id === t.toId);
                        if (!tank || tank.siteId !== selectedSiteId) return false;
                    } else {
                        return false;
                    }
                }

                return true;
            })
            .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [fuelTransfers, dateRange, selectedSiteId, fuelTanks, isWidget]);

    const displayPurchases = isWidget ? filteredPurchases.slice(0, 4) : (showAll ? filteredPurchases : filteredPurchases.slice(0, 10));

    // Exports
    const handleExportExcel = () => {
        const data = filteredPurchases.map((t: any) => ({
            Tarih: format(new Date(t.date), 'dd.MM.yyyy HH:mm'),
            Tedarikçi: getEntityName(t.fromType, t.fromId),
            Alan: getEntityName(t.toType, t.toId),
            Miktar: t.amount,
            'Birim Fiyat': t.unitPrice || 0,
            Tutar: t.totalCost || (t.amount * (t.unitPrice || 0))
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Yakıt Alımları");
        XLSX.writeFile(wb, "Yakit_Alimlari.xlsx");
    };

    const handleExportPDF = () => {
        const doc = new jsPDF();
        doc.addFont("https://fonts.gstatic.com/s/roboto/v20/KFOmCnqEu92Fr1Mu4mxP.ttf", "Roboto", "normal");
        doc.setFont("Roboto");

        const tableColumn = ["Tarih", "Tedarikci", "Alan", "Miktar", "Birim Fiyat", "Tutar"];
        const tableRows = filteredPurchases.map((t: any) => [
            format(new Date(t.date), 'dd.MM.yyyy HH:mm'),
            getEntityName(t.fromType, t.fromId),
            getEntityName(t.toType, t.toId),
            `${t.amount.toLocaleString('tr-TR')} Lt`,
            `${(t.unitPrice || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL`,
            `${(t.totalCost || (t.amount * (t.unitPrice || 0))).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL`
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            styles: { font: "Roboto", fontSize: 10 },
            headStyles: { fillColor: [41, 128, 185] }
        });
        doc.save("Yakit_Alimlari.pdf");
    };

    return (
        <>
            <Card className={isWidget ? "border-slate-200 shadow-sm" : "border-0 shadow-none"}>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-lg font-bold text-slate-800">
                        {isWidget ? 'Son Yakıt Alımları' : 'Tüm Yakıt Alımları'}
                    </CardTitle>
                    <div className="flex gap-2">
                        {!isWidget && (
                            <>
                                <Button variant="outline" size="sm" onClick={handleExportExcel} title="Excel İndir">
                                    <FileSpreadsheet className="w-4 h-4 text-green-600" />
                                </Button>
                                <Button variant="outline" size="sm" onClick={handleExportPDF} title="PDF İndir">
                                    <FileDown className="w-4 h-4 text-red-600" />
                                </Button>
                            </>
                        )}
                        {isWidget && (
                            <Button variant="outline" size="sm" onClick={() => setIsFullListOpen(true)} className="text-blue-600 hover:text-blue-700">
                                Tümünü Gör
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Filters - Only in Full Mode */}
                    {!isWidget && (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <div className="flex flex-col gap-1">
                                <Label className="text-xs text-slate-500">Tarih Başlangıç</Label>
                                <Input type="date" className="h-8 bg-white" value={dateRange.start} onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))} />
                            </div>
                            <div className="flex flex-col gap-1">
                                <Label className="text-xs text-slate-500">Tarih Bitiş</Label>
                                <Input type="date" className="h-8 bg-white" value={dateRange.end} onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))} />
                            </div>
                            <div className="flex flex-col gap-1 md:col-span-2">
                                <Label className="text-xs text-slate-500">Şantiye</Label>
                                <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                                    <SelectTrigger className="h-8 bg-white">
                                        <SelectValue placeholder="Tüm Şantiyeler" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tüm Şantiyeler</SelectItem>
                                        {sites.filter((s: any) => s.status === 'ACTIVE').map((s: any) => (
                                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}

                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Tarih</TableHead>
                                <TableHead>Tedarikçi</TableHead>
                                <TableHead></TableHead>
                                <TableHead>Depo</TableHead>
                                <TableHead className="text-right">Miktar</TableHead>
                                <TableHead className="text-right">Birim Fiyat</TableHead>
                                <TableHead className="text-right">Tutar</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {displayPurchases.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                                        Kayıt bulunamadı.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                displayPurchases.map((t: any) => (
                                    <TableRow
                                        key={t.id}
                                        className="cursor-pointer hover:bg-slate-50 transition-colors"
                                        onClick={() => { setSelectedTransfer(t); setIsEditDialogOpen(true); }}
                                    >
                                        <TableCell className="font-mono text-xs">{format(new Date(t.date), 'dd.MM.yyyy HH:mm')}</TableCell>
                                        <TableCell className="font-medium text-slate-700">
                                            {getEntityName(t.fromType, t.fromId)}
                                        </TableCell>
                                        <TableCell>
                                            <ArrowRight className="w-4 h-4 text-slate-400" />
                                        </TableCell>
                                        <TableCell className="font-medium text-slate-700">
                                            {getEntityName(t.toType, t.toId)}
                                        </TableCell>
                                        <TableCell className="text-right font-bold text-slate-900">
                                            {t.amount.toLocaleString('tr-TR')} Lt
                                        </TableCell>
                                        <TableCell className="text-right text-slate-600 font-mono">
                                            {t.unitPrice ? `${t.unitPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺` : '-'}
                                        </TableCell>
                                        <TableCell className="text-right font-medium text-emerald-700 font-mono">
                                            {t.totalCost ? `${t.totalCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺` : (t.amount * (t.unitPrice || 0)).toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ₺'}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>

                    {/* Show More Button - Only in Full Mode (Pagination style) */}
                    {!isWidget && filteredPurchases.length > 10 && (
                        <div className="flex justify-center mt-4 border-t pt-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowAll(!showAll)}
                                className="text-slate-500 hover:text-slate-800 gap-2 w-full sm:w-auto"
                            >
                                {showAll ? (
                                    <>
                                        <ChevronUp className="w-4 h-4" />
                                        Listeyi Küçült
                                    </>
                                ) : (
                                    <>
                                        <ChevronDown className="w-4 h-4" />
                                        Daha Fazla Göster (+{filteredPurchases.length - 10})
                                    </>
                                )}
                            </Button>
                        </div>
                    )}
                </CardContent>

                {selectedTransfer && (
                    <FuelPurchaseEditDialog
                        open={isEditDialogOpen}
                        onOpenChange={setIsEditDialogOpen}
                        transfer={selectedTransfer}
                    />
                )}
            </Card>

            {/* Dialog for Full List */}
            <Dialog open={isFullListOpen} onOpenChange={setIsFullListOpen}>
                <DialogContent className="max-w-[95vw] w-[95vw] max-h-[95vh] h-[95vh] overflow-y-auto p-6">
                    <FuelPurchaseList isWidget={false} />
                </DialogContent>
            </Dialog>
        </>
    );
}
