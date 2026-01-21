'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppStore } from '@/lib/store/use-store';
import { FileText, Wallet, Droplet, Users, AlertTriangle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SiteStockOverview } from '@/components/modules/dashboard/SiteStockOverview';
import { DailyFuelChart } from '@/components/modules/dashboard/DailyFuelChart';
import { useUserSites } from '@/hooks/use-user-access';
import { useAuth } from '@/lib/store/use-auth';
import { useRouter } from 'next/navigation';
import { format, isSameMonth, differenceInDays, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useMemo, useState } from 'react';
import { InsuranceProposalDialog } from '@/components/modules/dashboard/InsuranceProposalDialog';
import { cn } from '@/lib/utils';

export default function DashboardPage() {
    const { companies, vehicles, correspondences, yiUfeRates, cashTransactions, personnel, fuelLogs, fuelTransfers, sites, fuelTanks, siteLogEntries } = useAppStore();
    const userSites = useUserSites();
    const { user, hasPermission } = useAuth(); // To check if admin for other things if needed
    const router = useRouter();

    // ... (rest of code)



    // Calculate Latest Yi-UFE
    const latestYiUfe = yiUfeRates.length > 0
        ? [...yiUfeRates].sort((a, b) => {
            if (a.year !== b.year) return b.year - a.year;
            return b.month - a.month;
        })[0]
        : null;

    // Get Missing Reference Numbers (excluding BANK) - Only show to creator
    const missingDocs = correspondences.filter((c: any) => c.type !== 'BANK' && (!c.referenceNumber || c.referenceNumber.trim() === '') && c.createdByUserId === user?.id);

    // 1. Financial Status (Balance per User)
    const { users } = useAppStore();
    const userBalances = useMemo(() => {
        const balances: Record<string, number> = {};

        cashTransactions.forEach((t: any) => {
            const amount = t.type === 'INCOME' ? t.amount : -t.amount;
            const targetUser = t.responsibleUserId || t.createdByUserId;
            balances[targetUser] = (balances[targetUser] || 0) + amount;
        });

        return Object.entries(balances)
            .map(([userId, balance]) => {
                const user = users.find((u: any) => u.id === userId);
                return {
                    id: userId,
                    name: user?.name || 'Bilinmeyen Kullanıcı',
                    balance
                };
            })
            .filter(u => u.balance !== 0) // Only show non-zero balances
            .sort((a, b) => b.balance - a.balance);
    }, [cashTransactions, users]);

    // 2. Fuel Consumption (This Month per Site)
    // const { sites } = useAppStore(); // Already destructured at top
    const siteConsumption = useMemo(() => {
        const currentMonth = new Date();
        const consumption: Record<string, number> = {};

        fuelLogs
            .filter((log: any) => isSameMonth(new Date(log.date), currentMonth))
            .forEach((log: any) => {
                consumption[log.siteId] = (consumption[log.siteId] || 0) + (Number(log.liters) || 0);
            });

        return Object.entries(consumption)
            .map(([siteId, liters]) => {
                const site = sites.find((s: any) => s.id === siteId);
                if (!site || site.status !== 'ACTIVE' || site.finalAcceptanceDate) return null; // [MOD] Filter Passive & Finalized Sites
                return {
                    id: siteId,
                    name: site.name,
                    liters
                };
            })
            .filter((s): s is { id: string; name: string; liters: number } => s !== null && s.liters > 0)
            .sort((a, b) => b.liters - a.liters);
    }, [fuelLogs, sites]);

    // 3. Personnel Count (Assigned Active Personnel per Site)
    // personnel is already destructured at the top
    const sitePersonnelCounts = useMemo(() => {
        const counts: Record<string, number> = {};

        // Initialize counts for all sites
        sites.forEach((site: any) => {
            counts[site.id] = 0;
        });

        // Count ACTIVE personnel allocated to each site
        personnel.forEach((p: any) => {
            if (p.status !== 'LEFT' && p.siteId && counts[p.siteId] !== undefined) {
                counts[p.siteId]++;
            }
        });

        return Object.entries(counts)
            .map(([siteId, count]) => {
                const site = sites.find((s: any) => s.id === siteId);
                if (!site || site.status !== 'ACTIVE' || site.finalAcceptanceDate) return null; // [MOD] Filter Finalized
                return {
                    id: siteId,
                    name: site.name,
                    count
                };
            })
            .filter((pc): pc is { id: string; name: string; count: number } => pc !== null && pc.count > 0)
            .sort((a, b) => b.count - a.count);
    }, [personnel, sites]);

    // 4. Upcoming Insurance/Kasko Expirations
    const upcomingExpirations = useMemo(() => {
        const today = new Date();
        const alerts: any[] = [];

        vehicles.forEach((v: any) => {
            if (v.status === 'SOLD' || v.status === 'PASSIVE') return; // [MOD] Exclude PASSIVE
            if (v.ownership === 'RENTAL') return; // [NEW] Exclude Rentals from Insurance Alerts

            // Insurance
            if (v.insuranceExpiry) {
                const date = parseISO(v.insuranceExpiry);
                const days = differenceInDays(date, today);
                if (days <= 15) {
                    alerts.push({
                        id: v.id + '-ins',
                        vehicleId: v.id, // [NEW] for lookup
                        plate: v.plate,
                        type: 'Trafik Sigortası',
                        days,
                        date: v.insuranceExpiry,
                        agencyName: v.insuranceAgency,
                        vehicleBrand: v.brand,
                        vehicleModel: v.model
                    });
                }
            }
            // Kasko
            if (v.kaskoExpiry) {
                const date = parseISO(v.kaskoExpiry);
                const days = differenceInDays(date, today);
                if (days <= 15) {
                    alerts.push({
                        id: v.id + '-kas',
                        vehicleId: v.id,
                        plate: v.plate,
                        type: 'Kasko',
                        days,
                        date: v.kaskoExpiry,
                        agencyName: v.kaskoAgency,
                        vehicleBrand: v.brand,
                        vehicleModel: v.model
                    });
                }
            }

            // [NEW] Inspection (Muayene)
            if (v.inspectionExpiry) {
                const date = parseISO(v.inspectionExpiry);
                const days = differenceInDays(date, today);
                if (days <= 15) {
                    alerts.push({
                        id: v.id + '-insp',
                        vehicleId: v.id,
                        plate: v.plate,
                        type: 'Muayene',
                        days,
                        date: v.inspectionExpiry,
                        agencyName: 'TÜVTÜRK', // Default or N/A
                        vehicleBrand: v.brand,
                        vehicleModel: v.model
                    });
                }
            }
        });

        return alerts.sort((a, b) => a.days - b.days);
    }, [vehicles]);



    // 5. Incoming Fuel Purchases (Last 30 Days)
    const incomingFuelPurchases = useMemo(() => {
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);

        // 1. Get External Fuel Transfers (Purchase via Transfer)
        const transfers = fuelTransfers
            .filter((t: any) => t.fromType === 'EXTERNAL' && new Date(t.date) >= thirtyDaysAgo)
            .map((t: any) => {
                let siteName = '-';
                // Resolve To Entity Name
                if (t.toType === 'TANK') {
                    const tank = fuelTanks.find((tank: any) => tank.id === t.toId);
                    const site = sites.find((s: any) => s.id === tank?.siteId);
                    siteName = site?.name || tank?.name || 'Bilinmeyen Depo';
                } else if (t.toType === 'VEHICLE') {
                    const vehicle = vehicles.find((v: any) => v.id === t.toId);
                    const site = sites.find((s: any) => s.id === vehicle?.assignedSiteId);
                    siteName = `${vehicle?.plate} (${site?.name || '-'})`;
                }

                // Calculate Price/Cost robustly
                const amount = Number(t.amount) || 0;
                const unitPrice = Number(t.unitPrice) || 0;
                const explicitCost = Number(t.totalCost) || 0;

                let finalCost = explicitCost;
                if (finalCost === 0 && amount > 0 && unitPrice > 0) {
                    finalCost = amount * unitPrice;
                }

                let finalUnitPrice = unitPrice;
                if (finalUnitPrice === 0 && amount > 0 && finalCost > 0) {
                    finalUnitPrice = finalCost / amount;
                }

                return {
                    id: t.id,
                    date: t.date,
                    supplier: t.fromId, // Contains company name for EXTERNAL
                    target: siteName,
                    amount: t.amount,
                    unitPrice: finalUnitPrice,
                    cost: finalCost,
                    type: 'TRANSFER' // For debugging/icon potentially
                };
            });

        // 2. Get External Fuel Logs (Direct Purchase to Vehicle)
        // If tankId is missing, it implies external purchase or unknown source. 
        // We assume logs without tankId are external purchases in this context.
        const directPurchases = fuelLogs
            .filter((l: any) => !l.tankId && new Date(l.date) >= thirtyDaysAgo)
            .map((l: any) => {
                const vehicle = vehicles.find((v: any) => v.id === l.vehicleId);
                const site = sites.find((s: any) => s.id === l.siteId);
                const siteName = `${vehicle?.plate} (${site?.name || '-'})`;

                // Calculate Unit Price if missing
                let finalUnitPrice = l.unitPrice || 0;
                // FuelLog always has cost, but just in case check for unitPrice fallback
                if (finalUnitPrice === 0 && l.cost > 0 && l.liters > 0) {
                    finalUnitPrice = l.cost / l.liters;
                }

                return {
                    id: l.id,
                    date: l.date,
                    supplier: 'Dış Kaynak', // Logs don't strictly have supplier name field yet, defaulting
                    target: siteName,
                    amount: l.liters,
                    unitPrice: finalUnitPrice,
                    cost: l.cost,
                    type: 'LOG'
                };
            });

        // 3. Merge and Sort
        return [...transfers, ...directPurchases]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    }, [fuelTransfers, fuelLogs, fuelTanks, sites, vehicles]);

    const [selectedAlertForMail, setSelectedAlertForMail] = useState<any>(null);

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Genel Bakış</h1>

            {/* Top Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* Financial Status List Card */}
                <Card className="bg-emerald-50 border-emerald-100 border shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-600">
                            Şantiye Kasaları (Personel)
                        </CardTitle>
                        <Wallet className="h-4 w-4 text-emerald-600" />
                    </CardHeader>
                    <CardContent className="pt-2">
                        {userBalances.length === 0 ? (
                            <div className="text-sm text-slate-500">Bakiye yok.</div>
                        ) : (
                            <div className="space-y-2">
                                {userBalances.map((u) => (
                                    <div key={u.id} className="flex items-center justify-between text-sm p-2 border-b last:border-0 border-slate-100">
                                        <span className="font-medium text-slate-700">{u.name}</span>
                                        <span className={cn("font-bold font-mono", u.balance < 0 ? "text-red-600" : "text-emerald-700")}>
                                            {u.balance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Fuel Consumption List Card */}
                {/* Fuel Consumption Card Removed */}
                {/* <Card className="bg-amber-50 border-amber-100 border shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-600">
                            Yakıt Tüketimi (Bu Ay)
                        </CardTitle>
                        <Droplet className="h-4 w-4 text-amber-600" />
                    </CardHeader>
                    <CardContent className="pt-2">
                        {siteConsumption.length === 0 ? (
                            <div className="text-sm text-slate-500">Bu ay tüketim yok.</div>
                        ) : (
                            <div className="space-y-2">
                                {siteConsumption.map((s) => (
                                    <div key={s.id} className="flex items-center justify-between text-sm">
                                        <span className="font-medium text-slate-700 line-clamp-1 mr-2" title={s.name}>{s.name}</span>
                                        <span className="font-bold font-mono text-amber-700 whitespace-nowrap">
                                            {s.liters.toLocaleString('tr-TR')} Lt
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card> */}
                {/* Personnel Count List Card */}
                {/* Personnel Count Card Removed */}
                {/* <Card className="bg-blue-50 border-blue-100 border shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-600">
                            Personel Sayısı (Bu Ay)
                        </CardTitle>
                        <Users className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent className="pt-2">
                        {sitePersonnelCounts.length === 0 ? (
                            <div className="text-sm text-slate-500">Bu ay çalışan kaydı yok.</div>
                        ) : (
                            <div className="space-y-2">
                                {sitePersonnelCounts.map((s) => (
                                    <div key={s.id} className="flex items-center justify-between text-sm">
                                        <span className="font-medium text-slate-700">{s.name}</span>
                                        <span className="font-bold font-mono text-blue-700">
                                            {s.count} Kişi
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card> */}

                {/* Insurance Alerts Card */}
                <Card className="bg-red-50 border-red-100 border shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-600">
                            Yaklaşan Ödemeler (Sigorta/Kasko/Muayene)
                        </CardTitle>
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                    </CardHeader>
                    <CardContent className="pt-2">
                        {upcomingExpirations.length === 0 ? (
                            <div className="text-sm text-slate-500">Yaklaşan ödeme bulunmuyor.</div>
                        ) : (
                            <div className="space-y-2">
                                {upcomingExpirations.map((item) => (
                                    <div
                                        key={item.id}
                                        className="flex items-center justify-between text-sm p-2 rounded hover:bg-slate-100 cursor-pointer transition-colors border border-transparent hover:border-slate-200"
                                        onClick={() => setSelectedAlertForMail(item)}
                                        title="Acenteye Mail Gönder"
                                    >
                                        <div className="flex flex-col">
                                            <span className="font-bold font-mono text-slate-800">{item.plate}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-slate-500">{item.type}</span>
                                                <span className="text-[10px] text-slate-400">• {item.agencyName || 'Acente Yok'}</span>
                                            </div>
                                        </div>
                                        <span className={`font-bold ${item.days <= 7 ? 'text-red-700 animate-pulse' : 'text-orange-600'}`}>
                                            {item.days < 0 ? `${Math.abs(item.days)} Gün Geçti!` : `${item.days} Gün Kaldı`}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Site Fuel Stocks Removed as per request */}
            {/* <div className="grid gap-4" >
                <SiteStockOverview tanks={fuelTanks} sites={userSites.filter(s => s.status === 'ACTIVE' && !s.finalAcceptanceDate)} />
            </div> */}

            {/* Incoming Fuel Purchases Widget */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
                <Card className="col-span-2 border-emerald-100 shadow-sm">
                    <CardHeader className="pb-3 border-b border-emerald-50 bg-emerald-50/30">
                        <CardTitle className="flex items-center gap-2 text-emerald-800">
                            <Droplet className="h-5 w-5 text-emerald-600" />
                            Gelen Yakıt Hareketleri (Son 30 Gün)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {incomingFuelPurchases.length === 0 ? (
                            <div className="text-center py-6 text-slate-500 text-sm">
                                Son 30 günde dışarıdan yakıt alımı bulunmuyor.
                            </div>
                        ) : (
                            <div className="relative w-full overflow-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-500 font-medium">
                                        <tr>
                                            <th className="p-3">Tarih</th>
                                            <th className="p-3">Tedarikçi Firma</th>
                                            <th className="p-3">Gelen Yer / Şantiye</th>
                                            <th className="p-3 text-right">Miktar</th>
                                            <th className="p-3 text-right">Birim Fiyat</th> {/* [NEW] */}
                                            <th className="p-3 text-right">Tutar</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {incomingFuelPurchases.map((item) => (
                                            <tr key={item.id} className="hover:bg-slate-50/50">
                                                <td className="p-3 font-medium text-slate-700">
                                                    {format(new Date(item.date), 'dd MMM yyyy', { locale: tr })}
                                                </td>
                                                <td className="p-3 text-slate-600 font-semibold">{item.supplier}</td>
                                                <td className="p-3 text-slate-600 max-w-[200px] truncate" title={item.target}>
                                                    {item.target}
                                                </td>
                                                <td className="p-3 text-right font-mono font-bold text-amber-600">
                                                    {item.amount.toLocaleString('tr-TR')} Lt
                                                </td>
                                                <td className="p-3 text-right font-mono font-medium text-slate-600">
                                                    {item.unitPrice !== undefined ? `${item.unitPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺` : '-'}
                                                </td>
                                                <td className="p-3 text-right font-mono font-bold text-emerald-600">
                                                    {item.cost !== undefined ? `${item.cost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺` : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <DailyFuelChart fuelLogs={fuelLogs} fuelTransfers={fuelTransfers} fuelTanks={fuelTanks} sites={userSites} vehicles={vehicles} />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4 border-red-200 shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-red-700">
                            <FileText className="h-5 w-5" />
                            Eksik Evrak Numaraları
                            <span className="ml-auto text-sm font-normal text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                                {missingDocs.length} Adet
                            </span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {missingDocs.length === 0 ? (
                            <div className="text-center py-6 text-slate-500 text-sm">
                                Eksik evrak numarası bulunmuyor.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {missingDocs.map((doc: any) => (
                                    <div
                                        key={doc.id}
                                        onClick={() => router.push('/dashboard/correspondence')}
                                        className="group flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border border-red-100 bg-red-50 hover:bg-red-100 hover:border-red-200 cursor-pointer transition-all"
                                    >
                                        <div className="space-y-1">
                                            <div className="font-medium text-slate-900 group-hover:text-red-900 transition-colors">
                                                {doc.subject}
                                            </div>
                                            <div className="text-xs text-slate-500 flex items-center gap-2">
                                                <span>{format(new Date(doc.date), 'dd MMMM yyyy', { locale: tr })}</span>
                                                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                <span>{companies.find((c: any) => c.id === doc.companyId)?.name}</span>
                                            </div>
                                        </div>
                                        <div className="mt-2 sm:mt-0 text-xs font-medium text-red-600 bg-white px-2 py-1 rounded border border-red-100 shadow-sm">
                                            Numara Gir &rarr;
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Hızlı İşlemler & Bilgiler</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* YI-UFE Display */}
                        <div className="p-4 bg-slate-50 rounded-lg border flex items-center justify-between">
                            <div>
                                <div className="text-sm font-medium text-slate-500">Son Yi-ÜFE Endeksi</div>
                                <div className="text-xs text-slate-400">
                                    {latestYiUfe ? `${latestYiUfe.year} - ${new Date(0, latestYiUfe.month - 1).toLocaleString('tr-TR', { month: 'long' })}` : 'Veri Yok'}
                                </div>
                            </div>
                            <div className="flex flex-col items-end">
                                <div className="text-2xl font-bold font-mono text-blue-700">
                                    {latestYiUfe ? latestYiUfe.index.toFixed(2) : '-'}
                                </div>
                                <div className="text-[10px] text-muted-foreground">Endeks Değeri</div>
                            </div>
                        </div>

                        <p className="text-sm text-slate-500">Kısayollar buraya gelecek.</p>
                    </CardContent>
                </Card>
            </div>

            {/* SITE LOG WIDGET */}
            {hasPermission('site-log', 'VIEW') && (
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                            <FileText className="w-5 h-5 text-blue-600" />
                            Son Şantiye Defteri Girişleri
                        </CardTitle>
                        <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/site-log')}>
                            Tümünü Gör
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {siteLogEntries.slice(0, 3).map((entry: any) => {
                                const site = sites.find((s: any) => s.id === entry.siteId);
                                const author = users.find((u: any) => u.id === entry.authorId);
                                return (
                                    <div key={entry.id} className="border-b last:border-0 pb-3 last:pb-0">
                                        <div className="flex justify-between items-start mb-1">
                                            <div className="font-semibold text-sm text-blue-900">{site?.name || 'Bilinmeyen Şantiye'}</div>
                                            <div className="text-xs text-slate-500">{format(new Date(entry.date), 'dd MMMM', { locale: tr })}</div>
                                        </div>
                                        <p className="text-sm text-slate-600 line-clamp-2">{entry.content}</p>
                                        <div className="mt-1 flex gap-2 text-xs text-slate-400">
                                            <span>{author?.name || 'Bilinmeyen Kullanıcı'}</span>
                                            {entry.weather && <span>• {entry.weather}</span>}
                                        </div>
                                    </div>
                                );
                            })}
                            {siteLogEntries.length === 0 && (
                                <div className="text-center text-sm text-slate-500 py-4">Henüz kayıt yok.</div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}


            <InsuranceProposalDialog
                open={!!selectedAlertForMail}
                onOpenChange={(v) => !v && setSelectedAlertForMail(null)}
                item={selectedAlertForMail}
            />
        </div >
    );
}
