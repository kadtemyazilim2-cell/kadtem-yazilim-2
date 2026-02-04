'use client';

import { useState, useMemo } from 'react';
import { useAppStore } from '@/lib/store/use-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { Building2, Users, ReceiptTurkishLira, ChevronDown, ChevronRight, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export function SitePersonnelSummaryTable() {
    const { personnel, sites } = useAppStore();

    const siteGroups = useMemo(() => {
        // 1. Group active personnel by site
        const groups: Record<string, {
            siteId: string;
            siteName: string;
            personnelCount: number;
            totalSalary: number;
        }> = {};

        // Initialize groups for all active sites
        sites.filter((s: any) => s.status === 'ACTIVE').forEach((site: any) => {
            groups[site.id] = {
                siteId: site.id,
                siteName: site.name,
                personnelCount: 0,
                totalSalary: 0
            };
        });

        // Add 'Unassigned' group
        groups['unassigned'] = {
            siteId: 'unassigned',
            siteName: 'Atanmamış / Merkez',
            personnelCount: 0,
            totalSalary: 0
        };

        // Aggregate personnel data
        personnel.filter((p: any) => p.status === 'ACTIVE').forEach((p: any) => {
            const sId = p.siteId || 'unassigned';
            // Handle cases where personnel is assigned to deleted/passive sites
            if (!groups[sId]) {
                const siteName = sites.find((s: any) => s.id === sId)?.name || 'Bilinmeyen Şantiye';
                groups[sId] = {
                    siteId: sId,
                    siteName,
                    personnelCount: 0,
                    totalSalary: 0
                };
            }
            groups[sId].personnelCount += 1;
            groups[sId].totalSalary += (parseFloat(p.salary) || 0);
        });

        // Filter out empty 'unassigned'
        if (groups['unassigned'].personnelCount === 0) {
            delete groups['unassigned'];
        }

        return Object.values(groups).sort((a, b) => b.personnelCount - a.personnelCount);
    }, [personnel, sites]);

    const grandTotalCount = siteGroups.reduce((sum, g) => sum + g.personnelCount, 0);
    const grandTotalSalary = siteGroups.reduce((sum, g) => sum + g.totalSalary, 0);

    return (
        <Card className="shadow-sm border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b border-slate-100 bg-slate-50/50">
                <div className="space-y-1">
                    <CardTitle className="text-base font-semibold text-slate-700 flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-blue-600" />
                        Şantiye Personel Özeti
                    </CardTitle>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead className="font-semibold text-slate-600 pl-6">Şantiye Adı</TableHead>
                            <TableHead className="font-semibold text-slate-600 text-center w-[150px]">
                                <div className="flex items-center justify-center gap-2">
                                    <Users className="h-4 w-4 text-slate-500" /> Çalışan Sayısı
                                </div>
                            </TableHead>
                            <TableHead className="font-semibold text-slate-600 text-right pr-6 w-[200px]">
                                <div className="flex items-center justify-end gap-2">
                                    <ReceiptTurkishLira className="h-4 w-4 text-slate-500" /> Toplam Maaş
                                </div>
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {siteGroups.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center py-8 text-slate-500">
                                    Veri bulunamadı.
                                </TableCell>
                            </TableRow>
                        ) : (
                            siteGroups.map((group) => (
                                <TableRow key={group.siteId} className="hover:bg-slate-50">
                                    <TableCell className="font-medium text-slate-700 pl-6">
                                        {group.siteName}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="secondary" className="font-mono text-sm px-3">
                                            {group.personnelCount}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-medium text-slate-700 pr-6 text-base">
                                        {group.totalSalary.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                        {/* Grand Total Footer */}
                        {siteGroups.length > 0 && (
                            <TableRow className="bg-slate-100 hover:bg-slate-100 border-t-2 border-slate-300">
                                <TableCell className="font-bold text-slate-800 pl-6">GENEL TOPLAM</TableCell>
                                <TableCell className="font-bold text-slate-800 text-center">
                                    <Badge className="font-mono text-sm px-3 bg-slate-800 hover:bg-slate-700">
                                        {grandTotalCount}
                                    </Badge>
                                </TableCell>
                                <TableCell className="font-bold text-emerald-700 text-right font-mono pr-6 text-lg">
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
