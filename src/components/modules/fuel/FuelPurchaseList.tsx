'use client';

import { useState } from 'react'; // [NEW]
import { useAppStore } from '@/lib/store/use-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { ArrowRight } from 'lucide-react';
import { FuelPurchaseEditDialog } from './FuelPurchaseEditDialog'; // [NEW]

export function FuelPurchaseList() {
    const { fuelTransfers, fuelTanks } = useAppStore();
    const [selectedTransfer, setSelectedTransfer] = useState<any>(null); // [NEW]
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false); // [NEW]

    // Helper to resolve Entity Names
    const getEntityName = (type: string, id: string) => {
        if (type === 'TANK') {
            const tank = fuelTanks.find((t: any) => t.id === id);
            return tank?.name || '-';
        }
        if (type === 'VEHICLE') {
            // If purchase goes directly to vehicle (unlikely but possible in schema)
            return 'Araç';
        }
        if (type === 'EXTERNAL') {
            return id || 'Dış Kaynak';
        }
        return '-';
    };

    // Filter only External Purchases
    const purchases = fuelTransfers
        .filter((t: any) => t.fromType === 'EXTERNAL')
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
        <Card>
            <CardHeader>
                <CardTitle>Yakıt Alım Listesi</CardTitle>
            </CardHeader>
            <CardContent>
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
                        {purchases.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                                    Henüz yakıt alım kaydı bulunmamaktadır.
                                </TableCell>
                            </TableRow>
                        ) : (
                            purchases.map((t: any) => (
                                <TableRow
                                    key={t.id}
                                    className="cursor-pointer hover:bg-slate-50" // [NEW] Pointer
                                    onClick={() => { setSelectedTransfer(t); setIsEditDialogOpen(true); }} // [NEW] Click Handler
                                >
                                    <TableCell>{format(new Date(t.date), 'dd.MM.yyyy HH:mm')}</TableCell>
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
                                    <TableCell className="text-right text-slate-600">
                                        {t.unitPrice ? `${t.unitPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺` : '-'}
                                    </TableCell>
                                    <TableCell className="text-right font-medium text-slate-900">
                                        {t.totalCost ? `${t.totalCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺` : (t.amount * (t.unitPrice || 0)).toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ₺'}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>

            {selectedTransfer && (
                <FuelPurchaseEditDialog
                    open={isEditDialogOpen}
                    onOpenChange={setIsEditDialogOpen}
                    transfer={selectedTransfer}
                />
            )}
        </Card>
    );
}
