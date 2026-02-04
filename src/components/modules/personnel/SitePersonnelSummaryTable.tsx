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
    const [expandedSites, setExpandedSites] = useState<Record<string, boolean>>({});

    const siteGroups = useMemo(() => {
        // 1. Group active personnel by site
        const groups: Record<string, {
            siteId: string;
            siteName: string;
            personnel: typeof personnel;
            totalSalary: number;
        }> = {};

        // Initialize groups for all active sites to show even empty ones
        sites.filter((s: any) => s.status === 'ACTIVE').forEach((site: any) => {
            groups[site.id] = {
                siteId: site.id,
                siteName: site.name,
                personnel: [],
                totalSalary: 0
            };
        });

        // Add 'Unassigned' group
        groups['unassigned'] = {
            siteId: 'unassigned',
            siteName: 'Atanmamış / Merkez',
            personnel: [],
            totalSalary: 0
        };

        // Distribute personnel
        personnel.filter((p: any) => p.status === 'ACTIVE').forEach((p: any) => {
            const sId = p.siteId || 'unassigned';
            if (!groups[sId]) {
                // If site is passive or deleted but has personnel, create a group for visibility
                const siteName = sites.find((s: any) => s.id === sId)?.name || 'Bilinmeyen Şantiye';
                groups[sId] = {
                    siteId: sId,
                    siteName,
                    personnel: [],
                    totalSalary: 0
                };
            }
            groups[sId].personnel.push(p);
            groups[sId].totalSalary += (parseFloat(p.salary) || 0);
        });

        // Filter out empty 'unassigned' if generic
        if (groups['unassigned'].personnel.length === 0) {
            delete groups['unassigned'];
        }

        return Object.values(groups).sort((a, b) => b.personnel.length - a.personnel.length);
    }, [personnel, sites]);

    const toggleExpand = (siteId: string) => {
        setExpandedSites(prev => ({ ...prev, [siteId]: !prev[siteId] }));
    };

    const grandTotalCount = siteGroups.reduce((sum, g) => sum + g.personnel.length, 0);
    const grandTotalSalary = siteGroups.reduce((sum, g) => sum + g.totalSalary, 0);

    return (
        <Card className="shadow-sm border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b border-slate-100 bg-slate-50/50">
                <div className="space-y-1">
                    <CardTitle className="text-base font-semibold text-slate-700 flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-blue-600" />
                        Şantiye Bazlı Personel Listesi
                    </CardTitle>
                    <p className="text-xs text-slate-500">
                        Şantiyelere göre gruplanmış detaylı personel listesi. Detaylar için satırlara tıklayınız.
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
                            <TableHead className="w-[50px]"></TableHead>
                            <TableHead className="font-semibold text-slate-600">Şantiye Adı</TableHead>
                            <TableHead className="font-semibold text-slate-600 text-center w-[150px]">
                                <div className="flex items-center justify-center gap-2">
                                    <Users className="h-3 w-3" /> Çalışan Sayısı
                                </div>
                            </TableHead>
                            <TableHead className="font-semibold text-slate-600 text-right pr-6 w-[200px]">
                                <div className="flex items-center justify-end gap-2">
                                    <ReceiptTurkishLira className="h-3 w-3" /> Aylık Maliyet
                                </div>
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {siteGroups.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                                    Veri bulunamadı.
                                </TableCell>
                            </TableRow>
                        ) : (
                            siteGroups.map((group) => {
                                const isExpanded = expandedSites[group.siteId];
                                return (
                                    <>
                                        {/* Main Group Row */}
                                        <TableRow
                                            key={group.siteId}
                                            className="hover:bg-slate-50 transition-colors cursor-pointer group"
                                            onClick={() => toggleExpand(group.siteId)}
                                        >
                                            <TableCell className="text-center py-3">
                                                {isExpanded ?
                                                    <ChevronDown className="h-4 w-4 text-slate-400" /> :
                                                    <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-blue-500" />
                                                }
                                            </TableCell>
                                            <TableCell className="font-medium text-slate-700 text-base">
                                                {group.siteName}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="secondary" className="font-mono text-xs">
                                                    {group.personnel.length}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right font-mono font-medium text-slate-700 pr-6">
                                                {group.totalSalary.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                                            </TableCell>
                                        </TableRow>

                                        {/* Expanded Details Row */}
                                        {isExpanded && (
                                            <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-t-0 shadow-inner">
                                                <TableCell colSpan={4} className="p-0">
                                                    <div className="py-2 pl-12 pr-4 animate-in slide-in-from-top-1 duration-200">
                                                        <div className="border rounded-md bg-white overflow-hidden">
                                                            <Table>
                                                                <TableHeader className="bg-slate-100/50">
                                                                    <TableRow className="h-8 border-b border-slate-100">
                                                                        <TableHead className="h-8 text-xs font-semibold">Personel Adı</TableHead>
                                                                        <TableHead className="h-8 text-xs font-semibold">Görevi</TableHead>
                                                                        <TableHead className="h-8 text-xs font-semibold text-right pr-4">Maaş</TableHead>
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    {group.personnel.length === 0 ? (
                                                                        <TableRow>
                                                                            <TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-2">
                                                                                Bu şantiyede atalı personel yok.
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    ) : (
                                                                        group.personnel
                                                                            .sort((a: any, b: any) => a.fullName.localeCompare(b.fullName))
                                                                            .map((p: any) => (
                                                                                <TableRow key={p.id} className="h-9 hover:bg-slate-50 border-0 border-b last:border-0 border-slate-50">
                                                                                    <TableCell className="py-1 text-sm text-slate-700 flex items-center gap-2">
                                                                                        <User className="w-3 h-3 text-slate-400" />
                                                                                        {p.fullName}
                                                                                    </TableCell>
                                                                                    <TableCell className="py-1 text-sm text-slate-500">
                                                                                        {p.profession || '-'}
                                                                                    </TableCell>
                                                                                    <TableCell className="py-1 text-sm text-right font-mono text-slate-600 pr-4">
                                                                                        {parseFloat(p.salary || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                                                                                    </TableCell>
                                                                                </TableRow>
                                                                            ))
                                                                    )}
                                                                </TableBody>
                                                            </Table>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </>
                                );
                            })
                        )}
                        {/* Grand Total Footer */}
                        {siteGroups.length > 0 && (
                            <TableRow className="bg-slate-100 hover:bg-slate-100 border-t-2 border-slate-300">
                                <TableCell></TableCell>
                                <TableCell className="font-bold text-slate-800">GENEL TOPLAM</TableCell>
                                <TableCell className="font-bold text-slate-800 text-center font-mono">
                                    {grandTotalCount}
                                </TableCell>
                                <TableCell className="font-bold text-emerald-700 text-right font-mono pr-6">
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
