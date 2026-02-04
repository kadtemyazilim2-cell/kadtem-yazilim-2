'use client';

import { useEffect, useState } from 'react';
import { getPersonnelSiteSummary } from '@/actions/personnel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { Building2, Users, ReceiptTurkishLira } from 'lucide-react';
import { toast } from 'sonner';

interface SiteSummary {
    id: string;
    name: string;
    count: number;
    totalSalary: number;
}

export function SitePersonnelSummaryTable() {
    const [summary, setSummary] = useState<SiteSummary[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchSummary = async () => {
        setLoading(true);
        const res = await getPersonnelSiteSummary();
        if (res.success && res.data) {
            setSummary(res.data);
        } else {
            toast.error(res.error || 'Özet verileri alınamadı.');
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchSummary();
    }, []);

    const grandTotalCount = summary.reduce((sum, s) => sum + s.count, 0);
    const grandTotalSalary = summary.reduce((sum, s) => sum + s.totalSalary, 0);

    return (
        <Card className="shadow-sm border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b border-slate-100 bg-slate-50/50">
                <div className="space-y-1">
                    <CardTitle className="text-base font-semibold text-slate-700 flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-blue-600" />
                        Şantiye Personel Özeti
                    </CardTitle>
                    <p className="text-xs text-slate-500">
                        Şantiyelere göre çalışan sayısı ve net maaş toplamları.
                    </p>
                </div>
                <div className="flex items-center gap-4 text-sm">
                    <div className="flex flex-col items-end">
                        <span className="text-slate-500 text-xs font-medium">Toplam Çalışan</span>
                        <span className="font-bold text-slate-700">{grandTotalCount} Kişi</span>
                    </div>
                    <div className="w-px h-8 bg-slate-200" />
                    <div className="flex flex-col items-end">
                        <span className="text-slate-500 text-xs font-medium">Genel Toplam</span>
                        <span className="font-bold text-emerald-600 font-mono">
                            {grandTotalSalary.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                        </span>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead className="font-semibold text-slate-600 pl-4">Şantiye Adı</TableHead>
                            <TableHead className="font-semibold text-slate-600 text-center w-[150px]">
                                <div className="flex items-center justify-center gap-2">
                                    <Users className="h-3 w-3" /> Çalışan Sayısı
                                </div>
                            </TableHead>
                            <TableHead className="font-semibold text-slate-600 text-right pr-4 w-[200px]">
                                <div className="flex items-center justify-end gap-2">
                                    <ReceiptTurkishLira className="h-3 w-3" /> Aylık Toplam Maaş
                                </div>
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center py-8 text-slate-500">
                                    Yükleniyor...
                                </TableCell>
                            </TableRow>
                        ) : summary.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center py-8 text-slate-500">
                                    Veri bulunamadı.
                                </TableCell>
                            </TableRow>
                        ) : (
                            summary.map((site) => (
                                <TableRow key={site.id} className="hover:bg-slate-50 transition-colors">
                                    <TableCell className="font-medium text-slate-700 pl-4">
                                        {site.name}
                                    </TableCell>
                                    <TableCell className="text-center font-mono text-slate-600">
                                        {site.count}
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-medium text-slate-700 pr-4">
                                        {site.totalSalary.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                                    </TableCell>
                                </TableRow>
                            ))
                        )}

                        {!loading && summary.length > 0 && (
                            <TableRow className="bg-slate-50/80 border-t-2 border-slate-200">
                                <TableCell className="font-bold text-slate-800 pl-4">GENEL TOPLAM</TableCell>
                                <TableCell className="font-bold text-slate-800 text-center font-mono">
                                    {grandTotalCount}
                                </TableCell>
                                <TableCell className="font-bold text-emerald-700 text-right font-mono pr-4">
                                    {grandTotalSalary.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
