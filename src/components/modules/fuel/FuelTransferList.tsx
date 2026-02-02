'use client';

import { useAppStore } from '@/lib/store/use-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, parseISO } from 'date-fns';
import { ArrowRight } from 'lucide-react';

export function FuelTransferList() {
    const { fuelTransfers, fuelTanks, sites, vehicles, users } = useAppStore(); // [FIX] Added users

    // Helper to resolve Site Name from Entity ID
    const getEntityName = (type: string, id: string) => {
        if (type === 'TANK') {
            const tank = fuelTanks.find((t: any) => t.id === id);
            return tank?.name || '-';
        }
        if (type === 'EXTERNAL') {
            return id || 'Dış Kaynak';
        }
        return '-';
    };

    // [NEW] Helper for Author
    const getAuthorName = (id: string) => users.find((u: any) => u.id === id)?.name || 'Bilinmeyen';

    // Filter only Internal Transfers (Virman) -> Exclude External Purchases
    const transfers = fuelTransfers
        .filter((t: any) => t.fromType !== 'EXTERNAL')
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
        <Card>
            <CardHeader>
                <CardTitle>Yakıt Virman (Transfer) Listesi</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Tarih</TableHead>
                            <TableHead>Yakıtı Veren (Personel)</TableHead>
                            <TableHead>Çıkış Deposu</TableHead>
                            <TableHead></TableHead>
                            <TableHead>Varış Yeri (Depo)</TableHead>
                            <TableHead className="text-right">Miktar</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {transfers.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                    Henüz virman kaydı bulunmamaktadır.
                                </TableCell>
                            </TableRow>
                        ) : (
                            transfers.map((t: any) => (
                                <TableRow key={t.id}>
                                    <TableCell>{format(new Date(t.date), 'dd.MM.yyyy HH:mm')}</TableCell>
                                    <TableCell className="font-medium text-slate-700">
                                        {getAuthorName(t.createdByUserId)}
                                    </TableCell>
                                    <TableCell className="font-medium text-slate-600">
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
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
