'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppStore } from '@/lib/store/use-store';
import { FileText, Wallet, Droplet, Users, AlertTriangle, ArrowRight, MapPin, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SiteStockOverview } from '@/components/modules/dashboard/SiteStockOverview';
import { SiteSummaryTable } from '@/components/modules/dashboard/SiteSummaryTable';
import { useUserSites } from '@/hooks/use-user-access';
import { useAuth } from '@/lib/store/use-auth';
import { useRouter } from 'next/navigation';
import { format, isSameMonth, differenceInDays, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useMemo, useState, useEffect, useRef } from 'react';
import { InsuranceProposalDialog } from '@/components/modules/dashboard/InsuranceProposalDialog';
import { InsurancePolicyDialog } from '@/components/modules/vehicles/InsurancePolicyDialog';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { updateVehicle as updateVehicleAction } from '@/actions/vehicle';
import { updateCorrespondence as updateCorrespondenceAction } from '@/actions/correspondence';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FuelPurchaseList } from '@/components/modules/fuel/FuelPurchaseList';
import { FuelTransferList } from '@/components/modules/fuel/FuelTransferList';
import { SiteLogSummary } from '@/components/modules/dashboard/SiteLogSummary';
import { toast } from 'sonner';
import { getFuelLogs, getFuelTanks, getFuelTransfers } from '@/actions/fuel';
import { getAllTransactions } from '@/actions/transaction';
import { getSiteLogEntries } from '@/actions/site-log';

function serializeDashboard(data: any): any {
    return JSON.parse(JSON.stringify(data));
}

