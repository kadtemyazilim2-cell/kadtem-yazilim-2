'use client';

import { useRouter } from 'next/navigation'; // [FIX] Added import
import { useState } from 'react';
import { useAppStore } from '@/lib/store/use-store';
import { useAuth } from '@/lib/store/use-auth';
import { useUserSites } from '@/hooks/use-user-access';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { FuelForm } from './FuelForm';

export function FuelGivenList() {
    const { fuelLogs, vehicles, sites } = useAppStore();
    const { user } = useAuth();
    const router = useRouter(); // [FIX] Init router
    const [editingLog, setEditingLog] = useState<any>(null);

    if (!user) return null;

    const accessibleSites = useUserSites();
    const accessibleSiteIds = accessibleSites.map((s: any) => s.id);

    // Filter logs created by the current user OR visible to them based on site
    const userLogs = fuelLogs
        // Filter by user ID (User sees their own actions) AND Site Access (Security)
        .filter((log: any) => {
            // 1. Must be filled by this user (Primary condition)
            if (log.filledByUserId !== user.id) return false;

            // 2. [NEW] Must be for a site the user STILL has access to?
            // This prevents seeing logs from sites they were removed from.
            if (!accessibleSiteIds.includes(log.siteId)) return false;

            return true;
        })
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
                <div className="overflow-x-auto">
                    <Table className="text-xs md:text-sm">
                        <TableHeader>
                            <TableRow>
                                <TableHead>Tarih</TableHead>
                                <TableHead>Plaka</TableHead>
                                <TableHead>Şantiye</TableHead>
                                <TableHead className="text-right">Miktar</TableHead>
                                <TableHead className="text-left w-[30px]"></TableHead>
                                <TableHead className="text-right">Km/Saat</TableHead>
                                <TableHead className="text-left w-[50px]"></TableHead>
                                <TableHead className="hidden md:table-cell">Not</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {userLogs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
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
                                        <TableCell className="max-w-[80px] truncate" title={getSiteName(log.siteId)}>{getSiteName(log.siteId)}</TableCell>
                                        <TableCell className="font-bold text-right tabular-nums">{log.liters.toLocaleString('tr-TR')}</TableCell>
                                        <TableCell className="text-left text-muted-foreground">Lt</TableCell>
                                        <TableCell className="text-right tabular-nums">{log.mileage.toLocaleString('tr-TR')}</TableCell>
                                        <TableCell className="text-left text-muted-foreground">Km/Saat</TableCell>
                                        <TableCell className="hidden md:table-cell max-w-[200px] truncate" title={log.description}>
                                            {log.description || '-'}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setEditingLog(log)}
                                                    className="h-8 w-8 text-muted-foreground hover:text-blue-600"
                                                    title="Düzenle"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={async () => {
                                                        if (window.confirm('Bu yakıt kaydını silmek istediğinizden emin misiniz?')) {
                                                            try {
                                                                const { deleteFuelLog } = await import('@/actions/fuel');
                                                                const result = await deleteFuelLog(log.id);
                                                                if (result.success) {
                                                                    // Toast or alert
                                                                    const { toast } = await import('sonner');
                                                                    toast.success('Yakıt kaydı silindi.');
                                                                    router.refresh(); // [FIX] Refresh
                                                                } else {
                                                                    alert(result.error || 'Silinemedi.');
                                                                }
                                                            } catch (error) {
                                                                console.error(error);
                                                                alert('Bir hata oluştu.');
                                                            }
                                                        }
                                                    }}
                                                    className="h-8 w-8 text-muted-foreground hover:text-red-600"
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
                </div>
            </CardContent>

            {editingLog && (
                <FuelForm
                    initialData={editingLog}
                    open={!!editingLog}
                    onOpenChange={(val) => !val && setEditingLog(null)}
                    onSuccess={() => setEditingLog(null)}
                />
            )}
        </Card>
    );
}
