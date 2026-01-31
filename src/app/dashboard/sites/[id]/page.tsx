'use client';

import { useAppStore } from '@/lib/store/use-store';
import { SiteLogList } from '@/components/modules/site-log/SiteLogList';
import { CashBookList } from '@/components/modules/cash-book/CashBookList';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SiteDetailPage({ params }: { params: { id: string } }) {
    const { sites } = useAppStore();
    const router = useRouter();
    const site = sites.find((s: any) => s.id === params.id);

    if (!site) {
        return <div className="p-6">Şantiye bulunamadı.</div>;
    }

    return (
        <div className="space-y-6 p-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" onClick={() => router.back()}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Geri
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">{site.name}</h1>
                    <p className="text-muted-foreground">{site.location || 'Konum belirtilmemiş'}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {/* Site Log Section */}
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold">Şantiye Defteri</h2>
                    <SiteLogList siteId={site.id} />
                </div>

                {/* Expenses Section */}
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold">Şantiye Giderleri</h2>
                    <CashBookList siteId={site.id} type="EXPENSE" />
                </div>
            </div>
        </div>
    );
}
