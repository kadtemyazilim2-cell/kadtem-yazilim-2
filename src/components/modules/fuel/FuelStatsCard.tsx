import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button'; // [NEW]
import { Droplet, ArrowRightLeft, Fuel, Truck, TrendingDown, Factory, FileDown, FileSpreadsheet } from 'lucide-react'; // [NEW] Icons
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
// jsPDF, autoTable, and XLSX are imported dynamically inside handlers to prevent SSR crashes

interface FuelStatsCardProps {
    siteId: string;
    startDate: string;
    endDate: string;
    fuelTransfers: any[];
    fuelLogs: any[];
    fuelTanks: any[];
    sites: any[];
}

export function FuelStatsCard({
    siteId,
    startDate,
    endDate,
    fuelTransfers,
    fuelLogs,
    fuelTanks,
    sites
}: FuelStatsCardProps) {

    const siteName = sites.find(s => s.id === siteId)?.name || 'Şantiye';

    const stats = useMemo(() => {
        // ... (existing logic same as before, re-using for brevity if tool allows default keeping, but I will copy-paste known logic to be safe)
        // [Existing Logic Start]
        let capacity = 0;
        let purchased = 0;
        let transferredIn = 0;
        let transferredOut = 0;
        let consumed = 0;
        let remaining = 0;

        const siteTanks = fuelTanks.filter(t => !siteId || t.siteId === siteId);
        const siteTankIds = siteTanks.map(t => t.id);

        capacity = siteTanks.reduce((acc, t) => acc + t.capacity, 0);
        remaining = siteTanks.reduce((acc, t) => acc + t.currentLevel, 0);

        const start = startDate ? startOfDay(parseISO(startDate)) : null;
        const end = endDate ? endOfDay(parseISO(endDate)) : null;

        const dateFilter = (dateStr: string) => {
            if (!startDate && !endDate) return true;
            const d = parseISO(dateStr);
            if (start && d < start) return false;
            if (end && d > end) return false;
            return true;
        };

        const relevantPurchases = fuelTransfers.filter(t =>
            t.fromType === 'EXTERNAL' && t.toType === 'TANK' &&
            siteTankIds.includes(t.toId) && dateFilter(t.date)
        );
        purchased = relevantPurchases.reduce((acc, t) => acc + t.amount, 0);

        const relevantTransfersIn = fuelTransfers.filter(t =>
            t.fromType === 'TANK' && t.toType === 'TANK' &&
            siteTankIds.includes(t.toId) && !siteTankIds.includes(t.fromId) &&
            dateFilter(t.date)
        );
        transferredIn = relevantTransfersIn.reduce((acc, t) => acc + t.amount, 0);

        const relevantTransfersOut = fuelTransfers.filter(t =>
            t.fromType === 'TANK' && t.toType === 'TANK' &&
            siteTankIds.includes(t.fromId) && !siteTankIds.includes(t.toId) &&
            dateFilter(t.date)
        );
        transferredOut = relevantTransfersOut.reduce((acc, t) => acc + t.amount, 0);

        const relevantLogs = fuelLogs.filter(l =>
            l.siteId === siteId &&
            dateFilter(l.date)
        );
        consumed = relevantLogs.reduce((acc, l) => acc + l.liters, 0);

        return { capacity, purchased, transferredIn, transferredOut, consumed, remaining };
        // [Existing Logic End]
    }, [siteId, startDate, endDate, fuelTransfers, fuelLogs, fuelTanks]);

    // Formatters
    const fmt = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtWithUnit = (n: number) => fmt(n) + ' lt';

    const handleExportPDF = async () => {
        try {
            const { default: jsPDF } = await import('jspdf');
            const { default: autoTable } = await import('jspdf-autotable');
            const doc = new jsPDF();

            doc.setFontSize(16);
            doc.text(`${siteName} - Yakıt Özeti`, 14, 20);

            doc.setFontSize(10);
            doc.text(`Tarih Aralığı: ${startDate || 'Başlangıç Yok'} - ${endDate || 'Bitiş Yok'}`, 14, 28);
            doc.text(`Oluşturulma Tarihi: ${new Date().toLocaleDateString('tr-TR')}`, 14, 34);

            const tableData = [
                ['Depo Kapasite', fmtWithUnit(stats.capacity)],
                ['Akaryakıt İst. Alınan', `+${fmtWithUnit(stats.purchased)}`],
                ['Virmanla Gelen', `+${fmtWithUnit(stats.transferredIn)}`],
                ['Şantiyeye Gönderilen', `-${fmtWithUnit(stats.transferredOut)}`],
                ['Harcanan', `-${fmtWithUnit(stats.consumed)}`],
                ['Depoda Kalan', fmtWithUnit(stats.remaining)]
            ];

            autoTable(doc, {
                startY: 40,
                head: [['Başlık', 'Değer']],
                body: tableData,
                theme: 'grid',
                headStyles: { fillColor: [41, 128, 185] },
            });

            doc.save(`${siteName}_yakit_ozeti.pdf`);
        } catch (error) {
            console.error('PDF export error:', error);
            alert('PDF oluşturulurken hata oluştu.');
        }
    };

    const handleExportExcel = async () => {
        try {
            const XLSX = await import('xlsx');
            const wb = XLSX.utils.book_new();

            const data = [
                { Baslik: 'Rapor', Deger: `${siteName} - Yakıt Özeti` },
                { Baslik: 'Tarih Aralığı', Deger: `${startDate || '-'} / ${endDate || '-'}` },
                { Baslik: '', Deger: '' },
                { Baslik: 'Depo Kapasite', Deger: stats.capacity },
                { Baslik: 'Akaryakıt İst. Alınan', Deger: stats.purchased },
                { Baslik: 'Virmanla Gelen', Deger: stats.transferredIn },
                { Baslik: 'Şantiyeye Gönderilen', Deger: stats.transferredOut },
                { Baslik: 'Harcanan', Deger: stats.consumed },
                { Baslik: 'Depoda Kalan', Deger: stats.remaining },
            ];

            const ws = XLSX.utils.json_to_sheet(data);
            ws['!cols'] = [{ wch: 30 }, { wch: 20 }];

            XLSX.utils.book_append_sheet(wb, ws, "Yakıt Özeti");
            XLSX.writeFile(wb, `${siteName}_yakit_ozeti.xlsx`);
        } catch (error) {
            console.error('Excel export error:', error);
            alert('Excel oluşturulurken hata oluştu.');
        }
    };

    if (!siteId) return null;

    return (
        <Card className="bg-slate-50 border-slate-200 shadow-sm mb-6">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                    <Factory className="w-5 h-5 text-slate-500" />
                    {siteName} - Yakıt Özeti
                </CardTitle>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-2 h-8" onClick={handleExportExcel}>
                        <FileSpreadsheet className="w-4 h-4 text-green-600" /> Excel
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2 h-8" onClick={handleExportPDF}>
                        <FileDown className="w-4 h-4 text-red-600" /> PDF
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                    {/* Capacity */}
                    <div className="flex flex-col p-3 bg-white rounded-lg border shadow-sm">
                        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Depo Kapasite</span>
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-blue-100 rounded-md">
                                <Droplet className="w-4 h-4 text-blue-600" />
                            </div>
                            <span className="text-lg font-bold text-slate-700">{fmtWithUnit(stats.capacity)}</span>
                        </div>
                    </div>

                    {/* External Purchase */}
                    <div className="flex flex-col p-3 bg-white rounded-lg border shadow-sm">
                        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Akaryakıt İst. Alınan</span>
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-green-100 rounded-md">
                                <Fuel className="w-4 h-4 text-green-600" />
                            </div>
                            <span className="text-lg font-bold text-green-600">+{fmtWithUnit(stats.purchased)}</span>
                        </div>
                    </div>

                    {/* Transfer In */}
                    <div className="flex flex-col p-3 bg-white rounded-lg border shadow-sm">
                        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Virmanla Gelen</span>
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-emerald-100 rounded-md">
                                <ArrowRightLeft className="w-4 h-4 text-emerald-600" />
                            </div>
                            <span className="text-lg font-bold text-emerald-600">+{fmtWithUnit(stats.transferredIn)}</span>
                        </div>
                    </div>

                    {/* Transfer Out */}
                    <div className="flex flex-col p-3 bg-white rounded-lg border shadow-sm">
                        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Şantiyeye Gönderilen</span>
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-orange-100 rounded-md">
                                <ArrowRightLeft className="w-4 h-4 text-orange-600" />
                            </div>
                            <span className="text-lg font-bold text-orange-600">-{fmtWithUnit(stats.transferredOut)}</span>
                        </div>
                    </div>

                    {/* Consumed */}
                    <div className="flex flex-col p-3 bg-white rounded-lg border shadow-sm">
                        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Harcanan</span>
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-red-100 rounded-md">
                                <Truck className="w-4 h-4 text-red-600" />
                            </div>
                            <span className="text-lg font-bold text-red-600">-{fmtWithUnit(stats.consumed)}</span>
                        </div>
                    </div>

                    {/* Remaining */}
                    <div className="flex flex-col p-3 bg-white rounded-lg border shadow-sm border-l-4 border-l-blue-500">
                        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Depoda Kalan</span>
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-slate-100 rounded-md">
                                <TrendingDown className="w-4 h-4 text-slate-600" />
                            </div>
                            <span className="text-lg font-bold text-slate-800">{fmtWithUnit(stats.remaining)}</span>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
