'use client';

import { useAppStore } from '@/lib/store/use-store';
import { useAuth } from '@/lib/store/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

export function FuelGivenList() {
    const { fuelLogs, vehicles, sites } = useAppStore();
    const { user } = useAuth();

    if (!user) return null;

    // Filter logs created by the current user
    const userLogs = fuelLogs
        // Filter by user ID
        .filter((log: any) => log.filledByUserId === user.id)
        // Sort by date descending (newest first)
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
        // Limit to last 50 entries for performance/relevance
        .slice(0, 50);

    const getVehiclePlate = (id: string) => vehicles.find((v: any) => v.id === id)?.plate || '-';
    const getVehicleBrand = (id: string) => vehicles.find((v: any) => v.id === id)?.brand || '';
    const getSiteName = (id: string) => sites.find((s: any) => s.id === id)?.name || '-';

    return (
        <Card className="mt-6">
            <CardHeader>
                <CardTitle className="text-lg">Son Verdiğiniz Yakıtlar</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Tarih</TableHead>
                            <TableHead>Plaka</TableHead>
                            <TableHead>Şantiye</TableHead>
                            <TableHead>Miktar</TableHead>
                            <TableHead>KM</TableHead>
                            <TableHead className="hidden md:table-cell">Not</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {userLogs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                    Henüz yaptığınız bir yakıt işlemi bulunmuyor.
                                </TableCell>
                            </TableRow>
                        ) : (
                            userLogs.map((log: any) => (
                                <TableRow key={log.id}>
                                    <TableCell className="whitespace-nowrap">
                                        {format(new Date(log.date), 'dd.MM.yyyy HH:mm', { locale: tr })}
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        {getVehiclePlate(log.vehicleId)} <span className="text-xs text-muted-foreground hidden sm:inline">({getVehicleBrand(log.vehicleId)})</span>
                                    </TableCell>
                                    <TableCell>{getSiteName(log.siteId)}</TableCell>
                                    <TableCell className="font-bold">{log.liters} Lt</TableCell>
                                    <TableCell>{log.mileage} km</TableCell>
                                    <TableCell className="hidden md:table-cell max-w-[200px] truncate" title={log.description}>
                                        {log.description || '-'}
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
