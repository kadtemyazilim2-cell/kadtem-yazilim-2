'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { FileText, MapPin, Calendar, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface SiteLogSummaryProps {
    siteLogEntries: any[];
    sites: any[];
    users: any[];
}

export function SiteLogSummary({ siteLogEntries, sites, users }: SiteLogSummaryProps) {
    // Filter Active Sites
    const activeSites = sites.filter(s => s.status === 'ACTIVE' && !s.finalAcceptanceDate);

    // Group logs by site
    const logsBySite = activeSites.reduce((acc: any, site: any) => {
        const siteLogs = siteLogEntries
            .filter((e: any) => e.siteId === site.id)
            .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 5); // Take last 5

        if (siteLogs.length > 0) {
            acc.push({
                site,
                logs: siteLogs
            });
        }
        return acc;
    }, []);

    if (logsBySite.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-600" />
                        Şantiye Günlük DefteriÖzetleri
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 text-slate-500 text-sm">
                        Henüz aktif şantiyeler için kayıt bulunmamaktadır.
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold tracking-tight text-slate-800">Şantiye Günlük Defteri (Son 5 Gün)</h3>
                <Button variant="outline" size="sm" asChild>
                    <Link href="/dashboard/site-log">Tümünü Gör</Link>
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {logsBySite.map(({ site, logs }: any) => (
                    <Card key={site.id} className="flex flex-col h-full border-blue-100 shadow-sm hover:shadow-md transition-shadow">
                        <CardHeader className="pb-2 bg-blue-50/50 border-b border-blue-50 rounded-t-lg">
                            <CardTitle className="text-sm font-bold text-blue-900 flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-blue-500" />
                                <span className="truncate" title={site.name}>{site.name}</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-3 flex-1">
                            <div className="space-y-3">
                                {logs.map((log: any) => {
                                    const author = users.find((u: any) => u.id === log.authorId);
                                    return (
                                        <div key={log.id} className="relative pl-3 border-l-2 border-slate-200">
                                            <div className="text-xs text-slate-500 mb-0.5 flex items-center justify-between">
                                                <span className="flex items-center gap-1 font-medium text-slate-600">
                                                    <Calendar className="w-3 h-3" />
                                                    {format(new Date(log.date), 'dd MMM', { locale: tr })}
                                                </span>
                                                {log.weather && (
                                                    <span className="text-[10px] bg-slate-100 px-1 rounded text-slate-500 max-w-[80px] truncate" title={log.weather}>
                                                        {log.weather}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-700 line-clamp-2 leading-relaxed" title={log.content}>
                                                {log.content}
                                            </p>
                                            <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
                                                <User className="w-3 h-3" />
                                                <span className="truncate">{author?.name || 'Bilinmeyen'}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