export function DashboardPageClient() {
    const [dashLoading, setDashLoading] = useState(true);
    const fetchedRef = useRef(false);

    // Fetch dashboard data client-side
    useEffect(() => {
        if (fetchedRef.current) return;
        fetchedRef.current = true;

        const loadDashboardData = async () => {
            try {
                // Dashboard needs at least last 15 days for fuel chart + current month
                const now = new Date();
                const fifteenDaysAgo = new Date(now);
                fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
                const monthStart = new Date(Math.min(fifteenDaysAgo.getTime(), new Date(now.getFullYear(), now.getMonth(), 1).getTime()));
                const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

                const [fuelLogsRes, fuelTanksRes, fuelTransfersRes, transactionsRes, siteLogsRes] = await Promise.all([
                    getFuelLogs({ limit: 1000, startDate: monthStart, endDate: monthEnd }),
                    getFuelTanks(),
                    getFuelTransfers({ limit: 1000 }),
                    getAllTransactions(),
                    getSiteLogEntries(),
                ]);

                useAppStore.setState({
                    fuelLogs: serializeDashboard(fuelLogsRes?.data || []),
                    fuelTanks: serializeDashboard(fuelTanksRes?.data || []),
                    fuelTransfers: serializeDashboard(fuelTransfersRes?.data || []),
                    cashTransactions: serializeDashboard(transactionsRes?.data || []),
                    siteLogEntries: serializeDashboard(siteLogsRes?.data || []),
                });
                console.log('[Dashboard] Data loaded');
            } catch (err) {
                console.error('[Dashboard] Failed to load data:', err);
            } finally {
                setDashLoading(false);
            }
        };

        loadDashboardData();
    }, []);

    // Read everything from store (IndexedDB may have previous data for instant display)
    const { companies, vehicles, correspondences, yiUfeRates, personnel, sites,
        fuelLogs, fuelTanks, fuelTransfers, siteLogEntries, cashTransactions,
        updateVehicle: updateVehicleStore, updateCorrespondence: updateCorrespondenceStore } = useAppStore();

    const userSites = useUserSites();
    const { user, hasPermission } = useAuth();
    const router = useRouter();

    // Permission-based redirect: if user can't access dashboard, go to first permitted page
    useEffect(() => {
        if (!user || user.role === 'ADMIN') return;

        const perms = (user.permissions || {}) as Record<string, string[]>;
        const dashPerm = perms['dashboard'];
        const hasDashboard = dashPerm && dashPerm.length > 0 && !dashPerm.includes('NONE');

        if (!hasDashboard) {
            // Same order as Sidebar NAV_ITEMS
            const NAV_ORDER = [
                { href: '/dashboard/correspondence', perm: 'correspondence' },
                { href: '/dashboard/vehicles', perm: 'vehicles' },
                { href: '/dashboard/fuel', perm: 'fuel' },
                { href: '/dashboard/fuel/movement', perm: 'movement' },
                { href: '/dashboard/cash-book', perm: 'cash-book' },
                { href: '/dashboard/new-tab', perm: 'personnel-attendance' },
                { href: '/dashboard/vehicle-attendance', perm: 'vehicle-attendance' },
                { href: '/dashboard/site-log', perm: 'site-log' },
                { href: '/dashboard/limit-value', perm: 'limit-value' },
            ];

            for (const nav of NAV_ORDER) {
                const p = perms[nav.perm];
                // Check main permission or sub-permissions (for personnel-attendance)
                const hasMain = p && p.length > 0 && !p.includes('NONE');
                const hasSub = nav.perm === 'personnel-attendance' && Object.keys(perms).some(k => k.startsWith('personnel-attendance.') && perms[k]?.length > 0 && !perms[k].includes('NONE'));

                if (hasMain || hasSub) {
                    router.replace(nav.href);
                    return;
                }
            }
        }
    }, [user, router]);

    const canEditDashboard = user?.role === 'ADMIN' || hasPermission('dashboard', 'EDIT');

    // ... (Rest of existing logic form page.tsx) ...
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

    // Calculate Latest Yi-UFE
    const latestYiUfe = yiUfeRates.length > 0
        ? [...yiUfeRates].sort((a, b) => {
            if (a.year !== b.year) return b.year - a.year;
            return b.month - a.month;
        })[0]
        : null;

    // Get Missing Reference Numbers (excluding BANK)
    const missingDocs = correspondences.filter((c: any) =>
        c.direction === 'OUTGOING' &&
        c.type !== 'BANK' &&
        (
            (!c.referenceNumber || c.referenceNumber.trim() === '') ||
            (!c.registrationNumber || c.registrationNumber.trim() === '')
        )
    );

    // Group missing docs by creator for summary
    const missingDocsByUser = useMemo(() => {
        const storeUsers = useAppStore.getState().users || [];
        const grouped: Record<string, { name: string; count: number }> = {};

        missingDocs.forEach((doc: any) => {
            const userId = doc.createdByUserId;
            if (!grouped[userId]) {
                const u = storeUsers.find((u: any) => u.id === userId);
                grouped[userId] = { name: u?.name || 'Bilinmeyen', count: 0 };
            }
            grouped[userId].count++;
        });

        return Object.values(grouped).sort((a, b) => b.count - a.count);
    }, [missingDocs]);

    // 1. Financial Status (Balance per User)
    // [FIX] Use prop `cashTransactions` instead of store for immediate calculation
    const userBalances = useMemo(() => {
        const balances: Record<string, { balance: number; monthCashExp: number; monthCCExp: number }> = {};
        const currentMonth = new Date();

        cashTransactions.forEach((t: any) => {
            const targetUser = t.responsibleUserId || t.createdByUserId;
            if (!balances[targetUser]) balances[targetUser] = { balance: 0, monthCashExp: 0, monthCCExp: 0 };

            if (t.paymentMethod !== 'CREDIT_CARD') {
                const amount = t.type === 'INCOME' ? Number(t.amount || 0) : -Number(t.amount || 0);
                balances[targetUser].balance += amount;
            }

            if (t.date && isSameMonth(new Date(t.date), currentMonth)) {
                if (t.type === 'EXPENSE') {
                    const amt = Number(t.amount || 0);
                    if (t.paymentMethod === 'CREDIT_CARD') {
                        balances[targetUser].monthCCExp += amt;
                    } else {
                        balances[targetUser].monthCashExp += amt;
                    }
                }
            }
        });

        const { users } = useAppStore.getState(); // Safe to peek if store initialized in layout
        // Or fetch users from hook above (preferred) which depends on store
        // We use `useAppStore()` hook `users` which is fine.

        return Object.entries(balances)
            .map(([userId, stats]) => {
                const user = (useAppStore.getState().users || users || []).find((u: any) => u.id === userId); // Fallback
                return {
                    id: userId,
                    name: user?.name || 'Bilinmeyen Kullanıcı',
                    ...stats
                };
            })
            .filter(u => u.balance !== 0 || u.monthCashExp > 0 || u.monthCCExp > 0)
            .sort((a, b) => b.balance - a.balance);
    }, [cashTransactions, personnel]); // Removed users/store dependency causing loops, rely on ref/hook

    // 2. Fuel Consumption
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
                if (!site || site.status !== 'ACTIVE' || site.finalAcceptanceDate) return null;
                return {
                    id: siteId,
                    name: site.name,
                    liters
                };
            })
            .filter((s): s is { id: string; name: string; liters: number } => s !== null && s.liters > 0)
            .sort((a, b) => b.liters - a.liters);
    }, [fuelLogs, sites]);

    // 3. Personnel Count
    const sitePersonnelCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        sites.forEach((site: any) => {
            counts[site.id] = 0;
        });

        personnel.forEach((p: any) => {
            if (p.status !== 'LEFT' && p.siteId && counts[p.siteId] !== undefined) {
                counts[p.siteId]++;
            }
        });

        return Object.entries(counts)
            .map(([siteId, count]) => {
                const site = sites.find((s: any) => s.id === siteId);
                if (!site || site.status !== 'ACTIVE' || site.finalAcceptanceDate) return null;
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
            if (v.status === 'SOLD' || v.status === 'PASSIVE') return;
            if (v.ownership === 'RENTAL') return;

            if (v.insuranceExpiry) {
                const date = parseISO(v.insuranceExpiry);
                const days = differenceInDays(date, today);
                if (days <= 30) {
                    alerts.push({
                        id: v.id + '-ins',
                        vehicleId: v.id,
                        plate: v.plate,
                        type: 'Trafik Sigortası',
                        days,
                        date: v.insuranceExpiry,
                        agencyName: v.insuranceAgency,
                        proposalAgencies: v.lastTrafficProposalAgencies || [],
                        proposalDate: v.lastTrafficProposalDate,
                        vehicleBrand: v.brand,
                        vehicleModel: v.model
                    });
                }
            }
            if (v.kaskoExpiry) {
                const date = parseISO(v.kaskoExpiry);
                const days = differenceInDays(date, today);
                if (days <= 30) {
                    alerts.push({
                        id: v.id + '-kas',
                        vehicleId: v.id,
                        plate: v.plate,
                        type: 'Kasko',
                        days,
                        date: v.kaskoExpiry,
                        agencyName: v.kaskoAgency,
                        proposalAgencies: v.lastKaskoProposalAgencies || [],
                        proposalDate: v.lastKaskoProposalDate,
                        vehicleBrand: v.brand,
                        vehicleModel: v.model
                    });
                }
            }
            if (v.inspectionExpiry) {
                const date = parseISO(v.inspectionExpiry);
                const days = differenceInDays(date, today);
                if (days <= 30) {
                    alerts.push({
                        id: v.id + '-insp',
                        vehicleId: v.id,
                        plate: v.plate,
                        type: 'Muayene',
                        days,
                        date: v.inspectionExpiry,
                        agencyName: 'TÜVTÜRK',
                        proposalAgencies: [],
                        proposalDate: null,
                        vehicleBrand: v.brand,
                        vehicleModel: v.model
                    });
                }
            }
        });

        return alerts.sort((a, b) => a.days - b.days);
    }, [vehicles]);

    const [selectedAlertForMail, setSelectedAlertForMail] = useState<any>(null);
    const [selectedAlertForPolicy, setSelectedAlertForPolicy] = useState<any>(null);

    const handlePolicyClick = (item: any) => {
        setSelectedAlertForPolicy({
            vehicleId: item.vehicleId,
            type: item.type === 'Trafik Sigortası' ? 'TRAFFIC' : (item.type === 'Kasko' ? 'KASKO' : '')
        });
    };

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Genel Bakış</h1>

            <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-12">
                {/* 1. Indices */}
                {hasPermission('dashboard.indices', 'VIEW') && (
                    <Card className="col-span-1 md:col-span-1 lg:col-span-3 shadow-sm border-slate-200 h-full">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-slate-600">Bilgiler & Endeksler</CardTitle>
                            <FileText className="h-4 w-4 text-slate-400" />
                        </CardHeader>
                        <CardContent className="space-y-4 pt-2">
                            {(() => {
                                const sortedYiufe = [...yiUfeRates].sort((a, b) => {
                                    if (a.year !== b.year) return b.year - a.year;
                                    return b.month - a.month;
                                });
                                const current = sortedYiufe[0];
                                const prev = sortedYiufe[1];
                                const change = (current && prev) ? ((current.index / prev.index) - 1) : 0;

                                if (!current) return <div className="text-sm text-slate-500 py-4">Veri yok.</div>;

                                return (
                                    <div className="flex flex-col space-y-4">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium text-slate-500 mb-1">
                                                {new Date(0, current.month - 1).toLocaleString('tr-TR', { month: 'long' })} {current.year}
                                            </span>
                                            <span className="text-2xl font-bold text-slate-900 font-mono tracking-tight">
                                                {current.index.toFixed(2)}
                                            </span>
                                        </div>
                                        {prev && (
                                            <div className="flex flex-col pt-2 border-t border-slate-100">
                                                <span className="text-xs text-slate-400 mb-1">
                                                    {new Date(0, prev.month - 1).toLocaleString('tr-TR', { month: 'long' })} {prev.year}
                                                </span>
                                                <span className="text-lg font-semibold text-slate-700 font-mono">
                                                    {prev.index.toFixed(2)}
                                                </span>
                                            </div>
                                        )}
                                        {prev && (
                                            <div className="pt-2">
                                                <div className={cn("flex items-center w-full justify-center py-1.5 rounded-md text-sm font-bold",
                                                    change > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                                )}>
                                                    {change > 0 ? '+' : ''}%{(change * 100).toFixed(2)}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </CardContent>
                    </Card>
                )}

                {/* 2. Financial */}
                {hasPermission('dashboard.financial', 'VIEW') && (
                    <Card className="col-span-1 md:col-span-1 lg:col-span-4 bg-emerald-50 border-emerald-100 border shadow-sm h-full">
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
                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                    {userBalances.map((u) => {
                                        const canEditFinancial = user?.role === 'ADMIN' || hasPermission('dashboard.financial', 'EDIT') || hasPermission('dashboard', 'EDIT');
                                        const Container = (canEditFinancial ? Link : 'div') as any;
                                        const props = canEditFinancial ? { href: `/dashboard/cash-book?userId=${u.id}` } : {};
                                        return (
                                            <Container
                                                key={u.id}
                                                {...props}
                                                className={cn(
                                                    "flex flex-col p-2 border-b last:border-0 border-slate-100 rounded transition-colors",
                                                    canEditFinancial ? "hover:bg-slate-50 cursor-pointer" : "bg-transparent cursor-default opacity-80"
                                                )}
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="font-medium text-slate-700 text-xs sm:text-sm">{u.name}</span>
                                                    <span className={cn("font-bold font-mono whitespace-nowrap text-sm", u.balance < 0 ? "text-red-600" : "text-emerald-700")}>
                                                        {u.balance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3 text-[9px] text-slate-400 mt-1 font-mono pl-1">
                                                    <span>K.K: {u.monthCCExp.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                                    <span>Nakit: {u.monthCashExp.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                                </div>
                                            </Container>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* 3. Upcoming Payments */}
                {hasPermission('dashboard.upcoming-payments', 'VIEW') && (
                    <Card className="col-span-1 md:col-span-2 lg:col-span-5 bg-red-50 border-red-100 border shadow-sm h-full flex flex-col">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 shrink-0">
                            <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-red-600" />
                                Yaklaşan Ödemeler (Sigorta/Kasko/Muayene)
                            </CardTitle>
                            <span className="text-xs font-medium bg-white px-2 py-0.5 rounded text-slate-500 shadow-sm border border-slate-100">
                                {upcomingExpirations.length} Kayıt
                            </span>
                        </CardHeader>
                        <CardContent className="pt-2 flex-grow overflow-hidden flex flex-col">
                            {upcomingExpirations.length === 0 ? (
                                <div className="text-sm text-slate-500 py-4 text-center">Yaklaşan ödeme bulunmuyor.</div>
                            ) : (
                                <div className="space-y-2 overflow-y-auto pr-1 flex-grow scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                                    {upcomingExpirations.map((item) => {
                                        const vehicle = vehicles.find((v: any) => v.id === item.vehicleId);
                                        const canEditPayments = user?.role === 'ADMIN' || hasPermission('dashboard.upcoming-payments', 'EDIT') || hasPermission('dashboard', 'EDIT');

                                        // Agency Logic (Simplified for brevity, matches page.tsx)
                                        let latestAgency: string | null = null;
                                        let latestPolicyDate: string | null = null;
                                        if (vehicle?.insuranceHistory?.length) {
                                            const matchType = item.type === 'Trafik Sigortası' ? 'TRAFFIC' : (item.type === 'Kasko' ? 'KASKO' : null);
                                            if (matchType) {
                                                const matchingRecords = vehicle.insuranceHistory.filter((r: any) => r.type === matchType && r.agency).sort((a: any, b: any) => (b.createdAt || b.endDate || '').localeCompare(a.createdAt || a.endDate || ''));
                                                if (matchingRecords.length > 0) { latestAgency = matchingRecords[0].agency; latestPolicyDate = matchingRecords[0].endDate ? new Date(matchingRecords[0].endDate).toLocaleDateString('tr-TR') : null; }
                                            }
                                        }
                                        if (!latestAgency) {
                                            if (item.type === 'Trafik Sigortası') latestAgency = vehicle?.insuranceAgency || null;
                                            else if (item.type === 'Kasko') latestAgency = vehicle?.kaskoAgency || null;
                                        }

                                        return (
                                            <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between text-sm p-1.5 rounded bg-white hover:bg-slate-50 transition-colors border border-slate-100 hover:border-slate-200 gap-1.5 shadow-sm">
                                                <div className="flex flex-col gap-0.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold font-mono text-slate-800 text-sm">{item.plate}</span>
                                                        <span className={cn("text-[9px] font-bold px-1.5 py-0 rounded-full border", item.days <= 7 ? "bg-red-50 text-red-700 border-red-100 animate-pulse" : "bg-orange-50 text-orange-700 border-orange-100")}>
                                                            {item.days < 0 ? `${Math.abs(item.days)} Gün Geçti` : `${item.days} Gün Kaldı`}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                                                        <span className="font-medium text-slate-700">{item.type}</span>
                                                        <span className="text-slate-400">•</span>
                                                        <span className="text-slate-500">{item.vehicleBrand} {item.vehicleModel}</span>
                                                    </div>
                                                    {latestAgency && <div className="text-[10px] font-medium mt-0.5 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded w-fit border border-emerald-200">🏢 Son Acenta: {latestAgency}</div>}
                                                    {item.proposalAgencies?.length > 0 && (
                                                        <div className="text-[10px] font-medium mt-0.5 bg-blue-50 text-blue-700 px-2 py-0.5 rounded w-fit border border-blue-200">
                                                            📨 Teklif: {item.proposalAgencies.join(', ')}
                                                            {item.proposalDate && <span className="text-blue-400 ml-1">({format(new Date(item.proposalDate), 'dd.MM.yyyy')})</span>}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                                    {item.type === 'Muayene' ? (canEditPayments && <Button variant="outline" size="sm" className="h-7 text-xs bg-slate-50 hover:bg-slate-100" onClick={() => handleAlertClick(item)}>Tarih Gir</Button>) : (canEditPayments && <> <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-700 hover:bg-blue-50 hover:text-blue-800" onClick={() => handleAlertClick(item)}>Teklif İste</Button> <Button variant="outline" size="sm" className="h-7 text-xs text-green-700 border-green-200 hover:bg-green-50 hover:border-green-300" onClick={() => handlePolicyClick(item)}>Poliçe Gir</Button> </>)}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>

            <div className="grid gap-6 grid-cols-1 lg:grid-cols-12">
                {/* Site Stocks */}
                {hasPermission('dashboard.stocks', 'VIEW') && (
                    <div className="col-span-1 md:col-span-1 lg:col-span-12 space-y-4">
                        <div className="flex items-center justify-between border-b pb-2">
                            <h3 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
                                <Droplet className="h-5 w-5 text-blue-600" />
                                Aktif Şantiye Depo Stokları
                            </h3>
                        </div>
                        <SiteStockOverview tanks={fuelTanks} sites={userSites.filter(s => s.status === 'ACTIVE' && !s.finalAcceptanceDate)} />
                    </div>
                )
                }

                {/* Fuel & Charts */}
                <>
                    {/* Fuel Purchase List */}
                    {hasPermission('dashboard.fuel-purchases', 'VIEW') && (
                        <div className="col-span-1 md:col-span-1 lg:col-span-12 h-full">
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                                    <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                                        <Wallet className="h-4 w-4 text-slate-400" />
                                        Son Yakıt Alımları
                                    </h4>
                                </div>
                                <div className="flex-grow p-0">
                                    <FuelPurchaseList isWidget={true} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Site Summary Table */}
                    {hasPermission('dashboard.fuel-chart', 'VIEW') && (
                        <div className="col-span-1 md:col-span-1 lg:col-span-12 h-full">
                            <SiteSummaryTable sites={userSites} personnel={personnel} vehicles={vehicles} fuelLogs={fuelLogs} fuelTanks={fuelTanks} fuelTransfers={fuelTransfers} cashTransactions={cashTransactions} />
                        </div>
                    )}
                </>

                {/* Missing Docs */}
                {hasPermission('dashboard.missing-docs', 'VIEW') && (
                    <div className="col-span-1 md:col-span-1 lg:col-span-12">
                        <Card className="border-red-200 shadow-sm bg-white">
                            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
                                <CardTitle className="flex items-center gap-2 text-red-700 text-base">
                                    <FileText className="h-5 w-5" />
                                    Eksik Evrak Numaraları
                                    <span className="ml-auto text-xs font-normal text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200 shadow-sm">
                                        {missingDocs.length} Adet
                                    </span>
                                </CardTitle>
                                {/* Per-User Summary */}
                                {missingDocsByUser.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {missingDocsByUser.map((u) => (
                                            <div key={u.name} className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
                                                <span className="text-xs font-medium text-slate-700">{u.name}</span>
                                                <span className="text-xs font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full min-w-[20px] text-center">{u.count}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardHeader>
                            <CardContent className="p-0">
                                {missingDocs.length === 0 ? (
                                    <div className="text-center py-8 text-slate-500 text-sm">
                                        Eksik evrak numarası bulunmuyor.
                                    </div>
                                ) : (
                                    <>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm text-left">
                                                <thead className="text-xs text-slate-500 uppercase bg-slate-50/80 border-b">
                                                    <tr>
                                                        <th className="px-4 py-3 font-medium">Tarih</th>
                                                        <th className="px-4 py-3 font-medium">Konu</th>
                                                        <th className="px-4 py-3 font-medium">Muhatap</th>
                                                        <th className="px-4 py-3 font-medium text-right">İşlem</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {missingDocs.slice(0, showAllMissingDocs ? undefined : 5).map((doc: any) => {
                                                        const cleanText = (html: string) => { return html ? html.replace(/<[^>]*>/g, '') : ''; };
                                                        return (
                                                            <tr key={doc.id} className="bg-white hover:bg-slate-50 transition-colors">
                                                                <td className="px-4 py-3 whitespace-nowrap text-slate-600 font-mono text-xs">
                                                                    {format(new Date(doc.date), 'dd.MM.yyyy')}
                                                                </td>
                                                                <td className="px-4 py-3 max-w-[300px]">
                                                                    <div className="truncate font-medium text-slate-900 text-xs sm:text-sm" title={cleanText(doc.subject)}>
                                                                        {cleanText(doc.subject)}
                                                                    </div>
                                                                    {doc.description && <div className="text-[10px] text-slate-500 truncate mt-0.5" title={cleanText(doc.description)}>{cleanText(doc.description)}</div>}
                                                                </td>
                                                                <td className="px-4 py-3 max-w-[200px]">
                                                                    <div className="truncate text-slate-700 text-xs" title={doc.senderReceiver}>{doc.senderReceiver || '-'}</div>
                                                                    <div className="text-[10px] text-slate-400 truncate">{companies.find((c: any) => c.id === doc.companyId)?.name}</div>
                                                                </td>
                                                                <td className="px-4 py-3 text-right">
                                                                    {(canEditDashboard || hasPermission('dashboard.missing-docs', 'EDIT')) && (
                                                                        <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700" onClick={() => { setEditCorrespondenceId(doc.id); setEditReferenceNumber(doc.referenceNumber || ''); setEditRegistrationNumber(doc.registrationNumber || ''); setIsEditCorrespondenceOpen(true); }}>Numara Gir</Button>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                        {missingDocs.length > 5 && (
                                            <div className="flex justify-center py-2 border-t border-slate-100 bg-slate-50/30">
                                                <Button variant="ghost" size="sm" onClick={() => setShowAllMissingDocs(!showAllMissingDocs)} className="text-xs text-slate-500 hover:text-slate-800 h-7">
                                                    {showAllMissingDocs ? 'Listeyi Daralt' : `Tümünü Göster (+${missingDocs.length - 5})`}
                                                </Button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                )
                }

                {/* SITE LOG SUMMARY */}
                {
                    hasPermission('dashboard.site-log', 'VIEW') && (
                        <div className="col-span-1 md:col-span-1 lg:col-span-12">
                            <SiteLogSummary siteLogEntries={siteLogEntries} sites={sites} users={useAppStore.getState().users || []} />
                        </div>
                    )
                }
            </div>

            <InsuranceProposalDialog
                open={!!selectedAlertForMail}
                onOpenChange={(v) => !v && setSelectedAlertForMail(null)}
                item={selectedAlertForMail}
            />

            {selectedAlertForPolicy && (
                <InsurancePolicyDialog
                    open={!!selectedAlertForPolicy}
                    onOpenChange={(v) => !v && setSelectedAlertForPolicy(null)}
                    vehicle={vehicles.find((v: any) => v.id === selectedAlertForPolicy.vehicleId) as any}
                    defaultType={selectedAlertForPolicy.type}
                />
            )
            }

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
                            <Input id="inspection-date" type="date" value={inspectionDate} onChange={(e) => setInspectionDate(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setInspectionModalOpen(false)}>İptal</Button>
                        <Button onClick={handleSaveInspectionDate} disabled={!inspectionDate}>Kaydet</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
                            <Input value={editRegistrationNumber} onChange={(e) => setEditRegistrationNumber(e.target.value)} placeholder="Örn: 2024/123" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditCorrespondenceOpen(false)}>İptal</Button>
                        <Button onClick={handleUpdateCorrespondence}>Kaydet</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
