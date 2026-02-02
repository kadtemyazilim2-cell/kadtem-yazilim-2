'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppStore } from '@/lib/store/use-store';
import { FileText, Wallet, Droplet, Users, AlertTriangle, ArrowRight, MapPin } from 'lucide-react';
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

import { updateVehicle as updateVehicleAction } from '@/actions/vehicle';
import { updateCorrespondence as updateCorrespondenceAction } from '@/actions/correspondence'; // [NEW]
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'; // Ensure these are imported
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FuelPurchaseList } from '@/components/modules/fuel/FuelPurchaseList';
import { FuelTransferList } from '@/components/modules/fuel/FuelTransferList';
import { SiteLogSummary } from '@/components/modules/dashboard/SiteLogSummary'; // [NEW]

import { toast } from 'sonner';

export default function DashboardPage() {
    const { companies, vehicles, correspondences, yiUfeRates, cashTransactions, personnel, fuelLogs, fuelTransfers, sites, fuelTanks, siteLogEntries, updateVehicle: updateVehicleStore, updateCorrespondence: updateCorrespondenceStore } = useAppStore();
    const userSites = useUserSites();
    const { user, hasPermission } = useAuth(); // To check if admin for other things if needed
    const router = useRouter();

    // Inspection Dialog State
    const [inspectionModalOpen, setInspectionModalOpen] = useState(false);
    const [selectedInspection, setSelectedInspection] = useState<any>(null);
    const [inspectionDate, setInspectionDate] = useState('');

    // [NEW] Fuel Dashboard States
    const [selectedFuelSiteId, setSelectedFuelSiteId] = useState('');
    const [fuelDateRange, setFuelDateRange] = useState<{ start: string, end: string }>({ start: '', end: '' });

    // [NEW] Missing Number Update Dialog States
    const [isEditCorrespondenceOpen, setIsEditCorrespondenceOpen] = useState(false);
    const [editCorrespondenceId, setEditCorrespondenceId] = useState('');
    const [editReferenceNumber, setEditReferenceNumber] = useState('');
    const [editRegistrationNumber, setEditRegistrationNumber] = useState('');
    const [showAllMissingDocs, setShowAllMissingDocs] = useState(false);

    const handleAlertClick = (item: any) => {
        if (item.type === 'Muayene') {
            setSelectedInspection(item);
            setInspectionDate(item.date ? item.date.split('T')[0] : '');
            setInspectionModalOpen(true);
        } else {
            setSelectedAlertForMail(item);
        }
    };

    const handleSaveInspectionDate = async () => {
        if (!selectedInspection || !inspectionDate) return;

        try {
            const res = await updateVehicleAction(selectedInspection.vehicleId, {
                inspectionExpiry: new Date(inspectionDate)
            });

            if (res.success) {
                toast.success('Muayene tarihi güncellendi.');
                updateVehicleStore(selectedInspection.vehicleId, { inspectionExpiry: new Date(inspectionDate).toISOString() });
                setInspectionModalOpen(false);
            } else {
                toast.error(res.error || 'Güncelleme başarısız.');
            }
        } catch (error) {
            console.error(error);
            toast.error('Bir hata oluştu.');
        }
    };

    const handleUpdateCorrespondence = async () => {
        if (!editCorrespondenceId) return;

        try {
            const res = await updateCorrespondenceAction(editCorrespondenceId, {
                referenceNumber: editReferenceNumber,
                registrationNumber: editRegistrationNumber
            });

            if (res.success) {
                toast.success('Evrak numaraları güncellendi.');
                updateCorrespondenceStore(editCorrespondenceId, {
                    referenceNumber: editReferenceNumber,
                    registrationNumber: editRegistrationNumber
                });
                setIsEditCorrespondenceOpen(false);
            } else {
                toast.error(res.error || 'Güncelleme başarısız.');
            }
        } catch (error) {
            console.error(error);
            toast.error('Bir hata oluştu.');
        }
    };

    // ... (rest of code)



    // Calculate Latest Yi-UFE
    const latestYiUfe = yiUfeRates.length > 0
        ? [...yiUfeRates].sort((a, b) => {
            if (a.year !== b.year) return b.year - a.year;
            return b.month - a.month;
        })[0]
        : null;

    // Get Missing Reference Numbers (excluding BANK) - Show to all authorized users (removed user filter)
    // Checks for missing Reference Number AND/OR Missing Registration Number
    const missingDocs = correspondences.filter((c: any) =>
        c.direction === 'OUTGOING' &&
        c.type !== 'BANK' &&
        (
            (!c.referenceNumber || c.referenceNumber.trim() === '') ||
            (!c.registrationNumber || c.registrationNumber.trim() === '')
        )
    );

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





    const [selectedAlertForMail, setSelectedAlertForMail] = useState<any>(null);

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Genel Bakış</h1>


            {/* Top Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* Financial Status List Card */}
                {hasPermission('cash-book', 'VIEW') && (
                    <Card className="bg-emerald-50 border-emerald-100 border shadow-sm col-span-1">
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
                )}

                {/* Insurance Alerts Card */}
                {hasPermission('vehicle', 'VIEW') && (
                    <Card className="bg-red-50 border-red-100 border shadow-sm col-span-2">
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
                                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                                    {upcomingExpirations.map((item) => (
                                        <div
                                            key={item.id}
                                            className="flex items-center justify-between text-sm p-2 rounded hover:bg-slate-100 cursor-pointer transition-colors border border-transparent hover:border-slate-200"
                                            onClick={() => handleAlertClick(item)}
                                            title={item.type === 'Muayene' ? "Tarihi Güncelle" : "Acenteye Mail Gönder"}
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
                )}

                {/* Quick Actions & Info Card (Moved Here) */}
                <Card className="col-span-1 shadow-sm border-slate-200">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-600">Bilgiler & Endeksler</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* YI-UFE Display */}
                        {(() => {
                            const sortedYiufe = [...yiUfeRates].sort((a, b) => {
                                if (a.year !== b.year) return b.year - a.year;
                                return b.month - a.month;
                            });
                            const current = sortedYiufe[0];
                            const previous = sortedYiufe[1];
                            const rate = (current && previous) ? ((current.index / previous.index) - 1) : 0;

                            return (
                                <div className="space-y-3">
                                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-xs text-slate-500 font-medium">Son Yi-ÜFE</span>
                                            <span className="text-[10px] text-slate-400">
                                                {current ? `${new Date(0, current.month - 1).toLocaleString('tr-TR', { month: 'long' })} ${current.year}` : '-'}
                                            </span>
                                        </div>
                                        <div className="text-xl font-bold font-mono text-blue-700">
                                            {current ? current.index.toFixed(2) : '-'}
                                        </div>
                                    </div>

                                    {previous && (
                                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-xs text-slate-500 font-medium">Önceki Ay</span>
                                                <span className="text-[10px] text-slate-400">
                                                    {new Date(0, previous.month - 1).toLocaleString('tr-TR', { month: 'long' })} {previous.year}
                                                </span>
                                            </div>
                                            <div className="text-lg font-semibold font-mono text-slate-600 flex items-center justify-between">
                                                {previous.index.toFixed(2)}
                                            </div>
                                        </div>
                                    )}

                                    {current && previous && (
                                        <div className="flex items-center justify-between pt-1">
                                            <span className="text-xs font-medium text-slate-500">Aylık Artış (Ortalama)</span>
                                            <span className={cn("text-sm font-bold", rate > 0 ? "text-green-600" : "text-slate-600")}>
                                                %{(rate * 100).toFixed(2)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </CardContent>
                </Card>
            </div>

            {/* Site Fuel Stocks */}
            {hasPermission('fuel', 'VIEW') && (
                <div className="space-y-4 mt-8">
                    <h3 className="text-xl font-bold tracking-tight text-slate-800 border-b pb-2">Aktif Şantiye Depo Stokları</h3>
                    <div className="grid gap-4" >
                        <SiteStockOverview tanks={fuelTanks} sites={userSites.filter(s => s.status === 'ACTIVE' && !s.finalAcceptanceDate)} />
                    </div>
                </div>
            )}

            {/* Fuel Tables Section */}
            {hasPermission('fuel', 'VIEW') && (
                <>
                    <div className="grid gap-4 md:grid-cols-1">
                        <FuelPurchaseList />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                        <DailyFuelChart fuelLogs={fuelLogs} fuelTransfers={fuelTransfers} fuelTanks={fuelTanks} sites={userSites} vehicles={vehicles} />
                    </div>
                </>
            )}

            {hasPermission('correspondence', 'VIEW') && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                    <Card className="col-span-7 border-red-200 shadow-sm">
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
                                    <div className="grid md:grid-cols-2 gap-2">
                                        {missingDocs.slice(0, showAllMissingDocs ? undefined : 4).map((doc: any) => (
                                            <div
                                                key={doc.id}
                                                onClick={() => {
                                                    setEditCorrespondenceId(doc.id);
                                                    setEditReferenceNumber(doc.referenceNumber || '');
                                                    setEditRegistrationNumber(doc.registrationNumber || '');
                                                    setIsEditCorrespondenceOpen(true);
                                                }}
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
                                                    {/* [NEW] Recipient and Text Excerpt */}
                                                    <div className="text-xs text-slate-600">
                                                        <span className="font-semibold text-slate-700">Muhatap:</span> {doc.receiver || '-'}
                                                    </div>
                                                    {doc.description && (
                                                        <div className="text-[11px] text-slate-500 italic line-clamp-1 border-l-2 border-slate-200 pl-1">
                                                            {doc.description}
                                                        </div>
                                                    )}

                                                    {/* Show missing types explicitly */}
                                                    <div className="flex gap-2">
                                                        {(!doc.registrationNumber) && <span className="text-[10px] bg-red-100 text-red-700 px-1 rounded">Karar No Eksik</span>}
                                                        {(!doc.referenceNumber) && <span className="text-[10px] bg-orange-100 text-orange-700 px-1 rounded">Sayı No Eksik</span>}
                                                    </div>
                                                </div>
                                                <div className="mt-2 sm:mt-0 text-xs font-medium text-red-600 bg-white px-2 py-1 rounded border border-red-100 shadow-sm">
                                                    Numara Gir &rarr;
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {missingDocs.length > 4 && (
                                        <div className="flex justify-center pt-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setShowAllMissingDocs(!showAllMissingDocs)}
                                                className="text-slate-500 hover:text-slate-800"
                                            >
                                                {showAllMissingDocs ? 'Daha Az Göster' : `Devamını Göster (+${missingDocs.length - 4})`}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* SITE LOG SUMMARY */}
            {hasPermission('site-log', 'VIEW') && (
                <SiteLogSummary siteLogEntries={siteLogEntries} sites={sites} users={users} />
            )}


            <InsuranceProposalDialog
                open={!!selectedAlertForMail}
                onOpenChange={(v) => !v && setSelectedAlertForMail(null)}
                item={selectedAlertForMail}
            />

            {/* Inspection Update Dialog */}
            <Dialog open={inspectionModalOpen} onOpenChange={setInspectionModalOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Muayene Tarihi Güncelle</DialogTitle>
                        <DialogDescription>
                            <span className="font-semibold text-slate-900">{selectedInspection?.plate}</span> aracı için yeni muayene tarihini giriniz.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="inspection-date">Yeni Muayene Bitiş Tarihi</Label>
                            <Input
                                id="inspection-date"
                                type="date"
                                value={inspectionDate}
                                onChange={(e) => setInspectionDate(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setInspectionModalOpen(false)}>İptal</Button>
                        <Button onClick={handleSaveInspectionDate} disabled={!inspectionDate}>Kaydet</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Correspondence Update Dialog */}
            <Dialog open={isEditCorrespondenceOpen} onOpenChange={setIsEditCorrespondenceOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Evrak Numaralarını Gir</DialogTitle>
                        <DialogDescription>
                            Eksik olan numaraları tamamlayınız.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label>Evrak Kayıt (Karar) Numarası</Label>
                            <Input
                                value={editRegistrationNumber}
                                onChange={(e) => setEditRegistrationNumber(e.target.value)}
                                placeholder="Örn: 2024/123"
                            />
                        </div>

                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditCorrespondenceOpen(false)}>İptal</Button>
                        <Button onClick={handleUpdateCorrespondence}>Kaydet</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    );
}
